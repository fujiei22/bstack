# skill 文本瘦身 Implementation Plan（v2，依 review.md 改）

> 對應 spec: `docs/work/refactor/skill-text-slim/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-04
> 並行最大 group: 6
> 基線 sha: `b15efa9`（11 檔 2,533 行 / 97,861 bytes）

**Goal**: 11 個階段 SKILL.md 合計行數 ≤1,520（−40%）、bytes ≤68,500（−30%，證明不是刪空行灌水）；契約全綠、守門快照四項零差異。

**Architecture**: 每檔一個 task，五個 parallel group 由 subagent 平行改（同 group 的檔不被同一條契約讀到，或都在同 group 內由主 agent 收完再算）；主 agent 收回後跑契約 + 守門快照，逐檔 commit；最後 group 重產 references-data.js、做總量斷言、寫施工紀錄。

**Risks**: 單檔目標可能低於受保護內容下限（brainstorm / finish-branch / tdd-cycle / pr-explain），單檔目標是軟目標，總量由 Task 12 守；到不了就誠實報差距，不砍保護項。

---

## §共同施工守則（每個 task 的 subagent prompt 逐字附上）

**目標**：把 `skills/<name>/SKILL.md` 從 N 行砍到目標行（軟目標；bytes 也要降），**行為零改變**。

**不能動（六條）**：
1. frontmatter 整段（`---` 到 `---`）一個字都不改。
2. 「## 使用契約（強制）」底下的**編號步驟數量與順序**（含 2.5 / 3.5 這種）；每步的動作動詞（讀 / 判 / spawn / 交棒 / 跑 / commit）保留，句子可縮。
3. **所有 AskUserQuestion 選單逐字保留**。識別規則：含 `AskUserQuestion` 字樣的句子之後，**第一個清單**（不論是 code block 內的 `選項：` 編號、縮排編號列、還是 `- **retry** — …` 這種 bullet）到下一個空行或標題為止，整塊不動。含 `<區塊名>` 這種佔位也算選單文字。
4. **被別檔引用的 § 標題不改名**（白名單）：brainstorm `§Phase 0a` `§Phase 0b` `§Phase 0b′` `§Phase 0c` `§Phase 0d` `§Phase 0c/0d 合併確認` `§spec 文件結構與落檔` `§補施工清單入口` `§交棒`；review-plan `§結果整合` `§User gate` `§視角 prompt 模板`；execute-plan `§前端檔處理` `§Task 推進規則` `§Task fail 處置` `§Blocker` `§hand-off state` `§Verify 規則`；verify-done `§UI / browser e2e` `§漏網複查` `§verify 失敗處置` `§Verify 套餐`；request-review `§副檔名分流` `§結果整合` `§語言提示` `§T1 self review`；receive-review `§不危險處置` `§危險處置`；security-audit `§Dispatch` `§Critical-finding 流程`；finish-branch `§Conflict 流程` `§PR body 模板` `§hand-off state` `§Squash merge` `§Clean check` `§Merge 後：docs 歸檔` `§特殊情境`；tdd-cycle `§The Iron Law` `§RED` `§Verify RED` `§GREEN` `§Verify GREEN` `§REFACTOR`。**白名單外的 § 可合併 / 刪**。骨架（使用契約 → § 段 → §hand-off state → §結尾 Trace 標籤 → §Red Flags）只要求既有段不重排、**不新增本來沒有的段**。
5. 被 `scripts/plugin-contract.mjs` 斷言的字串：改完跑 `node scripts/plugin-contract.mjs | grep -E "FAIL|ALL PASS"`，**只處理錯誤訊息點名到自己這個檔的 FAIL**（把那句改回去），別的檔的 FAIL 原樣回報不動、**不改契約**。
6. 指令 / 路徑 / 檔名 / regex / 反引號片段 / 數字一律精確保留（可整段刪，不可改寫、不新增反引號片段）；例外只有 task 明列的兩個 nit（「≤ 8 列」「1-3 task」）。

**砍法（依序）**：
1. §Red Flags：留 task 指定的那幾列（3-6 列、下限 3），同義列合併。
2. §hand-off state yaml **不砍**（下游照它讀欄名）；唯一例外見 Task 6。
3. 「為什麼」長段：每個被砍的段留**恰一行**引言，固定格式 `> 為什麼<動作>：<機制一句>。不做會<後果一句>（實測 <YYYY-MM-DD>）`；task 指定「必留 WHY」的照列。
4. 範例 code block：同類只留一個；`❌` 反例可刪、`✅` 正例留。
5. 別檔已有的表 / 清單改成一行指向，格式固定 `見 <skill-name> §<段名>` 或 `見 rules.md §<段名>`。
6. `---` 分隔線與連續空行可刪，但不算數——bytes 也要降。

**產出（回報格式，不 commit）**：
```
檔：skills/<name>/SKILL.md
行數：N → M（目標 T）  bytes：B0 → B1
砍掉的段：<章節名列表>
保留的 WHY 引言：<逐行列出>
契約：ALL PASS | FAIL <點名自己檔的條目與處置> | 其他檔 FAIL：<原樣>
被迫動到「不能動」項：無 | <哪一條、為什麼>
```

**失敗處置（主 agent）**：行數差目標 ≤10% → 接受、施工紀錄註明；差 >10% 或動到「不能動」項 → 該檔 `git checkout` 回基線、以「不動保護項」為準重派一次；第二次仍到不了 → 接受現況、施工紀錄與 PR body 明列給 user。**不得由 subagent 自行放寬。**

---

### Task 1: brainstorm 329 → ≤240（軟）

**parallel-group**: 1
**files**: modify `skills/brainstorm/SKILL.md`

- [ ] Step 1-2: 紅 = `test $(wc -l < skills/brainstorm/SKILL.md) -le 240`（現 329，FAIL）
- [ ] Step 3: 砍點：§Phase 0c/0d 合併確認 的四段 `> ` 引言——「為什麼攤平」留機制一句（`options` 是平行陣列沒巢狀、做不到追問）；「為什麼只有兩條路徑」**必留**（design-direction 產出自檢硬要求 `design-demos/` 3 個 `.html`）；「只前移設計路徑、四項對齊留在 design-direction」是規則、整句留；「前移的代價」刪。spec 範本 code block 內的 HTML 註解可縮，`## 施工清單` `## 施工紀錄` 兩行裸標題必留。§交棒 yaml 不砍。Red Flags 9→5：留「跳 0a」「猜 tier 不問」「純後端跳 0b′」「T1 不問 UI 判定（禁 Tier 推 size）」「T2 也寫 plan.md」；「spec 短不落檔」+「設計簡單不寫 spec」合一、「memory 不讀」併入 0a 列。**兩個 nit**：§施工清單規則 與 §補施工清單入口 兩處「≤ 8 列」→「列數上限依 rules.md §Tier 表」；§交棒「依 spec 自拆 1-3 task」→「依 spec success criteria 自拆 task」
- [ ] Step 4: ≤240；P9b 綠；`grep -c "8 列"` = 0；`grep -c "1-3 task"` = 0；`grep -c '^> 為什麼'` ≥2
- [ ] Step 5: commit `refactor: brainstorm 文本瘦身`

