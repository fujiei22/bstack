# docs 站 OG 圖與 social meta Implementation Plan

> 對應 spec: `docs/work/feat/docs-og-image/spec.md`
> Track: Dev | Tier: T2
> 建立: 2026-09-04
> 並行最大 group: 4

**Goal**: 兩頁 head 補 OG / Twitter meta，產一張 1200×630 的 `docs/og.png`，契約驗證器加 C20 守門。

**Architecture**: 不引入任何依賴。OG 卡原稿 `docs/tools/og-card.html` 直接 `<link>` 同站的 `../css/styles.css`、全用 `var(--*)`，
所以卡片色值永遠跟站上同源；產圖用 Playwright MCP 對 `.card` 元素截圖（元素截圖尺寸 = 元素 CSS 尺寸，不受視窗大小與 DPR 影響）。
契約 C20 用零依賴 PNG 檔頭解析（IHDR 的 width / height 在 byte 16-24）守尺寸，用 regex 守 meta。

**Tech Stack**: 純 HTML / CSS、node 內建模組、Playwright MCP（產圖時一次性使用，不進 repo）。

**Risks**:
- 契約編號：`docs-site-contract.mjs` 的 C19 已被「landing 頁」檢查佔用，本次新契約編 **C20**（spec 寫 C19，以此為準）。
- `flow.html` 沒有 `<meta name="description">`，og:description 無既有值可抄——本 plan 為它補一句 description（同時補 `<meta name="description">`，兩者同值）。
- Playwright MCP 的 `filename` 參數以它自己的 output 目錄為基準；先試絕對路徑，不行就從 output 目錄複製過來。
- 字型走 Google Fonts；截圖前用 `document.fonts.ready` 等字型載完，否則會截到 fallback 字型。

---

## 檔案結構

| 項 | 路徑 | 職責 |
|---|---|---|
| 新建 | `docs/tools/og-card.html` | OG 卡原稿；固定 1200×630 的 `.card`；`<link>` `../css/styles.css`；零自有色值；檔頭註解寫重產步驟與快取注意 |
| 新建 | `docs/og.png` | 兩頁共用的 OG 圖；由 og-card.html 截圖產生 |
| 改動 | `docs/index.html:8` 之後 | 插入 OG / Twitter meta（在防 FOUC script 之前，不動 script 與 CSS 順序） |
| 改動 | `docs/flow.html:7` 之後 | 插入 `<meta name="description">` ＋ OG / Twitter meta |
| 改動 | `docs/tools/docs-site-contract.mjs:11-19`（檔頭對照表）與 `:648`（C19d 之後、selftest 之前） | 加 C20a-f |

**介面**：無跨檔 function。契約與 HTML 之間的「介面」是 meta 的 `property` 名與 `content` 值，寫死如下：

| property | index.html | flow.html |
|---|---|---|
| `og:type` | `website` | `website` |
| `og:site_name` | `bstack` | `bstack` |
| `og:locale` | `zh_TW` | `zh_TW` |
| `og:url` | `https://fujiei22.github.io/bstack/` | `https://fujiei22.github.io/bstack/flow.html` |
| `og:title` | `bstack：Claude Code 開發流程包` | `bstack：dev-workflow flowchart explorer` |
| `og:description` | 同既有 `<meta name="description">` | `bstack 九階段開發流程的互動流程圖：skill、agent、hook 與決策點的節點與連線，點節點就能讀該份文件。` |
| `og:image` | `https://fujiei22.github.io/bstack/og.png` | 同 |
| `og:image:width` / `height` | `1200` / `630` | 同 |
| `og:image:alt` | `bstack 標記與「Claude Code 開發流程包」字樣` | 同 |
| `twitter:card` | `summary_large_image` | 同 |
| `twitter:title` / `description` / `image` | 同 og 對應值 | 同 og 對應值 |

---

### Task 1: 契約 C20 先紅

**parallel-group**: 1
**files**:
- modify: `docs/tools/docs-site-contract.mjs:11-19`（檔頭對照表加 C20 一行）
- modify: `docs/tools/docs-site-contract.mjs:25-26`（檔頭「跑法」的舊路徑改成現址；既有問題，順手修）
- modify: `docs/tools/docs-site-contract.mjs:648`（C19d 之後插入 C20 區塊）

- [ ] **Step 1: 寫失敗檢查**

檔頭對照表在 C18 那行後面加：
```
 *   C19 landing 頁                      C20 social meta 與 OG 圖（og:* / twitter:* 齊且與 title / description 同文、og.png 1200×630）
```

