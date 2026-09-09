#!/usr/bin/env pwsh
<#
.SYNOPSIS
  bstack 在 Codex CLI 的一站式安裝：前置檢查 → 清舊副本 → marketplace → plugin → agents TOML → config.toml。
  每一步做了什麼都記進 manifest，-Uninstall 只拆自己加的。

.DESCRIPTION
  六步：
    1.  前置檢查   codex CLI / node（hook 用）/ git；缺了就停、印安裝指令
    1.5 清舊副本   ~/.agents/skills/ 內與本 repo skills/ 同名、frontmatter name 也相同的舊 bstack 副本
                  → 搬到 ~/.agents/bstack-migrate-bak-<時間>/（不刪）；Codex 同名 skill 不合併、兩份並列，舊版會搶先觸發
                  ~/.codex/AGENTS.md 含「dev-workflow」/「一律進」只警告，那是使用者的全域指示檔、不動
    2.  marketplace  codex plugin marketplace add fujiei22/bstack（-Source local → 本 clone 路徑）；已有就略過
    3.  plugin       codex plugin add bstack@bstack；Windows 對本機 marketplace 會間歇「存取被拒 (os error 5)」→ 自動重試最多 3 次
    4.  agents       codex/agents/*.toml 複製到 $CODEX_HOME/agents/（Codex plugin 帶不了 agents，只能靠複製）；已存在的問你覆蓋 / 跳過
    5.  config       $CODEX_HOME/config.toml 補 [tools.update_plan] enabled = true（Codex 0.152 起預設關，流程的任務追蹤靠它）
                  先備份 config.toml.bak-<時間> 再 append；-Uninstall 只拔「[tools.update_plan] 表且內容恰為 enabled = true」那一個表
                  （不用註解定界：Codex 自己重寫 config.toml 時會把別的表排進定界之間，2026-09-09 實測，靠定界拔會連使用者的表一起刪）
  manifest 住 $CODEX_HOME/bstack-codex.json：記 agents[]、config_patched、marketplace、安裝時間。
  本腳本無法代為信任 hook：Codex 的 plugin hook 預設不信任，裝完要在新 session 打 /hooks 手動信任，否則 branch-safety 不生效。

.PARAMETER Yes          非互動：清舊副本直接搬、agents 衝突一律跳過
.PARAMETER Source       github（預設）| local：marketplace 來源；local 用整個 working tree、樹大、Windows 較容易撞到 os error 5
.PARAMETER SkipMigrate  跳過 1.5
.PARAMETER SkipAgents   跳過 4
.PARAMETER Migrate      只跑 1.5（列出舊副本；-Yes 才搬）
.PARAMETER Uninstall    依 manifest 拆：codex plugin remove、刪自己複製的 agents、config.toml 只拔自己那段、刪 manifest
.EXAMPLE
  pwsh -File scripts/install-codex.ps1
  pwsh -File scripts/install-codex.ps1 -Yes
  pwsh -File scripts/install-codex.ps1 -WhatIf            # 只印會做的事，什麼都不動
  pwsh -File scripts/install-codex.ps1 -Migrate
  pwsh -File scripts/install-codex.ps1 -Uninstall
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$Yes,
    [ValidateSet('github', 'local')][string]$Source = 'github',
    [switch]$SkipMigrate,
    [switch]$SkipAgents,
    [switch]$Uninstall,
    [switch]$Migrate
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$GithubRepo = 'fujiei22/bstack'
$PluginId = 'bstack@bstack'
$MarketplaceName = 'bstack'
$DryRun = [bool]$WhatIfPreference
$RunStamp = Get-Date -Format yyyyMMddHHmmss      # 整支腳本共用：備份檔與搬遷目錄同一個時間戳
# 使用者家目錄：Windows 用 USERPROFILE、其他平台 pwsh 自帶 $HOME；`??` 不把空字串當 null，所以自己判
$UserHome = if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) { $env:USERPROFILE } else { $HOME }
$CodexHome = if (-not [string]::IsNullOrWhiteSpace($env:CODEX_HOME)) { $env:CODEX_HOME } else { Join-Path $UserHome '.codex' }
$AgentsHome = Join-Path $UserHome '.agents'    # Codex 的使用者級 skill 根：~/.agents/skills/
$ManifestPath = Join-Path $CodexHome 'bstack-codex.json'
$ConfigPath = Join-Path $CodexHome 'config.toml'
$AgentsDest = Join-Path $CodexHome 'agents'
$AgentsSrc = Join-Path $RepoRoot 'codex/agents'
# 1.6.0 之前的版本用這兩行註解定界 config 段；-Uninstall 遇到就順手拔掉（只拔註解行本身）
$LegacyMarkers = @('# bstack install-codex.ps1 加入（begin）', '# bstack install-codex.ps1 加入（end）')
$script:CodexExe = 'codex'
$script:CodexFromFallback = $false

function Step([string]$n, [string]$title) { Write-Host ""; Write-Host "== 步驟 $n：$title ==" -ForegroundColor Cyan }
function Ask {
    <# 問一個單鍵選項；-Yes 時直接回預設。回傳大寫字母。 #>
    param([string]$prompt, [string]$default)
    if ($Yes) { return $default.ToUpper() }
    $ans = Read-Host "$prompt（預設 $($default.ToLower())）"
    if ([string]::IsNullOrWhiteSpace($ans)) { return $default.ToUpper() }
    return $ans.Trim().ToUpper()
}
function Find-Codex {
    <#
    .SYNOPSIS 找 codex 執行檔：先看 PATH，找不到再探官方安裝腳本的落點 %LOCALAPPDATA%\Programs\OpenAI\Codex\bin。
    .DESCRIPTION 官方 install.ps1 只對「新開的 shell」更新 PATH（Task 0 實測），剛裝完在同一個視窗跑本腳本會找不到；
      探到就本次直接用絕對路徑，並提醒重開 shell。回傳 $true / $false。
    #>
    $c = Get-Command codex -ErrorAction SilentlyContinue
    if ($c) { $script:CodexExe = $c.Source; return $true }
    if ($IsWindows -and -not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        $p = Join-Path $env:LOCALAPPDATA 'Programs\OpenAI\Codex\bin\codex.exe'
        if (Test-Path -LiteralPath $p) { $script:CodexExe = $p; $script:CodexFromFallback = $true; return $true }
    }
    return $false
}
function Run-Codex {
    <# 跑 codex CLI 的寫入類指令；-WhatIf 只印不跑。回傳 exit code；輸出照印，同時留一份在 $script:LastCodexOutput 給呼叫端判斷錯誤類型。 #>
    param([string[]]$args_)
    $cmd = "codex $($args_ -join ' ')"
    $script:LastCodexOutput = ''
    if ($DryRun) { Write-Host "  [whatif] $cmd"; return 0 }
    Write-Host "  > $cmd"
    # 一定要接管 stdout：不接的話 stdout 會變成回傳值、跟 exit code 混成陣列，呼叫端 -ne 0 永遠為真（install.ps1 踩過）
    $out = @(& $script:CodexExe @args_ 2>&1 | ForEach-Object { "$_" })
    $rc = $LASTEXITCODE
    $out | ForEach-Object { Write-Host $_ }
    $script:LastCodexOutput = ($out -join "`n")
    return $rc
}
function Get-CodexJson {
    <# 跑 codex 的查詢類指令（-WhatIf 也跑）並解析 --json 輸出；失敗回 $null，呼叫端自己決定要不要當「沒有」。 #>
    param([string[]]$args_)
    try {
        $raw = (& $script:CodexExe @args_ 2>$null | Out-String)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) { return $null }
        # 前面可能夾 Warning 行（實測 plugin list 未登入時會印），從第一個 { 開始解析
        $i = $raw.IndexOf('{'); if ($i -lt 0) { return $null }
        return ($raw.Substring($i) | ConvertFrom-Json)
    } catch { return $null }
}
function Read-Manifest {
    <# 讀 manifest；不存在或壞掉回 $null。 #>
    if (-not (Test-Path -LiteralPath $ManifestPath)) { return $null }
    try { return (Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}
function Save-Manifest($m) {
    <# 寫 manifest（UTF-8、無 BOM）；先寫 .tmp 再 Move（原子替換，跟 extras.ps1 的 Write-JsonAtomic 同一招）：寫到一半被中斷不會留半截 JSON，-Uninstall 才拆得回去。-WhatIf 只印。 #>
    if ($DryRun) { Write-Host "  [whatif] 寫 manifest $ManifestPath"; return }
    New-Item -ItemType Directory -Path $CodexHome -Force | Out-Null
    $tmp = "$ManifestPath.tmp-$PID"
    [IO.File]::WriteAllText($tmp, (($m | ConvertTo-Json -Depth 5) + "`n"), [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $tmp -Destination $ManifestPath -Force
}
function Backup-File([string]$path) {
    <# 備份成 <path>.bak-<stamp>；同一次執行同檔只備份一次。 #>
    if (-not (Test-Path -LiteralPath $path)) { return }
    $bak = "$path.bak-$RunStamp"
    if (Test-Path -LiteralPath $bak) { return }
    if ($DryRun) { Write-Host "  [whatif] 備份 $path → $bak"; return }
    Copy-Item -LiteralPath $path -Destination $bak
    Write-Host "  已備份 $bak"
}
function Write-Utf8NoBom([string]$path, [string]$text) {
    [IO.File]::WriteAllText($path, $text, [Text.UTF8Encoding]::new($false))
}

function Invoke-Migrate {
    <#
    .SYNOPSIS 清 ~/.agents/skills/ 內的舊 bstack 副本（搬進備份目錄，不刪）。
    .DESCRIPTION 為什麼要清：Codex 對同名 skill 不合併、兩份都列給模型看（Task 0 用 codex debug prompt-input 實測，
      ~/.agents/skills 的 dev-workflow / db-access 與 plugin 版並列），舊版「關鍵詞自動攔截」會搶先觸發。
      判定看內容不看檔名（與 extras.ps1 的 Test-BstackSkillDir 同一套簽名）：目錄名在本 repo skills/ 清單內（動態讀目錄、不寫死）、
      SKILL.md frontmatter `name:` 等於目錄名、且內文含「（繁中）」；同名但簽名不符的視為使用者自己的 skill、不動。
      ~/.codex/AGENTS.md（使用者的全域指示檔）含「dev-workflow」或「一律進」只警告：那句會讓舊版自動攔截復活，請自行檢視。
      -ListOnly 只列不問；預設互動問 y/n；-Yes 直接搬。
    #>
    param([switch]$ListOnly)
    $skillsRoot = Join-Path $AgentsHome 'skills'
    Write-Host "  掃描 ~/.agents/skills/（實際路徑 $skillsRoot）"
    $repoSkills = Get-ChildItem -LiteralPath (Join-Path $RepoRoot 'skills') -Directory | ForEach-Object { $_.Name }
    $targets = @(); $sameNameSkipped = @()
    if (Test-Path -LiteralPath $skillsRoot) {
        foreach ($name in $repoSkills) {
            $d = Join-Path $skillsRoot $name
            $f = Join-Path $d 'SKILL.md'
            if (-not (Test-Path -LiteralPath $f)) { continue }
            $t = Get-Content -LiteralPath $f -Raw -Encoding UTF8
            if (($t -match "(?m)^name:\s*$([regex]::Escape($name))\s*$") -and ($t -match '（繁中）')) { $targets += $d } else { $sameNameSkipped += $d }
        }
    }
    # AGENTS.md 只警告不動
    $agentsMd = Join-Path $CodexHome 'AGENTS.md'
    $agentsMdHits = @()
    if (Test-Path -LiteralPath $agentsMd) {
        $agentsMdHits = @((Get-Content -LiteralPath $agentsMd -Encoding UTF8) | Select-String -Pattern 'dev-workflow|一律進' | ForEach-Object { $_.LineNumber })
    }

    if (-not $targets.Count -and -not $sameNameSkipped.Count -and -not $agentsMdHits.Count) { Write-Host "  沒有舊副本"; return }
    if ($targets.Count) {
        Write-Host "  偵測到會與 plugin 版並列的舊副本（Codex 同名 skill 不合併，舊版會搶先自動觸發）：" -ForegroundColor Yellow
        $targets | ForEach-Object { Write-Host "    $_" }
    }
    if ($sameNameSkipped.Count) { Write-Host "  （同名但簽名不符（frontmatter name 或「（繁中）」字樣）、視為你自己的 skill、不動：$($sameNameSkipped -join '、')）" }
    if ($agentsMdHits.Count) {
        Write-Host "  $agentsMd 第 $($agentsMdHits -join '、') 行含「dev-workflow」或「一律進」：這會讓舊版自動攔截復活，請自行檢視；本腳本不動這個檔。" -ForegroundColor Yellow
    }
    if (-not $targets.Count) { return }
    if ($ListOnly) { Write-Host "  清理請跑：pwsh -File scripts/install-codex.ps1 -Migrate -Yes"; return }

    $bakDir = Join-Path $AgentsHome "bstack-migrate-bak-$RunStamp"
    # Read-Host 在非互動（stdin 接 null）時回 $null，不能直接 .ToLower()
    $ans = if ($Yes) { 'y' } else { Read-Host "  搬到 $bakDir 備份（不直接刪）？[y/n]" }
    $go = -not [string]::IsNullOrWhiteSpace($ans) -and $ans.Trim().ToLower() -eq 'y'
    if (-not $go) { Write-Host "  不搬；之後可跑 -Migrate 再處理"; return }
    # 不直接 Remove-Item：判定是簽名推定、可能誤判，搬進備份目錄讓使用者能救回來
    foreach ($x in $targets) {
        $dest = Join-Path $bakDir "skills/$(Split-Path $x -Leaf)"
        if ($DryRun) { Write-Host "  [whatif] 搬 $x → $dest"; continue }
        New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null
        Move-Item -LiteralPath $x -Destination $dest -Force
        Write-Host "  已搬 $x → $dest"
    }
    if (-not $DryRun) { Write-Host "  完成。舊副本在 $bakDir，確認 plugin 版正常後可自行刪除；請重開 Codex session。" }
}

function Invoke-Uninstall {
    <#
    .SYNOPSIS 依 manifest 拆掉自己加的：codex plugin remove → 刪自己複製的 agents → config.toml 只拔 [tools.update_plan] 那個表 → 刪 manifest。
    .DESCRIPTION 沒 manifest 時只跑 plugin remove（agents / config 不知道哪些是自己加的、不動）。marketplace 不拆：
      使用者可能還有別的東西靠它；要拆自己跑 codex plugin marketplace remove bstack。
      config 只拔「[tools.update_plan] 表且表內有效內容恰為 enabled = true」：使用者後來在表裡加了別的 key 就不動、請他自己看。
      舊版（定界註解）留下的兩行註解順手拔掉、只拔註解本身。
    #>
    Step 'U' "解除安裝（manifest：$ManifestPath）"
    $m = Read-Manifest
    if (-not $m) { Write-Host "  找不到或讀不了 $ManifestPath：只跑 codex plugin remove，agents / config.toml 不動" -ForegroundColor Yellow }
    if (Find-Codex) {
        $rc = Run-Codex @('plugin', 'remove', $PluginId)
        if ($rc -ne 0) { Write-Host "  codex plugin remove 回傳 $rc（可能本來就沒裝），繼續拆其他項目" -ForegroundColor Yellow }
    } else { Write-Host "  找不到 codex CLI，跳過 plugin remove；其餘照拆" -ForegroundColor Yellow }
    if (-not $m) { return }

    foreach ($a in @($m.agents)) {
        if (-not $a) { continue }
        # manifest 是使用者可寫的檔：agents[] 只准純檔名（security-audit M2：Join-Path 對 ..\ 或絕對路徑會直接沿用、刪到別處）
        if ([string]$a -notmatch '^[\w.\-]+\.toml$') { Write-Host "  manifest 的 agents 有非純檔名項目「$a」，跳過不刪" -ForegroundColor Yellow; continue }
        $p = Join-Path $AgentsDest $a
        if (-not (Test-Path -LiteralPath $p)) { continue }
        if ($DryRun) { Write-Host "  [whatif] 刪 $p"; continue }
        Remove-Item -LiteralPath $p -Force; Write-Host "  已刪 $p"
    }
    if ($m.config_patched -and (Test-Path -LiteralPath $ConfigPath)) {
        $t = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8
        # 表頭到下一個表頭（或檔尾）就是這個表；表內「有效行」（去註解、去空白）恰為 enabled = true 才是本腳本加的原樣
        $tablePattern = '(?ms)^[ \t]*\[tools\.update_plan\][ \t]*\r?\n(?<body>.*?)(?=^[ \t]*\[|\z)'
        $removed = $false
        if ($t -match $tablePattern) {
            $effective = @(($Matches['body'] -split "\r?\n") | ForEach-Object { ($_ -replace '#.*$', '').Trim() } | Where-Object { $_ })
            if ($effective.Count -eq 1 -and $effective[0] -match '^enabled\s*=\s*true$') {
                if ($DryRun) { Write-Host "  [whatif] $ConfigPath 拔掉 [tools.update_plan] 這個表（先備份）" }
                else { Backup-File $ConfigPath; $t = $t -replace $tablePattern, ''; $removed = $true }
            } else { Write-Host "  $ConfigPath 的 [tools.update_plan] 表裡有本腳本沒寫的內容（$($effective -join ' / ')），不動它；請自行檢查" -ForegroundColor Yellow }
        } else { Write-Host "  $ConfigPath 沒有 [tools.update_plan] 表（可能已手動拿掉），不動它" -ForegroundColor Yellow }
        # 舊版定界註解：只拔註解行本身，中間不管有什麼都不碰
        $hadMarker = $false
        foreach ($mk_ in $LegacyMarkers) { $esc = [regex]::Escape($mk_); if ($t -match "(?m)^$esc[ \t]*\r?\n?") { $t = $t -replace "(?m)^$esc[ \t]*\r?\n?", ''; $hadMarker = $true } }
        if ($hadMarker) { if ($DryRun) { Write-Host "  [whatif] 順手拔掉舊版的兩行定界註解" } else { Backup-File $ConfigPath; $removed = $true } }
        if ($removed -and -not $DryRun) { Write-Utf8NoBom $ConfigPath ($t -replace "(\r?\n){3,}", "`n`n"); Write-Host "  已從 $ConfigPath 拔掉 [tools.update_plan]$(if ($hadMarker) { ' 與舊版定界註解' })" }
    }
    if ($DryRun) { Write-Host "  [whatif] 刪 manifest $ManifestPath" }
    else { Remove-Item -LiteralPath $ManifestPath -Force; Write-Host "  已刪 $ManifestPath" }
    Write-Host ""
    Write-Host "已解除。marketplace 沒拆，需要的話：codex plugin marketplace remove $MarketplaceName" -ForegroundColor Green
}

# ── 分流：-Uninstall / -Migrate 各自跑完就結束 ──────────────────────────────
if ($Uninstall) { Invoke-Uninstall; exit 0 }
if ($Migrate) { Step '1.5' '清舊副本'; Invoke-Migrate; exit 0 }

# ── 1. 前置檢查 ──────────────────────────────────────────────────────────────
Step 1 '前置檢查'
$ok = $true
if (Find-Codex) {
    Write-Host "  ✔ codex CLI：$((& $script:CodexExe --version 2>$null | Select-Object -First 1))"
    if ($script:CodexFromFallback) { Write-Host "  提醒：codex 不在這個 shell 的 PATH，本次改用 $script:CodexExe；官方安裝腳本只對新開的 shell 更新 PATH，用完請重開 shell。" -ForegroundColor Yellow }
} else {
    Write-Host '  ✘ 找不到 codex CLI。安裝：powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"（裝完重開 shell 再跑本腳本）' -ForegroundColor Red; $ok = $false
}
# hook 是 node 腳本（hooks/guard.mjs），Codex 不自帶 node，缺了 hook 起不來、branch 保護不存在
if (Get-Command node -ErrorAction SilentlyContinue) { Write-Host "  ✔ node $((node --version 2>$null))（hook 用）" }
else { Write-Host "  ✘ 找不到 node：hook 起不來、branch 保護不存在。Windows：winget install OpenJS.NodeJS.LTS；macOS：brew install node" -ForegroundColor Red; $ok = $false }
if (Get-Command git -ErrorAction SilentlyContinue) { Write-Host "  ✔ git" }
else { Write-Host "  ✘ 找不到 git（marketplace 從 GitHub 抓要用）。Windows：winget install --id Git.Git；macOS：brew install git" -ForegroundColor Red; $ok = $false }
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'skills'))) { Write-Host "  ✘ 找不到 $RepoRoot\skills，請在 clone 的 repo 內跑" -ForegroundColor Red; $ok = $false }
if (-not $ok) { exit 1 }
Write-Host "  CODEX_HOME = $CodexHome；manifest 會寫在 $ManifestPath"

# ── 1.5 清舊副本 ─────────────────────────────────────────────────────────────
Step '1.5' '清舊副本（~/.agents/skills）'
if ($SkipMigrate) { Write-Host '  跳過（-SkipMigrate）' } else { Invoke-Migrate }

# ── 2. marketplace ───────────────────────────────────────────────────────────
Step 2 'marketplace'
$srcArg = if ($Source -eq 'local') { $RepoRoot } else { $GithubRepo }
$mk = Get-CodexJson @('plugin', 'marketplace', 'list', '--json')
$have = $null
if ($mk -and $mk.marketplaces) { $have = @($mk.marketplaces | Where-Object { $_.name -eq $MarketplaceName }) | Select-Object -First 1 }
if ($have) {
    Write-Host "  marketplace $MarketplaceName 已存在（root = $($have.root)），略過 codex plugin marketplace add $srcArg"
    # 既有的來源跟這次 -Source 要的不一樣就講清楚：github 要的是 clone 進 ~/.codex 的 tracked 樹，root 若是本機 repo 就代表之前用 local 加的
    $haveRoot = [string]$have.root
    $isLocalRoot = $haveRoot -and (Test-Path -LiteralPath $haveRoot) -and ((Resolve-Path -LiteralPath $haveRoot).Path.TrimEnd('\', '/') -eq $RepoRoot.TrimEnd('\', '/'))
    if ($Source -eq 'github' -and $isLocalRoot) { Write-Host "  注意：既有 marketplace 指向本機 repo（$haveRoot），不是 -Source github 要的 GitHub 來源；接下來 plugin add 會複製整個 working tree。要改用 GitHub：codex plugin marketplace remove $MarketplaceName 後重跑本腳本" -ForegroundColor Yellow }
    elseif ($Source -eq 'local' -and -not $isLocalRoot) { Write-Host "  注意：既有 marketplace 的 root（$haveRoot）不是這個 repo；-Source local 沒有生效。要換來源：codex plugin marketplace remove $MarketplaceName 後重跑本腳本" -ForegroundColor Yellow }
} else {
    Write-Host "  供應鏈提醒：marketplace 來源是 $srcArg，plugin 內含會在你每個專案執行的 PreToolUse hook（hooks/guard.mjs）；裝之前請自行看過原始碼。" -ForegroundColor Yellow
    if ($Source -eq 'local') { Write-Host "  -Source local 會複製整個 working tree（含 ignored 目錄）進 plugin cache，Windows 實測較容易撞到「存取被拒 (os error 5)」；github 來源只有 tracked 檔、樹小得多。" }
    $mkRc = Run-Codex @('plugin', 'marketplace', 'add', $srcArg)
    # GitHub 來源在有防毒即時掃描的機器上會每次都撞「存取被拒 (os error 5)」：Codex clone 完立刻 rename，剛寫入的檔還被掃描器抓著
    # （2026-09-09 實測 Trellix：clone 後 0 秒 rename 被拒、10 秒後才放行）。退到本機來源：這個 clone 就是 marketplace root，不用再 clone
    if ($mkRc -ne 0 -and $Source -eq 'github' -and $script:LastCodexOutput -match 'os error 5|存取被拒|Access is denied') {
        Write-Host "  GitHub 來源在這台機器撞到 clone 後 rename 被拒（多半是防毒即時掃描），改用本機來源 $RepoRoot" -ForegroundColor Yellow
        $srcArg = $RepoRoot; $Source = 'local'
        $mkRc = Run-Codex @('plugin', 'marketplace', 'add', $srcArg)
    }
    if ($mkRc -ne 0) { Write-Host "  marketplace add 失敗" -ForegroundColor Red; exit 1 }
}

# ── 3. plugin ────────────────────────────────────────────────────────────────
Step 3 'plugin'
# Windows 對本機 marketplace 的 add 是「複製整個樹 → rename 進 cache」，rename 間歇被拒（Task 0 實測 9 次中 6 次失敗、
# 推斷是剛寫入的大量檔案還被掃描類程序持有 handle）；重試幾秒後通常會過。
$maxTry = 3; $rc = 1; $tries = 0
for ($i = 1; $i -le $maxTry; $i++) {
    $tries = $i
    $rc = Run-Codex @('plugin', 'add', $PluginId)
    if ($rc -eq 0) { break }
    # 只對那個 rename 競態重試；登入失敗、plugin id 打錯、marketplace 不在等確定性錯誤直接停，不白等 6 秒
    $transient = $script:LastCodexOutput -match 'os error 5|存取被拒|Access is denied|failed to activate plugin cache entry'
    if (-not $transient) { break }
    if ($i -lt $maxTry) { Write-Host "  codex plugin add 撞到 cache rename 被拒（第 $i/$maxTry 次），3 秒後重試…" -ForegroundColor Yellow; Start-Sleep -Seconds 3 }
}
if ($rc -ne 0) {
    if ($tries -ge $maxTry) { Write-Host "  codex plugin add $PluginId 連續 $maxTry 次「存取被拒 (os error 5)」：那是 Windows 複製大樹後 rename 被拒；改用 -Source github（預設）樹小、較不易撞到，或稍後再跑一次本腳本。" -ForegroundColor Red }
    else { Write-Host "  codex plugin add $PluginId 失敗（rc=$rc），錯誤不是暫時性的，不重試；看上面 codex 的訊息處理後再跑。" -ForegroundColor Red }
    exit 1
}

# manifest：重裝時聯集既有紀錄，agents[] 不遺失
$manifest = Read-Manifest
if (-not $manifest) { $manifest = [pscustomobject]@{ version = 1; installed_at = $null; marketplace = $null; plugin = $PluginId; agents = @(); config_patched = $false } }
# 手改過的 manifest 可能缺欄位：先補齊再賦值（EAP Stop 下對不存在的屬性賦值會 throw）
foreach ($k in 'installed_at', 'marketplace', 'plugin', 'agents', 'config_patched') {
    if (-not $manifest.PSObject.Properties[$k]) { $manifest | Add-Member -NotePropertyName $k -NotePropertyValue $(if ($k -eq 'agents') { @() } elseif ($k -eq 'config_patched') { $false } else { $null }) }
}
$manifest.installed_at = (Get-Date).ToString('o')
$manifest.plugin = $PluginId
$manifest.marketplace = [pscustomobject]@{ name = $MarketplaceName; source = $(if ($have) { "$($have.root)（既有）" } else { $srcArg }) }

# ── 4. agents ────────────────────────────────────────────────────────────────
Step 4 'agents（codex/agents/*.toml → $CODEX_HOME/agents/）'
if ($SkipAgents) { Write-Host '  跳過（-SkipAgents）' }
elseif (-not (Test-Path -LiteralPath $AgentsSrc)) { Write-Host "  找不到 codex/agents/，先跑 node scripts/gen-codex-agents.mjs；本步跳過（沒複製時 hosts.md 規定退成 explorer + agent 本文當 prompt）" -ForegroundColor Yellow }
else {
    $tomls = @(Get-ChildItem -LiteralPath $AgentsSrc -Filter *.toml)
    if (-not $tomls.Count) { Write-Host "  codex/agents/ 沒有 .toml，跳過" }
    $overwriteAll = $false
    $recorded = [System.Collections.Generic.List[string]]::new()
    foreach ($a in @($manifest.agents)) { if ($a) { $recorded.Add([string]$a) } }
    if ($tomls.Count -and -not $DryRun) { New-Item -ItemType Directory -Path $AgentsDest -Force | Out-Null }
    foreach ($f in $tomls) {
        $dest = Join-Path $AgentsDest $f.Name
        $mine = $recorded.Contains($f.Name)
        if ((Test-Path -LiteralPath $dest) -and -not $mine -and -not $overwriteAll) {
            # 不是自己上次放的檔：可能是使用者自己寫的 agent，問過才蓋；-Yes 一律跳過
            $c = Ask "  $dest 已存在且不是本腳本放的：[o] 覆蓋 / [s] 跳過 / [a] 全部覆蓋" 's'
            if ($c -eq 'A') { $overwriteAll = $true }
            elseif ($c -ne 'O') { Write-Host "  [skip] $($f.Name)"; continue }
        }
        # 蓋掉不是自己放的檔之前先備份（之後 -Uninstall 會把它當自己的刪掉，備份是唯一救回路）
        if ((Test-Path -LiteralPath $dest) -and -not $mine) { Backup-File $dest }
        if ($DryRun) { Write-Host "  [whatif] 複製 $($f.FullName) → $dest" }
        else {
            Copy-Item -LiteralPath $f.FullName -Destination $dest -Force
            Write-Host "  [copy] $($f.Name)"
        }
        if (-not $recorded.Contains($f.Name)) { $recorded.Add($f.Name) }
    }
    $manifest.agents = @($recorded)
}

# ── 5. config.toml ───────────────────────────────────────────────────────────
Step 5 'config.toml（tools.update_plan）'
$cfg = if (Test-Path -LiteralPath $ConfigPath) { Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 } else { '' }
# 三種既有寫法都認：[tools.update_plan] 表內 enabled = true、[tools] 表內 update_plan.enabled = true、inline table
$hasTable = $cfg -match '(?m)^\s*\[tools\.update_plan\]'
# 只看 [tools.update_plan] 表自己那段（到下一個 [ 表頭或檔尾），別把別表的 enabled = true 算進來
$tableSection = if ($cfg -match '(?ms)^\s*\[tools\.update_plan\]\s*\r?\n(.*?)(?=^\s*\[|\z)') { $Matches[1] } else { '' }
$alreadyOn = ($hasTable -and $tableSection -match '(?m)^\s*enabled\s*=\s*true') `
    -or ($cfg -match '(?m)^\s*update_plan\.enabled\s*=\s*true') `
    -or ($cfg -match 'update_plan\s*=\s*\{[^}]*enabled\s*=\s*true')
# 頂層 `tools = { … }` inline table 也算已定義：TOML 禁止再用 [tools.update_plan] 擴充 inline table，append 會讓整份 config 讀不了
$hasOtherDef = $hasTable -or ($cfg -match '(?m)^\s*update_plan(\.enabled)?\s*=') -or ($cfg -match '(?m)^\s*tools\s*=\s*\{')
if ($alreadyOn) { Write-Host "  $ConfigPath 已有 tools.update_plan.enabled = true，不動" }
elseif ($hasOtherDef) {
    # 已有定義但不是 true（或 tools 是 inline table）：再 append 一個 [tools.update_plan] 會變 TOML 重複表 / 非法擴充、整個 config 讀不了，只能請使用者手改
    Write-Host "  $ConfigPath 已有 tools / tools.update_plan 的設定但不是 enabled = true；為避免 TOML 重複表或擴充 inline table，本腳本不 append，請自行加上 tools.update_plan.enabled = true（任務追蹤靠它）" -ForegroundColor Yellow
} else {
    $block = "[tools.update_plan]`nenabled = true`n"
    $how = if (Test-Path -LiteralPath $ConfigPath) { "備份 $ConfigPath.bak-$RunStamp 後 append" } else { "建立 $ConfigPath 並寫入" }
    if ($DryRun) { Write-Host "  [whatif] ${how}：`n    [tools.update_plan]`n    enabled = true" }
    else {
        Backup-File $ConfigPath
        $body = $cfg.TrimEnd("`r", "`n")
        $sep = if ([string]::IsNullOrWhiteSpace($body)) { '' } else { "`n`n" }
        New-Item -ItemType Directory -Path $CodexHome -Force | Out-Null
        Write-Utf8NoBom $ConfigPath ($body + $sep + $block)
        Write-Host "  已在 $ConfigPath 加入 [tools.update_plan] enabled = true"
    }
    $manifest.config_patched = $true
}
Save-Manifest $manifest

# ── 收尾 ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "接下來：" -ForegroundColor Green
Write-Host "  1. 開新 Codex session（既有 session 不會載入新 plugin）"
Write-Host "  2. 打 /hooks 信任 bstack 的 PreToolUse hook——Codex 對 plugin hook 預設不信任，不信任就沒有 branch-safety / file-type 保護"
Write-Host '  3. 用法：$bstack:devwork <要做的事>（skill 呼叫名帶 bstack: 命名空間，Task 0 用 codex debug prompt-input 實測）'
Write-Host "  4. 若 skill 清單還看到不帶命名空間的 dev-workflow / db-access → 舊副本還在，跑 pwsh -File scripts/install-codex.ps1 -Migrate -Yes"
if ($script:CodexFromFallback) { Write-Host "  5. 重開 shell 讓 codex 進 PATH" }
Write-Host "  反悔：pwsh -File scripts/install-codex.ps1 -Uninstall（依 $ManifestPath 只拆本腳本加的）"
if ($DryRun) { Write-Host "  （-WhatIf：以上都沒有真的做）" }