### Task 4: execute-plan 242 → ≤150 ＋ rules.md 一句

**parallel-group**: 1
**files**: modify `skills/execute-plan/SKILL.md`、`skills/devwork/rules.md`（只動「超過 8 列代表 Tier 判低了」那句）

- [ ] Step 1-2: ≤150，FAIL
- [ ] Step 3: §前端檔處理 引言縮；「為什麼一定要回寫 `state.design`」那行**原句保留**（已是一行）；六選項與「不得自行選定」「無人值守停在這裡」原句留。§Parallel-group 派發 範例六行留三行；§Commit 格式 改成 `見 rules.md §Commit 訊息` + type 對照表；§Blocker 縮成一行清單。Red Flags 6→4：留「跳 tdd-cycle」「同 group 自己跑」「fail 多 retry」「subagent 結果我替他 commit」；「verify pass 就 commit」+「多 task 一個 commit」合一。**兩個 nit**：第 1 步「T1 依 success criteria 自拆 1-3 個 task」→ 去掉數字；「或超過 8 列 → 交棒 brainstorm §補施工清單入口（超過 8 列要回 0d 升 T3）」→「或超過 rules.md §Tier 表 的列數上限 → 交棒 brainstorm §補施工清單入口」。rules.md:130「超過 8 列代表 Tier 判低了」→「超過表列上限代表 Tier 判低了」
- [ ] Step 4: ≤150；P9a / P9b 綠；`grep -c "8 列" skills/execute-plan/SKILL.md` = 0；`grep -c "1-3 個"` = 0；`grep -c "8 列" skills/devwork/rules.md` = 1（只剩 Tier 表）；`grep -c '^> 為什麼'` ≥1
- [ ] Step 5: commit `refactor: execute-plan 文本瘦身、8 列上限收到 rules.md 一處`

