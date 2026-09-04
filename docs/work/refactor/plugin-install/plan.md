# 安裝模型改為 Claude Code plugin Implementation Plan

> 對應 spec: `docs/work/refactor/plugin-install/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-04（v2：套用四視角 review，見 `review.md`）
> 並行最大 group: 4

**Goal**: bstack 變成 Claude Code plugin，不再有任何腳本寫入 `~/.claude/`；`/devwork`（保底 `/bstack:devwork`）顯式啟動九階段流程；plugin 帶不了的四項偏好走 `scripts/extras.ps1` 逐項選單，可逆、含舊版遷移。

**Architecture**: repo 根目錄就是 plugin 根（`skills/` `agents/` `hooks/` 位置不變，只加 `.claude-plugin/` 兩份 manifest 與 `hooks/hooks.json`）。原 CLAUDE.md 全文搬進 `skills/devwork/rules.md` 當單一真相，repo 自身 CLAUDE.md 用 `@` import。27 個 skill 的自然語言觸發詞全部改成「由誰在哪一階段載入」。`setup.ps1` 改寫為 `extras.ps1`：statusLine / permissions / env / MCP 四項逐項問層級，manifest 只記實際新增的 key，`-Uninstall` 只拆自己加的，`-Migrate` 清舊 sync 副本（含會讓自動攔截復活的舊 `~/.claude/CLAUDE.md`）。

**Tech Stack**: Claude Code plugin manifest、`hooks/hooks.json` + `${CLAUDE_PLUGIN_ROOT}`、PowerShell 7、零依賴 node 契約腳本。

**Risks**: 裸 `/devwork` 是實測非文件保證（公開站指令碼寫 `/bstack:devwork`，文案叫它 `/devwork`）；hooks 隨 plugin 在所有啟用的專案生效（主推薦專案層級啟用，README 明講）；clone 者的 `enabledPlugins` 是否自動安裝未明（post-merge 實測回填）；user 級舊副本遮蔽 plugin skill（`-Migrate` 必清，devwork 用命名空間載入並以台詞辨識）。

---

## §檔案結構規劃

| 類型 | 路徑 | 職責 / 動什麼 |
|---|---|---|
| 新建 | `.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json` | plugin 身分；repo 自己當 marketplace |
| 新建 | `hooks/hooks.json` | PreToolUse Write\|Edit\|NotebookEdit → 兩支 pwsh |
| 修改 | `hooks/file-type-guard.ps1:8,18,77,161`、`hooks/branch-safety.ps1:9,78` | state dir 改系統 temp；stderr 改 `[bstack]` 白話 + `/plugin disable` 出口；CLAUDE.md / 全域字樣改 |
| 新建 | `skills/devwork/SKILL.md`、`skills/devwork/rules.md` | 入口 skill 與規則書單一真相 |
| 修改 | `CLAUDE.md` | 縮成 `--plugin-dir .` 說明 + `@skills/devwork/rules.md` |
| 修改 | `skills/*/SKILL.md` ×27、`agents/{db-reviewer,lang-reviewer,security-auditor}.md` | 描述「觸發：」→「載入：」；路徑字樣；`CLAUDE.md §` → `rules.md §`；「§跨流程 skill 觸發」→「§跨流程 skill 載入」 |
| 新建 | `scripts/extras.ps1`、`templates/project-settings.json` | 四項偏好選單；團隊範本（也是 permissions 白名單的唯一來源） |
| 刪除 / 搬移 | `scripts/setup.ps1`、`settings.json`、`state/`；`statusline.sh` → `extras/statusline.sh` | 全域 sync 路徑全數移除 |
| 新建 | `scripts/plugin-contract.mjs` | P1–P8 契約 |
| 修改 | `docs/js/data.js`、`docs/js/app.js`、`docs/index.html`、`docs/tools/docs-site-contract.mjs`、`README.md` | 流程圖 prelude、NODE_DOCS、landing 文案（含 hero 三句）、計數、契約基線 |
| 產出 | `docs/js/references-data.js` | `build-references.ps1` 重跑 |

**測試策略**：repo 無 test runner。「紅 / 綠」= 契約腳本 FAIL / PASS；extras.ps1 行為 = `-SelfTest` 內建斷言。**shell 規則**：```bash 區塊在 Git Bash 跑（`$?` 是整數）；```pwsh 區塊在 pwsh 跑，看 exit code 用 `$LASTEXITCODE`，不要用 `$?`（在 pwsh 是布林）。兩支契約檔頭都要抄 docs-site-contract 那段警語。

**跨 task 的「預期紅」**：Task 4 落地後 `docs-site-contract.mjs` 的 C8b（35 vs 34）與 C18（devwork 無 NODE_DOCS）會紅到 Task 7 才綠；group 2–3 的 verify 只看 `plugin-contract.mjs` 指定的 P 項，不把 docs-site-contract 的紅當失敗。

**hand-off 給 execute-plan 的名詞**：以下「白名單行」指 P4 掃描時跳過含 `舊版|遷移|-Migrate|不寫入|不碰|plugins/` 任一字樣的行。

---

### Task 1: plugin 結構契約 `scripts/plugin-contract.mjs`（先紅）

**parallel-group**: 1
**files**:
- create: `scripts/plugin-contract.mjs`

- [ ] **Step 1: 寫契約**

```js
/**
 * plugin 結構契約（零依賴，只用 node 內建模組）。
 *
 * 為什麼要有：這個 repo 沒有 test runner。改成 plugin 後「manifest 對不對、觸發詞有沒有清乾淨、
 * 全域路徑字樣有沒有殘留、兩份計數有沒有漂移」只能靠肉眼，這支把它們變成機械判定。
 *   P1 manifest                      P2 hooks.json、腳本存在、state dir 不在 plugin 內
 *   P3a skill 數量與 name==目錄名     P3b devwork 入口存在   P3c 描述無「觸發：」
 *   P4 無 ~/.claude 安裝路徑字樣（白名單行跳過）          P5 全域 sync 路徑已移除、範本合法
 *   P6 rules.md 單一真相             P7 agents frontmatter  P8 README / index.html 計數 == 磁碟
 *
 * 跑法（**必須用 Bash，不要用 PowerShell**——$? 在 PowerShell 是布林、grep 不存在）：
 *   node scripts/plugin-contract.mjs
 *   node scripts/plugin-contract.mjs --selftest   # 驗 fail 路徑與 frontmatter 解析
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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

/** frontmatter（--- 到 --- 之間）；沒有就回空字串。 */
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}
/**
 * description 值：先試 `description: |` 多行（只吃 [ \t]，**不能用 \s**——\s 會吃掉換行連同下一行縮排，
 * 捕獲群組變空、退到單行分支抓到 "|"，斷言就恆綠；review 實跑抓到過），再退單行。
 */
