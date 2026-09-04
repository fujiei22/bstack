# PR #62: fix: landing CTA hover 延遲、整欄寬與 rail 順序

> URL: https://github.com/fujiei22/bstack/pull/62
> Branch: feat/landing-cta-tweaks → main
> Track: Dev | Tier: T1
> 建立: 2026-09-04
> 對應 spec: docs/work/feat/landing-cta-tweaks/spec.md
> 對應 plan: N/A（T1 跳 plan）

## 整體脈絡

landing 頁（`docs/index.html`）兩顆「開啟流程圖」CTA 有三個互不相關的小毛病：底部那顆滑上去要等 180ms 才變色、hero 那顆被拉成整欄寬、右側 rail 最底下兩顆按鈕順序跟 flow.html 不一致。三個問題都是 2026-09-04 用 Playwright 量出來的（computed style + bounding box），不是目測。修法是兩檔各動一小塊：`landing.css` 把 stagger 進場延遲改成自訂屬性、給 `.cta` 加 `align-self`；`landing.js` 對調兩行字串串接。共 3 檔、+57/−7，其中 39 行是 spec 落檔。沒有 follow-up。

## 檔案改動清單

| 檔 | 類型 | 行 +/- | 改動性質 |
|---|---|---|---|
| `docs/css/landing.css` | edit | +16/−4 | stagger 延遲改走 `--rise-delay`；`.cta` 加 `align-self: flex-start`、transition 補進場兩條 |
| `docs/js/landing.js` | edit | +3/−2 | rail 底部「開」「自」兩顆順序對調 |
| `docs/work/feat/landing-cta-tweaks/spec.md` | new | +39/−0 | T1 spec（實測數據 + 成因 + 範圍） |

---

## `docs/css/landing.css`

### 改動意圖

對應 spec 問題 ① 與 ②。

① **hover 延遲**：`.rise` 是捲動進場效果（進視口後逐項浮起），原本用 `.in .rise:nth-child(N) { transition-delay: ... }` 做 stagger（錯開時間）。但 `transition-delay` 是獨立屬性，這條選擇器 specificity（選擇器權重）(0,3,0) 高過 `.cta` (0,1,0)，所以 `#install` 裡第 4 個子元素的 CTA 進視口後，它自己 hover 用的 `background` / `box-shadow` transition 也被套上 180ms 延遲——滑上去要等一下才變色。hero 那顆是第 5 個子元素、沒有對應的 nth-child 規則，實測 0s、沒中。

② **整欄寬**：`.hero`（`landing.css:71`）是 `display: flex; flex-direction: column`，flex 子元素預設 `align-items: stretch`，`inline-flex` 的 CTA 在交叉軸被拉滿欄寬（實測 563px = `.lcol` 欄寬）。底部那顆在 block 容器 `#install` 裡正常 146px。

### 改動詳解

#### 區塊 1：stagger 延遲改走 `--rise-delay`（`landing.css:114-127`）

```diff
-  transition: opacity 600ms var(--e-enter), transform 600ms var(--e-enter);
+  transition: opacity 600ms var(--e-enter) var(--rise-delay, 0ms), transform 600ms var(--e-enter) var(--rise-delay, 0ms);
 }
 .in .rise { opacity: 1; transform: none; }
-.in .rise:nth-child(2) { transition-delay: 60ms; }
+.in .rise:nth-child(2) { --rise-delay: 60ms; }
```

- 延遲從獨立的 `transition-delay` 屬性搬進 `.rise` 的 transition shorthand 第四個值，nth-child 規則只負責設自訂屬性 `--rise-delay`。自訂屬性本身不影響任何 transition，只有「有引用它的那條 shorthand」會吃到延遲，所以 `.cta` 的 background / box-shadow 完全不受影響。
- `var(--rise-delay, 0ms)` 的 fallback 讓沒被 nth-child 命中的 `.rise`（第 1、第 5+ 個子元素）延遲為 0，行為跟改動前相同。

#### 區塊 2：`.cta` 加 `align-self` 並補進場 transition（`landing.css:188-199`）

```diff
+  align-self: flex-start;
 ...
-  transition: background var(--t-micro) var(--e-move), box-shadow var(--t-micro) var(--e-move);
+  transition: background var(--t-micro) var(--e-move), box-shadow var(--t-micro) var(--e-move),
+              opacity 600ms var(--e-enter) var(--rise-delay, 0ms), transform 600ms var(--e-enter) var(--rise-delay, 0ms);
```

