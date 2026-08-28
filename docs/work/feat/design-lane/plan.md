# 設計 lane 階段 A（能力層）Implementation Plan · v2

> 對應 spec: `docs/work/feat/design-lane/spec.md`（本 plan 只涵蓋 **階段 A**；階段序 A → C1 → B → C2，見 spec §階段拆分）
> 前一版 review: `docs/work/feat/design-lane/review.md`（8 Critical / 10 Major，本版逐條處理，對照表見文末 §review 處理對照）
> Track: Dev | Tier: T3
> 建立: 2026-08-28（v2 重寫）
> 並行最大 group: 5（**全序列，無同 group 多 task**）

**Goal**：讓 dev-workflow 具備「判斷這次有沒有 UI 改動、屬於哪一區、要不要走設計 lane」的能力，並讓**小改路徑**（讀設計語言 → 改 code → 對齊檢查）完整可用**且真的會被觸發**。

**Architecture**：
- 新增能力型 skill `design-language`，形狀對齊既有的 `db-access`——不在 9 階段內，掛 dev-workflow §跨流程 skill 觸發表，由多個 phase 各自呼叫。
- **單一 `SKILL.md`、不開 `references/`**。依據：bstack 現有 25 skill 全為單檔（實測 `find skills -type f ! -name SKILL.md` 回空）。附帶查證：`setup.ps1:296-310` 用 `Get-ChildItem -Recurse -File` ＋ `Substring($skillsRoot.Length)` 保留相對路徑，**未來階段 B 要開 `references/` 不必改 setup.ps1** —— 所以「A 單檔、B 再拆」是零成本可逆決策，不是賭注。
- 判定結果走兩條路：進 hand-off state（給後續 phase 讀）＋ 落 `.design-gate`（給階段 C1 的 hook 讀）。**落檔時機延到 branch 建立後**（見下）。
- 區塊地圖 `docs/reference/design-map.md` 落在**被施工的專案**，不是 bstack。

**🔴 落檔時機（review C1 修正，最重要的一條）**：
`.design-gate` 與 `design-map.md` **絕不在 0b′ 當下寫入**。0b′ 執行時仍在 `main`，而 `hooks/branch-safety.ps1` 對 repo 內、branch 命中 `main` 的 `Write`/`Edit` 一律 `exit 2` —— 在那裡寫檔不是路徑錯，是**根本寫不出來**，且會逼 Phase 0 在 Track/Tier 都還沒判時先決定 branch。
正確做法：0b′ 只在記憶體產出欄位、寫進 hand-off state；兩個檔的落檔**延到 branch 建立後、與寫 `spec.md` 同一步**。

**Tech Stack**：Markdown（skill 定義）；驗證用 `grep -qF` / `find`（Git Bash）。無 runtime 相依、無新 npm/pip 套件。

**測試策略（偏離 write-plan 預設，明寫）**：產出皆為 markdown prompt 檔，無單元測試。5 step 紅綠循環對映為**可執行的結構驗證**：Step 1 寫驗證指令 → Step 2 跑確認 FAIL → Step 3 寫內容 → Step 4 跑確認 PASS → Step 5 commit。
**v2 的三條紀律**（前一版被 review M5 抓到「假綠燈」）：
1. 每條斷言必須抓**該 task 寫入前不可能存在的字串**
2. Step 2 明寫「本次由哪一條拉紅」，其餘標 regression guard
3. 驗證指令用**迴圈型**逐條印 `MISS:`，不用 `&&` 短路（短路只印一個 FAIL，看不出缺哪條）；一律 `grep -qF` 避免 `§`、`.` 被當 regex
**這是存在性檢查，不是行為驗證** —— markdown prompt 的品質只有 Task 5 的行為驗收查得到。

**並行性（review M3/M4 修正）**：本 plan **全序列，5 個 group 各 1 task**。理由：前一版 6 個 group 有 5 個恰好 2 task，而 `execute-plan` §使用契約 規定「同 group 多 task → 載 `dispatch-parallel` 並問 user」→ 5 次 skill 載入 + 5 次選單，只為讓 markdown 編輯少排幾次隊；且 CLAUDE.md §協作模式判定 判準 1 要求「可切 ≥3 塊」，2-task group 永遠過不了。**`parallel-group` 在本 plan 僅表達依賴順序，execute-plan 不需載 `dispatch-parallel`。**

**Risks**：
- Task 3／4 動 `dev-workflow` 與 `brainstorm`——所有 task 的必經之路。緩解：兩檔各自獨立 task、各自驗證；Task 5 端到端跑一次完整 Phase 0。**誠實記錄**：spec §風險 寫的「改動前後各跑一次對照」本 plan 只做「後測」，無 baseline（前一版被 Eng 抓到，v2 不再假裝承接）。
- 「禁止用 Tier 推導 `ui_size`」無機械保障。緩解：寫進三個檔的 Red Flags；合併選單把兩者並列，錯位當場可見。
- 階段 A 完成、C1 未 merge 前，S2 仍靠自律。**此窗口只有一輪 PR**（D21 把 C1 前移的用意）。

---

## §介面契約（跨檔唯一真相，Task 1 定義、Task 3/4 引用）

### hand-off state 欄位（review M2 修正：收進巢狀區塊）

前一版在頂層攤開六個欄位、混用 `ui_*` / `design_*` / `has_*` 三種 prefix，破壞既有 grouping 慣例（`codebase_impact.*`、`verify_results.*`、`frontend_test.*`）。v2 收進一個 `design:` 區塊，與 `frontend_test:` 同形：

