#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Superpowers + Caveman + Playwright MCP + gstack + 本 repo 設定 一鍵安裝至 global `~/.claude/`。

.DESCRIPTION
  動作（idempotent；偵測已裝者跳過）：
    1. Pre-flight：claude CLI / git / bash / jq 檢查；pwsh 缺則 warn
    2. Sync 本 repo → global（**直接覆蓋，不備份**）。repo 結構 1:1 鏡像 ~/.claude/：
         CLAUDE.md                       → CLAUDE.md
         settings.json                   → settings.json（轉 `${CLAUDE_PROJECT_DIR}` 為絕對路徑）
         statusline.sh                   → statusline.sh
         hooks/branch-safety.ps1         → hooks/branch-safety.ps1
         skills/db-access/SKILL.md       → skills/db-access/SKILL.md
         skills/git-workflow/SKILL.md    → skills/git-workflow/SKILL.md
    3. Superpowers marketplace add：
         git clone obra/superpowers-marketplace → ~/.claude/plugins/marketplaces/superpowers-marketplace
         寫 known_marketplaces.json
    4. Caveman marketplace add：
         git clone JuliusBrussee/caveman → ~/.claude/plugins/marketplaces/caveman
         寫 known_marketplaces.json
    5. Playwright MCP（user scope）：
         claude mcp add playwright -s user -- npx -y `@playwright/mcp@latest
         （mysql MCP 含 DB 密碼，不入腳本；結尾印手動指令）
    6. gstack 安裝：
         git clone obra/gstack → ~/.claude/skills/gstack
         bash ./setup --prefix

  plugin install（superpowers / caveman）由 user 在 claude REPL 內手動執行
  （`/plugin install` 涉版本/commit 解析，REPL 處理較穩）。

.NOTES
  Windows + pwsh 7+。需 Git Bash（gstack setup 為 shell script）。
  須在 repo 內執行（用 `git rev-parse --show-toplevel` 取 repo root）。

.PARAMETER SkipPrereqCheck
  跳過 pre-flight 版本檢查（debug 用）。
#>

[CmdletBinding()]
param(
    [switch]$SkipPrereqCheck
)

$ErrorActionPreference = 'Stop'

# 修中文 console 亂碼（PowerShell 預設 codepage 非 UTF-8）
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# === 公用 func ===

function Get-GlobalClaudeDir {
    <#
    .SYNOPSIS
      回傳 ~/.claude 絕對路徑；USERPROFILE 不存在則 fallback $HOME。
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

function Sync-File {
    <#
    .SYNOPSIS
      Copy repo file → global 對應位置，必要時建中介目錄；直接覆蓋（不備份）。
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

function Test-CommandExists {
    param([Parameter(Mandatory)][string]$Name)
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

# === Pre-flight ===

function Invoke-Preflight {
    Write-Section "Pre-flight check"

    # claude CLI
    if (-not (Test-CommandExists 'claude')) {
        Write-Error "找不到 claude CLI。請先裝 Claude Code：npm install -g @anthropic-ai/claude-code"
        exit 1
    }
    $claudeVer = (claude --version 2>&1) -join ''
    Write-Host "  claude   : $claudeVer"

    # git
    if (-not (Test-CommandExists 'git')) {
        Write-Error "找不到 git。請先裝 Git for Windows：https://git-scm.com/download/win"
        exit 1
    }
    Write-Host "  git      : $(git --version)"

    # bash（gstack setup 需）
    if (-not (Test-CommandExists 'bash')) {
        Write-Error "找不到 bash（gstack setup 為 shell script，需 Git Bash）。請裝 Git for Windows 並重開 PowerShell。"
        exit 1
    }
    Write-Host "  bash     : $((bash --version | Select-Object -First 1))"

    # jq（statusline.sh 重度依賴）
    if (-not (Test-CommandExists 'jq')) {
        Write-Error @"
找不到 jq。statusline.sh 需 jq 解 JSON。請任一方式裝後重開 PowerShell：
  winget install jqlang.jq
  choco install jq
  scoop install jq
"@
        exit 1
    }
    Write-Host "  jq       : $((jq --version))"

    Write-Host "  pwsh     : $($PSVersionTable.PSVersion)"

    # repo hook command 預設用 `pwsh`（PowerShell 7+）。若本機只有 PS 5.x，
    # synced hook 觸發時會 "command not found" → 提示 user。
    if (-not (Test-CommandExists 'pwsh')) {
        Write-Warning "未偵測到 pwsh（PowerShell 7+）。repo hook command 用 pwsh，"
        Write-Warning "若想保穩，sync 後手動把 global settings.json 內 hook 的 'pwsh' 改 'powershell'。"
    }
}

# === Step 1: Sync repo files ===

function Invoke-SyncRepoFiles {
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$GlobalDir
    )

    Write-Section "Step 1: Sync repo files → global（直接覆蓋）"

    # repo 結構鏡像 ~/.claude/，路徑 1:1 對應
    $fileMap = @(
        @{ Src = 'CLAUDE.md';                  Dst = 'CLAUDE.md' }
        @{ Src = 'hooks/branch-safety.ps1';    Dst = 'hooks/branch-safety.ps1' }
        @{ Src = 'statusline.sh';              Dst = 'statusline.sh' }
        @{ Src = 'skills/db-access/SKILL.md';  Dst = 'skills/db-access/SKILL.md' }
        @{ Src = 'skills/git-workflow/SKILL.md'; Dst = 'skills/git-workflow/SKILL.md' }
    )

    foreach ($pair in $fileMap) {
        $src = Join-Path $RepoRoot $pair.Src
        $dst = Join-Path $GlobalDir $pair.Dst
        Sync-File -Src $src -Dst $dst
    }

    # settings.json：純覆蓋（不 merge），但轉路徑
    $repoSettingsPath   = Join-Path $RepoRoot 'settings.json'
    $globalSettingsPath = Join-Path $GlobalDir 'settings.json'

    if (-not (Test-Path $repoSettingsPath)) {
        Write-Warning "  [skip ] repo 無 settings.json，settings sync 略過"
        return
    }

    $repoSettings = Get-Content $repoSettingsPath -Raw | ConvertFrom-Json

    # hook command 內 ${CLAUDE_PROJECT_DIR} 轉絕對 global 路徑
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

# === Step 2/3: Marketplace add（通用） ===

function Invoke-MarketplaceAdd {
    <#
    .SYNOPSIS
      註冊 Claude Code plugin marketplace：clone repo + 寫 known_marketplaces.json。
    .DESCRIPTION
      idempotent：目錄已存在跳 clone；known_marketplaces.json 已含 key 跳註冊。
    #>
    param(
        [Parameter(Mandatory)][string]$GlobalDir,
        [Parameter(Mandatory)][string]$Key,           # marketplace key（e.g. superpowers-marketplace / caveman）
        [Parameter(Mandatory)][string]$RepoSlug,      # github owner/repo
        [Parameter(Mandatory)][string]$DisplayName    # log 顯示名
    )

    $marketplaceDir = Join-Path $GlobalDir "plugins/marketplaces/$Key"
    $knownMpPath    = Join-Path $GlobalDir 'plugins/known_marketplaces.json'
    $repoUrl        = "https://github.com/$RepoSlug.git"

    # clone
    if (Test-Path $marketplaceDir) {
        Write-Host "  [skip ] marketplace 目錄已存在：$marketplaceDir（跳 clone；如需更新跑 git pull）"
    }
    else {
        $parent = Split-Path -Parent $marketplaceDir
        if (-not (Test-Path $parent)) {
            New-Item -ItemType Directory -Force -Path $parent | Out-Null
        }
        Write-Host "  [clone] $repoUrl → $marketplaceDir"
        git clone --depth 1 $repoUrl $marketplaceDir 2>&1 | ForEach-Object { Write-Host "    $_" }
        if ($LASTEXITCODE -ne 0) {
            Write-Error "git clone 失敗：$repoUrl"
            exit 1
        }
    }

    # known_marketplaces.json 註冊
    $knownMpDir = Split-Path -Parent $knownMpPath
    if (-not (Test-Path $knownMpDir)) {
        New-Item -ItemType Directory -Force -Path $knownMpDir | Out-Null
    }

    $knownMp = if (Test-Path $knownMpPath) {
        Get-Content $knownMpPath -Raw | ConvertFrom-Json
    } else {
        [pscustomobject]@{}
    }

    if ($knownMp.PSObject.Properties.Name -contains $Key) {
        Write-Host "  [skip ] known_marketplaces.json 已含 $Key"
    }
    else {
        $entry = [pscustomobject]@{
            source = [pscustomobject]@{
                source = 'github'
                repo   = $RepoSlug
            }
            installLocation = $marketplaceDir
            lastUpdated     = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
        }

        $knownMp | Add-Member -NotePropertyName $Key -NotePropertyValue $entry -Force
        $knownMp | ConvertTo-Json -Depth 10 | Set-Content $knownMpPath -Encoding UTF8
        Write-Host "  [reg  ] $knownMpPath ← $Key"
    }
}

# === Step 4: Playwright MCP ===

function Invoke-PlaywrightMcpInstall {
    Write-Section "Step 4: Playwright MCP install (user scope)"

    # idempotent 偵測
    & claude mcp get playwright *>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [skip ] playwright MCP 已存在（user scope）"
        return
    }

    Write-Host "  [add  ] claude mcp add playwright -s user -- npx -y `@playwright/mcp@latest"
    & claude mcp add playwright -s user -- npx -y '@playwright/mcp@latest'
    if ($LASTEXITCODE -ne 0) {
        Write-Error "claude mcp add playwright 失敗（exit $LASTEXITCODE）"
        exit 1
    }
}

