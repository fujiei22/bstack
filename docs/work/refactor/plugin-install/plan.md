# 安裝模型改為 Claude Code plugin Implementation Plan

> 對應 spec: `docs/work/refactor/plugin-install/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-04
> 並行最大 group: 4

**Goal**: bstack 變成 Claude Code plugin，不再有任何腳本寫入 `~/.claude/`；`/devwork`（保底 `/bstack:devwork`）顯式啟動九階段流程；plugin 帶不了的四項偏好走 `scripts/extras.ps1` 逐項選單。

**Architecture**: repo 根目錄就是 plugin 根（`skills/` `agents/` `hooks/` 位置不變，只加 `.claude-plugin/` 兩份 manifest 與 `hooks/hooks.json`）。原 CLAUDE.md 全文搬進 `skills/devwork/rules.md` 當單一真相，repo 自身 CLAUDE.md 用 `@` import 引用。27 個 skill 的自然語言觸發詞全部改成「由誰在哪一階段載入」，自動攔截的唯一來源就此消失。`setup.ps1` 改寫為 `extras.ps1`，只處理 statusLine / permissions / env / MCP 四項，逐項問層級、可逆、含舊版遷移。

**Tech Stack**: Claude Code plugin manifest（`.claude-plugin/plugin.json` + `marketplace.json`）、`hooks/hooks.json` + `${CLAUDE_PLUGIN_ROOT}`、PowerShell 7、零依賴 node 契約腳本（沿用 `docs/tools/docs-site-contract.mjs` 的 `check()` 寫法）。

**Risks**: 裸 `/devwork` 是實測行為非文件保證（文件雙寫 + smoke test 兩種都跑）；clone 者的 `enabledPlugins` 是否自動安裝未明（README 保守寫）；user 級舊副本會遮蔽 plugin skill（extras.ps1 -Migrate 必須先清）。

---

## §檔案結構規劃

| 類型 | 路徑 | 職責 / 動什麼 |
|---|---|---|
| 新建 | `.claude-plugin/plugin.json` | plugin 身分：name=bstack、version、description、author、homepage、license |
| 新建 | `.claude-plugin/marketplace.json` | repo 自己當 marketplace，`plugins[0].source="./"` |
| 新建 | `hooks/hooks.json` | PreToolUse Write\|Edit\|NotebookEdit → 兩支 pwsh，路徑用 `${CLAUDE_PLUGIN_ROOT}` |
| 修改 | `hooks/file-type-guard.ps1:18,77` | token state dir 改到系統 temp；docstring 同步 |
| 新建 | `skills/devwork/SKILL.md` | 入口 skill：讀 rules.md → 載 dev-workflow → Phase 0 |
| 新建 | `skills/devwork/rules.md` | 原 CLAUDE.md 全文（路徑字樣改 plugin 版） |
| 修改 | `CLAUDE.md` | 縮成「開發本 repo 用 `--plugin-dir .`」+ `@skills/devwork/rules.md` |
| 修改 | `skills/*/SKILL.md` ×27 | description「觸發：」→「載入：」；body 內 `~/.claude/…` 與「CLAUDE.md §」字樣 |
| 修改 | `agents/{db-reviewer,lang-reviewer,security-auditor}.md` | description「觸發：」→「載入：」 |
| 新建 | `scripts/extras.ps1` | 四項偏好選單 + `-Uninstall` + `-Migrate` + `-SelfTest`（重用 setup.ps1 的 `Merge-LocalFirst`） |
| 刪除 | `scripts/setup.ps1`、`settings.json`、`state/` | 全域 sync 路徑全數移除 |
| 搬移 | `statusline.sh` → `extras/statusline.sh` | 非 plugin 元件、手動選用 |
| 新建 | `templates/project-settings.json` | 團隊複製到專案 `.claude/settings.json` 的範本 |
| 新建 | `scripts/plugin-contract.mjs` | P1–P7 plugin 結構契約（本 plan 的測試檔） |
| 修改 | `docs/js/data.js`、`docs/js/app.js`、`docs/index.html`、`docs/tools/docs-site-contract.mjs`、`README.md` | 流程圖 prelude、NODE_DOCS、安裝文案、計數 27→28、契約基線 |
| 產出 | `docs/js/references-data.js` | `build-references.ps1` 重跑 |

**介面**：
- `scripts/plugin-contract.mjs`：`node scripts/plugin-contract.mjs [--selftest]`，exit 0 全綠、exit 1 有紅；輸出格式與 docs-site-contract 相同（`PASS  <id> <名>` / `FAIL  <id> <名>\n      <期望 vs 實際 + 後果>`）。
- `scripts/extras.ps1`：
  ```
  extras.ps1                                   # 互動選單
  extras.ps1 -Yes -Items statusLine,env -Scope user   # 非互動
  extras.ps1 -Uninstall                        # 依 manifest 拆掉自己加的
  extras.ps1 -Migrate [-Yes]                   # 清舊 setup.ps1 副本
  extras.ps1 -SelfTest                         # 在 temp 偽造 HOME 跑全套斷言
  ```
  環境變數 `BSTACK_CLAUDE_HOME` 存在時取代 `~/.claude`（SelfTest 用；一般使用不設）。

**測試策略**：repo 無 test runner（docs-site-contract 檔頭已說明）。本 plan 的「紅 / 綠」= 契約腳本的 FAIL / PASS；extras.ps1 的行為測試 = `-SelfTest` 內建斷言。

---

### Task 1: plugin 結構契約 `scripts/plugin-contract.mjs`（先紅）

**parallel-group**: 1
**files**:
- create: `scripts/plugin-contract.mjs`

- [ ] **Step 1: 寫契約（此時全部應 FAIL）**

```js
/**
 * plugin 結構契約（零依賴）。跑法：node scripts/plugin-contract.mjs [--selftest]
 *
 * 為什麼要有：這個 repo 沒有 test runner，改成 plugin 後「manifest 對不對、觸發詞有沒有
 * 清乾淨、全域路徑字樣有沒有殘留」只能靠肉眼。這支把它們變成機械判定。
 *   P1 manifest        P2 hooks.json 與檔案存在   P3 skill 描述無自然語言觸發詞
 *   P4 無 ~/.claude 安裝路徑字樣   P5 全域 sync 路徑已移除   P6 rules.md 單一真相
 *   P7 agents 描述與 frontmatter
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SELFTEST = process.argv.includes('--selftest');
let failed = 0;

/** 一條契約：pass 印 PASS，否則印 FAIL + 期望/實際/後果 並累計。 */
function check(id, ok, detail) {
  if (ok) { console.log(`PASS  ${id}`); return; }
  failed++;
  console.log(`FAIL  ${id}\n      ${detail}`);
}
const rd = (p) => readFileSync(join(REPO, p), 'utf8');
const exists = (p) => existsSync(join(REPO, p));
const parseJson = (p) => { try { return JSON.parse(rd(p)); } catch (e) { return { __err: e.message }; } };

/** 取 SKILL.md / agent .md 的 frontmatter（--- 到 --- 之間）；沒有就回空字串。 */
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}
/** frontmatter 內 description 區塊（`description: |` 之後的縮排行，或單行值）。 */
function description(fm) {
  const m = fm.match(/^description:\s*\|?\s*\r?\n?((?:[ \t]+.*\r?\n?)*)/m);
  if (m && m[1].trim()) return m[1];
  const s = fm.match(/^description:\s*(.+)$/m);
  return s ? s[1] : '';
}

