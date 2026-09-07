/**
 * 刪除的「為什麼」索引（一次性）：比對基線 4de4e83 與現況，列出被刪或改寫的「> 為什麼 / 實測」引言段
 * （不在 code block 內、以 `> ` 開頭、含「為什麼」或「實測」），附基線 檔:行 與縮成的新句（若有）。
 *   node quote-index.mjs [--rev 4de4e83]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
/** repo 根目錄：問 git，不硬編路徑——歸檔到 docs/archive 或換機器仍能跑（code-review conventions finder） */
const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8' }).trim();
const REV = process.argv.includes('--rev') ? process.argv[process.argv.indexOf('--rev') + 1] : '4de4e83';
const files = [];
for (const d of readdirSync(join(REPO, 'skills'))) { const p = `skills/${d}/SKILL.md`; if (existsSync(join(REPO, p))) files.push(p); }
files.push('skills/devwork/rules.md');
for (const f of readdirSync(join(REPO, 'agents'))) if (f.endsWith('.md')) files.push(`agents/${f}`);
/** 把 fenced code block 內的行換成空字串（保留行號對位），引言只算 block 外的 */
const stripCode = (t) => { let inCode = false; return t.split('\n').map((l) => { if (/^```/.test(l)) { inCode = !inCode; return ''; } return inCode ? '' : l; }); };
/** 把連續的 `> ` 行合成一段 { start: 起始行號, text: [各行] }，只留含「為什麼」或「實測」的段（spec 對「引言」的定義） */
const quotes = (lines) => { const out = []; let cur = null; lines.forEach((l, i) => { if (/^>\s?/.test(l)) { if (!cur) cur = { start: i + 1, text: [] }; cur.text.push(l.replace(/^>\s?/, '').trim()); } else if (cur) { out.push(cur); cur = null; } }); if (cur) out.push(cur); return out.filter((q) => /為什麼|實測/.test(q.text.join(' '))); };
let total = 0, removed = 0, shortened = 0;
console.log('| 檔 | 基線 行 | 原引言（首句） | 現況 |\n|---|---|---|---|');
for (const p of files) {
  let base; try { base = execFileSync('git', ['show', `${REV}:${p}`], { cwd: REPO, encoding: 'utf8' }); } catch { continue; }
  const now = readFileSync(join(REPO, p), 'utf8');
  const bq = quotes(stripCode(base.replace(/\r\n/g, '\n'))), nq = quotes(stripCode(now.replace(/\r\n/g, '\n')));
  const nowText = nq.map((q) => q.text.join(' '));
  for (const q of bq) {
    total++;
    const full = q.text.join(' ');
    if (nowText.includes(full)) continue;                        // 原樣留
    const key = full.replace(/[^\u4e00-\u9fff]/g, '').slice(0, 6); // 用前六個中文字找縮寫版
    const hit = nowText.find((t) => t.replace(/[^\u4e00-\u9fff]/g, '').includes(key));
    if (hit) shortened++; else removed++;
    console.log(`| ${p.replace(/^skills\/|\/SKILL\.md$/g, '')} | ${q.start} | ${q.text[0].slice(0, 70)} | ${hit ? '縮：' + hit.slice(0, 60) : '**刪**'} |`);
  }
}
console.log(`\n基線引言 ${total} 段：原樣 ${total - removed - shortened} / 縮寫 ${shortened} / 刪除 ${removed}`);
