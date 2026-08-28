# 設計 lane：把 huashu-design 精選整合進 dev-workflow

> Track: Dev | Tier: T3 | 建立: 2026-08-28
> 決策依據：`docs/work/feat/design-lane/interview-log.md`（D1-D25，每條含實據與 user 原話）

## 動機 / Why

bstack 的 dev-workflow 9 階段目前**沒有任何設計面的判定與產出**。前端改動走的路跟後端一樣，唯一的 UI 相關機制是 `verify-done` 的 `frontend-test`——那是 **code 寫完之後**的驗證，來不及影響設計決策。

具體會壞在三個地方（user 提出的三條前提）：

1. **判不出這次有沒有 UI / 前端改動** → 前端改動與後端改動走同一條路，沒有任何設計面把關。
2. **改既有專案時不看既有設計語言** → 會把不同區塊的設計誤植（例：把前台樣式套到後台）。
3. **後端改動衍生的前端需求無處可去** → 9 階段是單向的，唯一回頭路是 §Fail handling 的「回上層 Phase」，而那是**失敗**才走的路，不是「需求長出來」該走的路。

`huashu-design/`（上游 MIT 套件，repo 根目錄，`.gitignore` 排除、不進版控）有可用的零件，但**不能整包搬**：它明文自我排除本專案的使用情境（`SKILL.md:54`「不适用场景：**生产级 Web App**、SEO 网站、需要后端的动态系统」），且與 CLAUDE.md 強制守則有多處硬衝突。本 task 做的是**先決定要什麼、再只搬那些**，並自寫上游缺的部分。

## 目標 / Success criteria

- **S1**　任何 code 改動類 prompt 進 Phase 0 後，都會產出 `ui_involved` / `ui_scope` / `ui_size` 三個判定，並與 Track / Tier 在**同一個** `AskUserQuestion` 內一次確認。
- **S2**　`ui_involved=true` 時，動任何前端檔之前必定已讀過該區塊的設計語言；此事由 hook 機械保證，不靠模型自覺。**（階段 C1 達成，見 D21）**
- **S3**　同一 repo 內多套設計語言可分區辨識，改 A 區不會抄到 B 區的 token。
  > ⚠️ **驗收受限（D20）**：bstack 是單區 repo（實測 58 個 commit 中動過前端檔的只有 4 個 commit、只涉 `docs/index.html` 與 `docs/css/styles.css`），驗不出多區分歧路徑。S3 在本專案只能達成「單區驗證通過」，**多區辨識的真驗收 deferred 到第一個真正多區的專案**。
- **S4**　後端改動途中冒出前端需求時，可從 `execute-plan` 就地轉進、處理完接回原 task，且 `plan.md` 被回寫成實際跑過的樣子。
- **S5**　`ui_size=大改` 時預設出三版真實視覺讓 user 選；豁免是 `AskUserQuestion` 的一個選項，**不靠偵測 user 講的字串**。
- **S6**　搬進 repo 的上游內容不含任何上游識別字串（作者名 / 專案名 / 作者原話 / 指向上游其他 skill 的引用）。
  > ⚠️ 依 **D23**，本專案決定**不放置 MIT 版權聲明**。S6 達成不等於授權合規——兩者是不同的事，見下方 §授權處置。
- **S7**　`setup.ps1` 跑完後，`~/.claude/skills` 與 `~/.claude/agents` 內「repo 沒有的」項目會被列出來供 user 決定是否刪除。
- **S8**　bstack 自身的 `docs/` 文件站可作為端到端驗收案例：對它做一次小改與一次大改，兩條路徑都走得通。

## 範圍 / Scope

### 包含

**A. 從 `huashu-design/` 搬入的 10 檔（B 案，實測 224 KB）** — 見 D12

| 來源 | 用途 |
|---|---|
| `SKILL.md` | 改寫為 `design-direction` skill |
| `references/design-context.md` | 抽既有設計語言（歸 design-language skill） |
| `references/design-styles.md` | 無先例時的 60 種風格庫 |
| `references/content-guidelines.md` | 反 AI slop ＋ 可讀性底線 ＋ 現代 CSS |
| `references/typography.md` | 字體配對／中文排印 |
| `references/react-setup.md` | mockup 用單檔 React+Babel 技術紅線 |
| `references/critique-guide.md` | 5 維度評審 |
| `references/brand-asset-protocol.md` | 設計裡出現具名產品時取官方 logo |
| `assets/design_canvas.jsx` | 三版並排展示 |
| `scripts/fetch_images.py` | 取真圖 |

