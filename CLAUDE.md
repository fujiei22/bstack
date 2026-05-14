# CLAUDE.md

繁中台灣用語；英文專有名詞保留原文（brainstorm / Tier / Track / commit / PR / TDD）。

---

## 強制守則（無例外）

> 本段所有規則**優先於**任何 skill 行為。衝突時本段勝、skill 須讓位。

### §Task 追蹤

任務前先 `TaskCreate`；中途加新補進；start → `in_progress`；done → `completed`。skill 產的 task 走同一系統、不另開 tracking。

### §決策點選單

所有 user 決策點走 `AskUserQuestion`：推薦選項放第一 + 標「（推薦）」；平台自動附 `Other`、caller 不手動加。**禁文字 token NLP 判斷**（不接受 `approve / LGTM / 通過 / ✅` 等自由文字當 gate 信號）。

### §Branch safety

寫入動作由 PreToolUse hook 自動檢查（`~/.claude/hooks/branch-safety.ps1`）。命中 `main / master / production / prod / release` → block。處置：走 §決策點選單取 branch 名 → `git checkout -b <name>` → retry。任何 skill 的 `git checkout / merge / push` 受同一 hook 管制。

### §File-type 硬規則

由 `~/.claude/hooks/file-type-guard.ps1` 自動偵測。Hook 報的問題**不能跳過**。

| 類型 | 範例 | 處置 |
|---|---|---|
| 密鑰 / secret | `.env`、`*.key`、`*.pem`、`credentials.*` | **禁 commit**；hook block |
| gitignore | `.gitignore`、`.dockerignore` | `AskUserQuestion` 二次確認 |
| CI / CD | `.github/workflows/*.yml`、`.gitlab-ci.yml`、`.circleci/*` | 自動升 T2+、套 review |
| DB migration | `migrations/*.sql`、`prisma/migrations/`、`alembic/versions/` | 載 `db-access` + `db-reviewer`；DDL 大表 warn |
| 鎖檔 | `package-lock.json`、`bun.lock`、`Gemfile.lock`、`poetry.lock` | 列 diff、user 二次確認 |
| Infra | `Dockerfile`、`docker-compose.yml`、`terraform/*.tf`、`*.k8s.yml` | 套 review |
| Shell config | `.bashrc`、`.zshrc`、`.npmrc`、`.gitconfig` | `AskUserQuestion` 二次確認 |

### §PII 安全底線

PII（email / phone / 身分證 / 信用卡 / 地址 / id_number）原值**禁落**對話 / log / commit。輸出 mask 或 aggregate；WHERE 條件可原值（不落輸出）。適用 DB / API / file / log 全部，任何 skill 輸出同樣套用。

### §DB 操作

- **讀** → `mcp__mysql__mysql_query`；禁 bash mysql / psql CLI、禁手寫 SQL 貼對話讓 user 跑
- **寫** → MCP 帳號唯讀禁試跑；產 SQL 交 user 執行
- **量限** 預設 `LIMIT 100`；重 query 先 `EXPLAIN`
- **PII** SELECT 輸出 mask；WHERE 可原值
- **觸發** prompt 含 DB 關鍵詞、或 brainstorm 0b / write-plan / execute-plan / review 階段需查 schema → 直接用 MCP、無需等 user 開口
- 細則 → `db-access`

---

## 開發流程（dev-workflow 為骨幹）

任何「寫 / 改 / 修 / 加 / 重構 / 實作 / build / fix」類 prompt 一律進 `dev-workflow` skill。本段政策聲明、9 階段順序 / Track 路徑 / hand-off state / Memory hook（brainstorm 0a 讀 / retro 補）細節見 dev-workflow body。

### §Tier 機制

| Tier | 量體 | brainstorm | plan | TDD | review | security |
|---|---|---|---|---|---|---|
| **T0** | 1 行 / typo / 設定 | 跳 | 跳 | 跳 | 跳 | 跳 |
| **T1** | <3 檔 / 單模組小改 | 對話釐清 | 跳 | 1-2 關鍵測試 | self | 跳 |
| **T2** | 3-10 檔 / 單模組 feature | 完整 | 用 + review (Eng) | 紅綠循環 | subagent + lang-reviewer | 涉認證 / 資料層才 audit |
| **T3** | >10 檔 / 跨模組 / 架構 / DB schema | 完整 | 用 + review (4 視角) | 紅綠循環、80% 目標 | 雙視角 + lang-reviewer | audit + checklist + db-reviewer |

Track（Bug / Dev）+ Tier（T0-T3）在 brainstorm Phase 0c / 0d 判定、`AskUserQuestion` 確認。

### §Trace 標籤

每輪回覆**結尾**貼：`[Trace] Phase=<x> | Tier=<T0-T3> | Track=<Bug/Dev/—> | Skill=<active>`。T0 全程省、純問答對話可省。

### §Auto-fix 原則

- **不危險類**（typo / lint / 變數名 / 格式 / 註解 / 純 refactor）→ AI 自動修 + diff 給 user 看
- **危險類**（DB schema / 認證 / payment / 檔案刪除 / dependency / infra / migration）→ `AskUserQuestion` 問
- **T3** 即使「不危險類」也先 diff 再 commit

### §Fail handling

Task / verify / review fail → **不靜默重試**；評起因；`AskUserQuestion` 提 retry / adjust+retry / rollback / 回上層 Phase / escalate。細則 → `dev-workflow §Fail handling`。

### §Settings.json 政策

`~/.claude/settings.json` 內 `permissions.allow` **僅限 read-only / 查詢類** tool 與 command。寫入類（Edit / Write / commit / push / checkout / rm / npm install 等）**一律 prompt**、不進 allow 清單。

---

## 程式碼規範

### 程式註解（override 預設無註解方針）

- **Function / class** docstring（繁中 + 各語言官方慣例）；**非自明邏輯** 行內註解
- **原則** WHAT 簡短 + WHY 重點
- **範圍** 新 code 全寫；改動區補齊；未動區不動；測試 docstring（測案 + 原因）
- **豁免** trivial 一眼懂（純 getter、單行轉型）

---

## 版本控管

### Branch 命名

格式 `<type>/<short-desc>`、type ∈ `feat / fix / refactor / docs / chore / test / hotfix`、short-desc 英文 kebab-case 3-5 字。例：`feat/user-auth-jwt`。

### Commit 訊息格式（繁中）

```
<type>: <subject 50 字內，繁中、祈使句、不結尾標點>

<body 可選，72 字斷行，列點 what / why、不寫 how>

<footer 可選> Refs: #123 / Breaking-Change: <說明>
```

type ∈ `feat / fix / refactor / docs / style / test / chore`。範例與 PR title / body 模板見 `finish-branch`。

### GitHub Flow（單線）

- feature 從 `main` 切出 → PR → squash merge 回 `main`；無 develop / release branch
- merge 後 remote feature branch 立刻刪、local 由 `git fetch --prune` 同步清
- **禁** force push 到 `main / master`；feature branch 可 `--force-with-lease`（禁裸 `--force`）
- PR 內 落後 main → `git rebase origin/main`；進 main → squash merge

細則（commit / PR / squash / rebase 操作）→ `finish-branch`。
