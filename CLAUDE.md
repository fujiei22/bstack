# CLAUDE.md

## 對話風格

- 語言：繁中台灣用語
- 風格：`caveman:caveman` skill（lite 級）

---

## 強制守則（無例外）

### §Task 追蹤

執行任務前先用 `TaskCreate` 建出準備執行的 task 清單。

- 流程中需加新 task → `TaskCreate` 補進
- 開始執行 → `TaskUpdate` `in_progress`
- 完成 → `TaskUpdate` `completed`

### §決策點選單

所有 user 決策點（gate / branch 名 / tier / fix / PR 模板等）**主走 `AskUserQuestion`**：

- 推薦選項放第一 + label 加「（推薦）」
- 平台自動附 `Other`（caller 不手動加）
- **禁文字 token NLP 判斷**（不接受 `approve / LGTM / go / 通過 / ✅` 等自由文字當 gate 信號）

### Branch safety

寫入動作（Write / Edit / NotebookEdit）由 PreToolUse hook 自動檢查（`.claude/hooks/branch-safety.ps1`）。

- 命中 `main / master / production / prod / release` → block
- 處置：走 §決策點選單 取 branch 名 → `git checkout -b <name>` → retry

### PII 安全底線

PII（email / phone / 身分證 / 信用卡 / 地址 / id_number）原值禁落對話 / log / commit。

- 輸出須 mask 或改 aggregate
- WHERE 條件可原值比對（不落輸出即可）
- 適用：DB / API response / file / log 全部

### DB 操作

- **讀**：用 `mcp__mysql__mysql_query`；禁 bash mysql / psql CLI、禁手寫 SQL 貼對話讓 user copy 跑
- **寫**（INSERT / UPDATE / DELETE / DDL / TRUNCATE）：mysql MCP 帳號**唯讀**，禁試跑；產 SQL 交 user 執行
- **量限**：預設 `LIMIT 100`；重 query 先 `EXPLAIN`
- **PII**：SELECT 輸出含 PII 欄位 → mask 或 aggregate；WHERE 條件可原值（不落輸出）
- **觸發**：user prompt 含 DB / SQL / mysql / schema / query / table / 表 / 欄位 / SELECT / INSERT / UPDATE / DELETE / DDL / migration 任一關鍵詞
- **細則**（mask SQL 範例、寫操作交付模板、DDL 大表注意事項）→ 載入 `db-access` skill 展開

---

## 程式碼規範

### 程式註解（override 預設無註解方針）

- **Function / class**：docstring（繁中 + 各語言官方慣例）
- **非自明邏輯**：行內註解
- **原則**：WHAT 簡短 + WHY 重點
- **範圍**：新 code 全寫；改動區補齊；未動區不動；測試 docstring（測案 + 原因）
- **豁免**：trivial 一眼懂（純 getter、單行轉型）
