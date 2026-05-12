# CLAUDE.md

## 對話風格

- 語言：繁中台灣用語
- 風格：`caveman:caveman` skill（lite 級）

---

## 強制守則（無例外）

> 本段所有規則**優先於**任何 plugin skill 行為（superpowers / gstack 含）。
> 衝突時，本段勝；plugin skill 自有流程須讓位、改走本段機制。

### §Task 追蹤

執行任務前先用 `TaskCreate` 建出準備執行的 task 清單。

- 流程中需加新 task → `TaskCreate` 補進
- 開始執行 → `TaskUpdate` `in_progress`
- 完成 → `TaskUpdate` `completed`
- **plugin skill 產的 plan / task 清單也要落到 `TaskCreate`**，不另開 tracking 系統

### §決策點選單

所有 user 決策點（gate / branch 名 / tier / fix / PR 模板等）**主走 `AskUserQuestion`**：

- 推薦選項放第一 + label 加「（推薦）」
- 平台自動附 `Other`（caller 不手動加）
- **禁文字 token NLP 判斷**（不接受 `approve / LGTM / go / 通過 / ✅` 等自由文字當 gate 信號）
- **plugin skill 的 gate point 一律改用 `AskUserQuestion`**：
  - superpowers brainstorming 的 spec 確認
  - superpowers write-plan 的 plan 確認
  - superpowers execute-plan 的 task 推進確認
  - gstack `/gstack-cso` `/gstack-codex` 的處置選擇

### Branch safety

寫入動作（Write / Edit / NotebookEdit）由 PreToolUse hook 自動檢查（`.claude/hooks/branch-safety.ps1`）。

- 命中 `main / master / production / prod / release` → block
- 處置：走 §決策點選單 取 branch 名 → `git checkout -b <name>` → retry
- **plugin skill 的 git 操作受同一 hook 管制**：
  - superpowers `finishing-a-development-branch` 的 merge / PR 操作
  - gstack `/gstack-ship`（**不啟用**，見下方選用範圍）
  - 任何 skill 觸發 checkout / merge / push → 一律先過 hook

### PII 安全底線

PII（email / phone / 身分證 / 信用卡 / 地址 / id_number）原值禁落對話 / log / commit。

- 輸出須 mask 或改 aggregate
- WHERE 條件可原值比對（不落輸出即可）
- 適用：DB / API response / file / log 全部
- **plugin skill 的 review / QA / 安全稽核輸出同樣套用**（gstack `/gstack-cso` `/gstack-qa` 不豁免）

### DB 操作

- **讀**：用 `mcp__mysql__mysql_query`；禁 bash mysql / psql CLI、禁手寫 SQL 貼對話讓 user copy 跑
- **寫**（INSERT / UPDATE / DELETE / DDL / TRUNCATE）：mysql MCP 帳號**唯讀**，禁試跑；產 SQL 交 user 執行
- **量限**：預設 `LIMIT 100`；重 query 先 `EXPLAIN`
- **PII**：SELECT 輸出含 PII 欄位 → mask 或 aggregate；WHERE 條件可原值（不落輸出）
- **觸發**：
  - user prompt 含 DB / SQL / mysql / schema / query / table / 表 / 欄位 / SELECT / INSERT / UPDATE / DELETE / DDL / migration 任一關鍵詞
  - **plan / 實作過程主動查 DB**：規劃或實作階段為了確認 schema / 既有資料 / 欄位型別 / 索引 / 資料量等資訊需要查 DB 時，**直接用 mysql MCP**，無需等 user 開口
- **plugin skill DB 存取走同一條路**：superpowers brainstorming / write-plan 階段確認 schema、execute-plan 寫測試、gstack `/gstack-qa` 跑驗收若需 DB，一律 mysql MCP，禁 bash CLI
- **細則**（mask SQL 範例、寫操作交付模板、DDL 大表注意事項）→ 載入 `db-access` skill 展開

---

## 工作流程（superpowers 為骨幹）

### 優先順序（高 → 低）

1. 本文件「強制守則（無例外）」
2. superpowers 工作流程（brainstorm → plan → TDD → review → finish）
3. gstack 選用 skills（補強 superpowers 缺口）

### superpowers 流程

