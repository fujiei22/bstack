# 效率優化三項 Implementation Plan（v2，依 review.md 改）

> 對應 spec: `docs/work/refactor/skill-load-and-node-hook/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-07
> 並行最大 group: 4
> 基線 sha: `8dbb203`

**Goal**: 三項效率改動落地、每項附「邏輯零改變」的機械證明（契約 P2d / P2e / P11 + 守門快照 + hook 對照測試約 26 案）。

**Architecture**: group 1 契約先紅；group 2 三塊平行、檔集合互斥——hook（hooks/、scripts/hook-equivalence.mjs）、延遲載入（brainstorm / design-language / rules.md，含這三檔內的 hook 檔名替換）、dev-workflow；group 3 公開文案 + 其餘檔名引用；group 4 重產 + 總驗 + 施工紀錄。

**Risks**: hook 重寫（對照測試 + P2d / P2e 守）；三處清單雙寫（P11 守）；公開文案的事實陳述（照官方文件 + 實測，不寫推論）。

---

### Task 1: 契約先紅

**parallel-group**: 1
**files**: modify `scripts/plugin-contract.mjs`

- [ ] Step 1: P2a `hookCmds.length >= 2` → `>= 1` 且每個 command 含 `node "` ；P2c 改驗 `hooks/guard.mjs` 存在且不含 `state[\\/]file-guard`；P4 掃描清單 `hooks/*.ps1` → `hooks/guard.mjs`、`scripts/hook-equivalence.mjs`
- [ ] Step 2: **P2d**（import `decide` / `tokenPathFor`，純函式、無 IO）fixture：
  1. protected branch + repo 內 `src/a.ts` → exit 2、lines 含「目前在」
  2. feature branch + repo 內 → 0
  3. repo 外 `settings.json`（protected）→ 0（branch 段不看 repo 外）
  4. repo 外 `.gitconfig`（protected）→ 2、含 WARN、不含「目前在」（file-type 段不看 scope）
  5. protected + repo 內 `.env` → 2、lines 同時含「目前在」與 BLOCK（雙訊息）
  6. `.env.example` → 0；7. `.env.local` → BLOCK；8. `id_rsa`（NotebookEdit `notebook_path`）→ BLOCK；9. 裸 `credentials.json`（無前導斜線）→ 0（既有行為，pattern 要 `/`）
  10. `migrations/x.sql` 無 token → WARN 2；11. 同檔 token valid → 0；12. 同檔 token expired → WARN 2（consumeToken 回 `{existed:true, valid:false}`）
  13. `package-lock.json` → WARN；14. `Dockerfile` → WARN；15. `a.ts` feature → 0
  16. `tool_name: "edit"`（小寫）→ 視同 Edit；17. branch `Main` → 擋；18. branch null（非 git）→ 0；19. branch `HEAD`（detached）→ 0
  20. 空 stdin（payload null）protected → 2 只含「目前在」；21. `Write` 無 `tool_input` protected → 2；22. `Write` 有 `tool_input` 無 `file_path` protected → 2
  23. 未知 tool → 0；24. state dir 建不起來（`ensureStateDir` 回 false）且 WARN → 2、lines 含「state dir 建立失敗」
  25. `tokenPathFor('d:/x/.env', {TMP:'C:/t', USERNAME:'u'})` == `C:/t/bstack-file-guard-u/<sha256 前 16 hex>.token`（期望值先用舊 ps1 算一次寫死）；26. env 只有 TEMP 沒 TMP 也要用得到（.NET 順序 TMP → TEMP → USERPROFILE）
- [ ] Step 3: **P2e** 真 spawn：`spawnSync(process.execPath, ['hooks/guard.mjs'], {input, env})` 兩案——`tool_name: Read` → exit 0；Write 到 `<tmp>/bstack-p2e/.env`（repo 外）→ exit 2、stderr 含 `BLOCK`
- [ ] Step 4: **P11**：切區段（brainstorm `## §Phase 0b′` 到下個 `## `；design-language `## §前端副檔名` 到下個 `## `；rules.md `### §設計語言對齊` 到下個 `### `），各以 `/\.[a-z]+\b/g` 抓副檔名、排序後三組 JSON 相等；brainstorm 段含「不命中」「不載」「命中才載」「SKILL.md」；dev-workflow 無「Track 判定 heuristic」「Tier 判定 heuristic」、跨流程表 design-language 列含「命中才載」、Phase 0 圖 0b′ 行不含「← 載 design-language」；brainstorm 有 `## §Phase 0c` / `## §Phase 0d` 標題；design-language Red Flags 不含「沒有跳的必要」。錯誤訊息照「期望 / 實際 / 改法 / 後果」，改法寫明 design-language 那節是唯一真相、同步 brainstorm 0b′ 與 rules.md §設計語言對齊
- [ ] Step 5: 跑契約：P2a / P2c / P2d / P2e / P11 紅、`--selftest` 綠；commit `test: 契約 P2 系列改 node hook、新 P2d / P2e / P11`

