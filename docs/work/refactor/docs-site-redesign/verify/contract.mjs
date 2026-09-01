/**
 * docs 站契約驗證器（零依賴，只用 node 內建模組）。
 *
 * 為什麼要有這支：這個 repo 沒有 package.json、沒有 test runner，T3 的紅綠循環需要一個
 * 機械判定依據，否則「功能有沒有掉」只能靠肉眼。
 *
 * 契約與 F 項對照（本表是唯一說明文件，刻意不另建 README——分開放一定會漂移）：
 *   C1  file:// 相容（F14）             C2  防 FOUC 與屬性名（F19）
 *   C3  主題 localStorage key（F17）     C4  八型別 token 值域與成對（F22）
 *   C5  prefers-reduced-motion == 0（spec §已決事項 1）
 *   C6  NODE_DOCS 的 key 集合 / shape / 能否命中 REFERENCE_DOCS（F12 F13 F14）
 *   C7  scaleExtent（F1）               C8  不動的檔與 REFERENCE_DOCS 筆數
 *   C9  F12/F14 四句原文                C10 vendor 與 references-data 載入（F13 F16）
 *   C11 骨架錨點                        C12 動畫語彙
 *   C13 三態 class / app.js 不寫顏色（F4 F22）
 *   C14 抽屜 DOM 與 .md 包裹            C15 @media 只有 860px（spec §已決事項 2）
 *   C16 docstring 密度                  C17 無文件節點的 else 分支
 *
 * **刻意不測 F2 與 F21。** 前一版 plan 曾用 `/function fitView/` 當 F2 的契約，但定案 demo 的
 * fitView() 內容就是 landingTransform()——函式名在、行為沒了，契約照樣綠。這兩項一律以
 * e2e 與人工驗收為準，見 verify-F1-F22.md。契約只該測機械可判的事實，不該假裝能測行為。
 *
 * 跑法（**必須用 Bash，不要用 PowerShell**——$? 在 PowerShell 是布林、grep 不存在）：
 *   node docs/work/refactor/docs-site-redesign/verify/contract.mjs
 *   node docs/work/refactor/docs-site-redesign/verify/contract.mjs --selftest   # 驗 fail 路徑
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// verify/ -> docs-site-redesign -> refactor -> work -> docs
const DOCS = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const REPO = join(DOCS, '..');

/** 讀 docs/ 底下的檔（相對 docs/ 根）。 */
const read = (p) => readFileSync(join(DOCS, p), 'utf8');

let failed = 0;

/**
 * 印一條檢查結果。
 * @param {string} name   契約編號與名稱
 * @param {boolean} ok    是否通過
 * @param {string} [detail] FAIL 時印的說明。格式固定為「期望 X，實際 Y（後果：Z）」——
 *                          只寫「F19 防 FOUC 依賴這個順序」這種不含實際值的訊息，
 *                          FAIL 時看不出哪裡錯。
 */
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '\n        ' + detail}`);
  if (!ok) failed++;
}

const html = read('index.html');
const css = read('css/styles.css');
const js = read('js/app.js');

// ── C1：file:// 相容 ─────────────────────────────────────────────────────────
check(
  'C1a 無 ES module',
  !/type="module"/.test(html) && !/^\s*import\s/m.test(js),
  `期望 index.html 無 type="module" 且 app.js 無裸 import，實際 ` +
    `html.module=${/type="module"/.test(html)} js.import=${/^\s*import\s/m.test(js)}` +
    `（後果：file:// 下直接壞，而這個站的 references-data.js 內嵌就是為了 file:// 能開）`
);

const iRef = js.indexOf('REFERENCE_DOCS');
const iFetch = js.indexOf('fetch(');
if (iRef === -1 || iFetch === -1) {
  // 拆成兩種訊息：indexOf 回 -1 時報「順序反了」會把人引去查錯方向
  check(
    'C1b REFERENCE_DOCS 分支在 fetch 之前',
    false,
    `期望 app.js 同時有 REFERENCE_DOCS 與 fetch(，實際 REFERENCE_DOCS=${iRef !== -1} fetch=${iFetch !== -1}` +
      `（後果：抽屜沒接上內嵌全文，F13/F14 掉）`
  );
} else {
  check(
    'C1b REFERENCE_DOCS 分支在 fetch 之前',
    iRef < iFetch,
    `期望內嵌分支在前，實際 REFERENCE_DOCS@${iRef} > fetch@${iFetch}` +
      `（後果：file:// 會走到 fetch 然後失敗）`
  );
}

