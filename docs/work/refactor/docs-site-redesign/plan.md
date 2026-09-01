# docs 站整站換設計風格 Implementation Plan

> 對應 spec: `docs/work/refactor/docs-site-redesign/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-01
> 並行最大 group: 7

**Goal**：把 `design-demos/rail-console.html` 的設計（骨架 A ＋ 配色 P1）落到正式站的三個檔上，
F1–F22 一項不掉、`file://` 不壞、`data-theme` / `data-theme-mode` 屬性名不改。

**Architecture**：不引入框架、不引入 build step。demo 是單檔（CSS/JS inline），正式站維持
「`index.html` 外殼 ＋ 外部 `css/styles.css` ＋ classic script `js/app.js`」三段式——
這是 repo 既有慣例，也是 `file://` 能開的前提。移植方向固定：

| demo 位置 | 去處 | 量體 |
|---|---|---|
| `<style>` 13–576 | `docs/css/styles.css`（整份取代） | 564 行 |
| `<body>` 外殼 | `docs/index.html`（`<body>` 整段取代，`<head>` 局部改） | ~55 行 |
| `<script>` 644–1345 | `docs/js/app.js`（整份取代後回填契約） | 702 行 |

**Tech Stack**：d3 v7 ＋ dagre ＋ marked，三者皆 `docs/js/vendor/` 本地檔（不動）。
Google Fonts 由 CDN `<link>` 載入，離線降級到 fallback stack。

**Risks**：

1. **demo 不是正式站的超集**。實查已發現三處漂移，照抄就會壞（詳見 Task 6）：
   `NODE_DOCS` 多了 `LoadDD` / `LoadDLang`（＝ spec 明訂不修的既有缺口 1）、
   少了 `RPT2` / `RPT3`（＝ F12/F13 真的掉）、
   `localStorage` key 從 `dev-workflow-theme` 變成 `rail-console-theme`（＝ 現有訪客的主題偏好全作廢）。
2. **無預覽環境**。`main:/docs` 是 GitHub Pages 來源，squash merge 即公開上線。
3. **這個 repo 沒有任何測試基礎設施**（無 `package.json`、無 test runner）。
   Task 1 先建一個零依賴的 node 契約驗證器，紅綠循環才有依據——沒有它，
   T3 的「紅 → 綠」在這個 repo 只能靠肉眼，那不叫驗證。

---

## §檔案結構規劃

### 改動的檔

| 路徑 | 動什麼 | 為何 |
|---|---|---|
| `docs/index.html` | `<head>` 換字體 `<link>`、加 `marked.min.js`；`<body>` 整段換成 rail/stage/panel/detail/drawer 外殼 | 新骨架的 DOM 結構與舊三欄完全不同 |
| `docs/css/styles.css` | 940 行整份取代為 demo 的 564 行 | 整站換設計語言 |
| `docs/js/app.js` | 901 行整份取代為 demo 的 702 行，再回填 Task 6 的契約 | 渲染與互動全改 |

### 新建的檔

| 路徑 | 職責 |
|---|---|
| `docs/work/refactor/docs-site-redesign/verify/contract.mjs` | 零依賴 node 契約驗證器，涵蓋 C1–C10（見下表）。紅綠循環的判定依據 |
| `docs/work/refactor/docs-site-redesign/verify/README.md` | 怎麼跑、每條契約對應哪個 F 項 |
| `docs/work/refactor/docs-site-redesign/verify-F1-F22.md` | F1–F22 逐項驗證表（Task 7 填） |

> **為什麼驗證器放 `docs/work/` 而不是 `scripts/`**：依 CLAUDE.md §Docs 落檔，
> 「做過一次的紀錄」進 archive、「規則」才進 reference。這支驗證器綁本次改版的預期狀態
> （例如 C6 寫死 33 個 `NODE_DOCS` key），不是跨 branch 通用的規則，所以走 work → archive。
> 要把它升格成常設驗證是**獨立決策**，不在本次 scope。

### 不動的檔（明列，避免施工時手滑）

`docs/js/data.js`、`docs/js/references-data.js`、`docs/js/layout.js`、`docs/js/vendor/*`、
`docs/favicon.svg`、`docs/reference/docs-site-baseline.md` 的 F1–F22 原文與「既有缺口」六條。

### 契約清單（Task 1 實作，之後每個 task 都跑）

