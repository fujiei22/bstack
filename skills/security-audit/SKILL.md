---
name: security-audit
description: |
  OWASP + STRIDE 安全稽核（繁中）：判定要不要跑、spawn security-auditor、整合 finding、critical gate。
  載入：dev-workflow Phase 6；T2 涉認證 / 授權 / 資料層 / API 邊界 / payment / 上傳 / PII 才用、T3 程式碼 diff 必用、純文件 diff 且無 File-type 硬規則命中跳。
---

# security-audit
對改動做主動威脅建模，**不是跑 SAST 工具**。本 skill 是**協調殼**：判定要不要跑、收 context、spawn `security-auditor` agent、整合 finding、處 user gate；實質 threat modeling 由 agent 在獨立 context 跑（避免球員兼裁判）。

## 使用契約（強制）
**載入後立即動作**：
1. **讀 hand-off state** 取 `tier`、`codebase_impact`、`commits`、`diff`、`code_review_applicable`、`code_review_skipped_reason`（後兩欄由 request-review §副檔名分流 產出）。
2. **判定要不要跑**：
   - T0 / T1 跳、直接交 finish-branch。
   - T2 涉**認證 / 授權 / 資料層 / API 邊界 / payment / 上傳 / PII** 才跑。
   - T3 依序判三條，**全中才跳**：
     (a) `state.code_review_applicable === false`——request-review 已判為純文件 diff。state **沒這欄**（例如 user 顯式呼叫本 skill）就當 `true` 照跑，**不自己補判副檔名**；
     (b) `git diff <base>...HEAD --name-only` 沒有任何檔命中 rules.md §File-type 硬規則表任一列（密鑰 / ignore 檔 / CI-CD / DB migration / 鎖檔 / Infra / Shell config）——這些在 request-review 表裡歸純文件、卻是安全面最該看的檔，所以硬規則命中就照跑；
     (c) Tier 是 T3。
     三條全中 → 不 spawn agent、不載 security-checklist，state 寫 `security_skipped_reason`（例「純文件 diff：.md .json；無 File-type 硬規則命中」），直接交 finish-branch。任一不中 → 照舊：audit + checklist + db-reviewer（DB 改動）。
3. **spawn `security-auditor` agent**（見 §Dispatch）。
4. **收 agent finding**、整合到 hand-off state。
5. **Critical** → 走 §Critical-finding 流程交 user。
6. **Major** → 依 §Major / Minor 處置（不危險 auto-fix / 危險問 user）。
7. **載 security-checklist 互補**：需要展開 FAIL/PASS 實作範例才載。
8. 全部完 → 交 finish-branch。

## §Dispatch — spawn security-auditor agent
```yaml
Agent:
  description: "Security audit on <branch>"
  subagent_type: security-auditor
  prompt: |
    請對下列改動做 security audit。
    - Tier: <T2 or T3>、Track: <Bug or Dev>
    - 改動 commits: <commit list>、改動檔: <file list>
    - codebase_impact 標記: <auth / data / api / payment / upload / pii ... 任一命中>
    - Diff: <貼 git diff 或指引 agent 用 git diff origin/main..HEAD 自取>
    - Spec / Plan（可選）: <docs/work/<branch-name>/spec.md 或 plan.md>
    你不是 headless 主流程：禁 gh issue comment / git push / 寫 snapshot / 印 [bstack headless] 行；要問 user 的問題回報給派工你的 agent，由它決定。
    依 agent「§檢查焦點」做，回結構化 finding（critical / major / minor / nit + PASS）。**不寫 fix code、不問 user**。
```
涉 DB schema / migration 改動：**另外**派 `db-reviewer`（兩 agent 可同 message 平行 spawn），prompt 同樣附上面那句「你不是 headless 主流程」約束。

## §Critical-finding 流程
任一 Critical finding → `AskUserQuestion`（多個 Critical 一個一個跑，**不**批次成單一問題；headless 時 → 每個 critical 一則 B 類留言 `security-audit/critical`，見 `headless-mode`）：
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

## §Major / Minor 處置（§Auto-fix 原則）
依 rules.md「§Auto-fix」：
- **不危險類**（input validation 補上、log mask 補上、secure header 補上、註解 / 格式類安全建議）→ 自動修、修完整批 diff 給 user
- **危險類**（改認證邏輯、改 session 行為、改加密、改 DB schema 加 column 加 mask、改 dependency）→ AskUserQuestion 問 user

T3 不危險類也先讓 user 看 diff 才提交。Minor / Nit 整批列、user 自決（不主動 fix）。

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
  security_skipped_reason: <純文件 diff：<副檔名列表>；無 File-type 硬規則命中 | null>   # 第 2 步跳過時才有值；有值則上面 findings 全空
  security_user_decisions:    # critical / 危險 major 的 user 選項紀錄
    - finding: <id>
      decision: <option>
  current_phase: security-audit-done
```
**下一 phase**：→ `finish-branch`

## §Red Flags
| 想法 | 真相 |
|---|---|
| 「沒涉認證跳 audit」 | 認證只是一條；涉資料層 / API 邊界 / PII 也要跑 |
| 「純文件 diff 就跳」 | 還要查 File-type 硬規則：`.github/workflows/*.yml`、`docker-compose.yml`、`.npmrc` 都是純文字、都要 audit |
| 「state 沒有 code_review_applicable，我自己看副檔名判」 | 沒這欄就當程式碼 diff 照跑；副檔名表只在 request-review 一處，不在這裡長第二套 |
| 「skill 自己跑 STRIDE 比較快」 | 球員兼裁判；改動者的 context 對自家 code 有偏誤；必走 agent |
| 「critical agent 自己降級成 major」 | 嚴重度由 agent 標、skill 不擅自改；user gate 才是分流點 |
| 「PII 違規可以後修」 | PII 違規 = critical = 立即處（rules.md §PII 安全底線） |
| 「多個 critical 一個 AskUserQuestion 解決」 | 每個 critical 獨立決策、不打包 |