### Task 2: write-plan 223 → ≤130

**parallel-group**: 2
**files**: modify `skills/write-plan/SKILL.md`

- [ ] Step 1-2: ≤130，FAIL
- [ ] Step 3: §Task 結構 範例的五個 code block 縮成「1 個 python 測試 + 1 行指令 + 1 行 commit」；§並行性分析 範例六行留三行；§No-placeholder 表 7→4 列；§Self-review 五點各一句；§檔案結構規劃 表留、原則三條合一句。Red Flags 6→4：留「task 寫粗」「placeholder 之後補」「self-review 等 user 看」「跳過 review-plan」
- [ ] Step 4: ≤130；P9h 綠（無 `Eng-only`）
- [ ] Step 5: commit `refactor: write-plan 文本瘦身`

### Task 3: review-plan 245 → ≤145

**parallel-group**: 2
**files**: modify `skills/review-plan/SKILL.md`

- [ ] Step 1-2: ≤145，FAIL
- [ ] Step 3: §視角 prompt 模板：第 2 段留「標的不是 code 時逐條改寫」規則、`要 review 的不是程式，是 <標的性質>…` 模板句、五列對照表、一句「兩欄都不屬於時自己答『壞掉長什麼樣』」，砍 2026-09-03 產出器實例敘述；第 4 段 code block 三行 prompt 不動，故事縮成必留 WHY：`> 為什麼要寫「用 SendMessage 送回」：實測四個 reviewer 全部只送 idle 訊號，主 session 逐一去要才拿到——「做完」跟「送到」在 subagent 眼裡是同一件事（實測 2026-09-03）`。三視角 prompt 共用「讀 spec 與 plan / 回報格式同 Eng」骨架，各視角只列問題。§結果整合 範本縮。§User gate 選單一字不改。Red Flags 5→4：留「主 agent 自己 review」「視角少一個沒差」「沒 critical 就直接過」「T2 進來了就順便審」（措辭不得含 `T2 不能跳` / `T2 仍需`）
- [ ] Step 4: ≤145；P9h 綠；`grep -c '^> 為什麼'` ≥2
- [ ] Step 5: commit `refactor: review-plan 文本瘦身`

### Task 5: tdd-cycle 341 → ≤220（軟）

**parallel-group**: 3
**files**: modify `skills/tdd-cycle/SKILL.md`

- [ ] Step 1-2: ≤220，FAIL
- [ ] Step 3: §順序的價值 / §好測試的要素 / §常見 rationalization / §Red Flags / §最終規則 合併成一個 §Red Flags（≤6 列，從既有列挑：先寫 code 再補測、太簡單跳過、看到綠就不 refactor、沒跑紅也算紅、一次寫很多測試、mock 一切）；§Bug fix 範例 整段刪；§卡住怎麼辦 / §跟 debug 銜接 各留 3 行；RED / GREEN 段的 `❌` 反例可刪、`✅` 正例與說明留；§The Iron Law 與五步標題原句保留；§什麼時候用 縮成一表
- [ ] Step 4: ≤220；契約綠；`grep -c "Iron Law"` ≥1
- [ ] Step 5: commit `refactor: tdd-cycle 文本瘦身`

### Task 6: verify-done 175 → ≤105