檔頭「跑法」兩行的 `docs/work/refactor/docs-site-redesign/verify/contract.mjs` 改成 `docs/tools/docs-site-contract.mjs`（2026-09-03 搬檔時漏改）。

C19d 之後、`// ── selftest` 之前插入：
```js
// ── C20：social meta 與 OG 圖 ────────────────────────────────────────────────
// 貼連結到 LINE / Slack / FB 沒預覽圖，就是這幾行沒有。守三件事：兩頁 meta 齊、
// og:image 是絕對網址且真的指到 docs/ 底下存在的檔、那個檔是 1200×630 的 PNG。
// 尺寸不能只看檔案存在——截圖時視窗尺寸或 DPR 一偏，圖就是 2400×1260 或 1200×663，
// 平台照樣顯示但會裁掉邊。
// metaOf 的契約假設：只認 `<meta property|name="…" content="…"`——屬性 property/name 在前、
// 雙引號。屬性順序反過來或用單引號會回 null 而紅，這是刻意的：兩頁的 meta 格式固定，
// 契約不替不存在的寫法買保險。
const SITE = 'https://fujiei22.github.io/bstack/';
const metaOf = (src, prop) => {
  const m = src.match(new RegExp(`<meta\\s+(?:property|name)="${prop}"\\s+content="([^"]*)"`));
  return m ? m[1] : null;
};
const OG_REQUIRED = ['og:type', 'og:site_name', 'og:locale', 'og:url', 'og:title', 'og:description',
  'og:image', 'og:image:width', 'og:image:height', 'og:image:alt',
  'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
const ogPages = { 'index.html': landing, 'flow.html': html };
for (const [name, src] of Object.entries(ogPages)) {
  const missing = OG_REQUIRED.filter((p) => !metaOf(src, p));
  check(
    `C20a ${name} 的 og:* / twitter:* 齊全`,
    missing.length === 0,
    `期望 ${OG_REQUIRED.length} 個都在，實際缺 ${missing.length} 個：${missing.join(' / ')}` +
      `（後果：缺 og:image 就沒預覽圖，缺 twitter:card 在 X 上退成小卡）`
  );
  const img = metaOf(src, 'og:image') || '';
  const file = img.startsWith(SITE) ? img.slice(SITE.length) : null;
  check(
    `C20b ${name} 的 og:image 是絕對網址且檔案存在`,
    !!file && !file.includes('/') && existsSync(join(DOCS, file)) &&
      metaOf(src, 'twitter:image') === img,
    `期望 og:image 以 ${SITE} 開頭、指向 docs/ 根下存在的檔、且 twitter:image 同值，實際 og:image=${img}` +
      `（後果：相對路徑爬蟲不解析、檔不存在就 404，兩種都是沒圖）`
  );
  check(
    `C20c ${name} 的 og:url 指向自己`,
    metaOf(src, 'og:url') === SITE + (name === 'index.html' ? '' : name) &&
      metaOf(src, 'og:image:width') === '1200' && metaOf(src, 'og:image:height') === '630',
    `期望 og:url=${SITE}${name === 'index.html' ? '' : name} 且宣告 1200×630，實際 og:url=${metaOf(src, 'og:url')} ` +
      `${metaOf(src, 'og:image:width')}×${metaOf(src, 'og:image:height')}（後果：兩頁分享出去指到同一頁，或平台按錯尺寸預留版位）`
  );
  // C20f 守三份同文不漂移：<title> / og:title / twitter:title 一組，
  // <meta name="description"> / og:description / twitter:description 一組。C20a 只驗存在，
  // 日後改了 description 忘了改 og 版，分享卡跟頁面講的是兩套話而契約照綠。
  const titleTag = (src.match(/<title>([^<]*)<\/title>/) || [])[1] || null;
  check(
    `C20f ${name} 的 og / twitter title、description 與 <title> / description 同文`,
    !!titleTag && metaOf(src, 'og:title') === titleTag && metaOf(src, 'twitter:title') === titleTag &&
      !!metaOf(src, 'description') && metaOf(src, 'og:description') === metaOf(src, 'description') &&
      metaOf(src, 'twitter:description') === metaOf(src, 'description'),
    `期望 og:title / twitter:title == <title>「${titleTag}」且 og:description / twitter:description == meta description，` +
      `實際 og:title=${metaOf(src, 'og:title')} twitter:title=${metaOf(src, 'twitter:title')} ` +
      `og:description 同文=${metaOf(src, 'og:description') === metaOf(src, 'description')} ` +
      `twitter:description 同文=${metaOf(src, 'twitter:description') === metaOf(src, 'description')}` +
      `（後果：分享卡與頁面講兩套話，改了一處另一處不跟）`
  );
}
// 直接讀 byte，不用 read()——read() 會把 CRLF 換成 LF，二進位檔會被改壞。
const ogPngPath = join(DOCS, 'og.png');
const ogPng = existsSync(ogPngPath) ? readFileSync(ogPngPath) : Buffer.alloc(0);
const isPng = ogPng.length >= 24 && ogPng.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const pngW = isPng ? ogPng.readUInt32BE(16) : 0;
const pngH = isPng ? ogPng.readUInt32BE(20) : 0;
const OG_PNG_MAX = 512000;   // bytes；訊息與名稱都用這個數，不再一邊寫 KB 一邊寫 bytes
check(
  `C20d og.png 是 1200×630 的 PNG 且 < ${OG_PNG_MAX} bytes`,
  isPng && pngW === 1200 && pngH === 630 && ogPng.length < OG_PNG_MAX,
  `期望 PNG 1200×630 且 < ${OG_PNG_MAX} bytes，實際 isPng=${isPng} ${pngW}×${pngH} ${ogPng.length} bytes` +
    `（後果：尺寸不對平台會裁邊；太大 LINE 這類平台可能不抓）`
);
// 剝掉 CSS 註解與 HTML 註解後整檔掃色值字面。不限 color / background 屬性——
// border / box-shadow / 具名色（white）都算漏，原稿本來就該零色值字面、全靠 var(--*)。
const ogCard = existsSync(join(DOCS, 'tools/og-card.html')) ? read('tools/og-card.html') : '';
const ogCardBare = ogCard.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
check(
  'C20e og-card.html 連 ../css/styles.css 且不自己定義色值',
  ogCard.includes('href="../css/styles.css"') &&
    !/#[0-9A-Fa-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|:\s*(white|black)\b/.test(ogCardBare),
  '期望 OG 卡原稿只用 var(--*) 取色、零色值字面（後果：站上換配色時 OG 圖原稿不跟著變，重產出來的圖跟站不同色）'
);
```

- [ ] **Step 2: 跑確認失敗**

```bash
node docs/tools/docs-site-contract.mjs
# Expected: C1-C19 PASS；C20a/b/c/f 各兩條 FAIL（缺 meta）、C20d FAIL（isPng=false）、C20e FAIL；結尾 "10 FAILED"
# （reviewer 實測：C20a-e 版本是 8 FAILED；加 C20f 兩頁各一條 → 10）
```

- [ ] **Step 3: 最小實作** — 本 task 只有紅，實作在 Task 2-4。

- [ ] **Step 4: 跑確認** — 同 Step 2，紅是預期。

- [ ] **Step 5: commit**（body 寫明刻意先紅，bisect 到這顆時不會誤判）

```bash
git add docs/tools/docs-site-contract.mjs
git commit -m "test: 契約加 C20 守 social meta 與 og.png 尺寸（先紅）" -m "刻意先紅：C20a-f 對應的 meta / og.png / og-card.html 在後續 commit 才加，此 commit 契約 10 FAILED 是預期。順手把檔頭跑法路徑改成 docs/tools/ 現址。"
```

---

### Task 2: OG 卡原稿 og-card.html

**parallel-group**: 2
**files**:
- create: `docs/tools/og-card.html`

- [ ] **Step 1: 測試** — 對應 C20e（Task 1 已寫）。

- [ ] **Step 2: 跑確認失敗**

```bash
node docs/tools/docs-site-contract.mjs | grep C20e
# Expected: FAIL  C20e
```

- [ ] **Step 3: 寫檔**

```html
<!DOCTYPE html>
<html lang="zh-Hant" data-theme="light" data-theme-mode="light">
<head>
  <meta charset="UTF-8" />
  <title>bstack OG 卡原稿（產圖用，站上沒有任何頁連到這裡）</title>
  <!--
    這是 docs/og.png 的原稿。重產步驟：
      1. 用 Playwright 開這個檔（file:// 即可，字型走 Google Fonts 要連網）
      2. 等 document.fonts.ready
      3. 對 .card 元素截圖、scale=css → 得到 1200×630 的 PNG，存到 docs/og.png
      4. node docs/tools/docs-site-contract.mjs → C20d 綠
    色值全部 var(--*) 來自 ../css/styles.css，站上換配色這裡自動跟；契約 C20e 守這件事。
    強制 data-theme="light"：OG 圖不跟系統主題，只出 light 版。
    換圖注意：LINE / FB / Slack 按網址快取預覽圖，換了圖要改檔名或在兩頁的 og:image 加 ?v=N，
    否則舊圖會掛很久。og:image 寫死 https://fujiei22.github.io/bstack/，加 CNAME 時要一併改。
    標記 .mk 是 landing.css .lrail .mk 的等比放大（40px → 120px，×3）：
    圓角 3px → 9px、字級 19px → 57px、letter-spacing 與字重照抄。
  -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,600&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400&family=Noto+Sans+TC:wght@400;500&family=Noto+Serif+TC:wght@600&display=swap">
  <link rel="stylesheet" href="../css/styles.css" />
  <style>
    /* styles.css 的 body reset 已給 margin 0 / --paper 底 / --ink 字 / --font-body / overflow hidden，
       這裡只補卡片本身。全部尺寸寫死 px：OG 圖是固定 1200×630，不需要響應式。 */
    html, body { width: 1200px; height: 630px; }
    .card {
      position: relative; width: 1200px; height: 630px; padding: 84px;
      display: flex; flex-direction: column; justify-content: space-between;
      background: var(--paper); color: var(--ink);
    }
    .mk {
      width: 120px; height: 120px; display: grid; place-items: center; border-radius: 9px;
      background: var(--accent); color: var(--accent-ink);
      font-family: var(--font-display); font-weight: 600; font-size: 57px; letter-spacing: -.02em;
    }
    .name {
      margin: 0; font-family: var(--font-display); font-weight: 600;
      font-size: 104px; line-height: 1; letter-spacing: -.022em;
    }
    .tag { margin: 18px 0 0; font-family: var(--font-body); font-size: 36px; line-height: 1.4; color: var(--ink-2); }
    .url { font-family: var(--font-mono); font-size: 22px; letter-spacing: .04em; color: var(--ink-3); }
    .rule { position: absolute; left: 84px; right: 84px; bottom: 150px; border-top: 1px solid var(--rule); }
  </style>
</head>
<body>
  <div class="card">
    <div class="mk">bs</div>
    <div>
      <h1 class="name">bstack</h1>
      <p class="tag">Claude Code 開發流程包</p>
    </div>
    <div class="rule"></div>
    <div class="url">fujiei22.github.io/bstack</div>
  </div>
</body>
</html>
```

- [ ] **Step 4: 跑確認通過**

```bash
node docs/tools/docs-site-contract.mjs | grep C20e
# Expected: PASS  C20e
```

- [ ] **Step 5: commit**

```bash
git add docs/tools/og-card.html
git commit -m "feat: 加 OG 卡原稿 og-card.html，色值全沿用 styles.css token"
```

---

### Task 3: 用 Playwright 截出 og.png

**parallel-group**: 3
**files**:
- create: `docs/og.png`

- [ ] **Step 1: 測試** — 對應 C20d（Task 1 已寫）。

- [ ] **Step 2: 跑確認失敗**

```bash
node docs/tools/docs-site-contract.mjs | grep C20d
# Expected: FAIL  C20d ... isPng=false
```

- [ ] **Step 3: 產圖**（主 agent 直接用 Playwright MCP，一次性動作，不寫 script）

```
mcp__playwright__browser_resize        width=1280 height=720
mcp__playwright__browser_navigate      url=file:///D:/GitHub/bstack/docs/tools/og-card.html
mcp__playwright__browser_evaluate      function: async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family); }
   # Expected: 回傳陣列含 Newsreader、IBM Plex Sans、Noto Sans TC、IBM Plex Mono 四個。
   #   不會有 Noto Serif TC：卡上走 --font-display 的只有「bs」「bstack」全是拉丁字元，fallback 鏈逐字元比對、中文襯線根本不會被觸發載入。
   #   少了任一個 → 等 1 秒重跑一次，還是沒有 → 停下回報，不要截 fallback 字型的圖
