# Plan review 總結

> Plan: docs/work/refactor/t2-lane-slim/plan.md
> Tier: T3
> 視角: Design + Eng + DX（CEO 派出後由 user 於 2026-09-04 停掉——標的是內部規則，產品決策已定，CEO 無事可審；這個決定本身進 spec 第 9 條）
> 日期: 2026-09-04

Eng 把 P9 程式碼與 Task 2-5 的新文字套進 scratchpad 副本實跑；Design 跑了 `data-upto` 腳本並讀 landing.js；DX 逐檔對照 plan 的改寫文字。三份互相印證的地方最多，下面按主題合併、不按視角。

## Critical 共識

**C1. T2 + 設計大改的路徑斷掉**（Design C1、Eng Major 4）
施工清單跟 spec 同一個 gate 確認，但 T2 大改是「spec gate → design-direction 選方向 → 回寫 spec → 交棒」，清單在方向定案**之前**就被點頭。design-direction 兩處下游仍寫 write-plan（`:10`、`:329`），dev-workflow `:80-81` 設計三行、data.js 三條邊（`:285` `:291` `:293`）也都指 write-plan。→ brainstorm 3.5 加「T2 走過三方向 → 依 `direction_decided` 回寫施工清單、只對這張表再 AskUserQuestion 一次」；design-direction / dev-workflow / data.js 三處分 T2 / T3 出口；data.js 加 `UGDesign → LoadExec`（邊數變 134）。

**C2. spec gate 選單仍寫「進 write-plan」**（DX C1、Design M1）
`brainstorm:231-237` 那顆 AskUserQuestion 是 T2 使用者唯一親眼看到的交棒文字，plan 沒改它，也沒改 description「終態 → 交棒 write-plan」。→ 選項改「spec（含施工清單）正確，進 execute-plan（T1 / T2）／ write-plan（T3）／ debug-systematic（Bug）」，題目明講 T2「這是最後一次看計畫」；execute-plan 載入時宣告一句「Tier=T2：不寫 plan.md、task 來源 = spec §施工清單（N 列）」。

**C3. Task 7 的 grep「0 行」必紅**（DX C2、Eng Major 2）
plan 自己在 rules.md / dev-workflow / lang-reviewer.md 寫進「不再自動派發」，含子字串「自動派發」。→ pattern 改抓舊句 `依改的檔自動派發|依改動副檔名.*dispatch|動態 spawn|subagent \+ lang-reviewer`，並加一輪 `grep -rn write-plan skills docs/index.html` 逐處人工判「T2 仍會經過嗎」。

## Major（去重後）

1. **review-plan / write-plan 內部殘留 10 處「T2 Eng-only」**（DX M1、Eng Major 3）：`review-plan:5,20,27,137,189,248,259,269`、`write-plan:202,210`。前提說 T2 不進、Red Flag 說 T2 不准跳。→ Task 5 逐行列新文字；P9 加 P9h 掃這兩檔。
2. **`data-upto` 語意推錯**（Design M4、Eng Major 1）：它是手填的累計進度數，七段跟索引全不相等；plan 的「不相等就停」會讓 Task 6 卡死。→ 定義為「舊值減去其前被刪節點數」：b3 38→36、b4 55→53、b5 75→72、b7 96→93（b7 不能等於總數，否則進度條在最後一段就 100%）。
3. **`## 施工清單` 標題三處字面不一致、前綴比對會誤中**（Design M2）：spec 範例帶括號、brainstorm 範本帶括號、execute-plan 與 P9b 前綴 grep；這份 spec 自己就有「## 施工清單契約」段會被命中。→ 標題固定裸 `## 施工清單`，指示移到範本下方；execute-plan 寫「標題行恰為」；P9b 改 `/^## 施工清單$/m`。
4. **dispatch-parallel 整支以 plan.md Task section 為單位**（Design M7）：T2 同 group 多列會撞（派工 prompt 貼 plan 全文、Read plan 找 Task N、fail 選項退 write-plan）。→ 派工範本改「task 來源：plan Task N（T3）/ spec 施工清單第 N 列（T2）」；brainstorm 規則加「T2 預設每列不同 group」。
5. **退回 brainstorm 補施工清單沒有入口**（DX M2）：brainstorm 載入即跑 Phase 0 五步，會把 user 拉回去重問 Track / Tier。→ brainstorm 加「補施工清單」入口：state 已有 `tier=T2` 且 `spec_path` 存在 → 只跑施工清單段 + 同一顆 gate。
6. **dev-workflow 路徑圖替換錨點錯**（DX M3、Eng Minor 8）：plan 說「`1. brainstorm` 下的三行」但那三行是 design 分流（`:79-82`），要換的是 `:84-88`。→ Task 5 給 `1.` 到 `3.` 之間完整新區塊。
7. **dev-workflow state schema / Trace 範例 / snapshot / PR body 的 `plan_path` 不允許 null**（DX M4、Design m5、Eng Minor 2-4）：`dev-workflow:161-162,189`、`context-snapshot:51`、`context-resume:84`、`finish-branch:216`。→ 全改 `<path | null>`；PR body「plan: <plan.md | N/A（T2 施工清單在 spec）>」；Trace 範例拿掉 `+lang-reviewer`。
8. **app.js NODE_DOCS 與 C6a 基準沒進 plan**（Eng Major 5）：`app.js:91` LangAgent、`:98` RPT2；`docs-site-contract:243-244` BASELINE_KEYS。刪 LangAgent 條目會讓 C18 紅（它是 lang-reviewer 文件唯一的 NODE_DOCS）。→ 刪 RPT2 條目 + 同步 C6a 基準；**保留** LangAgent 條目改註解「已不在圖上、只給索引面板」。
9. **rules.md `:107` 自身殘留「pr-review.md（T0-T1 簡、T2-T3 詳）」**（Eng Major 6）→ 改「pr-explain；T3 自動、其他 tier 顯式呼叫」。
10. **T2 施工帳本沒有落點**（Design M6）：四項對齊檢查與執行偏差原本記在 plan Task 5，壓成表後沒欄位。→ execute-plan 加「T2 對齊檢查結果與執行偏差追加寫在 spec `## 施工清單` 之下的 `## 施工紀錄` 段」。
11. **landing 留痕 beat（`:99`）仍說每個 PR 都有 agent 重讀 diff**（Design M5、DX m6、Eng Minor 7）→ 「T3 的 PR 開完之後…」。
12. **P9 訊息沒「改處」、P9c 用縮寫、一條 regex 冗餘**（DX M6）→ 每條補「改處：<檔>「<§段>」」，對齊 P8 風格。

