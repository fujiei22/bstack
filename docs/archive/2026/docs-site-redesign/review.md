# Plan review 總結

> Plan: `docs/work/refactor/docs-site-redesign/plan.md`
> Tier: T3 | 視角: CEO + Design + Eng + DX（四個獨立 context 的唯讀 subagent）
> 日期: 2026-09-01

**每一條都附主 agent 的獨立複驗結果。** reviewer 說的不等於成立——本檔已剔除一條經查不成立的
指認（CEO 說少了 `docs/reference/design-map.md`，實際該檔已在 `6863a69` 建好並 commit；
CEO 只讀 spec 與 plan、沒查檔案系統）。

---

## Critical 共識（多視角同時提，且已複驗）

### K1. demo 有 2 個 `@media`，plan 卻斷言 0 —— 且這代表定案設計已順手修了缺口 4

**提出者**：CEO、Design（C-3）、Eng —— 三方獨立一致
**複驗**：✅ 成立。`rail-console.html:568` `@media (max-width: 1080px)`（藏 minimap）、
`:572` `@media (max-width: 860px)`（縮 panel / detail / masthead）。
plan Task 3 Step 3 說「13–576 整段照抄」，Step 4 卻是 `grep -c '@media' → Expected: 0`，自我矛盾。

**主 agent 補充的實據（reviewer 未提）**：兩條性質不同。
`.panel` 是 `left: calc(56px + 10px); width: 306px`（右緣 372px），
`.detail` 是 `right: 150px; width: 322px`（左緣 `vw - 472`），
兩者在 `vw ≈ 844` 開始**互相重疊**——**`860px` 那條是新骨架的結構必需**，不是順手修缺口 4。
`1080px` 藏 minimap 那條才是判斷取捨（實算 `.detail` 右緣 `vw-150`、minimap 左緣 `vw-119`，本不重疊）。

→ **需 user 裁決**。

### K2. C4 沒有紅相，F22 的唯一機械守門員形同虛設

**提出者**：DX（Critical 1）、Eng（Major 1）、Design（M-5 從另一面切入）
**複驗**：✅ 成立。用 plan 自己的 regex 跑**現況** `docs/css/styles.css` → **32 條、八型別齊全**。
plan Task 1 Step 4 與 Task 3 Step 2 都寫「Expected: FAIL C4a — 實際 0」，**那個紅不存在**。
C4 只數宣告數不看值，改版前後都綠。

**修法可行性複驗**：現況 `--c-*` 用 `oklch(` 的條數 = **0**，改版後 = 32 → 斷言值必須是 `oklch(`
確實有紅相。Design 另指出 `C4a == 32` 會把字面值焊死、擋掉未來任何 token 化重構，建議刪或改 `>= 16`。

→ 採納：C4a 改為值域斷言（`--c-*` 必須是 `oklch(`）＋ 保留 C4b（八型別各有 fill/bd 成對）。

### K3. `NODE_DOCS` 兩種 shape 混用，C6 全綠但三個讀取點壞掉

**提出者**：Design（C-2）、Eng（Critical 2）
**複驗**：✅ 成立。
demo：`{p:'skills/dev-workflow', n:'dev-workflow', k:'skill'}`；
現況：`{path:'references/skills/dev-workflow/SKILL.md', name:'dev-workflow'}`（無 `k`）。
plan Task 6 的 patch 寫 `RPT2: { path, name }` → 造出 31 筆 `{p,n,k}` ＋ 2 筆 `{path,name}` 的混血。

壞的三處（皆不報錯）：文件索引面板依 `d.k` 分組 → RPT2/RPT3 從兩組都被濾掉；
detail 的 doc-card `esc(doc.n)` → 顯示 `undefined`；drawer 標題與 path pill → `undefined`。

**主 agent 補充**：路徑轉換規則 plan 完全沒寫，實查是**兩種後綴**——
`p:'skills/x'` → `references/skills/x/SKILL.md`；`p:'agents/y'` → `references/agents/y.md`。
demo 從未把 `p` 解成真 key（它的抽屜是假內容，只拿 `p` 組顯示字串）。

→ 採納：統一成 demo 的 `{p,n,k}` shape；新增契約「每個 `NODE_DOCS[*]` 解出的 key 都要在
`REFERENCE_DOCS` 命中」——這是本輪 CP 值最高的缺漏契約。

---

## Critical 各視角獨見（已複驗）