**B. 自寫的五塊缺口**（上游全包皆無，見 D12-附 / D13）

- 框架 ／ CSS 方案 → 擴充 `design-map.md` 欄位，由偵測自動填
- 元件狀態 ／ 斷點 ／ 表單 ／ dark mode → 寫成 design-language skill 的「對齊檢查清單」

**C. 11 項 repo 改動** — 詳見下節「影響檔案」

### 排除（明寫避免 scope creep）

- **不搬**上游動畫／影音叢集（19 refs ＋ 37 SFX ＋ 6 BGM ＋ `demos/` ＋ 相關 script，28.7 MB）
- **不搬** deck／PPT 產線（`slide-decks.md`、`editable-pptx.md`、deck 資產、4 個 export script、`html2pptx.js`）
- **不搬** `assets/showcases/`（24 組樣例，3.36 MB）、`README.md` / `README.en.md`
- **不搬** `references/verification.md` ＋ `scripts/verify.py`（與既有 `frontend-test` ＋ `frontend-e2e-runner` 重疊）
- **不移植** `scripts/design-gate-hook.sh`（改寫等價的 pwsh hook）
- **不改** Tier（T0-T3）判定邏輯本身 —— `ui_size` 是獨立的第二根尺（D7）
- **不動** `huashu-design/` 目錄任何一個檔（上游原始碼、唯一真相來源）
- **不改** 既有 25 個 skill 中本 spec 未列出的任何一個
- **不主動搬**舊 PR 的文件到新路徑

## 階段拆分（D17，經 review 後由 D21 重排）

**按風險分四階段，各自獨立 plan / review-plan / PR。順序：A → C1 → B → C2。**

理由：11 項改動混了三種風險等級——改 skill 文字、新增一個會 block 的 hook、改一個會刪 `~/.claude` 內容的安裝腳本。綁在同一個 PR 出問題時無法定位，也無法單獨 revert。

| 序 | 階段 | 內容 | 完成後可用 | 風險 |
|---|---|---|---|---|
| 1 | **A · 能力層** | `design-language` skill、`design-map.md`、對齊檢查清單、`brainstorm` 0b′、`dev-workflow` 觸發表與 state 欄位、`.gitignore` | **小改路徑**（讀設計語言 → 改 code → 四項對齊檢查） | 低、自包含 |
| 2 | **C1 · 最小 gate** | `hooks/design-gate.ps1`（只驗 `.design-gate` 存在）＋ `settings.json` 註冊 ＋ `setup.ps1` 的 `$singleFiles` 加該 hook ＋ 逃生門 | **S2 達成**：動前端檔前沒跑判定就會被擋 | 高（會 block user 自己的編輯） |
| 3 | **B · 流程層** | `design-direction` skill、三方向流程、`design-demos/` 落檔、`execute-plan` 中途轉進、`verify-done` 漏網複查 | **大改路徑**（三方向 → 選定 → 落 code） | 中 |
| 4 | **C2 · 加固收尾** | `design-gate.ps1` 補「大改方向驗證」分支 ＋ `setup.ps1` 孤兒偵測 | 全部驗收標準達成 | 高（會刪 `~/.claude` 內容） |

**為什麼 C1 前移（D21）**：階段 A、B 交付的全是靠自覺執行的規則，而**這個 lane 存在的理由就是模型不會自覺去讀設計語言**——用「模型會自覺遵守新寫的規則」去解「模型不自覺」，在 hook 上線前是循環論證。另 `.design-gate` 在 A 就產生，若到最後才有讀者，中間兩輪發現格式要改就得回頭改 `brainstorm`。

**依賴關係**：A → C1（C1 只需 A 產出的 `.design-gate`，不需 B 的定案方向段格式）；A → B（B 的三方向需要 A 的設計語言辨識）；C2 需要 A 的 `.design-gate` ＋ B 的定案方向段格式，故排最後。

**階段間的已知缺口**：A 單獨上線（C1 尚未 merge）的那一段期間，S2 仍靠自律；C1 一 merge 即消失。此窗口比原排序短兩輪。

## 影響檔案 / Codebase impact

（「階」欄對應上方階段拆分）

