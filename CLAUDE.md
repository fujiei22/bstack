# CLAUDE.md

繁中台灣用語；英文專有名詞保留（brainstorm / Tier / Track / commit / PR / TDD）。

## 強制守則（無例外、優先於任何 skill）

### §事實核實（最高指導原則）
判斷資料模型 / 欄位用途 / schema / 廢棄 / 任何規劃前，**並行**驗 **儲存實際內容** + **codebase 使用點**、雙 source、缺一不可。單 source 推測常踩（名稱誤導、量少誤判廢、結構誤猜）。
- **儲存**：抽樣實資料（`SELECT * LIMIT N` / API GET / 讀檔）— 別只看 schema / 註解；「量少」≠「廢」；看關聯（外鍵 / parent_id / cascade）；**禁憑欄位名 / 表名假設語意**
- **Codebase**：grep 模型 / 表名全用法（含 test）；找寫入 / 讀取 / UI / 對外介面 / cascade / event / hook；確認「沒資料」是「未上線 / 沒人填 / 真死」哪種
- **下結論**：兩 source 都查才定論；MCP 抽樣 + Explore agent 都快、**沒理由跳**；規劃 / spec / plan / migration 前必跑；跨多表大改每結論在 spec / plan 附「樣本 + 使用點」雙引用

How：brainstorm 0b 並聯抽樣；write-plan / review-plan 涉資料每點附雙引用；db-reviewer / lang-reviewer 以此退件。

### §Task 追蹤
任務前先 `TaskCreate`；中途加新；start → `in_progress`；done → `completed`。skill 產的 task 走同一系統。

### §決策點選單
user 決策走 `AskUserQuestion`：推薦選項放第一 + 標「（推薦）」；平台附 `Other`。**禁文字 token NLP**（`approve / LGTM / 通過 / ✅` 不當 gate 信號）。

### §Branch safety
`~/.claude/hooks/branch-safety.ps1` 自動擋；命中 `main / master / production / prod / release` → block。處置：§決策點選單取 branch 名 → `git checkout -b <name>` → retry。`git checkout / merge / push` 受同 hook。

### §File-type 硬規則
`~/.claude/hooks/file-type-guard.ps1` 偵測；Hook 報的**不能跳**。

| 類型 | 範例 | 處置 |
|---|---|---|
| 密鑰 / secret | `.env`、`*.key`、`*.pem`、`credentials.*` | **禁 commit**、hook block |
| gitignore | `.gitignore`、`.dockerignore` | 二次確認 |
| CI / CD | `.github/workflows/*.yml`、`.gitlab-ci.yml` | 升 T2+、套 review |
| DB migration | `migrations/*.sql`、`prisma/migrations/`、`alembic/versions/` | 載 `db-access` + `db-reviewer`；DDL 大表 warn |
| 鎖檔 | `package-lock.json`、`bun.lock`、`poetry.lock` | 列 diff、二次確認 |
| Infra | `Dockerfile`、`docker-compose.yml`、`terraform/*.tf` | 套 review |
| Shell config | `.bashrc`、`.zshrc`、`.npmrc`、`.gitconfig` | 二次確認 |

### §PII 安全底線
PII（email / phone / 身分證 / 信用卡 / 地址 / id_number）原值**禁落**對話 / log / commit；輸出 mask 或 aggregate；WHERE 可原值（不落輸出）。DB / API / file / log 全套。

### §DB 操作
- **讀** `mcp__mysql__mysql_query`；禁 bash mysql / psql、禁手寫 SQL 貼對話讓 user 跑
- **寫** MCP 唯讀禁試跑；產 SQL 交 user 執行
- **量限** 預設 `LIMIT 100`；重 query 先 `EXPLAIN`；**PII** SELECT mask、WHERE 可原值
- **觸發** DB 詞 / brainstorm 0b / write-plan / execute-plan / review 需查 schema → 直接用 MCP；細則 → `db-access`

