# Typography：排印推理系統

> **這不是字型清單，是配對與排版的推理規則。** `design-styles.md` 已經給了各風格各自的字型名；本文回答的是「為什麼這樣配」「拿到任意內容怎麼推導出字級／行長／字重」。目標：同一個風格標籤，落到不同內容上，能推導出不同的排印結果，而不是每次都抄同一套字級。
>
> 前置紀律不變：該區已有設計語言時，先沿用它既有的字型（抽取方式見 `design-language` §設計語言抽取），本文的一切只在「沒有既有字型規範」時啟用。

## 0. 排印決策順序

拿到內容後按這個順序推，每一步都由上一步決定，不許跳到「直接選個好看的字型」：

1. **內容類型** → 長文閱讀／資料密集／行銷大字／UI 介面，決定音階比例和正文字級
2. **語言構成** → 純中文／中西混排／純西文，決定 fallback 鏈寫法和行高基準
3. **風格溫度**（對齊 `design-styles.md` 的安靜／中性／大膽三檔）→ 決定字型配對的對比度來源
4. **最後才是字型名** → 從下面第 3 章配對表選，或從風格庫對應條目取

為什麼：先選字型名的做法，會讓「內容是什麼」對排印零影響，這正是千人一面的病根。

## 1. 字級音階（modular scale）

字級不是拍腦袋，是從正文字級乘一個固定比例逐級推出來的。比例決定頁面的「戲劇性」：

| 比例 | 名字 | 性格 | 適用 |
|------|------|------|------|
| 1.2 | 小三度 | 平緩、層級多而不吵 | dashboard、文件站、資訊密集 UI |
| 1.25 | 大三度 | 通用、安全 | 大多數網頁、產品落地頁 |
| 1.333 | 純四度 | 標題明顯跳出 | editorial 長文、行銷頁、報告 |
| 1.5 | 純五度 | 戲劇性、層級極少 | 大字報、slides、hero 一屏一句 |

**推導規則**：正文定 16-18px（中文正文建議 17-18px，漢字筆畫密、同字級比西文顯擠），然後按比例上推標題、下推 caption。層級超過 5 檔就是失控，砍掉。

| 檔位 | 1.25 比例下的參考值 | 用途 |
|------|--------------------|------|
| caption | 12-13px | 圖註、meta 資訊、EXIF 式小字 |
| small | 14px | 輔助說明、表格 |
| body | 16-18px | 正文，一切的基準 |
| h3 | ≈1.25x | 小節標題 |
| h2 | ≈1.56x | 章節標題 |
| h1 | ≈1.95x | 頁面標題 |
| display | 3x-8x，脫離音階自由發揮 | hero 巨字，由版面而非音階決定 |

**流式字級寫法**（display 檔必用，避免大螢幕死板、小螢幕溢出）：

```css
/* clamp(最小值, 首選值, 最大值)：首選值 = 基礎 rem + 視口係數 */
h1 { font-size: clamp(2rem, 1.2rem + 3.5vw, 4.5rem); }
.display { font-size: clamp(3rem, 1rem + 9vw, 9rem); }
/* 正文不要 clamp 出大幅波動，16→18 的窄區間即可 */
body { font-size: clamp(1rem, 0.95rem + 0.3vw, 1.125rem); }
```

為什麼 display 脫離音階：hero 巨字是版面元素、不是文字層級，它的尺寸由「占視口幾成」決定，用 vw 推導比用音階推導更合理。

## 2. 行長與行高

### 行長（比字型選擇更影響可讀性）

| 語言 | 舒適區 | CSS 實作 |
|------|--------|----------|
| 西文正文 | 45-75 字元，最佳 66 | `max-width: 65ch` |
| 中文正文 | 一行 22-38 字，最佳 28-32 字 | `max-width: 36em`（em 隨字級縮放） |
| 圖註／側欄 | 更短，中文 15-20 字 | 窄容器天然限制 |

為什麼中文更短：漢字是無空格的緻密方塊字，同寬度下承載的資訊量明顯高於西文，同樣的眼跳次數中文讀進更多內容，行太長回行時找不到下一行開頭。

### 行高隨行長聯動

行高不是常數，是行長的函數。行越長，眼睛回行距離越遠，需要更大的行間距當「軌道」：

