# Code review 整合結果

> Tier: T3
> Reviewers: 主 reviewer + 架構視角 + 除錯視角 + lang-reviewer(typescript)；四個 subagent 獨立、互不通訊
> 日期: 2026-09-04

## Critical

| # | 問題 | 提出者 | 處置 |
|---|---|---|---|
| C1 | docs 站內嵌的「根規則」是 repo 根 CLAUDE.md 三行殼，35 處 `rules.md §…` 交叉引用斷鏈，兩支契約都不會紅 | 架構 | build-references 內嵌 `skills/devwork/rules.md` 為 `references/rules.md`；app.js EXTRA_DOCS 改名 `rules.md`；契約加 C8e（含 §事實核實）/ C8f（交叉引用可解析）/ C8g（index.html 節點數）；C18b 例外改 rules.md |
| C2 | 使用者 `permissions.allow` 只有一筆時，`$have = if (...) {...}` 被 unroll 成純量，`+` 變字串串接，allow 被毀成一個垃圾字串 | 除錯（實跑） | 兩處改 `@(if …)`；SelfTest u1（單筆）/ u2（字串）|

## Major（採納）

- **statusLine [R] 重裝後 -Uninstall 拆不掉**（主 / 架構）→ Save-Manifest keys 與既有紀錄聯集；SelfTest r1 / r2。
- **-Migrate 簽名在新版 rules.md 也存在，會誤改名使用者刻意複製的現版守則**（主 / 除錯）→ 簽名改用只有舊版才有的「一律進 `dev-workflow`」；內文非空行重疊 ≥ 90% 才視為未改；SelfTest e7。
- **-Migrate 只憑名字判所有權，會刪使用者自己的同名 skill**（架構）→ skill 看 frontmatter name + 「（繁中）」、agent 同、hook 看 bstack 字樣；SelfTest e1b。
- **`-Items statusLine,env` 經 `-File` 是一個字串，ValidateSet 拒絕**（除錯）→ 拔 ValidateSet、進腳本 split 驗集合。
- **沒有 claude CLI 時 Add-Mcp / -Uninstall 整支中止**（除錯）→ Test-ClaudeCli 守衛；Uninstall 失敗條目保留、manifest 只在全成功時刪。
- **內文全改仍判「未修改」**（除錯）→ 改比非空行重疊；訊息改「內文與現版重疊 ≥90%、未逐行比對」。
- **description() 對 `>` / `|-` 回傳指示符本身，P3c / P7 假綠**（除錯 / lang）→ 支援 `[|>]-?`、區塊內空行、fail-closed 回空；selftest S4 / S5 / S6。
- **公開站首要安裝路徑未實測**（主）→ 本地 `claude plugin marketplace add D:\GitHub\bstack` + `install bstack@bstack -s user` 實跑成功，`/devwork` 不帶 `--plugin-dir` 可用；已還原。記入 verify.md。
- **rules.md 經 Read 載入會被 compaction 洗掉，「位階等同 CLAUDE.md」只是宣告**（架構）→ rules.md 開頭改寫前提；dev-workflow §Skill hand-off 加「context 無 §事實核實 → 重 Read」。
- **hooks 只有 pwsh 版、README「靜默失效」是 Windows 實測非全平台**（架構 / 主）→ README 改標 Windows 實測、macOS / Linux 推斷；補 PATH 提醒。`sh` 包裝列 follow-up。

## Minor（採納）

