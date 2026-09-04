# PR #64: refactor: 精簡 T2 lane，review 合一、pr-explain 限 T3

> URL: https://github.com/fujiei22/bstack/pull/64
> Branch: refactor/t2-lane-slim → main
> Track: Dev | Tier: T3
> 建立: 2026-09-04
> 對應 spec: docs/work/refactor/t2-lane-slim/spec.md
> 對應 plan: docs/work/refactor/t2-lane-slim/plan.md

## 整體脈絡

這個 PR 動的不是程式邏輯，是**流程本身的定義**：bstack 是一個 Claude Code plugin，它的「行為」全寫在 markdown（rules.md、13 個 skill、1 個 agent），Claude 讀到哪句就照哪句做。問題是 T2（3-10 檔的單模組 feature）一直被當成小型 T3 在跑——spec 之外還寫一份 plan.md、跑 review-plan、三個 code reviewer、pr-explain 燒 9 萬 token、review fix 一個 finding 一顆 commit（squash 後全消失）。PR #61 實測 5 檔 150 行 code 要 44 分鐘，同日 T1 的 PR #62 只要 5 分鐘。

做法是把 lane 的「唯一真相」收斂到 `rules.md §Tier 表`，然後讓 13 個 skill、agent、README、流程圖、landing 全部跟著這張表走，並用兩支契約腳本（`plugin-contract.mjs` P9a-i、`docs-site-contract.mjs` C8a / C6a / C19e）機械守住「舊敘述不准殘留」。

改了 27 個檔（+1000 / -261；其中 679 行是 spec / plan / review 三份施工文件、17 行是產出器重產的 `references-data.js`，實質規則改動約 300 行）。核心行為改動五條：

1. **T2 不寫 plan.md、不跑 review-plan**——計畫壓成 spec 末尾一張 ≤8 列的 `## 施工清單`，與 spec 同一個 gate 確認，execute-plan 直接逐列當 task
2. **code review 合一**——T2 一個 reviewer、T3 架構 × 除錯兩個；語言 idiom 提示寫進 prompt，`lang-reviewer` agent 改為 user 點名才派
3. **pr-explain 限 T3**——T0-T2 開完 PR 即停
4. **receive-review 不危險類 finding 一顆 commit**
5. **T3 review-plan 視角依改動面向 1-3 個**（Eng 下限 / DX / Design），CEO 視角移除

本 PR 自己照舊規則跑完整 T3 流程（包含這份 pr-review.md），是最後一次這麼重。follow-up：新 lane 尚未實戰，建議第一個 T2 任務挑「把 request-review 改接內建 `/code-review`」。

## 檔案改動清單

| 檔 | 類型 | 行 +/- | 改動性質 |
|---|---|---|---|
| `skills/devwork/rules.md` | edit | +12/-7 | §Tier 表加 pr-explain 欄、T2 / T3 列改寫、表下宣告本表為 lane 唯一真相 |
| `skills/brainstorm/SKILL.md` | edit | +34/-6 | spec 範本加 `## 施工清單` / `## 施工紀錄`、交棒依 Tier 分流、新增 §補施工清單入口、0b 加 T3 視角判定 |
| `skills/execute-plan/SKILL.md` | edit | +13/-10 | `plan_path` null 時改讀 spec 施工清單（標題精確比對）、fail 退回分 T2 / T3、施工紀錄落點 |
| `skills/request-review/SKILL.md` | edit | +30/-44 | 刪 lang-reviewer 自動派發段、新增 §語言提示表、T3 prompt 補 spec / plan |
| `skills/review-plan/SKILL.md` | edit | +30/-57 | 刪 CEO 視角、視角改讀 `state.review_perspectives`、T2 誤入回彈 |
| `skills/dev-workflow/SKILL.md` | edit | +20/-17 | Phase 0 / 2 / 5 / 8 路徑圖依 Tier 分流、state schema `plan_path` 允許 null、跨流程表 lang-reviewer 列 |
| `skills/receive-review/SKILL.md` | edit | +7/-12 | §不危險處置改一顆 commit、Red Flag 反轉 |
| `skills/finish-branch/SKILL.md` | edit | +4/-4 | 第 6 步 T3 才交棒 pr-explain、PR body plan 行允許 N/A |
| `skills/write-plan/SKILL.md` | edit | +4/-5 | T3 only、非 T3 回彈 execute-plan |
| `skills/dispatch-parallel/SKILL.md` | edit | +7/-7 | task 來源分 plan Task N（T3）/ 施工清單第 N 列（T2）、fail 退回分流 |
| `skills/design-direction/SKILL.md` | edit | +2/-2 | 下游分 T3 → write-plan / T2 → brainstorm 3.5 |
| `skills/verify-done/SKILL.md` | edit | +1/-1 | fail 選項退回分 T2 / T3 |
| `skills/context-snapshot/SKILL.md` | edit | +2/-2 | `plan_path` 允許 null、決策紀錄範例拿掉「4 視角」 |
| `skills/context-resume/SKILL.md` | edit | +1/-1 | `plan_path` null 不當 snapshot 壞掉 |
| `skills/pr-explain/SKILL.md` | edit | +1/-1 | description 標 T3 自動、其他 tier 顯式呼叫 |
| `skills/write-skill/SKILL.md` | edit | +4/-4 | description 範例換成現行 execute-plan 的 |
| `agents/lang-reviewer.md` | edit | +4/-4 | description 改「user 顯式呼叫」 |
| `README.md` | edit | +6/-6 | 簡介標 T3、brainstorm / write-plan / review-plan / pr-explain / lang-reviewer 五列 |
| `scripts/plugin-contract.mjs` | edit | +58/-0 | 新增 P9a-i 九條 T2 lane 一致性檢查 |
| `docs/tools/docs-site-contract.mjs` | edit | +16/-3 | C6a 基準拿掉 RPT2、C8a EXPECT 96 / 135、新增 C19e |
| `docs/js/data.js` | edit | +29/-33 | 刪 RPSplit / RPT2 / LangAgent 三節點、刪 7 邊加 6 邊、label 標 Tier |
| `docs/js/app.js` | edit | +10/-9 | NODE_DOCS 刪 RPT2 條目、LangAgent 保留加註解、兩處計數註解 |
| `docs/index.html` | edit | +9/-9 | 節點數 99→96、四段 `data-upto`、b5 `data-nodes`、三段文案（純文字節點） |
| `docs/js/references-data.js` | edit（產出器） | +17/-17 | `build-references.ps1` 重產，內嵌全文跟上 |
| `docs/work/refactor/t2-lane-slim/spec.md` | new | +107 | brainstorm 產出（9 條 success criteria） |
| `docs/work/refactor/t2-lane-slim/plan.md` | new | +463 | write-plan v2（8 task）+ Task 8 實測紀錄 |
| `docs/work/refactor/t2-lane-slim/review.md` | new | +109 | plan review（Design + Eng + DX）+ code review 總結 |

---

## `skills/devwork/rules.md`

### 改動意圖

對應 spec 第 5、9 條。這份檔被 `CLAUDE.md` 用 `@import` 整份載進每個 session，是全 repo**位階最高**的文件；lane 精簡若不先改這裡，下游 skill 改了也會被它蓋回去。plan 的 Architecture 段明講「lane 行為唯一真相 = rules.md §Tier 表」，這個檔就是那張表。

### 改動詳解

#### 區塊 1：§Tier 表加第 8 欄、T2 / T3 列改寫

