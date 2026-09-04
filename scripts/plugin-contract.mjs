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
 *
 * code 內段落順序是 P1 P2 P3 P7 P4 P5 P6 P8：P7 先算是因為 P4 要用 agentFiles 掃描。
 *
 * 跑法（**必須用 Bash，不要用 PowerShell**——$? 在 PowerShell 是布林、grep 不存在；
 * 在 pwsh 看 exit code 用 $LASTEXITCODE）：
 *   node scripts/plugin-contract.mjs
 *   node scripts/plugin-contract.mjs --selftest   # 驗 fail 路徑與 frontmatter 解析
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
check('P2a hooks.json 合法且每個 command 用 ${CLAUDE_PLUGIN_ROOT}',
  !hooks.__err && hookCmds.length >= 2 && badCmd.length === 0,
  `期望 ≥2 個 command 全含 \${CLAUDE_PLUGIN_ROOT}，實際 ${hooks.__err || `${hookCmds.length} 個、${badCmd.length} 個沒用變數`}（後果：hook 路徑寫死本機）`);
check('P2b hooks.json 指到的腳本都存在', missingScript.length === 0,
  `期望 0 個缺，實際缺 [${missingScript.join(', ')}]（後果：每次 Write / Edit 噴 hook 執行失敗）`);
check('P2c file-type-guard 不再寫 plugin 目錄內的 state/（含 docstring）',
  exists('hooks/file-type-guard.ps1') && !/state[\\/]file-guard|\.\.[\\/]state/.test(rd('hooks/file-type-guard.ps1')),
  `期望全文無 ../state/file-guard，實際有（後果：token 寫進 plugin 快取，更新即清空）`);

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
  'hooks/branch-safety.ps1', 'hooks/file-type-guard.ps1', 'CLAUDE.md', 'README.md',
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
const n = skillDirs.length;
const readmeN = Number((rd('README.md').match(/^## Skills（(\d+)）/m) || [])[1]);
const html = exists('docs/index.html') ? rd('docs/index.html') : '';
const heroN = Number((html.match(/<b>(\d+)<\/b><span>skills<\/span>/) || [])[1]);
const legendN = Number((html.match(/<span class="nn">(\d+)<\/span><\/li>/) || [])[1]);
const metaN = Number((html.match(/content="(\d+) 個 skill/) || [])[1]);
check(`P8 README / index.html 的 skill 計數 == 磁碟 ${n}`,
  readmeN === n && heroN === n && legendN === n && metaN === n,
  `README=${readmeN} hero=${heroN} legend=${legendN} meta=${metaN}（後果：公開站報錯數字；改處：README.md「## Skills（N）」、index.html :8 :48 :87）`);

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAIL`);
// 用 exitCode 而非 process.exit()：stdout 接 pipe 時 exit() 可能截掉最後幾行（含 ALL PASS 那行）
process.exitCode = failed === 0 ? 0 : 1;
}
