# 階段 B2 驗收記錄

> 對應 plan：`docs/work/feat/design-lane/plan-b2.md`（v2）
> 對應 review：四視角（CEO / Design / Eng / DX），**11 個 Critical**，四份一致判「不可進 execute-plan」→ plan 重寫為 v2
> 日期：2026-08-31
> 驗收對象：`brainstorm` / `design-direction` / `design-language` / `execute-plan` / `verify-done` / `write-plan` / `dev-workflow` 七個檔

**涵蓋**：S4（中途轉進）、S5（三方向與豁免選單，**接上流程**）、V7（漏網複查）、K6 接收端。
**不涵蓋**：**V5 大改路徑端到端**（見下方「做不到的部分」）、S7 孤兒偵測（階段 C）。

---

## 一句話結論

**9 個 task 全序列跑完、全綠、逐 task commit。** 設計 lane 現在**真的會自己觸發**——`brainstorm` 判到大改會問設計路徑、選了出三版會在 branch 建立後載入 `design-direction`、`write-plan` 會讀定案方向拆 task、兩個轉進點都掛進了必經清單。但 **V5 沒有實跑**：這一階證明的是「接得上」，不是「跑得動」。

---

## 逐 task 結果

| Task | 內容 | Step 2 紅燈 | Step 4 | commit |
|---|---|---|---|---|
| 1 | `brainstorm` 合併確認第 3 題收窄選單 | 7 條 | PASS | `0e05cbc` |
| 2 | `brainstorm` 三方向載入點（branch 之後） | 4 條 | PASS | `27c94a8` |
| 3 | `brainstorm` spec 範本 ＋ state 三欄 | 3 條 | PASS | `6864f29` |
| 4 | `design-direction` / `design-language` 收自述 | 5 條 | PASS | `a7a2380` |
| 5 | `execute-plan` 常規 ＋ 中途轉進 | 14 條 | PASS | `032e909` |
| 6 | `verify-done` 漏網複查（全 tier） | 16 條 | PASS | `a876ada` |
| 7 | `write-plan` 讀定案方向 | 3 條 | PASS | `975e10a` |
| 8 | `dev-workflow` 接上 | 8 條 | PASS | `0baf958` |
| 9 | 驗收 ＋ spec ＋ 全域同步 | 5 條 | PASS | `75ea217` |

> 另有三個施工中產生的修正 commit：`a17ef18`（write-plan 補 `user_choice_quote`）、`c0c9415`（description 併掉重複觸發行）、`449ca6f`（plan 的 0b′ guard 改錨定粗體）。

---

## 施工中被斷言擋下來的三次（這一階最值得記的事）

**v1 的 review 找到 11 個 Critical，共同形狀是「散文層說了、驗證層沒把它變成斷言」。v2 立了 §驗證指令的寫作紀律，然後在寫 v2 的當下又犯了兩次、施工時再被擋兩次。**

| # | 何時 | 發生什麼 | 處置 |
|---|---|---|---|
| 1 | **寫完 v2、進 execute-plan 之前**（自檢） | 機械比對「Step 1 的 pattern 能不能在自己的 Step 3 原文裡逐字找到」，抓到 **Task 5 的 pattern 被粗體符號夾斷**（`**不在**` vs `不在 `）、**Task 6 的 pattern 被拆成兩段**。兩條都會讓 Step 4 永遠 PASS 不了——**與 v1 的 Eng C1 同型** | 改 Step 3 原文，commit `1504e2a` |
| 2 | Task 1 Step 4 | 斷言「不得再提一主一變體」擋下**我自己寫的說明文字**（在解釋為什麼砍掉它時提了它的名字） | **改內容不改斷言**——改斷言等於在 plan 之外自行放寬 gate。說明保留，名字拿掉 |
| 3 | Task 2 Step 4 | 反向 guard「載入點誤放在 0b′ 內」誤報：它抓任何「載入 `design-direction`」字串，而我寫進 0b′ 的是**禁令句**（「**不得**在 Phase 0 期間載入…」）。**我第一次跑時把 `\|\| ok=0` 拿掉才顯示 PASS——那是自己弱化了斷言** | 先講明弱化這件事，再修 guard 改**錨定粗體祈使形**（`**載入 \`design-direction\`**`），用未弱化版重跑。commit `449ca6f` |
| 4 | Task 9 Step 2 | 斷言要求 `user_choice_quote` 出現在四個檔，`write-plan` 只有 `direction_decided` | **判定斷言不算過嚴**——「不得推翻已定案方向」的依據正是那句原話，write-plan 應該指得到它。補內容 |

