# spec：安裝模型改為 Claude Code plugin，`/devwork` 顯式啟動

Track=Dev、Tier=T3、design.size=小改（`docs/index.html` 只改文字節點與安裝步驟內容，沿用既有 `.steps` / `.data` 版面）。
branch：`refactor/plugin-install`。

## 1. 問題

`scripts/setup.ps1`（665 行）把整包 sync 進 `~/.claude/`：CLAUDE.md、statusline.sh、兩支 hook、27 個 skill、6 個 agent，並 merge settings.json 的 `hooks` / `statusLine` / `env`。後果：

- 全域 CLAUDE.md 的九條強制守則、branch-safety hook、27 個 skill 的自動觸發詞，對使用者**所有專案**生效，不是只對想用 bstack 的專案。
- 覆蓋不備份（README §安裝 Step 2 自述），使用者原本的 `~/.claude/CLAUDE.md`、hooks 會被洗掉。
- dev-workflow 靠 skill 描述的關鍵詞（寫 / 改 / 修 / 加…）自動攔截，使用者沒有「這次不要走流程」的選項。

## 2. 目標（user 已於 2026-09-04 AskUserQuestion 定案）

| 決策 | 定案 |
|---|---|
| 發布模型 | Claude Code plugin |
| 啟動方式 | 只靠 `/devwork` 顯式觸發，拿掉自然語言自動攔截 |
| 強制守則載體 | 併進 devwork 流程本體，不碰使用者任何 CLAUDE.md |
| Tier / Track | T3 / Dev |
| 設計 | index.html 安裝區塊改文案，小改 |

**不動 `~/.claude/` 的定義**：本 repo 不再有任何腳本寫入 `~/.claude/`。使用者若走 `/plugin install`，Claude Code 自己會在 `~/.claude/plugins/` 放快取、在 settings 記 `enabledPlugins`，那是 Claude Code 的 plugin 登記機制、可用 `/plugin uninstall` 反悔，與「覆蓋使用者設定」不同，README 要講清楚這個差別。

## 3. 事實依據

### 3a 官方文件（claude-code-guide 查核，2026-09-04）

- skill 載入範圍與優先序：managed > user `~/.claude/skills/` > project `.claude/skills/` > plugin `skills/`。**user 級同名 skill 會遮蔽 plugin skill**（→ §6 遷移必須清掉舊 sync 的副本，否則舊版永遠勝出）。
- plugin 元件放 plugin 根目錄：`skills/`、`agents/`、`hooks/hooks.json`、`.mcp.json`、`settings.json`（**只認 `agent` / `subagentStatusLine`**，`permissions` / `env` / `statusLine` 不支援）。
- `.claude-plugin/plugin.json` 必填 `name`；`.claude-plugin/marketplace.json` 必填 `name`、`owner.name`、`plugins[].name`、`plugins[].source`，`source` 可為 `"./"`（repo 自己當 marketplace）。
- hooks.json 內可用 `${CLAUDE_PLUGIN_ROOT}`；plugin hooks 只在 plugin 啟用時生效。
- project 級 `.claude/settings.json` 可寫 `extraKnownMarketplaces`（GitHub source）+ `enabledPlugins`（map：`"bstack@bstack": true`）。clone 的人信任目錄後 marketplace 自動加入；plugin 是否自動裝**文件未明**（v2.1.195+ 說「doesn't load until installed」）→ README 保守寫「需跑一次 `/plugin install`」，execute 階段實測後修正。
- `--plugin-dir <path>` 載入不需 enable、只在該 session 生效。
- plugin 無法提供 CLAUDE.md；skill 內相對路徑 `./references/x.md` 可用，另有 `${CLAUDE_SKILL_DIR}`。
- CLAUDE.md `@path` import 支援相對路徑、最深 4 層。

### 3b 實測（Claude Code 2.1.260，2026-09-04）

最小 plugin（`name: bstack`，一個 `skills/devwork/SKILL.md`）用 `claude --plugin-dir` 載入：

| 輸入 | Skill tool call | 耗時 | 結論 |
|---|---|---|---|
| `/devwork` | 0 | 2.5 s | harness 直接展開，裸名可解析 |
| `/bstack:devwork` | 0 | 同 | 正式寫法 |
| `devwork`（無斜線） | 1 | 13.7 s | 模型自行判斷載入，即「自動觸發」路徑 |

裸名是實測行為、非文件保證。文件寫 `/devwork` 為主、`/bstack:devwork` 為保底。

### 3c repo 現況（樣本 + 使用點）