**parallel-group**: 3
**files**: modify `skills/verify-done/SKILL.md`

- [ ] Step 1-2: ≤105，FAIL
- [ ] Step 3: §Verify 套餐 三小節合成一張 tier × 項目表；T3 套餐裡「例外：skill 定義目錄底下的前端檔不觸發」整段（與 §UI / browser e2e 逐字重複）改一句「觸發與例外見 §UI / browser e2e」；**§UI / browser e2e 與 §漏網複查 的步驟不動**（下一支 PR 要改觸發條件）；§verify 失敗處置 的九項 bullet 選單不動；hand-off yaml 的 `design_rejudge` 結構改一行「結構同 execute-plan §hand-off state，`stage: verify-done`、`task_id: null`、`action` 無大改-user-gate」，其餘欄不砍。Red Flags 4→3：留「e2e 慢跳過」「環境問題不算 fail」「lint warning 算過」
- [ ] Step 4: ≤105；契約綠；`grep -c "§UI / browser e2e"` ≥2、`grep -c "§漏網複查"` ≥1
- [ ] Step 5: commit `refactor: verify-done 文本瘦身`

### Task 7: request-review 249 → ≤165

**parallel-group**: 4
**files**: modify `skills/request-review/SKILL.md`

- [ ] Step 1-2: ≤165，FAIL
- [ ] Step 3: 只把 §T1 self review 的回報範本併進 §結果整合；**T2 §spec coverage 自檢 表（欄名被 §結果整合 分級規則引用）與 T3 對齊 subagent prompt 一字不動**；§T2「medium 做什麼」實測段縮成兩句，**必留**「結果走 task-notification 的 `<result>`——等通知，不要用 `TaskOutput block=true` 輪詢」，數字砍、細節指 memory `reference_builtin_code_review_facts.md`；§副檔名分流 表、兩個 `Skill("code-review", args=…)`、§語言提示 表不動。Red Flags 7→4：留「純文件也跑 code-review」「`.mjs` 算純文件」「帶 --fix」「TaskOutput completed」
- [ ] Step 4: ≤165；P9a / P9c 綠
- [ ] Step 5: commit `refactor: request-review 文本瘦身`

### Task 8: receive-review 162 → ≤95

**parallel-group**: 4
**files**: modify `skills/receive-review/SKILL.md`

- [ ] Step 1-2: ≤95，FAIL
- [ ] Step 3: §不危險 vs 危險分類 三小節合成「項目 | 判定 | 條件」三欄表（灰色項條件寫第三欄）；§特殊狀況 三小節各一行；§危險處置 選單與「一顆 commit」句、body 格式不動。Red Flags 5→4：留「危險類自己 fix」「T3 偷偷 auto-fix」「每 finding 一顆 commit → squash 後 bisect 不到」（P9e 的 WHY 只在這列，必留）「reviewer fix 直接套」；「critical 太煩」併入第一列
- [ ] Step 4: ≤95；P9e 綠
- [ ] Step 5: commit `refactor: receive-review 文本瘦身`

### Task 9: security-audit 148 → ≤85

**parallel-group**: 5
**files**: modify `skills/security-audit/SKILL.md`

- [ ] Step 1-2: ≤85，FAIL
- [ ] Step 3: §Dispatch prompt 縮到只剩 Context 輸入 + 「依 agent §檢查焦點 做」+ 回報格式（agents/security-auditor.md 已含 STRIDE / OWASP / checklist / PII / File-type）；§Critical-finding 流程 選單不動；§Major / Minor 處置 縮。Red Flags 6→4：留「沒涉認證跳」「自己跑 STRIDE」「agent 自降級」「多 critical 一個 AskUserQuestion」
- [ ] Step 4: ≤85；契約綠
- [ ] Step 5: commit `refactor: security-audit 文本瘦身`

### Task 10: finish-branch 335 → ≤230（軟）

**parallel-group**: 5
**files**: modify `skills/finish-branch/SKILL.md`