### K4【Eng】Task 2→4 之間有 3 個確定壞掉的 commit，而契約在這期間逐條轉綠

**複驗**：✅ 成立。Task 2 換掉 `<body>` 後，舊 `app.js` 取 `#legend-side` / `#flow-svg` /
`#detail-panel` 全是 `null`，載入即 TypeError；Task 3 只換 CSS，仍是死的；要到 Task 4 才復活。
期間 C11 / C4 / C12 都會綠。

**這是整份 plan 最大的結構缺陷**：「紅→綠」與「站能不能開」在 Task 2–4 之間零相關，
T3 紅綠循環在此淪為形式。
→ 採納：Task 2/3/4 併成一個 task 一個 commit（三檔互相依賴，拆開的 commit 沒有可驗證意義）。

### K5【Design】F2 的 fit-all 能力實際被刪除，而 C15a 給假綠燈

**複驗**：✅ 成立，且這是本輪最嚴重的一條。
```js
function fitView(animate) { var t = landingTransform(); ... }   // rail-console.html:1259
```
`fitView()` 與落地視野是**同一個 transform**，只是加了動畫。
`btn-fit` 的 `data-label` 是「**回到起點**」（`:594`），不是「全圖」。
**demo 裡沒有任何入口能看到整張圖。**

而 spec §已決事項 0 白紙黑字承諾「**F2 的能力不刪**：fit-all 移到標題列按鈕」。
plan 的 `C15a: /function fitView|fitView\s*=/` 在 demo 上**直接 PASS**——契約保護的是函式名字，不是行為。

**現況是「能力移除的實作」配「能力保留的說法」。** → **需 user 裁決**。

### K6【Design】Task 5 描述的工作與 demo 實際結構不相容，量體被低估

**複驗**：✅ 成立。
- demo 是 `openDrawer(nodeId)`（`:1147`），三個呼叫端全傳 node id；plan 寫 `openDrawer(docPath, docName)`
- plan 引用的 `drawerBreadEl` / `drawerHeaderEl` / `drawerBodyEl` 在 demo **各命中 0**——
  demo 的 drawer 是 `drawerEl.innerHTML = ...` 整塊重建，沒有這些持久元素
- class 兩邊零交集：demo 用 `drawer-head` / `drawer-title` / `drawer-desc` / `drawer-body` / `.md`；
  舊 `app.js` 吐 `doc-drawer-*` / `doc-type-badge` / `meta-pill` / `doc-description`
- plan 的 snippet `drawerBodyEl.innerHTML = marked.parse(cleanBody)` 沒有包 `<div class="md">`，
  而 `.md` 承載 `max-width: 62ch` / `line-height: 1.75` / `h3` / `li` 全部樣式

**後果**：照 plan 做，C14a–C14d 四條**全部 PASS**，交付的是一個沒有樣式的文件面板。
Task 5 的真實工作是「重寫 drawer DOM ＋ 接資料 ＋ 寫 key 轉換」，不是「搬三個函式接進去」。

### K7【DX】Task 1 的 Step 1 → Step 2 順序不可執行

**複驗**：✅ 成立。Step 1 只寫 4 行 selftest（標「檔案末尾」），Step 2 就叫你跑
`node contract.mjs --selftest` 期待「印出 FAIL SELFTEST」。但此時 `check()` / `read()` /
`html`/`css`/`js` 都不存在，實跑會是 `ReferenceError`，不是 `FAIL SELFTEST`。
→ 採納：Task 1 改成「Step 3 寫完 → 用 `--selftest` 證明 fail 路徑有效」，不硬套 Step1/2 模板。

### K8【CEO】merge 即上線、無預覽，plan 卻沒有 user 視覺驗收 gate、也沒有 rollback 程序

**複驗**：✅ 成立。Task 7 Step 3 第 4 點的「人工開一次 `file://`」目的是驗 F14，不是驗設計。
這件事的本質是「把 user 選定的 demo 搬到正式站」，唯一真正的驗收標準是
**user 打開 `localhost:8080` 說「對，就是這個」**——這一步不在 plan 裡。
→ 採納：Task 7 加 user 視覺驗收 gate ＋ 記下 merge 前 main SHA 的 rollback 一行。

---

## Major（去重後，已複驗）

