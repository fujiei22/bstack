# landing CTA 三項調整（hover 延遲 / 寬度 / rail 順序）

> Track: Dev | Tier: T1 | 建立: 2026-09-04

## 動機 / Why

landing 頁「開啟流程圖」CTA 三個小問題，2026-09-04 以 Playwright 對 `http://127.0.0.1:8765/index.html`（1280×720）實測：

1. **hover 延遲**：底部 CTA（`#install` 第 4 個子元素）進視口後 computed `transition-delay` 是 `0.18s`。成因是 `landing.css:121` 的 `.in .rise:nth-child(4) { transition-delay: 180ms }` specificity (0,3,0) 高於 `.cta` (0,1,0) 自己的 transition 宣告，stagger 進場延遲漏到 hover 的 background / box-shadow。hero 那顆是第 5 子元素、實測 `0s`，沒中。
2. **太長**：hero CTA 寬 563px = `.lcol` 欄寬。`.hero` 是 `display:flex; flex-direction:column`（`landing.css:71`），子元素預設 `align-items: stretch`，`inline-flex` 的 CTA 被拉滿整欄。底部那顆在 block 容器裡正常 146px。
3. **順序**：rail 最底下兩顆由 `landing.js:36-37` 串出 `自（btn-theme）` 在上、`開（./flow.html）` 在下。flow.html 的 rail 底部群組是「置 → 自」，主題鈕壓底；landing 對調後兩頁一致。

## 目標 / Success criteria

- 兩顆 `.cta` 進視口後 computed `transition-delay` 對 background / box-shadow 皆為 `0s`；`.rise` 進場 stagger 對 opacity / transform 維持（nth-child 2/3/4 各 60/120/180ms）
- hero CTA 寬度 = 內容寬（約 146px），不再等於欄寬
- rail 最後兩顆順序為「開」在上、「自」在下；`#btn-theme` 的 id / data-label / onclick 行為不變
- `node docs/tools/docs-site-contract.mjs` ALL PASS（C19d landing.css 零色值 token 不受影響）

## 範圍 / Scope

**包含**：`docs/css/landing.css`（①②）、`docs/js/landing.js`（③）
**排除**：不改 CTA 文案 / 顏色 / 尺寸 token；不動 flow.html；不改 `.rise` 進場時長；不動 `.coda a`

## 影響檔案

| 檔 | 改動 | 風險 |
|---|---|---|
| `docs/css/landing.css:114-121` | stagger 延遲改走自訂屬性 `--rise-delay`，只掛在 `.rise` 的 opacity / transform；`.cta` 加 `align-self: flex-start` | 低；C19d 只掃色值 token，`--rise-delay` 是時間值不會中 |
| `docs/js/landing.js:36-37` | 兩行串接順序對調 | 低；純字串順序 |

## 設計方向

- 區塊：文件站（依據 `docs/css/styles.css`）；map_status ok；size 小改，未走三方向
- 沿用既有 transition 詞彙（`--t-micro` / `--e-move` / `--e-enter`），不新增色值、不新增尺寸

## 風險

- 改 `.rise` transition 寫法後，`.cta.rise` 的進場 opacity / transform 會**開始**有動畫（目前 `.cta` 的 transition 蓋掉 `.rise` 的，CTA 是瞬間出現）。這是修正而非副作用，但要在 verify 目測確認不突兀。
