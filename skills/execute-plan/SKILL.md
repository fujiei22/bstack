---
name: execute-plan
description: |
  按 plan 推進實作（繁中）。觸發：跑 plan / execute plan / 實作 plan / 照 plan 做 /
  start coding / 開工 / 進 implementation / 寫 code。
  涵蓋：讀 plan、逐 task 紅綠循環、parallel-group 派 subagent、verify、commit、
  task fail 處置、blocker 升級。
  上游：review-plan（user accept）或 brainstorm（T0 直接進）。
  下游：verify-done（全 task 完）。
---

# execute-plan

按 plan 把 task 一個個跑完。**主節奏 skill** — 內含 tdd-cycle、視情況載 dispatch-parallel。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 plan**：從 hand-off state 取 `plan_path`、Read 全文。同時讀 `spec_path` 對齊目標。
2. **TaskCreate**：把 plan 內每個 task 落到 TaskCreate（含 parallel-group 屬性）。
3. **逐 group 推進**：
   - 同 `parallel-group` 多 task → 載 `dispatch-parallel`、派 subagent 平行
   - 單 task group → 主 agent 自己跑 tdd-cycle
4. **每 task 完跑 verify**（plan 內的 verify command + 主 build / test）。
5. **每 task 完 commit**（繁中、依 CLAUDE.md commit 格式）。
6. **全 task 完** → 交棒 verify-done。

**禁止**：
- 跳 task / 重排序（除非升級為 user gate）
- 跳 tdd-cycle 紅綠循環
- 多 task 累一個大 commit

---

## §Task 推進規則

對每個 task：

1. `TaskUpdate` → `in_progress`
2. 讀 task 5 個 step
3. **進 tdd-cycle**：嚴格紅 → 跑紅 → 綠 → 跑綠 → commit
4. 遇 verify command → 跑 → 印 output → 確認 expected
5. `TaskUpdate` → `completed`
6. 進下個 task / 下個 group

---

## §Parallel-group 派發

讀 plan 看到下面情境：

```
Group 1 task: A, B, C   ← parallel-group: 1
Group 2 task: D         ← parallel-group: 2
Group 3 task: E, F      ← parallel-group: 3
```

對 group 1：

- **載 dispatch-parallel skill**
- 主 agent spawn 2 subagent 跑 A、B；自己跑 C
- 等 3 個都 done（subagent 回報 + 自己 verify 過）
- 整合 / 確認沒衝突
- 推進到 group 2

對 group 2（單 task）：

- 主 agent 直接跑 tdd-cycle

對 group 3：

- 同 group 1 步驟

**重要**：subagent 完成 task 後**不直接 commit**；由主 agent 收 subagent 結果、整合確認、最後主 agent 統一 commit。

---

## §Verify 規則

每 task `commit` step 之前：

1. **task 內指定的 verify command** — 跑、印 output、對 expected
2. **跑既有 test suite**（最小子集 — 動到的模組周邊）
3. lint / type-check 該跑就跑

非綠 → 停下、進 §Task fail 流程。

---

## §Task fail 處置

step 失敗 / verify 失敗時：

1. **不靜默 retry**
2. **印錯誤 + 評起因**（typo / 缺 dep / 假設錯 / 介面變 / plan step 錯）
3. **走 CLAUDE.md §Fail handling**：`AskUserQuestion` 提：
   - retry — 適暫態 / flaky test
   - adjust + retry — AI 提具體調整、user 點頭跑（如改 plan step）
   - rollback 該 task 的修改、回前一個 commit
   - 退到 write-plan 改 plan
   - escalate
4. 選後執行；`state.fail_history` append

---

## §Commit 格式

依 CLAUDE.md「Commit 訊息格式（繁中）」：

```
<type>: <subject 50 字內，繁中>

<body 可選>
- ...
```

**type 選擇**：
- 新功能 task → `feat`
- bug fix task → `fix`
- 純重構 task → `refactor`
- 純測試 task → `test`
- 純文件 task → `docs`

**範例**：
```
feat: 加入使用者 JWT 驗證 middleware

- 新增 jwt.verify wrapper、支援 refresh token
- 過期 token 回 401、不 redirect
```

**禁**：
- subject 寫英文（除非有 user 明確指示）
- 一個 commit 含多個 task
- skip pre-commit hook（`--no-verify`）

---

## §Blocker

**立即停下** 並提 user：
- 缺 dependency / 環境 / 設定
- plan step 與 codebase 現狀牴觸（API 已變、檔已搬）
- task 指令不清
- verify 反覆失敗（>2 次）

**禁猜**：don't guess your way through。

---

## §hand-off state

跑完最後一個 task：

```yaml
state:
  tasks_completed: <N>
  commits: [<sha>, ...]
  parallel_executed_groups: [...]
  current_phase: execute-plan-done
```

**下一 phase**：→ `verify-done`

---

## §結尾 Trace 標籤

每個 task 完成 / 階段切換時貼：

```
[Trace] Phase=execute-plan | Tier=<T1-T3> | Track=<Bug/Dev> | Skill=execute-plan
```

dispatch-parallel 期間 skill 欄位變 `execute-plan+dispatch-parallel`。

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「task 看起來簡單跳 tdd-cycle」 | 紅綠循環不可跳；trivial 也有測 |
| 「同 group task 自己跑就好」 | 同 group 多 task 必載 dispatch-parallel |
| 「verify pass 就 commit」 | verify pass 是 commit 前提；不是 commit 本身 |
| 「多 task 一個 commit」 | 違反 CLAUDE.md「一 commit 一邏輯改變」|
| 「fail 多 retry 一次過了就好」 | 不靜默 retry；走 §Task fail |
| 「subagent 結果我替他 commit」 | 主 agent 收 subagent 結果、整合後再 commit |
