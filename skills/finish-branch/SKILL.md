---
name: finish-branch
description: |
  收尾 development branch（繁中）。觸發：完成 / finish / 收尾 / 開 PR / 提交 /
  commit done / ready to merge / 開 pull request / 推 branch / 上 main。
  涵蓋：commit clean check、rebase main、push、開 PR、PR body 撰寫（套 git-workflow）、
  Branch safety 過 hook、按 GitHub Flow squash merge。
  上游：security-audit（或 receive-review，若 tier 跳 security）。下游：pr-explain。
---

# finish-branch

把 feature branch 收尾、開 PR。**不是 merge** — merge 由 user 在 GitHub 側按 squash 觸發。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state** 取 `commits`、`tier`、`spec_path`、`plan_path`、`review_summary_path`。
2. **clean check**：working tree clean、無未追蹤檔、最後 commit 過 verify。
3. **rebase main**：`git fetch origin && git rebase origin/main`，衝突 → 走 §Conflict 流程。
4. **push**：`git push -u origin <branch>`；feature branch 可 `--force-with-lease`，禁裸 `--force`。
5. **開 PR**：用 `gh pr create`，套 PR title / body 模板（見下、依 git-workflow skill）。
6. **印 PR URL** + 交棒 pr-explain。

**禁**：
- 直接 push 到 `main / master / production / prod / release`（Branch safety hook 會擋）
- skip pre-commit hook（`--no-verify`）
- 在 PR body 內貼 PII / secret / API key

---

## §Clean check

```bash
git status               # 應 working tree clean
git log <base>..HEAD    # commit 清單
```

不 clean → 處置：
- 未 commit 改動 → 評：是不是該補進 review？該 commit？該 stash？
- 未追蹤檔 → 評：要不要進 PR？該加 .gitignore？

不能盲目 `git add .` — 會挾帶意外檔（依 CLAUDE.md「§File-type 硬規則」可能漏 secret）。

---

## §Rebase main（PR 落後時）

```bash
git fetch origin
git rebase origin/main
```

無衝突 → 跑 §Push。

---

## §Conflict 流程

`git rebase` 中 conflict：

1. **不自作主張 resolve** — git 衝突常有 semantic 意圖
2. `AskUserQuestion`：
   ```
   問：rebase main 時遇 conflict 在 <file>。
   options:
     1. 我 propose resolution（推薦）— 我列出 ours / theirs / 合理 merge 並請你選
     2. 你直接告訴我怎麼 resolve
     3. abort rebase 退回（保留 origin pre-rebase 狀態）
   ```
3. 選 1 → 主 agent 列 ours / theirs / 提建議 merge → user 選 → apply → `git add` → `git rebase --continue`
4. 選 3 → `git rebase --abort` → 退 receive-review 重評

---

## §Push

```bash
# 第一次
git push -u origin <branch>

# 後續（rebase 過要 force-with-lease）
git push --force-with-lease
```

**禁裸 `--force`**：可能覆寫 remote 別人推的東西。

---

## §開 PR（依 git-workflow skill 模板）

```bash
gh pr create \
  --title "<type>: <subject 繁中、50 字內>" \
  --body "$(cat <<'EOF'
## 動機 / Why

<為何要做、user 在意什麼>

## 改動內容 / What

- <列點>

## 測試 / Test

- [x] verify-done 全綠（test / lint / build / type-check）
- [x] review 過（reviewer: <列>）
- [x] security-audit 過（若 tier T2 涉敏感 / T3）
- [ ] 上 staging 驗 / 手動跑過 e2e（若 UI）

## 風險 / Risk

- <若有；無寫「無」>

## 相關 / Refs

- spec: docs/plans/<topic>/spec.md
- plan: docs/plans/<topic>/plan.md
- review: docs/plans/<topic>/review.md
- (issue) #<N>
EOF
)"
```

**title type**：對齊 branch type（feat / fix / refactor / docs / chore / test / hotfix）。

---

## §Branch safety hook 配合

任何 `git checkout` / `git push` 都會過 `~/.claude/hooks/branch-safety.ps1`：
- 命中主分支 → exit 2 阻擋
- 處置：依 CLAUDE.md「§決策點選單」走 AskUserQuestion 取 feature branch 名 → 切 branch → retry

---

## §特殊情境

### Hotfix
- branch 名 `hotfix/<short>`
- title prefix `hotfix:`
- PR body 加「## Hotfix justification」section 寫為何跳 brainstorm / plan

### Tier T0 直接到此
- 不寫 spec / plan
- PR body 簡：「動機 + What + 一句 verify 說明」即可

### Bug track
- PR title 用 `fix:` prefix
- PR body 額外加「## Bug reproduce」section（症狀 / 重現步驟 / root cause）

---

## §hand-off state

```yaml
state:
  branch_name: <name>
  pr_url: <URL>
  pr_number: <int>
  pr_state: open
  current_phase: finish-branch-done
```

**下一 phase**：→ `pr-explain`

---

## §結尾 Trace 標籤

```
[Trace] Phase=finish-branch | Tier=<T0-T3> | Track=<Bug/Dev> | Skill=finish-branch
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「working tree 髒就強塞 PR」 | clean check 必過 |
| 「rebase conflict 我先試 resolve」 | 不自作主張；走 §Conflict 流程 |
| 「force push 比 force-with-lease 簡單」 | 禁裸 force；可能覆 remote 別人推的 |
| 「main 推一下沒事」 | Branch safety hook 會擋；別找麻煩 |
| 「PR body 簡短」 | T1+ 用模板填全；T0 才可簡 |
| 「skip pre-commit hook」 | 禁；hook 失敗 = 真問題、修了再 commit |