Uninstall 壞 JSON 保留條目、allow 拆空不留殼與 permissions 空父物件、Batch 印路徑與家目錄防線、project 用 git toplevel、Get-Installed 比 file、`ts` 安全截字、根非 object 跳過、Move-Item 失敗清 tmp、`-LiteralPath`（Resolve-Path / Get-Content / Push-Location）、mcp uninstall 切到專案目錄、file-type-guard state dir 延後建立與建不起來的訊息、Linux /tmp 限制寫進 docstring、branch-safety detached HEAD 說明、P4 白名單縮成 `-Migrate|setup.ps1|遮蔽|bstack-bak|plugins/` 並限 6 行、P4 掃 references/*.md、P7 加 README agents 計數、hooks 三層迴圈註解、`process.exitCode`、index.html 節點鏈 100 → 99、verify.md 斷言數、rules.md §Branch safety hook 範圍措辭、README 延遲實測數字（每支約 1.2 秒）、「唯一主動寫進」措辭、範本雙重身分說明。

## 未採納 / 延後（附理由）

- **hooks 用 `sh` 包裝做跨平台降級**（架構 M4）：spec §4f 明列不改 hook 語言；列 follow-up issue。
- **skill 描述反向依賴 Phase 編號**（架構 m1）：描述現在只給人看、不是 routing 依據；加契約反查成本高於收益，留著。
- **manifest 跟著目標 settings.json 走**（架構 m3）：改成 scope-local 會讓 -Uninstall 要掃多處；維持單一 manifest，README 已把「唯一不經選擇就寫的檔」講清楚。
- **P7 用精確值 vs P3a 用下限**（lang）：刻意——agent 變動頻率低，且現在與 README 計數一起比，已在 code 註明。
- **BOM 壓在 shebang 前**（主 nit）：`pwsh -File` 呼叫不受影響；直接 `./x.ps1` 在 Linux 才會壞，hooks.json 一律 `-File`。
- **lang-reviewer 的 `|-` 變體**：已在 C2 修法一併支援。

## Security audit（security-auditor subagent，STRIDE × 4 surface + OWASP A01/A04/A05/A08/A09）

無 Critical。四條 Major：

| # | 威脅 | 處置 |
|---|---|---|
| 1 | file-type-guard token 目錄在 Linux 是共用 `/tmp`，token 名由路徑決定，同機他人可預建繞過二次確認（本 PR 新引入的退化：舊版在 `~/.claude/hooks/../state`，本來就 per-user） | state dir 改 `$XDG_RUNTIME_DIR` 或 `<temp>/bstack-file-guard-<使用者名>`；token 消費時 append 一行 `consumed.log` 供回溯（Minor #1） |
| 2 | `-Migrate` 對 hook 的簽名含「PreToolUse hook」官方通稱，使用者自己的同名 hook 會被誤判；且直接 `Remove-Item` 無備份 | 簽名縮成 `BRANCH-SAFETY]|FILE-TYPE-GUARD]|[bstack]`；刪除改成搬進 `~/.claude/bstack-migrate-bak-<ts>/`；SelfTest e3b / e3c |
| 3 | 範本 `Bash(cat/head/tail:*)` 是任意檔讀取，file-type-guard 只管寫入，分發面從一個 repo 擴大到任意採用專案 | 不改白名單（是 user 原清單）；README §A1 與 rules.md §Settings.json 加警語：有密鑰檔就拿掉或改 ask |
| 4 | marketplace source 無版本 pin，repo 被接管等於對所有隊友的 hook 程式碼替換（平台限制） | README §A1 說明並建議 fork 自管 |

Minor #2（`.bak` 明文快照可能含帳密）→ README §B 加提醒。接受的風險：守則只在 `/devwork` 後生效（user 定案）、沒 pwsh 靜默失效（已揭露）、hook fail-open（刻意設計）、symlink 別名繞 file-type-guard（既有行為，非本 PR）。

## 驗證（修完）

- `node scripts/plugin-contract.mjs` ALL PASS；`--selftest` S1 S2 S4 S5 S6 PASS、S3 刻意紅。
- `node docs/tools/docs-site-contract.mjs` 39 條 ALL PASS（含新 C8e / C8f / C8g）。
- `pwsh scripts/extras.ps1 -SelfTest` 31 條 ALL PASS；`-Yes -Items statusLine,env -Scope user -WhatIf` 接受逗號字串。
- `pwsh scripts/build-references.ps1 -Check` PASS（35 份，含 rules.md）。
