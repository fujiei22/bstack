---
name: design-language
description: |
  既有專案設計語言辨識與對齊（繁中）。觸發：設計語言 / design token /
  設計對齊 / 樣式一致 / 這區長什麼樣 / 誤植 / 前台後台樣式 / 抄錯樣式 /
  沿用既有樣式 / 區塊地圖 / design-map。
  涵蓋：前端副檔名唯一真相、區塊邊界偵測、設計語言抽取（exact values）、
  design-map.md 產／查／失效檢查、四項對齊檢查清單。
  **強制**：brainstorm Phase 0b′ 必載；execute-plan 動前端檔的 task 前後必載。
  分工：既有事實（這區長什麼樣）→ 本 skill；新設計決策 → `design-direction`；改**完**要驗畫面 → `frontend-test`。
---

# design-language

回答兩個問題：**這次改的地方屬於哪一套設計語言**，以及**那套語言長什麼樣**。

不做設計決策（那是 `design-direction` 的事），只把既有事實查清楚並交出去。

## 使用契約（強制）

**載入後依序執行，不跳步**：

1. **先算 `involved`（零成本，必為第一步）**：拿呼叫端給的改動檔清單，**先剔除落在 skill 定義目錄底下的檔**（`~/.claude/skills/**`，或 repo 內含 `*/SKILL.md` 的 `skills/**`）——那些是**工具範本**（元件骨架、腳本），不是這個專案的介面——再比對 §前端副檔名。
   **剩下的全部不命中 → 立即回傳且不讀地圖**：`{involved:false, scope:null, scope_evidence:null, size:null, precedent:false, map_status:unknown}`，結束。
   > 為什麼這步必須在最前面：本 skill 由 `setup.ps1` 同步到 `~/.claude/skills/`，**全域生效**。若把讀地圖／偵測放在前面，這台機器上每個專案的每個 task（含純後端）都要付一次偵測成本。
   > 為什麼錨定「含 `*/SKILL.md`」而非裸 `skills/`：某個專案可能有叫 `skills/` 的產品目錄（例如做技能系統的產品），裸比對會把真實介面靜默排除。
2. **判 `size`**：依 §兩根尺 的判準表判小改／大改。**不看 Tier**。
3. 讀 `<專案>/docs/reference/design-map.md`；不存在 → 進 §首次偵測。
4. 存在 → 跑 §失效檢查。
5. 查表得 `scope` 與 `scope_evidence`，依 §設計語言抽取 讀出該區塊的 exact values。
6. 回傳六個欄位（見 §對外契約）。
7. 呼叫端為「小改」路徑 → 額外執行 §對齊檢查清單。

**禁止**：
- 憑檔名或目錄名**猜**區塊歸屬（必須有 token 來源檔佐證，且該路徑要放進 `scope_evidence` 回傳）
- 憑印象寫 token 值（必須從實際檔案抄 exact values）
- 用 `Tier` 推導 `size`（見 §兩根尺）

**落檔時機（硬規則）**：本 skill **不在 brainstorm Phase 0 當下寫任何檔**。Phase 0 執行時仍在 `main`，`hooks/branch-safety.ps1` 會 `exit 2` 擋掉 repo 內的寫入。`design-map.md` 的落檔一律延到 **branch 建立後**。

---

## §前端副檔名（唯一真相）

```
.css  .scss  .tsx  .jsx  .vue  .svelte  .html
```

其他檔案凡引用「前端副檔名」一律**指向本節**，不要各自重列。

> **現況分歧（待收斂）**：`.sass` 目前只出現在 `frontend-test` 的 description 觸發詞，`verify-done` §UI / browser e2e 兩處與 `dev-workflow` §跨流程觸發表都沒有。本清單暫不收 `.sass`，與多數處對齊；要收的話需同時補回那兩個檔。

---

## §對外契約

```yaml
design:
  involved: <bool>
  scope: <區塊名|null>
  scope_evidence: <token 來源檔路徑|null>
  size: <小改|大改|null>
  precedent: <bool>
  map_status: <ok|remapped|absent|unknown|pending>
```

| 情境 | involved | scope | scope_evidence | size | precedent | map_status |
|---|---|---|---|---|---|---|
| 不含前端檔 | `false` | null | null | null | `false` | `unknown` |
| 含前端檔、專案無設計語言 | `true` | null | null | 小改/大改 | `false` | `absent` |
| 含前端檔、命中地圖 | `true` | 區塊名 | token 檔路徑 | 小改/大改 | `true` | `ok` |
| 地圖過期並重畫 | `true` | 區塊名 | token 檔路徑 | 小改/大改 | `true` | `remapped` |
| 重畫後仍歸不了區 | `true` | null | null | 小改/大改 | `false` | `remapped` |
| **首次偵測完成、尚未落檔** | `true` | 區塊名 | token 檔路徑 | 小改/大改 | `true` | **`pending`** |