| 場景 | 西文 | 中文 |
|------|------|------|
| display 大字（1-2 行） | 0.95-1.1 | 1.1-1.25 |
| 標題（h1-h3） | 1.1-1.3 | 1.3-1.4 |
| 短行正文（<30 字／行） | 1.4-1.5 | 1.6-1.7 |
| 長行正文（接近上限） | 1.6 | 1.8-2.0 |

中文全線比西文高 0.2 左右：漢字是滿格方塊，沒有西文小寫字母之間的天然空隙，行距不足會糊成一片。

### text-wrap（2024+ 瀏覽器都支援了，白拿的排印品質）

```css
h1, h2, h3 { text-wrap: balance; }  /* 標題多行時各行長度均衡，消滅孤字行 */
p { text-wrap: pretty; }            /* 正文消滅行尾孤詞（西文效果明顯，中文輕微） */
```

balance 只用於 ≤4 行的標題（演算法限制 6 行且有效能成本）；pretty 全域給正文無副作用。

## 3. 十組開源字型配對（西文）

配對的三種對比度來源，配之前先想清楚用哪一種：

- **形式對比**：襯線 display × 無襯線 body（最經典，但要 x-height 咬合，否則視覺字級跳）
- **同族咬合**：superfamily 同一設計骨架（零風險，代價是平淡）
- **時代對比**：古典字形 × 現代字形（譜系差 200 年以上才有張力，差 50 年只顯得亂）

| # | 配對（display + body） | 配對邏輯 | 溫度 | 取得 |
|---|------------------------|----------|------|------|
| 1 | Newsreader + Geist | 形式對比：螢幕顯示優化的過渡襯線，x-height 高、與 Geist 咬合好；**Fraunces 的正牌平替** | 安靜 | Google Fonts／官方發布頁 |
| 2 | Source Serif 4 + Source Sans 3 | 同族咬合：同一設計系統，字高字重節奏完全對齊，報告和文件零翻車 | 安靜 | Google Fonts |
| 3 | EB Garamond + IBM Plex Sans | 時代對比：16 世紀法國老襯線 × 2017 理性 grotesque，差 400 年的張力；注意 Garamond x-height 低，同行混用需字級補償（+8% 是經驗起點，系統解法用 `font-size-adjust`，見第 4 章） | 安靜·文氣 | Google Fonts |
| 4 | Lora + Hanken Grotesk | 形式對比：Lora 筆刷感襯線中等反差，螢幕上耐看；Hanken 是 Söhne 氣質的開源近親 | 中性 | Google Fonts |
| 5 | Instrument Serif + Geist | 形式對比：只有 400 一檔字重，天生 display-only，正文必須交給 sans。**正在被 AI 工具用爛的路上**，想顯得獨特的場合要慎用 | 中性 | Google Fonts |
| 6 | Schibsted Grotesk + Source Serif 4 | 反轉結構：grotesque 當 display、襯線當正文，媒體感；**Space Grotesk 氾濫後的平替**（報業客製開源，帶新聞血統） | 中性 | Google Fonts |
| 7 | Bricolage Grotesque + Newsreader | 形式對比：Bricolage 的 ink trap 和不規則細節在大字級才顯現，天生 display；配安靜襯線正文形成粗獷 × 文雅 | 大膽 | Google Fonts |
| 8 | Archivo（Expanded／Black）+ Inter | 大字報結構：Archivo 寬體黑重壓場，Inter 只當 14-16px 正文工蜂（這是 Inter 的正確用法，見反模式） | 大膽 | Google Fonts |
| 9 | Cormorant Garamond + Work Sans | 高反差奢侈感：Cormorant 筆畫極細，**必須 ≥40px 才成立**，小字級筆畫會斷；適合時尚／圖錄風 | 大膽 | Google Fonts |
| 10 | Geist Mono／JetBrains Mono + Geist | 等寬當主角：命令列感、工程感；等寬只用於標籤／編號／程式碼，整段正文用等寬是災難（行長膨脹 30%） | 中性·技術 | 官方發布頁，均 OFL |

**已被用爛名單**（AI 生成頁面的指紋，用了等於自曝）：

