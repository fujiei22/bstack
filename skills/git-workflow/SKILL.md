---
name: git-workflow
description: |
  Git workflow 細則（繁中）：commit 訊息範例、PR title / body 模板、squash merge 慣例。
  觸發：寫 commit / 開 PR / merge / branch 命名疑問 / 任何 git workflow 細節展開需求。
  **核心鐵律見 CLAUDE.md「版本控管」H2**；本 skill 補範例與模板。
---

# Git Workflow 細則

> 核心規範（branch 命名、commit 格式、GitHub Flow、Rebase vs Merge）已寫進 CLAUDE.md。
> 本 skill 補：commit 範例、PR title / body 模板、實作細則。

## Commit 範例

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

## PR title

同 commit subject 規範（繁中、type prefix、50 字內、祈使句、不結尾標點）。

範例：
- `feat: 加入 JWT 驗證 middleware`
- `fix: 修正登入 redirect 無限迴圈`

## PR body 模板

```markdown
## 動機 / Why
<為何做此改動>

## 改動內容 / What
- ...

## 測試 / Test
- [ ] 單元測試通過
- [ ] E2E 測試通過（若 UI 改動）
- [ ] /quality-gate 通過

## 相關 / Refs
#issue
```

## Squash merge 細節

- GitHub repo Settings → Pull Requests → 預設 squash merge
- squash 後 commit message 以 PR title 為準（GitHub 預設行為）
- merge 後立即刪 remote feature branch（GitHub 設定 auto-delete head branches）
- local feature branch 由 `git fetch --prune` 同步清

## Rebase 操作細節

PR 內 feature branch 落後 main：

```bash
git fetch origin main
git rebase origin/main
# 解衝突
git push --force-with-lease origin <feature-branch>
```

**禁** `git push --force`，**用** `--force-with-lease`（避免覆蓋他人 push）。

## Branch safety 雙保險

- **Hook**：`.claude/hooks/branch-safety.ps1`（PreToolUse 擋 Write / Edit / NotebookEdit）
- **CLAUDE.md**：強制守則明列規則
- 命中主分支 → 走 §決策點選單 取 branch 名 → `git checkout -b <name>` → retry
