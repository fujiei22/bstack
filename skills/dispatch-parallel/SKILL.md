---
name: dispatch-parallel
description: |
  Parallel subagent 派發（繁中）。觸發：execute-plan 遇 parallel-group >1 task /
  平行跑 / 並行 task / dispatch parallel / subagent 平行 / multi-agent。
  涵蓋：spawn 多 subagent、傳 task prompt、收集結果、整合、處理 conflict、
  失敗 retry / rollback。
  上游：execute-plan（遇 parallel-group）。下游：execute-plan（整合完接下個 group）。
---

# dispatch-parallel

execute-plan 遇 `parallel-group` 同號多 task 時，把這些 task 派給 subagent 平行跑、加速。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state** 取當前 group 的 task 清單（task ID + plan section path）。
2. **檢預設**：
   - group 內 task **真的無依賴**（write-plan 階段標的應已驗過、但再驗一次）
   - 工作目錄 clean（無未 commit 改動）
3. **spawn**：對 N 個 task spawn N-1 個 subagent + 主 agent 跑 1 個（最大化平行）。
4. **等所有完成**：收集每 subagent 的結果（diff + commit sha + verify 狀態）。
5. **整合**：主 agent 確認所有 commit 都進 branch、無 conflict、verify 都過。
6. **進下個 group**。

---

## §Spawn 細節

對每個非主 agent 跑的 task：

```
Agent tool call:
  description: "跑 Task <N>: <task name>"
  subagent_type: general-purpose
  prompt: |
    你是 dispatch-parallel 派發的 subagent。

    Context:
    - repo: <repo root>
    - branch: <branch name>
    - 你要跑的 task: <task ID + 摘要>
    - plan 全文: <貼 plan markdown>
    - spec 全文: <貼 spec markdown>
    - 你**只跑 task <N>**，其他 task 不動。

    流程：
    1. Read plan 找 Task <N> section
    2. 依 tdd-cycle 走 5 step（紅 → 跑紅 → 綠 → 跑綠 → commit）
    3. commit 時用 CLAUDE.md commit 格式
    4. 跑該 task 的 verify command
    5. 回報下面 JSON：
       {
         "task_id": "<N>",
         "commit_sha": "<sha>",
         "files_changed": [...],
         "verify_result": "pass | fail",
         "verify_output_tail": "<最後 30 行>",
         "notes": "<重要觀察 / blocker>"
       }

    **禁**：
    - 動 task <N> 以外的檔（除非 plan 明列）
    - 跑 push / open PR（主 agent 統一做）
    - 互動 user（subagent 無 AskUserQuestion 通道；遇要 user 決定 → fail with 原因）
```

主 agent **自己**也跑一個 task（不浪費 idle）— 走 tdd-cycle 同樣 5 step。

---

## §等所有完成

主 agent 自己跑完後，等剩餘 subagent 都返回。

收集：
- N 個 task 的 commit sha 清單
- N 個 verify 結果
- 任何 blocker / fail report

---

## §整合 / 衝突

理論上 group 內 task 無依賴 → 無 conflict。但驗：

1. `git status` 看 working tree 是否 clean
2. `git log <pre-group-sha>..HEAD --pretty="%h %s"` 看是否 N 個 commit 都進 branch
3. 跑 group 範圍的 test 一次（subagent 跑的 verify 是各自的；整合測再跑保險）

衝突案例（理論上不該發生、但 fallback）：
- 兩 subagent 改到同一檔同行 → conflict → 走 finish-branch §Conflict 流程
- 兩 commit 互相破壞（A 加新 function、B 移該 function） → review-plan 標 parallel 標錯 → 退 write-plan

---

## §Subagent fail 處置

任一 subagent 回 `verify_result: fail`：

1. 主 agent 印 subagent 回報的 `verify_output_tail`
2. 走 CLAUDE.md §Fail handling：
   - **retry**（重 spawn 同 subagent、prompt 加 「前次 fail 原因：<...>」）
   - **adjust + retry**（主 agent 提具體 plan task 改動、user 點頭再 retry）
   - **rollback**：`git reset --hard <pre-group-sha>` → 整 group 重來
   - **退 execute-plan** 改一般串行 spawn（不平行）
   - **退 write-plan** 改 parallel-group 標
3. 不靜默 retry

---

## §結果整合 + hand-off state

完成（含所有 fail handling 後）：

```yaml
state:
  parallel_groups_done: [..., <current-group-N>]
  group_commits:
    <group-N>: [<sha1>, <sha2>, ...]
  parallel_fail_history: [...]
  current_phase: execute-plan-continuing
```

控制權**還給 execute-plan**、推進下個 group。

---

## §跟 user 互動

dispatch-parallel 期間：

- spawn 前印 「group <N> 派 M task 平行跑」
- 等待期間每 30s 印 「子 task 進度：<N done / M total>」（不刷屏）
- 完成印 「group <N> 完成：M task / M commit」
- fail 印詳細 + 走 §Fail handling

**禁**：靜默跑、user 不知道在幹嘛。

---

## §結尾 Trace 標籤

```
[Trace] Phase=execute-plan | Tier=<T2/T3> | Track=Dev | Skill=execute-plan+dispatch-parallel
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「group 內看似獨立、直接平行」 | 仍要 pre-check（git status / 預設 verify） |
| 「subagent 自己 push / 開 PR」 | 禁；主 agent 統一 |
| 「subagent fail 重 spawn 多次自動」 | 禁靜默 retry；走 §Fail handling |
| 「conflict 自作主張 resolve」 | 走 finish-branch §Conflict 流程 |
| 「parallel 跑得快、跳 verify」 | 整合測必跑 |
| 「subagent prompt 不含完整 spec」 | 必含；subagent 無 context |
