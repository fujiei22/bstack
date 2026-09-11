---
name: incident-investigate
description: |
  System incident 根因調查（繁中）：Observe → Hypothesize → Test（≥3 假設平行 spawn hypothesis-tester）→ Conclude。
  載入：Bug track Phase 3'，T2+ 與 debug-systematic 配對。
---

# incident-investigate

不易重現 / 多系統互動 / 跨層的 bug：**並列假設、不過早收斂、獨立驗證**。四階段 Observe → Hypothesize → Test → Conclude，階段間 `AskUserQuestion` gate；**Test 在 ≥3 假設時平行 spawn agent**，避免主 context 交叉污染。

## 使用契約（強制）

1. 建 incident 工作目錄 `docs/incidents/<id>/`（`<id>` = `<YYYY-MM-DD>-<short-slug>`、user 確認或自取）
2. 進 Step 1 Observe
3. 階段間用 `AskUserQuestion` gate；headless 時 → `incident-investigate/gate`：進下一階段 A 類、Conclude 的處置 B 類（`headless-mode`），hypothesis prompt 另含其 §子 agent 約束

## §Step 1: Observe — 蒐 fact、落地

只蒐 fact、不解釋。**鐵律**：寫時間線；列已蒐與蒐**不到**的 fact（後者重要）。

| 來源 | 看什麼 |
|---|---|
| log（app / web server / DB / proxy）| timestamp、error message、stack trace |
| metric / dashboard | latency / error rate / CPU / memory 突變點 |
| user report | 症狀、影響、首見時間 |
| change log | 最近 deploy / config change / dependency update |
| infra event | 雲端 provider 公告、network event |

**結尾必落** `docs/incidents/<id>/observe.md`（**facts artifact**）——fan-out 的 hypothesis-tester 只能讀此檔取共同事實：

```markdown
# Observe — <id>

## 時間線（UTC）
- <T0>：deploy v2.3.1
- <T0+15m>：error rate 從 0.1% 跳 8%
- <T0+25m>：3 user 回報「checkout button 沒反應」
- <T0+45m>：oncall 收到 alert

## Fact
- log 顯示 ConnectionTimeoutError 從 redis pool
- new deploy v2.3.1 加了 redis-based session cache（commit abc123）
- redis pool max 50；本服務 8 個 pod、各 8 個 worker = 64 concurrency

## 缺的 fact
- redis side 的 connection metric（沒採 telemetry）
- 0.1% baseline error 是否原本就是 redis 問題

## 資料來源
- log: <path / Grafana link / kibana query>
- metric: <dashboard link>
- change log: <PR / commit>
```

`AskUserQuestion`：
```
問：Observe 完成。Fact 落 docs/incidents/<id>/observe.md（見上）。
options:
  1. 進 Hypothesize（推薦）
  2. 補蒐其他 fact（指明哪些）
  3. 已知 root cause、直接跳 Conclude
```

## §Step 2: Hypothesize — 並列提多個

**至少 3 個假設**（湊不到就走 Step 3 順序模式）；不挑、不寫「最可能 / 我覺得」，全當未驗證。**落** `docs/incidents/<id>/hypotheses.md`：

```markdown
# Hypotheses — <id>

| ID | 假設 | 預期 if true | 預期 if false |
|---|---|---|---|
| H1 | redis pool 不夠（64 > 50）、高峰時 starvation | 升 pool 到 200 → error rate 立刻降 | 升 pool 不影響 error rate |
| H2 | redis-based session cache code 有 connection leak（commit abc123）| 找到 release 漏的 path | 全 path acquire/release 對齊 |
| H3 | 同時 deploy 的 network policy 改動造成 redis intermittent timeout | infra commit 顯示 policy 改、且時間吻合 | infra 無相關改動或時間不吻合 |
| H4 | 上游 LB 連 retry 過快、放大原本可吃下的 timeout | LB config 顯示 retry interval 過短 | LB config 正常 |
```

`AskUserQuestion`：
```
問：Hypothesize 完成。並列 N 個假設（見 hypotheses.md）。
options:
  1. 進 Test、逐一驗（推薦）
  2. 補假設（user 提想到的）
  3. 砍假設（明顯不可能）
```

## §Step 3: Test — fan-out 或順序

### 模式 P（≥3 假設）：平行 fan-out（Variant C）

**同一 message 內**呼叫 N 次 `Agent` tool、`subagent_type: hypothesis-tester`、每 agent 一條 H，prompt 模板：

