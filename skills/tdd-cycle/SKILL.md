---
name: tdd-cycle
description: |
  Test-driven 紅綠循環（繁中）。載入：dev-workflow Phase 3（execute-plan 每 task step 內）；亦可由使用者顯式呼叫。
  涵蓋：iron law（先紅再綠）、最小通過實作、watch fail、refactor 階段。
  下游：execute-plan 內每 task step 都進此 cycle。
---

# tdd-cycle

**先寫測試、看它失敗、再寫最小實作讓它通過。**

> **Iron law**：沒看過測試失敗、就不知道測試在測對的東西。

## 使用契約（強制）

**載入後立即動作**：

進 RED → GREEN → REFACTOR 三階段。**每階段都有 verify**，不可跳。

```
   RED            GREEN           REFACTOR
寫失敗測試  →  跑、確認失敗  →  寫最小實作  →  跑、確認通過  →  清理  →  跑、保持綠  →  下個
```

## §什麼時候用

| 情境 | 用不用 |
|---|---|
| 新功能 / 新 module / 新 endpoint / 行為改動 | 永遠用 |
| bug fix | 永遠用；fix 前先寫重現 bug 的測試 |
| refactor | 永遠用；refactor 前測試先到位、refactor 中保持綠 |
| 一次性 throwaway prototype（探索 / spike）、自動產生的 code、純設定 / config 檔 | 例外，須 user 明確說 OK |

「這次 trivial 跳一下」= rationalize。**Iron law 沒例外**。

## §The Iron Law

```
production code 之前必先有失敗的 test
```

**先寫 code 後想補 test？刪 code、重來。**

不留 code 當「reference」、不「改寫」 reference 變測試、不偷瞄。**刪就是刪**。從 test 重 implement。

## §RED — 寫失敗測試

寫**一個最小**測試展示「應該怎樣」。

✅ 好：
```typescript
test('連續失敗 3 次後重試成功', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```
名字清楚、測真實行為、一次一件事。

**要求**：一個行為、名字清楚、真實 code（mock 只在不得已用）。

## §Verify RED — 跑、看它失敗

**強制、不可跳**。

```bash
npm test path/to/test.ts
# or
pytest tests/path/test_file.py::test_name -v
```

確認：**失敗（不是 error）**、失敗訊息 = 預期、失敗原因 = **feature 還沒實作**（不是 typo / import 錯）。

**測試立刻過？** 你在測既有行為。改測試。
**測試報 error？** 修 error、重跑、直到「失敗」（不是 error）。

## §GREEN — 最小實作讓測試過

寫**剛好夠通過測試的 code**。不過度設計。

✅ 好：
```typescript
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}
```
剛好夠。多塞 maxRetries / backoff / onRetry 這類還沒人要的 options = YAGNI 違反。

**禁**：加 feature / 改別處 code / 「順便 improve」。

## §Verify GREEN — 跑、看它過

**強制**。

```bash
npm test path/to/test.ts
```

確認：此測試**過**、其他既有測試**仍過**、output 乾淨（無 warning / error）。

**此測試 fail？** 修 code、不修測試（除非測試錯）。
**其他測試 fail？** 立刻修。

## §REFACTOR — 清理

**只在綠後做**：去重、改命名、抽 helper。**保持綠**、不加新行為，refactor 後再跑一次測試確認綠。

然後進下個 task / 下個 step / 下個 feature 的 RED。完成 1 個 task = 完成 N 個 (RED → GREEN → REFACTOR) cycle。

## §verify checklist（commit 前）

- [ ] 每個新 function / method 都有測，且每個測試看過它失敗
- [ ] 失敗原因是「feature 沒實作」（不是 typo）
- [ ] 寫最小 code 讓測試過；全部測試過；output 乾淨（無 error / warning）
- [ ] 測試用真 code（mock 不得已才用）；邊界 + error case 有測

**check 不齊** = 你跳 TDD = 重來。

## §卡住怎麼辦

- 不知怎麼測 → 先寫「希望」的 API 與 assertion；還是不知 → 問 user
- 測太複雜 / 必須 mock 一切 / 測 setup 巨大 → 設計太複雜；簡化 interface、用 DI、抽 helper

## §跟 debug 銜接

bug 出現 → 寫重現它的失敗測試 → 跟 TDD 流程走 → 測證明 fix + 防回歸。**永不無測 fix bug**。

## §Red Flags — 看到就停下、重來

- 先寫 code 再補測試（含「留 reference」「改寫既有 code」「已花 X 小時、刪掉浪費」）→ 補的測試立刻過、證明不了什麼；沉沒成本，留不能信的 code 才是技術債
- 「太簡單不用測」「就這次跳一下」「這次不一樣，因為...」「TDD 死板、我務實」→ 簡單 code 也會壞、測寫 30 秒；沒有 user 明確允許的例外
- 看到綠就不 refactor → 去重 / 命名 / 抽 helper 只能在綠後做，不代表可以不做
- 沒跑紅也算紅（「手動測過了」「解釋不了測試為何失敗」）→ 手動 = 沒記錄、不可重跑；沒看過失敗 = 不知道它在測什麼
- 一次寫很多測試 → 一個 RED 一個行為；名字含「and」= 拆
- mock 一切 → 測 mock 不測 code；難測 = 設計爛，聽測試的話用 DI

**全都意味**：刪 code、TDD 重來。

```
production code → 必有先失敗的 test
否則 → 不是 TDD
```
