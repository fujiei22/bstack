# Plan review 總結

> Plan: docs/work/refactor/plugin-install/plan.md
> Tier: T3
> 視角: CEO + Design + Eng + DX（四個 subagent 獨立、互不通訊）
> 日期: 2026-09-04

## Critical 共識（多視角同時提）

| # | 問題 | 提出者 | 處置 |
|---|---|---|---|
| CC1 | **舊 `~/.claude/CLAUDE.md` 讓自動攔截復活**：第 114 行「寫 / 改 / 修 / 加類 prompt 一律進 dev-workflow」不清掉，舊使用者永遠得不到「不下指令 = 普通 Claude Code」；且 user 級 `~/.claude/skills/dev-workflow` 舊副本會靜默遮蔽 plugin 版，新舊台詞前綴相同、看不出載到哪個 | CEO C1、DX C2 | Task 6 `-Migrate` 偵測 bstack 簽名字串（`§事實核實` + `dev-workflow 為骨幹`）→ 相同就改名 `CLAUDE.md.bstack-bak-<ts>`、不同就印 diff 摘要與行號；`-Yes` 非互動路徑也印「偵測到 N 個舊副本」。Task 5a dev-workflow 台詞加 `· plugin` 標記；Task 4 devwork 用 `bstack:dev-workflow` 命名空間載入並實測能否繞過遮蔽 |
| CC2 | **hooks 隨 plugin 在所有啟用的專案生效，沒下 `/devwork` 也擋**，且 `branch-safety.ps1:78` 的擋人訊息指向沒載入的「§決策點選單」 | CEO C2、Design M2 | Task 7 主推薦**專案層級**啟用（template）、user scope 列第三並附後果；README 加「何時生效」矩陣（hooks / 守則 / extras 三列）；Task 3 兩支 hook 的 stderr 改成不依賴 rules.md 的白話 + `[bstack]` 前綴 + `/plugin disable bstack@bstack` 出口。session 標記 gating 列入 spec §4f 不做（理由：hook 無法可靠得知本 session 是否跑過 `/devwork`） |
| CC3 | **mysql MCP 只問 host，裝出來連不上**；`Invoke-Expression` 拼字串會把密碼留在歷史 / `-WhatIf` 印出 | CEO M2、Design C1、Eng M7、DX M2 | mcp 項**只做 playwright**；mysql 改印 README 指令範本讓使用者自填。`Invoke-Expression` 換 `& claude @args` |
| CC4 | **兩支測試都恆綠**：plugin-contract `description()` 對 `description: \|` 永遠抓到 `"\|"`（P3 / P7 半邊失效）；extras SelfTest 的 `$fails` local 與 `$script:fails` 不是同一個變數、d2 的陣列 `-eq` 會炸 | Eng C1 / C2 / C3 | Task 1 regex 改 `^description:[ \t]*\|[ \t]*\r?\n((?:[ \t]+.*(?:\r?\n\|$))*)`，`--selftest` 餵合成 frontmatter 斷言抓得到「觸發：」；P3 拆 P3a（數量 / name）與 P3c（無觸發詞）。Task 6 統一 `$script:fails`、加刻意失敗的 S0 反向驗證 exit=1、d2 改 `-join` 比對、全段 try/finally 還原 env 與清 temp |
| CC5 | **`-Uninstall` 會洗掉使用者自己的設定**：manifest 記靜態 key 清單而非實際新增的；本機已有 statusLine / allow 值也會被拔 | Design M7、Eng M4 | `Add-Item` 比對 merge 前後只記 `keys_added`；一個都沒加就印「你本機已有，未覆蓋」；SelfTest seed 放與名單重疊的值（`Read`、既有 statusLine）斷言 uninstall 後仍在 |
| CC6 | **SelfTest 的 project scope 斷言是空的**：fake HOME 與 cwd 同一目錄，寫到同一個檔 | Design M6、Eng M8、DX m3 | project 用 `$tmp/proj` 當 cwd |

## Critical / Major 各視角獨見（採納）

