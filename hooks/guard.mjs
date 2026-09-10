#!/usr/bin/env node
/**
 * bstack PreToolUse hook——一支腳本、兩段檢查，Claude Code（Write / Edit / NotebookEdit）與 Codex（apply_patch）共用：
 *   branch-safety 段：受保護 branch（main / master / production / prod / release）上禁寫 project repo 內的檔。
 *   file-type 段：密鑰類硬擋；CI / migration / lock / infra / shell config 類先擋、user 二次確認後由 AI 建 single-use token 放行。
 *     這一段**不看 repo scope**——repo 外的 ~/.gitconfig、~/.npmrc 也擋，那正是 rules.md §File-type 列 shell config 的用意。
 * 兩段都跑、兩邊訊息都印、任一 block → 擋。**擋的協定兩個 host 不同**（見 main()）：
 *   Claude Code 官方是 exit 2 + stderr；Codex（2026-09-09 Windows 實測）不認 exit 2，只認 stdout JSON `permissionDecision: "deny"` + exit 0。
 * JSON 壞 / git 失敗 / 路徑解析失敗 → 放行：hook 不因自身錯誤擋人。
 * 但 stdin 空、或 Write / Edit 沒帶 file_path 時 branch 段照舊查 branch（舊 ps1 就是這樣，零改變照搬）。
 *
 * 兩個 host 的差異（2026-09-09）：
 *   - Claude Code 一次一個檔（file_path / notebook_path 絕對路徑）、給 CLAUDE_PROJECT_DIR。
 *   - Codex 的 Write / Edit 只是 apply_patch 的別名：tool_name 仍是 apply_patch、tool_input.command 是整段 patch 文字，
 *     一個 patch 可含多個檔、路徑**相對 session cwd**（payload 帶 cwd 欄位；hook 進程的 cwd 也是它），且沒有 CLAUDE_PROJECT_DIR——
 *     repoDir 改用 `git rev-parse --show-toplevel` 算（跟 branch 同一次 spawn 一起拿，Codex 上每次 hook 只多這一次 git）。
 *     判定改成「多目標」：相對路徑以 cwd 解析、canonical 後去重、branch 段只查一次、file-type 段兩趟——第一趟只看（peekToken）
 *     分類 BLOCK / WARN，全部過關才第二趟逐檔消耗 token；預檢有任何一檔擋下就整包擋且**不消耗任何有效 token**，
 *     免得 user 確認過的 token 被同一包裡另一個檔的失敗白白燒掉（過期的 token 例外：第一趟就刪掉並記 consumed.log valid=False，稽核軌跡不斷）。
 *     第二趟的消耗是**原子 claim**（rename 成 .claim-<pid> 再刪）：兩個 hook 在 TTL 內同時跑同一檔，只有 rename 成功的那個放行；
 *     claim 失敗整包擋、已 claim 的不退還（重新向 user 確認再建）——放棄「多檔全有全無」換取 single-use 真的成立。
 *   - file-type 分類同時看原始路徑與 canonical（realpath）路徑、取較嚴格：config.txt 是 .env 的 symlink 也擋得到；
 *     token 身分仍綁原始路徑的 normalized hash（印給 user 的 --token 指令要對得上他確認的那個檔名）。
 *   - Codex 上 apply_patch 的相對路徑一律視為 repo 內（fail-closed）：rules.md §Branch safety 的「repo 外放行」豁免只對絕對路徑成立。
 *   - 訊息自帶兩個 host 的答案（AskUserQuestion / request_user_input），不引用任何 skill 檔——hook 在沒載 /devwork 時也會跑。
 *
 * 為什麼從 pwsh 改 node：pwsh -NoProfile 單支啟動約 1.1 秒、兩支每次編輯合計約 3.2 秒；node 約 0.3-0.5 秒（2026-09-07 實測）。
 * 注意 Claude Code / Codex 都是 native binary、不自帶 node；node 不在 PATH 時 hook 起不來——Claude Code 官方 /hooks 文件說會印
 * non-blocking 通知、工具照跑；Windows 非互動模式實測連通知都沒有、檔案照寫。兩種說法下保護都不存在，跟舊版缺 pwsh 一樣。
 *
 * decide() / targetsOf() / applyPatchPaths() / tokenPathFor() / isCodexPayload() 是純函式（不做 IO），契約 P2d 直接 import 對 fixture 測；
 * CLI 段只負責讀 stdin / 跑 git / 碰 token 檔。子命令 `--token <path>`：建 confirm token（給 AI 照抄，免拼引號與反斜線）。
 */
