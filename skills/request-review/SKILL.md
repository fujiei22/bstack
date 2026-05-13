---
name: request-review
description: |
  自動 code review 派發（繁中）。觸發：review / code review / 評 code /
  審 PR / 看一下 diff / 跑 review。
  涵蓋：T1 self review / T2 subagent + lang-reviewer dispatch /
  T3 雙視角 subagent（架構 × 除錯）+ lang-reviewer / 結果交棒 receive-review。
  上游：verify-done。下游：receive-review。
---

# request-review

寫完 + verify 過 → 進 review。**不是 user 看 diff** — 是讓不同視角 / 不同 prompt 角度的 subagent 看。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state** 取 `tier`、`commits`、`codebase_impact.files`。
2. **依 tier dispatch review**：
   - T1 = self review（主 agent 自己讀 diff）
   - T2 = 1 subagent（綜合 review）+ ECC lang-reviewer（依檔副檔名動態）
   - T3 = 2 subagent（架構 × 除錯雙視角）+ lang-reviewer
3. **收集 review finding** → 整合 → 交棒 receive-review。

---

## §T1 self review

主 agent 跑：
- `git diff <base>...HEAD` 看完整 diff
- 對 spec / plan 看 coverage
- 對 CLAUDE.md「§程式註解」看註解完整
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
- plan: <plan 內容>

回答：

1. **正確性**：實作是否符合 spec / plan？有沒有遺漏 / 過量？
2. **品質**：命名、結構、邊界、可讀性？
3. **風險**：error handling、race condition、edge case？
4. **測試**：每個改動都有測？測有測對的東西？
5. **CLAUDE.md 一致**：註解、PII、DB rule、commit 格式是否合？

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

### lang-reviewer dispatch

依改動副檔名選 language tag、spawn 單一 `lang-reviewer` agent、language 透過 prompt 動態 dispatch（**不是**為每語言開一個 agent 檔）：

| 副檔名 | language tag |
|---|---|
| `.py` | python |
| `.ts / .tsx / .js / .jsx` | typescript |
| `.sql` | sql |
| `.go` | golang |
| `.rs` | rust |
| `.java` | java |
| `.cs` | csharp |
| `.cpp / .c / .h` | cpp |
| 其他 | 跳、列「lang-reviewer 無對應 language section」 |

對每個命中的語言、spawn `Agent` with `subagent_type: lang-reviewer` + prompt body 內帶 `language: <tag>`，agent 依該 tag 套對應「§語言檢查焦點」段。

> 為何不每語言一個 agent 檔：agent 多會分散 maintenance、且大部分通用框架（正確性 / error handling / safety / testing / CLAUDE.md 一致）跨語言相同。動態 dispatch 一個 agent 處理全部、語言特化在 §語言檢查焦點 內分段。

> 注意：SQL 改動同時涉 DB schema / migration 時、`security-audit` phase 會另派 `db-reviewer`（有 mysql MCP 存取、做深度 review）；lang-reviewer SQL 是 surface 層、db-reviewer 是 deep 層、互補不重複。

prompt：
```
你是 <語言> 專家 reviewer。

讀以下 diff（focus 在 <副檔名> 檔）：
<diff>

特別檢查：
- <語言> 慣例 / idiom
- 該語言常見 pitfall（如 Python 的 mutable default arg、JS 的 truthy 比較）
- 該語言生態的 best practice

回報格式同主 reviewer。
```

---

## §T3 雙視角 subagent

T2 全部 + **再 spawn 一個 subagent**：

### 視角 A — 架構 / 重構

```
你是架構 reviewer。讀以下 diff：
<diff>

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
> Reviewers: <self | main + lang-reviewer(python) | main + lang-reviewer(typescript) + 架構 + 除錯>

## Critical 共識
- <多 reviewer 同提的>

## Critical 各自獨見
- 主 reviewer: ...
- lang-reviewer(<lang>): ...
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
  review_summary_path: docs/reviews/_temp/<task-slug>.md  # 暫存
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
| 「lang-reviewer 找不到對應 language section、跳過」 | 跳此 lang-reviewer 即可；但主 reviewer 必跑 |
| 「subagent_type 用 python-reviewer / sql-reviewer 等具體名稱」 | **錯**；只有 `lang-reviewer` 一個 agent；具體 language 用 prompt body `language: <tag>` 傳 |
| 「subagent 結果我自己判」 | 結果整合可以，但別自己 override critical |
