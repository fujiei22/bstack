---
name: write-plan
description: |
  從 spec 寫實作 plan（繁中）。載入：dev-workflow Phase 2（**T3 only**；brainstorm 產出 spec 後。T2 的施工清單在 spec 內，不進本 skill）；亦可由使用者顯式呼叫。
  涵蓋：bite-sized task / 紅綠循環 / 並行性分析（parallel-group） /
  spec → plan 對齊檢查 / 落檔 docs/work/&lt;branch-name&gt;/plan.md。
  上游：brainstorm（產出 spec）。下游：review-plan → execute-plan。
---

# write-plan

## 使用契約（強制）
1. **讀 spec**：從 brainstorm hand-off state 取 `spec_path`、Read 全文。
2. **檢查 scope**：spec 跨多獨立子系統、範圍仍過大 → 停下、提示 user 拆 sub-spec（每 sub-spec 各自走 brainstorm → write-plan）。
2.5 **`design.size=大改` 且 `direction_decided` 有值時**：先讀 `spec.md` 的「設計方向」段落，**依定案方向拆 task**。**不得推翻已定案的方向**——那是 user 看過三版真實視覺後選的（原話記在 `user_choice_quote`），覺得有問題 → 回報，不要自己換。選了「跳過三方向」時 `direction_decided` 為空，照一般流程拆。
3. **規劃檔案結構**：先列要建 / 改的檔案、每個的職責、邊界、interface。
4. **拆 task**：每 task 5 個 bite-sized step（紅 → 跑紅 → 綠 → 跑綠 → commit）。
5. **並行性分析**：標 `parallel-group: <N>`（同 N 可並行）。
6. **self-review**：對齊 spec / 找 placeholder / 型別一致。
7. **落檔 + commit**：寫到 `docs/work/<branch-name>/plan.md`，commit。
8. **交棒** review-plan。

**前提**：必須有 spec_path。沒 spec → 退回 brainstorm。`state.tier` 不是 T3 且不是 user 顯式呼叫 → 回報「T1 / T2 不進 write-plan」並交棒 execute-plan，不寫 plan.md。

## §檔案結構規劃（task 拆分前必做）
| 項 | 內容 |
|---|---|
| 新建的檔 | 路徑 + 一句職責 |
| 改動的檔 | 路徑 + 動什麼 + 為何 |
| 介面 | 跨檔的 function signature / class 邊界 |
| 測試檔 | 對應 src 路徑、測什麼 |
**原則**：一檔一職責、按職責切不按技術層次切、對齊既有 pattern 不隨便 unilateral refactor。

## §Task 結構（bite-sized）
每 task 一個目標，5 step 紅綠循環：
````markdown
### Task <N>: <component / behavior 名稱>
**parallel-group**: <int>   ← 同 group 號可並行；不可並行的後 task 用更大 N
**files**:
- create: `exact/path/to/new.py`
- modify: `exact/path/to/existing.py:<行範圍>`
- test:   `tests/exact/path/test_new.py`
- [ ] **Step 1: 寫失敗測試**
```python
def test_<具體行為>():
    result = function(input)
    assert result == expected
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL）
```
pytest tests/path/test_new.py::test_<name> -v
```
- [ ] **Step 3: 寫最小實作讓測試過**
- [ ] **Step 4: 跑測試確認通過**（同 Step 2 指令，Expected: PASS）
- [ ] **Step 5: commit**
```bash
git add tests/path/test_new.py src/path/new.py
git commit -m "feat: 加入 <具體功能> 並補測試"
```
````

## §並行性分析（parallel-group）
execute-plan 遇 `parallel-group` 相同的多 task → 載 `dispatch-parallel` 判跑法後平行跑。
1. 同 `parallel-group: N` 的 task **彼此無依賴**（任何順序都能跑，結果一致）；group 號**遞增**，group 1 全完才開 group 2。
2. **不確定能否並行 → 分開 group**（保守）。
3. 獨立模組 / 不同檔的新建檔 / 互不引用的 endpoint 可同 group；**同檔多 task / 後 task 用前 task 介面 / db migration 後續 query** → 不同 group。
```
Task 1: 新建 User model            parallel-group: 1
Task 2: 新建 Product model         parallel-group: 1
Task 3: 新建 Order model（引用 User + Product）  parallel-group: 2
```

## §Plan 文件 Header（必）
```markdown
# <Feature 名> Implementation Plan

> 對應 spec: `docs/work/<branch-name>/spec.md`
> Track: <Bug/Dev> | Tier: <T0-T3>
> 建立: <YYYY-MM-DD>
> 並行最大 group: <N>

**Goal**: <一句描述>

**Architecture**: <2-3 句架構決策>

**Tech Stack**: <關鍵技術 / lib>

**Risks**: <主要風險、trade-off>

---
```

## §No-placeholder 紀律
| 禁 | 替代 |
|---|---|
| `TBD` / `TODO` / `稍後實作` / `fill in` | 直接寫實際內容 |
| `加入適當 error handling` / `處理 edge case` | 列出每個 error / edge case + 對策 |
| `寫測試覆蓋上面` 但無測試 code、步驟只講 what 沒 code block、`同 Task N` 但不重貼 code | 直接寫 test code / 補 code block / 重貼 code（reader 可能跳讀） |
| 引用 type / function / method 但無處定義 | 在前面 task 補定義 |

## §Self-review
寫完整 plan 後，**自己**對著 spec 走一輪，找到 issue **直接改**、不必再 review：
1. **spec coverage**：spec 每個 requirement / success criteria 都點得出對應 task，漏的補 task。
2. **placeholder 掃**：對 §No-placeholder 表逐條找。
3. **型別一致**：function / property / return type 跨 task 不變（task 3 `clearLayers()` 但 task 7 `clearFullLayers()` = bug）。
4. **並行性檢查**：同 group 的 task 真的無依賴。
5. **scope 檢查**：超出 spec 範圍的刪。

## §落檔 + 交棒
**hand-off state**（plan.md 已依使用契約第 7 步 commit）：
```yaml
state:
  plan_path: docs/work/<branch-name>/plan.md
  parallel_groups: [1, 2, 3, ...]   # 出現過的 group 號
  task_count: <N>
  current_phase: write-plan-done
```
**下一 phase**：→ `review-plan`，視角依 `state.review_perspectives`（brainstorm 0b 依改動面向判；Eng 下限）。

## §結尾 Trace 標籤
```
[Trace] Phase=write-plan | Tier=T3 | Track=Dev | Skill=write-plan
```

## §Red Flags
| 想法 | 真相 |
|---|---|
| 「task 寫粗一點省事」 | bite-sized 才能 reliable 執行 |
| 「placeholder 之後補」 | placeholder = plan failure |
| 「self-review 等 user 看就好」 | self-review 抓的東西 user 不該幫你抓；spec 漏 requirement 也是 plan failure |
| 「跳過交棒 review-plan、直接 execute」 | 違反流程；review-plan 才能擋掉糟 plan |
