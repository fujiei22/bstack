# Frontend e2e report — feat/headless-mode（docs 站無人模式面板與流程圖旁線）

> preview: http://127.0.0.1:8765（`scripts/static-serve.mjs docs 8765`）
> tier: T3 · runner: frontend-e2e-runner（Playwright MCP）· 2026-09-11 16:34
> 主 agent 代寫本檔：runner 的 harness 禁止 subagent 寫 .md，結果由其回報訊息謄錄。

| # | scenario | viewport | 結果 | 備註 |
|---|---|---|---|---|
| 1 | landing-headless-panel | 1280×720 | PASS | 面板文字「HEADLESS · 04 / 無人」「沒有人在也能跑」「A 類：自己決定」「B 類：留言問你」「人只做三件事」；五列 + 三列皆渲染；rail 進度編號 04。`screenshots/landing-headless-panel.png` |
| 2 | landing-renumber | 1280×720 | PASS | 含「05 / 內涵」「06 / 功能索引」「07 / 三步」、不含「04 / 內涵」；hero `101` 緊鄰 `NODES`；面板順序 01 管理 → 02 階段 → 03 量體 → 04 無人 → 05 內涵 → 06 功能索引 → 07 三步 |
| 3 | flow-headless-nodes | 1280×720 | PASS | 菱形「無人環境？」與「載入 skill：headless-mode」可見；點 LoadHL 詳情顯示區段「無人模式：headless-mode（排程容器）」、上游 2 / 下游 3，與 data.js 8 條邊一致；「讀完整文件」含 headless-mode 與 §分流表；區段清單有「03 無人模式：headless-mode（排程容器）5」；標頭 101 節點 / 143 邊。`screenshots/flow-headless.png`、`screenshots/flow-headless-doc.png` |
| 4 | landing-mobile-headless | 390×844 | PASS | scrollWidth 375 ≤ innerWidth 390；五列三列可垂直捲動看到。`screenshots/landing-headless-mobile.png` |

**console**：兩頁維持既有 34 筆 error（`flow.html:350-383` SVG 樣板未插值，main 既有，見前一份 report 的 follow-up），點節點、展開文件、換面板皆無新增。

**測試方法陷阱（供後續 runner）**：橫向面板用 `content-visibility:auto`，離視窗的面板 `innerText` 為空，斷言要用 `textContent`；flow.html 第一個 `aside` 是左側型別篩選，文件面板要查第二個 `aside` 或 `body.textContent`。
