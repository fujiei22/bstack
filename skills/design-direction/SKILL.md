---
name: design-direction
description: |
  定新設計方向（繁中）：三方向真實視覺讓 user 選、反 AI slop、6 維度評審。
  載入：brainstorm 合併確認選「出三版」且 branch 已建、spec 已落檔；亦可顯式要求。既有設計語言查 design-language；改完驗畫面用 frontend-test。
  下游：T3 → write-plan；T2 → 回 `brainstorm` 3.5 回寫施工清單。
---

# design-direction

`design.size=大改` 時，產出三個差異化方向讓 user 選。**你不是在寫 HTML，你是在做設計決策**——交付標準是「看得出有人做過選擇」，不是「能跑」。

## 使用契約（強制）

**載入前提**：`design.size=大改`，且設計語言由 `design-language` 供給（本 skill 不自己抽 token）。**載入後依序執行**：

1. 讀 §對外契約 的輸入欄位。
2. **對齊假設 ＋ 確認設計路徑**：
   - 受眾 / 核心訊息 / **輸出尺寸** / 真實內容來源，缺任一走 `AskUserQuestion` 問。**輸出尺寸在這一步定案**、三版共用才能橫向比較；它是**截圖用的視口**，產出必須**填滿瀏覽器視窗**（`100vw` / `100vh` 或等效）、不留黑邊。
   - **設計路徑已於 `brainstorm` 0c/0d 合併確認第 3 題選定**（出三版／跳過三方向）；走到本 skill 就是選了出三版，**此處不重複問**。本步只對齊上面那四項假設。
3. 依 `design.precedent` 決定**可變維度**（見 §可變維度）。
4. 圖片前置：判斷圖片是不是**內容必需**（判準見 §圖片是不是必需）。必需就先取齊真圖，三版共用同一批。
5. **並行 spawn 3 個 subagent**，各產一版真實視覺（見 §三個 subagent 的跑法）。
6. 三版一起攤出來，走 `AskUserQuestion` 讓 user 選（見 §選定與落檔）。
7. 定案方向 ＋ user 選擇原話回寫 `spec.md`。

**落檔時機（硬規則）**：3 份 HTML ＋ 3 張截圖 ＋ 回寫 `spec.md` 全落 `docs/work/<branch-name>/` 底下，**必須 branch 已建立**——Phase 0 仍在 `main`，`hooks/guard.mjs`（branch-safety 段）會 `exit 2` 擋掉。`<branch-name>` 沿用 `frontend-test` §branch-name fallback 鏈（feature branch → `task-<id>` → `manual-<sha>`），`/` 保留為目錄層。

**禁止**：user 沒看到真實視覺就選方向（沒依據的選擇無效）；自行選定後繼續執行（含 autonomous / 無人值守）；從對話文字推斷 user 想跳過（違反 rules.md §決策點選單「**禁文字 token NLP**」，豁免只來自那個選單）。

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

**`scope=null` 時**（`map_status` 為 `absent` / `remapped`）：`design_language_summary` 為 null，走 `precedent=false` 路徑，以風格庫三方向為共用輸入。截圖驗完即刪（D14），**不得以截圖路徑作事後追溯依據**。

## §檔案路徑解析

本 skill 是多檔結構（`references/` / `assets/` / `scripts/`），路徑相對於本 skill 目錄：plugin 安裝時 `${CLAUDE_PLUGIN_ROOT}/skills/design-direction/<相對路徑>`，repo 內開發時 `<repo>/skills/design-direction/<相對路徑>`。Read 需絕對路徑，引用前先解析；解析不到就明說，**不要拿 SKILL.md 的摘要當作已讀過細則**。

## §適用邊界

**適用**：新頁、新區塊、既有區塊的視覺改版。**不適用**：`design.size=小改`（由 `design-language` §對齊檢查清單 承接）、純後端 / 無 DOM 改動、簡報 / 資訊圖 / 動畫 / 影片產線。

## §核心哲學

依優先序，衝突時上位者勝。

1. **從既有 context 長出來，不憑空畫**：`design.precedent=true` 時用 `design-language` 抄出的 exact values，**不臨場發明**。
2. **先對齊假設，再動手做**：四項對齊是 §使用契約 第 2 步，不是選配；理解錯了早改比晚改便宜。
3. **給 variations，不給「最終答案」**：三版跨不同維度，讓 user 能 mix and match（「A 版結構 ＋ B 版層級」是合法選擇）。
4. **Placeholder 優於爛實現**：沒圖示留灰方塊 ＋ 文字標籤，沒資料寫註解等真資料；**誠實的 placeholder 比拙劣的真實嘗試好**。
5. **系統優先，不要填充**：每個元素都要 earn its place；警惕沒用的 stats、每個標題配 icon、所有背景上漸層。

## §反 AI slop