## Minor（去重後）

- request-review T2 prompt 仍貼 `plan: <plan 內容>`、整合範本仍有 lang-reviewer 列（DX m1、Design m1）→ 「task 來源：T2 = spec §施工清單；T3 = plan」。
- verify-done `:73` 失敗選項仍「退回 write-plan」；execute-plan `:143-145` 自稱三處同一套（Design m2）→ 同步。
- execute-plan description `:4-6`、`:42`「讀 task 5 個 step」、`:86` §Parallel-group「讀 plan」沒跟上（DX m3、Design m3）→ 「T2 一列即一 task，五步由 tdd-cycle 現場展開；『怎麼驗』是目測依據時以截圖 / 引文代替 output」。
- README `:28` brainstorm 列沒說施工清單誰產；lang-reviewer 列「reviewer prompt」是行話；`:5` 簡介「PR 自動解釋落檔」沒標 T3（DX m4、Design n6）。
- landing 審查 beat 新句主詞變成「提示」、打斷「agent 做什麼」的並列節奏（DX m5）→ `<code>lang-reviewer</code> 你點名才派、按語言抓對應的 idiom 與 pitfall（平常的 review 已把語言提示寫進 reviewer 的 prompt）；`。
- rules.md 沒宣告真相層級（DX m7）→ 表下加「本表是 lane 唯一真相；施工清單格式以 brainstorm §spec 文件結構為準」。
- C8a check 標籤寫死 `99 nodes / 136 edges`（Eng Minor 1）→ template literal。
- P9e 沒驗「一顆 commit」、P9a 沒驗 T3 列（Eng Minor 5）→ 補。
- spec §影響檔案「改 ~8 邊、加 1 邊」與 plan 不一致（Eng Minor 6）→ spec 對齊「刪 7 加 5」（含 C1 新增那條）。
- data.js `TaskFail` / `VerifyFail` 節點 label、phase label `:37` `:44`、ambient `:402`（Design n1、n2）→ 加 T3 / T2 標註。
- brainstorm `:220`「T2+ 所有 section 都要寫」與範本「T3 刪掉本段」矛盾（Design n4）→ 「T3 不含施工清單」。
- lang-reviewer.md 首句「動態 dispatch」未改、P9f 抓不到（DX n1）→ 首句改；P9f 加 `動態 dispatch`。
- 施工清單「檔」欄標「檔（可多個）」（Design n6）。

## Nit

- plan Task 1 註解「5 個 skill」實際 8 個（DX n2）。
- rules.md 放「精簡依據（2026-09-04）…」一次性紀錄會隨 CLAUDE.md 常駐吃 token（DX n3）→ 留一句指向 archive。
- plan §Self-review「Task 6 依賴 Task 4」不成立，真依賴只有 Task 1（Eng Nit 1）。
- data.js `:80` SpecGate label 說 brainstorm 用自由文字問，已漂移（Design n3）→ 順手修。
- brainstorm `:275` 現況「T1+ Dev → write-plan」本就與 execute-plan description 打架，commit body 提一句（Eng Nit 3）。

