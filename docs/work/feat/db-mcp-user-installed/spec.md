# 規則支援多種資料庫、認得使用者自己裝的 DB 工具
> Track: Dev | Tier: T2 | 建立: 2026-11-09

## 動機 / Why
- 規則目前只認 `mcp__mysql__mysql_query`。專案若是 PostgreSQL / SQL Server / SQLite / Oracle / MariaDB，就算使用者自己裝了對應的 DB MCP，AI 也不知道該用它，只會停下來或回報工具不在。
- 範圍演變（2026-11-06 ~ 11-09，user 決定）：
  1. 內建 DBHub（舊 branch `feat/plugin-db-mcp-dbhub`，未 push）。
  2. 改成各自裝、附設定小工具。
  3. **最後定案：bstack 不附任何 DB MCP、不附安裝工具、不推薦特定 MCP，只讓規則支援多種資料庫。**
- 舊 branch 的多方言內容（db-access 的方言差異、庫名比對、工具不在、mask 範例）直接沿用。

## 目標 / Success criteria
- **規則書 §DB 操作**：
  - 讀取用「工具清單裡的資料庫查詢工具」，例如 `mcp__mysql__mysql_query`，或使用者自己裝的其他 DB MCP 的查詢工具。
  - 看不出是不是 DB 查詢工具就當工具不在。
  - 仍禁 bash `mysql` / `psql` / `sqlcmd` / `sqlite3` / `sqlplus`。
  - 寫入仍一律不試跑。
- **db-access**：
  - 怎麼認工具：看工具名與描述；常見例子列 mysql MCP、DBHub 的 `execute_sql`。
  - 唯讀不保證：使用者自裝的 MCP 是否強制唯讀 bstack 不知道，所以寫入一律不試跑，並提醒帳號要唯讀。
  - 判方言。
  - 首次查詢比對庫名。
  - 方言語法：LIMIT / TOP / FETCH FIRST、執行計畫、schema 查詢。
  - §工具不在：
    1. 請 user 自己裝 DB MCP 後重開 session。
    2. 本次只驗 codebase，標「儲存端未驗」。
    3. 任務其實不涉 DB。
  - 四種方言的 mask 範例。
  - 回傳筆數可能被 MCP 截斷的提醒。
- **db-reviewer**：
  - `tools` 白名單維持 `mcp__mysql__mysql_query`（subagent 只能用列出的工具名，使用者自裝的名稱無法預先列）。
  - 工具不在時照做靜態審查，大表估算標「未查」。
  - 加入多方言意識（online DDL、執行計畫各方言做法）。
  - security-audit 派 db-reviewer 時，主 agent 先用自己的 DB 工具抽樣（row 數），結果貼進派工 prompt。
- **headless-mode §分流表**：
  - `db-access/tool-missing`：涉 schema / migration / T3 → B；其餘 → A，採選項 2。
  - `db-access/db-mismatch`：B。
- **hosts.md §MCP 工具**：不再以 mysql 為唯一例子；DB 工具不在 → `db-access` §工具不在。
- **brainstorm DB 關鍵詞**：加 mariadb / postgres / postgresql / sqlite / sql server / mssql / oracle。
- **文件**：
  - 現有 mysql MCP 安裝範本**保留不動**（install.md、extras.ps1、install-codex.ps1）。
  - install.md 補一句：其他資料庫自己裝任一 DB MCP，帳號一定要唯讀。
- `node scripts/plugin-contract.mjs` ALL PASS，`gen-codex-agents --check` 綠，`build-references -Check` 綠。

## 範圍 / Scope
**包含**：上列規則、skill、agent 文字；契約補多方言與工具不在的檢查；docs 站對應文字；版本升 1.14.0。

**排除**：
- plugin 自帶 DB MCP。
- 設定小工具、啟動器。
- 推薦清單。
- 改 mysql 安裝範本。
- 改 PII 規則本身。
- 一個專案同時接多個資料庫的規則。