**CEO**
- M3 唯讀白名單兩份手抄已漂移一條 → extras 直接讀 `templates/project-settings.json` 的 allow；P5 加斷言 template 合法且含 `Read`。
- M4 公開站首要指令用保證形式 → landing / README 指令碼寫 `/bstack:devwork`，文案標題叫「/devwork」並註明裸名目前可用（與 Design M5 合併：保底只出現在 SKILL description 一句 + README 一行「打 `/devwork` 若出現 Unknown command 就改打 `/bstack:devwork`」）。
- M5 landing 第一步只放一條主路徑，README 才展開三種；clone 者是否自動裝 → post-merge 實測回填。
- m3 `CLAUDE_CODE_ENABLE_TODO_TOOLS` 無 skill 依賴 → env 項只留 AGENT_TEAMS。
- m1 `-Migrate` 剝 hooks 只過濾 group 內元素，group 空了才刪。

**Design**
- C2 `claude mcp add --scope project` 寫的是會進 git 的 `.mcp.json` → mcp 項提示改「[P] 專案 `.mcp.json`（會進 git、隊友共用）」，manifest 記實際檔。
- M1 landing hero `:44` 「零 marketplace 依賴」、`:46` 「誰都繞不過的規則書」、`:61` 「每個請求先跑 Phase 0」與新模型矛盾 → Task 7 三處純文字改寫；grep 紅線加 `marketplace 依賴|繞不過`。h1 不動（memory）。
- M3 `/devwork` 連噴兩條橫幅、沒帶文字時順序顛倒 → 只留 devwork 一條，分「有文字 / 沒文字」兩式；dev-workflow 被 devwork 載入時不另印；問「要做什麼」用一般文字不用 AskUserQuestion。
- M4 `/devwork <純問題>` 沒出口 → 保留一行 escape：純問答直接答、結尾提示 `/devwork` 是給改動用的。
- M6 選單每項只印內部 key → 開頭印兩個層級的解析後絕對路徑、cwd 非 git repo 印黃字、cwd 等於 home 上層拒絕 P；每項前印白話說明 + 建議層級。
- M8 重跑無回饋、statusLine 路徑永遠更新不了 → 每項先查 manifest，已裝顯示「[R] 重裝 / [S] 略過」，statusLine 重裝時覆蓋。
- M9 壞 JSON 中途死掉 → `Read-Json` try/catch，壞檔跳過該項並繼續；SelfTest 加壞 JSON 案例。
- M10 首次安裝者被 `-Migrate` 的 CLAUDE.md 黃字誤導 → 無舊副本一行都不印；CLAUDE.md 那句只在偵測到 bstack 簽名時印。
- m3 rules.md 內 `templates/project-settings.json` 相對路徑對 plugin 使用者不存在 → 寫 GitHub URL。
- m4 / n2 manifest 住 `~/.claude/bstack-extras.json` 違反「不寫 ~/.claude」字面 → README 加註；25 個 skill 描述不硬寫 `/bstack:` 前綴，只在 devwork SKILL.md 講一次。
- m6 `bstack@bstack` 像打錯 → README 一句「前面是 plugin、後面是 marketplace」。

**Eng**
- M1 / M2 / M3 P4 的紅綠歸屬錯：rules.md 新文字含 `~/.claude/settings.json`（Task 4 造成）；README / index.html / data.js 是 Task 7 的；`design-language:23`、`execute-plan:57`、`write-skill:177` 漏列 → P4 加行級白名單（含「舊版 / 遷移 / -Migrate / 不寫入」的行跳過）；Task 5b files 補三處；Task 5b 綠改「P3 / P7 PASS、P4 只剩 Task 7 檔」。
- M5 Uninstall 後 `env` 留空物件 → `Remove-KeyPath` 移除葉後父物件空則一併移除。
- M6 `Save-Manifest 'mcp' ... @('mcp:playwright') + $(...)` 引數模式下 `+` 變多餘位置參數 → 加括號；`Save-Manifest` 加 `[CmdletBinding()]`。
- M9 備份秒級時間戳同秒覆蓋、manifest 也備份 → 每次執行共用一個時間戳且每檔只備份一次；manifest 不備份；寫檔改 temp → Move-Item 原子替換；先寫 manifest（pending）再寫 settings。
- N1 並行依賴：Task 3 / 4 的 Step 4 實測需要 Task 2 的 plugin.json → Task 2 拉到 group 1；Task 4 落地後 docs-site-contract C8b / C18 預期紅到 Task 7，plan 明寫；Task 5a / 5b 同 worktree 平行時 `git add skills agents` 會混 → 5b 改明列檔案。
- N2 數字：99 / 136 正確；spec §4d「137、淨 +2」是算錯，execute 時修 spec；契約「歷次基線」字串接成 `→ 98/135 → 99/136`。
- N4 `setup.ps1:125-165` 應為 `125-167`。
- N5 statusLine 路徑綁 `$RepoRoot`，從 plugin 快取跑會指進快取 → extras 偵測 `$RepoRoot` 落在 `plugins/cache` 底下即警告；README 明寫從 clone 跑。
- N6 `-Migrate` 漏 `~/.claude/state/file-guard/`；`settingsTouched` 應比較過濾前後長度。
- N7 P2c 去註解沒處理 `<# #>` 區塊 → 一併剝除。
- N9 舊 settings.json 的 `attribution` 區塊 → **定案：不接**（它是作者個人偏好，與流程無關），spec §4a 註明。
- N10 冪等：同 item+scope+file 已在 manifest 則跳過。
- Nit：`app.js:51 / :54` 的 36 / 34 → 37 / 35；`index.html:50` 節點數 `<b>100</b>` 本來就錯 → 改 99；`file-type-guard.ps1:8`、`branch-safety.ps1:9` 的 CLAUDE.md / 全域字樣順手改。

