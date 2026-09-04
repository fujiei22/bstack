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

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAIL`);
// 用 exitCode 而非 process.exit()：stdout 接 pipe 時 exit() 可能截掉最後幾行（含 ALL PASS 那行）
process.exitCode = failed === 0 ? 0 : 1;
}
