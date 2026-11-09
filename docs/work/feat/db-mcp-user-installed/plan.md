# DB MCP 統一 DBHub + 設定小工具 Implementation Plan

> 對應 spec: `docs/work/feat/db-mcp-user-installed/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-11-09
> 並行最大 group: 1（全部串行：Task 2-5 都改 `scripts/plugin-contract.mjs`，同檔不並行）

**Goal**: 使用者跑一次 `node <plugin>/scripts/db-setup.mjs` 就裝好唯讀的 DBHub，server 名 `bstackdb`。規則、skill、agent 只認 `mcp__bstackdb__execute_sql`。

**Architecture**: 程式分兩檔。
- 純函式放 `scripts/lib/db-setup-lib.mjs`，契約直接 import 測。
- 互動與 IO 放 `scripts/db-setup.mjs`。

小工具自己當 MCP client：用 stdio 起 DBHub，送 `initialize` 再 `tools/call execute_sql`。試連與預先下載一次完成，不另寫各家驅動。唯讀設定檔（TOML）放使用者家目錄的 `~/.bstack/dbhub.toml`，不含密碼，DSN 用 `${DBHUB_DSN}` 引用。DSN 經 `claude mcp add -e` / `codex mcp add --env` 存進各 host 的 MCP 設定。

**Tech Stack**: Node ≥ 22.5（DBHub engines）、`@bytebase/dbhub@1.6.0`（npx）、node:readline（不回顯輸入）、node:child_process。

**Risks**:
- 1.6.0 的 TOML 格式或 `.env` 行為與 1.5.1 不同（Task 1 先測）。
- Windows `claude mcp add` 的 `npx` 要 `cmd /c`。
- Codex 可能沒有專案層 MCP。

---

## 檔案結構

| 檔 | 類型 | 職責 |
|---|---|---|
| `scripts/lib/db-setup-lib.mjs` | new | 純函式：`DBHUB` 版本常數、`normalizeDsn` / `checkDsn` / `describeDsn`（自舊 branch `mcp/dsn.mjs` 搬）、`buildDsn(answers)`、`buildToml()`、`claudeAddArgs(platform, scope, tomlPath)`、`codexAddArgs(...)`、`nodeOk` |
| `scripts/db-setup.mjs` | new | 互動流程、不回顯密碼、試連（MCP client）、寫 TOML、呼叫 host CLI、`--remove` / `--dry-run` / `--host claude\|codex\|both` |
| `scripts/dbhub-readonly-probe.mjs` | new（自舊 branch 搬、改） | 改成讀 `~/.bstack/dbhub.toml` 同款設定直接起 DBHub（不再經 `mcp/db-mcp.mjs`） |
| `scripts/plugin-contract.mjs` | edit | P20a lib fixture、P20b TOML 內容、P20c 規則一致、P20d 文件；P13 `mcpBundle` 維持只准 playwright |
| rules / hosts / skills / agents / codex TOML | edit | 工具名 `mcp__bstackdb__execute_sql`、多方言、工具不在 → 跑小工具 |
| `scripts/extras.ps1`、`scripts/install-codex.ps1` | edit | mysql 範本改印小工具指令 |
| README / install.md / docs 站 | edit | DB 查詢一節、升級段 |

---

### Task 1: 實測定案（DBHub 1.6.0、兩 host 的註冊方式）
**parallel-group**: 1
**files**: scratchpad 實驗；結論寫 `plan.md` §Task 1 結果

- [ ] **Step 1：DBHub 1.6.0 基本行為**（scratchpad，SQLite 檔）
  ```bash
  npx -y @bytebase/dbhub@1.6.0 --help
  DBHUB_DSN="sqlite:///<abs>/t.db" npx -y @bytebase/dbhub@1.6.0 --transport stdio --config <scratch>/dbhub.toml
  ```
  - TOML：`[[sources]] id="db" dsn="${DBHUB_DSN}"` 加 `[[tools]] name="execute_sql" source="db" readonly=true max_rows=100`。
  - 用 MCP client 片段送 `initialize` 加 `tools/list`，記下工具名。
  - 判定：工具名是 `execute_sql` 才沿用；不同則全 plan 換名。
- [ ] **Step 2：`.env` 行為**：cwd 放含 `READONLY=false`、`MAX_ROWS=5`、`ID=x`、`DSN=sqlite:///other.db` 的 `.env` 起 DBHub。
  - 照常起、仍唯讀、仍 100 列、連的仍是 `DBHUB_DSN` → 直接註冊 npx。
  - 會 exit、會被覆蓋 → 小工具改註冊薄啟動器 `~/.bstack/dbhub-launch.mjs`（cwd 換到 `~/.bstack`、刪衝突 env，沿用舊 `childEnv` 邏輯），並在 plan 追加 Task 2b。
