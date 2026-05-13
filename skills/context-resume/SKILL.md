---
name: context-resume
description: |
  進度快照讀回（繁中）。觸發：context-resume / resume context / 接續進度 /
  繼續上次 / 接回來 / load snapshot / 上次做到哪 / 繼續做。
  涵蓋：找最新 snapshot、Read 還原 state、印 progress 給 user、
  確認下一步、接續對應 phase skill。
  上游：context-snapshot（前次 session 存的）。
---

# context-resume

把 context-snapshot 存的進度讀回、還原 state、印給 user 看、接續執行。

## 使用契約

**載入後立即動作**：

1. **找 snapshot 候選**：
   - user 指定 path → 用該 path
   - 否則 `Glob docs/snapshots/**/*.md`、依檔名 ts 排序、取最新
   - 沒任何 snapshot → 印「沒找到，請走 brainstorm 開新 task」、結束
2. **Read snapshot 全文**。
3. **印 progress** 給 user 看（用 snapshot 內容濃縮）。
4. `AskUserQuestion` 確認接續方向。
5. 還原 `state` 結構 → 接續對應 phase skill（依 `current_phase`）。

---

## §印 progress 給 user

snapshot 讀完後：

```
[已載 snapshot: <path>]

## 上次進度回顧

- task: <topic-slug>
- track: <Bug/Dev>  tier: <T0-T3>
- branch: <branch_name>
- 進到: <current_phase>
- 已完成 task: <N>/<M>
- 進行中: <Task N - 卡在 <點>>
- 下一步: <明確動作>

## Open question（前次未答完）
- <列點，如有>

## 關鍵 decision 提醒
- <重要 decision 簡述>
```

---

## §接續方向確認

```
問：snapshot 讀完。接續方向？
  選項:
    1. 接續執行下一步：<明確下一步>（推薦）
    2. 跳到指定 phase（user 提）
    3. 答 pending question 後接續
    4. 不接續、開新 task（snapshot 視為 archive）
```

選 1 → 主 agent 推進 state、執行下一步
選 2 → user 指定的 phase 載入 skill
選 3 → user 答完 question 後再選 1
選 4 → 結束 resume、走 brainstorm 開新 task

---

## §State 還原

從 snapshot YAML 段重建 `state`：

```yaml
state:
  task_id: <from snapshot>
  track: <from snapshot>
  tier: <from snapshot>
  current_phase: <from snapshot>
  spec_path: <from snapshot>
  plan_path: <from snapshot>
  ...
  resumed_from: docs/snapshots/<...>.md
  resumed_at: <現在 ISO>
```

**驗 state 完整**：
- 各 path 是否存在（spec / plan / review）
- branch 是否還在 / clean
- 最後 commit sha 是否還是 HEAD

不一致 → 印 warning + `AskUserQuestion`：
- 是否 force resume（user 知狀態變了）
- 是否重新 reconcile（更新 state 對齊現實）
- 是否 discard snapshot 開新

---

## §跟 brainstorm 的差異

- **brainstorm**：開新 task 用、跑 Phase 0 4 子步驟
- **context-resume**：接續舊 task 用、不跑 Phase 0

resume 後 user 若提**新 idea** / 偏離原 task → 拒接續、引導走 brainstorm 開新。

---

## §跟 memory 的互動

resume 不主動讀 memory（brainstorm 0a 才讀）。

但 user 若希望 resume 時也讀 memory：
- `AskUserQuestion` 給 user 選「讀 memory 補 context」
- 預設不讀（避免 context 膨脹）

---

## §hand-off state

```yaml
state:
  resumed_from: docs/snapshots/<...>.md
  resumed_at: <ISO>
  current_phase: <from snapshot>
  # 其餘 state 完整還原
```

**下一 phase**：依 user 選擇 → 對應 phase skill

---

## §結尾 Trace 標籤

```
[Trace] Phase=<resumed phase> | Tier=<from snapshot> | Track=<from snapshot> | Skill=<resumed skill>
```

不貼自己（context-resume）作為 active skill、貼接續的 phase skill。

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「snapshot 全自動還原、不問 user」 | 必走 AskUserQuestion 確認方向 |
| 「最新 snapshot 一定對」 | 驗 state 是否與現實一致；不一致 prompt user |
| 「resume 跳 Phase 0、user 提新想法也接」 | 偏離原 task → 拒；引導開新 |
| 「snapshot 不存 = 開新」 | 顯示找不到、引導 brainstorm；別自作主張開新 |
