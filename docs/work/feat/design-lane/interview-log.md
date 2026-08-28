# huashu-design 整合訪談 · 決策紀錄

> 用途：訪談式決定 `huashu-design/` 設計包怎麼整合進 bstack。
> 訪談可能跨 session；本檔是唯一接手依據。
> 狀態：**訪談進行中**。訪談收斂前不寫 spec / plan、不改 `huashu-design/`（上游原始碼，唯一真相來源）。

## 接手須知

- Branch：`feat/design-lane`（2026-08-27 建立，經 user 同意）
- 上游包位置：repo 根目錄 `huashu-design/`，MIT，**不進版控**（`.gitignore` 有 `/huashu-design`）
- 硬約束：MIT 版權聲明（`huashu-design/LICENSE` 的 `Copyright (c) 2026 alchaincyf (花叔 · 花生)`）必須隨程式碼保留；**其餘上游識別字串全部移除**（作者名 / 專案名 / 作者原話 / 指向上游其他 skill 的引用）
- bstack `CLAUDE.md` 強制守則優先於任何 skill：§事實核實 / §決策點選單 / §Docs 落檔 / §PII / §Branch safety

## 訪談大綱（已確認，照此順序）

| # | 主題 | 狀態 |
|---|---|---|
| T1 | 適用邊界改寫（前提題） | ✅ 已決（D3） |
| T2 | 觸發與路由（含後端衍生前端的中途轉進） | ✅ 已決（D4 入口 / D5 中途轉進） |
| T3 | 與 dev-workflow 9 階段的關係 | ✅ 已決（D6 插入位置 / D7 Tier 關係） |
| T4 | 三方向硬門怎麼落地 | ✅ 已決（D8 可變維度 / D9 硬門與豁免） |
| T5 | 既有專案設計語言辨識（獨立 skill vs 併主 skill） | ✅ 已決（D10 分區判準 / D11 封裝） |
| T6 | 去蕪存菁的切法 | ✅ 已決（D12 搬什麼 / D13 補寫缺口） |
| T7 | 落檔與 gate 文件 | ✅ 已決（D14 產出落檔 / D15 gate hook） |
| T8 | 安裝與生效（setup.ps1 行為） | ✅ 已決（D16） |

**訪談狀態：8 題全數收斂（D1-D16）。** spec 已寫至 `docs/work/feat/design-lane/spec.md`（2026-08-28），spec 階段追加 D17（階段拆分）／ D18（skill 命名）。

---

## 決策紀錄

### D1 · 訪談大綱與順序

- **決定了什麼**：照 8 題大綱與上表順序跑（T1 → T8）。
- **依據哪個實據**：T6「去蕪存菁」依賴 T2-T5 的結論——先決定要什麼能力，才知道要搬哪些檔；反序會讓砍檔只能靠猜測。T1 是前提題，其答案會改變 T4 / T5 的問法（見 D-初判 §E-1）。
- **user 當時怎麼說**：`AskUserQuestion` 選「照 8 題順序跑（推薦）」。

### D2 · 決策紀錄落檔路徑

- **決定了什麼**：開 branch `feat/design-lane`，紀錄落 `docs/work/feat/design-lane/interview-log.md`。
- **依據哪個實據**：`hooks/branch-safety.ps1` 對 `$CLAUDE_PROJECT_DIR` 範圍內的 `Write` / `Edit`，當前 branch 命中 `main` 即 `exit 2` 阻擋（不看 gitignore，寫進 `huashu-design/` 一樣被擋）→ 在 `main` 上沒有任何 repo 內路徑可寫。符合 CLAUDE.md §Docs 落檔（dev-workflow 產出全落 `docs/work/<branch-name>/`）。
- **user 當時怎麼說**：`AskUserQuestion` 選「開 branch，落 docs/work/（推薦）」。

### D3 · T1 適用邊界：依量體分流

- **決定了什麼**：設計 lane 的產出**依量體分兩條路**——
  - **小改**（沒有新視覺決策、沿用既有 token 與元件；例：後端加欄位 → 表單跟著加一格）→ **直接改 production code**，但強制跑「既有設計語言對齊檢查」
  - **大改**（新頁 / 新區塊 / 改版）→ **先出視覺提案（mockup）**，user 選定後才落 production code
  - 兩條路都**必須先讀懂該區塊的設計語言**（小改讀了直接改，大改讀了才生三方向）
- **依據哪個實據**：
  - `SKILL.md:3`（description）與 `SKILL.md:54`「不适用场景：生产级 Web App…」與前提②③直接相反 → **改寫這句是整合的第一件事**，否則 skill 觸發時自我否決
  - `SKILL.md:222` 的 100% 三方向硬門若無條件套用在「後端衍生的微改」上，成本與延遲會逼人繞過——而「被繞過」正是上游立此硬門要治的病（`SKILL.md:222` 記載 2026-07-18 被抓現行的案例）
  - 前提②的失敗模式（「把前台樣式套到後台」）是 production code 的失敗，不是 mockup 的失敗 → 排除「只做獨立視覺物」
- **user 當時怎麼說**：`AskUserQuestion` 選「依量體分流（推薦）」，並確認 preview 範例：「後端加一個欄位，表單跟著加一格 → 小改：讀懂該區塊設計語言 → 直接改 code → 對齊檢查」／「新增一個後台報表頁 → 大改：讀懂『後台』設計語言 → 三方向 mockup → 你選 → 落 code」
- **未決、留給後續題**：小改／大改的**量體判準**本身（T2）；大改的三方向在「設計語言已定」前提下要變什麼（T4）；設計語言辨識到多細、怎麼分區（T5）

### D4 · T2a 入口判定：併進 brainstorm Phase 0

- **決定了什麼**：在 `brainstorm` Phase 0 的 0b（看 codebase）之後插入 **0b′「UI 面判定」**子步驟。
  - **訊號**：0b 已產出的 `codebase_impact.files` 副檔名 ＋ user 用詞 ＋ 改動區塊
  - **產出**：`ui_involved` / `ui_scope` / `ui_size` 三個欄位，寫進 dev-workflow §Skill hand-off state
  - **確認方式**：與 0c Track、0d Tier **合併在同一個 `AskUserQuestion`** 一次確認四者（符合 §決策點選單，不多開 gate）
- **依據哪個實據**：
  - 上游包零實作：`SKILL.md:58-72` 路由表欄位名為「任务信号」，整張表判的是 user 用詞，沒有任何一列看檔案或 diff → 前提①在包裡無著落
  - bstack 已有素材但掛錯階：`frontend-test` 的副檔名偵測（`.tsx/.jsx/.vue/.svelte/.html/.css/.scss`）掛在 **verify-done**，即 code 寫完才發現是前端改動，來不及做設計決策
  - 0b 本來就在 Read / Grep 影響檔（dev-workflow §Phase 0），判定所需資料**已經在手上**，另開 skill 等於重讀一次
  - `ui_size`（小改／大改）與 D3 的量體分流天然同位，放同一個判定點成本最低
- **user 當時怎麼說**：`AskUserQuestion` 選「併進 brainstorm Phase 0（推薦）」，並確認 preview 的 0a→0b→0b′→0c→0d 流程圖與「一次 AskUserQuestion 確認四者」。
- **未決**：`ui_size` 小改／大改的具體判準門檻（T2 後續或 T4）；`ui_scope` 的分區粒度取決於 T5

### D5 · T2b 中途轉進：execute-plan ＋ verify-done 兩點

- **決定了什麼**：後端改動衍生前端需求時，可從兩個點轉進設計 lane——
  - **execute-plan（主要轉進點）**：task 進行中發現前端需求 → **暫停當前 task** → 跑 0b′ 補判 → 依 `ui_size` 走小改（讀設計語言 → 改 code → 對齊檢查）或大改（插 mockup 子流程）→ **回寫 `plan.md`** → 接回原 task
  - **verify-done（漏網複查點）**：偵測到改動含前端副檔名、但 Phase 0 判 `ui_involved=false` → 觸發補判，事後補做對齊檢查
- **依據哪個實據**：
  - 上游包完全沒有此路徑：`SKILL.md:58` 明訂「收到任务先扫一遍这张表，确定走哪条线**再开工**」——開頭掃一次就定案，全篇無中途改判機制
  - bstack 這邊唯一的回頭路是 dev-workflow §Fail handling 的「回上層 Phase 重規劃」，但那是**失敗**觸發的路徑，不是「需求長出來」該走的路
  - verify-done 之所以只能當複查點而非主要轉進點：該階 code 已寫完，來不及回頭跑三方向，只能補對齊檢查
