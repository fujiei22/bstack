# 加 Codex 安裝支援（同一 repo 雙 host）
> Track: Dev | Tier: T3 | 建立: 2026-09-09

## 動機 / Why
bstack 目前只能以 Claude Code plugin 安裝。Codex（OpenAI）的 skill 格式、plugin manifest、hooks 事件與 stdin 格式都與 Claude Code 同構，官方還提供 `CLAUDE_PLUGIN_ROOT` 相容變數並讀 `.claude-plugin/marketplace.json`（依據：2026-09-08 讀完 learn.chatgpt.com/docs 全站與 developers.openai.com/plugins，見 memory `reference-codex-docs-fetch-and-key-facts`）。user 希望同一套九階段流程在 Codex 也能裝、能用，且不 fork 成兩份。

## 目標 / Success criteria
- Windows 上 Codex CLI 0.153+ 能 `codex plugin marketplace add fujiei22/bstack`（或本機路徑）+ `codex plugin add bstack@bstack`，新 session 的 skill 清單出現 `$bstack:devwork` 等 28 個 skill。
- 使用者在 Codex `/hooks` 信任 guard 後，在 `main` 上的 `apply_patch` 寫入被 exit 2 擋下；`.env` 類命中 BLOCK；WARN 類走 token 流程。單一 patch 內多檔逐一判定。
- Claude Code 側行為零改變：`node scripts/plugin-contract.mjs` 全綠，`hooks/hooks.json` 不動，`.claude-plugin/*` 不動（版本號除外）。
- `$bstack:devwork <事>` 在 Codex 上能走完 Phase 0 → spec → 施工，決策點用 Codex 的結構化問題工具，任務追蹤用 `update_plan`，subagent 用 `spawn_agent`；skill 內文不出現「找不到工具」的硬撞。
- `scripts/install-codex.ps1` 一站式完成：前置檢查（codex / node / git）、marketplace add、plugin add、agents TOML 複製、`tools.update_plan.enabled` 寫入、提醒 `/hooks` 信任。
- README 有「Codex」節：安裝、生效條件、信任 hook、與 Claude Code 的差異表。

## 範圍 / Scope
**包含**：
1. `hooks/guard.mjs`：支援 `tool_name: "apply_patch"`（從 `tool_input.command` 解析 `*** Add File:` / `*** Update File:` / `*** Delete File:` / `*** Move to:` 取路徑，多檔逐一判）；`repoDir` 改 `CLAUDE_PROJECT_DIR` → `git rev-parse --show-toplevel` → cwd；stderr 訊息改 host 中性（決策工具、停用指令兩個 host 都寫）。
2. `.codex-plugin/plugin.json`（Codex 原生 manifest）與 `.agents/plugins/marketplace.json`（原生 marketplace）；`.claude-plugin/*` 保留。
3. `skills/devwork/hosts.md`：六個抽象動作在兩個 host 的具體工具對照（決策點 / 任務追蹤 / 派 subagent / code review / memory 路徑 / 停用 plugin），含 host 判定規則；devwork 使用契約第 1 步一併讀。
4. skill 文字的雙 host 化：`request-review`（code-review 段）、`dispatch-parallel`（移除 Agent Teams 分支）、`brainstorm` 0a（memory 路徑依 host）、`rules.md` Tier 表 review 欄與 §決策點選單、`pr-explain` 移除 `context: fork`、`devwork` 讀 hosts.md。其餘 skill 保留 `AskUserQuestion` / `TaskCreate` / `Agent` / `subagent_type` / `mcp__<server>__<tool>` 等字樣當**抽象動詞**，由 hosts.md 定義兩 host 的具體工具，不逐檔改。
4b. **全 35 檔（28 skill + 6 agent + rules.md）Claude 專屬字面掃描**：2026-09-09 實測，4b 之外還有 12 檔各含 1 到 3 處字面（`~/.claude/…` 路徑：context-snapshot、retro；`.claude/`：design-language、execute-plan、retro、write-skill；`@import`：dev-workflow、design-language；`SendMessage`：review-plan；`NotebookEdit` 字樣：finish-branch、lock-files、hypothesis-tester、security-auditor；`${CLAUDE_PLUGIN_ROOT}`：design-direction（Codex 相容、可留）；`TaskList` 歷史：retro）。逐處改成 host 中性或雙 host 寫法。**契約 P14**（掃描集合刻意只含 `skills/*/SKILL.md` 與 `agents/*.md`；rules.md / hosts.md 是規則書本體，由 P16 明列斷言守）：禁帶語境的字面（`@skills/devwork/rules.md` 引用寫法、`~/.claude/projects`、`SendMessage`、`context: fork`、`/bstack:`、`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`、同行無「Claude Code」註記的裸 `NotebookEdit`）；`.claude/skills` 出現的行必須同時含 `.agents/skills`（正向雙寫）；design-language 的 CSS `@import` 追溯句不動。另加反向白名單：skill / agent 內出現的已知 Claude 工具名必須是 hosts.md 第一欄列出的抽象動詞。紅就擋 merge。
5. `codex/agents/*.toml` 產生器（從 `agents/*.md` 產 Codex custom agent TOML：`name` / `description` / `developer_instructions` = 本文、`model` 對照、reviewer 類 `sandbox_mode = "read-only"`、MCP 依賴）；產物入版控、契約守同步。
6. `scripts/install-codex.ps1` 與 README「Codex」節。
7. `scripts/plugin-contract.mjs`：新增 Codex manifest 檢查、雙 manifest 版本一致、apply_patch fixture、agents TOML 同步、hosts.md 存在且 devwork 有讀。
8. `docs/js/references-data.js` 重產（contract -Check 要綠）。

