# Plan review 總結
> Plan: docs/work/feat/db-mcp-user-installed/plan.md
> Tier: T3
> 視角: Eng + DX + Design（2026-11-09，三個獨立 subagent）

## Critical 共識（多視角同時提）
1. **密碼輸入與非 TTY**（Eng M5、DX C3、Design C1）：
   - pipe、Git Bash、Claude Code 的 `!` 前綴下 `setRawMode` 不存在。
   - 經 AI 執行時，密碼會進對話。
   - 契約用 pipe 餵 stdin，等於只測到假分支。
   - → 非 TTY 時拒絕互動、偵測 AI 環境就拒絕；按鍵序列處理寫成 lib 純函式測；stdout 與 stderr 都斷言不含密碼。
2. **DSN 經 host CLI 的 argv 與 Windows `.cmd`**（Eng C2 / C3、DX M5）：
   - npm 裝的 `claude` / `codex` 是 `.cmd`，不經 shell 呼叫會失敗；經 shell 又會被 `%` `&` 改壞 DSN。
   - argv 本來就看得見，不能宣稱「不進命令列紀錄」。
3. **專案綁定的路徑**（DX C2、Design M4、Eng M8）：local scope 綁執行時的 cwd，在子目錄、plugin 目錄、worktree 跑都會綁錯。

## Critical 各視角獨見
- **Eng C1**：Codex 專案層是 repo 內的 `.codex/config.toml`，DSN 寫進去就會進 git。
- **DX C1**：plugin 路徑帶版本號，文件不能寫死；應由 AI 依 skill 目錄印出絕對路徑。

## Major（去重合併）
- **改用薄啟動器**（Eng M1、Design M7）：host 只註冊 `node ~/.bstack/…launch.mjs`，DSN 存在 `~/.bstack`。這樣同時解決：
  - Windows 的 `cmd /c`；
  - argv 帶密碼；
  - `.env` 衝突與 `npm_config_ignore_scripts`；
  - 升 DBHub 版時要逐專案重跑；
  - 逾時時殺整棵行程樹。
  - 進階做法是用 lockfile 加 `npm ci` 鎖遞移依賴。
- **Codex 只能用使用者層時會跨專案串庫**（Eng M7、DX M2、Design M3）。
- **`.env` 測項要加 `DB_*`、`.env.local`**，判定標準是「連的庫等於設定值」（Eng M2）。
- **註冊後要驗 host 真的連得上**，並量快取後的啟動秒數（Eng M3）。
- **錯誤訊息要先清洗密碼**，清洗函式放 lib 測（Eng M4、DX M3）。
- **連線失敗時對照常見錯誤給下一步**，並可「重試 / 改欄位」（DX M3）。
- **補「額外參數」欄位或「貼完整 DSN」模式**，給雲端 TLS、SQL Server 具名執行個體、Oracle service name 用（Eng M10、DX M4）。另驗 `${DBHUB_DSN}` 代換會不會造成 TOML 注入。
- **原子寫入**；remove 加 add 失敗時要能還原；逐 host 回報結果（Eng M6、Design M5、DX m3）。
- **exit code 表與 `--check` 狀態查詢**（Design M5 / M6、DX M6）：`--check` 讓「沒設定 / 連不上 / 版本過舊」三種成因分流，三種情境共用。
- **工具名單一真相**：lib 匯出 `SERVER` / `TOOL` / `TOOL_ID`，契約、產生器都從這裡取（Design M1）；`MCP_TEMPLATES` 的 key 要改名（Design M2）。
- **subagent 看不看得到使用者自建的 MCP**，Task 1 要驗（Design M8）。
- **headless 兩列的新文字與 A / B 類別**要明寫，契約要斷言類別欄（Design M9、Eng M11）。
- **禁 AI 用 Bash 跑 `claude mcp get`**：它會印出 env 原文（Eng M9）。
- **舊 mysql 使用者會無聲斷線**：db-access 要有分支提示，移除指令依實際 scope 印（DX M1、Eng m4）。
- **沒有 node 的人第一步就失敗**：文件第一行先寫需要 Node ≥ 22.5（DX M7）。

## Minor / Nit（採用，不逐條問）
- 搬 `buildSpawn` / `childEnv`（Eng m3）。
- MCP client 補 `notifications/initialized`，並處理三種失敗（Eng m2）。
- P20c 解析 frontmatter、列出具體方言字串，並做「改壞會 FAIL」驗證（Eng m1）。
- `--dry-run` 輸出加固定前綴（Design m2）。
- `--remove` 範圍、不刪共用檔（Design m3、DX m4）。
- `--help` 與旗標表（Design m5）。
- 問題順序先問 DB 種類、寫入前印摘要並 y/N（DX m1）；重跑時帶舊值當預設（DX m2）。
- worktree / session-team 註明（DX m5）。
- Task 6 的 user 動作要標出來（Eng m7）。
- `templates/project-settings.json` 白名單加工具名（Eng m8）。
- 佔位符統一（DX n1）；完成訊息補一句（DX n2）。
- 開工前先查清本 session 的 bstackdb CONNECTION_CLOSED：已查明是 repo 根 `.mcp.json` 在舊 branch 被當成專案設定讀，`${CLAUDE_PLUGIN_ROOT}` 沒展開；新 branch 已沒有這段。

## 主 agent 建議
- 必處理：上面全部 Critical。
- 需 user 決定：
  1. 是否改用啟動器、DSN 存在 `~/.bstack`。
  2. 依賴要不要用 lockfile 鎖住。
  3. Codex 跨專案的處理（啟動器依 cwd 找專案設定，可能一併解掉，待 Task 1 驗 Codex 起 MCP 的 cwd）。
- follow-up（範圍外）：團隊共用不含密碼的預設值檔（DX n3）；多資料庫擴充方向寫進 spec 風險段（Design m7）。