- **user 當時怎麼說**：`AskUserQuestion` 選「execute-plan + verify-done 兩點（推薦）」，並確認 preview 的暫停／補判／回寫／接回四步與 verify-done 漏網複查。
- **已知代價（user 已看過並接受）**：execute-plan 要新增中斷／恢復邏輯；`plan.md` 的 task 清單會被動態插入 task，與 write-plan 的原始預估對不上，需回寫

### D6 · T3 插入位置：brainstorm → 【設計 lane】→ write-plan

- **決定了什麼**：大改（`ui_size=大改`）的三方向 mockup 流程插在 **brainstorm 之後、write-plan 之前**，作為 spec 的補完而非取代。
  ```
  brainstorm (0a-0d + 0b′) → spec.md
       ↓ ui_involved=true & ui_size=大改
  【設計 lane】讀懂該區塊設計語言 → 3 subagent 各出一版 mockup
              → AskUserQuestion 選定 → 回寫 spec.md（定案方向 + 截圖路徑）
       ↓
  write-plan → review-plan → execute-plan → verify-done → ...（9 階段原樣不動）
  ```
- **匯回點**：**回寫 `spec.md`**（定案方向 + 三版截圖路徑 + user 選擇原話），write-plan 依定案方向拆 task。
- **依據哪個實據**：
  - 上游 Fallback Phase 1-5 與 bstack brainstorm **重疊而非銜接**：Phase 1-2 = 釐清需求（≒0a）、Phase 3 =「≥500 字設計 spec」（≒spec.md），只有 Phase 3.5-5（取圖 → 三版 → 選定）是獨有的 → 只搬 Phase 3.5-5，Phase 1-3 由 brainstorm 承擔
  - 重疊若不處理會問兩次同樣的問題，且上游那套問法本身自相矛盾（初判 E2-3：`SKILL.md:245`「一次最多 3 个问题」vs `references/workflow.md:7`「至少 10 个问题」）
  - 放在 write-plan 之前的理由：write-plan 要拆前端 task 就必須知道前端長什麼樣，否則拆出來的粒度會因為選了另一版而全部作廢，review-plan 也等於審一份會變的 plan
- **user 當時怎麼說**：`AskUserQuestion` 選「brainstorm →【設計 lane】→ write-plan（推薦）」，並確認 preview 流程圖。
- **已知代價（user 已看過並接受）**：三方向成本（約 3 個 subagent 寫 HTML）在 plan 之前就花下去，若後續 review-plan 被退，這筆花費白費

### D7 · T3b Tier 關係：兩根尺各自判，Tier 不推導 ui_size

- **決定了什麼**：`Tier` 與 `ui_size` 是**兩個獨立維度**，各自判定、互不查表。
  - `Tier`（T0-T3）量 **code 改動量體與風險** → 決定 TDD／review 視角數／security／plan 要不要寫。**判定邏輯一行不改。**
  - `ui_size`（小改／大改）量 **新視覺決策的量體** → 只決定要不要先出三方向讓 user 選。
  - 整合後的 skill **必須明文寫「禁止用 Tier 推導 `ui_size`」**。
- **依據哪個實據**（兩個都取自本 repo，證明錯位是系統性的而非偶發）：
  - `docs/` 站改版：只動 `docs/css/styles.css` + `docs/index.html` = 2 檔 = **T1**（CLAUDE.md「≤2 檔 / 單模組小改」），但視覺上整站換臉 = **大改**。單一 Tier 會判成「跳過設計 lane」。
  - 10 個元件各加同一個 loading state：>10 檔 = **T3**，但沿用既有 token、零新視覺決策 = **小改**。單一 Tier 會白燒 3 個 subagent 產無從選起的三版。
- **user 當時怎麼說**：先回「這個我需要你說明一下你推薦的二維獨立是什麼意思」→ 經上述兩根尺的說明與兩個反例後，選「兩根尺各自判：Tier 不推導 ui_size（推薦）」。
- **已知代價（user 已看過並接受）**：0b′ 多判一個維度、hand-off state 多兩欄；且「禁止用 Tier 推導 ui_size」**沒有 hook 能擋、只能靠文件與自律**

### D8 · T4a 三版可變維度：依「有無可繼承的設計語言」分兩種玩法

- **決定了什麼**：
  | 情境 | 鎖死 | 可變 |
  |---|---|---|
  | **有先例可繼承**（改既有區塊） | 色彩 token / 字體 / 元件庫 | 版面結構、資訊層級、互動模式 |
  | **無先例**（0→1 或全新區塊） | —— | 連設計語言本身一起變（＝上游原本的風格探索） |
- **依據哪個實據**：
  - 「有先例」那一列**上游已寫好可直接複用**：`SKILL.md:317`「三版的布局骨架必须互异：导航/构图/内容区结构**至少一项结构性不同**，不许两版共用同一骨架只换色换字体（盲测实锤：共用骨架会被评审一眼识破『换皮』）」
  - 「設計語言鎖死時三方向仍成立」的原理上游也答過：`SKILL.md:222`「指定風格 → 在該風格語境內做**三個差異化詮釋**」「風格詞收窄解釋空間，不轉移選擇權」
  - 分兩種玩法直接實作前提②的前半（「要能判斷是從 0 開始發想，還是改既有專案」）；若一律鎖死，真正 0→1 的新面向會被迫沿用不相干區塊的樣式 = 前提②要防的誤植
- **user 當時怎麼說**：`AskUserQuestion` 選「依『有無可繼承的設計語言』分兩種玩法（推薦）」，並確認 preview 的兩欄對照。
- **已知代價（user 已看過並接受）**：0b′ 要多判「這個區塊有沒有先例可繼承」，且此判斷有灰地帶（例：做第一個後台頁時，前台算不算先例？）
- **轉給 T5**：上述灰地帶的判準（區塊邊界怎麼切、什麼算「同一套設計語言」）在 T5 定

### D9 · T4b 硬門與豁免：硬門保留，豁免改成選單選項

- **決定了什麼**：
  - 三方向硬門**保留**（`ui_size=大改` → 預設出三版）
  - **豁免不再靠偵測 user 講的話**，改成 0b′ 那個 `AskUserQuestion` 裡的一個選項：
    - ○ 出三版讓我選（推薦）
    - ○ 跳三方向、直接做一版 —— 代價：方向錯了是重做不是換一張
    - ○ 出一主 + 一變體（折衷）
  - 上游四條打架的豁免條款**全刪**（`SKILL.md:225` / `:434` ×2 / `:437`）
- **依據哪個實據**：
  - **這條是硬衝突、非改不可**：`SKILL.md:225` 的豁免條件是「用戶本次會話明說跳過（『不用出三版』『直接做』『就按上次那個方向』）」＝**在對話裡偵測特定字串當 gate 信號**；bstack CLAUDE.md §決策點選單明文「**禁文字 token NLP**（`approve / LGTM / 通過 / ✅` 不當 gate 信號）」
  - 靠猜使用者講的話本來就判不準，上游自己就有四種結論（見初判 E2-1 / E2-2）：`:225` 判「直接做」＝豁免不出三版；`:434` 判同一句「拒答问题≠跳过三方向」＝出三版；`:434` 同行又說「仅当用户明说『别出三版/一版就行』才降为 1 主+1 变体」＝出兩版；`:437` 時間緊迫「只做 1 个方案」但 `:224` 宣稱「唯一豁免（仅此三种）」不含此項
  - 改成結構化選項後這四條矛盾一次消失，且豁免本身變成可稽核的紀錄
- **user 當時怎麼說**：`AskUserQuestion` 選「硬門保留，豁免改成選單選項（推薦）」，並確認 preview 的三選項與代價文字。

### D10 · T5a 分區判準：偵測 → user 確認一次 → 存成 design-map.md

- **決定了什麼**：
  1. **首次**在某 repo 跑設計 lane：自動偵測區塊邊界（追 token / theme 檔的 import 圖 ＋ 目錄結構）
  2. → `AskUserQuestion` 給 user 看切出來的區塊表，確認或修正
  3. → 存進**被施工專案**的 `docs/reference/design-map.md`（不是存在 bstack）
  4. **之後每次查表**；並自動跑失效檢查：① 地圖記的 token 來源檔還在不在 ② 這次改動檔有沒有落在所有已知區塊之外 —— 任一中了即標記過期，重跑偵測 + 確認
- **地圖形狀**（範例）：

  | 區塊 | 範圍 | token 來源 |
  |---|---|---|
  | 前台 | `src/pages/**` | `tokens/public.css` |
  | 後台 | `src/admin/**` | `tokens/admin.css` |
  | 文件站 | `docs/**` | `docs/css/styles.css` |

