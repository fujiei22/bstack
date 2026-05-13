---
name: incident-investigate
description: |
  System incident 根因調查（繁中）。觸發：incident / production 壞 /
  服務異常 / 不易重現 / intermittent / flaky / 跨系統 bug / log 散落 /
  oncall / 多人受影響 / outage。
  涵蓋：Observe → Hypothesize → Test → Conclude 四階段。Test 階段在
  ≥3 假設時**平行** spawn hypothesis-tester agents（Variant C fan-out）；
  ≤2 假設退主 context 順序驗。產 incident report（postmortem 半成品）。
  常配對：debug-systematic（T2+ Bug track 用）。
---

# incident-investigate

不易重現 / 多系統互動 / 跨層的 bug。**並列假設、不過早收斂、獨立驗證**。

四階段 Observe → Hypothesize → Test → Conclude。階段間 `AskUserQuestion` 確認進度。**Test 階段在 ≥3 假設時平行 spawn agent**，避免主 context 對假設間判斷的交叉污染。

## 使用契約（強制）

**載入後立即動作**：

1. 建 incident 工作目錄 `docs/incidents/<id>/`（`<id>` = `<YYYY-MM-DD>-<short-slug>`、user 確認或自取）
2. 進 Step 1 Observe
3. 階段間用 `AskUserQuestion` gate

---

## §Step 1: Observe — 蒐 fact、落地

只蒐 fact、不解釋、不假設。

**蒐什麼**：

| 來源 | 看什麼 |
|---|---|
| log（app / web server / DB / proxy）| timestamp、error message、stack trace |
| metric / dashboard | latency / error rate / CPU / memory 突變點 |
| user report | 症狀、影響、首見時間 |
| change log | 最近 deploy / config change / dependency update |
| infra event | 雲端 provider 公告、network event |

**鐵律**：
- 寫時間線（timeline）— 時序很重要
- 列已蒐 fact + 已蒐**不到**的 fact（後者重要）

**結尾必落** `docs/incidents/<id>/observe.md`（**facts artifact**）：

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

**為何要落檔**：Step 3 平行 fan-out 時、每個 hypothesis-tester subagent 拿不到主對話歷史、必須讀此檔取共同事實。**facts 物化是 Variant C 的前置條件**。

階段尾：

`AskUserQuestion`：
```
問：Observe 完成。Fact 落 docs/incidents/<id>/observe.md（見上）。
options:
  1. 進 Hypothesize（推薦）
  2. 補蒐其他 fact（指明哪些）
  3. 已知 root cause、直接跳 Conclude
```

---

## §Step 2: Hypothesize — 並列提多個

**至少 3 個假設**（若湊不到、3 個以下也可、但走 Step 3 順序模式）。不挑、不過早收斂。

**落** `docs/incidents/<id>/hypotheses.md`：

```markdown
# Hypotheses — <id>

| ID | 假設 | 預期 if true | 預期 if false |
|---|---|---|---|
| H1 | redis pool 不夠（64 > 50）、高峰時 starvation | 升 pool 到 200 → error rate 立刻降 | 升 pool 不影響 error rate |
| H2 | redis-based session cache code 有 connection leak（commit abc123）| 找到 release 漏的 path | 全 path acquire/release 對齊 |
| H3 | 同時 deploy 的 network policy 改動造成 redis intermittent timeout | infra commit 顯示 policy 改、且時間吻合 | infra 無相關改動或時間不吻合 |
| H4 | 上游 LB 連 retry 過快、放大原本可吃下的 timeout | LB config 顯示 retry interval 過短 | LB config 正常 |
```

**鐵律**：不要寫「最可能 / 我覺得」— 全當未驗證對待。

階段尾：

`AskUserQuestion`：
```
問：Hypothesize 完成。並列 N 個假設（見 hypotheses.md）。
options:
  1. 進 Test、逐一驗（推薦）
  2. 補假設（user 提想到的）
  3. 砍假設（明顯不可能）
```

---

## §Step 3: Test — fan-out 或順序

依**假設數**決定模式：

### 模式 P（≥3 假設）：平行 fan-out（Variant C）

**同一 message 內**呼叫 N 次 `Agent` tool、`subagent_type: hypothesis-tester`、每 agent 一條 H。

每 agent 的 prompt 模板：

```
你要驗證下列 hypothesis（你只看到這一條、不知道別的）：

**Hypothesis**: <H_N 文字>

**Expected if true**: <see hypotheses.md>
**Expected if false**: <see hypotheses.md>

**共同 facts artifact**: docs/incidents/<id>/observe.md（先 Read 它）

**Repo**: <repo path>
**相關 commits（可選）**: <如有>

依 agent system prompt 跑驗證、回嚴格 output 格式（Verdict / Confidence / Evidence / Caveats / Unexpected findings）。
```

**收齊 N 個結果**後，每個落到 `docs/incidents/<id>/H<N>.md`（agent 的原始 output）。

### 模式 S（≤2 假設）：主 context 順序驗

平行 spawn 有固定 overhead、≤2 假設不划算。退原本主 context 順序驗：

對每假設：
- 跑驗證實驗
- 寫 verdict（沿用 agent 的 output 格式）
- 落 `docs/incidents/<id>/H<N>.md`

**為何不全用 P**：主 context 在驗 2 個假設時不易交叉污染、且省 agent 冷啟動 + facts 重讀的成本。

階段尾：

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

---

## §Step 4: Conclude — 整合 + 寫 report

整合 N 個 verdict、找 **root cause**（可能多重）：

1. **比對 supported 假設**：是不是同一 root cause 的不同面向？
2. **檢視 inconclusive**：是 observe fact 不全、還是方法限制？需要補嗎？
3. **掃 Unexpected findings**：把 N 個 agent 的攤開、看有沒有跨假設指向同一可疑點。**真 root cause 經常不在最初的 N 個假設裡** — 從這裡冒出來
4. **多層 cause**：immediate / underlying / contributing 三層分

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

---

## §結束後處置

incident report 寫完 → 走兩條路：

- **Bug track**：把 root cause 帶回 debug-systematic Step 4（寫 fix + 測試）
- **Action item**：long-term fix 進 `TaskCreate`、後續 sprint 處理

**禁**：incident 解了就忘 — action item 沒落實 = 下次再發生。

---

## §產出檔結構（summary）

```
docs/incidents/<id>/
├── observe.md         # Step 1 facts artifact（也是 fan-out 的共同基礎）
├── hypotheses.md      # Step 2 假設清單
├── H1.md ... HN.md    # Step 3 每假設驗證結果（agent / 主 context 產）
└── report.md          # Step 4 最終 incident report（postmortem 半成品）
```

---

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

**下一 phase**：→ 回 `debug-systematic` Step 4 / 5 寫 fix + test

---

## §結尾 Trace 標籤

```
[Trace] Phase=incident-investigate | Tier=<T2+> | Track=Bug | Skill=incident-investigate
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「我直覺是 X 直接 test」 | 並列假設、不過早收斂 |
| 「H1 像、不必 test H2-H4」 | 多 cause 是常態；全 test |
| 「3 假設就走順序、agent 不必要」 | 平行紅利 + 客觀性紅利在 ≥3 時都成立、預設走 P |
| 「沒時間寫 report」 | 沒 report = 下次再發生 |
| 「observe.md 不必落、AI 記得」 | 必落；fan-out agent 拿不到主 context、必須讀檔 |
| 「Unexpected findings 沒人看」 | 真 root cause 常在這、Conclude 必掃 |
| 「報 user 時間線太繁」 | 時間線是調查核心、別 skip |
| 「action item 之後處」 | 標 owner + due date、不模糊 |
