---
name: security-audit
description: |
  OWASP Top 10 + STRIDE 安全稽核（繁中）。觸發：security audit / 安全稽核 /
  threat model / OWASP / STRIDE / 認證 / 授權 / payment / API 邊界 /
  涉敏感資料 / 資料層改動 / 涉 PII / production data。
  涵蓋：判定要不要跑、spawn security-auditor agent（獨立 context 做 STRIDE / OWASP /
  checklist / PII 檢查）、整合 finding、critical user gate。
  上游：receive-review 完。下游：finish-branch。
---

# security-audit

對改動做主動威脅建模。**不是跑 SAST 工具** — 是用 OWASP / STRIDE 框架找架構層級的安全缺口。

本 skill 是**協調殼**：判定要不要跑、收 context、spawn `security-auditor` agent、整合 finding、處 user gate。實質 threat modeling 由 agent 在獨立 context 跑（避免球員兼裁判）。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state** 取 `tier`、`codebase_impact`、`commits`、`diff`。
2. **判定要不要跑**：
   - T2：涉**認證 / 授權 / 資料層 / API 邊界 / payment / 上傳 / PII** → 跑
   - T3：**必跑**（不論改動範圍）
   - T0 / T1：跳、直接交 finish-branch
3. **spawn `security-auditor` agent**（見 §Dispatch）。
4. **收 agent finding**、整合到 hand-off state。
5. **Critical** → 走 §Critical-finding 流程交 user。
6. **Major** → 整批給 user 看、依 §Auto-fix 處置（不危險 auto-fix / 危險問 user）。
7. **載 security-checklist 互補**：agent 已做 checklist 主題對齊；若需要展開實作範例（FAIL/PASS 程式碼）載 security-checklist skill。
8. 全部完 → 交 finish-branch。

---

## §Dispatch — spawn security-auditor agent

```yaml
Agent:
  description: "Security audit on <branch>"
  subagent_type: security-auditor
  prompt: |
    請對下列改動做 security audit。

    ## Context
    - Tier: <T2 or T3>
    - Track: <Bug or Dev>
    - 改動 commits: <commit list>
    - 改動檔: <file list>
    - codebase_impact 標記: <auth / data / api / payment / upload / pii ... 任一命中>

    ## Diff
    <貼 git diff 或指引 agent 用 git diff origin/main..HEAD 自取>

    ## Spec / Plan（可選）
    <若有 docs/plans/<topic>/spec.md 或 plan.md 一併附上>

    ## 你的任務
    依 agent SKILL.md「§檢查焦點」做：
    1. STRIDE 六類 × 每 surface
    2. OWASP Top 10 對應條目
    3. checklist 主題逐項對
    4. PII 違規檢查
    5. File-type 硬規則命中

    回結構化 finding（critical / major / minor / nit + PASS）。
    **不寫 fix code、不問 user**。
```

涉 DB schema / migration 改動：**另外**派 `db-reviewer`（兩 agent 可同 message 平行 spawn）。

---

## §Critical-finding 流程

任一 Critical finding：

`AskUserQuestion`：

```
問：Security audit 發現 critical：<簡述>
  位置: <file:line>
  類別: <STRIDE 或 OWASP 條目 或 PII>
  影響: <一句>
  建議 fix: <agent 建議>

選項：
  1. 採用建議 fix、進 finish-branch（推薦）
  2. 改 fix（user 給細節）
  3. 標 known issue、列 PR 內、user 接受風險
  4. 退 execute-plan 重做相關 task
```

多個 Critical → 一個一個跑 AskUserQuestion，**不**批次成單一問題（每個 critical 都該明確決策）。

---

## §Major / Minor 處置（§Auto-fix 原則）

依 CLAUDE.md「§Auto-fix」：

- **不危險類**（input validation 補上、log mask 補上、secure header 補上、註解 / 格式類安全建議）→ 自動修、修完整批 diff 給 user
- **危險類**（改認證邏輯、改 session 行為、改加密、改 DB schema 加 column 加 mask、改 dependency）→ AskUserQuestion 問 user

T3 即使不危險類也先讓 user 看 diff 才提交。

Minor / Nit：**整批列、user 自決**（不主動 fix）。

---

## §hand-off state

```yaml
state:
  security_audit_findings:
    critical: [...]   # 來自 agent
    major: [...]
    minor: [...]
    nit: [...]
    pass: [...]
  security_topics_checked: [...]
  security_user_decisions:    # critical / 危險 major 的 user 選項紀錄
    - finding: <id>
      decision: <option>
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
| 「沒涉認證跳 audit」 | 認證只是一條；涉資料層 / API 邊界 / PII 也要跑 |
| 「skill 自己跑 STRIDE 比較快」 | 球員兼裁判；改動者的 context 對自家 code 有偏誤；必走 agent |
| 「DB 改動讓 security-auditor 一起看」 | DB 派 db-reviewer；security-auditor 不重複 |
| 「critical agent 自己降級成 major」 | 嚴重度由 agent 標、skill 不擅自改；user gate 才是分流點 |
| 「PII 違規可以後修」 | PII 違規 = critical = 立即處 |
| 「多個 critical 一個 AskUserQuestion 解決」 | 每個 critical 獨立決策、不打包 |
