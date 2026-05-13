---
name: tdd-cycle
description: |
  Test-driven 紅綠循環（繁中）。觸發：TDD / 寫測試 / 紅綠 / red-green / test-first /
  新功能 / 修 bug（含寫回歸測試）/ refactor / 寫測試先 / write test first。
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

---

## §什麼時候用

**永遠用**：
- 新功能 / 新 module / 新 endpoint
- bug fix（fix 前先寫重現 bug 的測試）
- refactor（refactor 前測試先到位、refactor 中保持綠）
- 行為改動

**例外**（須 user 明確說 OK）：
- 一次性 throwaway prototype（探索 / spike）
- 自動產生的 code
- 純設定 / config 檔

「這次 trivial 跳一下」= rationalize。**Iron law 沒例外**。

---

## §The Iron Law

```
production code 之前必先有失敗的 test
```

**先寫 code 後想補 test？刪 code、重來。**

不留 code 當「reference」、不「改寫」 reference 變測試、不偷瞄。**刪就是刪**。

從 test 重 implement。

---

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

❌ 壞：
```typescript
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
```
名字模糊、測 mock 不測 code。

**要求**：
- 一個行為
- 名字清楚
- 真實 code（mock 只在不得已用）

---

## §Verify RED — 跑、看它失敗

**強制、不可跳**。

```bash
npm test path/to/test.ts
# or
pytest tests/path/test_file.py::test_name -v
```

確認：
- **失敗（不是 error）**
- 失敗訊息 = 預期
- 失敗原因 = **feature 還沒實作**（不是 typo / import 錯）

**測試立刻過？** 你在測既有行為。改測試。

**測試報 error？** 修 error、重跑、直到「失敗」（不是 error）。

---

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
剛好夠。

❌ 壞：
```typescript
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number) => void;
  }
): Promise<T> { /* ... */ }
```
YAGNI 違反。

**禁**：加 feature / 改別處 code / 「順便 improve」。

---

## §Verify GREEN — 跑、看它過

**強制**。

```bash
npm test path/to/test.ts
```

確認：
- 此測試**過**
- 其他既有測試**仍過**
- output 乾淨（無 warning / error）

**此測試 fail？** 修 code、不修測試（除非測試錯）。

**其他測試 fail？** 立刻修。

---

## §REFACTOR — 清理

**只在綠後做**。

- 去重
- 改命名
- 抽 helper

**保持綠**。不加新行為。

refactor 後再跑一次測試確認綠。

---

## §下一個

進下個 task / 下個 step / 下個 feature 的 RED。

```
完成 1 個 task = 完成 N 個 (RED → GREEN → REFACTOR) cycle
```

---

## §好測試的要素

| 維度 | 好 | 壞 |
|---|---|---|
| 最小 | 一件事；名字含「and」 = 拆 | `test('validates email and domain and whitespace')` |
| 清楚 | 名字描述行為 | `test('test1')` |
| 顯意 | 展示期望 API | 隱藏 code 該怎麼用 |

---

## §順序的價值

**「我先寫 code、之後補測試」** — 不行。

- 補的測試立刻通過 — 證明不了什麼
- 可能測錯
- 可能測實作不測行為
- 邊界 case 漏想
- 沒看過它抓 bug

Test-first 強迫看到測試失敗，**證明測試真的在測東西**。

---

## §常見 rationalization

| 藉口 | 真相 |
|---|---|
| 太簡單不用測 | 簡單 code 也會壞；測寫 30 秒 |
| 我之後補測 | 立刻過的測證明不了 |
| 我手動測過了 | 手動 = 沒記錄、不可重跑 |
| 刪掉 X 小時白費 | 沉沒成本；留不能信的 code 才是技術債 |
| 留 code 當 reference | 你會 adapt 它 = 在 test after。**刪就是刪** |
| 需要先 explore | OK，但探完丟掉、TDD 重來 |
| 難測 = 設計爛 | 聽測試的話：難測 = 難用 |
| TDD 拖慢 | TDD 比 debug 快、是 pragmatic |
| 手動測快 | 邊界 case 證明不了 |
| 既有 code 沒測 | 你在改、加測 |

---

## §Red Flags — 看到就停下、重來

- code 在 test 之前
- 寫完 code 才補 test
- 測試一寫立刻過
- 解釋不了測試為何失敗
- 「之後補測」
- 「就這次跳一下」
- 「手動測過了」
- 「test after 達同樣目的」
- 「是精神不是儀式」
- 「留 reference」、「改寫既有 code」
- 「已花 X 小時、刪掉浪費」
- 「TDD 死板、我務實」
- 「這次不一樣，因為...」

**全都意味**：刪 code、TDD 重來。

---

## §Bug fix 範例

**Bug**：空 email 被接受

**RED**：
```typescript
test('拒絕空 email', async () => {
  const result = await submitForm({ email: '' });
  expect(result.error).toBe('Email required');
});
```

**Verify RED**：
```
$ npm test
FAIL: expected 'Email required', got undefined
```

**GREEN**：
```typescript
function submitForm(data: FormData) {
  if (!data.email?.trim()) {
    return { error: 'Email required' };
  }
  // ...
}
```

**Verify GREEN**：
```
$ npm test
PASS
```

**REFACTOR**：若需多欄位驗證 → 抽 helper。

---

## §verify checklist（commit 前）

- [ ] 每個新 function / method 都有測
- [ ] 每個測試看過它失敗
- [ ] 失敗原因是「feature 沒實作」（不是 typo）
- [ ] 寫最小 code 讓測試過
- [ ] 全部測試過
- [ ] output 乾淨（無 error / warning）
- [ ] 測試用真 code（mock 不得已才用）
- [ ] 邊界 + error case 有測

**check 不齊** = 你跳 TDD = 重來。

---

## §卡住怎麼辦

| 問題 | 方案 |
|---|---|
| 不知怎麼測 | 寫「希望」的 API、寫 assertion 先；問 user |
| 測太複雜 | 設計太複雜；簡化 interface |
| 必須 mock 一切 | code 太緊耦合；用 DI |
| 測 setup 巨大 | 抽 helper；仍巨 = 簡化設計 |

---

## §跟 debug 銜接

bug 出現 → 寫重現它的失敗測試 → 跟 TDD 流程走 → 測證明 fix + 防回歸。

**永不無測 fix bug**。

---

## §最終規則

```
production code → 必有先失敗的 test
否則 → 不是 TDD
```

沒有 user 明確允許的例外。
