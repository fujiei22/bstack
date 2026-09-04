# bstack rules.md（規則書）

> 對 plugin 使用者：本檔由 `/devwork` 載入，不會進你的 CLAUDE.md；沒下 `/devwork` 時不套用。
> 對 bstack 貢獻者：repo 的 CLAUDE.md 會 `@import` 這份、整個 session 常駐，「沒下 /devwork 不套用」對 repo 自身開發不成立。兩邊不要各改各的。
> 位階等同 CLAUDE.md：與任何 skill 衝突時，本檔勝——**前提是它還在 context 裡**。經 `/devwork` 讀進來的內容會被 context 摘要洗掉，所以每個 phase skill 載入時若 context 找不到「§事實核實」這節，先重讀本檔再做事。

繁中台灣用語；英文專有名詞保留（brainstorm / Tier / Track / commit / PR / TDD）。

## 溝通風格

### §白話優先（所有對話輸出適用）

解釋技術問題、實作細節、失敗原因時，**術語與白話同時給**，不是二選一：

- `file watcher`（監看檔案變動的背景機制）
- `idempotent`（重複執行結果相同，跑幾次都不會壞）
- `overlap coefficient`（重疊係數，看兩組東西重疊多少的算法）

同時給的用意：原詞讓你能自己 google 查證，白話讓你當下就懂。

**寫法**
- **先給結論**再展開理由，不要鋪陳半天才講重點
- 用**具體例子**代替抽象描述——「這會怎樣」比「這是什麼」有用
- 講機制要附**後果**：壞掉會怎樣、誰受影響
- 比喻要貼才用；勉強的比喻比沒有更糟

**區分實測與推論**：講事實時交代依據是「實測」「官方文件」還是「推斷」。
禁把推論用肯定語氣講成事實。

**底線**：白話是為了讓人懂，不是為了模糊。檔名、行號、指令、數字一律精確，
不得為了口語化而含糊帶過。

**不適用**：commit message、code 註解、文件產出（spec / plan / review）維持既有規範。

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
plugin 的 `hooks/branch-safety.ps1`（PreToolUse）自動擋；命中 `main / master / production / prod / release` → block。處置：§決策點選單取 branch 名 → `git checkout -b <name>` → retry。hook 只攔 Write / Edit / NotebookEdit（見 `hooks/hooks.json` 的 matcher）；`git checkout / merge / push` 不經 hook，靠 finish-branch 的流程守則。

**豁免（實測 code 行為，非設計缺陷）**：hook 只管 `$CLAUDE_PROJECT_DIR` **底下**的檔。目標檔在 project repo 之外（例如 plugin 目錄內的檔、使用者的 Claude 設定目錄）一律放行，不論當前在哪個 branch。非 git repo、`git rev-parse` 失敗、stdin JSON 解析失敗也都放行——hook 不因自身錯誤擋人。**意思是：改 repo 以外的設定沒有 branch 保護，那是靠自律的區域。** 另外 hook 隨 plugin 在啟用它的每個專案生效、不需要 `/devwork`；不想要就 `/plugin disable bstack@bstack`。

### §File-type 硬規則
plugin 的 `hooks/file-type-guard.ps1` 偵測；Hook 報的**不能跳**。

| 類型 | 範例 | 處置 |
|---|---|---|
| 密鑰 / secret | `.env`、`*.key`、`*.pem`、`credentials.*` | **禁 commit**、hook block |
| ignore 檔 | `.dockerignore` | 二次確認（`.gitignore` 刻意不列：改動頻繁，攔它的干擾大於收益） |
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

### §設計語言對齊
動任何**前端檔**（`.css` `.scss` `.tsx` `.jsx` `.vue` `.svelte` `.html`）之前，**先讀該區塊的既有設計語言**——載 `design-language`，從實際檔案抄 exact values，不憑印象重畫。

