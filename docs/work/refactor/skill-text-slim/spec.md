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
