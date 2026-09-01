# docs 站改版 · F1–F22 逐項驗證結果

> 對照基準：`docs/reference/docs-site-baseline.md`（改版前於 `9c59c3e` 抽取）
> 驗證日期：2026-09-01 ｜ Branch：`refactor/docs-site-redesign`
> 定案設計：骨架 `rail-console` ＋ 配色「校樣」（spec §定案設計的可重建規格）

## 驗證方式（三軌，缺一不可）

| 軌 | 涵蓋 | 工具 | 結果 |
|---|---|---|---|
| **契約** | 機械可判的事實（token 值、字串、資料形狀、載入順序） | `verify/contract.mjs`，27 條 | **ALL PASS** |
| **e2e** | 行為（點擊、鍵盤、動畫、跨主題） | Playwright，26 scenario | **25 PASS / 1 FAIL → 已修復並複驗** |
| **人工 `file://`** | F14 唯一真正的驗證方式 | 瀏覽器直接開 `docs/index.html` | **PASS** |

> **為什麼 F2 與 F21 刻意不設契約**：plan v1 曾用 `/function fitView/` 當 F2 的契約，
> 但定案設計的 `fitView()` 內容就是 `landingTransform()`——函式名還在、行為已經沒了，
> 契約照樣綠。契約只該測機械可判的事實，不該假裝能測行為。

**e2e 環境**：console **0 error / 0 warning**；network 45 個請求全部 200、**0 個 ≥400**；
抽屜開啟期間確認**無任何 `.md` 檔請求**。

---

## 一、F1–F22 逐項

| # | 功能 | 結果 | 說明 |
|---|---|---|---|
| F1 | 縮放 / 平移 0.04–2.5 | ✅ | 原始碼與實測邊界皆為 `[0.04, 2.5]`；拖曳位移量精確等於拖曳距離 |
| F2 | 初始 fit view | **⚠ 改動說明 1** | fit-all 能力移除，改為對齊起點的可讀比例 |
| F3 | 節點點擊選取 / 再點取消 | ✅ | 點 `BS` 選取、再點取消，`is-focus` 與 detail 同步 |
| F4 | 選取後高亮三態 | ✅ | 實測 `is-focus`=1 / `is-neighbor`=2 / `is-dimmed`=182 / 邊 `is-highlighted`=2（84+103=187，1+2+2+182=187 吻合）。跑馬燈實測 `animation-name: dashmarch`、`0.72s`、`stroke-dasharray: 8px 4px` |
| F5 | 空白處取消選取 | ✅ | `elementFromPoint` 確認命中 `svg#flow` 本體後清除 |
| F6 | ESC | **⚠ 改動說明 2** | 分層邏輯保留且**擴充**：抽屜 → 選取 → 面板（baseline 只有前兩層） |
| F7 | type 篩選 | **⚠ 改動說明 3** | 功能完整（點 skill 實測恰 22 個非 dimmed、再點清除），但觸發路徑改變 |
| F8 | Phase 快速傳送 | **⚠ 改動說明 4** | 功能完整（選入口節點 ＋ 平移置中），時長與縮放下限改變 ＋ 觸發路徑改變 |
| F9 | detail panel 內容 | ✅ | type badge ／ phase 標籤 ／ 節點標題 ／ 文件段 ／ 上游(1) ／ 下游(1) 全到齊 |
| F10 | 上下游可跳轉 | ✅ | 點上游項目跳到 `DevWfSkill` 並選取 |
| F11 | detail panel 關閉 | ✅ | `#detail-close` 清除 selection |
| F12 | 節點文件摘要 | ✅ | 「載入中⋯」→ frontmatter `description`；四句原文一字未改。**另外**：51 個無文件節點顯示「無獨立文件」卡片且**無死按鈕**（改版前是整段不出現，這是改善） |
| F13 | doc drawer 開啟 | **⚠ 改動說明 5 ＋ 修正** | 內容完整（badge／標題／描述／pills／真 markdown）。麵包屑大小寫改變；**去 H1 從未生效的 bug 已修正** |
| F14 | drawer 資料來源 | ✅ | e2e 全程 45 個請求**零個 `.md`**；人工 `file://` 實開抽屜正常渲染 |
| F15 | drawer 關閉三路 | ✅ | `#drawer-close` ／ 點 backdrop ／ ESC 三種都能關 |
| F16 | minimap | **⚠ 改動說明 6** | viewport 方框即時跟隨（實測座標同步）、點擊平移主圖。形態與時長改變 |
| F17 | 主題切換 | **⚠ 改動說明 7** | 三態循環與 `localStorage['dev-workflow-theme']` 完全一致；**圖示改為單字** |
| F18 | 跟隨系統主題 | ✅（**附限制**） | 原始碼機制正確（`matchMedia` change listener ＋ 僅 `mode==='auto'` 才重套）。e2e 工具白名單無「模擬系統色彩偏好」能力，**這項動態行為未被真正跑過**，只有靜態佐證 ＋ 主 context 以 Playwright `--color-scheme` 分別截圖確認兩套色值都正確 |
| F19 | 防 FOUC | ✅ | inline script 仍在第一個 stylesheet 之前（契約 C2a）；navigate 返回時屬性已就緒 |
| F20 | ambient 區塊 | **⚠ 改動說明 8** | 內容完整：強制守則 **9 條**（不可點）＋ 跨流程 skill **5 個**（可點、實測開抽屜）。觸發路徑改變 |
| F21 | hint 文字 | **⚠ 改動說明 9** | 三種狀態的分支保留，字串全部重寫 |
| F22 | 節點配色 | ✅ | light 八型別 fill/stroke 各為不同 hue 的 oklch；dark 重新採樣（fill L≈0.28–0.31、stroke 提亮），hue 跨主題一致。**額外**：每個 token 都補了算出來的 hex fallback |

