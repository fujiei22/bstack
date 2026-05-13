#!/usr/bin/env pwsh
<#
.SYNOPSIS
  將本 repo 的 skill / hook / agent / settings 全套 sync 至 global `~/.claude/`。

.DESCRIPTION
  動作（idempotent；直接覆蓋既有檔、不備份）：
    1. 開頭印備份提醒（不強制等按鍵；user 自行決定中斷與否）
    2. Pre-flight：claude CLI / git / pwsh / jq（缺則錯誤）
    3. Sync repo → global：
         CLAUDE.md                       → CLAUDE.md
         statusline.sh                   → statusline.sh
         hooks/branch-safety.ps1         → hooks/branch-safety.ps1
         hooks/file-type-guard.ps1       → hooks/file-type-guard.ps1
         skills/<name>/SKILL.md          → skills/<name>/SKILL.md     （遞迴整個 skills/）
         agents/<name>.md                → agents/<name>.md
         settings.json                   → settings.json（轉 ${CLAUDE_PROJECT_DIR} 為絕對路徑）

  全 standalone：不裝 marketplace / plugin、不裝 playwright MCP、不跑 bun。
  mysql MCP 由 user 手動裝（結尾印指令範例）。

.NOTES
  Windows + pwsh 7+。
  須在 repo 內執行（`git rev-parse --show-toplevel` 取 repo root）。

.PARAMETER SkipPrereqCheck
  跳 pre-flight 版本檢查（debug 用）。

.PARAMETER Yes
  跳備份提醒（適 CI / 自動化）。
#>

