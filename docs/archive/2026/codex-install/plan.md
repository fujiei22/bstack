# 加 Codex 安裝支援 Implementation Plan

> 對應 spec: `docs/work/feat/codex-install/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-09（v2，依 review.md 修訂）
> 並行最大 group: 4

**Goal**: 同一個 repo 同時是 Claude Code plugin 與 Codex plugin；九階段流程在 Codex 上能裝、能跑，Claude Code 側零行為改變。

**Architecture**: 一份 `skills/`、兩份 manifest（`.claude-plugin/` 與 `.codex-plugin/`）、一份 host 對照表（`skills/devwork/hosts.md`，rules.md 另有 5 行濃縮版）。skill 內文的 `AskUserQuestion` / `TaskCreate` / `Agent` / `subagent_type` / `mcp__<server>__<tool>` 保留為**抽象動詞**，由 hosts.md 定義兩個 host 的具體工具；無法抽象的字面改雙 host 寫法。`hooks/hooks.json` 拆成兩個 matcher group（command 相同）；`guard.mjs` 看懂 `apply_patch`、對 apply_patch 來源路徑以 repo root 解析、branch 段判一次、file-type 段兩趟（先判後消 token）、stderr 自帶兩 host 答案。6 個 agent 由產生器從 frontmatter `tools:` 推導 `sandbox_mode` 與 MCP 依賴轉成 `codex/agents/*.toml`，安裝腳本記 manifest 複製到 `~/.codex/agents/`、可 `-Uninstall`。

**Tech Stack**: node 22（guard / 契約 / 產生器，零依賴）、pwsh 7（安裝腳本）、TOML literal string（Codex agent）、JSON（manifest / marketplace）。

**Risks**: 契約 P9a / P9c 對 rules.md Tier 表與 request-review 有字面斷言（`code-review medium`、`Skill("code-review", args="medium")` 等），雙 host 改寫**只加不刪**；Codex CLI 讀哪一份 marketplace、`$bstack:` 命名空間、`request_user_input` 可用性只能實測——所以 Task 0 先證明「hook 會被 Codex 呼叫」再施工。

**執行注意**：
- 派 subagent 照 memory `feedback-subagent-fanout-out-dir`（成品寫 `out/`、主 agent 機械驗收後落工作樹）與 `feedback-simple-subagent-use-opus`（Task 3 / 4 / 6 / 8 派 `model: opus`）。
- 紅測試**不用 `node -e`**（Bash 工具吃反斜線，memory `reference-bash-tool-eats-backslashes`）；先 Write 成 scratchpad 的 `.mjs`（檔名 `t<N>.mjs`）再 `node` 跑。
- 契約腳本只在 Task 1 與 Task 9 改。
- Task 6 的掃描只對自己 files；全域版留 Task 9 P14。

---

## §檔案結構規劃

| 項 | 路徑 | 職責 |
|---|---|---|
| 新建（Task 0） | `.codex-plugin/plugin.json` | Codex 原生 manifest；`skills: "./skills/"`；hooks 走預設 `hooks/hooks.json` |
| 新建（Task 0） | `.agents/plugins/marketplace.json` | Codex 原生 marketplace；`source.path: "./"` 相對 marketplace root（= repo root，文件明寫「不是相對 `.agents/plugins/`」） |
| 改（Task 0） | `hooks/hooks.json` | 拆兩個 matcher group：`Write\|Edit` 與 `NotebookEdit` |
| 改（Task 1） | `hooks/guard.mjs` | `targetsOf()`（含 `relTo`）、`applyPatchPaths()`、`decide()` 兩趟、`getBranch` memoize、`consumeToken(tokenPath, target)`、訊息自帶答案、repoDir fallback + sanity |
| 改（Task 1 / 9） | `scripts/plugin-contract.mjs` | P2d fixture 31-44、P2e 加 apply_patch spawn（Task 1）；P13-P16（Task 9） |
| 新建（Task 2） | `skills/devwork/hosts.md` | 八節四欄對照表 + 第一行護欄 |
| 改（Task 2） | `skills/devwork/SKILL.md` | `:5` description、`:13` `@import`、使用契約第 1 步、`:34` 清單 |
| 改（Task 2） | `skills/devwork/rules.md` | §決策點選單（+5 行濃縮表）、§Branch safety、Tier 表 review 欄、§協作模式判定、§Settings.json |
| 改（Task 3） | `.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json`、`.codex-plugin/plugin.json` | version 1.6.0；三處 description host 中性 |
| 新建（Task 4） | `scripts/gen-codex-agents.mjs`、`codex/agents/*.toml`（6） | 產生器（推導式）與產物 |
| 改（Task 5） | `skills/request-review/SKILL.md`、`skills/dispatch-parallel/SKILL.md`（整檔）、`skills/brainstorm/SKILL.md:31,50`、`skills/pr-explain/SKILL.md` | 雙 host 改寫 |
| 改（Task 6） | `skills/{context-snapshot,retro,design-language,execute-plan,write-skill,dev-workflow,review-plan,finish-branch,lock-files}/SKILL.md`、`agents/{hypothesis-tester,security-auditor}.md` | 字面掃描（design-language 只改 `:14`，`:85` CSS `@import` 不動） |
| 新建（Task 7） | `scripts/install-codex.ps1` | 五步安裝 + manifest `~/.codex/bstack-codex.json` + `-Uninstall` |
| 改（Task 8） | `README.md` | 簡介、§Hooks、Prerequisites、新「## Codex」節、§完全移除、§開發本 repo |
| 改（Task 9） | `scripts/build-references.ps1`；重產 `docs/js/references-data.js` | 內嵌 hosts.md |
| 改（Task 10） | `docs/work/feat/codex-install/spec.md`、`README.md` | 實測回填 |

**介面**：
- `guard.mjs` export：`applyPatchPaths(cmd) → string[]`；`targetsOf(payload) → { isWrite, targets: { path: string|null, relTo: 'repo'|null }[] }`；`targetOf(payload) → { isWrite, target }`（相容殼，回第一個 `path`）；`decide(payload, ctx)` 簽名不變，`ctx.consumeToken(tokenPath, target)` 多一個參數（舊呼叫端只傳一個仍可）、新增 `ctx.peekToken(tokenPath) → { valid }`（只查不刪）。
- `gen-codex-agents.mjs`：`render(name, md) → string`（純函式，export）；CLI 無參數寫檔、`--check` 比對；缺 MCP 範本 / 未知 model / 本文含 `'''` → exit 1。
- hosts.md 八個節標題（契約 P16 用 `/^##[ \t]+§<名>[ \t]*$/m` 逐一比對）：`§Host 判定`、`§決策點`、`§任務追蹤`、`§派 subagent`、`§程式碼審查`、`§MCP 工具`、`§Memory 路徑`、`§停用 plugin`。每節表頭固定 `| 抽象動作 | Claude Code | Codex | 工具不在清單時 |`（§Host 判定 與 §停用 plugin 例外，各自表頭見 Task 2）。

---

### Task 0: Codex manifest + hooks.json 拆 group + hook 觸發實測
**parallel-group**: 0
**files**:
- create: `.codex-plugin/plugin.json`、`.agents/plugins/marketplace.json`
- modify: `hooks/hooks.json`
- 記錄: `docs/work/feat/codex-install/spec.md` §施工紀錄

- [ ] **Step 1: 寫失敗測試**（scratchpad `t0.mjs`；Task 9 搬進 P13）
```js
import { readFileSync, existsSync } from 'node:fs';
const J = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { return { __err: e.message }; } };
const c = J('.codex-plugin/plugin.json'), m = J('.agents/plugins/marketplace.json'), h = J('hooks/hooks.json');
const e = m.plugins?.[0] || {};
const groups = h.hooks?.PreToolUse || [];
const ok = !c.__err && c.name === 'bstack' && c.skills === './skills/' && existsSync(c.skills) && !('hooks' in c)
  && !m.__err && m.name === 'bstack' && e.name === 'bstack' && e.source?.source === 'local' && e.source?.path === './'
  && ['AVAILABLE', 'INSTALLED_BY_DEFAULT'].includes(e.policy?.installation) && !!e.policy?.authentication && !!e.category
  && groups.length === 2 && groups.some((g) => g.matcher === 'Write|Edit') && groups.some((g) => g.matcher === 'NotebookEdit')
  && new Set(groups.map((g) => g.hooks[0].command)).size === 1;
console.log(ok ? 'PASS' : 'FAIL ' + JSON.stringify({ c, m, groups }).slice(0, 400)); process.exitCode = ok ? 0 : 1;
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL，兩檔不存在、hooks.json 只有一組）
```
node "<scratchpad>/t0.mjs"
```
- [ ] **Step 3: 寫最小實作**
```json
{
  "name": "bstack",
  "version": "1.5.0",
  "description": "繁中台灣用語的九階段開發流程：$bstack:devwork（Codex）或 /devwork（Claude Code）啟動 brainstorm → plan → execute → verify → review → security → finish → pr-explain → retro",
  "author": { "name": "Tommy Sian" },
  "homepage": "https://fujiei22.github.io/bstack/",
  "repository": "https://github.com/fujiei22/bstack",
  "license": "MIT",
  "keywords": ["workflow", "zh-tw", "tdd", "code-review"],
  "skills": "./skills/",
  "interface": {
    "displayName": "bstack",
    "shortDescription": "繁中九階段開發流程",
    "longDescription": "brainstorm → plan → execute → verify → review → security → finish → pr-explain → retro；含 branch-safety / file-type hook（安裝後需在 /hooks 信任才生效）。",
    "developerName": "Tommy Sian",
    "category": "Developer Tools",
    "capabilities": ["Read", "Write"]
  }
}
```
```json
{
  "name": "bstack",
  "interface": { "displayName": "bstack" },
  "plugins": [
    { "name": "bstack",
      "source": { "source": "local", "path": "./" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Developer Tools" }
  ]
}
```
```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Write|Edit", "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs\"" } ] },
      { "matcher": "NotebookEdit", "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs\"" } ] }
    ]
  }
}
```
接著**實測**（人工，逐項記到 spec §施工紀錄「Task 0」）：
  0. **前置（2026-09-09 實查）**：本機 `codex` 不在 PATH（bash / pwsh 都找不到；`%LOCALAPPDATA%\Programs\OpenAI\Codex\bin`、npm、standalone 三處都沒有），但 `~/.codex/` 已有 config.toml（`mysql` 與 `playwright` 兩個 MCP server 已設、playwright `enabled = false`、`model = "gpt-5.4"` 已退役、`features.memories = true`）與 `agents/dev-workflow-gate-runner.toml`。**安裝 CLI 是裝軟體，先問 user**：`powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"`，或由 user 指出既有 codex.exe 路徑。另 `~/.agents/skills/` 有**舊版 bstack skill 副本**（`dev-workflow`、`db-access`、`huashu-design`、`learned`；dev-workflow 的 description 仍是「Triggers on keywords: 寫 / 改 / 修 …」自動攔截版），Codex 同名 skill 不合併、兩個都會列——Task 0 第 4 項要一併記下是否出現兩個 dev-workflow；正式處理在 Task 7 的 `-Migrate`。
  1. `codex --version`。
  2. `codex plugin marketplace add D:\GitHub\bstack` → `codex plugin marketplace list --json`：記載到的是 `.agents/plugins/marketplace.json` 還是 `.claude-plugin/marketplace.json`、`root` 是什麼。
  3. `codex plugin add bstack@bstack --json` → 記 `installedPath`；確認該路徑下有 `hooks/hooks.json` 與 `skills/`。
  4. 新開 `codex` session：`/skills` 記 bstack skill 的實際呼叫名（`$bstack:devwork` 或 `$devwork`）與數量 28。
  5. `/hooks`：看到 PreToolUse 兩組、command 已展開成 installedPath → 信任。
  6. 在一個 `main` 上的暫存 repo（`git init -b main`、一個 commit）要 Codex「在 a.txt 加一行」→ 期望 exit 2、stderr 含「目前在 'main'」（此時 guard 還是舊版，訊息含 AskUserQuestion 字樣無妨）；記 Codex 顯示的 hook 錯誤文字與 hook 進程 cwd（在 guard 前臨時加一行 `console.error('[cwd]', process.cwd())` 看完即拔）。
  7. `git checkout -b feat/x` 後同動作 → 放行。
  任一項失敗 → rules.md §Fail handling 問 user（尤其第 6 項：hook 沒被呼叫代表 matcher 假設錯，Task 1 之後全部要重排）。
- [ ] **Step 4: 跑測試確認通過**（`t0.mjs` PASS；`node scripts/plugin-contract.mjs` P1 / P2a / P2b 仍綠；實測 7 項記錄完整）
- [ ] **Step 5: commit**
```bash
git add .codex-plugin .agents hooks/hooks.json docs/work/feat/codex-install/spec.md
git commit -m "feat: Codex manifest 與 marketplace；hooks.json 拆兩個 matcher group；Task 0 實測紀錄"
```

### Task 1: guard.mjs 支援 apply_patch（相對路徑解析、多檔兩趟）+ repoDir fallback + 自帶答案訊息
**parallel-group**: 1
**files**:
- modify: `hooks/guard.mjs`（docstring、`targetOf`、`decide`、`main`、常數）
- test: `scripts/plugin-contract.mjs` P2d 陣列與 P2e 段

- [ ] **Step 1: 寫失敗測試**。P2D 追加（既有 1-30，新號 31 起）：
```js
const AP = (files, op = 'Update File') => ({ tool_name: 'apply_patch', tool_input: { command: ['*** Begin Patch', ...files.map((f) => `*** ${op}: ${f}`), '*** End Patch'].join('\n') } });
const ctx2 = (o) => { const c = ctxOf(o); c.peekToken = (p) => ({ valid: (o?.tokens || {})[p] === true }); c.consumeToken = (p, t) => { (c.consumed ||= []).push({ p, t }); return { existed: true, valid: true }; }; return c; };
['31 apply_patch 相對 src/a.ts protected → 擋、只印一次「目前在」', AP(['src/a.ts', 'src/b.ts']), ctxOf({ branch: 'main' }), 2, { b: true }],   // 另斷言 lines.filter(l=>l.includes('目前在')).length === 1
['32 apply_patch 相對 Dockerfile → WARN', AP(['Dockerfile']), ctxOf(), 2, { W: true }],
['33 apply_patch 相對 package-lock.json → WARN', AP(['package-lock.json']), ctxOf(), 2, { W: true }],
['34 apply_patch 相對 .github/workflows/ci.yml → WARN', AP(['.github/workflows/ci.yml']), ctxOf(), 2, { W: true }],
['35 apply_patch 相對 credentials.json → BLOCK（Write 裸 credentials.json 仍放，fixture 9）', AP(['credentials.json'], 'Add File'), ctxOf(), 2, { B: true }],
['36 apply_patch Move to id_rsa → BLOCK', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: a.txt\n*** Move to: .ssh/id_rsa\n*** End Patch' } }, ctxOf(), 2, { B: true }],
['37 apply_patch 無 command → 當沒帶路徑（protected 擋）', { tool_name: 'apply_patch', tool_input: {} }, ctxOf({ branch: 'main' }), 2, { b: true }],
['38 apply_patch Delete .env.example → 放', AP(['.env.example'], 'Delete File'), ctxOf(), 0, {}],
['39 截斷 patch（無 End Patch）仍取到路徑 → .env BLOCK', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Add File: .env\n+X=1' } }, ctxOf(), 2, { B: true }],
['40 CRLF patch → Dockerfile WARN', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\r\n*** Update File: Dockerfile\r\n*** End Patch\r\n' } }, ctxOf(), 2, { W: true }],
['41 BLOCK + WARN 混合 → exit 2 且 token 未被消耗', AP(['.env', 'Dockerfile']), ctx2({ tokens: {} }), 2, { B: true, W: true }],   // 另斷言 ctx.consumed 為空
['42 兩 WARN 只一個有效 token → exit 2、無 consume', AP(['Dockerfile', 'docker-compose.yml']), ctx2({ tokens: { [G.tokenPathFor(...)] : true } }), 2, { W: true }],  // token 路徑用 tokenPathFor 算 Dockerfile 那個
['43 兩 WARN 兩 token 都有效 → 放行、consume 兩次且 target 各對', AP(['Dockerfile', 'docker-compose.yml']), ctx2({ tokens: {/* 兩個都 true */} }), 0, {}],
['44 同路徑重複（Update + Move to 同檔）→ 只判一次', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: Dockerfile\n*** Move to: Dockerfile\n*** End Patch' } }, ctx2({ tokens: {/* Dockerfile true */} }), 0, {}],   // 另斷言 consumed.length === 1
```
（41-44 的 token 路徑在 fixture 內用 `G.tokenPathFor(fwd(path.resolve(REPO_FIX, 'Dockerfile')).toLowerCase(), ctxOf().env)` 算，不寫死 hash。）P2e 追加：無 `CLAUDE_PROJECT_DIR`、cwd = repo 內子目錄 → apply_patch 相對 `src/a.ts` 在 main 被擋（驗 git toplevel fallback）；stderr 含 `request_user_input`（驗訊息自帶答案）；多檔 WARN stderr 只含一次「處置（依序執行）」。
- [ ] **Step 2: 跑測試確認失敗**（Expected: P2d 31-44、P2e FAIL）
```
node scripts/plugin-contract.mjs | grep -E 'P2d|P2e'
```
- [ ] **Step 3: 寫最小實作**
```js
/** apply_patch 的 command → 路徑陣列。行首 `*** ` 錨定：patch 內容行一律有 `+` / `-` / 空白前綴，不會誤觸；截斷（無 End Patch）也回已見路徑（fail-closed）。 */
export function applyPatchPaths(cmd) {
  if (typeof cmd !== 'string') return [];
  const out = [];
  for (const line of cmd.split(/\r?\n/)) { const m = line.match(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/); if (m && m[1].trim()) out.push(m[1].trim()); }
  return out;
}
export function targetsOf(payload) {
  if (payload === undefined) return { isWrite: true, targets: [{ path: null, relTo: null }] };
  if (payload === null || typeof payload !== 'object') return { isWrite: false, targets: [] };
  const t = String(payload.tool_name || '').toLowerCase();
  const i = (payload.tool_input && typeof payload.tool_input === 'object') ? payload.tool_input : {};
  const str = (v) => (typeof v === 'string' && v !== '' ? v : null);
  if (t === 'edit' || t === 'write') return { isWrite: true, targets: [{ path: str(i.file_path), relTo: null }] };
  if (t === 'notebookedit') return { isWrite: true, targets: [{ path: str(i.notebook_path), relTo: null }] };
  if (t === 'apply_patch') { const ps = applyPatchPaths(i.command); return { isWrite: true, targets: ps.length ? ps.map((p) => ({ path: p, relTo: 'repo' })) : [{ path: null, relTo: null }] }; }
  return { isWrite: false, targets: [] };
}
export function targetOf(payload) { const r = targetsOf(payload); return { isWrite: r.isWrite, target: r.targets[0]?.path ?? null }; }
```
`decide(payload, ctx)`：
  1. `targets` 取出後，`relTo === 'repo'` 且非絕對路徑者 `path.resolve(ctx.repoDir, path)`；以 `canonical()` 後字串 dedupe。
  2. **branch 段一次**：`inScope = targets 有任一 null 或任一在 repo 內`；`ctx.getBranch()` memoize（`ctx._branch ??= ...`）；命中印一次三行（第二行改「用決策問題工具跟 user 確認名稱——Claude Code 是 `AskUserQuestion`；Codex 是 `request_user_input`，工具不在清單就文字提問、選項編號」）。
  3. **file-type 第一趟**：逐 target 算 `normalized`（用解析後路徑）→ EXEMPT / BLOCK / WARN 分類；BLOCK 收集（tag + path）；WARN 收集 `{tag, path, tokenPath, valid: ctx.peekToken(tokenPath).valid}`。
  4. 結果：有 BLOCK → 印 BLOCK 訊息（逐檔一行）+ 共用尾註，exit 2，**不 consume**。無 BLOCK 但有 WARN 且（branch 擋 或 任一 WARN 無效 token）→ 印「WARN：<tag>：<path>」逐檔 + 逐檔一行 `node "<self>" --token "<tokenPath>"` + 共用「處置（依序執行）」三步 + 備註 + DISABLE_HINT **各一次**（>5 檔只列前 5 + 「另有 N 個」），exit 2，不 consume。全部有效且無阻擋 → **第二趟** `ctx.consumeToken(tokenPath, path)` 逐個消耗，exit 0。
  5. `DISABLE_HINT = '若你沒在用 bstack 流程、不想要這個檢查：Claude Code 打 /plugin disable bstack@bstack；Codex 打 /plugins 選 bstack 按 Space 停用（Codex 另需 /hooks 信任本 hook 才會跑）'`。
`main()`：
```js
function gitToplevel(cwd) { /* 同 getBranch 的 ENOENT 退路；失敗回 null */ }
let repoDir = process.env.CLAUDE_PROJECT_DIR || null;
if (!repoDir) { const top = gitToplevel(process.cwd()); repoDir = top || process.cwd(); }
```
`ctx.peekToken(p)` = 存在且 mtime 在 TTL 內；`ctx.consumeToken(p, target)` 刪檔並 log `for ${target}`。`ctx.getBranch` 對 `repoDir` 跑（sanity：toplevel 若不包含任何解析後 target，`inScope` 仍當 true 照查 branch——fail-closed）。docstring 更新：兩 host、apply_patch、兩趟、Codex 上多一次 `git rev-parse --show-toplevel`。
- [ ] **Step 4: 跑測試確認通過**（Expected: P2d 1-44、P2e PASS；其他契約不變）
```
node scripts/plugin-contract.mjs
```
- [ ] **Step 5: commit**
```bash
git add hooks/guard.mjs scripts/plugin-contract.mjs
git commit -m "feat: guard.mjs 支援 Codex apply_patch（相對路徑解析、多檔兩趟判定）、git toplevel fallback、訊息自帶兩 host 答案"
```

### Task 2: hosts.md + devwork / rules.md 接線
**parallel-group**: 1
**files**:
- create: `skills/devwork/hosts.md`
- modify: `skills/devwork/SKILL.md:5`（description）、`:12-14`（使用契約第 1 步；`:13` 的 `@import` 句）、`:34`（顯式呼叫清單）
- modify: `skills/devwork/rules.md:36`（§決策點選單）、`:41`（§Branch safety）、`:107-108`（Tier 表 review 欄）、`:119-131`（§協作模式判定）、`:148`（§Settings.json）

- [ ] **Step 1: 寫失敗測試**（scratchpad `t2.mjs`；Task 9 搬進 P16）
```js
import { readFileSync, existsSync } from 'node:fs';
const r = (p) => existsSync(p) ? readFileSync(p, 'utf8') : '';
const h = r('skills/devwork/hosts.md'), dw = r('skills/devwork/SKILL.md'), rules = r('skills/devwork/rules.md');
const heads = ['Host 判定', '決策點', '任務追蹤', '派 subagent', '程式碼審查', 'MCP 工具', 'Memory 路徑', '停用 plugin'];
const missHead = heads.filter((n) => !new RegExp(`^##[ \\t]+§${n}[ \\t]*$`, 'm').test(h));
const tierT2 = (rules.match(/^\| \*\*T2\*\*.*$/m) || [''])[0], tierT3 = (rules.match(/^\| \*\*T3\*\*.*$/m) || [''])[0];
const bs = (rules.match(/^### §Branch safety[\s\S]*?(?=^### )/m) || [''])[0];
const ok = missHead.length === 0 && /^> .*抽象動詞.*不是工具名/m.test(h.split('\n').slice(0, 3).join('\n'))
  && /request_user_input/.test(h) && /update_plan/.test(h) && /spawn_agent/.test(h) && /mcp__/.test(h)
  && /hosts\.md/.test(dw) && /\$bstack:devwork/.test(dw) && !/@import/.test(dw)
  && /hosts\.md/.test(rules) && /code-review medium/.test(tierT2) && /Codex/.test(tierT2) && /code-review high/.test(tierT3) && /依改動面向/.test(tierT3)
  && /\/plugin disable bstack@bstack/.test(bs) && /\/plugins/.test(bs) && /Codex 無 Agent Teams/.test(rules);
console.log(ok ? 'PASS' : 'FAIL ' + JSON.stringify({ missHead, dw: /hosts\.md/.test(dw), rules: /hosts\.md/.test(rules) })); process.exitCode = ok ? 0 : 1;
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL）
- [ ] **Step 3: 寫最小實作**。hosts.md：
```markdown
# hosts.md（host 對照表）
> **本表裡的 `AskUserQuestion` / `TaskCreate` / `TaskUpdate` / `TaskList` / `Agent` / `subagent_type` / `SendMessage` / `mcp__<server>__<tool>` 是抽象動詞不是工具名。** 動作前先確認同名工具在你自己的工具清單裡；不在，就照本表對應欄——**不要去找同名工具、也不要靜默略過該動作**。§Host 判定 只是預設值，工具清單永遠優先。
> 八個節標題與每節第一欄是契約鍵（plugin-contract.mjs P14 / P16），改名要同步。

## §Host 判定
| 訊號 | 判定 |
|---|---|
| 工具清單有 `AskUserQuestion` | Claude Code |
| 工具清單有 `apply_patch` 或 `spawn_agent` | Codex |
| 都沒有（例如你是被 spawn 的 subagent） | 不做決策點；把要問 user 的問題回報給主 agent，由它問 |

## §決策點
| 抽象動作 | Claude Code | Codex | 工具不在清單時 |
|---|---|---|---|
| `AskUserQuestion` | 同名工具；推薦選項第一、標「（推薦）」 | `request_user_input`（1-3 題附選項；experimental） | 文字提問、**選項編號、user 回編號**。編號可窮舉、無歧義、不靠語意判斷，所以不算 rules.md 禁的「文字 token NLP」；回的不是清單內編號一律重問、不猜 |

## §任務追蹤
| 抽象動作 | Claude Code | Codex | 工具不在清單時 |
|---|---|---|---|
| `TaskCreate` / `TaskUpdate` / `TaskList` | 同名工具 | `update_plan`（步驟 pending / inProgress / completed；需 `tools.update_plan.enabled = true`，install-codex.ps1 已寫） | 在 spec §施工清單 或 plan.md 的 checkbox 勾；retro 的歷史用 git log + plan.md |

## §派 subagent
| 抽象動作 | Claude Code | Codex | 工具不在清單時 |
|---|---|---|---|
| `Agent` + `subagent_type: <name>` | 同名工具、`subagent_type: bstack:<name>` | `spawn_agent`，agent 名 = `~/.codex/agents/<name>.toml` 的 `name`；收結果 `wait_agent` | 沒裝 TOML → 內建 `explorer`（唯讀）或 `worker`，把 `agents/<name>.md` 本文貼進 prompt；連 spawn 都沒有 → 主 agent 自己做並在回報標「未隔離」 |
| `SendMessage`（subagent 回結論 / 隊友通訊） | 同名工具 | 結論由 `wait_agent` 收；追加指令 `send_input` | 把結論寫在最終回覆 |

## §程式碼審查
| 抽象動作 | Claude Code | Codex | 工具不在清單時 |
|---|---|---|---|
| 內建 `code-review`（`Skill("code-review", args="medium\|high")`） | 同左，結果走 task-notification | 無可由模型呼叫的內建 review：T2 `spawn_agent` 一個 `reviewer`（唯讀）用 request-review §Codex reviewer prompt；T3 同上 + 對齊 subagent；另提醒 user 可自跑 `/review`。覆蓋面低於 8 finder，finding 分級不變 | 主 agent 自審並標「未隔離」 |

## §MCP 工具
| 抽象動作 | Claude Code | Codex | 工具不在清單時 |
|---|---|---|---|
| `mcp__<server>__<tool>`（例 `mcp__mysql__mysql_query`、`mcp__playwright__browser_*`） | `.mcp.json` / `claude mcp add`，工具名同格式 | `codex mcp add <server> -- <cmd>`，工具名同格式；**server 名必須與 skill / agent 寫的一致**（mysql、playwright） | **回報「MCP 工具 X 不在」並停在需要它的步驟**，不靜默略過（rules.md §事實核實 的儲存端就靠它） |

## §Memory 路徑
| 抽象動作 | Claude Code | Codex | 工具不在清單時 |
|---|---|---|---|
| brainstorm 0a 讀 memory | `~/.claude/projects/<slug>/memory/MEMORY.md`（session 起始已載入） | `$CODEX_HOME/memories/`（`features.memories` 開才有）→ 沒有就讀 repo `docs/reference/` | `memory_loaded: false`，原因寫進 spec §待釐清，不卡流程 |

## §停用 plugin
| Host | 指令 |
|---|---|
| Claude Code | `/plugin disable bstack@bstack` |
| Codex | `/plugins` 選 bstack 按 Space；hook 另需 `/hooks` 信任才會跑 |
```
devwork/SKILL.md：`:5` description 改「載入：Claude Code 輸入 `/devwork <要做的事>`（Unknown command 時改打 `/bstack:devwork`）；Codex 輸入 `$bstack:devwork <要做的事>`。不因自然語言自動載入；沒下指令時就是普通的 Claude Code / Codex。」；第 1 步「**讀 `rules.md` 與 `hosts.md`**（同目錄）… 若本 session 的 CLAUDE.md / AGENTS.md 已引用 rules.md，不重讀」；`:34` 清單改「（Claude Code `/bstack:finish-branch`…；Codex `$bstack:finish-branch`…）」。
rules.md：§決策點選單 後加 5 行濃縮表（抽象動詞 → Claude Code / Codex 工具，各一行；完整版指 hosts.md）；§Branch safety 的 `$CLAUDE_PROJECT_DIR` 句改「hook 只管 project repo（Claude Code 由 `$CLAUDE_PROJECT_DIR` 給、Codex 由 `git rev-parse --show-toplevel` 算）底下的檔」、停用句改「Claude Code `/plugin disable bstack@bstack`；Codex `/plugins` 停用、且 hook 需 `/hooks` 信任才生效」；Tier 表 T2 review 欄 `內建 \`/code-review medium\`（Codex：reviewer subagent，見 hosts.md §程式碼審查）+ 主 agent 對 spec 自檢…`、T3 同法（**保留** `code-review high`、`依改動面向`）；§協作模式判定 末尾加「- **Codex 無 Agent Teams**：不做開關偵測；同 group ≥2 task 就 `AskUserQuestion` 問 subagent 平行 / 串行二選一」；§Settings.json 首句加「（Claude Code 專案設定；Codex 對應為 `.codex/config.toml` 與 `rules/*.rules`，見 README Codex 節）」。
- [ ] **Step 4: 跑測試確認通過**（`t2.mjs` PASS；契約 P4 / P6 / P9a 仍綠）
- [ ] **Step 5: commit**
```bash
git add skills/devwork/hosts.md skills/devwork/SKILL.md skills/devwork/rules.md
git commit -m "feat: 加 hosts.md 兩 host 對照表；devwork / rules.md 雙 host 接線"
```

### Task 3: 版本 1.6.0、三處 description host 中性
**parallel-group**: 1
**files**:
- modify: `.claude-plugin/plugin.json:3-4`、`.claude-plugin/marketplace.json:5,9-10`、`.codex-plugin/plugin.json:3`

- [ ] **Step 1: 寫失敗測試**（scratchpad `t3.mjs`；併入 P13）
```js
import { readFileSync } from 'node:fs';
const J = (p) => JSON.parse(readFileSync(p, 'utf8'));
const a = J('.claude-plugin/plugin.json'), am = J('.claude-plugin/marketplace.json'), c = J('.codex-plugin/plugin.json');
const vs = [a.version, am.plugins[0].version, c.version];
const descs = [a.description, am.metadata.description, am.plugins[0].description];
const ok = vs.every((v) => v === '1.6.0') && descs.every((d) => !/Claude Code 九階段|Claude Code 開發流程/.test(d)) && descs.every((d) => /\$bstack:devwork|Codex/.test(d));
console.log(ok ? 'PASS' : 'FAIL ' + JSON.stringify({ vs, descs })); process.exitCode = ok ? 0 : 1;
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL）
- [ ] **Step 3: 寫最小實作**：三處 version 改 `1.6.0`；`.claude-plugin/plugin.json` description 改「繁中台灣用語的九階段開發流程：`/devwork`（Claude Code）或 `$bstack:devwork`（Codex）啟動 brainstorm → … → retro」；marketplace 的 `metadata.description`「bstack 自己的 marketplace（Claude Code 與 Codex 共用），只有一個 plugin」、`plugins[0].description` 同 plugin.json。
- [ ] **Step 4: 跑測試確認通過**（`t3.mjs` PASS；契約 P1 綠）
- [ ] **Step 5: commit**
```bash
git add .claude-plugin .codex-plugin
git commit -m "chore: 版本 1.6.0；manifest description 改 host 中性"
```

### Task 4: agents → Codex TOML 產生器（推導式）
**parallel-group**: 1
**files**:
- create: `scripts/gen-codex-agents.mjs`、`codex/agents/*.toml`（6）

- [ ] **Step 1: 寫失敗測試**（scratchpad `t4.mjs`；Task 9 P15 用 `--check` + import `render` 各一）
```js
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
const chk = spawnSync(process.execPath, ['scripts/gen-codex-agents.mjs', '--check'], { encoding: 'utf8' });
const tomls = existsSync('codex/agents') ? readdirSync('codex/agents').filter((f) => f.endsWith('.toml')) : [];
const sa = tomls.includes('security-auditor.toml') ? readFileSync('codex/agents/security-auditor.toml', 'utf8') : '';
const fe = tomls.includes('frontend-e2e-runner.toml') ? readFileSync('codex/agents/frontend-e2e-runner.toml', 'utf8') : '';
const ok = chk.status === 0 && tomls.length === 6 && /^sandbox_mode = "read-only"$/m.test(sa) && /^sandbox_mode = "workspace-write"$/m.test(fe)
  && /^developer_instructions = '''$/m.test(sa) && !/\r/.test(sa) && /^# \[mcp_servers\.playwright\]/m.test(fe) && !/^\[mcp_servers/m.test(fe)
  && /^description = "[^\r]*"$/m.test(sa);
console.log(ok ? 'PASS' : 'FAIL ' + JSON.stringify({ status: chk.status, out: chk.stdout, tomls })); process.exitCode = ok ? 0 : 1;
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL，腳本不存在）
- [ ] **Step 3: 寫最小實作**
```js
#!/usr/bin/env node
/**
 * agents/<name>.md → codex/agents/<name>.toml（Codex custom agent）。改 md 後重跑；--check 只比對不寫檔。
 * 全部從 frontmatter 推導、不另維護清單：tools 含 Write / Edit / NotebookEdit → workspace-write，否則 read-only；
 * tools 內 mcp__<server>__ 前綴 → 需要的 MCP server，對照 MCP_TEMPLATES（缺對照 exit 1）；model 對照 MODEL（缺 exit 1）。
 * developer_instructions 用 TOML literal string '''…'''（不處理跳脫，Windows 路徑 / regex 安全）；本文含 ''' 就 exit 1。
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
// Codex 模型名漂移時只改這裡（2026-09：gpt-5.4 系列已退役）
const MODEL = { sonnet: 'gpt-5.6-terra', opus: 'gpt-5.6-sol', haiku: 'gpt-5.6-luna' };
// server 名必須與 agent 的 mcp__<server>__ 一致；整段註解輸出，使用者取消註解並填自己的 command
const MCP_TEMPLATES = {
  mysql: ['# [mcp_servers.mysql]', '# command = "npx"', '# args = ["-y", "<你的 mysql MCP 套件>"]', '# # 工具名必須是 mcp__mysql__mysql_query；server 名恰為 mysql 才對得上 agent 的 tools'],
  playwright: ['# [mcp_servers.playwright]', '# command = "npx"', '# args = ["-y", "@playwright/mcp@0.0.68"]', '# # 版本 pin 到 2026-09-09 實測；server 名恰為 playwright'],
};
const strip = (t) => t.replace(/^﻿/, '').replace(/\r\n/g, '\n');
function frontmatter(t) { const m = t.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/); if (!m) throw new Error('no frontmatter'); return { head: m[1], body: m[2] }; }
function field(h, k) { const m = h.match(new RegExp(`^${k}:[ \\t]*(.*)$`, 'm')); return m ? m[1].trim() : ''; }
/** description：支援 | |- > >-（只吃 [ \t]，不用 \s——\s 會吃掉換行留裸 \r） */
function description(h) {
  const multi = h.match(/^description:[ \t]*[|>]-?[ \t]*\n((?:(?:[ \t]+.*|[ \t]*)(?:\n|$))*)/m);
  const raw = multi && multi[1].trim() ? multi[1] : field(h, 'description');
  return raw.split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
}
function tools(h) { const m = h.match(/^tools:[ \t]*(\[[\s\S]*?\])/m); if (!m) return []; return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]); }
const q = (s) => JSON.stringify(s);
export function render(name, md) {
  const { head, body } = frontmatter(strip(md));
  const tl = tools(head);
  const write = tl.some((t) => /^(Write|Edit|NotebookEdit)$/.test(t));
  const servers = [...new Set(tl.map((t) => (t.match(/^mcp__([^_]+)__/) || [])[1]).filter(Boolean))];
  const missing = servers.filter((s) => !MCP_TEMPLATES[s]); if (missing.length) throw new Error(`${name}: 缺 MCP 範本 [${missing}]，先在 MCP_TEMPLATES 加`);
  const mk = field(head, 'model') || 'sonnet'; if (!MODEL[mk]) throw new Error(`${name}: 未知 model "${mk}"，先在 MODEL 加對照`);
  if (body.includes("'''")) throw new Error(`${name}: 本文含 ''' 無法用 literal string`);
  const lines = [`# 由 scripts/gen-codex-agents.mjs 從 agents/${name}.md 產生，勿手改；改 md 後重跑 node scripts/gen-codex-agents.mjs`,
    `name = ${q(name)}`, `description = ${q(description(head))}`, `model = ${q(MODEL[mk])}`, 'model_reasoning_effort = "high"',
    `sandbox_mode = ${q(write ? 'workspace-write' : 'read-only')}`, "developer_instructions = '''", body.trimEnd(), "'''", ''];
  for (const s of servers) lines.push(...MCP_TEMPLATES[s], '');
  return lines.join('\n');
}
function main() {
  const check = process.argv.includes('--check'); const outDir = join(REPO, 'codex', 'agents'); if (!check) mkdirSync(outDir, { recursive: true });
  let bad = 0;
  for (const f of readdirSync(join(REPO, 'agents')).filter((x) => x.endsWith('.md')).sort()) {
    const name = f.replace(/\.md$/, ''); const out = render(name, readFileSync(join(REPO, 'agents', f), 'utf8')); const p = join(outDir, `${name}.toml`);
    if (check) { if (!existsSync(p) || strip(readFileSync(p, 'utf8')) !== out) { bad++; console.log(`STALE ${name}.toml`); } } else writeFileSync(p, out);
  }
  if (check) console.log(bad ? `${bad} STALE` : 'PASS codex/agents 與 agents/*.md 一致');
  return bad ? 1 : 0;
}
function isMainModule() { const n = (p) => { try { return realpathSync.native(p).replace(/\\/g, '/').toLowerCase(); } catch { return resolve(p).replace(/\\/g, '/').toLowerCase(); } }; return !!process.argv[1] && n(process.argv[1]) === n(fileURLToPath(import.meta.url)); }
if (isMainModule()) { try { process.exitCode = main(); } catch (e) { console.error(`[gen-codex-agents] ${e.message}`); process.exitCode = 1; } }
```
跑 `node scripts/gen-codex-agents.mjs` 產 6 個 TOML；人工開 `security-auditor.toml` 與 `frontend-e2e-runner.toml` 各看一遍。
- [ ] **Step 4: 跑測試確認通過**（`t4.mjs` PASS）
- [ ] **Step 5: commit**
```bash
git add scripts/gen-codex-agents.mjs codex/agents
git commit -m "feat: agents → Codex custom agent TOML 產生器（從 frontmatter 推導 sandbox / MCP）與產物"
```

### Task 5: request-review / dispatch-parallel（整檔）/ brainstorm / pr-explain 雙 host 改寫
**parallel-group**: 1
**files**:
- modify: `skills/request-review/SKILL.md:34-37`（§T2）、`:56-59`（§T3）、新增 §Codex reviewer prompt
- modify: `skills/dispatch-parallel/SKILL.md`（整檔：`:10` 首句、`:27-37` 判準表、`:39-42` 開關偵測、`:44-70` 選單範本、`:73-119` §隊友派工、`:94` SendMessage、`:194-195` 收工、`:210-214` Red Flags）
- modify: `skills/brainstorm/SKILL.md:31`（0a 讀 memory）、`:50`（剔除規則加 `.agents/skills/`）
- modify: `skills/pr-explain/SKILL.md:6`（刪 `context: fork`）與 spawn 段

- [ ] **Step 1: 寫失敗測試**（scratchpad `t5.mjs`）
```js
import { readFileSync } from 'node:fs';
const r = (p) => readFileSync(p, 'utf8');
const rr = r('skills/request-review/SKILL.md'), dp = r('skills/dispatch-parallel/SKILL.md'), bs = r('skills/brainstorm/SKILL.md'), pe = r('skills/pr-explain/SKILL.md');
const ok = /^## §Codex reviewer prompt$/m.test(rr) && /Skill\("code-review", args="medium"\)/.test(rr) && /Skill\("code-review", args="high"\)/.test(rr) && /hosts\.md §程式碼審查/.test(rr)
  && /Codex 無 Agent Teams/.test(dp) && /（Claude Code 限定）/.test(dp) && !/\bSendMessage\b/.test(dp) && !/CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS/.test(dp.replace(/（Claude Code 限定）[\s\S]*?(?=\n## )/g, ''))
  && /hosts\.md §Memory 路徑/.test(bs) && !/~\/\.claude\/projects/.test(bs) && /\.agents\/skills\//.test(bs.split('\n')[49])
  && !/^context: fork$/m.test(pe) && /hosts\.md §派 subagent/.test(pe);
console.log(ok ? 'PASS' : 'FAIL'); process.exitCode = ok ? 0 : 1;
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL）
- [ ] **Step 3: 寫最小實作**
  - request-review §T2 首句後加：「**Codex**（hosts.md §程式碼審查）：`spawn_agent` 一個 `reviewer`（唯讀；沒裝 TOML 用 `explorer`）帶 §Codex reviewer prompt，`wait_agent` 收；輸出同 code-review 的 JSON 陣列 `{file, line, summary, failure_scenario}`」。§T3 同法加「Codex：reviewer 一個 + 對齊 subagent 一個」。新增 `## §Codex reviewer prompt`：讀 diff（`git diff <base>...HEAD`）；只找會壞的：正確性、邊界（空 / 大 / 非預期輸入）、錯誤處理、併發、資源釋放、與既有介面不一致；每筆附 `failure_scenario`（具體輸入 → 錯誤結果）；不談風格；沒東西回 `[]`。**保留** `Skill("code-review", args="medium")` / `args="high"` 原句。
  - dispatch-parallel：`:10` 首句改「跑法三種：**Agent Teams（Claude Code 限定）**、subagent 平行、單一 session 串行」；判準表 Agent Teams 欄標「（Claude Code 限定）」；開關偵測前加第 0 步「依 hosts.md §Host 判定；**Codex 無 Agent Teams**：跳過 1-3，選單只列 subagent 平行 / 串行，同 group ≥2 task 就問」；§選單範本 的 question 改「這個 group 可平行，依據：…」並把 Agent Teams 選項標「（Claude Code 限定；Codex 不列）」；§隊友派工 標題後加「（Claude Code 限定）」，`:94` `SendMessage` 改「隊友通訊工具」；Red Flags 兩處提 Agent Teams 的加「（Claude Code）」。
  - brainstorm `:31` 改「**讀 memory**（必）：路徑依 hosts.md §Memory 路徑；讀不到 → `memory_loaded: false`、原因寫進 spec §待釐清，**不能因此卡住**」；`:50` 的舉例「plugin 快取、專案 `.claude/skills/`、repo `skills/`」加「`.agents/skills/`」（P11 三處之一；design-language `:14` 與 execute-plan `:37` 由 Task 6 同步）。
  - pr-explain 刪 `context: fork`；spawn 段改「以 hosts.md §派 subagent 的方式 spawn `pr-explainer`」。
- [ ] **Step 4: 跑測試確認通過**（`t5.mjs` PASS；契約 P9c / P9d / P9i 仍綠；P11 因 brainstorm 先改、design-language / execute-plan 未改**暫紅**，Task 6 後綠——此為已知、記在 commit message）
- [ ] **Step 5: commit**
```bash
git add skills/request-review/SKILL.md skills/dispatch-parallel/SKILL.md skills/brainstorm/SKILL.md skills/pr-explain/SKILL.md
git commit -m "feat: request-review / dispatch-parallel / brainstorm / pr-explain 雙 host 寫法（P11 待 Task 6 補齊）"
```

### Task 7: scripts/install-codex.ps1（manifest + -Uninstall）
**parallel-group**: 1
**files**:
- create: `scripts/install-codex.ps1`

- [ ] **Step 1: 寫失敗測試**（Bash）
```bash
out=$(pwsh -NoProfile -File scripts/install-codex.ps1 -WhatIf -Yes 2>&1); rc=$?
echo "$out" | grep -q 'codex plugin marketplace add' && echo "$out" | grep -q 'codex plugin add bstack@bstack' && echo "$out" | grep -q 'update_plan' && echo "$out" | grep -q '/hooks' && echo "$out" | grep -q 'bstack-codex.json' && echo "$out" | grep -q 'agents/skills' && [ "$rc" = 0 ] && echo PASS || { echo "FAIL rc=$rc"; echo "$out" | tail -20; }
pwsh -NoProfile -File scripts/install-codex.ps1 -Uninstall -WhatIf 2>&1 | grep -q 'bstack-codex.json' && echo PASS-uninstall
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: 檔不存在）
- [ ] **Step 3: 寫最小實作**（沿 install.ps1 樣式：`[CmdletBinding(SupportsShouldProcess)]`、`param([switch]$Yes, [ValidateSet('github','local')]$Source='github', [switch]$SkipMigrate, [switch]$SkipAgents, [switch]$Uninstall, [switch]$Migrate)`、`Step` / `Ask` / `Run-Codex` helper、`$DryRun = [bool]$WhatIfPreference`、`$CodexHome = $env:CODEX_HOME ?? "$env:USERPROFILE\.codex"`、manifest `$CodexHome\bstack-codex.json`）。
  安裝六步：
  1. 前置：`codex --version`（缺 → 印 `powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"`，停）；`node --version`（缺 → 「hook 起不來、branch 保護不存在」，停）；`git`（缺 → `winget install --id Git.Git`，停）。
  1.5 **清舊副本（`-Migrate` 同義，預設只列、`-Yes` 才搬）**：掃 `~/.agents/skills/<name>/SKILL.md`，`<name>` 與 repo `skills/` 目錄同名（用 `skills/` 目錄清單比對，不寫死）且 frontmatter `name:` 等於目錄名 → 列為「會與 plugin 版並列的舊副本」，搬到 `~/.agents/bstack-migrate-bak-<stamp>/`，不刪；另若 `~/.codex/AGENTS.md` 內含「dev-workflow」或「一律進」字樣，只**警告**（那是使用者的全域指示檔，不動）：「這句會讓舊版自動攔截復活，請自行檢視」。`-SkipMigrate` 跳過。
  2. marketplace：`codex plugin marketplace list --json` 已有 `bstack` 略過，否則 `codex plugin marketplace add fujiei22/bstack`（`-Source local` → `$RepoRoot`）。印供應鏈警語（同 README）。
  3. plugin：`codex plugin add bstack@bstack`。
  4. agents：對 `codex/agents/*.toml` 逐檔：目的 `$CodexHome\agents\<name>.toml` 已存在且不在 manifest → 互動問「覆蓋 / 跳過 / 全部覆蓋」（`-Yes` = 跳過）；複製的檔名記進 manifest `agents[]`；`-SkipAgents` 整步跳。
  5. config：讀 `$CodexHome\config.toml`，沒有 `[tools.update_plan]` 或其 `enabled = true` → 先備份 `.bak-<stamp>` 再 append 一段（含註解「# bstack install-codex.ps1 加入」），manifest 記 `config_patched: true`；印「開新 session 跑 `/hooks` 信任 bstack 的 PreToolUse hook，否則 branch-safety 不生效」與 `$bstack:devwork` 用法。
  `-Uninstall`：讀 manifest；`codex plugin remove bstack@bstack`；刪 manifest 列的 agents 檔；config.toml 只拔自己 append 的那段（靠註解定界）；刪 manifest。`-WhatIf` 全部只印 `[whatif] …`。
- [ ] **Step 4: 跑測試確認通過**（兩段都 PASS；真跑留 Task 10）
- [ ] **Step 5: commit**
```bash
git add scripts/install-codex.ps1
git commit -m "feat: 加 Codex 一站式安裝腳本（manifest 記錄、可 -Uninstall）"
```

### Task 8: README 雙 host 化與「Codex」節
**parallel-group**: 1
**files**:
- modify: `README.md:3`（簡介）、`:83-92`（§Hooks）、`:98-104`（Prerequisites）、新節 `## Codex`（放 §C 之後、§確認 plugin 有載入 之前）、`:199-206`（§完全移除）、`:209-213`（§開發本 repo）

- [ ] **Step 1: 寫失敗測試**（scratchpad `t8.mjs`）
```js
import { readFileSync } from 'node:fs';
const r = readFileSync('README.md', 'utf8');
const intro = r.split('\n').slice(0, 6).join('\n'), hooks = (r.match(/^## Hooks[\s\S]*?(?=^## )/m) || [''])[0], codex = (r.match(/^## Codex[\s\S]*?(?=^## )/m) || [''])[0];
const ok = /Codex/.test(intro) && /\/hooks/.test(hooks) && /Codex/.test(hooks)
  && /codex plugin marketplace add fujiei22\/bstack/.test(codex) && /codex plugin add bstack@bstack/.test(codex) && /\/hooks/.test(codex) && /\$bstack:devwork/.test(codex) && /install-codex\.ps1/.test(codex) && /版本 pin/.test(codex) && /~\/\.codex\/agents/.test(codex)
  && /\| \*\*Codex CLI[^|]*\*\* \|/.test(r) && /三支/.test(r) && /install-codex\.ps1 -Uninstall/.test(r) && /gen-codex-agents\.mjs --check/.test(r)
  && /^## Skills（28）/m.test(r);
console.log(ok ? 'PASS' : 'FAIL'); process.exitCode = ok ? 0 : 1;
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL）
- [ ] **Step 3: 寫最小實作**：簡介改「繁中台灣用語的開發流程 plugin，Claude Code 與 Codex 共用一套 skill」；§Hooks 段末加「**Codex**：plugin hook 安裝後預設不信任，開新 session 跑 `/hooks` 信任 bstack 的 PreToolUse，否則同樣保護不存在（見 ## Codex）」、「兩支可選腳本」改「三支（含 install-codex.ps1）」（`:92` 與 `:104` 兩處）；Prerequisites 加 `| **Codex CLI 0.153+** | 只有走 Codex 才需要（`powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 \| iex"`） |`；`## Codex` 節：安裝（一站式 / 手動兩行）→ 生效條件（新 session、`/hooks` 信任、`tools.update_plan.enabled`）→ 供應鏈警語（marketplace 無版本 pin，同 A1 那段）+「install-codex.ps1 會寫 `~/.codex/agents/` 與 `~/.codex/config.toml`（有備份、`-Uninstall` 可拆）」→ 與 Claude Code 差異表（抄 hosts.md 八節精簡）→ 已知限制（IDE extension 不支援 plugin、無 Agent Teams、Bash 寫檔兩邊都不擋、reviewer 覆蓋面）→ 從舊版遷移（`~/.agents/skills/` 的同名副本會與 plugin 版並列、舊 dev-workflow 是關鍵詞自動攔截版；`install-codex.ps1 -Migrate` 列出並搬進備份目錄；`~/.codex/AGENTS.md` 自行檢視）；§完全移除 表加 `| \`pwsh -File scripts/install-codex.ps1 -Uninstall\` | Codex：plugin、agents TOML、config 段 | 你的其他 Codex 設定 |`；§開發本 repo 加 `node scripts/gen-codex-agents.mjs --check   # 改了 agents/*.md 就不帶 --check 重跑` 與「新 agent：寫 `agents/<name>.md` → 重跑產生器 → commit TOML → README Agents 表 +1」三行。**不動** `## Skills（28）` 與 Agents 表計數。
- [ ] **Step 4: 跑測試確認通過**（`t8.mjs` PASS；契約 P8 / P9g 綠）
- [ ] **Step 5: commit**
```bash
git add README.md
git commit -m "docs: README 雙 host 化並加 Codex 安裝節"
```

### Task 6: 字面掃描（9 skill + 2 agent，只掃自己的檔）
**parallel-group**: 2
**files**:
- modify: `skills/context-snapshot/SKILL.md:116`、`skills/retro/SKILL.md`（`~/.claude` 與 `TaskList` 三處）、`skills/design-language/SKILL.md:14`（**`:85` 不動**）、`skills/execute-plan/SKILL.md:37`、`skills/write-skill/SKILL.md:29,110,111`、`skills/dev-workflow/SKILL.md:65,145`、`skills/review-plan/SKILL.md:52,57`、`skills/finish-branch/SKILL.md:167`、`skills/lock-files/SKILL.md:16,36`、`agents/hypothesis-tester.md`、`agents/security-auditor.md`（`NotebookEdit` 字樣）

- [ ] **Step 1: 寫失敗測試**（scratchpad `t6.mjs`；Task 9 P14 用同一組 regex 但掃全部）
```js
import { readFileSync } from 'node:fs';
const FILES = ['skills/context-snapshot/SKILL.md', 'skills/retro/SKILL.md', 'skills/design-language/SKILL.md', 'skills/execute-plan/SKILL.md', 'skills/write-skill/SKILL.md', 'skills/dev-workflow/SKILL.md', 'skills/review-plan/SKILL.md', 'skills/finish-branch/SKILL.md', 'skills/lock-files/SKILL.md', 'agents/hypothesis-tester.md', 'agents/security-auditor.md'];
const BAN = [/@skills\/devwork\/rules\.md/, /~\/\.claude\/projects/, /\bSendMessage\b/, /^context: fork$/m, /\/bstack:/, /CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS/];
const hits = [];
for (const f of FILES) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => {
    BAN.forEach((re, k) => { if (re.test(l)) hits.push(`${f}:${i + 1}#ban${k}`); });
    if (/\.claude\/skills/.test(l) && !/\.agents\/skills/.test(l)) hits.push(`${f}:${i + 1}#dual`);   // 正向雙寫
    if (/NotebookEdit/.test(l) && !/Claude Code/.test(l)) hits.push(`${f}:${i + 1}#nbe`);
  });
}
console.log(hits.length ? 'FAIL ' + hits.join(' ') : 'PASS'); process.exitCode = hits.length ? 1 : 0;
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL，約 12 處）
- [ ] **Step 3: 寫最小實作**：`~/.claude/projects/...` → 「memory（路徑依 hosts.md §Memory 路徑）」；`.claude/skills` 行補 `.agents/skills`（design-language `:14`、execute-plan `:37` 是 P11 剔除規則，只加不刪；write-skill 三處寫成雙 host 對照）；dev-workflow `:65` 「Agent Teams / subagent / 串行」加「Agent Teams 限 Claude Code」、`:145` 「CLAUDE.md 引用 rules.md」改「repo 的 CLAUDE.md / AGENTS.md 引用 rules.md」；review-plan `:52` `SendMessage` → 「用 hosts.md §派 subagent 的回傳方式把結論送回」、`:57` 實測句**保留**並加「（Claude Code 實測；Codex 對應見 hosts.md §派 subagent）」；retro `TaskList` 三處 → 「TaskList（Claude Code）或 plan.md / 施工清單勾選狀態（Codex）」；`NotebookEdit` 五處加「（Claude Code 才有）」。
- [ ] **Step 4: 跑測試確認通過**（`t6.mjs` PASS；契約 P4 / P9 / **P11** 全綠）
- [ ] **Step 5: commit**
```bash
git add skills agents
git commit -m "refactor: skill / agent 內 Claude 專屬字面改 host 中性；剔除規則補 .agents/skills"
```

### Task 9: 契約 P13-P16 + build-references 內嵌 hosts.md + 重產 + 三支收尾鏈
**parallel-group**: 3
**files**:
- modify: `scripts/plugin-contract.mjs`（docstring、P12 之後）、`scripts/build-references.ps1:71,94-99`
- 重產: `docs/js/references-data.js`

- [ ] **Step 1: 寫失敗測試**：把 `t0` / `t3`（→ P13：manifest / marketplace / hooks.json 兩組 / 版本三處 / 交叉：兩份 marketplace plugin name 相同、Codex `source.path` 下有 `.codex-plugin/plugin.json`、`skills` 目錄存在、`hooks` 若填必存在）、`t6`（→ P14：掃全部 `skills/*/SKILL.md` + `agents/*.md`，程式碼註解「刻意不含 rules.md / hosts.md：規則書本體允許 host 專屬字面，由 P16 明列守」；**加反向白名單**：從 hosts.md 各節第一欄抽反引號詞當白名單，skills / agents 內出現的 `AskUserQuestion|TaskCreate|TaskUpdate|TaskList|TaskOutput|Agent|subagent_type|NotebookEdit|Skill\("code-review"|SendMessage|ExitPlanMode|WebFetch` 不在白名單就紅）、`t4`（→ P15：spawn `--check` exit 0 + `import { render }` 對一段 fixture md 產出含 `sandbox_mode = "read-only"`）、`t2`（→ P16：八節標題行首錨定、第一行護欄、devwork / rules.md 斷言、`build-references.ps1` 含 `hosts.md`）各寫成 `check('P13 …', ok, '… （後果：… 改處：…）')`。四條訊息**都附後果與改處**。先跑：
```
node scripts/plugin-contract.mjs | grep -E 'P1[3-6]'
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: P16 FAIL——build-references 未含 hosts.md；P13-P15 PASS）
- [ ] **Step 3: 寫最小實作**：build-references.ps1 `$map` 加 `"references/hosts.md" = skills/devwork/hosts.md`（rules.md 之後）；跑 `pwsh -NoProfile -File scripts/build-references.ps1` 重產；docstring 頂部清單補 P13-P16。
- [ ] **Step 4: 跑測試確認通過**（三支全綠，用 `&&` 串）
```
node scripts/plugin-contract.mjs && node docs/tools/docs-site-contract.mjs && pwsh -NoProfile -File scripts/build-references.ps1 -Check
```
- [ ] **Step 5: commit**
```bash
git add scripts/plugin-contract.mjs scripts/build-references.ps1 docs/js/references-data.js
git commit -m "test: 契約加 P13 manifest / P14 禁字與白名單 / P15 agents TOML / P16 hosts.md；重產 references-data.js"
```

### Task 10: Codex CLI 全流程實測與回填
**parallel-group**: 4
**files**:
- modify: `docs/work/feat/codex-install/spec.md`（§施工紀錄、§待釐清回填）、`README.md`（命名空間 / marketplace 實測結果）

- [ ] **Step 1: 寫失敗測試**（人工 checklist，每項記「指令 / 預期 / 實際」）
  1. `codex plugin remove bstack@bstack`、`codex plugin marketplace remove bstack` 清掉 Task 0 的安裝；`pwsh -File scripts/install-codex.ps1 -Yes -Source local` 真跑 → 五步全綠、manifest 存在。
  2. 新 session：skill 清單、`/hooks` 兩組已展開路徑 → 信任。
  3. main 上 apply_patch → exit 2、stderr 含 `request_user_input` 字樣、只印一次「目前在」；`git checkout -b feat/x` 後放行。
  4. 寫 `.env` → BLOCK；一個 patch 同時改 `Dockerfile` 與 `docker-compose.yml` → 兩行 `--token`、共用步驟一次；建齊兩個 token 後 retry → 放行、`consumed.log` 兩筆檔名各對。
  5. `$bstack:devwork 加一個 README 段落` → 走到 Phase 0 合併確認，記決策工具實際是 `request_user_input` 還是文字提問；`update_plan` 有無出現。
  6. `spawn_agent` 指名 `security-auditor` → 確認載到 `~/.codex/agents/security-auditor.toml`（read-only 生效：要它改檔應被拒）。
  7. `pwsh -File scripts/install-codex.ps1 -Uninstall -Yes` → agents 檔、config 段、manifest 都拆乾淨；`codex plugin list --json` 無 bstack。
- [ ] **Step 2: 跑測試確認失敗**（Expected: 第 5 / 6 項動工前無法判定）
- [ ] **Step 3: 實作**：逐項跑；命名空間、marketplace 解析、決策工具實況回填 README「Codex」節與 spec §待釐清；任一項失敗走 rules.md §Fail handling。
- [ ] **Step 4: 跑測試確認通過**（7 項全記錄）
- [ ] **Step 5: commit**
```bash
git add docs/work/feat/codex-install/spec.md README.md
git commit -m "docs: Codex CLI 實測結果回填 spec 與 README"
```

---

## §並行性分析
- group 0（Task 0）：其餘全部的前提（hook 會不會被 Codex 呼叫、marketplace 讀哪份）。
- group 1（Task 1 / 2 / 3 / 4 / 5 / 7 / 8）：檔案兩兩不重疊——Task 1 `hooks/guard.mjs` + 契約；Task 2 `skills/devwork/*`；Task 3 三份 manifest；Task 4 產生器 + `codex/agents/`；Task 5 request-review / dispatch-parallel（整檔）/ brainstorm / pr-explain；Task 7 安裝腳本；Task 8 README。Task 5 會讓 P11 暫紅（三處之一先改），已知、Task 6 補齊。
- group 2（Task 6）：依賴 Task 2（`@import` 句在 devwork 已由 Task 2 改）與 Task 5（P11 三處要一起綠）；只掃自己的 11 檔。
- group 3（Task 9）：依賴 group 0-2 全部。
- group 4（Task 10）：依賴 Task 9 綠。

## §Self-review 結果
- spec coverage：SC1 → Task 0 / 3 / 7 / 10；SC2 → Task 0 / 1 / 10；SC3 → Task 1 / 9；SC4 → Task 2 / 5 / 6 / 10；SC5 → Task 7 / 10；SC6 → Task 8；spec 4b → Task 5 / 6 + P14；scope 8 → Task 9。
- review.md 對照：CC1 → Task 1（relTo + fixture 32-35）；CC2 → Task 6 BAN 改語境 + 雙寫 + design-language:85 不動；CC3 → Task 6 獨立 group、dispatch-parallel 全歸 Task 5、brainstorm:50 歸 Task 5、devwork:13 歸 Task 2、NotebookEdit 進掃描；CC4 → Task 1 訊息自帶答案 + Task 2 rules.md 濃縮表；DX C3 → Task 2 `:5` `:34`；Design M1 → Task 0；其餘 Major / Minor 各落 Task 1（兩趟、memoize、log、壓縮、sanity、docstring、fixture 39-44）、Task 2（八節四欄、護欄、subagent 註、編號理由）、Task 3（description）、Task 4（推導、literal、isMainModule、desc、MCP 註解 + pin、model 嚴格）、Task 7（manifest、-Uninstall、覆蓋詢問、缺席訊息、驗收指令）、Task 8（簡介、§Hooks、三支、供應鏈、完全移除、開發本 repo、regex）、Task 9（後果改處、白名單、P13 交叉、三支收尾鏈）。略過 Design m6 / m11（理由見 review.md）。
- placeholder：Task 4 `MCP_TEMPLATES.mysql` 的 args 是「使用者填」的註解，不是 TBD；`@playwright/mcp@0.0.68` 是 2026-09-09 已知版本，Task 10 實測若不對就改。
- 型別一致：`targetsOf` / `targetOf` / `applyPatchPaths` / `peekToken` / `consumeToken(p, target)` 在 Task 1 與 Task 9 一致；hosts.md 八節標題在 Task 2 / 5 / 6 / 8 / 9 引用一致（`§程式碼審查`）。
- 並行：見 §並行性分析；Task 5 與 Task 6 檔案已分開（dispatch-parallel 只在 Task 5）。
- scope：不動 docs/index.html、docs/js/data.js；不做 extras 的 Codex 版；不提交公開 directory。