// ── C2：防 FOUC 與屬性名 ─────────────────────────────────────────────────────
const iScript = html.indexOf('dev-workflow-theme');
const iLink = html.indexOf('<link rel="stylesheet"');
if (iScript === -1 || iLink === -1) {
  check(
    'C2a inline 主題 script 在 CSS 之前',
    false,
    `期望 index.html 同時有主題 script 與 stylesheet link，實際 script=${iScript !== -1} link=${iLink !== -1}` +
      `（後果：找不到錨點，無法判定順序）`
  );
} else {
  check(
    'C2a inline 主題 script 在 CSS 之前',
    iScript < iLink,
    `期望 script 在前，實際 script@${iScript} > link@${iLink}（後果：F19 防 FOUC 失效，載入會閃一下白底）`
  );
}
check(
  'C2b 兩個屬性名都在',
  html.includes('data-theme') && html.includes('data-theme-mode'),
  `期望 data-theme 與 data-theme-mode 都在，實際 theme=${html.includes('data-theme')} ` +
    `mode=${html.includes('data-theme-mode')}（後果：inline script 與 CSS 的共同契約斷裂）`
);

// ── C3：主題 localStorage key ────────────────────────────────────────────────
const keys = [...(html + js).matchAll(/localStorage\.[gs]etItem\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
const uniqKeys = [...new Set(keys)];
check(
  'C3 localStorage key 唯一且為 dev-workflow-theme',
  uniqKeys.length === 1 && uniqKeys[0] === 'dev-workflow-theme',
  `期望 ['dev-workflow-theme']，實際 [${uniqKeys.join(', ')}]` +
    `（後果：改 key 等於把所有現有訪客存過的主題偏好作廢、全部退回 auto）`
);

// ── C4：八型別 token ─────────────────────────────────────────────────────────
const TYPES = ['default', 'gate', 'agent', 'skill', 'policy', 'impl', 'hook', 'stop'];
const cDecls = [...css.matchAll(/(--c-[a-z]+(?:-bd)?)\s*:\s*([^;]+);/g)];
const notOklch = cDecls.filter((m) => !m[2].trim().startsWith('oklch('));
check(
  'C4a 八型別 token 值必須是 oklch',
  cDecls.length > 0 && notOklch.length === 0,
  `期望 0 條非 oklch（共 ${cDecls.length} 條宣告），實際 ${notOklch.length} 條非 oklch：` +
    `${notOklch.slice(0, 4).map((m) => m[1] + ':' + m[2].trim()).join(' / ')}` +
    `（後果：配色沒換到，或混用了兩套色彩空間）`
);
const missing = TYPES.filter((t) => {
  const fill = (css.match(new RegExp(`--c-${t}\\s*:`, 'g')) || []).length;
  const bd = (css.match(new RegExp(`--c-${t}-bd\\s*:`, 'g')) || []).length;
  return fill < 2 || bd < 2; // light + dark 各一組
});
check(
  'C4b 八型別在 light 與 dark 各有 fill 與 bd',
  missing.length === 0,
  `期望 8 型別各有 2 組 fill 與 2 組 bd，實際缺：${missing.join(', ')}` +
    `（後果：該型別在某個主題下沒有顏色）`
);

// ── C5：prefers-reduced-motion 必須維持 0 ────────────────────────────────────
const prm = (css.match(/prefers-reduced-motion/g) || []).length;
check(
  'C5 prefers-reduced-motion == 0',
  prm === 0,
  `期望 0，實際 ${prm}（後果：user 明確指示一律不加，加了會弄髒 F1-F22 的比對）`
);

// ── C6：NODE_DOCS ────────────────────────────────────────────────────────────
const BASELINE_KEYS = [
  'DevWfSkill', 'BS', 'LoadDB', 'LoadWP', 'LoadRP', 'LoadExec', 'LoadTDD', 'LoadDispatch',
  'LoadVerify', 'LoadFE', 'LoadReq', 'LoadRecv', 'LoadSec', 'LoadChk', 'LoadFin', 'LoadSafety',
  'LoadPrEx', 'LoadRetro', 'LoadDebug', 'LoadIncident', 'LoadLock', 'LoadCmdG', 'LoadCtxS',
  'LoadCtxR', 'LoadWS', 'HypAgent', 'FEAgent', 'LangAgent', 'SecAgent', 'DBAgent', 'PrExAgent',
  'RPT2', 'RPT3',
].sort();

const ndStart = js.search(/(?:const|var|let)\s+NODE_DOCS\s*=\s*\{/);
const ndEnd = ndStart === -1 ? -1 : js.indexOf('\n};', ndStart);
const ndBlock = ndStart === -1 ? '' : js.slice(ndStart, ndEnd);
const entries = [...ndBlock.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)\s*:\s*\{([^}]*)\}/gm)]
  .map((m) => ({ key: m[1], body: m[2] }));