- [ ] Step 1-2: ≤230，FAIL
- [ ] Step 3: `### Commit 範例` 4→1；`### Rebase vs Merge` 刪（一句留在 §Rebase main）；§Squash merge 的三個 `###`（WHO / WHEN、HOW）合成一段 ≤8 行，「Past 授權不延續」原句保留，內文引用「§Squash merge / WHO / WHEN」改「§Squash merge」；§特殊情境 三小節各一行（標題名留，data.js 引用）；§Branch 命名 與 §Commit 訊息規範 改 `見 rules.md §Branch 命名` / `§Commit 訊息` 只留一個範例；**§PR body 模板、§Conflict 流程 選單、§Clean check 清單、§Merge 後：docs 歸檔 步驟不動**。Red Flags 10→5：留「conflict 自己 resolve」「裸 force」「順手 gh pr merge（Past 授權不延續）」「skip hook」「merge 完 docs 留 work」
- [ ] Step 4: ≤230；P9d 綠（`T3 → 交棒 pr-explain`、`N/A（T2`）
- [ ] Step 5: commit `refactor: finish-branch 文本瘦身`

### Task 11: pr-explain 84 → ≤70（軟）

**parallel-group**: 5
**files**: modify `skills/pr-explain/SKILL.md`

- [ ] Step 1-2: ≤70，FAIL
- [ ] Step 3: **豁免守則 4 骨架與 Red Flags 下限**（本檔是 fork task prompt，本來就沒 § / hand-off / Red Flags，不補）；只砍 `## 注意` 與六步的說明句；六步 code block 指令不動；frontmatter 不動
- [ ] Step 4: ≤70；P9d 綠
- [ ] Step 5: commit `refactor: pr-explain 文本瘦身`

### Task 12: 守門比對 ＋ 重產 references-data.js ＋ 總量斷言 ＋ 施工紀錄

**parallel-group**: 6
**files**: regenerate `docs/js/references-data.js`；modify `docs/work/refactor/skill-text-slim/spec.md`（追加 §施工紀錄）

- [ ] Step 1-2: 三個紅燈分開看：(a) `node <scratch>/slim-guard.mjs check baseline.json` 四項（使用契約步驟、選單區塊、§ 白名單不消失且不新增 §、反引號片段不新增）全 PASS；(b) 11 檔 `wc -l` 合計 ≤1,520 且 `wc -c` 合計 ≤68,500；(c) `build-references.ps1 -Check` exit 0（重產前必 FAIL）
- [ ] Step 3: 跑 (a)，紅的檔照 §失敗處置；`pwsh -NoProfile -File scripts/build-references.ps1`；spec 追加 §施工紀錄（每檔前後行數 / bytes 表、砍了什麼、保留的 WHY 清單、契約與守門結果、到不了目標的檔與差距）
- [ ] Step 4: (a)(b)(c) 全綠 + `node scripts/plugin-contract.mjs`（含 `--selftest`）+ `node docs/tools/docs-site-contract.mjs` 全綠
- [ ] Step 5: commit `chore: 重產 references-data.js、補瘦身前後對照`

---

## Self-review（v2）

- spec coverage：−40% 行（Task 12b）、−30% bytes（新增，防灌水）、契約全綠（每 task Step 4 + Task 12）、不動清單（守則 1-6 + 守門快照）、兩個 nit（Task 1 / 4，含 §補施工清單入口 與 execute-plan 第 1 步）、Red Flags ≥3（各 task 指定列）、pr-explain 豁免
- 並行性：group 1 = {brainstorm, execute-plan+rules}（P9b 同時讀這兩檔；守則 5 只處理點名自己檔的 FAIL，主 agent 收完 group 再算數）；group 2 = {write-plan, review-plan}（P9h 同理）；group 3 = {tdd-cycle, verify-done}（無契約）；group 4 = {request-review, receive-review}（P9c / P9e 各讀一檔）；group 5 = {security-audit, finish-branch, pr-explain}（P9d 讀 finish-branch + pr-explain frontmatter，frontmatter 不動）
- 待辦不在本次：dev-workflow §Skill hand-off state 第 175 行的欄名 `review_summary` / `verify_result` 與實檔不一致（DX C1），記入 spec 待釐清