| # | 契約 | 對應 |
|---|---|---|
| C1 | `index.html` 與 `app.js` 無 `type="module"`、無裸 `import`；`app.js` 讀文件時 `REFERENCE_DOCS` 的分支在 `fetch` 之前 | F14、`file://` |
| C2 | `index.html` 的 inline 主題 script 出現在第一個 `<link rel="stylesheet">` **之前**；`data-theme` 與 `data-theme-mode` 兩個字串都在 | F19、屬性名鎖死 |
| C3 | 全 repo `docs/` 底下 `localStorage` 的 key 只有 `dev-workflow-theme` | F17 |
| C4 | `styles.css` 的 `--c-<type>` / `--c-<type>-bd` 宣告數 == 32（8 型別 × 2 主題），且 8 個型別名一個不少 | F22 |
| C5 | `styles.css` 的 `prefers-reduced-motion` 命中數 == 0 | spec §已決事項 1 |
| C6 | `app.js` 的 `NODE_DOCS` key 集合 == 基準 33 筆（含 `RPT2` / `RPT3`，**不含** `LoadDD` / `LoadDLang`） | F12、F13、缺口 1 不修 |
| C7 | `app.js` 的 `scaleExtent` == `[0.04, 2.5]` | F1 |
| C8 | 實跑 `data.js` ＋ `layout.js`：84 nodes / 103 edges / 15 phases / 8 types 未變 | 資料契約 |
| C9 | F21 的三句提示字串原文都在 `app.js` | F21 |
| C10 | `index.html` 仍載入 `d3.min.js`、`dagre.min.js`、`marked.min.js` 三個本地 vendor | F13、F16 |

---

## Task 1: 建立零依賴契約驗證器

**parallel-group**: 1
**files**:
- create: `docs/work/refactor/docs-site-redesign/verify/contract.mjs`
- create: `docs/work/refactor/docs-site-redesign/verify/README.md`

這個 task 的「紅」是**驗證器本身跑得動、且對著現況正確地報出 C1–C10 的當前狀態**。
現況下 C4/C5/C6/C9 等會依 demo 尚未移植而呈現「現況值」——那是基準，不是失敗。

- [ ] **Step 1: 寫失敗測試**

先寫一條會 fail 的自我測試，證明驗證器真的會 fail（不會永遠綠）：

```js
// verify/contract.mjs 末尾
if (process.argv.includes('--selftest')) {
  // 故意斷言一個不可能成立的條件，證明 fail 路徑會回非 0
  check('SELFTEST（應失敗）', false, '這條刻意失敗，證明驗證器不是永遠綠的');
}
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs --selftest
echo "exit=$?"
# Expected: 印出 FAIL SELFTEST，exit=1
```

- [ ] **Step 3: 寫最小實作讓測試過**

```js
// docs/work/refactor/docs-site-redesign/verify/contract.mjs
/**
 * docs 站契約驗證器（零依賴，只用 node 內建模組）。
 *
 * 為什麼要有這支：這個 repo 沒有 package.json、沒有 test runner，
 * T3 的紅綠循環需要一個機械判定依據，否則「功能有沒有掉」只能靠肉眼。
 * 契約編號 C1-C10 對應 verify/README.md 的表，與 docs-site-baseline.md 的 F 項掛鉤。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..'); // -> repo/docs
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let failed = 0;
/** 印一條檢查結果；false 時累計失敗數，最後決定 exit code。 */
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ' — ' + detail}`);
  if (!ok) failed++;
}

const html = read('index.html');
const css = read('css/styles.css');
const js = read('js/app.js');

// C1 file:// 契約
check('C1a 無 ES module', !/type="module"/.test(html) && !/^\s*import\s/m.test(js),
  'index.html 或 app.js 出現 type="module" / 裸 import，file:// 會直接壞');
check('C1b REFERENCE_DOCS 分支在 fetch 之前',
  js.indexOf('REFERENCE_DOCS') !== -1 &&
  js.indexOf('REFERENCE_DOCS') < js.indexOf('fetch('),
  'F14 要求先讀內嵌、沒有才 fetch；順序反了 file:// 就會走到 fetch 然後失敗');

// C2 防 FOUC + 屬性名
const iScript = html.indexOf("localStorage.getItem('dev-workflow-theme')");
const iLink = html.indexOf('<link rel="stylesheet"');
check('C2a inline 主題 script 在 CSS 之前', iScript !== -1 && iLink !== -1 && iScript < iLink,
  'F19 防 FOUC 依賴這個順序');
check('C2b 兩個屬性名都在',
  html.includes('data-theme') && html.includes('data-theme-mode'), '屬性名被改掉了');

