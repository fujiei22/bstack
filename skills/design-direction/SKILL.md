---
name: design-direction
description: |
  定設計方向（繁中）。觸發：三方向 / 設計方向 / 出幾版 / 視覺提案 /
  mockup / 改版 / 新頁面 / 新區塊 / 反 slop / 設計評審 / 這樣好不好看。
  涵蓋：三方向硬門、可變維度（有無先例）、三 subagent 並行、產出落檔、
  反 AI slop、React+Babel 技術紅線、6 維度評審。
  分工：既有事實（這區長什麼樣）→ `design-language`；新設計決策 → 本 skill；
  改完要驗畫面 → `frontend-test`。
  上游：`design-language`（供給設計語言）。下游：`write-plan`（依定案方向拆 task）。
  現況：**流程自動載入待階段 B2 接上**，目前僅 user 顯式呼叫。
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
   - **同一個選單問設計路徑**：三版（預設）／單版／一主一變體。**必須在 spawn 之前問**——問在後面等於先燒完三個 subagent 才問要不要三版。
   > 階段 B2 接上流程後，設計路徑會前移到 `brainstorm` 0b′ 的合併選單；在那之前由本 skill 自己問。**豁免一律來自選單，不得從對話文字推斷。**
3. 依 `design.precedent` 決定**可變維度**（見 §可變維度）。
4. 圖片前置：判斷圖片是不是**內容必需**（判準見 §圖片是不是必需）。必需就先取齊真圖，三版共用同一批。
5. **並行 spawn 3 個 subagent**，各產一版真實視覺（見 §三個 subagent 的跑法）。
6. 三版一起攤出來，走 `AskUserQuestion` 讓 user 選（見 §選定與落檔）。
7. 定案方向 ＋ user 選擇原話回寫 `spec.md`。

**落檔時機（硬規則）**：本 skill 寫的檔（3 份 HTML ＋ 3 張截圖 ＋ 回寫 `spec.md`）**全部落在 `docs/work/<branch-name>/` 底下，必須 branch 已建立**。Phase 0 期間仍在 `main`，`hooks/branch-safety.ps1` 會 `exit 2` 擋掉。`<branch-name>` 的解析沿用 `frontend-test` §branch-name fallback 鏈（feature branch → `task-<id>` → `manual-<sha>`），`/` 保留為目錄層。

**禁止**：
- 讓 user 在「只有文字、沒看到真實視覺」時選方向——沒有依據的選擇是無效的
- 自行選定後繼續執行（含 autonomous / 無人值守情境）
- 從對話文字推斷 user 想跳過（違反 CLAUDE.md §決策點選單「**禁文字 token NLP**」）

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

- 全域安裝時：`~/.claude/skills/design-direction/<相對路徑>`
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