```yaml
state:
  design:
    involved: <bool>          # 本次改動是否觸及前端 / UI
    scope: <區塊名|null>       # 命中 design-map 的哪一區
    scope_evidence: <path|null> # 判定依據的 token 來源檔（review M10：讓判錯看得見）
    size: <小改|大改|null>
    precedent: <bool>         # 該區塊有無可繼承的設計語言
    map_status: <ok|remapped|absent|unknown|pending>
```

**`design_path`（三版／單版／一主一變體）不在階段 A**——依 D19 隨設計路徑選單一起移到階段 B。

### 真值表（review M10 修正：釘死所有組合，消除 null 語意矛盾）

| 情境 | involved | scope | scope_evidence | size | precedent | map_status |
|---|---|---|---|---|---|---|
| 改動不含前端檔 | `false` | null | null | null | `false` | `unknown` |
| 含前端檔、專案無設計語言 | `true` | null | null | 小改/大改 | `false` | `absent` |
| 含前端檔、命中地圖 | `true` | 區塊名 | token 檔路徑 | 小改/大改 | `true` | `ok` |
| 含前端檔、地圖過期並重畫 | `true` | 區塊名 | token 檔路徑 | 小改/大改 | `true` | `remapped` |
| 含前端檔、重畫後仍歸不了區 | `true` | null | null | 小改/大改 | `false` | `remapped` |
| **首次偵測完成、尚未落檔** | `true` | 區塊名 | token 檔路徑 | 小改/大改 | `true` | **`pending`** |

**為什麼需要 `pending`**：C1 把落檔延到 branch 建立後，於是「已在記憶體偵測出地圖、檔案還沒寫」這個狀態沒有值可填——`ok` 不成立（下個 session 讀不到檔）、`absent` 與實情相反（明明偵測到了）、`remapped` 語意是「重畫過既有地圖」。**新專案第一個 UI task 必中此狀態。** 落檔完成後由呼叫端改記為 `ok`。

**`stale` 不是回傳值**（review M10）：前一版把 `stale` 列進 enum，但規則是「stale → 一律重跑至 ok」，呼叫端永遠拿不到它。v2 改用 `remapped`，帶「這次重畫過地圖」的資訊給 spec 記一筆。

### 章節錨點（review M4：Task 3 需要，故列進契約）

`design-language` 內必須存在下列章節名，供其他檔引用：
`§前端副檔名`、`§兩根尺`、`§首次偵測`、`§失效檢查`、`§設計語言抽取`、`§對齊檢查清單`、`§與 dev-workflow 銜接`

### 驗證指令的可攜寫法（review Nit）

所有 Step 一律以 `cd "$(git rev-parse --show-toplevel)"` 開頭，**不硬編機器路徑**（本 plan merge 後會進 `docs/archive/`，硬編路徑在別台機器照抄即錯）。
`0b′` 的 `′` 是 U+2032 PRIME，**不作為 grep pattern**（跨檔手打易靜默失敗）；需要驗證該節存在時一律抓 `UI 面判定` 這個 ASCII-safe 字串。

---

## §檔案結構規劃

| 項 | 內容 |
|---|---|
| **新建** | `skills/design-language/SKILL.md` — 副檔名唯一真相、兩根尺、區塊偵測、地圖格式、失效檢查、設計語言抽取、對齊檢查清單、與 dev-workflow 銜接 |
| **改動** | `skills/dev-workflow/SKILL.md` — Phase 0 流程圖加 0b′；`4 子步驟`→`5 子步驟`；四元組→五元組；state 加 `design:` 區塊；跨流程觸發表加一列；Dev track 路徑圖 |
| **改動** | `skills/brainstorm/SKILL.md` — §使用契約 第 1 條四子步驟修正；插入 §Phase 0b′；**刪除** 0c/0d 各自的選單範例並改指向新的合併節；spec 結構加 section；交棒 state；Red Flags |
| **改動** | `.gitignore` — 加 `**/design-demos/` 與 `**/.design-gate`（由階段 B 提前到 A，因 `.design-gate` 在 A 就產生） |
| **執行期產生** | `<專案>/docs/reference/design-map.md` — 區塊表（**入版控**） |
| **執行期產生** | `docs/work/<branch>/.design-gate` — 判定結果（**不入版控**） |
| **驗收產物** | `docs/work/feat/design-lane/verify-stage-a.md` — V1/V2/V4 實跑結果（review Minor：證據不能跑完就沒了） |

---

## Task 1: `design-language` skill 主體

**parallel-group**: 1
**files**:
- create: `skills/design-language/SKILL.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/design-language/SKILL.md; ok=1
for p in \
  "name: design-language" \
  "§前端副檔名" \
  "§兩根尺" \
  "§首次偵測" \
  "§失效檢查" \
  "§設計語言抽取" \
  "立即回傳且不讀地圖" \
  "scope_evidence" \
  "remapped" \
  "選擇器範圍" \
  "驗收門檻（質性，非數量）" \
  "排除 vendor" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
grep -qiE "花叔|alchaincyf|design-philosophy|huashu-gpt-image" "$f" 2>/dev/null && { echo "MISS: 上游識別字串應為零命中"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，全部 12 條 MISS（檔案尚不存在）
# 本次拉紅：全部 12 條；上游識別字串那條是 regression guard（本來就零命中）
# 註：「§與 dev-workflow 銜接」與對齊清單相關字串屬 Task 2 的斷言，不在本 task
#     （前一版誤把它們放進 Task 1，會導致 Task 1 的 Step 4 永遠 PASS 不了）
```

- [ ] **Step 3: 寫內容**

建立 `skills/design-language/SKILL.md`：

