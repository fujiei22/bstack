#!/usr/bin/env pwsh
<#
.SYNOPSIS
  PreToolUse hook — 攔截敏感檔案類型的寫入 / 編輯。

.DESCRIPTION
  Claude Code 呼叫 Write / Edit / NotebookEdit 前先跑此 hook。
  依 CLAUDE.md §File-type 硬規則：
    - 密鑰 / secret 類（.env, *.key, *.pem, credentials.*, id_rsa* 等）→ exit 2 block
    - 敏感配置類（.gitignore, CI config, migration, lock 檔, Dockerfile,
      terraform, shell config 等）→ exit 2 提示走 AskUserQuestion 二次確認
  非命中檔案 → exit 0 放行
  解析 stdin 失敗或非目標 tool → exit 0 放行
#>

$ErrorActionPreference = 'Continue'

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

# === BLOCK 類：密鑰 / secret（exit 2 + 強硬訊息）===
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
        [Console]::Error.WriteLine("[FILE-TYPE-GUARD] BLOCK：命中密鑰類檔案（$($b.tag)）：$filePath")
        [Console]::Error.WriteLine("禁直接寫入 / 編輯。如確需修改，先在對話向 user 說明動機與影響、取得 user 明確指示後再操作。")
        exit 2
    }
}

# === WARN 類：敏感配置（exit 2 + 提示走 AskUserQuestion）===
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
        [Console]::Error.WriteLine("[FILE-TYPE-GUARD] WARN：命中敏感類檔案（$($w.tag)）：$filePath")
        [Console]::Error.WriteLine("處置：在執行此寫入 / 編輯前，向 user 說明動機 + 預期影響，並走 AskUserQuestion 取得確認後再 retry。")
        exit 2
    }
}

exit 0