function description(fm) {
  const multi = fm.match(/^description:[ \t]*\|[ \t]*\r?\n((?:[ \t]+.*(?:\r?\n|$))*)/m);
  if (multi && multi[1].trim()) return multi[1];
  const single = fm.match(/^description:[ \t]*(.+)$/m);
  return single ? single[1] : '';
}
/** 剝掉 pwsh 的 `#` 行註解與 `<# … #>` 區塊註解，只留 code。 */
const stripPsComments = (s) => s.replace(/<#[\s\S]*?#>/g, '').replace(/^\s*#.*$/gm, '');

// selftest 先驗解析器本身，解析器壞掉時後面的 P3c / P7 都是假綠
if (SELFTEST) {
  const fake = 'name: x\ndescription: |\n  第一行。觸發：寫 / 改\n  第二行\ntools: []';
  const d = description(fake);
  const before = failed;
  check('S1 多行 description 抓得到內容', d.includes('觸發：') && d.includes('第二行'), `實際抓到 ${JSON.stringify(d)}`);
  check('S2 單行 description', description('description: 單行值') === '單行值', '單行分支壞了');
  check('S3 check() 累計失敗（本條必紅）', false, '刻意失敗');
  const ok = failed === before + 1;
  console.log(ok ? '\nSELFTEST PASS' : '\nSELFTEST FAIL');
  process.exit(ok ? 0 : 1);
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
  `期望 name=bstack、owner.name、plugins=[{name:bstack, source:'./'}]，實際 ${market.__err || JSON.stringify(market)}（後果：/plugin install bstack@bstack 找不到）`);

// ── P2 hooks ────────────────────────────────────────────────────────────────
const hooks = parseJson('hooks/hooks.json');
const hookCmds = [];
if (!hooks.__err && hooks.hooks) for (const evt of Object.values(hooks.hooks)) for (const e of evt) for (const h of (e.hooks || [])) hookCmds.push(h.command || '');
const badCmd = hookCmds.filter((c) => !c.includes('${CLAUDE_PLUGIN_ROOT}'));
const missingScript = hookCmds.map((c) => (c.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"']+)/) || [])[1]).filter(Boolean).filter((rel) => !exists(rel));
check('P2a hooks.json 合法且每個 command 用 ${CLAUDE_PLUGIN_ROOT}',
  !hooks.__err && hookCmds.length >= 2 && badCmd.length === 0,
  `期望 ≥2 個 command 全含 \${CLAUDE_PLUGIN_ROOT}，實際 ${hooks.__err || `${hookCmds.length} 個、${badCmd.length} 個沒用變數`}（後果：hook 路徑寫死本機）`);
check('P2b hooks.json 指到的腳本都存在', missingScript.length === 0,
  `期望 0 個缺，實際缺 [${missingScript.join(', ')}]（後果：每次 Write / Edit 噴 hook 執行失敗）`);
check('P2c file-type-guard code 不再寫 plugin 目錄內的 state/（含 docstring）',
  exists('hooks/file-type-guard.ps1') && !/state[\\/]file-guard|\.\.[\\/]state/.test(rd('hooks/file-type-guard.ps1')),
  `期望全文無 ../state/file-guard，實際有（後果：token 寫進 plugin 快取，更新即清空）`);

// ── P3 skills ───────────────────────────────────────────────────────────────
const skillDirs = readdirSync(join(REPO, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const nameBad = [], trigBad = [];
for (const name of skillDirs) {
  const p = `skills/${name}/SKILL.md`;
  if (!exists(p)) { nameBad.push(`${name}(無 SKILL.md)`); continue; }
  const fm = frontmatter(rd(p));
  const nm = (fm.match(/^name:\s*(.+)$/m) || [])[1];
  if (nm !== name) nameBad.push(`${name}(name=${nm})`);
  if (/觸發：/.test(description(fm))) trigBad.push(name);
}
check('P3a ≥28 個 skill 且 name==目錄名（下限而非精確值；精確計數由 P8 守）',
  skillDirs.length >= 28 && nameBad.length === 0, `實際 ${skillDirs.length} 個、問題 [${nameBad.join(', ')}]`);
check('P3b devwork 入口 skill 存在且描述提到 /devwork',
  exists('skills/devwork/SKILL.md') && /\/devwork/.test(description(frontmatter(rd('skills/devwork/SKILL.md')))),
  `期望 skills/devwork/SKILL.md 存在且描述含 /devwork（後果：使用者不知道怎麼啟動）`);
check('P3c 沒有任何 skill 描述含「觸發：」', trigBad.length === 0,
  `實際 ${trigBad.length} 個：${trigBad.slice(0, 8).join(', ')}（後果：自然語言觸發詞還在 = 沒下 /devwork 也會被攔）`);

// ── P7 agents ───────────────────────────────────────────────────────────────
const agentFiles = exists('agents') ? readdirSync(join(REPO, 'agents')).filter((f) => f.endsWith('.md')) : [];
const agentBad = [];
for (const f of agentFiles) {
  const fm = frontmatter(rd(`agents/${f}`));
  if (!/^name:/m.test(fm) || !/^description:/m.test(fm)) agentBad.push(`${f}(缺 name/description)`);
  if (/觸發：/.test(description(fm))) agentBad.push(`${f}(描述含「觸發：」)`);
}
check('P7 6 個 agent frontmatter 齊且描述無「觸發：」', agentFiles.length === 6 && agentBad.length === 0,
  `實際 ${agentFiles.length} 個、問題 [${agentBad.join(', ')}]`);

// ── P4 全域安裝路徑字樣 ────────────────────────────────────────────────────────
// 白名單行：講「舊版 / 遷移 / 不寫入 / 不碰 / plugins/ 快取」的行本來就該提到 ~/.claude，跳過。
const FORBID = /(~|\$HOME|\$env:USERPROFILE)[\\/]\.claude[\\/](skills|hooks|agents|settings\.json|CLAUDE\.md|statusline\.sh)/;
const ALLOW_LINE = /舊版|遷移|-Migrate|不寫入|不碰|plugins\//;
const scanTargets = [
  ...skillDirs.map((n) => `skills/${n}/SKILL.md`), ...agentFiles.map((f) => `agents/${f}`),
  'hooks/branch-safety.ps1', 'hooks/file-type-guard.ps1', 'CLAUDE.md', 'README.md',
  'skills/devwork/rules.md', 'docs/index.html', 'docs/js/data.js',
].filter(exists);
const hits = [];
for (const p of scanTargets) rd(p).split(/\r?\n/).forEach((line, i) => { if (FORBID.test(line) && !ALLOW_LINE.test(line)) hits.push(`${p}:${i + 1}`); });
check('P4 無 ~/.claude/{skills,hooks,agents,settings.json,CLAUDE.md,statusline.sh} 字樣（白名單行除外）',
  hits.length === 0, `實際 ${hits.length} 處：${hits.slice(0, 8).join(' / ')}（後果：文件教人去全域找檔，位置全錯）`);

// ── P5 全域 sync 路徑已移除、範本合法 ────────────────────────────────────────────
const tmpl = exists('templates/project-settings.json') ? parseJson('templates/project-settings.json') : { __err: '不存在' };
const p5 = {
  'settings.json 已刪': !exists('settings.json'),
  'scripts/setup.ps1 已刪': !exists('scripts/setup.ps1'),
  'state/ 已刪': !exists('state'),
  'scripts/extras.ps1 存在': exists('scripts/extras.ps1'),
  'extras/statusline.sh 存在': exists('extras/statusline.sh'),
  'templates/project-settings.json 合法且 allow 含 Read': !tmpl.__err && Array.isArray(tmpl.permissions?.allow) && tmpl.permissions.allow.includes('Read') && tmpl.enabledPlugins?.['bstack@bstack'] === true,
};
const p5bad = Object.entries(p5).filter(([, ok]) => !ok).map(([k]) => k);
check('P5 全域 sync 路徑已移除、extras 與範本到位', p5bad.length === 0, `不過 [${p5bad.join(', ')}]`);

// ── P6 rules.md 單一真相 ──────────────────────────────────────────────────────
check('P6 rules.md 存在且 CLAUDE.md 以 @ 引用',
  exists('skills/devwork/rules.md') && /^@skills\/devwork\/rules\.md\s*$/m.test(rd('CLAUDE.md')) && /### §事實核實/.test(rd('skills/devwork/rules.md')),
  `期望 rules.md 有 §事實核實 且 CLAUDE.md 含獨立一行 @skills/devwork/rules.md（後果：兩份守則漂移）`);

// ── P8 計數 ─────────────────────────────────────────────────────────────────
const n = skillDirs.length;
const readmeN = Number((rd('README.md').match(/^## Skills（(\d+)）/m) || [])[1]);
const html = exists('docs/index.html') ? rd('docs/index.html') : '';
const heroN = Number((html.match(/<b>(\d+)<\/b><span>skills<\/span>/) || [])[1]);
const legendN = Number((html.match(/<span class="nn">(\d+)<\/span><\/li>/) || [])[1]);
const metaN = Number((html.match(/content="(\d+) 個 skill/) || [])[1]);
check(`P8 README / index.html 的 skill 計數 == 磁碟 ${n}`,
  readmeN === n && heroN === n && legendN === n && metaN === n,
  `README=${readmeN} hero=${heroN} legend=${legendN} meta=${metaN}（後果：公開站報錯數字；改處：README.md「## Skills（N）」、index.html :8 :48 :87）`);

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAIL`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: 跑、確認紅**

```bash
node scripts/plugin-contract.mjs; echo "exit=$?"
# Expected: P1a P1b P2a P2b P2c P3a P3b P3c P4 P5 P6 P7 FAIL（P8 現況 27==27 PASS）、exit=1
node scripts/plugin-contract.mjs --selftest; echo "exit=$?"
# Expected: S1 S2 PASS、S3 FAIL、SELFTEST PASS、exit=0
```

- [ ] **Step 3: 無實作** — [ ] **Step 4: 同 Step 2**
- [ ] **Step 5: commit**

```bash
git add scripts/plugin-contract.mjs
git commit -m "test: 加 plugin 結構契約 plugin-contract.mjs（先紅）"
```

---

### Task 2: plugin manifest

**parallel-group**: 1（group 2 的實測都靠它，所以與 Task 1 同組先落）
**files**: create `.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json`

- [ ] **Step 1: 紅** = P1a / P1b FAIL
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
    { "name": "bstack", "source": "./", "description": "繁中台灣用語的 Claude Code 九階段開發流程，/devwork 啟動", "version": "1.0.0", "category": "workflow" }
  ]
}
```

- [ ] **Step 3: 綠** `node scripts/plugin-contract.mjs | grep P1` → 兩條 PASS
- [ ] **Step 4: 實測 manifest 可載**

```pwsh
claude --plugin-dir . -p "/bstack:brainstorm 只回 OK" --max-turns 1 --output-format text
# Expected: 無 Unknown plugin 類錯誤、回應含 OK
```

- [ ] **Step 5: commit** `git add .claude-plugin && git commit -m "feat: 加 plugin.json 與 marketplace.json，repo 自身即 marketplace"`

---

### Task 3: hooks.json、state dir、hook 訊息白話化

**parallel-group**: 2
**files**:
- create: `hooks/hooks.json`
- modify: `hooks/file-type-guard.ps1:8`（「依 CLAUDE.md §File-type 硬規則」→「依 bstack rules.md §File-type 硬規則」）、`:18`（docstring 位置）、`:77`（stateDir）、`:161` 附近 stderr（加 `[bstack]` 前綴）
- modify: `hooks/branch-safety.ps1:9`（「例如 ~/.claude 全域檔」→「例如使用者的 Claude 設定目錄」）、`:78`（stderr）

- [ ] **Step 1: 紅** = P2a / P2b / P2c FAIL
- [ ] **Step 2: 改**

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

`file-type-guard.ps1:77`
```powershell
# state dir 放系統 temp 而非 plugin 目錄：plugin 裝在 ~/.claude/plugins/ 快取，
# 更新即清空、也不該被 hook 寫入。token 檔名已含專案路徑 hash，不同專案不撞。
$stateDir = Join-Path ([System.IO.Path]::GetTempPath()) 'bstack/file-guard'
```
docstring `:18`：「位於 `<系統 temp>/bstack/file-guard/<hash>.token`（Windows 為 `%TEMP%\bstack\file-guard\`）」。

`branch-safety.ps1:78` stderr 改為（不依賴 rules.md 也看得懂）：
```
[bstack] 目前在 <branch>，這是受保護的 branch。請先開 branch：git checkout -b <type>/<short-desc>（type ∈ feat/fix/refactor/docs/chore/test/hotfix）。若你沒在用 bstack 流程、不想要這個檢查：/plugin disable bstack@bstack
```
`file-type-guard.ps1` 的 block / WARN 兩段 stderr 開頭加 `[bstack] `，WARN 段末加同一句 `/plugin disable` 出口；印出的 token 路徑維持 `$tokenPath` 絕對路徑。

- [ ] **Step 3: 綠** `node scripts/plugin-contract.mjs | grep P2` → 三條 PASS
- [ ] **Step 4: 實測（三個情境，目錄刻意用含空白路徑，例如 `%TEMP%\bstack probe\`）**

```pwsh
# (a) main 上 Write 被擋、訊息有 [bstack] 與 /plugin disable
git init; claude --plugin-dir D:\GitHub\bstack -p "用 Write 工具建立 a.txt 內容 hi" --max-turns 3 --output-format text
# (b) WARN 流程：git checkout -b feat/x 後請它建 Dockerfile → 看到 token 絕對路徑 → 用 Bash 工具建 token → 放行
# (c) 反向：暫時把 pwsh 從 PATH 拿掉跑 (a)，把使用者實際看到的錯誤文字抄進 Task 7 README troubleshooting
```

- [ ] **Step 5: commit** `git add hooks && git commit -m "feat: 加 plugin hooks.json，hook 訊息白話化並改寫系統 temp"`

---

### Task 4: devwork 入口 skill + rules.md + repo CLAUDE.md

**parallel-group**: 2
**files**: create `skills/devwork/SKILL.md`、`skills/devwork/rules.md`；modify `CLAUDE.md`

- [ ] **Step 1: 紅** = P3b / P6 FAIL
- [ ] **Step 2: 建檔**

`skills/devwork/rules.md` = 現行 `CLAUDE.md` 全文 + 五處改字：
1. 開頭加：`> 對 plugin 使用者：本檔由 /devwork 載入，不會進你的 CLAUDE.md。對 bstack 貢獻者：repo 的 CLAUDE.md 會 @import 這份。`
2. §Branch safety 首行 → `plugin 的 \`hooks/branch-safety.ps1\`（PreToolUse）自動擋`；豁免段「全域 `~/.claude/` 的 skill、CLAUDE.md、hook 本身」→「plugin 目錄內的檔、使用者的 Claude 設定目錄」。
3. §File-type 硬規則 首行 → `plugin 的 \`hooks/file-type-guard.ps1\` 偵測`。
4. §Settings.json 整節 →
   ```
   ### §Settings.json
   專案 `.claude/settings.json` 的 `permissions.allow` **僅限 read-only / 查詢類**（範本：https://github.com/fujiei22/bstack/blob/main/templates/project-settings.json）；寫入類（Edit / Write / commit / push / checkout / rm / npm install）一律 prompt。個人偏好走 `scripts/extras.ps1` 逐項選層級，本流程不主動寫使用者層級的 settings。
   ```
   （**不得**出現 `~/.claude/settings.json` 字樣，P4 會抓）
5. §開發流程 intro「寫 / 改 / 修 / 加 … 類 prompt 一律進 `dev-workflow`」→「流程由 `/devwork` 啟動；沒下指令時不套用本規則書」。

`skills/devwork/SKILL.md`
```markdown
---
name: devwork
description: |
  bstack 九階段開發流程的唯一入口（繁中）。使用者輸入 `/devwork <要做的事>` 才啟動
  （打了出現 Unknown command 或載到別的東西時改打 `/bstack:devwork`）；
  **不因「寫 / 改 / 修 / 加」等自然語言自動載入**。載入後：讀 rules.md → 載 dev-workflow → Phase 0。
  沒下這個指令時，Claude Code 就是普通的 Claude Code。
---

# devwork

## 使用契約（強制）

1. **讀 `rules.md`**（同目錄）。它的位階等同 CLAUDE.md：與任何 skill 衝突時 rules.md 勝。
   若本 session 的 CLAUDE.md 已經 `@import` 了它（在 bstack repo 內開發時會這樣），不重讀。
2. **判斷 `/devwork` 後面的文字**：
   - 純問答 / 教學（「這個函式在做什麼」「X 和 Y 差在哪」）→ 直接回答，不進 Phase 0，結尾提一句「`/devwork` 是給改動類任務用的」。
   - 改動類 → 進第 3 步。
   - 沒有文字 → 用一般文字問「要做什麼？一句話描述這次的改動」（開放題，**不用** AskUserQuestion）。
3. **載入 `bstack:dev-workflow`**（用命名空間，避免被使用者 `~/.claude/skills/` 的舊副本遮蔽），進 Phase 0 入口分流。
4. 之後每輪結尾照 rules.md §Trace 標籤 貼 `[Trace] …`。

## 第一句台詞（只印這一條，dev-workflow 被本 skill 載入時不另印）

- 有文字：`[bstack devwork · plugin] 已載入守則。這件事：<一句改述>。先做 Phase 0 判定。`
- 沒文字：`[bstack devwork · plugin] 已載入守則。要做什麼？一句話描述這次的改動。`

**若接著又出現一行 `[已載入 dev-workflow]`**，代表載到的是舊版 setup.ps1 留在使用者層級的副本、它遮蔽了 plugin 版：請使用者跑 `pwsh -File scripts/extras.ps1 -Migrate`。

## 為什麼要有這一層

以前流程靠 27 個 skill 描述裡的關鍵詞自動攔截，使用者沒有「這次不要走流程」的選項，守則放全域 CLAUDE.md 對所有專案生效。現在守則跟著 `/devwork` 走。

## 顯式呼叫其他 skill

流程內的 skill 都能單獨呼叫（`/bstack:finish-branch`、`/bstack:retro` …），它們預期 hand-off state 存在；單獨呼叫時缺的欄位由該 skill 用 AskUserQuestion 補問。這是全 repo 唯一寫出 `/bstack:` 前綴清單的地方。
```

`CLAUDE.md`（repo 自身）
```markdown
# CLAUDE.md（bstack repo 自身）

本 repo 是 Claude Code plugin。開發它自己時用 `claude --plugin-dir .` 載入，讓 `/devwork` 與 hooks 在這個 repo 內生效。
規則書單一真相在 `skills/devwork/rules.md`，下面整份 import，兩邊不要各改各的。

@skills/devwork/rules.md
```

- [ ] **Step 3: 綠** `node scripts/plugin-contract.mjs | grep -E "P3b|P6"` → 兩條 PASS（docs-site-contract 的 C8b / C18 此時預期紅）
- [ ] **Step 4: 實測**

```pwsh
Set-Location <空 temp 目錄>
# (a) 裸名 harness 展開：Skill tool call 應為 0
claude --plugin-dir D:\GitHub\bstack -p "/devwork" --max-turns 2 --output-format stream-json --verbose 2>&1 | Select-String '"name":"Skill"' | Measure-Object | % Count
# (b) 台詞
claude --plugin-dir D:\GitHub\bstack -p "/devwork" --max-turns 2 --output-format text          # Expected: 含 [bstack devwork · plugin]、問「要做什麼」
claude --plugin-dir D:\GitHub\bstack -p "/devwork 這個 repo 的 hooks 在做什麼" --max-turns 2 --output-format text   # Expected: 直接回答 + 提示 /devwork 給改動用
# (c) 命名空間繞過遮蔽：先確認本機 ~/.claude/skills/dev-workflow 仍是舊版（-Migrate 還沒跑），跑 (b) 第一條，看有沒有第二行 [已載入 dev-workflow]
#     有 → 命名空間繞不過遮蔽，devwork SKILL.md 第 3 步改回裸名並保留台詞辨識；沒有 → 保留命名空間。結果記進 verify.md
# (d) @import：在 repo 內 claude -p "rules.md 的 §事實核實 第一句是什麼" --max-turns 1 → 能引出「判斷資料模型 / 欄位用途 …」
```

- [ ] **Step 5: commit** `git add skills/devwork CLAUDE.md && git commit -m "feat: 加 devwork 入口 skill，守則搬進 rules.md 由 CLAUDE.md import"`

---

### Task 5a: dev-workflow 與 brainstorm 去自動觸發

**parallel-group**: 3
**files**: modify `skills/dev-workflow/SKILL.md`（description、:15 使用契約、:242 §跨流程 skill 觸發 標題、:264 §Red Flags、:283 §跟 CLAUDE.md 的關係、:296 第一句台詞）、`skills/brainstorm/SKILL.md`（description、body `CLAUDE.md §`）

- [ ] **Step 1: 紅** = P3c 列出 dev-workflow、brainstorm
- [ ] **Step 2: 改**

dev-workflow description：
```yaml
description: |
  自動化開發流程主入口（繁中）。載入：由 `devwork` skill 載入（使用者輸入 /devwork）；
  **不因自然語言自動觸發**。涵蓋：Phase 0 入口分流（Track / Tier）、9 階段順序、
  skill hand-off state、Trace 標籤、Auto-fix、Fail handling、Memory hook、跨流程 skill dispatch。
  規則書 `devwork/rules.md` 永遠優先於本 skill。
```
body：使用契約第 1 點 → 「user prompt 由 devwork 交進來（`/devwork` 後面的文字）；純問答已在 devwork 過濾，這裡收到的一律是改動類」；全文 `CLAUDE.md` → `rules.md`（段落標題「§跟 rules.md 的關係」）；`:242` 標題 → 「§跨流程 skill 載入」；`:296` 第一句台詞 → 「由 devwork 載入時**不印橫幅**（devwork 已印）；被單獨呼叫時印 `[bstack dev-workflow · plugin] Phase 0 入口分流啟動。`」。

brainstorm description：
```yaml
description: |
  需求釐清 + Phase 0 入口分流（繁中）。載入：dev-workflow 使用契約第 2 步；不因自然語言自動觸發。
  涵蓋：0a 對話釐清（+ 讀 memory）、0b 看 codebase、0b′ UI 面判定、0c Track 判定（Bug/Dev）、
  0d Tier 判定（T0-T3）、spec 落檔 docs/work/<branch-name>/spec.md。終態 → 交棒 write-plan（Dev）或 debug-systematic（Bug）。
```
body `CLAUDE.md §` → `rules.md §`。

- [ ] **Step 3: 綠** `node scripts/plugin-contract.mjs | grep P3c` 的清單不再含這兩個；`grep -c "CLAUDE.md" skills/dev-workflow/SKILL.md skills/brainstorm/SKILL.md` → 0 0
- [ ] **Step 4: 重跑 Task 4 Step 4 (b)**
- [ ] **Step 5: commit**（明列檔案，避免與 5b 同 worktree 混 commit）`git add skills/dev-workflow/SKILL.md skills/brainstorm/SKILL.md && git commit -m "refactor: dev-workflow 與 brainstorm 改為只由 devwork 載入"`

---

### Task 5b: 其餘 25 個 skill + 3 個 agent

**parallel-group**: 3
**files**:
- modify: 25 個 `skills/<name>/SKILL.md` description（不含 devwork / dev-workflow / brainstorm）
- modify: `agents/db-reviewer.md:4`、`agents/lang-reviewer.md:7`、`agents/security-auditor.md:4`
- modify 路徑 / 引用字樣：`skills/finish-branch/SKILL.md:276`、`skills/design-direction/SKILL.md:85-86`、`skills/design-language/SKILL.md:23,25`、`skills/execute-plan/SKILL.md:53,57`、`skills/write-skill/SKILL.md:173-177,185,190`、`skills/dispatch-parallel/SKILL.md:57`

- [ ] **Step 1: 紅** = P3c / P7 FAIL；P4 在 skills 內有 hits
- [ ] **Step 2: 改**

description 規則：「觸發：<清單>」→ 一句「載入：<誰在哪個階段>」，**不寫 `/bstack:` 前綴**（只在 devwork SKILL.md 講一次）：

| skill | 載入： |
|---|---|
| write-plan / review-plan / execute-plan / tdd-cycle / verify-done / request-review / receive-review / security-audit / security-checklist / finish-branch / pr-explain | `dev-workflow Phase <N>`（照 rules.md §Tier 表）；亦可由使用者顯式呼叫 |
| debug-systematic / incident-investigate | dev-workflow Bug track Phase 3' |
| design-language / design-direction / frontend-test / dispatch-parallel / db-access | dev-workflow §跨流程 skill 載入 表所列時點 |
| cmd-guard / safety-guard / lock-files / context-snapshot / context-resume / retro / write-skill | dev-workflow §跨流程 skill 載入 表；亦可由使用者顯式呼叫 |

agent 描述：「觸發：…」→「載入：…」（三個檔）。

路徑 / 引用字樣：
- `finish-branch:276` → `- **Hook**：plugin 的 \`hooks/branch-safety.ps1\`（PreToolUse 擋 Write / Edit / NotebookEdit）`
- `design-direction:85-86` → `- plugin 安裝時：\`${CLAUDE_PLUGIN_ROOT}/skills/design-direction/<相對路徑>\`` / `- repo 內開發時：\`<repo>/skills/design-direction/<相對路徑>\``
- `design-language:23`、`execute-plan:57` 的「剔除 `~/.claude/skills/**`」→「剔除任何路徑含 `skills/<name>/SKILL.md` 的 skill 定義目錄（plugin 快取、專案 `.claude/skills/`、repo `skills/` 都算）」；`design-language:25` 「由 setup.ps1 同步到 ~/.claude/skills/，全域生效」→「隨 plugin 在啟用它的每個專案生效」
- `write-skill:173-177` 放置表：「Global / 跨專案」列 →「plugin（隨 bstack 發布）| repo `skills/<name>/`」；「暫時 / experimental」→ 該專案 `.claude/skills/_experimental/<name>/`；`:177` 的 `D:\GitHub\b\skills…（走 setup.ps1 sync）` 整行刪；`:185,190` 「§跨流程 skill 觸發」→「§跨流程 skill 載入」。放置表之後新增一節：
  ```
  ### §新 skill 落地 checklist（漏一處契約就紅）
  1. `skills/<name>/SKILL.md`（name == 目錄名；描述寫「載入：」不寫「觸發：」）→ plugin-contract P3a / P3c
  2. `docs/js/app.js` NODE_DOCS 加 `Load<X>: {p:'skills/<name>', n:'<name>', k:'skill'}` → docs-site-contract C6a / C18
  3. `docs/js/data.js` 加節點與邊（或 ambient 區塊 docKey）→ C8a 節點 / 邊數
  4. `docs/tools/docs-site-contract.mjs` BASELINE_KEYS 與 EXPECT → C6a / C8a
  5. `pwsh -File scripts/build-references.ps1` → C8b / C18
  6. `README.md` 「## Skills（N）」與表格一列 → plugin-contract P8
  7. `docs/index.html` :8 :48 :87 三處計數 → P8
  ```
- `execute-plan:53` 「§跨流程 skill 觸發」→「§跨流程 skill 載入」
- `dispatch-parallel:57` → `1. 查環境變數 \`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\`（settings.json 的 env 區塊會注入為環境變數；\`scripts/extras.ps1\` 的 env 項可一鍵設定）。`
- 全部 skill / agent body 內 `CLAUDE.md §xxx` → `rules.md §xxx`（`grep -rn "CLAUDE.md" skills agents`；**保留** write-skill「SKILL.md 與 CLAUDE.md 這類給 AI 讀的 prompt 檔」泛稱）；`grep -rn "跨流程 skill 觸發" skills` → 0。

- [ ] **Step 3: 綠**

```bash
node scripts/plugin-contract.mjs | grep -E "P3c|P7|P4"
# Expected: P3c P7 PASS；P4 的 hits 只剩 README.md / docs/index.html / docs/js/data.js（Task 7 的檔）
grep -rn "觸發：" skills/*/SKILL.md agents/*.md | grep -v "^skills/[^/]*/SKILL.md:[0-9]*:  [^d]" | head   # 描述區以外的殘留人工看一眼
```

- [ ] **Step 4: 實測自然語言不觸發**

```pwsh
Set-Location <空 temp 目錄>
claude --plugin-dir D:\GitHub\bstack -p "幫我改一下 README 的錯字" --max-turns 2 --output-format stream-json --verbose 2>&1 | Select-String '"name":"Skill"' | Measure-Object | % Count
# Expected: 0
```

- [ ] **Step 5: commit**（明列）`git add agents skills/<25 個名>/SKILL.md && git commit -m "refactor: 25 個 skill 與 3 個 agent 改為流程載入，清掉全域路徑字樣"`

---

### Task 6: extras.ps1 + 範本 + 刪全域 sync 物

**parallel-group**: 3
**files**: create `scripts/extras.ps1`、`templates/project-settings.json`；`git mv statusline.sh extras/statusline.sh`；`git rm scripts/setup.ps1 settings.json`；`Remove-Item -Recurse state`（未追蹤）

- [ ] **Step 1: 紅** = P5 FAIL；extras.ps1 不存在
- [ ] **Step 2: 寫**

`templates/project-settings.json`（**permissions 白名單的唯一來源**，extras 讀它）
```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "extraKnownMarketplaces": { "bstack": { "source": { "source": "github", "repo": "fujiei22/bstack" } } },
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

`scripts/extras.ps1`（`Test-JsonObject` / `Merge-LocalFirst` 從 `setup.ps1:125-167` 原封搬入）
```powershell
#!/usr/bin/env pwsh
<#
.SYNOPSIS
  bstack 的「plugin 帶不了」四項偏好選單：statusLine / permissions / env / mcp。
.DESCRIPTION
  plugin 核心（skills / agents / hooks / 守則）走 `/plugin install bstack@bstack`，本腳本不碰。
  這裡只處理 Claude Code plugin 規格帶不了的個人偏好，每項各問一次要裝到哪一層：
    [U] 使用者層級  ~/.claude/settings.json（mcp 項：claude mcp add --scope user）
    [P] 目前專案    <cwd>/.claude/settings.json（mcp 項：專案根 .mcp.json，**會進 git、隊友共用**）
    [S] 跳過（預設；不選就什麼都不寫）
  merge 只加本項 key、其他原封保留；每次執行對每個動到的檔備份一次；manifest 只記「真的新增的 key」，
  -Uninstall 只拆那些。manifest 住 ~/.claude/bstack-extras.json——這是本腳本唯一主動寫進 ~/.claude/ 的檔。
  請從 clone 的 repo 跑（statusLine 會指到 extras/statusline.sh 的絕對路徑）；從 plugin 快取跑會警告。
.PARAMETER Yes        非互動：搭 -Items 與 -Scope 直接套用
.PARAMETER Items      statusLine | permissions | env | mcp
.PARAMETER Scope      user | project
.PARAMETER Uninstall  依 manifest 移除自己加過的 key / MCP
.PARAMETER Migrate    清舊 setup.ps1 sync 進 ~/.claude/ 的副本（預設只列，-Yes 才刪）
.PARAMETER SelfTest   在 temp 偽造 HOME 跑全套斷言（不碰真實設定）
#>
[CmdletBinding(SupportsShouldProcess, DefaultParameterSetName = 'Menu')]
param(
  [Parameter(ParameterSetName = 'Menu')][Parameter(ParameterSetName = 'Batch')][Parameter(ParameterSetName = 'Migrate')][switch]$Yes,
  [Parameter(ParameterSetName = 'Batch', Mandatory)][ValidateSet('statusLine','permissions','env','mcp')][string[]]$Items,
  [Parameter(ParameterSetName = 'Batch', Mandatory)][ValidateSet('user','project')][string]$Scope,
  [Parameter(ParameterSetName = 'Uninstall', Mandatory)][switch]$Uninstall,
  [Parameter(ParameterSetName = 'Migrate', Mandatory)][switch]$Migrate,
  [Parameter(ParameterSetName = 'SelfTest', Mandatory)][switch]$SelfTest
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$RunStamp = Get-Date -Format yyyyMMddHHmmss      # 整支腳本共用；同檔只備份一次
$script:BackedUp = @{}
$script:Written  = @()                            # 結尾摘要用：@{item; scope; file}

function Get-ClaudeHome {
  if ($env:BSTACK_CLAUDE_HOME) { return $env:BSTACK_CLAUDE_HOME }   # 測試覆寫；一般路徑會印黃字警告
  $h = $env:USERPROFILE; if (-not $h) { $h = $HOME }
  return (Join-Path $h '.claude')
}
function Get-SettingsPath([string]$scope) {
  if ($scope -eq 'user') { return (Join-Path (Get-ClaudeHome) 'settings.json') }
  return (Join-Path (Get-Location).Path '.claude/settings.json')
}
function Get-ManifestPath { Join-Path (Get-ClaudeHome) 'bstack-extras.json' }
function Get-TemplateAllow { (Get-Content (Join-Path $RepoRoot 'templates/project-settings.json') -Raw -Encoding UTF8 | ConvertFrom-Json).permissions.allow }

<# 每項：白話說明、建議層級、Fragment（要 merge 的片段；mcp 為 $null 走 claude mcp add）#>
$ItemDefs = [ordered]@{
  statusLine  = @{ Hint = '狀態列顯示 model / branch / context 用量（需 bash + jq）'; Suggest = 'U'; Fragment = {
      $sh = (Join-Path $RepoRoot 'extras/statusline.sh').Replace('\','/')
      [pscustomobject]@{ statusLine = [pscustomobject]@{ type = 'command'; command = "bash `"$sh`"" } } } }
  permissions = @{ Hint = "$(@(Get-TemplateAllow).Count) 條唯讀 / 查詢類工具不再逐次問你（Read / Grep / git status …）"; Suggest = 'P'; Fragment = {
      [pscustomobject]@{ permissions = [pscustomobject]@{ allow = @(Get-TemplateAllow) } } } }
  env         = @{ Hint = '開 Agent Teams 實驗開關（只有 dispatch-parallel 用到）'; Suggest = 'U'; Fragment = {
      [pscustomobject]@{ env = [pscustomobject]@{ CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1' } } } }
  mcp         = @{ Hint = 'playwright MCP（前端 e2e 用）。mysql MCP 含帳密，只印指令範本讓你自己填'; Suggest = 'U'; Fragment = $null }
}

function Read-Json([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  try { Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json }
  catch { Write-Host "  [skip] $path 不是合法 JSON，這項跳過，請先修好：$($_.Exception.Message)" -ForegroundColor Yellow; throw [System.FormatException]::new("bad-json:$path") }
}
function Write-JsonAtomic {
  [CmdletBinding(SupportsShouldProcess)] param([string]$path, $obj, [switch]$NoBackup)
  if (-not $PSCmdlet.ShouldProcess($path, 'write')) { return }
  $dir = Split-Path $path; if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if (-not $NoBackup -and (Test-Path -LiteralPath $path) -and -not $script:BackedUp[$path]) {
    Copy-Item -LiteralPath $path -Destination "$path.bak-$RunStamp"; $script:BackedUp[$path] = $true
  }
  $tmp = "$path.tmp-$PID"
  $obj | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $tmp -Encoding UTF8
  Move-Item -LiteralPath $tmp -Destination $path -Force
}
<# 列出 $after 有、$before 沒有的葉 key（dotted）；permissions.allow 例外列成 'permissions.allow[<值>]' #>
function Get-AddedKeys($before, $after, [string]$prefix = '') {
  $out = @()
  foreach ($p in $after.PSObject.Properties) {
    $k = if ($prefix) { "$prefix.$($p.Name)" } else { $p.Name }
    $bv = if ($before) { $before.PSObject.Properties[$p.Name] } else { $null }
    if ($k -eq 'permissions.allow') { $have = @($bv.Value); foreach ($v in @($p.Value)) { if ($v -notin $have) { $out += "permissions.allow[$v]" } }; continue }
    if ($null -eq $bv) { $out += $k; continue }
    if (Test-JsonObject $p.Value -and (Test-JsonObject $bv.Value)) { $out += Get-AddedKeys $bv.Value $p.Value $k }
  }
  return ,$out
}
function Save-Manifest { [CmdletBinding()] param([string]$item, [string]$scope, [string]$file, [string[]]$keys, [string]$status = 'done')
  $m = Read-Json (Get-ManifestPath); if (-not $m) { $m = [pscustomobject]@{ entries = @() } }
  $m.entries = @($m.entries | Where-Object { -not ($_.item -eq $item -and $_.scope -eq $scope -and $_.file -eq $file) })   # 冪等：同鍵覆蓋
  $m.entries += [pscustomobject]@{ item = $item; scope = $scope; file = $file; keys = $keys; status = $status; ts = (Get-Date).ToString('o') }
  Write-JsonAtomic (Get-ManifestPath) $m -NoBackup
}
function Get-Installed([string]$item, [string]$scope) { $m = Read-Json (Get-ManifestPath); if (-not $m) { return $null }; @($m.entries | Where-Object { $_.item -eq $item -and $_.scope -eq $scope })[0] }

function Add-Item { [CmdletBinding(SupportsShouldProcess)] param([string]$item, [string]$scope, [switch]$Force)
  if ($item -eq 'mcp') { return Add-Mcp $scope }
  $path = Get-SettingsPath $scope
  try { $local = Read-Json $path } catch [System.FormatException] { return }
  $frag = & $ItemDefs[$item].Fragment
  if ($item -eq 'statusLine' -and $Force) { $merged = $local; if (-not $merged) { $merged = [pscustomobject]@{} }; $merged | Add-Member -NotePropertyName statusLine -NotePropertyValue $frag.statusLine -Force }
  else { $merged = Merge-LocalFirst -Local $local -Repo $frag }
  if ($item -eq 'permissions') {   # 聯集：本機 allow 是使用者自己的，我們只是加上唯讀清單
    $have = @($local.permissions.allow); $merged.permissions.allow = @($have + @($frag.permissions.allow) | Select-Object -Unique)
  }
  $added = @(Get-AddedKeys $local $merged)
  if ($added.Count -eq 0 -and -not $Force) { Write-Host "  [keep] $item：你本機已有設定，未覆蓋" -ForegroundColor Yellow; return }
  if ($PSCmdlet.ShouldProcess($path, "merge $item")) {
    Save-Manifest $item $scope $path $added 'pending'   # 先記 manifest 再寫 settings：中途炸掉也拆得回來
    Write-JsonAtomic $path $merged
    Save-Manifest $item $scope $path $added 'done'
    $script:Written += @{ item = $item; scope = $scope; file = $path }
  }
}
function Add-Mcp { [CmdletBinding(SupportsShouldProcess)] param([string]$scope)
  $args_ = @('mcp','add','playwright','--scope',$scope,'--','npx','-y','@playwright/mcp@latest')
  $file = if ($scope -eq 'project') { Join-Path (Get-Location).Path '.mcp.json' } else { 'claude mcp (user)' }
  if ($PSCmdlet.ShouldProcess("claude $($args_ -join ' ')", 'run')) {
    & claude @args_; if ($LASTEXITCODE -ne 0) { Write-Host "  [fail] claude mcp add playwright 回傳 $LASTEXITCODE" -ForegroundColor Red; return }
    Save-Manifest 'mcp' $scope $file @('mcp:playwright')
    $script:Written += @{ item = 'mcp'; scope = $scope; file = $file }
  }
  Write-Host @"
  mysql MCP 含帳密，請自己填、自己跑（不寫進任何檔）：
  claude mcp add mysql --scope $scope --env MYSQL_HOST=<host> --env MYSQL_PORT=3306 --env MYSQL_USER=<唯讀帳號> --env MYSQL_PASS=<密碼> --env ALLOW_INSERT_OPERATION=false --env ALLOW_UPDATE_OPERATION=false --env ALLOW_DELETE_OPERATION=false -- npx -y @benborla29/mcp-server-mysql
"@
}
<# 移除 dotted 葉 key；'permissions.allow[值]' 只拔那個值；父物件空了就一併拔 #>
function Remove-KeyPath($obj, [string]$dotted) {
  if ($dotted -match '^permissions\.allow\[(.+)\]$') { $v = $Matches[1]; if ($obj.permissions) { $obj.permissions.allow = @($obj.permissions.allow | Where-Object { $_ -ne $v }) }; return }
  $parts = $dotted.Split('.'); $chain = @($obj); $cur = $obj
  for ($i = 0; $i -lt $parts.Length - 1; $i++) { $cur = $cur.($parts[$i]); if ($null -eq $cur) { return }; $chain += $cur }
  $cur.PSObject.Properties.Remove($parts[-1])
  for ($i = $parts.Length - 2; $i -ge 0; $i--) { if (@($chain[$i + 1].PSObject.Properties).Count -eq 0) { $chain[$i].PSObject.Properties.Remove($parts[$i]) } else { break } }
}
function Invoke-Uninstall { [CmdletBinding(SupportsShouldProcess)] param()
  $m = Read-Json (Get-ManifestPath); if (-not $m -or -not @($m.entries).Count) { Write-Host '沒有 manifest，沒東西可拆'; return }
  foreach ($e in $m.entries) {
    if ($e.item -eq 'mcp') { foreach ($k in $e.keys) { $n = $k.Split(':')[1]; if ($PSCmdlet.ShouldProcess("mcp $n", 'remove')) { & claude mcp remove $n --scope $e.scope } }; continue }
    try { $obj = Read-Json $e.file } catch { continue }; if (-not $obj) { continue }
    foreach ($k in $e.keys) { Remove-KeyPath $obj $k }
    Write-JsonAtomic $e.file $obj
  }
  if ($PSCmdlet.ShouldProcess((Get-ManifestPath), 'delete')) { Remove-Item -LiteralPath (Get-ManifestPath) -Force }
  Write-Host "已拆掉 $(@($m.entries).Count) 項，manifest 已刪。"
}
function Invoke-Migrate { [CmdletBinding(SupportsShouldProcess)] param()
  $home_ = Get-ClaudeHome
  $skills = Get-ChildItem (Join-Path $RepoRoot 'skills') -Directory | ForEach-Object Name
  $agents = Get-ChildItem (Join-Path $RepoRoot 'agents') -Filter *.md | ForEach-Object Name
  $targets = @()
  $targets += @($skills | ForEach-Object { Join-Path $home_ "skills/$_" } | Where-Object { Test-Path $_ })
  $targets += @($agents | ForEach-Object { Join-Path $home_ "agents/$_" } | Where-Object { Test-Path $_ })
  $targets += @(@('hooks/branch-safety.ps1','hooks/file-type-guard.ps1','statusline.sh','state/file-guard') | ForEach-Object { Join-Path $home_ $_ } | Where-Object { Test-Path $_ })
  # settings.json：只拔指向舊 hook 的 hooks[] 元素與舊 statusline，使用者自己的 hook 留著
  $settingsPath = Join-Path $home_ 'settings.json'; $s = $null; $touched = $false
  try { $s = Read-Json $settingsPath } catch {}
  if ($s) {
    if ($s.hooks.PreToolUse) {
      $before = ($s.hooks.PreToolUse | ForEach-Object { @($_.hooks).Count } | Measure-Object -Sum).Sum
      foreach ($g in $s.hooks.PreToolUse) { $g.hooks = @($g.hooks | Where-Object { $_.command -notmatch 'branch-safety\.ps1|file-type-guard\.ps1' }) }
      $s.hooks.PreToolUse = @($s.hooks.PreToolUse | Where-Object { @($_.hooks).Count -gt 0 })
      $after = ($s.hooks.PreToolUse | ForEach-Object { @($_.hooks).Count } | Measure-Object -Sum).Sum
      if ($after -ne $before) { $touched = $true }
      if (@($s.hooks.PreToolUse).Count -eq 0) { $s.hooks.PSObject.Properties.Remove('PreToolUse') }
      if (@($s.hooks.PSObject.Properties).Count -eq 0) { $s.PSObject.Properties.Remove('hooks') }
    }
    if ($s.statusLine.command -match 'statusline\.sh') { $s.PSObject.Properties.Remove('statusLine'); $touched = $true }
  }
  # 舊全域 CLAUDE.md：含 bstack 簽名字串（兩個都有）才處理——它第 114 行會讓 dev-workflow 自動啟動
  $claude = Join-Path $home_ 'CLAUDE.md'; $claudeOld = $false; $claudeModified = $false
  if (Test-Path $claude) {
    $t = Get-Content $claude -Raw -Encoding UTF8
    if ($t -match '§事實核實' -and $t -match 'dev-workflow 為骨幹') {
      $rules = Get-Content (Join-Path $RepoRoot 'skills/devwork/rules.md') -Raw -Encoding UTF8
      # 舊版與現版 rules.md 差在幾行路徑字樣；以「強制守則」段落逐行比對，相同行數 ≥ 90% 視為未被使用者改過
      $a = ($t -split "`r?`n") | Where-Object { $_ -match '^###? ' }; $b = ($rules -split "`r?`n") | Where-Object { $_ -match '^###? ' }
      $common = @($a | Where-Object { $_ -in $b }).Count
      if ($a.Count -gt 0 -and $common / $a.Count -ge 0.9) { $claudeOld = $true } else { $claudeModified = $true }
    }
  }
  if (-not $targets.Count -and -not $touched -and -not $claudeOld -and -not $claudeModified) { return }   # 新使用者：一行都不印
  Write-Host "偵測到舊 setup.ps1 sync 的副本（user 級 skill 會遮蔽 plugin 版，不清會一直跑舊版）：" -ForegroundColor Yellow
  $targets | ForEach-Object { "  $_" }
  if ($touched) { "  $settingsPath 內指向舊 hook / statusline 的條目" }
  if ($claudeOld) { "  $claude（bstack 舊版守則，未偵測到你的修改）→ 將改名為 CLAUDE.md.bstack-bak-$RunStamp" }
  if ($claudeModified) {
    $ln = (($t -split "`r?`n") | Select-String -Pattern '一律進 `?dev-workflow' | Select-Object -First 1).LineNumber
    Write-Host "  $claude 含 bstack 守則但被改過，不自動動它。其中第 $ln 行「…一律進 dev-workflow」會讓流程自動啟動，請自行拿掉。" -ForegroundColor Yellow
  }
  $go = $Yes -or ((Read-Host '刪除 / 改名以上項目？[y/N]').ToLower() -eq 'y')
  if (-not $go) { return }
  foreach ($x in $targets) { if ($PSCmdlet.ShouldProcess($x, 'remove')) { Remove-Item -LiteralPath $x -Recurse -Force } }
  if ($touched) { Write-JsonAtomic $settingsPath $s }
  if ($claudeOld -and $PSCmdlet.ShouldProcess($claude, 'rename')) { Move-Item -LiteralPath $claude -Destination "$claude.bstack-bak-$RunStamp" }
  Write-Host "  完成。請重開 Claude Code session。"
}
function Invoke-SelfTest {
  $tmp = Join-Path ([IO.Path]::GetTempPath()) "bstack-extras-selftest-$(Get-Random)"
  $script:fails = 0
  function Assert([string]$name, [bool]$ok) { if ($ok) { Write-Host "PASS  $name" } else { Write-Host "FAIL  $name" -ForegroundColor Red; $script:fails++ } }
  try {
    New-Item -ItemType Directory -Path "$tmp/.claude", "$tmp/proj" -Force | Out-Null
    $env:BSTACK_CLAUDE_HOME = "$tmp/.claude"
    # seed 刻意與我們的名單重疊：allow 有 Read、已有自己的 statusLine
    Set-Content "$tmp/.claude/settings.json" '{"model":"opus","theme":"dark","statusLine":{"type":"command","command":"echo mine"},"permissions":{"allow":["Bash(npm test)","Read"]}}' -Encoding UTF8
    Assert 'S0 反向：這條必紅' $false; $script:fails--          # 驗 Assert 會累計
    Add-Item 'statusLine' 'user'; $s = Read-Json "$tmp/.claude/settings.json"
    Assert 'a1 本機已有 statusLine → 不覆蓋' ($s.statusLine.command -eq 'echo mine')
    Add-Item 'permissions' 'user'; $s = Read-Json "$tmp/.claude/settings.json"
    Assert 'a2 allow 聯集且保留本機值' ($s.permissions.allow -contains 'Bash(npm test)' -and $s.permissions.allow -contains 'Grep')
    Assert 'a3 既有 model/theme 不變' ($s.model -eq 'opus' -and $s.theme -eq 'dark')
    Add-Item 'env' 'user'; $s = Read-Json "$tmp/.claude/settings.json"
    Assert 'a4 env 加入' ($s.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS -eq '1')
    Assert 'b 同檔只備份一次' (@(Get-ChildItem "$tmp/.claude" -Filter 'settings.json.bak-*').Count -eq 1)
    $m = Read-Json (Get-ManifestPath)
    Assert 'c1 manifest 2 筆（statusLine 未寫入不記）' (@($m.entries).Count -eq 2)
    Assert 'c2 manifest 記的是實際新增 key（不含 Read）' ((@($m.entries | ? item -eq permissions)[0].keys -join '|') -notmatch 'allow\[Read\]')
    Push-Location "$tmp/proj"; try { Add-Item 'permissions' 'project' } finally { Pop-Location }
    Assert 'p project 寫到 <cwd>/.claude/settings.json' ((Test-Path "$tmp/proj/.claude/settings.json") -and ((Read-Json "$tmp/proj/.claude/settings.json").permissions.allow -contains 'Read'))
    Add-Item 'env' 'user'; Assert 'i 冪等：重跑 env manifest 仍 3 筆' (@((Read-Json (Get-ManifestPath)).entries).Count -eq 3)
    Set-Content "$tmp/.claude/broken.json" '{ not json' -Encoding UTF8
    $threw = $false; try { Read-Json "$tmp/.claude/broken.json" | Out-Null } catch { $threw = $true }; Assert 'j 壞 JSON 以 FormatException 回報' $threw
    Add-Mcp 'user' -WhatIf; Assert 'k mcp -WhatIf 不寫 manifest' (@((Read-Json (Get-ManifestPath)).entries | ? item -eq mcp).Count -eq 0)
    Invoke-Uninstall; $s = Read-Json "$tmp/.claude/settings.json"
    Assert 'd1 env 整個拆掉（含空父物件）' ($null -eq $s.PSObject.Properties['env'])
    Assert 'd2 allow 回到原樣' ((@($s.permissions.allow) -join '|') -eq 'Bash(npm test)|Read')
    Assert 'd3 使用者自己的 statusLine 仍在' ($s.statusLine.command -eq 'echo mine')
    Assert 'd4 manifest 已刪' (-not (Test-Path (Get-ManifestPath)))
    # migrate：repo 名單內的刪、使用者自己的留、舊 CLAUDE.md 改名、被改過的不動、自己的 hook 留著
    New-Item -ItemType Directory -Path "$tmp/.claude/skills/brainstorm", "$tmp/.claude/skills/my-own", "$tmp/.claude/hooks", "$tmp/.claude/state/file-guard" -Force | Out-Null
    Set-Content "$tmp/.claude/hooks/branch-safety.ps1" '# old'
    Copy-Item (Join-Path $RepoRoot 'skills/devwork/rules.md') "$tmp/.claude/CLAUDE.md"
    Set-Content "$tmp/.claude/settings.json" '{"hooks":{"PreToolUse":[{"matcher":"Write","hooks":[{"type":"command","command":"pwsh x/hooks/branch-safety.ps1"},{"type":"command","command":"echo mine-hook"}]}]}}' -Encoding UTF8
    $script:Yes = $true; Invoke-Migrate
    Assert 'e1 舊 skill 副本刪除' (-not (Test-Path "$tmp/.claude/skills/brainstorm"))
    Assert 'e2 使用者自己的 skill 不動' (Test-Path "$tmp/.claude/skills/my-own")
    Assert 'e3 舊 hook / state 刪除' (-not (Test-Path "$tmp/.claude/hooks/branch-safety.ps1") -and -not (Test-Path "$tmp/.claude/state/file-guard"))
    Assert 'e4 舊 CLAUDE.md 改名備份' ((-not (Test-Path "$tmp/.claude/CLAUDE.md")) -and @(Get-ChildItem "$tmp/.claude" -Filter 'CLAUDE.md.bstack-bak-*').Count -eq 1)
    $s = Read-Json "$tmp/.claude/settings.json"; Assert 'e5 settings 只拔舊 hook、自己的留著' ((@($s.hooks.PreToolUse[0].hooks).Count -eq 1) -and ($s.hooks.PreToolUse[0].hooks[0].command -eq 'echo mine-hook'))
    Set-Content "$tmp/.claude/CLAUDE.md" "# 我的\n### §事實核實\ndev-workflow 為骨幹 一律進 dev-workflow" -Encoding UTF8
    Invoke-Migrate; Assert 'e6 被改過的 CLAUDE.md 不動' (Test-Path "$tmp/.claude/CLAUDE.md")
  } finally {
    Remove-Item Env:BSTACK_CLAUDE_HOME -ErrorAction SilentlyContinue
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  }
  Write-Host ($(if ($script:fails -eq 0) { 'SELFTEST ALL PASS' } else { "SELFTEST $($script:fails) FAIL" }))
  exit $(if ($script:fails -eq 0) { 0 } else { 1 })
}

# === 主流程 ===
if ($env:BSTACK_CLAUDE_HOME -and -not $SelfTest) { Write-Host "[warn] 寫入目標被 BSTACK_CLAUDE_HOME 覆寫為 $($env:BSTACK_CLAUDE_HOME)" -ForegroundColor Yellow }
if ($RepoRoot -match '[\\/]plugins[\\/]cache[\\/]') { Write-Host "[warn] 你從 plugin 快取跑本腳本，statusLine 會指到快取路徑、plugin 更新即失效。請從 clone 的 repo 跑。" -ForegroundColor Yellow }
if ($SelfTest)  { Invoke-SelfTest }
if ($Uninstall) { Invoke-Uninstall; exit 0 }
if ($Migrate)   { Invoke-Migrate; exit 0 }
if ($PSCmdlet.ParameterSetName -eq 'Batch') {
  Invoke-Migrate 2>$null | Out-Null   # 非互動也要看得到舊副本；Invoke-Migrate 沒 -Yes 時只列不刪
  foreach ($i in $Items) { Add-Item $i $Scope }; exit 0
}
Write-Host "== bstack extras ==" -ForegroundColor Cyan
Write-Host "plugin 核心請用 /plugin install bstack@bstack；本選單只處理 plugin 帶不了的四項，每項都能跳過，跳過就什麼都不寫。反悔：-Uninstall"
Write-Host "  使用者層級 = $(Get-SettingsPath user)"
$projPath = Get-SettingsPath project; $isGit = $true; try { git rev-parse --show-toplevel 2>$null | Out-Null; $isGit = ($LASTEXITCODE -eq 0) } catch { $isGit = $false }
Write-Host "  目前專案   = $projPath$(if (-not $isGit) { '（目前目錄不是 git repo，[P] 仍會寫到這裡）' })"
$homeIsCwd = ((Resolve-Path (Split-Path (Get-ClaudeHome))).Path -eq (Get-Location).Path)
Invoke-Migrate
foreach ($i in $ItemDefs.Keys) {
  $d = $ItemDefs[$i]; $inst = Get-Installed $i 'user'; if (-not $inst) { $inst = Get-Installed $i 'project' }
  Write-Host ""; Write-Host "$i — $($d.Hint)（建議 [$($d.Suggest)]）"
  if ($inst) {
    $ans = Read-Host "  已裝（$($inst.scope)，$($inst.ts.Substring(0,10))）→ [R] 重裝 / [S] 略過（預設 S）"
    if ($ans.ToUpper() -eq 'R') { Add-Item $i $inst.scope -Force } else { Write-Host "  略過" }; continue
  }
  $ans = Read-Host "  [U] 使用者層級 / [P] 目前專案 / [S] 跳過（預設 S）"
  switch ($ans.ToUpper()) {
    'U' { Add-Item $i 'user' }
    'P' { if ($homeIsCwd) { Write-Host "  目前目錄就是使用者家目錄，[P] 會等於 [U]，已拒絕；請到專案目錄再跑" -ForegroundColor Yellow } else { Add-Item $i 'project' } }
    default { Write-Host "  跳過" }
  }
}
Write-Host ""
if ($script:Written.Count -eq 0) { Write-Host "沒有寫入任何檔案。plugin 請用 /plugin install bstack@bstack" -ForegroundColor Green }
else { Write-Host "本次寫入 $($script:Written.Count) 項：" -ForegroundColor Green; $script:Written | ForEach-Object { "  $($_.item) → $($_.file)" }; Write-Host "反悔：pwsh -File scripts/extras.ps1 -Uninstall" }
```

- [ ] **Step 3: 綠**

```bash
node scripts/plugin-contract.mjs | grep P5      # Expected: PASS
```
```pwsh
pwsh -NoProfile -File scripts/extras.ps1 -SelfTest; "exit=$LASTEXITCODE"
# Expected: S0 印 FAIL（隨即扣回）、其餘 a1-a4 b c1 c2 p i j k d1-d4 e1-e6 全 PASS、SELFTEST ALL PASS、exit=0
$h = (Get-FileHash ~/.claude/settings.json).Hash; pwsh -NoProfile -File scripts/extras.ps1 -Yes -Items env -Scope user -WhatIf; (Get-FileHash ~/.claude/settings.json).Hash -eq $h
# Expected: 只印 What if:、True
```

- [ ] **Step 4: 同 Step 3**
- [ ] **Step 5: commit** `git add scripts/extras.ps1 templates extras && git commit -m "feat: setup.ps1 改寫為 extras.ps1，四項偏好逐項選層級並可逆"`

---

### Task 7: docs 站、README、契約基線、references 重產

**parallel-group**: 4
**files**:
- modify: `docs/js/data.js:53-55`、`:189-190`、ambient 內 `CLAUDE.md` 字樣
- modify: `docs/js/app.js`（NODE_DOCS 加 `LoadDevwork`；`:51` 36/34 → 37/35、`:53` 27 → 28、`:54` 34 → 35、`:531` 29/27 → 30/28）
- modify: `docs/index.html:8`、`:44`、`:46`、`:48`、`:50`、`:57`、`:61`、`:85-91`、`:108-121`（**只改文字節點與 `<li>` 內文，不動 class / style / 屬性**）
- modify: `docs/tools/docs-site-contract.mjs`（C6 BASELINE_KEYS、C8a EXPECT 與字串）
- modify: `README.md`
- 產出: `docs/js/references-data.js`

- [ ] **Step 1: 紅**

```bash
node docs/tools/docs-site-contract.mjs | grep FAIL      # Expected: C8b（35 vs 34）、C18（devwork 無 NODE_DOCS）
node scripts/plugin-contract.mjs | grep -E "P4|P8"      # Expected: P4 hits 在 README / index.html；P8 27≠28
```

- [ ] **Step 2: 改**

`data.js` nodes：
```js
Start:        { phase: 'prelude', type: 'default', shape: 'stadium', label: 'user 輸入 /devwork + 要做的事\n不下指令 = 普通 Claude Code' },
LoadDevwork:  { phase: 'prelude', type: 'skill',   shape: 'rect',    label: '載入 skill：devwork\n唯一入口，讀 rules.md' },
ClaudeMd:     { phase: 'prelude', type: 'policy',  shape: 'rect',    label: 'rules.md 強制守則仲裁\n優先於任何 skill' },
DevWfSkill:   { phase: 'prelude', type: 'skill',   shape: 'rect',    label: '載入 skill：dev-workflow\n（由 devwork 載入，不自動觸發）' },
```
edges（取代 `:189-190`）：
```js
['Start',        'LoadDevwork',  '',                           'solid'],
['LoadDevwork',  'ClaudeMd',     '讀 rules.md',                'solid'],
['ClaudeMd',     'DevWfSkill',   '',                           'solid'],
```
ambient：`grep -n "CLAUDE.md" docs/js/data.js` 逐一改「rules.md」（例 `'CLAUDE.md 強制守則'` → `'rules.md 強制守則（/devwork 載入）'`）。

`app.js`：NODE_DOCS 於 `DevWfSkill` 前加 `LoadDevwork:{p:'skills/devwork', n:'devwork', k:'skill'},`；四處註解計數如 files 所列。

`docs-site-contract.mjs`：BASELINE_KEYS 加 `'LoadDevwork'`（註解「2026-09-04 plugin 化：入口 skill」）；`EXPECT = { nodes: 99, edges: 136, phases: 15, types: 8 }`；C8a 標題同步；「歷次基線」字串改 `84/103 → 88/111 → 90/115 → 100/138 → 98/135`。

`index.html`（文字節點）：
- `:8` meta `27 個 skill` → `28 個 skill`；`:44` kicker「零 marketplace 依賴」→「Claude Code plugin · 一個指令啟動」；`:46` 「27 個 skill …同步進 ~/.claude/…一份誰都繞不過的規則書」→「28 個 skill、6 個 agent、2 個 PreToolUse hook，裝成一個 plugin。打 `/devwork` 才啟動、不打就是普通的 Claude Code」；`:48` `<b>27</b>` → `28`；`:50` `<b>100</b>` → `99`；`:57` 攔截段加一句「兩支 hook 在啟用 plugin 的專案一律生效，不需要 /devwork」；`:61` 「每個請求進來先跑 Phase 0」→「每個 /devwork 請求進來先跑 Phase 0」。h1（`:45`）**不動**。
- `:85` 「裝進 ~/.claude/ 的全部」→「plugin 裡有什麼」；`:87` 「主流程 12 條、跨流程觸發式 9 條」→「入口 1 條、主流程 12 條、跨流程 9 條」，`nn` 27 → 28；`:91` 其他列 → 「extras.ps1（statusLine / permissions / env / MCP 逐項選層級、可逆）、statusline.sh、project-settings 範本」。
- `#install`：標題「裝起來要三步」；副標「需要 pwsh 7+（hook 必需）；statusLine 另需 bash 與 jq；MCP 另需 Node.js」；三個 `<li>`：
  1. **啟用 plugin（推薦專案層級）**：把 `templates/project-settings.json` 複製成你專案的 `.claude/settings.json`，開 session 後若沒自動裝再 `/plugin install bstack@bstack`（前面是 plugin、後面是 marketplace 名）。只想試試：`claude --plugin-dir <clone 路徑>`
  2. **個人偏好（可跳過）**：`pwsh -File scripts/extras.ps1`，四項各選裝到使用者層級、目前專案或跳過；不選就什麼都不寫
  3. **開新 session 輸入** `<pre class="cmd">/bstack:devwork 要做的事</pre>`（裸 `/devwork` 目前也可）

`README.md`：
- `## Skills（28）`；§Phase 主流程 表最上面加 devwork 列。
- §Hooks 改「隨 plugin 的 `hooks/hooks.json` 註冊；在啟用 plugin 的專案一律生效、不需要 `/devwork`；不想要：`/plugin disable bstack@bstack`；每次 Write / Edit 多兩個 pwsh 程序、延遲約數百毫秒屬正常」。
- §安裝 重寫：Prerequisites（pwsh 7+ 必需，缺了 hook 失效且每次 Write 報錯「<Task 3 Step 4(c) 抄來的文字>」；mac/Linux 裝法 `brew install powershell` / 官方 apt 指令）→ **A. 啟用 plugin** 三種方式依序：專案範本（推薦）/ 個人 `/plugin marketplace add fujiei22/bstack` + `/plugin install bstack@bstack`（說明 Claude Code 會在 `~/.claude/plugins/` 放快取、settings 記 enabledPlugins，是它的登記機制、`/plugin uninstall` 可反悔，不會覆蓋你任何設定；**hooks 會在你所有專案生效**）/ 試用 `--plugin-dir` → **B. 個人偏好** extras.ps1 四項、從 clone 跑、manifest 住 `~/.claude/bstack-extras.json`、clone 搬家後重跑選 statusLine [R] → **C. 開新 session** `/bstack:devwork`（裸 `/devwork` 目前也可；出現 Unknown command 或載到別的東西就改打前綴版）。
- 新增 `## 確認 plugin 有載入`：(1) 輸入 `/devwork` 應看到 `[bstack devwork · plugin]`；(2) 沒有 → `/plugin` 看 bstack 是否 enabled；(3) 仍沒有 → `claude --plugin-dir <clone>` 對照，能載就是登記問題、不能載就是 manifest 問題；(4) 看到第二行 `[已載入 dev-workflow]` → 舊副本遮蔽，跑 `-Migrate`。
- 新增 `## 什麼時候生效`：三列表（hooks = 啟用 plugin 的專案全部 session；rules.md 守則與九階段 = 只在 `/devwork` 之後；extras 四項 = 你選的層級）。
- 新增 `## 從舊版（setup.ps1）遷移`：`pwsh -File scripts/extras.ps1 -Migrate`，說明 user 級同名 skill 遮蔽 plugin skill、舊 `~/.claude/CLAUDE.md` 會讓自動攔截復活（相同就改名備份、改過的印行號請自行拿掉）、之後重開 session。
- 新增 `## 完全移除`：三列表 `/plugin uninstall bstack@bstack`（拆 plugin 核心）/ `extras.ps1 -Uninstall`（拆四項偏好）/ `extras.ps1 -Migrate`（拆舊版副本），各寫拆什麼、不碰什麼。
- 新增 `## 開發本 repo`：`claude --plugin-dir .`；三支驗證 `node scripts/plugin-contract.mjs`、`node docs/tools/docs-site-contract.mjs`、`pwsh -File scripts/build-references.ps1 -Check`；改 skill 後重產；repo 搬家要改 `templates/project-settings.json` 的 `repo`。

重產：`pwsh -NoProfile -File scripts/build-references.ps1`

- [ ] **Step 3: 綠**

```bash
node docs/tools/docs-site-contract.mjs | tail -1        # ALL PASS（C8a 99/136、C8b 35、C18 28 skill）
node scripts/plugin-contract.mjs | tail -1              # ALL PASS
grep -nE "setup\.ps1|marketplace 依賴|繞不過|~/\.claude/(skills|hooks|agents|CLAUDE)" docs/index.html README.md | grep -vE "舊版|遷移|-Migrate|不寫入|不碰|plugins/"
# Expected: 無輸出
```
```pwsh
pwsh -NoProfile -File scripts/build-references.ps1 -Check   # PASS
```

- [ ] **Step 4: Playwright**：本機 http server 開 index.html / flow.html，console 零 error / warning；flow prelude 四節點文字完整（含 Start 的兩行）、devwork 節點點得開文件。
- [ ] **Step 5: commit** `git add docs README.md && git commit -m "docs: 安裝改為 plugin 三步，流程圖加 devwork 入口節點"`

---

## §Self-review（v2）

1. **spec coverage**：§4a → Task 2 / 3 / 6；§4b → Task 4；§4c → Task 5a / 5b；§4d → Task 7；§4e → Task 3 + 5b；§4g → Task 6；§5 P1–P8 → Task 1、SelfTest → Task 6、實測 → 各 Step 4；§6 → Task 6 `-Migrate`（含 CLAUDE.md 簽名比對）。spec §5.4 `/plugin marketplace add` 與「clone 者是否自動裝」→ verify-done post-merge 清單。
2. **review 採納對照**：CC1 → Task 4 命名空間 + 台詞、Task 6 CLAUDE.md 簽名、Batch 路徑印舊副本；CC2 → Task 3 訊息、Task 7 專案層級主推 + 何時生效矩陣；CC3 → Task 6 mcp 只 playwright + `& claude @args`；CC4 → Task 1 regex + selftest、Task 6 `$script:fails` + S0 + `-join`；CC5 → `Get-AddedKeys` + SelfTest 重疊 seed；CC6 → `$tmp/proj`。Major / Minor 逐條見 `review.md`「採納」。
3. **placeholder**：無 TBD；Task 7 README 的 troubleshooting 錯誤文字明寫「Task 3 Step 4(c) 抄來」，execute 時填實測結果。
4. **型別一致**：`LoadDevwork` 三處同名；`ItemDefs` 四 key == `-Items` ValidateSet；manifest `entries[].{item,scope,file,keys,status,ts}` 在 Save / Get-Installed / Uninstall 一致；`Get-AddedKeys` 的 `permissions.allow[值]` 與 `Remove-KeyPath` 的 regex 對應。
5. **並行性**：group 1 = Task 1 + 2（互斥檔）；group 2 = Task 3 / 4（實測依賴 Task 2 已落）；group 3 = 5a / 5b / 6（檔案集合互斥、commit 明列檔案）；group 4 = Task 7。
6. **scope**：SessionStart 注入、session 標記 gating、per-project 複製、hook 換語言、attribution 區塊皆不做（spec §4f）。

## §hand-off state

```yaml
state:
  plan_path: docs/work/refactor/plugin-install/plan.md
  parallel_groups: [1, 2, 3, 4]
  task_count: 8
  review_summary_path: docs/work/refactor/plugin-install/review.md
  current_phase: review-plan-done
```
