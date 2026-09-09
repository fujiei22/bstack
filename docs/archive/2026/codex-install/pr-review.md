# PR #80: feat: 加 Codex CLI 安裝支援（同一套 skill 雙 host）

> URL: https://github.com/fujiei22/bstack/pull/80
> Branch: feat/codex-install → main
> Track: Dev | Tier: T3
> 建立: 2026-09-09
> 對應 spec: docs/work/feat/codex-install/spec.md
> 對應 plan: docs/work/feat/codex-install/plan.md

## 整體脈絡

bstack 原本只能當 Claude Code plugin 安裝。本 PR 讓**同一個 repo、同一份 `skills/`** 也能被 OpenAI 的 Codex CLI 當 plugin 裝進去、啟動流程、被同一支 hook 保護，而 Claude Code 側行為零改變（契約 P1-P12 全綠、`hooks/hooks.json` 最終沒動）。做法不是 fork 一份 Codex 版，而是三層抽象：(1) skill 內文裡的 `AskUserQuestion` / `TaskCreate` / `Agent` 等字樣**降格成抽象動詞**，由新檔 `skills/devwork/hosts.md` 對照到各 host 的實際工具；(2) `hooks/guard.mjs` 學會 Codex 的 `apply_patch` payload（一個 patch 多檔、相對路徑、不認 exit 2）；(3) Codex 不能隨 plugin 帶 agents，所以用產生器從 `agents/*.md` 推導出 `codex/agents/*.toml`、安裝腳本複製到 `~/.codex/agents/`。

41 檔、+2772 / −178。核心程式碼在 4 支：`hooks/guard.mjs`（重寫判定模型）、`scripts/gen-codex-agents.mjs`（新）、`scripts/install-codex.ps1`（新）、`scripts/plugin-contract.mjs`（P2d 加 16 案、P2e 加 4 個真 spawn、P13-P17 新增）。其餘是 manifest、hosts.md、19 檔 skill / agent 字面改寫、6 個產出 TOML、README、施工文件。

follow-up 有：`docs/index.html` DOCS 索引加 hosts.md、契約 TOKEN14 改機械抽取、guard file-type 段 canonical 比對、Codex 互動 session 的 `/hooks` 信任流程只能人做。

## 檔案改動清單

