# 整合繁中去 AI 味能力（`zh-humanize`）

> Track: Dev | Tier: T3 | 建立: 2026-09-02 | **驗收完成: 2026-09-03（見 `verify.md`，13 項全綠）**

## 動機 / Why

bstack 目前 27 個 skill **沒有任何一個處理「給人讀的文字」**。這個缺口在 docs 站改版後暴露出來：視覺守住了，文案讀起來怪，而流程裡沒有任何一關會攔下它。

實測過整個生態系（見 §上游來源與授權立場）之後，缺口拆成兩塊：

| 缺口 | 現況 | 本 spec 的處置 |
|---|---|---|
| **繁中「AI 味」的辨識與改寫** | 已有成熟方案（繁中台灣用語、38 種痕跡、42 條 benchmark、季度維護） | **搬進來，不重造** |
| **開源工具站的文案文體** | 全生態系沒有人做 | **不在本 branch**，另立 |

**為什麼不自己寫去 AI 味那塊**：它需要的是長期累積的「痕跡樣本庫」（38 種模式、60+ 中國用語對照），不是靠推理能寫出來的東西。自己寫會得到一份看起來合理、但漏掉大半實際模式的清單。

**為什麼這兩塊要分開**：`docs/index.html` 那頁的問題**不是 AI 味**——它的數字全部正確、用詞也不套話。它的問題是**文體選錯**（用 B2B 轉化頁的寫法寫開源工具站）。去 AI 味的 skill 修不了文體，這是上游自己也承認的邊界（它的「不要觸發」條款明寫「不加個人風格」）。

## 目標 / Success criteria

- `zh-humanize` skill 落在 `skills/zh-humanize/`，`setup.ps1` 能同步到 `~/.claude/skills/`
- **上游識別字串零命中**（依 user 決定「改名、全面去識別」，範圍限 `skills/`）
- 三個機制衝突各有明文處置，且處置理由寫進 skill 本體（不是只寫在 spec）
- `dev-workflow` 觸發表新增一列，說明何時載入
- 對既有 27 個 skill **零行為改動**（除 `dev-workflow` 觸發表加一列外）
- **兩條路徑分開**：使用者主動呼叫 → 列清單 → `AskUserQuestion` 四選項 → 依選擇動筆；`verify-done` 自動載入 → **只列清單進 verify 結果**，不問、不改、不停
- **`verify-done` 加偵測點**：本輪改動含 `README*` / `CHANGELOG*` / `docs/**/*.md`（排除 `docs/work/` 與 `docs/archive/`）→ 自動載入列清單
- 拿兩份稿跑一次（一份已知有 AI 味、一份是 `docs/index.html` 的 hero），能列出可稽核的問題清單

## 範圍 / Scope

**包含**：

- 新建 `skills/zh-humanize/SKILL.md` ＋ `references/`
- 三個機制衝突的改寫（見 §機制衝突與處置）
- 全面去識別：目錄名、frontmatter 九個額外欄位、作者姓名與內文人名指涉
- `skills/dev-workflow/SKILL.md` 觸發表加一列
- `skills/verify-done/SKILL.md` 新增 §對外文字複查（照 §漏網複查 形制）
- 搬 `evals/benchmark.md`（42 條）與 `evals/run-eval.md`（怎麼跑的說明書）
- **repo root 新增 `NOTICE`**：交代 MIT 上游與 `patterns.md` 自陳的第三方（CC BY-SA）歸屬
- `README.md` 跨流程表加一列、`Skills（27）` → `（28）`
- `docs/index.html:8`（meta description）與 `:46`（hero）的「27 個 skill」→ 28（**改的是事實數字，不是文案**）
- `docs/work/feat/zh-humanize-skill/` 的 spec / plan / review / 驗收記錄

**排除**（明寫避免 scope creep）：