| 項目 | 樣本 | 使用點 |
|---|---|---|
| 觸發詞 | 27/27 個 `skills/*/SKILL.md` 的 description 含「觸發：」自然語言清單（grep 計數） | Claude Code 用 description 決定自動載入；這是自動攔截的唯一來源 |
| 全域路徑字樣 | `CLAUDE.md:48,53,155`、`skills/finish-branch:276`、`design-direction:85`、`design-language:25`、`write-skill:173,175`、`dispatch-parallel:57` 寫死 `~/.claude/...` | 改成 plugin 後這些描述全部失真 |
| hook state | `hooks/file-type-guard.ps1:77` 把二次確認 token 寫到 `$PSScriptRoot/../state/file-guard/` | plugin 安裝後 `$PSScriptRoot` 落在 `~/.claude/plugins/` 快取，更新即清空、且不該寫入快取 |
| settings.json | repo 根 `settings.json` 含 `env` / `hooks` / `statusLine` / `permissions` / `attribution` | 全部靠 setup.ps1 merge 進全域；plugin `settings.json` 元件不認這些 key |
| docs 站 | `docs/js/data.js` prelude 三節點 `Start` / `ClaudeMd` / `DevWfSkill`；`docs/index.html:85` 標題「裝進 ~/.claude/ 的全部」、`#install` 四步 | 公開 GitHub Pages，merge 即上線 |
| 契約 | `docs/tools/docs-site-contract.mjs` C6 BASELINE_KEYS、C8a 98/135、C18 磁碟 skill 全點得開 | 新增 skill 必須同步節點 + 內嵌，否則契約紅 |
| memory 路徑 | `brainstorm:37`、`retro:122` 的 `~/.claude/projects/.../memory/` | 那是 Claude Code 自己的 auto-memory，不是本 repo 安裝物，**不動** |

## 4. 設計

### 4a plugin 骨架

```
.claude-plugin/plugin.json        name=bstack, version, description, author, homepage, license
.claude-plugin/marketplace.json   name=bstack, owner, plugins=[{name: bstack, source: "./"}]
skills/<28 個>/SKILL.md           原 27 + 新 devwork
agents/<6 個>.md                  不動內容，只改描述的「觸發」措辭
hooks/hooks.json                  PreToolUse Write|Edit|NotebookEdit → 兩支 pwsh，用 ${CLAUDE_PLUGIN_ROOT}
hooks/branch-safety.ps1           不動
hooks/file-type-guard.ps1         state dir 改到系統 temp（見 4e）
extras/statusline.sh              從根目錄搬入；非 plugin 元件、手動選用
templates/project-settings.json   給團隊複製到專案 .claude/settings.json 的範本
scripts/build-references.ps1      不動
scripts/extras.ps1                setup.ps1 改寫：plugin 帶不了的個人偏好選單 + 舊版遷移（見 4g、§6）
scripts/plugin-contract.mjs       新：plugin 結構契約（見 §5）
```

刪除：`scripts/setup.ps1`（改寫為 extras.ps1）、根目錄 `settings.json`（內容拆進 extras.ps1 的項目定義）、`state/`。

### 4b 入口 skill `devwork`

- `skills/devwork/SKILL.md`：使用契約 = 讀 `rules.md` → 載 `dev-workflow` → Phase 0。description 寫明「使用者輸入 `/devwork` 或 `/bstack:devwork` 才啟動，不因自然語言自動載入」。
- `skills/devwork/rules.md`：原 CLAUDE.md 全文搬入（溝通風格 / 強制守則 / 開發流程政策 / 程式碼規範 / 版本控管），**單一真相**。文字內 `~/.claude/hooks/...` 改為「plugin 的 `hooks/branch-safety.ps1`」；§Settings.json 一節改寫成「建議專案 `.claude/settings.json` 的 permissions 僅限唯讀」。
- repo 自己的 `CLAUDE.md` 縮成：一段「開發本 repo 時用 `claude --plugin-dir .` 載入自己」+ `@skills/devwork/rules.md`。避免兩份漂移。
- 其他 skill 內「CLAUDE.md §xxx」的引用字樣改為「devwork rules §xxx」（grep `CLAUDE.md` 逐一改；docs 站的 `ClaudeMd` 節點同步）。

### 4c 觸發改造（27 個 skill + 3 個 agent 描述）

description 的「觸發：<自然語言清單>」一律改為「載入：<誰在哪個階段載入>」，例如：

