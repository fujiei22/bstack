/**
 * 文本瘦身量測（一次性腳本，隨 spec 歸檔）：每檔行 / bytes / 估 token / description 估 token，印表；
 *   node measure.mjs            印表
 *   node measure.mjs --assert   對 plan 目標斷言（description ≤2000 tok；B 非空行 ≤ 各 task 目標加總 / bytes ≤140600；每檔 ≤ 目標 +10%；rules.md ≤110 非空行 / ≤14000 bytes）
 * token 估法：CJK 1.2 / 字、其餘 3.8 字元 / token（粗估，兩次量測用同一把尺才有意義）。
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
/** repo 根目錄：問 git，不硬編路徑——歸檔到 docs/archive 或換機器仍能跑（code-review conventions finder） */
const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8' }).trim();
const B_SKILLS = ['dev-workflow', 'design-direction', 'design-language', 'dispatch-parallel', 'incident-investigate', 'frontend-test', 'write-skill', 'security-checklist', 'cmd-guard', 'safety-guard', 'lock-files', 'context-snapshot', 'context-resume', 'db-access', 'retro', 'debug-systematic', 'devwork'];
/** 粗估 token：CJK 1.2 / 字、其餘 3.8 字元 / token；前後量測同一把尺才有意義 */
const estTok = (s) => { const cjk = (s.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).length; return Math.round(cjk * 1.2 + (s.length - cjk) / 3.8); };
/** frontmatter 內文（--- 到 --- 之間），沒有回空字串 */
const fm = (t) => (t.match(/^---\r?\n([\s\S]*?)\r?\n---/) || ['', ''])[1];
/** description 值：先試 `|` / `>` 多行 block（縮排行到第一個無縮排行），再退單行；與 plugin-contract.mjs 的 description() 同一套規則 */
const desc = (f) => { const m = f.match(/^description:[ \t]*[|>]-?[ \t]*\r?\n((?:(?:[ \t]+.*|[ \t]*)(?:\r?\n|$))*)/m); if (m) return m[1]; const s = f.match(/^description:[ \t]*(.+)$/m); return s ? s[1] : ''; };
const files = [];
for (const d of readdirSync(join(REPO, 'skills'))) { const p = `skills/${d}/SKILL.md`; if (existsSync(join(REPO, p))) files.push({ p, group: B_SKILLS.includes(d) ? 'B' : 'other' }); }
files.push({ p: 'skills/devwork/rules.md', group: 'C' });
for (const f of readdirSync(join(REPO, 'agents'))) if (f.endsWith('.md')) files.push({ p: `agents/${f}`, group: 'B' });
// lines = 非空行（review Eng M7：`wc -l` 可被刪空行湊數）
const rows = files.map(({ p, group }) => { const t = readFileSync(join(REPO, p), 'utf8'); return { p, group, lines: t.split(/\r?\n/).filter((l) => l.trim()).length, bytes: statSync(join(REPO, p)).size, tok: estTok(t), dTok: estTok(desc(fm(t))) }; });
// 各 task 目標（plan v2 Task 3-25，非空行 / bytes）；--assert 對單檔與總量都斷言
const TARGETS = { 'dev-workflow': [185, 11300], 'design-direction': [175, 16000], 'design-language': [150, 14000], 'dispatch-parallel': [165, 11000], 'incident-investigate': [175, 7700], 'frontend-test': [125, 7650], 'write-skill': [140, 6100], 'security-checklist': [175, 6500], 'cmd-guard': [105, 4000], 'safety-guard': [100, 4200], 'lock-files': [68, 2750], 'context-snapshot': [100, 3700], 'context-resume': [92, 3300], 'db-access': [58, 2500], 'retro': [115, 4900], 'debug-systematic': [105, 4000], 'devwork': [26, 2100], 'db-reviewer': [92, 3800], 'frontend-e2e-runner': [125, 6800], 'hypothesis-tester': [85, 4900], 'lang-reviewer': [115, 4550], 'pr-explainer': [100, 3700], 'security-auditor': [98, 5300] };
const B_LINES_TARGET = Object.values(TARGETS).reduce((a, [l]) => a + l, 0), B_BYTES_TARGET = 140600;
const sum = (g, k) => rows.filter((r) => g === 'all' || r.group === g).reduce((a, r) => a + r[k], 0);
const key = (p) => p.replace(/^skills\/|\/SKILL\.md$|^agents\/|\.md$/g, '');
console.log('| 檔 | 組 | 非空行 | bytes | ~tok | desc~tok | 目標（行 / bytes） |\n|---|---|---|---|---|---|---|');
for (const r of rows.sort((a, b) => b.tok - a.tok)) { const tg = TARGETS[key(r.p)]; console.log(`| ${r.p} | ${r.group} | ${r.lines} | ${r.bytes} | ${r.tok} | ${r.dTok} | ${tg ? `≤${tg[0]} / ≤${tg[1]}` : '—'} |`); }
const D = sum('all', 'dTok'), BL = sum('B', 'lines'), BB = sum('B', 'bytes'), R = rows.find((r) => r.group === 'C');
console.log(`\n合計 ${rows.length} 檔 ${sum('all', 'lines')} 非空行 / ${sum('all', 'bytes')} bytes / ~${sum('all', 'tok')} tok`);
console.log(`description 合計 ~${D} tok（目標 ≤2000）`);
console.log(`B（17 skill + 6 agent）${BL} 非空行（目標 ≤${B_LINES_TARGET}）/ ${BB} bytes（目標 ≤${B_BYTES_TARGET}）`);
console.log(`rules.md ${R.lines} 非空行（目標 ≤110）/ ${R.bytes} bytes（目標 ≤14000）`);
if (process.argv.includes('--assert')) {
  const fails = [];
  if (D > 2000) fails.push(`description ${D} > 2000`);
  if (BL > B_LINES_TARGET) fails.push(`B 非空行 ${BL} > ${B_LINES_TARGET}`);
  if (BB > B_BYTES_TARGET) fails.push(`B bytes ${BB} > ${B_BYTES_TARGET}`);
  for (const r of rows) { const tg = TARGETS[key(r.p)]; if (tg && r.lines > tg[0] * 1.1) fails.push(`${key(r.p)} 非空行 ${r.lines} > 目標 ${tg[0]} +10%`); if (tg && r.bytes > tg[1] * 1.1) fails.push(`${key(r.p)} bytes ${r.bytes} > 目標 ${tg[1]} +10%`); }
  if (R.lines > 110) fails.push(`rules.md 非空行 ${R.lines} > 110`);
  if (R.bytes > 14000) fails.push(`rules.md bytes ${R.bytes} > 14000`);
  console.log(fails.length ? `\nASSERT FAIL：${fails.join('；')}` : '\nASSERT PASS');
  process.exitCode = fails.length ? 1 : 0;
}