import { readFileSync, writeFileSync, existsSync, statSync, unlinkSync, renameSync, utimesSync, appendFileSync, mkdirSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
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
const DISABLE_HINT = '若你沒在用 bstack 流程、不想要這個檢查：Claude Code 打 /plugin disable bstack@bstack；Codex 打 /plugins 選 bstack 按 Space 停用（Codex 另需 /hooks 信任本 hook 才會跑）';
const ASK_HINT = 'Claude Code 用 AskUserQuestion；Codex 用 request_user_input，工具不在清單就文字提問、選項編號';
const fwd = (p) => String(p).replace(/\\/g, '/');

/**
 * apply_patch 的 command（整段 patch 文字）→ 路徑陣列。
 * 只認行首 `*** Add File: / Update File: / Delete File: / Move to: `——patch 內容行一律有 `+` / `-` / 空白前綴，不會誤觸。
 * 截斷的 patch（沒有 `*** End Patch`）也回已經看到的路徑（fail-closed：看得到的都判）；CRLF 也吃。
 */
export function applyPatchPaths(cmd) {
  if (typeof cmd !== 'string') return [];
  const out = [];
  for (const line of cmd.split(/\r?\n/)) {
    const m = line.match(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/);
    if (m && m[1].trim()) out.push(m[1].trim());
  }
  return out;
}

/**
 * tool_name 大小寫不敏感（pwsh switch 預設）；回 { isWrite, targets: [{ path, relTo }] }。
 * relTo === 'cwd' 代表這個路徑（apply_patch 給的）相對 session cwd，decide 要先以 ctx.cwd 解析再判；null 代表照原樣（Claude Code 給絕對路徑）。
 * payload === undefined 代表 stdin 真的是空字串：舊 branch 段這時照樣查 branch（零改變）。
 * JSON 是 scalar（"x" / 123 / true）→ 舊 ps1 取 .tool_name 得 null → default → exit 0，所以這裡回 isWrite=false。
 * apply_patch 沒帶 command / 解析不到任何路徑 → 當「沒帶路徑」（branch 段照查、file-type 段沒得判），跟 Write 缺 file_path 同一條路。
 */
export function targetsOf(payload) {
  if (payload === undefined) return { isWrite: true, targets: [{ path: null, relTo: null }] };
  if (payload === null || typeof payload !== 'object') return { isWrite: false, targets: [] };
  const t = String(payload.tool_name || '').toLowerCase();
  const i = (payload.tool_input && typeof payload.tool_input === 'object') ? payload.tool_input : {};
  // 非字串的 file_path（數字 / 物件）一律當「沒帶路徑」→ branch 段照查、file-type 段沒得判。
  // 不能讓它進 path.resolve 拋錯再 catch 成「repo 外」放行——那是 security-audit 實測繞過 protected branch 的路（D3）
  const str = (v) => (typeof v === 'string' && v !== '' ? v : null);
  if (t === 'edit' || t === 'write') return { isWrite: true, targets: [{ path: str(i.file_path), relTo: null }] };
  if (t === 'notebookedit') return { isWrite: true, targets: [{ path: str(i.notebook_path), relTo: null }] };
  if (t === 'apply_patch') {
    const ps = applyPatchPaths(i.command);
    return { isWrite: true, targets: ps.length ? ps.map((p) => ({ path: p, relTo: 'cwd' })) : [{ path: null, relTo: null }] };
  }
  return { isWrite: false, targets: [] };
}

/** 相容殼：舊呼叫端只要第一個路徑。回 { isWrite, target }。 */
export function targetOf(payload) {
  const r = targetsOf(payload);
  return { isWrite: r.isWrite, target: r.targets[0]?.path ?? null };
}

/**
 * 這個 payload 是 Codex 送的嗎？兩個訊號取其一（任一成立就是）：turn_id 是字串（官方文件列為 Codex-specific extension）、
 * 或 tool_name 是 apply_patch（Claude Code 沒有這個工具）。兩個訊號是因為 Codex 不認 exit 2——判錯成 Claude Code 就是靜默 fail-open，
 * 單靠一個欄位太脆（欄位改名 / 子 agent 的 payload 形狀不同都會中）。
 */
export function isCodexPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return typeof payload.turn_id === 'string' || String(payload.tool_name || '').toLowerCase() === 'apply_patch';
}