| # | 來源 | 內容 | 複驗 |
|---|---|---|---|
| M1 | Design | **oklch 無 fallback**：demo `<style>` 有 `oklch()` **69 次、hex 0 次**。不支援的瀏覽器（Chrome <111 / Safari <15.4）會讓整份色票落空 → 黑字透明底無框節點，「看起來像壞掉」。配上無預覽環境，失效模式是「不會收到回報，只會有人默默關掉分頁」 | ✅ 實測 69 / 0 |
| M2 | Design | **`bastck` 靜默消失**：`docs/js/app.js:697` 有（spec 寫 686 是舊行號），demo 命中 **0**。spec §範圍 明訂「照抄不改」，但沒有任何契約攔得住 | ✅ 實測 |
| M3 | Design | **favicon 沒換**：`docs/favicon.svg` 唯一 `fill="#4040C4"` 是舊 periwinkle 藍。改版後全站暖紙＋校對紅，**唯一還是舊識別的東西在瀏覽器分頁上**。不在 spec 也不在 plan 任何清單 | ✅ 實測 |
| M4 | Design、CEO | **改動說明會累積到 5 項**：F2（預設視圖）、F8（350ms/0.35 → **560ms/0.85**）、F16（180ms → **320ms**）、F17（三顆 SVG icon → 「自/明/暗」單字）、F21（三句原文 → demo 狀態行）。plan 只預先宣告 F2 一項，實作者對表時 F8/F16 前半段對得上、很容易誤打 ✅ | ✅ 全部實測 |
| M5 | CEO | 改動說明**沒有上限也沒有裁決者**。結果會是「22 項功能都在，但其中 5 項行為不一樣」，而沒有人簽字。建議累計 >3 項 → `AskUserQuestion` 逐項確認 | — 流程建議 |
| M6 | Design | **F21 原文在新語境讀不通**：「點 **type** 或 **phase** 快速導覽」指舊左欄兩個常駐清單；新骨架裡叫「型」「段」且藏在 rail 後面，畫面上沒有 type/phase 這兩個字。且 demo 的 `renderStatus()` 三句資訊量是**超集**（帶計數與操作字彙）。建議 C9 改測「三種狀態各有分支」而非「三句原文」 | ✅ 實測 |
| M7 | Eng | **C13b 的註解剝除會吃掉真 code**：`/\/\/.*/g` 遇到 `'http://www.w3.org/1999/xhtml'`（`rail-console.html:882`）會砍到行尾。且只認 `#RRGGBB`，`oklch()` / `rgb()` / `#abc` 一律漏抓 | ✅ 讀碼確認該行存在 |
| M8 | Eng | **C8 的 layout.js 那段是死碼**：`new Function(...)(win,{},{})` 後 `win.dagre === undefined`，`buildLayout` 拋 `dagre not loaded`。主 agent 先前自測會過是因為多加了 `require()` fallback，**plan 的 code 沒有那段**——把「我測過」誤當成「plan 裡的 code 測過」 | ✅ 實測 |
| M9 | Eng | **C8 完全沒驗 `REFERENCE_DOCS`**（實測 31 個 key），那才是 F13/F14 的資料底 | ✅ |
| M10 | Eng | **F12/F14 的四句原文無契約**：`載入中⋯`、`（無描述）`、`（載入失敗）`、`載入失敗：` 在 demo **0 命中**。C9 對 F21 做字串比對、對同性質的 F12/F14 卻不做，標準不一致 | ✅ |
| M11 | DX | **docstring 密度倒退**：現況 `app.js` 901 行 / 20 函式 / **36 個 `/**`**；demo 702 行 / 25 函式 / **13 個 `/**`**。702 行全是新 code，CLAUDE.md §程式註解 要求「新 code 全寫」 | ✅ 實測 |
| M12 | DX | **plan 全篇 bash 語法但沒說用哪個 shell**。`echo "exit=$?"` 在 PowerShell 印 `True/False` 而非 exit code——**靜默給錯答案**。`grep` 在 PowerShell 不存在 | ✅ |
| M13 | DX、CEO | **plan 全篇 demo 路徑寫錯**（`design-demos/...` → 應為 `docs/work/refactor/docs-site-redesign/design-demos/...`），且該目錄被 `.gitignore` 的 `**/design-demos/` 命中、**永不進版控**。「整份取代」的來源在 merge 後連 archive 都沒有 | ✅ |
| M14 | DX、CEO | **檔頭註解出廠即死鏈**：Task 3 要在 `styles.css` 頂端指向 `docs/work/.../spec.md`，但 finish-branch 會把整包搬到 `docs/archive/<年>/<主題>/`——merge 當下就 404。Task 7 append 進 baseline 的指標同一個病 | ✅ 規則出自 CLAUDE.md §Docs 落檔 |
| M15 | CEO | **字體換法新增 CJK webfont CDN 載入，沒有被計價**。現況只載 Space Grotesk + Space Mono（純拉丁），Noto Sans TC 僅是本機 fallback **名稱**、不下載。新 `<link>` 進 5 個 family、含兩個 CJK 家族，而站台正文是繁中為主。後果：首屏字體流量與 FOUT 變差；`file://` 與離線時整套形式對比退化成系統字 | ✅ 實測 `index.html:29` |
| M16 | CEO | **demo 夾帶兩個沒人要求的新功能**（rail 的「文件索引」面板、panel 的「釘」鈕）。plan 只打算在 Task 7「記錄」而非在 Task 2「決定」。「釘」鈕沒有任何行為定義 | ✅ |
| M17 | CEO | **C8 該砍改用 `git diff --exit-code`**。C8 在驗三個 plan 明訂「不動的檔」，卻是全支腳本最脆的一段。`git diff --exit-code docs/js/data.js docs/js/layout.js docs/js/references-data.js` 一行、更強、零維護 | ✅ 與 M8 相印證 |
| M18 | DX | **`verify/README.md` 會過期**：Task 1 建立時涵蓋 C1–C10，Task 2–6 各加一條，但 Task 2–6 的 Step 5 **全都只 commit `contract.mjs`**，沒有一個更新 README。收尾時 README 與 docstring 都停在 C1–C10 | ✅ |
| M19 | Design | **C4a 把字面值焊死**：八型別的 hue 在 light/dark × fill/border 四種組合下**一個都沒變**（85/152/248/92/305/265/58/24），只有 L 與 C 變。但 chroma 是**逐色相人工調過的**（hue 92 的黃要 0.070 才跟 hue 248 的藍 0.050 看起來一樣飽和），全推導會抹掉校準。建議折衷：抽 `--h-<type>` 八個色相 token，L/C 留在各自宣告 | ✅ 實測 hue 恆定 |
| M20 | Design | **rail 可及性缺的不是 spec 以為的那一半**。命中區已是 44×44（`:159-160`）、hover 名牌已有（`:174-187`）。真正缺的是：(1) 名牌只綁 `:hover`，鍵盤 Tab 到「型」永遠不知道它是什麼；(2) 四顆按鈕無 `aria-label`，螢幕閱讀器讀到的就是單字「型」。且觸控裝置無 hover = 完全沒有標籤 | ✅ |
| M21 | Design | **plan Task 5 有把 demo 的「無文件」卡片弄掉的風險**。demo `:963-976` 對 51 個無文件節點有明確 else 分支（同尺寸卡片、寫「無獨立文件」＋ 解釋為什麼、**不產生死按鈕**），比舊站（整段不出現）好。plan Task 5 全程只講有文件的路徑 | ✅ |
| M22 | CEO | **`verify/README.md` 建議直接砍**。一支 merge 時就進 archive 的腳本不需要獨立說明文件，檔頭 docstring 已足夠 | — 判斷 |