# === Step 5: gstack ===

function Invoke-GstackInstall {
    param(
        [Parameter(Mandatory)][string]$GlobalDir
    )

    Write-Section "Step 5: gstack install (--prefix)"

    $skillsDir  = Join-Path $GlobalDir 'skills'
    $gstackDir  = Join-Path $skillsDir 'gstack'
    $gstackRepo = 'https://github.com/obra/gstack.git'

    if (-not (Test-Path $skillsDir)) {
        New-Item -ItemType Directory -Force -Path $skillsDir | Out-Null
    }

    if (Test-Path $gstackDir) {
        Write-Host "  [skip ] $gstackDir 已存在（跳 clone；如需更新跑 git pull）"
    }
    else {
        Write-Host "  [clone] $gstackRepo → $gstackDir"
        git clone --single-branch --depth 1 $gstackRepo $gstackDir 2>&1 | ForEach-Object { Write-Host "    $_" }
        if ($LASTEXITCODE -ne 0) {
            Write-Error "git clone 失敗：$gstackRepo"
            exit 1
        }
    }

    Push-Location $gstackDir
    try {
        if (-not (Test-Path './setup')) {
            Write-Error "gstack repo 內找不到 setup 腳本：$gstackDir/setup"
            exit 1
        }
        Write-Host "  [run  ] bash ./setup --prefix"
        bash ./setup --prefix 2>&1 | ForEach-Object { Write-Host "    $_" }
        if ($LASTEXITCODE -ne 0) {
            Write-Error "gstack setup 失敗（exit $LASTEXITCODE）"
            exit 1
        }
    }
    finally {
        Pop-Location
    }
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
Write-Host " Superpowers + Caveman + Playwright + gstack" -ForegroundColor Green
Write-Host " 一鍵安裝（純覆蓋，不備份）" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Repo  : $repoRoot"
Write-Host "  Global: $globalDir"

if (-not $SkipPrereqCheck) {
    Invoke-Preflight
}

Invoke-SyncRepoFiles -RepoRoot $repoRoot -GlobalDir $globalDir

Write-Section "Step 2: Superpowers marketplace add"
Invoke-MarketplaceAdd -GlobalDir $globalDir `
                      -Key 'superpowers-marketplace' `
                      -RepoSlug 'obra/superpowers-marketplace' `
                      -DisplayName 'Superpowers'

Write-Section "Step 3: Caveman marketplace add"
Invoke-MarketplaceAdd -GlobalDir $globalDir `
                      -Key 'caveman' `
                      -RepoSlug 'JuliusBrussee/caveman' `
                      -DisplayName 'Caveman'

Invoke-PlaywrightMcpInstall
Invoke-GstackInstall -GlobalDir $globalDir

# === Summary ===
Write-Section "Done"
Write-Host ""
Write-Host "✔ Repo 設定已覆蓋至 $globalDir"
Write-Host "✔ Superpowers marketplace 已註冊（obra/superpowers-marketplace）"
Write-Host "✔ Caveman marketplace 已註冊（JuliusBrussee/caveman）"
Write-Host "✔ Playwright MCP 已註冊（user scope）"
Write-Host "✔ gstack 已 clone + setup --prefix 完成"
Write-Host ""
Write-Host "後續手動步驟（在 Claude Code REPL 內跑）：" -ForegroundColor Yellow
Write-Host "  1. claude" -ForegroundColor Yellow
Write-Host "  2. /plugin install superpowers@superpowers-marketplace" -ForegroundColor Yellow
Write-Host "  3. /plugin install caveman@caveman" -ForegroundColor Yellow
Write-Host "  4. /exit 後重開 claude（讓 plugin 完全載入）" -ForegroundColor Yellow
Write-Host ""
Write-Host "選用：MySQL MCP（含 DB 密碼，不入腳本）。如需用 mysql MCP，貼下行並改 <your_password>：" -ForegroundColor Yellow
Write-Host '  claude mcp add mysql -s user -e MYSQL_HOST=127.0.0.1 -e MYSQL_PORT=3306 -e MYSQL_USER=mcp_readonly -e MYSQL_PASS=<your_password> -e ALLOW_INSERT_OPERATION=false -e ALLOW_UPDATE_OPERATION=false -e ALLOW_DELETE_OPERATION=false -- npx -y `@benborla29/mcp-server-mysql' -ForegroundColor Yellow
Write-Host ""
Write-Host "驗證：開新 session 跑 /help 應見 /superpowers:* 與 /gstack-* 指令；claude mcp list 應見 playwright connected。"
Write-Host ""
