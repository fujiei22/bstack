# 加 Codex 安裝支援 Implementation Plan

> 對應 spec: `docs/work/feat/codex-install/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-09
> 並行最大 group: 3

**Goal**: 同一個 repo 同時是 Claude Code plugin 與 Codex plugin；九階段流程在 Codex 上能裝、能跑，Claude Code 側零行為改變。

**Architecture**: 一份 `skills/`、兩份 manifest（`.claude-plugin/` 與 `.codex-plugin/`）、一份 host 對照表（`skills/devwork/hosts.md`）。skill 內文的 `AskUserQuestion` / `TaskCreate` / `Agent` / `subagent_type` / `mcp__<server>__<tool>` 保留為**抽象動詞**，由 hosts.md 定義兩個 host 的具體工具；只有無法抽象的字面（memory 路徑、`Skill("code-review")`、Agent Teams、`context: fork`、`SendMessage`）改成雙 host 寫法。`hooks/hooks.json` 不動（Codex 有 `CLAUDE_PLUGIN_ROOT` 相容與 `Write|Edit` 別名），只有 `guard.mjs` 要看懂 `apply_patch`。Codex plugin 不能帶 agents，6 個 agent 由產生器轉成 `codex/agents/*.toml`，安裝腳本複製到 `~/.codex/agents/`。

**Tech Stack**: node 22（guard / 契約 / 產生器，零依賴）、pwsh 7（安裝腳本）、TOML（Codex 設定）、JSON（manifest / marketplace）。

**Risks**: guard.mjs 兩 host 共用，patch 解析錯會漏擋（契約 P2d/P2e 加 fixture 守）；契約 P9a/P9c 對 rules.md Tier 表與 request-review 有字面斷言（`code-review medium` / `Skill("code-review", args="medium")` 等），雙 host 改寫必須**保留**這些字面、只加不刪；Codex CLI 是否讀 `.claude-plugin/marketplace.json`、`$bstack:` 命名空間、`request_user_input` 可用性三項只能實測（Task 10）。

**執行注意**：group 1 有 8 個 task、檔案互不重疊；派 subagent 時照 memory `feedback-subagent-fanout-out-dir`（成品寫到 `out/`、主 agent 機械驗收後再落工作樹）與 `feedback-simple-subagent-use-opus`（Task 3 / 4 / 6 / 8 屬簡單任務，派 `model: opus`）。契約腳本只在 Task 1 與 Task 9 改，其他 task 的「紅」用 `node -e` 內嵌斷言，Task 9 把它們原樣搬進契約。

---

## §檔案結構規劃

| 項 | 路徑 | 職責 |
|---|---|---|
| 新建 | `.codex-plugin/plugin.json` | Codex 原生 manifest；`skills: "./skills/"`；hooks 走預設 `hooks/hooks.json` 不填 |
| 新建 | `.agents/plugins/marketplace.json` | Codex 原生 marketplace（一個 entry 指 `./`） |
| 新建 | `skills/devwork/hosts.md` | 六個抽象動作 × 兩個 host 的對照表 + host 判定規則 + 停用指令 + memory 路徑 |
| 新建 | `scripts/gen-codex-agents.mjs` | `agents/*.md` → `codex/agents/<name>.toml`；`--check` 比對磁碟與產出是否一致 |
| 新建 | `codex/agents/{db-reviewer,frontend-e2e-runner,hypothesis-tester,lang-reviewer,pr-explainer,security-auditor}.toml` | 產生器產出，入版控 |
| 新建 | `scripts/install-codex.ps1` | Codex 一站式安裝（前置檢查 → marketplace add → plugin add → agents TOML 複製 → config.toml 寫 `tools.update_plan.enabled` → 提醒 `/hooks` 信任） |
| 改 | `hooks/guard.mjs` | `targetsOf()` 支援 `apply_patch`（多檔）；`repoDir` 三段 fallback；訊息 host 中性 |
| 改 | `scripts/plugin-contract.mjs` | P2d/P2e 加 apply_patch fixture（Task 1）；P13 雙 manifest、P14 禁字、P15 agents TOML 同步、P16 hosts.md（Task 9） |
| 改 | `skills/devwork/SKILL.md` | 使用契約第 1 步加「讀 hosts.md」 |
| 改 | `skills/devwork/rules.md` | Tier 表 review 欄、§決策點選單、§Branch safety 停用提示、§Settings.json、§協作模式判定 加 Codex 行 |
| 改 | `skills/request-review/SKILL.md` | §T2 / §T3 加 Codex 分支（reviewer subagent） |
| 改 | `skills/dispatch-parallel/SKILL.md` | §協作模式判定 開關偵測第 0 步判 host；Codex 只列 subagent / 串行 |
| 改 | `skills/brainstorm/SKILL.md` | 0a 讀 memory 改「依 hosts.md §memory 路徑」 |
| 改 | `skills/pr-explain/SKILL.md` | 移除 `context: fork`；改「spawn pr-explainer（hosts.md §派 subagent）」 |
| 改 | 9 skill + 2 agent（見 Task 6） | 字面掃描 |
| 改 | `.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json` | version 1.6.0 |
| 改 | `scripts/build-references.ps1` | 內嵌清單加 `skills/devwork/hosts.md` |
| 改 | `README.md` | Prerequisites 加 Codex 列；新「## Codex」節；「開發本 repo」加 Codex 試用 |
| 重產 | `docs/js/references-data.js` | Task 9 跑 build-references.ps1 |
| 測試 | `scripts/plugin-contract.mjs` | 本 repo 唯一 test runner；各 task 的紅 / 綠都對它或 `node -e` 斷言 |

**介面**（跨檔）：
- `guard.mjs` 匯出 `targetsOf(payload) → { isWrite: boolean, targets: (string|null)[] }`（新）；保留 `targetOf(payload) → { isWrite, target }` 給契約舊 fixture（回第一個 target）。`decide(payload, ctx)` 簽名不變，內部對 `targets` 逐一判、任一 exit 2 就 exit 2、訊息全部合併。
- `gen-codex-agents.mjs`：`node scripts/gen-codex-agents.mjs` 寫檔；`--check` 不寫檔、磁碟與產出不一致 exit 1 並列出差異檔。
- hosts.md 的節標題固定：`## §Host 判定`、`## §決策點`、`## §任務追蹤`、`## §派 subagent`、`## §Code review`、`## §Memory 路徑`、`## §停用 plugin`（契約 P16 精確比對）。

---

### Task 1: guard.mjs 支援 apply_patch（多檔）+ repoDir fallback + host 中性訊息
**parallel-group**: 1
**files**:
- modify: `hooks/guard.mjs:44-58`（targetOf）、`:90-150`（decide）、`:177-186`（main repoDir）、常數 `DISABLE_HINT`
- test: `scripts/plugin-contract.mjs` P2d 陣列與 P2e 段

- [ ] **Step 1: 寫失敗測試**（P2d 加 fixture、P2e 加真 spawn）
```js
// P2D 陣列末尾追加（fixture id 接在既有最後一號之後）
const AP = (files, op = 'Update File') => ({ tool_name: 'apply_patch', tool_input: { command: ['*** Begin Patch', ...files.map((f) => `*** ${op}: ${f}`), '*** End Patch'].join('\n') } });
['28 apply_patch Update 單檔 protected → 擋', AP([inRepo('src/a.ts')]), ctxOf({ branch: 'main' }), 2, { b: true }],
['29 apply_patch Add .env → BLOCK', AP([inRepo('.env')], 'Add File'), ctxOf(), 2, { B: true }],
['30 apply_patch 多檔：src/a.ts + Dockerfile（feature）→ WARN（Dockerfile）', AP([inRepo('src/a.ts'), inRepo('Dockerfile')]), ctxOf(), 2, { W: true }],
['31 apply_patch Move to id_rsa → BLOCK', { tool_name: 'apply_patch', tool_input: { command: `*** Begin Patch\n*** Update File: ${inRepo('a.txt')}\n*** Move to: ${inRepo('.ssh/id_rsa')}\n*** End Patch` } }, ctxOf(), 2, { B: true }],
['32 apply_patch 相對路徑（repo 內慣用）protected → 擋', AP(['src/a.ts']), ctxOf({ branch: 'main' }), 2, { b: true }],
['33 apply_patch 無 command → 當沒帶路徑（protected 擋）', { tool_name: 'apply_patch', tool_input: {} }, ctxOf({ branch: 'main' }), 2, { b: true }],
['34 apply_patch Delete .env.example → 放', AP([inRepo('.env.example')], 'Delete File'), ctxOf(), 0, {}],
```
```js
// P2e 追加兩次 spawn：無 CLAUDE_PROJECT_DIR 時靠 git toplevel；apply_patch 在 main 上被擋
const envNoDir = { ...p2eEnv }; delete envNoDir.CLAUDE_PROJECT_DIR;
const e7 = spawnSync(process.execPath, [join(REPO, 'hooks/guard.mjs')], { input: JSON.stringify({ tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: src/a.ts\n*** End Patch' } }), encoding: 'utf8', env: envNoDir, cwd: join(p2eRepo) });
// 斷言併入 P2e 的 check：e7.status === 2 && /目前在/.test(e7.stderr)
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: P2d 28-34 FAIL、P2e FAIL）
```
node scripts/plugin-contract.mjs | grep -E 'P2d|P2e'
```
- [ ] **Step 3: 寫最小實作**
```js
// hooks/guard.mjs
/** apply_patch 的 command 文字 → 路徑陣列（Add / Update / Delete File 與 Move to 的目標都算寫入）。 */
export function applyPatchPaths(cmd) {
  if (typeof cmd !== 'string') return [];
  const out = [];
  for (const line of cmd.split(/\r?\n/)) {
    const m = line.match(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/);
    if (m && m[1].trim()) out.push(m[1].trim());
  }
  return out;
}
/** 多目標版；targetOf 保留為相容殼（回第一個）。 */
export function targetsOf(payload) {
  if (payload === undefined) return { isWrite: true, targets: [null] };
  if (payload === null || typeof payload !== 'object') return { isWrite: false, targets: [] };
  const t = String(payload.tool_name || '').toLowerCase();
  const i = (payload.tool_input && typeof payload.tool_input === 'object') ? payload.tool_input : {};
  const str = (v) => (typeof v === 'string' && v !== '' ? v : null);
  if (t === 'edit' || t === 'write') return { isWrite: true, targets: [str(i.file_path)] };
  if (t === 'notebookedit') return { isWrite: true, targets: [str(i.notebook_path)] };
  if (t === 'apply_patch') { const ps = applyPatchPaths(i.command); return { isWrite: true, targets: ps.length ? ps : [null] }; }
  return { isWrite: false, targets: [] };
}
export function targetOf(payload) { const r = targetsOf(payload); return { isWrite: r.isWrite, target: r.targets[0] ?? null }; }
```
`decide()`：把現有本文抽成 `decideOne(target, ctx)`（回 `{exit, lines}`），`decide()` 對 `targetsOf(payload).targets` 逐一呼叫、`lines` 串接、`exit = max`；相對路徑先 `path.resolve(ctx.repoDir, target)`。`DISABLE_HINT` 改：`'若你沒在用 bstack 流程、不想要這個檢查：Claude Code 打 /plugin disable bstack@bstack；Codex 打 /plugins 選 bstack 按 Space 停用'`；WARN 第 1 步的「走 AskUserQuestion」改「用決策問題工具（hosts.md §決策點）」。`main()`：
```js
const repoDir = process.env.CLAUDE_PROJECT_DIR || gitToplevel(process.cwd()) || process.cwd();
function gitToplevel(cwd) { try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; } catch { return null; } }
```
（Windows `git.cmd` 的 ENOENT 退路照 `getBranch()` 現有寫法再包一層。）
- [ ] **Step 4: 跑測試確認通過**（Expected: P2d 1-34、P2e PASS；其他契約不變）
```
node scripts/plugin-contract.mjs
```
- [ ] **Step 5: commit**
```bash
git add hooks/guard.mjs scripts/plugin-contract.mjs
git commit -m "feat: guard.mjs 支援 Codex apply_patch 多檔判定與 git toplevel fallback"
```

### Task 2: hosts.md 對照表 + devwork / rules.md 接線
**parallel-group**: 1
**files**:
- create: `skills/devwork/hosts.md`
- modify: `skills/devwork/SKILL.md:12-14`（使用契約第 1 步）
- modify: `skills/devwork/rules.md:36`（§決策點選單）、`:41`（§Branch safety 停用提示）、`:107-108`（Tier 表 review 欄）、`:119-131`（§協作模式判定）、`:148`（§Settings.json）

- [ ] **Step 1: 寫失敗測試**（Task 9 原樣搬進契約 P16）
```bash
node -e '
const fs=require("fs");const h=fs.existsSync("skills/devwork/hosts.md")?fs.readFileSync("skills/devwork/hosts.md","utf8"):"";
const need=["## §Host 判定","## §決策點","## §任務追蹤","## §派 subagent","## §Code review","## §Memory 路徑","## §停用 plugin"];
const miss=need.filter(s=>!h.includes(s));
const dw=fs.readFileSync("skills/devwork/SKILL.md","utf8"), r=fs.readFileSync("skills/devwork/rules.md","utf8");
const ok=miss.length===0 && /hosts\.md/.test(dw) && /hosts\.md/.test(r) && /request_user_input/.test(h) && /update_plan/.test(h) && /spawn_agent/.test(h);
console.log(ok?"PASS":"FAIL "+JSON.stringify({miss,dw:/hosts\.md/.test(dw),rules:/hosts\.md/.test(r)}));process.exitCode=ok?0:1'
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL，hosts.md 不存在）
- [ ] **Step 3: 寫最小實作**。hosts.md 內容骨架（每節一張兩欄表）：
```markdown
# hosts.md（host 對照表）
> 由 `devwork` 使用契約第 1 步與 rules.md 一起讀。skill 內文的 `AskUserQuestion` / `TaskCreate` / `Agent` / `subagent_type` / `mcp__<server>__<tool>` 是**抽象動詞**，實際工具依本表。

## §Host 判定
工具清單有 `AskUserQuestion` → Claude Code；有 `apply_patch` 或 `spawn_agent` → Codex。判不出來當 Claude Code。

## §決策點
| 抽象 | Claude Code | Codex |
|---|---|---|
| `AskUserQuestion` | 同名工具（推薦選項第一、標「（推薦）」） | `request_user_input`（1-3 題附選項；experimental）。工具不在清單 → 文字提問，**選項編號、user 回編號**，仍禁 approve / LGTM 當 gate |

## §任務追蹤
| `TaskCreate` / `TaskUpdate` / `TaskList` | 同名工具 | `update_plan`（步驟 pending / inProgress / completed；需 `tools.update_plan.enabled = true`，安裝腳本已寫）。不在清單 → 在 spec 施工清單 / plan.md 的 checkbox 勾 |

## §派 subagent
| `Agent` + `subagent_type: <name>` | 同名工具，`subagent_type: bstack:<name>` | `spawn_agent`，agent 名 = `~/.codex/agents/<name>.toml` 的 `name`；沒裝 TOML → 用內建 `explorer`（唯讀）或 `worker`，並把 `agents/<name>.md` 本文貼進 prompt。收結果 `wait_agent`；`SendMessage` 對應 `send_input` |

## §Code review
| 內建 `code-review`（`Skill("code-review", args="medium\|high")`） | 同左 | 無可由模型呼叫的內建 review。T2：`spawn_agent`（`reviewer`，唯讀）一個，prompt = request-review §Codex reviewer prompt；T3：同上 + 對齊 subagent。另提醒 user 可自行 `/review`。覆蓋面低於 Claude Code 的 8 finder，finding 分級不變 |

## §Memory 路徑
| brainstorm 0a 讀 memory | `~/.claude/projects/<slug>/memory/MEMORY.md`（session 起始已載入） | `$CODEX_HOME/memories/`（`features.memories` 開才有）→ 沒有就讀 repo `docs/reference/`；都沒有 `memory_loaded: false` 並在 spec 註明 |

## §停用 plugin
| Claude Code | `/plugin disable bstack@bstack` |
| Codex | `/plugins` 選 bstack 按 Space；hook 另需 `/hooks` 信任才會跑 |
```
devwork/SKILL.md 第 1 步改：「**讀 `rules.md` 與 `hosts.md`**（同目錄）…」。rules.md 五處各加一句指向 hosts.md（Tier 表 review 欄在 `內建 \`/code-review medium\`` 後加 `（Codex：reviewer subagent，見 hosts.md）`；**不刪** `code-review medium` / `code-review high` / `依改動面向` 字面，P9a 靠它們）；§協作模式判定 加一行「**Codex 無 Agent Teams**：判定直接落 subagent 平行 / 串行二選一，不做開關偵測」。
- [ ] **Step 4: 跑測試確認通過**（Step 1 指令 PASS；`node scripts/plugin-contract.mjs` P9a 仍綠）
- [ ] **Step 5: commit**
```bash
git add skills/devwork/hosts.md skills/devwork/SKILL.md skills/devwork/rules.md
git commit -m "feat: 加 hosts.md 兩 host 對照表，devwork / rules.md 接線"
```

