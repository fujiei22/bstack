---
name: request-review
description: |
  自動 code review 派發（繁中）。載入：dev-workflow Phase 5（verify-done 之後）；亦可由使用者顯式呼叫。
  涵蓋：T1 self review / T2 單一 subagent（prompt 附語言提示） /
  T3 雙視角 subagent（架構 × 除錯，各附語言提示） / 結果交棒 receive-review。
  上游：verify-done。下游：receive-review。
---

# request-review

寫完 + verify 過 → 進 review。**不是 user 看 diff** — 是讓不同視角 / 不同 prompt 角度的 subagent 看。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state** 取 `tier`、`commits`、`codebase_impact.files`。
2. **依 tier dispatch review**（**T0 不進本 skill**：rules.md §Tier 表 T0 的 review 欄是「跳」）：
   - T1 = self review（主 agent 自己讀 diff）
   - T2 = 1 subagent（綜合 review + 語言提示）
   - T3 = 2 subagent（架構 × 除錯，各附語言提示）
3. **收集 review finding** → 整合 → 交棒 receive-review。

---

## §T1 self review

主 agent 跑：
- `git diff <base>...HEAD` 看完整 diff
- 對 spec / plan 看 coverage
- 對 rules.md「§程式註解」看註解完整
- 列「值得 user 注意」清單（簡短）
- 不另開 subagent

整合：
```markdown
## T1 Self review

Spec coverage: <yes/no, 細節>
註解完整: <yes/no>
Verify 全綠: <yes/no>
值得 user 注意: <列點>
```

---

## §T2 subagent dispatch

### 主 reviewer subagent

`Agent` tool spawn 一個 `general-purpose` agent，prompt：

```
你是 senior engineer code reviewer。

讀以下 diff 與相關 context：
- diff: <git diff base..HEAD output>
- spec: <spec 內容>
- task 來源: <T2 = spec §施工清單；T3 = plan 內容>
{語言提示}

回答：

1. **正確性**：實作是否符合 spec / plan？有沒有遺漏 / 過量？
2. **品質**：命名、結構、邊界、可讀性？
3. **風險**：error handling、race condition、edge case？
4. **測試**：每個改動都有測？測有測對的東西？
5. **rules.md 一致**：註解、PII、DB rule、commit 格式是否合？

回報格式（無 preamble）：
## 主 reviewer 結論

### Critical
- ...

### Major
- ...

### Minor
- ...

### Nit
- ...
```

### §語言提示（寫進 reviewer prompt，不另開 agent）

依改動副檔名組一段貼進每個 reviewer 的 prompt，格式「本 diff 含 <語言>，請特別看：<提示>」，多語言多列：

| 副檔名 | 提示 |
|---|---|
| `.py` | mutable default arg、裸 except、f-string 拼 SQL、type hint 與實際回傳不符 |
| `.ts .tsx .js .jsx .mjs` | `==` 與 truthy 比較、未 await 的 promise、regex 對 CRLF、`any` 逃逸 |
| `.sql` | 無 LIMIT 的重 query、隱式型別轉換讓 index 失效、migration 無回滾 |
| `.go` | err 未檢、goroutine 洩漏、defer 在迴圈內 |
| `.rs` | unwrap 在非測試碼、clone 掩蓋 borrow 問題 |
| `.java .cs .cpp .c .h` | 資源釋放、null / 未初始化、例外吞掉 |
| 其他 | 不附語言段 |

`lang-reviewer` agent 保留給 user 顯式要求（「用 lang-reviewer 看這段 SQL」），本 skill 不自動 spawn。
SQL 改動同時涉 DB schema / migration 時，`security-audit` phase 另派 `db-reviewer`（有 mysql MCP、做深度 review），與這裡的語言提示互補。

---

## §T3 雙視角 subagent

spawn 視角 A 與 B 兩個 subagent，不另開綜合 reviewer；兩個 prompt 都附 §語言提示：

### 視角 A — 架構 / 重構

```
你是架構 reviewer。讀以下 diff：
<diff>
{語言提示}

只看「架構是否合理」：

1. 抽象層次是否一致？
2. 模組邊界是否清楚？
3. 依賴方向是否符合既有架構？
4. 改動有沒有破壞既有 invariant？
5. 對 future scale / extensibility 的影響？

不關心微觀風格 / typo / 命名。

回報格式同 T2 主 reviewer。
```

### 視角 B — 除錯 / 邊界 / failure mode

```
你是 debugging-mindset reviewer。讀以下 diff：
<diff>
{語言提示}

只看「會在什麼情境壞」：

1. null / undefined / empty / 0 / NaN 怎麼處理？
2. 並發 / race condition / async timing？
3. 異常情境（network fail / OOM / disk full）？
4. 反直覺輸入（負數、超大、unicode、emoji）？
5. resource 沒釋放（file / connection / handle）？

不關心架構 / 風格。

回報格式同 T2 主 reviewer。
```

---

## §結果整合

主 agent 收 review 結論後：

```markdown
# Review 整合結果

> Tier: <T1-T3>
> Reviewers: <self | 綜合 reviewer | 架構 + 除錯>

## Critical 共識
- <多 reviewer 同提的>

## Critical 各自獨見
- 主 reviewer: ...
- 架構視角 (T3): ...
- 除錯視角 (T3): ...

## Major / Minor / Nit
（去重合併）

## 主 agent 建議
- 必處理: <Critical 列點>
- 建議處理: <Major 中認同的>
- 略過: <附理由>
```

---

## §hand-off state

```yaml
state:
  review_summary_path: docs/work/<branch-name>/_temp/<task-slug>.md  # 暫存
  reviewers_used: [...]
  critical_count: <N>
  major_count: <N>
  current_phase: request-review-done
```

**下一 phase**：→ `receive-review`（處置 finding、執行 auto-fix / 問 user）

---

## §結尾 Trace 標籤

```
[Trace] Phase=request-review | Tier=<T1-T3> | Track=<Bug/Dev> | Skill=request-review
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「T1 跳 self review 直接 finish」 | 哪怕 T1 也要 self review |
| 「T3 雙視角只跑一個」 | 雙視角缺一就退化成 T2 |
| 「多開一個 lang-reviewer 比較保險」 | 語言 idiom 已在 prompt；三個 reviewer 讀同一份 diff 是浪費，user 顯式要才派 |
| 「subagent 結果我自己判」 | 結果整合可以，但別自己 override critical |
