# Review 整合結果
> Tier: T3
> code-review: high（8 finder 候選 ≈ 40 條；主控 fork 收不到 finder 回報、verifier 由主 agent 接手逐條驗）
> Reviewers: code-review + 對齊 subagent（Eng 架構視角，Opus）
> 驗證方式：能實測的都實測（Codex exec、本機 config.toml、`codex debug prompt-input`），其餘讀 code 判定

## Critical
- **[code-review C] `scripts/install-codex.ps1` `-Uninstall` 的 begin / end 定界會吃掉使用者設定**。實測本機 `~/.codex/config.toml` 第 77-87 行：Codex 重寫設定檔時把 `[tui]`、`[tui.model_availability_nux]` 排進了兩個註解之間，現在跑 `-Uninstall` 會連它們一起刪。**CONFIRMED**。
- **[code-review B / A、對齊 M2] `guard.mjs` 的 Codex 判定只靠 `turn_id` 一個訊號，缺了就退到 exit 2 = Codex 靜默 fail-open**。**CONFIRMED（推理）**：Task 10 已證 Codex 不認 exit 2；子 agent / 未來欄位改名都會走到這條路。
- **[code-review C / A、fork 筆記 1] apply_patch 相對路徑以 git toplevel 解析，Codex 實際以 session cwd 解析**（payload 帶 `cwd`）。子目錄 session 下 `workflows/ci.yml` 這種路徑會算成不在 `.github/` 下 → file-type WARN **fail-open**、token hash 與 consumed.log 記錯檔。**CONFIRMED（讀 Codex hooks 文件 + 探針 payload）**。
- **[code-review B、對齊 M3] pr-explain 拔掉 `context: fork` 是 Claude Code 側行為改變**（不再 fork 到獨立 context），違反 spec Goal。實測 Codex 對 `context: fork` 無反應（`codex debug prompt-input` 照列）→ 拔掉沒有必要。**CONFIRMED**。

## Major
- [對齊 M1] hooks.json 拆兩組：Claude Code matcher 若非錨定，`Write|Edit` 可能連 `NotebookEdit` 一起命中、guard 跑兩次。**實測單一 matcher 在 Codex 上照攔** → 拆組沒必要，退回單一組（零改變），P13 改守「有一組含 Write 與 Edit」。
- [code-review B] `review-plan:52` 把「用 SendMessage 送回」改成指向 subagent 讀不到的 hosts.md；`dispatch-parallel:92` 同型。**CONFIRMED**：spawn 出去的 reviewer 沒有 plugin 路徑可讀。改成同行雙 host 字面（Claude Code `SendMessage` / Codex 由 `wait_agent` 收），P14 的 SendMessage 禁字改 context-aware。
- [code-review B] 過期 token 不再被刪與記 `valid=False`（稽核軌跡退化）。**CONFIRMED**（第一趟只 peek）。
- [code-review A / B] `WARN_LIST_MAX=5` 截斷 + 只 peek 不消耗 → 超過 5 檔的 patch 在 TTL 內可能永遠收斂不了。**CONFIRMED（推理）**。拿掉上限、全部列出。
- [code-review alt / A、fork 筆記 2] `gen-codex-agents.mjs` 的 `mcp__([^_]+)__` 對含底線的 server 名靜默失敗。**CONFIRMED**（本 session 就有 `mcp__claude_ai_Microsoft_365__`）。
- [code-review alt] `tools:` 只認 JSON 陣列，逗號寫法靜默變 read-only。**CONFIRMED**。
- [code-review reuse] 產生器的 description 對「只有 `|` 沒內容」會產出 `description = "|"`。**CONFIRMED（讀 code）**。
- [code-review A] `install-codex.ps1` 沒偵測 `tools = { … }` inline table，append 後整份 config 讀不了。**CONFIRMED（TOML 規則）**。
- [code-review C] 同名 marketplace 已存在就跳過，不比對來源與 `-Source` 是否一致。**CONFIRMED**（本機就是這狀況）。
- [code-review C] hosts.md / request-review 要 Codex spawn `reviewer`，但那不是內建 agent、repo 也沒產它。**CONFIRMED**（文件內建只有 default / worker / explorer）。改成 `explorer`。
- [對齊 M5、code-review C] rules.md §Branch safety 仍寫「hook 只攔 Write / Edit / NotebookEdit」，沒提 apply_patch。**CONFIRMED**。
- [code-review B] brainstorm `:31` 把「沒讀過不能進 0b」放寬成自報 flag，Claude Code 側 invariant 消失。**CONFIRMED**。改成 Claude Code 必讀成功、Codex 才允許 false。
- [對齊 M4] install-codex.ps1 零契約覆蓋。**CONFIRMED**。把 plan 的 `-WhatIf` 冒煙斷言收進契約 P17。
- [code-review eff] Codex 路徑每次 apply_patch 跑兩次 git（toplevel + branch），合併一次省約 97 ms（finder 實測）。**CONFIRMED**。

