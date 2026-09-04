---
name: design-direction
description: |
  定設計方向（繁中）。載入：dev-workflow §跨流程 skill 載入 表所列時點（brainstorm 0c/0d 合併確認選「出三版」
  且 branch 已建立、spec 已落檔）；亦可由使用者顯式要求出方向、評審設計。
  涵蓋：三方向硬門、可變維度（有無先例）、三 subagent 並行、產出落檔、
  反 AI slop、React+Babel 技術紅線、6 維度評審。
  分工：既有事實（這區長什麼樣）→ `design-language`；新設計決策 → 本 skill；
  改完要驗畫面 → `frontend-test`。
  上游：`design-language`（供給設計語言）。下游：T3 → `write-plan`（依定案方向拆 task）；T2 → 回 `brainstorm` 3.5 依方向回寫 `## 施工清單` 後交 execute-plan。
---

# design-direction

`design.size=大改` 時，產出三個差異化方向讓 user 選。

**你不是在寫 HTML，你是在做設計決策。** HTML 只是媒介——交付標準是「看得出有人做過選擇」，不是「能跑」。

## 使用契約（強制）

**載入前提**：`design.size=大改`，且**設計語言由 `design-language` 供給**（本 skill 不自己抽 token）。

**載入後依序執行**：

1. 讀 §對外契約 的輸入欄位。
2. **對齊假設 ＋ 確認設計路徑**：
   - 受眾 / 核心訊息 / **輸出尺寸** / 真實內容來源 —— 四項缺任一走 `AskUserQuestion` 問。**輸出尺寸必須在這一步定案**，三版共用；不統一就無法橫向比較。
     > **輸出尺寸是「截圖用的視口」，不是「固定畫板」。** 產出必須**填滿瀏覽器視窗**（`100vw` / `100vh` 或等效），視窗比該尺寸大就跟著長大、不留黑邊。
   - **設計路徑已於 `brainstorm` 0c/0d 合併確認第 3 題選定**（出三版／跳過三方向）；走到本 skill 就是選了出三版，**此處不重複問**。本步只對齊上面那四項假設。
   > **豁免一律來自那個選單，不得從對話文字推斷。**
3. 依 `design.precedent` 決定**可變維度**（見 §可變維度）。
4. 圖片前置：判斷圖片是不是**內容必需**（判準見 §圖片是不是必需）。必需就先取齊真圖，三版共用同一批。
5. **並行 spawn 3 個 subagent**，各產一版真實視覺（見 §三個 subagent 的跑法）。
6. 三版一起攤出來，走 `AskUserQuestion` 讓 user 選（見 §選定與落檔）。
7. 定案方向 ＋ user 選擇原話回寫 `spec.md`。

**落檔時機（硬規則）**：本 skill 寫的檔（3 份 HTML ＋ 3 張截圖 ＋ 回寫 `spec.md`）**全部落在 `docs/work/<branch-name>/` 底下，必須 branch 已建立**。Phase 0 期間仍在 `main`，`hooks/branch-safety.ps1` 會 `exit 2` 擋掉。`<branch-name>` 的解析沿用 `frontend-test` §branch-name fallback 鏈（feature branch → `task-<id>` → `manual-<sha>`），`/` 保留為目錄層。

**禁止**：
- 讓 user 在「只有文字、沒看到真實視覺」時選方向——沒有依據的選擇是無效的
- 自行選定後繼續執行（含 autonomous / 無人值守情境）
- 從對話文字推斷 user 想跳過（違反 rules.md §決策點選單「**禁文字 token NLP**」）

---

## §對外契約

**輸入**：

```yaml
design:                      # 來自 brainstorm 0b′，見 design-language §對外契約
  involved: true
  scope: <區塊名|null>
  scope_evidence: <path|null>
  size: 大改
  precedent: <bool>
  map_status: <ok|remapped|absent|unknown|pending>
design_language_summary: <design-language §設計語言抽取 的六類輸出|null>
alignment:
  audience: <目標受眾>
  core_message: <核心訊息>
  output_size: <寬,高>
  content_source: <真實內容從哪來>
```

**輸出**：

```yaml
design_demos_dir: docs/work/<branch-name>/design-demos/   # 3 HTML + 3 截圖，不進版控
direction_decided: <定案方向的文字描述>                     # 回寫 spec.md
user_choice_quote: <user 選擇原話>                         # 回寫 spec.md
```