| 爛大街 | 為什麼爛 | 平替 |
|--------|----------|------|
| Fraunces 當 display | 近年所有 AI 設計工具的預設「有品味」選項 | Newsreader、Libre Caslon Text |
| Inter 當 display | Inter 是為 UI 小字設計的，大字級下勻質無表情 | Archivo、Anton、Schibsted Grotesk |
| Space Grotesk | 「科技感」的偷懶答案，氾濫於加密／AI 落地頁 | Schibsted Grotesk、Familjen Grotesk |
| Playfair Display | 「優雅」的偷懶答案，婚禮喜帖既視感 | Cormorant（更極端）、DM Serif Display（更憨） |

## 4. 中文排印（本文最重的一章）

西文排印有百年成熟工具鏈，中文沒有。AI 設計工具在中文上集體擺爛（預設交給系統字型、直接套西文規則），這裡是差異化所在。

### 4.1 開源／免費商用中文字型地圖

**先看字集**：`SC` = 簡體字集、`TC` = 繁體字集、`SC+TC` = 兩者皆有對應版本。**繁體內容優先取 TC 版**——拿 SC 版排繁體會缺字，或落到字形不對的 fallback。**取用前一律到官方發布頁確認該版本的字集與授權**，本表只是選型起點。

| 字型 | 字集 | 類別 | 氣質 | 溫度 | 取得 |
|------|------|------|------|------|------|
| 思源宋體（Noto Serif TC／SC） | SC+TC | 宋體／明體 | 出版正統、字重齊全，Heavy 可當 display | 安靜-中性 | Google Fonts，OFL |
| 思源黑體（Noto Sans TC／SC） | SC+TC | 黑體 | 中文界的 Inter：可靠、無表情，當預設正文沒錯但沒個性 | 全溫度兜底 | Google Fonts，OFL |
| 源流明體／源樣明體 | TC | 明朝體 | 思源宋改刻，保留傳統字形細節，**繁體內容的明體首選** | 安靜·古典 | 官方發布頁，OFL |
| 台北黑體 | TC | 黑體 | 圓潤親和的繁體 UI 黑，字形依教育部標準字體，公部門／教育類合適 | 安靜·暖 | 官方發布頁，OFL |
| 芫荽 | TC | 手寫／楷味 | 帶手寫溫度的繁體字型，適合引文與文藝類標題 | 安靜·暖 | 官方發布頁，OFL |
| 霞鶩文楷（含 TC 版） | SC+TC | 楷體 | 手寫溫度、親切，適合文藝／教育／個人部落格正文與引文 | 安靜·暖 | 官方發布頁，OFL |
| 霞鶩新晰黑 | SC 為主 | 黑體 | 比思源黑更瘦更透氣的螢幕黑，正文久讀不累 | 安靜 | 官方發布頁 |
| 得意黑 Smiley Sans | SC 為主 | 斜黑體 | **中文世界罕見的原生斜體**，運動感、標題專用；正文用它會暈。**繁體覆蓋要先驗** | 大膽 | 官方發布頁，OFL |
| 匯文明朝體／京華老宋體 | SC 為主 | 舊字形明朝／老宋 | 老印刷鉛字氣、報頭感，適合書封／文化類 display | 大膽·復古 | 官方發布頁，免費商用 |
| 未來熒黑 Glow Sans | SC+TC | 幾何黑 | 思源黑衍生的現代幾何黑，多寬度（Compressed 可做窄長 display） | 中性-大膽·現代 | 官方發布頁，OFL |

選型推理：**正文只在明體／黑體／楷體裡選**（其餘都是 display 字型，整段用會累）；display 想要個性時才去動斜黑／老宋／明朝體。中文字型一個檔頂西文十個（單檔 5-15MB），一頁最多兩個中文字型家族——為了載入速度和統一性兩個理由。

### 4.2 中西混排規則

**fallback 鏈是第一槓桿**：中文字型自帶的西文字元普遍難看（思源黑的拉丁字母呆板），把西文字型放在前面，拉丁字元和數字被它接住，漢字自動落到後面的中文字型：

```css
/* 西文在前，中文在後，系統中文兜底，泛型收尾 */
font-family: "Geist", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
/* 襯線同理 */
font-family: "Newsreader", "Noto Serif TC", "Songti TC", serif;
```

