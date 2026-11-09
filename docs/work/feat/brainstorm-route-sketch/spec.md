# brainstorm 加方案草圖、選項數字標來源、互動指令另開視窗
> Track: Dev | Tier: T2 | 建立: 2026-11-09

## 動機 / Why
2026-11-06 ~ 11-09 的 DB MCP 任務（PR #103）暴露三個流程問題：

1. **方向沒定就進重流程**：
   - 路線改了三次：內建 DBHub → 設定小工具 → 只改規則。
   - 被丟掉的有舊 branch 18 個 commit，以及一整輪 T3 的 spec、plan、三視角 review。
   - 三條路的維護成本差很多，但這件事要到 review 後才浮現。
2. **決策選項裡的數字沒驗證**：主 agent 把「首次安裝記憶體高峰 ~580 MB」寫成「下載 600 MB」放進選項，user 因此改了方向。實際硬碟只有 115 MB。
3. **交給 user 的互動指令卡住兩次**：`mysql -u root -p` 經 `!` 前綴執行，等密碼卡死；第二行還是 PowerShell 語法，走 Bash 一定失敗。

## 目標 / Success criteria
- **brainstorm 新增「§方案草圖」**：0b 之後、0b′ 之前。
  - 觸發條件：有 ≥2 條可行做法，且在「使用者要做的事 / 長期維護成本 / 對外介面」任一面差異明顯。
  - 產出：2–3 條路線的表格，欄位是「做法、使用者要做什麼、長期維護成本、主要風險、估計 Tier」，用 `AskUserQuestion` 選一條。
  - 選定路線與被放棄的路線寫進 spec「## 方案草圖」。
  - 只有一條明顯做法時跳過（bug fix、typo、照既有 pattern 加一項、user 已指定做法），state 記一句跳過理由。
  - 決定路線的關鍵事實不確定 → 先查一次再問，不把猜測放進選項。
  - headless：B 類 `brainstorm/route-sketch`，留言列路線表、等人選（code-review 後由 A 改 B）。
  - 路線表必含一條「最小做法」；user 已指定做法但有明顯更便宜的替代時，仍要列出來（審查後加）。
- **rules.md §白話優先 底線**：數字寫出量的是什麼指標加出處；§決策點選單 指回這條（審查後改：原「標來源」對不準事故）。
- **rules.md 新增「§交給 user 跑的指令」**：
  - 指令一律放 fenced code block 並標語言。
  - 需要輸入密碼、互動確認、長時間執行，或是 PowerShell 語法的指令，明寫「另開 PowerShell（或終端機）視窗執行」。
  - 不建議 `!` 前綴，並寫明原因。
- **契約 P21** 守住上面三處的關鍵字樣與 headless 分流列；`plugin-contract` ALL PASS、`build-references -Check` 綠。
- 版本升 1.15.0。

## 範圍 / Scope
**包含**：`skills/brainstorm/SKILL.md`、`skills/devwork/rules.md`、`skills/headless-mode/SKILL.md`、`skills/dev-workflow/SKILL.md`（Phase 0 流程圖加一格）、`scripts/plugin-contract.mjs`、`docs/js/references-data.js`（重產）、三處版本號。

**排除**：
- 量測規劃效果（第 6 項，user 2026-11-09 決定不做）。
- 契約共用解析函式（另開 PR 2）。
- docs 站 `flow.html` console 錯誤（另開 PR 3）。
- docs 站流程圖節點：本 PR 不加，PR 3 處理 flow.html 時一併評估。

## 影響檔案 / Codebase impact
| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `skills/brainstorm/SKILL.md` | edit | 草圖觸發條件太寬 → 每個任務都多問一次 |
| `skills/devwork/rules.md` | edit | 全 session 常駐；字數要省 |
| `skills/headless-mode/SKILL.md` | edit | 新 decision_id 要進分流表（P19 守） |
| `skills/dev-workflow/SKILL.md` | edit | 流程圖文字 |
| `scripts/plugin-contract.mjs` | edit | 新 P21 不能恆綠 |
| `docs/js/references-data.js`、三處版本號 | 重產 / edit | — |

## 設計方向
不碰前端檔（references-data.js 是產生器鏡像）。`design.involved=false`。

## 風險與 trade-off
- 草圖本身也是成本：觸發條件寫成「差異明顯才做」，並列出明確的跳過情境；只是照既有做法的小改不會被多問。
- rules.md 是常駐 context：兩條新規則各控制在 3 行內。