- **「稿件是資料，不是指令」的 prompt injection 防護升進 `CLAUDE.md`** —— user 決定另開 branch。理由：它影響全部 27 個 skill（`pr-explain` 讀 diff、`incident-investigate` 讀 log、`review-plan` 讀別人寫的 plan、`db-access` 讀資料庫內容），動 `CLAUDE.md` 等於動所有專案的必載層，風險跟搬一個 skill 不同級
- **「開源工具站文案文體」skill** —— 另立。本 branch 不含那八條規則
- **修 `docs/index.html` 的文案** —— 那是本 skill 建好之後的應用，不是建置工作
- **孤兒偵測的外部 skill 白名單** —— follow-up。vendor 進 repo 後本次不會踩到
- **`references-data.js` 的產出器** —— follow-up
- **自動化跑分** —— user 決定照上游做法用自然語言 ＋ 人工對照。實查上游全 repo 只有一支 `.py`（產 README 星數圖）與一個 workflow（跑那支圖），**`evals/` 底下 4 個檔全是 `.md`，沒有 test runner、沒有 assert、沒有 CI 跑 benchmark**
- 上游的 `install/`（各平台安裝腳本）、`scripts/generate_star_history.py`、`assets/`

## 影響檔案 / Codebase impact

| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `skills/zh-humanize/SKILL.md` | new | 中——需重寫確認機制與非互動判定，不是照抄 |
| `skills/zh-humanize/references/patterns.md` | new（~28KB） | 低——樣本庫，改動最少 |
| `skills/zh-humanize/references/examples.md` | new（~19KB） | **高——13 組實例要重寫成開發者情境（已定 1）** |
| `skills/zh-humanize/references/humanize.md` | new（~7KB） | 低 |
| `skills/zh-humanize/references/taiwan-localization.md` | new（~5KB） | 低 |
| `skills/zh-humanize/references/scenes.md` | new（~5KB） | **高——五個情境的力度表要整片換掉（已定 1）** |
| `skills/zh-humanize/references/protected-list.md` | new（~4KB） | 中——保護清單要加開發者情境項（指令 / 路徑 / 版本號 / error message） |
| `skills/zh-humanize/evals/benchmark.md` | new（~21KB） | 中——42 條用例的文本是電子報／銷售頁情境，見 §已知限制 |
| `skills/zh-humanize/evals/run-eval.md` | new（~4KB） | 低——怎麼跑的說明書，無腳本 |
| `skills/dev-workflow/SKILL.md` | edit（+1 列） | 中——所有 task 必經之路 |
| `skills/verify-done/SKILL.md` | edit（+1 節、§使用契約 +1 步） | **高——所有 task 必經之路，且動的是驗收關卡本身** |
| `NOTICE` | new | 低——五到十行，交代兩層來源與 pinned SHA |
| `README.md` | edit（+1 列、27→28） | 低——但這是 clone 下來的人唯一的目錄，不改等於沒交付 |
| `docs/index.html` | edit（`:8`、`:46` 兩處數字） | 低——改的是事實數字，不觸及文案 |

**未動**：`CLAUDE.md`、`scripts/setup.ps1`（它同步整個 `skills/` 目錄，`design-direction` 已驗證能處理 `references/` 子目錄）、其餘 26 個 skill、`docs/js/references-data.js`（產出器不在 repo，見 §已知限制）。

## 設計方向

**v2.1 起 `involved` 改為 `true`。** v1/v2 寫的是 `false`，依據是「改動檔為 `skills/**/*.md` 與 `docs/**/*.md`」——那是把 `docs/index.html` 加進 scope（K10）**之前**的判定，已過期。

| 欄位 | 值 | 依據 |
|---|---|---|
| `involved` | **`true`** | `docs/index.html` 命中 `design-language §前端副檔名`，且不在 skill 定義目錄底下（不適用第 1 步排除） |
| `scope` | 文件站 | `docs/reference/design-map.md`（`d73d674` 進版控，docs 改版那輪 user 確認後寫入） |
| `scope_evidence` | `docs/css/styles.css` | 同上（唯一 importer 是 `docs/index.html`） |
| `size` | **小改** | 只改兩處文字數字（`27` → `28`），**沿用既有 token 與元件、零新視覺決策**。依 §兩根尺，`size` 不從 Tier 推導——本 task 是 T3，但 `size` 仍是小改 |
| `precedent` | `true` | 地圖存在且經 §失效檢查 三條全過 |
| `map_status` | **`ok`** | §失效檢查實跑：① token 來源 `docs/css/styles.css` 存在 ② `docs/index.html` 在 `docs/**` 內 ③ 實際 import 與地圖那列對得上 |

**§失效檢查第 3 條的細節**（值得記，因為差一點就判成過期）：`docs/index.html:34` 另外 import 了 `docs/css/landing.css`，而地圖只記 `styles.css`。實查 `landing.css`：**自宣告 `--` 變數 0 個、無 `:root`、`var(--)` 引用 115 次**——它是 token 的**消費者**不是來源，所以地圖那列仍然正確，不算過期。

