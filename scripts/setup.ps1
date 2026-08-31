#!/usr/bin/env pwsh
<#
.SYNOPSIS
  將本 repo 的 skill / hook / agent / settings 全套 sync 至 global `~/.claude/`。

.DESCRIPTION
  動作（idempotent；除 settings.json 外直接覆蓋既有檔、不備份）：
    1. 開頭印備份提醒（不強制等按鍵；user 自行決定中斷與否）
    2. Pre-flight：claude CLI / git / pwsh / jq（缺則錯誤）
    3. Sync repo → global：
         CLAUDE.md                       → CLAUDE.md
         statusline.sh                   → statusline.sh
         hooks/branch-safety.ps1         → hooks/branch-safety.ps1
         hooks/file-type-guard.ps1       → hooks/file-type-guard.ps1
         skills/<name>/SKILL.md          → skills/<name>/SKILL.md     （遞迴整個 skills/）
         agents/<name>.md                → agents/<name>.md
         settings.json                   → settings.json（**merge、非覆蓋**；轉 ${CLAUDE_PROJECT_DIR} 為絕對路徑）
    4. playwright MCP：user scope 未裝則裝上（含 --isolated；已裝但缺 flag 只警告不代改）
    5. 孤兒偵測：列出 global 有、repo 沒有的 skill / agent（**預設不刪**，需 -RemoveOrphans）

  settings.json merge 語意（本機優先）：
    hooks / statusLine        → 以 repo 為準（更新 hook 路徑正是本腳本目的）
    其餘所有 key（permissions.allow / defaultMode / model / theme / ...）
                              → 本機既有值原封保留；本機沒有的 key 才補 repo 值
  原因：`/config` 寫的設定存在 ~/.claude/settings.json，整檔覆蓋會把它們全洗掉。

  全 standalone：不裝 marketplace / plugin、不跑 bun。
  MCP：只管 playwright（見上 step 4）；mysql MCP 由 user 自行安裝。

.NOTES
  Windows + pwsh 7+。
  須在 repo 內執行（`git rev-parse --show-toplevel` 取 repo root）。

.PARAMETER SkipPrereqCheck
  跳 pre-flight 版本檢查（debug 用）。

.PARAMETER Yes
  跳備份提醒（適 CI / 自動化）。**不代表同意刪除孤兒。**

.PARAMETER RemoveOrphans
  同意刪除孤兒（`~/.claude/skills` 與 `~/.claude/agents` 內 repo 沒有的項目）。
  **不給這個開關就只列出、不刪。** `-Yes` 不代表同意刪除——它只跳備份提醒。
#>