第 3 次是最該記的：**我確實有一瞬間把斷言改鬆讓它變綠**。這是 Eng 在 review 裡預言的那個陷阱（「執行者到那一步只有兩條路：改斷言或改內容，兩條都是在 plan 之外自行決策」）。處置原則已寫進上表：**預設改內容；要改斷言必須先說明它為什麼鈍，並讓改完的版本仍有鑑別力**（本例：粗體祈使形全檔只在 `:23`，在 0b′ 之外，guard 仍抓得到真的誤放）。

---

## 3a · 全鏈欄名一致性

| 欄 | `design-language` | `design-direction` | `brainstorm` | `dev-workflow` | `write-plan` |
|---|---|---|---|---|---|
| `involved` / `scope` / `scope_evidence` / `size` / `precedent` / `map_status` | ✅ 定義端 | ✅ | ✅ | ✅ | —— |
| `direction_decided` | —— | ✅ | ✅ | ✅ | ✅ |
| `user_choice_quote` | —— | ✅ | ✅ | ✅ | ✅ |

兩個新欄實測**四檔皆有**。`state.design` 六欄用**行首錨定**驗（`^    key: `）——v1 的裸 `grep` 會被子字串餵飽（實測 `scope` 全檔 7 次命中，`scope_evidence` 就足以讓它恆綠）。

## 3b · 「還沒接上」殘留掃描

`grep -rE "階段 B[0-9]? ?(啟用|接上|才接上)|目前未接|尚未接上|（階段 B）" skills/` → **零命中**。

施工前實測 **8 處**：`brainstorm:134`（Task 1 刪）、`design-direction:11` `:30` `:326`、`design-language:262` `:263`（Task 4）、`dev-workflow:78` `:238`（Task 8）。
**v1 的斷言只掃 `階段 B 啟用`，8 處裡只掃得到 2 處**——其餘 6 處會存活而斷言顯示 PASS。其中 `design-direction:11` 在 **frontmatter `description`**，是每個 session 都載入的文字；留著會變成「`dev-workflow` 叫它載、skill 自己說別載」，而說「別載」的那一方在更高的載入層。**這一條不修，B2 可能整個靜默失效。**

## 3c · V7 機械驗（四條全過）

輸入六個檔，套 `design-language` 判準後只剩兩個：

| 輸入 | 判定 | 依據 |
|---|---|---|
| `docs/css/styles.css` | ✅ 撈出 | 前端副檔名、不在排除範圍 |
| `docs/index.html` | ✅ 撈出 | 同上 |
| `api/orders.py` | 濾掉 | 非前端副檔名 |
| `skills/design-direction/assets/design_canvas.jsx` | 濾掉 | skill 定義目錄 |
| `dist/app.css` | 濾掉 | 建置產物 |
| `node_modules/x/y.scss` | 濾掉 | vendor |

`<base>` fallback 實測：`state.commits` 不存在時 `git merge-base origin/main HEAD` = `a4bf017`，該 base 起的前端改動（套同一判準）為空——正確，本 branch 的前端改動全落在 `skills/` 底下。

---

## 3d · V6 桌上推演（中途轉進）

情境：**純後端 task 做到一半，發現要改 `docs/css/styles.css`**。對著 `execute-plan` 逐步走：

| 步 | 落在哪一句 | 結果 |
|---|---|---|
| 發現 | §Task 推進規則 **第 2 步**「並比對要動的檔是否都在 `codebase_impact.files` 內」 | ✅ 掛在每個 task 都會讀的地方，不是獨立章節 |
| 分流入口 | 「有前端檔不在清單 → 進 §前端檔處理 的例外分支」 | ✅ 指向明確 |
| 1 暫停 | 「`TaskUpdate` 維持 `in_progress`，**不 commit 半成品**」 | ✅ |
| 2 補判 | 載入 `design-language` 取六欄 | ✅ |
| 3 分流 · 小改 | 跑 `design-language §對齊檢查清單` 四項 → 繼續寫 code | ✅ |
| 3 分流 · 大改 | **先查 `spec.md` 是否已有 `direction_decided`**（有值 → 照已定案方向做，不重問）→ 沒有才走 `AskUserQuestion` 六選項 | ✅ 這一層是 v1 沒有的：v1 會對已定案的方向再問一次 |
| 4 回寫 | `state.design` ＋ `design_rejudge`；**大改才回寫 `plan.md`** | ✅ 小改不必動 plan，避免「順手改一個 `.css`」成本過重 |
| 5 接回 | 「接回 §Task 推進規則 **第 3 步（tdd-cycle）**，從中斷處繼續，**不必整個紅綠循環重來**」 | ✅ 回歸點指到具體第幾步，且說明不必重來 |