- [ ] **Step 3：唯讀探測**：舊 branch 探測腳本改指向 1.6.0，對 `bstack_dbhub_test`（MySQL / PostgreSQL）與 `--selftest`（SQLite）各跑一輪。
  - 判定：除 `pg_advisory_lock` 外全擋才繼續。
  - `pg_terminate_backend` / `SLEEP` 放行時列為已知放行（user 2026-11-09 定），寫進探測腳本的 allow 與文件。
  - 若有新放行 → §Fail handling 問 user。
- [ ] **Step 4：Claude Code 註冊**：拋棄式專案目錄跑 `claude mcp add bstackdb --scope local -e DBHUB_DSN=<sqlite dsn> -- cmd /c npx -y @bytebase/dbhub@1.6.0 --transport stdio --config <toml>`。
  - 再跑 `claude mcp get bstackdb`。
  - `claude -p` 加 `--allowedTools mcp__bstackdb__execute_sql` 叫它 `SELECT 1`。
  - 確認：工具名、`~/.claude.json` 存放位置、Windows 是否必須 `cmd /c`、`-e` 值含 `&` / `%` 等特殊字元能否原樣保存（直接比對檔案內容）。
- [ ] **Step 5：Codex 註冊**：用暫存 `CODEX_HOME` 跑 `codex mcp add bstackdb --env DBHUB_DSN=... -- npx ...`。
  - 查 Codex 文件或原始碼，看有沒有專案層 `.codex/config.toml` 的 `mcp_servers`。
  - 有就實測專案層；沒有就定為使用者層。
  - 記下工具名、`codex mcp list` 狀態。

**結果落檔**：本檔 §Task 1 結果，含每步指令與輸出摘要（DSN 一律遮），再 commit：
```bash
git add docs/work/feat/db-mcp-user-installed/plan.md
git commit -m "docs: plan 補 Task 1 實測結果"
```

### Task 2: 純函式模組 `db-setup-lib.mjs` + 契約 P20a / P20b
**parallel-group**: 2
**files**:
- create: `scripts/lib/db-setup-lib.mjs`
- modify: `scripts/plugin-contract.mjs`（新增 P20a、P20b 段與檔頭段落表）

- [ ] **Step 1：寫失敗測試**（P20a / P20b 加進契約）
  - **`normalizeDsn`**：沿用舊 branch 的 12 個 fixture。
    - 密碼含 `@ : / # ?`。
    - 已編碼的不重編。
    - 空白或 `${…}` 回 null。
    - sqlite 相對路徑轉絕對。
  - **`buildDsn`**：
    - `{type:'mysql', host:'127.0.0.1', port:3306, user:'ro', password:'p@ss:w/d', database:'app'}` → `mysql://ro:p%40ss%3Aw%2Fd@127.0.0.1:3306/app`。
    - `{type:'sqlite', path:'C:\\a b\\x.db'}` → `sqlite:///C:/a b/x.db`。
    - postgres / sqlserver / mariadb / oracle 各一筆，預設埠依序是 5432 / 1433 / 3306 / 1521。
  - **`checkDsn`**：不在 7 種 scheme 時 reason 只含 scheme、不含密碼。
  - **`describeDsn`**：`mysql://u:SECRET@h:3306/d` 與 `mysql://root:SECRET/db` 都不含 `SECRET`。
  - **`buildToml()`**：恰一段 `[[sources]]`，`dsn = "${DBHUB_DSN}"`；恰一段 `[[tools]]`，`readonly = true`、`max_rows = 100`；字串內無任何密碼欄位。
  - **`claudeAddArgs`**：
    - `('win32','local',p)` 含 `--scope local`、`cmd`、`/c`、`npx`、`@bytebase/dbhub@1.6.0`、`--config`、`p`。
    - `('linux',…)` 不含 `cmd`。
    - `-e` 的值是 `DBHUB_DSN=` 加 DSN 的那一個元素（陣列傳遞、不拼字串）。
  - **`codexAddArgs`**：依 Task 1 Step 5 結論的格式。
  - **`nodeOk`**：`22.4.0` 為 false，`22.5.0` 與 `24.0.0` 為 true。
