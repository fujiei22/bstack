---
name: finish-branch
description: |
  收尾 development branch + git workflow 細則合一（繁中）。載入：dev-workflow Phase 7
  （security-audit 或 receive-review 之後）；亦可由使用者顯式呼叫（含任何 git workflow 細節展開需求）。
  涵蓋：clean check、rebase、push、開 PR、PR body 撰寫、Branch safety 過 hook、
  按 GitHub Flow squash merge（user 授權才 auto-merge）、commit 範例、PR / branch 命名規範。
  上游：security-audit（或 receive-review，若 tier 跳 security）。下游：pr-explain（T3）；T0-T2 開完 PR 即停、等 user merge。
---

# finish-branch

Phase 7：把 feature branch 收尾、開 PR。git workflow 細則（commit / branch 命名 / PR 模板 / rebase / squash merge）合於一處。

**不是 merge** — merge 由 user 觸發（GitHub 側按 squash、或對 AI 明說「merge」/「自己 merge」）。Past PR 授權**不延續**到下個 PR；session 級明授權才能 auto-merge（見 §Squash merge）。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state** 取 `commits`、`tier`、`spec_path`、`plan_path`、`review_summary_path`。
2. **clean check**：working tree clean、無未追蹤檔、最後 commit 過 verify（見 §Clean check）。
3. **rebase main**：`git fetch origin && git rebase origin/main`，衝突 → 走 §Conflict 流程。
4. **push**：`git push -u origin <branch>`；rebase 過要 `--force-with-lease`，**禁裸 `--force`**（見 §Push）。
5. **開 PR**：用 `gh pr create`，套 §PR title 規範 + §PR body 模板。
6. **印 PR URL**。**T3 → 交棒 pr-explain**；T0-T2 → 到此為止、等 user merge（PR body 已含動機 / 改動 / 測試，pr-explain 對這個量體是純成本）。**禁順手 `gh pr merge`**（除非 session 級明授權；見 §Squash merge）。
7. **merge 之後**（同 session 內 user 觸發 merge 時）把 `docs/work/<branch-name>/` 搬進 `docs/archive/<年>/`（見 §Merge 後：docs 歸檔）。

**禁**：
- 直接 push 到 `main / master / production / prod / release`（Branch safety hook 會擋；見 §Branch safety 雙保險）
- skip pre-commit hook（`--no-verify`）
- 在 PR body 內貼 PII / secret / API key

## §Branch 命名

見 rules.md §Branch 命名。範例：`feat/user-auth-jwt`

## §Commit 訊息規範（繁中）

格式與 type 見 rules.md §Commit 訊息。範例：

```
feat: 加入 JWT 驗證 middleware

- 取代原 session cookie 驗證
- 支援 refresh token rotation
- 過期 token 回 401 而非 redirect

Refs: #45
```

## §Clean check

```bash
git status               # 應 working tree clean
git log <base>..HEAD    # commit 清單
```

不 clean → 處置：
- 未 commit 改動 → 評：是不是該補進 review？該 commit？該 stash？
- 未追蹤檔 → 評：要不要進 PR？該加 .gitignore？

不能盲目 `git add .` — 會挾帶意外檔（依 rules.md「§File-type 硬規則」可能漏 secret）。

## §Rebase main（PR 落後時）

無衝突 → 跑 §Push；有衝突 → 走 §Conflict 流程。PR 內落後 main 用 rebase，進 main 用 squash merge（見 §Squash merge）。

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

## §Push

```bash
git push -u origin <branch>   # 第一次
git push --force-with-lease   # rebase 過後
```

**禁裸 `--force`**：可能覆寫 remote 別人推的東西；feature branch 才能用 `--force-with-lease`，main / master / production 等永遠禁 force。

## §開 PR

```bash
gh pr create \
  --title "<type>: <subject 繁中、50 字內>" \
  --body "$(cat <<'EOF'
[填好的 PR body，見 §PR body 模板]
EOF
)"
```

**title**：type 對齊 branch type（feat / fix / refactor / docs / chore / test / hotfix）；規範同 commit subject（繁中、50 字內、祈使句、不結尾標點）。範例：`feat: 加入 JWT 驗證 middleware`

### §PR body 模板

```markdown
## 動機 / Why

<為何要做、user 在意什麼>

## 改動內容 / What

- <列點>

## 測試 / Test

- [x] verify-done 全綠（test / lint / build / type-check；e2e: <pass | smoke（文字節點豁免，未跑整套）| skipped>）
- [x] review 過（reviewer: <列>）
- [x] security-audit 過（若 tier T2 涉敏感 / T3）
- [ ] 上 staging 驗 / 手動跑過 e2e（若 UI）

## 風險 / Risk

- <若有；無寫「無」>

## 相關 / Refs

- spec: docs/work/<branch-name>/spec.md
- plan: <docs/work/<branch-name>/plan.md（T3）| N/A（T2 施工清單在 spec）>
- review: <hand-off state 的 review_summary_path 實際值；
  request-review 寫的是 docs/work/<branch-name>/_temp/<task-slug>.md，不要寫死 review.md>
- (issue) #<N>
```

