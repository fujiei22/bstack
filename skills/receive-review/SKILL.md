---
name: receive-review
description: |
  接收 review finding、執行 auto-fix 或詢 user（繁中）。觸發：
  收到 review / review 結果 / 處理 review / apply review fix / 改 review 意見。
  涵蓋：依 CLAUDE.md §Auto-fix 規則分流（危險問 / 非危險自動修）、
  T3 額外讓 user 看 diff、review reject 流程、空 / 全綠 review 短路。
  上游：request-review。下游：security-audit（依 tier / 條件）或 finish-branch。
---

# receive-review

review subagent 把 finding 丟回來後，**主 agent 處置**：自動修 / 問 user / 略過。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state** 取 `review_summary_path`、`tier`、`critical_count`、`major_count`。
2. **掃 finding 分類**：依 CLAUDE.md §Auto-fix 表分「不危險類」與「危險類」。
3. **不危險類** → 主 agent 直接 fix、commit、把 diff 給 user 看。
4. **危險類** → `AskUserQuestion` 問 user 該不該修、怎麼修。
5. **T3 全程**：即使「不危險類」也要 user 看 diff 才 commit（不強制 prompt、但顯式）。
6. 全部處置完 → 整理 `review_summary_path` 為定稿 → 交下個 phase。

---

## §不危險 vs 危險分類

依 CLAUDE.md §Auto-fix。再加 review-context 細化：

### 不危險（AI 自動修）
- typo / 註解錯字
- import 排序 / 未用 import
- 變數命名（不改 public API name）
- 純 formatting / lint
- 純 refactor（不改 behavior）
- 加缺漏的 docstring / 註解
- 加缺漏的 type annotation

### 危險（必問 user）
- DB schema / migration
- 認證 / 授權邏輯
- payment / 收費邏輯
- 檔案刪除 / batch operation
- dependency 升降 / 新增
- infra config（Dockerfile / k8s / terraform / CI）
- public API 介面變動（rename / 移除 / 改 signature）
- error handling 策略改變
- 對 production data 的 side effect
- 任何被 file-type-guard 警告的檔案改動

### 灰色（依 tier）
- 邏輯重構（改 implementation 但 behavior 不變）
  - T1/T2 → 不危險、自動修
  - T3 → 仍給 user 看 diff
- 加新測試
  - 全 tier 不危險、自動加
- 改測試（既有測試）
  - 若是測試名 / 重整 → 不危險
  - 若改 assertion / 測試行為 → 危險

---

## §不危險處置（自動修）

對每個 finding：

1. 寫 fix code
2. commit（依 CLAUDE.md commit 格式；type 通常 `style` / `refactor` / `test` / `docs`）
3. 印 diff 給 user 看：
   ```
   已自動修：<finding 簡述>
   diff:
   <git diff HEAD~1>
   ```
4. 不需 user 點頭、繼續下個 finding

**T3 特例**：批次完成後、進下 phase 前，整個 diff 給 user 過一眼：
```
T3 / 本次 review fix 共改 <N> 個 finding。請看 diff：
<git diff <pre-review-sha>...HEAD>
若有要 revert 的告知；否則進 <next phase>。
```

---

## §危險處置（問 user）

對每個 finding，`AskUserQuestion`：

```
問：Reviewer 指出：<finding 內容>
  影響：<file / function>
  reviewer 建議：<reviewer 寫的 fix 建議>

選項：
  1. 採用 reviewer 建議（推薦，若 reviewer 寫得合理）
  2. 改用 user 想的方式（user 自己指示）
  3. 暫時不處、列入 TODO（標 known issue 進 PR）
  4. 退回 execute-plan 重做相關 task
```

選 1 → 主 agent 寫 fix、commit、印 diff
選 2 → 等 user 給細節 → 主 agent 寫 → commit
選 3 → 加入 `docs/plans/<topic>/TODO.md`、不修
選 4 → 退 execute-plan、`state.fail_history` 記錄 review trigger

---

## §特殊狀況

### Review 全綠 / 0 finding
- `review_summary_path` 標 「無 finding，跳 receive-review、直接進下 phase」
- 短路 — 不啟動 fix 循環

### 1 reviewer 提、其他反對
- 多 reviewer 衝突 → `AskUserQuestion` 把所有視角列給 user 決定

### Reviewer 給的 fix 自己錯
- 主 agent 不照搬；提出修正後的 fix、`AskUserQuestion` 給 user 看：
  ```
  Reviewer 建議：<原建議>
  主 agent 評：<為何 reviewer fix 不對 / 不適合>
  主 agent 建議：<更好的 fix>
  ```

---

## §hand-off state

```yaml
state:
  review_resolved:
    auto_fixed: [...]      # finding ID 列
    user_decided: [...]
    deferred_to_todo: [...]
    triggered_rollback: bool
  review_summary_path: docs/reviews/_temp/<task-slug>.md  # 已更新
  current_phase: receive-review-done
```

**下一 phase**：
- 若 `triggered_rollback` → 退 execute-plan
- 否則 → security-audit（依 tier 條件）/ 否則 → finish-branch

---

## §結尾 Trace 標籤

```
[Trace] Phase=receive-review | Tier=<T1-T3> | Track=<Bug/Dev> | Skill=receive-review
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「reviewer 說 critical 太煩跳過」 | critical 必處（修 / 列 known issue / 退 execute-plan 三選一）|
| 「危險類我判斷一下自己 fix」 | 危險類必問；不准 auto-fix |
| 「T3 也偷偷 auto-fix 不告訴 user」 | T3 even 不危險 也給 user 看 diff |
| 「reviewer fix 寫對直接套」 | 仍要評；reviewer 不必對 |
| 「全 fix 完一次 commit 就好」 | 每 finding fix 一個 commit；保 bisect-able |
