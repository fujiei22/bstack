#!/usr/bin/env pwsh
<#
.SYNOPSIS
  將此 repo 的 Claude Code 設定一鍵同步至 global `~/.claude/`。

.DESCRIPTION
  覆蓋項目（含備份）：
    - CLAUDE.md
    - .claude/hooks/branch-safety.ps1
    - statusline.sh
    - db-access/SKILL.md          -> ~/.claude/skills/db-access/SKILL.md
    - git-workflow/SKILL.md       -> ~/.claude/skills/git-workflow/SKILL.md

  合併項目：
    - .claude/settings.json       -> 與 ~/.claude/settings.json 合併
      * `hooks.*` event：repo 覆蓋 global（同 event 整段換）
      * 其餘 key（statusLine / enabledPlugins / theme / tui / 通知 等）：保留 global 原值
      * hook command 內 `${CLAUDE_PROJECT_DIR}` 轉成絕對路徑（global 環境無 PROJECT_DIR）

  清理項目：
    - ~/.claude/hooks/ 內非 repo 同步來源的孤兒檔（settings.json 已不參照）→ 備份後刪
    - skills/ 與 runtime data（projects / sessions / history / cache 等）不動

  原檔備份字尾：`.bak.<yyyyMMdd-HHmmss>`，與目標檔同層。

.NOTES
  須在 repo 內執行（用 `git rev-parse --show-toplevel` 取 repo root）。
  Windows + pwsh 7+。
#>

$ErrorActionPreference = 'Stop'

# 修中文 console 亂碼（PowerShell 預設 codepage 非 UTF-8）
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Get-GlobalClaudeDir {
    <#
    .SYNOPSIS
      回傳 ~/.claude 絕對路徑；USERPROFILE 不存在則 fallback $HOME。
    .DESCRIPTION
      原因：腳本後段多處用 $globalDir，先前曾遇單一 $globalDir 變數被
      意外清空導致 Join-Path null 錯。改用 func 每次重算保證非 null。
    #>
    $userHome = $env:USERPROFILE
    if ([string]::IsNullOrWhiteSpace($userHome)) { $userHome = $HOME }
    if ([string]::IsNullOrWhiteSpace($userHome)) {
        Write-Error "無法判定 user home（USERPROFILE / HOME 皆空）"
        exit 1
    }
    return (Join-Path $userHome '.claude')
}

# === 路徑 ===
$repoRoot = (git rev-parse --show-toplevel 2>$null)
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
    Write-Error "未在 git repo 內。請 cd 進此 repo 後再執行。"
    exit 1
}
$repoRoot = $repoRoot.Trim()

$script:globalDir = Get-GlobalClaudeDir
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

if (-not (Test-Path $globalDir)) {
    New-Item -ItemType Directory -Force -Path $globalDir | Out-Null
}

Write-Host "== Sync repo -> global =="
Write-Host "  Repo  : $repoRoot"
Write-Host "  Global: $globalDir"
Write-Host "  Backup: *.bak.$timestamp"
Write-Host ""

# === 公用 func ===

function Backup-IfExists {
    <#
    .SYNOPSIS
      若目標檔存在則備份（同層加 .bak.<timestamp> 字尾）。
    .DESCRIPTION
      原因：避免 sync 把使用者本機改動覆蓋掉而無回退路徑。
    #>
    param([Parameter(Mandatory)][string]$Path)

    if (Test-Path $Path) {
        $bak = "$Path.bak.$timestamp"
        Copy-Item $Path $bak -Force
        Write-Host "  [backup] $bak"
    }
}

function Sync-File {
    <#
    .SYNOPSIS
      Copy repo file 到 global 對應位置，必要時建中介目錄並備份目標。
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

    Backup-IfExists $Dst
    Copy-Item $Src $Dst -Force
    Write-Host "  [sync ] $Src -> $Dst"
}

