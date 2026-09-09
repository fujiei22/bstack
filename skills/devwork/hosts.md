# hosts.md（host 對照表）
> **本表裡的 `AskUserQuestion` / `TaskCreate` / `TaskUpdate` / `TaskList` / `Agent` / `subagent_type` / `SendMessage` / `mcp__<server>__<tool>` 是抽象動詞不是工具名。** 動作前先確認同名工具在你自己的工具清單裡；不在，就照本表對應欄——**不要去找同名工具、也不要靜默略過該動作**。§Host 判定 只是預設值，工具清單永遠優先。
> 八個節標題與每節第一欄是契約鍵（plugin-contract.mjs P14 / P16），改名要同步。
> 工具名在 skill 內文的三種待遇（P14 守）：**列在本表第一欄的**可直接當抽象動詞寫（`AskUserQuestion`、`Agent`…）；**只有一個 host 有的**（`NotebookEdit`、`SendMessage`）要同行寫出另一個 host 的對應（例「Claude Code 用 `SendMessage`；Codex 靠 `wait_agent` 收」）；**都不是的**新工具名先加進本表對應節再用。

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
| `TaskOutput`（收背景 task / 內建 code-review 的結果） | 同名工具；forked 的結果也會走 task-notification 送回 | `wait_agent` 收 `spawn_agent` 的結果（Codex 沒有內建 code-review，見 §程式碼審查） | 結果寫在最終回覆裡，主 agent 自己讀 |

## §派 subagent
| 抽象動作 | Claude Code | Codex | 工具不在清單時 |
|---|---|---|---|
| `Agent` + `subagent_type: <name>` | 同名工具、`subagent_type: bstack:<name>` | `spawn_agent`，agent 名 = `~/.codex/agents/<name>.toml` 的 `name`；收結果 `wait_agent` | 沒裝 TOML → 內建 `explorer`（唯讀）或 `worker`，把 `agents/<name>.md` 本文貼進 prompt；連 spawn 都沒有 → 主 agent 自己做並在回報標「未隔離」 |
| `SendMessage`（subagent 回結論 / 隊友通訊） | 同名工具 | 結論由 `wait_agent` 收；追加指令 `send_input` | 把結論寫在最終回覆 |

## §程式碼審查
| 抽象動作 | Claude Code | Codex | 工具不在清單時 |
|---|---|---|---|
| 內建 `code-review`（`Skill("code-review", args="medium\|high")`） | 同左，結果走 task-notification | 無可由模型呼叫的內建 review：T2 `spawn_agent` 內建的 `explorer`（唯讀；Codex 內建只有 default / worker / explorer，沒有 `reviewer`）帶 request-review §Codex reviewer prompt；T3 同上 + 對齊 subagent；另提醒 user 可自跑 `/review`。覆蓋面低於 8 finder，finding 分級不變 | 主 agent 自審並標「未隔離」 |

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