// C3 localStorage key
const keys = [...(html + js).matchAll(/localStorage\.[gs]etItem\('([^']+)'/g)].map((m) => m[1]);
check('C3 localStorage key 唯一且為 dev-workflow-theme',
  keys.length > 0 && [...new Set(keys)].join(',') === 'dev-workflow-theme',
  `實際為 [${[...new Set(keys)].join(', ')}]；改 key 會讓現有訪客的主題偏好全部作廢`);

// C4 八型別 token x 兩主題
const TYPES = ['default', 'gate', 'agent', 'skill', 'policy', 'impl', 'hook', 'stop'];
const decls = [...css.matchAll(/--c-([a-z]+)(-bd)?\s*:/g)];
check('C4a token 宣告數 == 32', decls.length === 32, `實際 ${decls.length} 條`);
check('C4b 八型別一個不少',
  TYPES.every((t) => css.includes(`--c-${t}:`) && css.includes(`--c-${t}-bd:`)),
  '缺少某個型別的 token');

// C5 prefers-reduced-motion 必須維持 0（spec 已決事項 1）
check('C5 prefers-reduced-motion == 0',
  (css.match(/prefers-reduced-motion/g) || []).length === 0,
  'user 明確指示一律不加');

// C6 NODE_DOCS key 集合
const BASELINE_KEYS = [
  'DevWfSkill', 'BS', 'LoadDB', 'LoadWP', 'LoadRP', 'LoadExec', 'LoadTDD', 'LoadDispatch',
  'LoadVerify', 'LoadFE', 'LoadReq', 'LoadRecv', 'LoadSec', 'LoadChk', 'LoadFin', 'LoadSafety',
  'LoadPrEx', 'LoadRetro', 'LoadDebug', 'LoadIncident', 'LoadLock', 'LoadCmdG', 'LoadCtxS',
  'LoadCtxR', 'LoadWS', 'HypAgent', 'FEAgent', 'LangAgent', 'SecAgent', 'DBAgent', 'PrExAgent',
  'RPT2', 'RPT3',
].sort();
const block = js.slice(js.indexOf('NODE_DOCS'), js.indexOf('\n};', js.indexOf('NODE_DOCS')));
const actual = [...block.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)\s*:\s*\{/gm)].map((m) => m[1]).sort();
check('C6 NODE_DOCS key 集合與基準一致',
  JSON.stringify(actual) === JSON.stringify(BASELINE_KEYS),
  `多了 [${actual.filter((k) => !BASELINE_KEYS.includes(k))}]、少了 [${BASELINE_KEYS.filter((k) => !actual.includes(k))}]`);

// C7 縮放範圍
check('C7 scaleExtent == [0.04, 2.5]', /scaleExtent\(\[\s*0\.04\s*,\s*2\.5\s*\]\)/.test(js),
  'F1 的縮放範圍被改了');

// C9 F21 三句提示原文
const HINTS = ['再點同項清除 / ESC 清除', '再點同節點 / ESC 清除', '點 type 或 phase 快速導覽'];
check('C9 F21 三句提示原文都在', HINTS.every((h) => js.includes(h)),
  `缺 [${HINTS.filter((h) => !js.includes(h)).join(' | ')}]`);

// C10 三個本地 vendor
check('C10 三個 vendor 都載入',
  ['d3.min.js', 'dagre.min.js', 'marked.min.js'].every((v) => html.includes(`js/vendor/${v}`)),
  'marked 缺了 F13 的 markdown 就渲染不出來');

// C8 資料契約（實跑 data.js + layout.js）
const win = {};
new Function('window', 'module', 'exports', read('js/vendor/dagre.min.js'))(win, {}, {});
new Function('window', read('js/layout.js') + ';window.__bl=buildLayout;')(win);
new Function('window', read('js/data.js'))(win);
const F = win.FLOW_DATA;
const types = new Set(Object.values(F.nodes).map((n) => n.type || 'default'));
check('C8 資料契約 84/103/15/8',
  Object.keys(F.nodes).length === 84 && F.edges.length === 103 &&
  F.phases.length === 15 && types.size === 8,
  `實際 ${Object.keys(F.nodes).length}/${F.edges.length}/${F.phases.length}/${types.size}`);

if (process.argv.includes('--selftest')) {
  check('SELFTEST（應失敗）', false, '這條刻意失敗，證明驗證器不是永遠綠的');
}

console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 4: 跑測試確認通過**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs --selftest; echo "selftest exit=$?"
# Expected: 出現 FAIL SELFTEST，exit=1（證明 fail 路徑有效）