/**
 * normalized 路徑（分隔統一 /、小寫）→ token 絕對路徑。
 * state dir 放 per-user temp（不放 plugin 目錄：plugin 更新即清空；帶使用者名：Linux /tmp 共用、token 名可預測）。
 * tmp 依 .NET GetTempPath 順序（舊 ps1 用它）：win32 TMP → TEMP → USERPROFILE → windir；其他 TMPDIR → /tmp。
 * 不用 os.tmpdir()——它在 win32 是 TEMP → TMP，兩者不同時 token 目錄會跟舊版對不上。
 */
export function tokenPathFor(normalized, env = process.env, platform = process.platform, dirExists = existsSync) {
  let base;
  if (env.XDG_RUNTIME_DIR && dirExists(env.XDG_RUNTIME_DIR)) base = env.XDG_RUNTIME_DIR;   // dirExists 可注入，契約測時不碰磁碟
  else if (platform === 'win32') base = env.TMP || env.TEMP || env.USERPROFILE || env.windir || 'C:/Temp';
  else base = env.TMPDIR || '/tmp';
  const user = env.USERNAME || env.USER || 'user';
  const hash = createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 16);
  return path.join(base, `bstack-file-guard-${user}`, `${hash}.token`);
}

/**
 * 純判定。ctx：
 *   repoDir（branch 段的 repo 範圍）、cwd（apply_patch 相對路徑的解析基準；沒給退 repoDir）、
 *   getBranch() → string | null（null = 非 git / 無 commit / git 不在；lazy，repo 外的檔不會 spawn git；本函式只呼叫一次）、
 *   env、selfPath（本腳本絕對路徑，印進 token 指令）、
 *   peekToken(tokenPath) → { existed, valid }（只查存在與是否在 TTL 內、不刪）、
 *   consumeToken(tokenPath, target) → { existed, valid, claimed }（原子 claim：rename 成功才算 claimed、再刪 + 寫 consumed.log；
 *     claimed=false 代表被另一個 hook 先拿走或檔案鎖住；呼叫端負責 IO；第二個參數只用來 log）、
 *   ensureStateDir(dir) → bool。
 * 回 { exit: 0|2, lines: string[] }（兩段訊息合併；exit 2 = 擋，怎麼告訴 host 由 main() 依 host 決定）。
 */
