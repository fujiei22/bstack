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
4. skill 文字的雙 host 化：`request-review`（code-review 段）、`dispatch-parallel`（移除 Agent Teams 分支）、`brainstorm` 0a（memory 路徑依 host）、`rules.md` Tier 表 review 欄與 §決策點選單、`pr-explain` 移除 `context: fork`、`devwork` 讀 hosts.md。其餘 skill 保留 `AskUserQuestion` 等字樣當抽象動詞，由 hosts.md 定義。
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
| `hooks/hooks.json` | 不動 | 低：matcher `Write\|Edit\|NotebookEdit` 在 Codex 是 apply_patch 別名，`${CLAUDE_PLUGIN_ROOT}` Codex 相容 |
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
| `agents/*.md`（6 個） | 不動 | — |
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
- **guard.mjs 多檔判定**：一個 patch 多個檔任一命中就 exit 2；WARN token 路徑以檔為單位，多檔 WARN 時使用者要建多個 token（訊息逐檔列）。
- **同一份 hooks.json**：Codex 的 `Write|Edit` 別名對 `apply_patch` 生效；`NotebookEdit` 在 Codex 永不匹配，無害。

## 待釐清
- Codex 安裝後 skill 命名空間實際顯示為 `$bstack:devwork` 還是 `$devwork`（文件以 `$codex-security:security-scan` 為例，推定前者）；verify-done 實測後回填 README。
- `codex plugin marketplace add ./`（本機路徑）在 CLI 上的可用性（文件說本機測試建議 desktop app）；不可用時 README 改寫「本機試用走 desktop app 或 `~/.agents/plugins/marketplace.json`」。

## 施工紀錄
<!-- execute-plan 施工中追加 -->
