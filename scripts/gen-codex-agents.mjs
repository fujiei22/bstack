#!/usr/bin/env node
/**
 * agents/<name>.md → codex/agents/<name>.toml（Codex custom agent）。改 md 後重跑；--check 只比對不寫檔。
 * 全部從 frontmatter 推導、不另維護清單：tools 含 Write / Edit / NotebookEdit → workspace-write，否則 read-only；
 * tools 內 mcp__<server>__ 前綴 → 需要的 MCP server，對照 MCP_TEMPLATES（缺對照 exit 1）；model 對照 MODEL（缺 exit 1）。
 * developer_instructions 用 TOML literal string '''…'''（不處理跳脫，Windows 路徑 / regex 安全）；本文含 ''' 就 exit 1。
 * 產物檔頭帶 plugin 版本戳（讀 .codex-plugin/plugin.json）：版本升了 --check 就紅，逼人重產、安裝腳本才會複製新版。
 * 也掃孤兒：codex/agents/ 裡沒有對應 agents/<name>.md 的 TOML 一律報錯（刪掉的 agent 不該被 install-codex.ps1 繼續裝進使用者的 ~/.codex/agents/）。
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
// Codex 模型名漂移時只改這裡（2026-09：gpt-5.4 系列已退役）
const MODEL = { sonnet: 'gpt-5.6-terra', opus: 'gpt-5.6-sol', haiku: 'gpt-5.6-luna' };
// server 名必須與 agent 的 mcp__<server>__ 一致；整段註解輸出，使用者取消註解並填自己的 command
const MCP_TEMPLATES = {
  mysql: ['# [mcp_servers.mysql]', '# command = "npx"', '# args = ["-y", "<你的 mysql MCP 套件>"]', '# # 工具名必須是 mcp__mysql__mysql_query；server 名恰為 mysql 才對得上 agent 的 tools'],
  playwright: ['# [mcp_servers.playwright]', '# command = "npx"', '# args = ["-y", "@playwright/mcp@0.0.68"]', '# # 版本 pin 到 2026-09-09 實測；server 名恰為 playwright'],
};
const strip = (t) => t.replace(/^﻿/, '').replace(/\r\n/g, '\n');

/** 切 frontmatter：回 { head（--- 之間）, body（之後全文）}；沒有 frontmatter 就 throw。 */
function frontmatter(t) { const m = t.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/); if (!m) throw new Error('no frontmatter'); return { head: m[1], body: m[2] }; }
/** 取單行 key 的值（去頭尾空白）；沒有回空字串。 */
function field(h, k) { const m = h.match(new RegExp(`^${k}:[ \\t]*(.*)$`, 'm')); return m ? m[1].trim() : ''; }
/**
 * description：支援 `| |- > >-` 區塊寫法與單行寫法，多行合併成一行（Codex TOML 的 description 是單行字串）。
 * 只吃 [ \t] 不用 \s——\s 會吃掉換行留裸 \r。區塊指示符後面沒有內容（`description: |` 下面沒縮排行）→ 回空字串（fail-closed，
 * 不能退到單行分支抓到字面 `|` 寫進 TOML）。
 */
function description(h) {
  const single = field(h, 'description');
  if (/^[|>]-?$/.test(single)) {
    const multi = h.match(/^description:[ \t]*[|>]-?[ \t]*\n((?:(?:[ \t]+.*|[ \t]*)(?:\n|$))*)/m);
    const raw = multi ? multi[1] : '';
    return raw.split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
  }
  return single;
}
/**
 * tools：三種寫法都認——JSON 陣列 `tools: ["Read", "Grep"]`、逗號 `tools: Read, Grep`、YAML 清單（`- Read` 逐行）。
 * 有 `tools:` 這個 key 卻解析不到任何名字 → throw：靜默變 read-only 又沒 MCP 範本比直接失敗糟。
 */