- [ ] **Step 2：跑紅**：`node scripts/plugin-contract.mjs` → P20a / P20b FAIL（模組不存在）。
- [ ] **Step 3：實作**：寫 `scripts/lib/db-setup-lib.mjs`。
  - 每個函式附繁中 docstring（WHAT 加 WHY）。
  - `normalizeDsn`、`checkDsn`、`describeDsn` 自 `git show feat/plugin-db-mcp-dbhub:mcp/dsn.mjs` 搬，保留原 WHY 註解。
- [ ] **Step 4：跑綠**：`node scripts/plugin-contract.mjs` → ALL PASS。
- [ ] **Step 5：commit**
  ```bash
  git add scripts/lib/db-setup-lib.mjs scripts/plugin-contract.mjs
  git commit -m "feat: DB 設定小工具的純函式與契約"
  ```

### Task 3: 互動小工具 `db-setup.mjs` + 探測腳本
**parallel-group**: 3
**files**:
- create: `scripts/db-setup.mjs`、`scripts/dbhub-readonly-probe.mjs`
- modify: `scripts/plugin-contract.mjs`（P20a 加 `--dry-run` 實跑）

流程依序是：
1. 檢查 `nodeOk`，不過就印需要的版本並 exit 1。
2. 問 `--host`，預設兩個 host 都偵測。
3. 問 DB 種類（編號選單），再依種類問欄位。密碼用 readline 關閉回顯：Windows 與 POSIX 都以 `process.stdin.setRawMode(true)` 逐字讀、不輸出字元。
4. 組 DSN（`buildDsn`），過 `checkDsn`。
5. 寫 `~/.bstack/dbhub.toml`（`buildToml`），目錄不存在就建。
6. **試連加預先下載**：以 MCP client 起 DBHub（env `DBHUB_DSN`），送 `initialize` → `tools/call execute_sql {sql: <依方言的 SELECT 1>}`。
   - 首次下載可能 60 秒，逾時設 180 秒，等待時印進度點。
   - 失敗時印 DBHub 錯誤訊息，只印 `describeDsn` 遮過的連線描述，exit 1、不註冊。
7. 偵測舊 server：`claude mcp get mysql` / `codex mcp list` 有 `mysql` → 印移除指令，不代刪。
8. 註冊：先 `mcp remove bstackdb`（同 scope，忽略「不存在」），再 `mcp add`。參數用陣列傳給 `spawnSync`，不經 shell，DSN 不進命令列字串紀錄。
9. 印完成訊息與「重開 session 後生效、AI 第一次查詢會比對庫名」。

旗標：`--remove` 移除兩 host 的 bstackdb；`--dry-run` 不連線、不寫檔、不呼叫 host，只印會做什麼（DSN 以 `describeDsn` 遮）。

- [ ] **Step 1：寫失敗測試**：P20a 加一項，以 `--dry-run` 搭配 stdin 餵答案（sqlite、暫存路徑）跑 `db-setup.mjs`。
  - exit 0。
  - stdout 含 `bstackdb`、`--scope local`、`readonly = true`。
  - stdout **不含**餵進去的密碼字串（另跑一次 mysql 類型、密碼 `S3cr3t!@#`）。
- [ ] **Step 2：跑紅**：P20a FAIL（檔不存在）。
- [ ] **Step 3：實作** `db-setup.mjs`；探測腳本自舊 branch 搬：
  - 改用 `db-setup-lib` 的 `buildToml` 寫暫存 TOML、直接 spawn DBHub。
  - 表名強制 `bstack_probe_` 前綴。
  - DSN 只讀 env。
  - allow 清單加入 Task 1 Step 3 定的已知放行。
- [ ] **Step 4：跑綠**：契約 ALL PASS；手動跑 `node scripts/dbhub-readonly-probe.mjs --selftest` → PASS；手動 `node scripts/db-setup.mjs --dry-run`，目測互動文字。
- [ ] **Step 5：commit**
  ```bash
  git add scripts/db-setup.mjs scripts/dbhub-readonly-probe.mjs scripts/plugin-contract.mjs
  git commit -m "feat: DB 設定小工具（試連、預先下載、註冊到專案）與唯讀探測"
  ```