mcp__playwright__browser_take_screenshot  target=".card"  scale="css"  type="png"  filename="D:/GitHub/bstack/docs/og.png"
   # 絕對路徑若被 MCP 拒絕：改 filename="og.png"，從回傳訊息裡的實際存檔路徑 cp 到 docs/og.png
```

然後本地目測：`Read docs/og.png`，確認標記是紅底白字、字型是襯線 Newsreader、沒有截到滾動條或白邊。

- [ ] **Step 4: 跑確認通過**

```bash
node docs/tools/docs-site-contract.mjs | grep C20d
# Expected: PASS  C20d
```

- [ ] **Step 5: commit**

```bash
git add docs/og.png
git commit -m "feat: 加 docs 站 OG 圖 og.png（1200×630，由 og-card.html 截圖）"
```

---

### Task 4: 兩頁 head 補 meta

**parallel-group**: 4
**files**:
- modify: `docs/index.html:8`（description 之後、防 FOUC 註解之前）
- modify: `docs/flow.html:7`（title 之後、防 FOUC 註解之前）

兩檔各插一段，同 task 處理：改動形狀相同、各 15 行，拆兩 task 平行的協調成本高於收益。

- [ ] **Step 1: 測試** — 對應 C20a / C20b / C20c / C20f（Task 1 已寫）。

- [ ] **Step 2: 跑確認失敗**

```bash
node docs/tools/docs-site-contract.mjs | grep 'C20[abcf]'
# Expected: 8 條 FAIL
```

- [ ] **Step 3: 插 meta**

`docs/index.html` 在第 8 行（`<meta name="description" …>`）之後插入：
```html

  <!-- social meta：貼到 LINE / Slack / FB / X 的預覽卡。og:image 必須是絕對網址，
       圖由 tools/og-card.html 截出；換圖要改檔名或加 ?v=，平台會按網址快取。契約 C20 守。 -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="bstack" />
  <meta property="og:locale" content="zh_TW" />
  <meta property="og:url" content="https://fujiei22.github.io/bstack/" />
  <meta property="og:title" content="bstack：Claude Code 開發流程包" />
  <meta property="og:description" content="28 個 skill、6 個 agent、2 個 PreToolUse hook 與一份規則書，裝成 Claude Code plugin；/devwork 把改動類請求導進固定的九階段流程。" />
  <meta property="og:image" content="https://fujiei22.github.io/bstack/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="bstack 標記與「Claude Code 開發流程包」字樣" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="bstack：Claude Code 開發流程包" />
  <meta name="twitter:description" content="28 個 skill、6 個 agent、2 個 PreToolUse hook 與一份規則書，裝成 Claude Code plugin；/devwork 把改動類請求導進固定的九階段流程。" />
  <meta name="twitter:image" content="https://fujiei22.github.io/bstack/og.png" />