**六個選項涵蓋度**：① 轉進三方向 ② 縮回小改 ③ 撤掉這個改動 ④ 切成本 branch 內獨立 task ⑤ 接受並記技術債 ⑥ 暫停重 brainstorm（未 commit 的 `git stash`，不丟棄）。另明寫**無人值守時停在這裡等、不得自選**。

## 3e · 組合推演（v1 沒有這一格 · DX C1）

情境：**3d 的中途轉進跑完之後，跑 verify-done**。

| 檢查 | 結果 |
|---|---|
| `execute-plan` 第 4 步已把 `involved` 改成 `true`、原值存進 `design_rejudge[].design_before` | ✅ |
| `verify-done` §漏網複查 觸發條件**第 3 條**「已被 `design_rejudge` 處理過的檔不重複觸發」 | ✅ 該檔被濾掉，**不重跑四項對齊檢查** |
| 大改情境 user 選了「④ 之後再做」 | ✅ 同樣被第 3 條濾掉，**不會再問一次、不升 blocker** |

**v1 在這裡是壞的**：Task 3 只寫 `plan.md` 與 `pivots`、不回寫 `state.design`，而 Task 4 以 `involved=false` 為觸發依據——同一批檔會被抓第二次；大改時甚至會把 user 五分鐘前答過的問題再問一遍並升成 blocker。v2 用 `design_rejudge` 統一兩邊（取代 v1 的 `pivots` ＋ `design_recheck` 兩個概念）之後這條路徑才通。

**留下的正確行為**（不是 bug，記下來免得日後誤判）：若中途轉進補判出的 `scope` 與 `state.design.scope` 不同，觸發條件第 4 條的「`scope` 對不上」**仍會觸發**——那是另一種漏網，該觸發。

## 3f · 反向推演（純後端 task 全程）

情境：「幫 `api/orders.py` 的 `list_orders` 加分頁參數」，T1，完全不碰前端。

| 階段 | 新規則的作用 | 額外成本 |
|---|---|---|
| `brainstorm` 0b′ | `design-language` 第 1 步副檔名不命中 → `involved=false` → 第 3 步「到此為止」。新加的「本階段只判不做」只是 forward reference | 多讀 ~3 行 |
| 合併確認 | `involved=false` → **2 題（Track、Tier）**，第 3 題與設計路徑都不出現 | **0 個新問題** |
| spec 範本 | 「設計方向」段落 gate 在 `involved=true` | 整段跳過 |
| §使用契約 3.5 | gate 在 `size=大改` | 跳過 |
| `write-plan` 2.5 | gate 在 `size=大改` 且 `direction_decided` 有值 | 跳過 |
| `execute-plan` | §Task 推進規則 第 2 步多一個比對；§前端檔處理 ~35 行讀而不進 | 1 個比對 ＋ 多讀 ~35 行 |
| `verify-done` | §使用契約 2.5 跑 1 個 `git diff`，無輸出即結束；§漏網複查 ~25 行讀而不進 | 1 個 shell 指令 ＋ 多讀 ~25 行 |

**結論：純後端 task 多讀約 70 行（其中 60 行是永遠不會執行到的死碼）、多跑 1 個 `git diff`、多 1 個比對判斷、給 user 的問題增加 0 個。** 沒有任何一步被卡住。

**成本是條件的、不是固定的**：skill body 走按需載入、不進每個 session；純問答／查資料類 task 一毛都不付。**唯一的固定成本**是 `design-direction` 的 `description`（每 session 載入），而 Task 4 已把它從「還沒接上」改成正式觸發條件——那一行本來就會載入，改寫不增加成本。

## 3f-2 · B1 回歸

| 項 | 結果 |
|---|---|
| `design-direction` 檔數 | 9 ✅ |
| `skills/` 的 `⚠️` | 0 ✅ |
| `skills/` 的簡體字 | 0 ✅ |
| 裸 `^skills/` 比對殘留 | 0 ✅（Task 5／6 一律錨定 `*/SKILL.md`，理由見 `design-language` 的明文警告） |

---

## 做不到的部分（明寫，不含糊）

### V5 大改路徑端到端 —— **本階段沒有實跑**

