---
name: verify-done
description: |
  task 完成前的綜合驗證（繁中）。觸發：verify / 驗證 / 測一下 / 跑測試 /
  task 完成 / done / 收尾驗證 / 跑 lint / 跑 build / 跑 e2e。
  涵蓋：test / lint / build / type-check 全跑、T2+ 多輪 verify、
  T3 UI 改動加 browser e2e、verify fail 處置。
  上游：execute-plan（task 全完）/ tdd-cycle（單 task 完）。
  下游：request-review。
---

# verify-done

把 task 全跑完後到 PR 之間的「綠燈關卡」。**不過 = 不進 review**。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state** 取 `tier`、`codebase_impact`、`commits`。
2. **依 tier 跑驗證套餐**：
   - T1 = test + lint + type-check（基本盤）
   - T2 = T1 + build + 周邊回歸測試 + lint 全跑
   - T3 = T2 + 整 test suite + 必要時 browser e2e
3. **每項 verify 印 command + output**（讓 user 看得到）。
4. 全綠 → 交棒 request-review。
5. 非綠 → 走 §Verify fail 流程。

---

## §Verify 套餐（按 tier）

### T1 套餐
```
1. 跑動到的測試檔
   npm test <path> -v   /  pytest <path> -v
2. 跑 lint（動到的範圍）
   eslint <path>        /  ruff check <path>
3. 跑 type-check（如有）
   tsc --noEmit         /  mypy <path>
```

### T2 套餐
- T1 全部
- 跑**周邊回歸**：動到的 module + 依賴它的 module 的測試
- 跑 **build**（確保沒讓 build pipeline 壞）
- lint 全 repo 改動範圍

### T3 套餐
- T2 全部
- 跑**整個 test suite**
- 若改動含 UI / DOM / browser code → 跑 **browser e2e**（playwright / cypress / 你的 e2e setup）
- 若改動含 DB → 跑 migration dry-run + schema diff 對齊

---

## §verify 失敗處置

走 CLAUDE.md §Fail handling：

1. 不靜默 retry
2. 評起因（flaky / 環境 / 真 bug / verify command 寫錯）
3. `AskUserQuestion` 提：
   - **retry**（flaky / 暫態）
   - **adjust + retry**（AI 提具體 fix）
   - **rollback** 該 commit / 從前一個綠的 state 重來
   - **退回 execute-plan 改 task 實作**
   - **退回 write-plan 改 plan**
   - **escalate**
4. 選後執行；`state.fail_history` append

**特別 case**：
- lint warning 但功能對 → 走 §Auto-fix 不危險類自動修
- test flaky 反覆 3+ 次仍 flaky → 標 flaky、列入 `state.flaky_tests` 給 review 階段看；不阻塞流程
- type error 在改動範圍外 → 標 unrelated；不阻塞 但提示 user

---

## §UI / browser e2e（T3 only）

改動含 UI 才跑。範圍：
- 跑既有 e2e 測試套件
- 若 plan 有提到 user-facing 新 flow → 補一個冒煙測試（playwright nav + 關鍵 click + assert）
- 截圖留證據（測試 fail 才用）

工具：依 repo 的 e2e setup（不強制 playwright）。

---

## §hand-off state

```yaml
state:
  verify_results:
    test: pass | fail
    lint: pass | fail | warn
    build: pass | fail
    type_check: pass | fail
    e2e: pass | fail | skipped
  flaky_tests: [...]
  current_phase: verify-done-done
```

**下一 phase**：→ `request-review`

---

## §結尾 Trace 標籤

```
[Trace] Phase=verify-done | Tier=<T1-T3> | Track=<Bug/Dev> | Skill=verify-done
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「test pass build 之後跑」 | 一起跑、要看 build 是否被 task 改動弄壞 |
| 「lint warning 算過」 | warning 跟 error 看實質；warning 也該處 |
| 「e2e 慢、跳過」 | T3 UI 改動 e2e 是 must；T1/T2 不跑 |
| 「環境問題不算 verify fail」 | 仍要 escalate，user 環境壞 user 才能修 |
