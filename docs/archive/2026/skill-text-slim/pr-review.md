# PR #67: refactor: 九階段 skill 文本瘦身 38%，行為零改變

> URL: https://github.com/fujiei22/bstack/pull/67
> Branch: `refactor/skill-text-slim` → `refactor/review-builtin-code-review`（stacked on #66；#66 merge 後 GitHub 會自動把 base 改成 `main`）
> Track: Dev | Tier: T3
> 建立: 2026-09-04
> 對應 spec: `docs/work/refactor/skill-text-slim/spec.md`
> 對應 plan: `docs/work/refactor/skill-text-slim/plan.md`（v2，依 `review.md` 的 Eng + DX 兩視角改過一版）

## 整體脈絡

九階段 dev-workflow 的 11 個 SKILL.md（brainstorm ~ pr-explain，含 tdd-cycle / receive-review）合計 2,533 行，每次 phase 切換都整份載入吃掉 context——這是 Anthropic best practices 明講的「規則太長 Claude 會忽略一半」問題的具體實例。本 PR 對這 11 個檔逐一瘦身，外加 `rules.md` 一句改動（把「超過 8 列」的硬編數字收斂成指向 Tier 表），最終行數降到 1,575 行（−38%，僅差目標 −40% 約 3.5%），bytes 只降 13%（目標 −30%，未達）。**未達的原因量得出來、不是沒盡力**：瘦身後 40% 的 bytes 是「行為零改變」承諾下不能動的字面內容（frontmatter、AskUserQuestion 選單、hand-off yaml、prompt / 範本 code block、表格）。全部 16 個改動檔中，11 個 SKILL.md 是瘦身主體，`rules.md` 只動一行，3 個 `docs/work/refactor/skill-text-slim/*.md` 是這次施工自己的 spec / plan / review 流程文件（新增，非瘦身標的），`docs/js/references-data.js` 是純鏡像重產（12 處字串替換，逐字對應瘦身後的 11 個 SKILL.md 內容，不含額外邏輯）。

## 檔案改動清單

| 檔 | 類型 | 行 +/- | 改動性質 |
|---|---|---|---|
| `skills/brainstorm/SKILL.md` | edit | +24/-103 | 瘦身：329→250 行，Phase 0 系列小節合併、兩個 reviewer nit |
| `skills/execute-plan/SKILL.md` | edit | +21/-114 | 瘦身：242→149 行，Commit 格式改指向、兩個 reviewer nit |
| `skills/devwork/rules.md` | edit | +1/-1 | 「超過 8 列」→「超過表列上限」，收斂單一真相 |
| `skills/write-plan/SKILL.md` | edit | +21/-113 | 瘦身：223→130 行，範例 code block 縮量 |
| `skills/review-plan/SKILL.md` | edit | +15/-115 | 瘦身：245→145 行，三視角 prompt 共用骨架 |
| `skills/tdd-cycle/SKILL.md` | edit | +27/-210 | 瘦身：341→158 行，五段合併成單一 Red Flags 表 |
| `skills/verify-done/SKILL.md` | edit | +13/-83 | 瘦身：175→105 行，三套餐合成一張表 |
| `skills/request-review/SKILL.md` | edit | +17/-102 | 瘦身：249→164 行，T1 範本併入結果整合 |
| `skills/receive-review/SKILL.md` | edit | +14/-77 | 瘦身：162→99 行，分類三段合成一張表 |
| `skills/security-audit/SKILL.md` | edit | +12/-67 | 瘦身：148→92 行，Dispatch prompt 大幅縮 |
| `skills/finish-branch/SKILL.md` | edit | +19/-143 | 瘦身：335→211 行，**含唯一的行為修正**（見全域 patterns） |
| `skills/pr-explain/SKILL.md` | edit | +9/-23 | 瘦身：84→70 行，只砍 `## 注意` 與六步說明句 |
| `docs/js/references-data.js` | edit | +12/-12 | 純鏡像重產（`build-references.ps1`），12 檔字串同步替換 |
| `docs/work/refactor/skill-text-slim/spec.md` | new | +99/-0 | 本次施工的 spec（brainstorm 產出）|
| `docs/work/refactor/skill-text-slim/plan.md` | new | +177/-0 | 本次施工的 implementation plan（v2） |
| `docs/work/refactor/skill-text-slim/review.md` | new | +46/-0 | plan review 總結（Eng + DX 兩視角） |

`spec.md` / `plan.md` / `review.md` 是流程本身的產出物，不是「被瘦身的東西」，下面不逐檔展開改動詳解——它們的內容摘要已寫在本文件的「整體脈絡」與「全域 patterns」段。

---

## `skills/brainstorm/SKILL.md`

### 改動意圖

對應 plan Task 1（329 → ≤240 軟目標，實際 250）。這是流程入口，砍點集中在 Phase 0 系列小節重複的「動作：」開場白、被拆成多個 `---` 分隔小段的同質內容，以及 §Red Flags 表的近義列合併。

### 改動詳解

#### 區塊 1：Phase 0a/0b 動作清單去空話

```diff
-動作：
-
 1. **讀 memory**（必）：...
```

- 點 1：「動作：」是純格式詞、對執行沒有資訊量，`design-language`、`write-plan` 等檔也用同一種瘦身手法（拿掉純格式性前導詞）。
- 點 2：0a 的「反 pattern」小節（3 條列點：一次問太多題 / 跳過 paraphrase / 太早判 tier）整段刪除——這是「為什麼」類散文，plan 判定屬可刪範疇，理由已在 §Red Flags 表的對應列留存（例如「memory 太雜不用讀」列）。
- 點 3：0b 的 6 個編號動作縮成 3 句散文，第 6 點「T3 視角判定」保留但改指向 `rules.md` §Tier 機制，避免兩處各講一次同一套判準。

#### 區塊 2：0c/0d 合併確認 —— 兩段「為什麼」引言精簡但**必留機制**

```diff
-> **為什麼攤平而不是加第 4 題**：`AskUserQuestion` 的 `options` 是平行陣列、沒有巢狀，多題也同時呈現，做不到「選了選項 1 之後再追問」。攤平之後路徑選擇仍然**是一個可機械讀取的選項**，滿足 rules.md §決策點選單「**禁文字 token NLP**」；而且維持 §使用契約 第 2 步「合併成一個 `AskUserQuestion` 一次確認」的不變式。
+> 為什麼攤平而不是加第 4 題：`options` 是平行陣列、沒有巢狀，做不到「選了選項 1 之後再追問」。攤平後路徑仍是可機械讀取的選項（§決策點選單 禁文字 token NLP），不做會多一次呼叫、破壞「一次確認」不變式（2026-08-31 #42 設計時定）
```

- 點 1：這是 plan v2 的 DX Critical 共識產物——原版「為什麼」段沒有下限、砍完可能失去機制解釋；plan 規定固定格式 `> 為什麼<動作>：<機制一句>。不做會<後果一句>（實測 <日期>）`，這裡補了日期依據 `2026-08-31 #42`（design 系統的既有設計決策）。
- 點 2：「前移的代價」整段被刪——這段講的是「在 Phase 0 問設計路徑比在 design-direction 問資訊少」的 trade-off 說明，屬於 plan §共同施工守則 允許砍的「為什麼」類，機制本體（只前移「設計路徑」一項、四項對齊仍留在 design-direction）留在後面一句未刪。
- 點 3：spec 範本 code block 內大量空行 / 註解被壓縮（`## 施工清單`、`## 施工紀錄` 兩行裸標題保留字面——這是白名單保護項，execute-plan 精確比對這兩行）。

#### 區塊 3：兩個 reviewer nit（本 PR 明列的行為級改動，非純瘦身）

```diff
-**施工清單規則（T2）**：...；≤ 8 列，超過回 0d 升 T3
+**施工清單規則（T2）**：...；列數上限依 rules.md §Tier 表，超過回 0d 升 T3
```

- 點 1：「≤ 8 列」的硬編數字原本重複寫在 rules.md 說明句 + brainstorm 兩處（§施工清單規則、§補施工清單入口）+ execute-plan 第 1 步共 4 處；改成三處都指向 `rules.md §Tier 表`，只有 rules.md 本身的表格是唯一真相。這**不是瘦身**，是把「單一真相在哪」的規則落實——4 個獨立數字若未來要調（例如放寬到 10 列），舊寫法要改 4 個檔，新寫法只改 1 個。
- 點 2：§交棒「依 spec 自拆 1-3 個 task」→「依 spec success criteria 自拆 task」，去掉的「1-3」是 plan Task 1 指定的具體 nit，理由同上——具體數字對 T1 的彈性沒有幫助，success criteria 已經是判斷依據。

