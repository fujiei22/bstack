# Plan review 總結（階段 A）

> Plan: `docs/work/feat/design-lane/plan.md`
> Spec: `docs/work/feat/design-lane/spec.md`
> Tier: T3 | 視角: CEO + Design + Eng + DX（4 視角，各自獨立 context）
> 日期: 2026-08-28

**Critical 合計 8 條**（4 條多視角共識 + 4 條獨見）。所有可查證的事實主張已由主 agent 逐條實測，結果附在各條下方。

---

## Critical 共識（多視角獨立提出同一問題）

### C1 · `.design-gate` / `design-map.md` 在 0b′ 落檔會被 hook 擋死，且 `<branch-name>` 當下不存在
> Design Critical#2 + Eng Critical#1（兩個視角獨立提出）

`plan.md:664` 要 0b′ 寫 `docs/work/<branch-name>/.design-gate`；`plan.md:209` 要 §首次偵測 寫 `docs/reference/design-map.md`。但 0b′ 在 Phase 0 內（0b 與 0c 之間），而 CLAUDE.md §Docs 落檔規定「T1+ brainstorm **Phase 0 完成後**先 `git checkout -b <branch>` 再寫 spec」——0b′ 執行時仍在 `main`。

**主 agent 實測補充（比兩位 reviewer 說的更嚴重）**：`settings.json` 的 `PreToolUse` matcher 是 `Write|Edit|NotebookEdit`，`hooks/branch-safety.ps1` 對 repo 內、branch 命中 `main` 的寫入一律 `exit 2`。所以這兩個寫入不是「路徑寫錯」，是**根本寫不出來**——會被 hook 攔下，然後依 CLAUDE.md 處置要跳出 `AskUserQuestion` 問 branch 名。結果是 **Phase 0 在 0b′ 就被迫先決定 branch，而 Track / Tier 都還沒判**，入口分流順序被打亂。

**修法**：0b′ 只在記憶體產出欄位、寫進 hand-off state；`.design-gate` 與 `design-map.md` 的落檔延到「branch 建立後、寫 `spec.md` 的同一步」。需同時改 Task 1 §使用契約 與 Task 8。

### C2 · Task 9「取代 0c/0d 各自獨立問的寫法」沒給任何刪改指令
> DX Critical#1 + Design Critical#3（兩個視角獨立提出）

`plan.md:723` 只說「取代」，Step 3 卻只在 0d 之後 append 新節，沒有任何 step 刪掉既有的問法。合併後 `brainstorm/SKILL.md` 會同時存在三處互相打架的指示：`:21`（§使用契約「子步驟之間以 `AskUserQuestion` 取 user 確認」）、`:73`（§Phase 0c 內完整的單題選單範例）、`:96`（§Phase 0d「`AskUserQuestion` 確認」）。

這份檔的讀者是 AI，矛盾指令不會被「用常識忽略」，只會讓每次執行結果不同。而 Task 9 的 Step 1 全是 `grep -q` 存在性檢查，**結構上不可能抓到這個問題**。

**主 agent 實測**：`skills/brainstorm/SKILL.md:201` 本來就有 `## §Red Flags` → Task 9 那條 `grep -qE "Red Flags"` 在動工前就會過，改動 4 等於零驗證。另 `skills/dev-workflow/SKILL.md:60` 的「預判完務必 `AskUserQuestion` 確認」是第四處同義指令，Task 6 也沒動到。

**修法**：Step 3 明列各處的實際編輯（刪哪個 code block、改成哪句）；Step 1 加反向驗證（`! grep -q "問：判定為"`，或 `awk` 取 0c→0d 區段確認不再有選單塊）。

### C3 · `design-language` §使用契約 沒有 `ui_involved=false` 的 early exit
> DX Critical#2 + Eng Critical#3 + CEO Major（三個視角提出）

`plan.md:99-106` 的動作序是「取檔案清單 → 讀 design-map（不存在就進 §首次偵測）→ 查表 → 抽 exact values → 回傳」。`ui_involved` 只寫在 §對外契約 當說明文字（`plan.md:127`），**不是動作步驟**。而 §首次偵測（`plan.md:202-209`）是 7 組 Glob + import 圖追蹤 + **必經的 `AskUserQuestion`**。