// ── P1 manifest ─────────────────────────────────────────────────────────────
const plugin = parseJson('.claude-plugin/plugin.json');
const market = parseJson('.claude-plugin/marketplace.json');
check('P1a plugin.json 合法且 name=bstack',
  !plugin.__err && plugin.name === 'bstack' && typeof plugin.version === 'string' && typeof plugin.description === 'string',
  `期望 name=bstack 且有 version/description，實際 ${plugin.__err || JSON.stringify(plugin)}（後果：Claude Code 不認得這個目錄是 plugin）`);
check('P1b marketplace.json 必填齊且 source 指向 ./',
  !market.__err && market.name === 'bstack' && market.owner && typeof market.owner.name === 'string' &&
    Array.isArray(market.plugins) && market.plugins.length === 1 &&
    market.plugins[0].name === 'bstack' && market.plugins[0].source === './',
  `期望 name=bstack、owner.name、plugins=[{name:bstack, source:'./'}]，實際 ${market.__err || JSON.stringify(market)}（後果：/plugin marketplace add fujiei22/bstack 之後找不到 bstack@bstack）`);

// ── P2 hooks.json ───────────────────────────────────────────────────────────
const hooks = parseJson('hooks/hooks.json');
const hookCmds = [];
if (!hooks.__err && hooks.hooks) {
  for (const evt of Object.values(hooks.hooks)) for (const entry of evt) for (const h of (entry.hooks || [])) hookCmds.push(h.command || '');
}
const badCmd = hookCmds.filter((c) => !c.includes('${CLAUDE_PLUGIN_ROOT}'));
const missingScript = hookCmds.map((c) => (c.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"']+)/) || [])[1]).filter(Boolean).filter((rel) => !exists(rel));
check('P2a hooks.json 合法且每個 command 用 ${CLAUDE_PLUGIN_ROOT}',
  !hooks.__err && hookCmds.length >= 2 && badCmd.length === 0,
  `期望 ≥2 個 command 全含 \${CLAUDE_PLUGIN_ROOT}，實際 ${hooks.__err || `${hookCmds.length} 個、${badCmd.length} 個沒用變數`}（後果：hook 路徑寫死本機，別台機器裝了不會生效）`);
check('P2b hooks.json 指到的腳本都存在',
  missingScript.length === 0,
  `期望 0 個缺，實際缺 [${missingScript.join(', ')}]（後果：每次 Write / Edit 都噴 hook 執行失敗）`);
check('P2c file-type-guard 不再寫 plugin 目錄內的 state/',
  exists('hooks/file-type-guard.ps1') && !/state\\file-guard|\.\.\\state|\/state\/file-guard/.test(rd('hooks/file-type-guard.ps1').replace(/^\s*#.*$/gm, '')),
  `期望 code 內無 ../state/file-guard 路徑（註解除外），實際有（後果：token 寫進 plugin 快取，更新 plugin 即清空）`);

// ── P3 / P7 描述無自然語言觸發詞 ──────────────────────────────────────────────
const skillDirs = readdirSync(join(REPO, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const skillProblems = [];
for (const name of skillDirs) {
  const p = `skills/${name}/SKILL.md`;
  if (!exists(p)) { skillProblems.push(`${name}(無 SKILL.md)`); continue; }
  const fm = frontmatter(rd(p));
  const nm = (fm.match(/^name:\s*(.+)$/m) || [])[1];
  if (nm !== name) skillProblems.push(`${name}(name=${nm})`);
  if (/觸發：/.test(description(fm))) skillProblems.push(`${name}(描述含「觸發：」)`);
}
check('P3 每個 skill name==目錄名且描述無「觸發：」',
  skillDirs.length >= 28 && skillProblems.length === 0,
  `期望 ≥28 個 skill 全過，實際 ${skillDirs.length} 個、問題 [${skillProblems.slice(0, 6).join(', ')}]（後果：自然語言觸發詞還在 = 沒下 /devwork 也會被攔進流程）`);
check('P3b devwork 入口 skill 存在且描述提到 /devwork',
  exists('skills/devwork/SKILL.md') && /\/devwork/.test(description(frontmatter(rd('skills/devwork/SKILL.md')))),
  `期望 skills/devwork/SKILL.md 存在且描述含 /devwork，實際不然（後果：使用者不知道怎麼啟動）`);

const agentFiles = exists('agents') ? readdirSync(join(REPO, 'agents')).filter((f) => f.endsWith('.md')) : [];
const agentProblems = [];
for (const f of agentFiles) {
  const fm = frontmatter(rd(`agents/${f}`));
  if (!/^name:/m.test(fm) || !/^description:/m.test(fm)) agentProblems.push(`${f}(缺 name/description)`);
  if (/觸發：/.test(description(fm))) agentProblems.push(`${f}(描述含「觸發：」)`);
}
check('P7 agents frontmatter 齊且描述無「觸發：」',
  agentFiles.length === 6 && agentProblems.length === 0,
  `期望 6 個 agent 全過，實際 ${agentFiles.length} 個、問題 [${agentProblems.join(', ')}]`);

// ── P4 無 ~/.claude 安裝路徑字樣 ──────────────────────────────────────────────
// 白名單：Claude Code 自己的 auto-memory 路徑（~/.claude/projects/...）與 plugin 快取說明（~/.claude/plugins）。
const FORBID = /(~|\$HOME|\$env:USERPROFILE)[\\/]\.claude[\\/](skills|hooks|agents|settings\.json|CLAUDE\.md|statusline\.sh)/;
const scanTargets = [
  ...skillDirs.map((n) => `skills/${n}/SKILL.md`),
  ...agentFiles.map((f) => `agents/${f}`),
  'hooks/branch-safety.ps1', 'hooks/file-type-guard.ps1', 'CLAUDE.md', 'README.md',
  'skills/devwork/rules.md', 'docs/index.html', 'docs/js/data.js',
].filter(exists);
const hits = [];
for (const p of scanTargets) {
  rd(p).split(/\r?\n/).forEach((line, i) => { if (FORBID.test(line)) hits.push(`${p}:${i + 1}`); });
}
check('P4 無 ~/.claude/{skills,hooks,agents,settings.json,CLAUDE.md,statusline.sh} 字樣',
  hits.length === 0,
  `期望 0 處，實際 ${hits.length} 處：${hits.slice(0, 6).join(' / ')}（後果：文件教人去全域找檔，改成 plugin 後全是錯的位置）`);

// ── P5 全域 sync 路徑已移除 ────────────────────────────────────────────────────
const p5 = {
  'settings.json 已刪': !exists('settings.json'),
  'scripts/setup.ps1 已刪': !exists('scripts/setup.ps1'),
  'state/ 已刪': !exists('state'),
  'scripts/extras.ps1 存在': exists('scripts/extras.ps1'),
  'extras/statusline.sh 存在': exists('extras/statusline.sh'),
  'templates/project-settings.json 存在且合法': exists('templates/project-settings.json') && !parseJson('templates/project-settings.json').__err,
};
const p5bad = Object.entries(p5).filter(([, ok]) => !ok).map(([k]) => k);
check('P5 全域 sync 路徑已移除、extras 到位', p5bad.length === 0, `期望全過，實際不過 [${p5bad.join(', ')}]`);

// ── P6 rules.md 單一真相 ──────────────────────────────────────────────────────
check('P6 rules.md 存在且 CLAUDE.md 以 @ 引用',
  exists('skills/devwork/rules.md') && /^@skills\/devwork\/rules\.md\s*$/m.test(rd('CLAUDE.md')) &&
    /### §事實核實/.test(rd('skills/devwork/rules.md')),
  `期望 skills/devwork/rules.md 有 §事實核實 且 CLAUDE.md 含獨立一行 @skills/devwork/rules.md，實際不然（後果：兩份守則漂移）`);

// ── selftest：故意餵壞資料，確認 check() 的 fail 路徑會紅 ────────────────────
if (SELFTEST) {
  const before = failed;
  check('S1 selftest 應 FAIL', false, '這條本來就該紅');
  const ok = failed === before + 1;
  console.log(ok ? '\nSELFTEST PASS（fail 路徑正常）' : '\nSELFTEST FAIL（check() 沒有累計失敗）');
  process.exit(ok ? 0 : 1);
}

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAIL`);
process.exit(failed === 0 ? 0 : 1);
```

> exit code 方向弄反在 CI 會靜默全綠，所以 Step 2 要親眼看到 `exit=1`。

- [ ] **Step 2: 跑、確認紅**

```bash
node scripts/plugin-contract.mjs; echo "exit=$?"
# Expected: P1a P1b P2a P2b P3 P3b P5 P6 FAIL（P4 / P7 可能 PASS 或 FAIL 皆可）、exit=1
node scripts/plugin-contract.mjs --selftest; echo "exit=$?"
# Expected: SELFTEST PASS、exit=0
```

- [ ] **Step 3: 無實作（本 task 只建測試）**
- [ ] **Step 4: 同 Step 2**
- [ ] **Step 5: commit**

```bash
git add scripts/plugin-contract.mjs
git commit -m "test: 加 plugin 結構契約 plugin-contract.mjs（先紅）"
```

---

### Task 2: plugin manifest

**parallel-group**: 2
**files**:
- create: `.claude-plugin/plugin.json`
- create: `.claude-plugin/marketplace.json`

- [ ] **Step 1: 紅** = Task 1 的 P1a / P1b FAIL（已確認）
- [ ] **Step 2: 寫兩份 manifest**

`.claude-plugin/plugin.json`
```json
{
  "name": "bstack",
  "version": "1.0.0",
  "description": "繁中台灣用語的 Claude Code 九階段開發流程：/devwork 啟動 brainstorm → plan → execute → verify → review → security → finish → pr-explain → retro",
  "author": { "name": "Tommy Sian" },
  "homepage": "https://fujiei22.github.io/bstack/",
  "repository": "https://github.com/fujiei22/bstack",
  "license": "MIT",
  "keywords": ["workflow", "zh-tw", "tdd", "code-review"]
}
```

`.claude-plugin/marketplace.json`
```json
{
  "name": "bstack",
  "owner": { "name": "Tommy Sian" },
  "metadata": { "description": "bstack 自己的 marketplace，只有一個 plugin" },
  "plugins": [
    {
      "name": "bstack",
      "source": "./",
      "description": "繁中台灣用語的 Claude Code 九階段開發流程，/devwork 啟動",
      "version": "1.0.0",
      "category": "workflow"
    }
  ]
}
```

- [ ] **Step 3: 綠**

```bash
node scripts/plugin-contract.mjs | grep "P1"
# Expected: PASS  P1a ... / PASS  P1b ...
```

- [ ] **Step 4: 實測 Claude Code 讀得到 manifest**

```pwsh
claude --plugin-dir . -p "/bstack:brainstorm 只回 OK" --max-turns 1 --output-format text
# Expected: 不出現「Unknown plugin」類錯誤；回應含 OK（brainstorm 已存在，可用來驗 plugin 載入）
```

- [ ] **Step 5: commit**

```bash
git add .claude-plugin
git commit -m "feat: 加 plugin.json 與 marketplace.json，repo 自身即 marketplace"
```

---

### Task 3: hooks.json 與 file-type-guard state dir

**parallel-group**: 2
**files**:
- create: `hooks/hooks.json`
- modify: `hooks/file-type-guard.ps1:16-20`（docstring）、`:77`（stateDir）

- [ ] **Step 1: 紅** = P2a / P2b / P2c FAIL
- [ ] **Step 2: 寫 hooks.json、改 state dir**

`hooks/hooks.json`
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|NotebookEdit",
        "hooks": [
          { "type": "command", "command": "pwsh -NoProfile -File \"${CLAUDE_PLUGIN_ROOT}/hooks/branch-safety.ps1\"" },
          { "type": "command", "command": "pwsh -NoProfile -File \"${CLAUDE_PLUGIN_ROOT}/hooks/file-type-guard.ps1\"" }
        ]
      }
    ]
  }
}
```

`hooks/file-type-guard.ps1:77` 改為：
```powershell
# state dir 放系統 temp 而非 plugin 目錄：plugin 裝在 ~/.claude/plugins/ 快取，
# 更新即清空、也不該被 hook 寫入。token 檔名已含專案路徑 hash，不同專案不撞。
$stateDir = Join-Path ([System.IO.Path]::GetTempPath()) 'bstack/file-guard'
```
docstring `:18` 的「位於 <hooks 上一層>/state/file-guard/<hash>.token」改為「位於 `<系統 temp>/bstack/file-guard/<hash>.token`（Windows 為 `%TEMP%\bstack\file-guard\`）」；stderr 指示 AI 建 token 的那段訊息（grep `token` 找到印出路徑處）改印 `$tokenPath` 絕對路徑（原本就印絕對路徑則不動）。

- [ ] **Step 3: 綠**

```bash
node scripts/plugin-contract.mjs | grep "P2"
# Expected: P2a P2b P2c 全 PASS
```

- [ ] **Step 4: 實測 hook 在 plugin 模式生效**

```pwsh
# 在 main branch 的空目錄 git init 後：
claude --plugin-dir D:\GitHub\bstack -p "用 Write 工具建立 a.txt 內容 hi" --max-turns 3 --output-format text
# Expected: 回應提到被 branch-safety 擋下（在 main 上）
```

- [ ] **Step 5: commit**

```bash
git add hooks/hooks.json hooks/file-type-guard.ps1
git commit -m "feat: 加 plugin hooks.json，file-type-guard token 改寫系統 temp"
```

---

### Task 4: devwork 入口 skill + rules.md + repo CLAUDE.md

**parallel-group**: 2
**files**:
- create: `skills/devwork/SKILL.md`
- create: `skills/devwork/rules.md`（由 `CLAUDE.md` 全文搬入後改字樣）
- modify: `CLAUDE.md`（縮短）

- [ ] **Step 1: 紅** = P3b / P6 FAIL
- [ ] **Step 2: 建檔**

`skills/devwork/rules.md` = 現行 `CLAUDE.md` 全文，再做四處改字：
1. §Branch safety 首行 `` `~/.claude/hooks/branch-safety.ps1` 自動擋 `` → `` plugin 的 `hooks/branch-safety.ps1`（PreToolUse）自動擋 ``；豁免段「全域 `~/.claude/` 的 skill、CLAUDE.md、hook 本身」→「plugin 目錄內的檔、使用者的 `~/.claude/` 設定」。
2. §File-type 硬規則 首行 `` `~/.claude/hooks/file-type-guard.ps1` 偵測 `` → `` plugin 的 `hooks/file-type-guard.ps1` 偵測 ``。
3. §Settings.json 整節改為：
   ```
   ### §Settings.json
   專案 `.claude/settings.json` 的 `permissions.allow` **僅限 read-only / 查詢類**（範本：`templates/project-settings.json`）；寫入類（Edit / Write / commit / push / checkout / rm / npm install）一律 prompt。不寫入使用者 `~/.claude/settings.json`——個人偏好走 `scripts/extras.ps1` 逐項選。
   ```
4. 開頭加一行說明：`> 本檔是 bstack 的規則書，由 `/devwork` 啟動時載入；不是使用者的 CLAUDE.md。`

`skills/devwork/SKILL.md`
```markdown
---
name: devwork
description: |
  bstack 九階段開發流程的唯一入口（繁中）。使用者輸入 `/devwork <要做的事>`
  （或 `/bstack:devwork`）才啟動；**不因「寫 / 改 / 修 / 加」等自然語言自動載入**。
  載入後：讀 rules.md 強制守則 → 載 dev-workflow → Phase 0 入口分流（Track / Tier）。
  沒下這個指令時，Claude Code 就是普通的 Claude Code。
---

# devwork

## 使用契約（強制）

1. **讀 `rules.md`**（同目錄）：整份是強制守則 + 開發流程政策 + 程式碼規範 + 版本控管。
   它的位階等同 CLAUDE.md：**與任何 skill 衝突時 rules.md 勝**。
2. **載入 `dev-workflow`**（同 plugin 的 skill），進 Phase 0 入口分流。
3. 使用者跟在 `/devwork` 後面的文字就是 Phase 0a 的 user prompt；沒有文字就先問要做什麼。
4. 之後每輪結尾照 rules.md §Trace 標籤 貼 `[Trace] …`。

## 為什麼要有這一層

以前這套流程靠 27 個 skill 描述裡的關鍵詞自動攔截，使用者沒有「這次不要走流程」的選項，
而且守則放在全域 CLAUDE.md，對所有專案生效。現在：守則跟著 `/devwork` 走、不下指令就不生效。

## 顯式呼叫其他 skill

流程內的 skill 都能單獨呼叫（`/bstack:finish-branch`、`/bstack:retro`…），但它們預期
hand-off state 存在；單獨呼叫時缺的欄位由該 skill 用 AskUserQuestion 補問。

## 第一句台詞

```
[已載入 devwork] 讀取 rules.md 完成，載入 dev-workflow 進 Phase 0。
```
```

`CLAUDE.md`（repo 自身）改為：
```markdown
# CLAUDE.md（bstack repo 自身）

本 repo 是 Claude Code plugin。開發它自己時用 `claude --plugin-dir .` 載入，讓 `/devwork` 與 hooks 在這個 repo 內生效。
規則書單一真相在 `skills/devwork/rules.md`，下面整份 import，兩邊不要各改各的。

@skills/devwork/rules.md
```

- [ ] **Step 3: 綠**

```bash
node scripts/plugin-contract.mjs | grep -E "P3b|P6"
# Expected: 兩條 PASS
```

- [ ] **Step 4: 實測 /devwork 與 @import**

```pwsh
Set-Location <空 temp 目錄>
claude --plugin-dir D:\GitHub\bstack -p "/devwork" --max-turns 2 --output-format stream-json --verbose 2>&1 |
  Select-String -Pattern '"name":"Skill"' | Measure-Object | % Count
# Expected: 0（harness 直接展開，非模型自行載入）
claude --plugin-dir D:\GitHub\bstack -p "/devwork" --max-turns 2 --output-format text
# Expected: 回應含「[已載入 devwork]」
# @import 驗證：在 repo 內開 claude -p "rules.md 的 §事實核實 第一句是什麼" --max-turns 1
# Expected: 能引出「判斷資料模型 / 欄位用途 …」，證明 CLAUDE.md 的 @ 有展開
```

- [ ] **Step 5: commit**

```bash
git add skills/devwork CLAUDE.md
git commit -m "feat: 加 devwork 入口 skill，守則搬進 rules.md 由 CLAUDE.md import"
```

---

### Task 5a: dev-workflow 與 brainstorm 描述 / body 去自動觸發

**parallel-group**: 3
**files**:
- modify: `skills/dev-workflow/SKILL.md:1-11`（description）、§使用契約 第 1 點、§跨流程 skill 觸發 表頭、§Red Flags、§載入此 skill 後第一句台詞、§跟 CLAUDE.md 的關係
- modify: `skills/brainstorm/SKILL.md:1-10`（description）與 body 內「CLAUDE.md §」字樣

- [ ] **Step 1: 紅** = P3 列出 `dev-workflow(描述含「觸發：」)`、`brainstorm(…)`
- [ ] **Step 2: 改**

dev-workflow description 改為：
```yaml
description: |
  自動化開發流程主入口（繁中）。載入：由 `devwork` skill 載入（使用者輸入 /devwork）；
  **不因自然語言自動觸發**。涵蓋：Phase 0 入口分流（Track / Tier）、9 階段順序、
  skill hand-off state、Trace 標籤、Auto-fix、Fail handling、Memory hook、跨流程 skill dispatch。
  規則書 `devwork/rules.md` 永遠優先於本 skill。
```
body：
- §使用契約 第 1 點「確認 user prompt 屬「code 改動類」…純問答直接答」→「取 `/devwork` 後面的文字為 user prompt；空字串則先問」。
- 全文 `CLAUDE.md` 字樣（§跟 CLAUDE.md 的關係、「CLAUDE.md 永遠優先」、Red Flags 表）→ `rules.md`（`grep -n "CLAUDE.md" skills/dev-workflow/SKILL.md` 逐一改，段落標題改「§跟 rules.md 的關係」）。
- §跨流程 skill 觸發 表格標題改「§跨流程 skill 載入」，內容不動。
- §載入此 skill 後第一句台詞 改「[已載入 dev-workflow] Phase 0 入口分流啟動。」

brainstorm description 改為：
```yaml
description: |
  需求釐清 + Phase 0 入口分流（繁中）。載入：dev-workflow 使用契約第 2 步；
  不因自然語言自動觸發。涵蓋：0a 對話釐清（+ 讀 memory）、0b 看 codebase、
  0b′ UI 面判定、0c Track 判定（Bug/Dev）、0d Tier 判定（T0-T3）、
  spec 落檔 docs/work/<branch-name>/spec.md。終態 → 交棒 write-plan（Dev）或 debug-systematic（Bug）。
```
body 內 `CLAUDE.md §` → `rules.md §`。

- [ ] **Step 3: 綠**

```bash
node scripts/plugin-contract.mjs | grep "P3 "
# Expected: 問題清單不再含 dev-workflow / brainstorm（其他 25 個此時仍紅，屬 Task 5b）
grep -c "CLAUDE.md" skills/dev-workflow/SKILL.md skills/brainstorm/SKILL.md
# Expected: 0 0
```

- [ ] **Step 4: 重跑 Task 4 Step 4 的 `/devwork` smoke**（確認鏈路 devwork → dev-workflow 仍通）
- [ ] **Step 5: commit**

```bash
git add skills/dev-workflow/SKILL.md skills/brainstorm/SKILL.md
git commit -m "refactor: dev-workflow 與 brainstorm 改為只由 devwork 載入"
```

---

### Task 5b: 其餘 25 個 skill + 3 個 agent 描述改「載入：」、清路徑字樣

**parallel-group**: 3
**files**:
- modify: `skills/<25 個>/SKILL.md` description（不含 devwork / dev-workflow / brainstorm）
- modify: `agents/db-reviewer.md:4`、`agents/lang-reviewer.md:7`、`agents/security-auditor.md:4`
- modify: `skills/finish-branch/SKILL.md:276`、`skills/design-direction/SKILL.md:85`、`skills/design-language/SKILL.md:25`、`skills/write-skill/SKILL.md:173-175`、`skills/dispatch-parallel/SKILL.md:57`

- [ ] **Step 1: 紅** = P3 / P4 / P7 FAIL
- [ ] **Step 2: 逐檔改**

description 改寫規則（每個 skill 一句「載入：」取代「觸發：」清單，保留「涵蓋」「上游 / 下游」）：

| skill | 載入： |
|---|---|
| write-plan / review-plan / execute-plan / tdd-cycle / verify-done / request-review / receive-review / security-audit / security-checklist / finish-branch / pr-explain | `dev-workflow Phase <N>`（照 rules.md §Tier 表的階段號）；使用者亦可 `/bstack:<name>` 顯式呼叫 |
| debug-systematic / incident-investigate | dev-workflow Bug track Phase 3' |
| design-language / design-direction / frontend-test / dispatch-parallel / db-access / lang-reviewer 相關 | dev-workflow §跨流程 skill 載入 表所列時點 |
| cmd-guard / safety-guard / lock-files / context-snapshot / context-resume / retro / write-skill | dev-workflow §跨流程 skill 載入 表；使用者亦可 `/bstack:<name>` 顯式呼叫 |

路徑字樣：
- `finish-branch:276` → `- **Hook**：plugin 的 \`hooks/branch-safety.ps1\`（PreToolUse 擋 Write / Edit / NotebookEdit）`
- `design-direction:85-86` → `- plugin 安裝時：\`${CLAUDE_PLUGIN_ROOT}/skills/design-direction/<相對路徑>\`` / `- repo 內開發時：\`<repo>/skills/design-direction/<相對路徑>\``
- `design-language:25` 那段「本 skill 由 setup.ps1 同步到 ~/.claude/skills/，全域生效」→「本 skill 隨 plugin 在啟用它的每個專案生效」（其餘推理不動）
- `write-skill:173-175` 表格：「Global / 跨專案」列改「plugin（隨 bstack 發布）| repo `skills/<name>/`，跑 `build-references.ps1` 後進 docs 站」；「暫時 / experimental」列改「該專案 `.claude/skills/_experimental/<name>/`」
- `dispatch-parallel:57` → `1. 查環境變數 \`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\`（settings.json 的 env 區塊會注入為環境變數；用 \`scripts/extras.ps1\` 的 env 項可一鍵設定）。`
- 全部 skill body 內 `CLAUDE.md §xxx` → `rules.md §xxx`（`grep -rn "CLAUDE.md" skills agents` 逐一改；**保留** write-skill 內「SKILL.md 與 CLAUDE.md 這類給 AI 讀的 prompt 檔」這種泛稱用法）。

agent 描述：「觸發：T3 涉 DB schema…」→「載入：security-audit 階段、T3 涉 DB schema…」（三個檔同法）。

- [ ] **Step 3: 綠**

```bash
node scripts/plugin-contract.mjs
# Expected: P3 P4 P7 PASS（P5 仍紅、屬 Task 6）
```

- [ ] **Step 4: 自然語言不再自動觸發（實測）**

```pwsh
Set-Location <空 temp 目錄>
claude --plugin-dir D:\GitHub\bstack -p "幫我改一下 README 的錯字" --max-turns 2 --output-format stream-json --verbose 2>&1 |
  Select-String -Pattern '"name":"Skill"' | Measure-Object | % Count
# Expected: 0（沒有任何 skill 被模型自行載入）
```

- [ ] **Step 5: commit**

```bash
git add skills agents
git commit -m "refactor: 25 個 skill 與 3 個 agent 改為流程載入，清掉全域路徑字樣"
```

---

### Task 6: extras.ps1（取代 setup.ps1）+ 刪全域 sync 物

**parallel-group**: 3
**files**:
- create: `scripts/extras.ps1`
- create: `templates/project-settings.json`
- move: `statusline.sh` → `extras/statusline.sh`
- delete: `scripts/setup.ps1`、`settings.json`、`state/`

- [ ] **Step 1: 紅** = P5 FAIL；`pwsh -File scripts/extras.ps1 -SelfTest` 因檔不存在而錯
- [ ] **Step 2: 寫 extras.ps1（骨架與核心函式如下，Merge-LocalFirst / Test-JsonObject 從 setup.ps1:125-165 原封搬入）**

```powershell
#!/usr/bin/env pwsh
<#
.SYNOPSIS
  bstack 的「plugin 帶不了」四項偏好選單：statusLine / permissions / env / MCP。
.DESCRIPTION
  plugin 核心（skills / agents / hooks / 守則）走 `/plugin install bstack@bstack`，本腳本不碰。
  這裡只處理 Claude Code plugin 規格帶不了的個人偏好，每項各問一次要裝到哪一層：
    [U] 使用者層級  ~/.claude/settings.json
    [P] 目前專案    <cwd>/.claude/settings.json
    [S] 跳過（預設；不選就什麼都不寫）
  寫入走 merge（只加本項 key，其他原封保留）、先備份、記 manifest，-Uninstall 可逆。
.PARAMETER Yes        非互動：搭 -Items 與 -Scope 直接套用
.PARAMETER Items      statusLine | permissions | env | mcp（可多個）
.PARAMETER Scope      user | project
.PARAMETER Uninstall  依 manifest 移除自己加過的 key / MCP
.PARAMETER Migrate    清掉舊 setup.ps1 sync 進 ~/.claude/ 的副本（預設只列，-Yes 才刪）
.PARAMETER SelfTest   在 temp 偽造 HOME 跑全套斷言（不碰真實設定）
.PARAMETER WhatIf     只印會做的事
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [switch]$Yes,
  [ValidateSet('statusLine','permissions','env','mcp')][string[]]$Items,
  [ValidateSet('user','project')][string]$Scope,
  [switch]$Uninstall,
  [switch]$Migrate,
  [switch]$SelfTest
)
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Get-ClaudeHome {
  # SelfTest / 測試用覆寫；一般使用不設
  if ($env:BSTACK_CLAUDE_HOME) { return $env:BSTACK_CLAUDE_HOME }
  $h = $env:USERPROFILE; if (-not $h) { $h = $HOME }
  return (Join-Path $h '.claude')
}
function Get-SettingsPath([string]$scope) {
  if ($scope -eq 'user') { return (Join-Path (Get-ClaudeHome) 'settings.json') }
  return (Join-Path (Get-Location).Path '.claude/settings.json')
}
function Get-ManifestPath { Join-Path (Get-ClaudeHome) 'bstack-extras.json' }

<# 每個項目：要 merge 進 settings 的片段（Fragment）＋ 記進 manifest 的 key 清單 #>
$ItemDefs = [ordered]@{
  statusLine  = @{ Keys = @('statusLine'); Fragment = {
      $sh = (Join-Path $RepoRoot 'extras/statusline.sh').Replace('\','/')
      [pscustomobject]@{ statusLine = [pscustomobject]@{ type='command'; command="bash `"$sh`"" } } } }
  permissions = @{ Keys = @('permissions.allow'); Fragment = {
      [pscustomobject]@{ permissions = [pscustomobject]@{ allow = @(
        'Read','Glob','Grep','TaskCreate','TaskUpdate','TaskList','TaskGet','AskUserQuestion',
        'Bash(git status:*)','Bash(git diff:*)','Bash(git log:*)','Bash(git branch:*)','Bash(git show:*)',
        'Bash(git ls-files:*)','Bash(git config --get:*)','Bash(git rev-parse:*)','Bash(git remote -v)',
        'Bash(ls:*)','Bash(pwd)','Bash(cat:*)','Bash(head:*)','Bash(tail:*)','Bash(wc:*)',
        'mcp__mysql__mysql_query') } } } }
  env         = @{ Keys = @('env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS','env.CLAUDE_CODE_ENABLE_TODO_TOOLS'); Fragment = {
      [pscustomobject]@{ env = [pscustomobject]@{ CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS='1'; CLAUDE_CODE_ENABLE_TODO_TOOLS='1' } } } }
  mcp         = @{ Keys = @('mcp:playwright','mcp:mysql'); Fragment = $null }   # 走 claude mcp add，不寫 settings
}

function Read-Json([string]$path) { if (Test-Path -LiteralPath $path) { Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null } }
function Write-JsonWithBackup([string]$path, $obj) {
  if (Test-Path -LiteralPath $path) { Copy-Item -LiteralPath $path -Destination "$path.bak-$(Get-Date -Format yyyyMMddHHmmss)" }
  $dir = Split-Path $path; if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $obj | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $path -Encoding UTF8
}

<# permissions.allow 例外：Merge-LocalFirst 遇陣列本機勝、不聯集。這裡刻意做聯集（去重），
   因為使用者本機的 allow 已經是自己的東西，我們只是「加上」唯讀清單。 #>
function Add-Item([string]$item, [string]$scope) {
  if ($item -eq 'mcp') { return Add-Mcp $scope }
  $path = Get-SettingsPath $scope
  $local = Read-Json $path
  $frag  = & $ItemDefs[$item].Fragment
  $merged = Merge-LocalFirst -Local $local -Repo $frag
  if ($item -eq 'permissions') {
    $have = @($local.permissions.allow); $add = @($frag.permissions.allow)
    $merged.permissions.allow = @($have + $add | Select-Object -Unique)
  }
  if ($PSCmdlet.ShouldProcess($path, "merge $item")) {
    Write-JsonWithBackup $path $merged
    Save-Manifest $item $scope $path $ItemDefs[$item].Keys
  }
}
function Add-Mcp([string]$scope) {
  $cmds = @("claude mcp add playwright --scope $scope -- npx -y @playwright/mcp@latest")
  $host_ = if ($Yes) { $env:BSTACK_MYSQL_HOST } else { Read-Host 'mysql host（留空跳過 mysql MCP）' }
  if ($host_) { $cmds += "claude mcp add mysql --scope $scope --env MYSQL_HOST=$host_ --env ALLOW_INSERT_OPERATION=false --env ALLOW_UPDATE_OPERATION=false --env ALLOW_DELETE_OPERATION=false -- npx -y @benborla29/mcp-server-mysql" }
  foreach ($c in $cmds) { if ($PSCmdlet.ShouldProcess($c, 'run')) { Invoke-Expression $c } else { Write-Host "  [whatif] $c" } }
  if (-not $WhatIfPreference) { Save-Manifest 'mcp' $scope '' @('mcp:playwright') + $(if ($host_) { @('mcp:mysql') } else { @() }) }
}
function Save-Manifest([string]$item, [string]$scope, [string]$file, [string[]]$keys) {
  $m = Read-Json (Get-ManifestPath); if (-not $m) { $m = [pscustomobject]@{ entries = @() } }
  $m.entries = @($m.entries) + [pscustomobject]@{ item=$item; scope=$scope; file=$file; keys=$keys; ts=(Get-Date).ToString('o') }
  Write-JsonWithBackup (Get-ManifestPath) $m
}
function Remove-KeyPath($obj, [string]$dotted) {   # 'permissions.allow' → 只拿掉我們加的那些值；其他 key 整個刪
  $parts = $dotted.Split('.'); $cur = $obj
  for ($i = 0; $i -lt $parts.Length - 1; $i++) { $cur = $cur.($parts[$i]); if ($null -eq $cur) { return } }
  if ($dotted -eq 'permissions.allow') {
    $ours = @((& $ItemDefs.permissions.Fragment).permissions.allow)
    $cur.allow = @($cur.allow | Where-Object { $_ -notin $ours })
  } else { $cur.PSObject.Properties.Remove($parts[-1]) }
}
function Invoke-Uninstall {
  $m = Read-Json (Get-ManifestPath); if (-not $m -or -not $m.entries) { Write-Host '沒有 manifest，沒東西可拆'; return }
  foreach ($e in $m.entries) {
    if ($e.item -eq 'mcp') { foreach ($k in $e.keys) { $n = $k.Split(':')[1]; if ($PSCmdlet.ShouldProcess("mcp $n", 'remove')) { claude mcp remove $n --scope $e.scope } }; continue }
    $obj = Read-Json $e.file; if (-not $obj) { continue }
    foreach ($k in $e.keys) { Remove-KeyPath $obj $k }
    if ($PSCmdlet.ShouldProcess($e.file, "remove $($e.item)")) { Write-JsonWithBackup $e.file $obj }
  }
  if ($PSCmdlet.ShouldProcess((Get-ManifestPath), 'clear')) { Write-JsonWithBackup (Get-ManifestPath) ([pscustomobject]@{ entries = @() }) }
}
function Invoke-Migrate {
  $home_ = Get-ClaudeHome
  $skills = Get-ChildItem (Join-Path $RepoRoot 'skills') -Directory | % Name
  $agents = Get-ChildItem (Join-Path $RepoRoot 'agents') -Filter *.md | % Name
  $targets = @()
  $targets += $skills | % { Join-Path $home_ "skills/$_" } | ? { Test-Path $_ }
  $targets += $agents | % { Join-Path $home_ "agents/$_" } | ? { Test-Path $_ }
  $targets += @('hooks/branch-safety.ps1','hooks/file-type-guard.ps1','statusline.sh') | % { Join-Path $home_ $_ } | ? { Test-Path $_ }
  $settingsPath = Join-Path $home_ 'settings.json'; $s = Read-Json $settingsPath; $settingsTouched = $false
  if ($s) {
    if ($s.hooks.PreToolUse) {
      $s.hooks.PreToolUse = @($s.hooks.PreToolUse | ? { -not ($_.hooks | ? { $_.command -match 'branch-safety\.ps1|file-type-guard\.ps1' }) }); $settingsTouched = $true }
    if ($s.statusLine.command -match 'statusline\.sh') { $s.PSObject.Properties.Remove('statusLine'); $settingsTouched = $true }
  }
  Write-Host "舊 setup.ps1 副本："; $targets | % { "  $_" }
  if ($settingsTouched) { Write-Host "  $settingsPath 內指向舊 hook / statusline 的條目" }
  $claude = Join-Path $home_ 'CLAUDE.md'
  if (Test-Path $claude) { Write-Host "  （不自動處理）$claude：若內容是 bstack 舊版守則、且你沒改過，可自行刪除；守則現在跟著 /devwork 走" -ForegroundColor Yellow }
  if (-not $targets -and -not $settingsTouched) { Write-Host '  無'; return }
  $go = $Yes -or ((Read-Host '刪除以上項目？[y/N]') -eq 'y')
  if (-not $go) { return }
  foreach ($t in $targets) { if ($PSCmdlet.ShouldProcess($t, 'remove')) { Remove-Item -LiteralPath $t -Recurse -Force } }
  if ($settingsTouched -and $PSCmdlet.ShouldProcess($settingsPath, 'strip old hooks/statusLine')) { Write-JsonWithBackup $settingsPath $s }
}
function Invoke-SelfTest {
  $tmp = Join-Path ([IO.Path]::GetTempPath()) "bstack-extras-selftest-$(Get-Random)"
  New-Item -ItemType Directory -Path "$tmp/.claude" -Force | Out-Null
  $env:BSTACK_CLAUDE_HOME = "$tmp/.claude"
  $seed = '{"model":"opus","permissions":{"allow":["Bash(npm test)"]},"theme":"dark"}'
  Set-Content "$tmp/.claude/settings.json" $seed -Encoding UTF8
  $fails = 0
  function Assert([string]$name, [bool]$ok) { if ($ok) { Write-Host "PASS  $name" } else { Write-Host "FAIL  $name" -ForegroundColor Red; $script:fails++ } }
  # (a) 只多本項 key、既有 key 不變
  Add-Item 'statusLine' 'user'; $s = Read-Json "$tmp/.claude/settings.json"
  Assert 'a1 statusLine 加入' ($s.statusLine.command -match 'statusline\.sh')
  Assert 'a2 既有 model/theme 不變' ($s.model -eq 'opus' -and $s.theme -eq 'dark')
  Add-Item 'permissions' 'user'; $s = Read-Json "$tmp/.claude/settings.json"
  Assert 'a3 permissions.allow 聯集且保留本機值' ($s.permissions.allow -contains 'Bash(npm test)' -and $s.permissions.allow -contains 'Read')
  Add-Item 'env' 'user'; $s = Read-Json "$tmp/.claude/settings.json"
  Assert 'a4 env 兩個 key' ($s.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS -eq '1' -and $s.env.CLAUDE_CODE_ENABLE_TODO_TOOLS -eq '1')
  # (b) 備份 (c) manifest
  Assert 'b 備份檔存在' ((Get-ChildItem "$tmp/.claude" -Filter 'settings.json.bak-*').Count -ge 1)
  $m = Read-Json (Get-ManifestPath); Assert 'c manifest 3 筆' (@($m.entries).Count -eq 3)
  # project scope
  Push-Location $tmp; Add-Item 'permissions' 'project'; Pop-Location
  Assert 'p project 層級寫到 <cwd>/.claude/settings.json' (Test-Path "$tmp/.claude/settings.json" -and (Read-Json "$tmp/.claude/settings.json").permissions.allow -contains 'Read')
  # (d) uninstall 回原樣
  Invoke-Uninstall; $s = Read-Json "$tmp/.claude/settings.json"
  Assert 'd1 statusLine/env 拆掉' ($null -eq $s.statusLine -and $null -eq $s.env)
  Assert 'd2 permissions.allow 只剩本機值' (@($s.permissions.allow) -eq @('Bash(npm test)'))
  Assert 'd3 manifest 清空' (@((Read-Json (Get-ManifestPath)).entries).Count -eq 0)
  # (e) migrate 只刪 repo 名單內
  New-Item -ItemType Directory -Path "$tmp/.claude/skills/brainstorm","$tmp/.claude/skills/my-own","$tmp/.claude/hooks" -Force | Out-Null
  Set-Content "$tmp/.claude/hooks/branch-safety.ps1" '# old'
  $script:Yes = $true; Invoke-Migrate
  Assert 'e1 舊 skill 副本刪除' (-not (Test-Path "$tmp/.claude/skills/brainstorm"))
  Assert 'e2 使用者自己的 skill 不動' (Test-Path "$tmp/.claude/skills/my-own")
  Assert 'e3 舊 hook 刪除' (-not (Test-Path "$tmp/.claude/hooks/branch-safety.ps1"))
  Remove-Item $tmp -Recurse -Force; Remove-Item Env:BSTACK_CLAUDE_HOME
  Write-Host ($(if ($fails -eq 0) { 'SELFTEST ALL PASS' } else { "SELFTEST $fails FAIL" }))
  exit $(if ($fails -eq 0) { 0 } else { 1 })
}

# === 主流程 ===
if ($SelfTest) { Invoke-SelfTest }
if ($Uninstall) { Invoke-Uninstall; exit 0 }
if ($Migrate) { Invoke-Migrate; exit 0 }
if ($Yes) {
  if (-not $Items -or -not $Scope) { throw '-Yes 需搭配 -Items 與 -Scope' }
  foreach ($i in $Items) { Add-Item $i $Scope }; exit 0
}
Write-Host "== bstack extras（plugin 核心請用 /plugin install bstack@bstack；本選單不碰 skills / agents / hooks）==" -ForegroundColor Cyan
Invoke-Migrate
foreach ($i in $ItemDefs.Keys) {
  $ans = Read-Host "$i → [U] 使用者層級 / [P] 目前專案 / [S] 跳過（預設 S）"
  switch ($ans.ToUpper()) { 'U' { Add-Item $i 'user' } 'P' { Add-Item $i 'project' } default { Write-Host "  跳過 $i" } }
}
Write-Host "完成。反悔：pwsh -File scripts/extras.ps1 -Uninstall" -ForegroundColor Green
```

`templates/project-settings.json`
```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "extraKnownMarketplaces": {
    "bstack": { "source": { "source": "github", "repo": "fujiei22/bstack" } }
  },
  "enabledPlugins": { "bstack@bstack": true },
  "permissions": {
    "allow": [
      "Read", "Glob", "Grep", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "AskUserQuestion",
      "Bash(git status:*)", "Bash(git diff:*)", "Bash(git log:*)", "Bash(git branch:*)", "Bash(git show:*)",
      "Bash(git ls-files:*)", "Bash(git config --get:*)", "Bash(git rev-parse:*)", "Bash(git remote -v)",
      "Bash(ls:*)", "Bash(pwd)", "Bash(cat:*)", "Bash(head:*)", "Bash(tail:*)", "Bash(wc:*)"
    ]
  }
}
```

檔案操作：
```bash
git mv statusline.sh extras/statusline.sh
git rm scripts/setup.ps1 settings.json
git rm -r state   # 空目錄若未被 git 追蹤則 rm -r state
```
`extras/statusline.sh` 內容不動（它讀 stdin JSON，與位置無關）。

- [ ] **Step 3: 綠**

```bash
node scripts/plugin-contract.mjs | grep "P5"
# Expected: PASS
pwsh -NoProfile -File scripts/extras.ps1 -SelfTest; echo "exit=$?"
# Expected: a1 a2 a3 a4 b c p d1 d2 d3 e1 e2 e3 全 PASS、SELFTEST ALL PASS、exit=0
pwsh -NoProfile -File scripts/extras.ps1 -Yes -Items env -Scope user -WhatIf
# Expected: 只印 What if:，真實 ~/.claude/settings.json 不變（用 git 之外的 hash 比對前後）
```

- [ ] **Step 4: 同 Step 3**
- [ ] **Step 5: commit**

```bash
git add scripts/extras.ps1 templates extras
git commit -m "feat: setup.ps1 改寫為 extras.ps1，四項偏好逐項選層級並可逆"
```

---

### Task 7: docs 站、README、契約基線、references 重產

**parallel-group**: 4
**files**:
- modify: `docs/js/data.js:53-55`（prelude 節點）、`:189-190`（邊）、ambient 內 `CLAUDE.md` 字樣
- modify: `docs/js/app.js`（NODE_DOCS 加 `LoadDevwork`；`:53`、`:531` 註解計數 27→28）
- modify: `docs/index.html:8`、`:46`、`:48`、`:85-91`、`:108-121`
- modify: `docs/tools/docs-site-contract.mjs`（C6 BASELINE_KEYS、C8a EXPECT）
- modify: `README.md`（§Skills 計數與表、§Hooks、§安裝 全段、新增 §從舊版遷移）
- 產出: `docs/js/references-data.js`

- [ ] **Step 1: 紅**

```bash
node docs/tools/docs-site-contract.mjs | grep -E "FAIL|C18 "
# Expected: C18 FAIL（磁碟多了 devwork 但沒 NODE_DOCS / 內嵌）、C8b FAIL（35 vs 34）
```

- [ ] **Step 2: 改**

`data.js` nodes：
```js
Start:        { phase: 'prelude', type: 'default', shape: 'stadium', label: 'user 輸入 /devwork <要做的事>\n（或 /bstack:devwork；不下指令 = 普通 Claude Code）' },
LoadDevwork:  { phase: 'prelude', type: 'skill',   shape: 'rect',    label: '載入 skill：devwork\n唯一入口，讀 rules.md' },
ClaudeMd:     { phase: 'prelude', type: 'policy',  shape: 'rect',    label: 'rules.md 強制守則仲裁\n優先於任何 skill' },
DevWfSkill:   { phase: 'prelude', type: 'skill',   shape: 'rect',    label: '載入 skill：dev-workflow\n（由 devwork 載入，不自動觸發）' },
```
edges（取代 `:189-190` 兩條）：
```js
['Start',        'LoadDevwork',  '',                           'solid'],
['LoadDevwork',  'ClaudeMd',     '讀 rules.md',                'solid'],
['ClaudeMd',     'DevWfSkill',   '',                           'solid'],
```
ambient：`grep -n "CLAUDE.md" docs/js/data.js` 的 title / desc 改為「rules.md」（例：`title: 'CLAUDE.md 強制守則'` → `'rules.md 強制守則（/devwork 載入）'`）。

`app.js` NODE_DOCS 加一行（放 `DevWfSkill` 之前）：
```js
LoadDevwork:{p:'skills/devwork',            n:'devwork',             k:'skill'},
```
`:53` 註解 `（27 skill + 6 agent）` → `（28 skill + 6 agent）`；`:531` `29——…27 個` → `30——…28 個`。

`docs-site-contract.mjs`：BASELINE_KEYS 加 `'LoadDevwork'`（附註解「2026-09-04 plugin 化：入口 skill」）；`EXPECT = { nodes: 99, edges: 136, phases: 15, types: 8 }`，C8a 標題與「歷次基線」字串同步補 `→ 98/135`。

`index.html`：
- `:8` meta description 與 `:46` 內文 `27 個 skill` → `28 個 skill`；把「同步進 ~/.claude/」類措辭改「裝成 plugin」（只改文字）。
- `:48` `<b>27</b>` → `<b>28</b>`。
- `:85` `裝進 ~/.claude/ 的全部` → `plugin 裡有什麼`；`:87` `主流程 12 條、跨流程觸發式 9 條` → `入口 1 條、主流程 12 條、跨流程 9 條`，`<span class="nn">27` → `28`；`:91` 「其他」列文字 → `extras.ps1（statusLine / permissions / env / MCP 逐項選層級）、statusline.sh、project-settings 範本`。
- `#install`：標題「裝起來要四步」→「裝起來要三步」；副標「需要 git、jq、Node.js 與 npx」→「需要 pwsh 7+；statusLine 另需 bash 與 jq」；三個 `<li>`（**只換 `<div class="h">` / `<p>` / `<pre class="cmd">` 的文字內容**）：
  1. 取得 plugin：`/plugin marketplace add fujiei22/bstack` ＋ `/plugin install bstack@bstack`；或試用 `claude --plugin-dir <clone 路徑>`；團隊：複製 `templates/project-settings.json` 到專案 `.claude/settings.json`
  2. 個人偏好（可跳過）：`pwsh -File scripts/extras.ps1`，statusLine / permissions / env / MCP 每項各選裝到使用者層級、目前專案或跳過；不選就什麼都不寫
  3. 開新 session 輸入 `/devwork <要做的事>`；不下指令就是普通的 Claude Code

