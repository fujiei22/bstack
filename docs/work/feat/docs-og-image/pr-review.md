# PR #61: feat: docs 站補 OG 圖與 social meta

> URL: https://github.com/fujiei22/bstack/pull/61
> Branch: feat/docs-og-image → main
> Track: Dev | Tier: T2
> 建立: 2026-09-04
> 對應 spec: docs/work/feat/docs-og-image/spec.md
> 對應 plan: docs/work/feat/docs-og-image/plan.md

## 整體脈絡

`https://fujiei22.github.io/bstack/` 貼到 LINE / Slack / FB / X 時只有純文字 title、沒預覽圖，原因是兩頁 `<head>` 完全沒有 `og:*` / `twitter:*` meta，而站上唯一的圖 `favicon.svg` 是 SVG、社群爬蟲不吃。本 PR 做四件事：（1）加一張 1200×630 的 `docs/og.png`，兩頁共用；（2）把產這張圖的原稿 `docs/tools/og-card.html` 進 repo，色值全走 `styles.css` 的 `var(--*)`，站上換配色重產就跟；（3）兩頁 head 各補 14 個 og / twitter meta；（4）契約 `docs-site-contract.mjs` 加 C20a-g 七類守門，把「meta 齊、圖存在、尺寸對、三份文字同文、原稿零色值字面」全變成機械可判的事實。

改 5 個實作檔（2 新、3 改）＋ 3 份施工文件。走 TDD：先 commit 一顆刻意紅的契約（`1e09148`），再依 原稿 → 圖 → meta 順序轉綠。code review 後 1 Major + 4 Minor + 3 Nit 全數修掉、各自一顆 commit。follow-up 只有一項：merge 後到 opengraph.xyz 驗兩頁出圖（無預覽環境）。

本文所有「實測」標記是解釋者在 `feat/docs-og-image` HEAD 重跑得到的：`node docs/tools/docs-site-contract.mjs` ALL PASS；`docs/og.png` 讀 IHDR 為 1200×630、28571 bytes。

## 檔案改動清單

| 檔 | 類型 | 行 +/- | 改動性質 |
|---|---|---|---|
| `docs/og.png` | new | Bin 28571 bytes | 1200×630 PNG，兩頁共用的 OG 圖 |
| `docs/tools/og-card.html` | new | +55/-0 | OG 圖原稿；連 `../css/styles.css`、全 `var(--*)`、檔頭寫重產步驟 |
| `docs/index.html` | edit | +18/-0 | head 加 14 個 og / twitter meta |
| `docs/flow.html` | edit | +17/-0 | head 加 14 個 og / twitter meta，補原本沒有的 `<meta name="description">` |
| `docs/tools/docs-site-contract.mjs` | edit | +104/-2 | 加 C20a-g；檔頭跑法路徑改成現址 |
| `docs/work/feat/docs-og-image/spec.md` | new | +91 | brainstorm 產出 |
| `docs/work/feat/docs-og-image/plan.md` | new | +437 | write-plan 產出，含四項對齊檢查與產圖實測紀錄 |
| `docs/work/feat/docs-og-image/review.md` | new | +82 | plan review（Eng）＋ code review 總結 |

---

## `docs/tools/og-card.html`

### 改動意圖

spec §Success criteria 第 3 條：「OG 卡的原稿進 repo，日後重產不需安裝任何依賴」。這是 `og.png` 的**單一來源**——圖本身是二進位、改不動也 diff 不出來，能維護的是這份 HTML。對應 plan Task 2。

### 改動詳解

#### 區塊 1：檔頭註解＝重產 SOP

```html
<!--
  這是 docs/og.png 的原稿。重產步驟（file:// 或本機 http 開都可；…）：
    1. 用 Playwright 開這個檔（字型走 Google Fonts 要連網）
    2. 等 document.fonts.ready，確認 Newsreader / IBM Plex Sans / Noto Sans TC / IBM Plex Mono 都 loaded
    3. 對 .card 元素截圖、scale=css → 得到 1200×630 的 PNG，存到 docs/og.png
    4. node docs/tools/docs-site-contract.mjs → C20d 綠
  …
  換圖注意：LINE / FB / Slack 按網址快取預覽圖，換了圖要改檔名或在兩頁的 og:image 加 ?v=N
-->
```