```diff
-| Tier | 量體 | brainstorm | plan | TDD | review | security |
+| Tier | 量體 | brainstorm | plan | TDD | review | security | pr-explain |
-| **T2** | ... | 用 + review (Eng) | 紅綠循環 | subagent + lang-reviewer | 涉認證 / 資料層才 audit |
+| **T2** | ... | 施工清單（spec 內、≤8 列；不寫 plan.md、不跑 review-plan） | 紅綠循環 | 1 subagent（prompt 附語言 idiom） | 涉認證 / 資料層才 audit | 跳（PR body 已含 why / what / test） |
-| **T3** | ... | 用 + review (4 視角) | 紅綠、80% 目標 | 雙視角 + lang-reviewer | audit + checklist + db-reviewer |
+| **T3** | ... | plan.md + review-plan（視角依改動面向 1-3） | 紅綠、80% 目標 | 雙視角 subagent（架構 × 除錯，各附語言 idiom） | audit + checklist + db-reviewer | 用 |
```

- pr-explain 原本沒有 Tier 欄，等於「每個 tier 都跑」；加欄後 T0-T2 明確「跳」，這是 finish-branch 第 6 步分流的依據
- T2 plan 欄從「用 + review (Eng)」變「施工清單」——這一格是整個 PR 最關鍵的一句，brainstorm / execute-plan / write-plan / review-plan 四個 skill 的分流都引用它
- T3 review 欄拿掉 `+ lang-reviewer`；P9a 用 `!/lang-reviewer/.test(tierT3)` 守這一格

#### 區塊 2：表下四句宣告

- **「本表是 lane 的唯一真相；與任何 skill 衝突以本表為準」**——review DX m7 的發現：原本沒宣告真相層級，Claude 遇到 skill 與表打架時會自己挑一句照做。現在明講衝突時誰贏
- **「≤8 列，超過代表 Tier 判低了，回 0d 升 T3」**——這是施工清單的量體上限，brainstorm §補施工清單入口與 execute-plan 第 1 步都以此回彈
- **「lang-reviewer 不自動 spawn」**、**「T3 review-plan 視角依改動面向」**——兩條新規則的最高位階宣告
- 「精簡依據見 `docs/archive/2026/` 的 `t2-lane-slim` 主題」——刻意不把 PR #61 的實測數字寫進來，因為這份檔常駐每個 session，多一段就多吃 context（review DX n3）。code review 除錯 m6 指出 merge 當下 archive 路徑還不存在，改成「主題」而非寫死路徑

#### 區塊 3：§Docs 落檔的 pr-review.md 說明

`（T0-T1 簡、T2-T3 詳）` → `（T3 自動、其他 tier 顯式呼叫才有）`。舊句暗示 T2 會有 pr-review.md，與新表矛盾（review Eng Major 9）。

### 關聯檔案

- 被 `CLAUDE.md` `@import` → 全 session 常駐
- 被 `scripts/plugin-contract.mjs` P9a 守：T2 列含「施工清單」「1 subagent」、T3 列含「雙視角」「依改動面向」、表頭含「pr-explain」、全檔無「T2-T3 詳」
- 被 `docs/js/references-data.js` 內嵌（`references/rules.md` 條目）→ 產出器重產

---

## `skills/brainstorm/SKILL.md`

### 改動意圖

對應 spec 第 1、9 條與 plan Task 3。brainstorm 是施工清單的**生產端**——T2 的 plan.md 消失後，計畫要在這裡以表格形式產出。同時承接 review 的三個 Critical：C1（T2 + 設計大改路徑斷掉）、C2（spec gate 選單仍寫「進 write-plan」）與 Major 5（退回補清單沒有入口）。

### 改動詳解

#### 區塊 1：使用契約第 0 步——先分流

```diff
+0. **先分流**：state 已有 `tier=T2` 且 `spec_path` 存在、且是 execute-plan / dispatch-parallel / verify-done 退回來補清單 → 直跳 §補施工清單入口，**不跑 Phase 0**。其餘往下。
```

- 為什麼放第 0 步而不是只在檔尾加一節：code review 架構 M4 指出「§補施工清單入口寫在 240 行後，但載入時第 1 步就先跑 Phase 0」——Claude 讀到第 1 步就開始重問 Track / Tier，根本讀不到後面的入口。分流必須在 Phase 0 之前
- 判斷條件三個全中才走入口：有 tier=T2、有 spec_path、且是從下游退回。正常首次進 brainstorm 時 state 是空的，不會誤入

#### 區塊 2：契約 3.5 與第 4 步——T2 交棒分流

```diff
+   **T2 且走過三方向** → 依 `direction_decided` 回寫 `## 施工清單`，只對這張表再 `AskUserQuestion` 確認一次（不重問 spec），再進第 4 步。
-4. T0 → user 點頭後直接交實作；T1+ → 交棒 write-plan（Dev）或 debug-systematic（Bug）。
+4. T0 → ...；T1 → 交棒 execute-plan（無 plan）；**T2 → spec 末尾附 `## 施工清單` 後交棒 execute-plan**（不進 write-plan / review-plan）；T3 → 交棒 write-plan。Bug track 一律 debug-systematic。
```

- 3.5 的新句解決 review C1：T2 大改的順序是「spec gate → design-direction 選方向 → 回寫 spec → 交棒」，施工清單在方向定案**之前**就被 user 點頭，定案後清單可能已經不對。補一次只針對這張表的確認，不重問整份 spec
- 第 4 步舊句「T1+ → write-plan」本來就與 execute-plan description「T1 由 brainstorm 直接交棒」打架（commit 7e89cf1 body 有提），這次順帶修掉

#### 區塊 3：0b 第 6 點——T3 視角判定

```diff
+6. **T3 視角判定**：...從 `codebase_impact` 判命中哪些面向——機械可驗 → Eng（下限）；有人要讀 → DX；跨模組兩端契約或對外介面 → Design。命中幾個派幾個，寫 `state.review_perspectives`。0b 時 Tier 只是預判，以 0d 定案後為準；定案不是 T3、或 Track=Bug → 清掉這欄。
```

- 視角判定放在 brainstorm 而非 review-plan，因為只有 brainstorm 看過 codebase（0b）；review-plan 改成「只讀不判」
- 末句「0b 時 Tier 只是預判…清掉這欄」是 code review 架構 m1 補的：0b 跑在 0d 之前，此時 Tier 還沒定案；Bug track 也會經過 0b 卻用不到視角

#### 區塊 4：spec 範本加兩段 + 施工清單規則

```markdown
## 施工清單

<!-- T2 必填；T1 / T3 刪掉本段與下一段 -->

| # | group | 檔（可多個） | 做什麼 | 怎麼驗 |

## 施工紀錄

<!-- execute-plan 施工中追加：四項對齊檢查（N/A 附依據）、執行偏差、實際產出 -->
```

- **標題必須恰為 `## 施工清單`**（裸、無括號）：review Design M3 抓到三處字面不一致（spec 範例帶括號、範本帶括號、execute-plan 用前綴 grep），而本 PR 的 spec 自己就有「## 施工清單契約」段會被前綴比對誤中。改成精確比對後，execute-plan 與 P9b 都用 `^## 施工清單$`
- 指示改用 HTML 註解放在標題下方，不放標題裡，才不會破壞精確比對
- `## 施工紀錄` 是 review Design M6 補的：T2 沒有 plan.md 後，四項對齊檢查與執行偏差沒地方記；squash merge 後這一段是唯一留下的施工帳本
- 規則五條：≤8 列 / group 預設每列不同號（review Design M7：同號會觸發 dispatch-parallel 的協作模式問句，預設不同號避免 T2 動不動就被問 Agent Teams）/「怎麼驗」不寫「確認正常」/ 跟 spec 同一個 gate / execute-plan 逐列當 task

#### 區塊 5：spec gate 選單改寫