### 關聯檔案

- 被 `execute-plan` 第 1 步引用（讀 `spec_path` 的 `## 施工清單`）——標題行 `恰為` 比對邏輯未變，`plugin-contract.mjs` P9b 守著這條字串
- 被 `dispatch-parallel` 引用（同 group 觸發協作模式判定）——本次未動
- 契約 `node scripts/plugin-contract.mjs` P9b 斷言 `^## 施工清單$` `^## 施工紀錄$` `進 execute-plan`、以及「不得有 `進 <write-plan|debug-systematic>`」——PR body 稱 ALL PASS

---

## `skills/execute-plan/SKILL.md`（含 `skills/devwork/rules.md` 一句同批改動）

### 改動意圖

對應 plan Task 4（242 → ≤150，實際 149）。與 brainstorm 同批（parallel-group 1）——理由是兩檔都被 `plugin-contract.mjs` P9b 讀到，同組修改後才一次算契約，避免主 agent 收到「另一半還沒改完」的假紅燈。`rules.md` 的一句改動（「超過 8 列代表 Tier 判低了」→「超過表列上限代表 Tier 判低了」）是這個 task 唯一動到 `skills/brainstorm` 以外檔案的地方，把 rules.md 自己說明句裡殘留的具體數字也一併收斂。

### 改動詳解

#### 區塊 1：使用契約步驟 1、3 濃縮成散文，步驟數與順序不變

```diff
-**載入後立即動作**：
-
-1. **讀 task 來源**：...；T1 依 success criteria 自拆 1-3 個 task。...超過 8 列 → 交棒 brainstorm §補施工清單入口（超過 8 列要回 0d 升 T3）...
+1. **讀 task 來源**：...；T1 依 success criteria 自拆 task。...超過 rules.md §Tier 表 的列數上限 → 交棒 brainstorm §補施工清單入口...
```

- 點 1：「1-3 個 task」與「8 列」兩處硬編數字同步跟著 brainstorm 那邊的兩個 nit 修正，這是跨檔一致性——若只改 brainstorm 不改這裡，會出現「brainstorm 說列數上限看 rules.md，execute-plan 還在講 8」的自相矛盾。
- 點 2：「禁止」清單（跳 task / 跳 tdd-cycle / 多 task 累一個 commit）從三條 bullet 併成一句，內容一字不改。

#### 區塊 2：§前端檔處理 —— 常規段落大幅緊縮，但關鍵一句「為什麼」原句保留

```diff
-> 為什麼一定要回寫 `state.design`：不回寫的話 `verify-done` §漏網複查 會對同一批檔**再觸發一次**；大改情境甚至會把 user 五分鐘前答過的問題再問一次並升成 blocker。
+（同一句，未改字）
```

- 點 1：這段是 plan §共同施工守則 明列的「必留」引言（execute-plan 只有一段 WHY 引言，守則指定「Step 4：`grep -c '^> 為什麼'` ≥1」），因此逐字保留，只是前面判斷副檔名 / 排除規則的散文合併了。
- 點 2：五步例外動作（暫停 task / 補判 / user gate 六選項 / 回寫 state / 接回 tdd-cycle）保留五個步驟編號與內容，**AskUserQuestion 六選項是白名單保護項、一字未動**（守則 3）。
- 點 3：「禁止」三條併成一句散文，語意不變（發現前端檔只記心裡繼續寫 / 中途轉進當 Blocker / 拆到別 branch 偷做）。

#### 區塊 3：§Commit 格式 改成指向 rules.md，範例砍到 type 對照表

```diff
-依 rules.md「§Commit 訊息（繁中）」：
-
-```
-<type>: <subject 50 字內，繁中>
-...
-```
-
-**type 選擇**：
-- 新功能 task → `feat`
-...
-
-**範例**：
-```
-feat: 加入使用者 JWT 驗證 middleware
-...
-```
+見 rules.md §Commit 訊息。type 對照：
+
+| 新功能 | bug fix | 純重構 | 純測試 | 純文件 |
+|---|---|---|---|---|
+| `feat` | `fix` | `refactor` | `test` | `docs` |
```

- 點 1：commit 格式的完整範本、範例整段刪除，因為那已是 `rules.md` §Commit 訊息 的逐字複製——這是 plan 砍法第 5 條「別檔已有的表改一行指向」的典型案例，一行指向格式固定為 `見 <skill-name> §<段名>`。
- 點 2：type 對照表是新增的濃縮版（把「新功能 task → feat」這種 5 條 bullet 折成一張橫向表），語意等價，不是新內容。

#### 區塊 4：`rules.md:130` 一句字面改動

```diff
-- **本表是 lane 的唯一真相**；...；超過 8 列代表 Tier 判低了，回 0d 升 T3。
+- **本表是 lane 的唯一真相**；...；超過表列上限代表 Tier 判低了，回 0d 升 T3。
```

- 這是三個檔（rules.md 本身、brainstorm、execute-plan）中唯一「數字」被留下來的地方變成「概念」——`rules.md` §Tier 表本身的三個 Tier 列數上限（T1 未寫上限、T2 ≤8、T3 未寫上限）沒有被動，只是說明句不再重複那個數字。

### 關聯檔案

- 讀取 `brainstorm` 產出的 spec `## 施工清單`（T2）或 `write-plan` 產出的 `plan.md`（T3）——本次改動沒有動讀取邏輯，只動措辭
- 被 `dispatch-parallel`、`tdd-cycle` 呼叫（skill hand-off）——契約 P9a / P9b 對這兩處的「使用契約步驟數」快照比對顯示零差異（PR body 引用的守門結果）
- `rules.md` 這一句被 `brainstorm` §施工清單規則、§補施工清單入口 兩處與本檔第 1 步共同引用，是三處共用的唯一真相來源

---

## `skills/write-plan/SKILL.md`

### 改動意圖

對應 plan Task 2（223 → ≤130，實際 130，命中目標）。與 review-plan 同批（parallel-group 2）。砍點集中在 §Task 結構 的五個 code block 範例（濃縮成一組）、§並行性分析 的範例（六行縮三行）、§No-placeholder 紀律 表格列數精簡。

### 改動詳解

#### 區塊 1：§Task 結構 範例 —— 五個獨立 code block 濃縮成連續指令流

```diff
-- [ ] **Step 2: 跑測試確認失敗**
-
-```
-pytest tests/path/test_new.py::test_<name> -v
-# Expected: FAIL with "function not defined"
-```
+- [ ] **Step 2: 跑測試確認失敗**（Expected: FAIL）
+```
+pytest tests/path/test_new.py::test_<name> -v
+```
```

- 點 1：把「說明文字 + 獨立 code block」的重複格式（Step 2 / Step 4 兩處幾乎相同的 pytest 指令）合併，Expected 結果從獨立行搬進標題括號。Step 3（最小實作範例）與 Step 4 的獨立 code block 全部刪除、指向 Step 2 同一段指令。
- 點 2：這個範例本身是「教學範本」，5-step 紅綕循環的**步驟數與順序**（寫失敗測試 → 跑確認失敗 → 寫最小實作 → 跑確認通過 → commit）完全未變，只是排版更緊——這與 §No-placeholder 表新增的一條規則呼應：「步驟只講 what 沒 code block」被列為 plan failure，但範例本身刪 code block 是「同一資訊已在別處」，不是「缺失」。

#### 區塊 2：§並行性分析 —— 5 條規則併成 3 條，範例六個 task 縮成三個

```diff
-範例：
-
+```
 Task 1: 新建 User model            parallel-group: 1
 Task 2: 新建 Product model         parallel-group: 1
 Task 3: 新建 Order model（引用 User + Product）  parallel-group: 2
