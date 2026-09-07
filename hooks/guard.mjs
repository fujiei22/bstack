#!/usr/bin/env node
/**
 * bstack PreToolUse hook（Write / Edit / NotebookEdit）——一支腳本、兩段檢查，取代原本兩支 pwsh
 * （branch-safety.ps1 + file-type-guard.ps1，2026-09-07 之前的版本在 git history）：
 *   branch-safety 段：受保護 branch（main / master / production / prod / release）上禁寫 project repo 內的檔。
 *   file-type 段：密鑰類硬擋；CI / migration / lock / infra / shell config 類先擋、user 二次確認後由 AI 建 single-use token 放行。
 *     這一段**不看 repo scope**——repo 外的 ~/.gitconfig、~/.npmrc 也擋，那正是 rules.md §File-type 列 shell config 的用意。
 * 兩段都跑、兩邊訊息都印、任一 block → exit 2。官方 hooks 文件：同 matcher 多個 hook 平行執行、stderr 合併、
 * 任一 exit 2 就 block——所以一支兩段與原本兩支的可見行為相同（差別只有 stderr 順序從不定變固定）。
 * JSON 壞 / git 失敗 / 路徑解析失敗 → 放行：hook 不因自身錯誤擋人。
 * 但 stdin 空、或 Write / Edit 沒帶 file_path 時 branch 段照舊查 branch（舊 ps1 就是這樣，零改變照搬）。
 *
 * 為什麼從 pwsh 改 node：pwsh -NoProfile 啟動約 1.4 秒 × 2 支 = 每次編輯 3 秒；node 約 0.4 秒。
 * 注意 Claude Code 是 native binary、不自帶 node（官方 /setup 文件）；node 不在 PATH 時 hook 起不來 → Claude Code 印
 * non-blocking 通知、工具照跑、保護不存在（官方 /hooks 文件），跟舊版缺 pwsh 一樣沒保護。
 *
 * decide() / tokenPathFor() 是純函式（不做 IO），契約 P2d 直接 import 對 fixture 測；CLI 段只負責讀 stdin / 跑 git / 碰 token 檔。
 * 子命令 `--token <path>`：建 confirm token（給 Claude 照抄，免拼引號與反斜線）。
 */