### Task 2: hooks/guard.mjs 移植 + 對照測試 + 缺 node 實測

**parallel-group**: 2
**files**: create `hooks/guard.mjs`、`scripts/hook-equivalence.mjs`；modify `hooks/hooks.json`；delete 兩支 `.ps1`

- [ ] Step 1: 紅 = P2a / P2c / P2d / P2e
- [ ] Step 2: `guard.mjs`（草稿在 scratch `guard.draft.mjs`，依 review 修）：export `targetOf` / `tokenPathFor(normalized, env)` / `decide(payload, ctx)`；ctx = `{ repoDir, getBranch(), env, selfPath, consumeToken(path)→{existed,valid}, ensureStateDir(dir)→bool }`；順序：branch 段（取不到路徑也查 branch；repo 外才跳）→ file-type 段（不看 scope）；`PROTECTED` 與 tool_name 比對加 `/i` / 小寫；`tokenPathFor` 自己讀 env（win32：`TMP → TEMP → USERPROFILE → windir`；其他：`TMPDIR → TMP → TEMP → /tmp`）；WARN 訊息 token 行改 `node "<selfPath 正斜線>" --token "<tokenPath 正斜線>"`；子命令 `--token <path>` 建目錄 + 空檔；consumed.log 布林印 `True/False`；`CLAUDE_PROJECT_DIR` 指到不存在目錄 → git 失敗 → branch null → 放行（刻意差異，spec 列）；主程式判斷用 `argv[1]` 檔名 regex
- [ ] Step 3: `scripts/hook-equivalence.mjs`：`git show 8dbb203:hooks/<x>.ps1` 到 temp；臨時 repo 建 `main` / `Main`（Windows 不允許就 `Release`）/ `feat/x` 三 branch + detached HEAD + 空 repo；26 案（P2d 全部 + `CLAUDE_PROJECT_DIR` 未設只靠 cwd、相對路徑、大小寫不同 repo 路徑、`repo/../other/a.ts`、`.venv/x`、TEMP 指到檔案）；每案跑舊兩支 + 新一支，比 `max(舊 branch exit, 舊 file-type exit) == 新 exit`、第一行 `[bstack]` 標記集合（目前在 / BLOCK / WARN / state dir）相等、WARN 案兩邊印的 token 路徑相等（正規化分隔符後）、token 案跑完 token 檔已刪且 consumed.log 各多一行；`\r?\n` 切行；輸出對照表（欄位：# / tool / branch / 路徑 / token 狀態 / 舊 b / 舊 f / 舊 max / 新 / 舊標記 / 新標記 / 等價）
- [ ] Step 4: 跑對照測試全等；**不等時**：停、不重試；判「ps1 既有行為」→ 零改變照搬（或列刻意差異，寫進 spec）；「移植錯」→ 修 guard.mjs 重跑
- [ ] Step 5: hooks.json 改 `node "${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs"`（shell form、雙引號，與官方範例同）；刪兩支 ps1；P2a-e 綠
- [ ] Step 6: **缺 node 實測**：把 hooks.json 暫改成 `node-nope`，在臨時專案 `claude --plugin-dir D:/GitHub/bstack -p "<用 Write 建一個檔>" --output-format stream-json` 跑一次，記錄：transcript 有沒有 `non-blocking` 通知、檔案有沒有被寫；改回 `node`。結果進施工紀錄，rules.md / README 依實測寫
- [ ] Step 7: 計時：Bash `time` 與 PowerShell `Measure-Command` 各量「repo 外檔（不跑 git）」「repo 內檔」各 5 次中位數，對照 3.2 秒基線
- [ ] Step 8: commit `refactor: 兩支 pwsh hook 改寫成 hooks/guard.mjs，行為等價（對照測試 N 案）`

### Task 3: 延遲載入（brainstorm / design-language / rules.md，含這三檔的 hook 檔名）

**parallel-group**: 2
**files**: modify `skills/brainstorm/SKILL.md`、`skills/design-language/SKILL.md`、`skills/devwork/rules.md`

