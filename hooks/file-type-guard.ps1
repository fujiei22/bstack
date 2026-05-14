#!/usr/bin/env pwsh
<#
.SYNOPSIS
  PreToolUse hook — 攔截敏感檔案類型的寫入 / 編輯。

.DESCRIPTION
  Claude Code 呼叫 Write / Edit / NotebookEdit 前先跑此 hook。
  依 CLAUDE.md §File-type 硬規則：
    - 密鑰 / secret 類（.env, *.key, *.pem, credentials.*, id_rsa* 等）
      → exit 2 hard block，無 confirm 機制。
    - 敏感配置類（.gitignore, CI config, migration, lock 檔, Dockerfile,
      terraform, shell config 等）→ exit 2 block；user 經 AskUserQuestion
      二次確認後，AI 建 confirm token 即可放行（single-use, 5 min TTL）。
  非命中檔案 → exit 0 放行。解析 stdin 失敗或非目標 tool → exit 0 放行。

.NOTES
  Token 機制：基於檔案 normalized 路徑的 SHA256 hash 前 16 hex 為 token 檔名，
  位於 <hooks 上一層>/state/file-guard/<hash>.token。Hook 命中 WARN 且 token
  存在 → 刪 token + 放行（不論過期、過期視為無效）；否則 exit 2 + stderr
  指示 AI 建 token 路徑。
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

# 讀 stdin JSON event payload
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }

try {
    $payload = $raw | ConvertFrom-Json
} catch {
    # JSON 解析失敗放行（hook 不該因自身錯誤 block）
    exit 0
}

$toolName = $payload.tool_name
$filePath = $null

# 只攔三類寫入 tool；其他放行
switch ($toolName) {
    'Edit'         { $filePath = $payload.tool_input.file_path }
    'Write'        { $filePath = $payload.tool_input.file_path }
    'NotebookEdit' { $filePath = $payload.tool_input.notebook_path }
    default        { exit 0 }
}

if (-not $filePath) { exit 0 }

# Normalize：路徑分隔統一 /、轉小寫便於 pattern 比對
$normalized = $filePath.Replace('\', '/').ToLower()

# === 豁免清單（先比對；命中即放行）===
$exemptPatterns = @(
    '\.env\.example$',
    '\.env\.sample$',
    '\.env\.template$',
    '\.env\.dist$'
)
foreach ($p in $exemptPatterns) {
    if ($normalized -match $p) { exit 0 }
}

# === Confirm token 路徑（基於 normalized 路徑 SHA256 前 16 hex）===
$stateDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\state\file-guard'))
$sha = [System.Security.Cryptography.SHA256]::Create()
$hashBytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($normalized))
$hashHex = ($hashBytes | ForEach-Object { $_.ToString('x2') }) -join ''
$tokenName = $hashHex.Substring(0, 16) + '.token'
$tokenPath = Join-Path $stateDir $tokenName
$tokenTtlSec = 300

# state dir 不在就先建（讓 AI 後續 New-Item File 不會因父層缺失而失敗）
if (-not (Test-Path -LiteralPath $stateDir)) {
    New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
}

function Test-And-Consume-Token {
    param([string]$path, [int]$ttlSec)
    if (-not (Test-Path -LiteralPath $path)) { return $false }
    try {
        $item = Get-Item -LiteralPath $path -ErrorAction Stop
        $ageSec = ((Get-Date) - $item.LastWriteTime).TotalSeconds
        # 不論過期與否，命中即刪（single-use；過期視同無效）
        Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        return ($ageSec -le $ttlSec)
    } catch {
        return $false
    }
}