**`pending` 的用途**：落檔延到 branch 建立後（見 §使用契約 落檔時機），所以「已在記憶體偵測出地圖、檔案還沒寫」需要一個值——`ok` 不成立（下個 session 讀不到檔）、`absent` 與實情相反。**新專案第一個 UI task 必中此狀態。** 落檔完成後改記為 `ok`。

**`scope_evidence` 的用途**：讓「區塊判錯」看得見。呼叫端在跟 user 確認判定時，必須把 `scope` / `scope_evidence` / `map_status` 三項一起顯示——否則 user 是在沒有依據的情況下按確認，錯了要到樣式跑掉才發現。

---

## §兩根尺（禁止混用）

| 尺 | 量什麼 | 決定什麼 |
|---|---|---|
| `Tier`（T0-T3） | code 改動量體與風險 | TDD ／ review 視角數 ／ security ／ plan 要不要寫 |
| `size`（小改／大改） | 新視覺決策的量體 | 要不要先出三版讓 user 選 |

**禁止用 Tier 推導 `size`。** 兩者系統性錯開，兩個實例：
- 改一個文件站的整體視覺：動 2 檔 = **T1**，但整站換臉 = **大改**
- 10 個元件各加同一個 loading state：>10 檔 = **T3**，但零新視覺決策 = **小改**

**`size` 判準**：

| 判準 | size |
|---|---|
| 沿用既有 token 與元件，無新視覺決策（加欄位、改文案、補既有狀態） | 小改 |
| 新頁 / 新區塊 / 改版 / 需要新的版面結構或資訊層級 | 大改 |

---

## §首次偵測（`design-map.md` 不存在時）

**只在 `involved=true` 且地圖 absent 時才跑。**

1. **找 token 來源檔**：先 `Glob` 具名檔——
   `**/tokens*.css` `**/theme.{ts,js}` `**/colors.{ts,js}` `**/_variables.{scss,sass}`
   `**/globals.css` `**/styles.css` `**/tailwind.config.*`
   **再用 `**/*.{css,scss}` 兜底**，並以「檔內含 `--` custom property 或 `$` / `@` 變數宣告」篩選。
   > 為什麼要兜底：具名檔清單漏掉 style 進入點叫 `app.css` / `main.css` / `index.css` 的專案，而**失效方式是「不報錯、直接說這專案沒有設計語言」**——比報錯更糟。
2. **排除 vendor 與產物**：`node_modules/`、`dist/`、`build/`、`vendor/`、`.gitignore` 命中的路徑、`**/design-demos/`。
3. **追 import 圖**：對每個 token 來源檔，`Grep` 誰 import 它（`@import` / `import` / `<link rel="stylesheet">`），得到使用該套 token 的檔案集合。
4. **合併成區塊**：共用同一組 token 來源的集合 = 一個區塊，用最大公因目錄當「檔案範圍」。
5. **`AskUserQuestion` 給 user 確認或修正**（必經，不得自行定案）。選項：
   1. 表正確，寫入（推薦）
   2. 區塊切錯，我來指認邊界
   3. 此專案先不建地圖（回 `map_status: absent`）
6. 依 §使用契約 的落檔時機寫入 `<專案>/docs/reference/design-map.md`（**branch 建立後才寫**）。

**同檔多區的處理**：同一份 CSS 用 class prefix 區分前後台（`.admin-*` vs `.site-*`）時，import 圖會判成一個區塊。此時在地圖填「選擇器範圍」欄（見下），並在 §設計語言抽取 只讀該 prefix 的規則塊與它 `var()` 到的 token，**不要整份讀**——整份讀會同時吃到兩套 token，那正是要防的誤植。

**偵測不到任何 token 來源檔時**：不要猜。回 `map_status: absent`、`precedent: false`，告訴呼叫端此專案尚無可繼承的設計語言。

---

## §`design-map.md` 格式

落在**被施工的專案**：`<專案>/docs/reference/design-map.md`（**入版控**；該專案的 `docs/` 若被 gitignore 則不 `git add`，依 CLAUDE.md §Docs 落檔）。

