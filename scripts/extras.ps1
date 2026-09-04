#!/usr/bin/env pwsh
<#
.SYNOPSIS
  bstack 的「plugin 帶不了」四項偏好選單：statusLine / permissions / env / mcp。

.DESCRIPTION
  plugin 核心（skills / agents / hooks / 守則）走 `/plugin install bstack@bstack`，本腳本不碰。
  這裡只處理 Claude Code plugin 規格帶不了的個人偏好（plugin 的 settings.json 只認 agent /
  subagentStatusLine 兩個 key），每項各問一次要裝到哪一層：
    [U] 使用者層級  ~/.claude/settings.json（mcp 項：claude mcp add --scope user）
    [P] 目前專案    <cwd>/.claude/settings.json（mcp 項：專案根 .mcp.json，**會進 git、隊友共用**）
    [S] 跳過（預設；不選就什麼都不寫）
  merge 只加本項 key、其他原封保留；每次執行對每個動到的檔備份一次（同一個時間戳）；
  manifest 只記「真的新增的 key」，-Uninstall 只拆那些、使用者本來就有的不碰。
  manifest 住 ~/.claude/bstack-extras.json——這是本腳本唯一主動寫進 ~/.claude/ 的檔。
  請從 clone 的 repo 跑（statusLine 會指到 extras/statusline.sh 的絕對路徑）；從 plugin 快取跑會警告。

.PARAMETER Yes        非互動：搭 -Items 與 -Scope 直接套用；搭 -Migrate 則不問直接刪
.PARAMETER Items      statusLine | permissions | env | mcp（可多個）
.PARAMETER Scope      user | project
.PARAMETER Uninstall  依 manifest 移除自己加過的 key / MCP
.PARAMETER Migrate    清舊 setup.ps1 sync 進 ~/.claude/ 的副本（預設只列，-Yes 才刪）
.PARAMETER SelfTest   在 temp 偽造 HOME 跑全套斷言（不碰真實設定）

.EXAMPLE
  pwsh -File scripts/extras.ps1
  pwsh -File scripts/extras.ps1 -Yes -Items statusLine,env -Scope user
  pwsh -File scripts/extras.ps1 -Uninstall
  pwsh -File scripts/extras.ps1 -Migrate
  pwsh -File scripts/extras.ps1 -SelfTest