```
你要驗證下列 hypothesis（你只看到這一條、不知道別的）：

**Hypothesis**: <H_N 文字>

**Expected if true**: <see hypotheses.md>
**Expected if false**: <see hypotheses.md>

**共同 facts artifact**: docs/incidents/<id>/observe.md（先 Read 它）

**Repo**: <repo path>

你不是 headless 主流程：禁 gh issue comment / git push / 寫 snapshot / 印 [bstack headless] 行；要問 user 的問題回報給派工你的 agent，由它決定。
**相關 commits（可選）**: <如有>

依 agent system prompt 跑驗證、回嚴格 output 格式（Verdict / Confidence / Evidence / Caveats / Unexpected findings）。
```

**收齊 N 個結果**後各落 `docs/incidents/<id>/H<N>.md`。

### 模式 S（≤2 假設）：主 context 順序驗

平行 spawn 有固定 overhead（冷啟動 + facts 重讀）、≤2 假設不划算，主 context 也不易交叉污染。每假設：跑驗證、寫 verdict（沿用 agent output 格式）、落 `docs/incidents/<id>/H<N>.md`。

`AskUserQuestion`：
```
問：Test 完成。<M>/<N> 假設 supported / refuted / inconclusive（見 H1.md ... HN.md）。

關鍵 unexpected findings 摘要：
  - <agent 1 出的怪事>
  - <agent 2 出的怪事>
  ...

options:
  1. 進 Conclude、寫 incident report（推薦）
  2. 還缺 fact、補 Test（指明哪 H）
  3. 列新 hypothesis（從 unexpected findings 衍生）→ 退 Step 2
```

## §Step 4: Conclude — 整合 + 寫 report

整合 N 個 verdict、找 **root cause**（可能多重）：

1. **比對 supported 假設**：是否同一 root cause 的不同面向
2. **檢視 inconclusive**：fact 不全還是方法限制？要補嗎
3. **掃 Unexpected findings**：跨假設是否指向同一可疑點——**真 root cause 經常不在最初的 N 個假設裡**
4. **多層 cause**：immediate / underlying / contributing

**落** `docs/incidents/<id>/report.md`：

```markdown
# Incident <id> — <short title>

## Severity

<P0 / P1 / P2 / P3>

## Impact

- <受影響 user / 服務 / 時長 / financial / reputation>

## Timeline（UTC）

（從 observe.md 抓 + Test / Conclude 期間補的）
- <T0>：...
- <T0+15m>：...

## Root cause

<具體技術原因。可多層：immediate / underlying / contributing>

> 假設驗證結果摘要（連結到 H1.md ... HN.md）
> - H1: supported (high) — 主因之一
> - H2: refuted (high)
> - H3: inconclusive (low) — observe 缺 telemetry
> - H4: supported (medium) — 放大因子
> - 額外發現：<從 unexpected findings 衍生的因子>

## Fix

- **short-term**：<已 apply 的 mitigation>
- **long-term**：<下次怎麼避>

## Detection

- 怎麼發現的？user / monitoring / oncall？
- 從首見到偵測時長？

## Resolution

- 怎麼解？
- 從偵測到解時長？

## What went well
- <列點>

## What went wrong
- <列點>

## Action items

- [ ] <具體 task、有 owner、有 due date>
- ...
```

## §結束後處置

- **Bug track**：root cause 帶回 debug-systematic Step 4
- **Action item**：long-term fix 進 `TaskCreate`；**禁**解了就忘，沒落實 = 下次再發生

## §hand-off state

```yaml
state:
  incident_id: <YYYY-MM-DD-short>
  incident_dir: docs/incidents/<id>/
  incident_report_path: docs/incidents/<id>/report.md
  root_cause: <簡述>
  action_items: [<task list>]
  test_mode: <P|S>            # P=parallel fan-out, S=sequential
  current_phase: incident-investigate-done
```

**下一 phase**：→ 回 `debug-systematic` Step 4 / 5 寫 fix + test。結尾貼 rules.md §Trace 標籤（Phase=incident-investigate）。

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「直覺是 X 直接 test」「H1 像、不必 test 其他」 | 並列假設；多 cause 是常態、全 test |
| 「3 假設就走順序」 | 平行 + 客觀性紅利在 ≥3 時都成立、預設走 P |
| 「observe.md 不必落」 | fan-out agent 拿不到主 context、必須讀檔 |
| 「Unexpected findings 沒人看」 | 真 root cause 常在這、Conclude 必掃 |
| 「沒時間寫 report / 時間線」「action item 之後處」 | 沒 report = 下次再發生；時間線是調查核心；action item 標 owner + due date |