-Task 4: User CRUD endpoint         parallel-group: 3
-Task 5: Product CRUD endpoint      parallel-group: 3
-Task 6: Order CRUD endpoint        parallel-group: 4
```

- 點 1：範例只留前 3 個 task（展示「無依賴可同 group」與「依賴前兩者必須高一組」兩種情境），後 3 個 task 是同構重複（CRUD endpoint 版本的同一組規則），刪除不影響規則完整性。
- 點 2：規則說明句「Group 1 三 task（無依賴）可並行 → 主 agent spawn 2 subagent + 自己跑 1 個」整句刪除——這是「重述範例」的冗句，dispatch-parallel skill 本身有更完整的協作模式判定。

#### 區塊 3：§No-placeholder 紀律 —— 7 列表格併成 4 列，Self-review 5 點併成散文

```diff
-| `寫測試覆蓋上面` 但無測試 code | 直接寫 test code |
-| `同 Task N` 但不重複 code | 重貼 code（reader 可能跳讀）|
+| `寫測試覆蓋上面` 但無測試 code、步驟只講 what 沒 code block、`同 Task N` 但不重貼 code | 直接寫 test code / 補 code block / 重貼 code（reader 可能跳讀） |
```

- 點 1：這裡是 plan §Minor / Nit 採納的一條（「`同 Task N` 不重貼 code」是 DX 在 review 階段補回的規則，原稿瘦身時漏了、review fix commit `42d17f7` 補回），現在跟另外兩條合成一列，語意上是「新增」了一種 placeholder 情境（步驟只講 what 沒 code block），但 rules.md 表本身沒有新規則、是既有紀律的重新分組。
- 點 2：§Self-review 五步從編號清單改成散文，內容一字不改（spec coverage / placeholder 掃 / 型別一致 / 並行性檢查 / scope 檢查）。

### 關聯檔案

- 產出的 `plan.md` 被 `review-plan` 讀取做多視角 review、被 `execute-plan` 讀取逐 task 執行——本檔的 Task 結構格式（5 step、`parallel-group` 標記）是下游解析依據，本次未動格式本身
- 契約 P9h 斷言「不得有 `Eng-only`」——PR body 稱綠燈；這條字串本來就與本次瘦身內容無關（是防止有人把「Eng 是下限視角」誤寫成「只有 Eng」的舊回歸測試）

---

## `skills/review-plan/SKILL.md`

### 改動意圖

對應 plan Task 3（245 → ≤145，實際 145，命中目標）。這是本次瘦身裡「刪最多散文、但又要求兩行 WHY 引言必留」最緊繃的一檔——plan v2 明確指定第 2 段的產出器實例敘述可刪，第 4 段的「四個 reviewer 都只送 idle 訊號」故事必須留一行機制版。

### 改動詳解

#### 區塊 1：§視角 prompt 模板 第 2 段 —— 2026-09-03 實例敘述整段刪除，改寫規則保留

```diff
-**下面三個視角的提問是照「標的是 code」寫的。** 標的不是 code 時**必須逐條改寫**，
-照搬只會產生噪音——實測：對一份 markdown skill 跑原版模板，
-「API endpoint / response shape」「O(N²) 或全表掃」「dependency 版本鎖 / supply-chain」
-「stack trace ＋ context」「CLI / config 預設值」全部不適用，一條都用不上。
+下面三個視角的提問是照「標的是 code」寫的。**標的不是 code 時必須逐條改寫**（換問題、不是換詞），派工 prompt 明寫標的是什麼、哪些問題不要問：
```

- 點 1：「實測：對一份 markdown skill 跑原版模板，5 類問題全部不適用」這句是 2026-09-03 那次具體案例的敘述，被刪；規則本體（標的不是 code 時必須逐條改寫、換問題不換詞）保留在改寫後的句子裡。
- 點 2：後段窮舉標的類型的長段落（「窮舉標的類型永遠追不上新標的…那五組沒有寫在任何表上，也不該寫」）被壓成一行 `> 為什麼不窮舉標的類型：...（實測 2026-09-03）`——這是 plan v2 DX Critical 共識規定的固定格式（`> 為什麼<動作>：<機制>。不做會<後果>（實測 <日期>）`），此檔兩行必留 WHY 之一。

#### 區塊 2：§視角 prompt 模板 第 4 段 —— 「四個 reviewer 全部只送 idle 訊號」故事精簡為固定格式 WHY

```diff
-**這一句不寫，就會發生**：實測一輪四視角 review，**四個 reviewer 全部在分析完成後
-只送 idle 訊號**，主 session 逐一去要才拿到。它們沒做錯——「工作做完了」跟
-「結論送到了」在 subagent 眼裡是同一件事。
+> 為什麼要寫「用 SendMessage 送回」：實測四個 reviewer 全部只送 idle 訊號，主 session 逐一去要才拿到——「做完」跟「送到」在 subagent 眼裡是同一件事（實測 2026-09-03）
```

- 這是這份 PR 的 spec §施工紀錄 明列的「必留」引言之二（review-plan 檔的兩行 WHY 都標日期 2026-09-03）。改動前後機制解釋（做完≠送到）完全保留，只是敘事口吻（「這一句不寫，就會發生」）改成固定格式。

#### 區塊 3：三視角 prompt 從各自完整 code block 改成共用骨架 + 各自列問題

```diff
-### 視角 Design（介面 / 契約） — 跨模組契約 / 對外介面時
-
-```
-你是 Design / UX / API 介面視角的 reviewer。
-
-讀以下 spec 與 plan：
-...
-
-回答這些問題：
-
+**三視角 prompt 共用骨架**：開頭「讀以下 spec 與 plan：…」，結尾「回報格式：同 Eng 視角」；各視角只列問題。
+
+**視角 Design（介面 / 契約）— 跨模組契約 / 對外介面時**。你是 Design / UX / API 介面視角的 reviewer：
 1. user-facing 行為描述清楚嗎？...
```

- 點 1：這是 plan §風險與 trade-off 明寫的一條 trade-off——「review-plan 三視角 prompt 從 code block 改成散文骨架，執行時 Claude 要自己組回 prompt」，接受此代價（對齊 reviewer 的 Minor）。三個視角各自的 5 條問題**逐字未改**，只是外層 code block 格式改成一句骨架描述 + 散文小標。
- 点 2：這是 T3 review 唯一沒有機械契約守著的部分（`grep -c` 只驗字串存在，不驗排版），所以 plan 才把「Eng 視角逐檔對 diff」列為派 Eng 的理由——本 PR 的 review.md 確實有 Eng 視角覆盤過這個改動。

#### 區塊 4：§結果整合 範本、§User gate 選單

```diff
-選 1 → 主 agent 改 plan、commit、`AskUserQuestion` 再確認改完的版本 OK → 進 execute-plan
-選 2 → 直接進 execute-plan，state 記錄 user override
-選 3 → 退 write-plan、state 加 `review_findings`
-選 4 → 退 brainstorm、state reset 部份欄位
+選 1 → 主 agent 改 plan、commit、`AskUserQuestion` 再確認改完的版本 OK → 進 execute-plan；選 2 → 直接進 execute-plan，state 記錄 user override
+選 3 → 退 write-plan、state 加 `review_findings`；選 4 → 退 brainstorm、state reset 部份欄位
```

- 這段字面完全一樣，只是四行併成兩行——**選單本身的文字內容一字未改**（守則 3：AskUserQuestion 選單逐字保留），這裡是排版換行不是內容刪減，PR body 的守門快照對此有專門核對（「執行偏差」提到「跨空行的清單要放寬到 15 行才抓得到」，指的正是這類排版緊縮讓抽取器一度誤判）。

### 關聯檔案

- 讀取 `write-plan` 產出的 `plan.md`，spawn 的視角數量依 `state.review_perspectives`（brainstorm 0b 依改動面向判）——本次改動未動這個判斷邏輯，只動 prompt 措辭
- `§User gate` 選項 3 / 4 的措辭與 `execute-plan` §Task fail 處置、`verify-done` §verify 失敗處置 三處「刻意同一套」（PR body 引用）——本次三檔都各自瘦身但都沒有讓這套共同措辭失去一致，例如 execute-plan 那邊的引用句同步把「§Verify fail」改成了「§verify 失敗處置」（對齊 verify-done 那邊的實際標題，這是 plan review 的 Minor 採納項）
- 契約 P9h 斷言「依改動面向」或「命中幾個派幾個」、不得有 CEO / `T2 不能跳` / `T2 仍需`——PR body 稱綠燈

---

## `skills/tdd-cycle/SKILL.md`

### 改動意圖

對應 plan Task 5（341 → ≤220 軟目標，實際 158，遠低於軟目標——這是 11 檔裡砍幅最大的一檔，−54% 行、−27% bytes）。這是唯一「沒有任何契約守著」的檔（`grep -c "Iron Law"` 只是軟性檢查），所以砍法最激進：整個 §Bug fix 範例區塊、RED/GREEN 段的 ❌ 反例 code block 全部刪除。

### 改動詳解

#### 區塊 1：五個獨立小節合併成一張 §Red Flags 表

```diff
-## §好測試的要素
-| 維度 | 好 | 壞 |
-...
-## §順序的價值
-**「我先寫 code、之後補測試」** — 不行。
-- 補的測試立刻通過 — 證明不了什麼
-...
-## §常見 rationalization
-| 藉口 | 真相 |
-...
-## §Red Flags — 看到就停下、重來
-- code 在 test 之前
-...
+## §Red Flags — 看到就停下、重來
+- 先寫 code 再補測試（含「留 reference」「改寫既有 code」「已花 X 小時、刪掉浪費」）→ 補的測試立刻過、證明不了什麼；沉沒成本，留不能信的 code 才是技術債
+- 「太簡單不用測」...
+- 看到綠就不 refactor → ...
+- 沒跑紅也算紅（...）→ ...
+- 一次寫很多測試 → ...
+- mock 一切 → ...
```