const actualKeys = entries.map((e) => e.key).sort();

check(
  'C6a NODE_DOCS key 集合與基準一致',
  JSON.stringify(actualKeys) === JSON.stringify(BASELINE_KEYS),
  `期望 ${BASELINE_KEYS.length} 個 key，實際 ${actualKeys.length} 個。` +
    `多了 [${actualKeys.filter((k) => !BASELINE_KEYS.includes(k)).join(', ')}]、` +
    `少了 [${BASELINE_KEYS.filter((k) => !actualKeys.includes(k)).join(', ')}]` +
    `（後果：多的那些 references-data.js 沒有內嵌全文會點出載入失敗；少的那些 F12/F13 直接掉）`
);

const badShape = entries.filter((e) => !/\bp\s*:/.test(e.body) || !/\bn\s*:/.test(e.body) || !/\bk\s*:/.test(e.body));
check(
  'C6b 每筆 NODE_DOCS 都有 p / n / k',
  entries.length > 0 && badShape.length === 0,
  `期望全部 ${entries.length} 筆都有 p/n/k 三鍵，實際 ${badShape.length} 筆缺：` +
    `${badShape.slice(0, 4).map((e) => e.key).join(', ')}` +
    `（後果：文件索引面板依 k 分組會濾掉它們，抽屜與 detail 卡片顯示 undefined，且不報錯）`
);

/**
 * 把 NODE_DOCS 的 p 解成 REFERENCE_DOCS 的 key。
 * skill 的實體是 <dir>/SKILL.md、agent 的實體是 <name>.md，兩者後綴不同；
 * 解錯的後果是抽屜點下去空白且不報錯，C6c 就是為了攔這個。
 * @param {{p:string, k:string}} entry
 * @returns {string}
 */
function docKey(entry) {
  return entry.k === 'agent' ? `references/${entry.p}.md` : `references/${entry.p}/SKILL.md`;
}

const refSrc = read('js/references-data.js');
const refKeys = new Set([...refSrc.matchAll(/"(references\/[^"]+)"\s*:/g)].map((m) => m[1]));

const parsed = entries.map((e) => {
  const p = (e.body.match(/\bp\s*:\s*'([^']+)'/) || [])[1];
  const k = (e.body.match(/\bk\s*:\s*'([^']+)'/) || [])[1];
  const path = (e.body.match(/\bpath\s*:\s*'([^']+)'/) || [])[1];
  return { key: e.key, resolved: p && k ? docKey({ p, k }) : path };
});
const unresolved = parsed.filter((e) => !e.resolved || !refKeys.has(e.resolved));
check(
  'C6c 每筆 NODE_DOCS 都能在 REFERENCE_DOCS 命中',
  entries.length > 0 && unresolved.length === 0,
  `期望全部命中（REFERENCE_DOCS 有 ${refKeys.size} 個 key），實際 ${unresolved.length} 筆落空：` +
    `${unresolved.slice(0, 4).map((e) => e.key + '→' + e.resolved).join(' / ')}` +
    `（後果：抽屜點下去一片空白，而且不報錯——這是唯一能機械攔住它的檢查）`
);

// ── C7：縮放範圍 ─────────────────────────────────────────────────────────────
const se = (js.match(/scaleExtent\(\[[^\]]*\]\)/) || [])[0];
check(
  'C7 scaleExtent == [0.04, 2.5]',
  /scaleExtent\(\[\s*0\.04\s*,\s*2\.5\s*\]\)/.test(js),
  `期望 scaleExtent([0.04, 2.5])，實際 ${se || '找不到 scaleExtent'}（後果：F1 的縮放範圍改了）`
);