- dev-workflow：「由 `/devwork` 載入；不因自然語言自動觸發」
- brainstorm：「dev-workflow Phase 0 載入」
- finish-branch：「dev-workflow Phase 7 載入；user 亦可 `/bstack:finish-branch` 顯式呼叫」
- cmd-guard / safety-guard / db-access 等跨流程：「dev-workflow §跨流程 skill 觸發 表載入；user 亦可顯式呼叫」

body 內的「觸發」段落若只是重述描述，一併改；流程邏輯不動。

### 4d docs 站

- `data.js` prelude：`Start` label 改「user 輸入 /devwork」；`ClaudeMd` 改「devwork rules.md 強制守則仲裁」；新增 `LoadDevwork`（載入 skill：devwork）接在 `Start` 與 `DevWfSkill` 之間；`DevWfSkill` label 去掉「寫 / 改 / 修 / 加類 prompt 必載」。
- `app.js` NODE_DOCS 加 `LoadDevwork: {p:'skills/devwork', n:'devwork', k:'skill'}`。
- `index.html`：`#install` 改為三步（clone 或 marketplace add → `/plugin install bstack@bstack` 或 `--plugin-dir` → 開 session 輸入 `/devwork`）；「裝進 ~/.claude/ 的全部」改「plugin 裡有什麼」；計數 27 → 28；meta description 同步。**只改文字節點與 `<li>` 內容，不動 class / style。**
- README：§安裝 重寫（三種載入方式：試用 `--plugin-dir`、個人 `/plugin install`、團隊 template）；新增 §從舊版遷移 指向 `uninstall-global.ps1`；Skills 計數 28；Hooks 段落改 plugin 路徑。
- 契約：C6 BASELINE_KEYS 加 `LoadDevwork`；C8a 改 99 nodes / 137 edges（+1 節點、`Start→LoadDevwork→DevWfSkill` 取代 `Start→DevWfSkill`，淨 +2 邊；execute 時以實際數為準）；重跑 `build-references.ps1`。

### 4e hook 調整

- `hooks.json` command：`pwsh -NoProfile -File "${CLAUDE_PLUGIN_ROOT}/hooks/branch-safety.ps1"`（文件範例引號寫法）。
- `file-type-guard.ps1` state dir → `[IO.Path]::GetTempPath()/bstack/file-guard/`，token 檔名沿用 `<hash>.token`（hash 已含專案路徑，不同專案不撞）。docstring 同步。
- `dispatch-parallel` 開關偵測改為只查環境變數 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`（settings 的 `env` 會注入為環境變數；不再讀 `~/.claude/settings.json`）。

### 4g extras.ps1：plugin 帶不了的四項，逐項選單（user 2026-09-04 定案）

**為什麼另外做**：官方文件說 plugin 根目錄 `settings.json` 只認 `agent` / `subagentStatusLine`，statusLine / permissions / env / MCP 都帶不進 plugin。這四項是個人偏好，適合讓使用者逐項決定裝到哪一層。**plugin 核心（skills / agents / hooks / 守則）不在選單裡**，那走 `/plugin install`（使用者層級）或專案 `enabledPlugins`（專案層級），用 Claude Code 自己的範圍機制。

| 項目 | 寫入內容 | 預設建議層級 |
|---|---|---|
| statusLine | `statusLine: {type: command, command: bash "<絕對路徑>/extras/statusline.sh"}` | 使用者層級（`~/.claude/settings.json`） |
| permissions.allow 唯讀白名單 | 原 settings.json 的 25 條唯讀 / 查詢類 | 專案層級（`<project>/.claude/settings.json`） |
| env 開關 | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`、`CLAUDE_CODE_ENABLE_TODO_TOOLS=1` | 使用者層級 |
| MCP | `claude mcp add playwright --scope <user|project> -- npx -y @playwright/mcp@latest`；mysql 由使用者輸入連線環境變數後同法加入 | 使用者層級 |

**行為**：
- 每項各問一次：`[U] 使用者層級 / [P] 目前專案（cwd 的 .claude/settings.json） / [S] 跳過`；預設 S，**沒選就什麼都不寫**。
- 寫入走 merge（沿用舊 setup.ps1 的 `Merge-Settings` 邏輯：只加本項 key，其他一律保留），寫前備份 `settings.json.bak-<yyyyMMddHHmmss>`。
- 每次寫入記到 manifest `~/.claude/bstack-extras.json`：`{item, scope, file, keys_added, ts}`。
- `-Uninstall`：讀 manifest，只移除自己加過的 key / MCP，settings 其他內容不動；manifest 清空。
- `-Migrate`：舊版遷移（§6）併成選單第一項「偵測到舊 setup.ps1 的副本，要清掉嗎？」。
- 非互動：`-Yes -Items statusLine,env -Scope user` 直接套用，供 CI / 自動化。
- 不裝 plugin、不碰 skills / agents / hooks / CLAUDE.md，跑完印出「plugin 請用 `/plugin install bstack@bstack`」。

