/**
 * docs 站契約驗證器（零依賴，只用 node 內建模組）。
 *
 * 為什麼要有這支：這個 repo 沒有 package.json、沒有 test runner，T3 的紅綠循環需要一個
 * 機械判定依據，否則「功能有沒有掉」只能靠肉眼。
 *
 * **2026-09-08 void 改版後重寫。** 舊版整份寫的是「app.js + css/styles.css + 骨架 id」那套
 * 架構，改版後那四個檔都不存在了（樣式收進兩頁的 inline <style>、邏輯收進兩頁的元件 script、
 * React 執行期在 support.js）。原本 52 條裡有 17 條指向已刪除的檔，留著只會一直紅。
 * 重寫的原則沒變：**只測機械可判的事實，不假裝能測行為**。
 *
 * 契約總表（本表是唯一說明文件，刻意不另建 README——分開放一定會漂移）：
 *   C1  離線 / file:// 相容（無 module、無未映射 CDN、文件走內嵌）
 *   C2  防 FOUC（主題屬性在解析階段就掛上）
 *   C3  主題 localStorage key 全站唯一
 *   C4  八型別配色成對（TYPE_COLOR / TYPE_FILL）
 *   C5  prefers-reduced-motion == 0（spec §已決事項 1）
 *   C6  節點→文件對映不得低於改版前的 NODE_DOCS 基準線
 *   C7  縮放範圍 0.04 – 2.5
 *   C8  不動的檔、圖的規模、內嵌文件筆數與交叉引用
 *   C9  文件抽屜的可觀察字串
 *   C10 vendor 與資料檔載入
 *   C11 dc-runtime 掛載錨點
 *   C12 動畫語彙（linear 只准給流動虛線）
 *   C13 節點高亮語彙（三態靠 accent / edge-dim 驅動）
 *   C14 抽屜渲染（marked + 去第一個 H1）
 *   C15 兩頁色票同源（同名 token 不得各寫各的值）
 *   C16 docstring 密度
 *   C17 無文件節點有 else 分支
 *   C18 磁碟上的 skill / agent 全部能在站上點開文件
 *   C19 landing 頁
 *   C20 social meta 與 OG 圖
 *
 * **刻意不測的**：
 *   - 舊 F2（初始 fit view）與 F21：以 e2e 與人工驗收為準，理由見 docs/reference/docs-site-baseline.md。
 *   - **響應式斷點**。舊 C15 曾要求 css 恰有 1080px + 860px 兩條 @media；void 改版整站零
 *     @media（改用 clamp() 與 JS 量測），那條沒有等價物。窄視窗下側欄與浮層會不會疊，
 *     只能靠 e2e，別在這裡假裝測得到。
 *
 * 跑法（**必須用 Bash，不要用 PowerShell**——$? 在 PowerShell 是布林、grep 不存在）：
 *   node docs/tools/docs-site-contract.mjs
 *   node docs/tools/docs-site-contract.mjs --selftest   # 驗 fail 路徑
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// tools/ -> docs
// （原本住在 docs/work/refactor/docs-site-redesign/verify/，那時是 '../../../..'。
//  2026-09-03 隨施工文件歸檔時移到 docs/tools/，路徑深度從 4 層變 1 層。
//  移動當下實測炸掉：ENOENT open 'D:low.html' —— 少算三層會爬到磁碟根。）
const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(DOCS, '..');

/** 讀 docs/ 底下的檔（相對 docs/ 根）。 */
// 一律正規化成 LF 再比對。**這不是潔癖，是修一個真的 bug**：JS 的 `.` 不匹配行終止符，
// 而 \r 算行終止符，所以 /^\s*\/\/.*$/ 這種去註解的 regex 在 CRLF 檔上完全不生效
// （`.*` 停在 \r 前面，沒有 m 旗標的 `$` 又要求字串結尾）。
const read = (p) => readFileSync(join(DOCS, p), 'utf8').replace(/\r\n/g, '\n');

let failed = 0;

/**
 * 印一條檢查結果。
 * @param {string} name   契約編號與名稱
 * @param {boolean} ok    是否通過
 * @param {string} [detail] FAIL 時印的說明。格式固定為「期望 X，實際 Y（後果：Z）」——
 *                          只寫「C2 防 FOUC 依賴這個順序」這種不含實際值的訊息，
 *                          FAIL 時看不出哪裡錯。
 */
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '\n        ' + detail}`);
  if (!ok) failed++;
}

// 兩頁都是「靜態 head + x-dc 模板 + 元件 script」的同一種結構。
// flow.html 是流程圖本體，index.html 是 GitHub Pages 的入口 landing。
const flow = read('flow.html');
const landing = read('index.html');
const support = read('support.js');
const PAGES = { 'index.html': landing, 'flow.html': flow };

/**
 * 取靜態 <head>（第一個 </head> 之前）。social meta 與防 FOUC 都必須落在這裡——
 * 放進 x-dc 模板的話是 dc-runtime 執行期才掛，爬蟲與首屏都吃不到。
 * @param {string} src
 * @returns {string}
 */
const headOf = (src) => src.slice(0, src.indexOf('</head>'));

/**
 * 取兩頁的 inline <style> 內容合併（樣式改版後全部住在這裡，不再有外部 stylesheet）。
 * @param {string} src
 * @returns {string}
 */
const styleOf = (src) =>
  [...src.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

/**
 * 取元件邏輯：</head> 之後、扣掉 x-dc 模板那段的 script。
 * 粗略但夠用——這裡的檢查都是「某個字串在不在邏輯裡」，不需要精準切割。
 * @param {string} src
 * @returns {string}
 */
const logicOf = (src) => src.slice(src.indexOf('</head>'));

const flowCss = styleOf(flow);
const landingCss = styleOf(landing);
const flowJs = logicOf(flow);
const landingJs = logicOf(landing);

// ── C1：離線 / file:// 相容 ──────────────────────────────────────────────────
// 這個站的 references-data.js 內嵌全文就是為了 file:// 能開；改版引進 React 之後
// 多一條：React 必須自帶，不能跟 unpkg 要。
check(
  'C1a 兩頁都無 ES module',
  !/type="module"/.test(flow) && !/type="module"/.test(landing),
  `期望兩頁都沒有 type="module"，實際 flow=${/type="module"/.test(flow)} index=${/type="module"/.test(landing)}` +
    `（後果：file:// 下直接壞）`
);