**DX**
- C1 「沒反應」無診斷路徑 → README 加 §確認 plugin 有載入 三步（看台詞 → `/plugin` 看 enabled → `--plugin-dir` 對照）。
- M1 沒 pwsh 7 的 hook 失敗體驗 → README prerequisites 明寫 pwsh 7+ 是 hook 必需 + mac/Linux 安裝指令；Task 3 Step 4 補反向實測（PATH 拿掉 pwsh）並抄錯誤文字進 troubleshooting；含空白路徑跑一次。
- M3 加 skill 要動 7 處 → `write-skill` 加「新 skill 落地 checklist」；plugin-contract 加 P8：README `## Skills（N）`、index.html `<b>N</b>` 等於磁碟 skill 數。
- M4 bash / pwsh 區塊混用、`$?` 語意 → §測試策略 加說明（pwsh 用 `$LASTEXITCODE`）；plugin-contract 檔頭抄 docs-site-contract 警語；Step 命令按 shell 分區塊。
- m1 全跳過仍印「完成」→ 結尾印「本次寫入 N 項 → 檔案清單」，0 項印「沒有寫入任何檔案」。
- m2 `BSTACK_CLAUDE_HOME` 無防線 → 一般路徑偵測到就印黃字；SelfTest try/finally。
- m4 三種「拆掉」缺對照 → README 三列表（`/plugin uninstall` / `-Uninstall` / `-Migrate`：拆什麼、不碰什麼）。
- m5 README 缺貢獻者段 → 加 `## 開發本 repo`（`--plugin-dir .`、三支驗證指令、重產 references）。
- m6 「§跨流程 skill 觸發」改名後 `write-skill:185,190`、`execute-plan:53` 引用 → Task 5b 加 grep。
- m7 / CEO m4 repo 內 rules.md 載兩次 → devwork SKILL.md 加一句「CLAUDE.md 已 import 則不重讀」。
- n1 `docs/design-demos/_content.js:122,132` 殘留 `setup.ps1` → 該目錄在 `.gitignore`（`**/design-demos/`），不入版控、不改。

## 未採納（附理由）

- **CEO M1 縮成 MVP（extras 選單延後）**：user 已於 2026-09-04 定案要選單；但 CEO 提出後選單的 Major 數量（Design 10 條、Eng 9 條）確實集中在 extras.ps1。**交 user gate 決定**（見下）。
- **CEO C2 的 session 標記 gating**：hook 無法可靠判斷「這個 session 跑過 `/devwork`」（token 會跨 session 殘留、多 session 互相干擾），列入 spec §4f 不做並寫理由。
- **CEO m5 marketplace source 排除 docs/**：量小可接受，記入 spec §7 風險不改。
- **Eng N9 attribution**：不接，見上。

## 主 agent 建議

- **必處理**：CC1–CC6 六條共識。
- **建議處理**：上列各視角 Major 與標「採納」的 Minor（共約 30 條），多數是 Task 6 / Task 7 的細節與 Task 1 的斷言修正，不改架構。
- **交 user 決定**：extras.ps1 保留完整選單（照 plan + 上述修正，Task 6 會長到約 300 行），或縮成「只做 `-Migrate` + statusLine / env 兩項」先出、permissions 走 template、MCP 走 README 指令範本。