node docs/work/refactor/docs-site-redesign/verify/contract.mjs; echo "baseline exit=$?"
# Expected: C1/C2/C3/C6/C7/C8/C9 PASS（現況本來就對）
#           C4 FAIL（現況是 hex 不是 --c-* 的 32 條 oklch）、C10 FAIL 或 PASS 視 marked 而定
#           → 這些 FAIL 就是本次改版要轉綠的目標，是「紅」不是壞掉
```

- [ ] **Step 5: commit**

```bash
git add docs/work/refactor/docs-site-redesign/verify/
git commit -m "test: 加入 docs 站契約驗證器與 C1-C10 對照"
```

---

## Task 2: index.html 外殼移植

**parallel-group**: 2
**files**:
- modify: `docs/index.html`（`<head>` 局部、`<body>` 全段）

**不動**：`<head>` 開頭那段 inline 主題 script（`index.html:9-24`）**一行都不改**，位置維持在
第一個 `<link rel="stylesheet">` 之前——F19 與 C2a 靠它。

- [ ] **Step 1: 寫失敗測試**

C2a / C2b / C10 已在 Task 1 涵蓋。本 task 額外加一條到 `contract.mjs`：

```js
// C11 新骨架的五個錨點 id 都在
const ANCHORS = ['flow', 'panel', 'detail', 'drawer', 'backdrop'];
check('C11 骨架錨點齊全', ANCHORS.every((id) => html.includes(`id="${id}"`)),
  `缺 [${ANCHORS.filter((id) => !html.includes(`id="${id}"`)).join(', ')}]`);
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs 2>&1 | grep -E 'C11|C10'
# Expected: FAIL C11 骨架錨點齊全 — 缺 [flow, panel, detail, drawer, backdrop]
```

- [ ] **Step 3: 寫最小實作讓測試過**

`<head>` 只改兩處：字體 `<link>` 換成 demo 的那一行、vendor 區加回 `marked.min.js`。

```html
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500&family=Noto+Serif+TC:wght@600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="./css/styles.css" />

<!-- vendor libs：本地 classic script，file:// 與離線均可用 -->
<script src="./js/vendor/d3.min.js"></script>
<script src="./js/vendor/dagre.min.js"></script>
<script src="./js/vendor/marked.min.js"></script>

<script src="./js/layout.js"></script>
<script src="./js/data.js"></script>
<script src="./js/references-data.js"></script>
```

`<body>` 換成 demo `rail-console.html` 的 `<div class="shell">…</div>` 全段（rail / stage /
panel / detail / drawer / backdrop），**逐字照抄**，只有一處改：rail 的四個 `data-label`
在 demo 是 hover 才顯示，Task 5 會補上可及性處理，本 task 先照抄。

- [ ] **Step 4: 跑測試確認通過**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs 2>&1 | grep -E 'C1|C2|C10|C11'
# Expected: C1a/C1b/C2a/C2b/C10/C11 全 PASS
```

- [ ] **Step 5: commit**

```bash
git add docs/index.html docs/work/refactor/docs-site-redesign/verify/contract.mjs
git commit -m "refactor: docs 站外殼換成 rail/stage/panel 骨架"
```

---

## Task 3: styles.css 整份取代

**parallel-group**: 3
**files**:
- modify: `docs/css/styles.css`（940 行 → demo 的 564 行）

依 repo 慣例，樣式一律進外部 `styles.css`、沿用 `--c-*` token 設計系統，不用 inline
（memory `feedback_css_follow_repo_convention_no_ask`）。

- [ ] **Step 1: 寫失敗測試**

C4a / C4b / C5 已在 Task 1 涵蓋。額外加一條，防「換了設計卻把緩動退回硬切」：

```js
// C12 動畫語彙：0 個 linear、0 個裸 ease、>=4 條自訂 cubic-bezier
const linears = (css.match(/(transition|animation)[^;]*\blinear\b/g) || []).length;
const bareEase = (css.match(/(transition|animation)[^;]*\d+m?s\s+ease[;,\s)]/g) || []).length;
const curves = new Set((css.match(/cubic-bezier\([^)]*\)/g) || []));
check('C12 動畫語彙', linears === 0 && bareEase === 0 && curves.size >= 4,
  `linear=${linears} 裸ease=${bareEase} 自訂曲線=${curves.size}`);
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs 2>&1 | grep -E 'C4|C12'
# Expected: FAIL C4a token 宣告數 == 32 — 實際 0（現況是 hex，不是 --c-* oklch）
#           FAIL C12 動畫語彙 — linear=1 裸ease=13 自訂曲線=0
```