配上 Task 8 的「**必跑**——包含看起來純後端的 task」（`plan.md:657`），結果是：任何專案的第一個 task，哪怕改 `statusline.sh` 一行，都會在 Phase 0 中間被拉去做一次區塊地圖訪談。Task 8 step 3 的「`ui_involved=false` → 到此為止」來得太晚，貴的部分已經跑完。

**影響半徑被 setup.ps1 放大**：skill 是 sync 到 `~/.claude/skills/` 的全域資產，這個成本會加在這台機器上**每一個專案的每一個 task**。

**主 agent 實測**：bstack 58 個 commit 中，動過前端檔的只有 4 個 commit（約 7%），且永遠是 `docs/index.html` 與 `docs/css/styles.css` 兩個檔。也就是 93% 的 task 會白付這筆成本。

**修法**：§使用契約 第 1 步先用副檔名清單算 `ui_involved`；`false` → 立即回傳、不讀地圖、不進首次偵測。§首次偵測 只在 `ui_involved=true` 且地圖 absent 時才跑。

### C4 · dark mode 偵測寫死 `prefers-color-scheme`，在 dogfood 專案上判反
> Design Critical#1 + Eng Critical#4（兩個視角獨立提出；主 agent 亦自行抓到）

**主 agent 實測**：`docs/css/styles.css` 全檔 `prefers-color-scheme` **零命中**，也 **零個 `@media`**；dark mode 走的是 `:root[data-theme="dark"]`（`:47`），配 `data-theme-mode` 三態切換。

受影響處：`plan.md:375`（抽取 step 3 只讀 `prefers-color-scheme`）、`plan.md:430`（Task 5 把它固化成 grep 驗收條件）、`plan.md:459-460`（對齊檢查 dark mode 項）、`plan.md:820`（Task 10 寫「實測依據：`:root` 與 `prefers-color-scheme: dark` 各一套值」——**此句與實檔不符，違反 CLAUDE.md §事實核實**）。

**後果是連鎖的**：跑在 bstack `docs/` 上，skill 會判「該區沒有 dark mode」，然後依檢查項指示「沒有 → 不要單獨為這次改動引入一套」，AI 被明確引導成**不補 dark 值**——而該區其實有完整的第二套。第一個真實案例就把規則用反，且正好是 S3「不誤植」要防的反面。

**修法**：偵測改為三機制並列（`prefers-color-scheme` / `[data-theme]` / `.dark` class），任一命中即視為有兩套值；`design-map.md` 加一欄「dark 機制」；Task 5 grep 改驗三機制皆在；`plan.md:820` 照實改寫。

---

## Critical 各視角獨見

### C5 · 階段 A 會問一個系統當下答不出來的問題（CEO）

Task 9 的合併選單在 `ui_size=大改` 時放「設計路徑」四選一，第一個選項標「出三版讓我選（**推薦**）」。但三方向本體 `design-direction` 整個在階段 B（Task 7 自己寫明「階段 B 才會真正接上」）。**使用者選了推薦選項之後，系統什麼都不會出。**

CEO 的判斷：這比不問更糟——不問只是能力沒到，問了不做是破壞使用者對流程的信任，而這套流程唯一的資產就是「它說會做的事會做」。

**修法**：階段 A 的合併選單只問 Track / Tier / UI 判定三題（`ui_size` 照樣判、照樣進 state）。設計路徑那題整段挪到階段 B。

### C6 · Task 10 的 V2「分區不誤植」在 bstack 是空驗，self-review 卻標 S3 ✅（CEO）

**主 agent 實測確認**：58 個 commit 中動過前端檔的只有 4 個 commit、只涉及 2 個檔——bstack 只有**一個**設計語言區塊。單區 repo 驗不出「改 A 區不會抄到 B 區」，而那正是 spec §動機 第 2 個問題的核心，也是 §首次偵測 最複雜機制（追 import 圖、合併區塊、class prefix 指認）所要解的東西。這些機制在 Task 10 跑完後**一行都沒被真的執行過分歧路徑**。

