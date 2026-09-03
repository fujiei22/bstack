---
name: execute-plan
description: |
  按 plan 推進實作（繁中）。觸發：跑 plan / execute plan / 實作 plan / 照 plan 做 /
  start coding / 開工 / 進 implementation / 寫 code。
  涵蓋：讀 plan、逐 task 紅綠循環、parallel-group 派 subagent、verify、commit、
  task fail 處置、blocker 升級。
  上游：review-plan（user accept）；T1 依 CLAUDE.md §Tier「plan 跳」由 brainstorm 直接交棒。
  下游：verify-done（全 task 完）。
  **T0 不進本 skill**：CLAUDE.md §Tier 表的 T0 是「brainstorm / plan / TDD / review / security 全跳」，
  dev-workflow 與 brainstorm 皆明訂 T0 直接實作後進 finish-branch。
---

# execute-plan

按 plan 把 task 一個個跑完。**主節奏 skill** — 內含 tdd-cycle、視情況載 dispatch-parallel。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 plan**：從 hand-off state 取 `plan_path`、Read 全文。同時讀 `spec_path` 對齊目標。
2. **TaskCreate**：把 plan 內每個 task 落到 TaskCreate（含 parallel-group 屬性）。
3. **逐 group 推進**：
   - 同 `parallel-group` 多 task → 載 `dispatch-parallel`、由它判跑法（Agent Teams / subagent / 串行）並問 user
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
2. 讀 task 5 個 step，**並比對要動的檔是否都在 `codebase_impact.files` 內**；有前端檔不在清單 → 進 §前端檔處理 的例外分支
3. **進 tdd-cycle**：嚴格紅 → 跑紅 → 綠 → 跑綠 → commit
4. 遇 verify command → 跑 → 印 output → 確認 expected
5. `TaskUpdate` → `completed`
6. 進下個 task / 下個 group

---

## §前端檔處理

**先講常規**：task 要動的前端檔**在** `codebase_impact.files` 裡 → 照 §Task 推進規則 第 3 步之前載 `design-language`、寫完跑 `design-language §對齊檢查清單` 四項（元件狀態 / 斷點 / 表單 / dark mode）。這是既有規則，見 `dev-workflow` §跨流程 skill 觸發。

**本節其餘講的是例外**：施工中發現要動的前端檔，不在 `codebase_impact.files` 裡——也就是 Phase 0 沒看到它。

判斷副檔名用 `design-language` §前端副檔名 那份清單（**不在本檔重列**），排除同樣照 `design-language` §使用契約 第 1 步：剔除 `~/.claude/skills/**`，或 repo 內含 `*/SKILL.md` 的 `skills/**`。**不得用裸 `skills/` 比對**——`design-language` 明文說明理由：某個專案可能有叫 `skills/` 的產品目錄，裸比對會把真實介面靜默排除。

**動作（五步）**：

1. **暫停當前 task**，`TaskUpdate` 維持 `in_progress`，**不 commit 半成品**。
2. **補判**：載入 `design-language`，把新冒出的檔交給它，取回 `design.*` 六欄。
3. **依 `size` 分流**：
   - **小改** → 跑 `design-language §對齊檢查清單` 四項，通過就繼續寫 code
   - **大改** → **先查 `spec.md` 是否已有 `direction_decided`**：有值代表本 task 走過三方向，**照已定案方向做，不重問**。沒有才**升級為 user gate**，走 `AskUserQuestion`：
     1. 現在轉進三方向（`design-direction`）
     2. 縮回小改範圍、只做沿用既有 token 的版本
     3. 這個前端改動其實不必要，撤掉
     4. 切成本 branch 內的獨立 task 之後再做（**不另開 branch**）
     5. 接受它是大改、照既有 token 做完並記入技術債
     6. 暫停整個 plan 重新 brainstorm——此時未 commit 的改動一律 `git stash`，不丟棄
     > **不得自行選定後繼續**。大改代表有新的視覺決策要做，那是 user 的決定不是實作細節。
     > **無人值守**時停在這裡等，**不得自選**（對齊 `design-direction` §使用契約 的同一條禁令）。
4. **回寫 state**：把補判結果寫回 `state.design`（`involved=true`、`size` 依補判），原值存進 `design_rejudge[].design_before`。**大改才另外回寫 `plan.md`**（在該 task 底下追加 `轉進紀錄`）——小改只進 state，不必動 plan，否則「順手多改一個 `.css`」的成本過重。
   > 為什麼一定要回寫 `state.design`：不回寫的話 `verify-done` §漏網複查 會對同一批檔**再觸發一次**；大改情境甚至會把 user 五分鐘前答過的問題再問一次並升成 blocker。
5. **接回 §Task 推進規則 第 3 步（tdd-cycle）**，從中斷處繼續，**不必整個紅綠循環重來**。

**禁止**：
- 發現前端檔卻只在心裡記一下就繼續寫
- 把中途轉進當 §Blocker 處理然後停在那裡——轉進**有明確回歸點**，是繞路不是撞牆
- 為了不轉進而把前端改動拆到別的 branch 偷做（選項 4 指的是**本 branch 內**的新 task）

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
   - 退到 write-plan 重寫 plan — plan 有**結構性問題**（task 拆錯 / 順序錯 / 漏依賴 /
     並行 group 分錯 / 某個 task 的五個 step 根本寫不出來）
   - 退回 brainstorm 重釐清需求 — **需求理解就錯**（scope 定錯 / Track / Tier 判錯 /
     `design.size` 判錯），照 plan 做下去只會做出不該做的東西
   - escalate
4. 選後執行；`state.fail_history` append

**退 write-plan 還是退 brainstorm，用這句當場判**：「把 plan 改對，這件事就對了嗎？」
會對 → 退 write-plan；改對 plan 還是在做錯的東西 → 退 brainstorm。措辭與判準跟
`review-plan` §User gate 的選項 3 / 4、`verify-done` §Verify fail 的對應選項一致，三處刻意同一套。

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
  design_rejudge:               # 施工開始後對 design.* 的重判；沒發生就是空 list
    - stage: execute-plan       # execute-plan | verify-done
      task_id: <轉進發生在哪個 task>
      trigger_files: [...]
      design_before: {...}      # 補判前的六欄
      design: {...}             # 補判後的六欄
      action: <小改對齊|大改-user-gate|blocker>
      user_choice: <大改時 user 選的選項|null>
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
