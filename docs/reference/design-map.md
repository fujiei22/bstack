# 設計語言區塊地圖

> 由 design-language skill 產生。修改後請保留欄位結構。
> 首次偵測：2026-08-31，branch `refactor/docs-site-redesign`。

| 區塊 | 檔案範圍 | 選擇器範圍 | token 來源 | dark 機制 | 框架 | CSS 方案 |
|---|---|---|---|---|---|---|
| 文件站 | `docs/**` | — | `docs/css/styles.css` | `[data-theme]` | 無 | 外部 stylesheet |

## 偵測依據

- **唯一 CSS 來源**：`find` 全 repo（排除 `.gitignore` 命中的 `everything-claude-code` / `superpowers` / `gstack` / `huashu-design` 與 `.git`）只得 `docs/css/styles.css` 一個檔。
- **唯一 importer**：`grep -rn 'styles.css' --include=*.html` 只命中 `docs/index.html:30` 的 `<link rel="stylesheet">`。
- **dark 機制**：`:root[data-theme="dark"]` 屬性選擇器（`docs/css/styles.css:47`），非 `prefers-color-scheme`、非 `.dark` class。
  `docs/index.html:9-24` 的 inline script 在 CSS 之前把 `data-theme` / `data-theme-mode` 寫上 `<html>`（防 FOUC）。
- **框架**：無。`docs/index.html` 只載 classic script（d3 / dagre / marked 皆為 `docs/js/vendor/` 本地檔），無 build step、無 bundler。

## 注意

`data-theme` 與 `data-theme-mode` 兩個屬性名是 inline script 與 CSS 的共同契約，**改名會同時打破防 FOUC 與主題切換**。
