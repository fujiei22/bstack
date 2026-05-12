#!/usr/bin/env pwsh
<#
.SYNOPSIS
  PreToolUse hook — 禁主分支直接寫入。

.DESCRIPTION
  Claude Code 呼叫 Write / Edit / NotebookEdit 前先跑此 hook。
  current branch 命中 main / master / production / prod / release → exit 2 阻擋。
  非 git repo / git 失敗 → exit 0 放行（讓 Claude 自己判斷）。
  退出 2 = block tool call，stderr 顯示給 Claude，Claude 走 §決策點選單規則 切 branch 後 retry。
#>

$ErrorActionPreference = 'Continue'

# 用 CLAUDE_PROJECT_DIR 確保檢查正確 repo（避免 cwd 漂移）
$repo = $env:CLAUDE_PROJECT_DIR
if (-not $repo) { $repo = (Get-Location).Path }

Push-Location $repo
try {
    $branch = git rev-parse --abbrev-ref HEAD 2>$null
    if ($LASTEXITCODE -ne 0) {
        # 非 git repo，放行
        exit 0
    }

    if ($branch -match '^(main|master|production|prod|release)$') {
        [Console]::Error.WriteLine("[BRANCH-SAFETY] 目前在主分支 '$branch'，禁直接寫入 / 編輯檔案。")
        [Console]::Error.WriteLine("處置：走 §決策點選單規則 → AskUserQuestion 詢 user branch 名 → ``git checkout -b <name>`` → retry tool call。")
        exit 2
    }

    exit 0
}
finally {
    Pop-Location
}