## Minor
- [conv / 對齊 n1] guard.mjs 檔頭第 7 行「兩 host 契約相同：exit 2」與實作矛盾。
- [simplify / reuse] `gitToplevel` 與 `getBranch` 重複同一段 git spawn 邏輯 → 併成 `gitOut`（與上面合併 spawn 一起做）。
- [simplify] `targetOf` 相容殼無呼叫端 → 刪。
- [simplify] `peekToken` 缺席的 fallback 分支無人走且行為錯 → 改成必填。
- [simplify] 契約 `apRun` 對同一 ctx 重跑累積 `consumed` → 每次用新 ctx2。
- [reuse] 契約新加的 `J` 與既有 `parseJson` 重複 → 用既有的。
- [reuse] docs-site-contract 的 2 / 白名單寫死兩處 → `EXTRA_REFS` 常數。
- [reuse] install-codex.ps1 的 manifest 非原子寫入 → 先寫 tmp 再 Move。
- [reuse] `-Migrate` 判定與 extras.ps1 `Test-BstackSkillDir` 分岔（extras 多要求內文含「（繁中）」）→ 對齊。
- [eff] 重試對任何非零 rc 都重試 → 只認「存取被拒 / os error 5」。
- [eff] `New-Item` 在 foreach 內 → 提到迴圈外。
- [alt] `.gitattributes` 範圍 `*.toml` 太寬、註解說法不對 → 限 `codex/agents/*.toml`。
- [對齊 m2] dev-workflow Phase 5 沒 Codex 註記（P9c 字面保留）。
- [對齊 m3] 產生器不掃孤兒 TOML → `--check` 與產生時都報。
- [對齊 m5 / m6] P16 補表頭比對、補 request-review `§Codex reviewer prompt` 存在斷言。
- [對齊 m1] hosts.md 護欄補一句「三種待遇」原則。
- [對齊 m4] TOML header 加 plugin 版本戳。
- [conv] README 差異表「停用 plugin」欄漏 `/hooks`。
- [fork 筆記 5 / 6] manifest 缺欄位時 `installed_at` 先於 guard 賦值；覆蓋使用者的 agent TOML 前沒備份。
- [alt] P14 的 TOKEN14 是手維護清單 → 註明；本輪不改機制。
- [conv] 20 顆 commit 有 15 顆 subject 超 50 字 → squash merge 時 finish-branch 重寫 PR title；本輪不 rebase 改史。
- [eff] `peekToken` / `consumeToken` 重複 stat；e8 與 fixture 42 重疊 → 略過（微秒級、且 e8 守的是 CLI 端到端）。

## Nit
- [對齊 n3] `developer_instructions = '''` 後多一行空行 → `body.trim()`。
- [對齊 n2] TOKEN14 的 `\bAgent\b` 會命中散文 → 白名單放行，實質不設防；本輪只註明。

## 略過（附理由）
- [conv] branch 名 `feat/codex-install` 只有 2 字：docs/work 路徑綁定 branch 名，改名代價大於收益。
- [C] `docs/index.html` 首頁 DOCS 索引沒有 hosts.md：spec 明列 docs/index.html 排除；記入 follow-up。
- [alt] 一律輸出 JSON deny 取代 host 分流：Claude Code 對 exit 0 + JSON deny 的行為本輪沒實測，維持「Claude Code 用官方 exit 2」；改以雙訊號降低 fail-open 風險。
- [eff] P15 改 in-process 比對：`--check` 的 CLI 接線也是 P15 要守的東西，320 ms 可接受。
- [fork 筆記 3] Run-Codex 在 EAP Stop 下會 throw：fork 自己實測已 REFUTED。

## 主 agent 建議
- 必處理：Critical 4 條。
- 建議處理：Major 全部、Minor 大部分（上面沒標「略過」的）。
- 略過：見上節。

## 處置結果（receive-review，commit 5fa1ecb）
- 危險類四題走 AskUserQuestion：Uninstall 改只拆表（採）、guard 雙訊號 + payload.cwd（採）、hooks.json 與 pr-explain 退回原樣（採）、brainstorm memory 門檻（**user 決定兩個 host 都維持「讀得到就讀、讀不到也繼續」**，不改）。
- 其餘不危險類一顆 commit 修完；三支收尾鏈綠、P2d 46 案、P17 新增。
- 修法實測（Codex CLI 0.153.4）：假 CODEX_HOME 放「[tui] 夾在定界之間」的 config 跑真 `-Uninstall` → 只拔 update_plan 表、[tui] 留著、舊註解清掉；新 guard 在 main 擋、`feat/x` 子目錄 cwd=`.github` 的 `workflows/ci.yml` 命中 CI WARN（用 toplevel 解析會漏）。
- 本機 `~/.codex/config.toml` 的兩行舊定界註解已清掉（備份 `.bak-20260909-receive-review`）。
- 列入 follow-up（不在本 PR）：`docs/index.html` 首頁 DOCS 索引加 hosts.md；TOKEN14 改成機械抽取；P15 in-process 比對。