**排除**（明寫避免 scope creep）：
- `docs/index.html` landing 文案不動（會命中 `.html`，另開 follow-up）。
- 不做 Codex 版 `extras.ps1`（statusline / settings 個人偏好）；MCP server 設定由使用者 `codex mcp add` 自理，README 給指令。
- 不把 Claude Code 內建 code-review 的 8 finder 品質在 Codex 上複製；Codex 側走 reviewer subagent，品質差異寫進 Tier 表註。
- 不提交到 OpenAI 公開 plugin directory（需身分驗證與審查；本次只做 marketplace 安裝）。
- 不處理 Bash 寫檔攔截（兩個 host 都沒有）。

## 影響檔案 / Codebase impact
| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `hooks/guard.mjs` | edit | 高：兩 host 共用；patch 解析錯會漏擋或誤擋。契約 P2d/P2e 加 fixture |
| `hooks/hooks.json` | edit（拆成 `Write\|Edit` 與 `NotebookEdit` 兩個 matcher group、command 相同） | 低：Claude Code 兩組不重疊、guard 仍只跑一次；換掉「交替式含 NotebookEdit 在 Codex 仍匹配 apply_patch 別名」這條純推斷。`${CLAUDE_PLUGIN_ROOT}` Codex 相容 |
| `.codex-plugin/plugin.json` | new | 低 |
| `.agents/plugins/marketplace.json` | new | 中：entry 需 `policy.installation` / `policy.authentication` / `category`，格式錯整個 marketplace 不載 |
| `.claude-plugin/plugin.json`、`marketplace.json` | edit（版本 1.6.0） | 低 |
| `skills/devwork/hosts.md` | new | 中：是所有 skill 抽象動詞的定義來源 |
| `skills/devwork/SKILL.md` | edit | 低 |
| `skills/devwork/rules.md` | edit | 中：Tier 表 review 欄、§決策點選單、§Branch safety 段補 Codex |
| `skills/request-review/SKILL.md` | edit | 中：T2/T3 code-review 段雙 host |
| `skills/dispatch-parallel/SKILL.md` | edit | 中：拿掉 Agent Teams 分支後 §協作模式判定 要同步（rules.md 也有一份） |
| `skills/brainstorm/SKILL.md` | edit | 低：0a memory 路徑 |
| `skills/pr-explain/SKILL.md` | edit | 低：移除 `context: fork` |
| `skills/{context-snapshot,retro,design-language,execute-plan,write-skill,dev-workflow,review-plan,finish-branch,lock-files}/SKILL.md`（9 個） | edit（字樣，各 1 到 3 處） | 低：4b 掃描；契約 P12 守 |
| `agents/{hypothesis-tester,security-auditor}.md` | edit（`NotebookEdit` 字樣） | 低 |
| `agents/{db-reviewer,frontend-e2e-runner,lang-reviewer,pr-explainer}.md` | 不動（只有抽象動詞與 MCP 工具名） | — |
| `skills/{security-checklist,tdd-cycle,write-plan,cmd-guard,db-access,debug-systematic,frontend-test,incident-investigate,receive-review,safety-guard,security-audit,verify-done,context-resume,design-direction}/SKILL.md`（14 個） | 不動（只有抽象動詞） | — |
| `codex/agents/*.toml`（6 個） | new（產生器產出） | 中：model 名漂移（`gpt-5.6-terra` / `gpt-5.6-luna`） |
| `scripts/gen-codex-agents.mjs` | new | 中 |
| `scripts/install-codex.ps1` | new | 中：Codex CLI 指令 / 輸出格式需實測 |
| `scripts/plugin-contract.mjs` | edit | 中 |
| `README.md` | edit | 低 |
| `docs/js/references-data.js` | 重產 | 低 |