[CmdletBinding()]
param(
    [switch]$SkipPrereqCheck,
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'

# 修中文 console 亂碼
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# === 公用 func ===

function Get-GlobalClaudeDir {
    <#
    .SYNOPSIS
      回 `~/.claude` 絕對路徑。USERPROFILE / HOME 皆空則 exit 1。
    #>
    $userHome = $env:USERPROFILE
    if ([string]::IsNullOrWhiteSpace($userHome)) { $userHome = $HOME }
    if ([string]::IsNullOrWhiteSpace($userHome)) {
        Write-Error "無法判定 user home（USERPROFILE / HOME 皆空）"
        exit 1
    }
    return (Join-Path $userHome '.claude')
}

function Write-Section {
    param([Parameter(Mandatory)][string]$Title)
    Write-Host ""
    Write-Host "== $Title ==" -ForegroundColor Cyan
}

function Test-CommandExists {
    param([Parameter(Mandatory)][string]$Name)
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Sync-File {
    <#
    .SYNOPSIS
      Copy src → dst、必要時建中介目錄、直接覆蓋。
    #>
    param(
        [Parameter(Mandatory)][string]$Src,
        [Parameter(Mandatory)][string]$Dst
    )

    if (-not (Test-Path $Src)) {
        Write-Warning "  [skip ] 來源不存在：$Src"
        return
    }

    $dstDir = Split-Path -Parent $Dst
    if (-not (Test-Path $dstDir)) {
        New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
    }

    Copy-Item $Src $Dst -Force
    Write-Host "  [sync ] $Src -> $Dst"
}

function Convert-HookCommandPath {
    <#
    .SYNOPSIS
      hook command 中 `${CLAUDE_PROJECT_DIR}` 轉 global 絕對路徑。
    .DESCRIPTION
      原因：CLAUDE_PROJECT_DIR 在 global hook 觸發時指向「當前 project」，
      非 ~/.claude；若不轉換，global hook 找不到自身 script。
    #>
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string]$GlobalDir
    )

    $globalDirEsc = $GlobalDir.Replace('\', '/')
    return $Command -replace '\$\{CLAUDE_PROJECT_DIR\}', $globalDirEsc
}

# === 備份提醒 ===

function Show-BackupWarning {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host " 安裝前提醒：本腳本將**覆蓋**以下既有檔案" -ForegroundColor Yellow
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  ~/.claude/CLAUDE.md"
    Write-Host "  ~/.claude/statusline.sh"
    Write-Host "  ~/.claude/settings.json"
    Write-Host "  ~/.claude/hooks/branch-safety.ps1"
    Write-Host "  ~/.claude/hooks/file-type-guard.ps1"
    Write-Host "  ~/.claude/skills/<本 repo 列出的 skill 全部>"
    Write-Host "  ~/.claude/agents/<本 repo 列出的 agent 全部>"
    Write-Host ""
    Write-Host "  覆蓋是**直接覆蓋、不備份**。" -ForegroundColor Yellow
    Write-Host "  若 ~/.claude/ 內有手動加的內容、請先備份後再執行。" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  注意：本 repo 列出範圍**之外**的檔案不會動 — " -ForegroundColor Yellow
    Write-Host "  舊 plugin / 舊 skill 若仍存在仍會生效、可能與本 repo skill 衝突。" -ForegroundColor Yellow
    Write-Host "  建議結束後手動清理 ~/.claude/skills 與 ~/.claude/plugins 內非本 repo 內容。" -ForegroundColor Yellow
    Write-Host ""
    if ($Yes) {
        Write-Host "  -Yes flag 已帶、跳備份提醒。" -ForegroundColor Yellow
    } else {
        Write-Host "  10 秒後自動繼續；要中斷請 Ctrl+C。" -ForegroundColor Yellow
        for ($i = 10; $i -gt 0; $i--) {
            Write-Host "    $i ..." -NoNewline
            Start-Sleep -Seconds 1
            Write-Host ""
        }
    }
    Write-Host ""
}

# === Pre-flight ===

function Invoke-Preflight {
    Write-Section "Pre-flight check"

    # claude CLI
    if (-not (Test-CommandExists 'claude')) {
        Write-Error "找不到 claude CLI。請先裝 Claude Code：npm install -g @anthropic-ai/claude-code"
        exit 1
    }
    $claudeVer = (cmd /c "claude --version 2>&1") -join ''
    Write-Host "  claude   : $claudeVer"

    # git
    if (-not (Test-CommandExists 'git')) {
        Write-Error "找不到 git。請先裝 Git for Windows：https://git-scm.com/download/win"
        exit 1
    }
    Write-Host "  git      : $(git --version)"

    # jq（statusline.sh 重度依賴）
    if (-not (Test-CommandExists 'jq')) {
        Write-Error @"
找不到 jq。statusline.sh 需 jq 解 JSON。任一方式裝後重開 PowerShell：
  winget install jqlang.jq
  choco install jq
  scoop install jq
"@
        exit 1
    }
    Write-Host "  jq       : $((jq --version))"

    Write-Host "  pwsh     : $($PSVersionTable.PSVersion)"

    # pwsh 7+ 必（settings.json hook command 預設用 pwsh）
    if (-not (Test-CommandExists 'pwsh')) {
        Write-Warning "未偵測到 pwsh（PowerShell 7+）。settings.json 內 hook 用 pwsh，"
        Write-Warning "若機器只有 PS 5.x，sync 後可手動改 ~/.claude/settings.json 內 'pwsh' → 'powershell'。"
    }
}

# === Step 1: Sync repo files ===

function Invoke-SyncRepoFiles {
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$GlobalDir
    )

    Write-Section "Step 1: Sync repo files → global（直接覆蓋）"

    # 單檔 map（repo 結構 1:1 鏡像 ~/.claude/）
    $singleFiles = @(
        @{ Src = 'CLAUDE.md';                    Dst = 'CLAUDE.md' }
        @{ Src = 'statusline.sh';                Dst = 'statusline.sh' }
        @{ Src = 'hooks/branch-safety.ps1';      Dst = 'hooks/branch-safety.ps1' }
        @{ Src = 'hooks/file-type-guard.ps1';    Dst = 'hooks/file-type-guard.ps1' }
    )
    foreach ($pair in $singleFiles) {
        $src = Join-Path $RepoRoot $pair.Src
        $dst = Join-Path $GlobalDir $pair.Dst
        Sync-File -Src $src -Dst $dst
    }

    # skills/ 遞迴 sync（每個 sub-dir 一個 skill；含 SKILL.md 主檔 + 附屬檔）
    $skillsRoot = Join-Path $RepoRoot 'skills'
    if (Test-Path $skillsRoot) {
        $skillDirs = Get-ChildItem -Path $skillsRoot -Directory
        foreach ($d in $skillDirs) {
            $skillName = $d.Name
            # 遞迴 sync 此 skill 內所有檔
            $files = Get-ChildItem -Path $d.FullName -Recurse -File
            foreach ($f in $files) {
                $relPath = $f.FullName.Substring($skillsRoot.Length).TrimStart('\','/')
                $src = $f.FullName
                $dst = Join-Path $GlobalDir (Join-Path 'skills' $relPath)
                Sync-File -Src $src -Dst $dst
            }
        }
    }

    # agents/ sync（單檔模式）
    $agentsRoot = Join-Path $RepoRoot 'agents'
    if (Test-Path $agentsRoot) {
        $agentFiles = Get-ChildItem -Path $agentsRoot -File -Filter '*.md'
        foreach ($a in $agentFiles) {
            $src = $a.FullName
            $dst = Join-Path $GlobalDir (Join-Path 'agents' $a.Name)
            Sync-File -Src $src -Dst $dst
        }
    }

    # settings.json 特殊處理：轉 ${CLAUDE_PROJECT_DIR} 為絕對路徑
    $repoSettingsPath   = Join-Path $RepoRoot 'settings.json'
    $globalSettingsPath = Join-Path $GlobalDir 'settings.json'

    if (-not (Test-Path $repoSettingsPath)) {
        Write-Warning "  [skip ] repo 無 settings.json，sync 跳過"
        return
    }

    $repoSettings = Get-Content $repoSettingsPath -Raw | ConvertFrom-Json

    # hook command 內 ${CLAUDE_PROJECT_DIR} → 絕對 global 路徑
    if ($repoSettings.PSObject.Properties.Name -contains 'hooks' -and $repoSettings.hooks) {
        foreach ($eventProp in $repoSettings.hooks.PSObject.Properties) {
            foreach ($entry in $eventProp.Value) {
                foreach ($hook in $entry.hooks) {
                    if ($hook.command) {
                        $hook.command = Convert-HookCommandPath -Command $hook.command -GlobalDir $GlobalDir
                    }
                }
            }
        }
    }

    # statusLine.command 也轉
    if ($repoSettings.PSObject.Properties.Name -contains 'statusLine' -and $repoSettings.statusLine.command) {
        $repoSettings.statusLine.command = Convert-HookCommandPath -Command $repoSettings.statusLine.command -GlobalDir $GlobalDir
    }

    $repoSettings | ConvertTo-Json -Depth 10 | Set-Content $globalSettingsPath -Encoding UTF8
    Write-Host "  [over ] $globalSettingsPath（純覆蓋；路徑已轉絕對）"
}

# === main ===

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
    Write-Error "未在 git repo 內。請 cd 進此 repo 後再執行。"
    exit 1
}
$repoRoot = $repoRoot.Trim()
$globalDir = Get-GlobalClaudeDir