**這一階證明的是「接得上」，不是「跑得動」。**

要驗 V5 需要一次真的三方向：3 個 subagent ＋ 截圖 ＋ user 選定。它已在 `spec.md` §階段拆分 取得明確歸屬——**排在階段 C 之前**，對象是 bstack 自家 `docs/` 站。

**為什麼排在 C 之前**：C 是收尾（`setup.ps1` 孤兒偵測），V5 驗的是 B1+B2 的核心交付到底能不能用。而且已知有地雷：`verify-stage-b1.md` 記過 `npx playwright screenshot` 的 `--viewport-size` 未加引號會回 `Invalid viewport size format`——這類問題只在實跑時出現，**卡住的時點是已經燒完 3 個 subagent 之後**。

### 桌上推演的侷限

3d／3e／3f 抓得到「規則互相矛盾」「轉進出去沒回歸點」「欄名對不上」這類**靜態**問題，抓不到「實際跑起來卡住」。**不要把 3d/3e 讀成 V6 已經驗過。**

### 「一主一變體」被砍掉（D32）

原本它是三版與單版之間的折衷。現在大改只剩兩極：**燒三個 subagent**，或**完全不做設計決策**。要補回中間地帶，得先給 `design-direction` 一條非三版的執行路徑（它的產出自檢目前硬性要求 `design-demos/` 下有 3 個 `.html`）。

### `.sass` 仍未決

`design-language` §前端副檔名 **不含 `.sass`**；`frontend-test` 是全 repo 唯一含它的一處。本階段**沒有做這個決定**，維持 `spec.md` §待釐清 5 的未決狀態——**不讓它被實作順手決掉**。

---

## 失敗模式（這一階的風險本質）

改的是**所有 task 的必經之路**。寫錯不會拋例外、不會 build fail、沒有一行 log，症狀是「幾週後某個專案的某個 task 行為跟預期差一點」；而且 `setup.ps1` 同步之後，**錯誤在所有專案同時生效**。

按 debug 難度排序：

| 寫錯的地方 | 症狀 | 好不好抓 |
|---|---|---|
| `verify-done` §漏網複查 | 多印一段，或該印沒印 | **好抓**——觸發判斷是可手動重跑的指令 |
| `dev-workflow` 觸發表 | skill 沒被載入／多載一次 | 中等——`[Trace]` 的 `Skill=` 欄看得出來 |
| `write-plan` | plan 沒按定案方向拆 task | 中等——`plan.md` 是落檔的，事後對得起來 |
| `execute-plan` §前端檔處理 | **什麼都沒發生**，agent 沒注意到就繼續寫 | **難抓**——沒有負面證據。所以 v2 特意把觸發掛進第 2 步而非獨立章節 |
| `brainstorm` 第 3 題選項 | 選單當場可見，但**該出現的選項沒出現**時，user 不會知道自己少了一個選擇 | **最難**——大改路徑會永遠走不到而沒人察覺 |

**回退窗口**：B2 一經 `setup.ps1` 同步到全域，階段 C 就跑在新規則上。**C 施工中若發現 B2 有問題，先 `git revert` ＋ 重跑 `setup.ps1` 回到 B1 狀態再處理**，不要在新舊規則混用的狀態下繼續。

---

## 這一階真正的產出

不是七個檔的 diff，是**讓 B1 那 1,730 行從「要靠人記得手動叫」變成「流程會自己走到」**。

三個最能說明差別的接點：

1. **`design-direction:11` 那一行**。它在 frontmatter，每個 session 都載入。B1 留下的「流程自動載入待階段 B2 接上，目前僅 user 顯式呼叫」若不改，B2 其餘六個檔全部做對也沒用——模型讀到「還沒接上」就不會載，而且**不報錯**。四個 review 視角獨立點名了同一行。
2. **載入點的位置**。v1 把它放在 0b′，那是 Phase 0 的第三個子步驟——**在合併確認之前、且還在 `main`**。照 v1 施工的話，條件永遠判不出來；就算硬判出來，三個 subagent 跑完會被 `branch-safety.ps1` 擋在寫檔那一步。**這個錯誤 grep 抓不到，是 Design 視角讀時序讀出來的。**
3. **`design_rejudge` 取代兩個概念**。`execute-plan` 與 `verify-done` 各記一份重判結果、卻沒有交握，會讓同一批檔被處理兩次、user 被問兩次。合併成一個 list 之後，「已經處理過」變成一個**可機械判斷的事實**，而不是靠兩個章節的散文互相呼應。
