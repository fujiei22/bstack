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
- Codex 安裝後 skill 命名空間實際顯示為 `$bstack:devwork` 還是 `$devwork`（文件以 `$codex-security:security-scan` 為例，推定前者）；verify-done 實測後回填 README。
- `codex plugin marketplace add ./`（本機路徑）在 CLI 上的可用性（文件說本機測試建議 desktop app）；不可用時 README 改寫「本機試用走 desktop app 或 `~/.agents/plugins/marketplace.json`」。

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
