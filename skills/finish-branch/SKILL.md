---
name: finish-branch
description: |
  收尾 development branch + git workflow 細則合一（繁中）。觸發：完成 /
  finish / 收尾 / 開 PR / 提交 / commit done / ready to merge / 開 pull request /
  推 branch / 上 main / 寫 commit / merge / branch 命名疑問 / commit 格式 /
  PR 模板 / squash / rebase 操作 / 任何 git workflow 細節展開需求。
  涵蓋：clean check、rebase、push、開 PR、PR body 撰寫、Branch safety 過 hook、
  按 GitHub Flow squash merge（user 授權才 auto-merge）、commit 範例、PR / branch 命名規範。
  上游：security-audit（或 receive-review，若 tier 跳 security）。下游：pr-explain。
---

# finish-branch

Phase 7：把 feature branch 收尾、開 PR。本 skill **合 git workflow 細則於一處**（commit / branch 命名 / PR 模板 / rebase / squash merge）。

**不是 merge** — merge 由 user 觸發（GitHub 側按 squash、或對 AI 明說「merge」/「自己 merge」）。Past PR 授權**不延續**到下個 PR；session 級明授權才能 auto-merge（見 §Squash merge / WHO / WHEN）。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state** 取 `commits`、`tier`、`spec_path`、`plan_path`、`review_summary_path`。
2. **clean check**：working tree clean、無未追蹤檔、最後 commit 過 verify（見 §Clean check）。
3. **rebase main**：`git fetch origin && git rebase origin/main`，衝突 → 走 §Conflict 流程。
4. **push**：`git push -u origin <branch>`；rebase 過要 `--force-with-lease`，**禁裸 `--force`**（見 §Push）。
5. **開 PR**：用 `gh pr create`，套 §PR title 規範 + §PR body 模板。
6. **印 PR URL** + 交棒 pr-explain。**禁順手 `gh pr merge`**（除非 session 級明授權；見 §Squash merge / WHO / WHEN）。

**禁**：
- 直接 push 到 `main / master / production / prod / release`（Branch safety hook 會擋；見 §Branch safety 雙保險）
- skip pre-commit hook（`--no-verify`）
- 在 PR body 內貼 PII / secret / API key

---

## §Branch 命名

格式：`<type>/<short-desc>`

```
feat/<short-desc>
fix/<short-desc>
refactor/<short-desc>
docs/<short-desc>
chore/<short-desc>
test/<short-desc>
hotfix/<short-desc>
```

- **type**：`feat / fix / refactor / docs / chore / test / hotfix`
- **`<short-desc>`**：英文 kebab-case、3-5 字限

範例：`feat/user-auth-jwt`、`fix/login-redirect-loop`、`refactor/extract-payment-service`

---

## §Commit 訊息規範（繁中）

```
<type>: <subject 50 字內，繁中>

<body 可選，72 字斷行，繁中>
- 列點說明 what / why
- 不寫 how（看 diff 即知）

<footer 可選>
Refs: #123
Breaking-Change: <說明>
```

**type**：`feat / fix / refactor / docs / style / test / chore`

**subject 規則**：
- 祈使句、動詞開頭
- 不結尾標點
- 50 字內

### Commit 範例

```
feat: 加入 JWT 驗證 middleware

- 取代原 session cookie 驗證
- 支援 refresh token rotation
- 過期 token 回 401 而非 redirect

Refs: #45
```

```
fix: 修正登入 redirect 無限迴圈

- session expire 時 middleware 重新導向回登入頁
- 登入成功後又被 expire 判定 → 迴圈
- 改為 redirect 前先檢查 token TTL

Refs: #102
```

```
refactor: 抽出 payment service 至獨立模組

- 原 payment 邏輯散在 3 個 controller
- 集中至 services/payment/
- API 介面不變，無 breaking change
```

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
有衝突 → 走 §Conflict 流程。

### Rebase vs Merge

- **PR 內**：feature branch 落後 main → `git rebase origin/main`
- **進 main**：squash merge（GitHub repo 預設 squash、見 §Squash merge）

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
git push -u origin <branch>   # 第一次
git push --force-with-lease   # rebase 過後
```

**禁裸 `--force`**：可能覆寫 remote 別人推的東西。feature branch 才能用 `--force-with-lease`（main / master / production 等永遠禁 force）。

---

## §開 PR

```bash
gh pr create \
  --title "<type>: <subject 繁中、50 字內>" \
  --body "$(cat <<'EOF'
[填好的 PR body，見 §PR body 模板]
EOF
)"
```

**title type**：對齊 branch type（feat / fix / refactor / docs / chore / test / hotfix）。
**title 規範**：同 commit subject（繁中、type prefix、50 字內、祈使句、不結尾標點）。

### §PR title 範例

- `feat: 加入 JWT 驗證 middleware`
- `fix: 修正登入 redirect 無限迴圈`
- `refactor: 抽出 payment service 至獨立模組`

### §PR body 模板

```markdown
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
```

---

## §Squash merge

### WHO / WHEN — 預設 user 觸發

- **AI 預設不自動 `gh pr merge`**。`gh pr create` 開好 PR、印 URL、停。
- Merge 由 **user 觸發**（在 GitHub 側按 squash、或對 AI 明說「merge」/「自己 merge」/「可以 merge」）。
- Past 授權**不延續**：user 在 PR A 說「commit push merge」、不代表 PR B 也能自動 merge。每次明授權**只覆蓋當下這個 PR**。
- 唯一例外：user 對**整個 workflow / session** 明授權「這個流程可以自己 merge」、session 內延伸；新 session 不繼承。

理由：merge 進 main **不可逆**（要 revert 是另開 PR）、屬 CLAUDE.md「risky actions / 影響共享狀態」類、需 user 明確同意。

### HOW — GitHub Flow（單線）

```
main ← (PR + squash merge) ← feat/xxx
                              ↑ 多個 commit OK
```

- GitHub repo Settings → Pull Requests → 預設 squash merge
- 無 develop / release branch；所有 feature 從 main 切出
- squash 後 commit message 以 PR title 為準（GitHub 預設行為）
- merge 後立即刪 remote feature branch（GitHub 設定 auto-delete head branches）
- local feature branch 由 `git fetch --prune` 同步清
- **禁** force push 到 `main / master`

---

## §Branch safety 雙保險

- **Hook**：`~/.claude/hooks/branch-safety.ps1`（PreToolUse 擋 Write / Edit / NotebookEdit）
- **CLAUDE.md**：強制守則明列規則
- 任何 `git checkout` / `git push` 也過同 hook
- 命中主分支（`main / master / production / prod / release`）→ exit 2 阻擋
- 處置：依 CLAUDE.md「§決策點選單」走 AskUserQuestion 取 feature branch 名 → `git checkout -b <name>` → retry

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
| 「force push 比 force-with-lease 簡單」 | 禁裸 force；可能覆 remote 別人推的；feature branch 才能用 `--force-with-lease`、main 永遠禁 |
| 「main 推一下沒事」 | Branch safety hook 會擋；別找麻煩 |
| 「PR body 簡短」 | T1+ 用模板填全；T0 才可簡 |
| 「skip pre-commit hook」 | 禁；hook 失敗 = 真問題、修了再 commit |
| 「PR 開好順手 `gh pr merge`」 | **禁**；merge 由 user 觸發、past PR 授權不延續；session 級明授權才能 auto |
| 「Branch 名隨意」 | 必照 `<type>/<short-desc>` 格式；kebab-case、3-5 字 |
| 「commit subject 寫長一點清楚」 | 50 字內、超過進 body |
