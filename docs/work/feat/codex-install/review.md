# Plan review 總結
> Plan: docs/work/feat/codex-install/plan.md
> Tier: T3
> 視角: Eng + DX + Design（三個獨立 subagent，Opus；Eng 與 DX 都實跑了 plan 的掃描與 guard 判定）

## Critical 共識（多視角同時提）

**CC1. apply_patch 相對路徑讓 file-type 段在 Codex 上靜默失效**（Eng C1 實測、Design C1）
guard.mjs 的 WARN / BLOCK regex 有一半要求前導斜線（`/\/dockerfile/`、`/\/package-lock\.json$/`、`/\/\.github\/workflows\//`、`/\/credentials\./`、`/\/\.npmrc$/`…）。Codex 的 `*** Update File:` 慣用 repo 相對路徑，實測 Dockerfile / package-lock.json / .github/workflows/ci.yml / credentials.json / docker-compose.yml / .npmrc 六類相對路徑全部 exit 0。plan 的 fixture 驗 WARN 的全用絕對路徑，所以全綠而保護不存在。
**處置**：`targetsOf` 對 apply_patch 來源的路徑標 `relTo: 'repo'`，只有這批在進兩段判定前 `path.resolve(ctx.repoDir, …)`；Write / Edit / NotebookEdit 維持原樣（fixture 9 裸 `credentials.json` → 放 的既有行為不動）。補相對路徑 fixture：`Dockerfile` → WARN、`package-lock.json` → WARN、`.github/workflows/ci.yml` → WARN、`credentials.json` → BLOCK。

**CC2. P14 禁字清單自我矛盾，且會逼掉既有規則精度**（Eng C2、DX C1、Design C2）
`/\.claude\/(skills|settings)/` 命中的是 brainstorm:50 / design-language:14 / execute-plan:37 的「剔除 skill 定義目錄」舉例（P11 守的規則）與 write-skill 的位置說明——正確做法是**補** `.agents/skills/` 不是刪；plan 給 write-skill 開的雙 host 寫法本身就命中 ban。`/@import/` 會命中 design-language:85 的 **CSS at-rule**，照 plan 改寫會刪掉 token 追溯指令，P14 上線後永久鎖死。
**處置**：禁字改帶語境：`@skills\/devwork\/rules\.md`（Claude 的引用寫法）、`~\/\.claude\/projects`、`\bSendMessage\b`、`^context: fork$`、`\/bstack:`、`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`、裸 `NotebookEdit`（同行無「Claude Code」註記）。`.claude/skills` 改成**正向雙寫斷言**：出現的行必須同時含 `.agents/skills`。design-language:85 不改。三處剔除規則同步加 `.agents/skills/`、P11 仍綠。

**CC3. group 1 檔案重疊、Task 6 的紅不是自己的**（Eng C3、DX M1、Design M2）
實掃 14 處命中在 11 檔：devwork:13（`@import`）歸 Task 2、brainstorm:31 歸 Task 5 但 :50 無人認領、dispatch-parallel `:40` 與 `:94` 分屬 Task 5 / Task 6 同組撞檔、pr-explain 歸 Task 5；反向 finish-branch / lock-files / hypothesis-tester / security-auditor 四檔 0 命中、等於裸改。
**處置**：Task 6 移到獨立 group（在 Task 1-5 / 7 / 8 之後）、Step 1 只掃自己 files；dispatch-parallel 整檔歸 Task 5（含 `:10` 首句、判準表、§選單範本、`:40`、`:94`）；brainstorm:50 歸 Task 5；devwork:13 歸 Task 2；`NotebookEdit` 進禁字讓四檔有紅測試。

**CC4. hook 訊息指向 hosts.md，但 hook 在沒跑 /devwork 的 session 也會噴**（DX C2、Eng M1）
README §Hooks 明寫 hook 不需 `/devwork` 就生效，擋人當下 AI 手上沒有 hosts.md。單獨呼叫 finish-branch / retro 也一樣。
**處置**：guard.mjs stderr 一律自帶答案（「Claude Code 用 `AskUserQuestion`；Codex 用 `request_user_input`，工具不在清單就文字提問、選項編號」），不引用任何 skill 檔；含 `guard.mjs:120` branch 段那句（DX m7）。rules.md 加一段 5 行的抽象動詞濃縮表（rules.md 有「找不到 §事實核實 就重讀」機制，hosts.md 沒有），hosts.md 留完整表。

## Critical 各視角獨見

