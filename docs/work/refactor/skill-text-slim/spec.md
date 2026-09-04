# skill 文本瘦身：九階段 SKILL.md 砍 40%、行為零改變

> Track: Dev | Tier: T3 | 建立: 2026-09-04
> Branch 基底：`refactor/review-builtin-code-review`（PR #66）——本 branch 會改 request-review，#66 剛重寫它，疊在上面才不衝突。PR base 先指 #66 的 branch，#66 merge 後 GitHub 自動改指 main。

## 動機 / Why

九階段（含 tdd-cycle / receive-review 共 11 個）SKILL.md 合計 2,533 行，每個 phase 載入都整份吃 context；Anthropic best practices 明講規則太長 Claude 會忽略一半。實測本 session：走完一個 T2 任務載了 brainstorm / dev-workflow / design-language / execute-plan 四份，光 skill 文本就超過 1,200 行。

主要冗餘（0b 量測）：
- §Red Flags 表：11 檔共 ~90 行，多數是同一件事換句話說；tdd-cycle 的 Red Flags + rationalization + 範例三段合計 100 行
- hand-off state yaml：每檔整份重貼（dev-workflow §Skill hand-off state 已有母版），10 檔各 15-30 行
- 「為什麼要這樣」長段：finish-branch（Rebase vs Merge / Squash WHO-WHEN-HOW / 特殊情境）、tdd-cycle（順序的價值 / 好測試的要素）、review-plan 視角 prompt 的第 2 / 4 段說明
- 範例 code block 多份同類（finish-branch commit 範例 4 個、tdd-cycle bug fix 範例整段）

## 目標 / Success criteria

- 11 檔合計行數 ≤ 1,520（2,533 × 0.6）且 bytes ≤ 68,500（97,861 × 0.7，證明不是刪空行灌水）；前後對照寫進 spec §施工紀錄
- **行為零改變**：`node scripts/plugin-contract.mjs` P9a-i 全綠（它斷言的正是行為敘述）、`--selftest` 綠；`node docs/tools/docs-site-contract.mjs` 全綠；`pwsh -File scripts/build-references.ps1` 重產後 `-Check` exit 0
- 不動：每檔「使用契約」的步驟數與順序、AskUserQuestion 選單文字（review-plan §User gate、receive-review §危險處置、execute-plan §前端檔處理六選項、verify-done §verify 失敗處置、security-audit §Critical-finding、finish-branch §Conflict）、rules.md、frontmatter `description`
- 兩個 reviewer nit：brainstorm §交棒 T1「自拆 1-3 task」改成不寫數字；「≤ 8 列」只留 rules.md §Tier 表一處，rules.md 說明句、brainstorm §施工清單規則、execute-plan 第 1 步改成引用「rules.md §Tier 表 的列數上限」
- write-skill 的硬要求不破：每檔 Red Flags 表 ≥ 3 列、結構仍是「使用契約 → §段 → §hand-off state → §結尾 Trace 標籤 → §Red Flags」

## 範圍 / Scope

**包含**：`skills/{brainstorm,write-plan,review-plan,execute-plan,tdd-cycle,verify-done,request-review,receive-review,security-audit,finish-branch,pr-explain}/SKILL.md`；`skills/devwork/rules.md` 只動「超過 8 列代表 Tier 判低了」那一句；`docs/js/references-data.js` 重產。

**排除**：其他 17 個 skill（dev-workflow / design-language / dispatch-parallel …）本次不動；契約腳本不動（若某條契約因純措辭改寫而紅，優先改回措辭，不改契約——契約紅就是行為敘述被改掉的訊號）；不新增 references/ 檔（砍掉的「為什麼」段落若真有價值已在 `docs/archive/2026/t2-lane-slim/pr-review.md` 留過，直接刪）。

## 影響檔案 / Codebase impact

