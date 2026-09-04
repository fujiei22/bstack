#!/usr/bin/env pwsh
<#
.SYNOPSIS
  bstack 一站式安裝：前置檢查 → 清舊 setup.ps1 副本 → 裝 plugin → 個人偏好 → 驗證。每一步都問、都能跳過。

.DESCRIPTION
  五步，逐步問使用者：
    1. 前置檢查   pwsh 7+ / claude CLI / git（缺了就停，告訴你怎麼裝）
    2. 清舊副本   呼叫 extras.ps1 -Migrate（舊 setup.ps1 留在 ~/.claude/ 的 skill / hook / CLAUDE.md，搬進備份目錄不刪）
    3. 裝 plugin  問層級：[U] 使用者層級 / [P] 目前專案 / [T] 只印試用指令 / [S] 跳過；
                  marketplace 來源問 [G] GitHub fujiei22/bstack（推薦）/ [L] 本 clone 路徑
    4. 個人偏好   呼叫 extras.ps1 選單（statusLine / permissions / env / mcp 逐項選層級，可全跳）
    5. 驗證       claude plugin list 應列出 bstack@bstack；提醒重開 Claude Code 後打 /devwork
  本腳本自己不寫任何檔：寫入都交給 extras.ps1（有備份、可 -Uninstall）與 claude CLI（可 /plugin uninstall）。

.PARAMETER Yes        非互動：第 2 步自動 y、第 3 步用 -Scope、第 4 步跳過
.PARAMETER Scope      user | project（-Yes 時必填；互動時當預設選項）
.PARAMETER Source     github（預設）| local：marketplace 來源
.PARAMETER SkipMigrate / SkipExtras   跳過該步
.EXAMPLE
  pwsh -File scripts/install.ps1
  pwsh -File scripts/install.ps1 -Yes -Scope user
  pwsh -File scripts/install.ps1 -WhatIf          # 只印會做的事
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$Yes,
    [ValidateSet('user', 'project')][string]$Scope,
    [ValidateSet('github', 'local')][string]$Source = 'github',
    [switch]$SkipMigrate,
    [switch]$SkipExtras
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$Extras = Join-Path $PSScriptRoot 'extras.ps1'
$GithubRepo = 'fujiei22/bstack'
$DryRun = [bool]$WhatIfPreference

function Step([int]$n, [string]$title) { Write-Host ""; Write-Host "== 步驟 $n/5：$title ==" -ForegroundColor Cyan }
function Ask {
    <# 問一個單鍵選項；-Yes 時直接回預設。回傳大寫字母。 #>
    param([string]$prompt, [string]$default)
    if ($Yes) { return $default.ToUpper() }
    $ans = Read-Host "$prompt（預設 $default）"
    if ([string]::IsNullOrWhiteSpace($ans)) { return $default.ToUpper() }
    return $ans.Trim().ToUpper()
}
function Run-Claude {
    <# 跑 claude CLI；-WhatIf 只印。回傳 exit code。 #>
    param([string[]]$args_)
    $cmd = "claude $($args_ -join ' ')"
    if ($DryRun) { Write-Host "  [whatif] $cmd"; return 0 }
    Write-Host "  > $cmd"
    & claude @args_
    return $LASTEXITCODE
}

if ($Yes -and -not $Scope) { throw '-Yes 需搭配 -Scope user|project' }

# ── 1. 前置檢查 ──────────────────────────────────────────────────────────────
Step 1 '前置檢查'
$ok = $true
if ($PSVersionTable.PSVersion.Major -lt 7) {
    Write-Host "  ✘ 需要 pwsh 7+（目前 $($PSVersionTable.PSVersion)）。Windows：winget install Microsoft.PowerShell；macOS：brew install powershell" -ForegroundColor Red; $ok = $false
} else { Write-Host "  ✔ pwsh $($PSVersionTable.PSVersion)" }
if (Get-Command claude -ErrorAction SilentlyContinue) { Write-Host "  ✔ claude CLI：$((claude --version 2>$null | Select-Object -First 1))" }
else { Write-Host "  ✘ 找不到 claude CLI（不在 PATH）。先裝 Claude Code 再跑本腳本。" -ForegroundColor Red; $ok = $false }
if (Get-Command git -ErrorAction SilentlyContinue) { Write-Host "  ✔ git" } else { Write-Host "  ✘ 找不到 git" -ForegroundColor Red; $ok = $false }
if (-not (Test-Path -LiteralPath $Extras)) { Write-Host "  ✘ 找不到 $Extras，請在 clone 的 repo 內跑" -ForegroundColor Red; $ok = $false }
if (-not $ok) { exit 1 }
Write-Host "  提醒：hook 需要 pwsh 在**啟動 Claude Code 的環境** PATH 內；沒有時 hook 會靜默失效。"