- 點 1：這是 plan Task 5 明列的合併對象——「§順序的價值 / §好測試的要素 / §常見 rationalization / §Red Flags / §最終規則」五個小節，過去分散講的其實是同一件事（不能 test-after），合併成 6 條 Red Flags，每條把「藉口」與「真相機制」寫在同一行（例：「先寫 code 再補測試」的真相是「補的測試立刻過、證明不了什麼；沉沒成本，留不能信的 code 才是技術債」）。
- 點 2：原本 §常見 rationalization 表有 10 條藉口（太簡單不用測 / 我之後補測 / 我手動測過了 / 刪掉 X 小時白費 / 留 code 當 reference / 需要先 explore / 難測=設計爛 / TDD 拖慢 / 手動測快 / 既有 code 沒測），濃縮進 6 條 Red Flags 時做了語意去重（例如「刪掉 X 小時白費」「留 code 當 reference」两條合併成一條，因為兩者都是「捨不得砍已寫的 code」這同一個心理）。「需要先 explore」「既有 code 沒測」兩條藉口在新版沒有直接對應——這是可能的資訊流失點，但這兩條本身在原表裡也是相對次要的變體（探索完丟掉重來、既有 code 沒測就補測都不是常見誤用的核心）。

#### 區塊 2：§Bug fix 範例整段刪除

```diff
-## §Bug fix 範例
-
-**Bug**：空 email 被接受
-
-**RED**：
-```typescript
-test('拒絕空 email', async () => {...});
-```
-...
```

- 點 1：整個「空 email 被接受」的 RED→GREEN→REFACTOR 示範案例被刪，這是 plan §失敗處置 允許的砍點（tdd-cycle 明寫「❌ 反例可刪、✅ 留」），理由是 §RED / §GREEN 兩節本身已經各自有一個正例 code block（連續失敗 3 次重試成功 / retryOperation 實作），Bug fix 範例是第二套重複示範同一套流程，砍掉不影響「怎麼做」的可執行性，只影響「bug fix 專用範例」這個次要情境的具體感。
- 点 2：RED / GREEN 兩節裡的 ❌ 反例 code block（「retry works」模糊測試名、帶一堆 options 的過度設計實作）也被刪，只留 ✅ 正例 + 一句話點出反例錯在哪（「多塞 maxRetries / backoff / onRetry 這類還沒人要的 options = YAGNI 違反」）。

#### 區塊 3：§跟 debug 銜接 補一句「永不無測 fix bug」原句內縮

```diff
-bug 出現 → 寫重現它的失敗測試 → 跟 TDD 流程走 → 測證明 fix + 防回歸。
-
-**永不無測 fix bug**。
+bug 出現 → 寫重現它的失敗測試 → 跟 TDD 流程走 → 測證明 fix + 防回歸。**永不無測 fix bug**。
```

- 這是純排版合併（兩句併一句），字面未刪一字。

### 關聯檔案

- 被 `execute-plan` §Task 推進規則 第 3 步呼叫（「進 tdd-cycle：嚴格紅 → 跑紅 → 綠 → 跑綠 → commit」）——tdd-cycle 的五步骨架（The Iron Law → RED → Verify RED → GREEN → Verify GREEN → REFACTOR）標題原句全部保留（守則 4 白名單），只有標題底下的說明文字被壓縮
- 被 `debug-systematic` 引用（bug fix 必過 TDD 循環）——本次未動這條交叉引用
- 無契約腳本斷言；本次的品質把關落在 `review.md` 的 Eng 視角逐檔對 diff（PR body 說明這是派 Eng 視角的理由）

---

## `skills/verify-done/SKILL.md`

### 改動意圖

對應 plan Task 6（175 → ≤105，實際 105，命中目標）。與 tdd-cycle 同批（parallel-group 3，兩檔皆無契約字串重疊）。核心砍點是把 T1/T2/T3 三套驗證套餐從三個獨立小節合併成一張橫向表，並把 T3 套餐裡跟 §UI / browser e2e 逐字重複的「例外」段落改成一句指向。

### 改動詳解

#### 區塊 1：三套餐合併成 tier × 項目表

```diff
-### T1 套餐
-```
-1. 跑動到的測試檔
-...
-### T2 套餐
-- T1 全部
-- 跑**周邊回歸**：...
-### T3 套餐
-- T2 全部
-- 跑**整個 test suite**
-- 若改動含 UI ... → **載入 `frontend-test` skill** ...
-　**例外**：落在 skill 定義目錄底下的前端檔...e2e 無從跑起。判準與 `design-language` §使用契約 第 1 步一致。
-- 若改動含 DB → 跑 migration dry-run + schema diff 對齊
+| 項目 | T1 | T2 | T3 |
+|---|---|---|---|
+| 基本盤：動到的測試檔 + lint（T1 動到範圍、T2 起全 repo 改動範圍）+ type-check（如有） | ✓ | ✓ | ✓ |
+| 周邊回歸（動到的 module + 依賴它的 module 的測試）+ build | | ✓ | ✓ |
+| 整個 test suite；改動含 DB → migration dry-run + schema diff 對齊 | | | ✓ |
+| browser e2e：**載入 `frontend-test` skill** 跑 Playwright MCP e2e（必跑）；觸發與例外見 §UI / browser e2e | | | ✓ |
```

- 點 1：這是 plan §風險 提到的「T3 套餐重複的 e2e 例外段」——原本 T3 套餐裡完整重述了一次「落在 skill 定義目錄底下的前端檔不觸發」的例外規則，這條規則在下面 §UI / browser e2e 小節本來就有完整版本，這裡改成一句「觸發與例外見 §UI / browser e2e」，避免同一規則兩處各講一次、未來改一處漏改另一處。
- 点 2：**§UI / browser e2e 與 §漏網複查 兩節本身的步驟完全沒動**——plan Task 6 明寫「這兩節下一支 PR（任務 3：verify-done T3 e2e 觸發條件改文字節點豁免）要改觸發條件」，本次刻意不碰，避免跟下一支 PR 的改動範圍重疊打架。

#### 區塊 2：§verify 失敗處置 —— 特別 case 前移，AskUserQuestion 選單不動

```diff
-走 rules.md §Fail handling：
-1. 不靜默 retry
-2. 評起因（flaky / 環境 / 真 bug / verify command 寫錯）
-3. `AskUserQuestion` 提：
-   - retry ...
-4. 選後執行；`state.fail_history` append
-**特別 case**：
-- lint warning 但功能對 → 走 §Auto-fix 不危險類自動修
-- test flaky 反覆 3+ 次仍 flaky → 標 flaky...
-- type error 在改動範圍外 → 標 unrelated...
+特別 case 先分流：lint warning 但功能對 → 走 §Auto-fix 不危險類自動修；test flaky 反覆 3+ 次仍 flaky → 標 flaky、列入 `state.flaky_tests` 給 review 階段看、不阻塞；type error 在改動範圍外 → 標 unrelated、不阻塞但提示 user。其餘走 rules.md §Fail handling：
+1. 不靜默 retry；評起因（flaky / 環境 / 真 bug / verify command 寫錯）
+2. `AskUserQuestion` 提：
+   - retry ...
+3. 選後執行；`state.fail_history` append
```

- 點 1：內容順序調整（特別 case 移到前面當分流判斷），但三種特別 case 與 `AskUserQuestion` 九選項（retry / adjust+retry / rollback / 退回 execute-plan 補做 / 退回 brainstorm 重判 / 接受現況並記入技術債，此處省略部分列點）**逐字未改**——這是白名單保護的選單文字。

#### 區塊 3：§hand-off state 的 `design_rejudge` 結構改指向 execute-plan

```diff
-  design_rejudge:               # 與 execute-plan 共用；沒發生就是空 list
-    - stage: verify-done
-      task_id: null             # verify 階段沒有 task 歸屬
-      trigger_files: [...]
-      design_before: {...}
-      design: {...}
-      action: <小改對齊|blocker>
-      user_choice: <blocker 時 user 選的選項|null>
+  design_rejudge: [...]         # 結構同 execute-plan §hand-off state：stage: verify-done、task_id: null、action 無大改-user-gate；沒發生就是空 list
```

- 這是 plan v2 Critical 共識 1 的直接產物——原版守則寫「hand-off yaml 只留新增欄、其餘見母版」，但 review.md 指出這是空指令（`dev-workflow` 母版根本沒有這 22 個欄位，下游是照上游貼的 yaml 讀，不是照母版）。plan v2 改成「yaml 不砍，只有 verify-done 的 `design_rejudge` 完整結構改成指向 execute-plan 的同一份結構」——這是**唯一**被允許壓縮的 hand-off 欄位，其餘 10 檔的 hand-off yaml 逐欄保留。

### 關聯檔案

- 被 `execute-plan`（全 task 完）與 `tdd-cycle`（單 task 完）呼叫進入——本次改動未動觸發時機
- `design_rejudge` 欄位結構現在單一定義在 `execute-plan` §hand-off state，`verify-done` 引用同一份——這條交叉引用是本次唯一新增的「跨檔結構共用」關係，此前兩檔各自完整定義過一次
- 無契約腳本斷言；`§UI / browser e2e` `§漏網複查` 是白名單保護的 § 標題（守則 4），本次 `grep -c` 驗證兩者分別出現 ≥2 / ≥1 次（PR body 未單獨列出但屬 plan Task 6 Step 4 的驗收條件）

---

## `skills/request-review/SKILL.md`

### 改動意圖

對應 plan Task 7（249 → ≤165，實際 164）。與 receive-review 同批（parallel-group 4）。這是 #66（`refactor/review-builtin-code-review`，本 PR 的 base branch）剛重寫過的檔，因此瘦身範圍刻意收得比其他檔窄——plan 明寫「只把 §T1 self review 的回報範本併進 §結果整合；T2 §spec coverage 自檢 表與 T3 對齊 subagent prompt 一字不動」。

### 改動詳解

#### 區塊 1：§T1 self review 從獨立小節併入 §結果整合

```diff
-## §T1 self review
-主 agent 跑：
-- `git diff <base>...HEAD` 看完整 diff
-- 對 spec 看 coverage
-- 對 rules.md「§程式註解」看註解完整
-- 列「值得 user 注意」清單（簡短）
-- 不另開 subagent、不叫 code-review
-整合：
-```markdown
-## T1 Self review
-Spec coverage: <yes/no, 細節>
-...
+## §T1 self review
+主 agent 自己跑，不另開 subagent、不叫 code-review：看完整 `git diff <base>...HEAD`、對 spec 看 coverage、對 rules.md「§程式註解」看註解完整、列「值得 user 注意」清單。回報範本見 §結果整合 的 T1 段。
```

