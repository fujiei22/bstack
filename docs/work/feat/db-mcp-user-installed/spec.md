# DB MCP 統一用 DBHub，使用者用設定小工具自裝
> Track: Dev | Tier: T3 | 建立: 2026-11-09

## 動機 / Why
- 規則目前只認 `mcp__mysql__mysql_query`，但團隊專案可能是 PostgreSQL / SQL Server / SQLite / Oracle / MariaDB。
- 前一版做法（`feat/plugin-db-mcp-dbhub`，沒 push）把 DBHub 綁進 plugin。2026-11-09 user 決定**不內建**，理由是體積與首次啟動逾時：硬碟 115 MB，首次啟動 38–58 秒，超過 Claude Code 等待的 30 秒。
- 2026-11-09 調查各 DB 的 MCP（subagent 報告，出處附在 plan Task 1）。結論是每種 DB 唯一同時做到「工具本身強制唯讀」又還在維護的，只有 DBHub：
  - 官方 postgres / sqlite server 已封存，且有唯讀繞過或寫入工具。
  - MariaDB 官方版已 deprecated。
  - Oracle SQLcl 只靠帳號權限。
  - user 決定**全部統一用 DBHub**，包含 MySQL，取代現用的 mysql MCP。
- DBHub 的唯讀只能寫在 TOML 設定檔：1.6.0 的 CLI 旗標與 env 已移除。只用 `--dsn` 裝**不是唯讀**。所以要給一支小工具，替使用者寫好設定。

## 目標 / Success criteria
- **設定小工具** `scripts/db-setup.mjs`（node，user 在終端機跑）：
  - 問 DB 種類、主機、埠、庫名、帳號；SQLite 改問檔案路徑。
  - 問密碼時輸入不回顯，**不經 AI 對話**（rules.md §PII 與機密底線）。
  - 寫唯讀設定：`readonly=true`、`max_rows=100`，使用者不能關。
  - 用同一套設定試連一次，跑 `SELECT 1` 等價查詢；失敗就清楚說原因，不註冊。
  - 預先下載 DBHub，解掉首次啟動逾時。
  - 註冊到 Claude Code：預設**本專案範圍**（存在使用者電腦、不進 git）。
  - 註冊到 Codex：支援專案層就用專案層；不支援就用使用者層，並寫明。
  - 重跑可以覆蓋；有 `--remove` 可移除。
  - 密碼特殊字元自動編碼（沿用舊 branch `normalizeDsn` 的實測做法）。
- **固定 server 名 `bstackdb`** → 兩個 host 的工具名都是 `mcp__bstackdb__execute_sql`。規則、db-access、db-reviewer 白名單只認這一個名字。
- 規則書 §DB 操作：讀取用 `mcp__bstackdb__execute_sql`；禁 bash `mysql` / `psql` / `sqlcmd` / `sqlite3` / `sqlplus`；工具不在 → `db-access` §工具不在，提示跑小工具。
- `db-access` 沿用舊 branch 的多方言內容：
  - LIMIT / TOP / FETCH FIRST 的方言差異。
  - 首次查詢比對庫名。
  - §工具不在。
  - 四種方言的 mask 範例。
- DBHub **1.6.0**：推薦前用探測腳本重跑 MySQL / PostgreSQL / SQLite 唯讀攻擊，除已知放行項外全擋。SQL Server / Oracle 標「未實測」，文件要求唯讀帳號。
- 舊 `mysql` MCP 不留退路；README 升級段寫移除指令。
- `node scripts/plugin-contract.mjs` ALL PASS，`gen-codex-agents --check` 綠，`build-references -Check` 綠。

## 範圍 / Scope
**包含**：
- 新增：`scripts/db-setup.mjs` 與其純函式模組，含契約測試；`scripts/dbhub-readonly-probe.mjs`，從舊 branch 搬來並改用 1.6.0。
- 規則與 skill：
  - rules.md §DB 操作 / §事實核實 的「儲存端工具不在」句 / 抽象動詞表 MCP 列。
  - hosts.md §MCP 工具。
  - db-access。
  - headless-mode §分流表：`db-access/tool-missing`、`db-access/db-mismatch`。
  - brainstorm DB 關鍵詞。
  - session-team 一處提及。