```diff
-問：spec 已寫至 docs/work/<branch-name>/spec.md，請看一下。
+問：spec 已寫至 docs/work/<branch-name>/spec.md，請看一下。（T2：末尾的施工清單就是全部的計畫，這是最後一次看計畫，下一步直接施工）
-  1. spec 正確，進 <write-plan|debug-systematic>（推薦）
+  1. spec 正確，進 execute-plan（T1 / T2）／ write-plan（T3）／ debug-systematic（Bug）（推薦）
```

review C2 的重點：這顆 AskUserQuestion 是 T2 使用者**唯一親眼看到**的交棒文字，沒改它 user 會以為還有 plan 階段可以再看一次。P9b 守 `!/進 <write-plan\|debug-systematic>/`。

#### 區塊 6：§補施工清單入口（新節）與 §交棒 state

- 入口只做三件事：Read spec → 改寫 `## 施工清單`（仍 ≤8 列）→ 同一顆 gate 只問這張表 → 交棒 execute-plan。明講「把 user 拉回 0a 重問 Track / Tier 是錯的」
- state 新增 `plan_path: <path | null>`（T1 / T2 為 null）與 `review_perspectives: [...]`（T3 才有）
- Red Flags 加一列：「T2 也寫個 plan.md 比較保險」→ 走回舊 lane

### 關聯檔案

- 施工清單的消費端：`skills/execute-plan/SKILL.md` 第 1 步、`skills/dispatch-parallel/SKILL.md` 派工範本
- 補清單入口的呼叫端：execute-plan §Task fail、dispatch-parallel §失敗處置、verify-done §Verify fail、dev-workflow §Fail handling
- 3.5 的回流來源：`skills/design-direction/SKILL.md` 下游（T2 分支）
- `state.review_perspectives` 的讀取端：`skills/review-plan/SKILL.md` 契約第 2 步
- 被 P9b 守：裸標題兩個、gate 選單含「進 execute-plan」

---

## `skills/execute-plan/SKILL.md`

### 改動意圖

對應 spec 第 1 條，施工清單的**消費端**。spec 風險段第一條就是「兩端契約要同時改，漏一邊 T2 就卡住」，所以 plan 把它跟 brainstorm 放同一個 Task 3。

### 改動詳解

#### 區塊 1：契約第 1 步——task 來源分流

```diff
-1. **讀 plan**：從 hand-off state 取 `plan_path`、Read 全文。
+1. **讀 task 來源**：`plan_path` 有值（T3）→ Read plan.md。`plan_path` 為 null → Read `spec_path`：T2 取標題行**恰為** `## 施工清單` 的那張表、每列一個 task（`group` = parallel-group、「怎麼驗」= verify command）；T1 依 success criteria 自拆 1-3 個 task。T2 的 spec 沒這段、或超過 8 列 → 交棒 brainstorm §補施工清單入口（超過 8 列要回 0d 升 T3），不自己編。
+   載入時宣告一句給 user 看：「Tier=T2：依 rules.md §Tier 表不寫 plan.md、不跑 review-plan；task 來源 = spec §施工清單（N 列）」。
```

- 欄位映射寫死：`group` 欄 → parallel-group、「怎麼驗」欄 → verify command。這是表格能取代 plan.md 的關鍵——plan 的每 task 五步裡，紅（測試）就是「怎麼驗」、綠（實作）就是「做什麼」
- 「沒這段、或超過 8 列 → 交棒補清單入口，不自己編」：code review 除錯 m3 指出原本「>8 列升 T3」只寫在 brainstorm，execute-plan 不查列數，補這句讓消費端也守上限
- 宣告句（review C2）：讓 user 在施工開始那一刻就知道「這次沒有 plan 階段」，不會事後問「plan 在哪」

#### 區塊 2：§Task 推進規則第 2 步

T3 讀「task 5 個 step」；T2 讀「施工清單那一列」，五步由 tdd-cycle 現場展開。補一句「『怎麼驗』是目測依據時以截圖 / 引文代替 output」——本 repo 很多改動是 markdown 文字，verify command 不一定是可跑的指令。

#### 區塊 3：§前端檔處理第 4 步——大改落檔分流

```diff
-**大改才另外回寫 `plan.md`**（在該 task 底下追加 `轉進紀錄`）
+**大改才另外落檔**（T3 在 `plan.md` 該 task 底下追加 `轉進紀錄`；T1 / T2 追加到 spec 的 `## 施工紀錄`）
```

code review 架構 M3：中途轉進的紀錄原本只有 plan.md 一個落點，T1 / T2 沒 plan.md 會無處可寫。

#### 區塊 4：§Task fail 處置——退回分流

「退到 write-plan 重寫 plan」→「退到 write-plan（T3）／ 交棒 brainstorm §補施工清單入口（T2）」，判準句「把 plan 改對，這件事就對了嗎？」同步加 T2 分支。這句與 review-plan §User gate、verify-done §Verify fail 三處刻意同一套，所以三處都改。

#### 區塊 5：T2 施工紀錄落點

§Task 推進規則末尾加：「對齊檢查結果與依據、執行偏差、實際產出，追加寫進 spec 的 `## 施工紀錄` 段並 commit——squash 後這是唯一留下的施工帳本」。

### 關聯檔案

- 讀 `skills/brainstorm/SKILL.md` 產的 `## 施工清單`（標題精確比對）
- 遇同 group 多列 → 載 `skills/dispatch-parallel/SKILL.md`，該檔派工範本已改成貼施工清單全表
- fail 退回 → `skills/brainstorm/SKILL.md` §補施工清單入口
- 被 P9b 守：`恰為\*{0,2} \`## 施工清單\``（`\*{0,2}` 是 commit 71d53c0 補的，容忍「恰為」前後的粗體標記）、`plan_path.*null`、含「施工紀錄」

---

## `skills/request-review/SKILL.md`

### 改動意圖

對應 spec 第 2 條。原本 T2 開三個 reviewer（綜合 + lang-reviewer）、T3 開三到四個（綜合 + 架構 + 除錯 + lang-reviewer），全部讀同一份 diff。superpowers v6.0.0 已把雙 reviewer 合一；本 PR 把語言 idiom 從「獨立 agent」降級為「prompt 內一段提示」。

### 改動詳解

#### 區塊 1：刪 lang-reviewer dispatch 段（-44 行）、新增 §語言提示表

```diff
-### lang-reviewer dispatch
-依改動副檔名選 language tag、spawn 單一 `lang-reviewer` agent...
-| 副檔名 | language tag |
-| `.py` | python |
...
+### §語言提示（寫進 reviewer prompt，不另開 agent）
+依改動副檔名組一段貼進每個 reviewer 的 prompt，格式「本 diff 含 <語言>，請特別看：<提示>」，多語言多列：
+| 副檔名 | 提示 |
+| `.py` | mutable default arg、裸 except、f-string 拼 SQL、type hint 與實際回傳不符 |
+| `.ts .tsx .js .jsx .mjs` | `==` 與 truthy 比較、未 await 的 promise、regex 對 CRLF、`any` 逃逸 |
...
```

- 舊表是「副檔名 → language tag」再由 agent 內部查 §語言檢查焦點；新表直接把焦點內容攤在這裡，省掉一層間接與一個 agent context
- 「regex 對 CRLF」這條是本 PR 自己踩過的（plan Task 8 執行偏差 (2)：request-review 是 CRLF 檔，`.*\n` 要寫 `.*\r?\n`），寫進提示避免下次 reviewer 漏看
- 保留一句「SQL 涉 schema / migration 時 security-audit 另派 db-reviewer」——那條深度 review 沒被砍

#### 區塊 2：T2 prompt 的 task 來源 + `{語言提示}` 佔位

```diff
-- plan: <plan 內容>
+- task 來源: <T2 = spec §施工清單；T3 = plan 內容>
+{語言提示}
```