- 重產走 Playwright 對 `.card` **元素**截圖、`scale=css`，不是整頁截圖。理由：整頁截圖尺寸受 viewport 與 DPR（裝置像素比，Retina 螢幕是 2）影響，DPR=2 會產出 2400×1260；元素截圖配 `scale=css` 尺寸等於元素 CSS 尺寸、不受 DPR 影響（review.md 實測確認）。
- 「確認四個字型 loaded」的清單是 review 後修的：原 plan 列 Noto Serif TC，但卡上走 `--font-display` 的只有 `bs` / `bstack` 兩個拉丁字串，該字型永遠不會被觸發載入，照原清單等會假停工。
- 快取與 CNAME 兩個風險寫在原稿檔頭而不是 PR body，因為日後換圖的人會先開這個檔、不會去翻 PR。

#### 區塊 2：強制 light 主題

```html
<html lang="zh-Hant" data-theme="light" data-theme-mode="light">
```

- spec §排除：「不出 dark 版 OG 圖，OG 圖不跟系統主題」。`styles.css` 的 dark 值只掛在 `:root[data-theme="dark"]`、沒有 `prefers-color-scheme` media query（review.md 實測），所以寫死 `data-theme="light"` 就足以鎖定，產圖機器的系統主題不會滲進來。

#### 區塊 3：字型與樣式表

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,600&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400&family=Noto+Sans+TC:wght@400;500&display=swap">
<link rel="stylesheet" href="../css/styles.css" />
```

- Google Fonts 請求 4 個字型；commit `e54ee80` 拿掉了原本第 5 個 Noto Serif TC（理由同上，省一次請求）。
- `../css/styles.css` 是相對路徑，這份檔住 `docs/tools/`，所以指到 `docs/css/styles.css`。C20e 用字面 `href="../css/styles.css"` 守這條連結不能斷。

#### 區塊 4：卡片樣式——零色值字面、`.mk` 等比放大

```css
html, body { width: 1200px; height: 630px; }
.card { position: relative; width: 1200px; height: 630px; padding: 84px; … background: var(--paper); color: var(--ink); }
.mk { width: 120px; height: 120px; … border-radius: 9px; background: var(--accent); color: var(--accent-ink);
      font-family: var(--font-display); font-weight: 600; font-size: 57px; letter-spacing: -.02em; }