**小改路徑**：Task 1 改完跑 `design-language §對齊檢查清單` 四項，結果記進 `verify.md`。

## DB 影響

無。本 task 不涉任何資料庫。

## 上游來源與授權立場

### 來源

`Raymondhou0917/speak-human-tw`。`gh api` 實測資料（2026-09-02）：

```
star 920 · MIT · default branch master · 最後更新 2026-09-02
v1.4.0 · maturity: governed · review_cadence: quarterly
SKILL.md 20,872 bytes ＋ references 6 檔 68,580 bytes ＋ evals/ ＋ install/
38 種 AI 痕跡 · 42 條 benchmark（27 SF ＋ 15 SNF）· 60+ 中國用語→台灣用語對照
```

**選它的理由**：唯一一個**從頭以繁體中文與台灣用語校準**的，跟 bstack 全套語言設定一致；MIT；活躍維護；且它自己把邊界劃在「只去 AI 味、不加個人風格」，與 bstack 未來的文體 skill 不重疊。

落選的候選與理由：

| 候選 | 落選理由 |
|---|---|
| `MrGeDiao/shuorenhua` | 簡中；功能與上游重疊。但其 `hard_metrics.py` 與 **120 條 benchmark（含 57 條「不該改」的反向 case）** 的形狀值得參考 |
| `adewale/good-readme` | **僅 2 star**，不成熟；README 品質遠高於專案本身 |
| `gwagjiug/technical-writing` | **CC BY-NC-SA 4.0**，非商業＋相同方式分享，會傳染授權，與 bstack 的 MIT 不相容。**直接排除** |
| `makash/great-web-copy` 等行銷轉化類 | 文體相反（`Headlines lead with outcomes, not product names` 與十個開源工具站的實測結果衝突） |
| Anthropic 官方 `brand-guidelines` | 是視覺（字型＋色碼），不是文案 |

### 授權處置（user 決定 2026-09-02：repo root 放 `NOTICE`）

**這一題原本被 v1 的 spec 寫成兩難，那是錯的。** v1 認為「user 決定全面去識別」與「MIT 合規」互斥，於是選了不合規。但：

- user 的去識別範圍是 **`skills/zh-humanize/**`**
- V4 的驗證指令是 **`grep -rniE … skills/`**，只掃 `skills/`
- **MIT 從未要求聲明放進每個檔案**，它要求的是聲明隨副本散布

所以 **repo root 放 `NOTICE`，三邊同時成立**：user 的決定一字不改、V4 照樣零命中、授權站得住。這個位置在 v1 的去識別範圍表裡整個沒出現——不是評估後排除，是沒想到。

### 第三方授權層（v1 完全沒處理）

上游 `references/patterns.md:3`（要照搬的 28KB 主體）第一句是歸屬聲明：

> 主要整理自[中文維基百科「AI生成文的特徵」](…)（WikiProject AI Cleanup 社群持續更新）、朱宥勳「AI腔」句型分析，以及英文維基「Signs of AI writing」的社群觀察

維基百科文本是 **CC BY-SA**（share-alike）。而本 spec 的落選表把 `gwagjiug/technical-writing` 以「CC BY-NC-SA、**會傳染授權**、直接排除」處理掉——**同一個判準沒有對選中的這份跑過**。

且 v1 的 plan 指示「移除任何 `author` / 人名指涉」會把「朱宥勳」與維基連結一起清掉，**那不是上游的識別字串，是上游對更上游的致謝**。

**處置**：
1. `NOTICE` 同時交代兩層——上游 MIT，以及 `patterns.md` 自陳的 CC BY-SA 來源
2. **`patterns.md:3` 的歸屬聲明原樣保留**，不列入去識別範圍
3. plan 的去識別指示必須把「**上游身分字串**」與「**第三方歸屬**」分成兩類，分別下指令

**仍不主張這已窮盡授權評估**：share-alike 對衍生作品的要求超出本 spec 能判斷的範圍。本項記錄的是已知事實與已採取的處置。

### 去識別範圍