## reviewer 實測確認無誤（Eng）

- P9a-g 對現況 7 FAIL、套 plan 新文字後 7 PASS；CRLF 不影響 `^…$`；P9d 現況不恆綠、P9c 不恆紅。
- data.js 模擬刪 3 節點 / 7 邊 + 加 4 邊 → 96 / 133 / 0 孤兒 / 0 懸空；UG1 入邊只剩 RPT3；b3 / b5 新節點都存在。（C1 再加 1 邊 → 134，plan v2 以此為準。）
- `build-references -Check` 中途紅不會被任何 hook / 契約 / CI 擋。
- dispatch-parallel / tdd-cycle / verify-done / pr-explainer / docs/reference 除已列項目外無 T2 舊語意。

## 主 agent 建議

- **必處理**：C1-C3、Major 1-12。全部是 plan 漏檔或漏段，不是方向錯。
- **建議處理**：Minor 全收（都是逐行改寫，執行成本低、留著就是矛盾）。
- **略過**：無。Nit 順手做。
- **plan v2 的結構性改動**：新增檔 `design-direction`、`dispatch-parallel`、`verify-done`、`context-snapshot`、`context-resume`、`app.js`；C8a EXPECT 改 96 / 134；P9 加 P9h、補改處、P9b 改精確比對；`data-upto` 改「減去前面刪掉的節點數」；Task 5 給完整區塊文字；spec 第 9 條依 user 2026-09-04 討論改寫成「視角由 codebase_impact 命中的面向推導」。

---

# Code review 總結（Phase 5，本 PR 照舊規則：架構 × 除錯 + lang-reviewer）

> 三個 subagent 並行、皆實跑契約與 grep；架構視角把 HEAD 對 `git show main:` 逐檔對照。

## Critical
無（三份一致）。

## Major（去重）
1. dev-workflow `:44` Phase 0 圖尾仍寫「T1+ → 進階段 2」（架構 M1）
2. T3 code review 兩個 prompt 只給 diff、不給 spec / plan，「符合 spec」沒人看，比 T2 還少（架構 M2）
3. execute-plan `:74` 大改轉進紀錄只寫 plan.md，T1 / T2 沒落點（架構 M3）
4. brainstorm §補施工清單入口寫在 240 行後，但載入時使用契約第 1 步就先跑 Phase 0（架構 M4）
5. dispatch-parallel `:212` 衝突案例只寫「退 write-plan」，T2 會被 write-plan 守門彈回 execute-plan 形成迴圈（除錯 M1）

## Minor（去重）
- execute-plan `:146` 退回判準句、dev-workflow `:223` §Fail handling 沒 T2 分支（架構 m3、除錯 m2）
- brainstorm 0b 視角判定時 Tier 只是預判；Bug track 也會算出用不到的 review_perspectives（架構 m1）
- 補入口與「>8 列升 T3」打架，execute-plan 不查列數（除錯 m3）
- review-plan / write-plan 守門與 frontmatter「亦可由使用者顯式呼叫」衝突（除錯 m4）
- context-snapshot `:84` 仍寫「4 視角」、review-plan `:165` `Tier: <T2/T3>`、write-skill `:124-129` description 範例是舊 execute-plan（架構 m4、除錯 m7 / m8）
- P9i `/T2/.test(ddMd)` 恆綠、P9c 對 `subagent_type = ` 變體漏抓（架構 m5、除錯 nit 9）
- landing `data-upto` / `data-nodes` 無契約守（架構 m6）
- data.js TaskFail / VerifyFail label 說有 T2 補清單路，卻沒有邊（架構 m7、除錯 m5）
- rules.md `:134` 指向 merge 當下不存在的 archive 路徑（除錯 m6、架構 n4）
- app.js 兩處註解數字（36/35 應為 35/34；灌成 30 應為 29）（lang m1 / m2）

## 處置
全部不危險類，依新規則一顆 commit `fix: 處理 review finding（16 項）`（6550ac3），body 逐項列。修後 plugin-contract / docs-site-contract / `build-references -Check` 全綠；新增 C19e 守 landing 資料屬性、P9c / P9h / P9i 收緊。

## reviewer 實測確認無誤（節錄）
- 三個真相層級（rules.md §Tier 表 / brainstorm §spec 文件結構 / dev-workflow routing）無互相打架句；T2 主鏈每段有對應文字
- P9a-i 對 CRLF 檔行為正確（`$` 把 `\r` 當行終止）；data.js vm 載入 96 / 134（修後 135）/ 0 孤兒 / 0 懸空
- app.js 對「NODE_DOCS 有 key 但圖上無節點」的 LangAgent 全部有 fallback，不 throw
- 沒有 hook / 契約 / CI 呼叫 `-Check`，中途紅不擋 commit
