# bstack docs 站 · 功能與互動基準

> 抽取時點：**改版前**，main 於 `9c59c3e`（設計 lane 整合 merge 後）。
> 用途：任何一次 docs 站改版（含全面換設計風格）都以本表逐項對照，證明「功能與互動沒掉」。
> **改版後才抽的清單沒有意義**——那只會記錄改版後的樣子。本表刻意在改版前抽。

## 技術現況

| 項 | 現況 | 改版可不可以動 |
|---|---|---|
| 框架 | **無**。classic script，無 build step、無 bundler | 可以換，但換掉等於引入 build step，要先講 |
| vendor | `d3.min.js` / `dagre.min.js` / `marked.min.js`，**本地檔**、離線可用 | 換掉要說明替代方案 |
| 執行方式 | `file://` 直接開得起來（`references-data.js` 把 markdown 內嵌就是為了這個） | **不可破壞**（見 F14） |
| 字體 | Google Fonts CDN：Space Grotesk 300/400/500/600、Space Mono 400/700/400i | 可換 |
| 樣式 | 單一外部 `docs/css/styles.css`，940 行，`--c-*` / `--blue-*` token | 可重寫 |
| 主題 | `data-theme`（light/dark 解析值）＋ `data-theme-mode`（auto/light/dark） | **屬性名不可改**（inline script 與 CSS 都依賴） |

## 版面骨架

`#root` 三欄 ＋ 兩層 overlay：

- `#legend-side`（左欄）—— app header ＋ 主題鈕 ＋ Node Types ＋ Phase 快速傳送 ＋ ambient 區塊 ＋ hint
- `.flow-area > #flow-svg`（中間）—— d3 + dagre 畫的流程圖，內含右下角 minimap
- `#detail-panel`（右欄，預設 `.hidden`）—— 選到節點才出現
- `#doc-drawer` ＋ `#doc-drawer-backdrop`（overlay）—— markdown 文件抽屜

## 功能與互動清單

改版後逐項實測，每項填 ✅／❌／改動說明。**行號為改版前 `docs/js/app.js` 的位置**，改版後會變，留著是為了回溯原始實作。

| # | 功能 | 觸發 | 預期行為 | 原始位置 |
|---|---|---|---|---|
| F1 | 縮放 / 平移 | 滾輪 / 拖曳 | d3.zoom，縮放範圍 **0.04 – 2.5** | `app.js:276` |
| F2 | 初始 fit view | 載入後 40ms | 整張圖置中、留 8% padding | `app.js:846,864` |
| F3 | 節點點擊選取 | 點節點 | 選取；**再點同一個 → 取消** | `app.js:347` |
| F4 | 選取後的高亮 | 同 F3 | 自己 `is-focus`、直接上下游 `is-neighbor`、其餘 `is-dimmed`；相連邊 stroke 1.5→2.5、`stroke-dasharray: 8 4` ＋ `@keyframes march` 跑馬燈、arrow marker 換色 | `app.js:421-452`、`styles.css:647` |
| F5 | 空白處取消選取 | 點 svg 非節點處 | 清除 selection | `app.js:455` |
| F6 | ESC | 按 Esc | drawer 開著 → **只關 drawer**；否則清除 selection | `app.js:459` |
| F7 | type 篩選 | 點左欄 Node Types 任一項 | 高亮該型別全部節點；再點同項清除 | `app.js:735` |
| F8 | Phase 快速傳送 | 點左欄 Phase 項 | 選取該 phase 的入口節點 ＋ 350ms 平移置中；縮放 <0.35 時拉到 0.35 | `app.js:742,622` |
| F9 | detail panel 內容 | 選到節點 | type badge ＋ phase label ＋ 節點 label ＋ 文件段 ＋ 上游／下游清單（含數量） | `app.js:471` |
| F10 | 上下游可跳轉 | 點清單項 | 選取該節點 | `app.js:522` |
| F11 | detail panel 關閉 | 點 × | 清除 selection | `app.js:520` |
| F12 | 節點文件摘要 | 選到有 `NODE_DOCS` 對映的節點 | 顯示「載入中⋯」→ frontmatter `description` 第一行；無描述 →「（無描述）」；失敗 →「（載入失敗）」 | `app.js:493,525-545` |
| F13 | doc drawer 開啟 | 點「→ 查看完整文件」或 ambient skill 項 | breadcrumb `References / Skill｜Agent / <name>`；header 有 type badge、title、description、`model` / `tools` pills；body 用 marked 渲染並**去掉第一個 H1** | `app.js:570` |
| F14 | drawer 資料來源 | 同 F13 | **先讀 `window.REFERENCE_DOCS` 內嵌**，沒有才 `fetch`；失敗顯示「載入失敗：<訊息>」。這是 `file://` 能用的原因 | `app.js:583,606` |
| F15 | drawer 關閉 | × ／ 點 backdrop ／ ESC | 三種都要能關 | `app.js:556,557,459` |
| F16 | minimap | 右下縮圖 | viewport 方框跟著縮放平移即時更新；**點 minimap → 主視圖 180ms 平移**到對應位置 | `app.js:812,828` |
| F17 | 主題切換 | 點主題鈕 | `auto → light → dark` 循環，寫 `localStorage['dev-workflow-theme']`；三顆 icon 各對應一態 | `app.js:868-895` |
| F18 | 跟隨系統主題 | mode=auto 時改系統深淺色 | 即時切換，不需重整 | `app.js:880` |
| F19 | 防 FOUC | 頁面載入 | `index.html` 的 inline script **在 CSS 之前**設好 `data-theme` | `index.html:9-24` |
| F20 | ambient 區塊 | — | 左欄底部兩組：CLAUDE.md 強制守則（9 條，純文字）＋ 跨流程 skill（5 個，**可點開 drawer**） | `app.js:640,750` |
| F21 | hint 文字 | 依 selection 狀態 | 三種字串：「再點同項清除 / ESC 清除」「再點同節點 / ESC 清除」「點 type 或 phase 快速導覽」 | `app.js:730-732` |
| F22 | 節點配色 | — | 由 `styles.css` 的 `--c-*` token 依 SVG／HTML 的 `data-type` 屬性驅動，**8 種型別 × light/dark 兩套** | `styles.css:23-30,64-71` |