// support.js 內寫死的 CDN 來源，必須每一個都在兩頁的 window.__resources 裡被映射到本地檔。
// 少映一個，那一份就會在執行期回頭打 unpkg——斷網或 unpkg 掛掉整頁空白，而且本機測不出來。
// 只認 cdnScriptFor() 真的會去要的那幾個常數（BABEL 只有頁面帶 JSX 時才載，一樣要映）。
const cdnUrls = [...support.matchAll(/var\s+(?:REACT|REACT_DOM|BABEL)_URL\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
for (const [name, src] of Object.entries(PAGES)) {
  const resBlock = (src.match(/window\.__resources\s*=\s*\{[\s\S]*?\};/) || [''])[0];
  const unmapped = cdnUrls.filter((u) => !resBlock.includes(u));
  // BABEL 沒被映射不算錯：頁面沒有 JSX 就永遠不會載它。只有實際被載的那兩個是硬要求。
  const required = unmapped.filter((u) => !/babel/i.test(u));
  const localOk = [...resBlock.matchAll(/:\s*'(\.\/[^']+)'/g)]
    .map((m) => m[1])
    .every((p) => existsSync(join(DOCS, p.replace(/^\.\//, ''))));
  check(
    `C1b ${name} 的 React CDN 全部映射到本地檔`,
    !!resBlock && required.length === 0 && localOk,
    `期望 window.__resources 映掉 ${cdnUrls.filter((u) => !/babel/i.test(u)).length} 個必載 CDN 且本地檔存在，` +
      `實際 未映=[${required.join(', ')}] 本地檔都在=${localOk}` +
      `（後果：斷網 / unpkg 掛掉時整頁空白，而且開發機連得上網所以測不出來）`
  );
}

check(
  'C1c 文件抽屜讀內嵌的 REFERENCE_DOCS',
  /window\.REFERENCE_DOCS/.test(flowJs) && /window\.REFERENCE_DOCS/.test(landingJs),
  `期望兩頁都從 window.REFERENCE_DOCS 取文件，實際 flow=${/window\.REFERENCE_DOCS/.test(flowJs)} ` +
    `index=${/window\.REFERENCE_DOCS/.test(landingJs)}（後果：改回 fetch 就等於放棄 file:// 與離線）`
);

// ── C2：防 FOUC ─────────────────────────────────────────────────────────────
// CSS 的 :root 預設是 light，而 app 的預設 themeMode 是 'dark'，且 applyTheme() 在
// componentDidMount 才跑。沒有解析階段那段 inline script，暗色使用者每次進站都先閃一下白底。
const THEME_KEY = 'bstack-void-theme';
for (const [name, src] of Object.entries(PAGES)) {
  const head = headOf(src);
  const iPre = head.indexOf(`localStorage.getItem('${THEME_KEY}')`);
  const iSupport = head.indexOf('<script src="./support.js">');
  check(
    `C2a ${name} 防 FOUC script 在 head 內且早於 support.js`,
    iPre !== -1 && iSupport !== -1 && iPre < iSupport,
    `期望防 FOUC script 落在靜態 <head> 且排在 support.js 之前，實際 script@${iPre} support@${iSupport}` +
      `（後果：主題要等 React 掛載才套，暗色使用者每次進站先閃一下白底）`
  );
  check(
    `C2b ${name} 防 FOUC 用同一組屬性名`,
    /setAttribute\('data-theme',/.test(head) && /setAttribute\('data-theme-mode',/.test(head),
    `期望 data-theme 與 data-theme-mode 兩個屬性都在解析階段掛上，` +
      `實際 theme=${/setAttribute\('data-theme',/.test(head)} mode=${/setAttribute\('data-theme-mode',/.test(head)}` +
      `（後果：只掛一個的話 CSS 或元件其中一邊讀不到，切換鈕的狀態會跟畫面對不上）`
  );
  // 解析階段的 fallback 與元件的預設必須同一個值，否則會先掛一個主題、mount 後又跳成另一個。
  // 三處都要對得起來：head 的防 FOUC、元件 state 初值、localStorage 被鎖時的 catch。
  // （改版當下這三處在兩頁之間本來就不一致：flow 是 auto、index 是 dark，
  //   localStorage 被擋的瀏覽器上兩頁會套到不同主題。這條就是為了不讓它再漂回去。）
  const preDefault = (head.match(/saved === 'light' \|\| saved === 'auto' \? saved : '(\w+)'/) || [])[1];
  const stateDefault = (src.match(/themeMode:\s*'(\w+)'/) || [])[1];
  const catchDefault = (src.match(/catch \(_\) \{ this\.(?:apply|applyTheme)\('(\w+)'\)/) || [])[1];
  check(
    `C2c ${name} 防 FOUC / state 初值 / catch fallback 三處同值`,
    !!preDefault && preDefault === stateDefault && preDefault === catchDefault,
    `期望三處同值，實際 防FOUC='${preDefault}' state='${stateDefault}' catch='${catchDefault}'` +
      `（後果：先掛一個主題、mount 後又跳成另一個，比原本的 FOUC 更明顯；` +
      `catch 那條只在 localStorage 被鎖時才走，平常測不到）`
  );
}

// ── C3：主題 localStorage key 全站唯一 ───────────────────────────────────────
const keys = [...(flow + landing).matchAll(/localStorage\.[gs]etItem\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
const uniqKeys = [...new Set(keys)];
check(
  'C3 兩頁共用同一個主題 key',
  uniqKeys.length === 1 && uniqKeys[0] === THEME_KEY,
  `期望只有 '${THEME_KEY}' 一個 key，實際 ${uniqKeys.length} 個：${uniqKeys.join(' / ')}` +
    `（後果：在 landing 選的主題進到流程圖就失效，兩頁各記各的）`
);

// ── C4：八型別配色成對 ───────────────────────────────────────────────────────
// 改版前是 css 的 --c-* token，改版後是 flow.html 裡 TYPE_COLOR / TYPE_FILL 兩個物件。
// 守的事情沒變：八個型別、描邊與填色成對，缺一個就有節點在某個狀態下沒有顏色。
const TYPES = ['default', 'gate', 'agent', 'skill', 'policy', 'impl', 'hook', 'stop'];
/**
 * 取 flow.html 裡某個型別色表的 key 集合。
 * @param {string} varName TYPE_COLOR 或 TYPE_FILL
 * @returns {Set<string>}
 */
const typeKeys = (varName) => {
  const i = flowJs.indexOf(`const ${varName} = {`);
  if (i === -1) return new Set();
  const blk = flowJs.slice(i, flowJs.indexOf('};', i));
  return new Set([...blk.matchAll(/(\w+)\s*:\s*'/g)].map((m) => m[1]));
};
const colorKeys = typeKeys('TYPE_COLOR');
const fillKeys = typeKeys('TYPE_FILL');
const missingType = TYPES.filter((t) => !colorKeys.has(t) || !fillKeys.has(t));
check(
  'C4a 八型別在 TYPE_COLOR 與 TYPE_FILL 都成對',
  missingType.length === 0 && colorKeys.size === 8 && fillKeys.size === 8,
  `期望 8 型別各有描邊與填色，實際 color=${colorKeys.size} fill=${fillKeys.size} 缺 [${missingType.join(', ')}]` +
    `（後果：該型別的節點在圖上沒有顏色，或填色與描邊對不起來）`
);

// C4b：landing 的小色塊是**寫死的 hex**，與 flow.html 的 TYPE_COLOR 是兩份。
// 2026-09-08 調整 hook 配色時就踩到：改了 flow 忘了改 landing，同一個 hook 在兩頁不同色。
/** 取 flow.html TYPE_COLOR 某個 key 的值。 */
const typeColorOf = (key) => {
  const i = flowJs.indexOf('const TYPE_COLOR = {');
  const blk = flowJs.slice(i, flowJs.indexOf('};', i));
  const m = blk.match(new RegExp(key + `:\\s*'(#[0-9A-Fa-f]{6})'`));
  return m ? m[1].toUpperCase() : null;
};
// landing 的色塊固定長成 `background:#XXXXXX"></span><span …>標籤</span>`
const LABEL_TO_TYPE = {
  skills: 'skill', agents: 'agent', agent: 'agent', hook: 'hook',
  'rules.md': 'policy', gate: 'gate', trace: 'default'
};
const swatchDrift = [];
for (const m of landing.matchAll(/background:(#[0-9A-Fa-f]{6})"><\/span><span[^>]*>([^<]{1,12})<\/span>/g)) {
  const type = LABEL_TO_TYPE[m[2].trim()];
  if (!type) continue;
  const want = typeColorOf(type);
  if (want && m[1].toUpperCase() !== want) swatchDrift.push(`${m[2].trim()}: landing=${m[1]} flow.TYPE_COLOR.${type}=${want}`);
}
check(
  'C4b landing 的節點型別色塊與 flow.html 的 TYPE_COLOR 同色',
  swatchDrift.length === 0,
  `期望兩頁同色，實際漂了 ${swatchDrift.length} 個：${swatchDrift.slice(0, 4).join(' / ')}` +
    `（後果：同一個型別在首頁與流程圖是兩個顏色，讀者以為是兩種東西）`
);

// ── C5：prefers-reduced-motion 必須維持 0 ────────────────────────────────────
// 去掉註解再數：契約要測的是「有沒有這條規則」，不是「有沒有提到這個詞」。
const allCssNoComment = (flowCss + landingCss).replace(/\/\*[\s\S]*?\*\//g, '');
const prm = (allCssNoComment.match(/prefers-reduced-motion/g) || []).length;
check(
  'C5 prefers-reduced-motion == 0',
  prm === 0,
  `期望 0，實際 ${prm}（後果：user 明確指示一律不加）`
);

// ── C6：節點→文件對映不得低於基準線 ─────────────────────────────────────────
// 改版前 app.js 裡有一份手寫的 NODE_DOCS 顯式對映；改版後改成 resolveDoc() 拿
// label + id 去撞 docIndex 的名字（撞不到的靠 DOC_OVERRIDES 補）。
// 啟發式的風險是「某個節點悄悄撞不到了」——所以把改版前那份對映**固定寫死在這裡**當基準線。
//
// **為什麼不從 git 撈**：`git show main:docs/js/app.js` 在這個 branch merge 進 main 之後
// 就撈不到了（那個檔已刪），契約會在合併當天變成永遠紅。基準線是歷史事實，寫死才對。
// 只收「當時真的在 FLOW_DATA.nodes 上的節點」，ambient 側欄項不在此列。
const C6_BASELINE = {
  BS: 'references/skills/brainstorm/SKILL.md',
  DBAgent: 'references/agents/db-reviewer.md',
  DevWfSkill: 'references/skills/dev-workflow/SKILL.md',
  FEAgent: 'references/agents/frontend-e2e-runner.md',
  HypAgent: 'references/agents/hypothesis-tester.md',
  LoadChk: 'references/skills/security-checklist/SKILL.md',
  LoadDB: 'references/skills/db-access/SKILL.md',
  LoadDD: 'references/skills/design-direction/SKILL.md',
  LoadDebug: 'references/skills/debug-systematic/SKILL.md',
  LoadDevwork: 'references/skills/devwork/SKILL.md',
  LoadDispatch: 'references/skills/dispatch-parallel/SKILL.md',
  LoadDLang: 'references/skills/design-language/SKILL.md',
  LoadExec: 'references/skills/execute-plan/SKILL.md',
  LoadFE: 'references/skills/frontend-test/SKILL.md',
  LoadFin: 'references/skills/finish-branch/SKILL.md',
  LoadIncident: 'references/skills/incident-investigate/SKILL.md',
  LoadPrEx: 'references/skills/pr-explain/SKILL.md',
  LoadRecv: 'references/skills/receive-review/SKILL.md',
  LoadReq: 'references/skills/request-review/SKILL.md',
  LoadRetro: 'references/skills/retro/SKILL.md',
  LoadRP: 'references/skills/review-plan/SKILL.md',
  LoadSafety: 'references/skills/safety-guard/SKILL.md',
  LoadSec: 'references/skills/security-audit/SKILL.md',
  LoadTDD: 'references/skills/tdd-cycle/SKILL.md',
  LoadVerify: 'references/skills/verify-done/SKILL.md',
  LoadWP: 'references/skills/write-plan/SKILL.md',
  PrExAgent: 'references/agents/pr-explainer.md',
  RPT3: 'references/skills/review-plan/SKILL.md',
  SecAgent: 'references/agents/security-auditor.md'
};

// 載入資料檔（不 eval 整頁，只 eval 這兩個純資料檔）
const win = {};
const refSrc = read('js/references-data.js');
new Function('window', refSrc)(win);
new Function('window', read('js/data.js'))(win);
const FD = win.FLOW_DATA;
const refKeys = new Set(Object.keys(win.REFERENCE_DOCS || {}));

// 照 flow.html build() 的規則重建 docIndex。這段是**複製品**，不是引用——
// flow.html 改了規則而這裡沒跟，C6 會紅，那正是要的效果（有人動了對映邏輯就該重新對基準線）。
const docIndex = {};
for (const k of refKeys) {
  let m = k.match(/^references\/skills\/([^/]+)\/SKILL\.md$/);
  if (m) { docIndex[m[1]] = { key: k, kind: 'Skill', name: m[1] }; continue; }
  m = k.match(/^references\/agents\/([^/]+)\.md$/);
  if (m) { docIndex[m[1]] = { key: k, kind: 'Agent', name: m[1] }; continue; }
  m = k.match(/^references\/([^/]+)\.md$/);
  if (m) docIndex[m[1].toLowerCase()] = { key: k, kind: 'Doc', name: m[1] + '.md' };
}
const docNames = Object.keys(docIndex).sort((a, b) => b.length - a.length);
// DOC_OVERRIDES 從 flow.html 原文撈，不寫死——寫死就變成契約自己抄一份，改了不會紅。
const ovSrc = flowJs.slice(flowJs.indexOf('const DOC_OVERRIDES'));
const OVERRIDES = Object.fromEntries(
  [...ovSrc.slice(0, ovSrc.indexOf('};')).matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]])
);
/** flow.html resolveDoc() 的複製品。 */
const resolveDoc = (id, label) => {
  if (OVERRIDES[id]) return docIndex[OVERRIDES[id]] || null;
  const hay = label + ' ' + id;
  for (const name of docNames) {
    if (name.length < 4) continue;
    if (hay.includes(name)) return docIndex[name];
  }
  return null;
};

const c6Broken = [];
for (const [id, wantKey] of Object.entries(C6_BASELINE)) {
  if (!FD.nodes[id]) { c6Broken.push(`${id}(節點已不存在)`); continue; }
  const got = resolveDoc(id, String(FD.nodes[id].label));
  if (!got) c6Broken.push(`${id}(撞不到文件，應為 ${wantKey})`);
  else if (got.key !== wantKey) c6Broken.push(`${id}(撞到 ${got.key}，應為 ${wantKey})`);
}
check(
  `C6 ${Object.keys(C6_BASELINE).length} 個基準節點都對得到原本那份文件`,
  c6Broken.length === 0,
  `期望 0 個退步，實際 ${c6Broken.length} 個：${c6Broken.slice(0, 6).join(' / ')}` +
    `（後果：那個節點點下去從「有文件」變成「無獨立文件」，而且不報錯。` +
    `修法：在 flow.html 的 DOC_OVERRIDES 補一條，或把文件名寫進節點 label）`
);

// ── C7：縮放範圍 ─────────────────────────────────────────────────────────────
// 改版前是 d3.zoom().scaleExtent([0.04, 2.5])，改版後是自寫的 Math.min/max 夾擠。
const clamps = [...flowJs.matchAll(/Math\.min\(\s*([\d.]+)\s*,\s*Math\.max\(\s*([\d.]+)\s*,/g)]
  .map((m) => `${m[2]}-${m[1]}`);
check(
  'C7 縮放範圍維持 0.04 – 2.5',
  clamps.length >= 2 && clamps.every((c) => c === '0.04-2.5'),
  `期望每處縮放夾擠都是 0.04–2.5 且至少兩處（滾輪縮放與 fit view），實際 [${clamps.join(', ')}]` +
    `（後果：縮太小會看不見節點文字、縮太大會失去全圖概觀；兩處值不同會在 fit 之後跳一下）`
);

// ── C8：不動的檔 + 圖的規模 + 內嵌文件 ───────────────────────────────────────
const nodeCount = Object.keys(FD.nodes).length;
const edgeCount = FD.edges.length;
const phaseCount = FD.phases.length;
const typeCount = new Set(Object.values(FD.nodes).map((n) => n.type || 'default')).size;
const EXPECT = { nodes: 96, edges: 135, phases: 15, types: 8 };
check(
  `C8a 圖的規模 ${EXPECT.nodes} 節點 / ${EXPECT.edges} 邊 / ${EXPECT.phases} phase / ${EXPECT.types} 型別`,
  nodeCount === EXPECT.nodes && edgeCount === EXPECT.edges &&
    phaseCount === EXPECT.phases && typeCount === EXPECT.types,
  `期望 ${JSON.stringify(EXPECT)}，實際 ${JSON.stringify({ nodes: nodeCount, edges: edgeCount, phases: phaseCount, types: typeCount })}` +
    `（後果：data.js 被動到了；改版不該動內容）`
);

const usedIds = new Set();
FD.edges.forEach((e) => { usedIds.add(e[0]); usedIds.add(e[1]); });
const orphans = Object.keys(FD.nodes).filter((id) => !usedIds.has(id));
const dangling = FD.edges.filter((e) => !FD.nodes[e[0]] || !FD.nodes[e[1]]);
check(
  'C8c 圖完整：無孤兒節點、無懸空邊',
  orphans.length === 0 && dangling.length === 0,
  `期望 0 孤兒 0 懸空，實際 孤兒 ${orphans.length} 個 [${orphans.slice(0, 5).join(', ')}]、` +
    `懸空邊 ${dangling.length} 條（後果：dagre 會把孤兒堆到角落，懸空邊直接讓佈局炸掉）`
);

// data.js 與 layout.js 都不該被動——它們是資料與 dagre 參數，不在改版 scope
for (const f of ['docs/js/data.js', 'docs/js/layout.js']) {
  try {
    execFileSync('git', ['diff', '--exit-code', 'HEAD', '--', f], { cwd: REPO, stdio: 'pipe' });
    check(`C8d ${f.replace('docs/js/', '')} 未被改動`, true);
  } catch {
    check(`C8d ${f.replace('docs/js/', '')} 未被改動`, false,
      `期望 git diff 乾淨，實際有改動（後果：改到了資料或 dagre 佈局參數，整張圖的座標會位移）`);
  }
}

const expectedRefCount = 1 // rules.md
  + readdirSync(join(REPO, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).length
  + readdirSync(join(REPO, 'agents')).filter((f) => f.endsWith('.md')).length;
check(
  `C8b REFERENCE_DOCS 有 ${expectedRefCount} 個 key`,
  refKeys.size === expectedRefCount,
  `期望 ${expectedRefCount}（rules.md + 磁碟上的 skill + agent），實際 ${refKeys.size}` +
    `（後果：build-references.ps1 沒重跑，站上的文件是舊的）`
);

const rulesEmbedded = (refSrc.match(/"references\/rules\.md"\s*:\s*"((?:[^"\\]|\\.)*)"/) || [])[1] || '';
check(
  'C8e rules.md 在內嵌包裡且含 §事實核實',
  rulesEmbedded.includes('§事實核實') || rulesEmbedded.includes('事實核實'),
  `期望內嵌的 rules.md 含「事實核實」，實際長度 ${rulesEmbedded.length}` +
    `（後果：規則書的最高指導原則在站上讀不到）`
);

// 內嵌正文裡 `<name>.md §` 形式的交叉引用都要對得到文件。
// skill 自己 references/ 底下的檔（如 design-styles.md）不在抽屜裡、本來就連不到，不算斷鏈。
const refSrcPlain = refSrc.replace(/\\n/g, '\n');
const xrefNames = new Set([...refSrcPlain.matchAll(/(?<![A-Za-z0-9._-])([A-Za-z0-9._-]+\.md) §/g)].map((m) => m[1]));
const skillRefFiles = new Set();
for (const d of readdirSync(join(REPO, 'skills'), { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const refDir = join(REPO, 'skills', d.name, 'references');
  if (existsSync(refDir)) for (const f of readdirSync(refDir)) skillRefFiles.add(f);
}
const knownDocNames = new Set(Object.values(docIndex).map((e) => e.name));
const xrefBroken = [...xrefNames].filter(
  (n) => !knownDocNames.has(n) && !knownDocNames.has(n.replace(/\.md$/, '')) &&
    !docIndex[n.replace(/\.md$/, '')] && !skillRefFiles.has(n)
);
check(
  'C8f 內嵌正文的 `<name>.md §` 交叉引用都對得到文件',
  xrefNames.size > 0 && xrefBroken.length === 0,
  `期望 0 個斷鏈，實際 ${xrefBroken.length} 個：[${xrefBroken.join(', ')}]` +
    `（後果：正文裡指向守則章節的連結消失，而且不報錯）`
);

// C8g landing 的規模數字要跟 data.js 一致。
// 舊版守的是 hero 的 <b>N</b><span>節點</span>；void 改版改成 stat 列「96 / NODES」。
// 這種手填數字曾同時停在 100 而圖已是 98，所以一定要有契約。
const landingNodeStat = Number(
  (landing.match(/>(\d+)<\/b>[\s\S]{0,80}?NODES/i) ||
   landing.match(/(\d+)\s*<\/[^>]+>\s*<[^>]*>\s*NODES/i) ||
   landing.match(/'(\d+)'[^}]{0,40}NODES/i) || [])[1]
);
const flowCounts = (flowJs.match(/Object\.keys\(F\.nodes\)\.length \+ ' 節點 \/ ' \+ F\.edges\.length/) || []).length;
check(
  `C8g landing 的節點數 == data.js 的 ${nodeCount}`,
  landingNodeStat === nodeCount,
  `期望 ${nodeCount}，實際 ${landingNodeStat}` +
    `（後果：公開站報錯數字；改處：index.html stat 列的 NODES 那格）`
);
check(
  'C8h flow 頁的節點/邊數是算出來的、不是寫死的',
  flowCounts === 1,
  `期望 flow.html 的計數從 FLOW_DATA 算，實際命中 ${flowCounts} 處` +
    `（後果：改了 data.js 但標頭數字不跟，就是 C8g 擋的那種錯）`
);

// ── C9：文件抽屜的可觀察字串 ────────────────────────────────────────────────
// 改版後文件一律走內嵌、沒有 fetch，所以舊的「載入中⋯ / 載入失敗」在 flow 頁不再適用；
// 真正還在的可觀察行為是「沒有 description 時顯示（無描述）」。
check(
  'C9 無描述時的 fallback 字串還在',
  flowJs.includes('（無描述）'),
  `期望 flow.html 有「（無描述）」fallback，實際找不到` +
    `（後果：frontmatter 沒寫 description 的文件，抽屜標題下會是一片空白）`
);

// ── C10：vendor 與資料檔載入 ─────────────────────────────────────────────────
// d3 已隨改版移除（縮放平移改自寫），React 改為自帶。
const NEEDED = ['js/vendor/dagre.min.js', 'js/vendor/marked.min.js',
  'js/layout.js', 'js/data.js', 'js/references-data.js'];
const lostSrc = NEEDED.filter((v) => !flow.includes(v));
check(
  'C10a flow.html 載入 vendor 與資料檔',
  lostSrc.length === 0,
  `期望 ${NEEDED.length} 個都在，實際缺 [${lostSrc.join(', ')}]` +
    `（後果：marked 缺 → 抽屜的 markdown 渲染不出來；references-data 缺 → 離線 / file:// 失效）`
);
const VENDOR_FILES = ['js/vendor/dagre.min.js', 'js/vendor/marked.min.js',
  'js/vendor/react.production.min.js', 'js/vendor/react-dom.production.min.js'];
const lostVendor = VENDOR_FILES.filter((f) => !existsSync(join(DOCS, f)));
check(
  'C10b vendor 檔都在磁碟上',
  lostVendor.length === 0,
  `期望 ${VENDOR_FILES.length} 個檔都在，實際缺 [${lostVendor.join(', ')}]（後果：站上 404，頁面開不起來）`
);

// ── C11：dc-runtime 掛載錨點 ────────────────────────────────────────────────
// 舊版守的是 app.js 要抓的五個 id；改版後 dc-runtime 靠 x-dc 元素與 data-dc-script 開機。
for (const [name, src] of Object.entries(PAGES)) {
  const hasXdc = /<x-dc>/.test(src);
  const hasScript = /data-dc-script/.test(src);
  const hasSupport = /<script src="\.\/support\.js">/.test(src);
  check(
    `C11 ${name} 的 dc-runtime 錨點齊全`,
    hasXdc && hasScript && hasSupport,
    `期望 x-dc 元素 / data-dc-script / support.js 三者都在，實際 xdc=${hasXdc} script=${hasScript} support=${hasSupport}` +
      `（後果：dc-runtime 的 parseDcDocument() 回 null，整頁不渲染、也不報錯）`
  );
}

// ── C12：動畫語彙 ────────────────────────────────────────────────────────────
// linear 只准用在「跟隨連續輸入的東西」上，其餘一律禁。
//
// 判準是**這個動畫的進度由誰決定**：由使用者的連續輸入決定（捲軸位置、沿線流動的虛線）
// 就必須等速——套緩動會讓它相對輸入一下快一下慢，看起來像黏住或彈回。
// 由事件觸發的一次性進出場（開關面板、淡入）則相反，linear 是硬切。
// 兩者要的曲線相反，所以不能只數次數，要看它出現在哪。
//
// 掃**整份 HTML** 而不只是 <style>：這版大量動畫寫在模板的 style="" 屬性上，
// 只數 <style> 會嚴重低估（實測 <style> 內只有 2 種曲線，全檔有 4 種）。
const allCss = flow + '\n' + landing;
// 例外清單。每一條都要寫得出「它跟隨的是哪個連續輸入」，寫不出來就不該進來。
const LINEAR_OK = [
  { re: /dash|march|flow/i, why: '沿邊流動的虛線：進度跟著路徑長度走' },
  { re: /\b(height|top)\s+120ms\s+linear/, why: 'landing 捲動進度條與刻度：進度跟著捲軸位置走' }
];
const linearDecls = allCss.match(/(transition|animation)[^;"]*\blinear\b[^;"]*/g) || [];
const badLinear = linearDecls.filter((d) => !LINEAR_OK.some((x) => x.re.test(d)));
const curves = new Set(allCss.match(/cubic-bezier\([^)]*\)/g) || []);
check(
  'C12 動畫語彙',
  badLinear.length === 0 && curves.size >= 4,
  `期望流動虛線以外 linear=0、自訂曲線>=4，實際 越界 linear=${badLinear.length}` +
    `${badLinear.length ? '（' + badLinear.slice(0, 2).join(' / ') + '）' : ''} 曲線=${curves.size}` +
    `（後果：硬切的 linear 進出場正是這版要避免的東西。唯一例外是流動虛線——它必須等速）`
);

// ── C13：節點高亮語彙 ───────────────────────────────────────────────────────
// 舊版是 is-focus / is-neighbor / is-dimmed 三個 class；改版後改成在 render 時
// 直接算 stroke 與 opacity，靠 --accent（焦點）與 --edge-dim（壓暗）兩個 token 區分。
const HL_TOKENS = ['var(--accent)', 'var(--edge-dim)', 'var(--edge)'];
const lostHl = HL_TOKENS.filter((t) => !flowJs.includes(t));
check(
  'C13 高亮三態的色彩來源齊全',
  lostHl.length === 0 && /dimmed/.test(flowJs),
  `期望 ${HL_TOKENS.join(' / ')} 都在且有 dimmed 分支，實際缺 [${lostHl.join(', ')}] dimmed=${/dimmed/.test(flowJs)}` +
    `（後果：選取節點後看不出焦點與上下游，整張圖一樣亮）`
);

// ── C14：抽屜渲染 ───────────────────────────────────────────────────────────
check(
  'C14a 用 marked 渲染且去掉第一個 H1',
  /marked\.parse\(/.test(flowJs) && /replace\(\/\^#\\s\+/.test(flowJs),
  `期望 marked.parse( 與去 H1 的 replace 都在，實際 marked=${/marked\.parse\(/.test(flowJs)} ` +
    `stripH1=${/replace\(\/\^#\\s\+/.test(flowJs)}（後果：抽屜裡會出現與標題重複的大 H1）`
);
check(
  'C14b 抽屜正文有專屬樣式容器',
  /md-body/.test(flow),
  `期望 flow.html 有 .md-body 容器，實際找不到` +
    `（後果：.md-body 承載表格 / 清單 / 程式碼區塊的排版，沒包等於裸 HTML）`
);

// ── C15：兩頁色票同源 ───────────────────────────────────────────────────────
// 改版把樣式收進兩份 inline <style>，等於同一組色票在兩個檔各寫一份。
// 這條守的是它們不會各改各的——舊版靠「兩頁共用 styles.css」在結構上就不可能漂移，
// 現在那個保證沒了，只能用契約補回來。
/**
 * 取一段 CSS 裡某個選擇器區塊內的 --token: value 對。
 * @param {string} css
 * @param {string} selector
 * @returns {Map<string,string>}
 */
const tokensIn = (css, selector) => {
  const i = css.indexOf(selector + ' {');
  const map = new Map();
  if (i === -1) return map;
  const blk = css.slice(i, css.indexOf('}', i));
  for (const m of blk.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map.set(m[1], m[2].trim());
  return map;
};
for (const sel of [':root', ':root[data-theme="dark"]']) {
  const a = tokensIn(flowCss, sel);
  const b = tokensIn(landingCss, sel);
  const shared = [...a.keys()].filter((k) => b.has(k));
  const drifted = shared.filter((k) => a.get(k) !== b.get(k));
  check(
    `C15 兩頁 ${sel} 的同名 token 值一致`,
    shared.length >= 8 && drifted.length === 0,
    `期望共用 token ≥8 個且值全同，實際 共用 ${shared.length} 個、漂了 ${drifted.length} 個：` +
      `${drifted.slice(0, 4).map((k) => `${k}(flow=${a.get(k)} index=${b.get(k)})`).join(' / ')}` +
      `（後果：兩頁配色不同，從 landing 滑進流程圖會看到底色或重點色跳一下）`
  );
}

// ── C16：docstring 密度 ──────────────────────────────────────────────────────
// **數註解行，不數 /** 區塊。** 舊版數 `/**` 是因為 app.js 通篇 JSDoc；這版的兩份元件
// script 用的是 `//` 行註解（實測 70 行、密度約 3.5%），一個 JSDoc 區塊都沒有。
// 拿 `/**` 當門檻會逼人把好好的 `//` 說明改寫成 JSDoc，那是為了讓契約變綠而改 code。
// 這條真正要擋的是「有人把註解整批刪掉」，所以用行數下限，取實測值的七成當緩衝。
const COMMENT_FLOOR = 50;
const commentLines = [flowJs, landingJs]
  .flatMap((s) => s.split('\n'))
  .filter((l) => /^\s*(\/\/|\/\*|\*)/.test(l)).length;
check(
  `C16 註解密度（兩頁元件 script 合計 >= ${COMMENT_FLOOR} 行）`,
  commentLines >= COMMENT_FLOOR,
  `期望 >= ${COMMENT_FLOOR} 行註解，實際 ${commentLines} 行` +
    `（後果：違反 rules.md §程式註解「新 code 全寫」。這版的邏輯——換頁過場、主題同步、` +
    `dagre 座標換算——不留 WHY 的話下一個人只能重推）`
);

// ── C17：無文件節點的 else 分支 ──────────────────────────────────────────────
// 96 個節點裡只有 41 個對得到文件，其餘的 detail 面板必須有一塊「沒有文件」的說法，
// 否則會缺一塊或出現按了沒反應的死按鈕。
const withDoc = Object.entries(FD.nodes).filter(([id, n]) => !!resolveDoc(id, String(n.label))).length;
check(
  `C17 無文件節點有 else 分支（${nodeCount - withDoc} 個節點沒有對應文件）`,
  /無獨立文件|沒有獨立文件|doc \? |doc \?\?/.test(flowJs),
  `期望 flow.html 對 resolveDoc() 回 null 的節點有明確分支，實際找不到` +
    `（後果：那 ${nodeCount - withDoc} 個節點的 detail 面板會缺一塊，或出現死按鈕）`
);

// ── C18：磁碟上的 skill / agent 都要能在站上點開文件 ─────────────────────────
// 這條是 user 明確要求的本體（「流程圖中也沒有出現所有 skill，請全量檢查」）。
// 改版後側欄「文件索引」直接從 REFERENCE_DOCS 的 key 推清單，所以只要內嵌全文在、
// 且 key 的形狀對得上 docIndex 的三條 regex，就一定點得開。
const diskSkills = readdirSync(join(REPO, 'skills'), { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name).sort();
const diskAgents = readdirSync(join(REPO, 'agents'))
  .filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort();

const missingDocs = [];
for (const name of diskSkills) {
  if (!refKeys.has(`references/skills/${name}/SKILL.md`)) missingDocs.push('skill:' + name + '(無內嵌全文)');
  else if (!docIndex[name]) missingDocs.push('skill:' + name + '(docIndex 推不出來)');
}
for (const name of diskAgents) {
  if (!refKeys.has(`references/agents/${name}.md`)) missingDocs.push('agent:' + name + '(無內嵌全文)');
  else if (!docIndex[name]) missingDocs.push('agent:' + name + '(docIndex 推不出來)');
}
check(
  `C18 磁碟 ${diskSkills.length} skill + ${diskAgents.length} agent 都能點開文件`,
  missingDocs.length === 0,
  `期望 0 個漏掉，實際 ${missingDocs.length} 個：${missingDocs.slice(0, 6).join(' / ')}` +
    `（後果：那些 skill 在側欄的文件索引裡查不到，站上讀不到它的規格）`
);

// C18b 是 C18 的反向。為什麼需要它：C8b 的期望值從磁碟推導，所以磁碟上多出
// 垃圾目錄時，期望與實際同向移動 —— 產出器把垃圾內嵌進去、C8b 照樣 PASS。
// 這不是假設：2026-09-03 的 review 期間，reviewer 在 skills/ 底下造了 9 個
// zz-* fixture，正式 repo 的 references-data.js 一度變成 44 個 key，而契約全綠。
const diskSet = new Set([...diskSkills, ...diskAgents]);
const strayRefs = [...refKeys].filter((k) => {
  const m = k.match(/^references\/(skills\/([^/]+)\/SKILL\.md|agents\/([^/]+)\.md)$/);
  if (!m) return k !== 'references/rules.md';   // rules.md（規則書）是唯一合法的例外
  return !diskSet.has(m[2] || m[3]);
});
check(
  'C18b 內嵌的每一份都對得到磁碟上的檔（反向，抓垃圾）',
  strayRefs.length === 0,
  `期望 0 個，實際 ${strayRefs.length} 個：${strayRefs.slice(0, 6).join(' / ')}` +
    `（後果：產出器把不該收的目錄內嵌進去了，而 C8b 因為期望值同樣從磁碟推導所以不會紅）`
);

// C18c 守的是一種在 Windows 上完全靜默的失效：產出器若不把內嵌內容正規化成 LF，
// 產出就跟著 checkout 狀態走——core.autocrlf=true 的機器內嵌 CRLF、Linux 內嵌 LF。
// 那些 CR 是字串值裡的跳脫字元、git 的 autocrlf 碰不到，所以同一份 commit 在
// 兩種平台不可能同時通過 -Check。
// **為什麼 -Check 自己抓不到**：它拿「現在產的」比對「檔案裡的」，同一台機器兩邊
// 用同一種行尾，永遠一致。在 Windows 上刪掉正規化那行，-Check 照樣全綠，只有
// Linux / macOS 的人會踩到。所以這條必須驗產出物本身，不能靠 round-trip。
const crEscapes = (refSrc.match(/(?<!\\)\\r/g) || []).length;
check(
  'C18c 內嵌內容一律 LF（跨平台決定性）',
  crEscapes === 0,
  `期望 0 個 CR 跳脫，實際 ${crEscapes} 個` +
    `（後果：產出器少了 LF 正規化，這份 commit 在非 Windows 上 -Check 永遠 FAIL，` +
    `而在 Windows 上看起來全綠、查不出原因）`
);

// ── C19：landing 頁（GitHub Pages 的入口）───────────────────────────────────
check(
  'C19a landing 指得到流程圖',
  /\.\/flow\.html/.test(landing),
  '期望 index.html 有指向 ./flow.html 的路徑（後果：流程圖從入口進不去）'
);
// 內嵌 iframe 的預覽模式與獨立開啟必須共存：index 用 ?embed=1 把 flow 掛進隱藏 iframe，
// flow 自己則要判斷 embed 與否決定「回首頁」是導頁還是通知父層。
check(
  'C19b flow 支援 embed 模式、landing 用它',
  /embed=1/.test(landing) && /embed=1/.test(flow),
  `期望兩頁都認得 ?embed=1，實際 index=${/embed=1/.test(landing)} flow=${/embed=1/.test(flow)}` +
    `（後果：點「流程圖」會整頁重載而不是滑進來，或內嵌時出現兩層 header）`
);
// landing 的節點鏈是手填的節點 id，打錯不會有任何錯誤訊息、只會靜默少一格。
const landingNodeIds = [...landing.matchAll(/data-nodes="([^"]+)"/g)].flatMap((m) => m[1].split(','));
const badLandingIds = landingNodeIds.filter((id) => !FD.nodes[id.trim()]);
// C19d：「它管什麼」那幾張卡片用 data-node 指定要 focus 的節點。
// 打錯字是**靜默失效**——focusFrom() 找不到節點就什麼都不做，畫面上只是滑進流程圖沒選取，
// 看起來像「這張卡本來就沒有對應節點」，不會有任何錯誤訊息。
const focusIds = [...landing.matchAll(/data-node="([^"]+)"/g)].map((m) => m[1]);
const badFocusIds = focusIds.filter((id) => !FD.nodes[id]);
check(
  `C19d landing 的 data-node 都對得到節點（${focusIds.length} 張卡）`,
  focusIds.length > 0 && badFocusIds.length === 0,
  `期望 >0 張且 0 個壞 id，實際 ${focusIds.length} 張、壞 [${badFocusIds.join(', ')}]` +
    `（後果：點那張卡只會滑進流程圖但不選取任何節點，而且不報錯）`
);

check(
  'C19c landing 引用的節點 id 都在圖上',
  badLandingIds.length === 0,
  `期望 0 個壞 id，實際 ${badLandingIds.length} 個：[${badLandingIds.slice(0, 5).join(', ')}]` +
    `（後果：節點鏈少一格沒人發現。註：這版若已不用 data-nodes，本條自然為 0 通過）`
);

// ── C20：social meta 與 OG 圖 ────────────────────────────────────────────────
// 貼連結到 LINE / Slack / FB 沒預覽圖，就是這幾行沒有。
// **改版後多守一件事**：這些 meta 必須在靜態 <head>，不能在 x-dc 模板裡——
// 爬蟲不執行 JS，dc-runtime 執行期才掛上的 meta 牠們一個都讀不到。
const SITE = 'https://fujiei22.github.io/bstack/';
/**
 * 取一個 meta 的 content。
 * 契約假設：只認 `<meta property|name="…" content="…"`——屬性 property/name 在前、雙引號。
 * @param {string} src  HTML 原文（已 LF 正規化）
 * @param {string} prop property 或 name 的值，例 'og:image'、'description'
 * @returns {string|null} content 值；找不到回 null
 */
const metaOf = (src, prop) => {
  const m = src.match(new RegExp(`<meta\\s+(?:property|name)="${prop}"\\s+content="([^"]*)"`));
  return m ? m[1] : null;
};
const OG_REQUIRED = ['og:type', 'og:site_name', 'og:locale', 'og:url', 'og:title', 'og:description',
  'og:image', 'og:image:width', 'og:image:height', 'og:image:alt',
  'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
for (const [name, src] of Object.entries(PAGES)) {
  const head = headOf(src);
  // 一律只對靜態 head 取值——這樣「搬進 x-dc 模板」這個錯會直接讓 C20a 紅。
  const missingOg = OG_REQUIRED.filter((p) => !metaOf(head, p));
  check(
    `C20a ${name} 的 og:* / twitter:* 齊全且在靜態 head`,
    missingOg.length === 0,
    `期望 ${OG_REQUIRED.length} 個都在 </head> 之前，實際缺 ${missingOg.length} 個：${missingOg.join(' / ')}` +
      `（後果：缺 og:image 就沒預覽圖；放進 x-dc 模板則爬蟲完全讀不到，因為牠們不執行 JS）`
  );
  const img = metaOf(head, 'og:image') || '';
  // 檔名要先剝掉 ?v=N 這種快取破壞用的 query string 再去磁碟找——og-card.html 檔頭寫的換圖
  // 做法就是加 ?v=，不剝的話照著 repo 自己的說明做會被這條誤判成「檔不存在」。
  const file = img.startsWith(SITE) ? img.slice(SITE.length).split('?')[0] : null;
  check(
    `C20b ${name} 的 og:image 是絕對網址且檔案存在`,
    !!file && !file.includes('/') && existsSync(join(DOCS, file)) &&
      metaOf(head, 'twitter:image') === img,
    `期望 og:image 以 ${SITE} 開頭、指向 docs/ 根下存在的檔（?v= 之後不算檔名）、且 twitter:image 同值，實際 og:image=${img}` +
      `（後果：相對路徑爬蟲不解析、檔不存在就 404，兩種都是沒圖）`
  );
  const selfUrl = SITE + (name === 'index.html' ? '' : name);
  check(
    `C20c ${name} 的 og:url 指向自己`,
    metaOf(head, 'og:url') === selfUrl,
    `期望 og:url=${selfUrl}，實際 ${metaOf(head, 'og:url')}（後果：兩頁分享出去指到同一頁）`
  );
  check(
    `C20g ${name} 宣告 og:image 為 1200×630`,
    metaOf(head, 'og:image:width') === '1200' && metaOf(head, 'og:image:height') === '630',
    `期望 og:image:width=1200 og:image:height=630，實際 ${metaOf(head, 'og:image:width')}×${metaOf(head, 'og:image:height')}` +
      `（後果：平台按錯尺寸預留版位，圖被裁或留白）`
  );
  // C20f 守三份同文不漂移。C20a 只驗存在，日後改了 description 忘了改 og 版，
  // 分享卡跟頁面講的是兩套話而契約照綠。
  const titleTag = (head.match(/<title>([^<]*)<\/title>/) || [])[1] || null;
  check(
    `C20f ${name} 的 og / twitter title、description 與 <title> / description 同文`,
    !!titleTag && metaOf(head, 'og:title') === titleTag && metaOf(head, 'twitter:title') === titleTag &&
      !!metaOf(head, 'description') && metaOf(head, 'og:description') === metaOf(head, 'description') &&
      metaOf(head, 'twitter:description') === metaOf(head, 'description'),
    `期望 og:title / twitter:title == <title>「${titleTag}」且 og:description / twitter:description == meta description，` +
      `實際 og:title=${metaOf(head, 'og:title')} twitter:title=${metaOf(head, 'twitter:title')} ` +
      `og:description 同文=${metaOf(head, 'og:description') === metaOf(head, 'description')} ` +
      `twitter:description 同文=${metaOf(head, 'twitter:description') === metaOf(head, 'description')}` +
      `（後果：分享卡與頁面講兩套話，改了一處另一處不跟）`
  );
  // C20h：靜態 head 的 <title> 與 x-dc 模板裡那份必須同文。
  // 兩份都存在是刻意的（爬蟲讀靜態那份，執行期由 helmet 覆寫成同一字串），
  // 但也因此會各改各的——改了模板忘了改靜態，分享卡標題就停在舊的。
  const helmetTitle = (logicOf(src).match(/<title>([^<]*)<\/title>/) || [])[1] || null;
  check(
    `C20h ${name} 靜態 head 與模板的 <title> 同文`,
    !!titleTag && titleTag === helmetTitle,
    `期望兩處同文，實際 靜態head='${titleTag}' 模板='${helmetTitle}'` +
      `（後果：爬蟲讀靜態那份、瀏覽器分頁顯示模板那份，同一頁兩個標題）`
  );
}
// 直接讀 byte，不用 read()——read() 會把 CRLF 換成 LF，二進位檔會被改壞。
const ogPngPath = join(DOCS, 'og.png');
const ogPng = existsSync(ogPngPath) ? readFileSync(ogPngPath) : Buffer.alloc(0);
const isPng = ogPng.length >= 24 && ogPng.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const pngW = isPng ? ogPng.readUInt32BE(16) : 0;
const pngH = isPng ? ogPng.readUInt32BE(20) : 0;
const OG_PNG_MAX = 512000;   // bytes；訊息與名稱都用這個數，不再一邊寫 KB 一邊寫 bytes
check(
  `C20d og.png 是 1200×630 的 PNG 且 < ${OG_PNG_MAX} bytes`,
  isPng && pngW === 1200 && pngH === 630 && ogPng.length < OG_PNG_MAX,
  `期望 PNG 1200×630 且 < ${OG_PNG_MAX} bytes，實際 isPng=${isPng} ${pngW}×${pngH} ${ogPng.length} bytes` +
    `（後果：尺寸不對平台會裁邊；太大 LINE 這類平台可能不抓）`
);

// C20e：OG 卡原稿的色票必須與 index.html 的暗色 token 同值。
// 舊版是「og-card 連 ../css/styles.css、零色值字面」，靠共用檔案在結構上保證同色。
// void 改版沒有共用 stylesheet 了，原稿只能手抄一份 token——所以改成逐值比對。
// 抄錯或站上換色沒同步，重產出來的 OG 圖就跟站不同色。
const ogCard = existsSync(join(DOCS, 'tools/og-card.html')) ? read('tools/og-card.html') : '';
const cardTokens = tokensIn(ogCard.replace(/<!--[\s\S]*?-->/g, ''), ':root');
const siteDark = tokensIn(landingCss, ':root[data-theme="dark"]');
const tokenDrift = [...cardTokens.entries()]
  .filter(([k]) => siteDark.has(k))
  .filter(([k, v]) => siteDark.get(k) !== v)
  .map(([k, v]) => `${k}(卡=${v} 站=${siteDark.get(k)})`);
check(
  'C20e og-card.html 的色票與 index.html 暗色 token 同值',
  cardTokens.size >= 5 && tokenDrift.length === 0,
  `期望原稿抄的 token ≥5 個且與站上暗色同值，實際 ${cardTokens.size} 個、漂了 ${tokenDrift.length} 個：` +
    `${tokenDrift.slice(0, 4).join(' / ')}` +
    `（後果：站上換配色時 OG 圖原稿不跟著變，重產出來的圖跟站不同色）`
);

// ── selftest：證明 fail 路徑有效 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  check('SELFTEST（刻意失敗）', false, '這條證明 fail 路徑會回非 0，驗證器不是永遠綠的');
}

console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
