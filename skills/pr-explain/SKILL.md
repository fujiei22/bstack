---
name: pr-explain
description: |
  PR diff 詳盡解釋落檔（繁中）。觸發：PR 開好後自動 / PR 解釋 / explain pr /
  diff 解釋 / 詳細寫 / 落檔 review。
  涵蓋：fork pr-explainer agent 獨立 context 重讀 diff、依檔分 section 寫
  「為何 + 怎做 + 關聯」、落 docs/reviews/<pr>.md、commit、貼到 PR comment。
  上游：finish-branch（PR 已開）。下游：retro（不綁定）。
context: fork
agent: pr-explainer
argument-hint: "[pr-number]（可選；省略則自動取當前 branch 的 PR）"
---

# pr-explain task

對指定 PR 寫詳盡 diff 解釋、落檔到 `docs/reviews/<pr_number>.md`、commit、貼到 PR comment。

## 1. 取 PR number

PR number 候選：`$ARGUMENTS`

- 若上面非空 → 用該值
- 若上面為空 → 跑 `gh pr view --json number --jq '.number'` 取當前 branch 的 PR
- 兩者皆失敗 → 停下、回報「找不到 PR、無法解釋」

## 2. 取 PR metadata + diff + context

```bash
gh pr view <N> --json number,title,url,baseRefName,headRefName,body,createdAt,commits
gh pr diff <N>
```

從 PR body / commit messages / branch 名找：

- **Tier**：找 `[Trace] Tier=Tx` 或 branch 名線索；找不到預設 T2
- **Track**：找 `[Trace] Track=Bug/Dev`；找不到從 commit prefix 推（`feat/` `refactor/` → Dev、`fix/` `hotfix/` → Bug）
- **spec / plan**：PR body 或 commit message 提到 `docs/plans/<topic>/` → Read 對應 `spec.md` / `plan.md` 作為 context

## 3. 寫詳解檔

依 system prompt **§文件結構標準** 把詳解寫到 `docs/reviews/<N>.md`（已存在則覆蓋）。

詳盡度依 Tier 控（T1 簡 / T2 標準 / T3 詳盡），見 system prompt **§Tier 控詳盡度**。

## 4. Commit + push 到 PR branch

```bash
git add docs/reviews/<N>.md
git commit -m "docs: 加 PR #<N> diff 詳解"
git push
```

新 commit 直接進 PR diff，跟 PR 一起 review。

## 5. 貼到 PR comment

```bash
gh pr comment <N> --body-file docs/reviews/<N>.md
```

這步驟**預設執行**（不問 user）。reviewer 滑 PR 頁面就看到詳解、不用切 repo 翻檔。

## 6. 回報主對話

回單一摘要訊息：

```
✔ PR #<N> 詳解已落檔: docs/reviews/<N>.md
✔ Commit: <hash>
✔ 已貼 PR comment

整體脈絡（1-2 句）：<本 PR 想解決什麼、整體做法>

[Trace] Phase=pr-explain | Tier=<T0-T3> | Track=<Bug/Dev> | Skill=pr-explain
```

---

## 注意

- 全程**繁中**台灣用語、英文專有名詞保留
- **不**修 source code（只寫解釋）
- **不**問 user（subagent 內無 AskUserQuestion）
- PII 違規 → 在「安全 / PII 檢查」section 標 critical、但**不**主動修
- 套用 CLAUDE.md 強制守則（§PII / §Branch safety / §File-type 等）