而回報範本本身搬到後面的 §結果整合 區塊底部，跟 T2/T3 的 Header 範本合併成同一份 markdown 範本的一部分：

```diff
 ## 主 agent 建議
 - 必處理: <Critical 列點>
 - 建議處理: <Major 中認同的>
 - 略過: <附理由；code-review 的 PLAUSIBLE 沒觸發情境的可列這裡>
+## T1 Self review
+Spec coverage: <yes/no, 細節>
+註解完整: <yes/no>
+Verify 全綠: <yes/no>
+值得 user 注意: <列點>
```

- 點 1：這是這份 PR「別檔已有的表改一行指向」砍法的變體——不是指向別檔，是指向同檔的另一段。理由是 T1 / T2 / T3 三種回報格式本質上是同一份「Review 整合結果」文件的不同填法，過去分成三處各自完整寫一次範本，合併後只有一份 markdown 骨架、T1 只填最後那四行。

#### 區塊 2：§T2 內建 code-review 呼叫段落 —— 「medium 做什麼」實測數字砍、指向 memory

```diff
-**medium 做什麼**（2026-09-04 實測）：8 個 finder subagent（3 個 correctness 角度 + reuse / simplification / efficiency / altitude / conventions(CLAUDE.md)），每個最多 6 個 candidate；去重後每個 candidate 派 1 個 verifier 判 CONFIRMED / PLAUSIBLE / REFUTED；輸出 **JSON 陣列 ≤8 筆** `{file, line, summary, failure_scenario}`，沒東西就 `[]`。它的 prompt 明寫不叫 ReportFindings。一次約 7 分鐘、fork 本身 10 萬 token 上下（finder / verifier 另計）。
+**medium 做什麼**：多個 finder 各找 candidate、去重後逐條 verifier 驗證，輸出 JSON 陣列 `{file, line, summary, failure_scenario}`，沒東西就 `[]`。一次約 7 分鐘、fork 十萬 token 級（2026-09-04 實測；finder / verifier 另計）——這是判「要不要跑 medium」的依據。
```

- 點 1：這是 plan v2 Major「四檔目標低於受保護內容下限…」以外的另一條——plan Task 7 明寫「§T2「medium 做什麼」實測段縮成兩句，**必留**『結果走 task-notification 的 `<result>`——等通知，不要用 `TaskOutput block=true` 輪詢』，數字砍、細節指 memory」。具體數字（8 個 finder、6 個 candidate、10 萬 token）被砍，但「等通知不要輪詢」這條動作性規則逐字保留在契約段落裡（見下方區塊 3 引用）。
- 点 2：review fix commit（`42d17f7`）事後把這段改成「不再指向作者私人 memory」——原稿一度寫成「細節指 memory `reference_builtin_code_review_facts.md`」，這是作者個人的 memory 檔路徑，reviewer 指出這對其他使用者無意義，改成不特別點名去哪找。

#### 區塊 3：§副檔名分流 表與 §語言提示 表 —— 一字不動；§結果整合 轉換表也不動

```diff
（無變化片段——這兩張表完全未出現在 diff 裡）
```

- 這兩張表是 plan Task 7 明寫的保護項（「T2 §spec coverage 自檢 表與 T3 對齊 subagent prompt 一字不動」），本節只是確認：`git diff` 對這部分確實零改動，佐證主 agent 有遵守 plan 的範圍限制。

### 關聯檔案

- 契約 P9a 斷言全 repo 無「雙視角」字樣、P9c 斷言 §語言提示 / §副檔名分流 / 兩個 `Skill("code-review", args=...)` 呼叫字串、不得有 `視角 B` / `args="…--fix`——PR body 稱綠燈；這些字串本次全數未觸碰
- 下游 `receive-review` 讀取 `review_summary_path` 與 `critical_count` / `major_count`——hand-off state 欄位本身未動
- `Skill("code-review", args="medium"/"high")` 呼叫語法未變，仍是 #66 重寫後的既有介面

---

## `skills/receive-review/SKILL.md`

### 改動意圖

對應 plan Task 8（162 → ≤95，實際 99；超出軟目標 4%，plan 允許 ≤10% 接受帶）。與 request-review 同批（parallel-group 4，二檔各自被 P9c / P9e 讀到、互不干擾）。核心砍點是把「不危險 / 危險 / 灰色」三個獨立小節合成一張三欄表。

### 改動詳解

#### 區塊 1：分類三小節合成單一表格

```diff
-### 不危險（AI 自動修）
-- typo / 註解錯字
-- import 排序 / 未用 import
-...
-### 危險（必問 user）
-- DB schema / migration
-...
-### 灰色（依 tier）
-- 邏輯重構（改 implementation 但 behavior 不變）
-  - T1/T2 → 不危險、自動修
-  - T3 → 仍給 user 看 diff
-...
+| 項目 | 判定 | 條件 |
+|---|---|---|
+| typo / 註解錯字、import 排序 / 未用 import、純 formatting / lint、加缺漏的 docstring / 註解 / type annotation、加新測試 | 不危險 | 全 tier 自動修 |
+| 變數命名、純 refactor | 不危險 | 不改 public API name、不改 behavior |
+| 邏輯重構（改 implementation 但 behavior 不變） | 依 tier | T1/T2 不危險、自動修；T3 仍給 user 看 diff |
+| 改既有測試 | 依內容 | 測試名 / 重整 → 不危險；改 assertion / 測試行為 → 危險 |
+| DB schema / migration、認證 / 授權邏輯、... | 危險 | 必問 user |
```

- 點 1：這是 plan §Minor / Nit 明列採納的一條（「receive-review 表用『項目 / 判定 / 條件』三欄」）。三個小節（不危險 7 項、危險 10 項、灰色 3 項）合成 5 列，內容項目數不變（逐項比對：不危險 7 項全部保留、危險 10 項全部保留、灰色 3 種情境全部保留），只是原本用巢狀 bullet 表達「依 tier / 依內容」的分支，改成「條件」欄裡寫清楚。

#### 區塊 2：§特殊狀況 三個獨立 `###` 小節各縮成一行 bullet，但補回一條被漏掉的觸發條件