> **豁免：只改文字節點時不適用。** 改的是 HTML／JSX 裡的**文字內容**，完全不碰 token、class、屬性、標籤結構、版面——這種改動 `design-language` 管不到（它管色碼、字級、斷點、dark mode），載了也只會得到一份用不上的設計語言摘要。
> **邊界**：只要動到 `class` / `style` / 任何屬性值 / 標籤增刪，就不算文字節點改動，規則照舊適用。判不出來就當作適用。
> 實測依據：2026-09-03 潤 `docs/index.html` 文案時撞到——規則字面命中 `.html`，實質完全不適用，而執行的 agent 只能自己推豁免理由。

- **判定** brainstorm Phase 0b′ 產出 `design.{involved, scope, scope_evidence, size, precedent, map_status}`，與 Track / Tier 合併一個 `AskUserQuestion` 一次確認。**0b′ 必跑**（含純後端 task；第一步是零成本的副檔名比對，不命中就結束）
- **小改**（沿用既有 token、無新視覺決策）→ 直接改 code，改完跑**四項對齊檢查**（元件狀態 / 斷點 / 表單 / dark mode；該區客觀上無此維度 → 標 N/A 並附依據）
- **大改**（新頁 / 新區塊 / 改版）→ 先出三方向真實視覺讓 user 選，選定才落 code
- **禁止用 Tier 推導 `design.size`** 兩根尺各自判：Tier 量 code 改動量體，`size` 量新視覺決策的量體，兩者系統性錯開
- **禁止拿別區的 token 值頂替** 抽不到就說抽不到——頂替就是「把前台樣式套到後台」的起點

細則 → `design-language`（區塊偵測 / 抽取 / 對齊清單）。

### §Docs 落檔（按壽命分，不按文件類型分）
dev-workflow 產出文件**全落** `docs/work/<branch-name>/`；不再用 `docs/plans/<topic>/`、`docs/reviews/<pr>.md`、`docs/test-reports/<branch>/`。
按 feat / fix / refactor 分類在 merge 之後沒有資訊量——找文件用主題找，不用類型找。

| 目錄 | 放什麼 | 壽命 |
|---|---|---|
| `docs/work/<branch-name>/` | 施工中的 spec / plan / review / pr-review / 測試報告 | 到 merge |
| `docs/archive/<年>/<主題>/` | merge 後從 work 搬進來，備查 | 長期 |
| `docs/paused/<主題>/` | 有 spec / plan 但查無實作 commit（丟 archive 會被誤認做過了） | 到解凍 |
| `docs/reference/` | 跨 branch 有效、明年還會打開的參考 | 長期 |
| `docs/incidents/<id>/` | 事故調查（不綁 branch） | 長期 |
| `docs/snapshots/`、`docs/retros/` | context 快照 / 回顧 | 暫存 |

- **目錄**：`docs/work/<branch-name>/`（含 `<type>/` prefix，例 `docs/work/feat/user-auth-jwt/`）
- **檔名固定**：`spec.md`（brainstorm）/ `plan.md`（write-plan）/ `review.md`（review-plan）/ `pr-review.md`（pr-explain 覆寫；T0-T1 簡、T2-T3 詳）
- **時機**：T1+ brainstorm Phase 0 完成後**先 `git checkout -b <branch>` 再寫 spec**（branch-safety 雙保險）
- **覆寫**：plan / review / pr-review 同 branch 迭代覆寫；spec 修改靠 git history
- **merge 後搬檔**：finish-branch 把 `docs/work/<branch-name>/` 移到 `docs/archive/<年>/<主題>/`
- **進 reference 的門檻**：這份寫的是「規則」還是「做過一次的紀錄」？規則才進。一次性調查 / 量測 / 事故報告的**結論寫進 memory**，報告本體進 archive
- **檔名不放日期**：目錄已表達時序，日期放檔名會讓同一主題散在多處
- **commit 與否看專案**：docs 被 `.gitignore` 排除的專案就不 commit，別硬 `git add`（會直接報錯）
- **遷移**：本規則生效後新 branch 用新路徑；舊 PR 不主動搬

## 開發流程（dev-workflow 為骨幹）

流程由 `/devwork <要做的事>` 啟動：devwork skill 載入本規則書後進 `dev-workflow`；沒下指令時不套用本規則書。9 階段順序 / Track / hand-off state / Memory hook 細節見 dev-workflow body。

