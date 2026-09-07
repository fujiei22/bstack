/**
 * 一次性對照測試：舊兩支 pwsh hook（從 git 8dbb203 取）vs 新 hooks/guard.mjs，同一組 stdin payload 逐案比對。
 *   node scripts/hook-equivalence.mjs            # 需要 pwsh 7+ 與 git；只在跑的平台上有效（本輪 Windows）
 * 比什麼：max(舊 branch exit, 舊 file-type exit) == 新 exit；[bstack] 標記集合（目前在 / BLOCK / WARN / state dir）相等；
 *         WARN 案兩邊印的 token 路徑相等（正規化分隔符）；token 案跑完 token 檔已刪、consumed.log 各多一行。
 * 依 git history 取舊檔：未來 rewrite history 就跑不了，屬預期（spec 待釐清有記）。
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync, utimesSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || '8dbb203';
// realpathSync.native 把 Windows 8.3 短檔名（TOMMY_~1）解成長檔名：.NET GetTempPath 會回長檔名、node 照 env 原樣印，
// 不解開的話 token 路徑比對會因為同一目錄兩種寫法而假紅
const work = path.join(realpathSync.native(tmpdir()), `bstack-hook-eq-${process.pid}`);
mkdirSync(work, { recursive: true });
const oldB = path.join(work, 'branch-safety.ps1'), oldF = path.join(work, 'file-type-guard.ps1');
writeFileSync(oldB, execFileSync('git', ['show', `${BASE}:hooks/branch-safety.ps1`], { cwd: REPO }));
writeFileSync(oldF, execFileSync('git', ['show', `${BASE}:hooks/file-type-guard.ps1`], { cwd: REPO }));
const NEW = path.join(REPO, 'hooks', 'guard.mjs');

// 臨時 repo：main / feat/x / Release 三個 branch；另一個空 repo（無 commit）
const repo = path.join(work, 'repo');
const git = (args, cwd = repo) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
mkdirSync(repo); git(['init', '-q', '-b', 'main']); git(['config', 'user.email', 't@t']); git(['config', 'user.name', 't']);
writeFileSync(path.join(repo, 'a'), 'x'); git(['add', 'a']); git(['commit', '-qm', 'i']);
git(['branch', 'feat/x']); git(['branch', 'Release']);
const empty = path.join(work, 'empty'); mkdirSync(empty); git(['init', '-q'], empty);
const notGit = path.join(work, 'notgit'); mkdirSync(notGit);
const stateBase = path.join(work, 'tmp'); mkdirSync(stateBase);
const badTmp = path.join(work, 'tmp-is-a-file'); writeFileSync(badTmp, 'x');

const tagOf = (stderr) => {
  const s = new Set();
  for (const l of stderr.split(/\r?\n/)) {
    if (!l.startsWith('[bstack]')) continue;
    if (l.includes('目前在')) s.add('branch'); else if (l.includes('BLOCK')) s.add('BLOCK'); else if (l.includes('WARN')) s.add('WARN'); else if (l.includes('state dir')) s.add('statedir');
  }
  return [...s].sort().join('+') || '-';
};
const tokenIn = (stderr) => { const m = stderr.match(/(?:-Path '|--token ")([^'"]+\.token)/); return m ? m[1].replace(/\\/g, '/').toLowerCase() : null; };
const run = (cmd, args, input, env, cwd) => spawnSync(cmd, args, { input, encoding: 'utf8', env, cwd: cwd || repo });

/** 一案：checkout branch → 依 tokenMode 準備 token → 跑舊兩支（各自消耗 token 需分兩次準備）→ 跑新 → 比。 */
const rows = []; let bad = 0;
function caseRun(name, { branch = 'feat/x', payload, envExtra = {}, cwd, projectDir = repo, tokenMode = 'none', expectDiff = null }) {
  if (branch === 'detached') git(['checkout', '-q', '--detach', 'main']); else if (branch) git(['checkout', '-q', branch]);
  const input = payload === null ? '' : typeof payload === 'string' ? payload : JSON.stringify(payload);
  const baseEnv = { ...process.env, TMP: stateBase, TEMP: stateBase, TMPDIR: stateBase, ...envExtra };
  delete baseEnv.XDG_RUNTIME_DIR;
  const env = projectDir === undefined ? baseEnv : { ...baseEnv, CLAUDE_PROJECT_DIR: projectDir };
  if (projectDir === undefined) delete env.CLAUDE_PROJECT_DIR;
  // token 準備：先用新 hook 跑一次拿它印的 token 路徑（同時驗舊的印同一路徑）
  const prep = (mode) => {
    if (mode === 'none') return null;
    const probe = run(process.execPath, [NEW], input, env, cwd);
    const p = tokenIn(probe.stderr); if (!p) throw new Error(`${name}: 拿不到 token 路徑`);
    mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, '');
    if (mode === 'expired') { const t = (Date.now() - 400_000) / 1000; utimesSync(p, t, t); }
    return p;
  };
  const t1 = prep(tokenMode);
  const oB = run('pwsh', ['-NoProfile', '-File', oldB], input, env, cwd);
  const oF = run('pwsh', ['-NoProfile', '-File', oldF], input, env, cwd);
  const oldTokenGone = t1 ? !existsSync(t1) : null;
  const t2 = prep(tokenMode);
  const n = run(process.execPath, [NEW], input, env, cwd);
  const newTokenGone = t2 ? !existsSync(t2) : null;
  const oldExit = Math.max(oB.status, oF.status), newExit = n.status;
  const oldTag = tagOf(oB.stderr + '\n' + oF.stderr), newTag = tagOf(n.stderr);
  const oldTok = tokenIn(oF.stderr), newTok = tokenIn(n.stderr);
  const tokEq = oldTok === null && newTok === null ? 'n/a' : (oldTok === newTok ? 'same' : `DIFF ${oldTok} vs ${newTok}`);
  const consumedEq = t1 ? (oldTokenGone === newTokenGone ? 'both-consumed' : 'DIFF') : 'n/a';
  // expectDiff：spec §等價清單 列的刻意差異（D 系列）——exit 仍要相等，標記 / 路徑允許不同
  const ok = oldExit === newExit && (expectDiff || (oldTag === newTag && !tokEq.startsWith('DIFF') && consumedEq !== 'DIFF'));
  if (!ok) bad++;
  rows.push(`| ${rows.length + 1} | ${name} | ${branch} | ${tokenMode} | ${oB.status} | ${oF.status} | ${oldExit} | ${newExit} | ${oldTag} | ${newTag} | ${tokEq.startsWith('DIFF') ? 'DIFF' : tokEq} | ${consumedEq} | ${ok ? (expectDiff ? `✓（刻意差異 ${expectDiff}）` : '✓') : '✗'} |`);
}

