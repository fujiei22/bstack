# 設計語言區塊地圖

> 由 design-language skill 產生。修改後請保留欄位結構。
> 首次偵測：2026-08-31，branch `refactor/docs-site-redesign`。
> 重畫：2026-09-08，branch `docs/void-redesign`（void 改版把外部 stylesheet 收進兩頁的 inline `<style>`，
> 原本的 token 來源 `docs/css/styles.css` 已刪除，失效檢查第 1 條命中）。

| 區塊 | 檔案範圍 | 選擇器範圍 | token 來源 | dark 機制 | 框架 | CSS 方案 |
|---|---|---|---|---|---|---|
| 文件站 | `docs/**` | — | `docs/index.html` | `[data-theme]` | React 18（UMD，無 build step） | 頁內 inline `<style>` |

## 偵測依據

- **token 來源**：`docs/index.html` 的 `:root` 與 `:root[data-theme="dark"]` 兩個區塊（頁內 inline `<style>`）。
  `docs/flow.html` 有**結構相同、值相同的第二份**——兩頁各自獨立、沒有共用檔案。
  以 `index.html` 為準是因為它是站台入口，OG 卡原稿（`docs/tools/og-card.html`）也抄它那份。
  **兩份不得漂移**，契約 `docs-site-contract.mjs` 的 C15 逐值比對、C20e 比對 OG 原稿。
- **唯一 CSS 來源**：全 repo 已無 `.css` 檔（`docs/css/` 於本次改版整個刪除）。
- **dark 機制**：`:root[data-theme="dark"]` 屬性選擇器，非 `prefers-color-scheme`、非 `.dark` class。
  兩頁 `<head>` 的 inline script 在解析階段就把 `data-theme` / `data-theme-mode` 寫上 `<html>`（防 FOUC，契約 C2）。
  `auto` 模式才會去問 `prefers-color-scheme`，那是解析出 light/dark 的手段、不是機制本身。
- **框架**：React 18.3.1 UMD，由 `docs/support.js`（dc-runtime，**產生檔、不要手改**）在執行期掛載。
  React / ReactDOM 自帶於 `docs/js/vendor/`，不打 CDN（契約 C1b）。無 build step、無 bundler。

## 色票（exact values，抄自 `docs/index.html`）

| token | light | dark |
|---|---|---|
| `--bg` | `#FFFFFF` | `#000000` |
| `--surface` | `#FAFAFA` | `#0B0B0C` |
| `--sunk` | `#F2F2F3` | `#131315` |
| `--line` | `#E4E4E7` | `#232326` |
| `--line-2` | `#C9C9CF` | `#35353B` |
| `--ink` | `#0A0A0B` | `#FAFAFA` |
| `--ink-2` | `#52525B` | `#A3A3A8` |
| `--ink-3` | `#6B6B72` | `#8B8B92` |
| `--accent` | `#12855A` | `#7CF5A6` |
| `--accent-ink` | `#FFFFFF` | `#04140B` |

字體：`Instrument Sans`（body）/ `JetBrains Mono`（mono）/ `Noto Sans TC`（中文），Google Fonts CDN。
節點型別色不在 CSS token 裡，住在 `docs/flow.html` 的 `TYPE_COLOR` / `TYPE_FILL` 兩個物件（契約 C4）。

## 注意

- `data-theme` 與 `data-theme-mode` 兩個屬性名是 inline script、CSS 與元件的三方契約，
  **改名會同時打破防 FOUC 與主題切換**。
- **斷點**：`N/A（依據：docs/index.html 與 docs/flow.html 全檔 @media 零命中）`。
  這版的響應式靠 `clamp()` 與 JS 量測視窗尺寸，不用 media query——要加斷點前先確認不會跟 JS 那套打架。
- `docs/support.js` 檔頭寫明 `GENERATED from dc-runtime/src/*.ts — do not edit`，**不要手改**；
  要改行為改兩頁的元件 script。