import { readFileSync, existsSync, statSync, unlinkSync, appendFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const PROTECTED = /^(main|master|production|prod|release)$/i;   // pwsh -match 預設不分大小寫
const EXEMPT = [/\.env\.example$/, /\.env\.sample$/, /\.env\.template$/, /\.env\.dist$/];
const BLOCK = [
  [/\.env(\..+)?$/, '.env 環境變數檔（含 secret 風險）'], [/\.key$/, 'private key'], [/\.pem$/, 'PEM 憑證 / key'],
  [/\.crt$/, 'TLS 憑證'], [/\.p12$/, 'PKCS#12 keystore'], [/\.pfx$/, 'PFX keystore'], [/\/credentials\./, 'credentials 檔'],
  [/\/id_rsa(\..+)?$/, 'SSH private key'], [/\/id_ed25519(\..+)?$/, 'SSH Ed25519 private key'],
];
const WARN = [
  // .gitignore 刻意不列：它改動頻繁，每次都要 confirm token 的干擾大於收益。.dockerignore 動得少，保留。
  [/\/\.dockerignore$/, 'dockerignore'], [/\/\.github\/workflows\/.+\.ya?ml$/, 'GitHub Actions CI'], [/\/\.gitlab-ci\.ya?ml$/, 'GitLab CI'],
  [/\/\.circleci\//, 'CircleCI config'], [/\/migrations\/.+\.sql$/, 'DB migration (SQL)'], [/\/prisma\/migrations\//, 'Prisma migration'],
  [/\/alembic\/versions\/.+\.py$/, 'Alembic migration'], [/\/package-lock\.json$/, 'npm lock'], [/\/bun\.lock$/, 'bun lock'],
  [/\/yarn\.lock$/, 'yarn lock'], [/\/pnpm-lock\.yaml$/, 'pnpm lock'], [/\/gemfile\.lock$/, 'Bundler lock'], [/\/poetry\.lock$/, 'Poetry lock'],
  [/\/cargo\.lock$/, 'Cargo lock'], [/\/dockerfile/, 'Dockerfile'], [/\/docker-compose.*\.ya?ml$/, 'docker-compose'], [/\.tf$/, 'Terraform'],
  [/\.k8s\.ya?ml$/, 'K8s manifest'], [/\/\.bashrc$/, 'bash config'], [/\/\.zshrc$/, 'zsh config'], [/\/\.npmrc$/, 'npm config'], [/\/\.gitconfig$/, 'git config'],
];
export const TOKEN_TTL_SEC = 300;
const DISABLE_HINT = '若你沒在用 bstack 流程、不想要這個檢查：/plugin disable bstack@bstack';
const fwd = (p) => String(p).replace(/\\/g, '/');

/** tool_name 大小寫不敏感（pwsh switch 預設）；回 { isWrite, target }。非三類寫入 tool → isWrite=false。 */
export function targetOf(payload) {
  if (!payload || typeof payload !== 'object') return { isWrite: true, target: null };   // 空 stdin：舊 branch 段照樣查 branch
  const t = String(payload.tool_name || '').toLowerCase();
  const i = payload.tool_input || {};
  if (t === 'edit' || t === 'write') return { isWrite: true, target: i.file_path || null };
  if (t === 'notebookedit') return { isWrite: true, target: i.notebook_path || null };
  return { isWrite: false, target: null };
}

/**
 * normalized 路徑（分隔統一 /、小寫）→ token 絕對路徑。
 * state dir 放 per-user temp（不放 plugin 目錄：plugin 更新即清空；帶使用者名：Linux /tmp 共用、token 名可預測）。
 * tmp 依 .NET GetTempPath 順序（舊 ps1 用它）：win32 TMP → TEMP → USERPROFILE → windir；其他 TMPDIR → /tmp。
 * 不用 os.tmpdir()——它在 win32 是 TEMP → TMP，兩者不同時 token 目錄會跟舊版對不上。
 */
export function tokenPathFor(normalized, env = process.env, platform = process.platform) {
  let base;
  if (env.XDG_RUNTIME_DIR && existsSync(env.XDG_RUNTIME_DIR)) base = env.XDG_RUNTIME_DIR;
  else if (platform === 'win32') base = env.TMP || env.TEMP || env.USERPROFILE || env.windir || 'C:/Temp';
  else base = env.TMPDIR || '/tmp';
  const user = env.USERNAME || env.USER || 'user';
  const hash = createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 16);
  return path.join(base, `bstack-file-guard-${user}`, `${hash}.token`);
}

/**
 * 純判定。ctx：
 *   repoDir、getBranch() → string | null（null = 非 git / 無 commit / git 不在；lazy，repo 外的檔不會 spawn git）、
 *   env、selfPath（本腳本絕對路徑，印進 token 指令）、
 *   consumeToken(tokenPath) → { existed, valid }（存在即刪 + 寫 consumed.log；呼叫端負責 IO）、
 *   ensureStateDir(dir) → bool。
 * 回 { exit: 0|2, lines: string[] }（兩段訊息合併）。
 */
export function decide(payload, ctx) {
  const { isWrite, target } = targetOf(payload);
  if (!isWrite) return { exit: 0, lines: [] };
  const lines = [];
  let exit = 0;

  // ── branch-safety 段：目標在 repo 外才跳；取不到路徑照舊查（零改變）──
  let inScope = true;
  if (target) {
    try {
      const absT = path.resolve(target).toLowerCase();
      const absR = path.resolve(ctx.repoDir).replace(/[\\/]+$/, '').toLowerCase();
      inScope = absT.startsWith(absR + path.sep) || absT.startsWith(absR + '/');
    } catch { inScope = false; }
  }
  if (inScope) {
    const branch = ctx.getBranch();
    if (branch && PROTECTED.test(branch)) {
      lines.push(`[bstack] 目前在 '${branch}'，這是受保護的 branch，不直接寫入 / 編輯 project repo 內的檔。`);
      lines.push('請先開 branch：用 AskUserQuestion 跟 user 確認名稱 → `git checkout -b <type>/<short-desc>`（type ∈ feat/fix/refactor/docs/chore/test/hotfix）→ retry。');
      lines.push(DISABLE_HINT);
      exit = 2;
    }
  }

  // ── file-type 段：不看 repo scope；沒路徑就沒得判 ──
  if (!target) return { exit, lines };
  const normalized = fwd(target).toLowerCase();
  if (EXEMPT.some((r) => r.test(normalized))) return { exit, lines };
  for (const [re, tag] of BLOCK) {
    if (!re.test(normalized)) continue;
    lines.push(`[bstack] BLOCK：命中密鑰類檔案（${tag}）：${target}`);
    lines.push('不直接寫入 / 編輯。如確需修改，先在對話向 user 說明動機與影響、取得 user 明確指示後再操作。');
    lines.push(DISABLE_HINT);
    return { exit: 2, lines };
  }
  for (const [re, tag] of WARN) {
    if (!re.test(normalized)) continue;
    const tokenPath = tokenPathFor(normalized, ctx.env);
    const { valid } = ctx.consumeToken(tokenPath);      // 存在即刪（single-use；過期視同無效）
    if (valid) return { exit, lines };
    if (!ctx.ensureStateDir(path.dirname(tokenPath))) {
      lines.push(`[bstack] state dir 建立失敗：${fwd(path.dirname(tokenPath))}。請確認 TEMP 環境變數指向可寫目錄，或 /plugin disable bstack@bstack。`);
      return { exit: 2, lines };
    }
    lines.push(`[bstack] WARN：命中敏感類檔案（${tag}）：${target}`);
    lines.push('處置（依序執行）：');
    lines.push('  1) 向 user 說明動機 + 預期影響，走 AskUserQuestion 取得確認。');
    lines.push('  2) user 確認後，AI 建立 confirm token（兩個路徑照抄，正斜線在 Bash / PowerShell tool 都能跑）：');
    lines.push(`       node "${fwd(ctx.selfPath)}" --token "${fwd(tokenPath)}"`);
    lines.push(`  3) retry 此 tool call；hook 偵測 token 即放行（single-use，TTL ${TOKEN_TTL_SEC}s）。`);
    lines.push('備註：token 路徑由 normalized 檔案路徑 hash 決定、跨檔案不共用；勿手動產 token 繞 AskUserQuestion。');
    lines.push(DISABLE_HINT);
    return { exit: 2, lines };
  }
  return { exit, lines };
}

// ───────────────────────── CLI ─────────────────────────
function main() {
  const argv = process.argv.slice(2);
  const ti = argv.indexOf('--token');
  if (ti >= 0 && argv[ti + 1]) {
    const p = argv[ti + 1];
    mkdirSync(path.dirname(p), { recursive: true });
    appendFileSync(p, '');
    console.log(`token created: ${fwd(p)}`);
    return 0;
  }
  let raw = '';
  try { raw = readFileSync(0, 'utf8'); } catch { raw = ''; }
  let payload = null;
  if (raw.trim()) {
    try { payload = JSON.parse(raw); } catch { return 0; }   // JSON 壞 → 放行
  }
  const repoDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const targetForLog = targetOf(payload).target;
  const ctx = {
    repoDir, env: process.env, selfPath: path.resolve(process.argv[1]),
    getBranch() {
      try {
        return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
      } catch { return null; }   // 非 git / 無 commit / git 不在 / repoDir 不存在 → 放行
    },
    consumeToken(tokenPath) {
      if (!existsSync(tokenPath)) return { existed: false, valid: false };
      let ageSec = Infinity;
      try { ageSec = (Date.now() - statSync(tokenPath).mtimeMs) / 1000; } catch { /* 視同過期 */ }
      try { unlinkSync(tokenPath); } catch { /* ignore */ }
      const valid = ageSec <= TOKEN_TTL_SEC;
      // 留一行紀錄：token 可被預建，事後至少查得出「何時、哪個檔用 token 放行過」。布林沿用舊 ps1 的 True/False
      try { appendFileSync(path.join(path.dirname(tokenPath), 'consumed.log'), `${new Date().toISOString()} consumed ${path.basename(tokenPath)} for ${targetForLog} valid=${valid ? 'True' : 'False'}\n`); } catch { /* ignore */ }
      return { existed: true, valid };
    },
    ensureStateDir(dir) {
      if (existsSync(dir)) return true;
      try { mkdirSync(dir, { recursive: true }); return true; } catch { return false; }
    },
  };
  const { exit, lines } = decide(payload, ctx);
  if (lines.length) process.stderr.write(lines.join('\n') + '\n');
  return exit;
}

// 直接執行才跑 CLI；被 import（契約 P2d）時只匯出函式。用 argv[1] 檔名 regex 判（同 scripts/text-only-diff.mjs 先例；
// import.meta.url 與 argv[1] 在 Windows 會有磁碟機大小寫 / %20 差異）
if (process.argv[1] && /guard\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) {
  process.exitCode = main();
}