[CmdletBinding()]
param(
    [switch]$SkipPrereqCheck,
    [switch]$Yes,
    [switch]$RemoveOrphans
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

function Test-JsonObject {
    <#
    .SYNOPSIS
      判斷值是否為 JSON object（可再往下 merge），排除 array / 純量 / null。
    .DESCRIPTION
      ConvertFrom-Json 的 object 會是 PSCustomObject；array 是 Object[]、
      純量是 string / int / bool。只有兩邊都是 object 才遞迴。
    #>
    param($Value)

    if ($null -eq $Value) { return $false }
    return ($Value -is [System.Management.Automation.PSCustomObject])
}

function Merge-LocalFirst {
    <#
    .SYNOPSIS
      深層 merge：本機值優先，repo 值只補本機缺的 key。
    .DESCRIPTION
      兩邊都是 object → 逐 key 遞迴。
      任一邊非 object（array / 純量）→ 本機值直接勝，不做聯集。
      原因：permissions.allow 之類的陣列做聯集會讓「移除規則」永遠失效。
    #>
    param($Local, $Repo)

    # 陣列不可直接 return：pipeline 會展開它，空陣列變 $null、單元素變純量，
    # 寫回 settings.json 就成 "deny": null / "allow": "Read"（違反 schema）。以 , 包一層保原型。
    if ($null -eq $Local) { if ($Repo -is [array]) { return ,$Repo } else { return $Repo } }
    if ($null -eq $Repo) { if ($Local -is [array]) { return ,$Local } else { return $Local } }
    if (-not (Test-JsonObject $Local) -or -not (Test-JsonObject $Repo)) {
        if ($Local -is [array]) { return ,$Local } else { return $Local }
    }

    $merged = [ordered]@{}
    foreach ($p in $Local.PSObject.Properties) { $merged[$p.Name] = $p.Value }
    foreach ($p in $Repo.PSObject.Properties) {
        if ($merged.Contains($p.Name)) {
            $merged[$p.Name] = Merge-LocalFirst -Local $merged[$p.Name] -Repo $p.Value
        } else {
            $merged[$p.Name] = $p.Value
        }
    }
    return [pscustomobject]$merged
}

function Merge-GlobalSettings {
    <#
    .SYNOPSIS
      算出要寫回 global settings.json 的內容：本機優先 merge + repo 權威區塊強制覆蓋。
    .PARAMETER RepoOwned
      無論本機有什麼、一律以 repo 為準的 top-level key（hooks / statusLine）。
      這兩塊是 setup 的核心用途（同步 hook 路徑），本機優先會讓腳本失去意義。
    #>
    param(
        $Local,
        [Parameter(Mandatory)]$Repo,
        [string[]]$RepoOwned = @('$schema', 'hooks', 'statusLine')
    )

    if ($null -eq $Local) { return $Repo }

    $merged = Merge-LocalFirst -Local $Local -Repo $Repo

    $dict = [ordered]@{}
    foreach ($p in $merged.PSObject.Properties) { $dict[$p.Name] = $p.Value }
    foreach ($key in $RepoOwned) {
        $repoProp = $Repo.PSObject.Properties[$key]
        if ($repoProp) { $dict[$key] = $repoProp.Value }
    }
    return [pscustomobject]$dict
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
    Write-Host "  ~/.claude/hooks/branch-safety.ps1"
    Write-Host "  ~/.claude/hooks/file-type-guard.ps1"
    Write-Host "  ~/.claude/skills/<本 repo 列出的 skill 全部>"
    Write-Host "  ~/.claude/agents/<本 repo 列出的 agent 全部>"
    Write-Host ""
    Write-Host "  覆蓋是**直接覆蓋、不備份**。" -ForegroundColor Yellow
    Write-Host "  若 ~/.claude/ 內有手動加的內容、請先備份後再執行。" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  例外 — ~/.claude/settings.json 是**merge、不覆蓋**：" -ForegroundColor Yellow
    Write-Host "    hooks / statusLine 取 repo 版；其餘 key（permissions、/config 寫的"
    Write-Host "    model / theme / defaultMode 等）維持本機現值、本機沒有的才補上。"
    Write-Host ""
    Write-Host "  注意：本 repo 列出範圍**之外**的檔案不會動 — " -ForegroundColor Yellow
    Write-Host "  舊 plugin / 舊 skill 若仍存在仍會生效、可能與本 repo skill 衝突。" -ForegroundColor Yellow
    Write-Host "  建議結束後手動清理 ~/.claude/skills 與 ~/.claude/plugins 內非本 repo 內容。" -ForegroundColor Yellow
    Write-Host ""
    if ($Yes) {
        Write-Host "  -Yes flag 已帶、跳備份提醒確認。" -ForegroundColor Yellow
    } else {
        Write-Host "  繼續執行 setup？[y/N]: " -ForegroundColor Yellow -NoNewline
        $reply = (Read-Host).Trim().ToLower()
        if ($reply -ne 'y' -and $reply -ne 'yes') {
            Write-Host ""
            Write-Host "  使用者中斷、不執行 setup。" -ForegroundColor Yellow
            exit 0
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

    # 既有 global settings 讀進來當底（本機優先）；讀不到 / 壞掉才退回純寫入
    $localSettings = $null
    if (Test-Path $globalSettingsPath) {
        try {
            $raw = Get-Content $globalSettingsPath -Raw
            if (-not [string]::IsNullOrWhiteSpace($raw)) {
                $localSettings = $raw | ConvertFrom-Json
            }
        } catch {
            Write-Warning "  既有 $globalSettingsPath 不是合法 JSON，改為直接寫入 repo 版（本機內容將遺失）"
            $localSettings = $null
        }
    }

    $finalSettings = Merge-GlobalSettings -Local $localSettings -Repo $repoSettings

    $finalSettings | ConvertTo-Json -Depth 10 | Set-Content $globalSettingsPath -Encoding UTF8
    if ($localSettings) {
        Write-Host "  [merge] $globalSettingsPath（hooks / statusLine 取 repo；其餘本機設定保留）"
    } else {
        Write-Host "  [new  ] $globalSettingsPath（本機原無設定；寫入 repo 版）"
    }
}

# === Step 2: Ensure playwright MCP ===

function Invoke-EnsurePlaywrightMcp {
    <#
    .SYNOPSIS
      確保 user scope 裝有 playwright MCP，且帶 --isolated。

    .DESCRIPTION
      --isolated 讓瀏覽器 profile 只存在記憶體、不落磁碟。少了它，多個
      Claude Code session 共用同一個 profile 目錄，被 Chrome 的排他鎖擋住，
      第二個 session 開瀏覽器時報 "Browser is already in use"。

      三種情形分別處理：
        未安裝        → 直接裝（--scope user，由 claude CLI 寫入 ~/.claude.json）
        已裝且帶 flag → 跳過
        已裝但缺 flag → 只警告並印修復指令，不代改

      最後一種刻意不自動修：既有設定可能帶其他自訂參數，
      remove + add 會把它們一併洗掉。

      設定檔一律交 claude CLI 讀寫。~/.claude.json 內含深層 session 狀態，
      用 ConvertTo-Json 回寫會因 -Depth 截斷而毀損，故本函式只讀不寫。
    #>
    param(
        [Parameter(Mandatory)][string]$GlobalDir
    )

    Write-Section "Step 2: playwright MCP（user scope）"

    $addCmdText = "claude mcp add --scope user playwright -- npx -y `"@playwright/mcp@latest`" --sandbox --isolated"
    $configPath = Join-Path (Split-Path $GlobalDir -Parent) '.claude.json'

    # 讀既有設定；讀不到或壞掉一律當「未安裝」，讓後面的安裝流程接手
    $existingArgs = $null
    if (Test-Path $configPath) {
        try {
            $raw = Get-Content $configPath -Raw
            if (-not [string]::IsNullOrWhiteSpace($raw)) {
                $pw = ($raw | ConvertFrom-Json).mcpServers.playwright
                if ($pw) { $existingArgs = @($pw.args) }
            }
        } catch {
            Write-Warning "  $configPath 讀不到或不是合法 JSON，改以「未安裝」處理"
        }
    }

    if ($null -ne $existingArgs) {
        if ($existingArgs -contains '--isolated') {
            Write-Host "  [skip ] 已安裝且帶 --isolated"
            return
        }
        Write-Warning "  已安裝但缺 --isolated：多個 session 會互搶瀏覽器 profile 鎖。"
        Write-Warning "  現有參數：$($existingArgs -join ' ')"
        Write-Warning "  確認無其他自訂參數後，執行這兩行修復："
        Write-Host   "    claude mcp remove playwright --scope user"
        Write-Host   "    $addCmdText"
        return
    }

    # npx 缺席不擋安裝：設定寫得進去，只是屆時瀏覽器起不來
    if (-not (Test-CommandExists 'npx')) {
        Write-Warning "  未偵測到 npx（需 Node.js）。設定仍會寫入，但啟動瀏覽器時會失敗。"
    }

    Write-Host "  安裝中…"
    & claude mcp add --scope user playwright -- npx -y '@playwright/mcp@latest' --sandbox --isolated
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "  安裝失敗（exit $LASTEXITCODE）。可手動執行：$addCmdText"
        return
    }
    Write-Host "  [new  ] 已安裝（--sandbox --isolated）"
}

# === Step 3: 孤兒偵測 ===

function Get-OrphanItems {
    <#
    .SYNOPSIS
      比對 repo 與 global，回傳孤兒清單。**只掃 skills 與 agents，不碰其他任何東西。**

    .DESCRIPTION
      純比對，不刪任何檔案。

      前置守衛：repo 側 skills 或 agents 清單為空 → 直接回空並警告。
      理由：`$repoRoot` 取自 cwd（見 main 區），若在別的 repo 或空 working tree 執行，
      global 的每一個項目都會被判成孤兒。sync 端遇到 repo 無 skills/ 是靜默跳過，
      最壞組合是「sync 什麼都沒做、刪除照跑全力」。

    .OUTPUTS
      hashtable：@{ Whole = <整包孤兒路徑>; Stale = <活 skill 內的殘留檔路徑> }
    #>
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$GlobalDir
    )

    $empty = @{ Whole = @(); Stale = @() }

    $repoSkills   = Join-Path $RepoRoot 'skills'
    $repoAgents   = Join-Path $RepoRoot 'agents'
    $globalSkills = Join-Path $GlobalDir 'skills'
    $globalAgents = Join-Path $GlobalDir 'agents'

    # --- 前置守衛：repo 側清單為空就中止 ---
    $repoSkillNames = @()
    if (Test-Path -LiteralPath $repoSkills) {
        $repoSkillNames = @(Get-ChildItem -LiteralPath $repoSkills -Directory | ForEach-Object { $_.Name })
    }
    $repoAgentNames = @()
    if (Test-Path -LiteralPath $repoAgents) {
        $repoAgentNames = @(Get-ChildItem -LiteralPath $repoAgents -File -Filter '*.md' | ForEach-Object { $_.Name })
    }

    if ($repoSkillNames.Count -eq 0 -or $repoAgentNames.Count -eq 0) {
        Write-Warning "  repo 側清單為空（skills=$($repoSkillNames.Count) / agents=$($repoAgentNames.Count)），孤兒偵測中止，不刪任何東西。"
        return $empty
    }

    $whole = @()
    $stale = @()

    # --- skills：整包孤兒 + 活 skill 內的殘留檔 ---
    if (Test-Path -LiteralPath $globalSkills) {
        foreach ($g in Get-ChildItem -LiteralPath $globalSkills -Directory) {
            if ($repoSkillNames -notcontains $g.Name) {
                $whole += $g.FullName          # 整包孤兒；不再逐檔列它底下的檔
                continue
            }
            $repoDir = Join-Path $repoSkills $g.Name
            $repoRel = @(Get-ChildItem -LiteralPath $repoDir -Recurse -File |
                         ForEach-Object { $_.FullName.Substring($repoDir.Length).TrimStart('\','/') })
            foreach ($gf in Get-ChildItem -LiteralPath $g.FullName -Recurse -File) {
                $rel = $gf.FullName.Substring($g.FullName.Length).TrimStart('\','/')
                if ($repoRel -notcontains $rel) { $stale += $gf.FullName }
            }
        }
    }

    # --- agents：單檔比對 ---
    if (Test-Path -LiteralPath $globalAgents) {
        foreach ($ga in Get-ChildItem -LiteralPath $globalAgents -File -Filter '*.md') {
            if ($repoAgentNames -notcontains $ga.Name) { $whole += $ga.FullName }
        }
    }

    # `,` 包一層：避免空陣列變 $null、單元素被展開成純量（同 Merge-LocalFirst 的處理）
    return @{ Whole = ,$whole; Stale = ,$stale }
}

function Invoke-DetectOrphans {
    <#
    .SYNOPSIS
      列出孤兒；**預設不刪**。刪除需顯式 `-AutoRemove`（由 main 的 `-RemoveOrphans` 傳入）。

    .DESCRIPTION
      兩態，**沒有互動確認**：
        1. 預設                → 只列出 + 印出刪除指令
        2. `-AutoRemove`       → 刪除

      為什麼不做互動確認：Windows 上用來判斷「有沒有互動終端」的那個 .NET 屬性
      實測恆為 True（只有 Windows Service 才是 False），偵測不到非互動執行；
      而 `yes | pwsh -File setup.ps1` 會把每個互動提示餵成 y，等於無人值守刪除。
      「驗不到又會刪東西」的分支直接不做——本函式全程不讀任何使用者輸入。
      要不要刪由呼叫端（人或 agent）決定後用 `-RemoveOrphans` 重跑。

      `-Yes` **不代表同意刪除**——它只跳備份提醒。
    #>
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$GlobalDir,
        [switch]$AutoRemove
    )

    Write-Section "Step 3: 孤兒偵測（global 有、repo 沒有）"

    if ($PSVersionTable.PSVersion.Major -lt 7) {
        Write-Warning "  PowerShell $($PSVersionTable.PSVersion) < 7，跳過孤兒偵測（舊版 Remove-Item 對 junction 的行為不可靠）。"
        return
    }

    $found = Get-OrphanItems -RepoRoot $RepoRoot -GlobalDir $GlobalDir
    $wholeList = @($found.Whole)
    $staleList = @($found.Stale)

    if ($wholeList.Count -eq 0 -and $staleList.Count -eq 0) {
        Write-Host "  無孤兒：global 的 skills / agents 與 repo 一致。"
        return
    }

    if ($wholeList.Count -gt 0) {
        Write-Host ""
        Write-Host "  整包孤兒（repo 已無同名 skill / agent）：" -ForegroundColor Yellow
        $wholeList | ForEach-Object { Write-Host "    $_" }
    }
    if ($staleList.Count -gt 0) {
        Write-Host ""
        Write-Host "  殘留檔（skill 還在，但這些檔 repo 已無）：" -ForegroundColor Yellow
        $staleList | ForEach-Object { Write-Host "    $_" }
    }
    Write-Host ""

    # --- 比例上限：孤兒數超過 global 總數一半 → 判定為偵測異常，強制只列出 ---
    $globalTotal = 0
    $gs = Join-Path $GlobalDir 'skills'
    $ga = Join-Path $GlobalDir 'agents'
    if (Test-Path -LiteralPath $gs) { $globalTotal += @(Get-ChildItem -LiteralPath $gs -Directory).Count }
    if (Test-Path -LiteralPath $ga) { $globalTotal += @(Get-ChildItem -LiteralPath $ga -File -Filter '*.md').Count }

    if ($AutoRemove -and $globalTotal -gt 0 -and $wholeList.Count -gt ($globalTotal / 2)) {
        Write-Warning "  整包孤兒 $($wholeList.Count) 項 > global 總數 $globalTotal 的一半 —— 判定為偵測異常，強制只列出、不刪。"
        Write-Host "  若確認無誤，請自行逐項刪除上列路徑。"
        return
    }

    if (-not $AutoRemove) {
        Write-Host "  **預設不刪**。確認要刪的話，重跑並加上 -RemoveOrphans：" -ForegroundColor Cyan
        Write-Host "    pwsh -NoProfile -File scripts/setup.ps1 -RemoveOrphans"
        Write-Host "  或自行逐項刪除上列路徑。"
        return
    }

    foreach ($p in $wholeList) {
        Remove-Item -LiteralPath $p -Recurse -Force
        Write-Host "  [del  ] $p"
    }
    foreach ($p in $staleList) {
        Remove-Item -LiteralPath $p -Force
        Write-Host "  [del  ] $p"
    }
    Write-Host "  已刪除 $($wholeList.Count) 個整包孤兒、$($staleList.Count) 個殘留檔。"
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
Write-Host " 全 standalone 安裝（檔案純覆蓋不備份；settings.json 為 merge）" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Repo  : $repoRoot"
Write-Host "  Global: $globalDir"

Show-BackupWarning

if (-not $SkipPrereqCheck) {
    Invoke-Preflight
}

Invoke-SyncRepoFiles -RepoRoot $repoRoot -GlobalDir $globalDir

Invoke-EnsurePlaywrightMcp -GlobalDir $globalDir

# 身分哨兵：$repoRoot 取自 cwd，若不是 bstack repo 就不做孤兒偵測
$sentinel = Join-Path $repoRoot 'skills/dev-workflow/SKILL.md'
if (Test-Path -LiteralPath $sentinel) {
    Invoke-DetectOrphans -RepoRoot $repoRoot -GlobalDir $globalDir -AutoRemove:$RemoveOrphans
} else {
    Write-Warning "身分哨兵 $sentinel 不存在，跳過孤兒偵測（這可能不是 bstack repo）"
}

# === Summary ===
Write-Section "Done"
Write-Host ""
Write-Host "✔ CLAUDE.md / statusline.sh / 2 hooks 已覆蓋至 $globalDir"
Write-Host "✔ skills/ 全套已 sync"
Write-Host "✔ agents/ 全套已 sync"
Write-Host "✔ settings.json 已 merge（hooks / statusLine 取自本 repo 且路徑已轉絕對；本機其餘設定保留）"
Write-Host "✔ playwright MCP 檢查完成（結果見上方 Step 2）"
Write-Host "✔ 孤兒偵測完成（預設不刪；要刪請加 -RemoveOrphans）"
Write-Host ""