```markdown
# 設計語言區塊地圖

> 由 design-language skill 產生。修改後請保留欄位結構。

| 區塊 | 檔案範圍 | 選擇器範圍 | token 來源 | dark 機制 | 框架 | CSS 方案 |
|---|---|---|---|---|---|---|
| 前台 | `src/pages/**` | — | `tokens/public.css` | `prefers-color-scheme` | React | CSS Modules |
| 後台 | `src/admin/**` | — | `tokens/admin.css` | 無 | React | CSS Modules |
| 文件站 | `docs/**` | — | `docs/css/styles.css` | `[data-theme]` | 無 | 外部 stylesheet |
```

| 欄 | 內容 | 為什麼要 |
|---|---|---|
| 區塊 | 人看得懂的名字 | `scope` 的值 |
| 檔案範圍 | glob | 由改動檔反查區塊；**§失效檢查 只吃這一欄** |
| 選擇器範圍 | class prefix，無則填 `—` | 同檔多區時用；不參與路徑比對 |
| token 來源 | 實際檔案路徑 | 抽 exact values 的入口；`scope_evidence` 的值；失效檢查的錨點 |
| dark 機制 | `prefers-color-scheme` / `[data-theme]` / `.dark` / 無 | 抽取端知道去哪找第二套值 |
| 框架 | React / Vue / Svelte / 無 | 小改要照該區寫法改 |
| CSS 方案 | CSS Modules / styled-components / Tailwind / 外部 stylesheet / inline | 同上 |

後三欄是本專案自寫、上游沒有的——沒有它們，「小改直接改 production code」會用錯寫法、也會漏掉第二套色值。

---

## §失效檢查（每次查表前必跑）

地圖會過期。**用機械檢查偵測，不靠記得維護。**

**失效條件（任一中即需重畫）**：

1. 地圖某列的「token 來源」檔案**已不存在**
2. 本次改動檔**落在所有已知區塊的「檔案範圍」之外**
3. 改動檔實際 `import` 到的 token 檔，**與地圖判到的那一列對不上**

> 第 3 條治的是最危險的一種過期：**新區塊長在舊區塊的 glob 底下**（例如 `前台 = src/pages/**`，之後在 `src/pages/admin/**` 長出後台）。此時前兩條都不會響，地圖顯示 ok、`precedent=true`，然後把前台 token 餵給後台——**比沒有地圖更糟**，因為沒地圖時 `precedent=false` 至少會停下來說「這區沒有可繼承的設計語言」。

**驗證指令範例**（跑在被施工的專案）：

```bash
grep -oE '`[^`]+\.(css|scss|sass|ts|js|mjs|cjs)`' docs/reference/design-map.md \
  | tr -d '`' | while read f; do
      [ -e "$f" ] || echo "STALE: token 來源不存在 -> $f"
    done
```

**終止條件（不許無限重跑）**：同一次 task 內已重畫過一次、改動檔仍落在所有區塊之外 → 停止重跑，回 `scope: null` / `map_status: remapped`，走 `AskUserQuestion`：

1. 我指認它屬於哪一區
2. 此檔不納入地圖（例如 `design-demos/` 這類產物）

> 為什麼需要終止條件：§首次偵測 靠 import 圖，**還沒被任何檔 import 的新建檔永遠歸不了區**，不設上限會 stale → 重跑 → 再 stale 無限循環。

**不要做的事**：
- 不要因為 stale 就自行改地圖——一律回 §首次偵測 走 `AskUserQuestion`
- 不要把「新增了一個檔案」當 stale——只有落在**所有**區塊範圍外才算

---

## §設計語言抽取

拿到 `scope` 後，讀出**那一區**的設計語言。只讀該區，不跨區。

**讀什麼**：

1. **token 來源檔**（地圖已記）
2. **2-3 個代表性元件**；**該區若有表單，其中必含一個表單元件**
3. **global stylesheet**：基礎 reset、字體載入
4. **第二套色值**：依地圖的「dark 機制」欄去找——`prefers-color-scheme` media query／`[data-theme]` 屬性選擇器／`.dark` class，**三種都要看**，不要只找其中一種

**怎麼讀**：**抄 exact value，不憑印象重畫。** hex / oklch 色碼、px 或 rem 數值、font stack、border-radius、斷點值——全部照抄，並記下來源檔與行號。

**驗收門檻（質性，非數量）**：下列**六類**每類都要有實際值，或明確標 `N/A（依據：<檔＋grep 結果>）`：

| # | 類別 |
|---|---|
| 1 | 色彩 token |
| 2 | 字體（display / body / mono，含 fallback 鏈） |
| 3 | 間距 scale |
| 4 | 圓角 / 陰影 |
| 5 | 斷點 |
| 6 | dark mode 第二套值 |

> **為什麼不用數量門檻**：數量門檻不可一致執行。實測同一個檔（940 行的文件站 stylesheet），「行首宣告的 distinct 名」是 26 個、「任意位置 `--name:` 宣告」是 34 個——因為它一行寫兩個變數。同一個檔會因為怎麼數而落在「30 個」門檻的兩側。

**輸出格式**（交給呼叫端，不落檔）：

```markdown
區塊：<scope>（依據：<scope_evidence>）
1 色彩：--c-x: #XXXXXX（來源：<檔:行>）…
2 字體：display / body / mono，含 fallback 鏈
3 間距：<實際 scale>
4 圓角 / 陰影：<實際值>
5 斷點：<實際值 或 N/A（依據：…）>
6 dark mode：<機制> + 第二套值來源 或 N/A（依據：…）
7 表單慣例：必填標示 / 錯誤訊息位置 / 錯誤與欄位的關聯做法 或 N/A（依據：…）
框架 / CSS 方案：<取自地圖>
```

**抽不到時**：明說抽不到哪幾類、`precedent: false`，**不要拿別區的值頂替**——那正是「把前台樣式套到後台」的誤植路徑。

---

## §對齊檢查清單（小改路徑必跑）

改完 production code、commit 之前逐項對。**目標是可勾選的檢查項，不是教材**——每項只問一個能當場回答的問題。

- [ ] **元件狀態**：新增或改動的互動元件，七態有漏嗎？
      `default / hover / focus / disabled / loading / empty / error`
      對照該區既有同類元件的處理方式；缺哪態補哪態，該區本來就沒有的態不強加。
- [ ] **斷點**：沿用該區現有斷點了嗎？不得自行發明新斷點值。
      該區若用 container queries 就跟著用，不要混進 media query。
- [ ] **表單**：必填標示、錯誤訊息的位置與樣式，跟該區既有表單一致嗎？
      錯誤訊息與欄位的關聯做法以該區既有為準。
- [ ] **dark mode**：該區有第二套值嗎（依 §設計語言抽取 的三機制判定）？
      有 → 新增的色彩必須同時補第二套；沒有 → 不要單獨為這次改動引入一套。

**每項的 N/A 出口（四項通用）**：該區客觀上沒有這個維度時，**標 N/A 並寫明依據**（檔名＋grep 結果），不算沒讀夠。
例：`斷點：N/A（依據：docs/css/styles.css 全檔 @media 與 @container 皆零命中）`。

**什麼時候要回去補讀**：**該區有這個維度但你答不出來**，才回 §設計語言抽取 補讀。
（前一版寫成「任一項答不出來就補讀」，在沒有斷點也沒有表單的專案上會無限迴圈——補讀回去也沒有東西可讀。）

---

## §與 dev-workflow 銜接

| 呼叫端 | 何時 | 期待輸出 |
|---|---|---|
| `brainstorm` §Phase 0b′ | Phase 0，0b 之後、0c 之前。**必跑**（含純後端 task，因為第 1 步是零成本的副檔名比對） | 六個欄位進 hand-off state；**不落檔** |
| `execute-plan` | `design.involved=true` 且 `size=小改`，動到前端檔的 task 前後 | 前：§設計語言抽取 輸出；後：§對齊檢查清單 逐項結果 |
| `design-direction`（階段 B） | 大改出三方向前，鎖定該區設計語言 | §設計語言抽取 輸出 |
| `verify-done`（階段 B） | 偵測到前端檔但 `design.involved=false` 時的漏網複查 | 重跑判定 ＋ §對齊檢查清單 |

**與 `frontend-test` 的分工**：改**之前**要對齊 → 本 skill；改**完**要驗（Playwright e2e）→ `frontend-test`。兩者觸發詞刻意不重疊。

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「檔名看起來就是後台，直接當後台處理」 | 必須有 token 來源檔佐證，且要放進 `scope_evidence` |
| 「顏色我記得是那個藍」 | 抄 exact value；憑印象重畫一定走樣 |
| 「T1 這麼小，不用讀設計語言」 | Tier 與 `size` 是兩根尺，禁止互推 |
| 「地圖看起來還能用，跳過失效檢查」 | 失效檢查是機械的，跑一次很便宜 |
| 「這區沒有 dark mode，我順手加一套」 | 超出本次 scope；要加是獨立決策 |
| 「抽不到 token，先拿隔壁區的值頂著」 | 這就是「把前台樣式套到後台」 |
| 「純後端 task，這個 skill 跳過」 | 第 1 步是零成本副檔名比對，不命中就立刻結束，沒有跳的必要 |
| 「先寫個 design-map 再說」 | Phase 0 還在 main，寫檔會被 branch-safety 擋；落檔延到 branch 建立後 |