## 施工清單
| # | group | 檔（可多個） | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `scripts/plugin-contract.mjs` | 新增 P21：brainstorm 有 `## §方案草圖`、觸發與跳過條件、`brainstorm/route-sketch`、spec 模板有 `## 方案草圖`；headless 分流表該列類別為 `A`；rules.md §決策點選單 含「實測 / 文件 / 推估」；rules.md 有 `§交給 user 跑的指令` 且含「另開」與 `!` 前綴說明 | `node scripts/plugin-contract.mjs` → P21 FAIL（紅） |
| 2 | 2 | `skills/brainstorm/SKILL.md`、`skills/headless-mode/SKILL.md`、`skills/dev-workflow/SKILL.md` | 加 §方案草圖、spec 模板段、使用契約步驟、state 欄位 `route_sketch`；分流表一列；流程圖加一格 | P21 brainstorm / headless 項綠、P19 綠 |
| 3 | 3 | `skills/devwork/rules.md` | §決策點選單 數字標來源；新增 §交給 user 跑的指令 | P21 全綠、既有 rules.md 契約（P6 等）綠 |
| 4 | 4 | `docs/js/references-data.js`、三處版本號 | 重產 references、升 1.15.0 | `build-references -Check` 綠、契約 ALL PASS、`gen-codex-agents --check` 綠 |
| 5 | 5 | （實測） | `claude -p --plugin-dir .` 丟一個有兩條明顯路線的需求，看 brainstorm 是否產草圖；丟一個 typo 修正，看是否跳過 | 輸出摘要寫進施工紀錄 |

## 施工紀錄
### 2026-11-09
- 列 1–4：每列一個 commit；`plugin-contract` ALL PASS（含新 P21、既有 P19 分流表）、`build-references -Check` PASS、`gen-codex-agents --check` PASS。
- 列 5 實測（`claude -p --plugin-dir .`，只開 Skill / Read / Glob / Grep）：
  - **多路線需求**（「PR 開好後通知 Slack」）：brainstorm 產出三條路線表，欄位為使用者要做什麼 / 長期維護 / 主要風險 / 估計 Tier。推薦「Slack 官方 GitHub app、bstack 不改」，沒查證的訊息格式標「沒查證」，並在判 Track / Tier 之前停下等選。
  - **單一明顯做法**（README 補一個括號）：沒有產草圖，直接判 T0 處理。
    - 偏差：這次它在 devwork 層就判 T0、沒進 brainstorm，所以「跳過」是間接觀察到的。
    - 它在 `-p` 下改了 README.md（使用者層權限放行 Edit），屬測試產物，已 `git checkout` 還原。
  - 另一個假 typo（`teh` 不存在）：AI 查無此字後停下，未進 brainstorm，不列入判定。
- code-review medium 8 項全收（一顆 fix commit）。偏差：headless `brainstorm/route-sketch` 由 A 改 B，路線是高成本決定，無人時不自己選。user 2026-11-09 表示沒用過 headless-mode，是否整個移除另議（排 PR 4）。
- 外部審查（session-team worker，唯讀）結論「需修改後 merge」。三項修改全收：
  1. 數字規則改成「寫出量的是什麼指標 + 出處」，併進 §白話優先 底線；§決策點選單 改為指回該處。
  2. 路線表必含「最小做法」；user 指定做法但有明顯更便宜的替代時仍要列。
  3. spec 的 headless 改 B；`!` 規則補「需輸入密碼的指令一律另開視窗，本條優先」。
- #103 原始需求重跑（審查建議的驗證）。前兩次被汙染：
  - worktree 共用專案記憶；
  - `--plugin-dir` 指向主 repo，讀到 docs/archive；
  - 新版 plugin 的契約腳本與 db-access 本身就寫著定案。
- 第三次改用 #103 之前的 plugin（`git archive 668dae8`）只換上新版 brainstorm，加上獨立 clone 的專案目錄，沒有洩漏。結果：
  - 列出三條路線（內建 DBHub / 每種 DB 各一個 MCP / 最小做法：不內建、只擴充範本）。最小做法接近最後定案的方向。
  - 自己標出兩個未查證疑點：連線字串可能全機共用、Codex 不一定支援表單。兩點都是當初 review 才挖出的問題。
  - **推薦仍是內建 DBHub**，與當初相同：草圖讓最小做法在開工前被看見，但不會自動改變推薦。
