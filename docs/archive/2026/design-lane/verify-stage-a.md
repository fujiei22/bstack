# 階段 A 驗收記錄

> 對應 plan: `docs/work/feat/design-lane/plan.md` Task 5
> 日期: 2026-08-28
> 驗收對象: bstack 自身（`docs/` 文件站）

**涵蓋範圍**：V1（0b′ 判定生效）、V2（分區辨識，**單區**）、V4（小改路徑）、V8（識別字串）。
V3 屬階段 C1；V5 / V6 / V7 屬階段 B；V9 / V10 屬階段 C1 / C2。

**地圖的處置（user 決定）**：`docs/reference/design-map.md` 為**臨時產物**——建起來跑完驗收後即刪除、**不進版控**。因此地圖內容由本記錄承載。

---

## V2 · 分區辨識（部分達成）

### 偵測過程（依 `design-language` §首次偵測）

| 步驟 | 結果 |
|---|---|
| 1a 具名 glob（7 組） | 只命中 `docs/css/styles.css` |
| 1b **兜底** `**/*.{css,scss}` ＋ 內容篩選 | 另找到 5 個檔：`everything-claude-code/skills/frontend-slides/viewport-base.css`、`gstack/extension/{content,inspector,sidepanel}.css`、`gstack/test/fixtures/review-eval-design-slop.css` |
| 2 排除 vendor / gitignored | 上述 5 個 **全部** 被 `git check-ignore` 命中而排除 |
| 3 追 import 圖 | `docs/index.html:30` 以 `<link rel="stylesheet" href="./css/styles.css">` 引入 |
| 4 合併成區塊 | 單一區塊 |
| 5 `AskUserQuestion` 確認 | user 選「此專案先不建地圖」→ 追問後改為「不進版控，但建臨時的跑驗收」 |

> **這一步同時驗證了 review M8 的兩半**：具名 glob 確實會漏（漏 5 個），所以兜底有必要；而兜底會撈到 vendor，所以排除規則也有必要。兩者缺一，地圖不是漏就是髒。

### 偵測出的區塊表

| 區塊 | 檔案範圍 | 選擇器範圍 | token 來源 | dark 機制 | 框架 | CSS 方案 |
|---|---|---|---|---|---|---|
| 文件站 | `docs/**`（排除 `docs/js/vendor/`） | — | `docs/css/styles.css` | `[data-theme]` | 無 | 外部 stylesheet |

**dark 機制的實測依據**（三機制逐一查）：

| 機制 | 命中數 |
|---|---|
| `prefers-color-scheme` | **0** |
| `[data-theme]` | **5**（宣告在 `docs/css/styles.css:47` 的 `:root[data-theme="dark"]`） |
| `.dark` class | **0** |

> 這條正是 review C4 的來源：若照 v1 的寫法只查 `prefers-color-scheme`，會判成「該區沒有 dark mode」，然後依對齊清單指示「沒有就不要引入」——把規則用反。

**框架判定的誤命中排除**：`grep react|vue|svelte docs/js/*.js` 命中 `references-data.js`，但實查該檔是**資料檔**，內嵌各 skill 全文（`frontend-test` 的觸發詞含這些字）。`docs/index.html` 的 script 標籤只有 vendored d3 / dagre / marked ＋ 自寫 js → 框架判定為「無」。

### 未達成的部分

**多區辨識未驗。** bstack 是單區 repo——實測 58 個 commit 中動過前端檔的只有 4 個 commit、只涉 `docs/index.html` 與 `docs/css/styles.css`。§首次偵測 的分歧路徑（跨區 import 圖合併、class prefix 指認）在此**一行都沒被執行**。
依 D20，S3 標「部分」，真驗收 deferred 到第一個真正多區的專案。

---

## V1 · 0b′ 判定生效

兩個情境各推演一次 Phase 0（依改動後的 `brainstorm` §Phase 0b′ 與 §Phase 0c/0d 合併確認）：

### 情境 A — 純後端：「改 `statusline.sh` 的 git 分支顯示」

| 欄位 | 值 |
|---|---|
| `codebase_impact.files` | `[statusline.sh]` |
| `design.involved` | **`false`**（`.sh` 不在 §前端副檔名） |
| `design.scope` / `scope_evidence` / `size` | `null` / `null` / `null` |
| `design.precedent` | `false` |
| `design.map_status` | `unknown` |
| **合併選單題數** | **2 題**（Track、Tier） |
| 是否讀地圖 | **否**——契約第 1 步不命中就立即回傳 |

> 這驗證了 review C3 的修法：純後端 task **不會**被拉去做區塊偵測。若無 early exit，此處會觸發 7 組 Glob ＋ import 圖追蹤 ＋ 一個必經的 `AskUserQuestion`。

### 情境 B — 前端：「`docs/` 站的節點邊框對比度不夠」

| 欄位 | 值 |
|---|---|
| `codebase_impact.files` | `[docs/css/styles.css]` |
| `design.involved` | **`true`**（`.css` 命中） |
| `design.scope` | `文件站` |
| `design.scope_evidence` | `docs/css/styles.css` |
| `design.size` | **`小改`**（沿用既有 token、無新視覺決策） |
| `design.precedent` | `true` |
| `design.map_status` | `ok`（臨時地圖存在期間） |
| **合併選單題數** | **3 題**（Track、Tier、UI 判定） |

第 3 題的題目描述須同時顯示三項依據：`scope=文件站` ／ `scope_evidence=docs/css/styles.css` ／ `map_status=ok`。

> **Tier 與 size 的錯位在此可見**：本情境動 1 個檔 = **T1**，而 `size=小改` —— 兩根尺這次是一致的。反向的錯位例（T1 但大改）見 plan §兩根尺 的 `docs/` 站整體改版案例。