- **依據哪個實據**：
  - `references/design-context.md` 的**抽取方法可直接複用**且扎實：讀 `theme.ts / colors.ts / tokens.css / _variables.scss`、讀 2-3 個代表性元件、「读代码抄 **exact values**：hex codes、spacing scale、font stack、border radius。不要凭记忆重画」、驗收門檻「**读下来有 30+ 个具体 values 才真的 lift 到了**」
  - 但它**缺分區**：全文 213 行只有「Import 策略」在談範圍，且只按檔案數分大／中／小型（<50 / 50-500 / >500），**無任何一句處理「同一 repo 多套設計語言」** → 前提②的誤植它接不住
  - 落 `docs/reference/` 符合 CLAUDE.md §Docs 落檔的門檻：「這份寫的是**規則**還是做過一次的紀錄？規則才進」——區塊地圖是規則
- **user 當時怎麼說**：先問「自動偵測+快取 和 每次現場偵測 差在哪？快取又會存在哪？」→ 經「誰決定邊界／一致性／成本／出錯時查不查得到」四點對照與存放路徑說明後，選「偵測 → 你確認一次 → 存成 design-map.md（推薦）」。
- **已知代價（user 已看過並接受）**：首次多一輪確認；地圖需隨專案演進更新（靠上述機械失效檢查觸發，不靠記得維護）

### D11 · T5b 封裝方式：獨立 skill，走跨流程觸發表

- **決定了什麼**：設計語言辨識獨立成一個能力型 skill（暫名 `design-language`），列進 dev-workflow §跨流程 skill 觸發表，由三處各自呼叫：
  1. `0b′` 判 `ui_involved=true` 時（要知道屬於哪一區）
  2. 設計 lane（大改出三方向前鎖定語言）
  3. `execute-plan` 中途轉進（小改直接改 code 前對齊）
- **職責**：偵測區塊邊界 → 抽 30+ exact values → 產／查 `design-map.md` → 跑失效檢查
- **依據哪個實據**：
  - bstack 已有同形狀先例：`db-access` 不在 9 階段內，是 §跨流程 skill 觸發表的一列、被多個 phase 各自呼叫 —— 設計語言辨識的形狀與它一致
  - **小改是發生頻率最高的那條路**，且完全不需要三方向／mockup／反 slop 全套；若併進主設計 skill，每次小改都要把整個設計 skill 載進 context
  - `0b′` **判定階段就要用到它**，若併進主設計 skill 等於「判定還沒做完就要先載入判定結果才需要的 skill」
- **user 當時怎麼說**：`AskUserQuestion` 選「獨立 skill，走跨流程觸發表（推薦）」，並確認 preview 的觸發表新增列。

### D12 · T6 去蕪存菁：B 案（10 檔 / 224 KB，實測 `du`）

**要搬的 10 檔**

| 檔 | 用途 |
|---|---|
| `SKILL.md` | 改寫後的主 skill |
| `references/design-context.md` | 抽既有設計語言（歸 `design-language` skill 用） |
| `references/design-styles.md` | 無先例時的 60 種風格庫（網頁 20／PPT 20／信息圖 20） |
| `references/content-guidelines.md` | 反 AI slop 清單 ＋ 可讀性底線 ＋ 現代 CSS |
| `references/typography.md` | 字體配對邏輯／中文排印／`tabular-nums` |
| `references/react-setup.md` | mockup 用單檔 React+Babel 的技術紅線 |
| `references/critique-guide.md` | 5 維度評審 |
| `references/brand-asset-protocol.md` | 設計裡出現具名產品時取官方 logo |
| `assets/design_canvas.jsx` | 三版並排展示 |
| `scripts/fetch_images.py` | 取真圖（內建代理／授權標示／失敗兜底） |

**明確砍掉的（附理由）**

| 砍掉 | 量 | 理由 |
|---|---|---|
| 動畫／影音全叢集（19 refs ＋ 37 SFX ＋ 6 BGM ＋ `demos/` ＋ 相關 script） | 28.7 MB | ① T1 適用邊界＝production 前端 ② **ffmpeg / ffprobe 本機未裝**（實測），整條產線跑不動 |
| `references/verification.md` ＋ `scripts/verify.py` | 16 KB | 與 bstack 既有 `frontend-test` ＋ `frontend-e2e-runner` 重疊，後者為 Playwright MCP 原生、有 PII mask、獨立 context |
| deck / PPT 產線（`slide-decks.md` 745 行、`editable-pptx.md`、`deck_index.html`、`deck_stage.js`、4 個 export script、`html2pptx.js`） | 156 KB | 與前端設計 code 開發零關係；且需 playwright / pdf-lib / pptxgenjs / sharp 四個本機未裝的 npm 依賴 |
| `assets/showcases/`（24 組樣例） | 3.36 MB | 見下方查證 |
| `README.md` / `README.en.md` | — | 上游 repo 行銷頁 |

**showcases 的查證結論**（user 追問後實查）：
- 內容＝8 場景 × 3 工作室流派（Pentagram／Build／Takram），每組 1 HTML + 1 PNG，**用虛構示範內容**（打開 `homepage-pentagram.html` 見「Alex Chen — Indie Developer / 300K Followers」）
- **不是 60 種風格庫的子集**：grep 對照 `design-styles.md`，Pentagram 只出現在 `:217`／`:408` 當「參考出處」、Takram 在 `:458` 是某一種風格的命名來源 → 砍掉它，60 種一種不少
- **與已決流程相衝**：D9 定「現場產三版真實視覺、用 user 真實內容」；上游自己的鐵律 `SKILL.md:290`「絕不讓用戶在只有文字、沒看到視覺時選風格——用戶沒依據」，看別人內容的預製圖同樣沒依據。`INDEX.md:48` 自留退路「完全不匹配 → 跳过预制样例，直接进 Phase 3.5 现场生成」＝上游本就 optional
- 帶陳舊引用：`INDEX.md:115` 指向不存在的 `design-philosophy` skill；`:4`／`:38` 的「Phase 3 推荐」與現行 SKILL.md 的 Phase 3（固化 spec）對不上
- 唯一真價值＝**省 token**（場景精確匹配時先給一張現成圖）。對 bstack 確有一個精確匹配：第 8 場景「開發者文件站」＝ `docs/` 那個站。代價 3.36 MB，user 判定不值

- **user 當時怎麼說**：先追問「24 組風格樣例截圖、設計語言鎖死、風格畫廊是什麼？…是不是代表 B 案對前端設計與開發不完整？」→ 經上述查證說明後，選「B 案：10 檔 / 224 KB（推薦）」。

### D12-附 · B 案覆蓋度查驗結果（user 要求先查驗再決定）

**查驗方法**：把「前端設計 code 開發」拆成能力項，逐項 grep 全包，確認落點與內容實質（非看標題）。

**B 案確實覆蓋（已驗內容）**：抽既有設計語言（`design-context.md`，含「30+ 个具体 values 才真的 lift 到了」門檻）／可讀性與無障礙底線（`content-guidelines.md:165-180`：正文 ≥14px、行動端 16px 防 iOS 自動縮放、hit target ≥44×44、行高 1.5-1.7 中文 1.7-1.8、對比 4.5:1 大字 3:1 WCAG AA）／現代 CSS（`:180-250`：`text-wrap: balance/pretty`、`hanging-punctuation`、Grid named areas、subgrid、container queries、`:has()`、`color-mix`、view transitions）／反 slop／排印／風格庫／三版並排／取圖／評審／logo。

**🔴 全包都沒有的五塊缺口（不是切法造成，C 案／全搬也補不上）**：

| # | 缺口 | 實據 |
|---|---|---|
| 1 | **production 前端框架整合** | `references/react-setup.md` 開宗明義「用 HTML+React+Babel 做**原型**时必须遵守的技术规范」，內容是 unpkg CDN pinned script + `<script type="text/babel">`。全包 grep `Vue\|Svelte\|Next\|Nuxt\|Vite\|webpack\|CSS Modules\|styled-components`，命中**全為順帶提及**（`design-styles.md:198` 拿 Next.js Docs 當風格參考、`design-context.md:45` 拿 Tailwind 當調色盤）→ **零框架整合指引**。D3 的「小改直接改 production code」那條路，包裡一行都沒給 |
| 2 | **元件狀態清單**（empty／error／loading／skeleton／disabled） | B 案 5 個文字檔全 grep，僅 `design-context.md:79` 順帶一句「看 hover state」。無清單、無規範 |
| 3 | **響應式斷點策略** | 僅 `content-guidelines.md:240` 一個 container queries 語法範例；無「斷點怎麼定／mobile-first vs desktop-first／何時換版型」 |
| 4 | **表單設計**（驗證訊息／錯誤態／必填標示） | 全包 grep 僅 `workflow.md`、`sfx-library.md` 命中，皆非設計指引 |
| 5 | **dark mode 實作** | 全包僅一句原則 `content-guidelines.md:99`「不是简单 invert 颜色…不想做 dark mode 就别做」。對照：bstack `docs/css/styles.css` 已實作兩套完整 `--c-*` 值 |

