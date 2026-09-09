/**
 * plugin 結構契約（零依賴，只用 node 內建模組）。
 *
 * 為什麼要有：這個 repo 沒有 test runner。改成 plugin 後「manifest 對不對、觸發詞有沒有清乾淨、
 * 全域路徑字樣有沒有殘留、兩份計數有沒有漂移」只能靠肉眼，這支把它們變成機械判定。
 *   P1 manifest                      P2 hooks.json、腳本存在、state dir 不在 plugin 內
 *   P3a skill 數量與 name==目錄名     P3b devwork 入口存在   P3c 描述無「觸發：」
 *   P4 無 ~/.claude 安裝路徑字樣（白名單行跳過，且白名單行數有上限）
 *   P5 全域 sync 路徑已移除、範本合法   P6 rules.md 單一真相
 *   P7 agents frontmatter 與 README 計數   P8 README / index.html skill 計數 == 磁碟
 *   P9 T2 lane 精簡（施工清單 / code-review 內建 / pr-explain 限 T3）   P10 verify-done 文字節點豁免判定器
 *   P11 design-language 延遲載入、副檔名清單七處一致   P12 security-audit 純文件 T3 跳的六處同步
 *
 * code 內段落順序是 P1 P2 P3 P7 P4 P5 P6 P8 P9 P10 P11 P12：P7 先算是因為 P4 要用 agentFiles 掃描；
 * P9 之後的殘留掃描（雙視角 / T3 必跑）都吃 P4 的 scanTargets，不各自再列一份檔案清單。
 *
 * 跑法（**必須用 Bash，不要用 PowerShell**——$? 在 PowerShell 是布林、grep 不存在；
 * 在 pwsh 看 exit code 用 $LASTEXITCODE）：
 *   node scripts/plugin-contract.mjs
 *   node scripts/plugin-contract.mjs --selftest   # 驗 fail 路徑與 frontmatter 解析
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SELFTEST = process.argv.includes('--selftest');
let failed = 0;

/** 一條契約：pass 印 PASS，否則印 FAIL + 期望/實際/後果 並累計。 */
function check(id, ok, detail) {
  if (ok) { console.log(`PASS  ${id}`); return; }
  failed++;
  console.log(`FAIL  ${id}\n      ${detail}`);
}
const rd = (p) => readFileSync(join(REPO, p), 'utf8');
const exists = (p) => existsSync(join(REPO, p));
const parseJson = (p) => { try { return JSON.parse(rd(p)); } catch (e) { return { __err: e.message }; } };

/** frontmatter（--- 到 --- 之間）；沒有就回空字串。開頭的 UTF-8 BOM 先剝掉，否則 ^--- 對不上。 */
function frontmatter(text) {
  const m = text.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}
/**
 * description 值。支援 YAML block scalar 四種指示符 `|` `|-` `>` `>-`，區塊 = 指示符之後
 * 所有「有縮排的行或空行」直到第一個無縮排的非空行；再退單行值。
 *
 * 兩個刻意的地方：
 * - 只吃 [ \t]，**不能用 \s**——\s 會吃掉換行連同下一行縮排，捕獲群組變空、退到單行分支抓到 "|"，
 *   斷言就恆綠（第一版實跑抓到過）。
 * - fail-closed：單行分支若抓到的只是指示符本身（`|` `>` `|-`…），回空字串。空描述會讓
 *   P3b 之類的斷言紅，而不是讓 P3c 因為「描述裡沒有觸發：」而假綠。
 */
function description(fm) {
  const multi = fm.match(/^description:[ \t]*[|>]-?[ \t]*\r?\n((?:(?:[ \t]+.*|[ \t]*)(?:\r?\n|$))*)/m);
  if (multi && multi[1].trim()) return multi[1];
  const single = fm.match(/^description:[ \t]*(.+)$/m);
  if (!single) return '';
  return /^[|>]-?$/.test(single[1].trim()) ? '' : single[1];
}