| 檔 | 行數 | 目標 | 主要砍點 | 契約守著的字串 |
|---|---|---|---|---|
| brainstorm | 329 | ≤200 | spec 範本內註解、0c/0d 合併確認四段「為什麼」引言、交棒 yaml 只留新增欄、Red Flags 13→5 | P9b：`^## 施工清單$` `^## 施工紀錄$` `進 execute-plan`、不得有 `進 <write-plan\|debug-systematic>` |
| write-plan | 223 | ≤135 | Task 結構範例縮一個、並行性分析範例、No-placeholder 紀律、Red Flags | P9h：不得有 `Eng-only` |
| review-plan | 245 | ≤150 | 視角 prompt 模板第 2 / 4 段說明合併、三視角 prompt 共用骨架、結果整合範本、Red Flags | P9h：`依改動面向` 或 `命中幾個派幾個`、不得有 CEO / `T2 不能跳` / `T2 仍需` |
| execute-plan | 242 | ≤150 | §前端檔處理 的「為什麼」段、Parallel-group 範例、Commit 格式（指向 rules.md）、Blocker、Red Flags | P9b：`恰為** \`## 施工清單\``、`plan_path.*null`、`施工紀錄` |
| tdd-cycle | 341 | ≤200 | §順序的價值 / §好測試的要素 / §常見 rationalization / §Bug fix 範例 / §卡住怎麼辦 合併成一節、Red Flags 20→5 | 無契約；保 iron law 與五步 |
| verify-done | 175 | ≤110 | 三套餐合成一表、hand-off yaml 只留新增欄、Red Flags | 無契約；§UI / browser e2e 與 §漏網複查 步驟不動（任務 3 要改它） |
| request-review | 249 | ≤160 | §T1 / §T2 / §T3 的回報範本合一、§結果整合 範本、Red Flags 7→4 | P9a 全 repo 無「雙視角」；P9c：`§語言提示` `§副檔名分流` `Skill("code-review", args="medium")` / `"high"` `純文件`、不得有 `視角 B`、`args="…--fix` |
| receive-review | 162 | ≤100 | 分類三段合一表、特殊狀況、Red Flags | P9e：`處理 review finding` `一顆 commit`、不得有 `每 finding fix 一個 commit` |
| security-audit | 148 | ≤90 | Dispatch prompt 縮、hand-off yaml、Red Flags | 無契約 |
| finish-branch | 335 | ≤200 | Commit 範例 4→1、Rebase vs Merge、Squash WHO/WHEN/HOW 合一、特殊情境、Red Flags | P9d：`T3 → 交棒 pr-explain` `N/A（T2`；PR body 模板文字不動 |
| pr-explain | 84 | ≤60 | 已精簡，只砍 §注意 | P9d：frontmatter description 含 T3（不動） |
| rules.md | — | 1 句 | 「超過 8 列」→ 引用表 | P9a 那兩列不動 |

## 設計方向

`design.involved=false`：全部是 `skills/*/SKILL.md` 與 rules.md，design-language 第 1 步剔除後無前端副檔名。

## 風險與 trade-off

- **「行為零改變」只有契約守得到的部分是機械可驗**；契約沒守到的句子（例如 tdd-cycle 五步措辭）靠 review-plan Eng 視角逐檔對 diff。這是本次派 Eng 的理由。
- **砍「為什麼」會讓未來改 skill 的人不知道當初為何這樣寫**：接受，理由在 git history 與 archive 的 pr-review.md；DX 視角盯「砍完還讀得懂嗎」。
- **11 檔平行派 subagent 改**：各檔獨立、不互相引用行號，撞檔風險零；但每個 subagent 都要跑契約，主 agent 收回後再跑一次總驗。
- **疊在 #66 上**：#66 merge 前本 PR diff 會混進 #66 的改動；merge 後 GitHub 自動 retarget，必要時 `git rebase --onto main`。

## 待釐清

- 無（本次）。**留給下一支**：dev-workflow §Skill hand-off state 第 175 行寫 `review_summary` / `verify_result`，實檔欄名是 `review_summary_path` / `verify_results`（review-plan DX 視角 C1 發現）。

## 施工紀錄

### 前後對照（LF 同基準；基線 `b15efa9`）