→ 這五塊要自己寫，屬整合工程，在 T6b 決定範圍。

### D13 · T6b 五塊缺口：分兩種處理，全補

- **決定了什麼**：
  - **第 1 塊（框架／CSS 方案）→ 擴充 `design-map.md` 欄位**，由偵測時自動填。理由：這塊**跟專案綁死**（bstack `docs/` 是原生 HTML + 外部 `styles.css`；別的專案可能是 React + CSS Modules），寫死在 skill 裡必然過期；而偵測本來就在追 import 圖，順手就知道。
    | 區塊 | 範圍 | token 來源 | 框架 | CSS 方案 |
    |---|---|---|---|---|
    | 前台 | `src/pages/**` | `tokens/public.css` | React | CSS Modules |
    | 文件站 | `docs/**` | `docs/css/styles.css` | 無 | 外部 `styles.css` |
  - **第 2-5 塊（元件狀態／斷點／表單／dark mode）→ 寫成 `design-language` skill 的「對齊檢查清單」**。這正是 D3 那條「小改直接改 code，但**強制跑既有設計語言對齊檢查**」一直沒定內容的東西。
    - □ 元件狀態：default / hover / focus / disabled / loading / empty / error 七態有漏嗎
    - □ 斷點：沿用該區現有斷點了嗎
    - □ 表單：必填標示／錯誤訊息位置與該區一致嗎
    - □ dark mode：該區有兩套值嗎？新增的補了嗎
- **依據哪個實據**：五塊性質不同不能混寫——第 1 塊是**專案事實**（該偵測、該落地圖），第 2-5 塊是**通用規則**（該寫清單）。上游對兩者皆無可抄（見 D12-附）。
- **user 當時怎麼說**：`AskUserQuestion` 選「分兩種處理，五塊全補（推薦）」，並確認 preview 的 design-map 擴欄與四項檢查清單。
- **已知代價（user 已看過並接受）**：四份通用規則要自己寫（上游無可抄），且寫完要防它膨脹成又一套巨型文件

### D14 · T7a 產出落檔：`docs/work/<branch>/design-demos/`，gitignore，截圖驗完即刪

- **決定了什麼**：
  - 三份 mockup HTML ＋ 截圖落 `docs/work/<branch-name>/design-demos/`
  - **排除於版控**（`.gitignore` 加 `**/design-demos/`）
  - **截圖在檢驗完（user 選定方向後）即可移除**，不必保留
  - 兩個上游 gate 檔**取消獨立檔**：`direction-approved.md` 內容併進 `spec.md`（D6 已定回寫 spec）；`brand-spec.md` 只在涉具名品牌時產、作為 `spec.md` 的一個小節
- **依據哪個實據**：
  - 上游規定與 bstack 硬衝突：`SKILL.md:318`「存當前**項目目錄**（`項目名/design-demos/[逻辑名].html`）——❌ 禁 `_temp/`」vs bstack §Docs 落檔「dev-workflow 產出**全落** `docs/work/<branch-name>/`、檔名固定」
  - 同一件事不開兩個檔：`direction-approved.md` 要記的（展示哪幾版／截圖路徑／user 選擇原話）與 D6 定的「回寫 `spec.md`」完全重疊，分開記必不同步
  - gitignore 有現成先例：**上游自己的 `huashu-design/.gitignore` 就有 `**/design-demos/`**（註解寫「开发/测试中间产物…不分发给用户」）；bstack 也已把 `/huashu-design` 排除在版控外
- **user 當時怎麼說**：選「同位置但 gitignore」並補充「**截圖可以在檢驗完之後移除，不用保留**」。
- **🔴 對 D6 的連帶修正（本輪產生，需在 spec 階段落實）**：截圖既然會被刪，`spec.md` 裡就**不能把截圖路徑當長期依據**。D6 原寫「回寫 spec.md（定案方向 + 截圖路徑）」應改為：**回寫定案方向的文字描述 ＋ user 選擇原話**（可辨識到哪一版、為何選它），截圖路徑僅在當下回合有效、不作為事後追溯依據。
- **待辦（實作階段）**：`.gitignore` 加 `**/design-demos/` 一行 —— 注意此動作會命中 `hooks/file-type-guard.ps1` 的 gitignore 類別（處置：二次確認）

### D15 · T7b Gate hook：廢上游 hook，另寫 `hooks/design-gate.ps1`（block 級）

- **決定了什麼**：
  - `scripts/design-gate-hook.sh` **不移植、直接廢**
  - `0b′` 判定結果落成一個 state 檔（暫定 `docs/work/<branch-name>/.design-gate`，記 `ui_involved` / `ui_size` / 區塊）
  - 新寫 `hooks/design-gate.ps1`（PreToolUse: `Write|Edit`）：
    ```
    改動檔副檔名 ∈ {.css .scss .tsx .jsx .vue .svelte .html}
      ├─ .design-gate 不存在        → exit 2「尚未跑 0b′ UI 面判定」
      ├─ ui_size=大改 且 spec.md 無定案方向段 → exit 2「三方向未完成或未記選定」
      └─ 其餘                       → exit 0
    ```
- **依據哪個實據**：
  - **上游 hook 移植後是死碼**：實讀 `scripts/design-gate-hook.sh`，它只攔 `hyperframes render` / `render-video(-seek).js` / `render-narration.sh` / `npm run render` 四種命令，條件是「時長 ≥45s 且無 `direction-approved.md`」。D12 已砍光影片產線、D14 已取消該 gate 檔 → 攔的命令不會出現、找的檔不存在
  - **但它的立論在 bstack 同樣成立**：`SKILL.md:405`「检查点容易在长会话里被『继续/开工/快点』的**惯性冲掉**」，並記實測案例（2026-07-17 跳過方向確認直接渲 210s 全片 → 整片視覺返工）→ gate 要物化成機器可查的東西
  - hook 讀不到 context 裡的判定結果 → 判定必須落檔，hook 才有東西可查
- **user 當時怎麼說**：`AskUserQuestion` 選「廢舊 hook，另寫 pwsh gate hook（block 級）（推薦）」，並確認 preview 的三分支邏輯。
- **已知代價（user 已看過並接受）**：多一個 hook ＋ 多一個 state 檔要維護；手動改個 CSS typo 也會被擋 → **需要一個可稽核的逆向逃生門**（等價於上游的 `SKIP_DESIGN_GATE=1`），逃生門形式待實作階段定
- **待辦（實作階段，與 T8 相關）**：`scripts/setup.ps1` 的 `$singleFiles` 目前**寫死只 sync 兩個 hook**（`hooks/branch-safety.ps1`、`hooks/file-type-guard.ps1`），新增第三個 hook 必須同時改 `setup.ps1` 的清單 **和** repo 的 `settings.json`（`hooks` 區塊是 setup.ps1 的 RepoOwned key、以 repo 為準強制覆蓋）
- **自我適用提醒**：bstack 自己的 `docs/`（`index.html` + `css/styles.css`）也會命中此 hook 的副檔名清單 —— 改 bstack 文件站時同樣要先跑 0b′

### D16 · T8 安裝與生效：補 setup.ps1 孤兒偵測（列出來問過才刪）

