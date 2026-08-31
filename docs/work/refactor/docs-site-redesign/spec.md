# docs 站整站換設計風格

> Track: Dev | Tier: T3 | 建立: 2026-08-31 | Branch: `refactor/docs-site-redesign`

## 動機 / Why

`https://fujiei22.github.io/bstack/`（GitHub Pages，來源 `main:/docs`）目前是 blueprint monochrome
風格：白底 + 單一 periwinkle 藍、全站 `border-radius: 0` 方角、14 條 transition 全部 `.1s`／`.15s`
的線性硬切。功能完整但視覺與動態偏「工程草稿」。

user 要的是**更有設計感、動畫流暢自然**，同時**功能與互動一項都不能掉**。

## 目標 / Success criteria

1. **F1–F22 全數通過**，逐項對照 `docs/reference/docs-site-baseline.md` 填 ✅／❌／改動說明。
2. `file://` 直接開啟仍可完整運作（不得引入 build step、不得引入需要 HTTP 的資源載入路徑）。
3. `data-theme` / `data-theme-mode` 兩個屬性名維持不變，防 FOUC 的 inline script 仍在 CSS 之前執行。
4. 視覺明顯改版（不是換色而已）：版面層級、字體階層、動態語彙三者都要有可指認的差異。
5. 動畫「流暢自然」可驗：緩動曲線非 `linear`／非預設 `ease`，狀態轉換有明確的進入與離開。

## 範圍 / Scope

**包含**：
- `docs/css/styles.css` — 940 行整份重寫（含兩套主題色值）
- `docs/index.html` — `<head>` 的字體載入、`<body>` 結構如需調整
- `docs/js/app.js` — SVG 渲染細節（node/edge 幾何、marker、minimap）與動畫時序
- `docs/reference/design-map.md` — 新建（design-language 首次偵測產出）
- `docs/reference/docs-site-baseline.md` — **只在末尾追加驗證結果欄**，不改 F1–F22 原文

**排除**（明寫避免 scope creep）：
- **`docs/reference/docs-site-baseline.md` §既有缺口 的 6 條一律不修**。user 明確指示：修了會讓
  「功能有沒有掉」的比對變髒。這 6 條分別是 NODE_DOCS 缺 design-language/design-direction、
  build-references.ps1 不在 repo、`?v=` 版本切換 no-op、零響應式、鍵盤可及性只有 ESC、
  無 `prefers-reduced-motion`。
  > 第 6 條（`prefers-reduced-motion`）與本次「動畫流暢自然」的目標直接對撞——改版會**增加**
  > 動畫量。已就此獨立詢問 user，決定為 **一律不加**（見「已決事項」1）。
- `app.js:686` 硬編的 app 標題 `bastck`（疑似 `bstack` 拼錯）。不在 6 條缺口內，但同理會弄髒
  比對，**照抄不改**。
- `docs/js/data.js`（84 nodes / 103 edges 的內容）、`docs/js/references-data.js`（202KB 內嵌全文）、
  `docs/js/layout.js`（dagre 參數）、`docs/js/vendor/*` 三個 lib——一律不動。
- 不換框架、不引入 bundler、不引入 CDN JS。

## 影響檔案 / Codebase impact

| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `docs/css/styles.css`（940 行） | 整份 rewrite | **高**。F4／F22 的高亮與節點配色全靠這裡的 `--c-*` token × `data-type` 屬性選擇器；改壞 = 8 種型別 × light/dark 兩套全爛 |
| `docs/js/app.js`（901 行） | 局部 edit | **高**。`HL_COLOR` / `EDGE_CLR` / `DIM_CLR` 三個常數是 JS 硬編（`app.js:21-23`），同時餵給 `defArrow()` 的 marker fill 與 `applyHighlight()` 的 stroke。CSS 改色而 JS 沒跟 = 邊與箭頭對不上 |
| `docs/index.html`（74 行） | 局部 edit | **中**。`<head>` 的 inline theme script 順序不能動（F19）；vendor script 為 classic、順序有依賴 |
| `docs/reference/design-map.md` | new | 低 |
| `docs/reference/docs-site-baseline.md` | append-only | 低 |

### 不可破壞的資料契約（實測確認）

實跑 `docs/js/data.js` 取得，與 baseline 記載一致：

| 項 | 實測值 |
|---|---|
| nodes | 84 |
| edges | 103（solid 98 / dashed 5；有 label 者 55） |
| phases | 15 |
| node types | 8（default 20 / skill 22 / impl 14 / agent 11 / gate 9 / policy 4 / hook 2 / stop 2） |
| ambient | 2 組（policy 9 項純文字 / skill 5 項可點開 drawer） |
| `NODE_DOCS` | 31 筆（25 skill + 6 agent，另 RPT2 / RPT3 指回 review-plan） |
| `REFERENCE_DOCS` | 31 個內嵌 key |
| `window.FLOW_DATA_VERSIONS` | **`undefined`**（缺口 3 屬實，`pickFlowData()` 永遠 fallback） |

顏色的傳遞路徑（改版必須維持）：
`styles.css` 的 `--c-*` token → CSS 依 `.node-rect[data-type="..."]` / `.mm-node[data-type="..."]` /
`:is(.legend-side .legend-item .swatch, .detail-panel .badge)[data-type="..."]` 匹配 →
`app.js` 只負責在元素上寫 `data-type` 屬性，**不寫任何顏色**（除上述三個常數）。

## 設計方向（`design.involved=true`）

- 區塊（`scope`）：**文件站**　依據（`scope_evidence`）：`docs/css/styles.css`
- 地圖狀態（`map_status`）：`pending` → 本 branch 已落 `docs/reference/design-map.md`，轉 `ok`
- `size`：**大改**（整站改版，需要新的版面結構與視覺語言；**非**由 Tier 推導）
- `precedent`：true

