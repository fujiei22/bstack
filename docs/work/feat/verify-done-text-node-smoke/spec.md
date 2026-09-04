# verify-done：T3 e2e 觸發加「文字節點豁免」，改主 agent smoke

> Track: Dev | Tier: T2 | 建立: 2026-09-04
> Branch 基底：`refactor/skill-text-slim`（PR #67，它剛瘦身 verify-done）；PR base 先指該 branch，#67 merge 後自動 retarget。

## 動機 / Why

現行 verify-done §UI / browser e2e：改動含 `.html / .css …` 且 T3 → 必派 `frontend-e2e-runner` 跑整套 Playwright。PR #64 只改了 `docs/index.html` 的文字節點與 `data-upto` 屬性值，派一個 e2e agent 重跑整套是純成本；當時是在主 context 用 Playwright 跑等價檢查代替——那是「憑感覺」的豁免，沒有規則。rules.md §設計語言對齊 已有同構的「只改文字節點時不適用」豁免，本次讓 e2e 觸發條件對齊它，並把判定寫成可貼上跑的 `node -e` 一行，不靠感覺。

## 目標 / Success criteria

- verify-done §UI / browser e2e 新增豁免：diff 的 HTML 行只動文字節點或 `data-*` 屬性值（`class / style / id / href` 等屬性集合與標籤結構不變、無 `.css / .scss` 進 diff）→ T3 也不派 frontend-e2e-runner，改主 agent 用 Playwright 做「頁面載入 + console 零錯誤 + 改動處存在」smoke，`verify_results.e2e=smoke`
- 判定方式是一行 `node -e`（對 diff 的 HTML 行做屬性骨架比對），對四個歷史 diff 實測：PR #64（文字 + data-upto）TEXT-ONLY、PR #66（一句文案）TEXT-ONLY、PR #62（動 CSS）NOT、PR #61（新增 meta 標籤）NOT
- dev-workflow §跨流程 skill 載入 的 frontend-test 列與 Phase 4 路徑、frontend-test 上游表、流程圖 UIQ 節點 label 同步；rules.md 沒提到 e2e 觸發（實測 grep 零命中），不動
- `node scripts/plugin-contract.mjs`、`node docs/tools/docs-site-contract.mjs` 全綠；`build-references.ps1` 重產後 `-Check` exit 0

## 範圍 / Scope

**包含**：`skills/verify-done/SKILL.md`（§UI / browser e2e、hand-off `e2e` 枚舉）、`skills/dev-workflow/SKILL.md`（Phase 4 一行、跨流程表一列）、`skills/frontend-test/SKILL.md`（觸發表一列）、`docs/js/data.js`（UIQ label）、`scripts/plugin-contract.mjs`（新增 P10 守新敘述）、`docs/js/references-data.js` 重產。

**排除**：frontend-e2e-runner agent 不動；design-language §豁免 文字不動（只引用）；不做「T2 可選」那條的改動；smoke 不寫成 agent，主 agent 三步手跑。

## 影響檔案 / Codebase impact

| 檔 | 改動 | 風險 |
|---|---|---|
| `skills/verify-done/SKILL.md` | §UI / browser e2e 加豁免段（判定一行 + smoke 三步 + 結果寫法）；yaml `e2e: pass \| fail \| skipped \| smoke` | 任務 2 剛瘦身此檔，加回的段要維持密度；§漏網複查 不動 |
| `skills/dev-workflow/SKILL.md` | Phase 4「T3 + UI 改動 = 載 frontend-test」加括號；跨流程表 frontend-test 列加豁免 | P9c 讀此檔但只看 Phase 5 |
| `skills/frontend-test/SKILL.md` | 觸發表 T3 列加「文字節點豁免見 verify-done」 | 無契約 |
| `docs/js/data.js` | UIQ label 加第二行 | C8a 節點 / 邊數不變 |
| `scripts/plugin-contract.mjs` | P10：verify-done 含「文字節點」「smoke」「node -e」、yaml 含 `smoke`、dev-workflow 表列含「文字節點」、data.js UIQ label 含 smoke | 先紅後綠 |

## 設計方向

`design.involved=false`：改動檔剔除 `skills/*/SKILL.md` 後只剩 `.js` / `.mjs`，無前端副檔名。

## 風險與 trade-off

- **判定是行級骨架比對，不是 DOM diff**：同一行內文字與標籤混排時，剝掉文字後比骨架；跨行的標籤搬動會被判 NOT（保守方向，寧可多跑 e2e）。純文字行（無 `<>`）不計，段落重排斷行不影響。
- **smoke 不等於 e2e**：只驗載入 / console / 改動處存在，不驗互動；豁免範圍限定在「沒有互動可驗」的改動（文字與 data-*）所以等價。若 data-* 驅動 JS 行為（如 `data-upto` 控制節點鏈），smoke 的「改動處存在」要看渲染結果而非原始碼——寫進步驟。
- **一行 `node -e` 含正則反斜線**：本 repo 的 Bash 工具會吃反斜線（memory），SKILL.md 內的那行要用 Edit / Write 寫入，實測時從檔案貼。

## 待釐清

- 無。

## 施工清單

| # | group | 檔（可多個） | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `scripts/plugin-contract.mjs` | 新增 P10（verify-done 三字串 + yaml smoke + dev-workflow 表列 + data.js UIQ label） | 改其他檔前跑一次 P10 紅 |
| 2 | 2 | `skills/verify-done/SKILL.md` | §UI / browser e2e 加「文字節點豁免」段：判定一行 `node -e`（含用法、四案實測結果一句）、smoke 三步（起靜態伺服器→navigate→console_messages 零 error→snapshot/find 確認改動文字或 data-* 驅動的渲染結果）、`verify_results.e2e=smoke` 寫法；hand-off yaml `e2e` 枚舉加 `smoke`；Red Flags 加一列「文字節點也派 runner」 | P10 綠；`grep -c smoke` ≥3；契約全綠 |
| 3 | 3 | `skills/dev-workflow/SKILL.md`、`skills/frontend-test/SKILL.md` | Phase 4 一行與跨流程表列加豁免；frontend-test 觸發表 T3 列加「文字節點 / data-* 豁免見 verify-done §UI / browser e2e」 | P10 綠；`grep -n 文字節點` 兩檔各 ≥1 |
| 4 | 4 | `docs/js/data.js` | UIQ label 改「T3 + UI 改動？\n只動文字節點 / data-* → 主 agent smoke，不派 runner」 | C8a 仍 96/135；P10 綠 |
| 5 | 5 | `docs/js/references-data.js` | 重產 | `-Check` exit 0；docs-site-contract 全綠 |
| 6 | 6 | （本 branch） | 用 SKILL.md 裡那行 `node -e` 對 PR #64 / #62 / #66 / #61 四個歷史 diff 實跑，輸出貼 §施工紀錄 | 四案結果與目標一致 |

## 施工紀錄

（execute-plan 追加）