P9c 守 `!/plan: <plan 內容>/`——T2 沒有 plan，prompt 還寫「plan: <plan 內容>」會讓主 agent 去找不存在的檔。

#### 區塊 3：§T3 雙視角——不再疊在 T2 之上

```diff
-T2 全部 + **再 spawn 一個 subagent**：
+spawn 視角 A 與 B 兩個 subagent，不另開綜合 reviewer；兩個 prompt 都附 §語言提示：
```

視角 A 的 prompt 補 spec / plan 與一題「實作範圍與 spec / plan 一致嗎？有遺漏 / 過量嗎？（T3 沒有綜合 reviewer，這題只有你看）」；視角 B 補 spec。這是 code review 架構 M2 的發現：T3 原本三個 prompt 只給 diff 不給 spec，「符合 spec」這件事在 T3 反而沒人看，比 T2 還少。

#### 區塊 4：整合範本與 Red Flags

- Reviewers 行 `<self | 綜合 reviewer | 架構 + 除錯>`，刪 `lang-reviewer(<lang>)` 列
- Red Flags 刪兩列（lang-reviewer 相關）、加一列「多開一個 lang-reviewer 比較保險 → 三個 reviewer 讀同一份 diff 是浪費，user 顯式要才派」

### 關聯檔案

- `agents/lang-reviewer.md` description 同步改「不自動派發」
- `skills/dev-workflow/SKILL.md` Phase 5 三行、跨流程表 lang-reviewer 列、Trace 範例
- `docs/js/data.js` 刪 `LangAgent` 節點與 `RevT2/RevT3 → LangAgent → LoadRecv` 三邊，改 `RevT2/RevT3 → LoadRecv` 直連
- 被 P9c 守：無 `subagent_type[:=] lang-reviewer`（commit 6550ac3 加 `\s*[:=]\s*\`?` 變體）、有「§語言提示」、無「plan: <plan 內容>」

---

## `skills/review-plan/SKILL.md`

### 改動意圖

對應 spec 第 1、9 條。兩件事：T2 不再進來（-57 行裡大半是刪 T2 分支與 CEO 視角 prompt）；T3 視角從固定四個改成依 `state.review_perspectives` 1-3 個。

### 改動詳解

#### 區塊 1：契約第 2 步——只讀不判

```diff
-2. **依 tier 決定視角數**：T2 → Eng-only 1 視角；T3 → CEO + Design + Eng + DX 4 視角
+2. **讀 `state.review_perspectives`**（brainstorm 0b 依改動面向判...）。命中幾個派幾個，Eng 是下限；state 沒這欄 → 依 rules.md §Tier 機制自判並回寫。「該不該做」不在這裡問，那是 brainstorm 的事。
-**禁止跳階**：T2 不能跳 Eng review；T3 不能少視角。
+**禁止跳階**：state 標了的視角不能少；T2 進了本 skill 就是路徑錯，回報並交棒 execute-plan（user 顯式呼叫例外：照 user 指定的視角跑）。
```

- 「state 沒這欄 → 自判並回寫」是 fallback：context-resume 從舊 snapshot 接回來時可能沒這欄
- 「user 顯式呼叫例外」是 code review 除錯 m4 補的：frontmatter 寫「亦可由使用者顯式呼叫」，守門若無條件回彈會讓顯式呼叫也被彈走

#### 區塊 2：刪 CEO 視角 prompt（-34 行）

整段 `### 視角 1：CEO（策略）` 刪除。spec 第 9 條的依據：對「改規則書 / skill prompt」這種標的，CEO 視角只能複述 brainstorm 已定的決策（本 PR 自己的 plan review 派出 CEO 後 user 中途停掉，就是實證）。「MVP / 縮 scope」的功能由 brainstorm self-review 的「scope 太大 → 拆」承接。

#### 區塊 3：三個視角 prompt 改標「何時用」

- `視角 2：Design — T3 only` → `視角 Design（介面 / 契約）— 跨模組契約 / 對外介面時`
- `視角 3：Eng — T2 + T3` → `視角 Eng（架構 / 技術風險）— 必派（下限）`；回報格式的完整範本搬到這裡（原本在 CEO 段，其他視角「同 CEO 視角」，CEO 刪了要換錨點）
- `視角 4：DX — T3 only` → `視角 DX（開發者體驗）— 有人要讀的東西時`
- 第 2 段「下面四個視角」→「三個視角」

#### 區塊 4：整合範本、state、Trace、Red Flags

- 總結範本 `Tier: T3`、視角行改「依 state.review_perspectives，例 Eng + DX」、刪 CEO 區塊
- state `review_perspectives: [...]  # 來自 brainstorm 0b，本 skill 只讀`
- Trace 範例 `Tier=T3`
- Red Flags 兩列反轉：「T2 不需要 review」→「T2 進來了就順便審 → T2 不進本 skill」；「4 視角只跑 2 個」→「視角少一個沒差 → 少一個就是那個面向沒人看」

### 關聯檔案

- 讀 `state.review_perspectives`，由 `skills/brainstorm/SKILL.md` 0b 第 6 點寫入
- 上游 `skills/write-plan/SKILL.md` 交棒段同步改「視角依 state.review_perspectives」
- `docs/js/data.js` RPT3 label「T3：依改動面向 1-3 視角」、`docs/index.html` 規劃 beat 文案
- 被 P9h 守：無 `T2.*Eng-only` / `T2 不能跳` / `T2 仍需`、有「依改動面向」或「命中幾個派幾個」、全檔無 `CEO`

---

## `skills/dev-workflow/SKILL.md`

### 改動意圖

routing 真相（plan Architecture：「routing 真相 = dev-workflow」）。三個 Phase 的路徑圖要跟 Tier 表對齊；review DX M3 抓到 plan v1 的替換錨點指錯行，v2 改成給 `1.` 到 `3.` 之間完整區塊。

### 改動詳解

#### 區塊 1：Phase 0 圖尾（`:44`）

```diff
-若 T1+ → 進階段 2 起跑
+若 T1 / T2 → 進階段 3（execute-plan；T2 的 task 來源 = spec §施工清單）
+若 T3 → 進階段 2（write-plan）
```

code review 架構 M1：Phase 0 圖尾是 Claude 從 brainstorm 出來後第一眼看到的路徑，這行沒改等於 T2 還是會被送去 write-plan。

#### 區塊 2：Dev track 路徑圖 1→3 完整替換

設計三行分 T3 / T2 出口（T2 → brainstorm 3.5 回寫清單）；Phase 2 整段從「所有 T1+ 都走 write-plan → review-plan（T2 Eng / T3 四視角）」改成「T1 / T2 → 3. execute-plan；T3 → 2. write-plan → review-plan（視角依 state.review_perspectives）」。

#### 區塊 3：Phase 5 / Phase 8 / state schema / Trace / 跨流程表 / §Fail handling

- Phase 5：`T2 = 1 subagent（prompt 附語言提示）`、`T3 = 雙視角 subagent（架構 × 除錯，各附語言提示）`
- Phase 8：`pr-explain（T3；T0-T2 跳）`
- state schema：`plan_path: <path | null>`、`parallel_groups` 註明「T3 來自 plan、T2 來自 spec 施工清單 group 欄」、新增 `review_perspectives`
- Trace 範例拿掉 `+lang-reviewer`（P9c 守 `!/\+\s*lang-reviewer/`）
- 跨流程表 lang-reviewer 列：「user 顯式要求時由主 agent spawn；request-review 不自動派」
- §Fail handling「回上層 Phase 重規劃」加 T2 分支：「T3 回 write-plan；T2 交棒 brainstorm §補施工清單入口（不重跑 Phase 0）；需求理解就錯才回 brainstorm 0a」

