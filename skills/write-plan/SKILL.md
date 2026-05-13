---
name: write-plan
description: |
  從 spec 寫實作 plan（繁中）。觸發：write plan / 規劃 / 拆 task / implementation plan /
  寫計畫 / 拆步驟 / 任務分解 / TDD plan / 寫做法 / 拆解 / breakdown。
  涵蓋：bite-sized task / 紅綠循環 / 並行性分析（parallel-group） /
  spec → plan 對齊檢查 / 落檔 docs/plans/&lt;topic&gt;/plan.md。
  上游：brainstorm（產出 spec）。下游：review-plan → execute-plan。
---

# write-plan

把 spec 拆成「engineer 沒 context 也能照做」的 bite-sized task 清單。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 spec**：從 brainstorm hand-off state 取 `spec_path`、Read 全文。
2. **檢查 scope**：若 spec 內單一 sub-system 範圍仍過大、跨多獨立子系統，停下、提示 user 拆 sub-spec（每 sub-spec 各自走 brainstorm → write-plan）。
3. **規劃檔案結構**：先列要建 / 改的檔案、每個的職責、邊界、interface。
4. **拆 task**：每 task 5 個 bite-sized step（紅 → 跑紅 → 綠 → 跑綠 → commit）。
5. **並行性分析**：標 `parallel-group: <N>`（同 N 可並行）。
6. **self-review**：對齊 spec / 找 placeholder / 型別一致。
7. **落檔 + commit**：寫到 `docs/plans/<topic-slug>/plan.md`，commit。
8. **交棒** review-plan。

**前提**：必須有 spec_path。沒 spec → 退回 brainstorm。

---

## §檔案結構規劃（task 拆分前必做）

任何 task 拆分前先答：

| 項 | 內容 |
|---|---|
| 新建的檔 | 路徑 + 一句職責 |
| 改動的檔 | 路徑 + 動什麼 + 為何 |
| 介面 | 跨檔的 function signature / class 邊界 |
| 測試檔 | 對應 src 路徑、測什麼 |

**原則**：
- 一檔一職責；檔太大 → 切（除非既有 codebase 風格如此）
- 一起改的東西放一起；按職責切，不按技術層次切
- 對齊既有 pattern，不隨便 unilateral refactor

---

## §Task 結構（bite-sized）

每 task 一個目標。5 step 紅綠循環：

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

- [ ] **Step 2: 跑測試確認失敗**

```
pytest tests/path/test_new.py::test_<name> -v
# Expected: FAIL with "function not defined"
```

- [ ] **Step 3: 寫最小實作讓測試過**

```python
def function(input):
    return expected
```

- [ ] **Step 4: 跑測試確認通過**

```
pytest tests/path/test_new.py::test_<name> -v
# Expected: PASS
```

- [ ] **Step 5: commit**

```bash
git add tests/path/test_new.py src/path/new.py
git commit -m "feat: 加入 <具體功能> 並補測試"
```
````

---

## §並行性分析（parallel-group）

**目的**：execute-plan 階段，遇 `parallel-group` 相同的多 task → 載 `dispatch-parallel` 派 subagent 平行跑、節省時間。

**規則**：

1. 同 `parallel-group: N` 的 task **彼此無依賴**（任何順序都能跑，結果一致）。
2. `parallel-group` **遞增**：group 1 全完 → group 2 開始 → ...
3. **不確定能否並行 → 就分開 group**（保守）。
4. 通常**獨立模組 / 不同檔的新建檔 / 互不引用的 endpoint** 可同 group。
5. **同檔多 task / 後 task 用前 task 介面 / db migration 後續 query** → 不同 group。

範例：
```
Task 1: 新建 User model            parallel-group: 1
Task 2: 新建 Product model         parallel-group: 1
Task 3: 新建 Order model（引用 User + Product）  parallel-group: 2
Task 4: User CRUD endpoint         parallel-group: 3
Task 5: Product CRUD endpoint      parallel-group: 3
Task 6: Order CRUD endpoint        parallel-group: 4
```

Group 1 三 task（無依賴）可並行 → 主 agent spawn 2 subagent + 自己跑 1 個；Group 2 串行；Group 3 二 task 並行；Group 4 串行。

---

## §Plan 文件 Header（必）

```markdown
# <Feature 名> Implementation Plan

> 對應 spec: `docs/plans/<topic-slug>/spec.md`
> Track: <Bug/Dev> | Tier: <T0-T3>
> 建立: <YYYY-MM-DD>
> 並行最大 group: <N>

**Goal**: <一句描述>

**Architecture**: <2-3 句架構決策>

**Tech Stack**: <關鍵技術 / lib>

**Risks**: <主要風險、trade-off>

---
```

---

## §No-placeholder 紀律

以下是 **plan failure**，禁出現：

| 禁 | 替代 |
|---|---|
| `TBD` / `TODO` / `稍後實作` / `fill in` | 直接寫實際內容 |
| `加入適當 error handling` | 列具體會抛 / 處理哪些 error |
| `處理 edge case` | 列出每個 edge case + 對策 |
| `寫測試覆蓋上面` 但無測試 code | 直接寫 test code |
| `同 Task N` 但不重複 code | 重貼 code（reader 可能跳讀）|
| 引用 type / function / method 但無處定義 | 在前面 task 補定義 |
| 步驟描述 what 但沒 how / 沒 code block | 補 code block |

---

## §Self-review

寫完整 plan 後，**自己**對著 spec 走一輪檢查：

1. **spec coverage**：spec 每個 requirement / success criteria → 點得出對應 task？列 gap。
2. **placeholder 掃**：找 §No-placeholder 表的紅旗 → 修。
3. **型別一致**：function name / property name / return type 跨 task 不變（task 3 `clearLayers()` 但 task 7 `clearFullLayers()` = bug）。
4. **並行性檢查**：parallel-group 標的 task 真的無依賴？檢一次。
5. **scope 檢查**：plan 是否仍在 spec 範圍？跑題 → 刪。

找到 issue 就**直接改**、不必再 review。spec requirement 漏 task → 補 task。

---

## §落檔 + 交棒

寫至 `docs/plans/<topic-slug>/plan.md`，commit：

```bash
git add docs/plans/<topic-slug>/plan.md
git commit -m "docs: 加 <feature> implementation plan"
```

**hand-off state**：
```yaml
state:
  plan_path: docs/plans/<topic-slug>/plan.md
  parallel_groups: [1, 2, 3, ...]   # 出現過的 group 號
  task_count: <N>
  current_phase: write-plan-done
```

**下一 phase**：→ `review-plan`
- T2 = Eng-only 視角
- T3 = CEO + Design + Eng + DX 4 視角

---

## §結尾 Trace 標籤

```
[Trace] Phase=write-plan | Tier=<T1-T3> | Track=Dev | Skill=write-plan
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「task 寫粗一點省事」 | bite-sized 才能 reliable 執行 |
| 「placeholder 之後補」 | placeholder = plan failure |
| 「並行 group 全 N=1 算了」 | 浪費 execute-plan 階段時間；多用心拆 |
| 「self-review 等 user 看就好」 | self-review 抓的東西 user 不該幫你抓 |
| 「spec 有的我都記得不用對」 | 必對；漏 requirement 是 plan failure |
| 「跳過交棒 review-plan、直接 execute」 | 違反流程；review-plan 才能擋掉糟 plan |