| 範圍 | 處置 |
|---|---|
| `skills/zh-humanize/**` 的**上游身分字串** | **全面移除**：目錄名改 `zh-humanize`、frontmatter 削成 `name` ＋ `description`、移除作者姓名與專案名指涉 |
| `skills/zh-humanize/**` 的**第三方歸屬** | **原樣保留**（`patterns.md:3` 的維基與具名作者致謝） |
| repo root `NOTICE` | **新增**，交代兩層來源與 pinned commit |
| `docs/work/**` | **照實記載**來源、版本、授權立場。這是給維護者看的施工紀錄，不是散布的副本 |

### 上游 pin（K9）

本次搬入的基準：

```
repo   Raymondhou0917/speak-human-tw
commit 1146d868a3e05dd21168ab9fca6ece153563d581
date   2026-09-02T04:02:38Z  （對應 v1.4.0 之後的 master）
```

**所有 `gh api` 一律帶 `?ref=<sha>`。** 理由：上游今天還在更新，Task 1 與 Task 3 隔幾小時跑就可能拿到不同內容，而 plan 裡沒有任何地方會發現。

日後要跟上游更新，算的是 `diff(上游@本 SHA, 上游@新版)`——**兩端都在上游**，所以不需要在本地留 pristine 副本（那反而與去識別立場衝突，且會繞過 V4）。sha256 表見 `verify.md`。

## 機制衝突與處置

上游有三處與 bstack 的強制守則或既有結論衝突。**這三項是本 task 的實質工作量，搬檔不是。**

### 衝突 1 · 確認機制 vs `§決策點選單`

**上游作法**：分析後列出完整編號清單（12 處就列 12 條，四欄：觸發位置 / 原句 / 為什麼要改 / 建議怎麼改），問「以上 N 處有什麼地方是你覺得需要修改的嗎？」，等**自由文字**回覆（「都改」「我要改第 4、6、8 條」）。

**衝突點**：`CLAUDE.md §決策點選單` 明文「**禁文字 token NLP**」。而 `AskUserQuestion` 的 `options` 上限 **4 個**、`questions` 上限 **4 題**，**裝不下「12 處逐條勾選」**。

**這不是二選一**——兩邊都有不可放棄的理由：上游的逐條清單是它品質的核心（防止 AI 自作主張大改），bstack 的禁令是防止把「好」「OK」當成通過信號。

**處置方向**（實作階段定案，plan 要拆成獨立 task）：把「逐條勾選」與「gate 信號」拆開——清單照列（那是**資訊呈現**），但推進與否走 `AskUserQuestion` 的**粗粒度選項**（全部套用 / 全部不套用 / 我指定編號 / 只標問題不改）。選「我指定編號」時使用者回覆的編號是**內容**不是 gate 信號，不違反禁令。

### 衝突 2 · 非互動判定

**上游作法**：判斷「整個任務是靠單一 prompt 一次跑完、沒有後續對話輪次」→ 走「跳過確認、事後摘要」。

**衝突點**：bstack 階段 C 的實測結論是這類判定不可靠——`[Environment]::UserInteractive` 在三種非互動情境全回 `True`，當時的處置是**把整條互動分支移除**（「驗不到、又會刪東西的分支，最好的處置是不要有」）。上游的判定是**語意的**，比機械判定更不可靠。

**處置方向**：採 bstack 的既有結論——**不做環境偵測**。skill 一律走「列清單 → 等選項」；沒有人回答時就停在那裡，不自作主張套用。

**同時移除上游的孿生條款。** 上游 `SKILL.md` 另有一條「使用者在這次請求裡已明確授權跳過確認（例：『不用列清單，直接幫我改』）→ 可直接動筆」。**那條例外的判定方式就是拿自由文字當 gate 信號**，與衝突 1 被禁的是同一件事、寫在同一份檔裡。v1 的 spec 曾把它引用成衝突 2 的解法——那是錯的，等於前門上鎖後門大開。呼叫端要自動化 → **那是呼叫端不該用這個 skill**，不是 skill 該開後門。

### 兩條路徑的分工（K11 的設計解，非衝突）

原本擔心的衝突是：`verify-done` 自動載入 → skill 說「停下來等 `AskUserQuestion`」→ **每次改 README 驗收就卡住**。

實查 `verify-done §漏網複查` 的界線硬規則，這個衝突不存在：

> **不在 verify-done 補做三方向。**⋯⋯verify-done 的職責是**把漏網這件事變成看得見的**，不是把它就地補完。

`verify-done` 要的只是一份清單。所以：