function tools(h) {
  const arr = h.match(/^tools:[ \t]*(\[[\s\S]*?\])/m);
  let names = [];
  if (arr) names = [...arr[1].matchAll(/"([^"]+)"|'([^']+)'/g)].map((x) => x[1] || x[2]);
  else {
    const line = field(h, 'tools');
    if (line) names = line.split(',').map((s) => s.trim()).filter(Boolean);
    else {
      const list = h.match(/^tools:[ \t]*\n((?:[ \t]*-[ \t]*.+\n?)+)/m);
      if (list) names = list[1].split('\n').map((l) => l.replace(/^[ \t]*-[ \t]*/, '').trim()).filter(Boolean);
    }
  }
  if (/^tools:/m.test(h) && !names.length) throw new Error('tools: 有這個 key 卻解析不到任何工具名（認 JSON 陣列 / 逗號 / YAML 清單）');
  return names;
}
const q = (s) => JSON.stringify(s);
/** plugin 版本（.codex-plugin/plugin.json）；讀不到回 unknown——契約 P13 另守它存在。 */
function pluginVersion() { try { return JSON.parse(readFileSync(join(REPO, '.codex-plugin', 'plugin.json'), 'utf8')).version || 'unknown'; } catch { return 'unknown'; }
}
/**
 * 一個 agent md → TOML 字串（純函式，契約 P15 直接 import 測）。
 * 推導：tools 含 Write / Edit / NotebookEdit → workspace-write；mcp__<server>__ 前綴（server 名到下一個 __ 為止，可含底線）→ MCP 範本註解。
 * throw 的三種情況：缺 MCP 範本、未知 model、本文含 '''。
 */
export function render(name, md, version = pluginVersion()) {
  const { head, body } = frontmatter(strip(md));
  const tl = tools(head);
  const write = tl.some((t) => /^(Write|Edit|NotebookEdit)$/.test(t));
  const servers = [...new Set(tl.map((t) => (t.match(/^mcp__(.+?)__/) || [])[1]).filter(Boolean))];
  const missing = servers.filter((s) => !MCP_TEMPLATES[s]); if (missing.length) throw new Error(`${name}: 缺 MCP 範本 [${missing}]，先在 MCP_TEMPLATES 加`);
  const mk = field(head, 'model') || 'sonnet'; if (!MODEL[mk]) throw new Error(`${name}: 未知 model "${mk}"，先在 MODEL 加對照`);
  if (body.includes("'''")) throw new Error(`${name}: 本文含 ''' 無法用 literal string`);
  const lines = [`# 由 scripts/gen-codex-agents.mjs 從 agents/${name}.md 產生（bstack ${version}），勿手改；改 md 後重跑 node scripts/gen-codex-agents.mjs`,
    `name = ${q(name)}`, `description = ${q(description(head))}`, `model = ${q(MODEL[mk])}`, 'model_reasoning_effort = "high"',
    `sandbox_mode = ${q(write ? 'workspace-write' : 'read-only')}`, "developer_instructions = '''", body.trim(), "'''", ''];
  for (const s of servers) lines.push(...MCP_TEMPLATES[s], '');
  return lines.join('\n');
}
/** CLI：無參數重產 codex/agents/*.toml；--check 只比對（過期 / 孤兒都算 STALE）。回 exit code。 */
function main() {
  const check = process.argv.includes('--check'); const outDir = join(REPO, 'codex', 'agents'); if (!check) mkdirSync(outDir, { recursive: true });
  const version = pluginVersion();
  let bad = 0;
  const names = readdirSync(join(REPO, 'agents')).filter((x) => x.endsWith('.md')).sort().map((f) => f.replace(/\.md$/, ''));
  for (const name of names) {
    const out = render(name, readFileSync(join(REPO, 'agents', `${name}.md`), 'utf8'), version); const p = join(outDir, `${name}.toml`);
    if (check) { if (!existsSync(p) || strip(readFileSync(p, 'utf8')) !== out) { bad++; console.log(`STALE ${name}.toml`); } } else writeFileSync(p, out);
  }
  // 孤兒：有 TOML 沒 md（agent 被刪或改名）。產生模式也只報不刪——刪檔交給人
  const orphans = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith('.toml') && !names.includes(f.replace(/\.toml$/, ''))) : [];
  for (const f of orphans) { bad++; console.log(`ORPHAN codex/agents/${f}（agents/ 沒有對應的 md，請刪掉）`); }
  if (check) console.log(bad ? `${bad} STALE` : 'PASS codex/agents 與 agents/*.md 一致');
  return bad ? 1 : 0;
}
/** 直接執行才跑 CLI；被 import（契約 P15）時只匯出 render。比 realpath 免掉大小寫 / 8.3 短檔名差異。 */
function isMainModule() { const n = (p) => { try { return realpathSync.native(p).replace(/\\/g, '/').toLowerCase(); } catch { return resolve(p).replace(/\\/g, '/').toLowerCase(); } }; return !!process.argv[1] && n(process.argv[1]) === n(fileURLToPath(import.meta.url)); }
if (isMainModule()) { try { process.exitCode = main(); } catch (e) { console.error(`[gen-codex-agents] ${e.message}`); process.exitCode = 1; } }