**結果：22 項全部存在。9 項標改動說明、1 項附驗證限制、1 項另含修正。**

---

## 二、改動說明明細（9 項）

每一項都經 user 逐項確認（spec §已決事項 0 / 3 / 4），不是實作端自行認定。

### 1. F2 — fit-all 能力移除

| | |
|---|---|
| 改版前 | 載入後 40ms 整張圖置中、留 8% padding |
| 改版後 | 對齊流程起點的可讀比例。實測 `translate(42.84, 26) scale(0.534)` |
| 理由 | 圖的縱橫比實測 0.17（`gw 1925 × gh 11196`）。整圖 fit 在 1920×1080 算出 **8.1%**，`NODE_H` 80px 的節點只會畫成 **6.5px**，一個字都讀不到 |
| 性質 | **這是 F1–F22 裡唯一一項真的被移除的能力。** rail 的「置」鈕是「回到起點」，不是「全圖」 |

### 2. F6 — ESC 從兩層變三層

改版前：抽屜開著 → 只關抽屜；否則清除 selection。
改版後：抽屜 → selection → **面板**（新骨架多了召喚式面板這一層）。前兩層行為完全一致。

### 3 / 4 / 8. F7 · F8 · F20 — 觸發路徑從常駐左欄改為召喚式面板

| | 改版前 | 改版後 |
|---|---|---|
| F7 型別篩選 | 點左欄常駐的 Node Types 清單 | 點 rail「型」→ 面板滑出 → 點項目 |
| F8 階段傳送 | 點左欄常駐的 Phase 清單 | 點 rail「段」→ 面板滑出 → 點項目 |
| F20 ambient | 左欄底部常駐兩組 | 點 rail「環」→ 面板滑出 |

**功能與內容一項未減**（8 型別 / 15 phase / 9 條守則 + 5 個 skill 都在，數量實測吻合），
但多了一次點擊。這是 rail 骨架的核心取捨：把畫面讓給流程圖本身。

### 4b. F8 — 時長與縮放下限

改版前 350ms 平移、縮放 <0.35 拉到 0.35；改版後 **560ms**、下限 **0.85**。
配合新的三檔時長體系（`--t-micro 120ms` / `--t-panel 260ms` / `--t-large 380ms`）調過。

### 5. F13 — 麵包屑大小寫

`References / Skill｜Agent / <name>` → `references / skills｜agents / <name>`。
從「分類名」變成「資料夾路徑」，與新設計的檔案系統語彙一致。

### 6. F16 — minimap 形態與時長

右下角 176×128 橫框、點擊 180ms 平移 → **右緣直幅索引條**、點擊 **320ms** 平移。
理由：這張圖縱橫比 0.17，橫框只會把它畫成一條約 20px 的細線。

### 7. F17 — 主題鈕圖示

三顆 SVG icon（sun / moon / auto）→ 「**自 / 明 / 暗**」單字。
三態循環順序、`localStorage` key 與寫入時機完全不變。