// ── C8：不動的檔 + REFERENCE_DOCS 筆數 ───────────────────────────────────────
const FROZEN = ['docs/js/data.js', 'docs/js/layout.js', 'docs/js/references-data.js'];
try {
  execFileSync('git', ['diff', '--exit-code', 'HEAD', '--', ...FROZEN], { cwd: REPO, stdio: 'pipe' });
  check('C8a 三個不動的檔沒被改', true);
} catch {
  check(
    'C8a 三個不動的檔沒被改',
    false,
    `期望 git diff 對 ${FROZEN.join(' / ')} 全乾淨，實際有改動` +
      `（後果：資料契約 84 nodes / 103 edges / 15 phases / 8 types 可能已變）`
  );
}
check(
  'C8b REFERENCE_DOCS 有 31 個 key',
  refKeys.size === 31,
  `期望 31，實際 ${refKeys.size}（後果：內嵌文件集合被動過，F13/F14 的資料底變了）`
);

// ── C9：F12/F14 四句原文 ─────────────────────────────────────────────────────
const F12_F14 = ['載入中⋯', '（無描述）', '（載入失敗）', '載入失敗：'];
const lostStrings = F12_F14.filter((s) => !js.includes(s));
check(
  'C9 F12/F14 四句原文都在',
  lostStrings.length === 0,
  `期望四句都在，實際缺 [${lostStrings.join(' | ')}]` +
    `（後果：F12/F14 的可觀察行為改了。註：F21 刻意不用字串比對，見檔頭）`
);

// ── C10：vendor 與資料檔載入 ─────────────────────────────────────────────────
const NEEDED = ['js/vendor/d3.min.js', 'js/vendor/dagre.min.js', 'js/vendor/marked.min.js',
  'js/layout.js', 'js/data.js', 'js/references-data.js'];
const lostSrc = NEEDED.filter((v) => !html.includes(v));
check(
  'C10 vendor 與資料檔都載入',
  lostSrc.length === 0,
  `期望六個 script 都在，實際缺 [${lostSrc.join(', ')}]` +
    `（後果：marked 缺 → F13 的 markdown 渲染不出來；references-data 缺 → F14 的 file:// 路徑失效）`
);

// ── C11：骨架錨點 ────────────────────────────────────────────────────────────
const ANCHORS = ['flow', 'panel', 'detail', 'drawer', 'backdrop'];
const lostAnchors = ANCHORS.filter((id) => !html.includes(`id="${id}"`));
check(
  'C11 骨架錨點齊全',
  lostAnchors.length === 0,
  `期望 ${ANCHORS.join(' / ')} 五個 id 都在，實際缺 [${lostAnchors.join(', ')}]（後果：app.js 抓不到掛載點）`
);

// ── C12：動畫語彙 ────────────────────────────────────────────────────────────
const linears = (css.match(/(transition|animation)[^;]*\blinear\b/g) || []).length;
const bareEase = (css.match(/(transition|animation)[^;]*\d+m?s\s+ease[;,\s)]/g) || []).length;
const curves = new Set(css.match(/cubic-bezier\([^)]*\)/g) || []);
check(
  'C12 動畫語彙',
  linears === 0 && bareEase === 0 && curves.size >= 4,
  `期望 linear=0 裸ease=0 自訂曲線>=4，實際 linear=${linears} 裸ease=${bareEase} 曲線=${curves.size}` +
    `（後果：「動畫流暢自然」是本次改版的核心訴求，硬切的 .1s ease 正是要換掉的東西）`
);

// ── C13：三態 class 與 app.js 不寫顏色 ───────────────────────────────────────
const STATES = ['is-focus', 'is-neighbor', 'is-dimmed'];
const lostStates = STATES.filter((c) => !js.includes(c));
check(
  'C13a 三態 class 齊全',
  lostStates.length === 0,
  `期望三態都在，實際缺 [${lostStates.join(', ')}]（後果：F4 的焦點／鄰居／壓暗高亮）`
);