每個 feature / fix 預設走完整鏈：

- `brainstorming` → 釐清 spec（gate 走 `AskUserQuestion`）
- `write-plan` → 產實作 plan（gate 走 `AskUserQuestion`）
- `execute-plan` → 紅綠 TDD 跑 task（每個 task 進 `TaskUpdate`）
- `requesting-code-review` → subagent review
- `finishing-a-development-branch` → 收尾（git 操作過 Branch safety hook）

trivial 任務（單行修 typo / 改設定值）可豁免 superpowers，但 §Task 追蹤 + §決策點選單仍適用。

### gstack 選用範圍

**啟用**（補 superpowers 缺口）：

- `/gstack-codex` → 跨模型 second opinion，在 superpowers subagent review 完成後跑
- `/gstack-cso` → OWASP + STRIDE 安全稽核，動架構 / 認證 / 資料層前跑
- `/gstack-freeze` → 鎖定編輯範圍，動 prod 或敏感模組時開
- `/gstack-careful` → 危險指令防呆
- `/gstack-retro` → 週回顧（看習慣）

**不啟用**（與 superpowers 重複）：

- `/gstack-office-hours` `/gstack-autoplan` `/gstack-plan-*` → 規劃由 superpowers
- `/gstack-ship` `/gstack-land-and-deploy` → 收尾由 superpowers
- `/gstack-review` → review 由 superpowers subagent + `/gstack-codex` 雙層

### Plugin 行為覆蓋總表

| 衝突點 | plugin 預設 | 本文件覆蓋 |
| --- | --- | --- |
| spec / plan 確認 | 自然語言對話 | `AskUserQuestion` |
| commit / PR 訊息 | 英文模板 | 本文件「Commit 訊息格式（繁中）」 |
| branch 操作 | skill 自行 checkout / merge | 過 Branch safety hook |
| task 追蹤 | skill 內建清單 | `TaskCreate` / `TaskUpdate` |
| DB 存取 | skill 可能用 bash CLI | mysql MCP only |
| 註解產出 | 預設無註解 / 英文註解 | 本文件「程式註解」（繁中） |

---

## 程式碼規範

### 程式註解（override 預設無註解方針）

- **Function / class**：docstring（繁中 + 各語言官方慣例）
- **非自明邏輯**：行內註解
- **原則**：WHAT 簡短 + WHY 重點
- **範圍**：新 code 全寫；改動區補齊；未動區不動；測試 docstring（測案 + 原因）
- **豁免**：trivial 一眼懂（純 getter、單行轉型）
- **plugin skill 產的 code 同樣套用**（superpowers TDD 寫的測試也要 docstring 含測案 + 原因）

---

## 版本控管

### Branch 命名

格式：`<type>/<short-desc>`

- **type**：`feat / fix / refactor / docs / chore / test / hotfix`
- **short-desc**：英文 kebab-case，3-5 字限
- 範例：`feat/user-auth-jwt`、`fix/login-redirect-loop`

### Commit 訊息格式（繁中）

```
<type>: <subject 50 字內，繁中>

<body 可選，72 字斷行，繁中>
- 列點說明 what / why
- 不寫 how（看 diff 即知）

<footer 可選>
Refs: #123
Breaking-Change: <說明>
```

- **type**：`feat / fix / refactor / docs / style / test / chore`
- **subject**：祈使句、動詞開頭、不結尾標點、50 字內
- **plugin skill 自動 commit 也採此格式**（superpowers TDD 每個紅綠循環的 commit / `finishing-a-development-branch` 的 squash commit 含）

### GitHub Flow（單線）

- 所有 feature 從 `main` 切出 → PR → squash merge 回 `main`
- 無 `develop` / `release` branch
- merge 後 remote feature branch 立刻刪（GitHub 設定 auto-delete）；local 由 `git fetch --prune` 同步清
- **禁** force push 到 `main / master`
- feature branch 可 `--force-with-lease`（禁裸 `--force`）

### Rebase vs Merge

- **PR 內**：feature branch 落後 main → `git rebase origin/main`
- **進 main**：squash merge（GitHub repo 預設 squash）

### 細則指向

commit 範例、PR title / body 模板、squash 細節、rebase 操作 → 載入 `git-workflow` skill 展開