// selftest 先驗解析器本身，解析器壞掉時後面的 P3c / P7 都是假綠
if (SELFTEST) {
  const before = failed;
  const fake = 'name: x\ndescription: |\n  第一行。觸發：寫 / 改\n  第二行\ntools: []';
  const d = description(fake);
  check('S1 多行 description 抓得到內容、不吃到下一個 key', d.includes('觸發：') && d.includes('第二行') && !d.includes('tools'), `實際抓到 ${JSON.stringify(d)}`);
  check('S2 單行 description', description('description: 單行值') === '單行值', '單行分支壞了');
  const blank = 'description: |\n  第一段\n\n  空行之後才寫觸發：寫\nname: y';
  check('S4 區塊內空行不截斷', description(blank).includes('觸發：') && !description(blank).includes('name: y'), `實際抓到 ${JSON.stringify(description(blank))}`);
  check('S5 `>-` 折疊寫法抓得到內容', description('description: >-\n  折疊 觸發：改\n').includes('觸發：'), `實際抓到 ${JSON.stringify(description('description: >-\n  折疊 觸發：改\n'))}`);
  check('S6 只有指示符沒有內容 → 空字串（fail-closed）', description('description: |\nname: z') === '', `實際抓到 ${JSON.stringify(description('description: |\nname: z'))}`);
  check('S3 check() 累計失敗（本條必紅）', false, '刻意失敗');
  const ok = failed === before + 1;
  console.log(ok ? '\nSELFTEST PASS' : '\nSELFTEST FAIL');
  process.exitCode = ok ? 0 : 1;
} else {

// ── P1 manifest ─────────────────────────────────────────────────────────────
const plugin = parseJson('.claude-plugin/plugin.json');
const market = parseJson('.claude-plugin/marketplace.json');
check('P1a plugin.json 合法且 name=bstack',
  !plugin.__err && plugin.name === 'bstack' && typeof plugin.version === 'string' && typeof plugin.description === 'string',
  `期望 name=bstack 且有 version/description，實際 ${plugin.__err || JSON.stringify(plugin)}（後果：Claude Code 不認得這個目錄是 plugin）`);
check('P1b marketplace.json 必填齊且 source 指向 ./',
  !market.__err && market.name === 'bstack' && market.owner && typeof market.owner.name === 'string' &&
    Array.isArray(market.plugins) && market.plugins.length === 1 &&
    market.plugins[0].name === 'bstack' && market.plugins[0].source === './',
  `期望 name=bstack、owner.name、plugins=[{name:bstack, source:'./'}]，實際 ${market.__err || JSON.stringify(market)}（後果：/plugin install bstack@bstack 找不到）`);

// ── P2 hooks ────────────────────────────────────────────────────────────────
const hooks = parseJson('hooks/hooks.json');
const hookCmds = [];
// hooks.json 結構：{ hooks: { <event>: [ { matcher, hooks: [ { type, command } ] } ] } }
if (!hooks.__err && hooks.hooks) {
  for (const evt of Object.values(hooks.hooks)) for (const e of evt) for (const h of (e.hooks || [])) hookCmds.push(h.command || '');
}
const badCmd = hookCmds.filter((c) => !c.includes('${CLAUDE_PLUGIN_ROOT}'));
const missingScript = hookCmds.map((c) => (c.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"']+)/) || [])[1]).filter(Boolean).filter((rel) => !exists(rel));
// 2026-09-07 起 hook 是一支 node（hooks/guard.mjs，兩段檢查），取代兩支 pwsh；command 走 shell form + 雙引號（官方範例同寫法）
const notNode = hookCmds.filter((c) => !/^node "/.test(c));
check('P2a hooks.json 合法、≥1 個 command、全用 node + ${CLAUDE_PLUGIN_ROOT}',
  !hooks.__err && hookCmds.length >= 1 && badCmd.length === 0 && notNode.length === 0,
  `期望 ≥1 個 command 全為 node "\${CLAUDE_PLUGIN_ROOT}/…"，實際 ${hooks.__err || `${hookCmds.length} 個、${badCmd.length} 個沒用變數、${notNode.length} 個不是 node`}（後果：hook 路徑寫死本機、或又回到每次編輯 3 秒的 pwsh）`);
check('P2b hooks.json 指到的腳本都存在', missingScript.length === 0,
  `期望 0 個缺，實際缺 [${missingScript.join(', ')}]（後果：每次 Write / Edit 噴 hook 執行失敗）`);
check('P2c guard.mjs 不寫 plugin 目錄內的 state/（含 docstring）、舊 ps1 已刪',
  exists('hooks/guard.mjs') && !/state[\\/]file-guard|\.\.[\\/]state/.test(rd('hooks/guard.mjs')) && !exists('hooks/branch-safety.ps1') && !exists('hooks/file-type-guard.ps1'),
  `guard.mjs 存在=${exists('hooks/guard.mjs')} 舊 ps1 殘留=${exists('hooks/branch-safety.ps1') || exists('hooks/file-type-guard.ps1')}（後果：token 寫進 plugin 快取更新即清空；或兩套 hook 並存）`);

// P2d：guard.mjs 的純判定對 fixture 執行——擋 / 放 / 雙訊息 / token 三態 / 大小寫 / 取不到路徑 / repo 外 shell config，
// 全部照 spec §等價清單（docs/archive 或 docs/work 的 skill-load-and-node-hook/spec.md）。字樣 grep 守不住判定邏輯，所以直接跑。
const G = await import('../hooks/guard.mjs');
const REPO_FIX = process.platform === 'win32' ? 'C:\\repo' : '/repo';
const inRepo = (rel) => REPO_FIX + (process.platform === 'win32' ? '\\' : '/') + rel;
const ctxOf = ({ branch = 'feat/x', token = 'none', stateDir = true } = {}) => ({
  repoDir: REPO_FIX, env: { TMP: 'C:/t', USERNAME: 'u' }, selfPath: 'X:/p/hooks/guard.mjs',
  realpath: (p) => { throw new Error('nope'); },   // fixture 路徑不存在磁碟上；讓 canonical 退到 path.resolve
  getBranch: () => branch,
  peekToken: () => ({ valid: token === 'valid' }),
  consumeToken: () => token === 'none' ? { existed: false, valid: false } : { existed: true, valid: token === 'valid' },
  ensureStateDir: () => stateDir,
});
const W = (file_path, tool_name = 'Write') => ({ tool_name, tool_input: { file_path } });
// Codex apply_patch：tool_input.command 是整段 patch 文字、路徑相對 repo root
const AP = (files, op = 'Update File') => ({ tool_name: 'apply_patch', tool_input: { command: ['*** Begin Patch', ...files.map((f) => `*** ${op}: ${f}`), '*** End Patch'].join('\n') } });
// 多 token ctx：tokens = { [tokenPath]: true } 為有效；consumeToken 記錄呼叫（守「擋下就不消耗」與「逐檔 target 各對」）
const ctx2 = (o = {}) => { const c = ctxOf(o); c.consumed = []; c.peekToken = (p) => ({ valid: (o.tokens || {})[p] === true }); c.consumeToken = (p, t) => { c.consumed.push({ p, t }); return { existed: true, valid: true }; }; return c; };
const tokOf = (rel) => G.tokenPathFor(resolve(REPO_FIX, rel).replace(/\\/g, '/').toLowerCase(), ctxOf().env);   // 不寫死 hash
const tags = (r) => ({ b: r.lines.some((l) => l.includes('目前在')), B: r.lines.some((l) => l.includes('BLOCK')), W: r.lines.some((l) => l.includes('WARN')), S: r.lines.some((l) => l.includes('state dir')) });
const P2D = [
  ['1 protected + repo 內 → 擋', W(inRepo('src/a.ts')), ctxOf({ branch: 'main' }), 2, { b: true }],
  ['2 feature + repo 內 → 放', W(inRepo('src/a.ts')), ctxOf(), 0, {}],
  ['3 repo 外 settings.json（protected）→ 放', W('C:/Users/x/.claude/settings.json'), ctxOf({ branch: 'main' }), 0, {}],
  ['4 repo 外 .gitconfig（protected）→ WARN、無「目前在」', W('C:/Users/x/.gitconfig'), ctxOf({ branch: 'main' }), 2, { b: false, W: true }],
  ['5 protected + .env → 雙訊息', W(inRepo('.env')), ctxOf({ branch: 'main' }), 2, { b: true, B: true }],
  ['6 .env.example → 放', W(inRepo('.env.example')), ctxOf(), 0, {}],
  ['7 .env.local → BLOCK', W(inRepo('.env.local')), ctxOf(), 2, { B: true }],
  ['8 NotebookEdit id_rsa → BLOCK', { tool_name: 'NotebookEdit', tool_input: { notebook_path: inRepo('.ssh/id_rsa') } }, ctxOf(), 2, { B: true }],
  ['9 裸 credentials.json（無前導斜線）→ 放（既有行為）', W('credentials.json'), ctxOf(), 0, {}],
  ['10 migrations/x.sql 無 token → WARN', W(inRepo('db/migrations/x.sql')), ctxOf(), 2, { W: true }],
  ['11 同檔 token valid → 放', W(inRepo('db/migrations/x.sql')), ctxOf({ token: 'valid' }), 0, {}],
  ['12 同檔 token expired → WARN', W(inRepo('db/migrations/x.sql')), ctxOf({ token: 'expired' }), 2, { W: true }],
  ['13 package-lock.json → WARN', W(inRepo('package-lock.json')), ctxOf(), 2, { W: true }],
  ['14 Dockerfile → WARN', W(inRepo('Dockerfile')), ctxOf(), 2, { W: true }],
  ['15 a.ts feature → 放', W(inRepo('a.ts')), ctxOf(), 0, {}],
  ['16 tool_name 小寫 edit → 視同 Edit', W(inRepo('.env'), 'edit'), ctxOf(), 2, { B: true }],
  ['17 branch Main → 擋', W(inRepo('a.ts')), ctxOf({ branch: 'Main' }), 2, { b: true }],
  ['18 branch null（非 git）→ 放', W(inRepo('a.ts')), ctxOf({ branch: null }), 0, {}],
  ['19 detached HEAD → 放', W(inRepo('a.ts')), ctxOf({ branch: 'HEAD' }), 0, {}],
  ['20 空 stdin（payload undefined）protected → 2 只含「目前在」', undefined, ctxOf({ branch: 'main' }), 2, { b: true, B: false, W: false }],
  ['21 Write 無 tool_input protected → 擋', { tool_name: 'Write' }, ctxOf({ branch: 'main' }), 2, { b: true }],
  ['22 Write 無 file_path protected → 擋', { tool_name: 'Write', tool_input: {} }, ctxOf({ branch: 'main' }), 2, { b: true }],
  ['23 未知 tool → 放', { tool_name: 'Bash', tool_input: { command: 'x' } }, ctxOf({ branch: 'main' }), 0, {}],
  ['24 state dir 建不起來 + WARN → 擋、含 state dir', W(inRepo('Dockerfile')), ctxOf({ stateDir: false }), 2, { S: true, W: false }],
  // security-audit 實測繞過：file_path 是數字 → 舊版 path.resolve 拋錯被 catch 成「repo 外」放行；現在當沒帶路徑、branch 照查
  ['25 file_path 是數字（protected）→ 擋', W(123), ctxOf({ branch: 'main' }), 2, { b: true }],
  ['26 file_path 是物件（protected）→ 擋', W({ a: 1 }), ctxOf({ branch: 'main' }), 2, { b: true }],
  ['27 tool_input 是字串（protected）→ 擋（當沒帶路徑）', { tool_name: 'Write', tool_input: 'x' }, ctxOf({ branch: 'main' }), 2, { b: true }],
  ['28 JSON 字面 null（protected）→ 放（舊 .tool_name 取 null → exit 0）', null, ctxOf({ branch: 'main' }), 0, {}],
  ['29 空 stdin（payload undefined、protected）→ 擋', undefined, ctxOf({ branch: 'main' }), 2, { b: true }],
  // 8.3 短檔名：repoDir 給短檔名、file_path 給長檔名，realpath 注入把兩者都解成長檔名 → 仍在 repo 內 → 擋
  ['30 repoDir 8.3 短檔名 vs file_path 長檔名（protected）→ 擋', W('C:\\Users\\tommy_sian\\repo\\a.ts'),
    { ...ctxOf({ branch: 'main' }), repoDir: 'C:\\Users\\TOMMY_~1\\repo', realpath: (p) => p.replace(/TOMMY_~1/i, 'tommy_sian') }, 2, { b: true }],
  // 31-44：Codex apply_patch（相對路徑以 repoDir 解析、多檔、兩趟）。review CC1：相對路徑不能 fail-open
  ['31 apply_patch 相對 src/a.ts protected → 擋', AP(['src/a.ts', 'src/b.ts']), ctxOf({ branch: 'main' }), 2, { b: true }],
  ['32 apply_patch 相對 Dockerfile → WARN', AP(['Dockerfile']), ctxOf(), 2, { W: true }],
  ['33 apply_patch 相對 package-lock.json → WARN', AP(['package-lock.json']), ctxOf(), 2, { W: true }],
  ['34 apply_patch 相對 .github/workflows/ci.yml → WARN', AP(['.github/workflows/ci.yml']), ctxOf(), 2, { W: true }],
  ['35 apply_patch 相對 credentials.json → BLOCK（Write 裸 credentials.json 仍放，fixture 9）', AP(['credentials.json'], 'Add File'), ctxOf(), 2, { B: true }],
  ['36 apply_patch Move to id_rsa → BLOCK', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: a.txt\n*** Move to: .ssh/id_rsa\n*** End Patch' } }, ctxOf(), 2, { B: true }],
  ['37 apply_patch 無 command → 當沒帶路徑（protected 擋）', { tool_name: 'apply_patch', tool_input: {} }, ctxOf({ branch: 'main' }), 2, { b: true }],
  ['38 apply_patch Delete .env.example → 放', AP(['.env.example'], 'Delete File'), ctxOf(), 0, {}],
  ['39 截斷 patch（無 End Patch）仍取到路徑 → .env BLOCK', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Add File: .env\n+X=1' } }, ctxOf(), 2, { B: true }],
  ['40 CRLF patch → Dockerfile WARN', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\r\n*** Update File: Dockerfile\r\n*** End Patch\r\n' } }, ctxOf(), 2, { W: true }],
  ['41 BLOCK + WARN 混合 → exit 2 雙訊息', AP(['.env', 'Dockerfile']), ctx2({ tokens: {} }), 2, { B: true, W: true }],
  ['42 兩 WARN 只一個有效 token → exit 2', AP(['Dockerfile', 'docker-compose.yml']), ctx2({ tokens: { [tokOf('Dockerfile')]: true } }), 2, { W: true }],
  ['43 兩 WARN 兩 token 都有效 → 放行', AP(['Dockerfile', 'docker-compose.yml']), ctx2({ tokens: { [tokOf('Dockerfile')]: true, [tokOf('docker-compose.yml')]: true } }), 0, {}],
  ['44 同路徑重複（Update + Move to 同檔）→ 只判一次', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: Dockerfile\n*** Move to: Dockerfile\n*** End Patch' } }, ctx2({ tokens: { [tokOf('Dockerfile')]: true } }), 0, {}],
];
// 31 / 41-44 的副作用斷言（P2D 表只看 exit + 訊息 tag）：branch 訊息只印一次；擋下不消耗；全過才逐檔消耗、target 各對；去重後只消耗一次
const apCase = (n) => P2D.find(([name]) => name.startsWith(`${n} `));
const apRun = (n) => { const [, payload, ctx] = apCase(n); return { r: G.decide(payload, ctx), ctx }; };
const ap31 = apRun(31).r.lines.filter((l) => l.includes('目前在')).length === 1;
const ap41 = apRun(41).ctx.consumed.length === 0;
const ap42 = apRun(42).ctx.consumed.length === 0;
const ap43 = (() => { const { ctx } = apRun(43); return ctx.consumed.length === 2 && ctx.consumed.every((c) => /dockerfile|docker-compose\.yml/i.test(c.t)) && new Set(ctx.consumed.map((c) => c.p)).size === 2; })();
const ap44 = apRun(44).ctx.consumed.length === 1;
const ap42Lines = apRun(42).r.lines;   // 只列無效那個檔的 --token；「處置（依序執行）」一次
const ap42Msg = ap42Lines.filter((l) => l.includes('--token')).length === 1 && ap42Lines.filter((l) => l.includes('處置（依序執行）')).length === 1;
const apExtra = ap31 && ap41 && ap42 && ap43 && ap44 && ap42Msg;
const p2dBad = P2D.filter(([, payload, ctx, exit, tg]) => { const r = G.decide(payload, ctx); const t = tags(r); return r.exit !== exit || Object.entries(tg).some(([k, v]) => t[k] !== v); }).map(([n]) => n);
// 25 / 26：token 路徑純運算——期望值用舊 ps1 對同一字串算過（2026-09-07：sha256("d:/x/.env") 前 16 hex）
const tp25 = G.tokenPathFor('d:/x/.env', { TMP: 'C:/t', USERNAME: 'u' }, 'win32', () => false).replace(/\\/g, '/');
const tp26 = G.tokenPathFor('d:/x/.env', { TEMP: 'C:/t2', USER: 'v' }, 'win32', () => false).replace(/\\/g, '/');
// scalar JSON / 只有空白的 stdin 在舊 ps1 都是 exit 0（.tool_name 取 null → default；ConvertFrom-Json 拋錯 → catch）
const p2dScalar = G.decide('x', ctxOf({ branch: 'main' })).exit === 0 && G.decide(123, ctxOf({ branch: 'main' })).exit === 0;
const HASH25 = '5cda4cbfd584ef07';
check(`P2d guard.mjs 純判定 ${P2D.length} 案全對（含 apply_patch 多檔兩趟）、scalar JSON 放行、token 路徑照 .NET 順序`,
  p2dBad.length === 0 && apExtra && p2dScalar && tp25 === `C:/t/bstack-file-guard-u/${HASH25}.token` && tp26 === `C:/t2/bstack-file-guard-v/${HASH25}.token`,
  `錯的案=[${p2dBad.join(' | ')}] apply_patch 副作用 31=${ap31} 41=${ap41} 42=${ap42}/${ap42Msg} 43=${ap43} 44=${ap44} scalar 放行=${p2dScalar} tp25=${tp25} tp26=${tp26}（後果：該擋沒擋 / 不該擋擋了、Codex 相對路徑 fail-open、一包 patch 裡別的檔失敗把 user 確認過的 token 燒掉、或 token 目錄跟舊版對不上；改處：hooks/guard.mjs decide / targetsOf / applyPatchPaths / tokenPathFor）`);
// P2e：真 spawn，守「CLI 有接上兩段 + 真的跑 git + --token 子命令 + consumeToken 的 IO」——P2d 全部 mock，這些只有這裡守
const { spawnSync, execFileSync: xgit } = await import('node:child_process');   // 在 else 區塊內，不能用 import 宣告
const { tmpdir } = await import('node:os');
const { mkdirSync: mkd, rmSync, writeFileSync: wf, readFileSync: rf } = await import('node:fs');
const p2eDir = join(tmpdir(), `bstack-p2e-${process.pid}`); rmSync(p2eDir, { recursive: true, force: true }); mkd(p2eDir, { recursive: true });
const p2eRepo = join(p2eDir, 'repo'); mkd(p2eRepo);
let gitOk = true;
try { xgit('git', ['init', '-q', '-b', 'main'], { cwd: p2eRepo, stdio: 'ignore' }); wf(join(p2eRepo, 'a'), 'x'); xgit('git', ['add', 'a'], { cwd: p2eRepo, stdio: 'ignore' }); xgit('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'i'], { cwd: p2eRepo, stdio: 'ignore' }); } catch { gitOk = false; }
const p2eEnv = { ...process.env, CLAUDE_PROJECT_DIR: p2eRepo, TMP: p2eDir, TEMP: p2eDir, TMPDIR: p2eDir }; delete p2eEnv.XDG_RUNTIME_DIR;
const spawnHook = (payload, extra = []) => spawnSync(process.execPath, [join(REPO, 'hooks/guard.mjs'), ...extra], { input: payload === undefined ? '' : JSON.stringify(payload), encoding: 'utf8', env: p2eEnv, cwd: p2eRepo });
const e1 = spawnHook({ tool_name: 'Read', tool_input: { file_path: join(p2eRepo, 'a') } });
const e2 = spawnHook({ tool_name: 'Write', tool_input: { file_path: join(p2eDir, 'outside', '.env') } });
const e3 = spawnHook({ tool_name: 'Write', tool_input: { file_path: join(p2eRepo, 'src', 'a.ts') } });   // 真 git：main → 擋
const dockerOut = join(p2eDir, 'outside', 'Dockerfile');
const e4 = spawnHook({ tool_name: 'Write', tool_input: { file_path: dockerOut } });                    // WARN、印 --token 指令
const tokenPath = ((e4.stderr || '').match(/--token "([^"]+)"/) || [])[1];
const e5 = tokenPath ? spawnHook(undefined, ['--token', tokenPath]) : { status: -1 };                  // 子命令建 token
const tokenMade = tokenPath ? exists(tokenPath) || (await import('node:fs')).existsSync(tokenPath) : false;
const e6 = spawnHook({ tool_name: 'Write', tool_input: { file_path: dockerOut } });                    // 有 token → 放行、token 刪、log +1
const tokenGone = tokenPath ? !(await import('node:fs')).existsSync(tokenPath) : false;
const logOk = tokenPath ? /consumed .*valid=True/.test((() => { try { return rf(join(tokenPath, '..', 'consumed.log'), 'utf8'); } catch { return ''; } })()) : false;
// Codex 路：沒有 CLAUDE_PROJECT_DIR、cwd 在 repo 子目錄、apply_patch 相對路徑 → 靠 git toplevel 算 repoDir，main 仍擋；stderr 自帶兩 host 答案
const p2eSub = join(p2eRepo, 'sub'); mkd(p2eSub, { recursive: true });
const codexEnv = { ...p2eEnv }; delete codexEnv.CLAUDE_PROJECT_DIR;
const AP2 = (files) => ({ tool_name: 'apply_patch', tool_input: { command: ['*** Begin Patch', ...files.map((f) => `*** Update File: ${f}`), '*** End Patch'].join('\n') } });
const e7 = spawnSync(process.execPath, [join(REPO, 'hooks/guard.mjs')], { input: JSON.stringify(AP2(['src/a.ts'])), encoding: 'utf8', env: codexEnv, cwd: p2eSub });
const e7ok = e7.status === 2 && /目前在/.test(e7.stderr || '') && /request_user_input/.test(e7.stderr || '') && /AskUserQuestion/.test(e7.stderr || '');
// 多檔 WARN：兩行 --token、共用步驟只印一次（main 上會同時印 branch 訊息，不影響計數）
const e8 = spawnSync(process.execPath, [join(REPO, 'hooks/guard.mjs')], { input: JSON.stringify(AP2(['Dockerfile', 'docker-compose.yml'])), encoding: 'utf8', env: codexEnv, cwd: p2eRepo });
const e8tok = ((e8.stderr || '').match(/--token "/g) || []).length;
const e8ok = e8.status === 2 && e8tok === 2 && ((e8.stderr || '').match(/處置（依序執行）/g) || []).length === 1;
rmSync(p2eDir, { recursive: true, force: true });
check('P2e guard.mjs 真 spawn：Read → 0；repo 外 .env → BLOCK；真 git main → 擋；WARN → --token 建檔 → 再跑放行且 token 已刪、consumed.log 有 valid=True；Codex apply_patch 無 CLAUDE_PROJECT_DIR 走 git toplevel 仍擋、訊息含兩 host 工具名、多檔 WARN 兩行 --token 共用步驟一次',
  gitOk && e1.status === 0 && e2.status === 2 && /BLOCK/.test(e2.stderr || '') && e3.status === 2 && /目前在/.test(e3.stderr || '') &&
    e4.status === 2 && /WARN/.test(e4.stderr || '') && !!tokenPath && e5.status === 0 && tokenMade && e6.status === 0 && tokenGone && logOk && e7ok && e8ok,
  `git=${gitOk} Read=${e1.status} .env=${e2.status} main擋=${e3.status}/${/目前在/.test(e3.stderr || '')} WARN=${e4.status} tokenPath=${!!tokenPath} --token=${e5.status}/${tokenMade} 放行=${e6.status} token刪=${tokenGone} log=${logOk} codex-toplevel=${e7.status}/${e7ok} 多檔WARN=${e8.status}/${e8tok}/${e8ok}` +
    `（後果：CLI 沒接上判定、git spawn 寫壞會靜默放行、Codex 上 repoDir 退回 cwd 讓子目錄裡的相對路徑 fail-open、或 WARN 指示照抄卻建不出 token；改處：hooks/guard.mjs main() / gitToplevel / consumeToken / --token）`);

// ── P3 skills ───────────────────────────────────────────────────────────────
const skillDirs = readdirSync(join(REPO, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const nameBad = [], trigBad = [];
for (const name of skillDirs) {
  const p = `skills/${name}/SKILL.md`;
  if (!exists(p)) { nameBad.push(`${name}(無 SKILL.md)`); continue; }
  const fm = frontmatter(rd(p));
  const nm = ((fm.match(/^name:\s*(.+)$/m) || [])[1] || '').trim().replace(/^["']|["']$/g, '');
  if (nm !== name) nameBad.push(`${name}(name=${nm})`);
  const d = description(fm);
  if (!d) nameBad.push(`${name}(描述空)`);
  if (/觸發：/.test(d)) trigBad.push(name);
}
check('P3a ≥28 個 skill、name==目錄名、描述非空（下限而非精確值；精確計數由 P8 守）',
  skillDirs.length >= 28 && nameBad.length === 0, `實際 ${skillDirs.length} 個、問題 [${nameBad.join(', ')}]`);
check('P3b devwork 入口 skill 存在且描述提到 /devwork',
  exists('skills/devwork/SKILL.md') && /\/devwork/.test(description(frontmatter(rd('skills/devwork/SKILL.md')))),
  `期望 skills/devwork/SKILL.md 存在且描述含 /devwork（後果：使用者不知道怎麼啟動）`);
check('P3c 沒有任何 skill 描述含「觸發：」', trigBad.length === 0,
  `實際 ${trigBad.length} 個：${trigBad.slice(0, 8).join(', ')}（後果：自然語言觸發詞還在 = 沒下 /devwork 也會被攔）`);

// ── P7 agents（先算，P4 要用 agentFiles）──────────────────────────────────────
const agentFiles = exists('agents') ? readdirSync(join(REPO, 'agents')).filter((f) => f.endsWith('.md')) : [];
const agentBad = [];
for (const f of agentFiles) {
  const fm = frontmatter(rd(`agents/${f}`));
  if (!/^name:/m.test(fm) || !/^description:/m.test(fm)) agentBad.push(`${f}(缺 name/description)`);
  const d = description(fm);
  if (!d) agentBad.push(`${f}(描述空)`);
  if (/觸發：/.test(d)) agentBad.push(`${f}(描述含「觸發：」)`);
}
// agent 用精確值而非下限：agent 變動頻率低、且 README「## Agents（N）」一起比，漂移當場紅
const readmeAgents = Number((rd('README.md').match(/^## Agents（(\d+)）/m) || [])[1]);
check(`P7 agents frontmatter 齊、描述無「觸發：」、README 計數 == 磁碟 ${agentFiles.length}`,
  agentFiles.length > 0 && agentBad.length === 0 && readmeAgents === agentFiles.length,
  `實際 ${agentFiles.length} 個、README=${readmeAgents}、問題 [${agentBad.join(', ')}]`);

// ── P4 全域安裝路徑字樣 ────────────────────────────────────────────────────────
// 白名單行：只有講「遷移 / 舊副本 / 遮蔽」的行才准提到 ~/.claude 安裝路徑，而且白名單行數有上限，
// 免得白名單本身漂移成漏洞（第一版用「舊版|不寫入|不碰」太寬，review 抓到）。
const FORBID = /(~|\$HOME|\$env:USERPROFILE)[\\/]\.claude[\\/](skills|hooks|agents|settings\.json|CLAUDE\.md|statusline\.sh)/;
const ALLOW_LINE = /-Migrate|setup\.ps1|遮蔽|bstack-bak|plugins\//;
const ALLOW_MAX = 6;
const refDocs = [];
for (const n of skillDirs) {
  const dir = join(REPO, 'skills', n, 'references');
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith('.md')) refDocs.push(`skills/${n}/references/${f}`);
}
const scanTargets = [
  ...skillDirs.map((n) => `skills/${n}/SKILL.md`), ...refDocs, ...agentFiles.map((f) => `agents/${f}`),
  'hooks/guard.mjs', 'CLAUDE.md', 'README.md',
  'skills/devwork/rules.md', 'docs/index.html', 'docs/js/data.js',
].filter(exists);
const hits = [], allowed = [];
for (const p of scanTargets) rd(p).split(/\r?\n/).forEach((line, i) => {
  if (!FORBID.test(line)) return;
  (ALLOW_LINE.test(line) ? allowed : hits).push(`${p}:${i + 1}`);
});
check(`P4 無 ~/.claude/{skills,hooks,agents,settings.json,CLAUDE.md,statusline.sh} 字樣（白名單行 ${allowed.length} ≤ ${ALLOW_MAX}）`,
  hits.length === 0 && allowed.length <= ALLOW_MAX,
  `違規 ${hits.length} 處：${hits.slice(0, 8).join(' / ')}；白名單行 ${allowed.length} 處：${allowed.join(' / ')}（後果：文件教人去全域找檔，位置全錯；白名單超上限代表有人拿遷移措辭掩護新的全域路徑）`);

// ── P5 全域 sync 路徑已移除、範本合法 ────────────────────────────────────────────
const tmpl = exists('templates/project-settings.json') ? parseJson('templates/project-settings.json') : { __err: '不存在' };
const p5 = {
  'settings.json 已刪': !exists('settings.json'),
  'scripts/setup.ps1 已刪': !exists('scripts/setup.ps1'),
  'state/ 已刪': !exists('state'),
  'scripts/extras.ps1 存在': exists('scripts/extras.ps1'),
  'scripts/install.ps1 存在': exists('scripts/install.ps1'),
  'extras/statusline.sh 存在': exists('extras/statusline.sh'),
  'templates/project-settings.json 合法且 allow 含 Read': !tmpl.__err && Array.isArray(tmpl.permissions?.allow) && tmpl.permissions.allow.includes('Read') && tmpl.enabledPlugins?.['bstack@bstack'] === true,
};
const p5bad = Object.entries(p5).filter(([, ok]) => !ok).map(([k]) => k);
check('P5 全域 sync 路徑已移除、extras 與範本到位', p5bad.length === 0, `不過 [${p5bad.join(', ')}]`);

// ── P6 rules.md 單一真相 ──────────────────────────────────────────────────────
check('P6 rules.md 存在且 CLAUDE.md 以 @ 引用',
  exists('skills/devwork/rules.md') && /^@skills\/devwork\/rules\.md\s*$/m.test(rd('CLAUDE.md')) && /### §事實核實/.test(rd('skills/devwork/rules.md')),
  `期望 rules.md 有 §事實核實 且 CLAUDE.md 含獨立一行 @skills/devwork/rules.md（後果：兩份守則漂移）`);

// ── P8 計數 ─────────────────────────────────────────────────────────────────
// 2026-09-08 void 改版後 landing 的三處計數換了 markup：hero 從 `<b>N</b><span>skills</span>`
// 變成帶 inline style 的 <b>/<span>，legend 那條整個沒了，改成 inventory 列。錨點跟著換。
const n = skillDirs.length;
const readmeN = Number((rd('README.md').match(/^## Skills（(\d+)）/m) || [])[1]);
const html = exists('docs/index.html') ? rd('docs/index.html') : '';
// hero stat 列：<b …>28</b><span …>skills</span>
const heroN = Number((html.match(/<b[^>]*>(\d+)<\/b><span[^>]*>skills<\/span>/i) || [])[1]);
// inventory 列：…>skills</span>…（中間一段說明）…>28</span>
const invN = Number((html.match(/>skills<\/span>[\s\S]{0,400}?>(\d+)<\/span>/i) || [])[1]);
const metaN = Number((html.match(/content="(\d+) 個 skill/) || [])[1]);
// 最強的一條：landing 的 skill 索引卡是一份手寫清單，數字對了但清單漏一個照樣不會有人發現。
const listed = [...(html.match(/const SKILLS = \[[\s\S]*?\n\];/) || [''])[0].matchAll(/\['([^']+)'/g)].map((m) => m[1]);
const listMissing = skillDirs.filter((s) => !listed.includes(s));
const listExtra = listed.filter((s) => !skillDirs.includes(s));
check(`P8 README / index.html 的 skill 計數與清單 == 磁碟 ${n}`,
  readmeN === n && heroN === n && invN === n && metaN === n &&
    listed.length === n && listMissing.length === 0 && listExtra.length === 0,
  `README=${readmeN} hero=${heroN} inventory=${invN} meta=${metaN} 索引卡=${listed.length}` +
  `${listMissing.length ? ' 缺[' + listMissing.join(',') + ']' : ''}` +
  `${listExtra.length ? ' 多[' + listExtra.join(',') + ']' : ''}` +
  `（後果：公開站報錯數字，或新 skill 上了站但索引卡查不到；` +
  `改處：README.md「## Skills（N）」、index.html 的 hero stat 列 / inventory 列 / meta description / const SKILLS）`);

// ── P9 T2 lane 一致性（2026-09-04 精簡）────────────────────────────────────
// lane 定義散在 rules / 9 個 skill / 1 個 agent / README / landing，任一處留舊敘述，
// Claude 在那一步就照舊做。逐檔 grep 新舊字樣，舊的還在或新的沒到就紅，訊息附改處。
const rulesMd = rd('skills/devwork/rules.md');
const tierT2 = (rulesMd.match(/^\| \*\*T2\*\*.*$/m) || [''])[0];
const tierT3 = (rulesMd.match(/^\| \*\*T3\*\*.*$/m) || [''])[0];
const tierHead = (rulesMd.match(/^\| Tier \| 量體 \|.*$/m) || [''])[0];
// review 欄 2026-09-04 二改：T2 = 內建 code-review medium + 主 agent spec 自檢；T3 = code-review high + 1 個
// spec / 架構對齊 subagent；純文件 diff 兩者都跳。舊字樣「1 subagent」「雙視角」還在就是沒改到。
// 「雙視角」的反向掃描是全 repo（skills / agents / README / data.js / index.html）：只掃 Tier 表那列的話，
// §協作模式判定 與 dispatch-parallel 的殘留會讓契約綠著、Claude 照舊開兩個 reviewer（本 PR code-review 抓到的）。
const dualResidue = [];
for (const dir of ['skills', 'agents']) for (const f of readdirSync(join(REPO, dir), { withFileTypes: true })) {
  const p = f.isDirectory() ? `${dir}/${f.name}/SKILL.md` : `${dir}/${f.name}`;
  if (exists(p) && /雙視角/.test(rd(p))) dualResidue.push(p);
}
for (const p of ['README.md', 'docs/js/data.js', 'docs/index.html']) if (/雙視角/.test(rd(p))) dualResidue.push(p);
check('P9a rules.md §Tier 表：T2 施工清單 + code-review medium；T3 code-review high + 1 subagent、視角依面向；表頭有 pr-explain 欄；全 repo 無「雙視角」',
  /施工清單/.test(tierT2) && /code-review medium/.test(tierT2) && !/1 subagent（prompt/.test(tierT2) &&
    /code-review high/.test(tierT3) && /依改動面向/.test(tierT3) && dualResidue.length === 0 &&
    !/lang-reviewer/.test(tierT3) && /pr-explain/.test(tierHead) && !/T2-T3 詳/.test(rulesMd),
  `T2=「${tierT2.slice(0, 90)}」 T3 code-review high=${/code-review high/.test(tierT3)} 依面向=${/依改動面向/.test(tierT3)} 殘留「雙視角」=[${dualResidue.join(', ')}] ` +
    `表頭 pr-explain=${/pr-explain/.test(tierHead)} 殘留「T2-T3 詳」=${/T2-T3 詳/.test(rulesMd)}` +
    `（後果：Tier 表是 lane 唯一真相，沒改等於沒精簡；殘留處會讓 Claude 照舊開兩個 reviewer；改處：rules.md「§Tier 機制」表 T2 / T3 的 review 欄與列出的殘留檔）`);
const bsMd = rd('skills/brainstorm/SKILL.md'), exMd = rd('skills/execute-plan/SKILL.md');
check('P9b brainstorm 範本有裸標題「## 施工清單」與「## 施工紀錄」、spec gate 選單指 execute-plan；execute-plan 讀施工清單且允許 plan_path null',
  /^## 施工清單$/m.test(bsMd) && /^## 施工紀錄$/m.test(bsMd) && /進 execute-plan/.test(bsMd) && !/進 <write-plan\|debug-systematic>/.test(bsMd) &&
    /恰為\*{0,2} `## 施工清單`/.test(exMd) && /plan_path.*null/.test(exMd) && /施工紀錄/.test(exMd),
  `brainstorm 標題=${/^## 施工清單$/m.test(bsMd)} 紀錄=${/^## 施工紀錄$/m.test(bsMd)} gate=${/進 execute-plan/.test(bsMd)} ` +
    `execute-plan 精確比對=${/恰為\*{0,2} \`## 施工清單\`/.test(exMd)} null=${/plan_path.*null/.test(exMd)}` +
    `（後果：兩端契約缺一邊 T2 就卡；改處：brainstorm「§spec 文件結構」「§交棒」、execute-plan「§使用契約」第 1 步）`);
const rrMd = rd('skills/request-review/SKILL.md'), dwMd = rd('skills/dev-workflow/SKILL.md');
// 2026-09-04 二改：request-review 先依副檔名分流（純文件跳）、程式碼 diff 交內建 code-review（T2 medium / T3 high）、
// T3 只留 1 個 spec / 架構對齊 subagent（舊視角 B 拿掉）、不帶 --fix / --comment；dev-workflow Phase 5 三行同步。
const dwPhase5 = (dwMd.match(/^5\. request-review[\s\S]*?(?=^   ↓)/m) || [''])[0];
check('P9c request-review 依副檔名分流、程式碼交 code-review（T2 medium / T3 high、不帶 --fix）、純文件跳、無視角 B；dev-workflow Phase 5 同步',
  !/subagent_type\s*[:=]\s*`?lang-reviewer/.test(rrMd) && /§語言提示/.test(rrMd) && /§副檔名分流/.test(rrMd) &&
    /Skill\("code-review", args="medium"\)/.test(rrMd) && /Skill\("code-review", args="high"\)/.test(rrMd) &&
    /純文件/.test(rrMd) && !/args="[^"]*--(fix|comment)/.test(rrMd) && !/視角 B/.test(rrMd) && !/plan: <plan 內容>/.test(rrMd) &&
    /code-review medium/.test(dwPhase5) && /code-review high/.test(dwPhase5) && /純文件/.test(dwPhase5) && !/\+\s*lang-reviewer/.test(dwMd),
  `request-review 自動派發=${/subagent_type\s*[:=]\s*`?lang-reviewer/.test(rrMd)} 語言提示段=${/§語言提示/.test(rrMd)} 副檔名分流段=${/§副檔名分流/.test(rrMd)} ` +
    `Skill medium=${/Skill\("code-review", args="medium"\)/.test(rrMd)} high=${/Skill\("code-review", args="high"\)/.test(rrMd)} 純文件=${/純文件/.test(rrMd)} ` +
    `殘留視角 B=${/視角 B/.test(rrMd)} args 帶 --fix/--comment=${/args="[^"]*--(fix|comment)/.test(rrMd)} ` +
    `dev-workflow Phase 5 medium=${/code-review medium/.test(dwPhase5)} high=${/code-review high/.test(dwPhase5)} 純文件=${/純文件/.test(dwPhase5)} 殘留「+ lang-reviewer」=${/\+\s*lang-reviewer/.test(dwMd)}` +
    `（後果：request-review 照舊自寫 prompt 開 reviewer、或 dev-workflow 路徑圖跟 skill 打架；改處：request-review「§使用契約」「§副檔名分流」「§T2」「§T3」、dev-workflow「Phase 5」三行）`);
const fbMd = rd('skills/finish-branch/SKILL.md'), peFm = frontmatter(rd('skills/pr-explain/SKILL.md'));
check('P9d finish-branch 只在 T3 交棒 pr-explain、PR body plan 行允許 N/A；pr-explain 描述註明 T3',
  /T3 → 交棒 pr-explain/.test(fbMd) && /N\/A（T2/.test(fbMd) && /T3/.test(description(peFm)),
  `finish-branch T3 交棒=${/T3 → 交棒 pr-explain/.test(fbMd)} PR body N/A=${/N\/A（T2/.test(fbMd)} pr-explain.desc T3=${/T3/.test(description(peFm))}` +
    `（後果：T2 每次多燒數萬 token；改處：finish-branch「§使用契約」第 6 步、「§PR body 模板」Refs、「§hand-off state」；pr-explain frontmatter）`);
const rvMd = rd('skills/receive-review/SKILL.md');
check('P9e receive-review 不危險類一顆 commit',
  /處理 review finding/.test(rvMd) && /一顆 commit/.test(rvMd) && !/每 finding fix 一個 commit/.test(rvMd),
  `新句=${/處理 review finding/.test(rvMd)} 一顆=${/一顆 commit/.test(rvMd)} 舊句=${/每 finding fix 一個 commit/.test(rvMd)}` +
    `（後果：squash 後全消失的 commit 照做；改處：receive-review「§不危險處置」「§Red Flags」）`);
const lrFm = frontmatter(rd('agents/lang-reviewer.md'));
check('P9f lang-reviewer agent 描述改 user 顯式呼叫',
  !/動態 (spawn|dispatch)/.test(description(lrFm)) && /顯式/.test(description(lrFm)),
  `desc=「${description(lrFm).slice(-70)}」（後果：agent 描述與 request-review 打架；改處：agents/lang-reviewer.md description 首句與末句）`);
const readmeMd = rd('README.md');
const readmeLR = (readmeMd.match(/^\| \*\*lang-reviewer\*\*.*$/m) || [''])[0];
check('P9g README：lang-reviewer 列不寫「自動派發」、簡介標 T3 PR 解釋',
  readmeLR !== '' && !/自動派發/.test(readmeLR) && /T3 PR 自動解釋/.test(readmeMd),
  `lang-reviewer 列=「${readmeLR.slice(0, 60)}」 簡介 T3=${/T3 PR 自動解釋/.test(readmeMd)}（後果：README 說謊；改處：README.md 第 5 行與 Agents 表）`);
const rpMd = rd('skills/review-plan/SKILL.md'), wpMd = rd('skills/write-plan/SKILL.md');
check('P9h review-plan / write-plan 無 T2 分支、review-plan 視角依面向、無 CEO',
  !/T2.*Eng-only|Eng-only.*T2|T2 不能跳|T2 仍需/.test(rpMd) && /依改動面向|命中幾個派幾個/.test(rpMd) && !/CEO/.test(rpMd) && !/Eng-only/.test(wpMd) &&
    !/4 視角/.test(rd('skills/context-snapshot/SKILL.md')) && !/T1 由 brainstorm 直接交棒/.test(rd('skills/write-skill/SKILL.md')),
  `review-plan 殘留 T2=${/T2.*Eng-only|Eng-only.*T2|T2 不能跳|T2 仍需/.test(rpMd)} 依面向=${/依改動面向|命中幾個派幾個/.test(rpMd)} CEO=${/CEO/.test(rpMd)} write-plan Eng-only=${/Eng-only/.test(wpMd)}` +
    `（後果：前提說 T2 不進、Red Flag 說 T2 不准跳，Claude 挑一條照做；改處：review-plan 全檔、write-plan「§落檔 + 交棒」）`);
const ddMd = rd('skills/design-direction/SKILL.md'), dpMd = rd('skills/dispatch-parallel/SKILL.md');
check('P9i design-direction 下游分 T2 / T3；dispatch-parallel task 來源含施工清單',
  (ddMd.match(/T2 → 回 `brainstorm`/g) || []).length === 2 && /施工清單/.test(dpMd) &&
    !/退 write-plan\*\* 改 parallel-group 標$/m.test(dpMd) && !/→ 退 write-plan$/m.test(dpMd),
  `design-direction 下游 T2 分流=${(ddMd.match(/T2 → 回 `brainstorm`/g) || []).length}/2 dispatch-parallel 施工清單=${/施工清單/.test(dpMd)} 殘留「→ 退 write-plan」=${/→ 退 write-plan$/m.test(dpMd)}` +
    `（後果：T2 大改定案後沒人回寫清單、T2 同 group 派工找不到 Task N；改處：design-direction description 與「§與 dev-workflow 銜接」下游、dispatch-parallel「§使用契約」1-2、「§隊友派工」「§subagent 派工」範本、「§失敗處置」）`);

// ── P10 verify-done 文字節點豁免（2026-09-04）────────────────────────────────
// T3 前端改動只動文字節點 / data-* 時不派 frontend-e2e-runner，改主 agent smoke；判定器是 scripts/text-only-diff.mjs。
// P10a 直接 import 判定器對 fixture 執行（code-review 抓到第一版行級比對被四種改法繞過，字樣 grep 守不住判定邏輯）；
// P10b 守三個文字落點（verify-done / dev-workflow 跨流程表 / 流程圖 UIQ label）任一處沒寫到，Claude 就照舊派整套 e2e。
const { skeleton: tdSkeleton, judgeFiles: tdJudge } = await import('./text-only-diff.mjs');
const H = (attrs = '') => `<!doctype html><html><head><script>var k="t";</script><style>.a{color:red}</style></head><body>\n<p class="x"${attrs}>hello</p>\n<p class="y" data-n="1">two</p>\n</body></html>`;
const fx = [
  ['文字節點改動 → 豁免', H().replace('hello', 'world'), true],
  ['data-* 值改動 → 豁免', H().replace('data-n="1"', 'data-n="9"'), true],
  ['多行文字重排（純文字行）→ 豁免', H().replace('hello', 'hel\nlo'), true],
  ['class 值改動 → NOT', H().replace('class="x"', 'class="z"'), false],
  ['新增 data-* 屬性 → NOT', H(' data-hidden="true"'), false],
  ['標籤順序對調 → NOT', H().replace('<p class="x">hello</p>\n<p class="y" data-n="1">two</p>', '<p class="y" data-n="1">two</p>\n<p class="x">hello</p>'), false],
  ['inline script 內容改動 → NOT', H().replace('var k="t"', 'var k="u"'), false],
  ['inline style 內容改動 → NOT', H().replace('color:red', 'color:blue'), false],
  ['多行標籤的屬性行改動 → NOT', H().replace('<p class="x">', '<p\n  class="w"\n  >'), false],
];
const fxBad = fx.filter(([, after, expect]) => tdJudge([{ path: 'a.html', before: H(), after }]).ok !== expect).map(([n]) => n);
const emptyOk = !tdJudge([]).ok, newFileOk = !tdJudge([{ path: 'b.html', before: null, after: H() }]).ok;
check('P10a text-only-diff.mjs 判定器對 9 個 fixture 全對、空集合與新增檔 fail-closed',
  fxBad.length === 0 && emptyOk && newFileOk && typeof tdSkeleton === 'function',
  `錯的 fixture=[${fxBad.join(' | ')}] 空集合 fail-closed=${emptyOk} 新增檔 fail-closed=${newFileOk}（後果：豁免判錯 → T3 少跑整套 e2e；改處：scripts/text-only-diff.mjs skeleton / judgeFiles）`);
const vdMd = rd('skills/verify-done/SKILL.md');
const vdE2e = (vdMd.match(/^## §UI \/ browser e2e[\s\S]*?(?=^## )/m) || [''])[0];
const dwFeRow = (dwMd.match(/^\| `frontend-test` \|.*$/m) || [''])[0];
const dataJs = rd('docs/js/data.js');
const uiqLabel = (dataJs.match(/UIQ:\s*\{[^}]*label:\s*'([^']*)'/) || ['', ''])[1];
const fbTpl = rd('skills/finish-branch/SKILL.md');
check('P10b verify-done §UI / browser e2e 有文字節點豁免（呼叫 text-only-diff.mjs + smoke）、yaml e2e 含 smoke；dev-workflow frontend-test 列、data.js UIQ label、finish-branch PR 模板同步',
  /文字節點/.test(vdE2e) && /text-only-diff\.mjs/.test(vdE2e) && /static-serve\.mjs/.test(vdE2e) && /smoke/.test(vdE2e) && /data-\*/.test(vdE2e) && !/node -e '/.test(vdE2e) &&
    /e2e: pass \| fail \| skipped \| smoke/.test(vdMd) && /文字節點/.test(dwFeRow) && /smoke/.test(uiqLabel) && /e2e: <pass \| smoke/.test(fbTpl) &&
    exists('scripts/text-only-diff.mjs') && exists('scripts/static-serve.mjs'),
  `verify-done 豁免段：文字節點=${/文字節點/.test(vdE2e)} 呼叫判定器=${/text-only-diff\.mjs/.test(vdE2e)} static-serve=${/static-serve\.mjs/.test(vdE2e)} smoke=${/smoke/.test(vdE2e)} 殘留 node -e 一行=${/node -e '/.test(vdE2e)} yaml smoke=${/e2e: pass \| fail \| skipped \| smoke/.test(vdMd)} ` +
    `dev-workflow 列=${/文字節點/.test(dwFeRow)} UIQ label=「${uiqLabel.slice(0, 40)}」 finish-branch 模板 e2e 欄=${/e2e: <pass \| smoke/.test(fbTpl)}` +
    `（後果：文字節點改動照樣燒一整套 e2e agent、或 smoke-only 的 PR 被寫成全綠；改處：verify-done「§UI / browser e2e」與「§hand-off state」、dev-workflow「§跨流程 skill 載入」frontend-test 列、data.js UIQ 節點、finish-branch「§PR body 模板」）`);

// ── P11 design-language 延遲載入（2026-09-07）────────────────────────────────
// brainstorm 0b′ 自己做副檔名比對、命中才載 design-language；清單因此三寫（brainstorm / design-language / rules.md），
// 任一處漂掉 brainstorm 就對某副檔名判不命中、前端改動漏掉設計對齊。用區段切片 + tokenize 比（直接字串比會被格式差咬死）。
const section = (text, startRe) => { const m = text.match(startRe); if (!m) return ''; const rest = text.slice(m.index + m[0].length); const end = rest.search(/^#{2,3} /m); return end < 0 ? rest : rest.slice(0, end); };
const exts = (seg) => [...new Set((seg.match(/\.(css|scss|sass|less|tsx|jsx|vue|svelte|html)\b/g) || []))].sort().join(' ');
const bs0b = section(bsMd, /^## §Phase 0b′[^\n]*\n/m);
// design-language 只抓該節的 fenced block（節內另有「.sass 現況分歧」註記，不是清單）
const dlExt = (section(rd('skills/design-language/SKILL.md'), /^## §前端副檔名[^\n]*\n/m).match(/```[^\n]*\r?\n([\s\S]*?)```/) || ['', ''])[1];   // 檔案可能是 CRLF
const rulesDL = section(rulesMd, /^### §設計語言對齊[^\n]*\n/m);
const dlMd = rd('skills/design-language/SKILL.md');
// 同一份清單另有 4 處「觸發用」引用（frontend-test / verify-done / dev-workflow 跨流程表 / 流程圖 DesignQ label），一起守
const others = {
  'frontend-test': (rd('skills/frontend-test/SKILL.md').match(/^\| T2 \+ 前端檔改動.*$/m) || [''])[0],
  'verify-done': (rd('skills/verify-done/SKILL.md').match(/^改動含 UI \/ 前端檔.*$/m) || [''])[0],
  'dev-workflow': (dwMd.match(/^\| `frontend-test` \|.*$/m) || [''])[0],
  'data.js DesignQ': (rd('docs/js/data.js').match(/DesignQ:.*$/m) || [''])[0],
};
const othersBad = Object.entries(others).filter(([, seg]) => exts(seg) !== exts(dlExt)).map(([n, seg]) => `${n}=[${exts(seg)}]`);
const dw0bLine = (dwMd.match(/^0b′ UI 面判定.*$/m) || [''])[0];
const dwDLRow = (dwMd.match(/^\| `design-language` \|.*$/m) || [''])[0];
check('P11 副檔名清單七處一致（判定用：brainstorm 0b′ / design-language §前端副檔名 / rules.md；觸發用：frontend-test / verify-done / dev-workflow / DesignQ）；brainstorm 內嵌剔除規則且命中才載；dev-workflow 去重同步',
  exts(dlExt) !== '' && exts(bs0b) === exts(dlExt) && exts(rulesDL) === exts(dlExt) && othersBad.length === 0 &&
    /不命中/.test(bs0b) && /不載/.test(bs0b) && /命中/.test(bs0b) && /才載|才載入/.test(bs0b) && /SKILL\.md/.test(bs0b) &&
    /^## §Phase 0c/m.test(bsMd) && /^## §Phase 0d/m.test(bsMd) &&
    !/Track 判定 heuristic|Tier 判定 heuristic/.test(dwMd) && /命中.{0,8}才載/.test(dwDLRow) && !/← 載 design-language/.test(dw0bLine) &&
    !/沒有跳的必要/.test(dlMd),
  `期望七處清單相同；實際 brainstorm=[${exts(bs0b)}] design-language=[${exts(dlExt)}] rules.md=[${exts(rulesDL)}] 觸發用不符=[${othersBad.join(' ')}]；` +
    `brainstorm 0b′ 不命中=${/不命中/.test(bs0b)} 不載=${/不載/.test(bs0b)} 才載=${/才載|才載入/.test(bs0b)} 內嵌 SKILL.md 剔除規則=${/SKILL\.md/.test(bs0b)}；` +
    `dev-workflow 殘留 heuristic 表=${/Track 判定 heuristic|Tier 判定 heuristic/.test(dwMd)} design-language 列命中才載=${/命中.{0,8}才載/.test(dwDLRow)} Phase 0 圖殘留「← 載」=${/← 載 design-language/.test(dw0bLine)} design-language Red Flags 殘留=${/沒有跳的必要/.test(dlMd)}` +
    `（改法：design-language §前端副檔名 是唯一真相，改它之後同步 brainstorm §Phase 0b′ 第 1 步與 rules.md §設計語言對齊；後果：不同步時 brainstorm 對某副檔名判不命中、不載 design-language，前端改動漏掉設計對齊）`);

// ── P12 security-audit 純文件 T3 跳（2026-09-07，lane 改變）──────────────────
// T3 security 欄從「必跑」改「程式碼 diff 必跑、純文件 diff 且無 File-type 硬規則命中跳」。
// 判定沿用 request-review 產出的 code_review_applicable，不另發明副檔名表；File-type 例外是因為
// .github/workflows/*.yml、docker-compose.yml、.npmrc 在 request-review 表裡歸純文件、卻是安全面最該看的檔。
// 六處文字任一處留「T3 必跑」，Claude 在那一步就照舊 spawn security-auditor，所以反向掃全 repo（不含 docs/archive）。
const saMd = rd('skills/security-audit/SKILL.md'), saAgent = rd('agents/security-auditor.md');
const t3Sec = (tierT3.split('|').map((s) => s.trim())[7]) || '';   // 欄序：'' T3 量體 brainstorm plan TDD review security pr-explain
const saStep2 = (saMd.match(/^2\. \*\*判定要不要跑\*\*[\s\S]*?(?=^3\. )/m) || [''])[0];
const saState = (saMd.match(/## §hand-off state[\s\S]*?```[\s\S]*?```/) || [''])[0];
const dwSecT3 = (dwMd.match(/^ {3}└─ T3 = .*security-checklist.*$/m) || [''])[0];
const secQ = (dataJs.match(/^\s*SecQ:.*$/m) || [''])[0];
const loadChk = (dataJs.match(/^\s*LoadChk:.*$/m) || [''])[0];
const fbSecLine = (fbMd.match(/^- \[x\] security-audit 過.*$/m) || [''])[0];
// 殘留掃描吃 P4 的 scanTargets（skills / references / agents / guard.mjs / CLAUDE.md / README / rules.md / index.html / data.js），
// 不另列清單——第一版自己列 skills + agents + 三個檔，漏了 rules.md 與 references（code-review 抓到）。
// 只看同一行有 security / audit / checklist / STRIDE / 稽核 字樣的：verify-done 的「T3 | **必跑**（fail 不能放行）」
// 跟 security 無關，不該被判成 security 殘留。「純文件」同行出現代表已改成新敘述、不算殘留。
const secLine = /security|audit|checklist|STRIDE|稽核/i;
const bareMustRun = /T3 \*{0,2}必[跑用]/;
const mustRunResidue = [];
for (const p of scanTargets) rd(p).split(/\r?\n/).forEach((line, i) => {
  if (secLine.test(line) && bareMustRun.test(line) && !/純文件/.test(line)) mustRunResidue.push(`${p}:${i + 1}`);
});
const p12 = {
  rulesCell: /純文件 diff/.test(t3Sec) && /File-type/.test(t3Sec) && /audit \+ checklist \+ db-reviewer/.test(t3Sec),
  saStep2: /code_review_applicable/.test(saStep2) && /File-type 硬規則/.test(saStep2),
  saState: /security_skipped_reason/.test(saState),
  dw: /純文件/.test(dwSecT3),
  secQ: /純文件/.test(secQ),
  loadChk: /純文件|同 SecQ|跳/.test(loadChk),
  agentDesc: /純文件/.test(description(frontmatter(saAgent))),
  fb: /純文件/.test(fbSecLine),
  residue: mustRunResidue.length === 0,
};
check('P12 security-audit 純文件 T3 跳：rules.md T3 security 欄、security-audit 第 2 步（讀 code_review_applicable + 查 File-type 硬規則）與 state（security_skipped_reason）、dev-workflow 第 6 行、data.js SecQ / LoadChk、security-auditor 描述、finish-branch checklist 六處同步；全 repo 無裸「T3 必跑 / 必用」',
  Object.values(p12).every(Boolean),
  `${Object.entries(p12).filter(([, v]) => !v).map(([k]) => k).join(', ')} 不過；T3 security 欄=「${t3Sec}」 dev-workflow 第 6 行=「${dwSecT3.trim()}」 殘留「T3 必跑 / 必用」=[${mustRunResidue.join(', ')}]` +
    `（後果：Tier 表是 lane 唯一真相，任一處留「T3 必跑」Claude 就照舊 spawn security-auditor、純文件 PR 多燒 3-5 分鐘；改處：rules.md §Tier 表 T3 security 欄、security-audit §使用契約 第 2 步與 §hand-off state、dev-workflow 9 階段圖第 6 行、data.js SecQ / LoadChk、agents/security-auditor.md description、finish-branch PR 模板 checklist）`);

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAIL`);
// 用 exitCode 而非 process.exit()：stdout 接 pipe 時 exit() 可能截掉最後幾行（含 ALL PASS 那行）
process.exitCode = failed === 0 ? 0 : 1;
}