### 關聯檔案

- 被 `skills/devwork/SKILL.md` 載入（`/devwork` 入口）
- state schema 的 `plan_path | null` 與 `skills/context-snapshot/SKILL.md`、`skills/context-resume/SKILL.md`、`skills/brainstorm/SKILL.md` §交棒 四處一致

---

## `skills/receive-review/SKILL.md`

### 改動意圖

對應 spec 第 4 條。PR #61 實測 8 顆 review fix commit 在 squash merge 時全部消失——原本「每 finding 一顆 commit 保 bisect-able」的理由在 GitHub Flow squash 策略下不成立（rules.md §GitHub Flow 規定 squash merge）。

### 改動詳解

```diff
-對每個 finding：1. 寫 fix code 2. commit 3. 印 diff 4. 繼續下個 finding
+對全部不危險 finding：
+1. 逐條寫 fix（可一次改完）
+2. 跑該 tier 的 verify（契約 / test）
+3. **一顆 commit**：`fix: 處理 review finding（N 項）`，body 逐項列「finding 簡述 → 怎麼修」
+4. 印 `git diff HEAD~1` 給 user 看，不需 user 點頭
```

- 第 2 步「跑 verify」是新增的：舊流程每 finding 各 commit，verify 隱含在每次 commit 前；合成一顆後要明講在 commit 前跑一次
- Red Flags 末列反轉：「全 fix 完一次 commit 就好」（舊：錯）→「每 finding 一顆 commit 才好 bisect」（新：錯，squash 後只剩 PR title，bisect 不到；一顆 commit 的 body 列 finding 資訊等價）
- 危險類仍逐項 AskUserQuestion、T3 仍先整個 diff 給 user 看——這兩條沒動
- 本 PR 自己的 commit `6550ac3 fix: 處理 review finding（16 項）` 就是這條新規則的第一次執行

### 關聯檔案

- 被 P9e 守：有「處理 review finding」「一顆 commit」、無「每 finding fix 一個 commit」

---

## `skills/finish-branch/SKILL.md`、`skills/pr-explain/SKILL.md`

### 改動意圖

對應 spec 第 3 條。pr-explain 的產出（這份文件）對 T2 是純成本——PR body 模板已含動機 / 改動 / 測試 / 風險，reviewer 需要的 context 都在。

### 改動詳解

- finish-branch 契約第 6 步：`印 PR URL + 交棒 pr-explain` → `印 PR URL。T3 → 交棒 pr-explain；T0-T2 → 到此為止、等 user merge（PR body 已含動機 / 改動 / 測試，pr-explain 對這個量體是純成本）`
- finish-branch §PR body 模板 Refs：`plan: <plan.md（T3）| N/A（T2 施工清單在 spec）>`——T2 沒有 plan.md，模板寫死路徑會產生指向不存在檔案的連結
- finish-branch §hand-off 下一 phase：`T3 → pr-explain；T0-T2 → 無（等 merge；merge 後做 §Merge 後：docs 歸檔）`
- pr-explain description：`載入：dev-workflow Phase 8（**T3** finish-branch 開好 PR 後）；T0-T2 不自動跑，user 顯式呼叫可`。`context: fork` / `agent: pr-explainer` 不動——顯式 `/bstack:pr-explain` 仍走同一條路

### 關聯檔案

- `docs/js/data.js` 加 `PushPR → MergeGate` 邊（T0-T2：PR 開好即停）
- 被 P9d 守：finish-branch 有「T3 → 交棒 pr-explain」「N/A（T2」、pr-explain description 含「T3」

---

## `skills/write-plan/SKILL.md`

### 改動意圖

T3 only。review Major 1 抓到 `:202` `:210` 兩處「T2 = Eng-only 視角」殘留。

### 改動詳解

- description：`載入：dev-workflow Phase 2（**T3 only**；...T2 的施工清單在 spec 內，不進本 skill）`
- 前提補守門：`state.tier 不是 T3 且不是 user 顯式呼叫 → 回報「T1 / T2 不進 write-plan」並交棒 execute-plan，不寫 plan.md`。「user 顯式呼叫」例外同 review-plan（code review 除錯 m4）
- 交棒段：兩列 Tier 視角對照 → 一句「視角依 `state.review_perspectives`」
- Trace 範例 `Tier=T3`

### 關聯檔案

- 被 P9h 守：無 `Eng-only`
- 守門回彈到 `skills/execute-plan/SKILL.md`；dispatch-parallel 的 fail 選項若仍寫「退 write-plan」，T2 會被這裡彈回 execute-plan 形成迴圈（code review 除錯 M1）——所以 dispatch-parallel 同步改

---

## `skills/dispatch-parallel/SKILL.md`

### 改動意圖

review Design M7：整支 skill 以「plan.md Task N section」為單位——派工 prompt 貼 plan 全文、subagent 流程「Read plan 找 Task N」、失敗選項「退 write-plan」。T2 同 group 多列進來會找不到 plan。

### 改動詳解

- 契約第 1 步：task 來源分 `plan Task N section（T3）／ spec ## 施工清單 第 N 列（T2）`
- 第 2 步：「group 內 task 真的無依賴」加註「T3 由 write-plan 標、T2 由 brainstorm 施工清單標；這裡是 T2 唯一一次驗」——T2 沒有 review-plan 幫忙看 group 標對不對，dispatch-parallel 是最後一道
- 隊友派工範本與 subagent 派工範本：`plan 全文` → `task 來源: <T3 貼 plan 全文；T2 貼 spec ## 施工清單 全表>`；subagent 流程第 1 步分 T3 / T2
- §整合衝突案例（`:212`）與 §失敗處置退回選項：加 T2 分流「交棒 brainstorm §補施工清單入口」

### 關聯檔案

- 被 P9i 守：含「施工清單」、無 `退 write-plan** 改 parallel-group 標$`、無 `→ 退 write-plan$`（commit 6550ac3 加的第二條）
- `docs/js/data.js` 加 `TaskFail → BS` dashed 邊（T2 補清單路）

---

## `skills/design-direction/SKILL.md`

### 改動意圖

review C1 的另一端：design-direction 定案後的下游原本只有 write-plan，T2 沒有 write-plan 會斷路。

### 改動詳解

description 與 §與 dev-workflow 銜接 兩處下游：`write-plan` → `T3 → write-plan（依定案方向拆 task）；T2 → 回 brainstorm 3.5 依方向回寫 ## 施工清單 後交 execute-plan`。

plan Task 8 執行偏差 (3)：`:329` 那處「**下游**」帶粗體標記，Task 3 的 replace 沒命中，Task 7 人工掃 write-plan 提及處才抓到（commit 18c4c97）。P9i 之後改成數 `T2 → 回 \`brainstorm\`` 出現次數 === 2，兩處缺一就紅。

### 關聯檔案

- 回流到 `skills/brainstorm/SKILL.md` 契約 3.5 的 T2 分支
- `docs/js/data.js` 加 `UGDesign → LoadExec` 邊、`RerunCap → BS` label 補 T2

---

## `skills/verify-done/SKILL.md`、`skills/context-snapshot/SKILL.md`、`skills/context-resume/SKILL.md`、`skills/write-skill/SKILL.md`

### 改動意圖

四個檔各 1-4 行，全是「舊 lane 的殘留語意」清理（review Minor 與 code review Minor）。

### 改動詳解