`README.md`：
- `## Skills（27）` → `（28）`；§Phase 主流程 表最上面加 `| **devwork** | 唯一入口：\`/devwork <要做的事>\` 啟動九階段；不下指令不生效 |`。
- §Hooks 段落內全域路徑改「plugin 的 `hooks/hooks.json` 註冊」。
- §安裝 重寫為三段：**A. 裝 plugin**（三種：marketplace / `--plugin-dir` / 團隊 template，並說明 `/plugin install` 會由 Claude Code 在 `~/.claude/plugins/` 放快取、settings 記 `enabledPlugins`，那是它的登記機制、`/plugin uninstall` 可反悔，不會覆蓋你的任何設定）、**B. 個人偏好（可選）** extras.ps1 四項與 `-Uninstall`、**C. 開新 session 輸入 `/devwork`**。
- 新增 `## 從舊版（setup.ps1）遷移`：`pwsh -File scripts/extras.ps1 -Migrate`，說明「user 級同名 skill 會遮蔽 plugin skill，不清會一直跑舊版」與 `~/.claude/CLAUDE.md` 要自行處理。

重產：
```pwsh
pwsh -NoProfile -File scripts/build-references.ps1
```

- [ ] **Step 3: 綠**

```bash
node docs/tools/docs-site-contract.mjs | tail -1      # Expected: ALL PASS（C8a 99/136、C8b 35、C18 28 skill）
node scripts/plugin-contract.mjs | tail -1            # Expected: ALL PASS
pwsh -NoProfile -File scripts/build-references.ps1 -Check   # Expected: PASS
grep -rn "setup.ps1\|~/.claude/" docs/index.html README.md | grep -v "plugins/\|-Migrate\|從舊版"
# Expected: 無輸出
```