為什麼是這個順序：font-family 是逐字元比對的，西文字型不含 CJK 碼位，漢字自然穿透到中文字型。反過來寫（中文在前）西文字元全被中文字型吃掉，等於白配。

**字級補償**：同字級下西文小寫視覺偏小（x-height 只占字身一半，漢字占滿）。兩種解法：

```css
/* 解法一：font-size-adjust 讓 fallback 字型按 x-height 歸一 */
:root { font-size-adjust: from-font; }
/* 解法二：選 x-height 高的西文體（Geist／Inter／Source Sans 都高），混排天然齊 */
```

**baseline 對齊**：中西 baseline 不一致時，症狀是英文單字在中文行裡「下沉」。優先換 x-height 更高的西文體；個別 display 場景用 `vertical-align: -0.02em~-0.06em` 微調西文 span，正文別這麼修（維護成本大於收益）。

**數字規則**：數字一律走西文字型（fallback 鏈已保證），資料表格必須加 `font-variant-numeric: tabular-nums`，否則 1 和 8 寬度不同，欄位會抖。

**中英之間的留白**：由 fallback 鏈裡西文字型的字面寬度提供。要不要另外手動加空格，依該專案既有的文字慣例——**先去看那個專案實際怎麼寫，不要憑預設假設**。

### 4.3 中文沒有斜體

中文字形沒有 italic 傳統，瀏覽器遇到 `font-style: italic` 會機械傾斜漢字（faux italic），筆畫變形、極醜。強調手段替換表：

| 西文習慣 | 中文替代 | CSS |
|----------|----------|-----|
| italic 強調 | 換字重 | `font-weight: 600`（前提：字型真有這一檔字重） |
| italic 書名／引用 | 底色高亮 | `background: linear-gradient(transparent 60%, #FFE9A8 60%)` 螢光筆式 |
| italic 引文塊 | 換字型 | 引文整段換楷體，楷體本身就是中文的「引用語氣」 |
| italic 專名 | 顏色／著重號 | `text-emphasis: dot`（著重號，中文原生強調，支援度已可用） |

保險絲：`font-synthesis: none;` 全域禁掉合成斜體和合成加粗，寧可不強調也不接受變形字。

### 4.4 標點規範

| 規則 | 做法 | 為什麼 |
|------|------|--------|
| 引號 | 繁中出版慣例是直角引號「」『』 | 彎引號在中文字型裡是全形占位但形狀是西文的，視覺漂浮。**這一項依該區設計語言而定**，該區已有既定寫法就沿用 |
| 避頭尾 | `line-break: strict;` | 禁止句號逗號出現在行首、開引號出現在行尾，這是中文排版的底線 |
| 標點懸掛 | `hanging-punctuation: first allow-end;`（支援度有限）；跨瀏覽器用 `text-indent: -0.5em` 處理段首開引號 | 段首的開引號不懸掛會讓首行看起來縮排了半格，視覺左邊緣不齊 |
| 連續標點擠壓 | `font-feature-settings: "halt";`（行尾擠壓）或 `"palt"`（全比例寬度，需配合 letter-spacing） | 全形標點連排會出現一個半字寬的空洞，halt 收窄它 |

### 4.5 中文 letter-spacing 區間

| 場景 | 區間 | 為什麼 |
|------|------|--------|
| 正文 | 0 至 0.05em | 微加字距提升透氣度；超過 0.05em 詞的完形被打散，讀速下降 |
| 標題（24-48px） | 0 | 漢字方塊字距天然均勻，不需要西文式 tracking 調整 |
| display 巨字（>60px） | -0.02em 至 0 | 大字級下字面之間的空隙被放大，微收更緊湊；再負就筆畫相撞 |
| 全大寫西文小標籤 | 0.08-0.15em | 唯一需要大正字距的場景，且只對西文大寫生效 |

**中文永遠不要套西文那套「display 收 -0.05em」**：漢字是滿格設計，負字距直接筆畫打架。

### 4.6 中文 display 大字

中文沒有西文那種 Ultra Thin 到 Black 的 display 字型生態，大字的戲劇性要靠推理製造：