**DX C3. devwork 的呼叫語法在 Codex 上是錯的、無人認領**：`skills/devwork/SKILL.md:5` description 與 `:34` 的 `/bstack:` 清單。→ Task 2 files 補 `:5` 與 `:34`，改雙 host；`/bstack:` 進禁字（hosts.md / README 例外）。

## Major / Minor / Nit（去重後合併）

**Major**
- **M-hooks.json 拆兩個 matcher group**（Design M1）：`"Write|Edit"` 與 `"NotebookEdit"` 各一組、command 相同；Claude Code 零改變，換掉「regex 含 NotebookEdit 在 Codex 仍匹配」這條純推斷。spec「hooks.json 不動」改為「拆 group」。同時**新增 Task 0（group 0）**：以當前 branch 為本機 marketplace 裝進 Codex、`/hooks` 信任、在 main 上要 Codex 改檔，證明 hook 會被呼叫且 exit 2 生效——它證偽的是 Task 1-9 的共同前提，不能排最後。
- **M-repoDir fallback**（Eng M2）：Codex 上 100% 走 git toplevel；toplevel 回來的路徑若不含任何 target 就當「不知道」照查 branch（fail-closed）；Task 0 / 10 印 hook 進程 cwd 與算出的 repoDir；rules.md §Branch safety 豁免段那句「只管 `$CLAUDE_PROJECT_DIR` 底下」補 Codex 寫法（Task 2）。
- **M-decide 兩趟式**（Eng M3 / M4、Design M3 / M4）：targets 先 dedupe；branch 段對 payload 判**一次**（不逐檔）、`getBranch` memoize；file-type 第一趟只判不消 token，全部 WARN 都有 valid token 且無 BLOCK / branch 阻擋才第二趟 consume；`consumeToken(tokenPath, target)` log 寫實際檔名。補 fixture：兩 WARN 一 token → exit 2 且另一 token 仍在；同路徑重複 → 只判一次；BLOCK + WARN 混合 → token 未被消耗。
- **M-多 WARN 訊息壓縮**（DX m6）：共用步驟 / 備註 / DISABLE_HINT 只印一次，逐檔只印 `WARN：<tag>：<path>` 與該檔 `--token` 行；>5 檔只列 5 個並註明剩餘數。
- **M-產生器改推導**（Eng M5、Design M5、DX m4）：`sandbox_mode` 由 `tools:` 含 Write / Edit / NotebookEdit → `workspace-write`，否則 `read-only`（frontend-e2e-runner / pr-explainer 明標 workspace-write）；MCP server 名由 `mcp__(\w+)__` 前綴推導、對照 `MCP_TEMPLATES`，缺對照 → exit 1 指名 agent；`MODEL` 查不到 → exit 1 不靜默降級；TOML 頂端註解寫死「本 agent 需要 server 名恰為 `mysql`」。
- **M-MCP 範本註解化**（Eng M6）：`[mcp_servers.*]` 整段 `#` 註解、留「取消註解並填入」說明；playwright pin 版本。
- **M-marketplace 語意**（Design M6、Eng m8）：`.agents/plugins/marketplace.json` 的 `source.path: "./"` 基準未驗；Task 0 記 `codex plugin marketplace list --json` 載到哪一份、`installedPath` 解析成什麼；P13 加交叉斷言（兩份 marketplace 的 plugin `name` 相同；Codex 版 `source.path` 目錄下存在 `.codex-plugin/plugin.json`）。
- **M-P14 加反向白名單**（Design M7）：從 hosts.md 各節第一欄抽反引號內抽象動詞當白名單；skills / agents 內出現的已知 Claude 工具名（`AskUserQuestion|TaskCreate|TaskUpdate|TaskList|TaskOutput|Agent|subagent_type|NotebookEdit|Skill\("code-review"|SendMessage|ExitPlanMode|WebFetch`）不在白名單就紅，訊息指「先在 hosts.md 定義」。hosts.md 開頭註明節標題與第一欄是契約鍵。
- **M-安裝腳本契約**（DX M3 / M4）：比照 extras.ps1 記 `~/.codex/bstack-codex.json` manifest、加 `-Uninstall` 只拆 manifest 內的；既有同名 TOML 互動問「覆蓋 / 跳過 / 全覆蓋」，`-Yes` 才走預設；README §完全移除 補一列。
- **M-dispatch-parallel / rules.md 協作模式**（DX M5）：`:10` 首句、判準表 Agent Teams 欄、§選單範本、§隊友派工 整節標「（Claude Code 限定）」；rules.md §協作模式判定 加「Codex：無 Agent Teams，同 group ≥2 task 就問 subagent 平行 / 串行，不做開關偵測」。
- **M-契約訊息**（DX M6）：P13-P16 每條附「後果 / 改處」（本 repo 慣例）。
- **M-README 入口**（DX M8、Eng M9）：`README:3` 簡介改涵蓋兩 host；§Hooks 補「Codex 需 `/hooks` 信任，否則保護不存在」並指到 ## Codex 節；Codex 節照抄 marketplace 無版本 pin 的供應鏈警語，加「install-codex.ps1 會寫 `~/.codex/agents/` 與 `~/.codex/config.toml`，先備份」；Task 8 斷言涵蓋這三處。
- **M-hosts.md 結構**（DX M9 / M10 / m1 / m2、Design m2、Eng m4）：八節（加 `## §MCP 工具`），每節完整表頭、四欄 `| 抽象動作 | Claude Code | Codex | 工具不在清單時 |`；檔案第一行放護欄「本表的 AskUserQuestion 等是抽象動詞不是工具名；動作前先確認同名工具在你的清單，不在就照表、不要找同名工具也不要靜默略過」；§Host 判定 加「subagent context 內沒有決策工具是正常的，回報主 agent」；§決策點 加編號 gate 的理由與「回的不是清單內編號一律重問」。
- **M-rules.md 掃描**（DX M7、Design n1）：P14 集合刻意只含 SKILL.md + agents（程式碼註解寫明）；rules.md 的 host 專屬字面由 P16 明列斷言守（§Branch safety 停用提示同時有 Claude / Codex、§決策點選單 指 hosts.md、Tier 表 review 欄含 Codex）。