### Task 3: Codex manifest 與 marketplace、版本 1.6.0
**parallel-group**: 1
**files**:
- create: `.codex-plugin/plugin.json`、`.agents/plugins/marketplace.json`
- modify: `.claude-plugin/plugin.json:3`、`.claude-plugin/marketplace.json:10`

- [ ] **Step 1: 寫失敗測試**（Task 9 搬進 P13）
```bash
node -e '
const fs=require("fs");const J=p=>{try{return JSON.parse(fs.readFileSync(p,"utf8"))}catch(e){return {__err:e.message}}};
const c=J(".codex-plugin/plugin.json"),m=J(".agents/plugins/marketplace.json"),a=J(".claude-plugin/plugin.json"),am=J(".claude-plugin/marketplace.json");
const e=m.plugins?.[0]||{};
const ok=!c.__err&&c.name==="bstack"&&c.skills==="./skills/"&&/^\d+\.\d+\.\d+$/.test(c.version)&&c.version===a.version&&c.version===am.plugins?.[0]?.version
 &&!m.__err&&m.name==="bstack"&&e.name==="bstack"&&e.source?.source==="local"&&e.source?.path==="./"&&["AVAILABLE","INSTALLED_BY_DEFAULT"].includes(e.policy?.installation)&&e.policy?.authentication&&e.category;
console.log(ok?"PASS":"FAIL "+JSON.stringify({c,m}).slice(0,300));process.exitCode=ok?0:1'
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL，兩檔不存在）
- [ ] **Step 3: 寫最小實作**
```json
{
  "name": "bstack",
  "version": "1.6.0",
  "description": "繁中台灣用語的九階段開發流程：$bstack:devwork 啟動 brainstorm → plan → execute → verify → review → security → finish → pr-explain → retro",
  "author": { "name": "Tommy Sian" },
  "homepage": "https://fujiei22.github.io/bstack/",
  "repository": "https://github.com/fujiei22/bstack",
  "license": "MIT",
  "keywords": ["workflow", "zh-tw", "tdd", "code-review"],
  "skills": "./skills/",
  "interface": {
    "displayName": "bstack",
    "shortDescription": "繁中九階段開發流程",
    "longDescription": "brainstorm → plan → execute → verify → review → security → finish → pr-explain → retro；含 branch-safety / file-type hook（安裝後需在 /hooks 信任）。",
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
    { "name": "bstack", "source": { "source": "local", "path": "./" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Developer Tools" }
  ]
}
```
兩份 `.claude-plugin/*` 的 `version` 改 `1.6.0`。
- [ ] **Step 4: 跑測試確認通過**（Step 1 PASS；`node scripts/plugin-contract.mjs` P1 仍綠）
- [ ] **Step 5: commit**
```bash
git add .codex-plugin .agents .claude-plugin
git commit -m "feat: 加 Codex plugin manifest 與 marketplace，版本 1.6.0"
```

### Task 4: agents → Codex TOML 產生器
**parallel-group**: 1
**files**:
- create: `scripts/gen-codex-agents.mjs`、`codex/agents/*.toml`（6 個）

- [ ] **Step 1: 寫失敗測試**：`node scripts/gen-codex-agents.mjs --check` 應 exit 0 且 6 個 TOML 存在
```bash
node scripts/gen-codex-agents.mjs --check; echo "exit=$?"; ls codex/agents/*.toml | wc -l
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: 腳本不存在 → exit 1；0 個 TOML）
- [ ] **Step 3: 寫最小實作**
```js
#!/usr/bin/env node
/** agents/<name>.md → codex/agents/<name>.toml。--check：不寫檔，磁碟 != 產出 → exit 1 並列檔。 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = { sonnet: 'gpt-5.6-terra', opus: 'gpt-5.6-sol', haiku: 'gpt-5.6-luna' };
const READ_ONLY = new Set(['db-reviewer', 'hypothesis-tester', 'lang-reviewer', 'security-auditor']);   // 只讀 + Bash；不寫檔
const MCP = {
  'db-reviewer': '[mcp_servers.mysql]\n# 依你的環境改：codex mcp add mysql -- <command>；工具名須為 mcp__mysql__mysql_query\ncommand = "npx"\nargs = ["-y", "@your-org/mysql-mcp"]\n',
  'frontend-e2e-runner': '[mcp_servers.playwright]\ncommand = "npx"\nargs = ["-y", "@playwright/mcp@latest"]\n',
};
const fm = (t) => { const m = t.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/); return m ? { head: m[1], body: m[2] } : { head: '', body: t }; };
const field = (h, k) => { const m = h.match(new RegExp(`^${k}:[ \\t]*(.*)$`, 'm')); return m ? m[1].trim() : ''; };
const desc = (h) => { const m = h.match(/^description:[ \t]*\|?[ \t]*\r?\n((?:[ \t]+.*(?:\r?\n|$))+)/m); return (m ? m[1] : field(h, 'description')).replace(/^\s+/mg, '').replace(/\r?\n/g, ' ').trim(); };
const tomlStr = (s) => JSON.stringify(s);   // TOML basic string 與 JSON 同跳脫規則
export function render(name, md) {
  const { head, body } = fm(md);
  const lines = [`# 由 scripts/gen-codex-agents.mjs 從 agents/${name}.md 產生，勿手改；改 md 再重跑`,
    `name = ${tomlStr(name)}`, `description = ${tomlStr(desc(head))}`,
    `model = ${tomlStr(MODEL[field(head, 'model')] || MODEL.sonnet)}`, `model_reasoning_effort = "high"`];
  if (READ_ONLY.has(name)) lines.push('sandbox_mode = "read-only"');
  lines.push('developer_instructions = """', body.replace(/\r\n/g, '\n').replace(/"""/g, '""\\"').trimEnd(), '"""', '');
  if (MCP[name]) lines.push(MCP[name]);
  return lines.join('\n');
}
const check = process.argv.includes('--check');
const outDir = join(REPO, 'codex', 'agents'); if (!check) mkdirSync(outDir, { recursive: true });
let bad = 0;
for (const f of readdirSync(join(REPO, 'agents')).filter((x) => x.endsWith('.md')).sort()) {
  const name = f.replace(/\.md$/, ''); const out = render(name, readFileSync(join(REPO, 'agents', f), 'utf8')); const p = join(outDir, `${name}.toml`);
  if (check) { if (!existsSync(p) || readFileSync(p, 'utf8').replace(/\r\n/g, '\n') !== out) { bad++; console.log(`STALE ${name}.toml`); } }
  else writeFileSync(p, out);
}
if (check) { console.log(bad ? `${bad} STALE` : 'PASS codex/agents 與 agents/*.md 一致'); process.exitCode = bad ? 1 : 0; }
```
跑 `node scripts/gen-codex-agents.mjs` 產 6 個 TOML；人工看 `security-auditor.toml` 一遍（`"""` 跳脫、`sandbox_mode`）。
- [ ] **Step 4: 跑測試確認通過**（`--check` exit 0；`ls codex/agents/*.toml | wc -l` = 6）
- [ ] **Step 5: commit**
```bash
git add scripts/gen-codex-agents.mjs codex/agents
git commit -m "feat: agents → Codex custom agent TOML 產生器與產物"
```

### Task 5: request-review / dispatch-parallel / brainstorm / pr-explain 雙 host 改寫
**parallel-group**: 1
**files**:
- modify: `skills/request-review/SKILL.md:34-37`（§T2）、`:56-59`（§T3）
- modify: `skills/dispatch-parallel/SKILL.md:39-42`（開關偵測）
- modify: `skills/brainstorm/SKILL.md:31`（0a 讀 memory）
- modify: `skills/pr-explain/SKILL.md:6`（frontmatter）與 spawn 段

- [ ] **Step 1: 寫失敗測試**
```bash
node -e '
const fs=require("fs"),r=p=>fs.readFileSync(p,"utf8");
const rr=r("skills/request-review/SKILL.md"),dp=r("skills/dispatch-parallel/SKILL.md"),bs=r("skills/brainstorm/SKILL.md"),pe=r("skills/pr-explain/SKILL.md");
const ok=/§Codex reviewer prompt/.test(rr)&&/Skill\("code-review", args="medium"\)/.test(rr)&&/Skill\("code-review", args="high"\)/.test(rr)
 &&/Codex 無 Agent Teams|Codex.*不做開關偵測/.test(dp)&&/hosts\.md §Memory 路徑/.test(bs)&&!/^context: fork$/m.test(pe)&&/hosts\.md §派 subagent/.test(pe);
console.log(ok?"PASS":"FAIL");process.exitCode=ok?0:1'
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL）
- [ ] **Step 3: 寫最小實作**
  - request-review §T2 首句後加：「**Codex**（hosts.md §Code review）：改 `spawn_agent`（agent `reviewer`，唯讀）一個，prompt 用 §Codex reviewer prompt，等 `wait_agent`；輸出格式同 code-review 的 JSON 陣列 `{file, line, summary, failure_scenario}`」。新增 §Codex reviewer prompt 小節（bug 導向：正確性、邊界、錯誤處理、併發、資源釋放；每筆附 failure_scenario；沒東西回 `[]`）。§T3 同樣加一句「Codex：reviewer subagent 一個 + 對齊 subagent 一個」。**保留** `Skill("code-review", args="medium")` / `args="high"` 原句（P9c）。
  - dispatch-parallel 開關偵測前加第 0 步：「先依 hosts.md §Host 判定；**Codex 無 Agent Teams**，跳過 1-3、選單只列 subagent 平行 / 串行」。
  - brainstorm 0a 第 1 點改：「**讀 memory**（必）：路徑依 hosts.md §Memory 路徑；讀不到 → `memory_loaded: false`、原因寫進 spec §待釐清，**不能因此卡住**」。
  - pr-explain 刪 `context: fork` 行；spawn 段寫「以 hosts.md §派 subagent 的方式 spawn `pr-explainer`」。
- [ ] **Step 4: 跑測試確認通過**（Step 1 PASS；`node scripts/plugin-contract.mjs` P9c / P9d / P9i 仍綠）
- [ ] **Step 5: commit**
```bash
git add skills/request-review/SKILL.md skills/dispatch-parallel/SKILL.md skills/brainstorm/SKILL.md skills/pr-explain/SKILL.md
git commit -m "feat: request-review / dispatch-parallel / brainstorm / pr-explain 雙 host 寫法"
```

### Task 6: 全檔 Claude 專屬字面掃描（9 skill + 2 agent）
**parallel-group**: 1
**files**:
- modify: `skills/{context-snapshot,retro,design-language,execute-plan,write-skill,dev-workflow,review-plan,finish-branch,lock-files}/SKILL.md`、`agents/{hypothesis-tester,security-auditor}.md`

- [ ] **Step 1: 寫失敗測試**（Task 9 搬進 P14；掃描對象 = 全部 SKILL.md 與 agents，排除 hosts.md）
```bash
node -e '
const fs=require("fs"),p=require("path");const BAN=[/~\/\.claude\/projects/,/\.claude\/(skills|settings)/,/@import/,/\bSendMessage\b/,/^context: fork$/m,/claude --plugin-dir/,/\/plugin (disable|install)/,/CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS/];
const files=[...fs.readdirSync("skills").map(d=>`skills/${d}/SKILL.md`),...fs.readdirSync("agents").map(f=>`agents/${f}`)].filter(f=>fs.existsSync(f));
const hits=[];for(const f of files){const t=fs.readFileSync(f,"utf8");BAN.forEach((re,i)=>{if(re.test(t))hits.push(`${f}#${i}`)})}
console.log(hits.length?"FAIL "+hits.join(" "):"PASS");process.exitCode=hits.length?1:0'
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL，列出 ~15 處；含 Task 5 前的 request-review / dispatch-parallel，那兩檔由 Task 5 清）
- [ ] **Step 3: 寫最小實作**，逐處改法：`~/.claude/projects/.../memory` → 「memory（路徑依 hosts.md §Memory 路徑）」；`.claude/skills` 位置 → 「skill 目錄（Claude Code `~/.claude/skills` 或 `.claude/skills`；Codex `~/.agents/skills` 或 `.agents/skills`）」寫在 write-skill 一處、其他檔引用「見 write-skill §放置」；`@import`（dev-workflow / design-language 講 CLAUDE.md 引用 rules.md）→ 「repo 內 CLAUDE.md / AGENTS.md 引用 rules.md」；review-plan `SendMessage` → 「結論回主 agent（工具依 hosts.md §派 subagent）」；retro `TaskList` 歷史 → 「TaskList（Claude Code）或 plan.md / 施工清單勾選狀態（Codex）」；`NotebookEdit` 字樣保留但加「（Claude Code 才有）」。dispatch-parallel §隊友派工 整節開頭加「（Claude Code 限定）」，其內 `SendMessage` 改「隊友通訊工具」。
- [ ] **Step 4: 跑測試確認通過**（Step 1 PASS；契約 P4 / P9 全綠）
- [ ] **Step 5: commit**
```bash
git add skills agents
git commit -m "refactor: skill / agent 內 Claude 專屬字面改 host 中性寫法"
```

### Task 7: scripts/install-codex.ps1
**parallel-group**: 1
**files**:
- create: `scripts/install-codex.ps1`

- [ ] **Step 1: 寫失敗測試**：`-WhatIf` 只印不做且 exit 0；印出的指令含四個關鍵字
```bash
pwsh -NoProfile -File scripts/install-codex.ps1 -WhatIf -Yes 2>&1 | tee /tmp/ic.txt; echo "exit=$?"; grep -cE 'codex plugin marketplace add|codex plugin add bstack@bstack|update_plan|/hooks' /tmp/ic.txt
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: 檔不存在，pwsh 報錯）
- [ ] **Step 3: 寫最小實作**（沿 install.ps1 樣式：`[CmdletBinding(SupportsShouldProcess)]`、`param([switch]$Yes, [ValidateSet('github','local')]$Source='github', [switch]$SkipAgents)`、`Step`/`Ask`/`Run-Codex` 三個 helper、`$DryRun = [bool]$WhatIfPreference`）。五步：
  1. 前置：`codex --version`（缺 → 印 `https://chatgpt.com/codex/install.ps1` 一行）、`node --version`（hook 必需）、`git`。
  2. marketplace：`codex plugin marketplace list` 有 `bstack` 略過，否則 `codex plugin marketplace add fujiei22/bstack`（`-Source local` 用 `$RepoRoot`）。
  3. plugin：`codex plugin add bstack@bstack`。
  4. agents：`Copy-Item codex/agents/*.toml → $env:USERPROFILE\.codex\agents\`（`$env:CODEX_HOME` 有值優先；已存在檔備份 `.bak-<stamp>`）；可 `-SkipAgents`。
  5. config：`~/.codex/config.toml` 沒有 `[tools.update_plan]` / `enabled = true` 就 append 一段（先備份）；印提醒：「開新 session 跑 `/hooks` 信任 bstack 的 PreToolUse hook，否則 branch-safety 不生效」與 `$bstack:devwork` 用法。
  每步 `-WhatIf` 只印 `[whatif] <指令>`。
- [ ] **Step 4: 跑測試確認通過**（exit 0、grep 計數 ≥ 4；真跑留 Task 10）
- [ ] **Step 5: commit**
```bash
git add scripts/install-codex.ps1
git commit -m "feat: 加 Codex 一站式安裝腳本"
```

### Task 8: README「Codex」節
**parallel-group**: 1
**files**:
- modify: `README.md:98-104`（Prerequisites 表）、`:96` 之後新節、`:209-213`（開發本 repo）

- [ ] **Step 1: 寫失敗測試**
```bash
node -e '
const r=require("fs").readFileSync("README.md","utf8");
const ok=/^## Codex$/m.test(r)&&/codex plugin marketplace add fujiei22\/bstack/.test(r)&&/codex plugin add bstack@bstack/.test(r)&&/\/hooks/.test(r)&&/\$bstack:devwork/.test(r)&&/install-codex\.ps1/.test(r)&&/\| \*\*Codex CLI\*\*/.test(r);
console.log(ok?"PASS":"FAIL");process.exitCode=ok?0:1'
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL）
- [ ] **Step 3: 寫最小實作**。新節結構：安裝（一站式 `pwsh -File scripts/install-codex.ps1`；手動兩行）→ 生效條件（新 session；`/hooks` 信任；`tools.update_plan.enabled`）→ 與 Claude Code 差異表（決策工具 / 任務追蹤 / code review 覆蓋面 / agents 位置 / 停用方式，內容抄 hosts.md）→ 已知限制（IDE extension 不支援 plugin；Codex 無 Agent Teams；Bash 寫檔兩邊都不擋）。Prerequisites 表加 `| **Codex CLI 0.153+** | 只有走 Codex 才需要 |`。「開發本 repo」加：Codex 試用走 `.agents/plugins/marketplace.json`（`codex plugin marketplace add ./` 或 desktop app 本機 marketplace）。**不動** `## Skills（28）` 與 Agents 表（P8）。
- [ ] **Step 4: 跑測試確認通過**（Step 1 PASS；契約 P8 / P9g 綠）
- [ ] **Step 5: commit**
```bash
git add README.md
git commit -m "docs: README 加 Codex 安裝節"
```

### Task 9: 契約 P13-P16 + build-references 內嵌 hosts.md + 重產 references-data.js
**parallel-group**: 2
**files**:
- modify: `scripts/plugin-contract.mjs`（docstring 清單、P12 之後追加）、`scripts/build-references.ps1:71,94-99`
- 重產: `docs/js/references-data.js`

- [ ] **Step 1: 寫失敗測試**：把 Task 2 / 3 / 6 的 `node -e` 斷言原樣改寫成 `check('P13 …')`、`check('P14 …')`、`check('P16 …')`；P15 = `spawnSync(node, ['scripts/gen-codex-agents.mjs', '--check']).status === 0`；P16 另加 `rd('scripts/build-references.ps1')` 含 `hosts.md`。先跑：
```
node scripts/plugin-contract.mjs | grep -E 'P1[3-6]'
```
- [ ] **Step 2: 跑測試確認失敗**（Expected: P16 FAIL——build-references 還沒內嵌 hosts.md；P13-P15 應已 PASS）
- [ ] **Step 3: 寫最小實作**：build-references.ps1 第 71 行註解與 `$map` 加 `"references/hosts.md" = skills/devwork/hosts.md`（放 rules.md 之後、skills 之前）；跑 `pwsh -NoProfile -File scripts/build-references.ps1` 重產；`-Check` 綠。docstring 頂部清單補 P13-P16 一行。
- [ ] **Step 4: 跑測試確認通過**
```
node scripts/plugin-contract.mjs && pwsh -NoProfile -File scripts/build-references.ps1 -Check
```
- [ ] **Step 5: commit**
```bash
git add scripts/plugin-contract.mjs scripts/build-references.ps1 docs/js/references-data.js
git commit -m "test: 契約加 Codex manifest / 禁字 / agents TOML / hosts.md 四項；重產 references-data.js"
```

### Task 10: Codex CLI 實測（Windows）與回填
**parallel-group**: 3
**files**:
- modify: `docs/work/feat/codex-install/spec.md`（§施工紀錄、§待釐清回填）、`README.md`（命名空間與本機 marketplace 實測結果）

- [ ] **Step 1: 寫失敗測試**（人工 checklist，每項記「指令 / 預期 / 實際」到 spec §施工紀錄）
  1. `codex --version` ≥ 0.153。
  2. `codex plugin marketplace add <本 clone 絕對路徑>` → 列在 `codex plugin marketplace list --json`。不行 → 改 `~/.agents/plugins/marketplace.json` 手寫 entry 指向 clone。
  3. `codex plugin add bstack@bstack --json` → `installedPath` 存在。
  4. 新 `codex` session：`/skills` 或打 `$bs` 看到 28 個、記實際命名空間（`$bstack:devwork` 或 `$devwork`）。
  5. `/hooks` 看到 PreToolUse `node "${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs"`（變數應已展開為安裝路徑）→ 信任。
  6. 在一個 `main` 上的測試 repo 要 Codex 改一個檔 → 期望 exit 2 訊息「目前在 'main'」；`git checkout -b feat/x` 後同一動作放行。
  7. 要 Codex 寫 `.env` → BLOCK；寫 `Dockerfile` → WARN 含 `--token` 指令，照做後放行。
  8. `$bstack:devwork 加一個 README 段落` → 走到 Phase 0 合併確認，記決策工具實際是 `request_user_input` 還是文字提問。
  9. `pwsh -File scripts/install-codex.ps1 -Yes` 真跑一次（先 `codex plugin remove bstack@bstack`）→ 五步全綠。
- [ ] **Step 2: 跑測試確認失敗**（Expected: 第 4 / 8 項在動工前無法判定；其餘尚未執行）
- [ ] **Step 3: 實作**：逐項跑；命名空間與本機 marketplace 結果回填 README「Codex」節與 spec §待釐清；任一項失敗走 rules.md §Fail handling。
- [ ] **Step 4: 跑測試確認通過**（9 項全記錄，通過或有替代方案）
- [ ] **Step 5: commit**
```bash
git add docs/work/feat/codex-install/spec.md README.md
git commit -m "docs: Codex CLI 實測結果回填 spec 與 README"
```

---

## §並行性分析
- group 1（Task 1-8）：檔案集合兩兩不重疊（Task 1 是唯一動契約腳本的；Task 2 動 devwork / rules；Task 5 動 request-review / dispatch-parallel / brainstorm / pr-explain；Task 6 動另外 11 檔；Task 3 / 4 / 7 / 8 各自新建或只動 README、manifest）。任何順序結果一致。
- group 2（Task 9）：依賴 group 1 全部（契約要對成品跑、references-data 要內嵌 hosts.md 與改過的 skill）。
- group 3（Task 10）：依賴 group 2（契約綠才裝去實測）。

## §Self-review 結果
- spec coverage：success criteria 1（marketplace / plugin add、`$bstack:devwork`）→ Task 3 / 7 / 10；2（hook 擋 apply_patch）→ Task 1 / 10；3（Claude Code 零改變、契約綠）→ Task 1 / 9；4（流程在 Codex 走得動）→ Task 2 / 5 / 6 / 10；5（安裝腳本五步）→ Task 7；6（README）→ Task 8。spec scope 4b 字面掃描 → Task 6 + P14；scope 8 重產 → Task 9。
- placeholder：Task 4 的 mysql MCP `args` 是範例值，TOML 內以註解標明「依你的環境改」，屬刻意的使用者填值，不是 plan 的 TBD。
- 型別一致：`targetsOf` / `targetOf` / `applyPatchPaths` 三個 export 名稱在 Task 1 與 Task 9（P15 用的是產生器不是 guard）一致；hosts.md 七個節標題在 Task 2 / 5 / 6 / 9 引用一致。
- 並行：Task 5 與 Task 6 都動 skill，但檔案清單明列且不重疊；Task 2 動 rules.md、Task 6 不動 rules.md。
- scope：不動 docs/index.html、不做 extras 的 Codex 版、不做公開 directory 提交。