### Task 4: 規則 / skill / agent 換成 `mcp__bstackdb__execute_sql` + 契約 P20c
**parallel-group**: 4
**files**：
- modify: `skills/devwork/rules.md`、`skills/devwork/hosts.md`、`skills/db-access/SKILL.md`、`skills/headless-mode/SKILL.md`、`skills/brainstorm/SKILL.md`、`skills/session-team/SKILL.md`、`agents/db-reviewer.md`、`agents/lang-reviewer.md`、`scripts/gen-codex-agents.mjs`、`scripts/plugin-contract.mjs`
- regenerate: `codex/agents/*.toml`

內容自舊 branch 搬（`git show feat/plugin-db-mcp-dbhub:<path>`），改動點：
- **工具名**：兩 host 一律 `mcp__bstackdb__execute_sql`（Task 1 若 Codex 結果不同則照實寫兩個）。刪掉 `mcp__plugin_bstack_bstackdb__…`、`DBHUB_DSN 環境變數`、`/plugin 設定 db_dsn` 這些內建版說法。
- **設定方式**：一律寫「跑 `node <plugin 路徑>/scripts/db-setup.mjs`」，plugin 路徑怎麼找見 install.md。
- **db-access §工具不在**：選項 1 改「請 user 在終端機跑設定小工具後重開 session」，跑前先 `context-snapshot`。
- **db-access 模式段**：改為「小工具寫死 DBHub 唯讀加 100 列」，並寫明不是萬能，仍要唯讀帳號。
- **hosts.md**：
  - Claude Code 與 Codex 欄改成小工具。
  - 「不要自建叫 bstackdb 的 server」改成「bstackdb 只由小工具建立；手動建的沒有唯讀保證」。
- **session-team:70**：「mysql + playwright」改成「DB MCP（若有設）+ playwright，2026-11-09 換 DBHub 後未重測」。
- **gen-codex-agents MCP_TEMPLATES**：只印 `# DB MCP 由 node <plugin>/scripts/db-setup.mjs 建立，server 名 bstackdb、工具名 mcp__bstackdb__execute_sql`。

- [ ] **Step 1：寫失敗測試**（P20c）：
  - skills/、agents/、codex/agents/、rules、hosts 內不得出現 `mcp__mysql__`、`mcp__plugin_bstack_bstackdb`、`DBHUB_DSN=`（設定小工具與文件除外）。
  - `mcp__bstackdb__execute_sql` 出現在 rules.md / hosts.md / db-access / db-reviewer.md 的 `tools`。
  - db-access 有 `§工具不在`、提到 `db-setup.mjs`、五種方言的庫名查詢、`TOP`、`FETCH FIRST`。
  - headless-mode 有 `db-access/tool-missing`、`db-access/db-mismatch`。
  - brainstorm 關鍵詞含 `postgres`、`sqlite`、`oracle`、`mssql`。
- [ ] **Step 2：跑紅**：P20c FAIL。
- [ ] **Step 3：實作**：改上述檔，再跑 `node scripts/gen-codex-agents.mjs` 重產 TOML。
- [ ] **Step 4：跑綠**：`node scripts/plugin-contract.mjs` ALL PASS、`node scripts/gen-codex-agents.mjs --check` 綠、`pwsh -File scripts/build-references.ps1 -Check` 綠（不綠就跑 `build-references.ps1` 重產 `docs/js/references-data.js`）。
- [ ] **Step 5：commit**
  ```bash
  git add skills agents codex scripts/gen-codex-agents.mjs scripts/plugin-contract.mjs docs/js/references-data.js
  git commit -m "feat: 規則與 agent 改用 mcp__bstackdb__execute_sql、支援多資料庫"
  ```

### Task 5: 文件與安裝腳本 + 契約 P20d
**parallel-group**: 5
**files**: modify `README.md`、`docs/install.md`、`docs/index.html`（文字節點）、`docs/js/data.js`（兩個字串）、`scripts/extras.ps1`、`scripts/install-codex.ps1`、`scripts/plugin-contract.mjs`

