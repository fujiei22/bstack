# Plan review 總結

> Plan: docs/work/refactor/skill-load-and-node-hook/plan.md（v1 → v2）
> Tier: T3
> 視角: Eng + Design + DX（review_perspectives：機械可驗 / 對外介面 / 有人要讀 三面向都命中）

## Critical

**共識（Design C1 + DX C1）**：README / landing / install.ps1 預定寫「Claude Code 本身就是 node 程式，一律有 node」——官方 `/setup` 文件明說 native 安裝的 `claude` binary 不呼叫 node、npm 裝法也只是下載 binary。這句進公開站就是把推論講成事實且方向錯。→ 文案改「hook 需要 `node` 在啟動 Claude Code 的環境 PATH 內，Claude Code 自己不帶 node」；install.ps1 前置檢查加 `Get-Command node`（spec 早已承諾、plan 漏排）。

**Design C2**：spec / rules.md 預定寫「缺 node 時不會靜默放行」——官方 `/hooks` 文件：hook 起不來是 non-blocking（exit 127 那類）、印一行通知、**工具照跑**。保護一樣不存在，差別只在「看得到」；且 memory 記的 Windows 實測是 pwsh 缺席時完全靜默，換 node 是否會印通知是推斷。→ 措辭改兩層（官方文件說法 + 本機實測結果），Task 2 加一步實測缺 node。

**Eng C1**：等價清單漏 **file-type 段不受 repo scope 限制**——舊 `file-type-guard.ps1` 沒有 scope check，repo 外的 `~/.gitconfig` / `~/.npmrc` 現在會 WARN（那正是 §File-type 列 shell config 的用意）。合成一支若把「repo 外放行」寫成整支 early return 就靜默廢掉 file-type 段。→ 等價清單加 C4；fixture 加「repo 外 `.gitconfig` → WARN」。

**Eng C2**：spec B2「stdin 空 → exit 0」對 branch 段是錯的——舊 `branch-safety.ps1` 空 stdin / 有 tool_name 無 file_path 時**跳過 scope check 直接查 branch**，在 main 上 exit 2；只有 JSON 壞才 exit 0。→ 零改變照搬（user 硬前提），spec B2 改寫，fixture 加三案。

## Major（去重合併）

