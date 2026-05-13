---
name: pr-explain
description: |
  PR diff 詳盡解釋落檔（繁中）。觸發：PR 開好後自動 / PR 解釋 / explain pr /
  diff 解釋 / 詳細寫 / 落檔 review。
  涵蓋：依檔分 section、每檔含改動意圖 + 每行 code 在做什麼 + 跟其他檔的關聯、
  落 docs/reviews/<pr-id>.md、commit、貼到 PR 為 comment（選用）。
  上游：finish-branch（PR 已開）。下游：retro（不綁定）。
---

# pr-explain

PR 開好後，對 diff 寫「為何 + 怎做 + 關聯」**詳盡**解釋落檔。給 reviewer / 未來看 PR 的人讀。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state** 取 `pr_number`、`pr_url`、`spec_path`、`plan_path`。
2. **抓 diff**：`gh pr diff <pr_number>`（或 `git diff <base>...HEAD`）。
3. **依檔切分**：每個檔一個 section。
4. **每 section 寫**：
   - **改動意圖**（**為何**改、**什麼問題 / 需求**驅動）
   - **每行 code 解釋**（**做了什麼** / 重要邏輯逐步）
   - **跟其他檔的關聯**（caller / callee / 介面 / 資料流）
5. **落檔** `docs/reviews/<pr_number>-<topic-slug>.md`。
6. **commit**。
7. （選用）**貼到 PR comment**：`gh pr comment <pr_number> --body-file <path>`。

---

## §文件結構

```markdown
# PR #<N>: <PR title>

> URL: <pr_url>
> Branch: <head_branch> → <base_branch>
> Track: <Bug/Dev> | Tier: <T0-T3>
> 建立: <YYYY-MM-DD>
> 對應 spec: docs/plans/<topic-slug>/spec.md
> 對應 plan: docs/plans/<topic-slug>/plan.md

## 整體脈絡

<3-5 句總結：本 PR 想解決什麼、整體做法、改了多少 files、有沒有 follow-up>

## 檔案改動清單

| 檔 | 類型 | 行 +/- | 改動性質 |
|---|---|---|---|
| `src/foo.ts` | edit | +12/-5 | 加新 endpoint |
| `tests/foo.test.ts` | new | +45/-0 | 新測試 |
| ... | ... | ... | ... |

---

## `<檔 1 路徑>`

### 改動意圖

<這檔被改的 reason。對齊 spec 的哪條 success criteria / plan 的哪個 task。
如果是修 bug、寫 bug 表現、root cause、為何此 fix 解掉根因。>

### 改動詳解

<以**邏輯區塊**分小 chunk，每個小 chunk 含：>

#### 區塊 1：<簡述（例：handler signature 改動）>

```diff
- export function handleUser(req: Request): User { ... }
+ export async function handleUser(req: Request): Promise<User | null> { ... }
```

- 改 sync → async：因為下游加 DB call、必 await
- return `null` 表「user 不存在」（先前 throw error；現在以 explicit null 替代）
- caller 端必須 update（見下方關聯）

#### 區塊 2：<...>

...

### 關聯檔案

- 被 `src/api/users.ts:34` 引用 → 該檔也改了（return null 處置）
- 提供給 `src/middleware/auth.ts:18` 使用 → 不影響介面（return type 兼容）
- 測試 `tests/user.test.ts:12-45` 覆蓋此函數新行為

---

## `<檔 2 路徑>`

（同上格式）

---

## 全域 patterns / cross-cutting

<跨檔的設計決策 / 不屬單一檔的東西：例如 error handling 策略改動、type system 升級、新 dependency 影響、命名 convention 變動。>

---

## 後續 follow-up

- [ ] <已知未做、列入 TODO>
- ...

---

## 安全 / PII 檢查

- secret / API key: 無
- PII mask: <是否處置、處置方式>
- file-type 硬規則命中: <列、附 user 確認紀錄>
```

---

## §每行解釋的精準度

**T1**：簡略 — 每區塊 2-3 句說明做什麼即可。
**T2**：標準 — 每區塊 1 段解釋（含 what + why），重要邏輯逐行。
**T3**：詳盡 — 每區塊獨立 sub-section、含邏輯流、邊界、failure mode。

別逐字翻譯 code（PR diff 本身就是 code）— 寫的是「**理解 code 所需的 context**」。

---

## §資料來源

- `gh pr view <pr_number>` — PR metadata（title / body / branch / base）
- `gh pr diff <pr_number>` — 完整 diff
- spec / plan / review 文件 — context
- commit log — 邏輯演進

---

## §落檔 + commit

```bash
git add docs/reviews/<pr_number>-<topic>.md
git commit -m "docs: 加 PR #<N> diff 詳解"
git push
```

如果還在 PR branch、commit 會直接出現在 PR diff 內 — 沒問題（review 文件本來就跟 PR 一起 review）。

---

## §貼到 PR comment（選用）

`AskUserQuestion`：
```
問：要不要把 diff 詳解貼到 PR comment？
options:
  1. 貼，方便 reviewer 直接看（推薦）
  2. 只落檔、不貼 PR
```

選 1：
```bash
gh pr comment <pr_number> --body-file docs/reviews/<pr_number>-<topic>.md
```

---

## §hand-off state

```yaml
state:
  pr_explain_path: docs/reviews/<pr_number>-<topic>.md
  pr_explain_pasted_to_pr: <bool>
  current_phase: pr-explain-done
```

**下一 phase**：→ 通常結束（不自動進 retro；user 主動觸發）

---

## §結尾 Trace 標籤

```
[Trace] Phase=pr-explain | Tier=<T0-T3> | Track=<Bug/Dev> | Skill=pr-explain
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「diff 已經有 code、不必再解釋」 | 寫的是「為何 + 關聯」，不是 code 本身 |
| 「T1 也寫得詳盡」 | tier 控詳盡度；T1 過度詳盡浪費 |
| 「全 PR 寫一段就好」 | 必依檔切 section；diff 大時 reader 跳檔讀 |
| 「跳關聯檔案 section」 | 關聯是 PR 解釋的核心價值 |
| 「PII 不必檢查、PR 是 internal」 | 仍要檢；PR 進 git history 變 permanent |