**什麼是 slop**：AI 語料裡的「視覺最大公約數」——問題不在醜，是**不攜帶任何品牌資訊**，用了等於把產品稀釋成「又一個 AI 做的頁面」。

| 元素 | 為什麼是 slop | 什麼情況可以用 |
|---|---|---|
| 激進紫色漸層 | 「科技感」的萬能公式，出現在每一個 SaaS / AI 落地頁 | 該區設計語言本來就用紫漸層 |
| Emoji 當圖示 | 「不夠專業就用 emoji 湊」的病 | 該區既有元件本來就這樣用 |
| 圓角卡片 ＋ 左彩色 border accent | 2020-2024 時期的爛大街組合，已成視覺噪音 | user 明確要求，或該組合在既有設計語言裡 |
| SVG 手畫人物 / 場景 | AI 畫的 SVG 人物永遠五官錯位、比例詭異 | 幾乎沒有——有圖用真圖，沒圖留誠實 placeholder |
| Inter / Roboto / Arial 當 display | 太常見，讀者分不出「有設計」還是「demo 頁」 | 該區設計語言明訂用這些 |
| 均勻深藍底 ＋ 通用青紫霓虹 glow | 這**一種特定組合**是爛大街複製 | 開發者工具產品且該區本來走這方向 |

**唯一合法的破例是「該區設計語言本來就這樣」**。**別誤殺整片暗色**：禁的只是「均勻深藍底 ＋ 通用霓虹」這一種偷懶解。

**正向做什麼**（完整清單見 `references/content-guidelines.md`）：
- `text-wrap: pretty`、CSS Grid、container queries 這類排版細節——看起來像有人設計過
- **不憑空發明新顏色**：用 `design-language` 抄出的值，或從中推導
- 一個細節做到 120%、其餘 80%——品味是在對的地方用力

## §技術紅線

三版 mockup 用 HTML ＋ inline React + Babel 時不可違反（script 標籤細節見 `references/react-setup.md`）：

1. **不要**寫 `const styles = {...}`——多元件命名衝突會炸，**必須**給唯一名字（`heroStyles`）
2. **多個 `<script type="text/babel">` 之間 scope 不共享**，用 `Object.assign(window, {...})` 導出
3. **不要**用 `scrollIntoView`——會破壞容器捲動
4. React / Babel 一律 **pinned 版本 ＋ `integrity` hash**；六個 sha384 值在 `references/react-setup.md`，**產 HTML 的 subagent 必須先讀**（自己生不出來）——省略 `integrity` 等於拿掉 CDN 被劫持時的唯一防線

**可讀性硬底線（任何風格都不豁免）**：正文 ≥14px、行動端 ≥16px、標籤 ≥12px、對比度 ≥4.5:1、hit target ≥44×44；留白必須是**構圖**（首屏有視覺錨點），不是內容缺席。

## §可變維度

三版要差在哪，取決於 `design.precedent`：

| `precedent` | 鎖死 | 可變 |
|---|---|---|
| **`true`**（該區有可繼承的設計語言） | 色彩 token / 字型 / 元件庫（用 `design-language` 抄出的 exact values） | 版面結構、資訊層級、互動模式 |
| **`false`**（0→1 或全新區塊、無先例） | —— | 連設計語言本身一起變 |

**`precedent=true` 硬要求**：三版**骨架必須互異**——導航 / 構圖 / 內容區結構至少一項結構性不同；**不許只換色換字型**，一眼看穿是換皮。
**`precedent=false`**：從 `references/design-styles.md` §網頁風格庫 取三個差異化方向；**兩條路徑都要讀**同檔 §色彩推導協議。

## §圖片是不是必需

§使用契約 第 4 步的判準：

| 內容類型 | 判定 |
|---|---|
| 介紹一個具體事物（產品 / 地點 / 人物 / 生物 / 歷史） | 圖片**內容必需** |
| 工具 / 資料 / 文件 / 純觀點型 | 可能不需要 |
| 拿不準 | **按內容必需處理**（寧可取真圖） |

**真圖誠實性測試**：「去掉這張圖，資訊是否有損？」有損才用；無損 = 裝飾 = slop。
**取圖**：`scripts/fetch_images.py`（Wikimedia Commons 公共領域），搜 5 輪、找 10 個、選 2 個、每個 8/10 以上——**寧缺毋濫**。**取不到時三級兜底（不許卡死）**：① 換其他公共領域來源 → ② 標「圖待補」的**誠實 placeholder** 並在三版說明註明 → ③ **繼續 spawn 三版**，降級不停止。
**具名第三方產品 / 品牌**另走 `references/brand-asset-protocol.md`；取到的 logo / 產品圖同截圖處理：落 `docs/work/<branch-name>/design-demos/assets/`（不進版控），**資產清單與來源網址**寫進 `spec.md`——路徑隨 branch 消失，來源才留得住；三個 subagent 共用。

## §三個 subagent 的跑法