- **verify-done** `:73`：fail 選項「退回 write-plan 改 plan」加 `（T3）／ 交棒 brainstorm §補施工清單入口（T2）`——與 execute-plan §Task fail、review-plan §User gate 三處同一套
- **context-snapshot** `:51`：`plan_path: <path | null>   # T1 / T2 為 null`；`:84` 決策紀錄範例「review-plan 4 視角 finding」→「review-plan（視角依 state.review_perspectives）finding」（P9h 守 `!/4 視角/`）
- **context-resume** `:84`：`plan_path: <from snapshot | null>   # T1 / T2 為 null，別因此判 snapshot 壞掉`——resume 時看到 null 若當成 snapshot 損毀會誤報
- **write-skill** `:124-129`：「範例好的 description」引用的是 execute-plan 的 description，舊版寫「T1 由 brainstorm 直接交棒」；換成現行版本，否則 meta skill 教人寫的範例本身就是過時的（P9h 守 `!/T1 由 brainstorm 直接交棒/`）

---

## `agents/lang-reviewer.md`、`README.md`

### 改動意圖

對外說法同步。agent description 是 Claude Code 決定「何時派這個 agent」的依據，寫「動態 dispatch」等於告訴主 agent 可以自動派。

### 改動詳解

- **lang-reviewer.md** description：首句「動態 dispatch：主 dispatcher 在 spawn 時…」→「由主 agent 在 spawn 時於 prompt 標 language…」；末句「載入：…依改動副檔名由主 agent 動態 spawn」→「載入：request-review 不自動派發；user 顯式要求『用 lang-reviewer 看 <語言>』時由主 agent spawn」。agent body（§語言檢查焦點各段）不動，顯式呼叫時功能完整
- **README.md**：`:5` 簡介「PR 自動解釋落檔」→「T3 PR 自動解釋落檔」；brainstorm 列加「T2 會順手列一張施工清單、不另寫計畫」；write-plan / review-plan 列標「T3 才寫 / T3 才跑」；pr-explain 列「T3 才自動跑…其他 tier 你點名才跑」；lang-reviewer 列「你點名才派的語言專家…平常 review 時語言重點已經寫進 reviewer 的指示裡」（review DX m4：「reviewer prompt」是行話，README 面向使用者改白話）

### 關聯檔案

- 被 P9f 守：description 無 `動態 (spawn|dispatch)`、有「顯式」
- 被 P9g 守：README lang-reviewer 列無「自動派發」、簡介含「T3 PR 自動解釋」
- 被 P8 守：README skill 計數不變（28）

---

## `scripts/plugin-contract.mjs`

### 改動意圖

對應 spec 第 7、8 條與 plan Task 1（TDD 先紅：commit 20bfedd 先加 P9a-i 對現況 7 FAIL，Task 2-7 逐條轉綠）。lane 定義散在 rules / 9 個 skill / 1 個 agent / README / landing，任一處留舊敘述 Claude 在那一步就照舊做——所以每條 check 同時驗「新句在」與「舊句不在」。

### 改動詳解

九條 check，每條訊息尾附「後果 + 改處」（review DX M6：對齊 P8 風格，紅了直接告訴人去哪改）：

| 條 | 守什麼 | 關鍵 regex |
|---|---|---|
| P9a | rules.md §Tier 表 T2 / T3 列、表頭 pr-explain 欄、無「T2-T3 詳」 | `/^\| \*\*T2\*\*.*$/m` 抓整列再驗子字串 |
| P9b | brainstorm 兩個裸標題、gate 選單指 execute-plan；execute-plan 精確比對、`plan_path` null、施工紀錄 | `/^## 施工清單$/m`、`/恰為\*{0,2} \`## 施工清單\`/` |
| P9c | request-review 無自動派 lang-reviewer、有 §語言提示、無「plan: <plan 內容>」；dev-workflow 無「+ lang-reviewer」 | `/subagent_type\s*[:=]\s*\`?lang-reviewer/` |
| P9d | finish-branch T3 才交棒、PR body N/A；pr-explain description 含 T3 | |
| P9e | receive-review 一顆 commit、無舊句 | |
| P9f | lang-reviewer.md description 無「動態 spawn / dispatch」、有「顯式」 | |
| P9g | README lang-reviewer 列、簡介 T3 | |
| P9h | review-plan 無 T2 分支 / 有依面向 / 無 CEO；write-plan 無 Eng-only；context-snapshot 無「4 視角」；write-skill 無舊範例 | |
| P9i | design-direction 兩處 T2 下游；dispatch-parallel 含施工清單、無「→ 退 write-plan」 | `(ddMd.match(/T2 → 回 \`brainstorm\`/g) \|\| []).length === 2` |

- 全部用 `^…$` 配 `m` 旗標對 CRLF 檔行為正確（review Eng 實測：`$` 把 `\r` 當行終止）
- P9b 的 `\*{0,2}` 是 commit 71d53c0 補的：execute-plan 那句寫成 `**恰為** \`## 施工清單\``，粗體標記讓原 regex 沒命中
- P9c 的 `\s*[:=]\s*\`?` 與 P9i 的第二條 `!/→ 退 write-plan$/m` 是 commit 6550ac3 依 code review 收緊的（原 P9i 用 `/T2/.test(ddMd)` 恆綠）

### 關聯檔案

- 讀 `skills/devwork/rules.md`、9 個 skill、`agents/lang-reviewer.md`、`README.md`
- 由 `rd()` / `frontmatter()` / `description()` 既有 helper 讀檔，沒加新 helper
- 跑法 `node scripts/plugin-contract.mjs`；沒有 hook / CI 呼叫它，中途紅不擋 commit（review Eng 實測確認）

---

## `docs/tools/docs-site-contract.mjs`

### 改動意圖

流程圖節點數變動牽動三條契約：C6a（baseline 節點 key）、C8a（節點 / 邊 / phase / type 數）、以及新增的 C19e（landing 資料屬性）。

### 改動詳解

#### 區塊 1：C6a BASELINE_KEYS 拿掉 `'RPT2'`

review Eng Major 8：C6a 驗 NODE_DOCS 的 key 集合，RPT2 條目刪了基準不改就紅。`LangAgent` 保留在基準——它雖然不在圖上，NODE_DOCS 條目還在（見 app.js 段）。

#### 區塊 2：C8a EXPECT 99 / 136 → 96 / 135、標籤改 template literal

```diff
-const EXPECT = { nodes: 99, edges: 136, phases: 15, types: 8 };
-check('C8a 資料契約 99 nodes / 136 edges / 15 phases / 8 types', ...
+const EXPECT = { nodes: 96, edges: 135, phases: 15, types: 8 };
+check(`C8a 資料契約 ${EXPECT.nodes} nodes / ${EXPECT.edges} edges / ...`, ...
```

- 節點：刪 RPSplit / RPT2 / LangAgent = -3
- 邊：刪 7（LoadRP→RPSplit、RPSplit→RPT2、RPSplit→RPT3、RPT2→UG1、RevT2→LangAgent、RevT3→LangAgent、LangAgent→LoadRecv）、加 6（LoadRP→RPT3、RevT2→LoadRecv、RevT3→LoadRecv、UGDesign→LoadExec、PushPR→MergeGate、TaskFail→BS）= -1。plan 寫 134 是因為 `TaskFail → BS` 是 code review 架構 m7 補的（label 說有 T2 補清單路卻沒有邊）
- 標籤改 template literal（review Eng Minor 1）：舊標籤寫死數字，改 EXPECT 時標籤不會跟著變，紅了訊息還說「99 nodes」

#### 區塊 3：新增 C19e

```js
const beatAttrs = [...landingHtml.matchAll(/id="(b\d)" data-upto="(\d+)" data-nodes="([^"]+)"/g)]
  .map((m) => ({ beat: m[1], upto: Number(m[2]), ids: m[3].split(',') }));
const badIds = beatAttrs.flatMap((b) => b.ids.filter((id) => !FD.nodes[id]).map(...));
const uptoOk = beatAttrs.every((b, i) => b.upto < nodeCount && (i === 0 || b.upto > beatAttrs[i - 1].upto));
```

