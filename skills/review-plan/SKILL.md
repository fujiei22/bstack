---
name: review-plan
description: |
  Implementation plan 多視角 review（繁中）。載入：dev-workflow Phase 2（**T3** write-plan 產出 plan 後）；亦可由使用者顯式呼叫。
  涵蓋：視角依改動面向 1-3（Eng 下限 / DX / Design）；每視角 spawn
  subagent 做 review、主 agent 整合 → 提 user gate。
  上游：write-plan。下游：execute-plan（user 確認後）。
---

# review-plan

把 plan 拿到不同視角檢視，逼出單一視角看不到的問題。**不是給 plan 蓋章** — 是讓 plan 更穩。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state**：取 `plan_path`、`tier`、`spec_path`。
2. **讀 `state.review_perspectives`**（brainstorm 0b 依改動面向判：機械可驗 → Eng；有人要讀 → DX；跨模組契約 / 對外介面 → Design）。命中幾個派幾個，Eng 是下限；state 沒這欄 → 依 rules.md §Tier 機制自判並回寫。「該不該做」不在這裡問，那是 brainstorm 的事。
3. **每視角 spawn 一個 subagent**（用 Agent tool、`subagent_type` = `general-purpose` 或對應 reviewer agent），帶 plan + spec + 視角 prompt 進去。
4. **subagent 回傳 review 結論**（結構化 finding 清單）。
5. **主 agent 整合所有視角**：去重、分類嚴重度（critical / major / minor / nit）。
6. `AskUserQuestion` 提 user gate：accept plan / 改某項 / 退回 write-plan / 退回 brainstorm。

**禁止跳階**：state 標了的視角不能少；T2 進了本 skill 就是路徑錯，回報並交棒 execute-plan（user 顯式呼叫例外：照 user 指定的視角跑）。

---

## §視角 prompt 模板

每個視角 subagent 的 prompt 都含四段：

1. **角色設定**（你是誰、看什麼）
2. **標的性質**（下面這一段，**必寫**）
3. **檢視重點**（具體問哪些問題）
4. **回報格式**（要結構化清單）＋ **怎麼把結論送回來**

### 第 2 段：標的性質（必寫）

**下面三個視角的提問是照「標的是 code」寫的。** 標的不是 code 時**必須逐條改寫**，
照搬只會產生噪音——實測：對一份 markdown skill 跑原版模板，
「API endpoint / response shape」「O(N²) 或全表掃」「dependency 版本鎖 / supply-chain」
「stack trace ＋ context」「CLI / config 預設值」全部不適用，一條都用不上。

派工 prompt 要明寫標的是什麼、以及**哪些問題不要問**：

```
要 review 的不是程式，是 <標的性質>。所以 <列出不適用的問題類別> 全部不適用，不要問。
```

改寫時的對應關係（不是逐字換詞，是換問題）：

| 原本問（code） | markdown / prompt 類標的改問 |
|---|---|
| API 介面、response shape | skill 對使用者與對呼叫端的**兩個介面**：何時觸發、問什麼、回傳什麼、跟哪些 skill 邊界重疊 |
| failure mode、回退路徑 | **規則互相矛盾**——兩條規則打架時 AI 會挑一條照做，**而且不報錯** |
| test coverage | **斷言有沒有效**：pattern 在原文存不存在、guard 會不會恆綠／恆真 |
| 效能、scalability | **執行時到底載了什麼**：references 會不會根本沒被讀 |
| stack trace、log 點 | **出錯時怎麼定位**：輸出說不說得出自己命中哪一條規則 |

**這張表列的是兩種常見標的，不是清單。** 遇到兩欄都不屬於的——產出器、測試用例、schema、設定檔——**不要硬套最接近的那欄**，在「標的性質」段自己寫明兩件事：**這個標的壞掉會長什麼樣**，以及**哪些問題在它身上不適用**。

窮舉標的類型永遠追不上新標的；逼派工者答一次「這東西壞掉會怎樣」才追得上。實例：2026-09-03 那批的標的是一支**產出器**（是 code，但產物是資料）與一組**評測用例**（既非 code 也非 prompt），兩欄都不屬於。reviewer 是自己推出「輸入定義域 / 保真 / 冪等 / 下游 parser 合法性 / guard 恆綠」五組問題才問對的——**那五組沒有寫在任何表上，也不該寫**，因為下一個標的又會是別的。

### 第 4 段：怎麼把結論送回來（必寫）

```
分析完成後，**用 SendMessage 把完整結論送回派工你的 agent**（主 session 通常是 `main`，
但你若是被另一個 subagent 派的，收件人就是它——**照派工訊息的來源填，不要寫死**）。
你寫在回覆裡的東西不會自動傳給派工者——不送就等於沒交。
```

**這一句不寫，就會發生**：實測一輪四視角 review，**四個 reviewer 全部在分析完成後
只送 idle 訊號**，主 session 逐一去要才拿到。它們沒做錯——「工作做完了」跟
「結論送到了」在 subagent 眼裡是同一件事。