**用 subagent 平行，不開 Agent Teams，也不問 user**：rules.md §協作模式判定 判準 1、3 成立（3 塊、不同檔 `design-demos/*.html`、T2+），判準 2「需要互相反駁或交換發現」**不成立**——三版必須**獨立 context、互不參考**才不會趨同；唯讀 fan-out 一律 subagent。

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

**截圖**（`--viewport-size` **必須帶引號**，PowerShell 下逗號會被當參數分隔、實測回 `Invalid viewport size format`）：

```bash
npx playwright screenshot "file:///<絕對路徑>.html" "<輸出>.png" "--viewport-size=<output_size>"
```

> 為什麼沒 playwright CLI 就改用 `frontend-test`：本機能跑靠的是 `@playwright/mcp` 附帶的 browser binary、不保證有；不做會卡在現場下載，流程停擺。

**產出自檢（進 §選定與落檔 前必查）**：`design-demos/` 下有 **3 個 `.html`**（少於 3 = 沒跑完，補齊）；三句「骨架差在哪」不是講同一件事（雷同 = 換皮，退回重產）；`grep -E 'width: *(1440|1280|1920)px' *.html` 零命中（命中 = 大螢幕有信箱框，退回改成填滿視口）。

## §選定與落檔

**三版全部完成後一起攤出來**，每版標明可變維度上的選擇、骨架差在哪、為什麼；並排展示用 `assets/design_canvas.jsx`（讀內容 → inline 進展示 HTML 的 `<script>` → 三版 slot 進去）。

**走 `AskUserQuestion`**（rules.md §決策點選單；**禁文字 token NLP**，不得從「就這個吧」「不錯」推斷選擇）：

1. A 版 —— `<骨架差異一句話>`
2. B 版 —— `<骨架差異一句話>`
3. C 版 —— `<骨架差異一句話>`
4. 混合（選了之後我再問你要取哪版的哪部分）
5. 都不對，重跑三版

> **本選單刻意不標推薦**：三版等價，標一版等於替 user 預選，違背 §核心哲學 3；「推薦選項放第一」在此不適用。

**重跑上限**：同一 task **最多重跑 1 次**；第 2 次仍全否 → 走 `AskUserQuestion`：① 改由 user 描述方向、我做一版 ② 退回 `brainstorm` 重釐清 ③ 暫停。不設上限會無限迴圈。
**落檔**：三份 HTML ＋ 截圖 → `docs/work/<branch-name>/design-demos/`，**不進版控**；**截圖驗完即刪**，`spec.md` 「設計方向」段落記 `direction_decided` 與 `user_choice_quote`。
**豁免**：只來自 `brainstorm` 合併確認第 3 題（見 §使用契約 第 2 步），記進 `spec.md`；選「跳過三方向」的 task 不會走到本 skill。

## §評審

user 提「評審 / 好不好看 / 打分」或你想主動質檢時，按 `references/critique-guide.md` 走 **6 維度**評分，各 0-10：**概念 / 立意**（**權重最高**、一票否決：≤5 分時總評封頂 6.0）、哲學一致性（`precedent=false` 走風格庫時才有明確輸入，否則以該區設計語言為對照）、視覺層級、細節執行、功能性、創新性。
輸出：總評 ＋ Keep ＋ Fix（分致命 / 重要 / 優化）＋ 5 分鐘內能做的前 3 件事。**評設計，不評設計師。**

## §References 路由

**必讀**（每次都要）：

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

**資產**：

| 資產 | 用途 |
|---|---|
| `assets/design_canvas.jsx` | 三版並排展示的網格版面（讀內容 → inline 進展示 HTML） |
| `scripts/fetch_images.py` | 從 Wikimedia Commons 取公共領域真圖 |

## §與 dev-workflow 銜接

**上游**：`design-language`（供給設計語言）。**下游**：T3 → `write-plan`（依定案方向拆 task）；T2 → 回 `brainstorm` 3.5 依方向回寫 `## 施工清單` 後交 execute-plan。

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「直接做一版」「先給文字方案讓 user 選」 | 大改一律三版真實視覺，沒看到視覺的選擇無效；豁免只來自選單 |
| 「換色換字型就好」「尺寸之後再說」 | `precedent=true` 骨架必須互異，三句雷同就是換皮；尺寸是第 2 步產物，不同就無法橫向比較 |
| 「三個 subagent 互相看一下」「開 Agent Teams 跑」 | 獨立 context 是產出價值本身；判準 2 不成立，subagent 平行即可、不問不開 |
| 「user 說『不錯』就是選 A」「都不對就一直重跑」 | 禁文字 token NLP，一律走 `AskUserQuestion`；重跑上限 1 次，之後走選單改路徑 |
| 「reference 讀不到照摘要做」「截圖路徑寫進 spec」 | 摘要不是細則，`integrity` hash 自己生不出來；截圖驗完即刪，spec 記文字與 user 原話 |