# ── 2. 清舊副本 ──────────────────────────────────────────────────────────────
Step 2 '清舊 setup.ps1 副本'
if ($SkipMigrate) { Write-Host '  跳過（-SkipMigrate）' }
else {
    Write-Host "  舊版把 skill / hook / CLAUDE.md 複製進 ~/.claude/，會遮蔽 plugin 版、讓自動攔截復活。"
    Write-Host "  接下來由 extras.ps1 -Migrate 列出並問你；有東西會搬進 ~/.claude/bstack-migrate-bak-<時間>/，不直接刪。"
    $a = @('-NoProfile', '-File', $Extras, '-Migrate'); if ($Yes) { $a += '-Yes' }; if ($DryRun) { $a += '-WhatIf' }
    & pwsh @a
    if ($LASTEXITCODE -ne 0) { Write-Host "  extras.ps1 -Migrate 回傳 $LASTEXITCODE，先停在這裡" -ForegroundColor Red; exit 1 }
}

# ── 3. 裝 plugin ─────────────────────────────────────────────────────────────
Step 3 '裝 plugin'
Write-Host "  [U] 使用者層級：所有專案都能用 /devwork；兩支 hook 在你所有專案生效"
Write-Host "  [P] 目前專案：只在 $((Get-Location).Path) 生效（寫進該專案 .claude/settings.json）"
Write-Host "  [T] 不安裝，只印試用指令（claude --plugin-dir）"
Write-Host "  [S] 跳過"
$defaultScope = if ($Scope) { $Scope.Substring(0, 1) } else { 'U' }
$choice = Ask '  選哪個？[U/P/T/S]' $defaultScope
$installed = $false
switch ($choice) {
    'T' { Write-Host "  試用：claude --plugin-dir `"$RepoRoot`"（只在那個 session 生效）" }
    'S' { Write-Host '  跳過' }
    { $_ -in 'U', 'P' } {
        $scopeName = if ($choice -eq 'U') { 'user' } else { 'project' }
        $src = if ($Source -eq 'local') { 'L' } else { 'G' }
        if (-not $Yes) { $src = Ask "  marketplace 來源：[G] GitHub $GithubRepo（推薦，之後 /plugin marketplace update 可更新）/ [L] 本 clone 路徑 $RepoRoot" $src }
        $srcArg = if ($src -eq 'L') { $RepoRoot } else { $GithubRepo }
        $have = @(claude plugin marketplace list 2>$null | Select-String -Pattern '^\s*(❯\s*)?bstack\s*$')
        if ($have.Count) { Write-Host "  marketplace bstack 已存在，略過 add" }
        else { if ((Run-Claude @('plugin', 'marketplace', 'add', $srcArg)) -ne 0) { Write-Host "  marketplace add 失敗" -ForegroundColor Red; exit 1 } }
        if ((Run-Claude @('plugin', 'install', 'bstack@bstack', '-s', $scopeName)) -ne 0) { Write-Host "  plugin install 失敗" -ForegroundColor Red; exit 1 }
        $installed = $true
        if ($scopeName -eq 'project') { Write-Host "  提示：templates/project-settings.json 還帶一份唯讀權限白名單，下一步選 permissions [P] 就會合進來。" }
    }
    default { Write-Host "  不認得「$choice」，跳過" }
}

# ── 4. 個人偏好 ──────────────────────────────────────────────────────────────
Step 4 '個人偏好（statusLine / permissions / env / mcp）'
if ($SkipExtras -or $Yes) { Write-Host "  跳過（$(if ($Yes) { '-Yes 非互動' } else { '-SkipExtras' })）。之後想加：pwsh -File scripts/extras.ps1" }
else {
    Write-Host "  這四項 plugin 帶不了，每項各問一次要裝到哪一層，都能跳過。"
    $a = @('-NoProfile', '-File', $Extras); if ($DryRun) { $a += '-WhatIf' }
    & pwsh @a
}

# ── 5. 驗證 ──────────────────────────────────────────────────────────────────
Step 5 '驗證'
if ($installed -and -not $DryRun) {
    $list = claude plugin list 2>$null | Out-String
    if ($list -match 'bstack@bstack') { Write-Host "  ✔ claude plugin list 有 bstack@bstack" } else { Write-Host "  ✘ claude plugin list 找不到 bstack@bstack，請看上面 install 的輸出" -ForegroundColor Red }
}
Write-Host ""
Write-Host "接下來：" -ForegroundColor Green
Write-Host "  1. 重開 Claude Code（既有 session 不會載入新 plugin）"
Write-Host "  2. 輸入 /devwork，第一行應是 [bstack devwork · plugin] 已載入守則…"
Write-Host "  3. 若接著出現 [已載入 dev-workflow] 一行 → 舊副本還在遮蔽，重跑 pwsh -File scripts/extras.ps1 -Migrate"
Write-Host "  反悔：claude plugin uninstall bstack@bstack；extras 加的東西用 pwsh -File scripts/extras.ps1 -Uninstall"