### 9. F21 — 狀態列文字

| 狀態 | 改版前 | 改版後（實測抄錄） |
|---|---|---|
| 無選取 | 點 type 或 phase 快速導覽 | 點節點看 1-hop 上下游 · 滾輪縮放 · 拖曳平移 |
| 選節點 | 再點同節點 / ESC 清除 | 焦點 BS · 上游 1 · 下游 1 · Esc 取消 |
| 選型別 | 再點同項清除 / ESC 清除 | 型別 skill 載入 · 22 個節點 |

三種狀態的分支邏輯保留，字串因語境改變而重寫——原文的「點 **type** 或 **phase**」
指的是舊左欄兩個常駐清單，新骨架裡它們叫「型」「段」且藏在 rail 後面，
**畫面上沒有任何地方出現 type 或 phase 這兩個字**。新字串資訊量是原文的超集（帶計數）。

> **F12 / F14 的四句原文刻意維持不變**（`載入中⋯` ／ `（無描述）` ／ `（載入失敗）` ／
> `載入失敗：`），並有契約 C9 守著。標準與 F21 不同是刻意的：那四句在新語境語意不變。

---

## 三、非 F 項的其他差異

### 修正 1：抽屜正文的第一個 H1（`9f3961c`）

baseline F13 明訂「body 用 marked 渲染並**去掉第一個 H1**」。實查改版前 `43d5938` 的
`app.js:603` 是 `body.replace(/^#\s+.+\n?/, '').trim()`——frontmatter 收尾的 `---` 之後
還有一個換行，body 實際以 `"\r\n# xxx"` 開頭，`^#` 永遠匹配不到。
**這條規格從第一天起就沒生效過**，抽屜會把文件名顯示兩次。

改成 `.trim().replace(...).trim()`，實測 31 份內嵌文件全部正確去掉。

> 這不是「順手修既有缺口」：baseline 列的 6 條缺口沒有這條，而 F13 的原文就要求要去掉。
> **修了才是符合規格，不修才是偏離。**

### 改動 2：站名 `bastck`（依 user 決定，spec §已決事項 4）

改版前 `app.js:697` 硬編 `bastck`（疑似 `bstack` 拼錯）。定案設計的頁首是
`dev-workflow`（這張圖的主題名），rail 標記是 `bs`。**該字串已不存在**。

### 改動 3：缺口 3 的 no-op code 移除

baseline §既有缺口 3 記載「`?v=v1|v2|v3` 版本切換是 no-op」——`pickFlowData()` 找
`window.FLOW_DATA_VERSIONS`，但 `data.js` 只提供單一 `FLOW_DATA`，永遠 fallback。

改版後 `pickFlowData()` 連同 fallback 分支整個不存在，直接 `var FLOW = window.FLOW_DATA;`。

**`?v=` 的行為完全沒變**（本來就無效、現在也無效），但實作狀態從「有死 code」變成
「沒有 code」。**「刪掉」不等於「不修」**，所以列在這裡而不是當作缺口維持原狀。

### 新增 1：rail 文件索引面板

點 rail「檔」列出 Skills（27）＋ Agents（6）＝ 33 項，點任一項開抽屜。
baseline 沒有這個功能，是定案設計自帶的。數字從 `NODE_DOCS` 算，不寫死。

### 新增 2：面板「釘」鈕 ＋ 選節點自動收起

未釘住時，選節點會讓面板自動收起（把畫面讓給圖）；「釘」鈕就是這個行為的關閉開關。
兩者是一組，實測皆正確。

### 新增 3：兩條 `@media` 斷點

`1080px`（detail 移到 `right:16px`、minimap 讓路）＋ `860px`（縮面板寬度）。

**兩條是一組**：真正防 `.panel` / `.detail` 重疊的是 1080px 條裡的 `.detail { right: 16px }`
（讓出 134px）。e2e 在 820px 實測到 **24px 重疊**、detail 的關閉鈕與 badge 被壓住，才抓到
只留 860px 那條是不夠的（`min(306px, 100vw-76px)` 在 820px 算出 306、根本不會縮）。

> 這**不是**修缺口 4。baseline 的「零響應式」講的是「窄視窗／手機行為未定義」，
> 這兩條只處理桌面窄視窗的浮層互蓋，**手機行為仍然未定義**（見下方 mobile 實測）。
> 但 baseline 記的「全檔 `@media` 0 命中」已變成 **2 命中**，這個事實記在這裡。