## 設計方向
design.involved=false（0b′ 比對：無 `.css` `.scss` `.tsx` `.jsx` `.vue` `.svelte` `.html`；`docs/index.html` 明列排除）。

## DB 影響
無。

## 風險與 trade-off
- **Plugin hooks 在 Codex 預設不信任**：使用者不跑 `/hooks` 信任，branch safety 就不存在；企業 `allow_managed_hooks_only` 會整批跳過。README 與安裝腳本明講；安裝腳本無法代為信任（trust 綁 hook hash、要人審）。
- **`request_user_input` 是 experimental**：rules.md「禁文字 token NLP」在 Codex 放寬成「工具不可用時文字提問但選項編號、user 回編號」。
- **`update_plan` 0.152 起預設關**：安裝腳本寫 `tools.update_plan.enabled = true`；沒開時 hosts.md 退成 spec 施工清單 / plan.md 自身勾選。
- **Codex 沒有可由模型呼叫的內建 code-review**：改派 read-only reviewer subagent，覆蓋面低於 Claude Code 8 finder；Tier 表註明。
- **Codex plugin 不能帶 agents**：TOML 靠安裝腳本複製到 `~/.codex/agents/`，未複製時 hosts.md 規定退 `explorer` + agent 本文當 prompt。
- **Codex CLI 是否讀 `.claude-plugin/marketplace.json`** 文件只寫 desktop app 與 enterprise import；保險同時提供 `.agents/plugins/marketplace.json`。實測關卡見 verify-done。
- **guard.mjs 多檔判定**：一個 patch 多個檔任一命中就 exit 2；branch 段對整個 payload 判一次；file-type 段兩趟——第一趟只判不消 token，全部 WARN 都有有效 token 且無 BLOCK / branch 阻擋才消耗，所以多檔 WARN 時使用者必須**一次建齊**所有 token 再 retry（訊息逐檔列 `--token` 行，共用步驟只印一次）。
- **apply_patch 送相對路徑**：guard.mjs 只對 apply_patch 來源的路徑以 repo root 解析成絕對路徑再進兩段判定；Write / Edit 的 `file_path` 維持原樣（review 實測：不解析的話 Dockerfile / lock / CI yml 在 Codex 全部靜默放行）。
- **同一份 hooks.json**：拆兩個 matcher group 後 Codex 的 `Write|Edit` 別名對 `apply_patch` 生效；`NotebookEdit` 那組在 Codex 永不匹配，無害。Task 0 先實測 hook 會被 Codex 呼叫。

- **舊版副本遮蔽（2026-09-09 實查本機）**：`~/.agents/skills/` 已有舊版 `dev-workflow`（關鍵詞自動攔截版）、`db-access` 等 bstack 副本；Codex 同名 skill 不合併、兩個都列，舊版會搶先自動觸發。`install-codex.ps1` 加 `-Migrate`（列出並搬進備份目錄、不刪）；`~/.codex/AGENTS.md` 只警告不動。同機 `codex` 不在 PATH，Task 0 前先問 user 是否安裝 CLI。

## 待釐清
- ~~Codex 安裝後 skill 命名空間實際顯示為 `$bstack:devwork` 還是 `$devwork`~~ → **已定案 `$bstack:devwork`**（Task 0 第 4 項，`codex debug prompt-input` 實測）。
- ~~`codex plugin marketplace add ./`（本機路徑）在 CLI 上的可用性~~ → **可用**，但 `plugin add` 對本機來源間歇 `os error 5`（Task 0 第 3 項；install-codex.ps1 重試三次）。
- 新增（Task 10）：agent TOML `sandbox_mode = "read-only"` 在互動 session 無覆寫時是否生效——`codex exec` 下兩種給法都沿用父 sandbox（子 agent 真把檔改掉），文件說互動無覆寫才用檔內值，非互動驗不了。
- 新增（Task 10）：互動 session 有沒有 `request_user_input` 工具——`codex exec` 下沒有，模型照 hosts.md 退路用編號提問。