- [ ] Step 1: 紅 = P11
- [ ] Step 2: brainstorm §Phase 0b′ 四步改寫（仍四步）：
  1. 對 `codebase_impact.files` **先剔除路徑含 `skills/<name>/SKILL.md` 的 skill 定義目錄底下的檔**（plugin 快取、專案 `.claude/skills/`、repo `skills/` 都算；**不得用裸 `skills/` 比對**——與 design-language §使用契約 第 1 步同一條規則），再比對前端副檔名 `.css .scss .tsx .jsx .vue .svelte .html`（唯一真相在 design-language §前端副檔名，契約 P11 守三處一致）
  2. 不命中 → state 寫 `design: {involved:false, scope:null, scope_evidence:null, size:null, precedent:false, map_status:unknown}`，**不載 design-language**，進 0c
  3. 命中 → **載入 design-language、照它的使用契約從第 1 步跑**（第 1 步重算 `involved` 必為 true，多一層自我校驗），取回六欄
  4. `involved=true` → 進合併確認第 3 題
  「本階段只判不做」段：`hooks/branch-safety.ps1` → `hooks/guard.mjs`（branch-safety 段）；Red Flags「純後端 task，0b′ 跳過」列改「0b′ 必跑；brainstorm 自己做零成本副檔名比對，不命中就不載 design-language」；§Phase 0d「Tier 升降 trigger」句尾加理由「（爆炸半徑與行數無關）」（從 dev-workflow 搬來）
- [ ] Step 3: design-language：description「**強制**：brainstorm Phase 0b′ 必載」→「brainstorm 0b′ 比對命中前端副檔名才載；命中後照本契約從第 1 步跑」；§前端副檔名 加「唯一例外：brainstorm §Phase 0b′ 與 rules.md §設計語言對齊 重列本清單（不載入本 skill 時也要判得出來），契約 P11 守三處一致」；§與 dev-workflow 銜接 brainstorm 列同步；Red Flags「純後端 task，這個 skill 跳過」列改「純後端 task 本 skill 不會被載入；判定在 brainstorm 0b′，別在這裡重判」；:38 `hooks/branch-safety.ps1` → `hooks/guard.mjs`（branch-safety 段）
- [ ] Step 4: rules.md：§設計語言對齊「0b′ 必跑（含純後端 task；第一步是零成本的副檔名比對，不命中就結束）」→「0b′ 必跑（含純後端 task；brainstorm 自己做零成本副檔名比對，不命中就不載 design-language；命中則照舊必載——規則不變，只是比對這一步搬到 brainstorm）」；§Branch safety `hooks/branch-safety.ps1` → `hooks/guard.mjs`（branch-safety 段）、豁免段開頭「（實測 code 行為，非設計缺陷）」→「（契約 P2d 以 fixture 守的行為，非設計缺陷）」、末尾加一句依 Task 2 Step 6 實測結果寫「hook 跑在 node；官方文件：hook 起不來時印 non-blocking 通知、工具照跑、保護不存在；本機實測 <日期 / OS>：<結果>」；§File-type `hooks/file-type-guard.ps1` → `hooks/guard.mjs`（file-type 段）
- [ ] Step 5: P11 綠；守門快照三檔步驟數不變、選單不變；commit `refactor: brainstorm 0b′ 自做副檔名比對、命中才載 design-language；rules.md 同步 hook 檔名與缺 node 行為`

### Task 4: dev-workflow 去重

**parallel-group**: 2
**files**: modify `skills/dev-workflow/SKILL.md`

- [ ] Step 1: 紅 = P11 的 dev-workflow 子條件
- [ ] Step 2: 刪「Track 判定 heuristic」「Tier 判定 heuristic」兩表與「Tier 自動升級」段，換一行「Track / Tier 的預判表與『命中 File-type 硬規則自動升至少 T2』的規則見 `brainstorm` §Phase 0c / §Phase 0d；本 skill 不重貼，以免兩份漂移」；Phase 0 圖第 35 行「0b′ UI 面判定 ← 載 design-language；產出 design.* 六欄」→「0b′ UI 面判定 ← 比對前端副檔名，命中才載 design-language；產出 design.* 六欄」；分工表「routing 表 + hand-off state + heuristic → 本 skill」→「routing 表 + hand-off state → 本 skill；Track / Tier heuristic → brainstorm §0c / §0d」；跨流程表 design-language 列「brainstorm 0b′（必跑，含純後端 task）」→「brainstorm 0b′ 比對命中才載（比對在 brainstorm）」
- [ ] Step 3: P11 綠、P9c / P10b 綠；守門快照步驟數不變；commit `refactor: dev-workflow 刪與 brainstorm 重複的 heuristic 表，Phase 0 圖與分工表同步`

### Task 5: 公開文案與 install

**parallel-group**: 3
**files**: modify `README.md`、`docs/index.html`（第 75 / 128 / 129 行，皆文字節點）、`scripts/install.ps1`