- **install.md 新增「## DB 查詢（bstackdb）」**：
  - 一行指令（Windows / macOS / Linux 各一，plugin 路徑怎麼找）。
  - 小工具會問什麼。
  - 支援的 DB 與預設埠。
  - 確認生效（`/mcp` 看 bstackdb、問 AI「目前連到哪個庫」）。
  - 換庫 = 重跑。
  - 移除 = `--remove`。
  - 疑難排解：Node 版本、首次下載、連不上、`.env`（依 Task 1）。
  - 帳號權限：唯讀、不給 FILE / superuser / pg_read_server_files / pg_signal_backend。
  - SQL Server / Oracle 未實測、必須唯讀帳號。
  - 密碼存放位置（明文）與供應鏈風險（已接受）。
  - 原「MCP（mysql / playwright）」節改為只講 playwright，錨點與目錄同步改。
- **README**：
  - DB 查詢一段指向 install.md。
  - 「從 1.13.x 以前升上來」加：跑小工具，並移除舊 mysql MCP（`claude mcp get mysql` 看 scope 再 `claude mcp remove mysql -s <scope>`；Codex `codex mcp remove mysql`）。
- **extras.ps1 / install-codex.ps1**：mysql 範本改印小工具指令；install-codex Step 6 狀態行改偵測 `bstackdb`。兩者 `-SelfTest` 照過。
- **docs 站**：`data.js:82` LoadDB label、`:408` §DB 操作 desc、`index.html:576` 一句，只改文字。

- [ ] **Step 1：寫失敗測試**（P20d）：
  - README / install.md / extras.ps1 / install-codex.ps1 不含 `claude mcp add mysql`、`codex mcp add mysql`。
  - install.md 含 `db-setup.mjs`、`--remove`、`22.5`、`唯讀帳號`、`pg_signal_backend`、`@bytebase/dbhub@1.6.0`，且版本號等於 lib 的 `DBHUB`。
  - README 升級段含 `mcp remove mysql`。
  - install.md 目錄錨點都對得到標題。
- [ ] **Step 2：跑紅**。
- [ ] **Step 3：實作**。
- [ ] **Step 4：跑綠**：契約 ALL PASS；`pwsh -File scripts/extras.ps1 -SelfTest` 與 `pwsh -File scripts/install-codex.ps1 -SelfTest` 綠；`node scripts/text-only-diff.mjs origin/main...HEAD --ignore docs/js/references-data.js` 對 HTML 判 TEXT-ONLY。
- [ ] **Step 5：commit**
  ```bash
  git add README.md docs/install.md docs/index.html docs/js/data.js scripts/extras.ps1 scripts/install-codex.ps1 scripts/plugin-contract.mjs
  git commit -m "docs: DB 查詢改用設定小工具、移除 mysql MCP 教學"
  ```

### Task 6: 升版 1.14.0 + 整合驗證
**parallel-group**: 6
**files**: modify `.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json`、`.codex-plugin/plugin.json`；結果寫 spec `## 驗證`

- [ ] **Step 1：寫失敗測試**：既有契約的版本一致檢查（三處相同）在只改一處時 FAIL。
- [ ] **Step 2：跑紅**：先改 `.claude-plugin/plugin.json` 一處跑契約，確認 FAIL。
- [ ] **Step 3：實作**：三處都改 1.14.0。
- [ ] **Step 4：整合驗證**（每項記指令與結果，DSN 遮）：
  1. 拋棄式專案目錄跑真的 `db-setup.mjs`，分別設 SQLite / MySQL `bstack_dbhub_test` / PostgreSQL `bstack_dbhub_test`。
     - 每次之後：`claude -p --allowedTools mcp__bstackdb__execute_sql` 查庫名 → 正確。
     - INSERT → 被擋。
  2. 另一個專案目錄不受影響（`claude mcp get bstackdb` 找不到）。
  3. 密碼含 `@:/#` 的帳號能連（MySQL 建一個這樣的唯讀帳號，SQL 交 user 跑）。
  4. 在帶 `.env` 的專案跑（依 Task 1 Step 2 結論）。
  5. Codex 用暫存 `CODEX_HOME` 跑一次，查得到。
  6. `--remove` 後兩 host 都沒有 bstackdb。
  7. `node scripts/dbhub-readonly-probe.mjs` 對 MySQL / PostgreSQL 綠。
  8. 契約 ALL PASS、gen-codex-agents `--check`、build-references `-Check`。
- [ ] **Step 5：commit**
  ```bash
  git add .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json docs/work/feat/db-mcp-user-installed/spec.md
  git commit -m "chore: 升版 1.14.0 並補整合驗證紀錄"
  ```

---

## §Task 1 結果
（Task 1 執行後填）