### §Tier 機制
| Tier | 量體 | brainstorm | plan | TDD | review | security |
|---|---|---|---|---|---|---|
| **T0** | 1 行 / typo / 設定 | 跳 | 跳 | 跳 | 跳 | 跳 |
| **T1** | ≤2 檔 / 單模組小改 | 對話釐清 | 跳 | 1-2 關鍵測試 | self | 跳 |
| **T2** | 3-10 檔 / 單模組 feature | 完整 | 用 + review (Eng) | 紅綠循環 | subagent + lang-reviewer | 涉認證 / 資料層才 audit |
| **T3** | >10 檔 / 跨模組 / 架構 / DB schema | 完整 | 用 + review (4 視角) | 紅綠、80% 目標 | 雙視角 + lang-reviewer | audit + checklist + db-reviewer |

Track（Bug / Dev）+ Tier 在 brainstorm 0c / 0d 判定、`AskUserQuestion` 確認。

### §協作模式判定（Agent Teams gate）
判「這件事要不要開 Agent Teams」。**判準是工作者之間要不要互相講話，不是能不能平行**——能平行但不用溝通的工作，subagent 就夠、且便宜得多。

三條**全中**才提議：
1. **可切 ≥3 塊互不依賴**，且每塊擁有**不同檔案 / 目錄**（會撞同一批檔 → 不開）
2. **工作者之間需要互相反駁或交換發現**，或你要中途切進某個工作者改方向（只要結果不要過程 → subagent）
3. **量體 T2+**（T0-T1 協調成本大於收益，直接跳）

三條全中 → `AskUserQuestion` 問跑法（Agent Teams / subagent 平行 / 單一 session 串行），照 §決策點選單：建議選項第一 + 標「（推薦）」，每個選項附**代價**。推薦哪個依判定實據決定，**不預設 Agent Teams**。

- **禁自行開隊友**：判定只產生選項，一律等 user 選。
- **唯讀 fan-out 一律 subagent**：review / 驗證 / 稽核類（review-plan 多視角、request-review 雙視角、incident-investigate 多假設、security-audit）**不開隊友、也不問**。兩個理由：這些工作沒人在動檔（判準 1「不同檔案 / 目錄」的實質是防互蓋，唯讀時不成立），且**獨立性本身就是產出價值**——讓驗證者互相聽到彼此結論會污染判斷，等於拆掉 fan-out 的唯一紅利。
- **開關偵測**：`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` 未設時無法開隊友；選單改列「先開開關（需重開 session）」、其餘照常。
- **成本告知**：每個隊友是完整一份 Claude Code、各自載入全套 CLAUDE.md + skill，token 隨隊友數線性疊加。

觸發點：**只有一個**——`execute-plan` 遇 `parallel-group` 同號多 task 而載入 `dispatch-parallel` 時。9 階段裡只有這裡同時滿足「要互相講話」× 「有人在動同一批檔」。判準表 / 選單範本 / 隊友派工範本 → `dispatch-parallel` §協作模式判定。

### §Trace 標籤
每輪結尾：`[Trace] Phase=<x> | Tier=<T0-T3> | Track=<Bug/Dev/—> | Skill=<active>`。T0 / 純問答省。

### §Auto-fix
- **不危險**（typo / lint / 變數名 / 格式 / 註解 / 純 refactor）→ AI 自動修 + diff
- **危險**（DB schema / 認證 / payment / 檔案刪除 / dependency / infra / migration）→ `AskUserQuestion`
- **T3** 不危險也先 diff 再 commit

### §Fail handling
Task / verify / review fail → **不靜默重試**；評起因；`AskUserQuestion` 提 retry / adjust+retry / rollback / 回上層 Phase / escalate。細則 → `dev-workflow`。

### §Settings.json
專案 `.claude/settings.json` 的 `permissions.allow` **僅限 read-only / 查詢類**（範本：https://github.com/fujiei22/bstack/blob/main/templates/project-settings.json）；寫入類（Edit / Write / commit / push / checkout / rm / npm install）一律 prompt。個人偏好走 `scripts/extras.ps1` 逐項選層級，本流程不主動寫使用者層級的 settings。

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