**Minor**
- Task 1 fixture 編號改 31-37 起（既有 1-30）（Eng M7、Design m7）；補截斷 patch、CRLF 全篇、`Move to` 相對路徑三案（Eng m6）。
- Task 8 regex `/\| \*\*Codex CLI[^|]*\*\* \|/`（Eng M8）；Prerequisites 與 §Hooks 段末「兩支可選腳本」改三支（DX m3）；§開發本 repo 加 `node scripts/gen-codex-agents.mjs --check` 與新 agent 三行 checklist（DX m5）。
- 產生器：`desc()` 只吃 `[ \t]` 不用 `\s`（CRLF 實測留裸 `\r`）並支援 `|-` / `>-`（Eng m1）；`'''` literal string、本文含 `'''` → exit 1（Eng n2、Design m8、DX n1）；`isMainModule()` 包主流程（Design m9、Eng n1）；`applyPatchPaths` 註解說明 `^\*\*\* ` 錨定安全（Eng n3）。
- Task 7 驗收：`${PIPESTATUS[0]}`、四個 pattern 各 `grep -q`（Eng m2）；node / git 缺席的後果與下一步（DX n3）。
- Task 9 收尾鏈三支都跑：`plugin-contract.mjs`、`docs/tools/docs-site-contract.mjs`、`build-references.ps1 -Check`（Eng m3；memory `feedback-finish-chain-and-check-after-skill-edit`）。
- 紅測試不用 `node -e`（Bash 工具吃反斜線），先 Write 成 scratchpad 的 `.mjs` 再跑（Eng 回答 4；memory `reference-bash-tool-eats-backslashes`）。
- hosts.md 節標題比對改行首錨定 regex `/^##[ \t]+§決策點[ \t]*$/m`（Design m1）；`## §Code review` 統一中文 `## §程式碼審查`（DX n4）。
- P13 加 `skills` 目錄存在、`hooks` 若填了必須存在（Design m3）；版本是三處不是四處，plan 與 P13 訊息改正（Design m4）；`.claude-plugin/*` 三處 description 改 host 中性（Design m5）。
- review-plan:57 的實測依據句保留、句尾加 Codex 對應（Design m10）。
- spec §4b 的「契約 P12」改 P14 / P16（Eng m5）；Task 6 Step 2 預期值改「14 處、11 檔」（DX n2）。
- guard.mjs docstring 的計時與 lazy 描述跟著改（Eng m7）。

**Nit**
- `MODEL` 表的 `opus` / `haiku` 是死碼，留著但改成查不到 exit 1（Eng n4，併入 M-產生器）。

## 主 agent 建議
- **必處理**：CC1 / CC2 / CC3 / CC4、DX C3、Design M1（含 Task 0）。
- **建議處理**：上列全部 Major 與 Minor（每條都是低成本、且多數已有實測依據）。
- **略過**：Design m6（P2a 放寬 `CODEX_PLUGIN_ROOT`：目前 Codex 有相容變數，YAGNI，等真的要拆再開）；Design m11（docs 站給 hosts.md 入口：hosts.md 是 agent 讀的對照表，站上入口另開 follow-up，不併進本 PR）。
