/**
 * 收件（一次性）：對 out/<name>.md 逐檔跑守門 --src、量非空行 / bytes 對 plan 目標，印驗收表。
 *   node intake.mjs            只驗、不搬
 *   node intake.mjs --apply    守門 PASS 且非空行 ≤ 目標 +10% 的檔 copy 進 skills/ 或 agents/（不 commit）
 */
import { readFileSync, readdirSync, copyFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';   // 參數陣列、不經 shell：out/ 檔名若含 & | ^ % 也不會變成第二條命令（security-audit Major）
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
/** 腳本所在目錄就是施工目錄（歸檔後一起搬、路徑不用改）；repo 根問 git */
const G = dirname(fileURLToPath(import.meta.url));
const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: G, encoding: 'utf8' }).trim();
const TARGETS = { 'dev-workflow': [185, 11300], 'design-direction': [175, 16000], 'design-language': [150, 14000], 'dispatch-parallel': [165, 11000], 'incident-investigate': [175, 7700], 'frontend-test': [125, 7650], 'write-skill': [140, 6100], 'security-checklist': [175, 6500], 'cmd-guard': [105, 4000], 'safety-guard': [100, 4200], 'lock-files': [68, 2750], 'context-snapshot': [100, 3700], 'context-resume': [92, 3300], 'db-access': [58, 2500], 'retro': [115, 4900], 'debug-systematic': [105, 4000], 'db-reviewer': [92, 3800], 'frontend-e2e-runner': [125, 6800], 'hypothesis-tester': [85, 4900], 'lang-reviewer': [115, 4550], 'pr-explainer': [100, 3700], 'security-auditor': [98, 5300] };
const AGENTS = new Set(['db-reviewer', 'frontend-e2e-runner', 'hypothesis-tester', 'lang-reviewer', 'pr-explainer', 'security-auditor']);
const apply = process.argv.includes('--apply');
const skip = new Set(process.argv.includes('--skip') ? process.argv[process.argv.indexOf('--skip') + 1].split(',') : []);   // 尚未回報的檔先不搬
const rows = [];
for (const f of readdirSync(join(G, 'out')).filter((x) => x.endsWith('.md')).sort()) {
  const name = f.replace(/\.md$/, ''); const src = join(G, 'out', f);
  if (skip.has(name)) continue;
  if (!(name in TARGETS)) { console.log(`跳過 out/${f}：不在 TARGETS 白名單`); continue; }   // 只收 plan 列的檔，其餘檔名不進任何命令
  const dst = AGENTS.has(name) ? `agents/${name}.md` : `skills/${name}/SKILL.md`;
  const guardName = AGENTS.has(name) ? `agent:${name}` : name;
  const t = readFileSync(src, 'utf8'); const lines = t.split(/\r?\n/).filter((l) => l.trim()).length, bytes = statSync(src).size;
  const base = readFileSync(join(REPO, dst), 'utf8'); const bl = base.split(/\r?\n/).filter((l) => l.trim()).length, bb = statSync(join(REPO, dst)).size;
  let guard; try { execFileSync('node', [join(G, 'slim-guard-v2.mjs'), 'check', join(G, 'baseline-4de4e83.json'), '--only', guardName, '--src', src], { encoding: 'utf8' }); guard = 'PASS'; } catch (e) { guard = (e.stdout || '').split('\n').filter((l) => /^\s{2}\S/.test(l)).map((l) => l.trim()).join(' ／ ') || 'FAIL'; }
  const [tl, tb] = TARGETS[name] || [0, 0];
  const okLines = lines <= tl * 1.1, okBytes = bytes <= tb * 1.1;
  const verdict = guard === 'PASS' && okLines && okBytes ? '收' : guard === 'PASS' ? '守門綠、目標差>10%' : '守門紅';
  rows.push({ name, bl, lines, tl, bb, bytes, tb, guard, verdict });
  if (apply && guard === 'PASS' && okLines && okBytes) copyFileSync(src, join(REPO, dst));
}
console.log('| 檔 | 非空行 基線→成品（目標） | bytes 基線→成品（目標） | 守門 | 判 |\n|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.name} | ${r.bl}→${r.lines}（≤${r.tl}） | ${r.bb}→${r.bytes}（≤${r.tb}） | ${r.guard.length > 80 ? r.guard.slice(0, 80) + '…' : r.guard} | ${r.verdict} |`);
console.log(`\n收 ${rows.filter((r) => r.verdict === '收').length} / ${rows.length}${apply ? '（已 copy）' : ''}`);
