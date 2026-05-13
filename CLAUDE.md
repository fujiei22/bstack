# CLAUDE.md

## 對話風格

- 語言：繁中台灣用語
- 英文專有名詞保留原文（如 brainstorm / Tier / Track / commit / PR / TDD）

---

## 強制守則（無例外）

> 本段所有規則**優先於**任何 skill 行為。
> 衝突時，本段勝；skill 自有流程須讓位、改走本段機制。

### §Task 追蹤

執行任務前先用 `TaskCreate` 建出準備執行的 task 清單。

- 流程中需加新 task → `TaskCreate` 補進
- 開始執行 → `TaskUpdate` `in_progress`
- 完成 → `TaskUpdate` `completed`
- **skill 產的 plan / task 清單也要落到 `TaskCreate`**，不另開 tracking 系統

### §決策點選單

所有 user 決策點（gate / branch 名 / tier / track / fix / PR 模板等）**主走 `AskUserQuestion`**：

- 推薦選項放第一 + label 加「（推薦）」
- 平台自動附 `Other`（caller 不手動加）
- **禁文字 token NLP 判斷**（不接受 `approve / LGTM / go / 通過 / ✅` 等自由文字當 gate 信號）
- **任何 skill 的 gate point 一律改用 `AskUserQuestion`**

### §Branch safety

寫入動作（Write / Edit / NotebookEdit）由 PreToolUse hook 自動檢查（`~/.claude/hooks/branch-safety.ps1`）。

- 命中 `main / master / production / prod / release` → block
- 處置：走 §決策點選單 取 branch 名 → `git checkout -b <name>` → retry
- **任何 skill 的 git 操作受同一 hook 管制**：checkout / merge / push 一律先過 hook

### §File-type 硬規則

特定檔案類型在 Edit / Write / commit 前必須額外把關。由 `~/.claude/hooks/file-type-guard.ps1` 自動偵測。

| 類型 | 範例 | 處置 |
|---|---|---|
| 密鑰 / secret | `.env`、`*.key`、`*.pem`、`credentials.*` | **禁 commit**；hook 直接 block |
| gitignore | `.gitignore`、`.dockerignore` | 改動 → `AskUserQuestion` 二次確認 |
| CI / CD | `.github/workflows/*.yml`、`.gitlab-ci.yml`、`.circleci/*` | 改動自動升 T2+、套 review 流程 |
| DB migration | `migrations/*.sql`、`prisma/migrations/`、`alembic/versions/` | 改動載入 `db-access` + `db-reviewer`；DDL 大表 warn |
| 鎖檔 | `package-lock.json`、`bun.lock`、`Gemfile.lock`、`poetry.lock` | 改動列 dependency diff、user 二次確認 |
| Infra | `Dockerfile`、`docker-compose.yml`、`terraform/*.tf`、`*.k8s.yml` | 改動套 review 流程 |
| Shell config | `.bashrc`、`.zshrc`、`.npmrc`、`.gitconfig` | 改動 → `AskUserQuestion` 二次確認 |

Hook 報的問題**不能跳過**；如需修改該類檔案，先在對話中說明動機與影響，再由 user 確認。

### §PII 安全底線

PII（email / phone / 身分證 / 信用卡 / 地址 / id_number）原值禁落對話 / log / commit。

- 輸出須 mask 或改 aggregate
- WHERE 條件可原值比對（不落輸出即可）
- 適用：DB / API response / file / log 全部
- **任何 skill 的 review / QA / 安全稽核輸出同樣套用**

### §DB 操作

- **讀**：用 `mcp__mysql__mysql_query`；禁 bash mysql / psql CLI、禁手寫 SQL 貼對話讓 user copy 跑
- **寫**（INSERT / UPDATE / DELETE / DDL / TRUNCATE）：mysql MCP 帳號**唯讀**，禁試跑；產 SQL 交 user 執行
- **量限**：預設 `LIMIT 100`；重 query 先 `EXPLAIN`
- **PII**：SELECT 輸出含 PII 欄位 → mask 或 aggregate；WHERE 條件可原值（不落輸出）
- **觸發**：
  - user prompt 含 DB / SQL / mysql / schema / query / table / 表 / 欄位 / SELECT / INSERT / UPDATE / DELETE / DDL / migration 任一關鍵詞
  - **brainstorm 0b / write-plan / execute-plan / review 等 phase 主動查 DB**：規劃或實作階段為了確認 schema / 既有資料 / 欄位型別 / 索引 / 資料量等資訊需要查 DB 時，**直接用 mysql MCP**，無需等 user 開口
