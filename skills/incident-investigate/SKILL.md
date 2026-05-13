---
name: incident-investigate
description: |
  System incident 根因調查（繁中）。觸發：incident / production 壞 /
  服務異常 / 不易重現 / intermittent / flaky / 跨系統 bug / log 散落 /
  oncall / 多人受影響 / outage。
  涵蓋：Observe → Hypothesize → Test → Conclude 四階段、並列假設、
  自動產 incident report（postmortem 半成品）。
  常配對：debug-systematic（T2+ Bug track 用）。
---

# incident-investigate

不易重現 / 多系統互動 / 跨層的 bug。**並列假設、不過早收斂**。

## 使用契約（強制）

**載入後立即動作**：

進四階段 Observe → Hypothesize → Test → Conclude。**並列 hypothesize 是關鍵** — 一次只挑一個假設會走死巷。

```
1. Observe    ：蒐 fact（log / 症狀 / metric）
2. Hypothesize：並列提多個假設（不過早挑）
3. Test       ：每個假設逐一驗證
4. Conclude   ：找 root cause + 產 incident report
```

---

## §Step 1: Observe

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
- 寫下時間線（timeline）— 時序很重要
- 列出已蒐 fact + 已蒐**不到**的 fact（後者重要）

```markdown
## Observe

### 時間線
- <T0>：deploy v2.3.1
- <T0+15m>：error rate 從 0.1% 跳 8%
- <T0+25m>：3 user 回報「checkout button 沒反應」
- <T0+45m>：oncall 收到 alert

### Fact
- log 顯示 ConnectionTimeoutError 從 redis pool
- new deploy v2.3.1 加了 redis-based session cache（commit abc123）
- redis pool max 50；本服務 8 個 pod、各 8 個 worker = 64 concurrency

### 缺的 fact
- redis side 的 connection metric（沒採 telemetry）
- 0.1% baseline error 是否原本就是 redis 問題
```

---

## §Step 2: Hypothesize — 並列提多個

**至少 3 個假設**，不挑、不過早收斂。

範例：
```markdown
## Hypothesis

H1: redis pool 不夠（64 > 50），高峰時 starvation
H2: redis-based session cache code 有 connection leak（commit abc123）
H3: 同時 deploy 的 network policy 改動造成 redis intermittent timeout
H4: 上游 LB 連 retry 過快、放大原本可吃下的 timeout
```

**不要** 寫「最可能 / 我覺得」— 全部當未驗證對待。

---

## §Step 3: Test — 每個假設逐一驗

對每個假設，定**驗證實驗** + **預期結果**。

```markdown
## Test

### H1: redis pool 不夠
- 實驗: 升 pool 到 200、觀察 error rate
- 預期 if true: error rate 立刻降
- 預期 if false: 不影響
- 結果: <實驗後 fill>
- 判定: <true / false>

### H2: connection leak
- 實驗: 看 abc123 commit、grep redisClient.acquire 是否所有 path 都 release
- 預期 if true: 找到 release 漏的 path
- 預期 if false: 全 path release 對齊
- 結果: ...
- 判定: ...

### H3: ...
### H4: ...
```

**重點**：每假設**獨立**驗。「H1 看起來不像、跳 H2」是錯（H1 可能是 H2 的 root cause 之一）。

---

## §Step 4: Conclude — root cause + report

驗完所有假設，整合 → 找 root cause（可能多重）。

寫 **incident report**（落 `docs/incidents/<YYYY-MM-DD>-<short>.md`）：

```markdown
# Incident <YYYY-MM-DD> — <short title>

## Severity

<P0 / P1 / P2 / P3>

## Impact

- <受影響 user / 服務 / 時長 / financial / reputation>

## Timeline（UTC）

- <T0>：...
- <T0+15m>：...

## Root cause

<具體技術原因。可多層：immediate / underlying / contributing>

## Fix

- short-term：<已 apply 的 mitigation>
- long-term：<下次怎麼避>

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
- **Action item**：把 long-term fix 進 TaskCreate、後續 sprint 處理

**禁**：incident 解了就忘 — action item 沒落實 = 下次再發生。

---

## §報 user

跑完每階段、`AskUserQuestion` 確認下一步：

```
問：Observe 完成。Fact 蒐齊（見上）。
options:
  1. 進 Hypothesize（推薦）
  2. 補蒐其他 fact（指明哪些）
  3. 已知 root cause、直接跳 Conclude
```

```
問：Hypothesize 完成。並列 N 個假設（見上）。
options:
  1. 進 Test、逐一驗（推薦）
  2. 補假設（user 提想到的）
  3. 砍假設（明顯不可能）
```

```
問：Test 完成。N/M 假設 confirmed。
options:
  1. 進 Conclude、寫 incident report（推薦）
  2. 還缺 fact、補 Test
```

---

## §hand-off state

```yaml
state:
  incident_id: <YYYY-MM-DD-short>
  incident_report_path: docs/incidents/<...>.md
  root_cause: <簡述>
  action_items: [<task list>]
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
| 「沒時間寫 report」 | 沒 report = 下次再發生 |
| 「報 user 時間線太繁」 | 時間線是調查核心；別 skip |
| 「action item 之後處」 | 標 owner + due date；不模糊 |
