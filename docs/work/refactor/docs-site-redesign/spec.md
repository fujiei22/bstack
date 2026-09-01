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

三個 subagent 獨立 context 平行產版，各自分到一個結構維度：

| 版 | 方向名 | 骨架維度 | 一句話差異 |
|---|---|---|---|
| A | `rail-console` | 導航 | 56px 直立 rail，四個分區點了才彈出浮動面板、關掉就消失；右緣直幅索引條 |
| B | `docked-inspector` | 內容區結構 | 左欄切成型別／階段／環境三分頁；detail 改成貼底可拉高的橫向 inspector |
| C | `editorial-atlas` | 構圖 | 報頭帶 ＋ 01-15 章節序號目錄 ＋ 雙框裱起的畫布（上有圖版標題帶、下有圖註） |

**三版的配色與字體撞車**——都推導到「印刷打樣紙 ＋ 校對紅 ＋ Newsreader」，A 與 C 的字型堆疊
甚至字字相同（`Newsreader` + `IBM Plex Sans` + `IBM Plex Mono`），三版紙底明度都落在
0.968–0.972、強調色都是色相 28–32。三個獨立 context 從同一份內容推出同一套色，推導各自
合規，但差異化失效。因此 user 選定骨架後**另出兩套配色套在同一骨架上**
（產出行數 1348 = 1348，證明骨架一字未動）：

| 套 | 名稱 | 底色 | 強調色相 | 字型配對邏輯 |
|---|---|---|---|---|
| P1 | 校樣 | 暖紙 `oklch(0.972 0.006 85)` | 28（校對紅） | 襯線 display × 無襯線 body |
| P2 | 終端磷光 | 冷機殼灰 hue 250 | 205（CRT 青磷光） | 等寬 display × 無襯線 body |
| P3 | 藍曬工程圖 | 冷白微青 hue 225，墨為普魯士藍 | 350（修訂章紫紅） | grotesque display × 襯線 body |

- `direction_decided`：**骨架 A `rail-console` ＋ 配色 P1「校樣」**（即 A 版原始產出，未經配色替換）
- `user_choice_quote`：骨架 —「A rail-console（導航）」；配色 —「P1 校樣（暖紙 + 校對紅）」
- 資產清單：**無**。本設計不含任何具名第三方品牌或圖片素材，未走 `brand-asset-protocol.md`。

### 定案設計的可重建規格

> **這一節是唯一的長期記錄。** `design-demos/` 被 `.gitignore` 的 `**/design-demos/` 排除、
> 不進版控，merge 時連同截圖一併刪除。實作期間 `design-demos/rail-console.html` 是逐字對照
> 的基準，但**它不會留到 merge 之後**——所以設計本身必須寫在這裡，不能靠指向那個檔。

**版面骨架**

- 左緣 `--rail-w: 56px` 直立 rail：品牌標記 ＋ 四個分區入口（型別／階段／環境／文件）＋ 底部主題鈕
- 分區面板 `--panel-w: 306px`，點 rail 入口才滑出、再點或點別處收起；
  收起時流程圖佔滿 rail 以外的全部視口
- 右緣**直幅**索引條，取代原本 176×128 的橫向 minimap——這張圖縱橫比 0.172，
  橫框只會把它畫成一條約 20px 的細線
- detail panel 由右側滑入；文件抽屜 ＋ backdrop 維持覆蓋層

**色彩（P1「校樣」，全部 oklch，格式 `L / C / H`）**

- 中性序列（紙 → 墨，暖向 hue 60-85）：
  `--paper 0.972/0.006/85`、`--paper-sunk 0.941/0.008/85`、`--surface 0.995/0.003/85`、
  `--ink 0.245/0.012/60`、`--ink-2 0.455/0.012/60`、`--ink-3 0.575/0.011/60`、
  `--rule 0.878/0.008/70`、`--rule-2 0.800/0.010/70`
- 強調（校對紅筆）：`--accent 0.545/0.180/28`，另有 `--accent-ink`、
  `--accent-wash`（同色 10% alpha）、`--accent-line`（同色 34% alpha）
- 圖的線：`--edge 0.680/0.020/70`、`--edge-dim 0.890/0.010/70`
- 八型別（`--c-<type>` 填色 ／ `--c-<type>-bd` 邊框），light：

  | type | 填色 | 邊框 |
  |---|---|---|
  | default | 0.945/0.006/85 | 0.660/0.016/85 |
  | skill | 0.925/0.055/152 | 0.575/0.115/152 |
  | agent | 0.925/0.050/248 | 0.580/0.125/248 |
  | gate | 0.930/0.070/92 | 0.620/0.135/92 |
  | impl | 0.925/0.048/305 | 0.580/0.120/305 |
  | policy | 0.930/0.012/265 | 0.600/0.030/265 |
  | hook | 0.928/0.062/58 | 0.615/0.135/58 |
  | stop | 0.925/0.055/24 | 0.565/0.155/24 |