**修法**：§Self-review 的 S3 由 ✅ 改成「部分——單區驗證，多區辨識未驗」，並明寫 S3 的真驗收 deferred 到第一個真正多區的專案。

### C7 · MIT 版權聲明與負向 grep 互斥，S6 兩半在 plan 內自相矛盾（Eng）

`huashu-design/LICENSE:3` 是 `Copyright (c) 2026 alchaincyf (花叔 · 花生)`，spec 明文「必須保留」。但 `plan.md:349` 與 `plan.md:806` 的斷言是 `! grep -qiE "花叔|huashu|alchaincyf|..."` 零命中。Task 4 從 `design-context.md`（213 行）改寫內容進 `design-language/SKILL.md`，**卻沒有任何 step 放置 MIT 聲明**——目前是靠「不放」讓驗證過關。

照現況跑，V8 會綠燈，但 **S6 的前半（保留 MIT）被靜默跳過**，等於默默放掉一個授權義務。

**修法**：先拍板 attribution 落點（建議 `skills/design-language/NOTICE.md` 或 SKILL.md 末尾 `## §上游授權` 區塊），兩處 grep 改成「排除 attribution 區塊後零命中」。**此項牽涉 spec §待釐清 #2，需回 spec 層拍板。**

### C8 · 階段 A 宣稱「小改路徑完整可用」，但沒有任何 dispatch 會觸發對齊檢查清單（Eng）

Task 1 把責任推給呼叫端（`plan.md:106`），但階段 A 動的三個檔沒有一個是那個呼叫端。Task 7 的觸發表列的四個觸發條件（`plan.md:593`）**沒有一條是「小改路徑動前端檔前後跑對齊檢查」**，而 `execute-plan` 與 `verify-done` 的改動全在階段 B。

所以 V4 之所以會「通過」，是因為 Task 10 Step 3.3 由人手動照做一遍，**不是因為機制成立**。換一個 session 跑同樣的小改，不會有任何東西提醒它跑檢查清單。

**修法**（成本很低）：Task 7 觸發表補「`ui_involved=true` 且 `ui_size=小改`，execute-plan 動到前端檔的 task 前後」。dev-workflow §跨流程 skill 觸發 本身就是 dispatch 機制，補這一句即可，不需動 `execute-plan`。

---

## Major（去重後，按嚴重度排）

### M1 · 副檔名清單有六處拷貝，且授權當下就已分岔
> Design + Eng + DX 三方提出

**主 agent 實測命中位置**：`verify-done:52`、`verify-done:81`、`frontend-test:8`、`frontend-test:31`、`dev-workflow:230`，加上本 plan `:127` 共六份（階段 C 的 hook 會是第七份）。

`.sass` **只出現在 `frontend-test:8`**，其餘四處皆無；本 plan 又把 `.sass` 加回來，並寫了一句「與 verify-done 用同一組副檔名，兩處必須同步」——**該斷言在寫下當下就是假的**，而它寫在 AI 會當事實讀的 prompt 裡。

後果：`.sass` 檔會被 0b′ 判 `ui_involved=true`，卻不觸發 `frontend-test`、也不會被階段 C 的 hook 擋。

**修法**：在 `design-language` 開一節 §前端副檔名（唯一真相），其餘五處改成引用而非重列；階段 C 的 hook 因 pwsh 讀不到 markdown，允許為第二份拷貝但加一致性 grep。順帶決定 `.sass` 收不收（傾向收，並補回 `verify-done` 與 `dev-workflow`）。

### M2 · 五欄位契約的 shape 不合格
> Design（第 2 問明確判斷）

- **破壞既有 grouping 慣例**：既有 state 把相關欄位收進一個 key（`codebase_impact.{files,modules,db_involved}`、`verify_results.*`、`frontend_test.*`），本 plan 在頂層攤開六個。
- **三種 prefix 混用**：`ui_*`（三個）、`design_*`（兩個）、`has_*`（一個）。`has_` 在整個 repo 的 state 裡沒有先例（既有布林是 `db_involved` / `memory_loaded` / `ran` / `blocker`）。
- **插入指令自相矛盾**：`plan.md:540` 說「在 `db_involved` 之後補」，但 `db_involved` 在 `codebase_impact:` 底下（4-space 縮排），而 `plan.md:542-548` 的片段是 2-space。下游要讀 `state.ui_involved` 還是 `state.codebase_impact.ui_involved`？

