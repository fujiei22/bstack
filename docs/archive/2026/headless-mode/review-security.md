# Security audit（Phase 6）
> agent：security-auditor（STRIDE + OWASP）；主 agent 跑 security-checklist §1 / §2 / §11（其餘九題本 diff 無對應面）
> 焦點：「AI 讀 GitHub issue 留言依編號執行決策」這條不可信輸入邊界

| 級別 | finding | 處置 |
|---|---|---|
| Major M1 | `isMine` 只看內容標記不看作者：路人貼假 `<!-- bstack-reask -->` / `<!-- bstack-ask -->` 可污染 reasked / reminded / duplicate-instance，單則留言即可讓自動化 blocked | **已修**：標記留言也要求 `authorAssociation ∈ OWNER / MEMBER / COLLABORATOR`；§問人格式 duplicate 檢查同樣只認受信作者；P19 加 fixture |
| Major M2 | §問人格式 步驟順序 push 在 safety-guard 之前，「blocked 不 push」兌現不了 | **已修**：safety-guard 掃留言全文與待 push 改動移到第 1 步 |
| Minor N1 | issue 選定機制（label / cron / env）誰能觸發不在本 diff，SKILL.md 沒提醒 | **已修**：§前提 補「須限維護者可觸發」 |
| Minor N2 | security-audit 的 codebase_impact 關鍵字抓不到「外部輸入 → agent 自主決策」這類邊界 | 流程建議，記 follow-up（security-audit 觸發面加 `external-input`） |
| Nit | 三個 regex 無巢狀量詞、無 ReDoS；超大數字落回 unparseable | 無需動作 |

**PASS**：freeText 只在受信作者的 answered 才產生；`gh` 參數（repo / issue 號）不取自留言內容；`--body-file` 不內插 shell；P19 spawn 固定參數無外部輸入；留言模板不回顯 issue 原文或環境變數；merge 在 headless 永不自動；`.gitignore` 加 snapshots 的遺失風險已在 §前提 與 spec §排除 揭露。

**Checklist**：§1 secret（diff 無 hardcoded key，`git diff` grep 空）PASS；§2 input validation（parser 白名單編號、askedAt / optionCount 型別驗、作者信任）PASS；§11 error handling（stderr 只印參數錯誤訊息，無路徑 / stack）PASS。