**`scope=null` 時**（`map_status` 為 `absent` / `remapped`）：`design_language_summary` 為 null，走 `precedent=false` 路徑，改以風格庫選出的三個方向為共用輸入。

**截圖驗完即刪**（D14），所以 `spec.md` 記的是 `direction_decided` 與 `user_choice_quote` 兩段文字，**不得以截圖路徑作為事後追溯依據**。

---

## §檔案路徑解析

本 skill 是多檔結構（`references/` / `assets/` / `scripts/`）。**本節路徑相對於本 skill 目錄**：

- plugin 安裝時：`${CLAUDE_PLUGIN_ROOT}/skills/design-direction/<相對路徑>`
- repo 內開發時：`<repo>/skills/design-direction/<相對路徑>`

Read 工具需要絕對路徑，**引用 reference 前先解析成絕對路徑**。解析不到就明說解析不到，**不要拿 SKILL.md 的摘要當作已讀過細則**。

---

## §適用邊界

**適用**：這個專案裡要新增或改版的**介面**——新頁、新區塊、既有區塊的視覺改版。

**不適用**：
- `design.size=小改`（沿用既有 token、無新視覺決策）→ 由 `design-language` §對齊檢查清單 承接
- 純後端 / 無 DOM 改動
- 一次性的簡報、資訊圖、動畫、影片——本 skill 不涵蓋這些產線

---

## §核心哲學

依優先序，衝突時上位者勝。

**1. 從既有 context 長出來，不憑空畫**
`design.precedent=true` 時設計語言已由 `design-language` 抄出 exact values——**用那些值，不要臨場發明**。

**2. 先對齊假設，再動手做**
四項對齊（受眾 / 核心訊息 / 輸出尺寸 / 內容來源）是 §使用契約 第 2 步，不是選配。**理解錯了早改比晚改便宜得多。**

**3. 給 variations，不給「最終答案」**
交三個跨不同維度的版本，讓 user 能 mix and match（「A 版的結構 ＋ B 版的層級」是合法選擇）。

**4. Placeholder 優於爛實現**
沒圖示就留灰色方塊 ＋ 文字標籤，別畫爛 SVG。沒資料就寫註解說明等真資料，別編造看起來像資料的假數字。**一個誠實的 placeholder 比一個拙劣的真實嘗試好。**

**5. 系統優先，不要填充**
每個元素都要 earn its place。空白是設計問題，用構圖解決。特別警惕三種填充：沒用的數字與 stats、每個標題都配 icon、所有背景都上漸層。

---

## §反 AI slop

**什麼是 slop**：AI 訓練語料裡最常見的「視覺最大公約數」。它們之所以是 slop，不是因為本身醜，而是**不攜帶任何品牌資訊**——用了等於把這個產品稀釋成「又一個 AI 做的頁面」。

| 元素 | 為什麼是 slop | 什麼情況可以用 |
|---|---|---|
| 激進紫色漸層 | 「科技感」的萬能公式，出現在每一個 SaaS / AI 落地頁 | 該區設計語言本來就用紫漸層 |
| Emoji 當圖示 | 「不夠專業就用 emoji 湊」的病 | 該區既有元件本來就這樣用 |
| 圓角卡片 ＋ 左彩色 border accent | 2020-2024 時期的爛大街組合，已成視覺噪音 | user 明確要求，或該組合在既有設計語言裡 |
| SVG 手畫人物 / 場景 | AI 畫的 SVG 人物永遠五官錯位、比例詭異 | 幾乎沒有——有圖用真圖，沒圖留誠實 placeholder |
| Inter / Roboto / Arial 當 display | 太常見，讀者分不出「有設計」還是「demo 頁」 | 該區設計語言明訂用這些 |
| 均勻深藍底 ＋ 通用青紫霓虹 glow | 這**一種特定組合**是爛大街複製 | 開發者工具產品且該區本來走這方向 |

**唯一合法的破例理由是「該區設計語言本來就這樣」**——此時它不是 slop，是既有風格。

**別把整片暗色一起誤殺**：要禁的只是「均勻深藍底 ＋ 通用霓虹」這一種偷懶解。有作者意圖的暗色不在禁區。