function Convert-HookCommandPath {
    <#
    .SYNOPSIS
      把 hook command 中的 `${CLAUDE_PROJECT_DIR}` 轉為 global 絕對路徑。
    .DESCRIPTION
      原因：CLAUDE_PROJECT_DIR 在 global hook 觸發時指向「當前 project」，
      非 ~/.claude；若不轉換，global hook 找不到自身 script。
    #>
    param([Parameter(Mandatory)][string]$Command)

    $globalDirEsc = $globalDir.Replace('\', '/')
    return $Command -replace '\$\{CLAUDE_PROJECT_DIR\}/?\.claude', $globalDirEsc `
                    -replace '\$\{CLAUDE_PROJECT_DIR\}', $globalDirEsc
}

# === 1-4. 直接覆蓋的檔 ===

$fileMap = @(
    @{ Src = 'CLAUDE.md';                          Dst = 'CLAUDE.md' }
    @{ Src = '.claude/hooks/branch-safety.ps1';    Dst = 'hooks/branch-safety.ps1' }
    @{ Src = 'statusline.sh';                      Dst = 'statusline.sh' }
    @{ Src = 'db-access/SKILL.md';                 Dst = 'skills/db-access/SKILL.md' }
    @{ Src = 'git-workflow/SKILL.md';              Dst = 'skills/git-workflow/SKILL.md' }
)

foreach ($pair in $fileMap) {
    $src = Join-Path $repoRoot $pair.Src
    $dst = Join-Path $globalDir $pair.Dst
    Sync-File -Src $src -Dst $dst
}

# === 5. settings.json merge ===

$repoSettingsPath = Join-Path $repoRoot '.claude/settings.json'
$globalSettingsPath = Join-Path $globalDir 'settings.json'

if (-not (Test-Path $repoSettingsPath)) {
    Write-Warning "  [skip ] repo 無 .claude/settings.json，settings 合併略過"
}
else {
    Backup-IfExists $globalSettingsPath

    # 讀 global（若無則空物件）
    $globalSettings = if (Test-Path $globalSettingsPath) {
        Get-Content $globalSettingsPath -Raw | ConvertFrom-Json
    } else {
        [pscustomobject]@{}
    }

    $repoSettings = Get-Content $repoSettingsPath -Raw | ConvertFrom-Json

    # 確保 global.hooks 存在
    if (-not $globalSettings.PSObject.Properties.Name -contains 'hooks') {
        $globalSettings | Add-Member -NotePropertyName hooks `
                                     -NotePropertyValue ([pscustomobject]@{}) `
                                     -Force
    }
    if ($null -eq $globalSettings.hooks) {
        $globalSettings.hooks = [pscustomobject]@{}
    }

    # 對每 repo hook event 進行覆蓋（並轉路徑）
    foreach ($eventProp in $repoSettings.hooks.PSObject.Properties) {
        $eventName = $eventProp.Name
        $eventValue = $eventProp.Value

        foreach ($entry in $eventValue) {
            foreach ($hook in $entry.hooks) {
                if ($hook.command) {
                    $hook.command = Convert-HookCommandPath $hook.command
                }
            }
        }

        $globalSettings.hooks | Add-Member -NotePropertyName $eventName `
                                           -NotePropertyValue $eventValue `
                                           -Force
    }

    # 寫回。Depth 10 足以覆蓋 hook 巢狀層級。
    $globalSettings | ConvertTo-Json -Depth 10 | Set-Content $globalSettingsPath -Encoding UTF8
    Write-Host "  [merge] $globalSettingsPath（hooks 覆蓋；其餘 key 保留）"
}

# === 6. 清理 hooks/ 孤兒檔 ===
# repo 同步進 global 的 hook 檔白名單（檔名）。
# 白名單外的 hook 檔視為「settings.json 已不參照」的孤兒 → 備份後刪。
$repoHookWhitelist = @('branch-safety.ps1')

# 防禦：若 $script:globalDir 被前段意外清空，重算一次保證非 null。
if ([string]::IsNullOrWhiteSpace($script:globalDir)) {
    $script:globalDir = Get-GlobalClaudeDir
}
$globalHooksDir = Join-Path $script:globalDir 'hooks'

if (Test-Path $globalHooksDir) {
    Get-ChildItem -File $globalHooksDir | ForEach-Object {
        # 跳過備份檔本身（避免循環產生 .bak.bak）
        if ($_.Name -match '\.bak\.') { return }

        if ($_.Name -notin $repoHookWhitelist) {
            Backup-IfExists $_.FullName
            Remove-Item $_.FullName -Force
            Write-Host "  [clean] $($_.FullName)"
        }
    }
}

Write-Host ""
Write-Host "Done."
