# 效率優化三項 Implementation Plan

> 對應 spec: `docs/work/refactor/skill-load-and-node-hook/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-07
> 並行最大 group: 4
> 基線 sha: `8dbb203`

**Goal**: 三項效率改動落地、每項附「邏輯零改變」的機械證明（契約 + 守門快照 + hook 對照測試）。

**Architecture**: group 1 先改契約（紅）；group 2 三個獨立塊平行——hook 移植（含對照測試）、brainstorm / design-language / rules.md 延遲載入、dev-workflow 去重；group 3 公開文案與流程圖 label（依賴 group 2 的檔名定案）；group 4 重產 + 總驗 + 施工紀錄。

**Risks**: hook 重寫；brainstorm 與 design-language 清單雙寫；三個 subagent 都會碰 rules.md 的話撞檔——所以 rules.md 全部交給 Task 3 一個人改。

---

### Task 1: 契約先紅

**parallel-group**: 1
**files**: modify `scripts/plugin-contract.mjs`

- [ ] Step 1: 改 P2a `hookCmds.length >= 2` → `>= 1` 且每個 command 含 `node`；P2b 不動；P2c 改驗 `hooks/guard.mjs` 存在且不含 `state[\\/]file-guard`；P4 掃描清單 `hooks/*.ps1` → `hooks/guard.mjs`
- [ ] Step 2: 新增 **P2d**：`import` guard.mjs 匯出的 `decide(payload, env)` 純函式（不做 IO 的判定核心），對 fixture 跑：protected branch 內檔 → block；feature branch → pass；repo 外 → pass；`.env` → BLOCK；`.env.example` → pass；`id_rsa` → BLOCK；`migrations/x.sql` 無 token → WARN；`package-lock.json` → WARN；`Dockerfile` → WARN；`a.ts` → pass；NotebookEdit `notebook_path` 走同規則；未知 tool → pass；壞 JSON → pass
- [ ] Step 3: 新增 **P11**：brainstorm 0b′ 引用的副檔名清單字串 == design-language §前端副檔名 code block 內容；brainstorm 0b′ 段含「不命中」「不載」；dev-workflow 跨流程表 design-language 列含「命中才載」；dev-workflow 無「Track 判定 heuristic」「Tier 判定 heuristic」字樣
- [ ] Step 4: 跑契約：P2a / P2c / P2d / P11 紅（`--selftest` 仍綠）
- [ ] Step 5: commit `test: 契約 P2 系列改 node hook、新 P2d fixture 與 P11 清單一致`

### Task 2: hooks/guard.mjs 移植 + 對照測試

**parallel-group**: 2
**files**: create `hooks/guard.mjs`、`scripts/hook-equivalence.mjs`（一次性對照，結果進 spec）；modify `hooks/hooks.json`；delete `hooks/branch-safety.ps1`、`hooks/file-type-guard.ps1`

- [ ] Step 1: 紅 = P2a / P2c / P2d 紅（Task 1 已建）
- [ ] Step 2: 寫 `guard.mjs`：`export function decide(payload, ctx)` 回 `{ exit, lines[] }`，ctx 含 `repoDir / branch / tokenExists(path) / consumeToken(path) / ensureStateDir()` 的注入點；CLI 段讀 stdin、跑 git、組 ctx、印 stderr、`process.exit`。逐條照 spec §等價清單 B1-B6 / F1-F6 / C1-C3。stderr 訊息逐字從 ps1 搬，token 指令行改 `node -e "require('fs').mkdirSync(require('path').dirname(process.argv[1]),{recursive:true});require('fs').writeFileSync(process.argv[1],'')" "<tokenPath>"`，後面括號註 pwsh 舊寫法仍可
- [ ] Step 3: 寫 `scripts/hook-equivalence.mjs`：從 `git show 8dbb203:hooks/<x>.ps1` 取舊 hook 到 temp；建一個臨時 git repo（main 與 feat 兩個 branch）；對 ≥16 個 payload 各跑 舊兩支 + 新一支，比 exit code 與 stderr 第一行 `[bstack]` 後的標記；WARN + token 案要各自預建 token；印對照表、任何不等 exit 1
- [ ] Step 4: `node scripts/hook-equivalence.mjs` 全等；hooks.json 改一個 command `node "${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs"`；刪兩支 ps1；P2a / P2b / P2c / P2d 綠；實測 `time` 一次 hook
- [ ] Step 5: commit `refactor: 兩支 pwsh hook 改寫成 hooks/guard.mjs，行為等價（對照測試 N 案）`

### Task 3: design-language 延遲載入（brainstorm / design-language / rules.md）

**parallel-group**: 2
**files**: modify `skills/brainstorm/SKILL.md`（§Phase 0b′）、`skills/design-language/SKILL.md`（frontmatter description 一句、§與 dev-workflow 銜接 brainstorm 列、§使用契約 第 1 步加一句「呼叫端已比對過時直接進第 2 步」）、`skills/devwork/rules.md`（§設計語言對齊「0b′ 必跑」句、§Branch safety / §File-type 檔名、「缺 pwsh 靜默失效」→「缺 node 會報錯」）

- [ ] Step 1: 紅 = P11 紅
- [ ] Step 2: brainstorm 0b′ 四步改寫（仍四步）：1. 對 `codebase_impact.files` 先剔除 skill 定義目錄（規則同 design-language §使用契約 第 1 步），再比對 design-language §前端副檔名 清單（`.css .scss .tsx .jsx .vue .svelte .html`，**這裡的清單以那節為唯一真相、契約 P11 守一致**）；2. 不命中 → `design: {involved:false, scope:null, scope_evidence:null, size:null, precedent:false, map_status:unknown}` 寫進 state，**不載 design-language**，進 0c；3. 命中 → 載 design-language、從它第 2 步（判 size）接下去，取回六欄；4. `involved=true` → 進合併確認第 3 題。「本階段只判不做」段與 Red Flags 不動（「純後端跳 0b′」那列仍成立：0b′ 照跑，只是不載）
- [ ] Step 3: design-language description「**強制**：brainstorm Phase 0b′ 必載」→「brainstorm 0b′ 比對命中前端副檔名才載」；§與 dev-workflow 銜接 brainstorm 列同步；§使用契約 第 1 步尾加「呼叫端（brainstorm 0b′）已做過同一比對時，帶著它的結果直接進第 2 步」
- [ ] Step 4: rules.md：§設計語言對齊「0b′ 必跑（含純後端 task；第一步是零成本的副檔名比對，不命中就結束）」→「0b′ 必跑（含純後端 task；brainstorm 自己做零成本的副檔名比對，不命中就不載 design-language）」；§Branch safety `hooks/branch-safety.ps1` → `hooks/guard.mjs`（branch-safety 段）、豁免段末「缺 pwsh 靜默失效」相關句改「hook 是 node 腳本，缺 node 時 Claude Code 會報 hook 執行失敗、不會靜默放行」；§File-type `hooks/file-type-guard.ps1` → `hooks/guard.mjs`（file-type 段）
- [ ] Step 5: P11 綠；守門快照 brainstorm / design-language 步驢數不變；commit `refactor: brainstorm 0b′ 自做副檔名比對，命中才載 design-language；rules.md 同步 hook 檔名`

### Task 4: dev-workflow 去重

**parallel-group**: 2
**files**: modify `skills/dev-workflow/SKILL.md`

- [ ] Step 1: 紅 = P11 的 dev-workflow 子條件紅
- [ ] Step 2: 刪 §Phase 0 入口分流 底下「Track 判定 heuristic」表、「Tier 判定 heuristic」表、「Tier 自動升級」段，換一行「Track / Tier 的判定表與自動升級規則見 `brainstorm` §Phase 0c / §Phase 0d，本 skill 不重貼」；「0b′ 與 0c/0d 的關係」「三者合併 AskUserQuestion」兩段留；§跨流程 skill 載入 design-language 列「brainstorm 0b′（**必跑**，含純後端 task）」→「brainstorm 0b′ 比對命中才載（比對本身在 brainstorm）」；dispatch-parallel 列的「兩個 PreToolUse hook」不在本檔（在 dispatch-parallel:136，Task 6 改）
- [ ] Step 3: P11 綠、P9c / P10b 仍綠；守門快照 dev-workflow 步驟數不變
- [ ] Step 4: commit `refactor: dev-workflow 刪與 brainstorm 重複的 heuristic 表、design-language 列改命中才載`

### Task 5: 公開文案與 install

**parallel-group**: 3
**files**: modify `README.md`、`docs/index.html`（第 128 行文字節點）、`scripts/install.ps1`

- [ ] Step 1: 紅 = `grep -c "branch-safety.ps1\|file-type-guard.ps1" README.md` ≥1；`grep -c "hook 必需" docs/index.html` = 1
- [ ] Step 2: README hooks 表兩列改「guard.mjs（branch-safety 段 / file-type 段）」、「每次 Write / Edit 會多起兩個 pwsh」→「起一個 node（約 0.4 秒）」、「pwsh 7+ 是 hook 必需」段改「hook 需要 node（Claude Code 本身就是 node 程式，一律有）；pwsh 7+ 只有 `scripts/install.ps1` / `extras.ps1` 需要」、Prerequisites 表 pwsh 列同步、加 node 列；index.html 第 128 行「需要 pwsh 7+（hook 必需，缺了不會報錯、保護直接不存在）」→「hook 跑在 node 上（Claude Code 自帶）；pwsh 7+ 只有 install.ps1 / extras.ps1 需要」——**只改文字節點**；install.ps1 第 79 行提醒句改「hook 是 node 腳本，跟著 Claude Code 走、不需要額外裝」
- [ ] Step 3: `grep` 兩處 = 0；P8 計數不變；`node scripts/text-only-diff.mjs 8dbb203...HEAD` 對 index.html 那段的判定記錄（預期因 data.js 判 NOT）
- [ ] Step 4: commit `docs: README / landing / install 改 hook 需 node、pwsh 只給 install 與 extras`

### Task 6: 流程圖 label 與五個 skill 的檔名引用

**parallel-group**: 3
**files**: modify `docs/js/data.js`（HBranch / HFile / LoadDLang）、`skills/brainstorm/SKILL.md:57`、`skills/design-direction/SKILL.md:37`、`skills/design-language/SKILL.md:38`、`skills/finish-branch/SKILL.md:170`、`skills/dispatch-parallel/SKILL.md:136`

- [ ] Step 1: 紅 = `grep -rn "branch-safety.ps1\|file-type-guard.ps1" skills docs/js/data.js | wc -l` ≥6
- [ ] Step 2: data.js：HBranch label `guard.mjs（branch-safety 段）\nPreToolUse: Write / Edit / NotebookEdit`、HFile label `guard.mjs（file-type 段）\n密鑰 / migration / lockfile / CI / infra`、LoadDLang label `載入 skill：design-language\n0b′ 比對命中前端副檔名才載（比對在 brainstorm）`；五個 skill 的 `hooks/branch-safety.ps1` → `hooks/guard.mjs`（branch-safety 段）、`file-type-guard` 字樣在句子裡的保留（那是段名），只改帶 `.ps1` 的
- [ ] Step 3: grep = 0；C8a 96 / 135；守門快照：反引號片段新增 `hooks/guard.mjs` 一個——**允許**，記入施工紀錄
- [ ] Step 4: commit `docs: 流程圖三個 label 與五個 skill 的 hook 檔名改 guard.mjs`

### Task 7: 重產、總驗、施工紀錄

**parallel-group**: 4
**files**: regenerate `docs/js/references-data.js`；modify spec（§施工紀錄）

- [ ] Step 1: `build-references.ps1` 重產、`-Check` exit 0；三支契約全綠（含 `--selftest`）；守門快照 11 檔（含 brainstorm / dev-workflow / design-language 新基線 8dbb203）
- [ ] Step 2: 實測 hook 時間：同一 payload `time node hooks/guard.mjs` 對照 3.2 秒基線
- [ ] Step 3: spec 追加 §施工紀錄：對照測試表、時間、守門結果、反引號新增說明、frontend-test 結果（verify-done 階段）
- [ ] Step 4: commit `chore: 重產 references-data.js、補施工紀錄`

---

## Self-review

- spec coverage：目標 1（Task 3 + P11）、2（Task 4）、3（Task 2）、4（Task 2 Step 3 + P2d）、5（Task 7）、6（Task 7 Step 2）✓
- 並行性：group 2 三個 task 的檔集合互斥（Task 2 = hooks + hooks.json + scripts/hook-equivalence；Task 3 = brainstorm 0b′ + design-language + rules.md；Task 4 = dev-workflow）。**注意** Task 6 也動 brainstorm:57 / design-language:38 兩行檔名——放 group 3、在 Task 3 收完後才跑，不撞
- placeholder：無；P2d fixture 清單明列 13 案、對照測試 ≥16 案
- 待 review-plan 三視角：Eng（hook 等價與契約）、Design（hook 對 Claude Code 的介面：stderr 訊息、exit code、token 指令）、DX（README / landing 措辭、brainstorm 0b′ 讀得懂嗎）