### 新增 4：oklch 的 hex fallback

69 個 oklch 宣告各補一條**算出來的**（非目測）hex / rgba fallback。
Chrome <111 / Safari <15.4 不支援 oklch 時整份色票會落空——畫面不是變醜，是看起來像壞掉。
配上這個站 merge 即上線、無預覽環境，這個失效模式不會有人回報、只會有人默默關掉分頁。

### 新增 5：可及性（rail 專屬，非修缺口 5）

- rail 六顆按鈕補 `aria-label`（`data-label` 只餵 CSS 的 `::after` 名牌、不進可及性樹，
  螢幕閱讀器原本讀到的只有單字「型」「段」「環」「檔」）
- 名牌從只綁 `:hover` 改成也吃 `:focus-visible`（用鍵盤 Tab 過去原本永遠看不到那顆是什麼）
- 主題鈕的 `aria-label` 隨三態更新
- `.node` 補回 `data-id`（**改版前就有**，移植來源掉了；不影響行為，但 e2e 需要穩定選取器）

> **缺口 5 維持未修**：「SVG 節點是 `<g>`、不可 focus、不能用鍵盤選取」那條沒有動。
> 這裡補的是**新骨架把常駐清單換成單字 rail 之後才產生的**新問題。

---

## 四、baseline 既有缺口（6 條，維持未修）

| # | 缺口 | 改版後狀態 |
|---|---|---|
| 1 | `NODE_DOCS` 缺 `design-language` / `design-direction` | **維持未修**。e2e 實測點 `LoadDLang` 顯示「無獨立文件」，與 baseline 吻合。移植來源曾自行補上這兩筆，**已刻意移除**——`references-data.js` 沒有它們的內嵌全文（缺口 2），加了反而會讓節點點出「載入失敗」 |
| 2 | `build-references.ps1` 不在 repo | **維持未修**，未觸碰 |
| 3 | `?v=` 版本切換 no-op | 行為未變，但 no-op code 已移除（見上方「改動 3」） |
| 4 | 零響應式 | **實質維持未修**。手機行為仍未定義；新增的 2 條 `@media` 只防桌面窄視窗的浮層互蓋 |
| 5 | 鍵盤可及性只有 ESC | **維持未修**。SVG 節點仍不可 focus、不能用鍵盤選取 |
| 6 | 無 `prefers-reduced-motion` | **維持未修**，且由契約 C5 機械守住（命中數必須為 0）。依 user 明確指示，改版新增的動畫也不加護欄 |

**mobile 實測（390×844，僅記錄不判定）**：無水平溢位；面板佔滿視口大半、detail 被壓成
極窄一條、rail 的「置」「自」被推到視口底部邊緣。皆為「未定義行為」下的自然結果。

---

## 五、資料契約

| 項 | 改版前 | 改版後 |
|---|---|---|
| nodes | 84 | 84 |
| edges | 103 | 103 |
| phases | 15 | 15 |
| node types | 8 | 8 |
| `REFERENCE_DOCS` | 31 key | 31 key |
| `NODE_DOCS` | 33 key（25 skill + 6 agent + RPT2 + RPT3） | 33 key（同一組） |

`docs/js/data.js` ／ `layout.js` ／ `references-data.js` 三個檔**一個字元都沒動**，
由契約 C8a 以 `git diff --exit-code` 機械保證。

---

## 六、Rollback

merge 即上線、無預覽環境，所以先寫下退路：

本 branch 切出時的 `origin/main`（＝改版前的完整站台）：

```
43d593830204fc3b9896ee5cbb5017324b4218f6
```

merge 之後若發現問題：

```bash
git revert <squash-commit-sha>   # squash merge 產生的那一顆，revert 即回舊站
```

`docs/` 是 GitHub Pages 來源，revert 進 main 之後同樣會自動重新發布。

---

## 七、Evidence

- 契約：`docs/work/refactor/docs-site-redesign/verify/contract.mjs`（`node <path>`，27 條）
- e2e：`docs/work/refactor/docs-site-redesign/test-reports/20260901-1024/`
  （15 張截圖、`console-all.txt`、`network-all.txt`、`report.md`）
- 移植來源：`docs/work/refactor/docs-site-redesign/source-rail-console.html`
  （`design-demos/` 被 gitignore，這份是入版控的副本）
