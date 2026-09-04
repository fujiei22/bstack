# skill 文本瘦身 Implementation Plan

> 對應 spec: `docs/work/refactor/skill-text-slim/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-04
> 並行最大 group: 4

**Goal**: 11 個階段 SKILL.md 合計 2,533 → ≤1,520 行，契約全綠、使用契約步驟 / 選單文字 / frontmatter 不動。

**Architecture**: 每檔一個 task、各檔互不引用行號，三個 parallel group 各 3-4 檔由 subagent 平行改；主 agent 收回後統一跑契約、逐檔 commit。最後一個 group 重產 references-data.js 並做總行數斷言。

**Tech Stack**: markdown；驗證 = `node scripts/plugin-contract.mjs`、`node docs/tools/docs-site-contract.mjs`、`pwsh -File scripts/build-references.ps1 -Check`、`wc -l`。

**Risks**: 契約守不到的措辭被改掉語意（靠 review-plan Eng 逐檔對 diff）；砍過頭讀不懂（DX）。

---

## §共同施工守則（每個 task 的 subagent prompt 都附這段）

**目標**：把 `skills/<name>/SKILL.md` 從 N 行砍到 ≤ 目標行，**行為零改變**。

**不能動**：
1. frontmatter 整段（`---` 到 `---`）一個字都不改
2. 「## 使用契約（強制）」的步驟**數量與順序**；每步的動作動詞（讀 / 判 / spawn / 交棒）保留，可縮句子
3. 所有 `AskUserQuestion` 選單的選項文字（含「（推薦）」標記與編號）
4. 章節骨架：`使用契約 → §各段 → §hand-off state → §結尾 Trace 標籤 → §Red Flags`；`§` 開頭的標題名不改（別的 skill 用名字引用它們）
5. 任何被 `scripts/plugin-contract.mjs` 斷言的字串（改完跑一次，紅了就把那句改回去，**不改契約**）
6. 指令 / 路徑 / 檔名 / 數字 / regex 一律精確保留

**砍法（依序）**：
1. §Red Flags 表：留 3-5 列——只留「真的會被 rationalize 掉的」（例：跳 Phase 0、靜默 retry、危險類自 fix）；同一件事換句話說的合併
2. §hand-off state yaml：只列**本 skill 新增或改寫的欄位**，其餘一句「其餘欄位見 dev-workflow §Skill hand-off state」
3. 「為什麼要這樣」長段：一句話留 WHY（可用 `> ` 引言一行），細節刪
4. 範例 code block：同類只留一個
5. 重複貼的表 / 清單（別的 skill 或 rules.md 已有的）：改成一行指向

**產出**：改完跑 `node scripts/plugin-contract.mjs | grep -E "FAIL|ALL PASS"` 與 `wc -l skills/<name>/SKILL.md`，回報：前後行數、砍了哪些段（章節名列表）、契約結果、有沒有任何「不能動」項被迫動到（有就說明）。**不 commit**，主 agent 收。

---

### Task 1: brainstorm 329 → ≤200

**parallel-group**: 1
**files**: modify `skills/brainstorm/SKILL.md`

- [ ] Step 1: 紅 = `test $(wc -l < skills/brainstorm/SKILL.md) -le 200`（現在 329，FAIL）
- [ ] Step 2: 跑，確認 FAIL
- [ ] Step 3: 依 §共同施工守則 砍；額外兩處措辭：§施工清單規則 的「≤ 8 列，超過回 0d 升 T3」→「列數上限依 rules.md §Tier 表，超過回 0d 升 T3」；§交棒 的「依 spec 自拆 1-3 task」→「依 spec success criteria 自拆 task」。spec 範本 code block 內的 HTML 註解可縮但 `## 施工清單` `## 施工紀錄` 兩行裸標題必留
- [ ] Step 4: 行數 ≤200；契約 P9b 綠；`grep -c "1-3 task"` = 0；`grep -c "8 列"` = 0
- [ ] Step 5: commit `refactor: brainstorm 文本瘦身`

### Task 2: write-plan 223 → ≤135

**parallel-group**: 1
**files**: modify `skills/write-plan/SKILL.md`