if (-not (Test-Path $globalDir)) {
    New-Item -ItemType Directory -Force -Path $globalDir | Out-Null
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " Offline skill pack — setup.ps1" -ForegroundColor Green
Write-Host " 全 standalone 安裝（純覆蓋、不備份）" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Repo  : $repoRoot"
Write-Host "  Global: $globalDir"

Show-BackupWarning

if (-not $SkipPrereqCheck) {
    Invoke-Preflight
}

Invoke-SyncRepoFiles -RepoRoot $repoRoot -GlobalDir $globalDir

# === Summary ===
Write-Section "Done"
Write-Host ""
Write-Host "✔ CLAUDE.md / statusline.sh / 2 hooks 已覆蓋至 $globalDir"
Write-Host "✔ skills/ 全套已 sync"
Write-Host "✔ agents/ 全套已 sync"
Write-Host "✔ settings.json 已覆蓋（hook 路徑已轉絕對）"
Write-Host ""
Write-Host "後續手動步驟：" -ForegroundColor Yellow
Write-Host "  1. 開新 claude session（既有 session 不會載新 skill）" -ForegroundColor Yellow
Write-Host "  2. 跑 /help 應見 /dev-workflow / brainstorm / write-plan ... 等指令" -ForegroundColor Yellow
Write-Host "  3. 試「我想加個小功能」確認 dev-workflow 自動載入" -ForegroundColor Yellow
Write-Host ""
Write-Host "選用：MySQL MCP（含 DB 密碼、不入腳本）。如需 mysql MCP，貼下行並改 <your_password>：" -ForegroundColor Yellow
Write-Host '  claude mcp add mysql -s user -e MYSQL_HOST=127.0.0.1 -e MYSQL_PORT=3306 -e MYSQL_USER=mcp_readonly -e MYSQL_PASS=<your_password> -e ALLOW_INSERT_OPERATION=false -e ALLOW_UPDATE_OPERATION=false -e ALLOW_DELETE_OPERATION=false -- npx -y `@benborla29/mcp-server-mysql' -ForegroundColor Yellow
Write-Host ""
Write-Host "提醒：若 ~/.claude/skills 或 ~/.claude/plugins 內有舊 plugin（superpowers / gstack / ECC）" -ForegroundColor Yellow
Write-Host "  建議手動清，避免與本 repo skill 衝突：" -ForegroundColor Yellow
Write-Host "    Remove-Item -Recurse ~/.claude/plugins/marketplaces/superpowers-marketplace" -ForegroundColor Yellow
Write-Host "    Remove-Item -Recurse ~/.claude/skills/<plugin 殘留>" -ForegroundColor Yellow
Write-Host ""