| 檔 | 行 | 內容行（去空行 / `---`） | bytes | 砍了什麼 |
|---|---|---|---|---|
| brainstorm | 329 → 250 | 218 → 184 | 16,537 → 15,096（−9%） | 0c/0d 四段引言留兩行 WHY、前移的代價刪、0a 反 pattern、0b 合句、Red Flags 9→6；兩個 nit |
| write-plan | 223 → 130 | 148 → 109 | 7,593 → 6,034（−21%） | Task 結構五個 code block 縮一組、並行範例、No-placeholder 7→4 列、落檔 bash block |
| review-plan | 245 → 145 | 163 → 110 | 9,205 → 7,987（−13%） | 第 2 / 4 段實例敘述 → 兩行 WHY（2026-09-03）、三視角共用骨架、結果整合範本 |
| execute-plan | 242 → 149 | 164 → 110 | 10,995 → 10,047（−9%） | Commit 格式指向 rules.md、Parallel-group 敘述、Blocker、Red Flags 6→5；兩個 nit |
| tdd-cycle | 341 → 158 | 228 → 108 | 7,496 → 5,457（−27%） | 五段合一 Red Flags、Bug fix 範例刪、❌ 反例刪 |
| verify-done | 175 → 105 | 124 → 90 | 7,655 → 6,501（−15%） | 三套餐合一表、重複的 e2e 例外段指向 §UI / browser e2e、design_rejudge 指向 execute-plan |
| request-review | 249 → 164 | 168 → 144 | 11,761 → 10,861（−8%） | T1 範本併入結果整合、medium 實測數字 → memory、兩個 `### 呼叫` code block 內嵌 |
| receive-review | 162 → 99 | 115 → 74 | 5,363 → 4,933（−8%） | 三小節合一表、特殊狀況各一 bullet、T3 訊息範本刪 |
| security-audit | 148 → 92 | 102 → 80 | 5,030 → 4,293（−15%） | Dispatch prompt 五類檢查項刪（agent 已有）、Red Flags 6→4 |
| finish-branch | 335 → 211 | 223 → 150 | 11,095 → 9,032（−19%） | Commit 範例 4→1、Rebase vs Merge、Squash 三小節合一、命名 / commit 規範指向 rules.md、刪一條與 rules.md 矛盾的 hook 敘述 |
| pr-explain | 84 → 70 | 55 → 47 | 2,847 → 2,462（−14%） | 注意段（四條 agent 已有）、六步說明句 |
| **合計** | **2,533 → 1,573（−38%）** | **1,708 → 1,206（−29%）** | **95,577 → 82,703（−13%）** | 空行 + `---`：825 → 367 |

### 目標達成度（誠實版）

- **行數 −38%**，目標 −40%（≤1,520）差 53 行（3.5%）。四檔軟目標各在 ≤10% 接受帶內：brainstorm 250 / 240、security-audit 92 / 85、receive-review 99 / 95、finish-branch 211 / 230（達）。
- **bytes −13%**，目標 −30% **未達**。原因量得出來：改後 82,703 bytes 裡 **40%（33,469）是受保護內容**——frontmatter、code block（選單 / yaml / prompt / 範本）、表格——這些是「行為零改變」的字面本體，一個字都沒動；其中 request-review / receive-review / security-audit 三檔受保護占比 56-57%。剩下 49k 散文已經是「一句話留 WHY」的密度，再砍就是動選單 / 契約步驟 / 範本，等於改行為。
- **內容行 −29%** 是比行數更誠實的指標：行數的 −38% 裡有 458 行是空行與分隔線（Eng 視角預警的灌水風險），本紀錄把兩個數字都列出來讓 user 自己判。
- **byte 目標是 review 階段加的防灌水門檻，不是 user 的原始指標**；未達的處置是攤開數字、不放寬目標也不砍保護項（plan §失敗處置 第二次仍到不了 → 接受現況、PR body 明列）。

### 行為零改變的證據

- `node scripts/plugin-contract.mjs` ALL PASS（P9a-i）、`--selftest` PASS；`docs-site-contract` ALL PASS；`build-references.ps1 -Check` exit 0
- 守門快照（scratch `slim-guard.mjs`，對基線抽 frontmatter / 使用契約編號步驟 / § 白名單 / 選單區塊 / 反引號片段）：frontmatter 11/11 逐字同；使用契約步驟數 11/11 同；白名單 § 標題 0 消失、0 新增（receive-review 一個非白名單 § 加了括號註記）；反引號片段 0 新增。選單區塊有 6 檔報差異，逐一核對皆為抽取器錨點位移（例：execute-plan 六選項 diff 零差異、verify-done 九項 bullet diff 零差異、security-audit 兩條 bullet 為未動 context 行、brainstorm 為允許縮的 spec 範本、review-plan 為 prompt 四段清單非選單），選單文字本身無一改動。
- 保留的 WHY 引言 6 行（brainstorm 2、review-plan 2、execute-plan 1、receive-review Red Flags 原列 1），皆附實測日期。

### 執行偏差

- Bash heredoc 寫 plan v2 時整段指令解析失敗，改用 Write 工具；guard 腳本的選單抽取對「AskUserQuestion 之後跨空行的清單」要放寬到 15 行才抓得到 brainstorm 0c/0d 選項。
- 11 個 subagent 同時派（plan 分 5 group 是為了契約跨檔不誤紅；守則 5「只處理點名自己檔的 FAIL」實測有效，沒有一個 subagent 誤改別人的檔）。subagent 不 commit，主 agent 逐檔守門後 commit，共 11 顆。
- request-review 第一版 `wc -l` 178 是中途快照，最終 164。