#>
[CmdletBinding(SupportsShouldProcess, DefaultParameterSetName = 'Menu')]
param(
    [Parameter(ParameterSetName = 'Menu')]
    [Parameter(ParameterSetName = 'Batch')]
    [Parameter(ParameterSetName = 'Migrate')]
    [switch]$Yes,

    [Parameter(ParameterSetName = 'Batch', Mandatory)]
    [ValidateSet('statusLine', 'permissions', 'env', 'mcp')]
    [string[]]$Items,

    [Parameter(ParameterSetName = 'Batch', Mandatory)]
    [ValidateSet('user', 'project')]
    [string]$Scope,

    [Parameter(ParameterSetName = 'Uninstall', Mandatory)][switch]$Uninstall,
    [Parameter(ParameterSetName = 'Migrate', Mandatory)][switch]$Migrate,
    [Parameter(ParameterSetName = 'SelfTest', Mandatory)][switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$RunStamp = Get-Date -Format yyyyMMddHHmmss      # 整支腳本共用；同檔只備份一次
$script:BackedUp = @{}
$script:Written = @()                             # 結尾摘要用：@{item; scope; file}

# === 路徑 ===

function Get-ClaudeHome {
    <#
    .SYNOPSIS 回 ~/.claude 絕對路徑；BSTACK_CLAUDE_HOME 存在時覆寫（SelfTest 用，一般路徑會印黃字）。
    #>
    if ($env:BSTACK_CLAUDE_HOME) { return $env:BSTACK_CLAUDE_HOME }
    $h = $env:USERPROFILE; if (-not $h) { $h = $HOME }
    return (Join-Path $h '.claude')
}
function Get-SettingsPath([string]$scope) {
    if ($scope -eq 'user') { return (Join-Path (Get-ClaudeHome) 'settings.json') }
    return (Join-Path (Get-Location).Path '.claude/settings.json')
}
function Get-ManifestPath { Join-Path (Get-ClaudeHome) 'bstack-extras.json' }
function Get-TemplateAllow {
    <# permissions 白名單的唯一來源是 templates/project-settings.json，這裡不另抄一份。 #>
    (Get-Content (Join-Path $RepoRoot 'templates/project-settings.json') -Raw -Encoding UTF8 | ConvertFrom-Json).permissions.allow
}

# === 項目定義：白話說明、建議層級、Fragment（要 merge 的片段；mcp 為 $null 走 claude mcp add）===

$ItemDefs = [ordered]@{
    statusLine  = @{
        Hint = '狀態列顯示 model / branch / context 用量（需 bash + jq）'; Suggest = 'U'
        Fragment = {
            $sh = (Join-Path $RepoRoot 'extras/statusline.sh').Replace('\', '/')
            [pscustomobject]@{ statusLine = [pscustomobject]@{ type = 'command'; command = "bash `"$sh`"" } }
        }
    }
    permissions = @{
        Hint = "$(@(Get-TemplateAllow).Count) 條唯讀 / 查詢類工具不再逐次問你（Read / Grep / git status …）"; Suggest = 'P'
        Fragment = { [pscustomobject]@{ permissions = [pscustomobject]@{ allow = @(Get-TemplateAllow) } } }
    }
    env         = @{
        Hint = '開 Agent Teams 實驗開關（只有 dispatch-parallel 用到）'; Suggest = 'U'
        Fragment = { [pscustomobject]@{ env = [pscustomobject]@{ CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1' } } }
    }
    mcp         = @{
        Hint = 'playwright MCP（前端 e2e 用）。mysql MCP 含帳密，只印指令範本讓你自己填'; Suggest = 'U'
        Fragment = $null
    }
}

# === JSON 讀寫（原封搬自舊 setup.ps1 的 Test-JsonObject / Merge-LocalFirst）===

function Test-JsonObject {
    <# 判斷值是否為 JSON object（可再往下 merge），排除 array / 純量 / null。 #>
    param($Value)
    if ($null -eq $Value) { return $false }
    return ($Value -is [System.Management.Automation.PSCustomObject])
}

function Merge-LocalFirst {
    <#
    .SYNOPSIS 深層 merge：本機值優先，repo 值只補本機缺的 key。
    .DESCRIPTION 兩邊都是 object → 逐 key 遞迴；任一邊非 object（array / 純量）→ 本機值直接勝。
      陣列不可直接 return：pipeline 會展開它，空陣列變 $null、單元素變純量。以 , 包一層保原型。
    #>
    param($Local, $Repo)
    if ($null -eq $Local) { if ($Repo -is [array]) { return ,$Repo } else { return $Repo } }
    if ($null -eq $Repo) { if ($Local -is [array]) { return ,$Local } else { return $Local } }
    if (-not (Test-JsonObject $Local) -or -not (Test-JsonObject $Repo)) {
        if ($Local -is [array]) { return ,$Local } else { return $Local }
    }
    $merged = [ordered]@{}
    foreach ($p in $Local.PSObject.Properties) { $merged[$p.Name] = $p.Value }
    foreach ($p in $Repo.PSObject.Properties) {
        if ($merged.Contains($p.Name)) { $merged[$p.Name] = Merge-LocalFirst -Local $merged[$p.Name] -Repo $p.Value }
        else { $merged[$p.Name] = $p.Value }
    }
    return [pscustomobject]$merged
}

function Read-Json([string]$path) {
    <# 讀 JSON；檔不存在回 $null；壞 JSON 印黃字並丟 FormatException 讓呼叫端跳過該項。 #>
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    try { Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json }
    catch {
        Write-Host "  [skip] $path 不是合法 JSON，這項跳過，請先修好：$($_.Exception.Message)" -ForegroundColor Yellow
        throw [System.FormatException]::new("bad-json:$path")
    }
}

function Write-JsonAtomic {
    <#
    .SYNOPSIS 寫 JSON：每次執行同檔只備份一次，先寫 temp 再 Move-Item 原子替換。
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param([string]$path, $obj, [switch]$NoBackup)
    if (-not $PSCmdlet.ShouldProcess($path, 'write')) { return }
    $dir = Split-Path $path
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    if (-not $NoBackup -and (Test-Path -LiteralPath $path) -and -not $script:BackedUp[$path]) {
        Copy-Item -LiteralPath $path -Destination "$path.bak-$RunStamp"
        $script:BackedUp[$path] = $true
    }
    $tmp = "$path.tmp-$PID"
    $obj | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $tmp -Encoding UTF8
    Move-Item -LiteralPath $tmp -Destination $path -Force
}

function Get-AddedKeys($before, $after, [string]$prefix = '') {
    <#
    .SYNOPSIS 列出 $after 有、$before 沒有的葉 key（dotted）；permissions.allow 例外列成 'permissions.allow[<值>]'。
    .DESCRIPTION 這就是 manifest 記的東西：只記真的新增的，-Uninstall 才不會拔掉使用者本來就有的。
    #>
    $out = @()
    foreach ($p in $after.PSObject.Properties) {
        $k = if ($prefix) { "$prefix.$($p.Name)" } else { $p.Name }
        $bv = if ($before) { $before.PSObject.Properties[$p.Name] } else { $null }
        if ($k -eq 'permissions.allow') {
            $have = if ($bv) { @($bv.Value) } else { @() }
            foreach ($v in @($p.Value)) { if ($v -notin $have) { $out += "permissions.allow[$v]" } }
            continue
        }
        if ($null -eq $bv) { $out += $k; continue }
        if ((Test-JsonObject $p.Value) -and (Test-JsonObject $bv.Value)) { $out += Get-AddedKeys $bv.Value $p.Value $k }
    }
    # 直接回傳、不用 ,$out：呼叫端會再用 @() 包一層，包兩層會變「陣列裡一個陣列」，
    # 綁到 [string[]] 時整個被 join 成一個字串、空陣列也會被算成一筆（SelfTest c1 抓到過）。
    return $out
}

# === manifest ===

function Save-Manifest {
    <# 同 item+scope+file 覆蓋（冪等）；status pending → done 讓中途炸掉也拆得回來。 #>
    [CmdletBinding()]
    param([string]$item, [string]$scope, [string]$file, [string[]]$keys, [string]$status = 'done')
    $m = Read-Json (Get-ManifestPath); if (-not $m) { $m = [pscustomobject]@{ entries = @() } }
    $m.entries = @($m.entries | Where-Object { -not ($_.item -eq $item -and $_.scope -eq $scope -and $_.file -eq $file) })
    $m.entries += [pscustomobject]@{ item = $item; scope = $scope; file = $file; keys = $keys; status = $status; ts = (Get-Date).ToString('o') }
    Write-JsonAtomic (Get-ManifestPath) $m -NoBackup
}
function Get-Installed([string]$item, [string]$scope) {
    $m = Read-Json (Get-ManifestPath); if (-not $m) { return $null }
    return @($m.entries | Where-Object { $_.item -eq $item -and $_.scope -eq $scope })[0]
}

# === 加 / 拆 ===

function Add-Item {
    <#
    .SYNOPSIS 把一項 merge 進指定層級的 settings；-Force 用於 statusLine 重裝（覆蓋而非 local-first）。
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param([string]$item, [string]$scope, [switch]$Force)
    if ($item -eq 'mcp') { return (Add-Mcp $scope) }
    $path = Get-SettingsPath $scope
    try { $local = Read-Json $path } catch [System.FormatException] { return }
    $frag = & $ItemDefs[$item].Fragment
    if ($item -eq 'statusLine' -and $Force) {
        $merged = $local; if (-not $merged) { $merged = [pscustomobject]@{} }
        $merged | Add-Member -NotePropertyName statusLine -NotePropertyValue $frag.statusLine -Force
    } else {
        $merged = Merge-LocalFirst -Local $local -Repo $frag
    }
    if ($item -eq 'permissions') {
        # 聯集：本機 allow 是使用者自己的，我們只是加上唯讀清單
        $have = if ($local -and $local.permissions) { @($local.permissions.allow) } else { @() }
        $merged.permissions.allow = @($have + @($frag.permissions.allow) | Select-Object -Unique)
    }
    $added = @(Get-AddedKeys $local $merged)
    if ($added.Count -eq 0 -and -not $Force) { Write-Host "  [keep] $item：你本機已有設定，未覆蓋" -ForegroundColor Yellow; return }
    if ($PSCmdlet.ShouldProcess($path, "merge $item")) {
        Save-Manifest $item $scope $path $added 'pending'
        Write-JsonAtomic $path $merged
        Save-Manifest $item $scope $path $added 'done'
        $script:Written += @{ item = $item; scope = $scope; file = $path }
    }
}

function Add-Mcp {
    <# 只代跑 playwright；mysql 含帳密，印範本讓使用者自填。 #>
    [CmdletBinding(SupportsShouldProcess)]
    param([string]$scope)
    $args_ = @('mcp', 'add', 'playwright', '--scope', $scope, '--', 'npx', '-y', '@playwright/mcp@latest')
    $file = if ($scope -eq 'project') { Join-Path (Get-Location).Path '.mcp.json' } else { 'claude mcp (user)' }
    if ($PSCmdlet.ShouldProcess("claude $($args_ -join ' ')", 'run')) {
        & claude @args_
        if ($LASTEXITCODE -ne 0) { Write-Host "  [fail] claude mcp add playwright 回傳 $LASTEXITCODE" -ForegroundColor Red; return }
        Save-Manifest 'mcp' $scope $file @('mcp:playwright')
        $script:Written += @{ item = 'mcp'; scope = $scope; file = $file }
    }
    Write-Host @"
  mysql MCP 含帳密，請自己填、自己跑（本腳本不寫進任何檔）：
  claude mcp add mysql --scope $scope --env MYSQL_HOST=<host> --env MYSQL_PORT=3306 --env MYSQL_USER=<唯讀帳號> --env MYSQL_PASS=<密碼> --env ALLOW_INSERT_OPERATION=false --env ALLOW_UPDATE_OPERATION=false --env ALLOW_DELETE_OPERATION=false -- npx -y @benborla29/mcp-server-mysql
"@
}

function Remove-KeyPath($obj, [string]$dotted) {
    <# 移除 dotted 葉 key；'permissions.allow[值]' 只拔那個值；父物件空了就一併拔。 #>
    if ($dotted -match '^permissions\.allow\[(.+)\]$') {
        $v = $Matches[1]
        if ($obj.permissions) { $obj.permissions.allow = @($obj.permissions.allow | Where-Object { $_ -ne $v }) }
        return
    }
    $parts = $dotted.Split('.'); $chain = @($obj); $cur = $obj
    for ($i = 0; $i -lt $parts.Length - 1; $i++) {
        $cur = $cur.($parts[$i]); if ($null -eq $cur) { return }; $chain += $cur
    }
    $cur.PSObject.Properties.Remove($parts[-1])
    for ($i = $parts.Length - 2; $i -ge 0; $i--) {
        if (@($chain[$i + 1].PSObject.Properties).Count -eq 0) { $chain[$i].PSObject.Properties.Remove($parts[$i]) } else { break }
    }
}

function Invoke-Uninstall {
    [CmdletBinding(SupportsShouldProcess)]
    param()
    $m = Read-Json (Get-ManifestPath)
    if (-not $m -or -not @($m.entries).Count) { Write-Host '沒有 manifest，沒東西可拆'; return }
    foreach ($e in $m.entries) {
        if ($e.item -eq 'mcp') {
            foreach ($k in $e.keys) { $n = $k.Split(':')[1]; if ($PSCmdlet.ShouldProcess("mcp $n", 'remove')) { & claude mcp remove $n --scope $e.scope } }
            continue
        }
        try { $obj = Read-Json $e.file } catch { continue }
        if (-not $obj) { continue }
        foreach ($k in $e.keys) { Remove-KeyPath $obj $k }
        Write-JsonAtomic $e.file $obj
    }
    if ($PSCmdlet.ShouldProcess((Get-ManifestPath), 'delete')) { Remove-Item -LiteralPath (Get-ManifestPath) -Force }
    Write-Host "已拆掉 $(@($m.entries).Count) 項，manifest 已刪。"
}

function Invoke-Migrate {
    <#
    .SYNOPSIS 清舊 setup.ps1 sync 進 ~/.claude/ 的副本。
    .DESCRIPTION 為什麼必清：user 級同名 skill 會遮蔽 plugin skill，不清就永遠跑舊版；
      舊 ~/.claude/CLAUDE.md 那句「…一律進 dev-workflow」會讓自動攔截復活。
      無舊副本時一行都不印（新使用者不該看到遷移訊息）。-ListOnly 只列不問。
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param([switch]$ListOnly)
    $home_ = Get-ClaudeHome
    $skills = Get-ChildItem (Join-Path $RepoRoot 'skills') -Directory | ForEach-Object { $_.Name }
    $agents = Get-ChildItem (Join-Path $RepoRoot 'agents') -Filter *.md | ForEach-Object { $_.Name }
    $targets = @()
    $targets += @($skills | ForEach-Object { Join-Path $home_ "skills/$_" } | Where-Object { Test-Path $_ })
    $targets += @($agents | ForEach-Object { Join-Path $home_ "agents/$_" } | Where-Object { Test-Path $_ })
    $targets += @(@('hooks/branch-safety.ps1', 'hooks/file-type-guard.ps1', 'statusline.sh', 'state/file-guard') |
        ForEach-Object { Join-Path $home_ $_ } | Where-Object { Test-Path $_ })

    # settings.json：只拔指向舊 hook 的 hooks[] 元素與舊 statusline，使用者自己的 hook 留著
    $settingsPath = Join-Path $home_ 'settings.json'; $s = $null; $touched = $false
    try { $s = Read-Json $settingsPath } catch {}
    if ($s -and $s.hooks -and $s.hooks.PreToolUse) {
        $before = (@($s.hooks.PreToolUse) | ForEach-Object { @($_.hooks).Count } | Measure-Object -Sum).Sum
        foreach ($g in @($s.hooks.PreToolUse)) { $g.hooks = @($g.hooks | Where-Object { $_.command -notmatch 'branch-safety\.ps1|file-type-guard\.ps1' }) }
        $s.hooks.PreToolUse = @($s.hooks.PreToolUse | Where-Object { @($_.hooks).Count -gt 0 })
        $after = (@($s.hooks.PreToolUse) | ForEach-Object { @($_.hooks).Count } | Measure-Object -Sum).Sum
        if ($after -ne $before) { $touched = $true }
        if (@($s.hooks.PreToolUse).Count -eq 0) { $s.hooks.PSObject.Properties.Remove('PreToolUse') }
        if (@($s.hooks.PSObject.Properties).Count -eq 0) { $s.PSObject.Properties.Remove('hooks') }
    }
    if ($s -and $s.statusLine -and $s.statusLine.command -match 'statusline\.sh') { $s.PSObject.Properties.Remove('statusLine'); $touched = $true }

    # 舊全域 CLAUDE.md：含 bstack 簽名字串才處理。標題行與現版 rules.md 相同 ≥ 90% 視為未被使用者改過。
    $claude = Join-Path $home_ 'CLAUDE.md'; $claudeOld = $false; $claudeModified = $false; $t = ''
    if (Test-Path $claude) {
        $t = Get-Content $claude -Raw -Encoding UTF8
        if ($t -match '§事實核實' -and $t -match 'dev-workflow 為骨幹') {
            $rules = Get-Content (Join-Path $RepoRoot 'skills/devwork/rules.md') -Raw -Encoding UTF8
            $a = @(($t -split "`r?`n") | Where-Object { $_ -match '^###? ' })
            $b = @(($rules -split "`r?`n") | Where-Object { $_ -match '^###? ' })
            $common = @($a | Where-Object { $_ -in $b }).Count
            if ($a.Count -gt 0 -and ($common / $a.Count) -ge 0.9) { $claudeOld = $true } else { $claudeModified = $true }
        }
    }

    if (-not $targets.Count -and -not $touched -and -not $claudeOld -and -not $claudeModified) { return }

    Write-Host "偵測到舊 setup.ps1 sync 的副本（user 級 skill 會遮蔽 plugin 版，不清會一直跑舊版）：" -ForegroundColor Yellow
    $targets | ForEach-Object { Write-Host "  $_" }
    if ($touched) { Write-Host "  $settingsPath 內指向舊 hook / statusline 的條目" }
    if ($claudeOld) { Write-Host "  $claude（bstack 舊版守則，未偵測到你的修改）→ 將改名為 CLAUDE.md.bstack-bak-$RunStamp" }
    if ($claudeModified) {
        $hit = ($t -split "`r?`n") | Select-String -Pattern '一律進 `?dev-workflow' | Select-Object -First 1
        $ln = if ($hit) { $hit.LineNumber } else { '?' }
        Write-Host "  $claude 含 bstack 守則但被改過，不自動動它。其中第 $ln 行「…一律進 dev-workflow」會讓流程自動啟動，請自行拿掉。" -ForegroundColor Yellow
    }
    if ($ListOnly) { Write-Host "  清理請跑：pwsh -File scripts/extras.ps1 -Migrate"; return }

    $go = $Yes -or ((Read-Host '刪除 / 改名以上項目？[y/N]').ToLower() -eq 'y')
    if (-not $go) { return }
    foreach ($x in $targets) { if ($PSCmdlet.ShouldProcess($x, 'remove')) { Remove-Item -LiteralPath $x -Recurse -Force } }
    if ($touched) { Write-JsonAtomic $settingsPath $s }
    if ($claudeOld -and $PSCmdlet.ShouldProcess($claude, 'rename')) { Move-Item -LiteralPath $claude -Destination "$claude.bstack-bak-$RunStamp" }
    Write-Host "  完成。請重開 Claude Code session。"
}

# === SelfTest ===

function Invoke-SelfTest {
    <#
    .SYNOPSIS 在 temp 偽造 HOME 跑全套斷言；不碰真實設定、不呼叫 claude CLI（mcp 只走 -WhatIf）。
    #>
    $tmp = Join-Path ([IO.Path]::GetTempPath()) "bstack-extras-selftest-$(Get-Random)"
    $script:fails = 0
    function Assert([string]$name, [bool]$ok) {
        if ($ok) { Write-Host "PASS  $name" } else { Write-Host "FAIL  $name" -ForegroundColor Red; $script:fails++ }
    }
    try {
        New-Item -ItemType Directory -Path "$tmp/.claude", "$tmp/proj" -Force | Out-Null
        $env:BSTACK_CLAUDE_HOME = "$tmp/.claude"
        # seed 刻意與我們的名單重疊：allow 有 Read、已有自己的 statusLine
        Set-Content "$tmp/.claude/settings.json" '{"model":"opus","theme":"dark","statusLine":{"type":"command","command":"echo mine"},"permissions":{"allow":["Bash(npm test)","Read"]}}' -Encoding UTF8

        Assert 'S0 反向：這條必紅（驗 Assert 會累計）' $false; $script:fails--

        Add-Item 'statusLine' 'user'; $s = Read-Json "$tmp/.claude/settings.json"
        Assert 'a1 本機已有 statusLine → 不覆蓋' ($s.statusLine.command -eq 'echo mine')
        Add-Item 'permissions' 'user'; $s = Read-Json "$tmp/.claude/settings.json"
        Assert 'a2 allow 聯集且保留本機值' (($s.permissions.allow -contains 'Bash(npm test)') -and ($s.permissions.allow -contains 'Grep'))
        Assert 'a3 既有 model/theme 不變' ($s.model -eq 'opus' -and $s.theme -eq 'dark')
        Add-Item 'env' 'user'; $s = Read-Json "$tmp/.claude/settings.json"
        Assert 'a4 env 加入' ($s.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS -eq '1')
        Assert 'b 同檔只備份一次' (@(Get-ChildItem "$tmp/.claude" -Filter 'settings.json.bak-*').Count -eq 1)
        $m = Read-Json (Get-ManifestPath)
        Assert 'c1 manifest 2 筆（statusLine 未寫入不記）' (@($m.entries).Count -eq 2)
        $permKeys = (@($m.entries | Where-Object item -eq permissions)[0].keys -join '|')
        Assert 'c2 manifest 記的是實際新增 key（不含 Read）' (($permKeys -notmatch 'allow\[Read\]') -and ($permKeys -match 'allow\[Grep\]'))

        Push-Location "$tmp/proj"; try { Add-Item 'permissions' 'project' } finally { Pop-Location }
        Assert 'p project 寫到 <cwd>/.claude/settings.json' ((Test-Path "$tmp/proj/.claude/settings.json") -and ((Read-Json "$tmp/proj/.claude/settings.json").permissions.allow -contains 'Read'))
        Add-Item 'env' 'user'
        Assert 'i 冪等：重跑 env → manifest 仍 3 筆' (@((Read-Json (Get-ManifestPath)).entries).Count -eq 3)

        Set-Content "$tmp/.claude/broken.json" '{ not json' -Encoding UTF8
        $threw = $false; try { Read-Json "$tmp/.claude/broken.json" | Out-Null } catch [System.FormatException] { $threw = $true }
        Assert 'j 壞 JSON 以 FormatException 回報' $threw
        Add-Mcp 'user' -WhatIf
        Assert 'k mcp -WhatIf 不寫 manifest' (@((Read-Json (Get-ManifestPath)).entries | Where-Object item -eq mcp).Count -eq 0)

        Invoke-Uninstall; $s = Read-Json "$tmp/.claude/settings.json"
        Assert 'd1 env 整個拆掉（含空父物件）' ($null -eq $s.PSObject.Properties['env'])
        Assert 'd2 allow 回到原樣' ((@($s.permissions.allow) -join '|') -eq 'Bash(npm test)|Read')
        Assert 'd3 使用者自己的 statusLine 仍在' ($s.statusLine.command -eq 'echo mine')
        Assert 'd4 manifest 已刪' (-not (Test-Path (Get-ManifestPath)))

        # migrate：repo 名單內的刪、使用者自己的留、舊 CLAUDE.md 改名、被改過的不動、自己的 hook 留著
        New-Item -ItemType Directory -Path "$tmp/.claude/skills/brainstorm", "$tmp/.claude/skills/my-own", "$tmp/.claude/hooks", "$tmp/.claude/state/file-guard" -Force | Out-Null
        Set-Content "$tmp/.claude/hooks/branch-safety.ps1" '# old' -Encoding UTF8
        Copy-Item (Join-Path $RepoRoot 'skills/devwork/rules.md') "$tmp/.claude/CLAUDE.md"
        Set-Content "$tmp/.claude/settings.json" '{"hooks":{"PreToolUse":[{"matcher":"Write","hooks":[{"type":"command","command":"pwsh x/hooks/branch-safety.ps1"},{"type":"command","command":"echo mine-hook"}]}]}}' -Encoding UTF8
        $script:Yes = $true
        Invoke-Migrate
        Assert 'e1 舊 skill 副本刪除' (-not (Test-Path "$tmp/.claude/skills/brainstorm"))
        Assert 'e2 使用者自己的 skill 不動' (Test-Path "$tmp/.claude/skills/my-own")
        Assert 'e3 舊 hook / state 刪除' ((-not (Test-Path "$tmp/.claude/hooks/branch-safety.ps1")) -and (-not (Test-Path "$tmp/.claude/state/file-guard")))
        Assert 'e4 舊 CLAUDE.md 改名備份' ((-not (Test-Path "$tmp/.claude/CLAUDE.md")) -and (@(Get-ChildItem "$tmp/.claude" -Filter 'CLAUDE.md.bstack-bak-*').Count -eq 1))
        $s = Read-Json "$tmp/.claude/settings.json"
        Assert 'e5 settings 只拔舊 hook、自己的留著' ((@($s.hooks.PreToolUse[0].hooks).Count -eq 1) -and ($s.hooks.PreToolUse[0].hooks[0].command -eq 'echo mine-hook'))
        Set-Content "$tmp/.claude/CLAUDE.md" "## 我的規則`n### §事實核實`n### 我加的`ndev-workflow 為骨幹；改動 prompt 一律進 dev-workflow" -Encoding UTF8
        Invoke-Migrate
        Assert 'e6 被改過的 CLAUDE.md 不動' (Test-Path "$tmp/.claude/CLAUDE.md")
    } finally {
        Remove-Item Env:BSTACK_CLAUDE_HOME -ErrorAction SilentlyContinue
        if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    }
    Write-Host ($(if ($script:fails -eq 0) { 'SELFTEST ALL PASS' } else { "SELFTEST $($script:fails) FAIL" }))
    exit $(if ($script:fails -eq 0) { 0 } else { 1 })
}

# === 主流程 ===

if ($env:BSTACK_CLAUDE_HOME -and -not $SelfTest) { Write-Host "[warn] 寫入目標被 BSTACK_CLAUDE_HOME 覆寫為 $($env:BSTACK_CLAUDE_HOME)" -ForegroundColor Yellow }
if ($RepoRoot -match '[\\/]plugins[\\/]cache[\\/]') { Write-Host "[warn] 你從 plugin 快取跑本腳本，statusLine 會指到快取路徑、plugin 更新即失效。請從 clone 的 repo 跑。" -ForegroundColor Yellow }

if ($SelfTest)  { Invoke-SelfTest }
if ($Uninstall) { Invoke-Uninstall; exit 0 }
if ($Migrate)   { Invoke-Migrate; exit 0 }
if ($PSCmdlet.ParameterSetName -eq 'Batch') {
    Invoke-Migrate -ListOnly      # 非互動也要看得到舊副本，但不在這裡刪
    foreach ($i in $Items) { Add-Item $i $Scope }
    exit 0
}

Write-Host "== bstack extras ==" -ForegroundColor Cyan
Write-Host "plugin 核心請用 /plugin install bstack@bstack；本選單只處理 plugin 帶不了的四項，每項都能跳過，跳過就什麼都不寫。反悔：-Uninstall"
Write-Host "  使用者層級 = $(Get-SettingsPath user)"
$projPath = Get-SettingsPath project
$isGit = $false; try { git rev-parse --show-toplevel 2>$null | Out-Null; $isGit = ($LASTEXITCODE -eq 0) } catch { $isGit = $false }
Write-Host "  目前專案   = $projPath$(if (-not $isGit) { '（目前目錄不是 git repo，[P] 仍會寫到這裡）' })"
$homeIsCwd = $false
try { $homeIsCwd = ((Resolve-Path (Split-Path (Get-ClaudeHome))).Path -eq (Get-Location).Path) } catch {}

Invoke-Migrate
foreach ($i in $ItemDefs.Keys) {
    $d = $ItemDefs[$i]
    $inst = Get-Installed $i 'user'; if (-not $inst) { $inst = Get-Installed $i 'project' }
    Write-Host ""; Write-Host "$i — $($d.Hint)（建議 [$($d.Suggest)]）"
    if ($inst) {
        $ans = Read-Host "  已裝（$($inst.scope)，$($inst.ts.Substring(0, 10))）→ [R] 重裝 / [S] 略過（預設 S）"
        if ($ans.ToUpper() -eq 'R') { Add-Item $i $inst.scope -Force } else { Write-Host "  略過" }
        continue
    }
    $ans = Read-Host "  [U] 使用者層級 / [P] 目前專案 / [S] 跳過（預設 S）"
    switch ($ans.ToUpper()) {
        'U' { Add-Item $i 'user' }
        'P' { if ($homeIsCwd) { Write-Host "  目前目錄就是使用者家目錄，[P] 會等於 [U]，已拒絕；請到專案目錄再跑" -ForegroundColor Yellow } else { Add-Item $i 'project' } }
        default { Write-Host "  跳過" }
    }
}
Write-Host ""
if ($script:Written.Count -eq 0) {
    Write-Host "沒有寫入任何檔案。plugin 請用 /plugin install bstack@bstack" -ForegroundColor Green
} else {
    Write-Host "本次寫入 $($script:Written.Count) 項：" -ForegroundColor Green
    $script:Written | ForEach-Object { Write-Host "  $($_.item) → $($_.file)" }
    Write-Host "反悔：pwsh -File scripts/extras.ps1 -Uninstall"
}