### 設計語言摘要（exact values，抄自實際檔案）

| # | 類別 | 值 | 來源 |
|---|---|---|---|
| 1 | 色彩 token | `--bg #FFFFFF` / `--panel-bg #FFFFFF` / `--text #1A1A6E` / `--text-soft #6666AA` / `--border rgba(64,64,196,.20)`；blue scale `--blue-50 #F2F2FF` → `--blue-900 #1A1A6E`；8 組 node type 對（如 `--c-skill #DFFAEB` / `--c-skill-bd #3A9157`）；`--hl-ring #FF6A00` | `styles.css:4-43` |
| 2 | 字體 | display+body `'Space Grotesk'` 300/400/500/600，fallback `ui-sans-serif, system-ui, "Noto Sans TC", "Microsoft JhengHei", sans-serif`；mono `'Space Mono'` 400/700/400i。Google Fonts CDN | `index.html:29`、`styles.css:110-115` |
| 3 | 間距 scale | **無 token**，硬編 px；實際落點 1/2/3/4/5/6/8/10/12/14/16/18/20/28 | 全檔 |
| 4 | 圓角 / 陰影 | `border-radius: 0` 共 13 處（全站方角，blueprint 語彙）；SVG `rx` 2（node）/ 3（edge label bg）/ 4（mm-node）。**全檔唯一陰影** `drop-shadow(0 0 6px rgba(255,106,0,.28))` | `styles.css:626` |
| 5 | 斷點 | **N/A**（依據：`grep -c '@media\|@container' docs/css/styles.css` = **0**） | — |
| 6 | dark mode | `:root[data-theme="dark"]` 屬性選擇器；第二套值 47 行 | `styles.css:47-79` |
| 7 | 表單慣例 | **N/A**（依據：`grep -cE '<input\|<form\|<select\|<textarea'` 在 `index.html` 與 `app.js` 皆 = **0**） | — |

框架 / CSS 方案：**無框架**（classic script，無 build step）/ **單一外部 stylesheet**

### 現有動態語彙（改版要換掉的東西）

- `transition` / `animation` 宣告共 **14** 條
- 絕大多數是 `.1s ease` / `.15s ease`（硬切感的來源）；drawer 是 `.22s ease`
- 唯一 keyframes：`@keyframes march { to { stroke-dashoffset: -12; } }`，`.6s linear infinite`（F4 跑馬燈）
- JS 側動畫：`panToNode()` 350ms（F8）、minimap 點擊 180ms（F16），皆用 d3 預設緩動

### 三方向（`size=大改` 且第 3 題選「出三版」）

- `direction_decided`：**待填**
- `user_choice_quote`：**待填**
- 資產清單：**待填**

> 三方向的 HTML 與截圖落在 `docs/work/refactor/docs-site-redesign/design-demos/`，
> 該路徑被 `.gitignore` 的 `**/design-demos/` 排除、不進版控，驗完即刪。
> **不得以截圖路徑作為事後追溯依據**——能留下的只有上面三項文字。

## DB 影響

無。本 task 不涉任何資料庫（`grep` 全 `docs/` 無 SQL / mysql / schema 相關）。

## 風險與 trade-off

1. **無預覽環境**（memory `project_docs_site_is_public_github_pages`）：`main:/docs` 是 GitHub Pages
   來源，**squash merge 的那一刻即公開上線**。feature branch 期間只能本機起 http server 預覽
   （Playwright MCP 擋 `file://`，人用瀏覽器可直接開）。
   → 對策：merge 前必須跑完 F1–F22 逐項驗，不靠 merge 後補救。
2. **`file://` 相容是硬約束、且容易在改版時無聲破壞**：任何 `fetch()`、ES module `import`、
   CSS `@import` 遠端資源，在 `file://` 下都會失敗且**不一定報錯**（F14 目前靠 `REFERENCE_DOCS`
   內嵌避開）。→ 對策：驗證矩陣必含一輪真正的 `file://` 手開。
3. **JS 硬編顏色與 CSS token 的雙軌**：`HL_COLOR` / `EDGE_CLR` / `DIM_CLR` 在 JS，其餘在 CSS。
   改版若只改 CSS，邊與箭頭會與新配色脫節；若把三者搬進 CSS 則要處理 SVG `<marker>` 無法繼承
   `currentColor` 的限制。→ 這是實作決策，留給 write-plan 拆。
4. **動畫增量 vs 無 `prefers-reduced-motion`**：見「待釐清」。
5. **改版與缺口的邊界容易模糊**：例如「加響應式」既是缺口 4 也很像設計感的一部分。
   → 本 spec 明定：缺口 4「零響應式」**不修**，改版產出在桌面寬度下驗；窄視窗行為維持「未定義」。

## 已決事項

1. **`prefers-reduced-motion`：一律不加。**
   user 選項原話：「一律不加，嚴格照原指示」。
   已向 user 說明代價：改版後動畫量比現在多，開了系統「減少動態效果」的使用者（前庭功能失調 /
   偏頭痛 / 暈動症）會拿到比改版前更多的動畫，且是本次改版主動加的。user 在知情後維持原指示。
   → **實作端硬規則**：`docs/css/styles.css` 改版後 `grep -c 'prefers-reduced-motion'` 必須仍為 **0**。
   缺口 6 維持未修狀態。

## 待釐清

1. **字體要不要換？** baseline 標「可換」。Space Grotesk / Space Mono 是現有識別的一部分，
   換掉視覺差異最大、但也離現況最遠。→ 由三方向具體提案，user 挑版時一併定案。
