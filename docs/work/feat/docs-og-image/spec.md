# docs 站補 OG 圖與 social meta

> Track: Dev | Tier: T2 | 建立: 2026-09-04

## 動機 / Why

`https://fujiei22.github.io/bstack/` 貼到 LINE / Slack / Facebook / X 時沒有預覽圖，
只有純文字 title。原因是兩頁的 `<head>` 完全沒有 `og:*` / `twitter:*` meta，
而站上唯一的圖 `docs/favicon.svg` 是 SVG，社群平台的爬蟲不吃 SVG 當 `og:image`。

實查依據（2026-09-04，main `39d9c8d`）：
- `docs/index.html:4-8` 與 `docs/flow.html:4-7` 的 meta 只有 charset / viewport / title / description
- `docs/` 底下無任何 png / jpg，無 `assets/` 目錄
- 站是 `main:/docs` 直出、無 build step、無 `.github/` CI、無預覽環境（merge 即上線）

## 目標 / Success criteria

- 兩頁（`index.html` / `flow.html`）都有完整 OG + Twitter Card meta，`og:image` 為絕對網址
- `docs/og.png` 存在、1200×630、PNG、檔案大小 < 500 KB
- OG 卡的原稿 `docs/tools/og-card.html` 進 repo，日後重產不需安裝任何依賴（用 Playwright 開 1200×630 截圖即可）
- `docs/tools/docs-site-contract.mjs` 新增 C20 守門：兩頁 og:image 存在且為絕對網址、指向的檔存在於 `docs/`、PNG 檔頭解出 1200×630
- `node docs/tools/docs-site-contract.mjs` 全綠（既有 C1-C18 不掉）
- merge 後用 opengraph.xyz 或 Facebook Sharing Debugger 看到預覽圖（只能上線後驗，見風險）

## 範圍 / Scope

**包含**：
- `docs/og.png`（新）：兩頁共用一張
- `docs/tools/og-card.html`（新）：OG 卡原稿，沿用 `.lrail .mk` 標記與 `styles.css` token
- `docs/index.html` / `docs/flow.html`：head 加 meta，兩頁 title / description 各自不同、圖共用
- `docs/tools/docs-site-contract.mjs`：加 C19

**排除**（明寫避免 scope creep）：
- 不為 `flow.html` 另做流程圖截圖版 OG 圖（會隨圖漂移、多一張要維護；第一版共用）
- 不加 `theme-color` / `manifest.json` / apple-touch-icon 等其他 head 強化
- 不出 dark 版 OG 圖（OG 圖不跟系統主題）
- 不動 `favicon.svg`
- 不建 CI 自動重產圖（repo 無 CI，且圖不常變）
- 圖上不放 skill / agent / hook 數字（契約 C8g 守得住 HTML 裡的數字，守不住 PNG，一改就漂移）

## 影響檔案 / Codebase impact

| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `docs/og.png` | new | 低；靜態資源。快取風險見下 |
| `docs/tools/og-card.html` | new | 低；只在產圖時開，不被站上任何頁連結。位於 `docs/` 底下所以會被 Pages 一起發布，無害 |
| `docs/index.html` | edit（head 加 ~12 行 meta） | 低；不動 body、不動 inline theme script（F19 防 FOUC 順序不變） |
| `docs/flow.html` | edit（同上） | 低 |
| `docs/tools/docs-site-contract.mjs` | edit（加 C20） | 低；零依賴 PNG 檔頭解析，讀 byte 16-24 |

## 設計方向

- 區塊（`scope`）：文件站　依據（`scope_evidence`）：`docs/css/styles.css`
- 地圖狀態（`map_status`）：ok（失效檢查通過：token 來源存在、改動檔全在 `docs/**`、`landing.css` 零自有 token 全靠 `var()`）
- `size`：小改，未走三方向
- 設計語言摘要：
  1. 色彩：`--paper #F8F5F1`、`--surface #FEFDFB`、`--ink #251F1B`、`--ink-2 #5C5550`、`--accent #C3352D`、`--accent-ink #FEFDFB`（`styles.css:25-36`）
  2. 字體：display `Newsreader → Noto Serif TC → serif`；body `IBM Plex Sans → Noto Sans TC`（`styles.css:68-70`），Google Fonts 載入
  3. 間距：無 scale token，元件直寫 px
  4. 圓角：2-5px；標記 3px（`landing.css:18`）
  5. 斷點：N/A（OG 圖固定 1200×630）
  6. dark mode：N/A（OG 圖不跟主題；只出 light 版，用 light 值）
  7. 表單：N/A（兩頁無 `<form>` / `<input>`）
- 沿用元件：`.lrail .mk`（`landing.css:17-24`）：accent 底、accent-ink 字、Newsreader 600、letter-spacing -.02em、radius 為邊長 7.5%（40px → 3px；`favicon.svg` 64px → 4.8px）。OG 卡把它等比放大。
- 卡片內容：bs 標記 ＋ 「bstack」＋ 一句定位「Claude Code 開發流程包」（取自 `<title>`），紙色底、墨色字。不用 hero h1 那句。

## meta 規格

兩頁共同：
```
og:type=website  og:locale=zh_TW  og:site_name=bstack
og:image=https://fujiei22.github.io/bstack/og.png  og:image:width=1200  og:image:height=630
og:image:alt=<文字>  twitter:card=summary_large_image  twitter:image=<同 og:image>
```
各頁：`og:url` / `og:title` / `og:description` / `twitter:title` / `twitter:description` 取自該頁既有 `<title>` 與 `<meta name="description">`。
`og:image` 必須是絕對網址（爬蟲不解析相對路徑），寫死 github.io 網域；日後若加 CNAME 要一併改，這點寫在 og-card.html 檔頭。

## DB 影響

無。

## 風險與 trade-off

- **上線後才驗得到**：無預覽環境，社群爬蟲只抓公開網址。merge 前只能靠 C19 與本地目測 og.png；merge 後用 opengraph.xyz / Facebook Sharing Debugger 確認
- **平台快取**：LINE / FB / Slack 按網址快取預覽圖，日後換圖要改檔名或加 `?v=`，否則舊圖會掛很久。寫進 og-card.html 檔頭
- **字型依賴網路**：og-card.html 用 Google Fonts，離線截圖會退到 fallback 鏈。產圖時確認字型載完再截（Playwright `document.fonts.ready`）
- **og-card.html 會被 Pages 發布**：放在 `docs/tools/` 與 contract.mjs 同處是 repo 慣例；它沒有被任何頁連結，無害

## 待釐清

無。