- **決定了什麼**：`scripts/setup.ps1` sync 完後比對 `~/.claude/skills/` 與 repo `skills/`（`agents/` 同理），把「全域有、repo 沒有」的目錄／檔**列出來、經 user 確認才刪**。
- **依據哪個實據**（全為實測讀 `scripts/setup.ps1`，非推斷）：
  - **skills 是全檔遞迴複製**：`Invoke-SyncRepoFiles` 用 `Get-ChildItem -Path $d.FullName -Recurse -File`，`skills/<name>/` 底下所有附屬檔都會進 `~/.claude/skills/<name>/`（B 案 224 KB 無壓力）
  - **🔴 全程只有 `Copy-Item -Force`、零刪除邏輯** → 從 repo 刪除或改名 skill 後，`~/.claude/skills/` 舊版原封不動且仍被 Claude Code 載入。腳本自身備份提醒已承認：「本 repo 列出範圍**之外**的檔案不會動…**建議結束後手動清理** `~/.claude/skills` 與 `~/.claude/plugins`」
  - 實測 `ls ~/.claude/skills` 對照 repo `skills/`：**目前剛好一致**（同為 25 個），坑尚未踩到——但本次要新增／可能改名 skill（主設計 skill + `design-language`），正是會踩到的時機
  - **不採自動刪**：刪 `~/.claude` 內容屬危險動作，CLAUDE.md §Auto-fix 歸「危險類 → `AskUserQuestion`」；且會靜默刪掉他處安裝的 skill（例如 `hyperframes init` 塞進去的 19 個）
- **user 當時怎麼說**：`AskUserQuestion` 選「補：加孤兒偵測，列出來問你才刪（推薦）」。
- **已知代價（user 已看過並接受）**：`setup.ps1` 要改，而該改動本身是危險動作、需寫得保守；手動放在 `~/.claude/skills` 的東西會被列進候選名單
- **連帶待辦**：D15 的第三個 hook 要生效，必須同時改 `setup.ps1` 的 `$singleFiles`（目前寫死只有 `hooks/branch-safety.ps1`、`hooks/file-type-guard.ps1`）**和** repo 的 `settings.json`（`hooks` 是 RepoOwned key，只改本機會被下次 setup 覆蓋）

### D17 · 階段拆分：按風險分三階段，各自獨立 plan / PR

- **決定了什麼**：
  | 階段 | 內容 | 完成後可用 | 風險 |
  |---|---|---|---|
  | **A · 能力層** | `design-language` skill、`design-map.md`、對齊檢查清單、`brainstorm` 0b′、`dev-workflow` 觸發表與 state 欄位 | 小改路徑 | 低、自包含 |
  | **B · 流程層** | `design-direction` skill、三方向、`design-demos/` 落檔與 `.gitignore`、`execute-plan` 中途轉進、`verify-done` 漏網複查 | 大改路徑 | 中 |
  | **C · 工程加固** | `hooks/design-gate.ps1`、`settings.json` 註冊、`setup.ps1`（加 hook ＋ 孤兒偵測） | 機械保障（S2 才真正達成） | 高 |
- **依據哪個實據**：11 項改動混了三種風險等級——改 skill 文字 / 新增一個會 block 的 hook / 改一個會刪 `~/.claude` 內容的安裝腳本。綁同一個 PR 出問題無法定位、也無法單獨 revert。此為 brainstorm §spec self-review 第 4 條（scope 太大 → 提示 user 拆）觸發。
- **user 當時怎麼說**：`AskUserQuestion` 選「拆三階段，按風險分（推薦）」，並確認 preview 的三層內容。
- **已知代價（user 已看過並接受）**：三輪 plan / review-plan / PR，流程點多；且 **A 單獨上線時 gate hook 尚未存在**，S2 的「由 hook 機械保證」在 C 完成前只能靠自律頂著。

### D18 · Skill 命名：`design-direction` ＋ `design-language`

- **決定了什麼**：主 skill 命名 `design-direction`（定設計方向：三方向 → 選定）；能力 skill 命名 `design-language`（辨識與對齊既有設計語言）。
- **依據哪個實據**：須避開 Claude Code 內建的 `design` skill（畫布工具）以免混淆；bstack 現有 25 個 skill 全部以「職責」命名（`write-plan` / `frontend-test` / `db-access`），無一以流程位置命名，故不取 `design-lane`。
- **user 當時怎麼說**：`AskUserQuestion` 選「design-direction + design-language（推薦）」。

### D19 · 階段 A 不問「設計路徑」（review C5）

- **決定了什麼**：階段 A 的合併選單改為 **3 題**（Track / Tier / UI 判定）。設計路徑那題（三版／單版／一主一變體）整段移到階段 B。`ui_size` 照樣判、照樣進 hand-off state。
- **依據哪個實據**：CEO 視角 Critical#1——三方向本體 `design-direction` 在階段 B，plan 的 Task 7 自己寫明「階段 B 才會真正接上」；階段 A 問了之後系統什麼都不會出。
- **這不是推翻 D9**：D9 定的「硬門保留、豁免改成選單選項」仍成立，只是那個選單屬於三方向本體。**D9 是在 D17 拆階段之前做的決定**，當時沒有階段概念。
- **user 當時怎麼說**：主 agent 判定後告知，user 未異議並接受一併處理。

### D20 · S3 驗收改標「部分」（review C6）

- **決定了什麼**：spec 的 S3（分區不誤植）由 ✅ 改為「**部分——單區驗證通過，多區辨識未驗**」，真驗收 deferred 到第一個真正多區的專案。
- **依據哪個實據**（主 agent 實測）：bstack 58 個 commit 中動過前端檔的只有 **4 個 commit**、只涉及 `docs/index.html` 與 `docs/css/styles.css` 兩檔 → bstack 是**單區 repo**，驗不出「改 A 區不會抄到 B 區」。§首次偵測 最複雜的機制（追 import 圖、合併區塊、class prefix 指認）在 Task 10 跑完後一行都沒被執行過分歧路徑。
- **user 當時怎麼說**：主 agent 判定後告知，user 未異議並接受一併處理。

### D21 · Gate hook 拆 C1 / C2，排序改 A → C1 → B → C2

- **決定了什麼**：
  - **C1**（可緊接 A）：只檢查「動前端檔前有沒有跑過 0b′ 判定」——只依賴 A 產出的 `.design-gate`，不依賴 B 的 spec 定案方向段格式
  - **C2**（B 之後）：大改方向驗證 ＋ `setup.ps1` 孤兒偵測
  - 階段排序由 `A → B → C` 改為 **`A → C1 → B → C2`**
- **依據哪個實據**：CEO 視角 Major——階段 A、B 交付的全是靠自覺執行的規則，而**這個 lane 存在的理由就是模型不會自覺去讀設計語言**；用「模型會自覺遵守新規則」解「模型不自覺」，在 hook 上線前是循環論證。另 `.design-gate` 在 A 就產生、到 C 才有讀者，中間兩輪若發現格式要改得回頭改 brainstorm。
- **user 當時怎麼說**：先回「白話說明一下，我沒看懂」→ 經 hook 機制、前後排序的具體差別（三個月後改 `styles.css` 會不會被擋）說明後，選「拆，排 A → C1 → B → C2（推薦）」。
- **已知代價（user 已看過並接受）**：多一輪 PR；**C1 一 merge，user 自己手動改前端檔也會被擋**，逃生門必須先做好且好按。

### D22 · `.design-gate` 落 `docs/work/<branch>/`、不進版控

- **決定了什麼**：檔放 `docs/work/<branch-name>/.design-gate`，`.gitignore` 排除。`.gitignore` 那次改動由**階段 B 提前到階段 A**（順便一併加 `**/design-demos/`）。落檔時機依 review C1 修正：**延到 branch 建立後、與寫 `spec.md` 同一步**，不在 0b′ 當下寫。
- **依據哪個實據**：review C1（Design Critical#2 + Eng Critical#1 獨立提出，主 agent 實測補強）——0b′ 執行時仍在 `main`，`hooks/branch-safety.ps1` 對 repo 內、branch 命中 main 的 `Write`/`Edit` 一律 `exit 2`，該檔**根本寫不出來**，且會逼 Phase 0 在 Track/Tier 都還沒判時先決定 branch。
- **user 當時怎麼說**：先回「這是什麼我也看不懂，白話解釋」→ 經「hook 讀不到 AI 腦袋裡的東西，只能看檔案」的說明後，選「跟 spec.md 同一夾，但不進 git（推薦）」。

### D23 · MIT 版權聲明：照搬上游內容、不放聲明（🔴 user 決定，與其開頭硬約束相反）

- **決定了什麼**：階段 A 的 `design-language` 內容**照搬／改寫自上游 `references/design-context.md`**，且**不放置任何 MIT 版權聲明或 attribution**。
- **與 user 自己開頭硬約束的關係**：user 在任務開頭明訂「**MIT 版權聲明必須隨程式碼保留**（見 `huashu-design/LICENSE`，它明文要求版權聲明隨所有副本保留）」。本決定與該約束**相反**。
- **主 agent 已告知的事實（user 看過後仍選此項）**：
  - `huashu-design/LICENSE` 第三段要求版權聲明包含在「軟體的所有副本或**實質部分**」中
  - bstack 是公開 repo，且 `setup.ps1` 會把 skill 目錄整夾複製到 `~/.claude/skills/`
  - 存在一條合法替代路徑（自己寫、不參照上游段落結構與例子 → 不需任何聲明），user 未採
  - **階段 B 會更難繞**：B 要搬 `design-styles.md`（564 行、60 種風格的具體視覺 DNA 描述與參照案例）、`content-guidelines.md`、`typography.md`，那些是大量具體表達而非通用想法