```

- 所有顏色都是 `var(--paper / --ink / --ink-2 / --ink-3 / --accent / --accent-ink / --rule)`，全部在 `docs/css/styles.css:25-36` 有定義（實測）。這是 rules.md §設計語言對齊「從實際檔案抄 exact values」的落法，也是 C20e 守的事。
- `.mk` 是 `docs/css/landing.css:17-24` 的 `.lrail .mk` 放大 3 倍：40px → 120px、radius 3px → 9px、字級 19px → 57px，letter-spacing `-.02em` 與 `font-weight: 600` 照抄（對照原檔實測，數字吻合）。
- `html, body` 寫死 1200×630 是為了蓋掉 `styles.css` 給 body 的 `height: 100%`；`.card` 的 `padding: 84px` 靠 styles.css 的 `box-sizing: border-box` 含在 1200×630 內，不會撐大（review.md 實測）。
- 尺寸全寫 px 不用 clamp / vw：OG 圖固定尺寸、無響應式需求，spec §設計方向第 5 條標 N/A。

#### 區塊 5：內容

```html
<div class="mk">bs</div>
<h1 class="name">bstack</h1>
<p class="tag">Claude Code 開發流程包</p>
<div class="url">fujiei22.github.io/bstack</div>
```

- 副標取 `<title>` 的「Claude Code 開發流程包」，刻意不用 hero h1 那句（spec §設計方向末條；memory 也記過那句試改兩輪都更差、別碰）。
- 圖上不放 28 / 6 / 2 這組數字：spec §排除最後一條，契約守得住 HTML 裡的數字、守不住 PNG，一改就漂移。

### 關聯檔案

- 讀 `docs/css/styles.css:25-36, 68-70`（色彩 / 字型 token）；站上換配色時這裡自動跟
- 樣式來源 `docs/css/landing.css:17-24`（`.lrail .mk`）——這是「等比放大」的對照物，改了 `.mk` 這份不會自動跟，需人手同步
- 產出 `docs/og.png`
- 被 `docs/tools/docs-site-contract.mjs` C20e 守（連結字面 + 零色值字面）
- 會隨 GitHub Pages 發布到 `/tools/og-card.html`，站上沒有任何頁連到它

---

## `docs/og.png`

### 改動意圖

spec §Success criteria 第 2 條。社群爬蟲要 PNG / JPG 的絕對網址，站上原本只有 SVG。對應 plan Task 3。

### 改動詳解

- 二進位、無 diff。實測讀 PNG IHDR（檔頭第 16-24 byte）：寬 1200、高 630；檔大小 28571 bytes（PR body 寫 28.5 KB 吻合），遠低於 C20d 上限 512000。
- 1200×630 是 1.91:1，配 `twitter:card=summary_large_image` 與 FB / LINE 的大圖卡預設比例。
- 產法見 og-card.html 檔頭；plan Task 3 記錄是主 agent 用 Playwright MCP 一次性截圖，沒寫 script 進 repo（spec §排除：不建 CI 自動重產）。

### 關聯檔案

- 被 `docs/index.html` / `docs/flow.html` 的 `og:image` / `twitter:image` 以絕對網址 `https://fujiei22.github.io/bstack/og.png` 引用
- 被 `docs-site-contract.mjs` C20b（存在）與 C20d（檔頭尺寸 / 大小）守
- 來源 `docs/tools/og-card.html`

---

## `docs/index.html`

### 改動意圖

spec §meta 規格。head 補 og / twitter meta，讓爬蟲抓得到 title、description、圖。對應 plan Task 4。

### 改動詳解

#### 區塊 1：14 個 meta

```html
<meta property="og:type" content="website" />
<meta property="og:site_name" content="bstack" />
<meta property="og:locale" content="zh_TW" />
<meta property="og:url" content="https://fujiei22.github.io/bstack/" />
<meta property="og:title" content="bstack：Claude Code 開發流程包" />
<meta property="og:description" content="28 個 skill、6 個 agent、…" />
<meta property="og:image" content="https://fujiei22.github.io/bstack/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="bstack 標記與「Claude Code 開發流程包」字樣" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="…" />
<meta name="twitter:description" content="…" />
<meta name="twitter:image" content="https://fujiei22.github.io/bstack/og.png" />
```

- `og:*` 用 `property=`、`twitter:*` 用 `name=`——兩個規格各自的寫法，契約 `metaOf` 兩種都認。
- `og:title` / `twitter:title` 與既有 `<title>` 同文，`og:description` / `twitter:description` 與既有 `<meta name="description">` 同文。三份同文是 C20f 守的：改了一處另兩處沒跟，分享卡與頁面就講兩套話。
- `og:url` 是 `SITE` 根（結尾 `/`），不是 `index.html`——C20c 對 index.html 期望的就是根網址。
- `og:image` 是絕對網址，寫死 github.io 網域；相對路徑爬蟲不解析。CNAME 風險在 PR body 與 og-card 檔頭都寫了。
- 插入位置在既有 `<meta name="description">` 之後、防 FOUC 的 inline `<script>` 之前。C2a 守「script 在 stylesheet 前」，meta 插在更前面不影響（review.md 實測 C2a / C8g / C19 不受影響）。

#### 區塊 2：註解

註解寫了三件下一個人會問的事：為什麼絕對網址、圖從哪來 / 換圖要注意快取、哪條契約守。

### 關聯檔案

