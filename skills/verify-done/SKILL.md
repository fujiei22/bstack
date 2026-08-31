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
2.5 **跑 §漏網複查 的觸發判斷**（**全 tier 都跑**，成本是 1 個 `git diff`）。
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
- 若改動含 UI / DOM / browser code（.tsx / .jsx / .vue / .svelte / .html / .css / .scss）→ **載入 `frontend-test` skill** 跑 Playwright MCP e2e（必跑）

　**例外**：落在 skill 定義目錄底下的前端檔（`skills/*/assets/`、`skills/*/references/` 等）**不觸發** —— 那些是**工具範本、非可執行頁面**（例如只靠 `Object.assign(window,…)` 導出、沒有 HTML 宿主的元件片段），e2e 無從跑起。判準與 `design-language` §使用契約 第 1 步一致。
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
   - **退回 execute-plan 補做**（漏網複查判為大改時）
   - **退回 brainstorm 重判**（設計判定從一開始就錯）
   - **接受現況並記入技術債**（這一輪先出去，方向另案處理）
4. 選後執行；`state.fail_history` append

**特別 case**：
- lint warning 但功能對 → 走 §Auto-fix 不危險類自動修
- test flaky 反覆 3+ 次仍 flaky → 標 flaky、列入 `state.flaky_tests` 給 review 階段看；不阻塞流程
- type error 在改動範圍外 → 標 unrelated；不阻塞 但提示 user

---

## §UI / browser e2e

改動含 UI / 前端檔（.tsx / .jsx / .vue / .svelte / .html / .css / .scss）時觸發。**載入 `frontend-test` skill** 委派執行：

　**例外**：落在 skill 定義目錄底下的前端檔（`skills/*/assets/`、`skills/*/references/` 等）**不觸發** —— 那些是**工具範本、非可執行頁面**（例如只靠 `Object.assign(window,…)` 導出、沒有 HTML 宿主的元件片段），e2e 無從跑起。判準與 `design-language` §使用契約 第 1 步一致。

| Tier | 行為 |
|---|---|
| T1 | 預設不跑；user 明說再跑 |
| T2 | 可選；AI 視改動量自判（牽動 user flow 建議跑） |
| T3 | **必跑**（fail 不能放行 verify-done） |

frontend-test 跑完寫回 `state.verify_results.e2e` + `state.frontend_test.*`、本 skill 整合進綜合驗證結果。

詳見 `frontend-test` skill §測試矩陣 / §測試流程 / §測試報告。

---

## §漏網複查

**要防的事**：Phase 0b′ 判 `design.involved=false`（或 `scope` 判錯），但這一輪**實際改動檔**含前端副檔名——判定漏了，而且沒有任何 gate 會發現。**全 tier 都跑**：這種漏網最常發生在「T1，兩個檔，順手改一下」，只在 T3 跑等於對最需要的情境無效。

**觸發條件**：

1. 取本 branch 的改動清單。`<base>` = `state.commits` 第一個 commit 的 parent；**`state.commits` 不存在**（verify-done 被單獨呼叫、或上游是 tdd-cycle）→ fallback `$(git merge-base origin/main HEAD)`；兩者都取不到 → **不觸發**，在結果標 `design_rejudge` 未執行與原因。
2. **副檔名與排除判準一律依 `design-language`**（§前端副檔名 ＋ §使用契約 第 1 步的 skill 定義目錄排除 ＋ §首次偵測 的 `node_modules` / `dist` / `build` / `vendor` / gitignore 命中 / `design-demos` 排除）。**不在本檔重列清單，也不得用裸 `skills/` 比對。**
3. **已被 `design_rejudge` 處理過的檔不重複觸發**——`execute-plan` 中途轉進處理過的，不必在這裡再來一次。
4. 剩下的清單非空，且 `state.design.involved` 為 `false`、或該檔不在 `state.design.scope` 對應的範圍內（`scope` 對不上）→ 觸發。

**動作**：

1. 載入 `design-language` 補判，取回 `design.*` 六欄，append 進 `state.design_rejudge`（`stage: verify-done`）。
2. **跑 `design-language §對齊檢查清單` 四項對齊檢查**，結果記進 verify 結果。
3. **補判結果是大改 → 標為 blocker**，走 §verify 失敗處置 的 design 專屬三選項。

**界線（硬規則）**：**不在 verify-done 補做三方向。** 這時 code 已經寫完，叫三方向重來等於推翻已經寫好的實作——成本與收益不成比例。verify-done 的職責是**把漏網這件事變成看得見的**，不是把它就地補完。

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
  frontend_test:
    ran: <bool>
    report_dir: <path | null>
    report_path: <path | null>
    pass_count: <n>
    fail_count: <n>
    viewports_tested: [...]
    blocker: <bool>
  design_rejudge:               # 與 execute-plan 共用；沒發生就是空 list
    - stage: verify-done
      task_id: null             # verify 階段沒有 task 歸屬
      trigger_files: [...]
      design_before: {...}
      design: {...}
      action: <小改對齊|blocker>
      user_choice: <blocker 時 user 選的選項|null>
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
| 「e2e 慢、跳過」 | T3 UI 改動 e2e 是 must（載 frontend-test）；T1 預設不跑、T2 可選 |
| 「環境問題不算 verify fail」 | 仍要 escalate，user 環境壞 user 才能修 |