- **本紀錄的立場**：照 user 決定執行，但**不記載為「已符合授權要求」**。
- **user 當時怎麼說**：先問「這個 MIT 會跟上游 repo 有關嗎？」→ 經授權條款、表達 vs 想法之分、以及合法替代路徑的說明後，選「照搬上游內容，但不放聲明」。

### D24 · `.design-gate` 落檔綁 `involved`、不綁 Tier（補 T0 洞）

- **決定了什麼**：`design.involved=true` 就寫 `.design-gate`，**與 Tier 無關**——T0 也寫（只是仍不寫 `spec.md`）。
- **依據哪個實據**（階段 C1 開工前查證發現，屬階段 A 埋下的洞）：
  - `skills/brainstorm/SKILL.md:138`「**T0** 不寫 spec」
  - 同檔 `:192`「`design.involved=true` 時：**與 `spec.md` 同一步**寫出 `.design-gate`」
  - → **T0 的 task 永遠不會產生 `.design-gate`**，而 C1 hook 的規則是「檔不存在 → `exit 2`」→ **T0 ＋ 前端改動 = 永遠被擋死**，而 T0 正是「改 1 行 / typo / 純設定值」這種最常見的小改
  - 可行性：T0 要改 repo 內的前端檔，本來就得先開 branch（否則 `hooks/branch-safety.ps1` 先擋），開了 branch 就寫得出 `.design-gate`
- **user 當時怎麼說**：`AskUserQuestion` 選「落檔改綁 involved、不綁 Tier（推薦）」。
- **待改位置**：`skills/brainstorm/SKILL.md` §spec 文件結構與落檔（本次由階段 C1 一併修）

### D25 · 不另設逃生門，「跑一次判定」就是門

- **決定了什麼**：`hooks/design-gate.ps1` 只問一件事——這支 branch 跑過 0b′ 了嗎？跑過就解鎖，之後都放行。**不設 `SKIP_*` 環境變數、不設 skip 檔、不設 skip 欄位。**
- **依據哪個實據**：
  - **環境變數方案被實測限制排除**：上游 hook 攔的是 **Bash 指令**，所以能在指令前加 `SKIP_DESIGN_GATE=1` 讓 hook grep 到；本 hook 攔的是 **`Write`／`Edit`**，收到的 JSON 只有 `file_path` 與內容，**沒有任何地方可以 inline 帶環境變數**。只能在啟動 Claude Code 前設，粒度是整個 session 且要重開才關得掉。
  - 專用 skip 檔的問題是 **sticky**：忘了刪就永遠開著，而且它也在 `.gitignore` 裡、沒人看得到門是開的。
  - 寫進 `.design-gate` 的 skip 欄位更糟：它依賴該檔先存在，而「檔根本不在」正是最常被擋的情境——逃生門在最需要它的時候沒地方寫。
  - 配上 D24 之後，解鎖門檻本來就很低（跑一次判定，那本來就是想要的行為）。
- **user 當時怎麼說**：`AskUserQuestion` 選「不另設，『跑一次判定』就是門（推薦）」。
- **已知代價（user 已看過並接受）**：真的遇到 hook 誤擋（bug）時，唯一出路是手動改 `~/.claude/settings.json` 拿掉那條 hook。

### D26 · 廢掉 design-gate hook，改寫進 CLAUDE.md 強制守則（**推翻 D21 / D15 / D22 / D24 / D25**）

- **決定了什麼**：
  - **不做 `hooks/design-gate.ps1`**。階段 C1 由「最小 gate hook」改為「**全域守則條文**」——在 `CLAUDE.md` 強制守則加一條 §設計語言對齊，與 §事實核實、§決策點選單 同等地位。
  - 連帶：**`.design-gate` 檔一併廢除**（它在 skill 裡的定義就是「hook 的唯一輸入」，沒有 hook 就沒有讀者）。
  - 階段序回到 **A → B → C**（C 只剩 `setup.ps1` 孤兒偵測）。
- **依據哪個實據**：
  1. **既有兩支 hook 防的是不可逆傷害，design-gate 防的是可逆的品質問題** —— `branch-safety` 防「在 main 上直接寫入」（難以乾淨復原、污染共用歷史）、`file-type-guard` 防「密鑰 commit」（不可逆外洩）。而「改顏色前沒讀設計語言」改錯了 `git checkout --` 就回來了，且 verify-done / request-review 本來就在抓品質問題。**這是不同類別的東西，原 plan 把它們放進同一個籃子。**
  2. **這套系統每一道 gate 都靠 CLAUDE.md 文字，不是 hook** —— §事實核實雙 source、§決策點選單、Tier 判定、§Docs 落檔、§Fail handling 全都沒有 hook。CEO 視角的「用『模型會自覺遵守新規則』解『模型不自覺』是循環論證」**證明太多**：照該邏輯 CLAUDE.md 每一條都是循環論證，整套流程根本不該能運作。
  3. **在 auto mode 下這支 hook 幾乎不會被觸發（實測）** —— `settings.json` 的 matcher 只有 `Write|Edit|NotebookEdit`，**無任何 hook 攔 Bash**；而 auto mode 明確指示「改檔優先用 sed / heredoc / 短腳本而非 Edit / Write 工具」。本 session 大多數編輯確實走 python heredoc → hook 一次都不會觸發。
  4. **會誤傷這台機器上所有其他前端專案（reviewer 沙盒實測）** —— 判定鏈無 opt-in，只要是 git repo ＋ 非保護分支 ＋ 前端副檔名就擋，而 `docs/work/` 是本套流程專有慣例，別的專案永遠沒有。配上 D25「無逃生門」，那些專案要工作得先改全域設定檔。
  5. **錯誤訊息在教它怎麼繞** —— 原設計的訊息明寫「缺少檔案：`docs/work/$branch/.design-gate`」，對被擋住的模型而言那是「建立這個檔就好」。`New-Item` 一行解鎖，成本遠低於跑 0b′。
- **user 當時怎麼說**：先回「我看不懂你提供的幾個選項分別是怎麼處理的」「我現在反而對這個 hook 有疑問，為什麼需要存在這個 hook？」→ 經上述說明後表示「**我認為開 auto mode 什麼都沒有阻攔到很合理，但只要全域設定內也有說到要檢查的事項，就算不是硬性規定也沒關係，因為整個作業流程的 gate 也是建築在此一基礎之上**」→ 選「廢掉 hook，改寫進 CLAUDE.md 強制守則（推薦）」。
- **被推翻的先前決策**：
  | 決策 | 原內容 | 現況 |
  |---|---|---|
  | **D15** | 廢上游 hook、另寫 `hooks/design-gate.ps1`（block 級） | **廢除**——不寫任何 hook |
  | **D21** | 拆 C1／C2、排序 A → C1 → B → C2 | **廢除**——回到 A → B → C |
  | **D22** | `.design-gate` 落 `docs/work/<branch>/`、不進版控 | **廢除**——檔本身取消 |
  | **D24** | `.design-gate` 落檔綁 `involved` 不綁 Tier（補 T0 洞） | **失效**——沒有這個檔就沒有這個洞 |
  | **D25** | 不另設逃生門 | **失效**——沒有 hook 就沒有要逃的門 |
- **仍然成立的**：D1-D14、D16-D20、D23。spec 的 S2 需改寫（見下）。

### D27 · 階段 B 拆兩輪：B1 skill 本體 / B2 流程接點

- **決定了什麼**：
  - **B1** = `design-direction` skill 本體（SKILL.md 改寫 ＋ 6 個 reference 搬入去識別 ＋ 2 個資產），約 6 task
  - **B2** = 流程接點（`execute-plan` 中途轉進、`verify-done` 漏網複查、`dev-workflow` 接上 `design-direction`），約 4 task
- **依據哪個實據**：
  - 量體：上游 `SKILL.md` **579 行 / 17 章節**、6 個 reference 合計 **1,835 行**、外加 3 個既有 skill 要改。前一份 5-task 的 plan 就已 900 行
  - **兩者風險性質不同**：B1 全是**新建檔**（改壞了不影響現有流程）；B2 動的是 `execute-plan` / `verify-done`——**所有 task 的必經之路**