**正向做什麼**：
- `text-wrap: pretty`、CSS Grid、container queries 這類排版細節——會用這些的產出看起來像有人設計過
- **不憑空發明新顏色**：用 `design-language` 抄出來的值，或從中推導
- 一個細節做到 120%，其餘做到 80%——品味是在對的地方用力，不是均勻用力

完整清單見 `references/content-guidelines.md`。

---

## §技術紅線

三版 mockup 用 HTML ＋ inline React + Babel 時，以下不可違反（**細節與實際的 script 標籤見 `references/react-setup.md`**）：

1. **不要**寫 `const styles = {...}`——多元件時命名衝突會炸。**必須**給唯一名字（`heroStyles`）
2. **多個 `<script type="text/babel">` 之間 scope 不共享**，必須用 `Object.assign(window, {...})` 導出
3. **不要**用 `scrollIntoView`——會破壞容器捲動
4. React / Babel 一律用 **pinned 版本 ＋ `integrity` hash**。那六個 sha384 值在 `references/react-setup.md`，**產 HTML 的 subagent 必須先讀那個檔**——自己生不出來，省略 `integrity` 等於拿掉 CDN 被劫持時的唯一防線

**可讀性硬底線（任何風格都不豁免）**：正文 ≥14px、行動端 ≥16px、標籤 ≥12px、正文對比度 ≥4.5:1、hit target ≥44×44。留白必須是**構圖**（首屏有明確視覺錨點），不是內容缺席。

---

## §可變維度

三版要差在哪，取決於 `design.precedent`：

| `precedent` | 鎖死 | 可變 |
|---|---|---|
| **`true`**（該區有可繼承的設計語言） | 色彩 token / 字型 / 元件庫（用 `design-language` 抄出的 exact values） | 版面結構、資訊層級、互動模式 |
| **`false`**（0→1 或全新區塊、無先例） | —— | 連設計語言本身一起變 |

**`precedent=true` 時的硬要求**：三版的**骨架必須互異**——導航 / 構圖 / 內容區結構至少一項結構性不同。**不許兩版共用同一骨架只換色換字型**，那會被一眼看穿是換皮。

**`precedent=false` 時**：從 `references/design-styles.md` §網頁風格庫 取三個差異化方向。

**兩條路徑都要讀**：`references/design-styles.md` §色彩推導協議——它的標題就是「用任何風格前先走這三步」，決定色彩時一律適用。

---

## §圖片是不是必需

§使用契約 第 4 步的判準：

| 內容類型 | 判定 |
|---|---|
| 介紹一個具體事物（產品 / 地點 / 人物 / 生物 / 歷史） | 圖片**內容必需** |
| 工具 / 資料 / 文件 / 純觀點型 | 可能不需要 |
| 拿不準 | **按內容必需處理**（寧可取真圖） |

**真圖誠實性測試**：「去掉這張圖，資訊是否有損？」有損才用。無損 = 裝飾 = slop，不加。

**取圖**：`scripts/fetch_images.py`（Wikimedia Commons 公共領域）。取材原則：搜尋 5 輪、找到 10 個素材、選 2 個好的，每個需 8/10 以上——**寧缺毋濫**，湊數的素材比沒有更糟。

**取不到時三級兜底（不許卡死）**：① 換其他公共領域來源 → ② 標「圖待補」的**誠實 placeholder** 並在三版說明裡註明 → ③ **繼續 spawn 三版，不卡流程**。取圖失敗是「降級繼續」，不是停止。

設計裡若要出現**具名的第三方產品或品牌**，另走 `references/brand-asset-protocol.md`。
**取到的 logo / 產品圖與截圖同處理**：落 `docs/work/<branch-name>/design-demos/assets/`（不進版控），並把**資產清單與來源網址**寫進 `spec.md` 的設計方向段落——路徑會隨 branch 消失，來源記錄才留得住。三個 subagent 共用同一批。

---

## §三個 subagent 的跑法

**用 subagent 平行，不開 Agent Teams，也不問 user。**

依據 rules.md §協作模式判定三判準：可切 3 塊 ✓、不同檔（`design-demos/*.html`）✓、T2+ ✓，但判準 2「工作者之間需要互相反駁或交換發現」**明確不成立**——三版必須**獨立 context、互不參考**才不會趨同。§協作模式判定 也明訂「唯讀 fan-out 一律 subagent、不開隊友也不問」。

