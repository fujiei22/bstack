/**
 * 文本瘦身守門 v2（一次性腳本，隨 spec 歸檔）：對 28 skill + 6 agents + rules.md 抽「不能動」的東西存快照，砍完後比對。
 *   node slim-guard-v2.mjs snapshot <out.json>
 *   node slim-guard-v2.mjs check <baseline.json> [--only <name,name>]
 *
 * 抽什麼（對應 spec §零改變界線；review-plan Eng C1 / C2 / M1 / M2 / M3 補強後）：
 *   fmRest      frontmatter 去掉 description 之後的其餘欄逐字
 *   desc        description：第一行非空、無「觸發：」、PROTECTED 字樣仍在
 *   steps       「## 使用契約」（沒有則 body 第一個含編號清單的段）每一步的 { 編號, 動詞集合, 反引號片段集合 }——
 *               編號序全等；每步動詞 / 反引號 砍後 ⊇ 基線
 *   headings    所有 ## / ### 的 § 標題；白名單必留、不得新增
 *   blocks      **所有** fenced code block（normalize 空白）：砍後每個 block 必須等於某個基線 block（可整塊刪、不可改、不可新增）；
 *               yaml block 例外走行級：砍後每行 ∈ 基線該檔 yaml 行 ∪ dev-workflow §Skill hand-off state 主 yaml 行 ∪ `# 承上` 註解；
 *               消失的行 ⊆ dev-workflow 主 yaml 行（只有「承上」才准刪）
 *   tables      所有 `|` 表格行（normalize）：非 Red Flags 段的行 砍後 ⊆ 基線；Red Flags 段只限列數 ≤ 5（不含表頭兩行）
 *   ticks       反引號片段集合不得新增
 *   bullets     agents 的「角色職責」「§輸入契約」「§嚴格 output 格式」段：bullet 數不減、粗體關鍵詞集合 ⊇ 基線
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const REPO = 'D:/GitHub/bstack';

const FILES = {};
for (const d of readdirSync(join(REPO, 'skills'))) {
  const p = `skills/${d}/SKILL.md`; if (existsSync(join(REPO, p))) FILES[d] = p;
}
FILES['rules.md'] = 'skills/devwork/rules.md';
for (const f of readdirSync(join(REPO, 'agents'))) if (f.endsWith('.md')) FILES[`agent:${f.replace(/\.md$/, '')}`] = `agents/${f}`;

const WHITELIST = {
  'brainstorm': ['§Phase 0a', '§Phase 0b —', '§Phase 0b′', '§Phase 0c —', '§Phase 0d', '§Phase 0c/0d 合併確認', '§spec 文件結構與落檔', '§補施工清單入口', '§交棒'],
  'review-plan': ['§結果整合', '§User gate', '§視角 prompt 模板'],
  'execute-plan': ['§前端檔處理', '§Task 推進規則', '§Task fail 處置', '§Blocker', '§hand-off state', '§Verify 規則'],
  'verify-done': ['§UI / browser e2e', '§漏網複查', '§verify 失敗處置', '§Verify 套餐'],
  'request-review': ['§副檔名分流', '§結果整合', '§語言提示', '§T1 self review'],
  'receive-review': ['§不危險處置', '§危險處置'],
  'security-audit': ['§Dispatch', '§Critical-finding 流程'],
  'finish-branch': ['§Conflict 流程', '§PR body 模板', '§hand-off state', '§Squash merge', '§Clean check', '§Merge 後：docs 歸檔', '§特殊情境'],
  'tdd-cycle': ['§The Iron Law', '§RED', '§Verify RED', '§GREEN', '§Verify GREEN', '§REFACTOR'],
  'design-direction': ['§對外契約', '§與 dev-workflow 銜接'],
  'design-language': ['§前端副檔名', '§對外契約', '§兩根尺', '§首次偵測', '§設計語言抽取', '§對齊檢查清單', '§與 dev-workflow 銜接'],
  'dev-workflow': ['§Track × Tier × Phase 路徑', '§Skill hand-off state', '§Trace 標籤', '§Auto-fix 原則', '§Fail handling', '§Memory hook 點', '§跨流程 skill 載入'],
  'dispatch-parallel': ['§協作模式判定', '§隊友派工', '§Spawn 細節'],
  'frontend-test': ['§載入時機', '§測試矩陣', '§branch-name fallback 鏈'],
  'write-skill': ['§新 skill 落地 checklist'],
  'rules.md': ['§白話優先', '§事實核實', '§Task 追蹤', '§決策點選單', '§Branch safety', '§File-type 硬規則', '§PII 安全底線', '§DB 操作', '§設計語言對齊', '§Docs 落檔', '§Tier 機制', '§協作模式判定', '§Trace 標籤', '§Auto-fix', '§Fail handling', '§Settings.json'],
  'agent:db-reviewer': ['§檢查焦點', '§回報格式'],
  'agent:frontend-e2e-runner': ['§輸入契約', '§嚴格 output 格式', '§使用 tool 範圍'],
  'agent:hypothesis-tester': ['§輸入契約', '§嚴格 output 格式', '§使用 tool 範圍', '§PII'],
  'agent:lang-reviewer': ['§回報格式'],
  'agent:pr-explainer': ['§Tier 控詳盡度', '§文件結構標準', '§使用 tool 範圍'],
  'agent:security-auditor': ['§PII 安全底線', '§回報格式', '§使用 tool 範圍'],
};
// description 裡契約（P3b / P9d / P9f / P9i / P12）或行為守的字樣。P9i 是全檔計數 === 2，其中一處在 description（Eng C1）。
const PROTECTED = {
  'devwork': ['/devwork', '不因'],
  'dev-workflow': ['不因自然語言自動觸發'],
  'brainstorm': ['不因自然語言自動觸發'],
  'pr-explain': ['T3'],
  'design-language': ['命中', '才載'],
  'design-direction': ['T2 → 回 `brainstorm`'],
  'agent:lang-reviewer': ['顯式'],
  'agent:security-auditor': ['純文件'],
};
const VERBS = /(AskUserQuestion|spawn|commit|讀|判|交棒|跑|回傳|回報|寫|載|派|問|停|退|檢|抽|比對|印|確認|整合|收)/g;
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const AGENT_SECTIONS = /^## (角色職責|§輸入契約|§嚴格 output 格式)/;

import { execFileSync } from 'node:child_process';
let REV = null;   // snapshot --rev <sha>：從 git 讀該 commit 的檔，不受工作樹狀態影響（stash 拍快照會拍到已 commit 的改動，實測踩過）
function extract(name, srcPath) {
  const raw = srcPath ? readFileSync(srcPath, 'utf8')
    : REV ? execFileSync('git', ['show', `${REV}:${FILES[name]}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 24 })
    : readFileSync(join(REPO, FILES[name]), 'utf8');
  const t = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const hasFm = /^---\n/.test(t);
  const fm = hasFm ? (t.match(/^---\n([\s\S]*?)\n---/) || ['', ''])[1] : '';
  const descM = fm.match(/^description:[ \t]*(?:[|>]-?[ \t]*\n((?:(?:[ \t]+.*|[ \t]*)(?:\n|$))*)|(.+)$)/m);
  const desc = descM ? (descM[1] ?? descM[2] ?? '') : '';
  const fmRest = descM ? fm.replace(descM[0], '') : fm;
  const firstLine = desc.split('\n').map((s) => s.trim()).find(Boolean) || '';
  const protectedMissing = (PROTECTED[name] || []).filter((s) => !desc.includes(s));
  const body = hasFm ? t.slice(t.indexOf('\n---', 3) + 4) : t;
  const sections = body.split(/^(?=## )/m);
  const contract = sections.find((s) => /^## .*使用契約/.test(s)) || sections.find((s) => /^\d+\.\s+/m.test(s)) || '';
  // 每步：從編號行到下一個編號行之間的文字（含縮排子項）
  const stepChunks = contract.split(/^(?=\d+(?:\.\d+)?\.\s+)/m).filter((c) => /^\d+(?:\.\d+)?\.\s+/.test(c));
  const steps = stepChunks.map((c) => ({
    no: c.match(/^(\d+(?:\.\d+)?)\./)[1],
    verbs: [...new Set((c.match(VERBS) || []))].sort(),
    ticks: [...new Set([...c.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]))].sort(),
  }));
  // 標題只掃 code block 之外（write-skill 範本裡的 `## §<段一名>`、pr-explainer 格式 block 的 `## 整體脈絡` 是內容不是標題）
  const headings = [...body.replace(/```[a-zA-Z]*\n[\s\S]*?```/g, '').matchAll(/^#{2,3} (§[^\n]+)/gm)].map((m) => m[1].trim());
  const fenced = [...body.matchAll(/```([a-zA-Z]*)\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1].toLowerCase(), text: norm(m[2]), lines: m[2].split('\n').map(norm).filter(Boolean) }));
  const blocks = fenced.filter((b) => !/^ya?ml$/.test(b.lang)).map((b) => b.text);
  const yamlLines = fenced.filter((b) => /^ya?ml$/.test(b.lang)).flatMap((b) => b.lines);
  // AskUserQuestion 之後不在 code block 裡的選單清單（原 v1 規則）
  const lines = body.split('\n'); const menus = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/AskUserQuestion/.test(lines[i])) continue;
    const opts = []; let j = i + 1;
    while (j < lines.length && j < i + 16 && !/^\s*\d+\.\s|^\s*- \*\*/.test(lines[j])) j++;
    for (; j < lines.length && /^\s*\d+\.\s|^\s*- \*\*|^\s{2,}\S/.test(lines[j]); j++) if (/^\s*\d+\.\s|^\s*- \*\*/.test(lines[j])) opts.push(lines[j].trim());
    if (opts.length >= 2) menus.push(norm(opts.join('\n')));
  }
  // 表格：分 Red Flags 段 / 其他；排除 code block 內的 | 行
  const bodyNoCode = body.replace(/```[a-zA-Z]*\n[\s\S]*?```/g, '');
  // 非 Red Flags 表格以「連續 | 行」為一張表：整張可刪（改成指向）、不可刪單列 / 改列 / 新增列
  let inRF = false; const tables = [], rfRows = []; let cur = null;
  for (const l of bodyNoCode.split('\n')) {
    if (/^## /.test(l)) inRF = /Red Flags/.test(l);
    if (!/^\|/.test(l)) { if (cur) { tables.push(cur); cur = null; } continue; }
    if (inRF) { if (!/^\|\s*-{2,}|想法\s*\|/.test(l)) rfRows.push(norm(l)); continue; }
    if (/^\|\s*:?-{2,}/.test(l)) continue;   // `|---|---|` 分隔列各表相同，算進去會讓「整張刪」被誤判成「留了一列」（dev-workflow subagent 實測）
    (cur ||= []).push(norm(l));
  }
  if (cur) tables.push(cur);
  const ticks = [...new Set([...body.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]))];
  // agents 三段的 bullet 與粗體
  const bullets = {};
  if (name.startsWith('agent:')) for (const s of sections) {
    const h = (s.match(/^## ([^\n]+)/) || [])[1]; if (!h || !AGENT_SECTIONS.test(s)) continue;
    const sNoCode = s.replace(/```[a-zA-Z]*\n[\s\S]*?```/g, '');
    bullets[h] = { n: (sNoCode.match(/^\s*(?:[-*]|\d+\.)\s+/gm) || []).length, bold: [...new Set([...sNoCode.matchAll(/\*\*([^*\n]+)\*\*/g)].map((m) => m[1]))].sort() };
  }
  return { hasFm, fmRest, desc: { firstLine, hasTrigger: /觸發：/.test(desc), protectedMissing }, steps, headings, blocks, yamlLines, menus, tables, rfRows, ticks, bullets };
}

const [mode, file, ...rest] = process.argv.slice(2);
const only = rest.includes('--only') ? rest[rest.indexOf('--only') + 1].split(',') : null;
const src = rest.includes('--src') ? rest[rest.indexOf('--src') + 1] : null;   // 用這個檔的內容當 <name> 的現況（subagent 成品在 out/ 時用；需 --only 單一 name）
if (rest.includes('--rev')) REV = rest[rest.indexOf('--rev') + 1];            // snapshot 專用：從 git 該 rev 讀基線
if (src && (!only || only.length !== 1)) { console.error('--src 需搭配 --only <單一 name>'); process.exit(2); }
const names = Object.keys(FILES).filter((n) => !only || only.includes(n));
const now = Object.fromEntries(Object.keys(FILES).map((n) => [n, extract(n, src && only[0] === n ? src : null)]));
if (mode === 'snapshot' && !REV) { console.error('snapshot 必須帶 --rev <sha>：從工作樹拍基線會拍到半改完的檔（施工中踩過）'); process.exit(2); }
if (mode === 'snapshot') { writeFileSync(file, JSON.stringify(now, null, 1)); console.log(`snapshot ${Object.keys(now).length} 檔 -> ${file}`); process.exit(0); }
if (mode !== 'check') { console.error('用法：snapshot <out.json> | check <baseline.json> [--only a,b] [--src <path>]'); process.exit(2); }
const base = JSON.parse(readFileSync(file, 'utf8'));
const mainYaml = new Set(base['dev-workflow'].yamlLines);   // 承上只准刪這批
let bad = 0;
for (const n of names) {
  const a = base[n], b = now[n];
  if (!a) { console.log(`SKIP ${n}（基線沒有）`); continue; }
  const d = [];
  if (norm(a.fmRest) !== norm(b.fmRest)) d.push('frontmatter 除 description 外的欄變了');
  if (b.hasFm && !b.desc.firstLine) d.push('description 第一行空');
  if (b.desc.hasTrigger) d.push('description 含「觸發：」（P3c）');
  if (b.desc.protectedMissing.length) d.push(`description 缺契約字樣：${b.desc.protectedMissing.join(' / ')}`);
  if (a.steps.map((s) => s.no).join('|') !== b.steps.map((s) => s.no).join('|')) d.push(`步驟序 ${a.steps.map((s) => s.no).join(',')} → ${b.steps.map((s) => s.no).join(',')}`);
  else a.steps.forEach((s, i) => {
    const lv = s.verbs.filter((v) => !b.steps[i].verbs.includes(v)), lt = s.ticks.filter((v) => !b.steps[i].ticks.includes(v));
    if (lv.length || lt.length) d.push(`步驟 ${s.no} 少了動詞 [${lv.join(' ')}] / 反引號 [${lt.join(' | ')}]`);
  });
  const lostWL = (WHITELIST[n] || []).filter((h) => !b.headings.some((x) => x.startsWith(h)));
  if (lostWL.length) d.push(`白名單 § 消失：${lostWL.join(' / ')}`);
  const added = b.headings.filter((h) => !a.headings.includes(h));
  if (added.length) d.push(`新增或改名的 §（§ 只能刪、不能改名）：${added.join(' / ')}`);
  const badBlocks = b.blocks.filter((x) => !a.blocks.includes(x));
  if (badBlocks.length) d.push(`code block 被改或新增 ${badBlocks.length} 個：${badBlocks.map((x) => x.slice(0, 70)).join(' || ')}`);
  // rules.md 沒有任何 AskUserQuestion 選單（選項都寫在同一句括號內），它提到 AskUserQuestion 之後的 bullet 是規則條目、
  // 不是選項；這條 v1 承襲的啟發式只對 skill 生效，rules.md 的 bullet 由「表格 / 反引號 / § / 契約」四層守
  const lostMenus = n === 'rules.md' ? [] : a.menus.filter((x) => !b.menus.includes(x));
  if (lostMenus.length) d.push(`選單清單變了 ${lostMenus.length} 個：${lostMenus.map((x) => x.slice(0, 60)).join(' || ')}`);
  const badYaml = b.yamlLines.filter((l) => !a.yamlLines.includes(l) && !mainYaml.has(l) && !/^#\s*承上/.test(l));
  if (badYaml.length) d.push(`yaml 行被改或新增 ${badYaml.length}：${badYaml.slice(0, 5).join(' || ')}`);
  const lostYaml = a.yamlLines.filter((l) => !b.yamlLines.includes(l) && !mainYaml.has(l));
  if (lostYaml.length) d.push(`yaml 行消失且非承上 ${lostYaml.length}：${lostYaml.slice(0, 5).join(' || ')}`);
  const bRows = new Set(b.tables.flat()), aRows = new Set(a.tables.flat());
  const newRows = [...bRows].filter((r) => !aRows.has(r));
  if (newRows.length) d.push(`表格行被改或新增 ${newRows.length}：${newRows.map((r) => r.slice(0, 70)).slice(0, 4).join(' || ')}`);
  for (const tbl of a.tables) {
    const kept = tbl.filter((r) => bRows.has(r));
    if (kept.length && kept.length < tbl.length) d.push(`表格「${tbl[0].slice(0, 40)}」少了 ${tbl.length - kept.length} 列（整張可刪、不可刪單列）：${tbl.filter((r) => !bRows.has(r))[0].slice(0, 60)}`);
  }
  // Red Flags：目標 ≤5 列；沒動過的檔（列集合與基線全等，例如 #67 已瘦的九檔）不追究
  if (b.rfRows.length > 5 && b.rfRows.join('\n') !== a.rfRows.join('\n')) d.push(`Red Flags ${b.rfRows.length} 列 > 5（已改動）`);
  const newTicks = b.ticks.filter((x) => !a.ticks.includes(x));
  if (newTicks.length) d.push(`新增反引號片段 ${newTicks.length}：${newTicks.slice(0, 6).join(' | ')}`);
  // regex / 路徑 / 指令旗標 這類反引號片段是規則本體（safety-guard PII regex、cmd-guard pattern、路徑），不准消失；一般名詞片段可隨段落刪
  const RULEISH = /[\\\[\]{}^$*+?]|^--|^[.~]?\/|\/\w|\.(mjs|ps1|md|js|json|yml|yaml|sql|env)\b/;
  const lostRule = a.ticks.filter((x) => RULEISH.test(x) && !b.ticks.includes(x));
  if (lostRule.length) d.push(`規則型反引號片段消失 ${lostRule.length}（regex / 路徑 / 旗標）：${lostRule.slice(0, 5).join(' | ')}`);
  for (const [h, v] of Object.entries(a.bullets || {})) {
    const w = (b.bullets || {})[h];
    if (!w) { d.push(`agent 段「${h}」消失`); continue; }
    if (w.n < v.n) d.push(`agent 段「${h}」bullet ${v.n} → ${w.n}`);
    const lb = v.bold.filter((x) => !w.bold.includes(x)); if (lb.length) d.push(`agent 段「${h}」粗體消失：${lb.join(' / ')}`);
  }
  if (d.length) { bad++; console.log(`FAIL ${n}\n  ${d.join('\n  ')}`); } else console.log(`PASS ${n}`);
}
console.log(bad ? `\n${bad} FAIL` : '\nALL PASS');
process.exitCode = bad ? 1 : 0;
