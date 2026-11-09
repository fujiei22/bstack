# DB MCP 改為使用者各自裝、規則支援多種資料庫
> Track: Dev | Tier: T3 | 建立: 2026-11-09

## 動機 / Why
- 現在規則只認 `mcp__mysql__mysql_query`，團隊專案可能是 PostgreSQL / SQL Server / SQLite / Oracle。
- 前一版做法（`feat/plugin-db-mcp-dbhub`，未 push）把 DBHub 綁進 plugin。2026-11-09 user 決定**不內建**，改成依自己的資料庫各自裝 MCP。理由是體積與首次啟動逾時：DBHub 實測硬碟 115 MB，首次啟動 38–58 秒，超過 Claude Code 等待的 30 秒。
- 舊 branch 的「多資料庫規則與文件」部分各自裝一樣用得到，搬過來改寫。啟動器、安裝表單、Codex mcp.json、探測腳本不搬。

## 目標 / Success criteria
- 規則書 §DB 操作：讀取用「工具清單裡的資料庫查詢工具」，推薦清單的工具名寫在 `db-access`。仍禁 bash `mysql` / `psql` / `sqlcmd` / `sqlite3` / `sqlplus`。
- `db-access`：
  - 推薦 MCP 對照表：每種 DB 一個，含 server 名、工具名、唯讀怎麼保證。
  - 方言差異（LIMIT / TOP / FETCH FIRST）與首次查詢比對庫名。
  - §工具不在。
  - 四種方言的 mask 範例。
- `db-reviewer` 的 `tools` 白名單列推薦清單裡的全部工具名（硬限制：沒列就查不了）；不在清單的 MCP 改做靜態審查。
- `docs/install.md`：每種 DB 一個推薦裝法。唯讀要靠工具本身強制，加上唯讀帳號，共兩道防線。Claude Code / Codex 兩個 host 的指令都寫。
- 推薦清單裡的每一個 MCP 都要**實測**唯讀攻擊被擋；本機沒引擎的標「未實測」，並寫明必須用唯讀帳號。
- 既有使用者的 `mysql` MCP（`mcp__mysql__mysql_query`）**繼續可用**，不需重裝。
- 契約守兩處對齊：db-access 推薦表的工具名與 db-reviewer 白名單一致；規則、hosts.md 不寫死單一工具名。
- `node scripts/plugin-contract.mjs` ALL PASS，`gen-codex-agents --check` 綠，`build-references -Check` 綠。

## 範圍 / Scope
**包含**：
- 規則與 skill：rules.md §DB 操作 / §事實核實 的「儲存端工具不在」句 / 抽象動詞表 MCP 列，hosts.md §MCP 工具，db-access，headless-mode §分流表（`db-access/tool-missing`、`db-access/db-mismatch`），brainstorm DB 關鍵詞，session-team 一處提及。
- agent：db-reviewer、lang-reviewer、`gen-codex-agents.mjs` 與 `codex/agents/*.toml` 重產。
- 腳本：extras.ps1（mysql 範本改成指向推薦清單）、install-codex.ps1 提示。
- 文件：README、install.md、docs 站文字節點。
- 其他：契約、版本升 1.14.0。

**排除**：
- plugin 自帶任何 DB MCP（`.mcp.json` 不動）。
- 安裝表單（userConfig）。
- 自動幫使用者安裝或移除 MCP。
- 同時接多個資料庫的規則。
- 改 PII mask 規則本身。

## 影響檔案 / Codebase impact
| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `skills/devwork/rules.md` | edit | 全 session 常駐；寫得太寬會讓 AI 把非 DB 的 MCP 當 DB 用 |
| `skills/devwork/hosts.md` §MCP 工具 | edit | 兩 host 的工具名格式 |
| `skills/db-access/SKILL.md` | edit | 推薦表是工具名的單一真相；方言範例錯會產出錯 SQL |
| `skills/headless-mode/SKILL.md` | edit | 分流表新增兩列 |
| `skills/brainstorm/SKILL.md`、`skills/session-team/SKILL.md` | edit | 一處提及 |
| `agents/db-reviewer.md`、`agents/lang-reviewer.md` | edit | 白名單漏列 = 該 DB 查不了 |
| `scripts/gen-codex-agents.mjs`、`codex/agents/*.toml` | edit / 重產 | Codex agent 的 MCP 範本 |
| `scripts/extras.ps1`、`scripts/install-codex.ps1` | edit | `-SelfTest` 要照過 |
| `scripts/plugin-contract.mjs` | edit | 新對齊檢查不能恆綠 |
| `README.md`、`docs/install.md`、`docs/index.html`、`docs/js/data.js`、`docs/js/references-data.js` | edit | 公開 docs 站 merge 即上線；html / data.js 只改文字 |
| 三處版本號 | edit | 不升版使用者拿不到 |

## 設計方向
`docs/index.html` / `docs/js/data.js` 只改文字節點，因此適用 rules.md §設計語言對齊 的豁免，`design.involved=false`。

## DB 影響
不改任何專案的 schema。實測沿用本機拋棄式庫 `bstack_dbhub_test`（MySQL 8 / PostgreSQL 18），驗收完由 user 刪。

## 可沿用的前次實測（舊 branch，2026-11-06）
- DBHub 1.5.1：唯讀攻擊 SQLite 16 種、MySQL 26 種、PostgreSQL 20 種全擋。唯讀只能設在 TOML `[[tools]] readonly=true`；沒有 DSN 時 exit 1。
- Claude Code 自己另加的 MCP 工具名是 `mcp__<server>__<tool>`。Codex 的 plugin MCP 不加前綴；使用者自加的 MCP 預期同格式，待實測確認。
- mysql MCP（`@benborla29/mcp-server-mysql`）寫入旗標預設 false（memory 已記）。

## 風險與 trade-off
- **唯讀保證因 MCP 而異**：推薦清單只收「工具本身強制唯讀」的 MCP；不在清單的，規則要求唯讀帳號，db-access 第一次使用時提醒。
- **規則寫「資料庫查詢工具」比寫死名字寬**：AI 可能誤認。對策是 db-access 列推薦名，並寫「看不出是不是 DB 工具就當工具不在」。
- **推薦清單會過時**：每列附查證日期與版本。
- **首次啟動逾時仍可能發生**（例如 DBHub 走 npx）：install.md 附預熱指令；這次由使用者自己選裝，不再影響不用 DB 的人。

## 待釐清
- 各 DB 推薦哪個 MCP → plan 第一個 task 查證加實測後定案，候選如下：
  - MySQL：`@benborla29/mcp-server-mysql`（現用）
  - PostgreSQL / SQL Server / SQLite / Oracle：DBHub 自裝（要 TOML 設唯讀），或其他官方 / 主流 MCP
- Codex 使用者自加 MCP 的工具名格式 → 同一 task 實測。
