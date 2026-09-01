# docs 站整站換設計風格 Implementation Plan（v2）

> 對應 spec: `docs/work/refactor/docs-site-redesign/spec.md`
> 對應 review: `docs/work/refactor/docs-site-redesign/review.md`（四視角，8 Critical / 22 Major）
> Track: Dev | Tier: T3
> 建立: 2026-09-01（v2 依 review-plan 結果重寫）
> 並行性: **serial（無 parallel-group）**，理由見 §並行性分析

**Goal**：把 `design-demos/rail-console.html` 的設計（骨架 A ＋ 配色 P1「校樣」）落到正式站，
F1–F22 逐項交代、`file://` 不壞、`data-theme` / `data-theme-mode` 屬性名不改。

## §執行環境（v2 新增，全篇適用）

**本 plan 的所有指令一律在 Bash（Git Bash）執行，不在 PowerShell。**
理由：`$?` 在 PowerShell 是布林（會印 `True` / `False`，不是 exit code）——那是**靜默給錯答案**，
比報錯更糟；`grep` 在 PowerShell 也不存在。

**移植來源的絕對路徑**（v1 全篇寫成 `design-demos/...`，repo 根本沒有那個目錄）：

```
D:/GitHub/bstack/docs/work/refactor/docs-site-redesign/design-demos/rail-console.html
```

該目錄被 `.gitignore` 的 `**/design-demos/` 命中、**永不進版控**。Task 1 會複製一份到
`docs/work/refactor/docs-site-redesign/source-rail-console.html`（入版控、隨 work 目錄進 archive），
否則「整份取代」的來源在 merge 後連 archive 都接不到。

**檔內註解一律指向 archive 後的路徑** `docs/archive/2026/docs-site-redesign/`，不指向
`docs/work/...`——依 CLAUDE.md §Docs 落檔，finish-branch 會把整包搬走，指向 work 的註解 merge 當下就 404。

---

## §v1 → v2 改了什麼（review 的處置）

| review | v1 的問題 | v2 的處置 |
|---|---|---|
| K4 | Task 2→4 之間有 3 個確定壞掉的 commit，契約卻逐條轉綠 | **三檔合併成 Task 2 一個 commit**。站台不經過不可用狀態 |
| K5 | `C15a: /function fitView/` 保護名字不保護行為，fit-all 已被移除卻會綠 | 刪掉 C15a；F2 改記「能力移除」（spec §已決事項 0），驗證改由 e2e ＋ 驗證表承擔 |
| K2 | C4 現況就是 32 條、改版前後都綠，F22 無守門能力 | C4 改**值域斷言**（`--c-*` 的值必須以 `oklch(` 開頭）＋ light/dark 各 8 組成對 |
| K3 | `NODE_DOCS` shape 混血、C6 只比 key 名 | 新增 C6b（每筆有 `p`/`n`/`k`）與 **C6c（解出的 key 必須在 `REFERENCE_DOCS` 命中）** |
| K6 | Task 5 描述與 demo 結構不相容，量體低估一倍 | Task 3 重寫為「重寫抽屜 DOM ＋ 寫 path→key 轉換 ＋ 接真資料」 |
| K7 | Task 1 的 `--selftest` 在 `check()` 存在前就要跑 | 改成「寫完 → 用 `--selftest` 證明 fail 路徑有效」，不硬套 Step1/2 模板 |
| K8 | 無 user 視覺驗收 gate、無 rollback | Task 5 加 user 視覺驗收 gate ＋ 記錄 merge 前 main SHA |
| M7 | C13b 的註解剝除會吃掉 `'http://...'` 整行；只認 6 位 hex | 改只剝行首註解；pattern 擴成 `oklch(|rgba?(|hsla?(|#[0-9a-f]{3,8}` |
| M8/M17 | C8 的 `layout.js` 那段是死碼（`win.dagre` 是 undefined） | C8 改成 `git diff --exit-code` 三個不動的檔 ＋ 驗 `REFERENCE_DOCS` 31 key |
| M10 | F12/F14 四句原文無契約，標準與 F21 不一致 | 新增 C9（四句原文）；F21 改測「三種狀態各有分支」 |
| M11 | docstring 密度倒退（36/20 → 13/25） | 新增 C16（`/**` 區塊數 ≥ 具名 function 數）＋ Task 2 明列要補 |
| M18/M22 | `verify/README.md` 會過期且沒人更新 | **不建 README**，內容寫進 `contract.mjs` 檔頭 |
| M20 | rail 可及性缺的是 focus 名牌與 `aria-label`，不是命中區 | Task 4 明列這兩條（命中區實測已是 44×44，不用動） |
| M21 | Task 5 有把 demo 的「無文件」卡片弄掉的風險 | Task 3 明列必須保留該 else 分支 ＋ 加契約 |
| Minor | 「加回 marked」是錯的（現況已載入）；真風險是照抄 demo 的 `<head>` 會弄丟它 | Task 2 明寫「demo 只載 d3+dagre，marked 與 references-data 必須保留」 |

---

## §契約清單（Task 1 實作）

