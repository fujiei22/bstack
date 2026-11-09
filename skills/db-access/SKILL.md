---
name: db-access
description: |
  資料庫存取規範（繁中）：用使用者自己裝的 DB 查詢工具、多資料庫方言、寫入產 SQL 交 user、量限、PII mask。
  載入：brainstorm 0b 偵測到 DB 關鍵詞必載。
---

# db-access

## 使用契約（強制）

**載入後第一動作**：
0. 判方言：從 migration 檔、ORM 設定、連線設定、user 告知、工具回的錯誤訊息判斷（MySQL / MariaDB / PostgreSQL / SQL Server / SQLite / Oracle）。
1. Confirm 任務涉 DB；找 DB 查詢工具（§認工具），找不到 → §工具不在。
2. 識別讀 vs 寫。
3. 讀 → 用 §認工具 找到的工具（禁 bash `mysql` / `psql` / `sqlcmd` / `sqlite3` / `sqlplus`、禁手寫 SQL 貼對話讓 user 跑）。
   - **第一次查詢先確認連到的是本專案的庫**：
     - MySQL / MariaDB：`SELECT DATABASE()`
     - PostgreSQL：`SELECT current_database()`
     - SQL Server：`SELECT DB_NAME()`
     - SQLite：`PRAGMA database_list`
     - Oracle：`SELECT sys_context('USERENV','DB_NAME') FROM dual`
   - 對不上 → 停下告訴 user（DB MCP 常裝在使用者層、所有專案共用）；headless 時 → `db-access/db-mismatch`。
4. 寫 → 產 SQL 交 user，禁試跑。

## §認工具

bstack 不附 DB MCP，DB 查詢工具是使用者自己裝的，名稱不固定。依序判斷：

1. 工具清單裡名稱或描述明確是「對資料庫執行 SQL / 查詢」的 MCP 工具。常見例子：
   - mysql MCP 的 `mcp__mysql__mysql_query`
   - DBHub 的 `mcp__<server>__execute_sql`
   - PostgreSQL 類的 `mcp__<server>__query`
2. 有多個候選 → 選與 §使用契約 第 0 步方言相符的那個；仍無法判斷 → 問 user（`AskUserQuestion`）。
3. 看不出是不是 DB 查詢工具（例如只有通用的檔案或 HTTP 工具）→ 當不在，走 §工具不在。**不得**拿非 DB 工具湊。

## 模式

使用者自裝的 MCP 是否強制唯讀，bstack **不保證**：有的工具會擋寫入，有的只靠帳號權限。所以：

- 任何寫操作**一律禁試跑**，產 SQL 交 user 執行。
- 提醒 user 連線用**唯讀帳號**；只在第一次用到時提一次，不每次重複。

## §工具不在

工具不在清單、或呼叫回錯誤（連不上 / 帳密錯 / 逾時）→ `AskUserQuestion`：
1. 自己裝或修好 DB MCP 後重開 session（推薦）。裝什麼由 user 決定，帳號要唯讀；MySQL 可照 docs/install.md 的範本。重開前先跑 `context-snapshot`，新 session 用 `context-resume` 接回。
2. 本次只驗 codebase，spec / 報告標「儲存端未驗（沒有 DB 查詢工具）」。
3. 這個任務其實不涉及 DB。

headless 時 → `db-access/tool-missing`（`headless-mode`；涉 schema / migration 或 T3 時停下問人）。選 2 的結論不得用於廢棄 / 刪除 / migration / schema 判斷（rules.md §事實核實）。**不得**因工具不在卡住與 DB 無關的任務。

## 讀（SELECT / EXPLAIN / 方言的 schema 查詢）

| 項 | 規則 |
|---|---|
| Tool | 見 §認工具 |
| 禁用 | 見使用契約第 3 步 |
| 量限 | 查詢自己限筆數：MySQL / PostgreSQL / SQLite `LIMIT 100`、SQL Server `TOP 100`、Oracle `FETCH FIRST 100 ROWS ONLY`；超量分頁。MCP 可能另有回傳上限：**回傳筆數剛好等於某個整數上限（例 100）時視為可能被截斷**，數量一律用 `COUNT(*)` |
| 重 query | 執行前看執行計畫：MySQL / PostgreSQL / SQLite `EXPLAIN`；SQL Server 的 `SET SHOWPLAN_*`、Oracle 的 `EXPLAIN PLAN FOR` 會被唯讀工具擋或要寫入 plan table → 產 SQL 交 user 看 |
| 查 schema | MySQL / PostgreSQL / SQL Server 用 `information_schema`；SQLite 用 `PRAGMA table_info(<表>)` / `sqlite_master`；Oracle 用 `ALL_TABLES` / `ALL_TAB_COLUMNS` |

EXPLAIN 範例（MySQL / PostgreSQL）：
```sql
EXPLAIN SELECT id, name FROM users WHERE created_at > '2026-01-01' LIMIT 100;
```

## 寫（INSERT / UPDATE / DELETE / DDL / TRUNCATE / REPLACE / MERGE）

**禁試跑**。產 SQL 交 user，交付附三欄：
- **目的**：一句話。
- **影響範圍**：表與估算 row 數。
- **回滾**：反向 SQL 或 backup 指引。

主操作 SQL 在前、預檢 COUNT 查詢在後（註明執行前可先跑看筆數）。

DDL / migration 額外提醒：
- 大表加欄位 / index 要用 online 做法，依方言：
  - MySQL：pt-osc / gh-ost
  - PostgreSQL：`CREATE INDEX CONCURRENTLY` / pg_repack
  - SQL Server：`ONLINE = ON`
- 改 PK / unique → replication 風險

## PII（全域底線見 rules.md §PII 安全底線，此節為 DB 場景）

| 場景 | 處置 |
|---|---|
| SELECT 輸出含 PII 欄位 | mask 或改 aggregate |
| WHERE 條件用 PII 比對 | 可原值（不落輸出即可） |
| LIKE / 模糊查 | 仍禁原值落對話 |
| EXPLAIN 結果 | 一般無 PII，可原樣貼 |

email mask 範例（依方言）：
```sql
-- MySQL / MariaDB
SELECT CONCAT(LEFT(email,2),'***@',SUBSTRING_INDEX(email,'@',-1)) AS email_masked FROM users LIMIT 100;
-- PostgreSQL
SELECT LEFT(email,2) || '***@' || split_part(email,'@',2) AS email_masked FROM users LIMIT 100;
-- SQL Server
SELECT TOP 100 LEFT(email,2) + '***@' + SUBSTRING(email, CHARINDEX('@',email)+1, 255) AS email_masked FROM users;
-- SQLite
SELECT substr(email,1,2) || '***@' || substr(email, instr(email,'@')+1) AS email_masked FROM users LIMIT 100;

-- aggregate 替代（MySQL / PostgreSQL / SQLite）
SELECT DATE(created_at) AS d, COUNT(*) AS n FROM users GROUP BY d;
```

## 與 dev-workflow 銜接

- **brainstorm Phase 0b** 偵測到 DB 關鍵詞 → 載入本 skill（唯一的固定載入點）
- **debug-systematic 的 Triage** 涉 DB → 此 skill 規則生效
- **security-audit（Phase 6）派 `db-reviewer`** → 主 agent 先用自己的 DB 查詢工具抽樣（見 security-audit §Dispatch）；reviewer 摘要含 PII 須依本 skill mask
- **風險表「DB schema / migration」命中** → 升一級；phase 編號以 `dev-workflow` §Track × Tier × Phase 路徑為準