````markdown
---
name: design-language
description: |
  既有專案設計語言辨識與對齊（繁中）。觸發：設計語言 / design token /
  設計對齊 / 樣式一致 / 這區長什麼樣 / 誤植 / 前台後台樣式 / 抄錯樣式 /
  沿用既有樣式 / 區塊地圖 / design-map。
  涵蓋：前端副檔名唯一真相、區塊邊界偵測、設計語言抽取（exact values）、
  design-map.md 產／查／失效檢查、四項對齊檢查清單。
  **強制**：brainstorm Phase 0b′ 必載；execute-plan 動前端檔的 task 前後必載。
  分工：改**之前**要對齊 → 本 skill；改**完**要驗 → `frontend-test`。
---

# design-language

回答兩個問題：**這次改的地方屬於哪一套設計語言**，以及**那套語言長什麼樣**。

不做設計決策（那是 `design-direction` 的事），只把既有事實查清楚並交出去。

## 使用契約（強制）

**載入後依序執行，不跳步**：

1. **先算 `involved`（零成本，必為第一步）**：拿呼叫端給的改動檔清單，比對 §前端副檔名。
   **全部不命中 → 立即回傳且不讀地圖**：`{involved:false, scope:null, scope_evidence:null, size:null, precedent:false, map_status:unknown}`，結束。
   > 為什麼這步必須在最前面：本 skill 由 `setup.ps1` 同步到 `~/.claude/skills/`，**全域生效**。若把讀地圖／偵測放在前面，這台機器上每個專案的每個 task（含純後端）都要付一次偵測成本。
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

**落檔時機（硬規則）**：本 skill **不在 brainstorm Phase 0 當下寫任何檔**。Phase 0 執行時仍在 `main`，`hooks/branch-safety.ps1` 會 `exit 2` 擋掉 repo 內的寫入。`design-map.md` 與 `.design-gate` 的落檔一律延到 **branch 建立後、與寫 `spec.md` 同一步**。

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
````

- [ ] **Step 4: 跑驗證確認通過**

```bash
# 同 Step 1 指令
# Expected: PASS
```

- [ ] **Step 5: commit**

```bash
git add skills/design-language/SKILL.md
git commit -m "feat: 加入 design-language skill 主體（契約 / 偵測 / 地圖 / 失效檢查 / 抽取）"
```

---

## Task 2: 對齊檢查清單、Red Flags、與 dev-workflow 銜接

**parallel-group**: 2
**files**:
- modify: `skills/design-language/SKILL.md`（append 三節）

**這三節是上游全包都沒有的自寫內容**（spec §D12-附 缺口 2-5）。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/design-language/SKILL.md; ok=1
for p in \
  "§對齊檢查清單（小改路徑必跑）" \
  "§Red Flags" \
  "§與 dev-workflow 銜接" \
  "default / hover / focus / disabled / loading / empty / error" \
  "標 N/A 並寫明依據" \
  "必填標示" \
  "該區有這個維度但你答不出來" \
  "隔壁區的值頂著" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，7 條 MISS
# 本次拉紅：7 條。「必填標示」是 regression guard —— Task 1 的 §設計語言抽取
# 輸出格式第 7 行已寫入該字串，本 task 不靠它拉紅，只確保沒把它弄丟
#
# 實測補記（execute 階段發現）：第一條原本寫成 "§對齊檢查清單"，實跑只有 6 條
# MISS —— 因為 Task 1 的 §使用契約 第 7 步就前向引用了這個章節名。已改成抓完整
# 標題 "§對齊檢查清單（小改路徑必跑）"，那是 Task 2 才會寫入的字串。
# 教訓：章節名若在別處被前向引用，就不能單獨拿來當斷言（違反紀律 1）。
```

- [ ] **Step 3: 寫內容**

在 `skills/design-language/SKILL.md` 末尾 append：

````markdown
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
````

- [ ] **Step 4: 跑驗證確認通過**

```bash
# 同 Step 1 指令
# Expected: PASS
```

- [ ] **Step 5: commit**

```bash
git add skills/design-language/SKILL.md
git commit -m "feat: design-language 加入對齊檢查清單與銜接說明"
```

---

## Task 3: `dev-workflow` 接上設計 lane

**parallel-group**: 3
**files**:
- modify: `skills/dev-workflow/SKILL.md`（§Phase 0 圖與敘述、§Skill hand-off state、§跨流程 skill 觸發表、Dev track 路徑圖、§使用契約 與 §載入後第一句台詞 的「4 子步驟」）

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/dev-workflow/SKILL.md; ok=1
for p in \
  "UI 面判定" \
  "5 子步驟" \
  "Phase 0 5 子步驟" \
  "scope_evidence" \
  "map_status" \
  "design-language" \
  "動到前端檔的 task 前後" \
  "階段 B 啟用" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
grep -qF "4 子步驟" "$f" && { echo "MISS: 舊的「4 子步驟」應已全數改掉"; ok=0; }
grep -qF "四元組" "$f" && { echo "MISS: 舊的「四元組」應已改成五元組"; ok=0; }
grep -qF "預判完務必 \`AskUserQuestion\` 確認" "$f" && { echo "MISS: :61（C2 殘留第四處）應已改掉"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL
# 本次拉紅：8 條正向 MISS + 3 條負向（實測：「4 子步驟」在 :20/:274、「四元組」在 :31、
#           「預判完務必 AskUserQuestion 確認」在 :61）
```

- [ ] **Step 3: 寫內容**

**改動 1 — §Phase 0 入口分流**：把 `0b 看 codebase` 到 `0d Tier 判定` 之間的區段替換成下圖，**保留其後原有的 T0／T1+ 分支兩行**：