- agent：db-reviewer、lang-reviewer、`gen-codex-agents.mjs` 與 `codex/agents/*.toml` 重產。
- 腳本：extras.ps1、install-codex.ps1 的 mysql 範本改成指向小工具。
- 文件：README、install.md、docs 站文字節點。
- 其他：契約、版本升 1.14.0。

**排除**：
- plugin 自帶 DB MCP（`.mcp.json` 不動）。
- 安裝表單。
- 讓 AI 代填密碼。
- 一個專案同時接多個資料庫。
- 改 PII mask 規則本身。
- 自動移除使用者既有的 `mysql` MCP：小工具偵測到時印移除指令，不代刪。

## 影響檔案 / Codebase impact
| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `scripts/db-setup.mjs`（+ 純函式模組） | new | 寫錯唯讀設定 = 可寫入；密碼回顯或進紀錄；Windows `npx` 要經 `cmd /c` |
| `scripts/dbhub-readonly-probe.mjs` | new（搬） | 只對拋棄式庫跑 |
| `skills/devwork/rules.md` | edit | 全 session 常駐；工具名錯 = DB 查詢全停 |
| `skills/devwork/hosts.md` §MCP 工具 | edit | 兩 host 的設定方式 |
| `skills/db-access/SKILL.md` | edit | 方言範例錯會產出錯 SQL |
| `skills/headless-mode/SKILL.md` | edit | 分流表兩列 |
| `skills/brainstorm/SKILL.md`、`skills/session-team/SKILL.md` | edit | 一處提及 |
| `agents/db-reviewer.md`、`agents/lang-reviewer.md` | edit | 白名單漏列 = 查不了 |
| `scripts/gen-codex-agents.mjs`、`codex/agents/*.toml` | edit / 重產 | Codex agent MCP 範本 |
| `scripts/extras.ps1`、`scripts/install-codex.ps1` | edit | `-SelfTest` 要照過 |
| `scripts/plugin-contract.mjs` | edit | 不能恆綠 |
| `README.md`、`docs/install.md`、`docs/index.html`、`docs/js/data.js`、`docs/js/references-data.js` | edit | 公開站 merge 即上線；html / data.js 只改文字 |
| 三處版本號 | edit | 不升版使用者拿不到 |

## 設計方向
`docs/index.html` / `docs/js/data.js` 只改文字節點，適用 rules.md §設計語言對齊 豁免，`design.involved=false`。

## DB 影響
不改任何專案的 schema。實測沿用本機拋棄式庫 `bstack_dbhub_test`（MySQL 8 / PostgreSQL 18），驗收完由 user 刪。

## 可沿用的前次實測（舊 branch，2026-11-06，DBHub 1.5.1）
- 唯讀攻擊全擋：SQLite 16 種、MySQL 26 種、PostgreSQL 20 種；`max_rows` 截斷生效。
- TOML 支援 `${ENV}` 引用 → 密碼可以不進 TOML。
- DBHub 會讀 cwd 的 `.env`，`READONLY` / `MAX_ROWS` / `ID` 有值時 exit 1 或 throw。使用者自裝時 cwd 是專案目錄，1.6.0 行為要重測。
- 密碼未編碼 → 連不上，且紀錄外露後半段密碼。
- Claude Code 使用者自加的 MCP 工具名是 `mcp__<server>__<tool>`。

## 風險與 trade-off
- **使用者多一個步驟**：要自己跑一次小工具。換來的是不用 DB 的人零影響、首次逾時在設定時解掉。
- **密碼存放**：Claude Code 寫在 `~/.claude.json` 的 MCP env（明文，與現用 mysql MCP 相同）；Codex 寫在 `config.toml`。文件要求唯讀帳號、最好限來源 IP。
- **依賴套件沒鎖**（npx 不吃 lockfile）：列為已接受風險，文件寫明。
- **專案的 `.env` 可能讓 DBHub 起不來**：待 1.6.0 實測；若仍會，小工具改註冊一個極薄的啟動器，或文件寫明。
- **唯讀非萬能**：特權帳號仍可用 `pg_read_file` 之類的讀檔函式；SQL Server 交易外的副作用擋不住。所以文件要求唯讀帳號。

## 待釐清（plan Task 1 實測定案）
- DBHub 1.6.0 的 TOML 格式、`${ENV}` 引用、`.env` 行為、唯讀攻擊結果。
- Claude Code `claude mcp add --scope local` 在 Windows 的 `npx` 寫法。
- Codex 是否支援專案層 MCP 設定。