---

## V4 · 小改路徑（讀設計語言 → 改 code → 四項對齊檢查）

### 步驟 1 — 設計語言抽取（六類質性門檻）

| # | 類別 | 結果 |
|---|---|---|
| 1 | 色彩 token | 行首宣告 distinct **26** 個 / 任意位置 `--name:` distinct **34** 個（該檔一行寫兩個變數）。含 `--blue-*` 色階 7 階、`--c-*` 節點型別 8 組（每組 fill ＋ border） |
| 2 | 字體 | display / body = `'Space Grotesk', ui-sans-serif, system-ui, "Noto Sans TC", "Microsoft JhengHei", sans-serif`；mono = `'Space Mono', monospace` |
| 3 | 間距 scale | 1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 / 10 / 14 / 16 / 18 / 28 px —— **非等比 scale**，逐處指定 |
| 4 | 圓角 / 陰影 | `border-radius: 0`（全直角，是明確的設計決策）；`box-shadow` **零命中** |
| 5 | 斷點 | **N/A**（依據：`@media` 0 命中、`@container` 0 命中） |
| 6 | dark 第二套值 | 有——`:root[data-theme="dark"]`（`styles.css:47`），完整第二套 `--c-*` |
| 7 | 表單慣例 | **N/A**（依據：`docs/index.html` 的 `<form>`／`<input>`／`<select>`／`<textarea>` 皆 0 命中） |

> 六類中 2 類標 N/A 且各有 grep 依據——這正是 review M6／M7 的修法生效：若用 v1 的「至少 30 個具體值」數量門檻，本檔按行首算是 26（不過）、按任意位置算是 34（過），**同一個檔會因為怎麼數而落在門檻兩側**。

### 步驟 2 — 實際改動

`--c-default-bd` 在淺色底上對比不足。WCAG 非文字元素（邊框）門檻 **3:1**，實算：

| | 底色 | 邊框 | 對比 | 判定 |
|---|---|---|---|---|
| light 現況 | `#EEF0F4` | `#96A4B8` | **2.22:1** | 不足 |
| light 改後 | `#EEF0F4` | `#7B8AA0` | **3.08:1** | 通過 |
| dark 現況 | `#2A2D38` | `#7888A0` | **3.81:1** | 已通過 |

改動：`docs/css/styles.css:23` 的 `--c-default-bd: #96A4B8` → `#7B8AA0`（light 區單行）。

### 步驟 3 — 四項對齊檢查

| 項 | 結果 | 依據 |
|---|---|---|
| **元件狀態** | **N/A** | 本次僅調整既有 token 值，未新增或改動互動元件。該區既有狀態覆蓋：`:hover` 14 處、`:focus` 1 處、`:disabled` 0 處 |
| **斷點** | **N/A** | `styles.css` 全檔 `@media` 0、`@container` 0 —— 該區客觀上無斷點維度 |
| **表單** | **N/A** | `docs/index.html` 零表單元件 |
| **dark mode** | **已核對，無需改動** | 該區有第二套值（`[data-theme="dark"]`），第二套的 `--c-default-bd: #7888A0` 實算 **3.81:1** 已達門檻 → 保持不動 |

> **這一項是本次驗收最有價值的證據**：清單要求「有兩套值 → 必須同時看第二套」。實際照做之後，發現第二套本來就達標、不需改——**但我們是查過才知道的**。若沒有這條檢查，直覺會是「light 改了，dark 應該也要跟著改」，那反而會把一個已達標的值改壞。
>
> 同時它驗證了 review M6：四項裡有 **3 項** 落在 N/A。若沿用 v1「任一項答不出來 = 沒讀夠、回去補讀」的規則，這次驗收會在斷點與表單兩項上**無限迴圈**——補讀回去也沒有東西可讀。

### 步驟 4 — 還原

驗收完成後執行 `git checkout -- docs/css/styles.css` 還原。該檔不在 spec §影響檔案 表內，不應留下改動。

---

## V8 · 上游識別字串

```bash
grep -rniE "花叔|alchaincyf|design-philosophy|huashu-gpt-image|huashu-md-html|Huashu-Design" skills/
```

結果：**零命中**。

> ⚠️ 依 **D23**，本專案決定不放置 MIT 版權聲明。**本項通過只代表上游識別字串已清除，不代表授權合規**——兩者是不同的事。

---

## 未達成 / 已知限制

| 項 | 狀態 |
|---|---|
| **V1 / V4 的行為無機械驗證** | 本記錄是人工推演與實跑的紀錄，`plan.md` Task 5 Step 1 對本檔的 grep 只是存在性檢查。markdown prompt 產出的固有限制，`plan.md` §測試策略 已聲明 |
| **多區辨識（V2 的另一半）** | bstack 為單區 repo，驗不到分歧路徑。deferred 到第一個多區專案 |
| **S2 機械保障** | 屬階段 C1（`hooks/design-gate.ps1`）。階段 A 完成到 C1 merge 之間，設計 lane 的規則仍靠自覺執行 |
| **`design-map.md` 未留存** | user 決定不進版控。下次在 bstack 動前端檔時會重跑一次 §首次偵測 |

## 順帶發現（不在本次 scope）

`docs/js/references-data.js` 內嵌各 skill 的**全文副本**，且內容為**改動前的舊版**（仍含「Phase 0 4 子步驟」、`docs/plans/<plan-name>.md` 等已淘汰的寫法）。本次改了 `brainstorm` / `dev-workflow` 兩個 skill，該文件站顯示的內容因此更加過期。spec §範圍 明文排除未列出的檔，故本次不動它，但這是一個真實的資料同步缺口。