| 階 | 檔 / 模組 | 改動類型 | 內容 | 風險 |
|---|---|---|---|---|
| **B** | `skills/design-direction/` | new | 由 B 案 10 檔改寫；含三方向流程、反 slop、風格庫、評審 | 內容量大，改寫時易殘留上游字串 |
| **A** | `skills/design-language/` | new | 區塊偵測、抽 exact values、產／查 `design-map.md`、失效檢查、對齊檢查清單 | 四塊通用規則需自寫，無可抄 |
| **A** | `skills/brainstorm/SKILL.md` | edit | 0b 與 0c 之間插入 §Phase 0b′；0c/0d 的 `AskUserQuestion` 合併為一次問四項＋設計路徑；spec 結構加「設計方向」section；hand-off state 加三欄；Red Flags 加一條 | 動到 Phase 0 骨架，所有 task 都會經過 |
| **A** | `skills/dev-workflow/SKILL.md` | edit | §Phase 0 流程圖加 0b′；§Skill hand-off state 加欄位；§跨流程 skill 觸發表加 `design-language` 一列；Dev track 路徑圖加設計 lane 與兩個轉進點 | 同上 |
| **B** | `skills/execute-plan/SKILL.md` | edit | §Task 推進規則加「中途轉進」分支（暫停 → 補判 → 處理 → 回寫 plan.md → 接回） | 中斷／恢復是新語意，需明確定義 state |
| **B** | `skills/verify-done/SKILL.md` | edit | §UI / browser e2e 加漏網複查：偵測到前端檔但 `state.ui_involved=false` → 觸發補判 + 對齊檢查 | 低——複用該節既有的副檔名清單 |
| **C1**／**C2** | `hooks/design-gate.ps1` | new | C1：PreToolUse(Write\|Edit) 前端副檔名，只驗 `.design-gate` 存在 ＋ 可稽核逃生門。C2：補「`ui_size=大改` 且 spec.md 無定案方向段」分支 | **會擋住手動小改**，誤擋成本高 |
| **C1** | `settings.json` | edit | `hooks.PreToolUse` 註冊第三個 hook | 低 |
| **C1**／**C2** | `scripts/setup.ps1` | edit | C1：`$singleFiles` 加新 hook。C2：新增孤兒偵測（列出 → 問 → 刪） | **孤兒偵測會刪 `~/.claude` 內容**，必須寫得保守 |
| **A** | `.gitignore` | edit | 加 `**/design-demos/` 與 `**/.design-gate`（由 B 提前到 A，因 `.design-gate` 在 A 就產生） | 命中 `file-type-guard.ps1` gitignore 類別 → 二次確認 |
| **A** | 各專案 `docs/reference/design-map.md` | new（執行期產生） | 區塊表：區塊 / 範圍 / token 來源 / 框架 / CSS 方案 | 會過期，靠機械失效檢查觸發更新 |

**DB 影響**：無。本 task 不涉任何資料庫。

## 設計方向 / 流程規格

### 整合後的流程

```
brainstorm Phase 0
  0a 對話釐清 → 0b 看 codebase
  0b′ UI 面判定  ← 新增（呼叫 design-language 查 design-map.md）
       產出 ui_involved / ui_scope / ui_size，落 .design-gate
  0c Track → 0d Tier
  └─ 一次 AskUserQuestion 確認四者 ＋ 設計路徑
       ↓
  ui_size=大改 →【設計 lane】鎖語言 → 3 subagent 出三版 → user 選 → 回寫 spec.md
  ui_size=小改 → 不進設計 lane，直接改 code ＋ 對齊檢查清單
       ↓
write-plan → review-plan → execute-plan → verify-done → request-review → ...
                              ↑ 中途轉進        ↑ 漏網複查
```

### 兩根尺（D7）

| 尺 | 量什麼 | 決定什麼 |
|---|---|---|
| `Tier`（T0-T3） | code 改動量體與風險 | TDD ／ review 視角數 ／ security ／ plan 要不要寫 |
| `ui_size`（小改／大改） | 新視覺決策的量體 | 要不要先出三版讓 user 選 |

**`design-direction` 內必須明文寫「禁止用 Tier 推導 `ui_size`」**。此規則沒有 hook 能擋，只能靠文件與自律。