### 4f 不做

- 不做 per-project 複製模式（user 選 plugin only）。
- 不做 SessionStart 注入守則。
- 不改 hook 為跨平台 shell（仍是 pwsh；README prerequisites 保留 pwsh 7+）。
- 不改 27 個 skill 的流程邏輯，只改描述與路徑字樣。

## 5. 驗證

1. `scripts/plugin-contract.mjs`（零依賴 node）：
   - P1 `plugin.json` / `marketplace.json` 是合法 JSON、必填欄位齊、`plugins[0].source === "./"`、兩邊 `name` 一致
   - P2 `hooks/hooks.json` 合法、每個 command 含 `${CLAUDE_PLUGIN_ROOT}`、指到的檔存在
   - P3 每個 `skills/*/SKILL.md` frontmatter `name` == 目錄名；description **不含「觸發：」**
   - P4 `skills/ agents/ hooks/ CLAUDE.md README.md` 內不出現 `~/.claude/skills|hooks|agents|settings.json|CLAUDE.md`（白名單：`~/.claude/projects/.../memory`、`/plugin` 指令說明段）
   - P5 根目錄無 `settings.json`、無 `scripts/setup.ps1`、`scripts/extras.ps1` 存在
   - P6 `skills/devwork/rules.md` 存在且 repo `CLAUDE.md` 含 `@skills/devwork/rules.md`
2. `scripts/extras.ps1 -SelfTest`：在 temp 目錄偽造 `HOME` 與 cwd，跑 `-Yes -Items <每項> -Scope user|project` 後斷言 (a) 目標 settings.json 只多了該項 key、其他既有 key 逐 byte 不變 (b) 備份檔存在 (c) manifest 記錄正確 (d) `-Uninstall` 後 settings 回到原樣、manifest 清空 (e) `-Migrate` 對偽造的舊副本只刪 repo 名單內的項目。MCP 項在 SelfTest 以 `-WhatIf` 只印指令不執行。
3. `docs/tools/docs-site-contract.mjs` 全綠；`build-references.ps1 -Check` PASS。
4. 實測（手動、記錄進 verify.md）：
   - 從空目錄 `claude --plugin-dir <repo> -p "/devwork" --max-turns 2`：回應含 devwork 使用契約第一句
   - 同上 `-p "幫我改一下這個檔"`：**不**載入 dev-workflow（stream-json 無 Skill tool call）
   - hooks.json 生效：`--plugin-dir` 下在 main branch 對 repo 內檔 Write → 被 block
   - `/plugin marketplace add fujiei22/bstack` + `/plugin install bstack@bstack`（merge 後才能測，記為 post-merge 驗證）
5. Playwright 開 index.html / flow.html：console 零錯誤、渲染內容無 `~/.claude/`、`setup.ps1` 字樣。

## 6. 遷移（已用舊 setup.ps1 的機器，含作者本機）

`scripts/extras.ps1 -Migrate`（選單第一項）：
- 列出 `~/.claude/skills/<repo 27 名>`、`~/.claude/agents/<6 名>`、`~/.claude/hooks/{branch-safety,file-type-guard}.ps1`、`~/.claude/statusline.sh`，以及 `~/.claude/settings.json` 內指向這些 hook 的 `hooks` 條目與 `statusLine`
- 預設只列；互動選 Y 或 `-Yes` 才刪 / 移除條目；settings.json 先備份 `settings.json.bak-<ts>`
- `~/.claude/CLAUDE.md` **不自動刪**：印出「若內容與 bstack 舊版相同可自行刪除」與 diff 摘要（可能已被使用者改過）
- 理由：user 級 skill 遮蔽 plugin skill（§3a），不清就會永遠跑舊版。

## 7. 風險

| 風險 | 處置 |
|---|---|
| 裸 `/devwork` 是實測行為，未來版本可能要求前綴 | 文件雙寫；smoke test 兩種都跑 |
| clone 者的 `enabledPlugins` 是否自動安裝未明 | README 保守寫需 `/plugin install`；execute 實測後修 |
| 守則只在 `/devwork` 後生效，PII / DB 唯讀底線在流程外不生效 | user 已接受；README 明講 |
| hooks 在 plugin 啟用的專案全域生效（含非 bstack 流程的 session） | 這是 plugin 的正常語意；hook 本身對非 project 檔放行 |
