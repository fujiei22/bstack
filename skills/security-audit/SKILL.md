---
name: security-audit
description: |
  OWASP Top 10 + STRIDE 安全稽核（繁中）。觸發：security audit / 安全稽核 /
  threat model / OWASP / STRIDE / 認證 / 授權 / payment / API 邊界 /
  涉敏感資料 / 資料層改動 / 涉 PII / production data。
  涵蓋：threat modeling 流程、依改動類型套 OWASP 條目、STRIDE 六類威脅、
  finding 結構化回報、與 security-checklist 互補。
  上游：receive-review 完。下游：finish-branch。
---

# security-audit

對改動做主動威脅建模。**不是跑 SAST 工具** — 是用 OWASP / STRIDE 框架找架構層級的安全缺口。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state** 取 `tier`、`codebase_impact`、`commits`。
2. **判定要不要跑**：
   - T2：涉**認證 / 授權 / 資料層 / API 邊界 / payment / 上傳 / PII** → 跑
   - T3：**必跑**（不論改動範圍）
   - T0 / T1：跳
3. **threat modeling**：依改動列威脅模型（STRIDE）、套 OWASP Top 10 對應條目。
4. **finding 結構化回報**：critical / major / minor + 對應條目。
5. **載 security-checklist 互補**：跑完 STRIDE 後對 ECC checklist 逐項對。
6. 嚴重 finding → 走 §Critical-finding 流程交 user。
7. 全部完 → 交 finish-branch。

---

## §Threat modeling — STRIDE

對改動的每個 component / endpoint / data flow 問六類威脅：

| 字 | 威脅 | 問什麼 |
|---|---|---|
| **S** Spoofing | 身份偽造 | 認證機制？token 是否會被偽造？session fixation？|
| **T** Tampering | 資料竄改 | 資料完整性？signature？資料庫寫入是否驗 schema / 權限？|
| **R** Repudiation | 否認 | log 是否能追責？audit trail？|
| **I** Information disclosure | 資訊洩漏 | error 是否漏 stack trace / SQL / 內部結構？response 是否漏多餘欄位（如 password hash）？|
| **D** Denial of service | 服務阻斷 | rate limit？大檔案 / 慢 request 是否會耗盡 resource？無限 recursion / 無上限 query？|
| **E** Elevation of privilege | 提權 | 一般 user 是否能變 admin？role check 是否每個 endpoint 都做？|

對改動每個 surface（endpoint / function / data path）跑一遍六類。

---

## §OWASP Top 10 對應

依改動類型挑相關條目深入：

| 改動類 | OWASP 條目 |
|---|---|
| 認證 / 授權 / session | A01 Broken Access Control、A07 Identification & Auth Failures |
| 加密 / token 處理 | A02 Cryptographic Failures |
| 資料層 / DB query / ORM | A03 Injection（SQL / NoSQL / OS / LDAP） |
| 架構 / 介面設計 | A04 Insecure Design |
| 設定 / config / env | A05 Security Misconfiguration |
| dependency 升降 / 新增 | A06 Vulnerable & Outdated Components |
| log / monitor | A09 Security Logging & Monitoring Failures |
| 外連 / SSRF / file fetch | A10 Server-Side Request Forgery |

對命中條目，跑該條目的標準檢查（OWASP cheat sheet）。

---

## §跟 security-checklist 互補

STRIDE 是 framework、checklist 是 concrete 項目。**先跑 STRIDE 找架構威脅 → 再跑 checklist 找具體實作 bug**。

載 security-checklist skill；對改動命中的主題逐項對：
- secrets management
- input validation
- SQL injection
- XSS / CSRF
- authentication / authorization
- error handling
- session management
- file upload
- API rate limiting
- secure headers
- HTTPS / TLS
- logging（PII mask）

詳見 security-checklist skill 本體。

---

## §Finding 回報格式

```markdown
# Security audit 結果

> Tier: <T2/T3>
> 改動範圍: <files / modules>
> 跑了: STRIDE × <N> surface + OWASP × <條目> + checklist 主題 <列>

## Critical

### S/T/R/I/D/E or OWASP A0X: <威脅名>
- **位置**：<file:line>
- **威脅**：<具體攻擊 scenario>
- **影響**：<會被怎樣>
- **建議 fix**：<具體做法>
- **參考**：OWASP / CWE link（如有）

## Major
（同格式、嚴重度較低）

## Minor / Nit
（同格式）

## 通過項目（非 finding，但稽核過）
- ...
```

---

## §Critical-finding 流程

任一 Critical finding：

`AskUserQuestion`：

```
問：Security audit 發現 critical：<簡述>
  位置: <file:line>
  影響: <一句>
  建議 fix: <reviewer 建議>

選項：
  1. 採用 fix、進 finish-branch（推薦）
  2. 改 fix（user 給細節）
  3. 標 known issue、列 PR 內、user 接受風險
  4. 退 execute-plan 重做相關 task
```

**Major** 不立刻 prompt，整批給 user 看 + receive-review style 處置（不危險 auto-fix / 危險問）。

---

## §PII 安全底線（必檢）

依 CLAUDE.md「§PII 安全底線」對改動 grep：

- output / log / error message 是否含 email / phone / 身分證 / 信用卡 / 地址 / id_number 原值？
- DB query 是否 SELECT PII 欄位但無 mask？
- response 是否 return 多餘 PII（如 admin endpoint return password hash）？

PII 違規 = **Critical**，照 §Critical-finding 流程。

---

## §File-type 硬規則命中（必檢）

依 CLAUDE.md「§File-type 硬規則」：
- 改動是否含密鑰類檔（.env / *.key / *.pem ...）？→ Critical
- 改動是否含 CI / migration / lock / infra？→ 必須有對應的 verification 證據（如 migration dry-run 結果、CI workflow 測試過）

---

## §hand-off state

```yaml
state:
  security_audit_findings:
    critical: [...]
    major: [...]
    minor: [...]
  security_topics_checked: [...]
  security_user_decisions: [...]
  current_phase: security-audit-done
```

**下一 phase**：→ `finish-branch`

---

## §結尾 Trace 標籤

```
[Trace] Phase=security-audit | Tier=<T2/T3> | Track=<Bug/Dev> | Skill=security-audit
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「沒涉認證跳 audit」 | 認證只是其中一條；涉資料層 / API 邊界 / PII 也要跑 |
| 「STRIDE 太抽象、跳直接看 checklist」 | STRIDE 抓架構級威脅，checklist 抓實作；兩者互補 |
| 「critical finding 我自己修就好不問 user」 | 危險類必問；security critical 絕對是危險類 |
| 「PII 違規可以後修」 | PII 違規 = critical = 立即處 |
| 「lint 沒報就沒事」 | lint 跟 security 不同層；別代換 |