**修法**：收進一個 `design:` 區塊（`involved`/`scope`/`size`/`precedent`/`map_status`/`path`），與 `frontend_test:` 同形。`.design-gate` 是 KEY=VALUE 文字檔，維持扁平不受影響。**現在改成本很低，階段 C 的 hook 一旦開始讀就變貴。**

### M3 · 10 個 task 可壓到 5，且並行的價值是負的
> CEO + Eng

Task 1-5 全部往**同一個新檔**順序 append，plan 自己的鐵律說同檔不並行——那五個 group 編號是形式。而「可單獨 revert」在新檔上不成立：revert 掉 §失效檢查 之後剩下的是半成品 skill，比沒有更糟（模型會照殘缺規則走）。

**並行成本**：6 個 group 裡有 5 個恰好 2 個 task，而 `execute-plan` §使用契約 規定「同 group 多 task → 載 `dispatch-parallel` 並問 user」→ **5 次 skill 載入 + 5 次 `AskUserQuestion`**，只為讓 10 次 markdown 編輯少排幾次隊。且 CLAUDE.md §協作模式判定 判準 1 要求「可切 ≥3 塊」，2-task group 永遠過不了，選單答案必然是 subagent 或串行。

**修法**：合併成 T1（design-language 主體）、T2（對齊清單＋Red Flags）、T3（dev-workflow）、T4（brainstorm）、T5（驗收），grep 斷言取聯集。或至少明寫「本 plan 的 parallel-group 僅表達依賴順序，不必載 dispatch-parallel」。

### M4 · group 1 標錯：Task 6 引用 Task 1 才會產生的章節錨點
> Eng（唯一逐 group 驗證的視角）

`plan.md:537` 要寫進 dev-workflow 的句子是「細則見 `design-language` §兩根尺」，而 §兩根尺 是 Task 1 Step 3 的內容。兩者同在 group 1。並行總表的理由「Task 6 只需 skill 名與欄位名」不成立——還需要一個章節錨點。

Eng 逐 group 驗證結果：**6 個 group 中 5 個標對，只有 group 1 錯**。「同檔 task 一律分不同 group」的鐵律確實被遵守（T1-5 → g1-g5、T6-7 → g1,g2、T8-9 → g3,g4，無同檔同 group）。

**修法**：Task 6 移到 group 2、Task 7 移到 group 3；或把 §兩根尺 的章節名寫進 plan §介面 當契約一部分。

### M5 · 大量 grep 斷言在該 task 開跑前就已成立，紅綠循環的「紅」是假的
> DX + Eng + CEO 三方

實查已預先成立的斷言：

| task | 開跑前就會過的斷言 | 真正載重的 |
|---|---|---|
| Task 2 | `docs/reference/design-map.md`（Task 1 契約已寫） | `§首次偵測`、`CSS 方案` |
| Task 3 | `stale`（Task 1 契約 yaml 已有） | `§失效檢查` |
| Task 4 | `! grep 上游字串`（本來就零命中） | `§設計語言抽取`、`exact value` |
| Task 5 | `斷點`、`prefers-color-scheme`（皆在 Task 4 內容中） | `§對齊檢查清單`、`empty`、`必填` |
| Task 7 | `` `design-language` ``（Task 6 註解句已含） | 只剩 `-qE` 那條 |
| Task 9 | `ui_size`、`Red Flags`、`禁止用 Tier 推導` | 只剩兩條 |

另外幾條是**空檢查**：`grep -q "30"` 會被檔內任何含 30 的字串命中（含未來寫進去的色碼、px 值）；`grep -qE "Red Flags"` 在 `brainstorm:201` 本來就存在。

**修法**：每條 grep 改抓**該次改動獨有的字串**（原則：驗證字串必須是這個 task 寫進去之前不可能存在的）；Step 2 明寫「本次由哪一條斷言拉紅」，其餘標為 regression guard。