- [ ] **Step 3: 寫最小實作讓測試過**

把 `rail-console.html` 第 13–576 行（`<style>` 與 `</style>` 之間）整段寫進
`docs/css/styles.css`，取代原本 940 行全部。頂部補檔頭註解：

```css
/* dev-workflow flowchart explorer — rail-console 骨架 / 校樣配色 */
/* 設計定案與 token 論證見 docs/work/refactor/docs-site-redesign/spec.md §定案設計的可重建規格 */
/* 顏色只透過 [data-type="..."] 屬性選擇器套用；app.js 不寫任何顏色（F22 契約） */
```

**不得順手加**：`@media`（缺口 4 零響應式不修）、`prefers-reduced-motion`（已決事項 1）、
`tabindex` / `:focus-visible` 擴充（缺口 5 不修）。

- [ ] **Step 4: 跑測試確認通過**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs 2>&1 | grep -E 'C4|C5|C12'
# Expected: C4a / C4b / C5 / C12 全 PASS

grep -c '@media' docs/css/styles.css
# Expected: 0（缺口 4 維持未修）
```

- [ ] **Step 5: commit**

```bash
git add docs/css/styles.css docs/work/refactor/docs-site-redesign/verify/contract.mjs
git commit -m "refactor: docs 站樣式換成校樣配色與 oklch token"
```

---

## Task 4: app.js 渲染與互動移植

**parallel-group**: 4
**files**:
- modify: `docs/js/app.js`（901 行 → demo 的 702 行為底）

- [ ] **Step 1: 寫失敗測試**

C7 已涵蓋 `scaleExtent`。額外加一條，確認新渲染真的把三態與 8 型別掛上 DOM：

```js
// C13 三態 class 與 data-type 上色機制都在 app.js
check('C13a 三態 class 齊全',
  ['is-focus', 'is-neighbor', 'is-dimmed'].every((c) => js.includes(c)),
  'F4 的三態高亮');
check('C13b app.js 不寫顏色（顏色只在 CSS）',
  !/#[0-9a-fA-F]{6}\b/.test(js.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')),
  'F22 契約：顏色一律由 --c-* token 經 [data-type] 驅動，app.js 只寫 data-type 屬性');
```

> C13b 是本次改版**相對現況的加嚴**：現況 `app.js:21-23` 硬編了
> `HL_COLOR` / `EDGE_CLR` / `DIM_CLR` 三個 hex，是 spec §風險 3 點名的雙軌問題。
> demo 已經把它們改成從 CSS custom property 讀，這條契約把該改進鎖住。

- [ ] **Step 2: 跑測試確認失敗**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs 2>&1 | grep -E 'C13'
# Expected: FAIL C13b — 現況 app.js 有 #FF6A00 / #8080CC / #CCCCEE 三個硬編色
```

- [ ] **Step 3: 寫最小實作讓測試過**

把 `rail-console.html` 第 644–1345 行（`<script>` 與 `</script>` 之間）整段寫進
`docs/js/app.js`，取代原本 901 行。移植時**只做三件必要調整**：

1. 檔頭補繁中 docstring（CLAUDE.md §程式註解：function/class docstring 必寫）
2. demo 的 `NODE_DOCS` **先原樣帶入**，Task 6 才修正——分兩步是為了讓 C6 的紅綠看得見
3. demo 的 `localStorage` key **先原樣帶入**，Task 6 才修正——同上理由

> **為什麼不在這個 task 一次改完**：C6 與 C3 的失敗必須被「跑出來看到」，
> 否則 Task 6 就變成沒有紅的綠。這是刻意分兩個 task，不是漏掉。

