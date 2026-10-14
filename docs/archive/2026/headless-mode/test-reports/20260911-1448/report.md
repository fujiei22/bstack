# Frontend e2e report — feat/headless-mode

> preview: http://127.0.0.1:8765（`scripts/static-serve.mjs docs 8765`）
> tier: T3 · runner: frontend-e2e-runner（Playwright MCP）· 2026-09-11 14:48
> 主 agent 代寫本檔：runner 的 harness 禁止 subagent 寫 .md，結果由其回報訊息謄錄。

| # | scenario | viewport | 結果 | 備註 |
|---|---|---|---|---|
| 1 | landing-counts | 1280×720 | FAIL（console） | 計數全對：hero `29 / skills`、inventory「十條」+ `29`。console 34 error 全來自 `flow.html` SVG 樣板字面值（`{{ e.d }}` 等）；`git diff main...HEAD -- docs/flow.html` 為空、main 上同樣重現 → **既有問題，非本 branch 引入**，另開 follow-up |
| 2 | landing-headless-card-and-drawer | 1280×720 | PASS | 搜尋 headless → 卡片「無人環境：決策點採推薦或留言問人」→ 抽屜含「§分流表」「表外一律 B」。`screenshots/drawer-headless.png` |
| 3 | flow-crosscut-list | 1280×720 | INCONCLUSIVE（矩陣措辭） | flow.html 沒有字面「跨流程 skill（按需載入）」分組（側欄是節點型別篩選 + 字母序「文件索引 37」）；headless-mode 在文件索引可查、可開、內容正確、console 無新增。驗收標準實為「查得到、開得了」→ 功能面 PASS |
| 4 | landing-mobile | 390×844 | PASS | scrollWidth 375 ≤ innerWidth 390；卡片可見。`screenshots/landing-mobile.png` |
| 5 | landing-regression-existing-card | 1280×720 | PASS | context-resume 抽屜含「headless 時不問」→ references 已重產 |

## 額外發現（本 branch 引入）

- `docs/index.html:514` `<h2>` 寫死「35 個功能」，動態 `resultLabel` 已變 36 項（29 skill + 6 agent + 1 doc）。**已修**：35 → 36（P8 不守這個數字，記入 follow-up：改成動態值）。

## Follow-up（不在本 PR）

- `docs/flow.html:350-383` SVG 樣板在 JS 插值前先被瀏覽器解析，產生 34 個 console error（main 上既有）。
- `docs/index.html:514` 的功能總數改成由 `SKILLS.length + AGENTS.length + DOCS.length` 動態算，並加進 P8。
