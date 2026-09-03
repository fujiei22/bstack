<#
.SYNOPSIS
  產生 docs/js/references-data.js —— 把 CLAUDE.md、每個 skill 的 SKILL.md、每個 agent
  的 .md 全文內嵌成一個 JS 物件，供 docs 站在 `file://` 下直接開文件抽屜。

.DESCRIPTION
  為什麼要內嵌而不用 fetch：docs 站是純靜態、無 build step，而 `file://` 協定下
  `fetch()` 會被瀏覽器擋（CORS）。內嵌之後，把整個 docs/ 目錄複製到任何地方、
  用瀏覽器直接開 index.html 就能用——這是 baseline 的 F14，不可破壞。

  這支腳本從磁碟掃檔、不維護清單：新增一個 skill 只要跑一次就會被收進來。
  **它是唯一的產出途徑**——references-data.js 每行一個 key、每個值是一整份
  markdown 的跳脫字串，手改幾乎必然出錯。

  idempotent：內容沒變時重跑產出的檔逐 byte 相同。

.PARAMETER Check
  只檢查不寫入。產出的內容與現有檔不同時 exit 1 並印出差異摘要。
  用途：CI 或 commit 前確認「有人改了 skill 但忘了重跑產出器」。

.EXAMPLE
  pwsh -NoProfile -File scripts/build-references.ps1
  pwsh -NoProfile -File scripts/build-references.ps1 -Check
#>
[CmdletBinding()]
param([switch]$Check)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outPath  = Join-Path $repoRoot 'docs/js/references-data.js'

<#
.SYNOPSIS
  把一份 markdown 全文轉成 JS 字串字面值（不含外層引號）。
.DESCRIPTION
  用 ConvertTo-Json 做跳脫而不是自己 replace：JSON 字串的跳脫規則與 JS 完全相容，
  而手寫 replace 很容易漏掉控制字元（backspace、form feed、unit separator 這類在
  出現過——例如貼進來的終端輸出）。
  ConvertTo-Json 會回傳含外層雙引號的字串，這裡剝掉。
#>
function ConvertTo-JsStringBody {
    param([Parameter(Mandatory)][AllowEmptyString()][string]$Text)
    $json = $Text | ConvertTo-Json -Compress -Depth 1
    return $json.Substring(1, $json.Length - 2)
}

<#
.SYNOPSIS
  收集要內嵌的檔案清單，回傳 [ordered]@{ key = 絕對路徑 }。
.DESCRIPTION
  順序固定為 CLAUDE.md → skills（字母序）→ agents（字母序）。
  固定順序是為了讓「內容沒變就逐 byte 相同」成立——目錄列舉的順序在不同
  檔案系統上不保證一致，所以明確排序。

  `Sort-Object Name` 預設吃系統 locale，跨機器結果會不同（實測 tr-TR 與 en-US
  對含大小寫的名字排出不同順序）。釘 `-Culture 'en-US'` 讓它決定性。
  **注意要傳字串**——傳 `[CultureInfo]::InvariantCulture` 物件無效。
  目前 skill 名全是小寫 ASCII kebab、踩不到，但只要有人加一個帶大寫的就會。
#>
function Get-ReferenceSources {
    param([Parameter(Mandatory)][string]$RepoRoot)

    $map = [ordered]@{}

    $claudeMd = Join-Path $RepoRoot 'CLAUDE.md'
    if (-not (Test-Path -LiteralPath $claudeMd)) {
        throw "找不到 $claudeMd —— 這是必收的檔，缺了代表 repo 結構有問題，不靜默略過"
    }
    $map['references/CLAUDE.md'] = $claudeMd

    $skillsDir = Join-Path $RepoRoot 'skills'
    foreach ($d in Get-ChildItem -LiteralPath $skillsDir -Directory | Sort-Object Name -Culture 'en-US') {
        $f = Join-Path $d.FullName 'SKILL.md'
        if (Test-Path -LiteralPath $f) {
            $map["references/skills/$($d.Name)/SKILL.md"] = $f
        } else {
            Write-Warning "  skills/$($d.Name)/ 沒有 SKILL.md，略過（這個目錄可能不是 skill）"
        }
    }

    $agentsDir = Join-Path $RepoRoot 'agents'
    foreach ($f in Get-ChildItem -LiteralPath $agentsDir -Filter '*.md' | Sort-Object Name -Culture 'en-US') {
        $map["references/agents/$($f.Name)"] = $f.FullName
    }

    return $map
}

# === 產出 ===

$sources = Get-ReferenceSources -RepoRoot $repoRoot

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine('/** 內嵌所有 references markdown，供 file:// 直接存取（無需 fetch）。產出器：scripts/build-references.ps1（PowerShell 自動 inline）。 */')
[void]$sb.AppendLine('window.REFERENCE_DOCS = {')

$replacementChar = [char]0xFFFD

foreach ($key in $sources.Keys) {
    $text = Get-Content -LiteralPath $sources[$key] -Raw -Encoding UTF8

    # 非 UTF-8 的位元組會被解碼器靜默換成 U+FFFD。不擋的話：內容毀損、產出仍是
    # 合法 JS、-Check 兩邊算出同一個 U+FFFD 所以判 PASS —— 全綠而文件站顯示一片問號。
    # 原始碼本來就不該有 U+FFFD，所以直接當錯誤。
    if ($text -and $text.IndexOf($replacementChar) -ge 0) {
        $bad = ($text.ToCharArray() | Where-Object { $_ -eq $replacementChar }).Count
        throw "$($sources[$key]) 含 $bad 個 U+FFFD —— 該檔不是合法 UTF-8（存成 Big5 或 UTF-16 了？）。修好編碼再跑，不要讓毀損的內容進產出物。"
    }

    $body = ConvertTo-JsStringBody -Text $text
    [void]$sb.AppendLine("  `"$key`": `"$body`",")
}

[void]$sb.AppendLine('};')

# 最後一個 key 後面的逗號留著——JS 物件字面值允許 trailing comma，
# 而特別處理最後一項會讓 diff 在「新增一個 skill」時多出一行無關改動。
$content = $sb.ToString()

if ($Check) {
    if (-not (Test-Path -LiteralPath $outPath)) {
        Write-Host "FAIL  $outPath 不存在" -ForegroundColor Red
        exit 1
    }
    $existing = Get-Content -LiteralPath $outPath -Raw -Encoding UTF8
    if ($existing -eq $content) {
        Write-Host "PASS  references-data.js 與磁碟上的 $($sources.Count) 份文件一致" -ForegroundColor Green
        exit 0
    }
    Write-Host "FAIL  references-data.js 過期" -ForegroundColor Red
    Write-Host "      磁碟上有 $($sources.Count) 份文件；現有檔內嵌 $((Select-String -Path $outPath -Pattern '"references/' -AllMatches).Matches.Count) 個 key"
    Write-Host "      修法：pwsh -NoProfile -File scripts/build-references.ps1"
    exit 1
}

Set-Content -LiteralPath $outPath -Value $content -Encoding UTF8 -NoNewline
Write-Host "已產出 $outPath" -ForegroundColor Green
Write-Host "  內嵌 $($sources.Count) 份文件（CLAUDE.md 1 + skills $((Get-ChildItem (Join-Path $repoRoot 'skills') -Directory).Count) + agents $((Get-ChildItem (Join-Path $repoRoot 'agents') -Filter '*.md').Count)）"
