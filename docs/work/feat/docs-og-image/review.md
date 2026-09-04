# Plan review 總結

> Plan: docs/work/feat/docs-og-image/plan.md
> Tier: T2
> 視角: Eng
> 日期: 2026-09-04

reviewer 把 plan 的 C20 區塊原樣貼進契約檔副本實測：對現況 `docs/` 跑一次、對「模擬 Task 2-4 完成」的副本跑一次、對 2400×1260 的 PNG 跑一次。標「實測」的來自這三輪，標「推斷」的是讀 code。

## Critical

無。C20 貼進 C19d 之後可直接跑（`node --check` 通過、無撞名、import 齊）；對 plan Task 4 的 meta 寫法全綠；DPR=2 的假圖只紅 C20d 且訊息印出 `2400×1260`；既有 C1-C19 與 selftest 不受影響。

## Major

1. **Task 1 Step 2 預期「9 FAILED」錯，實測 8 FAILED**（C20a×2、C20b×2、C20c×2、C20d、C20e）。照 plan 對數字會以為少紅一條、誤觸 §Fail handling。→ 改 8。
2. **Task 3 字型預期會造成假停工**。卡上用 `--font-display` 的只有 `bs` 與 `bstack`，全拉丁字元，Noto Serif TC 不會被觸發載入（推斷，fallback 鏈逐字元比對）。實際會 loaded 的是 Newsreader、IBM Plex Sans、Noto Sans TC（`.tag` 中文）、IBM Plex Mono。→ 預期清單改這四個。
3. **三份同值文字沒契約守同步**。改完 index.html 會有 `<meta name="description">` / `og:description` / `twitter:description` 三份同文、title 也三份。C20a 只驗存在，日後改 description 忘改 og 版就漂移、契約仍綠。→ 加 C20f：`og:title === <title>`、`og:description === <meta name="description">`、`twitter:title === og:title`、`twitter:description === og:description`，兩頁都驗。附帶：plan Task 4 寫「C8g 守那組數字」不正確，C8g 守的是 body 節點數，跟 description 的 28 / 6 / 2 無關。

## Minor

4. **C20e 色值偵測有漏洞**：第三個 regex 只抓 `color:` / `background:` 後接 hex / rgba / oklch，`border-top: 1px solid #DAD6D1`、`color: white`、`hsl(` 抓不到。→ 改成剝掉 `/* */` 與 `<!-- -->` 後整檔測 `/#[0-9A-Fa-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/`，一條頂替第二、第三條。
5. **C20e 兩條 regex 剝註解方式不一致**（一條剝 CSS+HTML 註解、一條只剝 HTML），`<style>` 內寫 `/* 原本是 background: #fff */` 會恆紅。→ 用同一份剝乾淨的字串（第 4 條修法順便解掉）。
6. **`metaOf` 對屬性順序反或單引號寫法會回 null**（實測）。plan 格式固定所以不會踩，但 C20 註解要寫明「只認 property/name 在前、雙引號」。
7. **並行性理由改寫**：Task 2 與 Task 4 不能同時跑的硬理由是 C20b 要 `og.png` 存在，Task 4 若先於 Task 3 完成，收尾時 C20b 必紅。串行 2→3→4 是對的，理由寫成依賴而不是「保守」。

## Nit

8. 契約檔頭 :25-26 的跑法路徑仍是舊的 `docs/work/refactor/docs-site-redesign/verify/contract.mjs`（既有問題）。Task 1 反正要動檔頭，順手改成 `docs/tools/docs-site-contract.mjs`。
9. C20d 名稱「< 500 KB」、訊息「< 512000 bytes」是 KiB 對 bytes，讀起來像兩個數。→ 擇一。
10. Task 1 單獨 commit 一份會紅的契約，squash merge 後不影響 main，但 bisect 會踩到。→ commit body 寫「刻意先紅」。

## reviewer 實測確認無誤的項目

- C20 程式碼可直接跑；`existsSync` / `readFileSync` / `join` 已 import；`const missing` 在 for 區塊內是合法遮蔽。
- regex 對 ` />` 結尾與多空白都 match；`og:image` 不會誤中 `og:image:width`。
- `read()` 會 throw 的兩處（og.png / og-card.html）都有 `existsSync` 守；PNG IHDR 位移正確。
- meta 插入位置不影響 C2a（script 仍在 stylesheet 前）、C8g（仍抓到 99）、C19c、C1a；selftest 尾段未動。
- Playwright MCP `browser_take_screenshot` 有 `target` 與 `scale`；`scale=css` 尺寸等於元素 CSS 尺寸，不受 DPR 影響。
- `.card` 不會被撐大或裁掉：`box-sizing: border-box` 讓 padding 含在 1200×630 內；`body { margin:0; overflow:hidden }`；og-card 的 `html, body { width; height }` 蓋掉 `height: 100%`。
- 強制 light 成立：styles.css 的 dark 只掛 `:root[data-theme="dark"]`，無 `prefers-color-scheme` media。

## 主 agent 建議

- **必處理**：Major 1-3（1、2 是 plan 數字 / 預期修正；3 加 C20f 是 spec 沒寫但明顯划算的守門，五行程式）。
- **建議處理**：Minor 4-7、Nit 8-10 全收。都是 plan 文字或 C20 區塊內的小改，不動架構。
- **略過**：無。