```diff
-### Review 全綠 / 0 finding
-- `review_summary_path` 標 「無 finding，跳 receive-review、直接進下 phase」
-- 短路 — 不啟動 fix 循環
-### 1 reviewer 提、其他反對
-- 多 reviewer 衝突 → `AskUserQuestion` 把所有視角列給 user 決定
-### Reviewer 給的 fix 自己錯
-- 主 agent 不照搬；提出修正後的 fix、`AskUserQuestion` 給 user 看：
+- **Review 全綠 / 0 finding**：`review_summary_path` 標「無 finding，跳 receive-review、直接進下 phase」，短路、不啟動 fix 循環
+- 多 reviewer 衝突 → `AskUserQuestion` 把所有視角列給 user 決定
+- **Reviewer 給的 fix 自己錯** → 主 agent 不照搬；提出修正後的 fix、`AskUserQuestion` 給 user 看：
```

- 這是 review fix commit（`42d17f7`）補回的一項——PR body 提到「receive-review：特殊狀況第三條補回『Reviewer 給的 fix 自己錯』觸發條件」。第一版瘦身時這條的觸發語境（「Reviewer 給的 fix 自己錯」這個判斷點）一度被壓縮到不清楚，reviewer 對齊 finding 指出後補回明確的觸發描述。

#### 區塊 3：§Red Flags 表 —— 5 條併 4 條，P9e 守著的那句原句留

```diff
-| 「reviewer 說 critical 太煩跳過」 | critical 必處（修 / 列 known issue / 退 execute-plan 三選一）|
-| 「危險類我判斷一下自己 fix」 | 危險類必問；不准 auto-fix |
+| 「危險類我判斷一下自己 fix」「reviewer 說 critical 太煩跳過」 | 危險類必問、不准 auto-fix；critical 必處（修 / 列 known issue / 退 execute-plan 三選一）|
...
 | 「每 finding 一顆 commit 才好 bisect」 | squash merge 後只剩 PR title，bisect 不到；一顆 commit 的 body 列 finding 資訊等價 |
```

- 「每 finding 一顆 commit 才好 bisect」那一列**一字未動**——plan Task 8 明寫「P9e 的 WHY 只在這列，必留」，因為 `plugin-contract.mjs` P9e 斷言字串「一顆 commit」與不得有「每 finding fix 一個 commit」正是靠這句的文字存在。

### 關聯檔案

- 讀取 `request-review` 產出的 `review_summary_path`——本次改動未動這個介面
- 契約 P9e 斷言「處理 review finding」「一顆 commit」、不得有「每 finding fix 一個 commit」——PR body 稱綠燈
- 下游依 `triggered_rollback` 決定退 `execute-plan` 還是進 `security-audit` / `finish-branch`——hand-off state 欄位未動

---

## `skills/security-audit/SKILL.md`

### 改動意圖

對應 plan Task 9（148 → ≤85，實際 92；超出軟目標 8%，plan 允許帶內）。與 finish-branch、pr-explain 同批（parallel-group 5）。核心砍點是 §Dispatch 段落的 spawn prompt——原本把 `security-auditor` agent 定義裡已經有的「STRIDE 六類 × 每 surface / OWASP Top 10 / checklist 主題逐項對 / PII 違規檢查 / File-type 硬規則命中」五類檢查項目又在 skill 這邊完整複述一次。

### 改動詳解

#### 區塊 1：§Dispatch prompt 大幅縮，五類檢查項改指向 agent 定義

```diff
-## Context
-- Tier: <T2 or T3>
-- Track: <Bug or Dev>
-- 改動 commits: <commit list>
-- 改動檔: <file list>
-- codebase_impact 標記: <auth / data / api / payment / upload / pii ... 任一命中>
-
-## Diff
-<貼 git diff 或指引 agent 用 git diff origin/main..HEAD 自取>
-
-## Spec / Plan（可選）
-<若有 docs/work/<branch-name>/spec.md 或 plan.md 一併附上>
-
-## 你的任務
-依 agent SKILL.md「§檢查焦點」做：
-1. STRIDE 六類 × 每 surface
-2. OWASP Top 10 對應條目
-3. checklist 主題逐項對
-4. PII 違規檢查
-5. File-type 硬規則命中
-
-回結構化 finding（critical / major / minor / nit + PASS）。
-**不寫 fix code、不問 user**。
+- Tier: <T2 or T3>、Track: <Bug or Dev>
+- 改動 commits: <commit list>、改動檔: <file list>
+- codebase_impact 標記: <auth / data / api / payment / upload / pii ... 任一命中>
+- Diff: <貼 git diff 或指引 agent 用 git diff origin/main..HEAD 自取>
+- Spec / Plan（可選）: <docs/work/<branch-name>/spec.md 或 plan.md>
+依 agent「§檢查焦點」做，回結構化 finding（critical / major / minor / nit + PASS）。**不寫 fix code、不問 user**。
```

- 點 1：這是 plan Task 9 明寫的砍點——「Dispatch prompt 縮到只剩 Context 輸入 + 依 agent §檢查焦點 做 + 回報格式（agents/security-auditor.md 已含 STRIDE / OWASP / checklist / PII / File-type）」。5 條編號檢查項目被刪除，因為 `agents/security-auditor.md` 本身（獨立 agent 定義檔，本次未動）已經完整定義了這五類檢查——這是「跨檔重複」的瘦身，不是「刪規則」，實際檢查邏輯仍會在 agent 執行時跑到。
- 點 2：Context 段落 4 個標題級小節（`## Context` `## Diff` `## Spec / Plan` `## 你的任務`）合併成連續 bullet，內容項目數不變。

#### 區塊 2：§Critical-finding 流程 選單不動，只是段落標題精簡

```diff
-任一 Critical finding：
-`AskUserQuestion`：
+任一 Critical finding → `AskUserQuestion`（多個 Critical 一個一個跑，**不**批次成單一問題）：
```

- 「多個 Critical → 一個一個跑」這句原本在選單**後面**單獨一段，現在挪到選單**前面**當作括號附註——內容未變，只是段落順序調整讓讀者先看到「一個一個跑」這個限制再看選單本身。四個選項本身（修 / 描述再問 / 標記 known issue 暫不修 / 退 execute-plan 重做）逐字未動。

#### 區塊 3：§Red Flags 6→4，一條被刪、一條補依據

```diff
-| 「DB 改動讓 security-auditor 一起看」 | DB 派 db-reviewer；security-auditor 不重複 |
 | 「critical agent 自己降級成 major」 | ... |
-| 「PII 違規可以後修」 | PII 違規 = critical = 立即處 |
+| 「PII 違規可以後修」 | PII 違規 = critical = 立即處（rules.md §PII 安全底線） |
```

- 點 1：「DB 改動讓 security-auditor 一起看」整條被刪——這條規則本身（DB 由 db-reviewer 專責、security-auditor 不重複做）仍然成立，只是沒有寫進 Red Flags 表；`§Dispatch` 段落底下「涉 DB schema / migration 改動：另外派 db-reviewer」那句原句仍在，資訊沒有真的消失，只是換了位置陳述。
- 点 2：「PII 違規可以後修」這條是 review fix commit 補回的（PR body 提到「security-audit：Red Flags 補回『PII 違規可以後修』列」），並且加了 `（rules.md §PII 安全底線）` 依據——這是 reviewer 對齊 finding 要求「規則要附出處」的產物。

### 關聯檔案

- spawn 的 `security-auditor` agent 定義檔（`agents/security-auditor.md`）本身**不在本次改動範圍內**——這是本檔瘦身能大幅刪除 Dispatch prompt 的前提：agent 定義本身承載了完整的檢查邏輯，skill 只是協調殼
- T3 涉 DB schema 時另外 spawn 的 `db-reviewer` agent 亦不在本次改動範圍
- 無契約腳本斷言此檔；PR body 稱「security-auditor 無 Critical / Major、1 Minor 已補回」（即上述 §Red Flags 的 PII 依據補回項）

---

## `skills/finish-branch/SKILL.md`

### 改動意圖

對應 plan Task 10（335 → ≤230 軟目標，實際 211，優於軟目標）。與 security-audit、pr-explain 同批（parallel-group 5）。**這是本 PR 唯一含刻意行為修正的檔**——刪除了一句與 `rules.md` §Branch safety 矛盾的錯誤敘述，其餘全是純瘦身（Commit 範例 4→1、Rebase vs Merge 併一句、Squash merge 三小節合一）。

### 改動詳解

#### 區塊 1：**刻意的行為修正** —— 刪除與 rules.md 矛盾的 hook 敘述