---

## Minor / Nit（節錄，不逐條展開）

- **C12 的 Expected 數字錯**：plan 寫「linear=1 裸ease=13」，實測現況是 **linear=1、裸ease=8、曲線=0**（DX）✅
- **C10 的「視 marked 而定」是不必要的不確定**：實查 `docs/index.html:35` 已載 `marked.min.js`，
  現況就是 PASS；plan 說「加回」是錯的。**真正的風險相反**——demo 只載 d3+dagre，
  Task 2 若照抄 demo 的 `<head>`，marked 會消失、C10 才會紅。plan 的敘述剛好把真風險蓋掉（DX）✅
- **`NODE_DOCS` 筆數 spec 與 plan 打架**：spec 寫「31 筆」、plan C6 寫「33 筆」，實測 **33**。
  plan 對，spec 的括號寫法會誤導後人（CEO）✅
- **demo 硬編字串會變錯**：`rail-console.html:1013` 寫死「27 skill + 6 agent」，
  移除 LoadDD/LoadDLang 後實際 25；Task 7 又寫「文件索引（31）」——同一個東西三個數字。
  建議改成從 `Object.keys(NODE_DOCS)` 算（CEO）✅
- **縱橫比兩個打架的「實測」值**：spec 寫 `1925 × 11196`（0.172）、demo 註解 `:229` 寫
  「實測 1978×12398」（0.160）。結論一致但依 CLAUDE.md §白話優先「數字一律精確」該對齊（CEO）✅