| # | 契約 | 守什麼 | 有紅相？ |
|---|---|---|---|
| C1a | `index.html` / `app.js` 無 `type="module"`、無裸 `import` | F14、`file://` | 否（現況已對，防退化） |
| C1b | `app.js` 同時有 `REFERENCE_DOCS` 與 `fetch(`，且前者的位置在後者之前 | F14 | **是**（demo 兩者皆無） |
| C2a | inline 主題 script 在第一個 `<link rel="stylesheet">` 之前 | F19 | 否（防退化） |
| C2b | `data-theme` 與 `data-theme-mode` 兩字串都在 | 屬性名鎖死 | 否（防退化） |
| C3 | `localStorage` key 唯一且為 `dev-workflow-theme` | F17 | **是**（demo 是 `rail-console-theme`） |
| C4a | 每個 `--c-*` 宣告的值都以 `oklch(` 開頭 | F22 | **是**（現況 0 條、改版後 32 條） |
| C4b | 八型別在 light 與 dark 各有 fill ＋ bd 成對 | F22 | 否（現況已對） |
| C5 | `prefers-reduced-motion` 命中 == 0 | spec §已決事項 1 | 否（守「不修」） |
| C6a | `NODE_DOCS` key 集合 == 基準 33 筆 | F12/F13、缺口 1 不修 | **是**（demo 多 2 少 2） |
| C6b | 每筆 `NODE_DOCS[*]` 都有 `p` / `n` / `k` 三鍵 | K3 混血物件 | **是** |
| C6c | 每筆解出的 key 都在 `REFERENCE_DOCS` 命中 | **F13/F14 的資料底** | **是** |
| C7 | `scaleExtent` == `[0.04, 2.5]` | F1 | 否（demo 已對） |
| C8a | `git diff --exit-code` 三個不動的檔全乾淨 | 資料契約 | 否 |
| C8b | `REFERENCE_DOCS` 有 31 個 key | F13/F14 | 否 |
| C9 | F12/F14 四句原文都在：`載入中⋯`／`（無描述）`／`（載入失敗）`／`載入失敗：` | F12、F14 | **是**（demo 0 命中） |
| C10 | `index.html` 載入 `d3.min.js`、`dagre.min.js`、`marked.min.js` 三個本地 vendor ＋ `references-data.js` | F13、F16 | **是**（若照抄 demo 的 head 就會紅） |
| C11 | 骨架錨點 `flow`/`panel`/`detail`/`drawer`/`backdrop` 都在 | 新骨架 | **是** |
| C12 | `linear` == 0、裸 `ease` == 0、自訂 cubic-bezier ≥ 4 | 「動畫流暢自然」 | **是**（現況 1/8/0） |
| C13a | 三態 class `is-focus`/`is-neighbor`/`is-dimmed` 都在 | F4 | 否（demo 已對） |
| C13b | `app.js` 不寫顏色（`oklch(`／`rgb(`／`hsl(`／`#hex` 皆零命中） | F22 加嚴 | **是**（現況 3 個硬編 hex） |
| C14a | 抽屜 DOM 用 demo 的 class：`drawer-head`/`drawer-title`/`drawer-desc`/`drawer-body` | K6 | 否 |
| C14b | markdown 內容被 `<div class="md">` 包起來 | K6（`.md` 承載全部排版） | **是** |
| C14c | 用 `marked.parse(` 渲染、且去掉第一個 H1 | F13 | **是** |
| C15 | `styles.css` 的 `@media` 命中 == 1，且是 `max-width: 860px` | spec §已決事項 2 | **是**（現況 0、demo 2） |
| C16 | `app.js` 的 `/**` 區塊數 ≥ 具名 function 數 | CLAUDE.md §程式註解 | **是**（demo 13 < 25） |
| C17 | 無文件節點的 else 分支存在（`無獨立文件` 字串在） | M21 | 否（demo 已對，防被改掉） |

**刻意不做成契約的**（review M-2 / K5 的教訓：契約只該測機械可判的事實）：

- **F2 / F21 一律以 e2e ＋ 人工驗收為準**。v1 的 `C15a: /function fitView/` 證明了
  「函式名存在」與「行為存在」無關——那條契約在 fit-all 已被移除的 demo 上會直接綠。
- F3 / F5 / F6 / F8 / F10 / F11 / F15 / F16 / F18 這些**行為**同理，走 Task 5 的 e2e。

---

## §檔案結構規劃

### 改動的檔

| 路徑 | 動什麼 |
|---|---|
| `docs/index.html` | `<head>` 換字體 `<link>`（保留 `preconnect` 兩行、保留 inline 主題 script 位置、**保留 marked 與 references-data**）；`<body>` 換成 rail/stage/panel/detail/drawer 外殼 |
| `docs/css/styles.css` | 940 行整份取代為 demo 的 564 行，**扣掉 `1080px` 那條 `@media`**，**加上 hex fallback** |
| `docs/js/app.js` | 901 行整份取代為 demo 的 702 行為底，再做 Task 3 / Task 4 的回填 |
| `docs/favicon.svg` | 唯一的 `fill="#4040C4"` 換成新配色墨色 |

### 新建的檔

