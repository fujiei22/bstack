---
name: request-review
description: |
  自動 code review 派發（繁中）。載入：dev-workflow Phase 5（verify-done 之後）；亦可由使用者顯式呼叫。
  涵蓋：先依副檔名分流（純文件 diff 跳 code review）/ T1 self review /
  T2 內建 code-review medium + 主 agent 對 spec 自檢 /
  T3 內建 code-review high + 1 個 spec / 架構對齊 subagent（附語言提示） / 結果交棒 receive-review。
  上游：verify-done。下游：receive-review。
---

# request-review

寫完 + verify 過 → 進 review。抓 bug / 可簡化處交給 Claude Code **內建的 `code-review` skill**（8 個 finder 視角 + 逐條驗證，自寫 prompt 做不到同樣覆蓋）；「符合 spec / 規則書」內建的不看，這題自己派。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state** 取 `tier`、`commits`、`codebase_impact.files`、`spec_path`、`plan_path`。
2. **§副檔名分流**：對 `git diff <base>...HEAD --name-only` 的檔名比對下表，得 `code_review_applicable`。
3. **依 tier × 分流結果 dispatch**（**T0 不進本 skill**：rules.md §Tier 表 T0 的 review 欄是「跳」）：
   - T1 → §T1 self review（不看副檔名，本來就不派 agent）
   - T2 → 程式碼：`Skill("code-review", args="medium")` + §spec coverage 自檢；純文件：只做 §spec coverage 自檢
   - T3 → 程式碼：`Skill("code-review", args="high")` + §T3 對齊 subagent；純文件：只派 §T3 對齊 subagent
4. **收集 finding** → §結果整合 → 交棒 receive-review。

**不帶的旗標（硬規則）**：
- `--fix`：它會把 finding 直接套進 working tree，跟 receive-review「危險類要問」衝突。不寫這個旗標就不會動檔（2026-09-04 實測兩次 working tree 乾淨）。finding 一律交 receive-review 依 rules.md §Auto-fix 分類。
- `--comment`：貼 PR inline comment。Phase 5 時 PR 還沒開（Phase 7 才開），沒東西可貼；pr-explain 貼的是另一份文件。
- `ultra`：雲端多 agent、計費、要 user 自己觸發。

---

## §副檔名分流

| diff 內容 | `code_review_applicable` | 為什麼 |
|---|---|---|
| 含任一程式碼副檔名：`.js .mjs .cjs .ts .tsx .jsx .py .go .rs .sql .java .cs .cpp .c .h .rb .php .kt .swift .sh .ps1` | `true` | 有可執行邏輯，finder 找得到 bug / 重複 / 可簡化處 |
| 只有純文件：`.md .txt .json .yml .yaml .toml .csv .html .css`、prompt、文案、資料檔 | `false`（跳 code review） | 8 個 finder 對純文字找不到「會壞的情境」，只燒 token；一致性靠契約腳本（如本 repo 的 `plugin-contract.mjs`）與 T3 review-plan |
| 混合（例：改 skill 文本順手改一支 `.mjs` 契約） | `true` | 有程式碼就跑；finder 會自己忽略純文字 hunk |

**邊界**：`.html` / `.css` 歸純文件——它們沒有可執行邏輯，樣式對齊由 design-language 四項檢查管、畫面由 frontend-test 管。含 `<script>` 的 `.html` 判 `true`。判不出來就當 `true`（多跑一次的代價是 token，漏跑的代價是 bug）。

跳過時 `code_review_skipped_reason` 寫「純文件 diff：<副檔名列表>」，進 hand-off state。

---

## §T1 self review

主 agent 跑：
- `git diff <base>...HEAD` 看完整 diff
- 對 spec 看 coverage
- 對 rules.md「§程式註解」看註解完整
- 列「值得 user 注意」清單（簡短）
- 不另開 subagent、不叫 code-review

整合：
```markdown
## T1 Self review

Spec coverage: <yes/no, 細節>
註解完整: <yes/no>
Verify 全綠: <yes/no>
值得 user 注意: <列點>
```

---

## §T2：內建 code-review + spec 自檢

### 呼叫

```
Skill("code-review", args="medium")
```

不給 target 就是當前 branch 對 upstream / main 的 diff（含未 commit 的）。Skill 工具會立刻回「launched (forked execution, running in the background)」，**結果走 task-notification 的 `<result>`**——等通知，不要用 `TaskOutput block=true` 輪詢（fork 派出 finder 子 agent 等待期間它會立刻回 completed）。

**medium 做什麼**（2026-09-04 實測）：8 個 finder subagent（3 個 correctness 角度 + reuse / simplification / efficiency / altitude / conventions(CLAUDE.md)），每個最多 6 個 candidate；去重後每個 candidate 派 1 個 verifier 判 CONFIRMED / PLAUSIBLE / REFUTED；輸出 **JSON 陣列 ≤8 筆** `{file, line, summary, failure_scenario}`，沒東西就 `[]`。它的 prompt 明寫不叫 ReportFindings。一次約 7 分鐘、fork 本身 10 萬 token 上下（finder / verifier 另計）。

