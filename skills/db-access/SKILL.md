---
name: db-access
description: |
  資料庫存取規範（繁中）。觸發：DB / SQL / mysql / schema / query / table / 表 / 欄位 /
  column / SELECT / INSERT / UPDATE / DELETE / DDL / migration / EXPLAIN / index /
  JOIN / 跑 SQL / 抓資料 / 看 schema / mysql MCP / 改資料 / 加欄位 / 改表 / DB 設計 /
  連 DB / 資料表結構。涵蓋：MCP 唯讀、讀寫分流、查詢量限、PII mask、產 SQL 交付格式。
  **強制**：dev-workflow Phase 2 triage / Phase 8c DB reviewer 涉 DB 時亦須載入。
---

# db-access

## 使用契約（強制）

**載入後第一動作**：
1. Confirm 任務涉 DB
2. 識別讀 vs 寫
3. 讀 → `mcp__mysql__mysql_query`（禁 bash mysql / psql CLI / 手寫 SQL 貼對話讓 user 跑）
4. 寫 → 產 SQL 交 user，禁試跑

## 模式

mysql MCP 帳號**唯讀**。任何寫操作禁試跑，產 SQL 交 user 執行。

## 讀（SELECT / SHOW / DESCRIBE / EXPLAIN）

| 項 | 規則 |
|---|---|
| Tool | `mcp__mysql__mysql_query` |
| 禁用 | bash mysql / psql CLI / 手寫 SQL 貼對話他處 |
| 量限 | 預設 `LIMIT 100`；超量分頁（OFFSET / cursor） |
| 重 query | 執行前 `EXPLAIN` 看 plan，避免全表掃 / 缺 index |

EXPLAIN 範例：
```sql
EXPLAIN SELECT id, name FROM users WHERE created_at > '2026-01-01' LIMIT 100;
```

## 寫（INSERT / UPDATE / DELETE / DDL / TRUNCATE / REPLACE / MERGE）

**禁試跑**。產 SQL 交 user。交付格式：

````markdown
**目的**：<一句話>
**影響範圍**：<表 / 估算 row 數>
**回滾**：<反向 SQL 或 backup 指引>

```sql
-- 主操作
UPDATE users SET status = 'inactive' WHERE last_login < '2025-01-01';

-- 預檢（執行前可先跑此查筆數）
SELECT COUNT(*) FROM users WHERE last_login < '2025-01-01';
```
````

DDL / migration 額外提醒：
- 大表加欄位 → online DDL 工具（pt-osc / gh-ost）
- 改 PK / unique → replication 風險

## PII（全域底線見 CLAUDE.md，此節為 DB 場景）

| 場景 | 處置 |
|---|---|
| SELECT 輸出含 PII 欄位 | mask 或改 aggregate |
| WHERE 條件用 PII 比對 | 可原值（不落輸出即可） |
| LIKE / 模糊查 | 仍禁原值落對話 |
| EXPLAIN 結果 | 一般無 PII，可原樣貼 |

mask SQL 範例：
```sql
-- email mask
SELECT CONCAT(LEFT(email,2),'***@',SUBSTRING_INDEX(email,'@',-1)) AS email_masked
FROM users LIMIT 100;

-- aggregate 替代
SELECT DATE(created_at) AS d, COUNT(*) AS n FROM users GROUP BY d;
```

## 與 dev-workflow 銜接

- **Phase 2 triage** 涉 DB → 此 skill 規則生效
- **Phase 8c DB reviewer** 跑 `database-reviewer`；reviewer 摘要含 PII 須依本 skill mask
- **風險表「DB schema / migration」命中** → 升一級