## 施工紀錄
<!-- execute-plan 施工中追加 -->

### Task 0（2026-09-09 實測，Codex CLI 0.153.4 / Windows 11）

| # | 項目 | 結果 |
|---|---|---|
| 0 | 前置 | user 同意後以官方 `irm https://chatgpt.com/codex/install.ps1 \| iex` 安裝，落在 `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin`（PATH 只對新開的 shell 生效）。`~/.agents/skills/` 的舊副本 `dev-workflow` / `db-access` / `huashu-design` 確認**與 plugin 版並列**出現在模型看到的 skill 清單（見第 4 項），Task 7 `-Migrate` 要處理 |
| 1 | `codex --version` | `codex-cli 0.153.4` |
| 2 | marketplace | `codex plugin marketplace add D:\GitHub\bstack` 成功、`root = D:\GitHub\bstack`。讀的是 **`.agents/plugins/marketplace.json`**：`codex plugin list --json` 回 `installPolicy: AVAILABLE` / `authPolicy: ON_INSTALL`，這兩欄只有它有、legacy `.claude-plugin/marketplace.json` 沒有 |
| 3 | `codex plugin add bstack@bstack` | 最終成功，`installedPath = ~/.codex/plugins/cache/bstack/bstack/1.5.0`，底下有 `hooks/hooks.json`（兩組 matcher）與 `skills/`（28）。**但間歇失敗**：`failed to activate plugin cache entry: 存取被拒 (os error 5)`。同一 repo 連續 9 次 add：前 5 次全失敗、之後 4 次 3 成功 1 失敗；內容完全相同的副本（含 `.git`、四個 ignored 目錄、`.git` 隱藏屬性、目錄名同為 `bstack`、放在 D:\GitHub 同層）10 次全成功。已排除：Claude Code sandbox、cwd 在 repo 內、檔案鎖（只有 `extras/statusline.sh` 被 statusline 的 bash 佔著，模擬同樣佔用時副本照樣成功）、ACL / owner、reparse point、ADS、路徑長度。FileSystemWatcher 看到流程是「複製整個 working tree 到 `cache/bstack/plugin-install-<rand>/bstack/1.5.0`（**7,621 個項目、144 MB，連 ignored 的四個 clone 目錄都抄**，約 60 秒）→ rename 到 `cache/bstack/bstack/1.5.0`」，失敗點在 rename，**推斷**是 Windows 上剛寫入的大量檔案還被掃描類程序持有 handle 導致 rename 被拒（未證實）。對 Task 7 的影響：`plugin add` 失敗要**自動重試 ≤3 次**、並建議 `-Source github`（clone 只有 tracked 檔，樹小得多） |
| 4 | skill 呼叫名 | 不開 TUI，用 `codex debug prompt-input`（印模型實際看到的 prompt）：skill 根 `r3 = …/cache/bstack/bstack/1.5.0/skills`，28 個全列為 **`bstack:<name>`**（`bstack:brainstorm` …），所以呼叫是 **`$bstack:devwork`**（待釐清第 1 條定案）。同一份清單同時列出 `~/.agents/skills` 的 `dev-workflow` / `db-access` / `huashu-design`（舊副本並列證實） |
| 5 | `/hooks` 信任 | **未做**：需互動 TUI；自動化改用 `codex exec --dangerously-bypass-hook-trust`（文件明列給自動化用） |
| 6 | main 上 apply_patch 被擋 | **卡住**：`codex exec` 在本機回 `401 refresh_token_reused`（Codex 登入的 refresh token 已被別的裝置 / session 用掉，要重新 `codex login`）。另一個坑：`codex exec` 在非 TTY 下會等 stdin，要接 `< /dev/null`。cache 版 `guard.mjs` `main()` 第一行已加 `[cwd-probe]` 探針（印 cwd / `CLAUDE_PROJECT_DIR` / `CLAUDE_PLUGIN_ROOT`），看完要拔（重裝 plugin 即還原） |
| 7 | feature branch 放行 | 同上待登入 |

**Task 0 判定**：檔案部分（兩份 manifest、hooks.json 拆組、t0.mjs、契約 P1 / P2 綠）完成；第 6 / 7 項是「hook 會不會被 Codex 呼叫」的唯一實證，**等 user 重新 `codex login` 後補跑**。

