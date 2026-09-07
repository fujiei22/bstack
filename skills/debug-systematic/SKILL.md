---
name: debug-systematic
description: |
  系統性 bug fix（繁中）：Triage → Reproduce → Min Repro → Fix → Test，每 fix 必有測試。
  載入：Bug track Phase 3'，brainstorm 判 Track=Bug 後。
---

# debug-systematic

修 bug 的紀律流程。**沒測證明 = 沒修**。

## 使用契約（強制）

**載入後立即動作**：進五步驟，**不可跳**、**不可合**。

```
1. Triage   ：理解嚴重度、影響範圍、急迫性
2. Reproduce：能重現嗎？步驟？
3. Min Repro：最小複製案例
4. Fix      ：寫一個專注的 fix
5. Test     ：寫測試證明 + 防回歸
```

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

## §Step 2: Reproduce

**目標**：100% 重現。問 user 或自跑：

1. 重現步驟（step-by-step）
2. 預期 vs 實際
3. log / screenshot / error trace（如有）

**不能重現 = 不能修**。重現不出來 → 擇一：
- `AskUserQuestion` 問 user 更精確的 step
- 看 production log / error tracker（Sentry / DataDog）找模式
- 升 incident-investigate（不易重現 = T2+ 升級信號）

## §Step 3: 最小複製（Min Repro）

把重現步驟**簡化到最小**：移除無關 setup 與資料，縮成幾行 code / 一個 endpoint call / 一個 input；無關 setup 會藏真兇。

例：原 repro「開 app、登入、跑 4 個 workflow 後第 5 個 hang」→ min repro「呼叫 `process(emptyArray)` hang」。

Min repro 失敗 → 仍要 simplify 直到能；別跳直接 fix。

## §Step 4: 寫專注的 Fix

**只**修這 bug：找 root cause（不是 symptom）、最小 fix、不動 unrelated code。**不**順便重構 / 加 feature / 改命名；「順便」改動拆獨立 commit / task。

## §Step 5: 寫測試證明 + 防回歸

**先**寫測試（依 tdd-cycle），針對 bug 行為：

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

**測寫對 = 證明 bug 存在 + 證明 fix 解掉**。

## §commit 規範

見 rules.md「Commit 訊息」；bug fix 的 body 固定三點：

```
fix: <bug 簡述、繁中、50 字內>

- 症狀：<簡述>
- root cause：<簡述>
- 對策：<簡述>

Refs: #<issue>
```

## §升級到 incident-investigate

以下情境 → **同時載 incident-investigate**：
- T2+ 任務
- production incident（user-facing、多人受影響）
- 不易重現（intermittent / flaky）
- 跨服務 / 跨系統互動
- log 散落、症狀模糊

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

## §結尾 Trace 標籤

結尾貼 rules.md §Trace 標籤（Phase=debug-systematic）

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「重現不出來、先 fix 看看 / 當 bug 不存在」 | 不能修；先重現、不出升 incident-investigate |
| 「跳 min repro 直接看 root cause」 | min repro 才能避 false root cause |
| 「順便 refactor 一下」 | 禁；拆獨立 commit |
| 「fix 完不用寫測試、太累」 | 必寫；沒測 = 下次回歸發現不了 |
| 「測試寫一下就好不必看它 fail」 | 必看 fail；沒看過 fail 證明不了測對的東西 |