## §Squash merge

- **AI 預設不自動 `gh pr merge`**：`gh pr create` 開好 PR、印 URL、停。Merge 由 **user 觸發**（在 GitHub 側按 squash、或對 AI 明說「merge」/「自己 merge」/「可以 merge」）。
- Past 授權**不延續**：user 在 PR A 說「commit push merge」、不代表 PR B 也能自動 merge。每次明授權**只覆蓋當下這個 PR**。
- 唯一例外：user 對**整個 workflow / session** 明授權「這個流程可以自己 merge」、session 內延伸；新 session 不繼承。
- 理由：merge 進 main **不可逆**（要 revert 是另開 PR）、屬 rules.md「risky actions / 影響共享狀態」類、需 user 明確同意。
- GitHub Flow 單線：所有 feature 從 main 切出、無 develop / release branch；repo 預設 squash merge，squash 後 commit message 以 PR title 為準。
- merge 後立即刪 remote feature branch（GitHub 設定 auto-delete head branches）；local 由 `git fetch --prune` 同步清。
- **禁** force push 到 `main / master`。

## §Merge 後：docs 歸檔

merge 完成後把該 branch 的施工文件從 `work/` 移進 `archive/`，否則 `work/` 會累積成
分不出死活的雜物堆（見 rules.md §Docs 落檔）。

```bash
mkdir -p docs/archive/<年>
mv docs/work/<branch-name> docs/archive/<年>/<主題>
```

- `<主題>` = branch 的 short-desc，**不帶 `<type>/` prefix**：merge 之後「這是 feat 還是
  fix」已無資訊量，找文件是用主題找
- **單檔主題平放**：只剩一個檔就不開夾，直接 `docs/archive/<年>/<主題>.md`
- **抽長期價值**：搬之前先問這批裡有沒有「規則」性質的（別支 branch 會回頭查的），有就
  挑出來放 `docs/reference/`；一次性調查 / 量測報告的**結論寫進 memory**、報告本體照樣進
  archive
- **docs 有進版控的專案**：這個搬移是 `git mv` + 一支 `chore:` commit，可併進下一支 branch；
  docs 被 `.gitignore` 排除的專案直接本機 `mv`，不需 commit

## §Branch safety 雙保險

- **Hook**：plugin 的 `hooks/branch-safety.ps1`（PreToolUse 擋 Write / Edit / NotebookEdit）；命中主分支（`main / master / production / prod / release`）→ exit 2 阻擋
- **rules.md**：見 rules.md §Branch safety
- 處置：依 rules.md「§決策點選單」走 AskUserQuestion 取 feature branch 名 → `git checkout -b <name>` → retry

## §特殊情境

### Hotfix
branch 名 `hotfix/<short>`、title prefix `hotfix:`、PR body 加「## Hotfix justification」section 寫為何跳 brainstorm / plan

### Tier T0 直接到此
不寫 spec / plan；PR body 簡：「動機 + What + 一句 verify 說明」即可

### Bug track
PR title 用 `fix:` prefix；PR body 額外加「## Bug reproduce」section（症狀 / 重現步驟 / root cause）

## §hand-off state

```yaml
state:
  branch_name: <name>
  pr_url: <URL>
  pr_number: <int>
  pr_state: open
  current_phase: finish-branch-done
```

**下一 phase**：T3 → `pr-explain`；T0-T2 → 無（等 merge；merge 後做 §Merge 後：docs 歸檔）

## §結尾 Trace 標籤

```
[Trace] Phase=finish-branch | Tier=<T0-T3> | Track=<Bug/Dev> | Skill=finish-branch
```

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「rebase conflict 我先試 resolve」 | 不自作主張；走 §Conflict 流程 |
| 「force push 比 force-with-lease 簡單」 | 禁裸 force；可能覆 remote 別人推的；feature branch 才能用 `--force-with-lease`、main 永遠禁 |
| 「PR 開好順手 `gh pr merge`」 | **禁**；merge 由 user 觸發、past PR 授權不延續；session 級明授權才能 auto |
| 「skip pre-commit hook」 | 禁；hook 失敗 = 真問題、修了再 commit |
| 「merge 完就結束、docs 留在 work 沒差」 | 沒搬 archive 的話 `work/` 會變成死活不分的雜物堆；見 §Merge 後：docs 歸檔 |