- **細則**（mask SQL 範例、寫操作交付模板、DDL 大表注意事項）→ 載入 `db-access` skill 展開

---

## 開發流程（dev-workflow 為骨幹）

> 任何「寫 / 改 / 修 / 加 / 重構 / 實作 / build / fix」類 user prompt 一律進 `dev-workflow` skill。
> dev-workflow 負責整體 routing（Track 分流 + Tier 判定 + Phase 順序 + skill dispatch + hand-off）。
> 本段為政策聲明；細則由 `dev-workflow` skill 展開。

### §Track 分流（Phase 0 內判定）

| Track | 觸發 | 路徑 |
|---|---|---|
| **Bug** | 修現有錯誤、行為不如預期 | brainstorm → debug-systematic（T2+ 加 incident-investigate）→ verify-done → review → security → finish-branch → pr-explain |
| **Dev** | 加新功能、refactor、新 module | brainstorm → write-plan → review-plan → execute-plan + tdd-cycle → verify-done → review → security → finish-branch → pr-explain |

Track 判定在 brainstorm Phase 0c 完成、輸出進 dev-workflow state。

### §Tier 機制

每個 task 都帶一個 Tier（T0-T3）。brainstorm Phase 0d 預判 + `AskUserQuestion` 確認。Tier 控嚴格度：

| Tier | 量體 | brainstorm | plan | plan review | TDD | subagent | code review | 安全 |
|---|---|---|---|---|---|---|---|---|
| **T0** | 1 行 / typo / 設定 | 跳 | 跳 | 跳 | 跳 | 跳 | 跳 | 跳 |
| **T1** | <3 檔 / 單模組小改 | 對話釐清 | 跳 | 跳 | 1-2 個關鍵測試 | 跳 | self | 跳 |
| **T2** | 3-10 檔 / 單模組 feature | 完整 | 用 | review-plan (Eng-only) | 紅綠循環 | 可選 | request-review + lang-reviewer | 涉認證 / 資料層才 security-audit |
| **T3** | >10 檔 / 跨模組 / 架構 / DB schema | 完整 | 用 | review-plan (4 視角) | 紅綠循環、80% 目標 | 用 | 雙視角 + lang-reviewer | security-audit + security-checklist + db-reviewer |

### §Phase 0 入口分流

brainstorm skill 內建 4 子步驟：

1. **0a 對話釐清** — paraphrase 確認、反問補足；同時讀 memory（user 偏好 / 領域背景 / 過去關鍵決策）
2. **0b 看 codebase** — Read / Grep 影響檔案、列 dep。若 prompt 含 DB 關鍵詞，載入 `db-access`
3. **0c Track 判定** — Bug or Dev → `AskUserQuestion` 確認
4. **0d Tier 判定** — T0-T3 → `AskUserQuestion` 確認

T0 在 0d 後直接跳到實作；T1+ 帶 Track + Tier 進階段 2-9。

### §流程階段順序（9 階段）

```
1. brainstorm        （含 Phase 0：0a / 0b / 0c / 0d）
2. write-plan        （Dev track only；含並行性分析；落 docs/plans/<plan-name>.md）
   └→ review-plan    （T2 Eng-only / T3 4 視角 CEO+Design+Eng+DX）
3. execute-plan      （+ tdd-cycle；遇並行 group 載 dispatch-parallel）
4. verify-done       （T2+ 多輪 verify；T3 UI 改動加 browser e2e）
5. request-review    （T1 跳 / T2 subagent + lang-reviewer / T3 雙視角 + lang-reviewer）
   └→ receive-review
6. security-audit    （T2 涉認證 / 資料層才用；T3 必用）
   + security-checklist + db-reviewer  （T3 DB 改動時）
7. finish-branch     （含 git-workflow + branch-safety）
8. pr-explain        （PR 開好後，依檔分 section、解釋意圖 + 每行 code + 關聯，落 docs/reviews/<pr-id>.md）
9. weekly-retro      （手動觸發；Memory hook 補）
```

### §Trace 標籤

每輪 AI 回覆**結尾**貼一行 Trace 標籤，方便除錯 / 審核：

