---
name: db-access
description: |
  資料庫存取規範（繁中）。載入：dev-workflow §跨流程 skill 載入 表所列時點（brainstorm 0b 偵測到 DB 關鍵詞）。
  涵蓋：MCP 唯讀、讀寫分流、查詢量限、PII mask、產 SQL 交付格式。
  **強制**：brainstorm Phase 0b 偵測到 DB 關鍵詞時必載；debug-systematic 的 Triage
  與 security-audit（Phase 6）的 db-reviewer 涉 DB 時亦適用本規則。
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

## PII（全域底線見 rules.md §PII 安全底線，此節為 DB 場景）

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

- **brainstorm Phase 0b** 偵測到 DB 關鍵詞 → 載入本 skill（唯一的固定載入點）
- **debug-systematic 的 Triage** 涉 DB → 此 skill 規則生效
- **security-audit（Phase 6）派 `db-reviewer`** → reviewer 摘要含 PII 須依本 skill mask
- **風險表「DB schema / migration」命中** → 升一級

> **phase 編號以 `dev-workflow` §Track × Tier × Phase 路徑為準**：Phase 2 是 write-plan、
> Phase 6 是 security-audit、Phase 8 是 pr-explain。舊版本檔寫的「Phase 2 triage」與
> 「Phase 8c DB reviewer」兩個編號都是錯的，已更正。