```
0a 對話釐清    ← paraphrase + 讀 memory（user 偏好 / 領域 / 過去決策）
   ↓
0b 看 codebase ← Read / Grep 影響檔；DB 關鍵詞 → 載 db-access
   ↓
0b′ UI 面判定  ← 載 design-language；產出 design.* 六欄
   ↓
0c Track 判定  ← Bug or Dev
   ↓
0d Tier 判定   ← T0/T1/T2/T3
   ↓
三者一次 AskUserQuestion 確認（Track / Tier / UI 判定）
```

圖下方補一句：

```markdown
**0b′ 與 0c/0d 的關係**：`design.size` 與 `Tier` 是**獨立的兩根尺**，禁止互推（細則見 `design-language` §兩根尺）。三者合併在同一個 `AskUserQuestion` 確認，讓錯位當場可見。
```

**改動 2 — 四處文字修正**（動工前實測位置：`:20`、`:31`、`:61`、`:274`）：
- `:20`「進 **Phase 0 入口分流**（4 子步驟，下節展開）」→ `5 子步驟`
- `:31`「Phase 0 結尾產出 `{Track, Tier, spec, codebase-impact}` 四元組」→ `{Track, Tier, spec, codebase-impact, design}` **五元組**
- `:61`「預判完務必 `AskUserQuestion` 確認（推薦選項 = AI 預判結果）。」→ 「**0b′／0c／0d 三者合併成一個 `AskUserQuestion` 一次確認**（推薦選項 = AI 預判結果）。」
  > 這是 review C2 點名的第四處殘留 —— 它與合併選單直接衝突（指示「Tier 判完自己問一次」）。前一版四處只處理了兩處。
- `:274`「內含 Phase 0 4 子步驟」→ `Phase 0 5 子步驟`

**改動 3 — §Skill hand-off state**，在 `codebase_impact:` 區塊**之後、與它同層**加入：

```yaml
  design:                     # 0b′；欄位語意見 design-language §對外契約
    involved: <bool>
    scope: <區塊名|null>
    scope_evidence: <token 來源檔路徑|null>
    size: <小改|大改|null>
    precedent: <bool>
    map_status: <ok|remapped|absent|unknown>
```

**改動 4 — §跨流程 skill 觸發 表**，在 `db-access` 那列之後插入：

```markdown
| `design-language` | brainstorm 0b′（**必跑**，含純後端 task）／ `design.involved=true` 且 `size=小改` 時，execute-plan **動到前端檔的 task 前後**／ user 顯式問設計語言。以下待階段 B 啟用：execute-plan 中途轉進、verify-done 漏網複查 |
```

**改動 5 — Dev track 路徑圖**，在 `1. brainstorm` 與 `2. write-plan` 之間補：

```
1. brainstorm（Phase 0 內建，含 0b′ UI 面判定）
   ↓
   design.size=大改 → 設計 lane（**階段 B 啟用**，目前未接）
   design.size=小改 → execute-plan 動前端檔的 task 前後載 design-language 跑對齊檢查
   ↓
2. write-plan ─→ docs/work/<branch-name>/plan.md
```

- [ ] **Step 4: 跑驗證確認通過**

```bash
# 同 Step 1 指令
# Expected: PASS
```

- [ ] **Step 5: commit**

```bash
git add skills/dev-workflow/SKILL.md
git commit -m "feat: dev-workflow 接上 design-language 與 0b′ UI 面判定"
```

---

## Task 4: `brainstorm` 插入 0b′ 並收斂確認選單

**parallel-group**: 4
**files**:
- modify: `skills/brainstorm/SKILL.md`（§使用契約 第 1 條、插入 §Phase 0b′、**刪改** §Phase 0c / §Phase 0d 的選單、新增 §合併確認、§spec 文件結構、§交棒、§Red Flags）

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/brainstorm/SKILL.md; ok=1
for p in \
  "UI 面判定" \
  "0a → 0b → 0b" \
  "§Phase 0c/0d 合併確認" \
  "## 設計方向" \
  "scope_evidence" \
  "map_status" \
  "純後端 task，0b" \
  "禁止用 Tier 推導" \
  "把三者並列在同一個選單" \
  "decided_at" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 改動 4 專屬：改動 3 與 4 的替換句逐字相同，用出現次數區分（必須是 2 處）