**spawn 範本**（三個各一，只換 `<方向名>` 與可變維度的指派）：

```yaml
Agent:
  description: "design-direction 方向 <方向名>"
  subagent_type: general-purpose
  prompt: |
    你要產出一版真實的設計視覺（純 HTML/CSS，必要時 inline React）。

    **開工前必讀**（用絕對路徑 Read，讀不到就說讀不到、不要憑摘要做）：
    - <skill 絕對路徑>/references/content-guidelines.md   # 反 slop 與可讀性底線
    - <skill 絕對路徑>/references/typography.md            # 字型配對
    - <skill 絕對路徑>/references/react-setup.md           # 用 inline React 時必讀，含 6 個 integrity hash
    - <skill 絕對路徑>/references/design-styles.md §色彩推導協議   # 一律讀（決定色彩就要）
    - <skill 絕對路徑>/references/design-styles.md §網頁風格庫     # 僅 precedent=false 時

    設計語言（必須照抄 exact values，不得臨場發明）：<design_language_summary>
    對齊假設：受眾 <audience> / 核心訊息 <core_message> / 輸出尺寸 <output_size>
    真實內容：<content_source 提供的實際文字，不是 Lorem>
    真圖：<共用的那批圖，或「無，用誠實 placeholder」>
    你這一版的可變維度指派：<結構 / 層級 / 互動 三選一的具體方向>

    產出：
    1. 一份 HTML 落 docs/work/<branch>/design-demos/<方向名>.html
    2. 一句話說明「本版的骨架差在哪」（導航 / 構圖 / 內容區結構挑一項）

    禁止參考其他兩版；禁止 Lorem；禁止發明新顏色。
```

**截圖**（`--viewport-size` **必須帶引號**——PowerShell 下逗號會被當參數分隔，實測回 `Invalid viewport size format`）：

```bash
npx playwright screenshot "file:///<絕對路徑>.html" "<輸出>.png" "--viewport-size=<output_size>"
```

> 實測本機可跑（browser binary 來自 `@playwright/mcp` 安裝的副產物）。**沒有 playwright CLI 時改用 `frontend-test`**，不要現場下載。

**產出自檢（進 §選定與落檔 前必查）**：
- `design-demos/` 下真的有 **3 個 `.html`**。少於 3 個 = 沒跑完，補齊再往下
- **三版各有一句「骨架差在哪」，且三句不是在講同一件事**。三句雷同 = 換皮，退回重產
- **沒有任何一版把自己釘在固定畫板上**：`grep -E 'width: *(1440|1280|1920)px' *.html` 應為零命中。命中 = 該版在大螢幕上會有信箱框，退回改成填滿視口

---

## §選定與落檔

**三版全部完成後一起攤出來**，每版標明：可變維度上做了什麼選擇、骨架差在哪、一句話說為什麼。並排展示用 `assets/design_canvas.jsx`（讀取內容 → inline 進一份展示 HTML 的 `<script>` 標籤 → 把三版 slot 進去）。

**走 `AskUserQuestion`**（rules.md §決策點選單；**禁文字 token NLP**——不得從對話裡的「就這個吧」「不錯」推斷選擇）：

1. A 版 —— `<骨架差異一句話>`
2. B 版 —— `<骨架差異一句話>`
3. C 版 —— `<骨架差異一句話>`
4. 混合（選了之後我再問你要取哪版的哪部分）
5. 都不對，重跑三版

> **本選單刻意不標推薦**：三版是等價的，標其中一版等於預先替 user 做選擇，違背 §核心哲學 3。rules.md §決策點選單 的「推薦選項放第一」規則在此不適用。

**重跑上限**：同一次 task 內**最多重跑 1 次**。第 2 次仍全否 → 走 `AskUserQuestion`：① 改由 user 描述想要的方向、我做一版 ② 退回 `brainstorm` 重釐清需求 ③ 暫停。三版重跑的成本是 3 個 subagent ＋ 截圖，不設上限會無限迴圈。

**落檔**：
- 三份 HTML ＋ 截圖 → `docs/work/<branch-name>/design-demos/`，**不進版控**
- **截圖驗完即刪** —— 所以 `spec.md` 記的是 `direction_decided`（定案方向的文字描述）與 `user_choice_quote`（user 原話）
- 回寫 `spec.md` 的「設計方向」段落