## 影響檔案 / Codebase impact
| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `skills/devwork/rules.md` | edit | 全 session 常駐；「DB 查詢工具」寫太寬，AI 會把別的 MCP 當 DB 用 |
| `skills/devwork/hosts.md` | edit | 一列 |
| `skills/db-access/SKILL.md` | edit | 方言範例錯會產出錯 SQL |
| `skills/headless-mode/SKILL.md` | edit | 兩列 |
| `skills/brainstorm/SKILL.md` | edit | 一行關鍵詞 |
| `agents/db-reviewer.md`、`codex/agents/db-reviewer.toml`（重產）、`skills/security-audit/SKILL.md` | edit | 派工 prompt 多一步抽樣 |
| `scripts/plugin-contract.mjs` | edit | 新斷言不能恆綠 |
| `docs/install.md`、`docs/js/data.js`、`docs/js/references-data.js`（重產）、三處版本號 | edit | 公開站 merge 即上線；data.js 只改字串 |

## 設計方向
`docs/js/data.js` 只改字串，不碰前端結構。`design.involved=false`。

## DB 影響
不改任何 schema。實測沿用本機拋棄式庫 `bstack_dbhub_test`，驗收完由 user 刪。

## 風險與 trade-off
- **使用者自裝的 MCP 可能可寫**：bstack 沒有工具層保證，只靠「AI 不試跑寫入」與「帳號唯讀」兩條規則，這是本方案接受的取捨。
- **db-reviewer 只能直接查 mysql MCP**：其他 DB 改由主 agent 抽樣後交給它，審查深度相同，只是多一手。
- **規則認工具靠語意判斷**：寫明判斷依據與「看不出就當不在」，避免誤用。

## 施工清單
| # | group | 檔（可多個） | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `scripts/plugin-contract.mjs` | 新增 P20：db-access 含 §工具不在、`TOP`、`FETCH FIRST`、五種方言庫名查詢字串（`DATABASE()`、`current_database()`、`DB_NAME()`、`PRAGMA database_list`、`sys_context('USERENV'`）；rules.md §DB 操作不再寫死唯一工具名且含 `sqlcmd`、`sqlplus`；headless 分流表兩列的類別欄分別為 `A / B`、`B`；brainstorm 關鍵詞含 `postgres`、`sqlite`、`oracle`、`mssql`；db-reviewer 含「未查」與多方言 | `node scripts/plugin-contract.mjs` → P20 FAIL（紅） |
| 2 | 2 | `skills/devwork/rules.md`、`skills/devwork/hosts.md` | 改 §DB 操作、§事實核實「儲存端工具不在」、抽象動詞表 MCP 列、hosts.md §MCP 工具 | 契約 P20 對應項轉綠 |
| 3 | 3 | `skills/db-access/SKILL.md` | 以舊 branch 版本為底，改成「認使用者自裝的 DB 工具」，不寫 bstackdb / DBHub 設定 | 契約 P20 db-access 項綠；人工比對四種方言的 SQL 範例 |
| 4 | 4 | `skills/headless-mode/SKILL.md`、`skills/brainstorm/SKILL.md` | 分流表兩列、關鍵詞 | 契約綠 |
| 5 | 5 | `agents/db-reviewer.md`、`skills/security-audit/SKILL.md`、`codex/agents/*.toml` | 多方言、工具不在照做靜態審查、派工前主 agent 抽樣 | 契約綠、`node scripts/gen-codex-agents.mjs --check` 綠 |
| 6 | 6 | `docs/install.md`、`docs/js/data.js`、`docs/js/references-data.js` | 補一句其他資料庫；docs 站兩個字串；重產 references | `pwsh -File scripts/build-references.ps1 -Check` 綠；docs 站本機開 flow / 規則頁，看得到新字串、console 錯誤數與 main 相同 |
| 7 | 7 | 三處版本號 | 升 1.14.0 | 契約版本一致項綠 |
| 8 | 8 | （實測） | `claude -p` 在 PostgreSQL 專案情境下，用自裝 DB MCP 查庫名；沒有 DB 工具時走 §工具不在 | 輸出摘要寫進施工紀錄 |

## 施工紀錄