```diff
 ## §Branch safety 雙保險
 
-- **Hook**：plugin 的 `hooks/branch-safety.ps1`（PreToolUse 擋 Write / Edit / NotebookEdit）
-- **rules.md**：強制守則明列規則
-- 任何 `git checkout` / `git push` 也過同 hook
-- 命中主分支（`main / master / production / prod / release`）→ exit 2 阻擋
+- **Hook**：plugin 的 `hooks/branch-safety.ps1`（PreToolUse 擋 Write / Edit / NotebookEdit）；命中主分支（`main / master / production / prod / release`）→ exit 2 阻擋
+- **rules.md**：見 rules.md §Branch safety
 - 處置：依 rules.md「§決策點選單」走 AskUserQuestion 取 feature branch 名 → `git checkout -b <name>` → retry
```

- 點 1：**這是本 PR 唯一被明確標記的行為級改動，不是文本瘦身**。原句「任何 `git checkout` / `git push` 也過同 hook」宣稱 `git checkout` / `git push` 這類 git 指令也會被 `branch-safety.ps1` 攔截，但 `rules.md` §Branch safety 的實測敘述明確寫著：「hook 只攔 Write / Edit / NotebookEdit（見 hooks/hooks.json 的 matcher）；`git checkout / merge / push` 不經 hook，靠 finish-branch 的流程守則」。兩份文件字面互相矛盾，本次刪掉 finish-branch 這句錯的、保留 rules.md 那句對的（並由本檔用「見 rules.md §Branch safety」指向它）。
- 点 2：這件事之所以重要，是因為它**改變了讀者對系統行為的認知**（若照舊版理解，會誤以為對 main branch 跑 `git push` 這種指令會被自動擋下，但實測不會——PreToolUse hook 只掛在 Write / Edit / NotebookEdit 三種工具，git 指令走 Bash 工具，不在 hook 的 matcher 範圍內）。PR body 與 spec §施工紀錄 都把這條單獨列出，跟其他純瘦身改動區分開來。

#### 區塊 2：§Branch 命名 / §Commit 訊息規範 —— 完整規範表改指向 rules.md，只留一個範例

```diff
-格式：`<type>/<short-desc>`
-```
-feat/<short-desc>
-fix/<short-desc>
-...
-- **type**：`feat / fix / refactor / docs / chore / test / hotfix`
-- **`<short-desc>`**：英文 kebab-case、3-5 字限
-範例：`feat/user-auth-jwt`、`fix/login-redirect-loop`、`refactor/extract-payment-service`
+見 rules.md §Branch 命名。範例：`feat/user-auth-jwt`
```

- 點 1：`rules.md` §Branch 命名 本來就有完整的格式定義（本次未改動），finish-branch 原本整段複製一次，現在改成一行指向 + 保留一個範例（原本三個範例砍到一個，因為指向後 rules.md 那邊看得到完整清單，這裡只需要「長什麼樣」的直覺）。
- 点 2：§Commit 訊息規範 同理，完整格式定義（`<type>: <subject>`、body 規則、footer）整段刪除改指向，範例保留一個（`feat: 加入 JWT 驗證 middleware`），另外兩個範例（`fix:` redirect loop、`refactor:` payment service）被刪除。

#### 區塊 3：§Squash merge 三個 `###` 小節合成一段

```diff
-### WHO / WHEN — 預設 user 觸發
-- **AI 預設不自動 `gh pr merge`**。`gh pr create` 開好 PR、印 URL、停。
-- Merge 由 **user 觸發**...
-...
-理由：merge 進 main **不可逆**...
-### HOW — GitHub Flow（單線）
-```
-main ← (PR + squash merge) ← feat/xxx
-...
-```
-- GitHub repo Settings → Pull Requests → 預設 squash merge
-...
+- **AI 預設不自動 `gh pr merge`**：`gh pr create` 開好 PR、印 URL、停。Merge 由 **user 觸發**...
+- Past 授權**不延續**...
+- 唯一例外：...
+- 理由：merge 進 main **不可逆**...
+- GitHub Flow 單線：所有 feature 從 main 切出、無 develop / release branch；repo 預設 squash merge，squash 後 commit message 以 PR title 為準。
+- merge 後立即刪 remote feature branch...
+- **禁** force push 到 `main / master`。
```

- 「Past 授權不延續」這句規則性質內容**逐字保留**（守則 2/3 保護範圍外但屬「行為敘述」，plan 明寫「Past 授權不延續」原句保留）；被刪的是 ASCII 圖示（`main ← (PR + squash merge) ← feat/xxx`）——這張圖只是文字重述「squash merge 進 main」這個已經用散文講過的事，屬冗餘視覺化。
- 兩處內文引用（execute-plan 第 6 步、rules.md 說明句）原本寫「見 §Squash merge / WHO / WHEN」，因為 `###` 小節被合併，這些引用同步改成「見 §Squash merge」（整個小節合一，不再有 WHO/WHEN 子錨點）。

#### 區塊 4：§Red Flags 10→5，砍掉的 5 條是「已被其他強制規則涵蓋」的重複警示

```diff
-| 「working tree 髒就強塞 PR」 | clean check 必過 |
 | 「rebase conflict 我先試 resolve」 | ... |
-| 「main 推一下沒事」 | Branch safety hook 會擋；別找麻煩 |
-| 「PR body 簡短」 | T1+ 用模板填全；T0 才可簡 |
-| 「skip pre-commit hook」 | 禁；hook 失敗 = 真問題、修了再 commit |
 | 「PR 開好順手 `gh pr merge`」 | ... |
-| 「Branch 名隨意」 | 必照 `<type>/<short-desc>` 格式；kebab-case、3-5 字 |
-| 「commit subject 寫長一點清楚」 | 50 字內、超過進 body |
+| 「skip pre-commit hook」 | 禁；hook 失敗 = 真問題、修了再 commit |
```

- 保留 5 條（rebase conflict 自作主張 / force push 誤用 / 順手 gh pr merge / skip pre-commit hook / merge 完 docs 留 work），砍掉的 5 條分別是：working tree 髒（§Clean check 本身就是硬規則）、main 推一下沒事（§Branch safety 雙保險本身講得夠清楚）、PR body 簡短（§PR body 模板 本身就是規範）、Branch 名隨意（改指向 rules.md 後那邊有完整格式）、commit subject 長度（同上）。这些都是「規則本體已經講過，Red Flags 只是換句話重講一次」的情況。

### 關聯檔案

- 被 dev-workflow Phase 7 呼叫（receive-review 或 security-audit 之後）——本次未動觸發時機
- T3 完成後交棒 `pr-explain`（本 PR 之後你現在讀的這份 pr-review.md 正是這條交棒的產物）
- 契約 P9d 斷言「T3 → 交棒 pr-explain」「N/A（T2」；PR body 稱綠燈；PR body 模板 / §Conflict 流程 選單 / §Clean check 清單 / §Merge 後：docs 歸檔 步驟全部落在守則保護範圍內，`git diff` 顯示這些段落確實未被觸碰

---

## `skills/pr-explain/SKILL.md`

### 改動意圖

對應 plan Task 11（84 → ≤70 軟目標，實際 70，命中目標）。與 security-audit、finish-branch 同批（parallel-group 5）。這是 11 檔裡砍幅最小的一檔——plan 明寫「已精簡，只砍 §注意」，並且**豁免**「使用契約 → § 段 → §hand-off state → §結尾 Trace 標籤 → §Red Flags」骨架要求（本檔 `context: fork`，是 fork task prompt，本來就沒有這些結構）。

### 改動詳解

#### 區塊 1：`## 注意` 整節刪除，內容併入開頭一句

```diff
-對指定 PR 寫詳盡 diff 解釋、落檔到 `docs/work/<branch-name>/pr-review.md`、commit、貼到 PR comment。
+對指定 PR 寫詳盡 diff 解釋、落檔到 `docs/work/<branch-name>/pr-review.md`、commit、貼到 PR comment。全程套用 rules.md 強制守則（§PII / §Branch safety / §File-type 等）；輸出語言、不修 code、不問 user、PII 違規標 critical、不主動修，其餘處置依 agent 定義。
```

```diff
-## 注意
-
-- 全程**繁中**台灣用語、英文專有名詞保留
-- **不**修 source code（只寫解釋）
-- **不**問 user（subagent 內無 AskUserQuestion）
-- PII 違規 → 在「安全 / PII 檢查」section 標 critical、但**不**主動修
-- 套用 rules.md 強制守則（§PII / §Branch safety / §File-type 等）
```

- 這正是我（`pr-explainer` agent）此刻在寫這份文件時遵守的規則來源——原本獨立一節的五條「注意」被搬到開頭一句話（繁中輸出、不修 code、不問 user、PII 標 critical 不修、套用 rules.md 守則），內容一字不少，只是不再獨立成節。plan 特別註明這是因為「四條 agent 定義已有、一條併入開頭」——`agents/pr-explainer.md`（本檔對應的 agent 定義）本身已經完整寫了這些禁止項（§風格「不寫 fix 建議」「不問 user」等），SKILL.md 這邊維持一句提醒即可，不必重複整節。