| 路徑 | 職責 |
|---|---|
| `docs/work/refactor/docs-site-redesign/verify/contract.mjs` | 零依賴 node 契約驗證器（C1–C17）。檔頭 docstring 自帶完整對照表，**不另建 README** |
| `docs/work/refactor/docs-site-redesign/source-rail-console.html` | 移植來源的入版控副本（`design-demos/` 被 gitignore，不留就追不回來） |
| `docs/work/refactor/docs-site-redesign/verify-F1-F22.md` | F1–F22 逐項驗證表（Task 5 填） |

### 不動的檔

`docs/js/data.js`、`docs/js/references-data.js`、`docs/js/layout.js`、`docs/js/vendor/*`、
`docs/reference/docs-site-baseline.md` 的 F1–F22 原文與「既有缺口」六條。
（C8a 用 `git diff --exit-code` 機械保證前三個。）

---

## Task 1: 契約驗證器 ＋ 移植來源入版控

**files**:
- create: `docs/work/refactor/docs-site-redesign/verify/contract.mjs`
- create: `docs/work/refactor/docs-site-redesign/source-rail-console.html`

> **本 task 不套 Step1/2 模板**（review K7）。v1 要求「先寫 4 行 selftest 再跑」，
> 但那時 `check()` / `read()` / `html`/`css`/`js` 都不存在，實跑只會拿到 `ReferenceError`，
> 不是 `FAIL SELFTEST`——那是假的紅。真正能跑的紅只可能在驗證器寫完之後。

- [ ] **Step 1: 複製移植來源進版控**

```bash
cp "docs/work/refactor/docs-site-redesign/design-demos/rail-console.html" \
   "docs/work/refactor/docs-site-redesign/source-rail-console.html"
git check-ignore -q docs/work/refactor/docs-site-redesign/source-rail-console.html \
  && echo "ERROR: 副本仍被 gitignore" || echo "OK: 副本可入版控"
```

- [ ] **Step 2: 寫驗證器**

實作 C1–C17。骨幹如下，`detail` 一律寫成「期望 X，實際 Y（後果：Z）」——
review M（DX）指出 v1 有 15 條只寫「F19 防 FOUC 依賴這個順序」這種**不含實際值**的訊息，
FAIL 時看不出哪裡錯。

```js
/**
 * docs 站契約驗證器（零依賴，只用 node 內建模組）。
 *
 * 為什麼要有這支：這個 repo 沒有 package.json、沒有 test runner，T3 的紅綠循環需要一個
 * 機械判定依據，否則「功能有沒有掉」只能靠肉眼。
 *
 * 契約與 F 項對照（本表是唯一說明文件，刻意不另建 README——review 指出分開放一定會漂移）：
 *   C1  file:// 相容（F14）        C2  防 FOUC 與屬性名（F19）
 *   C3  主題 localStorage key（F17） C4  八型別 token 值域與成對（F22）
 *   C5  prefers-reduced-motion==0（spec §已決事項 1）
 *   C6  NODE_DOCS key 集合／shape／能否命中 REFERENCE_DOCS（F12 F13 F14）
 *   C7  scaleExtent（F1）          C8  不動的檔與 REFERENCE_DOCS 筆數
 *   C9  F12/F14 四句原文           C10 vendor 與 references-data 載入（F13 F16）
 *   C11 骨架錨點                   C12 動畫語彙
 *   C13 三態 class／app.js 不寫顏色（F4 F22）
 *   C14 抽屜 DOM 與 .md 包裹       C15 @media 只有 860px（spec §已決事項 2）
 *   C16 docstring 密度             C17 無文件節點的 else 分支
 *
 * 刻意不測 F2 與 F21：v1 曾用 `/function fitView/` 當 F2 的契約，但 demo 的 fitView()
 * 內容就是 landingTransform()——函式名在、行為沒了，契約照樣綠。這兩項一律以 e2e 與
 * 人工驗收為準，見 verify-F1-F22.md。
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
const read = (p) => readFileSync(join(DOCS, p), 'utf8');

let failed = 0;
/**
 * 印一條檢查結果。
 * @param {string} name   契約編號與名稱
 * @param {boolean} ok    是否通過
 * @param {string} detail FAIL 時印的說明，格式固定為「期望 X，實際 Y（後果：Z）」
 */
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '\n        ' + detail}`);
  if (!ok) failed++;
}