// 只剝行首註解：整段 /\/\/.*/g 會把 'http://…' 之後的整行吃掉，那是放寬不是收緊
const jsNoComment = js
  .split('\n')
  .map((l) => l.replace(/^\s*\/\/.*$/, '').replace(/^\s*\*.*$/, ''))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const hardColors = jsNoComment.match(/oklch\(|rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b/g) || [];
check(
  'C13b app.js 不寫顏色',
  hardColors.length === 0,
  `期望 0 個硬編色，實際 ${hardColors.length} 個：${[...new Set(hardColors)].slice(0, 5).join(' ')}` +
    `（後果：F22 的「顏色只由 --c-* token 經 [data-type] 驅動」被破壞，切主題時會對不上）`
);

// ── C14：抽屜 DOM ────────────────────────────────────────────────────────────
const DRAWER_CLASSES = ['drawer-head', 'drawer-title', 'drawer-desc', 'drawer-body'];
// 比對完整的 class="x"：舊 class `doc-drawer-header` 含子字串 `drawer-head`，
// 用 includes() 會給假 PASS——這正是「契約保護名字而非行為」的同一種錯。
const lostDrawer = DRAWER_CLASSES.filter((c) => !js.includes(`class="${c}"`));
const staleDrawer = (js.match(/class="doc-drawer-[a-z]+"/g) || []);
check(
  'C14a 抽屜用新 class 且無舊 class 殘留',
  lostDrawer.length === 0 && staleDrawer.length === 0,
  `期望 ${DRAWER_CLASSES.map((c) => 'class="' + c + '"').join(' / ')} 都在且無 doc-drawer-* 殘留，` +
    `實際缺 [${lostDrawer.join(', ')}]、殘留 [${[...new Set(staleDrawer)].join(', ')}]` +
    `（後果：吐出舊 class 而新 CSS 沒有對應規則，抽屜會完全沒有樣式）`
);
check(
  'C14b markdown 被 .md 包起來',
  /class="md"/.test(js),
  `期望 app.js 產出 class="md" 容器，實際找不到` +
    `（後果：.md 承載 max-width / line-height / h3 / li 全部排版，沒包等於裸 HTML）`
);
check(
  'C14c 用 marked 渲染且去掉第一個 H1',
  /marked\.parse\(/.test(js) && /replace\(\/\^#\\s\+/.test(js),
  `期望 marked.parse( 與去 H1 的 replace 都在，實際 marked=${/marked\.parse\(/.test(js)} ` +
    `stripH1=${/replace\(\/\^#\\s\+/.test(js)}（後果：F13 明訂 body 要去掉第一個 H1）`
);

// ── C15：@media 只能有 860px 一條 ────────────────────────────────────────────
const medias = css.match(/@media[^{]*/g) || [];
check(
  'C15 @media 只有 max-width: 860px 一條',
  medias.length === 1 && /max-width:\s*860px/.test(medias[0]),
  `期望恰好 1 條且為 max-width: 860px，實際 ${medias.length} 條：${medias.map((m) => m.trim()).join(' / ')}` +
    `（後果：860px 是新骨架的結構必需——沒有它視窗 <844px 時 .panel 會疊在 .detail 上；` +
    `多加其他斷點則等於修了 user 明訂不修的缺口 4）`
);

// ── C16：docstring 密度 ──────────────────────────────────────────────────────
const docBlocks = (js.match(/\/\*\*/g) || []).length;
const namedFns = (js.match(/^\s*function\s+[A-Za-z_$]/gm) || []).length;
check(
  'C16 docstring 密度',
  docBlocks >= namedFns,
  `期望 /** 區塊 >= 具名 function，實際 ${docBlocks} < ${namedFns}` +
    `（後果：違反 CLAUDE.md §程式註解「新 code 全寫」。改版前是 36 個 /** 對 20 個 function）`
);

// ── C17：無文件節點的 else 分支 ──────────────────────────────────────────────
check(
  'C17 無文件節點有 else 分支',
  js.includes('無獨立文件'),
  `期望 app.js 有「無獨立文件」卡片，實際找不到` +
    `（後果：84 個節點裡 51 個沒有對應文件，少了這個分支它們的 detail 會缺一塊或出現死按鈕）`
);

// ── selftest：證明 fail 路徑有效 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  check('SELFTEST（刻意失敗）', false, '這條證明 fail 路徑會回非 0，驗證器不是永遠綠的');
}

console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