#### 區塊 2：六步骨架（取 PR number → 取 metadata+diff → 寫詳解檔 → commit+push → 貼 comment → 回報）步驟數與順序未變

```diff
-- 若上面非空 → 用該值
-- 若上面為空 → 跑 `gh pr view --json number --jq '.number'` 取當前 branch 的 PR
-- 兩者皆失敗 → 停下、回報「找不到 PR、無法解釋」
+- 非空 → 用該值
+- 空 → 跑 `gh pr view --json number --jq '.number'` 取當前 branch 的 PR
+- 皆失敗 → 停下、回報「找不到 PR、無法解釋」
```

- 六個步驟標題與內容完全未變（守則 2 保護的「使用契約步驟數與順序」，本檔雖豁免了骨架要求，但步驟本身仍是行為描述、不能改），只是「若上面非空」這種口語贅字被砍成「非空」。第 5 步「這步驟**預設執行**（不問 user）。reviewer 滑 PR 頁面就看到詳解、不用切 repo 翻檔」後半句說明被刪，只留「預設執行（不問 user）」這個動作本體。

### 關聯檔案

- 本檔對應的 fork agent 是 `agents/pr-explainer.md`（本次未改動）——本檔六步驟第 3 步「依 system prompt §文件結構標準 寫到 pr-review.md」，這正是我（本次執行 pr-explain 的 agent）此刻遵循的格式來源
- 契約 P9d 斷言 frontmatter `description` 含 T3 字樣（本次未動 frontmatter）——PR body 稱綠燈
- 下游 `retro` skill 不綁定接在 pr-explain 後面（dev-workflow 明訂），本檔完成後回報主對話即結束交棒

---

## 全域 patterns / cross-cutting

### (a) 行數 −38% 但 bytes 只 −13% 的結構原因

11 檔基線合計 2,533 行 / 97,861 bytes，瘦身後 1,575 行 / 82,703 bytes。行數達成率（−38%／目標 −40%）遠高於 bytes 達成率（−13%／目標 −30%），差距不是執行不力，是可量測的結構限制：

- 瘦身後的 82,703 bytes 裡，**40%（33,469 bytes）是「行為零改變」承諾下不可更動的字面內容**——frontmatter、AskUserQuestion 選單全文、hand-off state 的 yaml 區塊、prompt / 範本 code block、表格本體。這些內容多半是密集的結構化文字（yaml 縮排、表格分隔符 `|`、code block 圍欄），字元密度天生比散文高，卻不能被「合併成一句」這種瘦身手法觸碰。
- 三個檔（`request-review` / `receive-review` / `security-audit`）的受保護內容占比達 56-57%——這三檔恰好是「呼叫 code-review 的分流邏輯 + 危險分類表 + agent dispatch prompt」為主體的檔，散文說明本來就少。
- 反過來看，行數的 −38% 裡有 458 行純粹是空行與 `---` 分隔線（825 → 367，減少 458 行）——這部分「刪空行」對 bytes 貢獻很小（一個空行只有 1-2 bytes），卻能大幅拉低行數。這解釋了兩個百分比為何不同步：**行數瘦身有一部分來自排版壓縮（不算內容減少），bytes 瘦身才是內容減少的忠實指標**。這也是 plan v2 從 Eng 視角的 Critical 意見（「`wc -l` 可被空行與 `---` 灌水」）新增 byte 斷言的原因——若只看行數，這次瘦身的「真實」砍幅會被高估。
- **「內容行」（去空行 / `---`）這個第三指標最誠實**：1,708 → 1,206 行（−29%），介於行數瘦身（−38%）與 bytes 瘦身（−13%）之間，spec §施工紀錄 明白寫「本紀錄把兩個數字都列出來讓 user 自己判」。

### (b) 唯一刻意的行為修正

見上方 `skills/finish-branch/SKILL.md` 區塊 1——刪除「任何 `git checkout` / `git push` 也過同 hook」這句與 `rules.md` §Branch safety 矛盾的錯誤敘述。全 PR 11 個 SKILL.md + rules.md 一句的改動裡，**只有這一處是「改正錯誤」而非「精簡措辭」**，其餘所有改動都通過了守門快照（frontmatter 11/11 同、使用契約步驟數 11/11 同、§ 白名單 0 增 0 減、AskUserQuestion 選單逐字比對零差異、反引號片段 0 新增）與四支自動化契約（`plugin-contract.mjs` 含 `--selftest`、`docs-site-contract.mjs`、`build-references.ps1 -Check`）驗證。

### (c) plan review 階段抓到並修掉的東西

`review.md`（Eng + DX 兩視角）對 plan v1 提出 3 條 Critical 共識，全部進了 plan v2、也就是本次實際執行依據的版本：

1. **hand-off yaml「只留新增欄、見母版」是空指令**——`dev-workflow` 母版沒有下游 22 個實際欄位，下游 skill 是照上游貼的 yaml 讀，不是照母版讀。修正：yaml 逐欄保留，只有 `verify-done` 的 `design_rejudge` 結構改指向 `execute-plan`（見上方區塊）。
2. **守則「§ 標題名不改」與 Task 5（tdd-cycle 要合併四個 §）、Task 10（finish-branch 的 §Rebase vs Merge 其實是 `###`）直接矛盾**——修正：改成「被別檔引用的 § 白名單不改名，其餘可合併 / 刪」，白名單直接列在 plan 裡（每檔 3-6 個被引用的 § 標題）。
3. **`wc -l` 可被空行與 `---` 灌水（Eng 實測：空行 703 + 分隔線 122 = 33%）**——修正：加 byte 斷言，每個 task 同時報 `wc -l` / `wc -c`，這正是全域 patterns (a) 段能夠量化解釋 bytes 落後行數的原因。

DX 獨見的 Critical（「砍『為什麼』沒有下限，且 spec 前提『理由已在 archive』不成立」）也被採納，固定格式 `> 為什麼<動作>：<機制>。不做會<後果>（實測 <日期>）` 就是這條的直接產物，反映在 brainstorm（2 行）、review-plan（2 行）、execute-plan（1 行）、receive-review Red Flags（1 行）共 6 處保留引言。

此外還有 3 條被對齊 subagent（T3 request-review 階段派的架構 review）標記的 Major，在後續一顆 review fix commit（`42d17f7`）裡處理：

- `request-review`：medium 成本量級（8 個 finder、6 個 candidate 等具體數字）留原地，但拿掉「指向作者私人 memory」的措辭
- `receive-review`：特殊狀況第三條補回「Reviewer 給的 fix 自己錯」的觸發條件
- `security-audit`：Red Flags 補回「PII 違規可以後修」列（並補上 `rules.md §PII 安全底線` 依據）

同一顆 commit 也處理了 5 條 Minor（brainstorm 補回攤平的第二個理由、write-plan 補回 `同 Task N` 不重貼 code 的規則、execute-plan 引用標題對齊 verify-done 實際標題、pr-explain PII 標 critical 半句補回、spec 施工紀錄改成「4 行附日期」）。

## 後續 follow-up

- [ ] `dev-workflow` §Skill hand-off state 第 175 行寫的欄名 `review_summary` / `verify_result`，與實際檔案讀寫的欄名 `review_summary_path` / `verify_results` 不一致（review-plan DX 視角發現）。本 PR 範圍明訂只動 11 個 SKILL.md + rules.md 一句，`dev-workflow` 本身不在改動範圍，這條記入 spec §待釐清，留給下一支 PR。
- [ ] bytes 瘦身差目標 17 個百分點（−13% 對 −30%）：spec §施工紀錄 已誠實記錄差距與原因（見全域 patterns (a)），plan §失敗處置 規定「第二次仍到不了 → 接受現況、施工紀錄與 PR body 明列給 user」，本 PR 已照此處置，不再重跑瘦身。
- [ ] 四個軟目標檔（brainstorm 250/240、security-audit 92/85、receive-review 99/95、finish-branch 211/230）中，finish-branch 唯一達標，其餘三檔各超出 4-8%，皆在 plan 訂的 ≤10% 接受帶內，不需額外處理。

## 安全 / PII 檢查

- secret / API key：無命中（全部是流程文件與規則書文字，未見任何憑證 / token 字面值）
- PII mask：N/A——本 PR 內容是 skill 定義與規則書文本，未見 email / 電話 / 身分證 /信用卡等個資字面
- file-type 硬規則命中：無（改動檔全為 `.md`；`references-data.js` 屬產出器重產鏡像，非人工編輯的 CI/CD、DB migration、lock 檔或 infra 檔）
