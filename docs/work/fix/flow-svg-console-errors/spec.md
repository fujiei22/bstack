# 修 docs 站 flow 頁 34 筆 console 錯誤
> Track: Bug | Tier: T2 | 建立: 2026-11-09

## 動機 / Why
- 症狀：公開 docs 站 `flow.html` 每次載入都有 34 筆 console error，例如 `<g> attribute transform: Expected transform function, "{{ viewTransform }}"`。畫面正常。PR #103 驗證時已確認 main 上原本就有。
- 影響：
  - frontend-test 規定「console 有 error 就 FAIL」，每次驗證都要拿 main 對照數字，才能排除這 34 筆；
  - 真的新錯誤可能混在裡面看不出來。

## 根因（實測）
- 頁面樣板直接寫在 `<x-dc>` 元素裡。瀏覽器解析 HTML 時，把裡面的 SVG 當真圖形建立，遇到 `transform="{{ … }}"` 這類佔位符就報錯。dc-runtime（`docs/support.js`）之後才填值，所以畫面正常。
- 最小重現（scratchpad，Playwright）：
  - `<x-dc>` 內放 `<g transform="{{ v }}">` → 報 2 筆錯（另 1 筆是 favicon 404）；
  - 改放在 `<template>` 內 → 0 筆，再把 `template.innerHTML` 指定給另一個 `<template>` 也是 0 筆。

## 方案草圖
- 選定：樣板外包一層 `<template>`，`support.js` 兩個讀樣板處改成「有 `<template>` 就讀它的內容，沒有照舊」，向後相容；加契約守住這處修改。
- 放棄：
  - 最小做法「不修、在 frontend-test 註明已知噪音」：每次驗證都要對照數字，新錯誤會被淹沒；
  - 不做。
- 代價：`support.js` 檔頭寫「GENERATED — do not edit」，產生它的 dc-runtime 原始碼不在本 repo。若日後用外部工具重新產生，修改會被蓋掉，由契約變紅提醒補回。

## 目標 / Success criteria
- `flow.html` 載入 console error 0 筆。favicon 404 若出現另計，那不是本問題。
- `index.html` 不受影響：error 數不增加，畫面相同。
- flow 頁桌機版截圖與修改前一致（目視加互動：點節點、切換主題）。
- **契約新增一段檢查**：
  - `docs/flow.html` 的 `<x-dc>` 第一層是 `<template>`；
  - `support.js` 的 `parseDcDocument` 讀 `:scope > template`；
  - `parseDcText` 會剝掉 `<template>` 外層。
- 不升版（只動 docs 站與契約，plugin 行為不變）。

## 範圍 / Scope
**包含**：`docs/flow.html`、`docs/support.js`、`scripts/plugin-contract.mjs`。

**排除**：`docs/index.html`（量測無此錯誤；support.js 的修改向後相容，index 照舊可用）；dc-runtime 上游。

## 影響檔案 / Codebase impact
| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `docs/support.js` | edit（2 處） | 讀樣板失敗 → 整頁空白；公開站 merge 即上線 |
| `docs/flow.html` | edit（包一層標籤） | 結構改動，需截圖對照 |
| `scripts/plugin-contract.mjs` | edit | 新檢查不能恆綠 |

## 設計方向
- 區塊：docs 站 flow 頁；size：小改；map_status：沿用既有。
- 四項對齊檢查：元件狀態 / 斷點 / 表單 / dark mode 都是 N/A。依據：`<template>` 不渲染、不帶樣式，沒有新視覺；改用前後截圖對照確認一致。

## 風險與 trade-off
- 樣板讀取失敗會讓整頁空白。驗證時桌機與手機都要截圖，index 也要開。

## 施工清單
| # | group | 檔（可多個） | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `scripts/plugin-contract.mjs` | 新增 P23：flow.html `<x-dc>` 第一層是 `<template>`；support.js parseDcDocument 讀 `:scope > template`、parseDcText 剝外層 | `node scripts/plugin-contract.mjs` → P23 FAIL（紅） |
| 2 | 2 | （基準） | 改動前 flow / index 的 console error 數、桌機與手機截圖 | 數字與截圖路徑記進施工紀錄 |
| 3 | 3 | `docs/support.js` | 兩處讀樣板支援 `<template>` 外層（向後相容） | index（無外層）照常顯示、console 不增加 |
| 4 | 4 | `docs/flow.html` | `<x-dc>` 內容包進 `<template>` | P23 綠；flow console 0 error；截圖與基準一致；點節點、切主題正常 |

## 施工紀錄
### 2026-11-09
- 列 1：契約 P23 先紅（三項都缺）。
- 列 2 基準（改動前，桌機 1280×720）：
  - flow.html console error 34 筆；
  - index.html 本身 0 筆，但內嵌的 `flow.html?embed=1` 帶出同樣 34 筆；
  - 截圖 `before-flow-desktop.png`。
- 列 3：`support.js` 加 `unwrapTemplate()`；`parseDcDocument` 讀 `:scope > template`，`parseDcText` 剝外層。index 未包外層時照常顯示、自身 0 錯，向後相容確認。
- 列 4：`flow.html` 的 `<x-dc>` 內容包進 `<template>`，P23 綠、契約 ALL PASS。驗收結果：
  - **flow 桌機**：console 0 筆；截圖 `after-flow-desktop.png` 與 before 的 sha256 完全相同（`946d5d85…`）。
  - **互動**：點第一個節點，開出詳情面板（「user 輸入 /devwork + 要做的事」）；主題 dark → light 切換成功（`after-flow-interact.png`）；之後 console 仍 0 筆。
  - **index**：含內嵌 flow，console 0 筆（原本 34 筆隨 flow 一起消失）。
  - **flow 手機 390×844**：console 0 筆，版面正常（`after-flow-mobile.png`）。
- 設計對齊四項：全部 N/A。依據：只加了不渲染的 `<template>` 外層，沒有樣式或結構上的視覺變化；截圖 hash 相同是直接證據。
