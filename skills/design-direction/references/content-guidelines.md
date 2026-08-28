# Content Guidelines：反 AI slop、內容準則、Scale 規範

AI 設計裡最容易掉進去的陷阱。這是一份「不做什麼」的清單，比「做什麼」更重要——因為 AI slop 是**預設值**，你不主動避開就會發生。

## AI Slop 完整黑名單

### 視覺陷阱

**❌ 激進漸層背景**
- 紫 → 粉 → 藍 全螢幕漸層（AI 生成網頁的典型味道）
- 任何方向的 rainbow gradient
- Mesh gradient 鋪滿背景
- ✅ 真要用漸層：subtle、單色系、有意圖地點綴（例如 button hover）

**❌ 圓角卡片 ＋ 左 border accent 色**
```css
/* 這是 AI 味卡片的典型簽名 */
.card {
  border-radius: 12px;
  border-left: 4px solid #3b82f6;
  padding: 16px;
}
```
這種卡片在 AI 生成的 Dashboard 裡氾濫。想做強調？用更有設計感的方式：背景色對比、字重／字級對比、plain 分隔線，或者乾脆不分卡片。

**❌ Emoji 裝飾**
除非品牌本身就用 emoji，否則不要在介面上放 emoji。**尤其不要**：
- 標題前的 🚀 ⚡️ ✨ 🎯 💡
- Feature 列表的 ✅
- CTA 按鈕裡的 →（箭頭單獨出現 OK，emoji 箭頭不行）

沒圖示就用真的 icon 庫（Lucide／Heroicons／Phosphor），或者用 placeholder。

**❌ 用 SVG 畫 imagery**
不要試圖用 SVG 畫：人物、場景、裝置、物品、抽象藝術。AI 畫的 SVG imagery 一眼就是 AI 味，幼稚且廉價。**一個灰色矩形 ＋「插畫位 1200×800」的文字標籤，比一個拙劣的 SVG hero illustration 強 100 倍**。

唯一可以用 SVG 的場景：
- 真正的 icon（16×16 到 32×32 這個級別）
- 幾何圖形做裝飾元素
- Data viz 的 chart

**❌ 過多 iconography**
不是每個標題／feature／section 都需要 icon。濫用 icon 會讓介面像玩具。Less is more。

**❌ Data slop**
編造的 stats 拿來裝飾：
- 「10,000+ happy customers」（你根本不知道有沒有）
- 「99.9% uptime」（沒有真資料就別寫）
- 用圖示 ＋ 數字 ＋ 詞組成的裝飾用 metric cards
- Mock table 裡的假資料裝點得花花綠綠

沒有真資料就留 placeholder，或者跟 user 要。

**❌ Quote slop**
編造的使用者評價、名人名言拿來裝飾頁面。留 placeholder 跟 user 要真的 quote。

### 字型陷阱

**❌ 避開這些爛大街字型**：
- Inter（AI 生成網頁的預設）
- Roboto
- Arial／Helvetica
- 純 system font stack
- Fraunces（AI 發現這個之後就用濫了）
- Space Grotesk（近期 AI 的最愛）

**✅ 用有特點的 display ＋ body 配對**。靈感方向：
- 襯線 display ＋ 無襯線 body（editorial feel）
- Mono display ＋ sans body（technical feel）
- Heavy display ＋ light body（contrast）
- Variable font 做 hero 的粗細動態

字型資源：
- Google Fonts 的冷門好選項（Instrument Serif、Cormorant、Bricolage Grotesque、JetBrains Mono）
- 開源字型站
- **不要憑空發明字型名**

### 色彩陷阱

**❌ 憑空發明顏色**
不要從頭設計一整套自己不熟的色彩，那通常不和諧。

**✅ 策略**：
1. 有品牌色 → 用品牌色，缺的 color token 用 oklch 內插
2. 沒品牌色但有參考 → 從參考產品截圖吸色
3. 完全從零 → 選一個已知的配色系統（Radix Colors／Tailwind 預設 palette／Material palette），不要自己調

**用 oklch 定義色彩**是最現代的做法：
```css
:root {
  --primary: oklch(0.65 0.18 25);       /* 溫暖的 terracotta */
  --primary-light: oklch(0.85 0.08 25); /* 同色系淺色 */
  --primary-dark: oklch(0.45 0.20 25);  /* 同色系深色 */
}
```
oklch 能保證調整亮度時色相不漂移，比 hsl 好用。

**❌ 夜間模式隨手加反色**
不是單純 invert 顏色。好的 dark mode 需要重新調飽和度、對比度、accent 色。不想做 dark mode 就別做。

### 版面陷阱

**❌ Bento grid 過度氾濫**
每個 AI 生成的 landing page 都想搞 bento。除非你的資訊結構確實適合 bento，否則換別的版面。

**❌ 大 hero ＋ 3-column features ＋ testimonials ＋ CTA**
這個 landing page 樣板被用爛了。想創新就真的創新。