- **字重對比是主武器**：明體 Heavy 900 壓 Light 300，同一字型兩個極端字重同屏，比換字型更有張力且零載入成本
- **筆畫密度決定可用字級下限**：筆畫細／反差大的字型只在大字級成立；小於 24px 細筆畫開始斷筆，正文必須回到黑體／中等筆畫
- **反向也成立**：筆畫重的字（黑體 Black、老宋）在超大字級下墨量過大，簡單字與複雜字的墨量差被放大，密度不均的標題考慮換低一檔字重
- **直排是中文獨有的 display 武器**：`writing-mode: vertical-rl` 做書脊式標題、詩詞、目錄，西文做不到；注意直排裡的西文和數字要用 `text-orientation: upright` 或 `text-combine-upright: all`（兩位數字合體直立）

## 5. 反模式清單

| ❌ 反模式 | 為什麼錯 |
|-----------|----------|
| 全場 Inter（display + body 一把梭） | Inter 是 UI 小字工具，當 display 勻質無表情；這是「AI 生成頁面」的頭號指紋 |
| 中文交給 `sans-serif` 系統預設 | Windows 落到微軟正黑、macOS 落到蘋方，同一頁面跨裝置完全兩張臉，等於沒做設計 |
| 繁體內容用 SC 版字型 | 缺字或字形不對（例如「骨」「戶」的寫法差異），讀者一眼看出不對勁 |
| faux italic／faux bold | 瀏覽器合成變形：斜體扭曲漢字，合成加粗把筆畫糊成墨團；用 `font-synthesis: none` 斷根 |
| 大標題字距過鬆 | 西文 display 需要收緊（大字級空隙被放大），AI 常反著來加 +0.05em，標題鬆垮像臨時占位 |
| 行長失控（無 max-width） | 大螢幕上一行 60 個漢字，讀者回行必迷路；可讀性問題裡行長失控排第一，比字型選錯傷害大 |
| 字級檔位 >6 檔 | 層級貶值，讀者分不清什麼重要；音階的意義就是強制克制 |
| 只有 400／700 兩檔字重 | 層級全靠字級撐，頁面平；variable font 時代 300-900 都是免費的表達維度 |
| 表格／資料不用 tabular-nums | 數字寬度不等，欄位左右抖動，資料可信感直接打折 |
| 中文正文用 display 字型（斜黑／老宋整段排） | display 字型的個性在正文裡變成閱讀阻力，200 字後就累 |
| 中西混排把中文字型放 fallback 鏈最前 | 拉丁字元全被中文字型自帶的難看西文吃掉，配好的西文體永遠輪不到出場 |

## 6. CSS 實作要點

```css
:root {
  /* 1. fallback 鏈：西文 → 中文 → 系統中文 → 泛型（順序即規則，見 4.2） */
  --font-body: "Geist", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
  --font-display: "Newsreader", "Noto Serif TC", "Songti TC", serif;

  /* 2. 禁合成：不接受瀏覽器偽造的斜體／加粗（中文場景必開） */
  font-synthesis: none;

  /* 3. 中文斷行底線 */
  line-break: strict;        /* 避頭尾 */
  overflow-wrap: break-word; /* 長 URL／英文串不撐破容器 */
}

body {
  font-family: var(--font-body);
  font-size: 17px;           /* 中文正文基準，見第 1 章 */
  line-height: 1.8;          /* 中文行高基準，見第 2 章 */
  /* 正文開啟標準連字，關閉花俏特性 */
  font-feature-settings: "liga" 1, "calt" 1;
}

/* 資料場景：等寬數字 + 斜槓零（0 和 O 不混淆） */
.data, table { font-variant-numeric: tabular-nums slashed-zero; }

/* 西文小標籤：全大寫 + 大字距的唯一合法場景 */
.label { text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; }

/* 標點擠壓：中文 display 大字裡全形標點的空洞收窄 */
.display-cjk { font-feature-settings: "halt" 1; }
```

**中文字型載入**（單檔 5-15MB，直接引全量會毀掉首屏）：

- 首選 Google Fonts 的 Noto TC／SC 系（已按 unicode-range 自動切成上百個分片，瀏覽器只下載用到的字）
- self-host 個性字型必須先子集化（`cn-font-split` 或 fonttools 的 `pyftsubset`）：正文字型按常用字表切，display 字型按實際出現的字元切（一張海報往往只有 20 個字，子集能壓到 50KB 以內）
- `font-display: swap` 保底——中文字型下載慢，白屏等字型是最差體驗