反例（皆取自本 repo，證明兩尺是系統性錯開）：
- `docs/` 站改版：`docs/css/styles.css` ＋ `docs/index.html` ＝ 2 檔 ＝ **T1**，但視覺上整站換臉 ＝ **大改**
- 10 個元件各加同一個 loading state：>10 檔 ＝ **T3**，但沿用既有 token、零新視覺決策 ＝ **小改**

### 三方向的可變維度（D8）

| 情境 | 鎖死 | 可變 |
|---|---|---|
| **有先例可繼承**（改既有區塊） | 色彩 token ／ 字體 ／ 元件庫 | 版面結構、資訊層級、互動模式 |
| **無先例**（0→1 或全新區塊） | —— | 連設計語言本身一起變 |

「有先例」那列直接沿用上游既有條款：三版的**骨架必須互異**，導航／構圖／內容區結構至少一項結構性不同，不許兩版共用同一骨架只換色換字體。

### 三方向的 gate（D9）

**⚠️ 此選單屬階段 B（D19）**——三方向本體 `design-direction` 在 B，階段 A 的合併選單只問 3 題（Track / Tier / UI 判定），`ui_size` 照樣判、照樣進 state。

`ui_size=大改` 時，0b′ 那個 `AskUserQuestion` 內含「設計路徑」一項：

- ○ 出三版讓我選（推薦）
- ○ 跳三方向、直接做一版 —— 代價：方向錯了是重做不是換一張
- ○ 出一主 ＋ 一變體（折衷）

**上游四條打架的豁免條款全刪**。豁免只能來自這個選單，不得從對話文字推斷。

### 三個 subagent 的跑法（已判定，不需再問）

Fallback 三版由 **subagent 平行**產出，**不開 Agent Teams、也不問 user**。依據 CLAUDE.md §協作模式判定三判準：可切 3 塊 ✓、不同檔（`design-demos/*.html`）✓、T2+ ✓，但判準 2「工作者之間需要互相反駁或交換發現」**明確不成立**——三版必須獨立 context、互不參考以避免趨同，讓它們互相聽到彼此結論反而破壞產出價值。

### 產出落檔（D14）

- 三份 mockup HTML ＋ 截圖 → `docs/work/<branch-name>/design-demos/`，**排除於版控**
- 截圖在 user 選定方向後即可移除
- `direction-approved.md` / `brand-spec.md` **不開獨立檔**：前者內容回寫 `spec.md`；後者僅在涉具名品牌時作為 `spec.md` 的一個小節
- ⚠️ 截圖會被刪，故 `spec.md` 記錄的是**定案方向的文字描述 ＋ user 選擇原話**，不得以截圖路徑作為事後追溯依據

### Gate hook 邏輯（D15）

```
hooks/design-gate.ps1（PreToolUse: Write|Edit）

改動檔副檔名 ∈ {.css .scss .tsx .jsx .vue .svelte .html}
  ├─ docs/work/<branch>/.design-gate 不存在 → exit 2「尚未跑 0b′ UI 面判定」
  ├─ ui_size=大改 且 spec.md 無定案方向段 → exit 2「三方向未完成或未記選定」
  └─ 其餘 → exit 0
```

必須提供一個**可稽核的逆向逃生門**（等價於上游的 `SKIP_DESIGN_GATE=1`），否則手動改一個 CSS typo 也會被擋死。

### design-map.md 形狀（D10 / D13）

| 區塊 | 範圍 | token 來源 | 框架 | CSS 方案 |
|---|---|---|---|---|
| 前台 | `src/pages/**` | `tokens/public.css` | React | CSS Modules |
| 後台 | `src/admin/**` | `tokens/admin.css` | React | CSS Modules |
| 文件站 | `docs/**` | `docs/css/styles.css` | 無 | 外部 `styles.css` |

**失效檢查**（機械、不靠記得維護）：① 地圖記的 token 來源檔還在不在 ② 本次改動檔有沒有落在所有已知區塊之外。任一中了即標記過期，重跑偵測 ＋ user 確認。

### 對齊檢查清單（D13，自寫）

- □ **元件狀態**：default / hover / focus / disabled / loading / empty / error 七態有漏嗎
- □ **斷點**：沿用該區現有斷點了嗎
- □ **表單**：必填標示／錯誤訊息位置與該區一致嗎
- □ **dark mode**：該區有兩套值嗎？新增的補了嗎

寫的時候要防它膨脹成又一套巨型文件——目標是可勾選的檢查項，不是教材。

## 上游識別字串處理（S6）

