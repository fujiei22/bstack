---
name: review-plan
description: |
  Implementation plan 多視角 review（繁中）。觸發：plan review / 評 plan /
  review implementation plan / plan 看一下 / 看看 plan / 評估 plan / 審查 plan /
  cross-perspective review。
  涵蓋：T2 Eng-only / T3 CEO + Design + Eng + DX 4 視角；每視角 spawn
  subagent 做 review、主 agent 整合 → 提 user gate。
  上游：write-plan。下游：execute-plan（user 確認後）。
---

# review-plan

把 plan 拿到不同視角檢視，逼出單一視角看不到的問題。**不是給 plan 蓋章** — 是讓 plan 更穩。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state**：取 `plan_path`、`tier`、`spec_path`。
2. **依 tier 決定視角數**：
   - T2 → Eng-only 1 視角
   - T3 → CEO + Design + Eng + DX 4 視角
3. **每視角 spawn 一個 subagent**（用 Agent tool、`subagent_type` = `general-purpose` 或對應 reviewer agent），帶 plan + spec + 視角 prompt 進去。
4. **subagent 回傳 review 結論**（結構化 finding 清單）。
5. **主 agent 整合所有視角**：去重、分類嚴重度（critical / major / minor / nit）。
6. `AskUserQuestion` 提 user gate：accept plan / 改某項 / 退回 write-plan / 退回 brainstorm。

**禁止跳階**：T2 不能跳 Eng review；T3 不能少視角。

---

## §視角 prompt 模板

每個視角 subagent 的 prompt 都含四段：

1. **角色設定**（你是誰、看什麼）
2. **標的性質**（下面這一段，**必寫**）
3. **檢視重點**（具體問哪些問題）
4. **回報格式**（要結構化清單）＋ **怎麼把結論送回來**

### 第 2 段：標的性質（必寫）

**下面四個視角的提問是照「標的是 code」寫的。** 標的不是 code 時**必須逐條改寫**，
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

### 視角 1：CEO（策略） — T3 only

```
你是 CEO / 產品策略視角的 reviewer。

讀以下 spec 與 plan：
- spec: <spec 內容>
- plan: <plan 內容>

回答這些問題：

1. 這個 plan **應該現在做**嗎？對 user / 業務的 marginal value 是什麼？
2. 是否有「最低可行做法」(MVP) 比這 plan 更小？縮 scope 能否仍達 success criteria？
3. plan 中是否含「未來可能要」但「現在用不到」的東西？應該砍。
4. trade-off 是否被忽略？（時間 / 複雜度 / 維護成本）
5. 風險：如果這 plan 全部跑完還沒解決問題，最大原因是什麼？

**回報格式**（純 markdown，無 preamble）：
## CEO 視角 review

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

### 視角 2：Design（UX / API） — T3 only

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

**回報格式**：同 CEO 視角。
```

---

### 視角 3：Eng（架構 / 技術風險） — T2 + T3

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

**回報格式**：同 CEO 視角。
```

---

### 視角 4：DX（開發者體驗） — T3 only

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

**回報格式**：同 CEO 視角。
```

---

## §結果整合

各視角 subagent 回傳後，主 agent 做整合：

```markdown
# Plan review 總結

> Plan: docs/work/<branch-name>/plan.md
> Tier: <T2/T3>
> 視角: <Eng | CEO + Design + Eng + DX>

## Critical 共識（多視角同時提）
- ...

## Critical 各視角獨見
**CEO**：
- ...

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
  review_perspectives: [CEO, Design, Eng, DX]  # T3 / 或 [Eng] T2
  review_critical_count: <N>
  review_user_action: <accept|adjust|reject_to_writeplan|reject_to_brainstorm>
  current_phase: review-plan-done
```

---

## §結尾 Trace 標籤

```
[Trace] Phase=review-plan | Tier=<T2/T3> | Track=Dev | Skill=review-plan
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「主 agent 自己 review 不要 subagent」 | subagent 才有獨立視角；主 agent self-review 偏向自我合理化 |
| 「T2 不需要 review」 | T2 仍需 Eng-only review；別跳 |
| 「T3 4 視角只跑 2 個算了」 | 違反流程；4 視角的價值在多視角衝突浮現 |
| 「review 沒 critical 就直接過」 | 仍要走 user gate（accept / adjust / reject）|
| 「review 出問題就退到底重來」 | 多數時候改 plan 即可、不要 over-react |