### M6 · 對齊檢查清單缺「該區沒有這個維度」的出口，在 dogfood 專案上就會卡死
> CEO + Design + Eng 三方

四項裡元件狀態與 dark mode 有出口，**斷點與表單沒有**。而 `plan.md:462` 規定「任一項答不出來 = 設計語言沒讀夠，回 §設計語言抽取 補讀，不要猜」。

**主agent 實測**：`docs/css/styles.css` 有 **0 個 `@media`**、也沒有表單。跑 Task 10 的 V4 時，「沿用該區現有斷點了嗎」無解、「跟該區既有表單一致嗎」無對象 → 依 `:462` 要回去補讀 → 但沒有東西可讀 → 迴圈。

**修法**：四項統一加「該區客觀上無此維度 → 標 N/A 並寫明依據（檔＋grep 結果），不算沒讀夠」；`:462` 的觸發條件收窄成「該區**有**這個維度但你答不出來」。

### M7 · 「至少 30 個具體值」門檻不可執行
> Design + Eng + CEO 三方，數字互相矛盾

**主 agent 裁決**：兩位 reviewer 的數字都對，是算法不同——
- **26** = 行首宣告的 distinct 名
- **34** = 任意位置 `--name:` 宣告的 distinct 名（`styles.css` 一行寫兩個變數，第二個不在行首）

也就是說，**同一個檔案會因為怎麼數而落在門檻兩側**。這條門檻不可一致執行，而 dogfood 專案剛好卡在邊界。

**修法**：改成質性門檻（色彩／字體／間距／圓角／斷點／dark mode 六類，每類要有實際值或明確標 N/A），比數字門檻更能抓到「只看了個大概」。

### M8 · §首次偵測 的 glob 太窄，且沒排除 vendor / gitignored 目錄
> Eng

**主 agent 實測**：7 組 pattern 跑在全 repo 只命中 `docs/css/styles.css`，漏掉 5 個 CSS 檔（`gstack/extension/{content,inspector,sidepanel}.css`、`everything-claude-code/skills/frontend-slides/viewport-base.css`、`gstack/test/fixtures/review-eval-design-slop.css`）。換到 style 進入點叫 `app.css` / `main.css` / `index.css` 的專案，偵測會回 `absent`、`has_precedent: false`——**失效方式恰好是「不報錯、直接說這專案沒有設計語言」**。

反面：bstack 根目錄有四個 gitignore 的 vendor 目錄，spec 還明訂「不動 `huashu-design/`」。§首次偵測 沒有任何排除規則，pattern 一放寬就會把 vendor 切進地圖。

**修法**：pattern 補 `**/*.css` 兜底 + 用「檔內含 `--` custom property 或 `$`/`@` 變數宣告」當篩選（比檔名可靠）；同時明寫排除 `node_modules/`、`.gitignore` 命中路徑、`vendor/`、`dist/`。

### M9 · 失效檢查有三個洞
> CEO + Design

1. **偵測不到最危險的過期**（CEO）：新區塊長在舊區塊的 glob 底下（`前台 = src/pages/**`，之後長出 `src/pages/admin/**`）。此時地圖顯示 ok、`has_precedent=true`、抽出前台 token 餵給後台——**比沒地圖更糟**（沒地圖至少會 `has_precedent=false` 停下來）。
2. **沒有迴圈上限**（Design）：還沒被任何檔 import 的新建檔永遠歸不了區 → 落區外 → stale → 重跑 → 再 stale。階段 B 的 `design-demos/*.html` 會穩定觸發。
3. **grep 範例與 pattern 清單對不上**（Design）：`plan.md:307` 只抓 `.(css|scss|ts|js)`，但偵測 pattern 含 `.sass` 與 `tailwind.config.*`（常是 `.mjs`/`.cjs`）→ 這類專案的 token 檔被刪永遠不判 stale，靜默失效。

### M10 · 其餘 Major（不逐條展開，修 plan 時一併處理）