```

`docs/flow.html` 在第 7 行（`<title>`）之後插入：
```html
  <meta name="description" content="bstack 九階段開發流程的互動流程圖：skill、agent、hook 與決策點的節點與連線，點節點就能讀該份文件。" />

  <!-- social meta：同 index.html，圖共用、title / description / url 換成本頁的。契約 C20 守。 -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="bstack" />
  <meta property="og:locale" content="zh_TW" />
  <meta property="og:url" content="https://fujiei22.github.io/bstack/flow.html" />
  <meta property="og:title" content="bstack：dev-workflow flowchart explorer" />
  <meta property="og:description" content="bstack 九階段開發流程的互動流程圖：skill、agent、hook 與決策點的節點與連線，點節點就能讀該份文件。" />
  <meta property="og:image" content="https://fujiei22.github.io/bstack/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="bstack 標記與「Claude Code 開發流程包」字樣" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="bstack：dev-workflow flowchart explorer" />
  <meta name="twitter:description" content="bstack 九階段開發流程的互動流程圖：skill、agent、hook 與決策點的節點與連線，點節點就能讀該份文件。" />
  <meta name="twitter:image" content="https://fujiei22.github.io/bstack/og.png" />
```

**index.html 的 og:description 一律從既有 `<meta name="description">` 原文複製**，不要自己改寫——C20f 會比對三份同文，改寫就紅。（28 / 6 / 2 那組數字沒有契約守，C8g 守的是 body 裡的節點數；數字漂移是另一個既有缺口，本次不處理。）

- [ ] **Step 4: 跑確認通過**

```bash
node docs/tools/docs-site-contract.mjs
# Expected: ALL PASS（C1-C20 全綠；C2 防 FOUC 順序不受影響，因為 meta 插在 script 之前、CSS 更後面）
node docs/tools/docs-site-contract.mjs --selftest; echo "exit=$?"
# Expected: 1 FAILED、exit=1（證明 fail 路徑仍有效）
```

- [ ] **Step 5: commit**

```bash
git add docs/index.html docs/flow.html
git commit -m "feat: 兩頁 head 補 OG 與 Twitter Card meta"
```

---

### Task 5: 設計對齊檢查 ＋ 手動驗證紀錄

**parallel-group**: 5
**files**:
- modify: `docs/work/feat/docs-og-image/plan.md`（本檔，勾完成）

- [x] **Step 1: 四項對齊檢查**（rules.md §設計語言對齊 小改路徑）

| 項 | 結果 |
|---|---|
| 元件狀態 | N/A（OG 卡無互動元件；og-card.html 不對外連結） |
| 斷點 | N/A（固定 1200×630，`og-card.html` 全檔 0 條 `@media`） |
| 表單 | N/A（兩頁 grep `<form>` / `<input>` 零命中） |
| dark mode | N/A 有依據：OG 圖不跟主題，原稿強制 `data-theme="light"`；兩頁新增 meta 不含色值 |

**2026-09-04 實測**：`og-card.html` grep `@media` 0 命中；`index.html` / `flow.html` grep `<form|<input` 各 0 命中；本次兩頁新增行 grep 色值字面（hex / rgb / oklch）0 命中；Playwright 讀到 `data-theme="light"`、`.mk` 背景是 styles.css 的 `oklch(0.545 0.18 28)`。四項全 N/A、依據成立。
**本地目測**：`docs/og.png` 1200×630、28571 bytes；紙色底、紅底白字 bs 標記、Newsreader 標題、ink-2 副標、mono 網址；四個字型（Newsreader / IBM Plex Sans / Noto Sans TC / IBM Plex Mono）截圖前確認 loaded。
**執行偏差**：Playwright MCP 擋 `file://`，改用 node 內建 http 模組起一次性靜態伺服器（scratchpad，不進 repo）開 `http://127.0.0.1:8765/tools/og-card.html` 截圖；og-card.html 檔頭的重產步驟第 1 步應理解為「用任何方式開到瀏覽器」，file:// 或 http 都可。

