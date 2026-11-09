# 路線級問題退回重選、入口不自判 T0、非最小推薦附理由
> Track: Dev | Tier: T2 | 建立: 2026-11-09

## 動機 / Why
PR #105 的外部審查列了三個後續問題，user 決定直接修：
1. **T3 review 發現路線本身有問題時，流程會在原路線上修。** review-plan 的 user gate 推薦是「修 plan 後進 execute-plan」，即使 review 揭示的是「這條路本身不該走」。#103 第二次改向就是這樣：三視角 review 挖出密碼、Windows、專案綁定、升版問題，卻先被當成 plan 的修正項。
2. **devwork 入口可能自己判 T0、繞過 Phase 0。** PR #105 實測時，「README 補括號」在 devwork 層就被判 T0 直接改檔，沒進 brainstorm；這違反 dev-workflow「T0 由 0d 判」。
3. **方案草圖推薦非最小做法時沒交代理由。** #103 需求重跑時，AI 仍推薦內建 DBHub，但沒寫「為什麼值得背這份維護」，user 不容易看出代價。

## 方案草圖
略過：只有一條明顯做法（照既有模式補規則）。

## 目標 / Success criteria
- **devwork 第 2 步**：改動類**一律**載 dev-workflow 進 Phase 0，入口不判 Tier（含 T0）。T0 由 brainstorm 0d 判，判 T0 後仍走 0c/0d 合併確認。
- **review-plan**：
  - 新增「路線級 finding」判準：問題不在 plan 寫法，而在路線本身。例如維護負擔、使用者步驟、對外介面或安全模型，在這條路上無解或代價明顯高於草圖時的估計。
  - 有路線級 finding 時，user gate 推薦改為「退回 brainstorm §方案草圖 重選路線」，並在題目寫出是哪幾條 finding。
  - headless 時這種情況走 B 類。
- **receive-review**：遇到路線級 finding 時，不自動修、不列 TODO，改走 `AskUserQuestion`，推薦退回 §方案草圖。
- **brainstorm §方案草圖**：推薦的不是「最小做法」時，必須附一句「為什麼值得背這份維護」（具體指出最小做法缺什麼）。
- 契約補對應字樣與 headless 分流列；`plugin-contract` ALL PASS、`build-references -Check` 綠。
- 版本升 1.16.0。

## 範圍 / Scope
**包含**：`skills/devwork/SKILL.md`、`skills/review-plan/SKILL.md`、`skills/receive-review/SKILL.md`、`skills/brainstorm/SKILL.md`、`skills/headless-mode/SKILL.md`（分流列）、`scripts/plugin-contract.mjs`、`docs/js/references-data.js`（重產）、三處版本號。

**排除**：PR 2（契約共用解析函式）、PR 3（docs 站 console 錯誤）、headless-mode 去留。

## 影響檔案 / Codebase impact
| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `skills/devwork/SKILL.md` | edit | 入口文字；寫太硬可能讓純問答也進 Phase 0 |
| `skills/review-plan/SKILL.md`、`skills/receive-review/SKILL.md` | edit | 「路線級」判準太寬 → 每次 review 都想退回重選 |
| `skills/brainstorm/SKILL.md` | edit | 一句 |
| `skills/headless-mode/SKILL.md` | edit | 新 decision_id 進分流表（P19） |
| `scripts/plugin-contract.mjs` | edit | 新斷言不能恆綠 |

## 設計方向
不碰前端。`design.involved=false`。

## 風險與 trade-off
- 「路線級」是語意判斷：用具體判準加例子收斂，並要求在題目寫出是哪幾條 finding，讓 user 判斷是否真的到了路線級。

## 施工清單
| # | group | 檔（可多個） | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `scripts/plugin-contract.mjs` | 新增 P22：devwork 第 2 步含「一律」「入口不判 Tier」；review-plan 有「路線級 finding」判準與退回 §方案草圖的推薦；receive-review 有路線級處置；brainstorm §方案草圖 含「為什麼值得背這份維護」；headless 分流表有 `review-plan/route-level`（B） | `node scripts/plugin-contract.mjs` → P22 FAIL（紅） |
| 2 | 2 | `skills/devwork/SKILL.md`、`skills/brainstorm/SKILL.md` | 入口不判 T0；非最小推薦附理由 | P22 對應項綠 |
| 3 | 3 | `skills/review-plan/SKILL.md`、`skills/receive-review/SKILL.md`、`skills/headless-mode/SKILL.md` | 路線級 finding 判準、gate 推薦、headless 分流 | P22 全綠、P19 綠 |
| 4 | 4 | references 重產、三處版本號 | 升 1.16.0 | 契約 ALL PASS、`build-references -Check`、`gen-codex-agents --check` 綠 |
| 5 | 5 | （實測） | `claude -p --plugin-dir .`（唯讀工具、獨立 clone）丟「README 補括號」，確認有進 brainstorm 並經 0d 判 T0 | 輸出摘要寫進施工紀錄 |

## 施工紀錄
### 2026-11-09
- 列 1–4 各一個 commit；`plugin-contract` ALL PASS（含 P19、新 P22）、`build-references -Check` PASS、`gen-codex-agents --check` PASS。
- review-plan 的 hand-off `review_user_action` 加 `reject_to_route_sketch`（清單外的小補充，配合選項 5）。
- 列 5 實測：用本 branch 的 plugin 副本（`git archive HEAD`）加獨立 clone，執行 `claude -p` 並禁用寫檔與 shell。
  - 「README 補括號」這次依序載入 dev-workflow → brainstorm（→ db-access），在 0d 判 T0，並與 branch、內容問題一起停下等確認；沒改任何檔。
  - 對照 PR #105 實測時，同一需求是入口直接判 T0 並改檔。
  - 它另外發現括號少了 MariaDB，與 db-access 不一致，屬額外收穫，不在本 PR 範圍。