- **user 當時怎麼說**：`AskUserQuestion` 選「拆兩輪：B1 skill 本體 / B2 流程接點（推薦）」。

### D28 · `design-language` 排除 `skills/**`

- **決定了什麼**：`design-language` §使用契約 第 1 步（`involved` 判定）加一條——改動檔落在 `skills/**` 底下 → `involved=false`，不算專案 UI。
- **依據哪個實據**（規劃 B1 時發現，屬 C1 階段埋下的問題）：
  - B1 要把 `design_canvas.jsx` 放進 `skills/design-direction/assets/`，而 **`.jsx` 就在我自己寫進 `CLAUDE.md` 的前端副檔名清單裡**
  - 現有排除清單（`node_modules/`、`dist/`、`build/`、`vendor/`、gitignore 命中、`**/design-demos/`）**不含 `skills/`**，且該排除只寫在 §首次偵測 第 2 步（找 token 來源用），**不在 `involved` 判定那一步** → 判定仍會回 `true`
  - 後果：每次動 skill 的 `.jsx` / `.html` 附屬資產，都會跑一遍區塊偵測 ＋ 對齊檢查，而那個檔根本不屬於任何設計語言區塊——純粹損耗，且會讓人開始想繞過這條規則
  - 理由：**skill 資產是工具範本，不是這個專案的介面**