### Group 1-3 施工紀錄（2026-09-09）

- 跑法：group 1 七個 task 檔案兩兩不重疊、彼此不需對話 → 依 dispatch-parallel §協作模式判定不出選單、直接 subagent 平行（各自 git worktree；Task 3 / 4 / 8 派 Opus）；主 agent 做 Task 1。worktree 建出來時 HEAD 在 `main`，subagent 各自 `--ff-only` 到 branch 頂端再做，主 agent 以 cherry-pick 收、每個 task 重跑一次它的 `t<N>.mjs` 與契約才進 branch。
- 偏離 plan：(1) 加 `.gitattributes`（`*.toml text eol=lf`）——`core.autocrlf=true` 機器 checkout 後 TOML 變 CRLF，t4 / P15 的 `!/\r/` 斷言會假紅；(2) plan 預期 Task 5 讓 P11 暫紅，實測**仍綠**（P11 只比對副檔名 token，`.agents/skills/` 不含副檔名）；(3) P14 改成 context-aware：`/bstack:` 同行並列 `$bstack:` 放行（devwork 是全 repo 唯一列前綴清單的地方）、`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` 同行標「Claude Code 限定」放行；(4) hosts.md §任務追蹤 補一列 `TaskOutput`（request-review 用它收內建 code-review 結果，P14 反向白名單抓出來的）；(5) docs 站契約 C8b / C18b 一併認 `references/hosts.md`（內嵌 36 份）。
- Task 6 掃描實得 14 處 + plan 明列 5 處，共 19 行；Task 5 的 pr-explain 沒有既有 spawn 段，新增 `## 0. 派發方式` 一節。

### Task 10（2026-09-09，部分）

| # | 項目 | 結果 |
|---|---|---|
| 1 | `install-codex.ps1 -Yes -Source local -SkipMigrate` 真跑 | 五步全綠、manifest 寫出（agents 六檔、`config_patched: true`）。第 3 步 `plugin add` **前兩次 os error 5、第三次成功**——重試機制實測有用。`-SkipMigrate` 是主 agent 決定：搬 `~/.agents/skills/` 的 `dev-workflow` / `db-access` 會改變 user 既有 Codex 行為（`~/.codex/AGENTS.md` 七行引用 dev-workflow），留給 user 決定 |
| 7 | `-Uninstall -Yes` | agents 六檔刪、`dev-workflow-gate-runner.toml`（user 自己的）不動、config 定界段拔掉（有備份）、manifest 刪、`codex plugin list` 無 bstack；與安裝前 config 唯一差異是 `[marketplaces.bstack]`（刻意不拆，訊息有給指令）。之後重裝一次（第一次就成功）留給第 2-6 項 |
| 2 | 新 session `/hooks` 信任 | **未做**（互動 TUI）。以下 3-6 全用 `codex exec --dangerously-bypass-hook-trust`（文件明列給自動化用）。一度卡 `401 refresh_token_reused`（`codex login status` 顯示 Logged in 是假的、只讀 auth.json），user 重新 `codex login` 後通 |
| 3 | main 擋 / feature 放 | **第一輪沒擋**：hook 有被呼叫（探針記到 `tool_name: apply_patch`、`tool_input.command` 是 patch 文字、`CLAUDE_PLUGIN_ROOT` / `PLUGIN_ROOT` 都給、payload 多 `turn_id` / `permission_mode: bypassPermissions`），guard 也回 exit 2 + 訊息，**但 Codex 照寫檔**。用探針各試：stdout JSON deny + exit 0 → 擋（模型收到「Command blocked by PreToolUse hook: …」）；exit 2 + JSON → 不擋；exit 2 + stderr → 不擋。**結論：Codex（至少 Windows）不認 exit 2**。guard.mjs 改：payload 有 `turn_id` → JSON deny + exit 0；Claude Code 路徑不動（契約 P2e 加 e9 守）。改完真 guard 實測：main 擋（stderr 訊息完整送到模型）、`feat/x` 放。另一個插曲：第一次跑模型自己先 `git rev-parse` 看到 main 就停了（舊 `~/.codex/AGENTS.md` 的 branch 規則在起作用），要明令「第一個動作就是 apply_patch」才碰得到 hook |
| 4 | `.env` BLOCK；兩敏感檔 token | `.env` → BLOCK、檔沒建。`Dockerfile` + `docker-compose.yml` 一個 patch → 兩行 `--token`、「處置（依序執行）」一次；照抄兩行建 token（`--token` 子命令在 pwsh 跑，state dir 判定跟 hook 端一致：`C:/Users/TOMMY_~1/AppData/Local/Temp/bstack-file-guard-<user>/`）→ retry 放行、兩檔建好、`consumed.log` 兩筆檔名各對、token 已刪 |
| 5 | `$bstack:devwork 在 README.md 加一個「用途」段落` | 印 `[bstack devwork · plugin]` 橫幅 → 讀 `SKILL.md` / `rules.md` / `hosts.md`（用 pwsh `Get-Content`；先 `rg --files` 找不到再找對）→ 進 0a → 模型自述「Codex 目前沒有 `request_user_input` 工具，依 hosts fallback 用編號」→ 印「請回覆 1 或 2：1. Dev（推薦） 2. Bug」+ `[Trace] Phase=0a … Skill=bstack:devwork`。`update_plan` 未出現（0a 還沒到 TaskCreate 的點）。舊 `~/.agents/skills/dev-workflow` 沒有搶到（顯式 `$bstack:` 命名空間） |
| 6 | `spawn_agent security-auditor` read-only | 子 thread 的 rollout 確認：`agent_role = security-auditor`、model `gpt-5.6-terra`、developer message 就是我們的 `developer_instructions`（含 OWASP / 安全特化字樣）→ **TOML 有載入**。但 `sandbox_policy` 是父的 `workspace-write`，子 agent 真把 `a.txt` 改成 `hacked`；`-s workspace-write` 與 `-c sandbox_mode="workspace-write"` 兩種給法都一樣。文件：父 turn 有 runtime 覆寫時子一律沿用父的；互動無覆寫才用檔內值——**非互動驗不了**，記進 README 已知限制與 §待釐清 |