const html = read('index.html');
const css = read('css/styles.css');
const js = read('js/app.js');
```

C1b 要**拆成兩種訊息**（review M：`indexOf` 回 -1 時 v1 會報「順序反了」，真因是「東西不存在」）：

```js
const iRef = js.indexOf('REFERENCE_DOCS');
const iFetch = js.indexOf('fetch(');
if (iRef === -1 || iFetch === -1) {
  check('C1b REFERENCE_DOCS 分支在 fetch 之前', false,
    `期望 app.js 同時有 REFERENCE_DOCS 與 fetch(，實際 REFERENCE_DOCS=${iRef !== -1}、fetch=${iFetch !== -1}` +
    `（後果：抽屜沒接上真資料，F13/F14 掉）`);
} else {
  check('C1b REFERENCE_DOCS 分支在 fetch 之前', iRef < iFetch,
    `期望內嵌分支在前，實際 REFERENCE_DOCS@${iRef} > fetch@${iFetch}（後果：file:// 會走到 fetch 然後失敗）`);
}
```

C4a 改成**值域**斷言（v1 只數宣告數，現況就是 32、永遠綠）：

```js
const cDecls = [...css.matchAll(/(--c-[a-z]+(?:-bd)?)\s*:\s*([^;]+);/g)];
const notOklch = cDecls.filter(([, , v]) => !v.trim().startsWith('oklch('));
check('C4a 八型別 token 值必須是 oklch', notOklch.length === 0,
  `期望 0 條非 oklch，實際 ${notOklch.length} 條：${notOklch.slice(0, 3).map(([, k]) => k).join(', ')}` +
  `（後果：配色沒換到，或混用了兩套色彩空間）`);
```

C6c 是**本輪 CP 值最高的新契約**——它是唯一能機械攔住「抽屜點下去空白」的檢查：

```js
/** demo 的 NODE_DOCS 用 {p,n,k}，p 沒有 references/ 前綴也沒有副檔名；
 *  REFERENCE_DOCS 的 key 是完整路徑。skill 補 /SKILL.md、agent 補 .md。 */