- **user 當時怎麼說**：`AskUserQuestion` 選「design-language 排除 skills/**（推薦）」。
- **已知代價（user 已看過並接受）**：若未來真的要在 `skills/` 下做一個真實介面會漏掉（實務上不會發生）。

### D29 · 框架修正：bstack 是**多專案共用的全域設定**，不是單一專案

- **決定了什麼**：評估「某個能力要不要留」時，**不得以「bstack 這個 repo 用不用得到」為判準**。bstack 經 `setup.ps1` 裝到 `~/.claude/`，服務這台機器上的每一個專案。
- **為什麼記這條**：階段 B1 的 plan review 中，**主 agent 與 CEO 視角共用了一個錯誤前提**——用「bstack 全 repo 只有 2 個前端檔、零第三方品牌」論證砍掉 `critique-guide.md`（221 行）與 `brand-asset-protocol.md`（250 行）。那是**用最不具代表性的使用者決定所有人的工具箱**。
- **user 原話**：「整個 bstack 是要給很多人用的 claude code 全域設定，不是只為了這個專案，bstack 有可能被拿去開發很多專案」
- **連帶影響（如實記載）**：
  - **D12 部分依據被削弱**：當時砍動畫／影音叢集的兩個理由中，「本機 ffmpeg 未裝」是**機器特定**的，別的機器可能有。但另一個理由（T1 適用邊界＝production 前端）是 scope 決策、仍然成立，故 **D12 結論維持**。
  - **`design-styles.md` 的 PPT／信息圖 353 行**：砍它的理由是「SKILL.md §適用邊界 自己寫不涵蓋這些產線」——那是**產品定位**而非「這個 repo 用不到」，故仍然成立。
- **重新評估 `critique-guide.md` 的結果**（依此框架重查）：6 個維度裡**維度 0（概念/立意，權重最高）、2 視覺層級、3 細節執行、4 功能性、5 創新性 —— 五個都是通用的**；只有維度 1（哲學一致性）需要「選定設計師/流派」當輸入，而 `precedent=false` 走風格庫時風格庫本身就標了流派與參照案例，**弱但不是沒有**。原本接受 CEO 砍它是判斷錯誤。

### D30 · 6 個 reference 全留，逐檔修剪（約 1,390 行）

- **決定了什麼**：

  | 檔 | 原 | 目標 | 處置 |
  |---|---|---|---|
  | `content-guidelines.md` | 260 | 260 | 全留（反 slop ＋ 可讀性底線 ＋ 現代 CSS） |
  | `typography.md` | 260 | ~250 | 修正中文字體地圖的 SC 偏向（10 款只有 1 款繁體導向） |
  | `react-setup.md` | 280 | ~245 | 砍 `:140-175`「把 Anthropic API key 貼進 HTML」那節 |
  | `design-styles.md` | 564 | ~210 | 砍 PPT 20 種 ＋ 信息圖 20 種 ＋ AI 生圖 共 353 行 |
  | `critique-guide.md` | 221 | ~180 | 砍不適用場景列、修正為 **6 維**（原 plan 誤寫 5 維且漏掉權重最高那維） |
  | `brand-asset-protocol.md` | 250 | ~200 | **改寫**「固化為 `brand-spec.md` 檔案」以符 D14；拿掉 `nano-banana-pro` / `yt-dlp` / `ffmpeg` 依賴 |
  | **合計** | **1,835** | **~1,345** | |

- **全部要繁化 ＋ 台灣用語轉換**（S1 已定）。
- **依據**：D29 的框架修正 ＋ review K3（353 行屬明文排除產線）＋ K10/K11 揭露的兩處硬問題（D14 衝突、缺失依賴）。
- **user 當時怎麼說**：先問「為什麼不把 critique-guide 納入？」並指出 scope 框架錯誤 → 經重新評估後選「6 檔全留，但逐檔修剪（推薦）」。

### D31 · 在 B1 就修 `verify-done` 的 e2e gate

- **決定了什麼**：在 `verify-done` 的兩處前端副檔名清單（`:52`、`:81`）加上「`skills/**` 底下的前端檔不觸發 e2e」，**在 B1 做，不等 B2**。
- **依據**：
  - review K4（Eng 獨家）：`verify-done:87` 對 T3 是「**必跑，fail 不能放行**」，本 branch 是 T3；而 `design_canvas.jsx` 實測 `export` / `<!DOCTYPE` / `<html` 命中數 **0**——它是靠 `Object.assign(window,…)` 導出的元件片段，上游 `SKILL.md:494` 明寫用法是「inline 進你的 HTML `<script>` 標籤」。**沒有 HTML 宿主，e2e 無從跑起。**
  - 依 D29，「skill 的附屬資產不該觸發 e2e」是**通用規則**——別的專案寫 skill 放前端資產時會撞到同一個問題，值得根治而非繞過。
  - 這與 B1 Task 1 對 `design-language` 做的事（D28）是**同一類修正**，放同一輪反而一致。
- **user 當時怎麼說**：先回「我已經忘記 B1、B2 那些階段了，把你建議的做法跟流程影響一起說明我再決定」→ 經階段結構與三個選項的流程影響說明後，選「在 B1 就修 verify-done（改推薦）」。
- **已知代價（user 已看過並接受）**：提前動一個原本排在 B2 的檔，而 `verify-done` 是所有 task 的必經之路（但本次只加一條排除、不動其他邏輯）。

---

## 訪談收斂總結（D1-D16）

**整合後的形狀**

```
brainstorm Phase 0
  0a 對話釐清 → 0b 看 codebase
  0b′ UI 面判定  ← 新增（呼叫 design-language skill 查 design-map.md）
       產出 ui_involved / ui_scope / ui_size，落 .design-gate
  0c Track → 0d Tier
  └─ 一次 AskUserQuestion 確認四者 + 設計路徑（三版 / 跳過 / 一主一變體）
       ↓
  ui_size=大改 →【設計 lane】鎖語言 → 3 subagent 出三版 → 選定 → 回寫 spec.md
  ui_size=小改 → 不進設計 lane
       ↓
write-plan → review-plan → execute-plan → verify-done → request-review → ... （9 階段不變）
                              ↑ 中途轉進點        ↑ 漏網複查點
```

**新增／改動清單**

| 項目 | 動作 |
|---|---|
| 主設計 skill | 新增（B 案 10 檔改寫而成） |
| `design-language` skill | 新增（跨流程觸發表一列；含對齊檢查清單） |
| `brainstorm` SKILL.md | 加 0b′ 子步驟 |
| `dev-workflow` SKILL.md | hand-off state 加欄位；跨流程觸發表加一列；execute-plan／verify-done 轉進點 |
| `execute-plan` SKILL.md | 加中斷／恢復邏輯、回寫 plan.md |
| `verify-done` SKILL.md | 加漏網複查 |
| `hooks/design-gate.ps1` | 新增 |
| `settings.json` | 註冊新 hook |
| `scripts/setup.ps1` | `$singleFiles` 加新 hook；加孤兒偵測 |
| `.gitignore` | 加 `**/design-demos/` |
| 各專案 `docs/reference/design-map.md` | 首次跑時產生 |

**跨題連帶修正**：D14 已修正 D6（`spec.md` 不得以截圖路徑為長期依據，改記定案方向文字描述 + user 選擇原話）。

---

## 初判實據庫（訪談素材，讀完全包後產出；未經 user 確認，僅供後續各題引用）

### E1 · 環境實測（`command -v` 逐個跑過，非推斷）

- ✅ node v22.14.0、npx 11.3.0、python3 3.13.9、uv、jq、git、pwsh
- ❌ **ffmpeg / ffprobe 皆無**
- 依賴 ffmpeg 的檔（grep 命中數）：`cloud/ai-review-video.py`(9)、`narrate-pipeline.mjs`(7)、`render-video-seek.js`(6)、`render-video.js`(6)、`verify-video.sh`(4)、`mix-voiceover.sh`(4)、`convert-formats.sh`(3)、`sfx-cues.sh`(2)、`cloud/tts-doubao.mjs`(2)、`add-music.sh`(2)
- 後果：影片／音訊產線（SKILL.md Step 9、9.5）本機 0 可用，而 `SKILL.md:381` 把「帶音頻的 MP4」訂為**預設交付形態**

### E2 · 內部矛盾與 bug

1. **三方向豁免條款三路打架**：`SKILL.md:225` 列「直接做」為豁免 → 不出三版；`SKILL.md:434` 對同一句「不要問了，直接做」判「拒答问题≠跳过三方向」→ 出三版；同行又說「仅当用户明说『别出三版/一版就行』才降为 1 主+1 变体」→ 出兩版。
2. **「唯一豁免僅此三種」被自己打破**：`SKILL.md:437` 時間緊迫「只做 1 个方案」，但 `:224` 明文「唯一豁免（仅此三种）」不含此項。
3. **問幾個問題差 3 倍**：`SKILL.md:245`「一次最多 3 个问题」、`SKILL.md:433`「而不是直接问 10 个问题」 vs 路由表指定的 `references/workflow.md:7`「开工前要问至少 10 个问题」。
4. **陳舊 Phase 編號**：`references/critique-guide.md:3` 自稱「Phase 7 的详细参考」，SKILL.md `:69/:402` 掛在 Step 10；`assets/showcases/INDEX.md:4/38/48` 自稱服務「Phase 3 推荐设计方向」，但 SKILL.md Phase 3 是「固化设计 spec」；`INDEX.md:115` 寫「适用于 **design-philosophy skill**」= 此包不存在的孤兒 skill 名。
5. **`npm run check` 跑不起來**：`SKILL.md:384` 指示執行，但 `huashu-design/package.json` **無 `scripts` key**（僅 4 個 dependencies）；該指令只存在於 `hyperframes init` 產生的另一專案，前提僅寫在 `references/hyperframes-backend.md:31`。
6. **HyperFrames 汙染全域 skill 目錄**：`references/hyperframes-backend.md:22-24`「`hyperframes init` … 还会把 **19 个 hyperframes skill 安装到** `~/.claude/skills/`」——與 bstack setup.ps1 管的同一目錄，且 setup.ps1 無刪除邏輯。
7. **死鏈檢查乾淨**：SKILL.md 與全部 reference / script 內 `references|assets|scripts/*` 路徑逐個 `-e` 測過，**0 死鏈**；`showcases/INDEX.md` 宣稱的 24 樣例實際對得上（24 HTML + 24 PNG）。壞的是規則層矛盾，不是檔案完整性。

### E3 · 上游識別字串盤點

- **必留**：`huashu-design/LICENSE` 的 `Copyright (c) 2026 alchaincyf (花叔 · 花生)`（MIT 第三段要求）
- **待清**：
  - 標題／description：`SKILL.md:3`、`SKILL.md:6`
  - 推廣水印：`SKILL.md:565-567` §「Skill 推广水印」＋ `references/video-export.md:201, 234-245`（「Created by Huashu-Design」）
  - 作者原話：`SKILL.md:121, 284, 290, 318`；`brand-asset-protocol.md:10, 126, 144, 238, 240`；`storyboard-basics.md:5, 124`；`typography.md:163`；`design-gate-hook.sh:4, 12`；`narrate-pipeline.mjs:20`
  - 上游其他 skill：`huashu-gpt-image`（`SKILL.md:282, 323, 330`、`cinematic-patterns.md:101, 103`、`design-styles.md:383, 520, 559`）、`huashu-md-html`（`launch-film-director-notes.md`、`multi-perspective-parallel-case-study.md` 整份案例主體）、`design-philosophy`（`showcases/INDEX.md:115`）
  - `README.md` / `README.en.md` 全份為上游 repo 行銷頁 → 不搬

### E4 · 體積與安裝機制（實測讀 `scripts/setup.ps1`）

- `Invoke-SyncRepoFiles` 對 `skills/` 走 `Get-ChildItem -Recurse -File` **全檔遞迴複製**，非只複製 SKILL.md
- 全程只有 `Copy-Item -Force`、**零刪除邏輯** → 從 repo 移除／改名 skill 後，`~/.claude/skills/` 舊版仍在仍生效（setup.ps1 自身備份提醒亦承認「建議結束後手動清理」）
- `settings.json` 為 merge，但 `hooks` / `statusLine` **以 repo 為準強制覆蓋** → 要裝 `design-gate-hook` 必須寫進 bstack repo 的 `settings.json`（且它是 bash + python3，bstack 現有兩 hook 皆 pwsh）
- 量級落差：bstack 現有 25 skill **全為單一 SKILL.md、零附屬檔**（`find skills -type f ! -name SKILL.md` 回空）；huashu-design 為 **189 檔 / 約 32 MB**，其中 6 個 BGM mp3 佔 **27.8 MB**

### E5 · 與 bstack 強制守則的衝突

1. **適用範圍對撞（最嚴重）**：`SKILL.md:3` description 與 `:54`「不适用场景：**生产级 Web App**、SEO 网站、需要后端的动态系统」——與前提②③直接相反
2. **§決策點選單**：包內 5 個 🛑 檢查點與 Fallback Phase 5 全靠對話等回話（`SKILL.md:230`「结束回合等用户选择」）；bstack 禁文字 token 當 gate 信號，須改 `AskUserQuestion`
3. **§Docs 落檔**：包要求 gate 檔落「項目目錄」（`SKILL.md:318` 明訂 `項目名/design-demos/[逻辑名].html`）；bstack 規定全落 `docs/work/<branch-name>/`
4. **§事實核實**：包的核心原則 #0 只驗外部產品事實（WebSearch）；bstack 要儲存實資料 + codebase 使用點雙 source，兩者不互相取代
5. **§協作模式判定 — 相容**：Fallback Phase 4 的 3 個 subagent，`SKILL.md:290` 明訂「独立 context、互不参考」→ bstack 判準 2（需互相反駁）不成立 → **subagent 平行、不開 Agent Teams、不必問**
6. **雲端外送**：`.env.example` 要 `DOUBAO_TTS_API_KEY` / `ARK_API_KEY`（火山引擎）；`scripts/cloud/ai-review-video.py` 會上傳成片給第三方模型

### E6 · 對照三條前提的能力盤點

| 前提 | 包內現況 | 實據 |
|---|---|---|
| ① 判斷有無 UI／前端改動 | **無**。`SKILL.md:58-72` 路由表欄位為「任务信号」，全靠 user 用詞，無 diff／副檔名判定 | SKILL.md:58-72 |
| ② 辨識既有專案設計語言 | **有骨架但被降級**。`references/design-context.md` 七成在講讀 codebase 抄 exact values，第 3 行自稱「这是这个 skill 最重要的 one thing」；但 `SKILL.md:518` 標為「没有 design context 怎么办（薄 fallback）」 | SKILL.md:518 vs design-context.md:3 |
| ②b 分區不誤植（前台 vs 後台） | **完全無**。design-context.md 視 codebase 為單一設計系統，Import 策略只按檔案數分大中小 | design-context.md 全文 |
| ③ 後端衍生前端、中途轉進 | **完全無**，且被 `SKILL.md:54` 明文排除 | SKILL.md:54 |

**bstack 既有可複用**：`frontend-test` skill 已做副檔名偵測（`.tsx/.jsx/.vue/.svelte/.html/.css/.scss`）並 spawn `frontend-e2e-runner` 跑 Playwright；包內 `references/verification.md`(200 行) 與其高度重疊。
**現成測試案例**：bstack 自身 `docs/`（`index.html` + `css/styles.css` 940 行 + `js/app.js` 901 行），已有完整 `--c-*` token 系統與 light/dark 兩套值。
