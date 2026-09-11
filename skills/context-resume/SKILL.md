---
name: context-resume
description: |
  進度快照讀回（繁中）：找最新 snapshot、還原 state、接續 phase。
  載入：新 session 接續舊 task；亦可顯式呼叫。
---

# context-resume

## 使用契約

1. **找 snapshot**：user 給 path 就用；否則 `Glob docs/snapshots/**/*.md` 依檔名 ts 取最新；都沒有 → 印「沒找到，請走 brainstorm 開新 task」、結束。headless 時只找 `docs/snapshots/issue-<n>-*.md`（`headless-mode` §偵測）
2. **Read snapshot 全文**。
3. **印 progress**（snapshot 濃縮）。
4. `AskUserQuestion` 確認接續方向；headless 時不問：snapshot 有 `pending_question` → `headless-mode` §讀回覆，沒有 → 接續下一步（等同選項 1）。
5. 還原 `state` 結構 → 接續對應 phase skill（依 `current_phase`）。

## §印 progress 給 user

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

## §接續方向確認

```
問：snapshot 讀完。接續方向？
  選項:
    1. 接續執行下一步：<明確下一步>（推薦）
    2. 跳到指定 phase（user 提）
    3. 答 pending question 後接續
    4. 不接續、開新 task（snapshot 視為 archive）
```

1 → 推進 state 執行下一步；2 → 載 user 指定 phase 的 skill；3 → 答完 question 再選 1；4 → 結束 resume、走 brainstorm 開新

## §State 還原

由 snapshot YAML 重建 `state`：

```yaml
state:
  task_id: <from snapshot>
  track: <from snapshot>
  tier: <from snapshot>
  current_phase: <from snapshot>
  spec_path: <from snapshot>
  plan_path: <from snapshot | null>   # T1 / T2 為 null，別因此判 snapshot 壞掉
  ...
  resumed_from: docs/snapshots/<...>.md
  resumed_at: <現在 ISO>
```

**驗 state 完整**：各 path（spec / plan / review）存在、branch 還在且 clean、最後 commit sha 仍是 HEAD。

不一致 → 印 warning + `AskUserQuestion`（headless 時 → B 類 `context-resume/inconsistent`）：
- 是否 force resume（user 知狀態變了）
- 是否重新 reconcile（更新 state 對齊現實）
- 是否 discard snapshot 開新

## §跟 brainstorm 的差異

- **brainstorm**：開新 task 用、跑 Phase 0 4 子步驟
- **context-resume**：接續舊 task 用、不跑 Phase 0

user 若提**新 idea** / 偏離原 task → 拒接續、引導走 brainstorm。

## §跟 memory 的互動

不主動讀 memory（brainstorm 0a 才讀）；user 要讀時：
- `AskUserQuestion` 給 user 選「讀 memory 補 context」
- 預設不讀（避免 context 膨脹）

## §hand-off state

```yaml
state:
  resumed_from: docs/snapshots/<...>.md
  resumed_at: <ISO>
  current_phase: <from snapshot>
  # 其餘 state 完整還原
```

**下一 phase**：user 選的 phase skill

## §結尾 Trace 標籤

```
[Trace] Phase=<resumed phase> | Tier=<from snapshot> | Track=<from snapshot> | Skill=<resumed skill>
```

Skill 欄貼接續的 phase skill，不貼 context-resume。

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「snapshot 全自動還原、不問 user」 | 必走 AskUserQuestion 確認方向；headless 例外見 `headless-mode` |
| 「最新 snapshot 一定對」 | 驗 state 與現實一致；不一致問 user |
| 「resume 跳 Phase 0、user 提新想法也接」 | 偏離原 task → 拒；引導開新 |
| 「snapshot 不存 = 開新」 | 印找不到、引導 brainstorm；別自行開新 |