### §spec coverage 自檢（主 agent 自己做，不另開 subagent）

code-review 只看 diff 本身會不會壞，**不知道 spec 要什麼**。等通知的同時主 agent 做：

1. 讀 `spec_path` 的 `## 施工清單`，逐列對 diff：這列做了嗎？有沒有做了清單外的事？
2. 對 rules.md「§程式註解」：新 function / class 有 docstring？
3. 對 rules.md「§PII 安全底線」「§File-type 硬規則」：diff 有沒有碰到？
4. 產出：

```markdown
## Spec coverage 自檢（T2）

| 施工清單 # | 做了 | 偏差 |
|---|---|---|
| 1 | yes | — |

清單外改動：<列點或「無」>
註解：<yes/no>
PII / File-type：<無命中 / 命中什麼>
```

純文件 diff 時只有這一段，沒有 code-review 輸出。

---

## §T3：內建 code-review + 對齊 subagent

### 呼叫

```
Skill("code-review", args="high")
```

high 依 skill 描述覆蓋更廣、可能含不確定的 finding（PLAUSIBLE 也會進來）。回收方式同 T2。

### 對齊 subagent（spec / 架構）

與 code-review **並行** spawn 一個 `general-purpose` agent；prompt 附 §語言提示：

```
你是架構 reviewer。讀以下 diff 與 context：
<diff>
- spec: <spec 內容>
- plan: <plan.md 內容>
{語言提示}

先答一題：實作範圍與 spec / plan 一致嗎？有遺漏 / 過量嗎？（bug 另有內建 code-review 在看，這題只有你看）

只看「架構是否合理」：

1. 抽象層次是否一致？
2. 模組邊界是否清楚？
3. 依賴方向是否符合既有架構？
4. 改動有沒有破壞既有 invariant？
5. 對 future scale / extensibility 的影響？

不關心微觀風格 / typo / 命名 / 邊界值——那些內建 code-review 會抓。

回報格式（無 preamble）：
## 對齊 reviewer 結論

### Critical
- ...

### Major
- ...

### Minor
- ...

### Nit
- ...
```

純文件 diff 時只派這個 subagent。

### §語言提示（寫進對齊 subagent 的 prompt，不另開 agent）

依改動副檔名組一段貼進 prompt，格式「本 diff 含 <語言>，請特別看：<提示>」，多語言多列：

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
SQL 改動同時涉 DB schema / migration 時，`security-audit` phase 另派 `db-reviewer`（有 mysql MCP、做深度 review）。

---

## §結果整合

code-review 的輸出**格式不歸我們管**（Claude Code 升版可能改），所以不 parse 欄位名，用意思轉：

| code-review 輸出 | 轉成 |
|---|---|
| JSON 陣列每筆（`summary` + `failure_scenario`） | 有具體觸發情境且會壞 → **Critical / Major**（看爆炸半徑）；重複 / 可簡化 / 效率 / 慣例類 → **Minor**；已 merge 或前置既有、本 PR 只是暴露 → **Minor 附註「pre-existing」** |
| 純文字 `path:line — 問題` 行 | 同上 |
| `[]` / `(none)` | 0 finding，receive-review 短路 |

主 agent 整合：

```markdown
# Review 整合結果

> Tier: <T1-T3>
> code-review: <medium | high | 跳（純文件：.md .js-label）>
> Reviewers: <self | code-review + spec 自檢 | code-review + 對齊 subagent>

## Critical
- <來源標 [code-review] / [對齊] / [自檢]>

## Major / Minor / Nit
（去重合併；同一行兩邊都提的合成一條）

## 主 agent 建議
- 必處理: <Critical 列點>
- 建議處理: <Major 中認同的>
- 略過: <附理由；code-review 的 PLAUSIBLE 沒觸發情境的可列這裡>
```

---

## §hand-off state

```yaml
state:
  review_summary_path: docs/work/<branch-name>/_temp/<task-slug>.md  # 暫存
  reviewers_used: [...]                 # 例 [code-review:medium, spec-self-check]
  code_review_level: <medium|high|null> # null = 跳
  code_review_skipped_reason: <純文件 diff：.md .json | null>
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
| 「純文件 diff 也跑 code-review 比較保險」 | 8 個 finder 對純文字找不到會壞的情境，只燒 token；一致性靠契約腳本 |
| 「有 `.mjs` 但只是契約腳本，算純文件」 | 有程式碼副檔名就跑；判不出來當 `true` |
| 「帶 `--fix` 省一步」 | 危險類 finding 會被直接套進 working tree；一律交 receive-review 分類 |
| 「TaskOutput 回 completed 了，結果應該有了」 | fork 在等 finder 期間也回 completed；等 task-notification 的 `<result>` |
| 「code-review 沒提 spec 遺漏，應該沒事」 | 它不看 spec；coverage 是自檢 / 對齊 subagent 的事 |
| 「多開一個 lang-reviewer 比較保險」 | 語言 idiom 已在對齊 subagent prompt；user 顯式要才派 |
