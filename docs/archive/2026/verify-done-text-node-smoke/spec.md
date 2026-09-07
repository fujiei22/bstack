# verify-done：T3 e2e 觸發加「文字節點豁免」，改主 agent smoke

> Track: Dev | Tier: T2 | 建立: 2026-09-04
> Branch 基底：`refactor/skill-text-slim`（PR #67，它剛瘦身 verify-done）；PR base 先指該 branch，#67 merge 後自動 retarget。

## 動機 / Why

現行 verify-done §UI / browser e2e：改動含 `.html / .css …` 且 T3 → 必派 `frontend-e2e-runner` 跑整套 Playwright。PR #64 只改了 `docs/index.html` 的文字節點與 `data-upto` 屬性值，派一個 e2e agent 重跑整套是純成本；當時是在主 context 用 Playwright 跑等價檢查代替——那是「憑感覺」的豁免，沒有規則。rules.md §設計語言對齊 已有「只改文字節點時不適用」的豁免（那條連 `data-*` 值都不放行，本豁免比它寬），本次讓 e2e 觸發條件有同樣的機械判定，不靠感覺。

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

### 施工清單對照

| # | 做了 | 怎麼驗的結果 |
|---|---|---|
| 1 契約 P10 | yes | `git stash` 其他檔後跑：P10 FAIL；pop 後 ALL PASS（紅→綠實跑） |
| 2 verify-done | yes | P10 綠；`grep -c smoke` = 6；§漏網複查 未動 |
| 3 dev-workflow / frontend-test | yes | 兩檔各一處「文字節點」；P9c 仍綠 |
| 4 data.js UIQ | yes | C8a 96 / 135 不變 |
| 5 references | yes | `-Check` exit 0；docs-site-contract ALL PASS |
| 6 四案實跑 | yes（第一版）→ 第二版改 9 fixture + 7 端到端 + 真實 repo | 見下 |

### 第一版判定（行級 node -e 一行）的四案實跑

從 SKILL.md fence 抽出原樣執行：PR #64 / #66 TEXT-ONLY、#62（CSS）/ #61（meta 標籤）NOT。**這版被 code-review 實測繞過，已作廢**（見下）。

### request-review：code-review medium 對 PR #68 的 8 筆 finding 與處置

target 用 PR 號（stacked base）；10 分 24 秒、fork 126k token、32 次工具呼叫。全部不危險類、一顆 commit。

| # | 一句話 | 處置 |
|---|---|---|
| 1 | pathspec 只有 html / css / scss，改 `.tsx` / `.js` 加一個文字節點照樣 TEXT-ONLY | 判定器改用 `git diff --name-only` 全清單，任何程式 / 樣式檔進 diff 直接 NOT |
| 2 | 行級 `sig()` 對沒有 `<>` 的行回空：inline `<script>` / `<style>` 內容、多行標籤的屬性行全被跳過 | 改**檔級**骨架比對：script / style 整段保留、整份 HTML 依序比 |
| 3 | 空 diff（壞 ref、未 commit、沒 HTML hunk）兩邊都空 → TEXT-ONLY | fail-closed：沒 HTML 改動、working tree 有未 commit 前端檔、壞 range、新增 / 刪除檔一律 NOT |
| 4 | `sort()` 讓標籤重排過關；整個 data-* 屬性剝掉讓「新增 data-* 屬性」過關（styles.css 有 44 個 `[data-…]` 選擇器） | 依序比對；data-* 只歸零**值**、屬性增刪判 NOT |
| 5 | 沒人讀 `verify_results.e2e`，finish-branch PR 模板固定印「全綠」，smoke-only 的 T3 PR 看起來像跑過整套 | finish-branch §PR body 模板 verify 那行加 `e2e: <pass | smoke | skipped>` |
| 6 | 「與 rules.md §設計語言對齊 同構」講成事實，實際比它寬（rules.md 任何屬性值改動都不算文字節點） | 改寫成「比 rules.md 寬：多放行 data-* 值，兩者各管各的」；spec 動機段同步 |
| 7 | 靜態伺服器 recipe 寫死 `docs` / 8765、無 Content-Type（`type="module"` 被 strict-MIME 擋）、無 error handler、不關 | 獨立成 `scripts/static-serve.mjs`（root / port 參數、MIME 表、EADDRINUSE 明報、路徑穿越擋）；smoke 加第 4 步關 server |
| 8 | 760 字元 `node -e` 塞在 markdown fence、自帶「別經吃反斜線的工具轉貼」警語；P10 只 grep 字樣守不住判定邏輯；verify-done bytes +51% | 判定器搬到 `scripts/text-only-diff.mjs`（同 `plugin-contract.mjs` 慣例），SKILL.md 只留一行呼叫；P10a 直接 import 判定器對 9 個 fixture 執行 |

**與 user 原始要求的差異（明列）**：user 要「verify-done 裡可貼上跑的 node -e 一行」。現在是「可貼上跑的一行 `node <plugin 根>/scripts/text-only-diff.mjs <range>`」——仍是一行、仍機械判，但邏輯在腳本檔而不是內嵌 fence。理由是 finding 1-4 證明行級一行寫不對，且內嵌 fence 有反斜線轉貼風險、契約也測不到它。

### 第二版判定（檔級腳本）的實測

契約 P10a（import 判定器、9 個 fixture 純函式）：文字節點改 ✓豁免、data-* 值改 ✓豁免、純文字行重排 ✓豁免、class 改 ✗、新增 data-* ✗、標籤對調 ✗、inline script 改 ✗、inline style 改 ✗、多行標籤屬性行改 ✗；空集合 / 新增檔 fail-closed。

臨時 git repo 端到端（scratchpad `tod-e2e`，7 案）：文字 + data 值改 → TEXT-ONLY；未 commit 的 HTML 改動 → NOT（先 commit 再判）；產出檔 `gen.js` 一起改 → NOT，加 `--ignore site/js/gen.js` → TEXT-ONLY；`app.js` 改 → NOT；新增 html → NOT；沒 html 改動 → NOT；inline script 改 → NOT。

真實 repo：PR #64 加 `--ignore docs/js/references-data.js` 仍 NOT——因為它其實還改了 `app.js` / `data.js`（**當年只 smoke index.html 是漏的**，這正是 finding 1 的情境）；PR #66 加 ignore 後仍 NOT（`data.js` label）；PR #62 / #61 NOT。本 repo 裡「純文字節點」的 PR 目前一個都沒有——豁免存在的意義是下一個。

`scripts/static-serve.mjs` 實測：index / js / css 各自正確 Content-Type、404、`../` 穿越回 404、port 被占明報 EADDRINUSE。

### 執行偏差

- request-review 的 code-review target 用 PR 號而不是預設的 `main...HEAD`（實跑證實有效：finder 只看到本 branch 的 diff）：本 branch 疊在 #67 上（#67 疊在 #66 上），`main...HEAD` 會把上游兩支的 diff 一起餵給 finder。request-review §副檔名分流 的「混合 diff 給 path target」段可以再加一句「stacked branch 給 PR 號」——留給下一次改 request-review 時順手做，本次不動它。
- rules.md 實測 grep `e2e / frontend-e2e-runner / frontend-test` 零命中，不動。