**豁免**：設計路徑在 `brainstorm` 合併確認第 3 題已選定，此處不重複問。選了「跳過三方向」的 task 根本不會走到本 skill。豁免要記進 `spec.md`。

---

## §評審

user 提「評審 / 好不好看 / 打分」，或你對產出有疑慮想主動質檢時，按 `references/critique-guide.md` 走 **6 維度**評分，各 0-10：

| 維 | 名稱 | 備註 |
|---|---|---|
| 0 | **概念 / 立意** | **權重最高**，且有一票否決：概念 ≤5 分時總評封頂 6.0 |
| 1 | 哲學一致性 | `precedent=false` 走風格庫時才有明確輸入；否則以該區設計語言為對照 |
| 2 | 視覺層級 | |
| 3 | 細節執行 | |
| 4 | 功能性 | |
| 5 | 創新性 | |

輸出：總評 ＋ Keep（做得好的）＋ Fix（分致命 / 重要 / 優化）＋ 5 分鐘內能做的前 3 件事。

**評設計，不評設計師。**

---

## §References 路由

路徑解析見 §檔案路徑解析。分**必讀**與**條件讀**兩塊——條件讀那塊的條件都是可機械判斷的。

**必讀**（每次三方向都要）：

| 檔 | 為什麼 |
|---|---|
| `references/content-guidelines.md` | 反 slop 與可讀性底線，每一版都要對 |
| `references/typography.md` | 每一版都要選字型 |

**條件讀**：

| 條件 | 讀 |
|---|---|
| `precedent=false`（要從風格庫取方向） | `references/design-styles.md` §網頁風格庫 |
| 決定色彩時（兩條路徑都適用） | `references/design-styles.md` §色彩推導協議 |
| 三版要用 inline React + Babel | `references/react-setup.md`（**含 6 個 integrity hash，subagent 必讀**） |
| 走 §評審 | `references/critique-guide.md` |
| 設計裡要出現具名的第三方產品 / 品牌 | `references/brand-asset-protocol.md` |

| 資產 | 用途 |
|---|---|
| `assets/design_canvas.jsx` | 三版並排展示的網格版面（讀內容 → inline 進展示 HTML） |
| `scripts/fetch_images.py` | 從 Wikimedia Commons 取公共領域真圖 |

---

## §與 dev-workflow 銜接

| 呼叫端 | 何時 | 期待輸出 |
|---|---|---|
| user 顯式呼叫 | 「出三版看看」「這個要改版」 | 三版 ＋ 選定結果回寫 `spec.md` |
| `brainstorm` | 合併確認第 3 題選「出三版」，且 branch 已建立、`spec.md` 已落檔 | 同上 |

**上游**：`design-language`（供給設計語言）。**下游**：T3 → `write-plan`（依定案方向拆 task）；T2 → 回 `brainstorm` 3.5 依方向回寫 `## 施工清單` 後交 execute-plan。

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「需求很清楚，直接做一版就好」 | 大改一律三版；豁免只能來自選單選項 |
| 「先給文字方案讓 user 選方向」 | 沒看到真實視覺的選擇是無效的選擇 |
| 「三版換個色換個字型就好」 | `precedent=true` 時骨架必須互異；三句「骨架差在哪」雷同就是換皮 |
| 「三個 subagent 讓它們互相看一下比較一致」 | 獨立 context 是產出價值本身；趨同就白跑了 |
| 「user 說『這個不錯』就是選 A 版」 | 禁文字 token NLP；一律走 `AskUserQuestion` |
| 「reference 讀不到就先照 SKILL.md 的摘要做」 | 摘要不是細則。讀不到就說讀不到——尤其 `integrity` hash 自己生不出來 |
| 「截圖路徑寫進 spec 就好」 | 截圖驗完即刪；spec 記文字描述與 user 原話 |
| 「先開 Agent Teams 跑三版比較快」 | 三判準的第 2 條不成立；subagent 平行即可，不問也不開 |
| 「輸出尺寸之後再說」 | 尺寸是 §使用契約 第 2 步的產物；三版不同尺寸就無法橫向比較 |
| 「都不對，那就一直重跑」 | 重跑上限 1 次，之後走選單改路徑 |