- 守兩件事：`data-nodes` 的每個 id 都在 `FD.nodes`（landing.js:149 找不到會**靜默跳過**，id 打錯沒有任何錯誤訊息）；`data-upto` 嚴格遞增且小於總節點數（等於總數會讓進度條在最後一段就 100%，coda 段沒東西補）
- code review 架構 m6 的發現：這兩個值是手填的，本次刪三個節點時手算過一次，沒契約守下次再刪又要人工對
- `beatAttrs.length >= 7` 防 regex 沒抓到任何段時 `every` 對空陣列回 true 的假綠

### 關聯檔案

- 讀 `docs/js/data.js`（`FD`）、`docs/index.html`（`landingHtml`）、`docs/js/app.js`（NODE_DOCS）
- 跑法 `node docs/tools/docs-site-contract.mjs`

---

## `docs/js/data.js`

### 改動意圖

對應 spec 第 6 條。流程圖是 docs 站（公開 GitHub Pages）對外的流程真相，節點 / 邊要跟 skill 一致。

### 改動詳解

#### 區塊 1：刪三節點

- `RPSplit`（review-plan 依 Tier 分視角的菱形）：T2 不進 review-plan 後只剩 T3 一條路，分流節點沒意義
- `RPT2`（T2 Eng-only review）
- `LangAgent`（派 lang-reviewer）：不自動派就不在主流程圖上；NODE_DOCS 條目保留給索引面板

#### 區塊 2：邊的重接

```diff
-['TrackSplit', 'LoadExec', 'Dev + T1\n跳 Phase 2（rules.md §Tier：plan 跳）', 'solid'],
-['TrackSplit', 'LoadWP',   'Dev + T2 / T3', 'solid'],
+['TrackSplit', 'LoadExec', 'Dev + T1 / T2\n跳 Phase 2（T2 的 task 來源 = spec §施工清單）', 'solid'],
+['TrackSplit', 'LoadWP',   'Dev + T3', 'solid'],
-['LoadRP', 'RPSplit', ...], ['RPSplit', 'RPT2', 'T2'], ['RPSplit', 'RPT3', 'T3'], ['RPT2', 'UG1', ''],
+['LoadRP', 'RPT3', '', 'solid'],
-['RevT2', 'LangAgent', ''], ['RevT3', 'LangAgent', ''], ['LangAgent', 'LoadRecv', ''],
+['RevT2', 'LoadRecv', ''], ['RevT3', 'LoadRecv', ''],
+['UGDesign', 'LoadExec', 'T2：回寫施工清單、再確認 → execute-plan', 'solid'],
+['PushPR', 'MergeGate', 'T0-T2：PR 開好即停，等 user merge', 'solid'],
+['TaskFail', 'BS', 'T2：交棒 brainstorm §補施工清單入口', 'dashed'],
```

- `TrackSplit → LoadWP` 有**兩條**邊（一般路徑與設計 lane「跳過三方向」那條），plan Task 8 執行偏差 (4)：先改設計 lane 那條再改一般那條，否則 replace 命中錯邊
- `UGDesign → LoadExec` 對應 review C1：T2 大改定案後不經 write-plan
- `PushPR → MergeGate` 對應 finish-branch 第 6 步：T0-T2 開完 PR 即停
- `TaskFail → BS` dashed：T2 補清單路，與 `TaskFail → LoadWP`（T3）並列

#### 區塊 3：label 標 Tier

九個 label 改動：phase_plan / phase_pr 加「（T3）」；WritePlan、LoadPrEx 加「（T3）」；RPT3「T3：依改動面向 1-3 視角」；RevT2 / RevT3 拿掉 lang-reviewer；TaskFail / VerifyFail 退回選項分 T3 / T2；RerunCap→BS、VerifyFail→BS 加 T2 說明；`SpecGate` 順手修掉「brainstorm 目前用自由文字問，非 AskUserQuestion」——這句早已漂移（brainstorm 用 AskUserQuestion 很久了）；ambient §Tier 機制 desc 加 pr-explain

### 關聯檔案

- 被 `docs/tools/docs-site-contract.mjs` C8a（96 / 135）、C8c / C8g、C19e 守
- 被 `docs/js/app.js` NODE_DOCS 對照（RPT3 條目）
- 被 `docs/index.html` `data-nodes` 引用（b3 的 RPT3、b5 的 RevT2 / RevT3）
- 被 `docs/js/landing.js` 依 `data-upto` 逐段長出節點鏈

---

## `docs/js/app.js`

### 改動意圖

NODE_DOCS 是「圖上節點 → 內嵌文件」的索引；RPT2 節點刪了條目要跟著刪，LangAgent 則**刻意保留**。

### 改動詳解

```diff
+  // LangAgent 2026-09-04 起不在圖上（request-review 不自動派 lang-reviewer），
+  // 條目保留給文件索引面板——它是 lang-reviewer 文件唯一的入口，刪了 C18 會紅。
   LangAgent: {p:'agents/lang-reviewer', ...},
-  RPT2: {p:'skills/review-plan', n:'review-plan (T2 Eng-only)', k:'skill'},
-  RPT3: {p:'skills/review-plan', n:'review-plan (T3 四視角)', k:'skill'}
+  RPT3: {p:'skills/review-plan', n:'review-plan (T3 依面向 1-3 視角)', k:'skill'}
```

- review Eng Major 8 的關鍵發現：C18 驗「每份內嵌文件至少有一個 NODE_DOCS 入口」，LangAgent 是 lang-reviewer.md 唯一的入口，刪了 C18 紅、且索引面板從此點不開 lang-reviewer 文件。code review 除錯視角確認 app.js 對「NODE_DOCS 有 key 但圖上無節點」全部有 fallback、不 throw
- 兩處註解數字：「37 個 key 對應 35 個相異文件」→「35 / 34」、「灌成 30」→「29」（lang-reviewer m1 / m2）。這些註解解釋 DOC_COUNTS 為什麼要依路徑去重，數字錯會誤導下次改的人

### 關聯檔案

- 被 C6a（BASELINE_KEYS）、C18 守
- 讀 `docs/js/references-data.js` 的 key

---

## `docs/index.html`

### 改動意圖

landing 是公開站，文案要跟新 lane 一致；節點鏈的 `data-upto` / `data-nodes` 要跟 data.js 對齊。**只改文字節點與資料屬性**，不碰 class / style / 版面——rules.md §設計語言對齊 的豁免條款適用（plan Task 8 以屬性集合比對確認：只有 `data-upto` ×4 與 `data-nodes` ×1 變動）。

### 改動詳解

#### 區塊 1：節點數 99 → 96（`:68` hero stat、`:145` deck 計數）

#### 區塊 2：`data-upto` 四段遞減

| 段 | 舊 | 新 | 理由 |
|---|---|---|---|
| b3 規劃 | 38 | 36 | 其前刪 RPSplit / RPT2（2 個） |
| b4 施工 | 55 | 53 | 同上 |
| b5 審查 | 75 | 72 | 再刪 LangAgent（3 個） |
| b7 留痕 | 96 | 93 | 同上；**不能等於 96**，否則進度條在最後一段就 100% |

review Design M4 / Eng Major 1：plan v1 以為 `data-upto` 是節點索引、「不相等就停」會卡死；實測它是手填的累計進度數，正確做法是「舊值減去其前被刪節點數」。

#### 區塊 3：b5 `data-nodes`

`LoadReq,RevT3,LangAgent,AutoFixQ` → `LoadReq,RevT2,RevT3,AutoFixQ`——LangAgent 不在圖上會被 landing.js 靜默跳過，鏈少一格沒人發現；補 RevT2 讓審查段仍是四格。