- **token 建立指令**（三方）：`node -e "…" "<反斜線路徑>"` 在 Bash tool 會被吃反斜線。→ guard.mjs 子命令 `--token <path>`，stderr 印的路徑一律正斜線。
- **剔除 skill 定義目錄的規則**（DX M1 + Eng M6）：brainstorm 只寫「規則同 design-language §使用契約 第 1 步」是死引用（不命中的情境正是沒載它）。→ 照 execute-plan:42 先例整句內嵌（`skills/<name>/SKILL.md` 錨定、裸 `skills/` 不算），P11 守 `SKILL.md` 字樣。
- **清單重列 vs「不要各自重列」**（Design M3）：design-language §前端副檔名 寫「凡引用一律指向本節」，rules.md:79 其實早就重列了。→ 該節加「唯一例外：brainstorm 0b′ 與 rules.md §設計語言對齊 重列，契約 P11 守三處一致」；P11 區段切片 + tokenize 比對（Eng m9 / DX m1 指出直接字串比恆紅）。
- **design-language 跳步句與「不跳步」矛盾**（DX M2）：→ 不加跳步句，命中後載入照它契約跑，第 1 步重算結果必為 true；spec 目標 1 改寫。
- **dev-workflow 漏改兩處**（DX M4 + Design M2 + Eng M7）：Phase 0 圖第 35 行「← 載 design-language」、分工表第 290 行「heuristic → 本 skill」。→ 都改。「Tier 自動升級」的理由句（爆炸半徑與行數無關）brainstorm 0d 沒有 → 先搬過去再刪（DX M3）。
- **大小寫**（Eng M3）：pwsh `-match` / `switch` 預設不分大小寫，`Main` / `RELEASE` branch、`tool_name: "edit"` 現在都會被處理。→ node 加 `/i`、tool_name 小寫比對；fixture 加案。
- **temp 目錄 env 順序**（Eng M4）：.NET `GetTempPath` 是 `TMP → TEMP → USERPROFILE`，node `os.tmpdir()` 是 `TEMP → TMP`。→ 自己讀 env 照 .NET 順序，否則 token 路徑兩邊不同。
- **對照測試強化**（Eng M4 + DX m6）：標記加第四類「state dir 建立失敗」；token 路徑由第一次 WARN 輸出取、兩邊路徑要相等；驗 token 被刪 + consumed.log 多一行；`\r?\n` 切行；exit 規則寫明「新 == max(舊 branch, 舊 file-type)」；案例擴到約 26 案；`CLAUDE_PROJECT_DIR` 設與不設各跑一組；只在 Windows 實測、Linux 為推斷。
- **P2e 真 spawn**（Eng M8）：P2d 只測純函式，CLI 段少接一段照樣綠。→ P2e 用 `spawnSync(process.execPath)` 跑兩案（Read → 0；repo 外 `.env` → 2 + BLOCK）；P2d 加「protected + `.env` 雙訊息」案。
- **P2d 補案**（Design M4）：branch 取不到（null）、detached HEAD、state dir 失敗。
- **ctx 介面**（Eng M5）：`consumeToken(path) → {existed, valid}` 一個就夠；`tokenPathFor` 另 export 讓 P2d 測 hash；`getBranch()` lazy（repo 外不 spawn git）；順序 consume → ensureStateDir → 印。
- **Task 6 併入 Task 3**（Eng m13）：brainstorm / design-language 的檔名替換由 Task 3 一併做，Task 6 只剩 data.js + design-direction + finish-branch + dispatch-parallel；dispatch-parallel「兩個 PreToolUse hook」改「一個」。
- **design-language Red Flags:278**（Eng M7）「純後端 task 這個 skill 跳過 → 沒有跳的必要」與新流程矛盾 → 改「純後端 task 本 skill 不會被載入；判定在 brainstorm 0b′」。brainstorm Red Flags 那列同步（DX m5）。
- **公開文案漏處**（三方）：index.html:75 兩個 `<code>.ps1</code>` 與「兩個 PreToolUse hook」、:129「兩支 hook」；README 85 / 92 / 102 / 134 / 180 全掃 `兩支 hook|兩個 pwsh|靜默失效|\.ps1`。Prerequisites 表 node 列是**改寫**既有 MCP 那列不是新增；貢獻者仍需 pwsh 跑 build-references.ps1 要寫；install.ps1 ✘ 訊息主詞改「本腳本需要 pwsh」。

## Minor / Nit（採納）

- consumed.log 布林 `True/False` 沿用；`CLAUDE_PROJECT_DIR` 指到不存在目錄 → node catch → exit 0，列刻意差異；`--abbrev-ref` 回 `heads/main` 的歧義案兩邊都放行，記 spec 待釐清
- hooks.json 維持 shell form 雙引號（官方範例同寫法；exec form 舊版支援未知、P2b regex 讀不到）
- rules.md §Branch safety 豁免段開頭「（實測 code 行為…）」改「（契約 P2d 以 fixture 守的行為…）」；§設計語言對齊 加半句「命中則照舊必載，規則不變、只是比對搬到 brainstorm」
- 時間量兩個數字（repo 外不跑 git / repo 內）、Bash `time` 與 PowerShell `Measure-Command` 各一
- 施工紀錄對照表欄位照 DX n1；「步驢數」typo

## 略過（附理由）

- Design m1 提到的怪癖「main 上改 Dockerfile 且有 token → file 段先吃掉 token、branch 段再 block」：舊版平行也如此，零改變原則下不修，記等價清單備註
- 拆 `guard-core.mjs` + `guard.mjs`（Design m3）：主程式判斷照 `text-only-diff.mjs` 先例用 `argv[1]` 檔名 regex 即可，不拆

## 主 agent 建議

- 必處理：4 條 Critical → 全進 plan v2
- 建議處理：全部 Major → 全進
- user gate：user 已授權本輪到開 PR；plan v2 落檔後直接進 execute-plan