export function decide(payload, ctx) {
  const { isWrite, targets } = targetsOf(payload);
  if (!isWrite) return { exit: 0, lines: [] };
  const lines = [];
  let exit = 0;

  // canonical：舊 .NET GetFullPath 會把 Windows 8.3 短檔名（TOMMY_~1）展開；path.resolve 不會，兩邊寫法不同就會誤判「repo 外」放行。
  // 用 realpath 展開到最深的存在祖先，剩餘段接回去（目標檔常常還不存在）。ctx.realpath 可注入（契約測時不碰磁碟）。
  const canonical = (p) => {
    const abs = path.resolve(p);
    const rp = ctx.realpath || ((x) => realpathSync.native(x));
    let head = abs, tail = [];
    for (;;) {
      try { return path.join(rp(head), ...tail).toLowerCase(); } catch { /* 不存在，往上一層 */ }
      const parent = path.dirname(head);
      if (parent === head) return abs.toLowerCase();
      tail.unshift(path.basename(head)); head = parent;
    }
  };

  // ── 解析 + 去重：apply_patch 的相對路徑以 session cwd 解析（Codex 就是這樣寫檔的）；同一檔在一個 patch 出現兩次（Update + Move to）只判一次 ──
  const base = ctx.cwd || ctx.repoDir;
  let anyNull = false, anyRel = false;
  const resolved = [];   // { path（給訊息 / normalized 用）, key（去重 / scope 用）}
  const seen = new Set();
  for (const t of targets) {
    if (!t.path) { anyNull = true; continue; }
    let p = t.path;
    if (t.relTo === 'cwd' && !path.isAbsolute(p)) { p = path.resolve(base, p); anyRel = true; }
    let key;
    try { key = canonical(p); } catch { key = fwd(p).toLowerCase(); }
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push({ path: p, key });
  }

  // ── branch-safety 段：全部目標都在 repo 外才跳；取不到路徑照舊查（零改變）。只查一次 branch、只印一次。
  //    相對路徑（Codex）一律當 repo 內：cwd 在 repo 裡、../ 跳出去的也照查（fail-closed；rules.md §Branch safety 有註明）──
  let inScope = anyNull || anyRel || resolved.length === 0;
  if (!inScope) {
    try {
      const absR = canonical(ctx.repoDir).replace(/[\\/]+$/, '');
      inScope = resolved.some(({ key }) => key.startsWith(absR + path.sep) || key.startsWith(absR + '/'));
    } catch { inScope = true; }   // 解析失敗 = 不知道，不當「repo 外」；照查 branch（fail-closed）
  }
  if (inScope) {
    const branch = ctx.getBranch();
    if (branch && PROTECTED.test(branch)) {
      lines.push(`[bstack] 目前在 '${branch}'，這是受保護的 branch，不直接寫入 / 編輯 project repo 內的檔。`);
      lines.push(`請先開 branch：跟 user 確認名稱（${ASK_HINT}）→ \`git checkout -b <type>/<short-desc>\`（type ∈ feat/fix/refactor/docs/chore/test/hotfix）→ retry。`);
      exit = 2;
    }
  }

  // ── file-type 段：不看 repo scope；沒路徑就沒得判 ──
  if (resolved.length === 0) { if (exit === 2) lines.push(DISABLE_HINT); return { exit, lines }; }
  // 第一趟：只分類、只 peek；有效 token 不動，過期的當場刪掉並記 log（稽核：預建的 token 也要留下痕跡）
  const blocks = [], warns = [];
  // 單一路徑的分類：EXEMPT 先讓 .env.example 這類逃過 .env 的 BLOCK pattern；回 { rank, tag }，rank 2=BLOCK 1=WARN 0=無
  const classify = (n) => {
    if (EXEMPT.some((r) => r.test(n))) return { rank: 0 };
    const b = BLOCK.find(([re]) => re.test(n));
    if (b) return { rank: 2, tag: b[1] };
    const w = WARN.find(([re]) => re.test(n));
    return w ? { rank: 1, tag: w[1] } : { rank: 0 };
  };
  for (const { path: p, key } of resolved) {
    const normalized = fwd(p).toLowerCase();
    // 原始路徑與 canonical 路徑各分類一次、取較嚴格：別名（symlink / junction）指到敏感檔時，原始名字看不出來、canonical 看得出來；
    // 反過來 .env.example 是 .env 的 symlink 時，原始名字 EXEMPT、canonical 命中 BLOCK，也是取 BLOCK。EXEMPT 只豁免自己那一邊，不提早 continue
    const canon = key ? fwd(key) : normalized;
    const c1 = classify(normalized), c2 = canon !== normalized ? classify(canon) : { rank: 0 };
    const c = c2.rank > c1.rank ? c2 : c1;
    if (c.rank === 2) { blocks.push({ tag: c.tag, path: p }); continue; }
    if (c.rank === 0) continue;
    const tokenPath = tokenPathFor(normalized, ctx.env);
    const peek = ctx.peekToken(tokenPath);
    if (peek.existed && !peek.valid) ctx.consumeToken(tokenPath, p);   // 過期：刪 + log valid=False
    warns.push({ tag: c.tag, path: p, tokenPath, valid: !!peek.valid });
  }
  for (const { tag, path: p } of blocks) lines.push(`[bstack] BLOCK：命中密鑰類檔案（${tag}）：${p}`);
  if (blocks.length) {
    lines.push('不直接寫入 / 編輯。如確需修改，先在對話向 user 說明動機與影響、取得 user 明確指示後再操作。');
    exit = 2;
  }
  const pending = warns.filter((w) => !w.valid);
  if (pending.length) {
    for (const w of pending) {
      if (!ctx.ensureStateDir(path.dirname(w.tokenPath))) {
        lines.push(`[bstack] state dir 建立失敗：${fwd(path.dirname(w.tokenPath))}。請確認 TEMP 環境變數指向可寫目錄，或停用本 hook（${DISABLE_HINT}）。`);
        return { exit: 2, lines };
      }
    }
    for (const w of pending) lines.push(`[bstack] WARN：命中敏感類檔案（${w.tag}）：${w.path}`);
    lines.push('處置（依序執行）：');
    lines.push(`  1) 向 user 說明動機 + 預期影響，取得確認（${ASK_HINT}）。`);
    lines.push(`  2) user 確認後，AI 建立 confirm token（${pending.length > 1 ? '每個檔一行、' : ''}路徑照抄，正斜線在 Bash / PowerShell tool 都能跑）：`);
    for (const w of pending) lines.push(`       node "${fwd(ctx.selfPath)}" --token "${fwd(w.tokenPath)}"`);
    lines.push(`  3) retry 此 tool call；hook 偵測 token 即放行（single-use，TTL ${TOKEN_TTL_SEC}s；一包 patch 內全部 token 都有效才放行，預檢沒過不消耗任何 token；預檢過後逐檔原子消耗，消耗失敗整包擋、已消耗的不退還）。`);
    lines.push('備註：token 路徑由 normalized 檔案路徑 hash 決定、跨檔案不共用；勿手動產 token 繞過 user 確認。');
    exit = 2;
  }
  if (exit === 2) { lines.push(DISABLE_HINT); return { exit: 2, lines }; }   // 任一檔擋下：整包擋、不消耗任何有效 token
  // 第二趟：全部過關才逐檔消耗（single-use）。消耗 = 原子 claim；claim 不到（另一個 hook 同時拿走、檔案鎖住、或 claim 時已過期）→ 擋整包。
  // 前面已 claim 成功的不退還：要退還就得再做一套復原流程，超過這支防誤操作 hook 的規模；代價是 user 要重新確認一次
  const failed = [];
  for (const w of warns) {
    const c = ctx.consumeToken(w.tokenPath, w.path);
    if (!c.claimed || !c.valid) failed.push(w);
  }
  if (failed.length) {
    for (const w of failed) lines.push(`[bstack] token 消耗失敗（同時有另一個 hook 在用、檔案鎖住、或已過期）：${w.path}`);
    lines.push('這一包不放行；本次已消耗的 token 不退還。請重新向 user 確認後再建 token、retry。');
    lines.push(DISABLE_HINT);
    return { exit: 2, lines };
  }
  return { exit, lines };
}