- [ ] Step 1-2: 行數斷言 ≤135，FAIL
- [ ] Step 3: 砍 §Task 結構 範例的 5 個 code block 縮成 1 個 python + 1 個指令；§並行性分析 範例六行留三行；§No-placeholder 表縮到 4 列；§Self-review 五點縮句
- [ ] Step 4: ≤135；P9h 綠（無 `Eng-only`）
- [ ] Step 5: commit `refactor: write-plan 文本瘦身`

### Task 3: review-plan 245 → ≤150

**parallel-group**: 1
**files**: modify `skills/review-plan/SKILL.md`

- [ ] Step 1-2: ≤150，FAIL
- [ ] Step 3: §視角 prompt 模板 的第 2 / 4 段說明合併成一個共用骨架；三個視角只列各自的「看什麼」清單；§結果整合 範本縮；§User gate 選單文字**一字不改**
- [ ] Step 4: ≤150；P9h 綠（`依改動面向` 或 `命中幾個派幾個` 仍在、無 CEO）
- [ ] Step 5: commit `refactor: review-plan 文本瘦身`

### Task 4: execute-plan 242 → ≤150 ＋ rules.md 一句

**parallel-group**: 1
**files**: modify `skills/execute-plan/SKILL.md`、`skills/devwork/rules.md:130`

- [ ] Step 1-2: ≤150，FAIL
- [ ] Step 3: §前端檔處理 的引言與「為什麼一定要回寫」縮成一行；六選項文字不動；§Parallel-group 派發 範例縮；§Commit 格式 改成指向 rules.md §Commit 訊息 只留 type 對照表；§Blocker 縮；第 1 步「或超過 8 列 → 交棒…（超過 8 列要回 0d 升 T3）」→「或超過 rules.md §Tier 表 的列數上限 → 交棒 brainstorm §補施工清單入口」。rules.md:130 「超過 8 列代表 Tier 判低了」→「超過表列上限代表 Tier 判低了」
- [ ] Step 4: ≤150；P9a / P9b 綠；`grep -c "8 列" skills/execute-plan/SKILL.md` = 0；rules.md 只剩 Tier 表那列含「≤8 列」
- [ ] Step 5: commit `refactor: execute-plan 文本瘦身、8 列上限收到 rules.md 一處`

### Task 5: tdd-cycle 341 → ≤200

**parallel-group**: 2
**files**: modify `skills/tdd-cycle/SKILL.md`

- [ ] Step 1-2: ≤200，FAIL
- [ ] Step 3: §順序的價值 / §好測試的要素 / §常見 rationalization / §Red Flags / §最終規則 合併成一個 §Red Flags（≤6 列）；§Bug fix 範例 整段刪（RED / GREEN 段已各有範例）；§卡住怎麼辦 / §跟 debug 銜接 各留 3 行；RED / GREEN / REFACTOR 五步與 Iron Law 原句保留
- [ ] Step 4: ≤200；契約綠（無直接斷言）；`grep -c "Iron Law"` ≥1
- [ ] Step 5: commit `refactor: tdd-cycle 文本瘦身`

### Task 6: verify-done 175 → ≤110

**parallel-group**: 2
**files**: modify `skills/verify-done/SKILL.md`

- [ ] Step 1-2: ≤110，FAIL
- [ ] Step 3: §Verify 套餐 三小節合成一張 tier × 項目表；§hand-off state 只留 `verify_results` / `e2e` / `design_rejudge` 新增欄；**§UI / browser e2e 與 §漏網複查 的步驟不動**（下一支 PR 要改觸發條件）；§verify 失敗處置 選單文字不動
- [ ] Step 4: ≤110；契約綠；`grep -c "§UI / browser e2e"` = 1、`grep -c "§漏網複查"` ≥1
- [ ] Step 5: commit `refactor: verify-done 文本瘦身`

### Task 7: request-review 249 → ≤160

**parallel-group**: 2
**files**: modify `skills/request-review/SKILL.md`

