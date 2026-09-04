---
name: pr-explain
description: |
  PR diff 詳盡解釋落檔（繁中）。載入：dev-workflow Phase 8（**T3** finish-branch 開好 PR 後）；T0-T2 不自動跑，user 顯式呼叫可。
  涵蓋：fork pr-explainer agent 獨立 context 重讀 diff、依檔分 section 寫
  「為何 + 怎做 + 關聯」、落 docs/work/<branch-name>/pr-review.md、commit、貼到 PR comment。
  上游：finish-branch（PR 已開）。下游：retro（不綁定）。
context: fork
agent: pr-explainer
argument-hint: "[pr-number]（可選；省略則自動取當前 branch 的 PR）"
---

# pr-explain task

對指定 PR 寫詳盡 diff 解釋、落檔到 `docs/work/<branch-name>/pr-review.md`、commit、貼到 PR comment。全程套用 rules.md 強制守則（§PII / §Branch safety / §File-type 等）；輸出語言、不修 code、不問 user、PII 處置依 agent 定義。

## 1. 取 PR number

PR number 候選：`$ARGUMENTS`

- 非空 → 用該值
- 空 → 跑 `gh pr view --json number --jq '.number'` 取當前 branch 的 PR
- 皆失敗 → 停下、回報「找不到 PR、無法解釋」

## 2. 取 PR metadata + diff + context

```bash
gh pr view <N> --json number,title,url,baseRefName,headRefName,body,createdAt,commits
gh pr diff <N>
```

從 PR body / commit messages / branch 名找：

- **Tier**：`[Trace] Tier=Tx` 或 branch 名線索；找不到預設 T2
- **Track**：`[Trace] Track=Bug/Dev`；找不到從 commit prefix 推（`feat/` `refactor/` → Dev、`fix/` `hotfix/` → Bug）
- **spec / plan**：提到 `docs/work/<branch-name>/` → Read 對應 `spec.md` / `plan.md` 作為 context

## 3. 寫詳解檔

依 system prompt **§文件結構標準** 寫到 `docs/work/<branch-name>/pr-review.md`（已存在則覆蓋）；詳盡度依 Tier 控（T1 簡 / T2 標準 / T3 詳盡），見 system prompt **§Tier 控詳盡度**。

## 4. Commit + push 到 PR branch

```bash
git add docs/work/<branch-name>/pr-review.md
git commit -m "docs: 加 PR #<N> diff 詳解"
git push
```

## 5. 貼到 PR comment

```bash
gh pr comment <N> --body-file docs/work/<branch-name>/pr-review.md
```

**預設執行**（不問 user）。

## 6. 回報主對話

回單一摘要訊息：

```
✔ PR #<N> 詳解已落檔: docs/work/<branch-name>/pr-review.md
✔ Commit: <hash>
✔ 已貼 PR comment

整體脈絡（1-2 句）：<本 PR 想解決什麼、整體做法>

[Trace] Phase=pr-explain | Tier=<T0-T3> | Track=<Bug/Dev> | Skill=pr-explain
```
