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

# PowerShell 5.1 與 7 的 ConvertTo-Json 跳脫規則不同，會產出不同 bytes：
#   5.1（JavaScriptSerializer）："<script> & 'q'"
#   7  （Newtonsoft）           ："<script> & 'q'"
# 被內嵌的 35 份文件裡有 925 個 < & ' —— 換直譯器跑一次，產出檔就多出約
# 4,600 bytes 的無謂 diff，而且所有人的 -Check 都會 FAIL、看不出原因。
# `powershell -File` 與 `pwsh -File` 差別只在有沒有打那個 w，太容易踩。
# 5.1 的 Set-Content -Encoding UTF8 還會多寫 BOM，同樣是靜默的位元組差異。
if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw "本腳本需要 PowerShell 7+（目前 $($PSVersionTable.PSVersion)）。請用 pwsh 而不是 powershell —— 5.1 的 ConvertTo-Json 跳脫規則不同，產出的檔會與 repo 內的不一致。"
}

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
    $body = $json.Substring(1, $json.Length - 2)

    # 把 `</` 寫成 `<\/`：在 JS 字串裡 `\/` 就是 `/`，**解出來的值一個字元都沒變**，
    # 但 HTML parser 不再認得 `</script`。目前 docs/flow.html 是 <script src=> 外部
    # 載入、不受影響，這是為了 docstring 講的「把 docs/ 複製到任何地方直接開」——
    # design-demos/*.html 那批正是 inline 寫法，哪天有人照做就會咬。
    # 只跳脫 `</` 不跳脫所有 `<`：全跳脫要動 818 個字元、多 4KB，而只有 `</`
    # 會提前關閉標籤（實測全 repo 只有 2 個 `</`）。
    return $body -replace '</', '<\/'
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

# key 也要跳脫。目前所有 key 都是 ASCII 路徑，但目錄名在 macOS / Linux 可以含 `"`，
# 那會讓產出的 JS 在該處提前收尾。跟值走同一條路徑，不另寫規則。
foreach ($key in $sources.Keys) {
    $text = Get-Content -LiteralPath $sources[$key] -Raw -Encoding UTF8

    # 非 UTF-8 的位元組會被解碼器靜默換成 U+FFFD。不擋的話：內容毀損、產出仍是
    # 合法 JS、-Check 兩邊算出同一個 U+FFFD 所以判 PASS —— 全綠而文件站顯示一片問號。
    # 原始碼本來就不該有 U+FFFD，所以直接當錯誤。
    if ($text -and $text.IndexOf($replacementChar) -ge 0) {
        $bad = ($text.ToCharArray() | Where-Object { $_ -eq $replacementChar }).Count
        throw "$($sources[$key]) 含 $bad 個 U+FFFD —— 該檔不是合法 UTF-8（存成 Big5 或 UTF-16 了？）。修好編碼再跑，不要讓毀損的內容進產出物。"
    }

    # 內嵌值裡的行尾釘死 LF。**這與檔尾那條「不要寫死 LF」方向相反，兩條都對**，
    # 差別在 git 管不管得到：
    #   產出檔自己的行尾  = 真正的 CR LF 位元組 → core.autocrlf 會正規化 → 交給 AppendLine
    #   內嵌字串值裡的     = `\` `r` `\` `n` 四個普通字元 → git 完全碰不到 → 只能自己釘
    # 不釘的話產出隨 checkout 狀態浮動：Windows（autocrlf=true）內嵌 \r\n、
    # Linux / macOS 內嵌 \n，同一份 commit 在兩邊 -Check 不可能同時綠。
    # 實測本 repo 35 份文件曾內嵌 6,868 個 \r，而 -Check 在非 Windows 上是永遠 FAIL 的。
    $text = $text -replace "`r`n", "`n"

    $body = ConvertTo-JsStringBody -Text $text
    $safeKey = ConvertTo-JsStringBody -Text $key
    [void]$sb.AppendLine("  `"$safeKey`": `"$body`",")
}

[void]$sb.AppendLine('};')

# 行尾刻意用 AppendLine（平台原生），不要改成寫死的 "`n"。
# 這個 repo 的 core.autocrlf = true：git 存 LF、checkout 出 CRLF。
# AppendLine 在 Windows 產 CRLF、在 Linux 產 LF，剛好與工作區一致，
# -Check 兩邊才對得上。寫死 LF 會讓 Windows 上「產出 LF vs 工作區 CRLF」
# 永遠 FAIL。**這條看起來像 bug，其實是對的，改之前先看 core.autocrlf。**
#
# 注意這與上面 foreach 裡「內嵌值釘死 LF」那條**方向相反，而且必須相反**。
# 兩者都在講換行，但管轄權不同：這裡是 git 會正規化的真行尾，那裡是 git
# 碰不到的跳脫字元。**看到不一致想統一之前，先讀那一段的理由。**

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
    # 行首錨定：文件正文裡若出現 `"references/...` 這種字樣（本 repo 的 skill 互相
    # 引用時很常見），不錨定的話診斷會把它們一起數進去，印出「內嵌 20 個 key」
    # 而實際只有 17 —— 讓人以為少了 3 個 skill。判定本身用整檔字串比對、不受影響。
    $existingKeys = (Select-String -Path $outPath -Pattern '^  "references/' -AllMatches).Matches.Count
    Write-Host "      磁碟上有 $($sources.Count) 份文件；現有檔內嵌 $existingKeys 個 key"
    Write-Host "      修法：pwsh -NoProfile -File scripts/build-references.ps1"
    exit 1
}

Set-Content -LiteralPath $outPath -Value $content -Encoding UTF8 -NoNewline
Write-Host "已產出 $outPath" -ForegroundColor Green
Write-Host "  內嵌 $($sources.Count) 份文件（CLAUDE.md 1 + skills $((Get-ChildItem (Join-Path $repoRoot 'skills') -Directory).Count) + agents $((Get-ChildItem (Join-Path $repoRoot 'agents') -Filter '*.md').Count)）"