- [x] **Step 2: 本地目測** — `Read docs/og.png`，對照 spec「設計方向」：紙色底、紅底白字 bs 標記、Newsreader 標題、ink-2 副標。

- [ ] **Step 3: 上線後驗證項**（merge 後、不在本 branch）— 到 https://www.opengraph.xyz/ 貼 `https://fujiei22.github.io/bstack/` 與 `/flow.html`，兩頁都出圖。寫進 PR body 的「merge 後待驗」。

- [ ] **Step 4: 無 code，跳。**

- [ ] **Step 5: 無 commit，跳。**

---

## Self-review

| spec success criteria | 對應 task |
|---|---|
| 兩頁完整 OG + Twitter meta、og:image 絕對網址 | Task 4；C20a-c |
| og.png 1200×630 PNG < 500 KB | Task 3；C20d |
| og-card.html 進 repo、重產不需依賴 | Task 2（檔頭寫重產步驟） |
| 契約新增守門 | Task 1（編號改 C20，理由見 Risks） |
| C1-C19 不掉、selftest 仍紅 | Task 4 Step 4 |
| merge 後 opengraph.xyz 出圖 | Task 5 Step 3（本 branch 外） |

- placeholder：無 TBD / TODO。
- 名稱一致：`SITE` / `metaOf` / `OG_REQUIRED` / `ogPng` 只在 C20 區塊使用，不與既有 `html` / `landing` / `read` 撞名；`existsSync` / `readFileSync` / `join` 已在檔頭 import。
- 並行性：group 1→5 全串行，且是**依賴**不是保守：Task 3 要 Task 2 的原稿才能截圖；Task 4 收尾要跑 C20b，它要 `docs/og.png` 存在，所以 Task 4 必須在 Task 3 之後——Task 2 與 Task 4 若同時跑，Task 4 收尾時 C20b 必紅，破壞「每 task 收尾該綠的都綠」。
- review 後修訂（2026-09-04，見 `review.md`）：FAILED 數字 9→10（加 C20f）、字型預期清單拿掉 Noto Serif TC、加 C20f、C20e 改整檔掃色值字面、C20d 統一用 bytes、檔頭舊路徑順手修、Task 1 commit body 註明刻意先紅、C8g 誤述修正。
- scope：未動 favicon / theme-color / manifest / CI，與 spec 排除清單一致。