- 引用 `docs/og.png`
- 被 `docs-site-contract.mjs` C20a / b / c / f / g 守（變數 `landing`）
- `docs/flow.html` 同構，只有 url / title / description 三處不同

---

## `docs/flow.html`

### 改動意圖

同 index.html，另補一條 `<meta name="description">`。

### 改動詳解

```html
<meta name="description" content="bstack 九階段開發流程的互動流程圖：skill、agent、hook 與決策點的節點與連線，點節點就能讀該份文件。" />
```

- flow.html 原本沒有 description。C20f 要求 `og:description === <meta name="description">`，沒有來源就沒得比，所以一併補上——這是新寫的文案，不是抄來的。這也是 flow.html 比 index.html 多 1 行（+17 vs +18 是 index 多一段三行註解、flow 是一行註解加一行 description）的原因。
- `og:url` 是 `https://fujiei22.github.io/bstack/flow.html`；C20c 對非 index 頁期望 `SITE + name`。兩頁若寫成同一個 url，分享出去會指到同一頁。
- 圖、尺寸、alt、`twitter:card` 與 index.html 完全相同（共用一張圖，spec §排除：不為 flow 另做流程圖截圖版）。

### 關聯檔案

- 引用 `docs/og.png`
- 被 `docs-site-contract.mjs` C20a / b / c / f / g 守（變數 `html`）

---

## `docs/tools/docs-site-contract.mjs`

### 改動意圖

spec §Success criteria 第 4 條：契約加守門，讓「有沒有預覽圖」從上線後才知道變成本地就紅。這是本 PR 唯一有邏輯的檔。TDD 順序：commit `1e09148` 先加 C20 全紅（10 FAILED 是預期，commit body 有寫），Task 2-4 依序轉綠。plan 原編號 C19 已被 landing 檢查佔用、實作採 C20，spec 隨後同步（`6147120` / `b02e1d8`）。

### 改動詳解

#### 區塊 1：檔頭

```diff
+ *   C19 landing 頁                      C20 social meta 與 OG 圖（…）
- *   node docs/work/refactor/docs-site-redesign/verify/contract.mjs
+ *   node docs/tools/docs-site-contract.mjs
```

- 索引表補 C19 / C20（C19 是既有的、原本漏列）。
- 跑法路徑是既有錯誤：契約 2026-09-03 從 `docs/work/refactor/docs-site-redesign/verify/` 搬到 `docs/tools/` 時檔頭沒跟（`DOCS` 常數上面那段註解有記搬遷史）。plan review Nit 8 順手修。

#### 區塊 2：`SITE` 與 `metaOf`