### §Docs 落檔（一 branch 一目錄）
dev-workflow 產出文件**全落** `docs/<branch-name>/`；不再用 `docs/plans/<topic>/` 或 `docs/reviews/<pr>.md`。
- **目錄**：`docs/<branch-name>/`（含 `<type>/` prefix，例 `docs/feat/user-auth-jwt/`）
- **檔名固定**：`spec.md`（brainstorm）/ `plan.md`（write-plan）/ `review.md`（review-plan）/ `pr-review.md`（pr-explain 覆寫；T0-T1 簡、T2-T3 詳）
- **時機**：T1+ brainstorm Phase 0 完成後**先 `git checkout -b <branch>` 再寫 spec**（branch-safety 雙保險）
- **覆寫**：plan / review / pr-review 同 branch 迭代覆寫；spec 修改靠 git history
- **不在此**：`docs/snapshots/`、`docs/incidents/<id>/` 維持原路徑
- **遷移**：本規則生效後新 branch 用新路徑；舊 PR 不主動搬

## 開發流程（dev-workflow 為骨幹）

「寫 / 改 / 修 / 加 / 重構 / 實作 / build / fix」類 prompt 一律進 `dev-workflow`。9 階段順序 / Track / hand-off state / Memory hook 細節見 dev-workflow body。

### §Tier 機制
| Tier | 量體 | brainstorm | plan | TDD | review | security |
|---|---|---|---|---|---|---|
| **T0** | 1 行 / typo / 設定 | 跳 | 跳 | 跳 | 跳 | 跳 |
| **T1** | ≤2 檔 / 單模組小改 | 對話釐清 | 跳 | 1-2 關鍵測試 | self | 跳 |
| **T2** | 3-10 檔 / 單模組 feature | 完整 | 用 + review (Eng) | 紅綠循環 | subagent + lang-reviewer | 涉認證 / 資料層才 audit |
| **T3** | >10 檔 / 跨模組 / 架構 / DB schema | 完整 | 用 + review (4 視角) | 紅綠、80% 目標 | 雙視角 + lang-reviewer | audit + checklist + db-reviewer |

Track（Bug / Dev）+ Tier 在 brainstorm 0c / 0d 判定、`AskUserQuestion` 確認。

### §Trace 標籤
每輪結尾：`[Trace] Phase=<x> | Tier=<T0-T3> | Track=<Bug/Dev/—> | Skill=<active>`。T0 / 純問答省。

### §Auto-fix
- **不危險**（typo / lint / 變數名 / 格式 / 註解 / 純 refactor）→ AI 自動修 + diff
- **危險**（DB schema / 認證 / payment / 檔案刪除 / dependency / infra / migration）→ `AskUserQuestion`
- **T3** 不危險也先 diff 再 commit

### §Fail handling
Task / verify / review fail → **不靜默重試**；評起因；`AskUserQuestion` 提 retry / adjust+retry / rollback / 回上層 Phase / escalate。細則 → `dev-workflow`。

### §Settings.json
`~/.claude/settings.json` 的 `permissions.allow` **僅限 read-only / 查詢類**；寫入類（Edit / Write / commit / push / checkout / rm / npm install）一律 prompt。

## 程式碼規範

### 程式註解（override 預設無註解）
- **Function / class** docstring（繁中 + 語言官方慣例）；**非自明邏輯** 行內註解
- **原則** WHAT 簡短 + WHY 重點
- **範圍** 新 code 全寫；改動區補齊；未動區不動；測試 docstring（測案 + 原因）
- **豁免** trivial 一眼懂（純 getter、單行轉型）

## 版本控管

### Branch 命名
`<type>/<short-desc>`、type ∈ `feat / fix / refactor / docs / chore / test / hotfix`、短英 kebab-case 3-5 字。例：`feat/user-auth-jwt`。

### Commit 訊息（繁中）
```
<type>: <subject 50 字內、祈使句、不結尾標點>

<body 可選，72 字斷行，列點 what / why、不寫 how>

<footer 可選> Refs: #123 / Breaking-Change: <說明>
```
type ∈ `feat / fix / refactor / docs / style / test / chore`。範例 + PR 模板 → `finish-branch`。

### GitHub Flow（單線）
- feature 從 `main` 切 → PR → squash merge；無 develop / release
- merge 後 remote feature branch 立刻刪；local `git fetch --prune` 清
- **禁** force push `main / master`；feature 可 `--force-with-lease`、禁裸 `--force`
- 落後 main → `git rebase origin/main`；進 main → squash merge

細則 → `finish-branch`。