- **`grep -E 'C1|C2|...'` 會誤撈**：`C1` 同時命中 C10–C15（DX）✅
- **`parallel_groups: [1..7]` 每組各一 task 等於沒有 group**，直接標 serial 更清楚，
  也避免 execute-plan 誤判要載 `dispatch-parallel`（CEO）
- **Task 5 與 Task 6 拆兩個 task 是純儀式成本**，同檔同一次移植收尾，合併後紅綠循環一樣成立（CEO）
- **驗證器呼叫路徑很長、plan 出現 14 次**，可加薄 wrapper（DX）
- **C2a / C1b 在「東西根本不存在」時會報錯誤的根因**：`indexOf` 回 -1 時訊息說「順序反了」，
  真因是「字串沒對上」。應拆成兩種訊息（DX）✅
- **24 條檢查裡 15 條的 `detail` 不印實際值**，FAIL 時看不出哪裡錯。建議統一成
  `期望 X，實際 Y（後果：Z）`（DX）

---

## 主 agent 建議

### 必處理（不需 user 決定，我直接改 plan）

K2 / K3 / K4 / K6 / K7、M7 / M8 / M9 / M10 / M11 / M12 / M13 / M14 / M17 / M18 / M20 / M21、
以及全部 Minor 的事實錯誤（C12 數字、C10 敘述、`NODE_DOCS` 筆數、縱橫比、grep 錨定、detail 訊息）。

其中結構性的三項：
1. **Task 2/3/4 併成一個 task 一個 commit**（K4）——三檔互相依賴，拆開的 commit 無可驗證意義
2. **Task 5 重寫**（K6）——真實工作是「重寫 drawer DOM ＋ 接資料 ＋ 寫 key 轉換」
3. **契約從「測名字」改成「測行為 ＋ 測值」**（K2、K5、M7、M10）：
   C4 改值域斷言、新增 `NODE_DOCS → REFERENCE_DOCS` 命中檢查、新增 F12/F14 四句原文檢查、
   C9 / C15 降級註明「輔助檢查，F2 / F21 一律以 e2e 為準」

### 需 user 裁決（見下方選單）

| # | 決策點 | 為何不能我決定 |
|---|---|---|
| D1 | **fit-all 到底做不做**（K5） | spec 已對 user 承諾「能力不刪」，實際是刪了。要嘛補做、要嘛改承諾——兩者都動到 user 看過的文字 |
| D2 | **兩條 `@media` 留不留**（K1） | user 明訂六條缺口不修，但 `860px` 那條是新骨架的結構必需。砍了會疊、留了動到「不修」的界線 |
| D3 | **5 項改動說明怎麼處置**（M4、M5、M6） | user 的硬要求是「一項都不能掉」。把「掉」的判定權留在我手上不合適 |
| D4 | **三個殘留 / 防禦項**（M1 oklch fallback、M2 `bastck`、M3 favicon） | 都不在 spec 任何清單裡，且各有一個「不做」的合理理由 |

### 略過（附理由）

- **M16「釘」鈕與文件索引面板** → 併進 D3 一起處理，不單獨開決策點
- **M19 抽 `--h-<type>` 色相 token** → 好建議但屬於重構，本次 scope 是「換設計」不是「重構 token 系統」。
  記進 review.md 供日後參考，不進本次 plan
- **M15 CJK webfont 流量** → 記錄但不改。字體是 user 定案設計的一部分，
  且 `file://` 離線降級到系統字是可接受的降級（不是壞掉）。**但要寫進驗證表當已知取捨**
- **M22 砍 `verify/README.md`** → 採納（併入 M18 的處理：不建 README，內容寫進 `contract.mjs` 檔頭）

---

## hand-off state

```yaml
state:
  review_summary_path: docs/work/refactor/docs-site-redesign/review.md
  review_perspectives: [CEO, Design, Eng, DX]
  review_critical_count: 8      # K1-K8
  review_major_count: 22        # M1-M22
  review_user_decisions: [D1, D2, D3, D4]
  current_phase: review-plan-done
```