- **表單檢查項答不出來，因為抽取步驟沒讀表單**（DX）：「讀什麼」三條沒有一條保證讀到表單，輸出格式也無對應欄位。修法：代表性元件改成「該區若有表單，其中必含一個表單元件」，輸出格式加「表單慣例」一行。
- **判錯區塊時沒有可觀察線索**（DX）：`ui_scope` 只回一個名字，契約沒有 evidence 欄位；使用契約寫了「必須有 token 來源檔佐證」卻沒要求印出來。修法：加第六欄 `ui_scope_evidence`，合併選單那題固定帶「區塊／token 來源檔／`design_map_status`」。
- **契約 null 語意自相矛盾**（Design）：`has_precedent: bool` 與 `design_map_status: ok|stale|absent` 都不允許 null，但 `plan.md:663` 說「`ui_involved=false` → 其餘欄位填 null」。修法：補真值表釘死所有組合。
- **`design_map_status: stale` 是永遠回不出去的死值**（Design）：`plan.md:301` 規定 stale 一律重跑至 ok。修法：改成 `ok|remapped|absent`，或明訂真的會回 stale 的情境。
- **class prefix 分區與失效檢查、抽取三者互斥**（Design）：範圍欄放 prefix 時路徑永遠比對不到 → 每次都判 stale；且抽取是整份讀 token 檔，shared CSS 會同時吃到兩套 token——正是要防的誤植。修法：範圍拆兩欄（`檔案範圍` glob ＋ 選填 `選擇器範圍` prefix），失效檢查只吃前者。
- **`.design-gate` 缺 `design_path` 欄、也沒進 `.gitignore`**（DX + Eng）：階段 C 的 hook 要判「大改但無定案方向」，若 user 選了合法豁免，hook 沒有欄位能知道。且 `.gitignore` 改動排在階段 B，而檔在階段 A 就會產生。
- **`design-language` 與 `frontend-test` 觸發詞衝突**（Eng）：兩者 description 共用「前端／UI／樣式／CSS／改 UI／改前端」。skill description 就是 routing 機制本身，這是唯一會真的讓選錯 skill 的事。修法：`design-language` 收斂成「設計語言／design token／設計對齊／樣式一致／誤植」，並各加一句互斥說明（「改完要驗 → frontend-test；改之前要對齊 → design-language」）。
- **觸發表提前宣告階段 B 才存在的能力**（DX + Eng）：`plan.md:593` 那列與 `plan.md:601` 的路徑圖提到尚未接上的 `design-direction`。Task 7 改動 2 有標階段、改動 1 沒標，同一份 plan 內處理方式不一致。
- **三處「四子步驟／四元組」改完會變錯，沒有 task 修**（DX）：`dev-workflow:20`、`:31`、`:274`、`brainstorm:20`。最後一條殺傷力最大——它是 §使用契約（強制）第 1 條，明列四個子步驟且說「不跳過」，AI 讀到強制契約說四步、後面有五節，會優先信契約。

---

## Minor / Nit（合併摘要，修 plan 時參考，不逐條列）

