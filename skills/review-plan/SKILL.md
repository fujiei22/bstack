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

每個視角 subagent 的 prompt 都含三段：

1. **角色設定**（你是誰、看什麼）
2. **檢視重點**（具體問哪些問題）
3. **回報格式**（要結構化清單）

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

> Plan: docs/plans/<topic>/plan.md
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
  review_summary_path: docs/plans/<topic>/review.md  # 整合結果寫一份保存
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