```js
const SITE = 'https://fujiei22.github.io/bstack/';
const metaOf = (src, prop) => {
  const m = src.match(new RegExp(`<meta\\s+(?:property|name)="${prop}"\\s+content="([^"]*)"`));
  return m ? m[1] : null;
};
```

- `SITE` 是網域的唯一常數，C20b / C20c 都用它。加 CNAME 時是三處要改：這裡＋兩頁 meta。
- `metaOf` 只認「`property` / `name` 在前、雙引號、`content` 緊接」這一種寫法，順序反或單引號會回 null 而紅。JSDoc 寫明這是**刻意**：兩頁格式固定，契約不替不存在的寫法買保險。反過來說，日後有人改寫成 `content` 在前，C20a 會整排紅——那是提醒維持格式，不是 bug。
- `prop` 直接內插進 regex 未跳脫；呼叫端全是常數（`OG_REQUIRED` 與字面字串），`og:image` 這類值裡的 `:` 在 regex 不是 metacharacter，`.` 沒出現，安全。`og:image` 不會誤中 `og:image:width`，因為緊接的 `\s+content=` 把 `:width` 排除（review.md 實測）。

#### 區塊 3：兩頁迴圈——C20a / b / c / g / f

```js
const ogPages = { 'index.html': landing, 'flow.html': html };
for (const [name, src] of Object.entries(ogPages)) { … }
```

- `landing` / `html` 是檔頭既有的 `read('index.html')` / `read('flow.html')`，已 LF 正規化。

**C20a 齊全**：`OG_REQUIRED` 14 個 filter 掉 `metaOf` 回 null 的，缺幾個印出來。變數叫 `missingOg` 不叫 `missing`，因為 C4b 區塊已有同名 const（合法遮蔽但對照著讀會對錯行，`7438eb0`）。

**C20b 絕對網址且檔案存在**：
```js
const file = img.startsWith(SITE) ? img.slice(SITE.length).split('?')[0] : null;
!!file && !file.includes('/') && existsSync(join(DOCS, file)) && metaOf(src, 'twitter:image') === img
```
- 三段：以 `SITE` 開頭 → 剝掉 query string 取檔名 → 檔名不含 `/`（限 docs 根）且磁碟上存在；外加 `twitter:image` 與 `og:image` 完整字串同值。
- `.split('?')[0]` 是 code review 唯一 Major（`ab0ea22`）：og-card 檔頭教人換圖加 `?v=N` 破快取，但原版直接拿 `og.png?v=2` 去 `existsSync` 必紅——repo 自己的說明會讓自己的契約紅。修法只剝檔名比對用的那份，`twitter:image` 同值比對維持含 query，兩邊版號要一起換。
- `!file.includes('/')` 意思是圖只能放 `docs/` 根。這是現況的守法，日後想放 `docs/assets/` 要連這條一起改。

**C20c og:url 指向自己**：`selfUrl = SITE + (name === 'index.html' ? '' : name)`——index 是根網址，其他頁是 `SITE + 檔名`。

**C20g 宣告尺寸**：`og:image:width === '1200' && og:image:height === '630'`。原本綁在 C20c 裡，兩位 reviewer 都提「一條 check 綁兩件不相關的事，FAIL 時看名稱找錯方向」，拆出來編 g（`19ca899`）。編號不連號（a b c g f）是拆分順序造成，不是漏。

**C20f 三份同文**：
```js
const titleTag = (src.match(/<title>([^<]*)<\/title>/) || [])[1] || null;
!!titleTag && og:title === titleTag && twitter:title === titleTag &&
!!description && og:description === description && twitter:description === description
```
- plan review Major 3 加的、spec 原本沒寫：C20a 只驗存在，改了 description 忘改 og 版契約照綠。`!!titleTag` / `!!metaOf(src,'description')` 先擋 null，否則 `null === null` 會讓兩邊都缺的情況誤判通過。
- FAIL 訊息把四個比對結果各自印出，紅了直接看得出是 title 組還是 description 組漂了。

#### 區塊 4：C20d——PNG 檔頭

```js
const ogPng = existsSync(ogPngPath) ? readFileSync(ogPngPath) : Buffer.alloc(0);
const isPng = ogPng.length >= 24 && ogPng.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
const pngW = isPng ? ogPng.readUInt32BE(16) : 0;
const pngH = isPng ? ogPng.readUInt32BE(20) : 0;
const OG_PNG_MAX = 512000;
```

- **不用 `read()`**：`read()` 會把 CRLF 換 LF，二進位檔會被改壞；直接 `readFileSync` 拿 Buffer。
- PNG 結構：前 8 byte 是固定簽名，接著 IHDR chunk，寬高各 4 byte big-endian 在 offset 16 / 20。`>= 24` 剛好是讀到高度最後一個 byte 所需的長度。零依賴解析，不裝 image 套件。
- 為什麼要驗尺寸而不只驗存在：截圖時視窗或 DPR 一偏，圖是 2400×1260 或 1200×663，平台照樣顯示但會裁邊。review.md 實測 2400×1260 假檔頭、600 KB、JPEG 檔頭三種都紅。
- `OG_PNG_MAX` 抽成常數、名稱與訊息都印同一個數（plan review Nit 9：原本名稱寫 500 KB、訊息寫 512000 bytes，讀起來像兩個數）。spec 寫 500 KB，512000 = 500 KiB。

#### 區塊 5：C20e——原稿零色值字面

```js
const ogCardBare = ogCard.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
ogCard.includes('href="../css/styles.css"') &&
  !/#[0-9A-Fa-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|:\s*(white|black)\b/.test(ogCardBare)