### 🔴 授權處置（D23 · user 決定，與其開頭硬約束相反）

**user 決定：照搬／改寫上游內容，且不放置任何 MIT 版權聲明或 attribution。**

user 在任務開頭訂的硬約束是「MIT 版權聲明必須隨程式碼保留」。本決定與該約束相反。主 agent 在 user 拍板前已告知下列事實，user 看過後仍選此項：

- `huashu-design/LICENSE` 第三段要求版權聲明包含在「軟體的所有副本或**實質部分**」中
- bstack 是公開 repo，且 `setup.ps1` 會把 skill 目錄整夾遞迴複製到 `~/.claude/skills/`
- 存在一條合法替代路徑（不參照上游段落結構與例子、自己寫 → 不需任何聲明），user 未採
- **階段 B 會更難繞**：B 要搬 `design-styles.md`（564 行、60 種風格的具體視覺 DNA 描述與參照案例）、`content-guidelines.md`、`typography.md`，那些是大量具體表達而非通用想法

**本 spec 的立場**：照 user 決定執行，但**不記載為「已符合授權要求」**。驗收項 V8 只驗「上游識別字串零命中」，不代表授權合規。

**必須清除**（實測命中位置，見 interview-log 初判 E3）：

| 類型 | 位置 |
|---|---|
| 標題／description | `SKILL.md:3`、`SKILL.md:6` |
| 推廣水印 | `SKILL.md:565-567` ＋ `references/video-export.md:201, 234-245`（後者不搬） |
| 作者原話 | `SKILL.md:121, 284, 290, 318`；`brand-asset-protocol.md:10, 126, 144, 238, 240`；`typography.md:163` |
| 上游其他 skill | `huashu-gpt-image` → `SKILL.md:282, 323, 330`、`design-styles.md:383, 520, 559` |

**⚠️ 本項含一個未經 user 確認的判斷（實作前需拍板，見「待釐清」）**：多處作者原話**包著真實的失敗案例**（例：`brand-asset-protocol.md:238` 的產品發布動畫案例、`:240` 的五家產品 logo 全漏案例）。本 spec 假設處理方式為「**移除人名與引號原話、改寫成中性敘述，保留案例事實與教訓**」，而非連案例一起刪——因為那些案例正是規則的依據，刪掉會讓規則變成沒有理由的教條。

## 驗收標準

| # | 驗收項 | 怎麼驗 |
|---|---|---|
| V1 | 0b′ 判定生效 | 對一個純後端改動與一個前端改動各跑一次 Phase 0，確認前者 `ui_involved=false`、後者 `true`，且四項在同一個 `AskUserQuestion` 出現 |
| V2 | 分區不誤植（**部分**，見 S3 註） | 在 bstack 產出 `docs/reference/design-map.md`，確認 `docs/` 被獨立辨識、token 來源指向 `docs/css/styles.css`、dark 機制欄記為 `[data-theme]`（**實測：該檔 `prefers-color-scheme` 零命中、`@media` 零命中，dark 走 `:root[data-theme="dark"]`（`:47`）**）。多區分歧路徑本專案驗不到 |
| V3 | hook 真的擋（**階段 C1**） | 未跑 0b′ 時直接 Edit `docs/css/styles.css`，確認被 exit 2 擋下；走逃生門後放行 |
| V4 | 小改路徑（S8） | 對 `docs/` 做一次小改，確認走「讀設計語言 → 改 code → 四項對齊檢查」且不觸發三方向 |
| V5 | 大改路徑（S8，**階段 B**） | 對 `docs/` 做一次大改，確認出三版、選定後回寫 `spec.md`、`design-demos/` 未進版控 |
| V6 | 中途轉進（**階段 B**） | 模擬 execute-plan 途中冒出前端需求，確認暫停 → 補判 → 處理 → 回寫 `plan.md` → 接回原 task |
| V7 | 漏網複查（**階段 B**） | 令 Phase 0 判 `ui_involved=false` 但實際改到 `.css`，確認 verify-done 觸發補判 |
| V8 | 識別字串清乾淨 | 指令：`grep -rniE "花叔\|alchaincyf\|design-philosophy\|huashu-gpt-image\|huashu-md-html\|Huashu-Design" skills/`，須零命中。**階段 B 搬 10 個上游檔時是主要驗收工具。注意：依 D23 不放聲明，本項通過不代表授權合規** |
| V9 | 孤兒偵測（**階段 C2**） | 暫時改名一個 skill 目錄後跑 `setup.ps1`，確認舊名被列出並詢問，未經確認不刪 |
| V10 | setup 不壞既有行為（**階段 C1／C2 各驗一次**） | 跑 `setup.ps1`，確認既有 25 skill、2 hook、6 agent、settings merge 行為全部照舊 |