| 路徑 | 觸發 | 行為 |
|---|---|---|
| 使用者主動呼叫 | 顯式要求去 AI 味 / 潤稿 | 列清單 → `AskUserQuestion` 四選項 → 依選擇動筆 |
| `verify-done` 自動載入 | 本輪改動含對外文字檔 | **只列清單進 verify 結果**，不問、不改、不停、不升 blocker |

**這兩條路徑必須在 `SKILL.md` 內明文分開，並各有斷言鎖住。** 混在一起就會出現「驗收階段卡住等人回答」或「自動改了你的 README」——兩種都不可接受。

### 衝突 3 · 識別字串

見 §上游來源與授權立場 的去識別範圍。

## 驗收標準

| # | 驗收項 | 怎麼驗 |
|---|---|---|
| V1 ✅ | skill 能被同步 | 跑 `setup.ps1`，確認 `~/.claude/skills/zh-humanize/` 出現且 `references/` 完整，`diff -rq` 與 repo 一致 |
| V2 ✅ | 既有行為不壞 | 跑 `setup.ps1`，確認既有 27 skill、2 hook、6 agent 全在，`settings.json` merge 行為照舊；skill 總數變 28 |
| V3 ✅ | 觸發表接上 | `dev-workflow` 觸發表含 `zh-humanize` 一列，且觸發條件與 skill 的 `description` 一致（**兩處措辭要能互相 grep 到**，這是 B2 那輪吃過虧的地方） |
| V4 ✅ | **上游身分字串**清乾淨 | `grep -rniE "speak-human｜Raymond｜雷蒙" skills/` 須零命中。**注意：識別字串在上游只存在於 `SKILL.md`(4)、`benchmark.md`(1)、`run-eval.md`(1)，`references/` 六個檔全部 0**——所以這條斷言只在那三個檔有作用，別拿它給 `references/` 的 task 充數 |
| V4b ✅ | **第三方歸屬**保住 | `patterns.md` 須含「中文維基百科」與「朱宥勳」——反向驗證去識別沒有清過頭 |
| V5 ✅ | 衝突 1 的處置真的不違禁 | skill 本體含粗粒度 `AskUserQuestion` 選項清單，且**沒有任何一處**把自由文字當推進信號。反向斷言：搜「等使用者回覆…才」這類措辭應為零命中 |
| V6 ✅ | 衝突 2 的處置真的不做偵測 | 搜「非互動環境 / codex exec / claude -p / 沒有後續對話輪次 / **跳過確認、事後摘要 / 自動化工作流模式 / 保留確認清單**」全部零命中。**後三個是 v1 漏掉的**——只刪含「非互動」字眼的句子、保留兩個模式 bullet，v1 的斷言會全綠而禁止行為仍在（已實測重現） |
| V7 ✅ | 實跑一次 | 拿 `docs/index.html` 的 hero ＋ 一個 beat 段落餵給它，確認產出的是可稽核的編號清單（含原句與原因），且**沒有動到數字、指令、`<code>` 內容** |
| V8 ✅ | 保護清單涵蓋開發者情境 | `protected-list.md` 含上游**五類**（第 5 類原文是「承諾**類文字**」不是「承諾條款」）＋ 新增的指令 / 路徑 / 版本號 / error message / code block；用 V7 的實跑驗證 |
| V9 ✅ | `NOTICE` 存在且交代兩層 | repo root 有 `NOTICE`，內含上游 repo、MIT、pinned commit SHA，以及 `patterns.md` 的 CC BY-SA 來源 |
| V10 ✅ | `27` 全部改對 | `README.md:21`、`docs/index.html:8`、`docs/index.html:46` 三處數字改為 28；`grep -rn "27 個 skill\|Skills（27）" README.md docs/index.html` 零命中 |
| V11 ✅ | 既有 skill 零行為改動 | `git diff --name-only main -- skills/` 扣掉 `zh-humanize/`、`dev-workflow/SKILL.md`、`verify-done/SKILL.md` 後須為空 |
| V12 ✅ | `verify-done` 偵測點生效 | `verify-done` 含 §對外文字複查，觸發清單為 `README*` / `CHANGELOG*` / `docs/**/*.md` 且**明文排除 `docs/work/` 與 `docs/archive/`**；動作是「列清單進 verify 結果」，**不得出現升 blocker 或改寫**。反向驗證：`docs/work/` 排除規則若漏掉，本 branch 自己寫的每份 spec/plan 都會觸發它 |

