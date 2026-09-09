#!/usr/bin/env node
/**
 * agents/<name>.md → codex/agents/<name>.toml（Codex custom agent）。改 md 後重跑；--check 只比對不寫檔。
 * 全部從 frontmatter 推導、不另維護清單：tools 含 Write / Edit / NotebookEdit → workspace-write，否則 read-only；
 * tools 內 mcp__<server>__ 前綴 → 需要的 MCP server，對照 MCP_TEMPLATES（缺對照 exit 1）；model 對照 MODEL（缺 exit 1）。
 * developer_instructions 用 TOML literal string '''…'''（不處理跳脫，Windows 路徑 / regex 安全）；本文含 ''' 就 exit 1。
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
function frontmatter(t) { const m = t.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/); if (!m) throw new Error('no frontmatter'); return { head: m[1], body: m[2] }; }
function field(h, k) { const m = h.match(new RegExp(`^${k}:[ \\t]*(.*)$`, 'm')); return m ? m[1].trim() : ''; }
/** description：支援 | |- > >-（只吃 [ \t]，不用 \s——\s 會吃掉換行留裸 \r） */
function description(h) {
  const multi = h.match(/^description:[ \t]*[|>]-?[ \t]*\n((?:(?:[ \t]+.*|[ \t]*)(?:\n|$))*)/m);
  const raw = multi && multi[1].trim() ? multi[1] : field(h, 'description');
  return raw.split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
}
function tools(h) { const m = h.match(/^tools:[ \t]*(\[[\s\S]*?\])/m); if (!m) return []; return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]); }
const q = (s) => JSON.stringify(s);
export function render(name, md) {
  const { head, body } = frontmatter(strip(md));
  const tl = tools(head);
  const write = tl.some((t) => /^(Write|Edit|NotebookEdit)$/.test(t));
  const servers = [...new Set(tl.map((t) => (t.match(/^mcp__([^_]+)__/) || [])[1]).filter(Boolean))];
  const missing = servers.filter((s) => !MCP_TEMPLATES[s]); if (missing.length) throw new Error(`${name}: 缺 MCP 範本 [${missing}]，先在 MCP_TEMPLATES 加`);
  const mk = field(head, 'model') || 'sonnet'; if (!MODEL[mk]) throw new Error(`${name}: 未知 model "${mk}"，先在 MODEL 加對照`);
  if (body.includes("'''")) throw new Error(`${name}: 本文含 ''' 無法用 literal string`);
  const lines = [`# 由 scripts/gen-codex-agents.mjs 從 agents/${name}.md 產生，勿手改；改 md 後重跑 node scripts/gen-codex-agents.mjs`,
    `name = ${q(name)}`, `description = ${q(description(head))}`, `model = ${q(MODEL[mk])}`, 'model_reasoning_effort = "high"',
    `sandbox_mode = ${q(write ? 'workspace-write' : 'read-only')}`, "developer_instructions = '''", body.trimEnd(), "'''", ''];
  for (const s of servers) lines.push(...MCP_TEMPLATES[s], '');
  return lines.join('\n');
}
function main() {
  const check = process.argv.includes('--check'); const outDir = join(REPO, 'codex', 'agents'); if (!check) mkdirSync(outDir, { recursive: true });
  let bad = 0;
  for (const f of readdirSync(join(REPO, 'agents')).filter((x) => x.endsWith('.md')).sort()) {
    const name = f.replace(/\.md$/, ''); const out = render(name, readFileSync(join(REPO, 'agents', f), 'utf8')); const p = join(outDir, `${name}.toml`);
    if (check) { if (!existsSync(p) || strip(readFileSync(p, 'utf8')) !== out) { bad++; console.log(`STALE ${name}.toml`); } } else writeFileSync(p, out);
  }
  if (check) console.log(bad ? `${bad} STALE` : 'PASS codex/agents 與 agents/*.md 一致');
  return bad ? 1 : 0;
}
function isMainModule() { const n = (p) => { try { return realpathSync.native(p).replace(/\\/g, '/').toLowerCase(); } catch { return resolve(p).replace(/\\/g, '/').toLowerCase(); } }; return !!process.argv[1] && n(process.argv[1]) === n(fileURLToPath(import.meta.url)); }
if (isMainModule()) { try { process.exitCode = main(); } catch (e) { console.error(`[gen-codex-agents] ${e.message}`); process.exitCode = 1; } }