**❌ Card grid 裡每張 card 長一樣**
Asymmetric、不同大小的 cards、有的帶 image 有的只有文字、有的跨欄——這才像真設計師做的。

## 內容準則

### 1. 不要加填充內容

每個元素都必須 earn its place。空白是設計問題，用**構圖**解決（對比、節奏、留白），**不是**靠內容填滿。

**判斷 filler 的三個問題**：
- 如果去掉這段內容，設計會變差嗎？答案若是「不會」，就去掉。
- 這個元素解決了什麼真問題？如果答案是「讓頁面不那麼空」，刪掉。
- 這個 stats／quote／feature 有真資料支持嗎？沒有就不要憑空寫。

「One thousand no's for every yes」。

### 2. 加東西之前先問

你覺得多加一段／一頁／一個 section 會更好？**先問 user，不要單方面加**。

理由：
- user 比你清楚他的受眾
- 加內容有成本，user 可能不想要
- 單方面加內容等於替 user 做了他沒授權的決定

### 3. 先把系統講出來

探索完設計 context 之後，**先用文字說出你要用的系統**，讓 user 確認：

```markdown
我的設計系統：
- 色彩：#1A1A1A 主體 ＋ #F0EEE6 背景 ＋ #D97757 accent（來自你的品牌）
- 字型：Instrument Serif 做 display ＋ Geist Sans 做 body
- 節奏：section title 用 full-bleed 彩色背景 ＋ 白字；一般 section 用白背景
- 圖像：hero 用 full-bleed 照片，feature section 用 placeholder 等你提供
- 最多用 2 種背景色，避免雜亂

確認這個方向我就開始做。
```

user 確認後再動手。這個 check-in 能避免「做完一半才發現方向錯」。

## Scale 規範

### 簡報（1920×1080）

- 正文最小 **24px**，理想 28-36px
- 標題 60-120px
- Section title 80-160px
- Hero headline 可以用 180-240px 的大字
- 永遠不要在簡報上用 <24px 的字

### 印刷文件

- 正文最小 **10pt**（約 13.3px），理想 11-12pt
- 標題 18-36pt
- Caption 8-9pt

### Web 與行動端

- 正文最小 **14px**（要對長輩友善就用 16px）
- 行動端正文 **16px**（避免 iOS 自動縮放）
- Hit target（可點擊元素）最小 **44×44px**
- 行高 1.5-1.7（中文 1.7-1.8）

### 對比度

- 正文 vs 背景 **至少 4.5:1**（WCAG AA）
- 大字 vs 背景 **至少 3:1**
- 用 Chrome DevTools 的 accessibility 工具檢查

## CSS 神器

**進階 CSS 特性**是設計師的好朋友，大膽用：

### 排版

```css
/* 讓標題換行更自然，最後一行不會孤單一個詞 */
h1, h2, h3 { text-wrap: balance; }

/* 正文換行，避免寡婦行與孤兒行 */
p { text-wrap: pretty; }

/* 中文排版神器：標點擠壓、行首行尾控制 */
p {
  text-spacing-trim: space-all;
  hanging-punctuation: first;
}
```

### 版面

```css
/* CSS Grid ＋ named areas ＝ 可讀性爆表 */
.layout {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-columns: 240px 1fr;
  grid-template-rows: auto 1fr auto;
}

/* Subgrid 對齊卡片內容 */
.card { display: grid; grid-template-rows: subgrid; }
```

### 視覺效果

```css
/* 有設計感的捲軸 */
* { scrollbar-width: thin; scrollbar-color: #666 transparent; }

/* 玻璃擬態（克制使用） */
.glass {
  backdrop-filter: blur(20px) saturate(150%);
  background: color-mix(in oklch, white 70%, transparent);
}

/* View transitions API 讓頁面切換滑順 */
@view-transition { navigation: auto; }
```

### 互動

```css
/* :has() 選擇器讓條件樣式變容易 */
.card:has(img) { padding-top: 0; } /* 有圖片的卡片無頂部 padding */

/* container queries 讓元件真的響應式 */
@container (min-width: 500px) { ... }

/* 新的 color-mix 函式 */
.button:hover {
  background: color-mix(in oklch, var(--primary) 85%, black);
}
```

## 決策速查：當你猶豫時

- 想加個漸層？→ 大概率不加
- 想加個 emoji？→ 不加
- 想給卡片加圓角 ＋ border-left accent？→ 不加，換別的方式
- 想用 SVG 畫個 hero 插畫？→ 不畫，用 placeholder
- 想加一段 quote 裝飾？→ 先問 user 有沒有真的 quote
- 想加一排 icon features？→ 先問要不要 icon，可能不需要
- 想用 Inter？→ 換一個更有特點的
- 想用紫色漸層？→ 換一個有根據的配色

**當你覺得「加一下會更好看」的時候——那通常就是 AI slop 的徵兆**。先做最簡的版本，只在 user 要求時才加。