```

- 先剝 CSS 註解與 HTML 註解再掃，否則檔頭那段長註解或 `/* 原本是 #fff */` 會誤紅（plan review Minor 5）。
- 整檔掃、不限 `color:` / `background:` 屬性：`border-top: 1px solid #DAD6D1` 這種在 border / box-shadow 裡的色值原版抓不到（plan review Minor 4）。
- 具名色只擋 `: white` / `: black`：其餘 140 多個 CSS 具名色不列，因為 `red` / `gray` 會出現在說明文字裡誤中。註解如實寫這是刻意取捨（`2fe19e9`，原註解暗示擋所有具名色）。
- 這條與 C19d「landing 不自己定義色值」是同一條紅線：抽不到 token 就說抽不到，不頂替。

### 關聯檔案

- 讀 `docs/index.html`（`landing`）、`docs/flow.html`（`html`）、`docs/og.png`（raw Buffer）、`docs/tools/og-card.html`（`read()`）
- 沿用檔頭既有 helper：`DOCS` / `read` / `check` / `existsSync` / `join`，無新 import
- `--selftest` 尾段未動；實測 `node docs/tools/docs-site-contract.mjs` ALL PASS
- 沒有 CI 跑它——repo 無 `.github/workflows`，靠 verify-done 與 reviewer 手跑

---

## 全域 patterns / cross-cutting

- **TDD 在契約層落地**：先 commit 一顆刻意紅的契約再實作，commit body 明寫「刻意先紅」給 bisect 的人看。squash merge 後 main 不會留下這顆。
- **單一來源**：圖 ← og-card.html ← styles.css token。三層各有契約守一段（C20d 守圖、C20e 守原稿連 styles.css 且不自帶色值），斷在哪層本地就紅。
- **網域寫死三處**（契約 `SITE`、兩頁 meta）、**同文三份兩組**（title / description 各三份）——都有契約盯著，但 CNAME 那種「三處要一起改」的事契約只能在改了一處沒改另一處時紅，改不改是人決定。
- **不驗行為、只驗機械事實**：與檔頭「刻意不測 F2 與 F21」的原則一致。爬蟲到底出不出圖只能上線後用 opengraph.xyz 看，契約守的是「出不了圖的已知原因一個都不在」。
- **review 每 finding 一顆 commit**（`ab0ea22` 到 `066b257` 共 8 顆），對照 review.md 能逐條找到修法。

---

## 後續 follow-up

- [ ] merge 後到 https://www.opengraph.xyz/ 貼 `https://fujiei22.github.io/bstack/` 與 `/flow.html`，兩頁都應出圖（PR body 已列；無預覽環境，只能上線後驗）
- [ ] 日後換圖：改檔名或兩頁 `og:image` / `twitter:image` 一起加 `?v=N`（C20b 允許 query string，但 twitter:image 必須與 og:image 完整同值）
- [ ] 日後加 CNAME：契約 `SITE`、`index.html` 與 `flow.html` 的 `og:url` / `og:image` / `twitter:image` 一併改
- [ ] 圖若要搬離 `docs/` 根（例如 `docs/assets/`），C20b 的 `!file.includes('/')` 要放寬

---

## 安全 / PII 檢查

- secret / API key: 無。新增的網址全是公開 GitHub Pages 網域與 Google Fonts。
- PII mask: N/A。diff 內無 email / phone / 個資；commit author email 是 git metadata、非本 PR 內容。
- file-type 硬規則命中: 無。改動檔全在 `docs/**`，不含 CI / 鎖檔 / migration / infra / shell config。`og-card.html` 是前端檔，rules.md §設計語言對齊已走小改路徑，plan Task 5 記錄四項對齊檢查（元件狀態 / 斷點 / 表單 / dark mode 三項 N/A 附依據）。