- [ ] **Step 4: Playwright**：起本機 http server 開 index.html / flow.html，console 零 error / warning；flow 的 prelude 三節點點得開 devwork 文件。
- [ ] **Step 5: commit**

```bash
git add docs README.md
git commit -m "docs: 安裝改為 plugin 三步，流程圖加 devwork 入口節點"
```

---

## §Self-review

1. **spec coverage**：
   - §4a 骨架 → Task 2 / 3 / 6；§4b devwork → Task 4；§4c 觸發改造 → Task 5a / 5b；§4d docs 站 → Task 7；§4e hook → Task 3 + 5b（dispatch-parallel）；§4g extras → Task 6；§5 驗證 P1–P7 → Task 1、SelfTest → Task 6、實測 → 各 task Step 4 與 verify-done；§6 遷移 → Task 6 `-Migrate`。
   - spec §5.4 的 `/plugin marketplace add` 實測只能 merge 後做 → 記入 verify-done 的 post-merge 清單，不在本 plan。
2. **placeholder**：無 TBD / TODO；每個 task 都有可直接落檔的 code 或逐條改法。
3. **型別一致**：`LoadDevwork` 在 data.js / app.js / contract 三處同名；`ItemDefs` key 與 `-Items` ValidateSet 同四個；manifest 欄位 `entries[].{item,scope,file,keys,ts}` 在 Save / Uninstall 一致。
4. **並行性**：group 2 三 task 檔案互斥（manifest / hooks / devwork+CLAUDE.md）；group 3 三 task 互斥（dev-workflow+brainstorm / 其餘 skill+agents / scripts+templates+extras）；Task 7 依賴 devwork 存在與 skill 描述定稿，放最後。Task 5a 與 5b 都改 skill 但檔案集合不重疊。
5. **scope**：未加 SessionStart、未做 per-project 複製、未改 hook 語言，與 spec §4f 一致。

## §hand-off state

```yaml
state:
  plan_path: docs/work/refactor/plugin-install/plan.md
  parallel_groups: [1, 2, 3, 4]
  task_count: 8   # 1, 2, 3, 4, 5a, 5b, 6, 7
  current_phase: write-plan-done
```