**Task 10 判定**：7 項中 1 / 3 / 4 / 5 / 7 綠、6 揭露一個文件層面的限制（已回填）、2 是互動步驟留給 user。實測環境：Windows 11、Codex CLI 0.153.4、`gpt-5.6-luna`。

### 追加：landing 文案雙 host 化（2026-09-09，user 在 pr-explain 後追加）

- 改 `docs/index.html`：title / og / twitter 標題與描述、hero 加 Codex 安裝指令、安裝節前置文案、卡 01 加 Codex 兩行指令與 `/hooks` 提醒、卡 02 標 Claude Code 專用、卡 03 加 `$bstack:devwork`。`docs/js/data.js` 的流程圖 label 不動（契約 C8d 守）。
- design-language：`scope=文件站`（`docs/reference/design-map.md`，token 來源 `docs/index.html` `:root`）、`size=小改`。四項對齊：元件狀態 → 新 `<pre>` / `<code>` 原樣抄同卡片既有 inline style（含 `style-hover`）；斷點 → N/A（沿用 grid `auto-fit`，未加 media query）；表單 → N/A（無表單）；dark mode → 只用 `--sunk` / `--line` / `--ink-3` / `--accent`，`:root[data-theme="dark"]` 已有第二套值。
- smoke（static-serve + Playwright）：標題與三處新文字都找得到；console 35 個 error 全來自內嵌 `flow.html?embed=1`（模板佔位字串在 JS 接手前被瀏覽器解析、`FLOW_DATA` 重複宣告），stash 回改動前同樣 35 個 → 既有問題，記 follow-up。

### request-review / receive-review（2026-09-09）

- code-review high 的主控 fork 收不到 finder 回報（finder 把結果送到主 session），verifier 由主 agent 接手；能實測的都用 Codex CLI 實測。整合結果與處置在 `code-review.md`。
- 兩個設計回退（實測定案）：hooks.json 退回單一 matcher `Write|Edit|NotebookEdit`（Codex 把 Write / Edit 當 apply_patch 別名，單一組照攔，spec 第 38 行的拆組假設不成立）；pr-explain 加回 `context: fork`（Codex 對它無反應）。兩者都是為了守「Claude Code 側零行為改變」。
- 新事實：Codex 的 apply_patch 相對路徑基準是 session cwd（payload `cwd`），不是 git toplevel；Codex 內建 agent 只有 default / worker / explorer；Codex 重寫 config.toml 會把別的表排進註解之間（定界拔法不可靠）。