const W = (p, tool = 'Write') => ({ tool_name: tool, tool_input: { file_path: p } });
const R = (rel) => path.join(repo, rel);
caseRun('protected + repo 內 a.ts', { branch: 'main', payload: W(R('src/a.ts')) });
caseRun('feat + repo 內 a.ts', { payload: W(R('src/a.ts')) });
caseRun('repo 外 settings.json（main）', { branch: 'main', payload: W(path.join(work, 'outside', '.claude', 'settings.json')) });
caseRun('repo 外 .gitconfig（main）→ WARN 不看 scope', { branch: 'main', payload: W(path.join(work, 'outside', '.gitconfig')) });
caseRun('protected + .env 雙訊息', { branch: 'main', payload: W(R('.env')) });
caseRun('.env.example', { payload: W(R('.env.example')) });
caseRun('.env.local', { payload: W(R('.env.local')) });
caseRun('NotebookEdit id_rsa', { payload: { tool_name: 'NotebookEdit', tool_input: { notebook_path: R('.ssh/id_rsa') } } });
caseRun('裸 credentials.json（相對路徑）', { payload: W('credentials.json') });
caseRun('.venv/x', { payload: W(R('.venv/x')) });
caseRun('migrations 無 token', { payload: W(R('db/migrations/001.sql')) });
caseRun('migrations token valid', { payload: W(R('db/migrations/001.sql')), tokenMode: 'valid' });
caseRun('migrations token expired', { payload: W(R('db/migrations/001.sql')), tokenMode: 'expired' });
caseRun('package-lock.json', { payload: W(R('package-lock.json')) });
caseRun('Dockerfile', { payload: W(R('Dockerfile')) });
caseRun('tool_name 小寫 edit + .env', { payload: W(R('.env'), 'edit') });
caseRun('branch Release（大小寫）', { branch: 'Release', payload: W(R('a.ts')) });
caseRun('detached HEAD', { branch: 'detached', payload: W(R('a.ts')) });
caseRun('空 repo 無 commit', { branch: false, payload: W(path.join(empty, 'a.ts')), projectDir: empty, cwd: empty });
caseRun('非 git 目錄', { branch: false, payload: W(path.join(notGit, 'a.ts')), projectDir: notGit, cwd: notGit });
caseRun('CLAUDE_PROJECT_DIR 未設、cwd=repo（main）', { branch: 'main', payload: W(R('a.ts')), projectDir: undefined });
caseRun('相對路徑 src/a.ts（main、cwd=repo）', { branch: 'main', payload: W('src/a.ts') });
caseRun('repo 路徑大小寫不同（main）', { branch: 'main', payload: W(R('a.ts').toUpperCase()) });
caseRun('repo/../other/a.ts 走出 repo（main）', { branch: 'main', payload: W(path.join(repo, '..', 'other', 'a.ts')) });
caseRun('正斜線 Windows 路徑（main）', { branch: 'main', payload: W(R('a.ts').replace(/\\/g, '/')) });
caseRun('空 stdin（main）', { branch: 'main', payload: null });
caseRun('Write 無 tool_input（main）', { branch: 'main', payload: { tool_name: 'Write' } });
caseRun('Write 無 file_path（main）', { branch: 'main', payload: { tool_name: 'Write', tool_input: {} } });
caseRun('未知 tool（main）', { branch: 'main', payload: { tool_name: 'Bash', tool_input: { command: 'x' } } });
caseRun('壞 JSON（main）', { branch: 'main', payload: '{oops' });
// D2：舊 ps1 在 TMP 指到檔案時 Join-Path 噴 PowerShell 錯誤、tokenPath 變空、照樣印 WARN（指示是壞的）；新版明確報 state dir 建立失敗。兩邊都 exit 2
caseRun('TEMP 指到檔案 + Dockerfile → state dir 失敗', { payload: W(R('Dockerfile')), envExtra: { TMP: badTmp, TEMP: badTmp, TMPDIR: badTmp }, expectDiff: 'D2' });

const pwshVer = run('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], '', process.env).stdout.trim();
console.log(`環境：${new Date().toISOString().slice(0, 10)} · 基線 ${BASE} · pwsh ${pwshVer} · node ${process.version} · ${process.platform}`);
console.log('| # | 案 | branch | token | 舊 b | 舊 f | 舊 max | 新 | 舊標記 | 新標記 | token 路徑 | token 消耗 | 等價 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
console.log(bad === 0 ? `\nALL EQUAL（${rows.length} 案）` : `\n${bad} 案不等`);
rmSync(work, { recursive: true, force: true });
process.exitCode = bad === 0 ? 0 : 1;