| 檔 | 類型 | 行 +/- | 改動性質 |
|---|---|---|---|
| `hooks/guard.mjs` | edit | +179/−71 | 單目標 → 多目標判定；apply_patch 解析；Codex 走 JSON deny；git 合併一次 spawn |
| `scripts/gen-codex-agents.mjs` | new | +102/−0 | agents/*.md → codex/agents/*.toml 產生器（推導式、--check、掃孤兒） |
| `scripts/install-codex.ps1` | new | +399/−0 | Codex 一站式安裝 / -Migrate / -Uninstall，manifest 記錄 |
| `scripts/plugin-contract.mjs` | edit | +186/−9 | P2d 31-46 案、P2e e7-e10、P13-P17 新增 |
| `.codex-plugin/plugin.json` | new | +19/−0 | Codex 原生 plugin manifest |
| `.agents/plugins/marketplace.json` | new | +12/−0 | Codex 原生 marketplace（policy / category 必填） |
| `.claude-plugin/plugin.json` | edit | +2/−2 | 版本 1.6.0、description host 中性 |
| `.claude-plugin/marketplace.json` | edit | +3/−3 | 同上 |
| `.gitattributes` | new | +3/−0 | `codex/agents/*.toml` 固定 LF |
| `skills/devwork/hosts.md` | new | +49/−0 | 八節 host 對照表；P14 白名單與 P16 的契約鍵來源 |
| `skills/devwork/rules.md` | edit | +16/−5 | §決策點選單 加濃縮對照表；§Branch safety 雙 host；Tier 表 review 欄加 Codex 註；§協作模式 加「Codex 無 Agent Teams」 |
| `skills/devwork/SKILL.md` | edit | +4/−4 | 使用契約第 1 步加讀 hosts.md；`$bstack:` 前綴 |
| `skills/request-review/SKILL.md` | edit | +27/−9 | T2 / T3 雙 host 派法；新增 §Codex reviewer prompt |
| `skills/dispatch-parallel/SKILL.md` | edit | +24/−23 | Agent Teams 標「Claude Code 限定」；開關偵測加第 0 步；SendMessage 同行雙 host |
| `skills/pr-explain/SKILL.md` | edit | +5/−1 | 新增 §0 派發方式（`context: fork` 保留） |
| `skills/brainstorm/SKILL.md` | edit | +2/−2 | 0a memory 路徑改依 hosts.md；`.agents/skills` 雙寫 |
| `skills/review-plan/SKILL.md` | edit | +4/−4 | SendMessage 同行雙 host |
| `skills/dev-workflow/SKILL.md` | edit | +4/−4 | Phase 3 / 5 加 Codex 註；`@import` 字樣改「CLAUDE.md / AGENTS.md 引用」 |
| `skills/retro/SKILL.md` | edit | +4/−4 | TaskList 雙 host；memory 路徑依 hosts.md |
| `skills/{context-snapshot,design-language,execute-plan,finish-branch,lock-files,write-skill}/SKILL.md` | edit | 各 1-3 行 | 字面掃描：`~/.claude/…` / `.claude/skills` / `NotebookEdit` 改雙 host 寫法 |
| `agents/{hypothesis-tester,security-auditor}.md` | edit | 各 +1/−1 | 禁用工具清單加 Codex `apply_patch`、NotebookEdit 標 Claude Code |
| `codex/agents/*.toml`（6 檔） | new | +738/−0 | 產生器產物，入版控 |
| `scripts/build-references.ps1` | edit | +8/−1 | 內嵌 hosts.md |
| `docs/tools/docs-site-contract.mjs` | edit | +5/−3 | 規則層文件清單收成 `EXTRA_REFS` |
| `docs/js/references-data.js` | 重產 | +18/−17 | 內嵌 36 份 |
| `README.md` | edit | +97/−5 | 雙 host 化；新增「Codex」節 |
| `docs/work/feat/codex-install/{spec,plan,review,code-review}.md` | new | +851/−0 | 施工文件 |

---

## `hooks/guard.mjs`

### 改動意圖

對應 spec Scope 第 1 條、plan Task 1，加上 receive-review 的三條 Critical（雙訊號判 Codex、相對路徑以 `payload.cwd` 解析、exit 2 在 Codex 不算 block）。原本的判定模型是「一次一個絕對路徑」（Claude Code 的 `file_path`），Codex 的寫檔工具 `apply_patch` 把整段 patch 文字放在 `tool_input.command`，一個 patch 可含多個檔、路徑相對 session cwd、沒有 `CLAUDE_PROJECT_DIR`。這支檔要在**不改 Claude Code 行為**的前提下吃下這種 payload。

實測發現的兩個硬事實決定了設計：Codex（Windows）**不把 exit 2 當 block**，只認 stdout JSON `permissionDecision: "deny"` + exit 0；Codex 的相對路徑基準是 session cwd（payload 帶 `cwd`），不是 git toplevel。

### 改動詳解

#### 區塊 1：`applyPatchPaths(cmd)`（新純函式）

```js
const m = line.match(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/);
```

- 只認行首 `*** Add File:` / `Update File:` / `Delete File:` / `Move to:` 四種標頭；patch 內容行一律有 `+` / `-` / 空白前綴，不會誤觸。
- 邊界：`split(/\r?\n/)` 吃 CRLF；截斷的 patch（沒有 `*** End Patch`）也回已看到的路徑——fail-closed，看得到的都判（契約 P2d 39、40）。
- `Move to:` 的目標也算一個寫入目標（P2d 36：`Move to: .ssh/id_rsa` → BLOCK）。

#### 區塊 2：`targetOf` → `targetsOf`（多目標）

```js
- if (t === 'edit' || t === 'write') return { isWrite: true, target: str(i.file_path) };
+ if (t === 'edit' || t === 'write') return { isWrite: true, targets: [{ path: str(i.file_path), relTo: null }] };
+ if (t === 'apply_patch') {
+   const ps = applyPatchPaths(i.command);
+   return { isWrite: true, targets: ps.length ? ps.map((p) => ({ path: p, relTo: 'cwd' })) : [{ path: null, relTo: null }] };
+ }
```

- 回傳形狀從 `{ isWrite, target }` 改成 `{ isWrite, targets: [{ path, relTo }] }`；`relTo: 'cwd'` 標記「這個路徑要先以 ctx.cwd 解析」，Claude Code 的絕對路徑 `relTo: null` 照原樣。
- `apply_patch` 沒帶 command / 解析不到路徑 → 當「沒帶路徑」（`[{ path: null }]`），走 Write 缺 `file_path` 的老路：branch 段照查、file-type 段沒得判（P2d 37）。
- 保留 `targetOf()` 相容殼（取第一個路徑）。code-review 建議刪（無呼叫端），但實際仍在檔內——非本文件判斷範圍，只記錄。

#### 區塊 3：`isCodexPayload(payload)`（新）

```js
return typeof payload.turn_id === 'string' || String(payload.tool_name || '').toLowerCase() === 'apply_patch';
```

- 兩個訊號取其一。為什麼要兩個：Codex 不認 exit 2，判錯成 Claude Code 就是**靜默 fail-open**（檔案照寫、沒任何提示）；單靠 `turn_id` 一個欄位，欄位改名或子 agent 的 payload 形狀不同都會中（code-review Critical B/A）。
- failure mode 仍存在：兩個訊號都缺（例如 Codex 未來改 tool 名又拿掉 turn_id）→ 退回 exit 2 → Codex 不擋。`main()` 末尾對「判成非 Codex 卻帶 `cwd` 欄位」印一行稽核提示（security-audit M1），判定本身不變。

#### 區塊 4：`decide()` 的解析 + 去重 + branch 段

```js
const base = ctx.cwd || ctx.repoDir;
if (t.relTo === 'cwd' && !path.isAbsolute(p)) { p = path.resolve(base, p); anyRel = true; }
...
let inScope = anyNull || anyRel || resolved.length === 0;
```

- 相對路徑以 `ctx.cwd`（Codex payload 的 `cwd`）解析；canonical 後以 key 去重，同一檔在一個 patch 出現兩次（`Update File` + `Move to` 同檔）只判一次、token 只消耗一次（P2d 44）。
- **相對路徑一律視為 repo 內**（`anyRel` → `inScope = true`）：`../x.txt` 跳出 repo 也照查 branch（P2d 46）。這是刻意的 fail-closed，rules.md §Branch safety 有註明「repo 外放行」豁免只對絕對路徑成立。
- 絕對路徑的 scope 判定從「單一 target 在 repo 內」改成「任一 target 在 repo 內」（`resolved.some(...)`）。
- `getBranch()` 只呼叫一次、訊息只印一次（apSE 斷言 ap31）。

#### 區塊 5：file-type 段兩趟判定

```js
// 第一趟：只分類、只 peek；過期的當場刪掉並記 log
const peek = ctx.peekToken(tokenPath);
if (peek.existed && !peek.valid) ctx.consumeToken(tokenPath, p);
warns.push({ tag, path: p, tokenPath, valid: !!peek.valid });
...
if (exit === 2) { lines.push(DISABLE_HINT); return { exit: 2, lines }; }   // 整包擋、不消耗
// 第二趟：全部過關才逐檔消耗
for (const w of warns) ctx.consumeToken(w.tokenPath, w.path);
```

- 舊版是「命中 WARN 就 consume」：一個 patch 裡 Dockerfile 有 token、docker-compose.yml 沒有 → 舊邏輯會先燒掉 Dockerfile 的 token 再因第二檔擋下，user 確認過的 token 白白消耗。新版第一趟只 `peekToken`（不刪），BLOCK / branch / 任一 WARN 無 token → 整包擋、**不消耗任何有效 token**（P2d 41、42 + ap41 / ap42 斷言）。
- 過期 token 例外：第一趟就刪並記 `consumed.log valid=False`（review Major：稽核軌跡不能斷；ap47）。
- 訊息：多檔 WARN 時逐檔列 `--token` 行、共用步驟（「處置（依序執行）」）只印一次；`DISABLE_HINT` 移到最末只印一次（e9dup 守）。
- ctx 介面變動：新增 `peekToken(tokenPath)` 必填、`consumeToken(tokenPath, target)` 第二參數用來寫 log（舊版用閉包的 `targetForLog`，多檔下會記錯檔）。
- `WARN_LIST_MAX` 上限拿掉（review 指出超過上限的檔被截斷又只 peek，TTL 內永遠收斂不了）。

#### 區塊 6：訊息 host 中性

```js
const DISABLE_HINT = '…Claude Code 打 /plugin disable bstack@bstack；Codex 打 /plugins 選 bstack 按 Space 停用（Codex 另需 /hooks 信任本 hook 才會跑）';
const ASK_HINT = 'Claude Code 用 AskUserQuestion；Codex 用 request_user_input，工具不在清單就文字提問、選項編號';
```

- hook 在沒載 `/devwork` 時也會跑，所以訊息**自帶兩個 host 的答案**、不引用任何 skill 檔（P2e e7 斷言 stderr 同時含 `AskUserQuestion` 與 `request_user_input`）。

#### 區塊 7：CLI 段 — `gitOut()`、repoDir fallback、Codex deny 協定

```js
let repoDir = process.env.CLAUDE_PROJECT_DIR || null;
if (!repoDir) {
  const out = gitOut(['rev-parse', '--show-toplevel', '--abbrev-ref', 'HEAD'], cwd);
  const [top, br] = out ? out.split(/\r?\n/) : [null, null];
  repoDir = top || cwd; branchCache = br || null;
}
...
if (exit === 2 && isCodexPayload(payload)) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: lines.join('\n') } }) + '\n');
  return 0;
}
```

- `gitOut()` 抽出原本 `getBranch()` 內的 ENOENT → shell 重試邏輯（Windows 只有 `git.cmd` 包裝時 libuv 找不到），toplevel 與 branch 合成**一次** git spawn（review eff：省約 97 ms）。Claude Code 路徑（有 `CLAUDE_PROJECT_DIR`）仍 lazy 一次 `getBranch()`，零改變。
- `cwd` 優先取 payload 的 `cwd` 欄位（Codex session cwd），沒有才用 hook 進程 cwd。
- 擋的協定分流：Codex → stdout JSON deny + exit 0；Claude Code → 維持官方 exit 2 + stderr。**stderr 兩邊都印**（Codex 實測 stderr 訊息完整送到模型）。
- failure mode：`git rev-parse` 失敗（非 git repo）→ `repoDir = cwd`、branch null → 放行；跟舊版「hook 不因自身錯誤擋人」一致。

### 關聯檔案

- `scripts/plugin-contract.mjs` P2d（第 104-134 行新增 31-46 案 + apSE 副作用斷言）、P2e（e7 / e8 / e9 / e10 真 spawn）覆蓋本檔全部新分支。
- `hooks/hooks.json` **最終沒動**：spec 原計畫拆兩組 matcher，Task 10 實測 Codex 把 Write / Edit 當 apply_patch 別名、單一組 `Write|Edit|NotebookEdit` 照攔，退回原樣（守零改變）。P13 改守「三個工具名都被某一組 matcher 整字匹配」。
- `skills/devwork/rules.md` §Branch safety 補寫「Codex 的 apply_patch 路徑相對 session cwd，hook 一律視為 repo 內」。
- `README.md` hook 段落新增 Codex 段（exit 2 不算 block 的實測）。README 第 23 行寫「看 payload 有沒有 `turn_id` 分流」，實作是 `turn_id` **或** `tool_name === apply_patch` 雙訊號——文件比實作少講一個訊號（未明示是否刻意簡化）。

---

## `scripts/gen-codex-agents.mjs`

### 改動意圖

spec Scope 第 5 條、plan Task 4（review 後改成「推導式」：不另維護一份清單，全部從 `agents/*.md` frontmatter 推）。Codex plugin 帶不了 agents，custom agent 要放 `~/.codex/agents/<name>.toml`；本檔把 6 個 agent md 轉成 TOML，產物入版控、契約 P15 守同步。

### 改動詳解

#### 區塊 1：推導規則（`render()`）

```js
const write = tl.some((t) => /^(Write|Edit|NotebookEdit)$/.test(t));
const servers = [...new Set(tl.map((t) => (t.match(/^mcp__(.+?)__/) || [])[1]).filter(Boolean))];
```

- `sandbox_mode`：tools 含 Write / Edit / NotebookEdit → `workspace-write`，否則 `read-only`。實際結果：pr-explainer、frontend-e2e-runner 是 workspace-write，其餘四個 read-only。
- MCP：`mcp__<server>__` 前綴取 server 名（`.+?` 懶惰比對到下一個 `__`，所以 server 名可含底線——review 指出 `[^_]+` 對 `mcp__claude_ai_Microsoft_365__` 會靜默失敗）；對照 `MCP_TEMPLATES`，缺範本 throw。範本整段註解輸出，使用者自己取消註解填 command。
- model：`MODEL` 表 sonnet / opus / haiku → `gpt-5.6-terra` / `gpt-5.6-sol` / `gpt-5.6-luna`；未知 model throw。**model 名漂移是已知風險**（spec 影響表標中）。
- `developer_instructions` 用 TOML literal string `'''…'''`（不處理跳脫，Windows 路徑 / regex 安全）；本文含 `'''` 就 throw。
- 檔頭帶 plugin 版本戳（讀 `.codex-plugin/plugin.json`）：版本升了 `--check` 就紅，逼人重產，安裝腳本才會複製新版。

#### 區塊 2：frontmatter 解析的 fail-closed

- `description()`：支援 `| |- > >-` 區塊寫法，多行合併成一行；區塊指示符後面沒內容 → 回空字串（不能退到單行分支抓到字面 `|`）。
- `tools()`：認 JSON 陣列 / 逗號 / YAML 清單三種；有 `tools:` key 卻解析不到任何名字 → throw（靜默變 read-only 又沒 MCP 範本比直接失敗糟）。

#### 區塊 3：CLI — `--check` 與孤兒掃描

- 無參數重產；`--check` 逐檔比對（`strip()` 正規化 BOM / CRLF 後比）。
- 孤兒：`codex/agents/` 裡沒有對應 `agents/<name>.md` 的 TOML 一律報 `ORPHAN`（產生模式也只報不刪——刪掉的 agent 不該被安裝腳本繼續裝進使用者目錄）。
- `isMainModule()` 用 `realpathSync.native` 正規化比對，免掉大小寫 / 8.3 短檔名差異（被契約 import 時不跑 CLI）。

### 關聯檔案

- 輸入 `agents/*.md`（6 檔）；輸出 `codex/agents/*.toml`（6 檔，見下節）。
- `scripts/plugin-contract.mjs` P15：真 spawn `--check` + import `render()` 對 fixture 斷言 read-only / description 單行 / literal string / 無 `\r`。
- `scripts/install-codex.ps1` 第 4 步複製產物；找不到 `codex/agents/` 時提示先跑產生器。
- `.gitattributes` 讓產物在 `core.autocrlf=true` 機器 checkout 後仍是 LF（否則 P15 的 `!/\r/` 假紅）。
- README「開發本 repo」段加 `node scripts/gen-codex-agents.mjs --check`；新增 agent 的落地步驟加「重跑產生器、一起 commit TOML」。

---

## `codex/agents/*.toml`（6 檔，產生器產物）

### 改動意圖

同上，plan Task 4 產物入版控。

### 改動詳解

每檔結構固定：版本戳註解 → `name` / `description`（單行）/ `model = "gpt-5.6-terra"`（六個都是 sonnet 對照）/ `model_reasoning_effort = "high"` → sandbox 註解 → `sandbox_mode` → `developer_instructions = '''<agent md 本文>'''` → MCP 範本註解（db-reviewer 帶 mysql、frontend-e2e-runner 帶 playwright）。

- sandbox 註解（security-audit M3）：「父 session 有 runtime 覆寫時子 agent 沿用父的 sandbox，這行不生效」——Task 10 第 6 項實測 `codex exec` 下 security-auditor 拿到 workspace-write 真的改了檔。**唯讀 reviewer 的唯讀性在 Codex 上靠自律**，README §已知限制 有寫。
- `developer_instructions` 是 agent md 的**本文原樣**，含 `NotebookEdit`（Claude Code 才有）等字樣；Task 6 已把 hypothesis-tester / security-auditor 的禁用清單改成同行雙 host，其他四個沒有這類字樣。

### 關聯檔案

- 由 `scripts/gen-codex-agents.mjs` 產；`scripts/install-codex.ps1` 複製到 `$CODEX_HOME/agents/`；`skills/devwork/hosts.md` §派 subagent 規定 `spawn_agent` 的 agent 名取自 TOML `name`。

---

## `scripts/install-codex.ps1`

### 改動意圖

spec Scope 第 6 條、plan Task 7。Codex 安裝有五件事要串（marketplace add、plugin add、agents 複製、config.toml 開 `tools.update_plan`、清舊副本），且 Windows 上 `plugin add` 間歇 `os error 5`。腳本把每步寫進 manifest（`$CODEX_HOME/bstack-codex.json`），`-Uninstall` 只拆自己加的。receive-review 的 Critical（定界註解拔法會刪掉使用者的表）在這裡改掉。

### 改動詳解

#### 區塊 1：分流與前置（第 250-270 行）

- `-Uninstall` / `-Migrate` 各自跑完就 `exit 0`，不進安裝主流程。
- 前置檢查 codex / node / git 三項，缺一 `exit 1` 並印安裝指令。`Find-Codex` 先看 PATH，找不到探 `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe`（官方安裝腳本只對新 shell 更新 PATH，剛裝完同視窗跑會找不到）。
- `Run-Codex` 一定接管 stdout（不接的話 stdout 混進回傳值、`-ne 0` 永遠為真——`install.ps1` 踩過），並留一份 `$script:LastCodexOutput` 給呼叫端判錯誤類型。

#### 區塊 2：`Invoke-Migrate`（第 141-198 行）

- 判定看內容不看檔名（與 `extras.ps1` 的 `Test-BstackSkillDir` 同簽名）：目錄名在本 repo `skills/` 清單內（動態讀）、frontmatter `name:` 等於目錄名、內文含「（繁中）」——同名但簽名不符視為使用者自己的 skill、不動。
- 搬進 `~/.agents/bstack-migrate-bak-<stamp>/`、**不刪**（簽名是推定、可能誤判）。
- `~/.codex/AGENTS.md` 含「dev-workflow」或「一律進」只警告（那是使用者的全域指示檔）。
- Task 10 第 1 項主 agent 決定 `-SkipMigrate`：搬掉 user 既有 `dev-workflow` 會改變其 Codex 行為，留 user 決定。

#### 區塊 3：marketplace 與 plugin add 重試（第 276-313 行）

```powershell
$transient = $script:LastCodexOutput -match 'os error 5|存取被拒|Access is denied|failed to activate plugin cache entry'
if (-not $transient) { break }
```

- 同名 marketplace 已存在就略過 add，但比對既有 root 與這次 `-Source`：github 要的卻指向本機 repo、或 local 要的卻不是這個 repo → 印警告與換來源的指令（review Major：本機就是這狀況）。
- 供應鏈提醒：marketplace 來源沒版本 pin、hook 是每次寫檔都跑的程式碼。
- `plugin add` 最多 3 次、**只對 rename 競態的錯誤字樣重試**（登入失敗、id 打錯等確定性錯誤直接停）。Task 10 實測前兩次失敗第三次成功。

#### 區塊 4：manifest 與 agents 複製（第 315-356 行）

- 重裝時聯集既有 `agents[]`；手改過的 manifest 缺欄位先 `Add-Member` 補齊（EAP Stop 下對不存在屬性賦值會 throw）。
- 目的地已存在且不是本腳本上次放的 → 互動問 `[o]/[s]/[a]`、`-Yes` 一律跳過；覆蓋前 `Backup-File`（之後 `-Uninstall` 會把它當自己的刪掉，備份是唯一救回路）。

#### 區塊 5：config.toml（第 358-388 行）

- 三種既有寫法都認為「已開」：`[tools.update_plan]` 表內 `enabled = true`、`[tools]` 表內 `update_plan.enabled = true`、inline table。
- `hasOtherDef` 含頂層 `tools = { … }` inline table：TOML 禁止再用 `[tools.update_plan]` 擴充 inline table，append 會讓整份 config 讀不了 → 不 append、請使用者手改。
- 否則備份後 append `[tools.update_plan]\nenabled = true`，**不再寫定界註解**。

#### 區塊 6：`Invoke-Uninstall`（第 200-248 行）

```powershell
$tablePattern = '(?ms)^[ \t]*\[tools\.update_plan\][ \t]*\r?\n(?<body>.*?)(?=^[ \t]*\[|\z)'
if ($effective.Count -eq 1 -and $effective[0] -match '^enabled\s*=\s*true$') { … 拔 }
```

- 舊設計是 begin / end 註解定界、拔中間全部。實測 Codex 重寫 config.toml 時會把 `[tui]` 等別的表排進兩個註解之間，定界拔法會連使用者的表一起刪（code-review Critical C）。新法：只拔「`[tools.update_plan]` 表且表內有效行恰為 `enabled = true`」；使用者後來在表裡加了別的 key 就不動、印警告。舊版留下的兩行定界註解只拔註解行本身。
- `agents[]` 只准純檔名 `^[\w.\-]+\.toml$`（security-audit M2：manifest 是使用者可寫的檔，`..\` 會讓 `Join-Path` 刪到別處）。
- marketplace 刻意不拆（使用者可能還有別的東西靠它），印指令讓使用者自己拆。

### 關聯檔案

- `scripts/plugin-contract.mjs` P17：假 `CODEX_HOME` 跑 `-WhatIf -Yes -SkipMigrate` 與 `-Uninstall -WhatIf`，斷言六步訊息都在、假目錄沒被寫、`-Uninstall` 提到 manifest。
- `codex/agents/*.toml` 是第 4 步的來源；`skills/devwork/hosts.md` §任務追蹤 說明 `update_plan` 需要第 5 步寫的設定。
- README「Codex」節與「解除安裝」表引用本腳本三種用法。
- `scripts/extras.ps1`：`-Migrate` 簽名對齊它的 `Test-BstackSkillDir`（本 PR 沒改 extras.ps1）。

---

## `scripts/plugin-contract.mjs`

### 改動意圖

plan Task 9 + receive-review 的 P17。守三件事：guard.mjs 的新分支（P2d / P2e）、Codex 相關檔案結構（P13 / P15 / P16 / P17）、skill 文字不再出現 Claude 專屬字面（P14）。

### 改動詳解

#### 區塊 1：P2d 加 16 案 + 副作用斷言

- fixture helper：`AP(files, op)` 組 apply_patch payload；`ctx2()` 記錄 `consumed` 呼叫、`tokens` 表控制哪些 token 有效；`tokOf(rel)` 用真 `tokenPathFor` 算路徑、不寫死 hash。
- 31-44 覆蓋：相對路徑 protected 擋、Dockerfile / lock / CI WARN、credentials.json BLOCK（對比 fixture 9 的裸 Write 仍放）、Move to、無 command、`.env.example` 放、截斷、CRLF、BLOCK+WARN 混合、兩 WARN 一 token、兩 token 全過、同檔去重。
- 45-46：`cwd` 給 `repo/.github`、patch 寫 `workflows/ci.yml` → 解析成 `.github/workflows/ci.yml` → WARN（用 toplevel 解析會 fail-open）；`../x.txt` 仍查 branch。
- apSE：每案新建 ctx（review：同 ctx 重跑會累積 `consumed`）；ap31 branch 訊息只印一次、ap41 擋下不消耗、ap42 只列無效那檔一行 `--token`、ap43 全過逐檔消耗且 target 各對、ap44 去重後一次、ap47 過期 token 第一趟消耗。

#### 區塊 2：P2e 真 spawn e7-e10

- e7：無 `CLAUDE_PROJECT_DIR`、cwd 在 repo 子目錄、apply_patch 沒帶 `turn_id` → 仍判 Codex（第二訊號）、exit 0 + JSON deny、stderr 含兩 host 工具名。
- e8：多檔 WARN 兩行 `--token`、「處置」一次。
- e9：帶 `turn_id` → JSON deny，`permissionDecisionReason` 含 branch 訊息、停用提示只印一次。
- e10：`payload.cwd` 給 `.github` → deny reason 含「GitHub Actions CI」。

#### 區塊 3：P13 manifest / P15 產生器 / P16 hosts.md 接線 / P17 安裝腳本

- P13：`.codex-plugin/plugin.json` 的 `skills === './skills/'`、`hooks` 欄沒填或存在；`.agents/plugins/marketplace.json` 的 `source.path === './'`、`policy.installation` ∈ AVAILABLE / INSTALLED_BY_DEFAULT、`policy.authentication` 與 `category` 非空；hooks.json 三個工具名都被某組 matcher **整字**匹配（`^(?:${matcher})$`）；版本三處一致；四處 description 都含 `Codex`、不含「Claude Code 九階段 / 開發流程」。
- P15：見產生器節。
- P16：hosts.md 八節標題行首錨定、四欄節表頭固定（P14 白名單吃第一欄）、第一行護欄含「抽象動詞…不是工具名」、`request-review` 有 `## §Codex reviewer prompt` 且 hosts.md 指向它、devwork 讀 hosts.md 且含 `$bstack:devwork` 且無 `@import`、rules.md 含 hosts.md 與 `request_user_input`、Tier 表 T2 / T3 保留 `code-review medium|high` 字面並加 Codex、§Branch safety 含兩 host 停用句、rules.md 含「Codex 無 Agent Teams」、build-references 含 hosts.md。
- P17：見安裝腳本節。pwsh 不在 PATH：win32 紅、其他平台 skipped。

#### 區塊 4：P14 字面掃描（context-aware）

```js
const BAN14 = [[/@skills\/devwork\/rules\.md/, …, null], [/~\/\.claude\/projects/, …, null],
  [/\bSendMessage\b/, …, /wait_agent/], [/\/bstack:/, …, /\$bstack:/], [/CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS/, …, /Claude Code 限定/]];
```

- 掃 `skills/*/SKILL.md` + `agents/*.md`（**刻意不含 rules.md / hosts.md**：對照表本體就是要並列兩 host 工具名，由 P16 明列守）。
- 三種規則：(a) 禁字，第三欄是「同行有這個字樣就放行」（雙 host 並列寫法）；(b) `.claude/skills` 出現的行必須同時含 `.agents/skills`；(c) 反向白名單——`TOKEN14` 手維護的工具名清單命中時，token 必須在 hosts.md 各節第一欄的反引號詞裡（`NotebookEdit` 特例：同行要有「Claude Code」）。
- `context: fork` **不禁**（實測 Codex 對它無反應；拔掉反而是 Claude Code 側行為改變）。
- 已知限制（review 標明、本輪不改）：`TOKEN14` 是手維護清單，沒列的新工具名不設防；`\bAgent\b` 會命中散文但被白名單放行，實質不設防。

### 關聯檔案

- 被守的檔：`hooks/guard.mjs`、`.codex-plugin/*`、`.agents/plugins/*`、`.claude-plugin/*`、`hooks/hooks.json`、`skills/devwork/{hosts,rules}.md`、`skills/devwork/SKILL.md`、`skills/request-review/SKILL.md`、`scripts/gen-codex-agents.mjs`、`scripts/install-codex.ps1`、`scripts/build-references.ps1`、全部 skill / agent md。
- 契約檔頭的段落順序註解同步更新（P13-P17 附在 P12 之後）。

---

## `.codex-plugin/plugin.json`、`.agents/plugins/marketplace.json`、`.claude-plugin/*`

### 改動意圖

spec Scope 第 2 條、plan Task 0 / Task 3。Codex 原生 manifest 與 marketplace；Claude Code 的兩份只升版本、description 改 host 中性。

### 改動詳解

- `.codex-plugin/plugin.json`：`skills: "./skills/"`（同一份目錄）、沒填 `hooks`（走預設 `hooks/hooks.json`）、`interface.category = "Developer Tools"`、`capabilities: ["Read", "Write"]`。
- `.agents/plugins/marketplace.json`：`source: { source: "local", path: "./" }`、`policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" }`、`category`——spec 標「格式錯整個 marketplace 不載」。Task 0 實測 Codex 讀的是這份（`codex plugin list --json` 的 `installPolicy` / `authPolicy` 只有它有）。
- 版本三處 1.5.0 → 1.6.0；description 四處改成「/devwork（Claude Code）或 $bstack:devwork（Codex）啟動…」。

### 關聯檔案

- P13 守全部欄位與三處版本一致；`scripts/gen-codex-agents.mjs` 讀 `.codex-plugin/plugin.json` 的 `version` 當 TOML 檔頭戳。

---

## `skills/devwork/hosts.md`（新）

### 改動意圖

spec Scope 第 3 條、plan Task 2。整個「同一份 skill 雙 host」設計的樞紐：skill 內文的工具名是抽象動詞，這份表定義它們在 Claude Code / Codex 各對應哪個工具、以及「工具不在清單時」的退路。

### 改動詳解

- 第一段護欄（P16 `guardLine` 守）：動作前先確認同名工具在自己的工具清單裡；不在就照表對應，**不要去找同名工具、也不要靜默略過**。工具清單永遠優先於 §Host 判定 的預設值。
- 三種待遇原則（review m1 補）：列在第一欄的可直接當抽象動詞；只有一個 host 有的（`NotebookEdit`、`SendMessage`）要同行寫出另一 host 對應；都不是的先加進表再用。這三條就是 P14 的三種規則。
- 八節（P16 `HEADS16` 守）：Host 判定 / 決策點 / 任務追蹤 / 派 subagent / 程式碼審查 / MCP 工具 / Memory 路徑 / 停用 plugin。
- 值得注意的對應：
  - 決策點退路「文字提問、選項編號、user 回編號」——明寫為什麼不算 rules.md 禁的「文字 token NLP」（編號可窮舉、無歧義）。
  - 任務追蹤多一列 `TaskOutput`（P14 反向白名單抓出 request-review 在用它）。
  - 派 subagent 沒裝 TOML → 內建 `explorer` / `worker` 把 agent md 本文貼進 prompt；連 spawn 都沒有 → 主 agent 自己做並標「未隔離」。
  - 程式碼審查：Codex 內建只有 default / worker / explorer、**沒有 `reviewer`**（review Major 改掉的錯誤假設）。
  - MCP 工具不在 → **回報並停在需要它的步驟**，不靜默略過（§事實核實 的儲存端就靠它）。

### 關聯檔案

- `skills/devwork/SKILL.md` 使用契約第 1 步讀它；`skills/devwork/rules.md` §決策點選單 有濃縮版並指向這裡。
- `scripts/plugin-contract.mjs` P14 從各節第一欄抽白名單、P16 守八節與表頭。
- `scripts/build-references.ps1` 內嵌成 `references/hosts.md`；`docs/tools/docs-site-contract.mjs` `EXTRA_REFS` 認它。
- 被 brainstorm / context-snapshot / retro / dispatch-parallel / request-review / review-plan / pr-explain 引用「§Memory 路徑」「§任務追蹤」「§派 subagent」「§程式碼審查」「§Host 判定」。

---

## `skills/devwork/rules.md`

### 改動意圖

規則書本體雙 host 化，但守「位階等同 CLAUDE.md」：只加不減、Tier 表 review 欄的 `code-review medium|high` 字面保留（P9 / P16 都守）。

### 改動詳解

- §決策點選單：加一段「本檔與各 skill 寫的工具名是抽象動詞」+ 五列濃縮對照表（AskUserQuestion / Task* / Agent / code-review / mcp__）。
- §Branch safety：hook 攔的工具改寫成「Claude Code 的 Write / Edit / NotebookEdit、Codex 的 `apply_patch`（Codex 把 Write / Edit 當 apply_patch 的別名）」；新增「apply_patch 路徑相對 session cwd，hook 一律視為 repo 內」；豁免段 repo 範圍改「Claude Code 由 `$CLAUDE_PROJECT_DIR` 給、Codex 由 `git rev-parse --show-toplevel` 算」；停用句雙 host。
- §Tier 表 T2 / T3 review 欄各加「（Codex：reviewer subagent，見 hosts.md §程式碼審查）」。
- §協作模式判定 加一列「Codex 無 Agent Teams：不做開關偵測；同 group ≥2 task 就問 subagent 平行 / 串行二選一」。
- §Settings.json：加「Codex 對應為 `.codex/config.toml` 與 `rules/*.rules`」。

### 關聯檔案

- P16 `rulesDigest` / `tierRows` / `branchSafety` / `noTeams` 四項斷言；P9 / P12 既有斷言仍綠（字面保留）。
- `CLAUDE.md` `@import` 這份（bstack repo 自身開發常駐）。

---

## `skills/request-review/SKILL.md`

### 改動意圖

plan Task 5。Codex 沒有可由模型呼叫的內建 code-review，T2 / T3 的「抓 bug」那一半要有替代；「符合 spec」那一半兩 host 本來就自己派。

### 改動詳解

- 使用契約第 3 步：T2 / T3 各加「（Codex：§Codex reviewer prompt 的 reviewer 一個）」。
- §T2 / §T3 段拆成 **Claude Code** / **Codex** 兩段：Codex `spawn_agent` 內建 `explorer`（唯讀）帶 reviewer prompt、`wait_agent` 收；輸出同 code-review 的 JSON 陣列、走 §結果整合 同一張表。明寫「Codex 的 reviewer 只有一個 agent、沒有 finder / verifier 兩層，覆蓋面比 medium 低，本 skill 不另外補償」。
- 新增 `## §Codex reviewer prompt`（P16 守存在、hosts.md 指向它）：只找「會壞」的六類、每筆必附 `failure_scenario`、只回 JSON 陣列。
- hand-off state：`reviewers_used` Codex 例 `[codex-reviewer, spec-self-check]`；`code_review_level` 照 tier 填（語意是「該 tier 該有的檔位」）。
- Red Flags 加一列「Codex 沒有 code-review，抓 bug 那段就跳過」→ 只有純文件 diff 才跳。

### 關聯檔案

- `skills/devwork/hosts.md` §程式碼審查 指向 §Codex reviewer prompt；`skills/dev-workflow/SKILL.md` Phase 5 加同義註記；`rules.md` Tier 表加 Codex 註。

---

## `skills/dispatch-parallel/SKILL.md`

### 改動意圖

plan Task 5（review 後從「移除 Agent Teams 分支」改成「標 Claude Code 限定」，守零改變）。

### 改動詳解

- 全檔 Agent Teams 字樣後綴「（Claude Code 限定）」；§隊友派工 標題同。
- 開關偵測加第 0 步：依 hosts.md §Host 判定 認 host；Codex 跳過 1-3、判準表只看 subagent / 串行兩欄、同 group ≥2 task 就問（沒有「三條全中才問」這關）。
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` 那行前綴「（Claude Code 限定）」——P14 BAN14 第五條要求同行有這字樣才放行。
- 選單範本從「推薦 / 次選 / 再次選」佔位改成三個固定 label（Agent Teams 標「Codex 不列」、subagent 平行、單一 session 串行），每個附代價。
- 隊友派工的「用 `SendMessage` 送回」改成同行雙 host：Claude Code `SendMessage`；Codex 靠 `wait_agent` 收（P14 BAN14 第三條）。

### 關聯檔案

- `rules.md` §協作模式判定 的「Codex 無 Agent Teams」一列與此同步；`skills/dev-workflow/SKILL.md` Phase 3 圖加「（限 Claude Code）」。

---

## `skills/pr-explain/SKILL.md`

### 改動意圖

plan Task 5 原計畫拔 `context: fork`（以為 Codex 不認會出錯）；review Critical 實測 Codex 對它無反應、拔掉反而是 Claude Code 側行為改變 → 還原，只加 §0 說明 Codex 怎麼派。

### 改動詳解

- description 「fork pr-explainer」→「spawn pr-explainer」（抽象動詞）。
- 新增 `## 0. 派發方式`：Claude Code 由 frontmatter `context: fork` + `agent: pr-explainer` 自動 fork（harness 強制）；Codex 不認這兩個 key，由主 agent 依 hosts.md §派 subagent spawn `pr-explainer`，把 1-6 步連同 `$ARGUMENTS` 當 prompt 交給它。主 agent 不自己讀 diff、不自己寫檔。

### 關聯檔案

- `agents/pr-explainer.md`（未改）與 `codex/agents/pr-explainer.toml`（產物，workspace-write）。

---

## 其餘 skill / agent 字面改寫（plan Task 6，14 處 + Task 5 明列 5 處）

### 改動意圖

spec Scope 4b：全 35 檔掃描 Claude 專屬字面，逐處改成 host 中性或同行雙 host。P14 守不回退。

### 改動詳解

| 檔 | 改了什麼 |
|---|---|
| `brainstorm` 0a | memory 路徑改「依 hosts.md §Memory 路徑」；讀不到 → `memory_loaded: false`、原因進 spec §待釐清、不卡流程。**user 決定兩 host 都維持「讀得到就讀、讀不到也繼續」**（receive-review 記錄），所以「沒讀過不能進 0b」的硬門檻在 Claude Code 側也放寬了——這是本 PR 少數 Claude Code 側可觀察的行為變化 |
| `brainstorm` 0b′ / `design-language` / `execute-plan` / `write-skill` | `.claude/skills/` 出現處同行雙寫 `.agents/skills/`（P14 規則 b） |
| `context-snapshot` / `retro` | `~/.claude/projects/.../memory/` 改「路徑依 `devwork/hosts.md` §Memory 路徑」 |
| `retro` | TaskList 標 Claude Code、Codex 改讀 plan.md / 施工清單勾選 |
| `dev-workflow` | Phase 3 / 5 加 Codex 註；「CLAUDE.md @import」改「CLAUDE.md / AGENTS.md 引用」 |
| `devwork` | 讀 hosts.md；`/bstack:` 前綴清單並列 `$bstack:`（P14 BAN14 第四條） |
| `review-plan` | SendMessage 同行雙 host |
| `finish-branch` / `lock-files` / `agents/hypothesis-tester` / `agents/security-auditor` | `NotebookEdit` 同行標「Claude Code 才有」、加 Codex `apply_patch` |

- `finish-branch` §Branch safety 雙保險 仍寫「→ exit 2 阻擋」，Codex 側實際是 JSON deny——文字沒同步到 Task 10 的發現（未明示是否刻意）。
- `design-direction` 的 `${CLAUDE_PLUGIN_ROOT}` 與 `design-language` 的 CSS `@import` 追溯句依 spec 刻意不動。

### 關聯檔案

- 全部由 P14 守；`codex/agents/*.toml` 因 hypothesis-tester / security-auditor 改動而重產（commit 3e20618）。

---

## `scripts/build-references.ps1`、`docs/tools/docs-site-contract.mjs`、`docs/js/references-data.js`

### 改動意圖

spec Scope 第 8 條、plan Task 9：docs 站要看得到 hosts.md（跟 rules.md 一樣是規則層）。

### 改動詳解

- `build-references.ps1`：`$map['references/hosts.md']` 加入內嵌；找不到就 throw（不靜默略過）。收尾訊息計數改「rules.md + hosts.md 2」。
- `docs-site-contract.mjs`：`EXTRA_REFS = ['references/rules.md', 'references/hosts.md']`，C8b 期望數與 C18b 白名單都從這一份算（review reuse：原本兩處寫死）。
- `references-data.js` 重產（36 份）。

### 關聯檔案

- P16 `buildRefs` 斷言；`build-references -Check` 是收尾鏈之一（memory 記錄：改 SKILL.md 後必跑）。

---

## `README.md`

### 改動意圖

spec Scope 第 6 條、plan Task 8。全文雙 host 化並新增「Codex」節。

### 改動詳解

- 開頭與 hook 段：加 Codex 段落（apply_patch、`/hooks` 信任、exit 2 不算 block 的實測、`allow_managed_hooks_only`）。
- 前置需求表加 `Codex CLI 0.153+`；pwsh 需求列出第三支腳本。
- 新「Codex」節六小節：安裝（一站式 / 手動兩行、為什麼預設 GitHub 而非本機——複製整棵 working tree 7,621 項 144 MB、`os error 5` 間歇）、生效條件（新 session / `/hooks` 信任 / `tools.update_plan`）、供應鏈與寫入範圍、與 Claude Code 的差異表、已知限制（IDE extension 不支援 plugin、無 Agent Teams、shell 寫檔攔不到、reviewer 覆蓋面低、sandbox_mode 不一定生效、`request_user_input` 在 `codex exec` 沒有）、從舊版遷移。
- 解除安裝表加 `install-codex.ps1 -Uninstall`；開發本 repo 段加產生器 `--check` 與新增 agent 的落地步驟。
- 全文標「實測」與「官方文件 / 推斷」分開寫（§白話優先 的「區分實測與推論」）。

### 關聯檔案

- 契約 P7 / P8 的 README 計數斷言未受影響（Agents 表 6 個未變）。

---

## 全域 patterns / cross-cutting

- **抽象動詞 + 對照表**：skill 內文不寫 host 專屬工具名，`hosts.md` 是唯一對照來源；P14 用 hosts.md 第一欄當白名單反向守——新工具名要先進表才能在 skill 用。這是本 PR 最核心的設計決策，之後任何 skill 改動都受它約束。
- **零改變守則的實踐**：三處原計畫的 Claude Code 側改動（hooks.json 拆組、pr-explain 拔 `context: fork`、brainstorm memory 硬門檻）前兩處經實測還原；第三處 user 決定兩 host 都放寬。
- **實測優先於文件**：spec 原寫「apply_patch 被 exit 2 擋下」、「用 git toplevel 解析相對路徑」，Task 10 與 review 實測推翻，改成 JSON deny 與 `payload.cwd`。契約 P2e 用真 spawn 把這兩個事實釘住。
- **fail-closed 傾向**：相對路徑一律 repo 內、截斷 patch 也判、產生器解析不到就 throw、description 空區塊回空字串、build-references 找不到 hosts.md 就 throw。
- **推導不維護清單**：TOML 的 sandbox / MCP / model 全從 frontmatter 推；docs-site-contract 的規則層文件收成一個常數。
- **新 dependency**：無（Codex CLI 是使用者環境，不是 repo 依賴）。

---

## 後續 follow-up

- [ ] `docs/index.html` 首頁 DOCS 索引加 hosts.md（spec 明列本 PR 排除）
- [ ] 契約 P14 `TOKEN14` 手維護清單改機械抽取；`\bAgent\b` 散文命中被白名單放行、實質不設防
- [ ] guard file-type 段用 canonical key 比對（security-audit m1，pre-existing；動到 fixture 9 既有行為）
- [ ] P15 改 in-process 比對（本輪判 320 ms 可接受）
- [ ] Codex 互動 session 的 `/hooks` 信任流程、互動 session 是否有 `request_user_input`、無 runtime 覆寫時 `sandbox_mode = "read-only"` 是否生效——三項只能人在 TUI 驗
- [ ] `README.md` hook 段「看 payload 有沒有 `turn_id`」與 `finish-branch` SKILL.md「→ exit 2 阻擋」兩處文字比實作少講（雙訊號 / JSON deny）；未明示是否刻意簡化
- [ ] `guard.mjs` 的 `targetOf()` 相容殼：code-review 標無呼叫端建議刪，檔內仍保留
- [ ] 20 顆 commit 有 15 顆 subject 超 50 字：squash merge 時由 finish-branch 重寫 PR title
- [ ] `scripts/gen-codex-agents.mjs` 的 `MODEL` 對照表（`gpt-5.6-*`）名稱漂移時要手動更新

---

## 安全 / PII 檢查

- secret / API key: 無。`MCP_TEMPLATES` 是註解範本、無憑證；`install-codex.ps1` 不讀寫 auth.json。
- PII mask: N/A。diff 內出現的 `tommy_sian` / `TOMMY_~1` 是契約 fixture 的路徑字串（8.3 短檔名測試，pre-existing）與 spec 實測紀錄的 state dir 路徑；無 email / phone / 身分證。
- file-type 硬規則命中: 無密鑰類。`.gitattributes` 與 `.codex-plugin/plugin.json` / `.agents/plugins/marketplace.json` 不在 §File-type 表列類型；`scripts/*.ps1` / `hooks/*.mjs` 不屬 infra / CI 類。code-review.md 記錄 security-auditor PASS 項含「`.gitattributes` 與 lock-files 假命中」已檢過。