```
[Trace] Phase=<phase-name> | Tier=<T0/T1/T2/T3> | Track=<Bug/Dev/—> | Skill=<active-skill>
```

範例：`[Trace] Phase=execute-plan | Tier=T2 | Track=Dev | Skill=execute-plan`

**例外**：
- Trivial 對話（純問答、無 phase 推進）可省略
- T0 task 全程省略

### §Auto-fix 原則

Review / 安全稽核 / verify 發現問題後：

- **不危險類**（typo / lint / import 順序 / 變數名 / 格式 / 註解 / 純 refactor）→ AI **自動修**、修完把 diff 給 user 看
- **危險類**（DB schema / 認證邏輯 / payment / 檔案刪除 / dependency 改動 / infra 改動 / migration）→ `AskUserQuestion` 問 user 該不該修、怎麼修

T3 即使「不危險類」也應先讓 user 看 diff 才提交。

### §Fail handling

Task fail / verify fail / review 嚴重打槍時：

1. AI **不靜默重試**
2. AI **評起因**（實作錯 / plan 錯 / test 設定錯 / 架構假設錯 / 需求理解錯）
3. `AskUserQuestion` 提 3-4 個選項給 user 選：
   - **retry**（同樣作法再跑一次，適偶發 / 暫態）
   - **adjust + retry**（AI 提具體調整方案，user 點頭後跑）
   - **rollback**（git 回前一個 commit / clean working tree，從頭來）
   - **回上層 Phase 重規劃**（回到 brainstorm 或 write-plan）
   - **escalate**（user 接手）

### §Memory hook

`brainstorm` 與 `weekly-retro` 兩個 phase 與 memory 系統互動：

- **brainstorm 0a** — **讀** memory：user 偏好 / 領域背景 / 過去關鍵決策。讀進來作為 context，影響 0b / 0c / 0d 判定
- **weekly-retro** — **補** memory：分析本週 git log / PR / TaskList 抽反覆出現的模式（user 偏好 / AI 犯錯 / 領域 lesson） → 產 memory 更新 proposal → user review 後寫入

其他 phase 預設**不**主動 hook memory（避免雜訊）。

### §Settings.json 政策

`~/.claude/settings.json` 內 `permissions.allow` 全局允許清單，僅限 **read-only / 查詢類** tool 與 command：

- `Read`、`Glob`、`Grep`、`TaskCreate`、`TaskUpdate`、`TaskList`、`TaskGet`、`AskUserQuestion`
- `Bash(git status:*)`、`Bash(git diff:*)`、`Bash(git log:*)`、`Bash(git branch:*)`、`Bash(ls:*)`、`Bash(pwd)`
- `mcp__mysql__mysql_query`（mysql MCP 帳號本身唯讀）

寫入類（`Edit`、`Write`、`NotebookEdit`、`Bash(git commit:*)`、`Bash(git push:*)`、`Bash(git checkout:*)`、`Bash(rm:*)`、`Bash(npm install:*)` 等）**一律 prompt**，不進 allow 清單。

### §Skill index

完整 skill 清單與 routing 細節見 `dev-workflow` skill：

- **Phase 階段 skill**：brainstorm、write-plan、review-plan、execute-plan、tdd-cycle、verify-done、request-review、receive-review、security-audit、security-checklist、finish-branch、pr-explain、weekly-retro
- **跨流程 skill**：debug-systematic、incident-investigate、lock-files、cmd-guard、safety-guard、context-snapshot、context-resume、frontend-test
- **Meta skill**：write-skill、dispatch-parallel
- **既有 skill**：db-access、git-workflow
- **Agents**：db-reviewer、lang-reviewer（python-reviewer / typescript-reviewer / sql-reviewer / golang-reviewer / ... 動態 dispatch）

---

## 程式碼規範

### 程式註解（override 預設無註解方針）

- **Function / class**：docstring（繁中 + 各語言官方慣例）
- **非自明邏輯**：行內註解
- **原則**：WHAT 簡短 + WHY 重點
- **範圍**：新 code 全寫；改動區補齊；未動區不動；測試 docstring（測案 + 原因）
- **豁免**：trivial 一眼懂（純 getter、單行轉型）
- **任何 skill 產的 code 同樣套用**

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
- **skill 自動 commit 也採此格式**

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