- [ ] **Step 4: 跑測試確認通過**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs 2>&1 | grep -E 'C7|C13'
# Expected: C7 / C13a / C13b PASS
#           C3（localStorage）與 C6（NODE_DOCS）此時應為 FAIL — 那是 Task 6 的紅
```

- [ ] **Step 5: commit**

```bash
git add docs/js/app.js docs/work/refactor/docs-site-redesign/verify/contract.mjs
git commit -m "refactor: docs 站主程式換成 rail-console 渲染與互動"
```

---

## Task 5: 文件抽屜接回真 REFERENCE_DOCS

**parallel-group**: 5
**files**:
- modify: `docs/js/app.js`（drawer 區塊）

demo 的抽屜用靜態假內容示意（`rail-console.html:1177` 那段是現編的上下游摘要）。
正式站必須接回 `window.REFERENCE_DOCS` ＋ `marked`，否則 **F13 / F14 直接掉**。

- [ ] **Step 1: 寫失敗測試**

```js
// C14 抽屜走真資料：先內嵌、沒有才 fetch；用 marked 渲染；去掉第一個 H1
check('C14a 抽屜讀內嵌 REFERENCE_DOCS', /REFERENCE_DOCS\s*(\?\.|\[)/.test(js), 'F14');
check('C14b 用 marked 渲染', /marked\.parse\(/.test(js), 'F13 的 markdown 渲染');
check('C14c 去掉第一個 H1', /replace\(\/\^#\\s\+\.\+/.test(js) || js.includes("replace(/^#\\s+.+\\n?/"),
  'F13 明訂 body 要去掉第一個 H1');
check('C14d frontmatter description 解析', /parseFrontmatterDesc|description:/.test(js), 'F12');
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs 2>&1 | grep -E 'C14'
# Expected: C14a-C14d 全 FAIL（demo 沒有接真資料）
```

- [ ] **Step 3: 寫最小實作讓測試過**

從現況 `app.js` 搬回三個函式，原樣不改邏輯（它們是 F12 / F13 / F14 的實作）：
`parseFrontmatterDesc()`（`app.js:79-90`）、`parseFrontmatter()`（`app.js:98-127`）、
`openDocDrawer()` 的資料取得與渲染段（`app.js:583-616`）。接進 demo 的 drawer DOM：

```js
/**
 * 開啟文件抽屜並渲染指定 markdown。
 * 先讀 window.REFERENCE_DOCS 內嵌全文（file:// 能用的原因），沒有才 fetch。
 * @param {string} docPath - 相對 index.html 的路徑
 * @param {string} docName - 顯示名稱
 */
function openDrawer(docPath, docName) {
  // ...（麵包屑 / badge / 開闔動畫沿用 demo 的實作）
  var inlined = window.REFERENCE_DOCS && window.REFERENCE_DOCS[docPath];
  var textPromise = inlined != null
    ? Promise.resolve(inlined)
    : fetch(docPath).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      });
  textPromise.then(function (text) {
    var parsed = parseFrontmatter(text);
    // header：type badge / title / description / model+tools pills（F13）
    var cleanBody = parsed.body.replace(/^#\s+.+\n?/, '').trim();
    drawerBodyEl.innerHTML = window.marked.parse(cleanBody);
  }).catch(function (e) {
    drawerBodyEl.innerHTML = '<div class="drawer-error">載入失敗：' + esc(e.message) + '</div>';
  });
}
```

detail panel 的文件摘要（F12）同樣接回：`載入中⋯` → frontmatter `description` 第一行 →
無描述顯示 `（無描述）` → 失敗顯示 `（載入失敗）`，三個字串原文不得改。

- [ ] **Step 4: 跑測試確認通過**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs 2>&1 | grep -E 'C1b|C14'
# Expected: C1b（內嵌分支在 fetch 之前）與 C14a-C14d 全 PASS
```

- [ ] **Step 5: commit**

```bash
git add docs/js/app.js docs/work/refactor/docs-site-redesign/verify/contract.mjs
git commit -m "fix: 文件抽屜接回內嵌 REFERENCE_DOCS 與 marked 渲染"
```

---

## Task 6: 契約回填 — 修掉 demo 的三處漂移

**parallel-group**: 6
**files**:
- modify: `docs/js/app.js`

本 task 專門處理「demo 不是正式站超集」造成的三處漂移。**這是整個 plan 風險最高的一個 task**，
因為三處都會靜默地壞掉、不報錯。

- [ ] **Step 1: 寫失敗測試**

C3（localStorage key）、C6（NODE_DOCS 集合）、C9（F21 三句）已在 Task 1 寫好，此處不重寫。
再加一條 F2 的改動記錄，確認 fit-all 的能力沒被刪掉、只是不再是預設：

```js
// C15 F2 改動：預設對齊起點，但 fit-all 仍可觸發
check('C15a 仍有 fitView 能力', /function fitView|fitView\s*=/.test(js), 'F2 的能力不得刪除');
check('C15b 預設走 landing 而非 fitView',
  /landingTransform/.test(js), 'spec 已決事項 0：預設對齊起點的可讀比例');
check('C15c fit-all 有觸發點', /btn-fit/.test(js), 'fit-all 必須有 UI 入口');
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs 2>&1 | grep -E 'C3|C6|C9|C15'
# Expected:
#   FAIL C3  — 實際為 [rail-console-theme]
#   FAIL C6  — 多了 [LoadDD,LoadDLang]、少了 [RPT2,RPT3]
#   FAIL C9  — 缺 [再點同項清除 / ESC 清除 | 再點同節點 / ESC 清除 | 點 type 或 phase 快速導覽]
```

- [ ] **Step 3: 寫最小實作讓測試過**

**漂移 1 — `localStorage` key**。demo 的 `'rail-console-theme'` 全部改回 `'dev-workflow-theme'`。
不改的話所有現有訪客存過的主題偏好會被當成沒設定過，全部退回 auto。

```js
try { localStorage.setItem('dev-workflow-theme', next); } catch (_) {}
```

**漂移 2 — `NODE_DOCS`**。刪掉 demo 自行加上的 `LoadDD` / `LoadDLang` 兩筆，補回 `RPT2` / `RPT3`：

```js
// 刪除（spec §範圍 明訂：baseline 既有缺口 1 不修。
// 且 references-data.js 沒有這兩份的內嵌全文（缺口 2），加了反而會讓節點點出「載入失敗」）
// LoadDLang: { path: 'references/skills/design-language/SKILL.md',  ... },
// LoadDD:    { path: 'references/skills/design-direction/SKILL.md', ... },

// 補回（review-plan 內 spawn 的 subagent 節點，指回 review-plan skill）
RPT2: { path: 'references/skills/review-plan/SKILL.md', name: 'review-plan (T2 Eng-only)' },
RPT3: { path: 'references/skills/review-plan/SKILL.md', name: 'review-plan (T3 四視角)' },
```

**漂移 3 — F21 三句提示**。把 demo 的 `renderStatus()` 補上原本三種狀態字串，原文一字不改：

```js
/**
 * 依 selection 狀態產生提示字串。三句原文來自改版前的 app.js:730-732，
 * 是 F21 的驗證對象，不得改寫。
 */
function hintText() {
  if (selection && selection.kind === 'type') return '再點同項清除 / ESC 清除';
  if (selection && selection.kind === 'node') return '再點同節點 / ESC 清除';
  return '點 type 或 phase 快速導覽';
}
```

- [ ] **Step 4: 跑測試確認通過**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs
# Expected: ALL PASS，exit=0（C1-C15 全綠）
```

- [ ] **Step 5: commit**

```bash
git add docs/js/app.js docs/work/refactor/docs-site-redesign/verify/contract.mjs
git commit -m "fix: 回填 NODE_DOCS 與主題 key，補回 F21 提示字串"
```

---

## Task 7: F1–F22 逐項驗證表

**parallel-group**: 7
**files**:
- create: `docs/work/refactor/docs-site-redesign/verify-F1-F22.md`
- modify: `docs/reference/docs-site-baseline.md`（**append-only**，只在末尾加一段指向驗證表）

契約驗證器只涵蓋機械可測的部分。F3/F5/F6/F8/F10/F11/F15/F16/F18 這些**行為**要靠
`frontend-test` → `frontend-e2e-runner`（Playwright MCP）實跑。

- [ ] **Step 1: 寫失敗測試**

驗證表本身就是「測試」。先建空表，每項填 `⬜ 未驗`：

```markdown
| # | 功能 | 驗證方式 | 結果 |
|---|---|---|---|
| F1 | 縮放 / 平移 0.04–2.5 | C7 ＋ e2e 滾輪 | ⬜ 未驗 |
| ... | | | |
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
grep -c '⬜ 未驗' docs/work/refactor/docs-site-redesign/verify-F1-F22.md
# Expected: 22（全部未驗）
```

- [ ] **Step 3: 寫最小實作讓測試過**

依序執行並填表：

1. `node docs/work/refactor/docs-site-redesign/verify/contract.mjs` → 填 C 系列涵蓋的項
2. 本機起 http server 供 Playwright 用（**Playwright MCP 擋 `file://`**，見 memory）：
   `python -m http.server 8080 --directory docs`
3. 載 `frontend-test`，spawn `frontend-e2e-runner` 跑行為項
4. **人工開一次 `file://docs/index.html`**——這是 F14 唯一真正的驗證方式，
   Playwright 走 http 驗不到 `file://` 專屬的失敗模式

**填表規則**：
- 行為與改版前一致 → ✅
- 行為有意改動 → **改動說明**（F2 屬此，附 spec §已決事項 0 的連結）
- 掉了 → ❌，**停止收尾、回 execute-plan 修**
- 六條既有缺口 → 標「既有缺口，未修（依 user 指示）」，不算 ❌

另外把 demo 帶進來的**兩個新增功能**單獨列一節，不混進 F 表：
rail 的「文件索引（31）」瀏覽面板、panel 的「釘」鈕。新增不是取代，但要有紀錄。

- [ ] **Step 4: 跑測試確認通過**

```bash
grep -c '⬜ 未驗' docs/work/refactor/docs-site-redesign/verify-F1-F22.md
# Expected: 0

grep -c '❌' docs/work/refactor/docs-site-redesign/verify-F1-F22.md
# Expected: 0
```

- [ ] **Step 5: commit**

```bash
git add docs/work/refactor/docs-site-redesign/verify-F1-F22.md docs/reference/docs-site-baseline.md
git commit -m "docs: 補 F1-F22 改版後逐項驗證結果"
```

---

## §並行性分析

**結論：本 plan 幾乎沒有並行空間，`parallel-group` 1→7 全序列。**

依 write-plan §並行性分析 規則 5「同檔多 task → 不同 group」：

| group | task | 為何不能與前一組並行 |
|---|---|---|
| 1 | Task 1 驗證器 | 唯一真正獨立的 task（不碰 `docs/` 的三個產品檔） |
| 2 | Task 2 index.html | 後續 CSS 的 class 名要對著新 DOM |
| 3 | Task 3 styles.css | 依賴 Task 2 的 DOM 結構 |
| 4 | Task 4 app.js 主體 | 依賴 Task 2 的錨點 id 與 Task 3 的 class |
| 5 | Task 5 抽屜 | **同檔** `app.js` |
| 6 | Task 6 契約回填 | **同檔** `app.js`，且刻意排在 Task 4 之後才能看到紅 |
| 7 | Task 7 驗證表 | 依賴全部完成 |

**因此不會觸發 `dispatch-parallel`，也就不會有 Agent Teams 的判定點**——
CLAUDE.md §協作模式判定 的觸發點只有「execute-plan 遇 parallel-group 同號多 task」，本 plan
沒有任何一組同號多 task。這是實據結論，不是省略。

---

## §Self-review

**1. spec coverage**

| spec success criteria | 對應 task |
|---|---|
| ① F1–F22 全數通過、逐項填表 | Task 1（C1–C15 機械項）＋ Task 7（行為項 e2e ＋ 填表） |
| ② `file://` 直接開仍可運作 | C1a / C1b / C10（Task 1）＋ Task 7 Step 3 的人工 `file://` 實開 |
| ③ `data-theme` / `data-theme-mode` 不改、inline script 仍在 CSS 前 | C2a / C2b（Task 1、Task 2 驗收） |
| ④ 視覺明顯改版（版面層級 / 字體階層 / 動態語彙） | Task 2（版面）＋ Task 3（字體階層、C12 動態語彙） |
| ⑤ 動畫可驗：非 linear、非裸 ease，有進出場 | C12（Task 3） |

spec §範圍「排除」的六條缺口 ＋ `bastck` 拼字，在 Task 3 / Task 6 / Task 7 都有明文守則，
且 C5（`prefers-reduced-motion == 0`）把「不修」寫成了機械契約——**不修**這件事本身被測到了。

**2. placeholder 掃**：無 `TBD` / `TODO` / `稍後實作`。每個 Step 3 都有可執行的 code 或
明確的行號來源（`app.js:79-90` 等）。

**3. 型別一致**：`check(name, ok, detail)` 三參數在 C1–C15 全一致；
`html` / `css` / `js` 三個變數名在 `contract.mjs` 內全域一致。

**4. 並行性檢查**：已逐組列出依賴理由，見上節。

**5. scope 檢查**：唯一超出 spec 原文的是 **Task 1 的驗證器**（spec 沒提要建測試工具）。
理由是 T3 需要紅綠依據而這個 repo 零測試設施；已限制在 `docs/work/` 底下、merge 時隨
work 目錄進 archive，不變成常設資產。**這條列出來讓 review-plan 判，不當作已核准。**

---

## §hand-off state

```yaml
state:
  plan_path: docs/work/refactor/docs-site-redesign/plan.md
  parallel_groups: [1, 2, 3, 4, 5, 6, 7]
  task_count: 7
  current_phase: write-plan-done
```

**下一 phase**：`review-plan`（T3 = CEO ＋ Design ＋ Eng ＋ DX 四視角）