function docKey(entry) {
  return entry.k === 'agent'
    ? `references/${entry.p}.md`
    : `references/${entry.p}/SKILL.md`;
}
```

C13b 修掉 v1 的兩個 bug（只剝行首註解，避免吃掉 `'http://...'`；擴大顏色 pattern）：

```js
const jsNoComment = js
  .split('\n')
  .map((l) => l.replace(/^\s*\/\/.*$/, '').replace(/^\s*\*.*$/, ''))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const hardColors = jsNoComment.match(/oklch\(|rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b/g) || [];
check('C13b app.js 不寫顏色', hardColors.length === 0,
  `期望 0 個硬編色，實際 ${hardColors.length} 個：${[...new Set(hardColors)].slice(0, 5).join(' ')}` +
  `（後果：F22 的「顏色只由 --c-* token 經 [data-type] 驅動」被破壞，換主題時對不上）`);
```

C8a 用 git 取代 v1 那段死碼（review M8 實測 `win.dagre` 是 `undefined`，`buildLayout` 從未真的跑過）：

```js
try {
  execFileSync('git', ['diff', '--exit-code', '--',
    'docs/js/data.js', 'docs/js/layout.js', 'docs/js/references-data.js'],
    { cwd: join(DOCS, '..'), stdio: 'pipe' });
  check('C8a 三個不動的檔沒被改', true);
} catch {
  check('C8a 三個不動的檔沒被改', false,
    '期望 git diff 乾淨，實際有改動（後果：資料契約 84/103/15/8 可能已變）');
}
```

C16 用 AST-free 的粗估即可（目的是擋住「整段照抄時把 docstring 跳過」）：

```js
const docBlocks = (js.match(/\/\*\*/g) || []).length;
const namedFns = (js.match(/^\s*function\s+[A-Za-z_$]/gm) || []).length;
check('C16 docstring 密度', docBlocks >= namedFns,
  `期望 /** 區塊 >= 具名 function，實際 ${docBlocks} < ${namedFns}` +
  `（後果：違反 CLAUDE.md §程式註解「新 code 全寫」；改版前是 36/20）`);
```

末尾：

```js
if (process.argv.includes('--selftest')) {
  check('SELFTEST（刻意失敗）', false, '這條證明 fail 路徑會回非 0，驗證器不是永遠綠的');
}
console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 3: 證明 fail 路徑有效**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs --selftest; echo "exit=$?"
# Expected: 出現 FAIL SELFTEST，exit=1
```

- [ ] **Step 4: 跑基準，釘住起點（不留活口）**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs; echo "exit=$?"
```

現況（改版前）的**完整**預期狀態——v1 只列了 `grep` 撈出的幾條，
review 指出這會讓開發者分不清「計畫中的紅」與「我抄壞了」：

| PASS | FAIL（＝本次改版要轉綠的目標） |
|---|---|
| C1a C1b C2a C2b C3 C4b C5 C6a C6b C6c C7 C8a C8b C9 C10 C13a C17 | **C4a**（現況 32 條全是 hex，0 條 oklch）、**C11**（舊 DOM 無新錨點）、**C12**（linear=1 裸ease=8 曲線=0）、**C13b**（現況 3 個硬編 hex：`#FF6A00`/`#8080CC`/`#CCCCEE`）、**C14a/b/c**（舊抽屜用 `doc-drawer-*`）、**C15**（現況 `@media` 0 條，期望 1 條）、**C16**（現況 36 ≥ 20，PASS） |

> C16 現況其實是 PASS（36 ≥ 20）；它的紅會出現在 Task 2 剛照抄完 demo 的時候（13 < 25）。

- [ ] **Step 5: commit**

```bash
git add docs/work/refactor/docs-site-redesign/verify/ \
        docs/work/refactor/docs-site-redesign/source-rail-console.html
git commit -m "test: 加入 docs 站契約驗證器 C1-C17 與移植來源副本"
```

---

## Task 2: 三檔一次移植（單一 commit）

**files**:
- modify: `docs/index.html`、`docs/css/styles.css`、`docs/js/app.js`

> **為什麼合併成一個 task 一個 commit**（review K4）：v1 把三檔拆成 Task 2/3/4，
> 但 Task 2 換掉 `<body>` 之後，舊 `app.js` 取 `#legend-side` / `#flow-svg` / `#detail-panel`
> 全是 `null`，**頁面載入即 TypeError**；Task 3 只換 CSS，站仍是死的；要到 Task 4 才復活。
> 而契約在這期間還會逐條轉綠——「紅→綠」與「站能不能開」零相關。
> 三檔互相依賴（CSS 對著新 DOM 的 class、JS 對著新 DOM 的錨點），拆開的 commit 沒有可驗證意義。

- [ ] **Step 1: 確認紅**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs 2>&1 | grep -E '^(PASS|FAIL)  C(4a|11|12|13b|14|15) '
# Expected: FAIL C4a / C11 / C12 / C13b / C14a / C14b / C14c / C15
```

- [ ] **Step 2: index.html**

`<head>` 只改字體 `<link>` 一行，其餘**逐字保留**：

- 保留 `index.html:9-24` 的 inline 主題 script，位置維持在第一個 `<link rel="stylesheet">` 之前（F19 / C2a）
- 保留 `preconnect` 兩行（`:27-28`）
- **保留 `marked.min.js` 與 `references-data.js`**。demo 只載 d3 + dagre，
  照抄它的 `<head>` 會弄丟這兩個 → C10 紅、F13 掉。v1 寫「加回 marked」是錯的，它從來沒掉

`<body>` 換成 `source-rail-console.html` 的 `<div class="shell">…</div>` 全段。

- [ ] **Step 3: styles.css**

把 `source-rail-console.html` 第 13–576 行寫進 `docs/css/styles.css`，取代原本 940 行，並做三處修改：

1. **砍掉 `@media (max-width: 1080px)` 整塊**，保留 `@media (max-width: 860px)`（spec §已決事項 2）
2. **補 hex fallback**（spec §已決事項 4）。`:root` 與 dark 區塊各補一組同名 hex 前置宣告：

```css
:root {
  /* 舊瀏覽器 fallback：先 hex、後 oklch。不支援 oklch 的吃第一條，支援的被第二條覆蓋。
     沒有這組的話 Chrome <111 / Safari <15.4 會讓整份色票落空 —— 不是變醜，是看起來像壞掉。 */
  --paper: #F7F5F1;  --paper: oklch(0.972 0.006 85);
  --ink:   #2B2723;  --ink:   oklch(0.245 0.012 60);
  /* …八型別與其餘中性色同法 */
}
```

3. 檔頭註解**指向 archive 路徑**（review M14：指向 `docs/work/...` 的註解 merge 當下就 404）：

```css
/* dev-workflow flowchart explorer — rail-console 骨架 / 校樣配色 */
/* 設計定案、token 論證與動畫節奏見 docs/archive/2026/docs-site-redesign/spec.md */
/* 顏色只透過 [data-type="..."] 屬性選擇器套用；app.js 不寫任何顏色（F22 契約，見 C13b） */
```

**不得順手加**：`prefers-reduced-motion`（已決事項 1）、`tabindex` / `:focus-visible` 的
全面擴充（缺口 5 不修——Task 4 只補 rail 那四顆按鈕，那是新骨架自己引入的問題）。

- [ ] **Step 4: app.js**

把 `source-rail-console.html` 第 644–1345 行寫進 `docs/js/app.js`，取代原本 901 行。移植時：

1. **逐一補繁中 docstring**（C16）。demo 的 25 個具名 function 只有 13 個 `/**`；
   702 行全是新 code，CLAUDE.md §程式註解 要求「新 code 全寫」。改版前是 36 個 `/**` / 20 個 function
2. `NODE_DOCS` 與 `localStorage` key **先原樣帶入**，Task 3 / Task 4 才修
   （這樣 C3 / C6 的紅在 Step 5 看得見）

- [ ] **Step 5: 跑驗證器，對照完整預期狀態**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs; echo "exit=$?"
```

| 應轉綠 | 應仍紅（下游 task 的目標） |
|---|---|
| C4a C11 C12 C13b C15 C14a | **C1b**（demo 抽屜是假內容，`REFERENCE_DOCS` 與 `fetch(` 皆無）、**C3**（demo 是 `rail-console-theme`）、**C6a**（demo 多 `LoadDD`/`LoadDLang`、少 `RPT2`/`RPT3`）、**C6c**（`p` 尚未解成真 key）、**C9**（四句原文 demo 0 命中）、**C14b/c**（抽屜尚未接 marked） |

- [ ] **Step 6: 開起來看一眼（合併 commit 的最低自檢）**

```bash
python -m http.server 8080 --directory docs &
# 瀏覽器開 http://localhost:8080/ ：圖要畫出來、rail 四顆點得開、點節點 detail 要長出來
```

- [ ] **Step 7: commit**

```bash
git add docs/index.html docs/css/styles.css docs/js/app.js
git commit -m "refactor: docs 站換成 rail-console 骨架與校樣配色"
```

---

## Task 3: NODE_DOCS 正規化 ＋ 抽屜接真 REFERENCE_DOCS

**files**: modify `docs/js/app.js`

> **v1 嚴重低估了這個 task**（review K6）。v1 寫「從現況 app.js 搬回三個函式、接進 demo 的
> drawer DOM」，但實查：demo 是 `openDrawer(nodeId)` 不是 `openDrawer(docPath, docName)`；
> v1 引用的 `drawerBreadEl` / `drawerHeaderEl` / `drawerBodyEl` 在 demo **各命中 0**
> （demo 的 drawer 是 `drawerEl.innerHTML = ...` 整塊重建）；兩邊 class 零交集。
> 照 v1 做，C14 全綠、交付一個沒有樣式的文件面板。

- [ ] **Step 1: 確認紅**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs 2>&1 | grep -E '^(PASS|FAIL)  C(1b|6a|6b|6c|9|14) '
# Expected: FAIL C1b / C6a / C6c / C9 / C14b / C14c
```

- [ ] **Step 2: NODE_DOCS 正規化**

統一成 demo 的 `{p, n, k}` shape（**不是** v1 那個 `{path, name}` 混血），並：

- 刪掉 demo 自行加的 `LoadDLang` / `LoadDD`（spec §範圍：缺口 1 不修。
  且缺口 2 表示 `references-data.js` 沒有這兩份的內嵌全文，加了反而讓節點點出「載入失敗」）
- 補回 `RPT2` / `RPT3`，**用 demo 的 shape**：

```js
RPT2: { p: 'skills/review-plan', n: 'review-plan (T2 Eng-only)', k: 'skill' },
RPT3: { p: 'skills/review-plan', n: 'review-plan (T3 四視角)',   k: 'skill' },
```

- [ ] **Step 3: 寫 path → REFERENCE_DOCS key 轉換**

demo 從未把 `p` 解成真 key（它的抽屜是假內容，只拿 `p` 組顯示字串）。實查兩種後綴不同：

```js
/**
 * 把 NODE_DOCS 的 p 解成 REFERENCE_DOCS 的 key。
 * skill 的實體是 <dir>/SKILL.md、agent 的實體是 <name>.md，兩者後綴不同，
 * 解錯的後果是抽屜點下去空白且不報錯（C6c 就是為了攔這個）。
 * @param {{p:string, k:string}} entry
 * @returns {string}
 */
function docKey(entry) {
  return entry.k === 'agent'
    ? 'references/' + entry.p + '.md'
    : 'references/' + entry.p + '/SKILL.md';
}
```

- [ ] **Step 4: 重寫抽屜 DOM ＋ 接真資料**

保留 demo 的 class 與 `.md` 包裹（C14a/C14b），把資料源換成真的：

```js
var key = docKey(d);
var inlined = window.REFERENCE_DOCS && window.REFERENCE_DOCS[key];
var textPromise = inlined != null
  ? Promise.resolve(inlined)
  : fetch(key).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });

textPromise.then(function (text) {
  var parsed = parseFrontmatter(text);
  var cleanBody = parsed.body.replace(/^#\s+.+\n?/, '').trim();
  drawerEl.querySelector('.md').innerHTML = window.marked.parse(cleanBody);
}).catch(function (e) {
  drawerEl.querySelector('.md').innerHTML =
    '<div class="drawer-error">載入失敗：' + esc(e.message) + '</div>';
});
```

從現況 `app.js` 搬回 `parseFrontmatterDesc()`（`:79-90`）與 `parseFrontmatter()`（`:98-127`）
兩個純函式，**邏輯不改**（它們是 F12 / F13 的實作），並補 docstring。

detail panel 的文件摘要（F12）四句原文原樣：`載入中⋯` → `（無描述）` / `（載入失敗）`；
抽屜失敗是 `載入失敗：`。四句**一字不改**（C9）。

**必須保留**：demo 對 51 個無文件節點的 else 分支（`無獨立文件` ＋
「此節點是流程步驟本身，規則寫在 CLAUDE.md 或上游 skill 內。」＋**不產生死按鈕**）。
這比舊站（整段不出現）好，C17 守它。

- [ ] **Step 5: 跑驗證器**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs 2>&1 | grep -E '^(PASS|FAIL)  C(1b|6a|6b|6c|9|14|17) '
# Expected: 全 PASS。C3 仍紅（Task 4 的目標）
```

- [ ] **Step 6: commit**

```bash
git add docs/js/app.js
git commit -m "fix: NODE_DOCS 正規化並把文件抽屜接回內嵌 REFERENCE_DOCS"
```

---

## Task 4: 殘留、識別與可及性

**files**: modify `docs/js/app.js`、`docs/index.html`、`docs/favicon.svg`

- [ ] **Step 1: 確認紅**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs 2>&1 | grep -E '^(PASS|FAIL)  C3 '
# Expected: FAIL C3 — 期望 dev-workflow-theme，實際 [rail-console-theme]
```

- [ ] **Step 2: 主題 localStorage key**

demo 的 `'rail-console-theme'` 全部改回 `'dev-workflow-theme'`。
不改的話，所有現有訪客存過的主題偏好會被當成沒設定過、全部退回 auto。

- [ ] **Step 3: favicon**

`docs/favicon.svg` 唯一的 `fill="#4040C4"` 換成新配色墨色（`--ink` 的 hex 近似值）。
改版後它會是全站唯一還帶舊 periwinkle 藍的東西，而且就在瀏覽器分頁上。

- [ ] **Step 4: rail 可及性（新骨架自己引入的問題，不是缺口 5）**

實測 demo 的命中區**已經是 44×44**（`:159-160`）、hover 名牌**已經有**（`:174-187`），
spec 原本寫的「擴大命中區」是誤判。真正缺的是兩條：

```css
/* 名牌只綁 :hover，鍵盤 Tab 到「型」永遠看不到它是什麼 */
.rail-btn:focus-visible::after { /* 套用與 :hover::after 相同的 opacity / transform */ }
```

```html
<!-- data-label 不進可及性樹，螢幕閱讀器讀到的就是單字「型」 -->
<button class="rail-btn" data-sec="type" aria-label="節點型別" ...>型</button>
```

四顆分區鈕（型／段／環／檔）＋ 兩顆功能鈕（置／自）都要補 `aria-label`。

> **這不算修缺口 5**。缺口 5 講的是「SVG 節點是 `<g>`、不可 focus、不能用鍵盤選取」，
> 那個維持不修。這裡補的是**新骨架把常駐清單換成單字 rail 之後才產生的**新問題。

- [ ] **Step 5: 跑驗證器（應全綠）**

```bash
node docs/work/refactor/docs-site-redesign/verify/contract.mjs; echo "exit=$?"
# Expected: ALL PASS，exit=0
```

- [ ] **Step 6: commit**

```bash
git add docs/js/app.js docs/index.html docs/favicon.svg
git commit -m "fix: 回填主題 key、換 favicon 配色、補 rail 可及性標籤"
```

---

## Task 5: F1–F22 驗證表 ＋ user 視覺驗收 ＋ rollback 記錄

**files**:
- create: `docs/work/refactor/docs-site-redesign/verify-F1-F22.md`
- modify: `docs/reference/docs-site-baseline.md`（**append-only**）

- [ ] **Step 1: 建空表**

22 項全填 `⬜ 未驗`，另開兩節：「**預先宣告的改動說明**」與「**新增功能**」。

**預先宣告 6 項改動說明**（spec §已決事項 0 / 3 / 4）——v1 只宣告 F2 一項，
review 指出實作者對表時 F8/F16 的前半段描述對得上、很容易誤打 ✅：

| F | 改版前 | 改版後 |
|---|---|---|
| F2 | 整圖 fit（實算 8.1%） | 對齊起點的可讀比例；**fit-all 能力移除** |
| F8 | 350ms；縮放 <0.35 拉到 0.35 | **560ms**；下限 **0.85** |
| F16 | minimap 點擊 180ms | **320ms** |
| F17 | 三顆 SVG icon | 「自 / 明 / 暗」單字 |
| F21 | 三句提示原文 | `renderStatus()` 三種狀態行（原文的超集） |
| — | 站名 `bastck`（`app.js:697`） | 頁首改為 `dev-workflow`（主題名） |

**新增功能**（demo 夾帶、非 F 項）：rail 的「文件索引」瀏覽面板、panel 的「釘」鈕、
`@media (max-width: 860px)` 的防重疊。三者都要單獨驗，不混進 F 表。

- [ ] **Step 2: 確認全未驗**

```bash
grep -c '⬜ 未驗' docs/work/refactor/docs-site-redesign/verify-F1-F22.md
# Expected: 22
```

- [ ] **Step 3: 三軌驗證**

1. **契約**：`node docs/work/refactor/docs-site-redesign/verify/contract.mjs` → 填 C 系列涵蓋的項
2. **e2e**：起 `python -m http.server 8080 --directory docs`，載 `frontend-test`
   → spawn `frontend-e2e-runner` 跑行為項（F3 F5 F6 F8 F10 F11 F15 F16 F18，
   ＋ **F2 與 F21 一律以此為準**）。
   Playwright MCP 擋 `file://`，所以行為驗證只能走 http
3. **人工 `file://`**：直接開 `file:///D:/GitHub/bstack/docs/index.html`。
   這是 F14 唯一真正的驗證方式——http 驗不到 `file://` 專屬的失敗模式

**填表規則**：
- 行為與改版前一致 → ✅
- 在 Step 1 預先宣告的 6 項 → **改動說明**（附 spec §已決事項 連結）
- **未預先宣告卻不一致 → ❌，停止收尾、回 Task 2–4 修**
- 六條既有缺口 → 標「既有缺口，未修（依 user 指示）」，不算 ❌

- [ ] **Step 4: user 視覺驗收 gate（v2 新增，review K8）**

契約與 e2e 都不驗「這是不是 user 選的那個設計」。這件事的本質是「把 user 選定的 demo 搬到正式站」，
**唯一真正的驗收標準是 user 打開瀏覽器說「對，就是這個」**。

```bash
python -m http.server 8080 --directory docs
# 請 user 開 http://localhost:8080/ 對照 source-rail-console.html
```

走 `AskUserQuestion`：驗收通過 ／ 有落差（列出來，回 Task 2 修）。
**未通過不得進 finish-branch。**

- [ ] **Step 5: 記錄 rollback 路徑**

merge 即上線、無預覽環境，所以要先寫下退路：

```bash
git rev-parse origin/main   # 記進 verify-F1-F22.md
# 壞了就 git revert <squash commit>，即回舊站
```

- [ ] **Step 6: 確認表填完且無 ❌**

```bash
grep -c '⬜ 未驗' docs/work/refactor/docs-site-redesign/verify-F1-F22.md   # Expected: 0
grep -c '❌' docs/work/refactor/docs-site-redesign/verify-F1-F22.md        # Expected: 0
```

- [ ] **Step 7: commit**

```bash
git add docs/work/refactor/docs-site-redesign/verify-F1-F22.md docs/reference/docs-site-baseline.md
git commit -m "docs: 補 F1-F22 改版後逐項驗證結果"
```

---

## §並行性分析

**serial，無 parallel-group。**

v1 標了 `parallel-group: 1..7` 但每組各一個 task——那等於沒有 group 概念，
還可能讓 execute-plan 誤判要載 `dispatch-parallel`。v2 直接標 serial。

| task | 為何不能與前一個並行 |
|---|---|
| 1 | 驗證器 ＋ 來源副本，唯一不碰 `docs/` 產品檔的 task |
| 2 | 三檔互相依賴，**合併成一個 commit**（K4） |
| 3 | 同檔 `app.js` |
| 4 | 同檔 `app.js` |
| 5 | 依賴全部完成 |

**因此不觸發 `dispatch-parallel`，沒有 Agent Teams 判定點**——
CLAUDE.md §協作模式判定 的觸發點只有「execute-plan 遇 parallel-group 同號多 task」，本 plan 沒有。

---

## §Self-review

**1. spec coverage**——v1 只對了 5 條 success criteria、**沒對 §範圍**（review CEO 抓到）。v2 兩者都對：

| spec 項目 | 對應 |
|---|---|
| SC① F1–F22 逐項填表 | Task 1（C1–C17）＋ Task 5（e2e ＋ 人工 ＋ 填表） |
| SC② `file://` 可運作 | C1a / C1b / C10 ＋ Task 5 Step 3 第 3 點人工實開 |
| SC③ 屬性名不改、inline script 在 CSS 前 | C2a / C2b |
| SC④ 視覺明顯改版 | Task 2（版面 ＋ 字體階層）＋ C12（動態語彙）＋ Task 5 Step 4 user 驗收 |
| SC⑤ 動畫非 linear／非裸 ease | C12 |
| §範圍 包含：`styles.css` | Task 2 Step 3 |
| §範圍 包含：`index.html` | Task 2 Step 2 |
| §範圍 包含：`app.js` | Task 2 Step 4、Task 3、Task 4 |
| §範圍 包含：`design-map.md` | **已完成**（commit `6863a69`），無對應 task |
| §範圍 包含：`favicon.svg` | Task 4 Step 3 |
| §範圍 包含：baseline append-only | Task 5 Step 7 |
| §範圍 排除：六條缺口不修 | C5（`prefers-reduced-motion`）機械守住；缺口 4 由 C15 限制成「只有 860px 一條」；其餘在 Task 2 Step 3 與 Task 4 Step 4 明文寫「不得順手加」 |
| §已決事項 0 F2 | Task 5 Step 1 預先宣告；**不設契約**（K5 的教訓） |
| §已決事項 1 reduced-motion | C5 |
| §已決事項 2 `@media` | C15 ＋ Task 2 Step 3 |
| §已決事項 3 五項改動說明 | Task 5 Step 1 |
| §已決事項 4 三個殘留項 | Task 2 Step 3（fallback）＋ Task 4 Step 3（favicon）＋ Task 5 Step 1（`bastck`）|

**2. placeholder 掃**：無 `TBD` / `TODO` / `稍後實作`。

**3. 型別一致**：`check(name, ok, detail)` 三參數全篇一致；`docKey(entry)` 在 C6c 與 Task 3 Step 3
是同一個定義；`{p, n, k}` shape 在 Task 3 全篇一致（v1 的 `{path, name}` 混血已刪）。

**4. 並行性檢查**：已逐項列出依賴理由。

**5. scope 檢查**：超出 spec 原文的只有 **Task 1 的驗證器與來源副本**。
理由是 T3 需要紅綠依據而這個 repo 零測試設施；兩者都限制在 `docs/work/` 底下、
merge 時隨 work 目錄進 archive，不變成常設資產。

---

## §hand-off state

```yaml
state:
  plan_path: docs/work/refactor/docs-site-redesign/plan.md
  review_summary_path: docs/work/refactor/docs-site-redesign/review.md
  parallel_groups: []        # serial
  task_count: 5
  current_phase: write-plan-done（v2，已納入 review-plan 四視角結果）
```

**下一 phase**：`execute-plan`