## 風險與 trade-off

| 風險 | 說明 | 緩解 |
|---|---|---|
| **上游會繼續更新，我們的副本不會** | 上游季度 review、今天還在更新 v1.4.0。全面去識別後**使用者追不到上游**，維護者也容易忘記 | `docs/work/` 的 spec 記下來源與版本；follow-up 排一個「定期比對上游」的機制 |
| **場景層整片重寫，等於自寫一個判斷層** | 上游五個情境沒有一個是開發者的對外內容，已定改成開發者情境（已定 1）。重寫的部分**沒有上游驗證過**，是本 branch 自己的產出 | benchmark 驗不到這一層（見 §已知限制）；靠 V7 實跑 ＋ review 把關 |
| **實際 114KB 進 repo，不是 89KB** | v1 寫的 89,452 bytes **不含 `evals/`**（另 24,462）。實際 `113,914`，低估 27%。`patterns.md` 28KB ＋ `examples.md` 上游 19KB 是大宗 | reference 分檔、SKILL.md 只放路由；`examples.md` 改為自寫並**上限 6KB**（v1 把上游檔案大小抄成目標，會生產最多、品質風險最高的內容） |
| **T3 的 security-audit 產出會很空** | 全部是 markdown，OWASP 那套幾乎全 N/A | 不為了填表湊風險。**但上游那段 prompt injection 防護正是 security 視角該看的**——即使本 branch 不升 `CLAUDE.md`，審的時候要看它在 skill 內是否保留 |
| **改名後與上游的雙向可追溯性斷裂** | `zh-humanize` 與上游之間沒有任何字串連結 | 同第一列 |

## 已知限制

**benchmark 的 42 條用例量不到重寫過的場景層。**

用例文本全是電子報 / 社群貼文 / 銷售頁 / 客服信情境。它們驗得到的是**規則層**——AI 痕跡有沒有被抓到（`patterns.md`）、保護清單有沒有漂移（`protected-list.md`），而這兩份我們基本照搬，所以驗證仍然成立。

驗不到的是**場景層**：改寫力度的判定（`scenes.md`）與實例（`examples.md`）換成開發者情境之後，**沒有任何一條用例測得到新的力度表**。

這是明知的取捨，不是遺漏。處置：

- 本 branch **不補開發者情境的用例**（補一條 SF 就要配一條 SNF，那是另一個量體）
- 靠 V7 的實跑（拿 `docs/index.html` 的真實文案跑一次）＋ T3 的雙視角 review 把關
- **follow-up**：補開發者情境的 SF/SNF 成對用例

## 已定事項（原待釐清）

1. ~~場景層要不要換成開發者情境~~ → **已定**：**換成開發者情境**（README / release notes / 文件 / issue 與 PR 回覆 / 產品站文案）。上游五個情境沒有一個是 bstack 使用者的日常，照搬等於搬一個用不到的判斷層。代價見 §已知限制。

2. ~~`benchmark.md` 搬不搬、搬了怎麼跑~~ → **已定**：**搬，含 `run-eval.md`，照上游做法用自然語言 ＋ 人工對照，不建腳本。**

   實查依據（`gh api git/trees?recursive=1`）：上游全 repo 只有一支 `.py`（`scripts/generate_star_history.py`，產 README 星數圖）與一個 workflow（跑那支圖），`evals/` 底下 4 個檔全是 `.md`。**沒有 test runner、沒有 assert、沒有 CI 跑 benchmark。** 它的 96% / 0 誤殺是「`codex exec` 跑改寫端 → 另一個模型當判分端 → 人工終判 → 手寫進 results 檔」得到的。

   評估過的自動化選項與否決理由：**能機械判定的只有「保真」（保護 span 逐字比對）與「不換湯」（同族詞表比對）兩項**，而且兩項都需要先做前置工作——42 條用例逐條加結構化欄位、自建同族詞表——且「承諾條款只能調語氣不能調意思」這類保護項本身就是語意判斷、機械檢查不了。命中率與誤殺率天生要模型或人判。**分數的主體部分自動不了**，因此不做。

3. ~~名字~~ → **已定**：`zh-humanize`。語言前綴有資訊量——這個 skill 的規則只對中文成立（省略主詞、全形標點、中國用語對照）。