#### 區塊 4：三段文案（純文字節點）

- **規劃 beat** h2「拆給四個人看」→「拆給別人看」；段落從列舉四視角改成「看改動碰到什麼就派誰看：有機械可驗的東西派工程視角，有人要讀的派接手者視角，跨模組的契約派介面視角。該不該做、做多大，在計畫之前就問過你了」——不寫死數字，且把「CEO 移除」的理由用白話說出來
- **審查 beat**：`lang-reviewer` 「依改的檔自動派發」→「你點名才派…（平常的 review 已把語言提示寫進 reviewer 的 prompt）」；保持「六個 agent 各有專責」的並列節奏（review DX m5）
- **留痕 beat**：「PR 開完之後還有一個 agent 重讀一次 diff」→「T3 的 PR 開完之後…」

### 關聯檔案

- 被 `docs/js/landing.js` 讀 `data-upto` / `data-nodes`
- 被 C19e、C8g（節點數兩處）、P8（skill 計數 28 不變）守
- 從 `main:/docs` 自動發布，merge 即上線、無預覽環境

---

## `docs/js/references-data.js`

### 改動意圖

docs 站的文件索引面板內嵌 rules.md / 全部 skill / agent 全文；skill 改了這裡要重產，否則 C8b / C18 紅（內嵌與磁碟不一致）。

### 改動詳解

`pwsh -File scripts/build-references.ps1` 重產，17 個條目（rules.md + 13 skill + lang-reviewer + 2 個 description 有動的 skill）的字串值替換。不手改；`-Check` 模式 exit 0 確認與磁碟一致。plan Task 7 明訂「產出器必最後」——所有 skill 改完才重產一次，本 PR 實際重產兩次（4aed2a6 施工完、6550ac3 review fix 後）。

### 關聯檔案

- 產出自 `skills/**`、`agents/**`、`skills/devwork/rules.md`
- 被 `docs/js/app.js` NODE_DOCS 以 `docKey()` 組 key 查詢
- 被 C8b / C18 守

---

## `docs/work/refactor/t2-lane-slim/{spec,plan,review}.md`

### 改動意圖

本 branch 的施工文件，依 rules.md §Docs 落檔 放 `docs/work/<branch-name>/`，merge 後由 finish-branch 搬到 `docs/archive/2026/t2-lane-slim/`。

### 改動詳解

- **spec.md**（107 行）：9 條 success criteria；第 9 條（視角依改動面向、CEO 移除）是 plan review 期間追加的（commit 1021e79 → 9e68e17 兩輪），依據是本 PR 自己的 plan review 派出 CEO 後 user 中途停掉。§施工清單契約 段是給 brainstorm / execute-plan 兩端看的格式定義
- **plan.md**（463 行）：v2 依 review.md 重寫；8 個 task 串行（group 1→8），Task 1 契約先紅、Task 2-7 逐條轉綠、Task 8 landing 實測。末尾「Task 8 實測紀錄」記四項對齊檢查全 N/A 的依據與四條執行偏差
- **review.md**（109 行）：前半 plan review（Design + Eng + DX 三視角，按主題合併）——3 Critical / 12 Major / Minor 若干，全部落進 plan v2；後半 code review 總結（架構 × 除錯 + lang-reviewer）——0 Critical / 5 Major / 11 Minor，一顆 commit 6550ac3 修掉

---

## 全域 patterns / cross-cutting

### 1. 真相層級三層

plan Architecture 段定的：**lane 行為 = rules.md §Tier 表**（最高）→ **施工清單格式 = brainstorm §spec 文件結構** → **routing = dev-workflow**。其他 skill 只引用、不定義。這是為什麼 rules.md 表下多了「本表是 lane 的唯一真相；與任何 skill 衝突以本表為準」——沒這句 Claude 遇到矛盾會自己挑。

### 2. `plan_path` 允許 null 貫穿六處

brainstorm §交棒、dev-workflow state schema、execute-plan 契約第 1 步、context-snapshot、context-resume、finish-branch PR body 模板。null 是 T1 / T2 的正常值，不是錯誤——context-resume 特別註明「別因此判 snapshot 壞掉」。

### 3. 每個「退 write-plan」都拆成 T3 / T2 兩路

execute-plan §Task fail、verify-done §Verify fail、dispatch-parallel §失敗處置與 §整合衝突、dev-workflow §Fail handling、data.js 的 TaskFail / VerifyFail / RerunCap 邊——六處同一套措辭「退 write-plan（T3）／ 交棒 brainstorm §補施工清單入口（T2）」。少一處 T2 就會被 write-plan 守門彈回 execute-plan 形成迴圈（code review 除錯 M1 抓到 dispatch-parallel `:212` 漏改）。

### 4. 「新句在 + 舊句不在」雙向契約

P9a-i 每條同時驗兩件事。只驗新句會漏「舊敘述殘留」（review C3：plan v1 的 grep pattern 自己就含「自動派發」子字串必紅）；只驗舊句不在會漏「新句沒寫到」。舊句掃描 0 行之外，plan Task 7 另做一輪 `grep -rn write-plan` 逐處人工判「T2 仍會經過嗎」，結果記在 commit 4aed2a6 body（11 處皆為泛稱或 T3 語境）。

### 5. 精確比對取代前綴比對

`## 施工清單` 標題從三處字面不一致改成裸標題 + `^…$` 精確比對。教訓來自本 PR 的 spec 自己有「## 施工清單契約」段——前綴 grep 會把格式定義當成清單本體。

### 6. 本 PR 自己走舊規則

spec 風險段明講：規則在 merge 前不生效，本 PR 照 T3 完整流程跑（三視角 plan review、架構 × 除錯 + lang-reviewer code review、security-audit、pr-explain）。唯一例外是 receive-review 已提前採用「一顆 commit」（6550ac3），因為那條規則的檔已在本 branch 改好。

---

## 後續 follow-up

- [ ] 新 lane 第一次實戰：挑一個 T2 任務（PR body 建議「把 request-review 改接內建 `/code-review`」）驗證 brainstorm → 施工清單 → execute-plan 整條鏈
- [ ] merge 後 finish-branch 把 `docs/work/refactor/t2-lane-slim/` 搬到 `docs/archive/2026/t2-lane-slim/`，rules.md 表下那句「精簡依據見 docs/archive/2026/ 的 t2-lane-slim 主題」才對得上
- [ ] skill 文本瘦身（Red Flags 表、重複範本）→ spec 排除段已註明另開 `refactor/skill-text-slim`
- [ ] verify-done 的 T3 e2e 本次在主 context 用 Playwright 跑、沒開 frontend-e2e-runner（改動只有文字節點與資料屬性）；下次 T3 UI 改動應照 verify-done 規定派 agent
- [ ] `build-references.ps1 -Check` 沒有 hook / CI 呼叫，中途紅不擋 commit（review Eng 實測）；是否加進 pre-commit 或 CI 另議

---

## 安全 / PII 檢查

- secret / API key: 無。diff 內容為 markdown 規則、JS 資料檔、契約腳本；無 `.env` / `*.key` / credentials 類檔
- PII mask: N/A。diff 內無 email / phone / 身分證 / 地址。commit 作者 email 屬 git metadata、不在檔案內容
- file-type 硬規則命中: 無。未動 CI / CD、migration、鎖檔、Infra、shell config、ignore 檔
- 額外：`docs/index.html` 屬前端檔，本 PR 只改文字節點與 `data-*` 屬性，rules.md §設計語言對齊 豁免條款適用（plan Task 8 以屬性集合比對確認無 class / style / id / href 變動）
