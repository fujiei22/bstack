---
name: debug-systematic
description: |
  系統性 bug fix（繁中）。觸發：debug / 修 bug / 壞了 / 不對 / 異常 / 失敗 /
  沒反應 / 報錯 / 跑不起來 / regression / 行為不如預期 / unexpected behavior。
  涵蓋：Triage / Reproduce / Min Repro / 專注 Fix / 專注 Test 五步驟，
  每 bug fix 必有測證明 + 防回歸。
  上游：brainstorm（Bug track 進此）。下游：verify-done。
---

# debug-systematic

修 bug 的紀律性流程。**沒測證明 = 沒修**。

## 使用契約（強制）

**載入後立即動作**：

進五步驟：Triage → Reproduce → Min Repro → Fix → Test。**不可跳**任何一步、**不可合**步驟。

```
1. Triage   ：理解嚴重度、影響範圍、急迫性
2. Reproduce：能重現嗎？步驟？
3. Min Repro：最小複製案例
4. Fix      ：寫一個專注的 fix
5. Test     ：寫測試證明 + 防回歸
```

---

## §Step 1: Triage

問清楚：

| 項 | 內容 |
|---|---|
| 症狀 | user 看到 / 感受到什麼？error message / wrong output / hang / crash？|
| 影響 | 多少 user 受影響？單一 / 所有？production / staging / local？|
| 急迫 | 阻塞 user 工作？資料損壞？安全風險？ |
| 首見 | 什麼時候開始？哪個 release / commit 後？|
| 環境 | 平台 / 瀏覽器 / OS / 版本？|

不清楚 → `AskUserQuestion` 問 user（不要猜）。

---

## §Step 2: Reproduce

**目標**：能 100% 重現。

問 user 或自己跑：

1. 重現步驟（step-by-step）
2. 預期 vs 實際
3. log / screenshot / error trace（如有）

**不能重現 = 不能修**。重現不出來 → 走以下其中一條：
- `AskUserQuestion` 問 user 更精確的 step
- 看 production log / error tracker（Sentry / DataDog）找模式
- 升 incident-investigate（不易重現 = T2+ 升級信號）

---

## §Step 3: 最小複製（Min Repro）

把重現步驟**簡化到最小**：

- 移除無關 setup
- 移除無關資料
- 縮成幾行 code / 一個 endpoint call / 一個 input

**為何**：min repro 讓 root cause 跑出來。一堆無關 setup 會藏起真兇。

範例：
- 原 repro：「開 app、登入、跑 4 個 workflow 後第 5 個 hang」
- min repro：「呼叫 `process(emptyArray)` hang」

Min repro 失敗 → 仍要 simplify 直到能；別跳直接 fix。

---

## §Step 4: 寫專注的 Fix

**只**修這 bug；**不**順便重構、不順便加 feature、不順便改命名。

- 找 root cause（不是 symptom）
- 最小 fix（不過度設計）
- 不動 unrelated code

「順便」改動 → 拆獨立 commit / 獨立 task。

---

## §Step 5: 寫測試證明 + 防回歸

**先**寫測試（依 tdd-cycle）。測試針對 bug 行為：

1. **RED**：寫 min repro 的失敗測試
   ```typescript
   test('process(emptyArray) returns [] instead of hang', () => {
     const result = process([]);
     expect(result).toEqual([]);
   });
   ```
2. **Verify RED**：跑、看它 fail（**用原本沒 fix 的 code**）
3. **GREEN**：apply fix
4. **Verify GREEN**：跑、看它 pass + 其他既有測仍 pass

**Test 寫對 = 證明 bug 真的存在 + 證明 fix 真的解掉**。

---

## §commit 規範

依 CLAUDE.md：

```
fix: <bug 簡述、繁中、50 字內>

- 症狀：<簡述>
- root cause：<簡述>
- 對策：<簡述>

Refs: #<issue>
```

範例：
```
fix: 修 process 空 array hang 問題

- 症狀：process([]) 永遠不返回
- root cause：while loop 條件用 length>0 + decrement 不執行
- 對策：early return 空 input；加防呆 test

Refs: #42
```

---

## §升級到 incident-investigate

以下情境 → **同時載 incident-investigate**：
- T2+ 任務
- production incident（user-facing、多人受影響）
- 不易重現（intermittent / flaky）
- 跨服務 / 跨系統互動
- log 散落、症狀模糊

incident-investigate 提供更系統的調查框架 + 自動產 incident report。

---

## §hand-off state

```yaml
state:
  bug:
    symptom: <簡述>
    root_cause: <簡述>
    fix_commit: <sha>
    test_commit: <sha>
    regression_test: <path:test_name>
  current_phase: debug-systematic-done
```

**下一 phase**：→ `verify-done`

---

## §結尾 Trace 標籤

```
[Trace] Phase=debug-systematic | Tier=<T1+> | Track=Bug | Skill=debug-systematic
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「重現不出來、先 fix 看看」 | 不能修；先重現 |
| 「跳 min repro 直接看 root cause」 | min repro 才能避 false root cause |
| 「順便 refactor 一下」 | 禁；拆獨立 commit |
| 「fix 完不用寫測試、太累」 | 必寫；沒測 = 下次回歸發現不了 |
| 「測試寫一下就好不必看它 fail」 | 必看 fail；沒看過 fail 證明不了測對的東西 |
| 「重現不出來 = bug 不存在」 | 升 incident-investigate；別 dismiss |