## 風險與 trade-off

| 風險 | 說明 | 緩解 |
|---|---|---|
| **hook 誤擋成本高** | `design-gate.ps1` 擋所有前端副檔名的 Write/Edit，改個 typo 也會中 | 逃生門必須好按且可稽核；先以 bstack `docs/` 實跑一輪確認誤擋率 |
| **孤兒偵測會刪 `~/.claude` 內容** | 屬 CLAUDE.md §Auto-fix 危險類 | 一律列出 → `AskUserQuestion` → 才刪；預設不刪；`~/.claude/plugins` 不納入偵測 |
| **動到 Phase 0 骨架** | brainstorm ／ dev-workflow 是所有 task 的必經之路，改壞影響全面 | 這兩個檔的改動獨立成 task、獨立 verify；改動前後各跑一次完整 Phase 0 對照 |
| **「禁止用 Tier 推導 ui_size」無機械保障** | 只能靠文件與自律，實作時很容易偷懶 | 寫進主 skill 的 Red Flags 表；0b′ 的 `AskUserQuestion` 把兩者並列呈現，讓錯位當場可見 |
| **四塊通用規則可能膨脹** | 自寫內容沒有上游可抄，容易越寫越長變成第二套 content-guidelines | 定上限：對齊檢查清單以「可勾選項」為形式；超出即拆到 reference |
| **design-map.md 會過期** | 專案演進後區塊邊界改變 | 機械失效檢查（token 檔存在性 ＋ 改動檔落在已知區塊外） |
| **三方向成本可能白費** | 依 D6 三方向跑在 write-plan 之前，若 review-plan 被退則這筆花費白費 | user 已知悉並接受（D6）；豁免選項提供成本出口 |

## 待釐清

1. ~~兩個新 skill 的正式命名~~ → **已定（D18）**：`design-direction`（主，定設計方向）＋ `design-language`（能力，辨識與對齊既有設計語言）。避開 Claude Code 內建的 `design` skill（畫布工具）。
2. ~~作者原話的處理方式~~ → **已定（D23）**：照搬／改寫上游內容，不放任何聲明。作者原話本身（人名、引號原話）仍全部移除，改寫成中性敘述並保留案例事實。
3. ~~`.design-gate` 的格式與位置~~ → **已定（D22）**：`docs/work/<branch-name>/.design-gate`，KEY=VALUE 純文字，**不進版控**（`.gitignore` 提前到階段 A）。落檔時機延到 branch 建立後、與寫 `spec.md` 同一步（review C1 修正）。
4. ~~hook 逃生門的形式~~ → **已定（D25）**：**不另設逃生門**。hook 只問「這支 branch 跑過 0b′ 了嗎」，跑過即解鎖。環境變數方案因實測限制排除（`Write`/`Edit` hook 的輸入沒有地方 inline 帶 env var）。誤擋時的唯一出路是手動改 `~/.claude/settings.json`。
   > 配套：**D24** 把 `.design-gate` 的落檔改綁 `involved`、不綁 Tier，補掉「T0 不寫 spec → 永遠沒有 `.design-gate` → 永遠被擋」的洞。
5. **`.sass` 到底收不收**（review M1）：**實測** `skills/` 內共五處副檔名清單（`verify-done:52`、`verify-done:81`、`frontend-test:8`、`frontend-test:31`、`dev-workflow:230`），其中**只有 `frontend-test:8` 一處含 `.sass`**。階段 A 的 `design-language` §前端副檔名 暫不收，與多數處對齊。要收的話需同時補回 `verify-done` 兩處與 `dev-workflow` 一處。

---

## 附：本 spec 的決策溯源

D1-D16 全部決策、每條的實據（檔名＋行號＋原文字串）、user 原話、以及訪談中產生的跨題修正，均記於 `docs/work/feat/design-lane/interview-log.md`。該檔同時保存「初判實據庫」——包含上游包的內部矛盾清單、環境實測結果、與 CLAUDE.md 的衝突盤點，供 write-plan 與 review-plan 引用。