## 資料契約（改版不得破壞）

- `data.js` 匯出 `window.FLOW_DATA`：`phases` / `nodes` / `edges` / `ambient` / `legend`，另掛 `getUpstream` / `getDownstream` / `getAdjacentEdges`
- `app.js` 的 `NODE_DOCS`：節點 id → `{ path, name }`
- `references-data.js` 匯出 `window.REFERENCE_DOCS`：文件路徑 → markdown 全文
- 目前規模：**84 節點 / 103 邊 / 15 phase / 8 型別**（改版前實測）

## 既有缺口（改版前就存在，不是改版造成）

**列在這裡是為了免責**：改版後這幾項仍然壞，不算改版的錯；但也**不要順手修**——那會讓「功能有沒有掉」的比對變髒。

1. **`NODE_DOCS` 只收 25 個 skill ＋ 6 個 agent**，缺 `design-language` / `design-direction`。新加的 `LoadDLang` / `LoadDD` 節點點下去**沒有文件段**（F12 / F13 不觸發）。
2. **`references-data.js` 的產出器 `scripts/build-references.ps1` 不在 repo**（檔頭自述有，實查只有 `setup.ps1`）。所以第 1 點無法只改 `NODE_DOCS` 解決——沒有對應內嵌全文，drawer 會走 fetch 再失敗。
3. **`?v=v1|v2|v3` 版本切換是 no-op**：`pickFlowData()` 找 `window.FLOW_DATA_VERSIONS`，但 `data.js` 只提供單一 `FLOW_DATA`（該名稱在 `data.js` 只出現在註解裡），實際永遠 fallback。
4. **零響應式**：`styles.css` 全檔 `@media` 0 命中、`@container` 0 命中。窄視窗／手機的行為**未定義**。
5. **鍵盤可及性只有 ESC**：全檔 `tabindex` 0 命中、`:focus-visible` 只有 1 條（`styles.css:233` 的主題鈕）。SVG 節點是 `<g>`，不可 focus、不能用鍵盤選取。
6. **無 `prefers-reduced-motion`**：全檔 0 命中。現有 14 條 transition／animation 宣告在偏好減少動態的系統上照跑。

---

## 改版紀錄

| 改版 | branch | 驗證結果 |
|---|---|---|
| 2026-09-01　rail-console 骨架 ＋ 校樣配色 | `refactor/docs-site-redesign` | `docs/archive/2026/docs-site-redesign/verify-F1-F22.md` |

**該次結論**：F1–F22 **22 項全部存在**；其中 9 項標「改動說明」（行為或觸發路徑改變、
功能未減），1 項附驗證限制（F18 的動態切換工具測不到，只有靜態佐證），
1 項另含修正（F13 的「去掉第一個 H1」自 `43d5938` 起就從未生效，該次修好）。
上方「既有缺口」六條維持未修，其中缺口 3 的 no-op code 隨改版移除（行為未變）。

### 2026-09-01 第二批（同一支 branch，驗收後追加）

| 項 | 對基準的影響 |
|---|---|
| 文件交叉引用可點 | F13 多一項改動說明：抽屜正文在 marked 之後多跑一次 DOM 改寫，純文字內容不變 |
| `REFERENCE_DOCS` 收進 CLAUDE.md | 33 → 34 key |
| `.icon-btn` 墨跡置中 ＋ `flex-shrink` | 純樣式修正，無 F 項影響 |
| 主題切換過場 | 新增行為，F4 的三態切換本身未變 |
| **landing 頁**：流程圖從 `index.html` 搬到 `flow.html` | **F1–F22 全部改指 `flow.html`**；`index.html` 是新的 landing 頁，不在 F1–F22 的範圍內 |
| oklch fallback 改用 `@supports` | **修正**：原本「自訂屬性連寫兩行」的寫法實測完全沒有 fallback 效果 |

**缺口狀態**：六條的 4（零響應式）與 5（鍵盤可及性）在第一批已標處置；
6（無 `prefers-reduced-motion`）維持未修——主題過場刻意也不加，見驗證表第九節。

> 本節為 **append-only**。上方 F1–F22 原文與「既有缺口」六條是改版比對的基準，
> **任何一次改版都不得修改它們**——改了就不再是基準。