- [ ] Step 1-2: ≤160，FAIL
- [ ] Step 3: §T1 / §T2 自檢 / §T3 對齊 subagent 三份回報範本合成 §結果整合 一份；§T2 的「medium 做什麼」實測段留一行、細節在 spec 與 memory；Red Flags 7→4；**§副檔名分流 表、兩個 `Skill("code-review", args=…)` 呼叫、對齊 subagent prompt、§語言提示 表不動**
- [ ] Step 4: ≤160；P9a / P9c 綠
- [ ] Step 5: commit `refactor: request-review 文本瘦身`

### Task 8: receive-review 162 → ≤100

**parallel-group**: 2
**files**: modify `skills/receive-review/SKILL.md`

- [ ] Step 1-2: ≤100，FAIL
- [ ] Step 3: §不危險 vs 危險分類 三小節合成一張表（不危險 / 危險 / 灰色三欄）；§特殊狀況 三小節各一行；§危險處置 選單文字不動；「一顆 commit」句與 body 格式不動
- [ ] Step 4: ≤100；P9e 綠
- [ ] Step 5: commit `refactor: receive-review 文本瘦身`

### Task 9: security-audit 148 → ≤90

**parallel-group**: 3
**files**: modify `skills/security-audit/SKILL.md`

- [ ] Step 1-2: ≤90，FAIL
- [ ] Step 3: §Dispatch prompt 縮到只剩必要輸入 / 輸出格式；§Critical-finding 流程 選單不動；hand-off yaml 只留新增欄
- [ ] Step 4: ≤90；契約綠
- [ ] Step 5: commit `refactor: security-audit 文本瘦身`

### Task 10: finish-branch 335 → ≤200

**parallel-group**: 3
**files**: modify `skills/finish-branch/SKILL.md`

- [ ] Step 1-2: ≤200，FAIL
- [ ] Step 3: §Commit 範例 4→1；§Rebase vs Merge 刪（一句留在 §Rebase main）；§Squash merge 的 WHO / WHEN / HOW 合成一段 ≤8 行、「Past 授權不延續」原句保留；§特殊情境 三小節各一行；§Branch 命名 與 §Commit 訊息規範 指向 rules.md 只留範例；**§PR body 模板、§Conflict 流程 選單、§Clean check 清單不動**
- [ ] Step 4: ≤200；P9d 綠（`T3 → 交棒 pr-explain`、`N/A（T2`）
- [ ] Step 5: commit `refactor: finish-branch 文本瘦身`

### Task 11: pr-explain 84 → ≤60

**parallel-group**: 3
**files**: modify `skills/pr-explain/SKILL.md`

- [ ] Step 1-2: ≤60，FAIL
- [ ] Step 3: §注意 縮；六步的指令 code block 保留；frontmatter 不動
- [ ] Step 4: ≤60；P9d 綠
- [ ] Step 5: commit `refactor: pr-explain 文本瘦身`

### Task 12: 重產 references-data.js ＋ 總行數斷言 ＋ 施工紀錄

**parallel-group**: 4
**files**: regenerate `docs/js/references-data.js`；modify `docs/work/refactor/skill-text-slim/spec.md`（追加 §施工紀錄）

- [ ] Step 1-2: 紅 = 11 檔 `wc -l` 合計 ≤1,520 且 `build-references.ps1 -Check` exit 0（重產前 -Check 必 FAIL）
- [ ] Step 3: `pwsh -NoProfile -File scripts/build-references.ps1`；spec 追加 §施工紀錄（前後行數表、每檔砍了什麼、契約結果）
- [ ] Step 4: 合計 ≤1,520；三支驗證全綠
- [ ] Step 5: commit `chore: 重產 references-data.js、補瘦身前後對照`

---

## Self-review

- spec coverage：−40%（Task 12 斷言）✓、契約全綠（每 task Step 4）✓、不動清單（守則 1-6）✓、兩個 nit（Task 1 / 4）✓、Red Flags ≥3（守則砍法 1）✓
- placeholder：無
- 並行性：group 1-3 各檔互不引用行號；Task 4 動 rules.md 一句、Task 1 動 brainstorm 一句，兩句互相引用「rules.md §Tier 表」這個名稱而非行號，可同 group
- scope：未動 17 個非階段 skill、未動契約