# === BLOCK 類：密鑰 / secret（exit 2 + 強硬訊息；無 confirm 機制）===
$blockPatterns = @(
    @{ p = '\.env(\..+)?$';        tag = '.env 環境變數檔（含 secret 風險）' },
    @{ p = '\.key$';               tag = 'private key' },
    @{ p = '\.pem$';               tag = 'PEM 憑證 / key' },
    @{ p = '\.crt$';               tag = 'TLS 憑證' },
    @{ p = '\.p12$';               tag = 'PKCS#12 keystore' },
    @{ p = '\.pfx$';               tag = 'PFX keystore' },
    @{ p = '/credentials\.';       tag = 'credentials 檔' },
    @{ p = '/id_rsa(\..+)?$';      tag = 'SSH private key' },
    @{ p = '/id_ed25519(\..+)?$';  tag = 'SSH Ed25519 private key' }
)
foreach ($b in $blockPatterns) {
    if ($normalized -match $b.p) {
        Write-Err "[FILE-TYPE-GUARD] BLOCK：命中密鑰類檔案（$($b.tag)）：$filePath"
        Write-Err "禁直接寫入 / 編輯。如確需修改，先在對話向 user 說明動機與影響、取得 user 明確指示後再操作。"
        exit 2
    }
}

# === WARN 類：敏感配置（confirm token 機制）===
$warnPatterns = @(
    @{ p = '/\.gitignore$';                       tag = 'gitignore' },
    @{ p = '/\.dockerignore$';                    tag = 'dockerignore' },
    @{ p = '/\.github/workflows/.+\.ya?ml$';      tag = 'GitHub Actions CI' },
    @{ p = '/\.gitlab-ci\.ya?ml$';                tag = 'GitLab CI' },
    @{ p = '/\.circleci/';                        tag = 'CircleCI config' },
    @{ p = '/migrations/.+\.sql$';                tag = 'DB migration (SQL)' },
    @{ p = '/prisma/migrations/';                 tag = 'Prisma migration' },
    @{ p = '/alembic/versions/.+\.py$';           tag = 'Alembic migration' },
    @{ p = '/package-lock\.json$';                tag = 'npm lock' },
    @{ p = '/bun\.lock$';                         tag = 'bun lock' },
    @{ p = '/yarn\.lock$';                        tag = 'yarn lock' },
    @{ p = '/pnpm-lock\.yaml$';                   tag = 'pnpm lock' },
    @{ p = '/gemfile\.lock$';                     tag = 'Bundler lock' },
    @{ p = '/poetry\.lock$';                      tag = 'Poetry lock' },
    @{ p = '/cargo\.lock$';                       tag = 'Cargo lock' },
    @{ p = '/dockerfile';                         tag = 'Dockerfile' },
    @{ p = '/docker-compose.*\.ya?ml$';           tag = 'docker-compose' },
    @{ p = '\.tf$';                               tag = 'Terraform' },
    @{ p = '\.k8s\.ya?ml$';                       tag = 'K8s manifest' },
    @{ p = '/\.bashrc$';                          tag = 'bash config' },
    @{ p = '/\.zshrc$';                           tag = 'zsh config' },
    @{ p = '/\.npmrc$';                           tag = 'npm config' },
    @{ p = '/\.gitconfig$';                       tag = 'git config' }
)
foreach ($w in $warnPatterns) {
    if ($normalized -match $w.p) {
        # 有 confirm token 就放行（single-use，hook 已刪除 token）
        if (Test-And-Consume-Token -path $tokenPath -ttlSec $tokenTtlSec) {
            exit 0
        }

        Write-Err "[FILE-TYPE-GUARD] WARN：命中敏感類檔案（$($w.tag)）：$filePath"
        Write-Err "處置（依序執行）："
        Write-Err "  1) 向 user 說明動機 + 預期影響，走 AskUserQuestion 取得確認。"
        Write-Err "  2) user 確認後，AI 建立 confirm token："
        Write-Err "       New-Item -ItemType File -Path '$tokenPath' -Force | Out-Null"
        Write-Err "  3) retry 此 tool call；hook 偵測 token 即放行（single-use，TTL ${tokenTtlSec}s）。"
        Write-Err "備註：token 路徑由 normalized 檔案路徑 hash 決定、跨檔案不共用；勿手動產 token 繞 AskUserQuestion。"
        exit 2
    }
}

exit 0