// ───────────────────────── CLI ─────────────────────────
/**
 * 跑一次 git、回 stdout（trim）；失敗回 null。
 * Windows：git 只以 git.cmd / git.bat 包裝在 PATH 時，無 shell 的 spawn 找不到（libuv 只試 .com/.exe）；舊 pwsh 走 PATHEXT 找得到。
 * ENOENT 才退到 shell 版重試一次（多 ~50ms、只在這條路），其他錯誤（非 git / 無 commit）維持 null → 放行。
 */
function gitOut(args, cwd) {
  const opts = { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
  try {
    return execFileSync('git', args, opts).trim() || null;
  } catch (e) {
    if (e && e.code === 'ENOENT' && process.platform === 'win32') {
      try { return execFileSync(['git', ...args].join(' '), { ...opts, shell: true }).trim() || null; } catch { return null; }
    }
    return null;
  }
}

function main() {
  const argv = process.argv.slice(2);
  const ti = argv.indexOf('--token');
  if (ti >= 0) {
    const p = argv[ti + 1];
    if (!p) { process.stderr.write('[bstack] --token 需要一個路徑參數（照 WARN 訊息第 2 步那行原樣貼）\n'); return 1; }   // 不能靜默落進 hook 模式讀 stdin
    // 只准建在本機當下 env 算出來的 state dir 底下：這支不該變成「順手在任何路徑 touch 空檔」的通用工具（security-audit Minor）
    const expectDir = path.resolve(path.dirname(tokenPathFor('probe', process.env))).replace(/\\/g, '/').toLowerCase();
    const gotDir = path.resolve(path.dirname(p)).replace(/\\/g, '/').toLowerCase();
    if (gotDir !== expectDir) { process.stderr.write(`[bstack] --token 拒絕：路徑不在 state dir（期望 ${fwd(expectDir)}）\n`); return 1; }
    mkdirSync(path.dirname(p), { recursive: true });
    // writeFileSync（不是 append）：舊 ps1 是 New-Item -Force，對既存檔會重建、mtime 刷新到現在——TTL 從「這次確認」起算
    writeFileSync(p, '');
    const now = new Date(); utimesSync(p, now, now);
    console.log(`token created: ${fwd(p)}`);
    return 0;
  }
  let raw = '';
  try { raw = readFileSync(0, 'utf8'); } catch { return 0; }   // stdin 讀不到（EAGAIN 之類）= 自身錯誤 → 放行，不假裝成「空 stdin」
  let payload;   // undefined = 完全空字串（舊 branch 段照查 branch）；JSON null / scalar / 只有空白 → targetsOf 回 isWrite=false 或這裡 catch → exit 0
  if (raw !== '') {
    try { payload = JSON.parse(raw); } catch { return 0; }
  }
  // cwd：apply_patch 相對路徑的基準。Codex payload 帶 cwd（session cwd）；沒有就用 hook 進程自己的 cwd
  const cwd = (payload && typeof payload === 'object' && typeof payload.cwd === 'string' && payload.cwd) ? payload.cwd : process.cwd();
  // repoDir：Claude Code 給 CLAUDE_PROJECT_DIR；Codex 沒有 → 用 cwd 所在 repo 的 toplevel（跟 branch 同一次 spawn 一起拿）；都沒有才退回 cwd
  let repoDir = process.env.CLAUDE_PROJECT_DIR || null;
  let branchCache;   // undefined = 還沒查；null = 查不到
  if (!repoDir) {
    const out = gitOut(['rev-parse', '--show-toplevel', '--abbrev-ref', 'HEAD'], cwd);
    const [top, br] = out ? out.split(/\r?\n/) : [null, null];
    repoDir = top || cwd;
    branchCache = br || null;
  }
  const ageSecOf = (p) => { try { return (Date.now() - statSync(p).mtimeMs) / 1000; } catch { return Infinity; } };   // 讀不到 mtime 視同過期
  const ctx = {
    repoDir, cwd, env: process.env, selfPath: path.resolve(process.argv[1]),
    getBranch() {
      if (branchCache === undefined) branchCache = gitOut(['rev-parse', '--abbrev-ref', 'HEAD'], repoDir);   // Claude Code 路徑：lazy 一次
      return branchCache;
    },
    peekToken(tokenPath) {
      if (!existsSync(tokenPath)) return { existed: false, valid: false };
      return { existed: true, valid: ageSecOf(tokenPath) <= TOKEN_TTL_SEC };
    },
    consumeToken(tokenPath, target) {
      if (!existsSync(tokenPath)) return { existed: false, valid: false, claimed: false };
      // 原子 claim：同目錄 rename 在 Windows / POSIX 都是原子的，兩個 hook 同時搶只有一個成功；失敗就當被拿走、不放行
      const claim = `${tokenPath}.claim-${process.pid}`;
      try { renameSync(tokenPath, claim); } catch { return { existed: true, valid: false, claimed: false }; }
      const ageSec = ageSecOf(claim);   // rename 不動 mtime，TTL 照原 token 算
      try { unlinkSync(claim); } catch { /* 刪不掉也已改名，不會再被當 token 認到 */ }
      const valid = ageSec <= TOKEN_TTL_SEC;
      // 留一行紀錄：token 可被預建，事後至少查得出「何時、哪個檔用 token 放行過（或過期被清）」。布林沿用舊 ps1 的 True/False
      // target 剝掉控制字元：路徑來自 patch 文字，夾單獨 \r 會把 log 排版弄成假的一行（security-audit m2）
      const safeTarget = String(target).replace(/[\x00-\x1f\x7f]/g, '?');
      try { appendFileSync(path.join(path.dirname(tokenPath), 'consumed.log'), `${new Date().toISOString()} consumed ${path.basename(tokenPath)} for ${safeTarget} valid=${valid ? 'True' : 'False'}\n`); } catch { /* ignore */ }
      return { existed: true, valid, claimed: true };
    },
    ensureStateDir(dir) {
      if (existsSync(dir)) return true;
      try { mkdirSync(dir, { recursive: true }); return true; } catch { return false; }
    },
  };
  const { exit, lines } = decide(payload, ctx);
  if (lines.length) process.stderr.write(lines.join('\n') + '\n');
  // Codex：exit 2 不算 block（2026-09-09 Windows 實測：exit 2 + stderr、或 exit 2 + stdout JSON 都照寫檔），只認 stdout JSON deny + exit 0；
  // Claude Code 官方就是 exit 2 + stderr。依 isCodexPayload 分流，兩邊各走各的契約。
  if (exit === 2 && isCodexPayload(payload)) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: lines.join('\n') } }) + '\n');
    return 0;
  }
  // 判成 Claude Code 卻帶 cwd 欄位（Codex 特徵之一）：可能是 Codex 改了 payload 形狀、我們判錯了 → 只留痕跡不改判定（security-audit M1）
  if (exit === 2 && payload && typeof payload === 'object' && typeof payload.cwd === 'string') process.stderr.write('[bstack] 注意：這個 payload 帶 cwd 但沒被判成 Codex；若你是 Codex 而檔案仍被寫入，代表 hook 判定要更新（hooks/guard.mjs isCodexPayload）\n');
  return exit;
}

// 直接執行才跑 CLI；被 import（契約 P2d、或別支腳本）時只匯出函式。
// 不用檔名 regex：任何叫 *guard.mjs 的呼叫端 import 本檔都會誤觸 main() 偷讀 stdin（對齊 review 實測）。
// 改比 realpath：磁碟機大小寫、8.3 短檔名、%20 都在 realpathSync.native + toLowerCase 後消掉。
function isMainModule() {
  if (!process.argv[1]) return false;
  const norm = (p) => { try { return realpathSync.native(p).replace(/\\/g, '/').toLowerCase(); } catch { return path.resolve(p).replace(/\\/g, '/').toLowerCase(); } };
  return norm(process.argv[1]) === norm(fileURLToPath(import.meta.url));
}
if (isMainModule()) process.exitCode = main();