- `align-self: flex-start` 只在 flex 容器裡有意義；在 block 容器 `#install` 裡被忽略、無害，所以不用分兩個選擇器寫。
- transition 是 shorthand，`.cta` 這條會整個蓋掉 `.rise` 那條（兩者 specificity 相同、`.cta` 在後面）。改動前的後果是 `.cta.rise` 沒有進場動畫、瞬間出現；這次把 opacity / transform 兩條也列進 `.cta` 的 shorthand，讓兩顆 CTA 跟其他 `.rise` 一樣浮起。這不在原本三個問題裡，是改區塊 1 時順手補的（commit `a137a02` body 有寫），PR body 風險段已標「不再瞬間出現，屬修正而非副作用」。
- 兩處的 `600ms var(--e-enter) var(--rise-delay, 0ms)` 是重複字串，沒抽成共用變數；T1 量體下可接受，但之後改 `.rise` 時長要記得兩邊同步。

### 關聯檔案

- `docs/index.html:52`（hero CTA，`.hero` 第 5 個子元素）與 `docs/index.html:117`（`#install` CTA，第 4 個子元素）是唯二的 `.cta.rise` 使用點
- `docs/index.html` 其他 `.rise` 元素（kicker / h1 / sub / stat / tag / h2 / lead / p / inv / chips / steps / foot）行為不變：只是延遲的載體從 `transition-delay` 換成 `--rise-delay`，數值 60/120/180ms 一樣
- `docs/tools/docs-site-contract.mjs:642` C19d「landing 不自己定義色值」：新增的 `--rise-delay` 是時間值、不是色值，PR body 說明 ALL PASS

---

## `docs/js/landing.js`

### 改動意圖

對應 spec 問題 ③。rail（右側浮動導覽條）由 JS 串 HTML 字串產生，最底下兩顆原本是「自（主題）」在上、「開（流程圖）」在下。flow.html 的 rail 底部群組（`docs/flow.html:55-58`）是「置（回起點）→ 自（主題）」，主題鈕壓底；landing 對調後兩頁的主題鈕落在同一個位置。

### 改動詳解

#### 區塊 1：兩行字串串接對調（`landing.js:35-38`）

```diff
     h += '<div class="sp"></div>' +
-         '<a href="#" id="btn-theme" data-label="主題：自動" role="button">自</a>' +
-         '<a href="./flow.html" data-label="開啟流程圖" aria-label="開啟流程圖">開</a>';
+         '<a href="./flow.html" data-label="開啟流程圖" aria-label="開啟流程圖">開</a>' +
+         '<a href="#" id="btn-theme" data-label="主題：自動" role="button">自</a>';
```

- 純粹交換兩個 `<a>` 的輸出順序，兩顆的屬性字串一個字都沒動。
- `#btn-theme` 的行為由 `setupTheme()`（`landing.js:81-95`）用 `getElementById` 綁 onclick、`applyTheme()`（`landing.js:73-78`）用同樣方式改 label / glyph，都不依賴 DOM 位置，順序對調不影響。

### 關聯檔案

- `docs/js/landing.js:73`、`landing.js:86` 以 id 取 `#btn-theme`，與位置無關
- `docs/flow.html:55-58` 是對齊目標，本 PR 未改它
- `docs/js/app.js:1357`、`app.js:1387` 是 flow.html 自己的 `#btn-theme` 邏輯，與 landing 無關、未動

---

## `docs/work/feat/landing-cta-tweaks/spec.md`

T1 spec 落檔。記錄三個問題的 Playwright 實測數據（0.18s / 563px / 順序）、CSS 成因（含 specificity 數值與行號）、success criteria、範圍排除（不改文案 / 顏色 / 尺寸 token、不動 flow.html、不動 `.coda a`）。純文件、無程式邏輯。

---

## 全域 patterns / cross-cutting

- **自訂屬性當「延遲載體」**：這次的核心手法是用 CSS custom property 取代直接寫 `transition-delay`，讓「誰要吃延遲」由引用它的 shorthand 決定、不由選擇器 specificity 決定。landing.css 其他地方（`.vs > div`、`.step`、`.coda`）都沒有 stagger，目前只有 `.rise` 用到這個 pattern。
- **transition shorthand 互蓋**：`.cta` 補 opacity / transform 是在承認「兩個 class 各寫一條 transition shorthand 時，後者會全蓋前者」這件事，用「後者把前者的項目也列進來」解決，沒有引入 `!important` 或拆成 longhand。
- 沿用既有 token（`--t-micro` / `--e-move` / `--e-enter`），沒有新色值、新尺寸；spec 設計方向段標 size 小改、四項對齊檢查全 N/A。

---

## 後續 follow-up

- 無。spec 未列 TODO；PR body 亦無。

---

## 安全 / PII 檢查

- secret / API key: 無
- PII mask: N/A（diff 內無 email / phone / 個資；commit author email 為 GitHub 帳號公開資訊，未落入 diff 內容）
- file-type 硬規則命中: 無（`.css` / `.js` / `.md`，皆非密鑰 / CI / migration / 鎖檔 / infra）