[ "$(grep -cF '判定結果留給' "$f")" = "2" ] || { echo "MISS: 「判定結果留給」應出現 2 次（0c 與 0d 各一），實際 $(grep -cF '判定結果留給' "$f")"; ok=0; }
# 改動 7 專屬：§交棒 區段內必須有 map_status（不能只靠改動 2 命中）
awk '/^## §交棒/,/^## §結尾/' "$f" | grep -qF "map_status" || { echo "MISS: §交棒 yaml 未補 design: 區塊"; ok=0; }
grep -qF "問：判定為" "$f" && { echo "MISS: §Phase 0c 的獨立選單範例應已刪除"; ok=0; }
grep -qF "四子步驟" "$f" && { echo "MISS: §使用契約 的「四子步驟」應已改掉"; ok=0; }
grep -qF "子步驟之間以 \`AskUserQuestion\` 取 user 確認" "$f" && { echo "MISS: §使用契約 第 2 條（C2 殘留）應已改掉"; ok=0; }
# 只比對「標題行」，不能用裸字串——內文會多處引用 §Phase 0c/0d 合併確認
awk '/^## .*UI 面判定/{a=1} /^## §Phase 0c — Track/{ if(!a) exit 1 }' "$f" || { echo "MISS: 0b′ 節必須排在 §Phase 0c 之前"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL
# 本次拉紅：10 條正向 + 改動 4 的計數斷言 + 改動 7 的區段斷言
#           + 3 條負向（實測：「問：判定為」在 :76、「四子步驟」在 :20、
#             「子步驟之間以 AskUserQuestion 取 user 確認」在 :21）+ 1 條順序檢查
#
# 實測補記（execute 階段發現）：順序斷言原本用裸字串 `/§Phase 0c/`，會被改動 1
# 寫進 :21 的「見 §Phase 0c/0d 合併確認」誤命中（該行在 0b′ 節之前）→ 假 FAIL。
# 已改成只比對標題行 `/^## §Phase 0c — Track/`。
# 教訓：章節名會在內文被反覆引用，順序檢查一律只比對標題行。
# 補這幾條的原因：前一版的斷言只證明得了 8 個改動裡的 4 個 —— 改動 4／5／6-後半／7
#   跳過也照樣 PASS。那正是 C2 的原始病灶（刪改型改動沒有反向驗證）在本 task 內復發。
```

- [ ] **Step 3: 寫內容**

**改動 1 — §使用契約 第 1、2 條**（`:20`、`:21`）：

`:20` 改成——

```markdown
1. 進 Phase 0 五子步驟（0a → 0b → 0b′ → 0c → 0d），不跳過。
```

`:21` 現為「子步驟之間以 `AskUserQuestion` 取 user 確認；**禁文字 token NLP 判斷**。」，與合併選單直接衝突（它指示「每個子步驟各問一次」）。改成——

```markdown
2. 0b′／0c／0d 的判定**合併成一個 `AskUserQuestion` 一次確認**（見 §Phase 0c/0d 合併確認）；**禁文字 token NLP 判斷**。
```

> 這是 review C2 點名的四處之一，前一版只處理了 `:73`／`:96` 兩處。剩下的第四處在 `dev-workflow:61`，由 Task 3 改動 2 處理。

**改動 2 — 在 `## §Phase 0c — Track 判定` 之前插入新節**：

````markdown
---

## §Phase 0b′ — UI 面判定

**目的**：判斷本次改動有沒有碰前端、屬於哪一套設計語言、是小改還是大改。

**必跑**——包含看起來純後端的 task。成本極低：`design-language` 的第 1 步是零成本的副檔名比對，不命中就立刻回傳結束，不會去讀地圖也不會做偵測。

動作：

1. **載入 `design-language` skill**，把 0b 得到的 `codebase_impact.files` 交給它。
2. 取回六個欄位（`involved` / `scope` / `scope_evidence` / `size` / `precedent` / `map_status`），寫進 hand-off state 的 `design:` 區塊。
3. **`involved=false` → 到此為止**，繼續 0c。
4. **`involved=true`** → 判定結果進 §Phase 0c/0d 合併確認 的第 3 題一起問。

**本階段不寫任何檔（硬規則）**。Phase 0 執行時仍在 `main`，`hooks/branch-safety.ps1` 會 `exit 2` 擋掉 repo 內的寫入。`.design-gate` 與 `design-map.md` 的落檔一律延到 **branch 建立後、與寫 `spec.md` 同一步**（見 §spec 文件結構與落檔）。

**禁止用 Tier 推導 `size`**。0d 還沒判，這裡也不准先看量體猜。細則見 `design-language` §兩根尺。

**判不出來時**：`map_status: absent`（專案尚無設計語言）照樣繼續、`precedent=false`，不要卡住流程。
````

**改動 3 — 刪除 §Phase 0c 內的選單範例**。

🔴 **刪除範圍是 `:73` 到 `:81`**（實測確認：`:73` 是「`AskUserQuestion` 確認，推薦選項 = AI 預判：」這句、`:74` 空行、`:75` 是 ```` ``` ```` 開頭、`:81` 是 ```` ``` ```` 收尾）。
**`:70-71` 是 Track heuristic 表的最後兩列，絕對不能動** —— 前一版誤寫成刪 `:70-79`，照字面執行會砍掉表格兩列、並留下孤兒的 `  3. 兩者皆有 / 拆分` 與沒有開頭的 ```` ``` ````，把 markdown 結構弄壞。

刪掉後改成一句：

```markdown
判定結果留給 §Phase 0c/0d 合併確認 一次問，**本節不單獨發問**。
```

**改動 4 — §Phase 0d 的「`AskUserQuestion` 確認，推薦 = AI 預判」**（`:96`）同樣改成：

```markdown
判定結果留給 §Phase 0c/0d 合併確認 一次問，**本節不單獨發問**。
```

**改動 5 — 在 §Phase 0d 之後新增合併節**：

````markdown
---

## §Phase 0c/0d 合併確認

0b′ / 0c / 0d 判完後，**用一個 `AskUserQuestion` 一次確認**，不要問三次。

| 情境 | 問幾題 |
|---|---|
| `design.involved=false` | 2 題：Track、Tier |
| `design.involved=true` | 3 題：Track、Tier、UI 判定 |

**第 3 題（UI 判定）的選項**，題目描述必須同時顯示 `scope` / `scope_evidence` / `map_status` 三項，讓 user 看得到判斷依據：

1. `<區塊名>` ＋ `<小改/大改>`，正確（推薦）
2. 區塊判錯，我來指認
3. `size` 判錯

把三者並列在同一個選單，用意是讓 `Tier` 與 `design.size` 的錯位當場可見——「T1 ＋ 大改」（改一個站的整體視覺）或「T3 ＋ 小改」（10 個元件加同一個 loading state）都是合法組合。

> **設計路徑（三版／單版／一主一變體）不在本階段問**——三方向本體 `design-direction` 屬階段 B，在此問等於問一個系統當下答不出來的問題。
````

**改動 6 — §spec 文件結構**，在「## 影響檔案 / Codebase impact」之後插入：

````markdown
## 設計方向（`design.involved=true` 時必填）

- 區塊（`scope`）：　依據（`scope_evidence`）：
- 地圖狀態（`map_status`）：
- `size`：小改 / 大改
- 設計語言摘要：<六類值的重點；N/A 的類別要寫依據>
````

並在 §spec 文件結構與落檔 的落檔步驟補一句：

```markdown
**`design.involved=true` 時**：與 `spec.md` 同一步寫出 `docs/work/<branch-name>/.design-gate`（KEY=VALUE，內容為 `design:` 六欄 ＋ `decided_at`）。**不進版控**（`.gitignore` 已排除）。此檔是階段 C1 的 gate hook 唯一輸入。
```

**改動 7 — §交棒 的 yaml**，補入與 `dev-workflow` §Skill hand-off state 完全相同的 `design:` 六欄區塊。

**改動 8 — §Red Flags 表補兩列**：

```markdown
| 「純後端 task，0b′ 跳過」 | 0b′ 必跑；第 1 步是零成本副檔名比對，不命中就結束 |
| 「T1 這麼小，不用問 UI 判定」 | 禁止用 Tier 推導 size；兩根尺各自判 |
```

- [ ] **Step 4: 跑驗證確認通過**

```bash
# 同 Step 1 指令
# Expected: PASS
```

- [ ] **Step 5: commit**

```bash
# 拆兩個 commit：純新增與刪改分開，讓 revert 不會連 0b′ 一起丟掉
# 第一個 —— 純新增（改動 2 / 5 / 6 / 7 / 8）
git add skills/brainstorm/SKILL.md
git commit -m "feat: brainstorm 加入 0b′ UI 面判定與合併確認節"

# 第二個 —— 刪改既有指示（改動 1 / 3 / 4）
git add skills/brainstorm/SKILL.md
git commit -m "refactor: brainstorm 移除 0c/0d 各自發問的舊指示"
```

---

## Task 5: `.gitignore`、端到端驗收、驗收記錄落檔

**parallel-group**: 5
**files**:
- modify: `.gitignore`
- create: `docs/reference/design-map.md`
- create: `docs/work/feat/design-lane/verify-stage-a.md`

對應 spec 驗收 **V1**（0b′ 判定生效）、**V2**（分區辨識，**單區**）、**V4**（小改路徑）、**V8**（識別字串）。V3 屬階段 C1；V5/V6/V7 屬階段 B；V9/V10 屬階段 C1/C2。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && ok=1
grep -qF "**/design-demos/" .gitignore || { echo "MISS: .gitignore design-demos"; ok=0; }
grep -qF "**/.design-gate" .gitignore || { echo "MISS: .gitignore design-gate"; ok=0; }
test -f docs/reference/design-map.md || { echo "MISS: design-map.md 不存在"; ok=0; }
for p in "docs/css/styles.css" "外部 stylesheet" "[data-theme]" ; do
  grep -qF "$p" docs/reference/design-map.md 2>/dev/null || { echo "MISS(map): $p"; ok=0; }
done
test -f docs/work/feat/design-lane/verify-stage-a.md || { echo "MISS: 驗收記錄未落檔"; ok=0; }
for p in "V1" "V2" "V4" "2 題" "3 題" ; do
  grep -qF "$p" docs/work/feat/design-lane/verify-stage-a.md 2>/dev/null || { echo "MISS(verify): $p"; ok=0; }
done
grep -rqiE "花叔|alchaincyf|design-philosophy|huashu-gpt-image" skills/ && { echo "MISS: skills/ 有上游識別字串"; ok=0; }
git status --porcelain docs/css/styles.css | grep -q . && { echo "MISS: styles.css 有未還原的驗收改動"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL
# 本次拉紅：.gitignore 兩條、design-map.md 四條、verify-stage-a.md 六條
# regression guard：上游識別字串（本來就零命中）、styles.css 乾淨（本來就乾淨）
```

- [ ] **Step 3: 執行驗收**

**3.0 — `.gitignore`**（會命中 `hooks/file-type-guard.ps1` 的 gitignore 類別 → 二次確認）：在「Claude Code per-cwd 權限白名單」那段之前加入

```gitignore
# 設計 lane 的工作產物（不入版控）
**/design-demos/
**/.design-gate
```

**3.1 — 建目錄**：`mkdir -p docs/reference`

**3.2 — V2**：依 §首次偵測 對 bstack 跑一次，經 `AskUserQuestion` 確認後寫入 `docs/reference/design-map.md`。

預期結果與**實測依據**：
- 區塊：**文件站**（單一區塊）
- 檔案範圍 `docs/**`、選擇器範圍 `—`
- token 來源 `docs/css/styles.css`（實測：940 行、行首宣告 26 個 distinct custom property、任意位置 34 個）
- **dark 機制 `[data-theme]`**（實測：該檔 `prefers-color-scheme` **零命中**、`@media` **零命中**，dark 走 `:root[data-theme="dark"]`，位於 `:47`）
- 框架「無」、CSS 方案「外部 stylesheet」

檔頭需補一句：「本專案目前僅一個設計語言區塊」，免得日後被誤認為地圖沒維護。

> **本項只達成單區驗證。** 多區辨識（追 import 圖跨區、class prefix 指認）在 bstack 驗不到——實測 58 個 commit 中動過前端檔的只有 4 個 commit、只涉 `docs/index.html` 與 `docs/css/styles.css`。spec S3 已標「部分」，真驗收 deferred 到第一個多區專案。

**3.3 — V1**：對兩個 prompt 各跑一次 Phase 0——
- 純後端（例：「改 `statusline.sh` 的 git 分支顯示」）→ 預期 `design.involved=false`、`map_status=unknown`，合併選單只問 **2 題**，且**全程沒有讀 `design-map.md`**
- 前端（例：「`docs/` 站的節點邊框對比度不夠」）→ 預期 `involved=true`、`scope=文件站`、`scope_evidence=docs/css/styles.css`、`size=小改`，合併選單問 **3 題**且第 3 題顯示三項依據

**3.4 — V4**：對 `docs/` 做一次真實小改（調整一個 `--c-*-bd` 的對比度），確認流程為「讀設計語言 → 改 code → 四項對齊檢查」且**未觸發三方向**。四項預期答案：
- 元件狀態：N/A 或依實際
- **斷點：N/A（依據：`docs/css/styles.css` 全檔 `@media`／`@container` 零命中）**
- **表單：N/A（依據：該區無表單元件）**
- **dark mode：有第二套值（機制 `[data-theme]`，`:47`）→ 新增／調整的色彩必須同時改第二套**

驗收完 **`git checkout -- docs/css/styles.css` 還原**（該檔不在 spec §影響檔案 表內，不應留改動）。

**3.5 — 落檔**：把 3.2/3.3/3.4 的實跑結果（各問幾題、四項檢查逐項答案與依據）寫進 `docs/work/feat/design-lane/verify-stage-a.md`。

**3.6 — V8**：跑 Step 1 的 `grep -rqiE` 那段確認零命中。
> **注意**：依 D23，本專案決定不放 MIT 聲明。**本項通過不代表授權合規**，只代表上游識別字串已清除。

- [ ] **Step 4: 跑驗證確認通過**

```bash
# 同 Step 1 指令
# Expected: PASS
```

- [ ] **Step 5: commit**

```bash
git add .gitignore docs/reference/design-map.md docs/work/feat/design-lane/verify-stage-a.md
git commit -m "feat: 加入設計 lane 工作產物 gitignore 與 bstack 區塊地圖"
```

---

## §並行性總表

| group | task | 檔案 |
|---|---|---|
| 1 | Task 1 | `skills/design-language/SKILL.md`（new） |
| 2 | Task 2 | 同上（append） |
| 3 | Task 3 | `skills/dev-workflow/SKILL.md` |
| 4 | Task 4 | `skills/brainstorm/SKILL.md` |
| 5 | Task 5 | `.gitignore`、`docs/reference/`、驗收記錄 |

**全序列，每個 group 只有 1 task** → `execute-plan` **不需載 `dispatch-parallel`**。
依賴鏈：Task 1 定契約與章節錨點（`§兩根尺` 等）→ Task 2 同檔 append → Task 3 引用 Task 1 的章節錨點 → Task 4 引用 Task 1 契約與 Task 3 的 state 形狀 → Task 5 驗收全部。

---

## §Self-review

**1. spec coverage**

| spec 項 | 對應 task | 狀態 |
|---|---|---|
| S1 判定＋合併選單 | Task 3、4 | ✅ |
| S2 hook 機械保證 | —— | ⚠️ **階段 C1**（D21 已把它前移到 A 之後） |
| S3 分區不誤植 | Task 1、5 | ⚠️ **部分**——單區驗證通過，多區辨識本專案驗不到（D20 已在 spec 標註） |
| S4 中途轉進 | —— | ⚠️ **階段 B** |
| S5 三方向與豁免選單 | —— | ⚠️ **階段 B**（D19 已把選單移出階段 A） |
| S6 識別字串清乾淨 | Task 1、5 | ✅ 上游識別字串零命中。**注意：依 D23 不放 MIT 聲明，本項不等於授權合規** |
| S7 setup.ps1 孤兒偵測 | —— | ⚠️ **階段 C2** |
| S8 `docs/` 端到端 | Task 5（小改側） | 部分（大改側屬階段 B） |
| 缺口 1 框架／CSS 方案 | Task 1（地圖後三欄） | ✅ |
| 缺口 2-5 對齊清單 | Task 2 | ✅ |

**2. placeholder 掃**：無 `TBD` / `TODO` / 「稍後實作」。每個 Step 3 給出實際要寫入的完整內容（Task 4 改動 3/4/7 為刪改與同步指令，已寫明改成什麼字、與哪一節同步）。

**3. 型別一致**：六個欄位名 `involved` / `scope` / `scope_evidence` / `size` / `precedent` / `map_status` 跨 Task 1、3、4 完全一致，全部位於 `design:` 巢狀區塊底下。`design_path` 已移出階段 A，本 plan 全文不出現。

**4. 並行性檢查**：全序列，無同 group 多 task，不存在隱性依賴風險。

**5. scope 檢查**：新增 `.gitignore` 與 `docs/reference/`、`verify-stage-a.md` 三處，前者由 spec 明列（階段標記已由 B 改 A）、後兩者為執行期產物與驗收記錄。Task 5 的 V4 會暫時改 `docs/css/styles.css`，Step 3.4 明訂驗收後還原、Step 1 有斷言把關。

---

## §review 處理對照（v1 → v2）

| review 項 | 處理 |
|---|---|
| **C1** 落檔被 hook 擋死 | Architecture 加「落檔時機」硬規則；Task 1 §使用契約、Task 4 改動 2／6 三處同步 |
| **C2** Task 9 沒給刪改指令 | Task 4 改動 3／4 明列刪哪個 block、改成哪句；Step 1 加負向斷言 `! grep "問：判定為"` |
| **C3** 無 early exit | Task 1 §使用契約 第 1 步改為零成本副檔名比對、不命中立即回傳 |
| **C4** dark mode 寫死 `prefers-color-scheme` | 抽取改三機制並列；地圖加「dark 機制」欄；Task 5 實測依據改寫為 `[data-theme]` |
| **C5** 階段 A 問設計路徑 | 合併選單降為 3 題，設計路徑移階段 B（D19） |
| **C6** V2 空驗但標 ✅ | S3 改標「部分」，Task 5 明寫多區驗不到及其實測依據（D20） |
| **C7** MIT 與負向 grep 互斥 | 依 D23 記為 user 決定；V8 加註「通過不等於授權合規」 |
| **C8** 小改路徑無 dispatch | Task 3 改動 4 觸發表補「`size=小改` 時 execute-plan 動前端檔的 task 前後」 |
| **M1** 副檔名六處分岔 | Task 1 開 §前端副檔名（唯一真相）；暫不收 `.sass` 並記錄現況分歧（spec §待釐清 5） |
| **M2** 契約 shape | 收進 `design:` 巢狀區塊，與 `frontend_test:` 同形；prefix 統一 |
| **M3** 10 task 應壓到 5 / 並行價值為負 | 5 task、全序列、明寫不需 `dispatch-parallel` |
| **M4** group 1 標錯 | 全序列後不存在；章節錨點另列進 §介面契約 |
| **M5** 假綠燈斷言 | 三條紀律（獨有字串／明寫拉紅／迴圈型 `grep -qF`）；Task 3、4 各加負向斷言 |
| **M6** 對齊清單無 N/A 出口 | 四項通用 N/A 出口；補讀觸發條件收窄 |
| **M7** 30 值門檻不可執行 | 改六類質性門檻，並附 26 vs 34 的實測說明 |
| **M8** glob 太窄／未排除 vendor | 加 `**/*.{css,scss}` 兜底 ＋ 內容篩選 ＋ 排除清單 |
| **M9** 失效檢查三洞 | 加第 3 條失效條件（import 對不上）、終止條件、grep 範例補 `.sass/.mjs/.cjs` |
| **M10** 其餘 | 表單納入抽取與輸出格式；加 `scope_evidence`；真值表；`stale`→`remapped`；地圖拆「檔案範圍／選擇器範圍」兩欄；觸發詞收斂與 `frontend-test` 分工；階段標記；三處「四子步驟／四元組」修正 |
| **Minor/Nit** | **已做**：`cd "$(git rev-parse --show-toplevel)"`；迴圈型驗證逐條印 MISS；`grep -qF`；不 grep `0b′` 的 PRIME 字元改抓 `UI 面判定`；`mkdir -p docs/reference`；驗收記錄落檔；`styles.css` 還原；`§與 dev-workflow 銜接`；地圖檔頭註明單區；`🔴`/`⚠️`/`○` 收斂到不進 `skills/`（保留在 plan 自身）。**未做，如實承認**：見下方兩列 |
| **Minor · V1/V4 零機械覆蓋** | **未修**。落 `verify-stage-a.md` 只解決「證據跑完就沒了」，Step 1 對該檔的 grep 是**手寫就能過**的存在性檢查——V1（各問幾題）與 V4（四項檢查逐項答案）的**行為本身仍無機械驗證**。這是 markdown prompt 產出的固有限制，`plan.md` §測試策略 已聲明「這是存在性檢查，不是行為驗證」 |
| **Minor · 上游識別字串 grep one-liner 未進 spec** | **已修**（見 spec 驗收標準 V8）。review 指出它是**階段 B 的驗收工具**，只留在階段 A 的 plan 裡、merge 進 archive 後就找不到 |

### v2 → v2.1 修正（複驗 agent 抓到的 6 項，全部已改）

| 複驗項 | 問題 | 修法 |
|---|---|---|
| **阻斷 1** | Task 1 Step 1 有兩條**永遠成立不了**的斷言（`§與 dev-workflow 銜接` 屬 Task 2；`六類值` 在 Task 1 內容中根本不存在）→ Step 4 永遠 FAIL | 兩條移除，改抓 Task 1 真的會寫入的 `驗收門檻（質性，非數量）`；Step 2 計數 13→12 並註明原因 |
| **阻斷 2** | Task 4 改動 3 的刪除範圍 `:70-79` **實測是錯的**（選單 block 在 `:75-81`，`:70-71` 是 Track heuristic 表）→ 照字面刪會弄壞 `brainstorm/SKILL.md` | 改為 `:73-81`（含一併刪掉 `:73` 的 lead-in 句），並明寫「`:70-71` 絕對不能動」 |
| **阻斷 3** | Task 4 八個改動只有四個有專屬斷言，改動 4／5／6-後半／7 跳過也會 PASS —— C2 的病灶在 task 內復發 | 補四條：`判定結果留給` 計數 = 2、`把三者並列在同一個選單`、`decided_at`、§交棒 區段內的 `map_status` |
| **誠信 4** | Task 2 Step 2 宣稱「8 條全 MISS」，但 `必填標示` 在 Task 1 就已寫入 | 改為 7 條，並標 `必填標示` 為 regression guard |
| **正確性 5** | C2 點名四處只處理兩處，`brainstorm:21` 與 `dev-workflow:61` 原封不動 | Task 4 改動 1 擴及 `:21`、Task 3 改動 2 擴及 `:61`，兩處各加負向斷言 |
| **正確性 6** | 真值表沒有「偵測完成、尚未落檔」的狀態，新專案第一個 UI task 必中 | 兩張真值表各補 `pending` 一列＋理由；enum 加 `pending` |

一併處理的建議項：Task 4 拆兩個 commit（純新增／刪改分開）；`brainstorm` 內容裡的 `🔴` 拿掉（維持 `skills/` 零新符號）；上游識別字串 grep one-liner 補進 spec V8。
