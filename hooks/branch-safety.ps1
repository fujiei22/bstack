#!/usr/bin/env pwsh
<#
.SYNOPSIS
  PreToolUse hook — 禁主分支直接寫入（限 project repo 內檔案）。

.DESCRIPTION
  Claude Code 呼叫 Write / Edit / NotebookEdit 前先跑此 hook。
    - 取 $CLAUDE_PROJECT_DIR 對應的 current branch；非 git repo / git 失敗 → exit 0 放行。
    - 若 file_path 不在 $CLAUDE_PROJECT_DIR 範圍內（例如 ~/.claude 全域檔）→ exit 0 放行，
      避免「全域 / 工具檔的編輯被 project branch 連坐攔截」。
    - branch 命中 main / master / production / prod / release → exit 2 阻擋。
  退出 2 = block tool call，stderr 顯示給 Claude，Claude 走 §決策點選單規則 切 branch 後 retry。
#>

$ErrorActionPreference = 'Continue'

# === stderr / stdout UTF-8 setup（避免 Claude Code 收到 CP950 編碼亂碼）===
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$errStream = [Console]::OpenStandardError()
$err = New-Object System.IO.StreamWriter $errStream, $utf8NoBom
$err.AutoFlush = $true

function Write-Err {
    param([string]$msg)
    $err.WriteLine($msg)
}

# 讀 stdin event payload，取被寫入 / 編輯的 file_path（用於 scope check）
$raw = [Console]::In.ReadToEnd()
$targetPath = $null
if ($raw) {
    try {
        $payload = $raw | ConvertFrom-Json
        switch ($payload.tool_name) {
            'Edit'         { $targetPath = $payload.tool_input.file_path }
            'Write'        { $targetPath = $payload.tool_input.file_path }
            'NotebookEdit' { $targetPath = $payload.tool_input.notebook_path }
            default        { exit 0 }
        }
    } catch {
        # JSON 解析失敗放行（hook 不該因自身錯誤 block）
        exit 0
    }
}

# 用 CLAUDE_PROJECT_DIR 確保檢查正確 repo（避免 cwd 漂移）
$repo = $env:CLAUDE_PROJECT_DIR
if (-not $repo) { $repo = (Get-Location).Path }

# Scope check：file_path 若有解析到、且不在 $repo 之下 → 全域 / 外部檔，放行
if ($targetPath) {
    try {
        $absTarget = [System.IO.Path]::GetFullPath($targetPath)
        $absRepo   = [System.IO.Path]::GetFullPath($repo).TrimEnd('\','/')
        # 大小寫不敏感（Windows）
        if (-not $absTarget.ToLower().StartsWith(($absRepo + [System.IO.Path]::DirectorySeparatorChar).ToLower()) -and
            -not $absTarget.ToLower().StartsWith(($absRepo + '/').ToLower())) {
            exit 0
        }
    } catch {
        # 路徑解析失敗保守放行
        exit 0
    }
}

Push-Location $repo
try {
    $branch = git rev-parse --abbrev-ref HEAD 2>$null
    if ($LASTEXITCODE -ne 0) {
        # 非 git repo，放行
        exit 0
    }

    if ($branch -match '^(main|master|production|prod|release)$') {
        Write-Err "[BRANCH-SAFETY] 目前在主分支 '$branch'，禁直接寫入 / 編輯 project repo 內檔案。"
        Write-Err "處置：走 §決策點選單規則 → AskUserQuestion 詢 user branch 名 → ``git checkout -b <name>`` → retry tool call。"
        exit 2
    }

    exit 0
}
finally {
    Pop-Location
}