- [ ] Step 1: 紅 = `grep -cE "兩支 hook|兩個 pwsh|靜默失效|\.ps1 hook|branch-safety\.ps1|file-type-guard\.ps1" README.md docs/index.html` ≥ 1
- [ ] Step 2: 三處統一一句：「hook 是 node 腳本，需要 `node` 在啟動 Claude Code 的環境 PATH 內（`node --version` 驗）；Claude Code 自己不帶 node，native 安裝的機器要另裝。pwsh 7+ 只有 `install.ps1` / `extras.ps1` 兩支可選的輔助腳本需要——不跑它們，照 `/plugin marketplace add` + `/plugin install` 兩行也裝得起來。」缺 node 那句依 Task 2 Step 6 實測寫（官方：印 non-blocking 通知、工具照跑、保護不存在）。README：hooks 表兩列改 `guard.mjs`（branch-safety 段 / file-type 段）、「每次 Write / Edit 多起兩個 pwsh」→「起一個 node（實測 <秒>）」、Prerequisites 表 pwsh 列改「`install.ps1` / `extras.ps1` / 開發本 repo（build-references.ps1）」、既有 node 列改「hook 必需；MCP 也用」（不是新增一列）、第 134 / 180 行同步；index.html :75 兩個 `<code>` 內文與「兩個 PreToolUse hook」→「一支」、:128 改上面那句（後半「MCP 另需 Node.js」併成「hook 與 MCP 都跑在 Node.js 上；statusLine 另需 bash 與 jq」）、:129「兩支 hook」→「hook」；install.ps1 第 72 行 ✘ 訊息主詞改「**本腳本**需要 pwsh 7+（hook 不需要，hook 跑 node）」、前置檢查加 `Get-Command node`（缺 → ✘ 印 `winget install OpenJS.NodeJS.LTS` / `brew install node`）、第 79 行提醒句改「hook 需要 node 在啟動 Claude Code 的環境 PATH 內」
- [ ] Step 3: grep = 0；P8 計數不變；`grep -c "<code>" docs/index.html` 前後相等（只改文字節點）
- [ ] Step 4: commit `docs: README / landing / install 改 hook 需 node、pwsh 只給輔助腳本`

### Task 6: 流程圖 label 與其餘檔名引用

**parallel-group**: 3
**files**: modify `docs/js/data.js`（HBranch / HFile / LoadDLang）、`skills/design-direction/SKILL.md`、`skills/finish-branch/SKILL.md`、`skills/dispatch-parallel/SKILL.md`

- [ ] Step 1: 紅 = `grep -rln "branch-safety.ps1\|file-type-guard.ps1" skills docs/js/data.js | wc -l` ≥ 4（Task 3 已處理 brainstorm / design-language）
- [ ] Step 2: data.js：HBranch label `guard.mjs（branch-safety 段）\nPreToolUse: Write / Edit / NotebookEdit`、HFile `guard.mjs（file-type 段）\n密鑰 / migration / lockfile / CI / infra`、LoadDLang `載入 skill：design-language\n0b′ 比對命中前端副檔名才載（比對在 brainstorm）`；三個 skill 的 `.ps1` 檔名 → `hooks/guard.mjs`（branch-safety 段）／（file-type 段），dispatch-parallel「兩個 PreToolUse hook」→「一支 PreToolUse hook（兩段檢查）」
- [ ] Step 3: grep = 0；C8a 96 / 135；守門快照反引號片段新增 `hooks/guard.mjs` 一個——允許，記施工紀錄
- [ ] Step 4: commit `docs: 流程圖三個 label 與三個 skill 的 hook 檔名改 guard.mjs`

### Task 7: 重產、總驗、施工紀錄

**parallel-group**: 4
**files**: regenerate `docs/js/references-data.js`；modify spec（§施工紀錄）

- [ ] Step 1: `build-references.ps1` 重產、`-Check` exit 0；三支契約全綠（含 `--selftest`）；守門快照對基線 8dbb203
- [ ] Step 2: spec 追加 §施工紀錄：對照測試表（表頭寫日期 / 基線 sha / pwsh 版 / node 版 / OS；表尾寫耗時對照與「stderr 允許差異：僅 token 指令行」）、缺 node 實測、守門結果、反引號新增說明、刻意差異清單
- [ ] Step 3: commit `chore: 重產 references-data.js、補施工紀錄`

---

## Self-review（v2）

- spec coverage：目標 1（Task 3 + P11）、2（Task 4）、3（Task 2 + P2d / P2e）、4（Task 2 Step 3 / 6）、5（Task 7）、6（Task 2 Step 7）；review 4 Critical 全進（Task 5 事實陳述、Task 2 Step 6 實測、P2d 案 4 / 20-22）
- 並行性：group 2 三 task 檔集合互斥（Task 2 = hooks + scripts/hook-equivalence；Task 3 = brainstorm + design-language + rules.md；Task 4 = dev-workflow）；Task 6 不再碰 Task 3 的檔
- 事實陳述：公開文案與 rules.md 的「缺 node」句子等 Task 2 Step 6 實測後才落，Task 5 / Task 3 Step 4 因此在 group 順序上都在 Task 2 之後或同 group 但引用其結果——**執行時 Task 3 / 5 的那一句最後填**
