---
name: context-snapshot
description: |
  進度快照存（繁中）。觸發：context-save / save context / 存進度 / save progress /
  存快照 / 留 context / 跨 session 暫停 / 要關電腦 / 中斷 task。
  涵蓋：抽當前 state（spec / plan / phase / decision / pending）寫到
  docs/snapshots/<topic>-<ts>.md、Memory hook 可選、recovery 路徑明確。
  下游：未來 session 用 context-resume 接續。
---

# context-snapshot

把當前 dev-workflow state + 關鍵 decision + pending 寫到磁碟、下個 session 可被 context-resume 接回。

## 使用契約

**載入時機**：

1. user 顯式要存進度（「save context」/「存一下」）
2. session 接近 auto-compact 閾值
3. 長 task 跨日要暫停

**載入後立即動作**：

1. 抽 state 內容
2. 詢 user 是否要存（無顯式觸發 case 才問；顯式觸發直接存）
3. 寫到 `docs/snapshots/<topic-slug>-<ISO-ts>.md`
4. 印 path、告知 user 怎麼 resume

---

## §快照結構

```markdown
# Context snapshot: <topic-slug>

> 建立: <ISO timestamp>
> Phase: <current_phase>
> Tier: <T0-T3>
> Track: <Bug/Dev>
> Branch: <branch_name>
> 最後 commit: <sha>

## State 摘要

```yaml
task_id: <slug>
track: <Bug|Dev>
tier: <T0-T3>
current_phase: <phase>
spec_path: docs/plans/<topic>/spec.md
plan_path: docs/plans/<topic>/plan.md
tasks_completed: <N>/<M>
parallel_groups_done: [...]
review_summary_path: <path>
codebase_impact:
  files: [...]
  modules: [...]
  db_involved: <bool>
fail_history: [...]
```

## 已完成 task

- [x] <Task 1>: <簡述>
- [x] <Task 2>: <簡述>
- ...

## 進行中 task

- [ ] **<Task N>**: <簡述>
  - 進度：<step X/5>
  - 卡在：<具體點>
  - 下一步：<明確動作>

## 未開始 task

- [ ] <Task N+1>: <簡述>
- ...

## 關鍵 decision

- <T0c track 為 Dev、reason: ...>
- <T0d tier 為 T2、reason: ...>
- <review-plan 4 視角 finding 採用了 X / 略過 Y、reason: ...>

## Open question / pending user input

- <user 還沒答的 AskUserQuestion 列出>

## Resume 指引

下個 session 跑 `/context-resume` 並指此 path：
`docs/snapshots/<topic-slug>-<ISO-ts>.md`

Resume 流程：
1. Read 本檔 → 還原 state
2. 確認 user 沒 forgotten progress
3. 接續 progress 列的「進行中 task」「下一步」
```

---

## §存哪些東西

**存**：
- state YAML（完整）
- 已 / 進行中 / 未開始 task 清單
- 關鍵 decision（gate point 選擇、tier override、review override）
- pending user input（如未答 AskUserQuestion）
- relevant file path（spec / plan / review / snapshot 自身）

**不存**：
- code diff（已在 git 內，重複）
- 整個 codebase（重複）
- review subagent 完整 output（太大；保留摘要）
- secret / PII（依 safety-guard 篩）

---

## §存哪裡

`docs/snapshots/<topic-slug>-<ISO-ts>.md`

- `topic-slug`：對齊 `docs/plans/<topic-slug>/` 的 slug
- ISO-ts：`2026-05-13T14-30-00`（檔名禁`:`，用 `-`）

可選：`docs/snapshots/index.md` 維 list（每 entry 1 行）— 但這需 user 啟動才做、不自動。

---

## §commit snapshot 不？

snapshot 是 transient state、不算 deliverable。

預設 **不 commit snapshot**：
- 加到 `.gitignore` 的 `docs/snapshots/`
- snapshot 是 local-only

但若 user 想跨機器 / 跨 session 用：
- `AskUserQuestion` 問是否 commit
- 確認 sensitive content 已被 safety-guard 篩過才 commit

---

## §跟 memory 系統互動

snapshot **不是 memory**：
- snapshot = 當下進度（暫時）
- memory = 長期偏好 / 領域知識（持久）

但 snapshot 內若出現「值得 long-term 記住」的 decision，user 可手動載 memory：依 CLAUDE.md auto memory 規則寫到 `~/.claude/projects/.../memory/`。

snapshot 不主動寫 memory（避免雜訊）。

---

## §hand-off state

```yaml
state:
  snapshot_path: docs/snapshots/<topic>-<ts>.md
  snapshot_saved_at: <ISO>
```

不推進 phase（橫向 skill）。

---

## §結尾 Trace 標籤

由呼叫 phase 帶。

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「snapshot 含 code 比較完整」 | 不存 code；git 已有 |
| 「全部 review output 都存」 | 摘要即可；details 留 git diff / docs/reviews |
| 「snapshot 自動 commit」 | 預設不；user 顯式同意才 commit |
| 「snapshot 取代 memory」 | 不能；snapshot 是 transient、memory 是 persistent |