---

### 視角 Design（介面 / 契約） — 跨模組契約 / 對外介面時

```
你是 Design / UX / API 介面視角的 reviewer。

讀以下 spec 與 plan：
...

回答這些問題：

1. user-facing 行為描述清楚嗎？user 怎麼觸發、看到、感受？
2. 若 plan 涉 API：endpoint / 參數 / response shape 是否符合既有風格？
3. error message / 邊界情境（空 / 大 / 非預期輸入）有顯式處理嗎？
4. 跟既有 UX / API 風格是否一致？
5. 設計上有沒有「以後會痛」的 lock-in（如硬編 magic string）？

**回報格式**：同 Eng 視角。
```

---

### 視角 Eng（架構 / 技術風險） — 必派（下限）

```
你是工程架構 / 技術風險視角的 reviewer。

讀以下 spec 與 plan：
...

回答這些問題：

1. 架構決策合理？是否有更穩 / 更主流的做法（Layer 1 tried-and-true）？
2. **failure mode**：plan 中各 task 失敗會怎樣？回退路徑？data 一致性？
3. 並行性（parallel-group）標得對嗎？同 group 真的無依賴？
4. test coverage 足夠？有沒有關鍵 path 沒測？
5. 引入新 dependency 嗎？版本鎖？supply-chain 風險？
6. 對既有 codebase 的相容性 / migration / 廢棄路徑？
7. performance / scalability：plan 中是否含已知 O(N²) 或全表掃？

**回報格式**（純 markdown，無 preamble）：
## <視角名> 視角 review

### Critical（必須處理）
- ...

### Major（強烈建議）
- ...

### Minor（可選）
- ...

### Nit（風格）
- ...
```

---

### 視角 DX（開發者體驗） — 有人要讀的東西時

```
你是 Developer Experience 視角的 reviewer。

讀以下 spec 與 plan：
...

回答這些問題：

1. error 訊息對開發者夠用嗎？stack trace + context？
2. debug 起來容不容易？log 點足夠？
3. 文件：plan 完成後，下個 dev 接手要怎麼上手？
4. CLI / config 使用門檻？預設值合理？
5. 跑測試 / 開發循環是否流暢？

**回報格式**：同 Eng 視角。
```

---

## §結果整合

各視角 subagent 回傳後，主 agent 做整合：

```markdown
# Plan review 總結

> Plan: docs/work/<branch-name>/plan.md
> Tier: T3
> 視角: <依 state.review_perspectives，例 Eng + DX>

## Critical 共識（多視角同時提）
- ...

## Critical 各視角獨見
**Design**：
- ...

**Eng**：
- ...

**DX**：
- ...

## Major / Minor / Nit
（去重後合併）

## 主 agent 建議
- 必處理：<列 critical>
- 建議處理：<列 major 中認同的>
- 略過：<列 minor / nit 中判定不影響的、附理由>
```

---

## §User gate

整合完畢，`AskUserQuestion`：

```
問：Plan review 完成。下一步？
選項：
  1. 修 plan 後進 execute-plan（推薦）
     — 套用「必處理」+「建議處理」的修改
  2. 直接進 execute-plan，忽略 review 意見
     — 你看過 review、知道風險、選擇接受
  3. 退回 write-plan 重寫
     — review 揭示 plan 結構性問題
  4. 退回 brainstorm 重釐清需求
     — review 揭示需求理解就錯
```

選 1 → 主 agent 改 plan、commit、`AskUserQuestion` 再確認改完的版本 OK → 進 execute-plan
選 2 → 直接進 execute-plan，state 記錄 user override
選 3 → 退 write-plan、state 加 `review_findings`
選 4 → 退 brainstorm、state reset 部份欄位

---

## §hand-off state

```yaml
state:
  review_summary_path: docs/work/<branch-name>/review.md  # 整合結果寫一份保存
  review_perspectives: [...]  # 來自 brainstorm 0b，本 skill 只讀
  review_critical_count: <N>
  review_user_action: <accept|adjust|reject_to_writeplan|reject_to_brainstorm>
  current_phase: review-plan-done
```

---

## §結尾 Trace 標籤

```
[Trace] Phase=review-plan | Tier=T3 | Track=Dev | Skill=review-plan
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「主 agent 自己 review 不要 subagent」 | subagent 才有獨立視角；主 agent self-review 偏向自我合理化 |
| 「T2 進來了就順便審」 | T2 不進本 skill；回報並交棒 execute-plan |
| 「視角少一個沒差」 | state 標的視角是 0b 依改動面向判的；少一個就是那個面向沒人看 |
| 「review 沒 critical 就直接過」 | 仍要走 user gate（accept / adjust / reject）|
| 「review 出問題就退到底重來」 | 多數時候改 plan 即可、不要 over-react |