- 驗證指令硬編 `cd "D:/GitHub/bstack"`，merge 後進 archive 在別台機器照抄即錯 → 改 `cd "$(git rev-parse --show-toplevel)"`
- Step 2 短路 `&&` 只印一個 `FAIL`，看不出缺哪條 → 改迴圈型逐條印 `MISS:`，並用 `grep -qF` 避免 `§`、`.` 被當 regex
- `0b′` 的 `′` 是 U+2032 PRIME，跨四個 task、三個檔、六條手打 grep，任一處打成 ASCII `'` 會靜默失敗 → 建議改 `0b-ui` 這類純 ASCII 標識
- 新 skill 引入 repo 未曾使用的符號：`🔴`／`⚠️`／`○` 在 `skills/` 各出現 **0 次**（實測），既有慣例是 `**粗體**` 與 `1./2./3.` 編號
- frontmatter 用「被呼叫端：」是新造詞，既有是「上游：／下游：」或 `db-access` 的「**強制**：」句式
- 缺一節 §與 dev-workflow 銜接（`db-access` 有，同為跨流程能力型 skill 的既有慣例）
- `docs/reference/` 目前不存在，Task 10 Step 3 沒有建目錄動作
- Task 6 Step 3 說「插入一列」但貼了五行完整區塊，照做會覆蓋掉原圖尾巴的 T0／T1+ 分支兩行
- Task 9 改動 3 只有一句話沒有實際 yaml，且「六個欄位」與 §介面 的五個對不上（`design_path` 是選單結果，不是 `design-language` 回傳值）
- `design_path` 的選單標籤與 enum 值（`三版|單版|一主一變體`）沒有映射表
- **合併選單 4 題已頂到 `AskUserQuestion` 的 `maxItems: 4` 上限**（主 agent 由工具 schema 確認，Design 原標為推斷）——階段 B/C 想再加維度沒有空間
- Task 10 的 V4 會動 `docs/css/styles.css`，但 Step 5 只 commit `design-map.md`，會留一個真實視覺改動在 working tree；且該檔不在 spec §影響檔案 表內
- V1/V4 零機械覆蓋，Task 10 的 PASS 證明不了它們
- 三塊知識只活在 plan 裡（markdown 的紅綠對映約定、單檔 vs 多檔 skill 的破例判準、上游識別字串 grep one-liner），merge 後隨 plan 進 archive 就找不到——第三項尤其該補進 spec，它是**階段 B 的驗收工具**
- spec 的緩解措施「改動前後各跑一次完整 Phase 0 對照」只實現了「後」半，沒有 baseline

---

## 主 agent 建議

### 判斷：這不是修幾行，是要重寫 plan

八條 Critical 不是散落的錯字，集中在**三個結構性缺陷**：

1. **落檔時機錯（C1）** —— plan 照跑會在 0b′ 被 hook 擋死，Phase 0 直接卡住。這條讓整份 plan 無法執行。
2. **契約設計不完整（C3 early exit、M2 shape、M10 null 語意 / 死值）** —— 契約是 Task 1 定的，後面九個 task 全部建在上面。契約改，九個 task 都要跟著改。
3. **驗證是假綠燈（M5、C6、C8）** —— 大量斷言預先成立、V1/V4 零機械覆蓋、V2 在單區 repo 上驗不到分歧路徑。也就是說「跑完全 PASS」不代表東西是對的。

加上 M3（10 task 應壓到 5、並行價值為負）與 M4（group 1 標錯），task 切分本身也要重來。局部修補會變成在一個錯的骨架上補丁。

### 有四項要回 spec 層，不是 plan 層能決定的

| 項 | 為什麼超出 plan |
|---|---|
| **C5** 階段 A 問設計路徑但 B 才實作 | 這是 D17 階段拆分的邊界問題 |
| **C6** S3 在 bstack 驗不了 | spec 的 S8 dogfood 假設本身有問題（bstack 是單區 repo） |
| **C7** MIT attribution 落點 | spec §上游識別字串處理只說「必須保留」沒說放哪；spec §待釐清 #2 未決 |
| **C1 的下半** `.design-gate` 格式與位置 | spec §待釐清 #4 未決，且它同時是階段 C hook 的輸入 |

另外 CEO 提了一個**跨階段的排序建議**值得在 spec 層一併考慮：把階段 C 的 hook 拆成 **C1「只驗 `.design-gate` 存不存在」**（只依賴 A，可緊接 A 上線）與 **C2「大改方向驗證＋setup.ps1 孤兒偵測」**，排序改成 A → C1 → B → C2。理由是 C8 揭示的那件事——階段 A 交付的全是靠自覺執行的規則，而**這個 lane 存在的理由就是模型不會自覺去讀設計語言**；用「模型會自覺遵守新寫的規則」去解「模型不自覺」，在 hook 上線前是循環論證。

### 必處理 / 建議處理 / 略過

- **必處理**：C1-C8 全部（八條 Critical）
- **建議處理**：M1-M9（M1 副檔名唯一真相、M2 契約 shape、M3 task 顆粒度、M4 group 1、M5 斷言強度、M6 N/A 出口、M7 門檻、M8 glob、M9 失效檢查三洞）
- **略過**：Nit 中的 `0b′` 改 ASCII 一項可留待實作時決定；其餘 Nit 建議一併處理，成本都很低