- dark（`:root[data-theme="dark"]`）：`--paper 0.185/0.008/65`、`--ink 0.932/0.008/80`、
  `--accent 0.700/0.150/32`；八型別填色統一 L≈0.30、邊框 L≈0.50–0.70，**色相不變**
- **色彩論證**（`design-styles.md` §色彩推導協議 第 3 步）：主色取自校對紅筆，chroma 0.180
  只用在小面積；大面積底色 chroma ≤0.008，借印刷紙的物理灰度換掉螢幕螢光感。
  dark 是**暖炭黑**而非深藍，刻意避開反 slop 清單的「均勻深藍底 ＋ 青紫霓虹」

**字體**

- `--font-display`：`"Newsreader", "Noto Serif TC", "Songti TC", "PMingLiU", serif`
- `--font-body`：`"IBM Plex Sans", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`
- `--font-mono`：`"IBM Plex Mono", "Noto Sans TC", "PingFang TC", monospace`
- 西文在前、繁中在後（fallback 鏈是逐字元比對）；全域 `font-synthesis: none`、`line-break: strict`
- 配對邏輯：形式對比（襯線 display × 無襯線 body）
- 三者皆不在 `typography.md` §已被用爛名單 上；Newsreader 是該表指名的 Fraunces 正牌平替。
  **現有站台用的 `Space Grotesk` 本身就在那份名單上**（「科技感的偷懶答案」），
  這是換字體的獨立依據，不是我單方面的主張

**動畫節奏**

- 三檔時長：`--t-micro 120ms` ／ `--t-panel 260ms` ／ `--t-large 380ms`
- 四條曲線：
  `--e-enter cubic-bezier(.16,.84,.44,1)`（進場減速）、
  `--e-exit cubic-bezier(.55,.02,.86,.30)`（離場加速）、
  `--e-move cubic-bezier(.33,.10,.25,1)`、
  `--e-snap cubic-bezier(.34,1.28,.48,1)`（帶回彈）
- **同一元素進場與離場用不同曲線**——這是「流暢自然」的主要來源，不是把時長拉長
- 全檔 **0 個 `linear`、0 個裸 `ease`**（`visibility 0s linear` 這種零時長慣用法不算）
- 具名細節：rail 活躍指示條用 `--e-snap` 在按鈕間滑動；面板清單逐項 22ms 錯開進場、
  收起時整塊走；選取邊的跑馬燈用 `steps(6)` 電報式節拍而非 linear 爬行

**待實作時處理的可用性修正（不改骨架）**

- rail 的「型／段／環／檔」單字直排過於隱晦 → hover 展開全名 ＋ 擴大命中區

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

0. **F2 初始視圖：改成對齊起點的可讀比例，fit-all 移到按鈕。**
   user 選項原話：「改成對齊起點、可讀比例，fit-all 移到按鈕（推薦）」。
   依據（**實測**，非推斷）：以 stock dagre 參數跑 `buildLayout` 得 `gw 1925 × gh 11196`、
   縱橫比 **0.172**。baseline F2 的「整張圖置中、留 8% padding」在 1920×1080 視口算出
   scale = **8.1%**，`NODE_H` 80px 的節點只會畫成 **6.5px** 高，一個字都讀不到。
   三個 subagent 各自量測後都獨立把它改掉了。
   → **F2 的能力不刪**：fit-all 移到標題列按鈕，索引條也仍可用；只是不再是預設。
   → 驗證表上這條標「**改動說明**」而非 ✅，不假裝沒動過。


1. **`prefers-reduced-motion`：一律不加。**
   user 選項原話：「一律不加，嚴格照原指示」。
   已向 user 說明代價：改版後動畫量比現在多，開了系統「減少動態效果」的使用者（前庭功能失調 /
   偏頭痛 / 暈動症）會拿到比改版前更多的動畫，且是本次改版主動加的。user 在知情後維持原指示。
   → **實作端硬規則**：`docs/css/styles.css` 改版後 `grep -c 'prefers-reduced-motion'` 必須仍為 **0**。
   缺口 6 維持未修狀態。

## 待釐清

1. **字體要不要換？** baseline 標「可換」。Space Grotesk / Space Mono 是現有識別的一部分，
   換掉視覺差異最大、但也離現況最遠。→ 由三方向具體提案，user 挑版時一併定案。
