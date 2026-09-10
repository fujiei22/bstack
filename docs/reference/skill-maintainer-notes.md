# skill 維護者註記（從 skill 本文搬出）

> 這些是「改 skill 文本時要知道」的接線與量測紀錄，AI 執行流程用不到，2026-09-10 從 skill 本文搬出（Codex 外部 review 第 6 項）。原行號以當時的 main 05e8c6f 為準。

## skills/devwork/hosts.md 原 L3-4

> 八個節標題與每節第一欄是契約鍵（plugin-contract.mjs P14 / P16），改名要同步。
> 工具名在 skill 內文的三種待遇（P14 守）：**列在本表第一欄的**可直接當抽象動詞寫（`AskUserQuestion`、`Agent`…）；**只有一個 host 有的**（`NotebookEdit`、`SendMessage`）要同行寫出另一個 host 的對應（例「Claude Code 用 `SendMessage`；Codex 靠 `wait_agent` 收」）；**都不是的**新工具名先加進本表對應節再用。

## skills/design-language/SKILL.md 原 L37

> **現況分歧（待收斂）**：`.sass` 目前只出現在 `frontend-test` 的 description 觸發詞，`verify-done` §UI / browser e2e 兩處與 `dev-workflow` §跨流程觸發表都沒有。本清單暫不收 `.sass`，與多數處對齊；要收的話需同時補回那兩個檔。

## skills/design-language/SKILL.md 原 L35

其他檔案引用「前端副檔名」一律**指向本節**。**例外**：`brainstorm` §Phase 0b′ 與 rules.md §設計語言對齊 重列（它們**不載入本 skill**也要判得出來）；另 4 處觸發用引用列同一份（dev-workflow §跨流程 skill 載入 frontend-test 列、verify-done §UI / browser e2e、frontend-test §載入時機、流程圖 DesignQ label）。契約 P11 守七處一致，改這裡要同步那六處。

## skills/request-review/SKILL.md 原 L39 前半

**medium 做什麼**：多個 finder 各找 candidate、去重後逐條 verifier 驗證，輸出 JSON 陣列 `{file, line, summary, failure_scenario}`，沒東西就 `[]`。一次約 7 分鐘、fork 十萬 token 級（2026-09-04 實測；finder / verifier 另計）——這是判「要不要跑 medium」的依據。
