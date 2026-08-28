# Plan review 總結（階段 B1）

> Plan: `docs/work/feat/design-lane/plan-b1.md`
> Tier: T3 | 視角: CEO + Design + Eng + DX（四視角，各自獨立 context）
> 日期: 2026-08-28

**Critical 合計 13 條**（3 條多視角共識 ＋ 10 條獨見）。所有可查證的主張已由主 agent 逐條實測；**有一條 agent 主張經複查為誤（符號標錯），但其發現本身成立**，見 M6。

**四視角的一致結論**：這份 plan 對 Task 1-3（`design-language` 排除、SKILL.md 撰寫）的結構與斷言品質可以留；**Task 4 / 5 / 6（搬檔與驗收）需要重寫**——它把一個內容工程描述成「機械性搬移」。

---

## Critical 共識（多視角獨立提出）

### K1 · 要搬的 1,835 行**全是簡體中文**，而 `CLAUDE.md` 第一條就是「繁中台灣用語」
> CEO C1 ＋ Eng C1 ＋ DX M3（三個視角獨立提出）

**主 agent 實測（簡體字出現次數）**：

| 檔 | 次數 | | 檔 | 次數 |
|---|---|---|---|---|
| `design-styles.md` | **946** | | `critique-guide.md` | 114 |
| `typography.md` | 155 | | `content-guidelines.md` | 72 |
| `brand-asset-protocol.md` | 152 | | `react-setup.md` | 37 |

**對照組**：階段 A 自己寫的 `skills/design-language/SKILL.md` = **0**。Eng 另測 26 個既有 skill 對簡體字集與大陸詞彙（`软件|视频|数据|项目|默认|屏幕|质量|信息|用户|界面|组件|布局`）**全數零命中**。

`CLAUDE.md:3` 原文：「繁中台灣用語；英文專有名詞保留」。

**後果**：`setup.ps1` 會把 `skills/` 遞迴同步到 `~/.claude/skills/`，所以這 1,835 行簡體內容會成為**這台機器上每個專案的常駐設計規範**，且 repo 是公開的。Task 4/6 的驗證腳本完全沒有這一維檢查 → 會全綠通過。

**連帶推翻 plan 兩處敘述**：
- Task 4 開頭「**這是機械性搬移 ＋ 定點編輯，不是重寫**」—— 實際是 1,835 行的繁化與在地化。
- Task 5「`design_canvas.jsx` **內容零識別字串，原樣複製**」—— 該檔 `:2-24` 的 docstring 全簡體。「零識別字串」只在那 4 個關鍵字的意義上成立。

### K2 · Task 4 的死鏈斷言**恆綠**——實測只檢查到 1 條路徑，而它一定存在
> DX C1 ＋ Eng C2（兩個視角各自實測，結論相同）

plan 的 regex 要求路徑帶 `references/` `assets/` `scripts/` 前綴。**主 agent 實測跑在 6 個來源檔上，全部命中只有一筆**：`references/typography.md` —— 而該檔正在搬入清單裡。

真正的死鏈**全是 bare 檔名或散文裡的權威指涉**，regex 一個都抓不到。Eng 給出的實際清單（≥14 處），節錄：

| 檔:行 | 引用 | 搬入後狀態 |
|---|---|---|
| `typography.md:5` | `design-context.md` | **死鏈**——該檔階段 A 已吸收進 `design-language`，不在 6 檔內 |
| `design-styles.md:18` | `SKILL「设计方向顾问」Phase 3-5`、`assets/showcases/` | 雙死鏈（新 SKILL 無 Phase 編號；showcases 明文不搬） |
| `critique-guide.md:3` | `Phase 7 的详细参考` | 死鏈（新 skill 無 Phase 7） |
| `critique-guide.md:25` | `呼应 SKILL.md 的 form 推导` | 死鏈（改寫後無此段） |
| `brand-asset-protocol.md:3-4` | `从 SKILL.md「核心哲学 #1.a」下沉`、`回 SKILL.md 看精简版` | 死鏈（新 SKILL 無 #1.a 編號） |
| `design-styles.md` ×5、`typography.md` ×2、`critique-guide.md` ×1 | 「**本仓库**」「**本库**」「**本 skill**」 | 上游權威殘留，指向不存在的倉庫 |
| `react-setup.md:108` | 「搞坏 **web harness** 的布局」 | 上游執行環境術語，bstack 無此概念 |

**Step 3c 只寫一句「逐一確認、不留死鏈」，工作量嚴重低估**——其中約一半不是路徑、是散文裡的指涉，grep 抓不到，只能逐檔讀。

### K3 · `design-styles.md` 大半是本專案**明文排除**的產線
> CEO C2 ＋ Eng C3 ＋ DX M2（三視角，行數估算 306-353 略有差異，結論一致）

**主 agent 實測章節行號**：

| 章節 | 起始行 | 本專案用得到？ |
|---|---|---|
| 色彩推導協議 | `:22` | ✅ **且 `precedent=true` 也該讀** |
| 網頁風格庫 20 種 | `:61` | ✅ |
| **PPT 風格庫 20 種** | `:212` | ❌ spec §排除 明寫「不搬 deck／PPT 產線」 |
| **信息圖風格庫 20 種** | `:365` | ❌ SKILL.md §適用邊界 自己寫「不涵蓋資訊圖」 |
| **AI 生圖專用風格** | `:518` | ❌ 本專案無生圖能力 |
| **生圖提示詞心法** | `:547` | ❌ 同上 |

`:212-564` 共 **353 行**落在排除範圍。整檔搬入 = SKILL 說不管、reference 講了 300+ 行怎麼管，**內部自相矛盾且違反 spec 排除項**。

DX 另指出一個路由設計錯誤：**§色彩推導協議 標題就寫「用任何風格前先走這三步」，`precedent=true` 一樣適用**，但路由表只在 `precedent=false` 那一列指到整檔 → 這 38 行在最常見的路徑上永遠讀不到。

---

## Critical 各視角獨見

### K4 · `verify-done` 對 T3 的 e2e 是「必跑、fail 不能放行」，而 `.jsx` 跑不起來（Eng C4）
> **這是四份 review 裡唯一會讓 B1 收尾直接撞牆的問題，只有 Eng 抓到。**

**主 agent 實測**：
- `verify-done:52`、`:81` 兩處清單都含 `.jsx`
- `verify-done:87`：「T3 | **必跑**（fail 不能放行 verify-done）」
- 本 branch 是 **T3**
- `design_canvas.jsx` 的 `export` / `<!DOCTYPE` / `<html` 命中數 = **0** —— 它是 React 元件片段，靠 `Object.assign(window,…)` 導出，**沒有 HTML 宿主，根本跑不起來 e2e**

Task 5 建立這個檔之後，走到 `verify-done` 會判定「T3 ＋ 前端檔改動 → Playwright e2e 必跑」，而那個 gate **沒有解法**。修 `verify-done` 屬 B2（spec 影響檔案表已列）。

**三個出路**（需決策）：把 `verify-done` 那兩處的排除提前到 B1；或 Task 6 明寫「本 branch 的 e2e 判 N/A，理由＝資產為工具範本非可執行頁面」並落檔；或把 Task 5 整個移到 B2。

### K5 · 豁免路徑指向一個**明文不存在**的選單（Design C1）

plan §選定與落檔 寫「豁免來自 0b′ 那個合併選單的『設計路徑』選項」，§Red Flags 再封一次。但 `brainstorm/SKILL.md:134` 明文：「設計路徑（三版／單版／一主一變體）**不在本階段問**」，第 3 題實際只有 3 個選項。

B1 已允許 user 顯式呼叫 `design-direction`，此時不想出三版 → **唯一合法出口不存在**，而 Red Flags 同時禁止從對話文字推斷 → skill 陷入「一定要出三版」的死結。

### K6 · 回寫 `spec.md` 的目標欄位不存在（Design C2）

**主 agent 實測** `brainstorm/SKILL.md` 的 spec 範本「設計方向」section 只有四行，**全部是 0b′ 的判定結果**（`scope` / `scope_evidence` / `map_status` / `size` / 設計語言摘要），**沒有「定案方向 / 為何選它 / user 原話」**。

而 D14 硬性規定「不得以截圖路徑作為事後追溯依據」、截圖驗完即刪 —— 這三個欄位是**唯一的追溯載體**。寫不進去 = 三方向的決策沒有任何持久紀錄。

Design 另指出（M5）：`dev-workflow` 的 `design:` 區塊六欄也全是判定欄，沒有承載定案方向的欄位 → **三個載體全缺**。

### K7 · UA 的 `<owner>` placeholder 會被送進對外 HTTP header（Design C4）

plan 指定 `UA = "bstack-design-image-fetcher/1.0 (+https://github.com/<owner>/bstack)"`，而同一行自己強調「這是實際送往 Wikimedia 的 HTTP header」。**主 agent 實測** `git remote -v` → owner 為 `fujiei22`。

Task 5 的斷言 `grep -qE "^UA = "` **只驗有定義、不驗內容**，抓不到這個。plan §Self-review 宣稱「placeholder 掃：無」——**該條不成立**。

### K8 · 26 個 skill **零多檔前例**，路由表沒交代 skill root 怎麼解析（DX C2）

**主 agent 實測**：`grep -rn "references/" skills/` **零命中**；`find skills -type f ! -name SKILL.md` **空**。

DX 的分析比我原本設想的精準：失效形態**不是「每次全讀」也不是「每次不讀」，而是「想讀但 Read 失敗 → 放棄 → 拿 SKILL.md 的摘要硬幹」**。這是最壞的一種，因為 AI 會以為自己看過細則了。

### K9 · 三個 subagent 拿不到 reference，而它們才是真正的消費端（DX C3）

**主 agent 實測**：`react-setup.md` 有 **6 個 `integrity=` sha384 hash**。SKILL.md §技術紅線 第 5 條只寫「一律用 pinned 版本 ＋ integrity hash（見 `references/react-setup.md`）」——**沒讀那個檔的 subagent 不可能生出正確 hash**，結果必然省略 `integrity`，而該檔明文「不要省略」。這是可驗證的、必然發生的失敗。

plan 的 §三個 subagent 的跑法 列了 5 項共用輸入，**沒有一項是 reference 檔**；也沒給 spawn prompt 範本（對照 `frontend-test` §Dispatch 有完整 yaml `Agent:` block）。

### K10-K11 · 兩個檔本輪不該搬（CEO M1 / M2）

**`brand-asset-protocol.md`（250 行）**：
- **主 agent 實測**它自帶違反 D14 的硬指令——`:163`「**固化为 `brand-spec.md` 文件**」、`:215`「所有 HTML **必须引用** `brand-spec.md`」，而 D14 明訂「`brand-spec.md` 不開獨立檔」
- 依賴本專案沒有的工具：`nano-banana-pro`（`:107`/`:133`/`:228`）、`yt-dlp` ＋ `ffmpeg`（`:105`）——**全都不在 plan 的識別字串 grep 裡**，Task 6 驗收會綠燈放行
- 零適用場景：bstack 全 repo 前端資產是兩個檔，零第三方品牌

**`critique-guide.md`（221 行）**：
- **主 agent 實測是 6 維不是 5 維**（`:9` 維度 **0「概念/立意 · 權重最高」**，帶一票否決「概念≤5分时，总评封顶6.0」）。plan 寫「5 維度」並**恰好漏掉權重最高那一維**
- 而維度 1「哲學一致性」評的是「有沒有用該設計師的標誌性手法」——選定設計哲學那一段正是被砍掉的 Phase 1-3，**這個維度沒有輸入**
- §場景評審側重 七列裡五列是排除產線

---

## Major（去重後，按嚴重度）

| # | 內容 | 來源 / 複驗 |
|---|---|---|
| **M1** | **`typography.md:163` 的改寫寫進了一條本 repo 不存在的規則**。plan 要改成「本專案規範：中英之間**不加**空格」，但**主 agent 實測本 repo 是 2563 : 0**——中英之間**一律加空格**。憑空宣告一條相反的專案規則，未來會被當事實引用 | Eng M1，實測確認 |
| **M2** | **8 個 `⚠️` 會進 `skills/`，而現況是 0**。Eng 原報告寫「3 個 🔴」，**主 agent 複查為誤**——8 檔的 🔴 皆為 0，實際是 `⚠️` 共 8 個（`design-styles` 3、其餘各 1）。**符號標錯，但發現成立** | Eng M2（部分修正） |
| **M3** | **`react-setup.md` 沒有 §技術紅線 第 4 條指的內容**。主 agent 實測 `letterbox\|auto-scale\|缩放` **零命中**。該條源自 1920×1080 的 deck 產線，正是排除範圍 → 建議直接刪 | Eng M4，實測確認 |
| **M4** | **`fetch_images.py` 無條件清空 proxy 環境變數**（`:17-19`），註解還指向上游作者的私人 memory 檔。企業網路下會 100% 連不上 Wikimedia，且失敗訊息看不出根因 | Eng M6，實測確認 |
| **M5** | **`fetch_images.py` 的殘留比 plan 列的 3 處多**：`:17` 私人 memory 引用、`:13/:71/:89` Phase 3.5 ×3、`:10/:78` 落檔路徑與 D14 不符 | Eng M5 |
| **M6** | **`react-setup.md:140-175` 是「把 Anthropic API key 貼進 HTML」的可用範例**。有警語但會進公開 repo ＋ 全域 `~/.claude/skills/`。plan 對 `react-setup.md` 全程零討論 | CEO m1 ＋ Eng M3，實測確認 |
| **M7** | **§介面契約 只寫在 plan、沒進 SKILL.md**。對照 `design-language:54-80` 有完整 §對外契約。merge 後 plan 進 archive，B2 接流程時契約只剩 archive 裡有 | DX M4 |
| **M8** | **`ui_size` 與 `design.size` 在同一份 prompt 內混用**（plan `:9`、`:22`、`:383`）。實際落地的是 `design.size` | Design M1，實測確認 |
| **M9** | **frontmatter 宣稱「強制：brainstorm 0b′ 判大改時載入」，但 B1 根本沒接上**。description 是 skill 選擇時唯一被讀到的文字 | Design M2 |
| **M10** | **職責消歧只有單向**。`design-language` 的 description 分工行沒提 `design-direction`；body 有寫但要選中才讀得到 | Design M3 |
| **M11** | **「都不對，重跑三版」沒有次數上限**。對照姊妹 skill `design-language` §失效檢查 有明確終止條件 | Design M6 |
| **M12** | **落檔時機硬規則缺席**。`design-direction` 寫的檔比 `design-language` 多得多（3 HTML + 3 截圖 + 回寫 spec），卻沒有任何一句說「必須在 branch 建立後才跑」 | Design M7 |
| **M13** | **`brand-asset-protocol` 自稱「強制執行」，卻被降級成路由表一列**；同時 §使用契約 第 3 步「判斷圖片是不是內容必需」**判準完全沒給**，而判準正好在那份不會被觸發的參考裡 | DX M5 |
| **M14** | **來源目錄 `huashu-design/` 被 gitignore，搬完無法追溯**。merge 後無法重跑 diff、無法驗證「12 處」這個數字。這也是 D23「如實記載」在技術上唯一站得住的作法——記載要能被查 | DX M6 |
| **M15** | **Task 6 Step 1 是純關鍵字存在檢查**——只驗報告裡有沒有出現那四個詞。寫一份「3a 失敗、3c 沒跑」的誠實報告照樣 PASS。這是 Task 6 唯一的機械驗證 | Eng M7 |
| **M16** | **每個 task 的回退路徑 plan 完全沒寫**。兩個實際風險：Task 1 改的是已全域生效的 skill（repo revert 掉但 `~/.claude/` 那份要重跑 setup）；Task 3 到 Task 5 之間 repo 裡是一個路由表全死鏈的 skill | Eng M8 |

## Minor / Nit（摘要）

- **`--viewport-size=1440,900` 的逗號在 PowerShell 傳給原生指令時會被拆掉**，回 `Invalid viewport size format`。必須寫成 `"--viewport-size=1440,900"`。**這條四份 review 都沒抓到，是主 agent 驗證 Design C3 時撞到的**
- `npx playwright screenshot` **實測可跑**（2900 bytes PNG）——Design C3 的「是否可跑」部分被推翻。browser binary 來自 `@playwright/mcp` 的安裝副產物，**不是宣告的依賴**；「另開第二條 browser 路徑」的架構重複顧慮仍成立
- `AskUserQuestion` 五選項沒標「（推薦）」——Design 認為**不標是對的**（三版等價），但要明寫這是刻意豁免，否則執行的 agent 會照 CLAUDE.md 自己補一個上去
- 選項 4「混合（說明要取哪版的哪部分）」在點選式 UI 裡承載不了自由文字，實務上會變兩段式
- `assets/design_canvas.jsx` **自帶一套設計語言**（`#F5F5F0` 底、`PingFang SC`）——三版放進去比的是「誰跟 `#F5F5F0` 比較配」
- `typography.md:117-137` 的 10 款中文字體**只有 1 款是繁體導向**，其餘 SC 優先；作為繁中專案的字型選型依據，預設值是錯的
- 產出自檢只查數量不查內容；`precedent=true` 的「骨架必須互異」**沒有任何自檢**，只靠 §Red Flags 自律
- Task 1 的排除規則 `skills/**` 沒有錨定點，某個專案若有叫 `skills/` 的產品目錄會被靜默排除
- plan Task 1 Step 2 的實測註解**理由寫錯**（結論對）：`skills/` 在 `design-language` 只出現一處，在 involved 判定的 blockquote 裡，§首次偵測 的排除清單根本沒提 `skills/`

## Eng 實測確認 plan 說對的部分

避免只報壞消息，以下經實測**確認正確**：

1. **多檔 skill 的 `setup.ps1` 行為 —— 「零成本、不必改 setup.ps1」成立**。Eng 照 `setup.ps1:296-310` 的邏輯建三層子目錄實跑，`Substring($skillsRoot.Length)` 在多層子目錄下計算正確，9 個檔會完整落到 `~/.claude/skills/design-direction/`
2. **Task 1 的斷言是真紅真綠**（現況 FAIL，patch 後 PASS）
3. **Task 5 的 `ast.parse` 是真驗證**，不是 C1 那種恆綠空包彈
4. **識別字串「12 處 / 4 檔」的數字本身正確**——問題不在數錯，在於清單的**維度太窄**
5. **`版本自检` / 水印 / `.last-update-check` / `skills.sh` 全部只在 `SKILL.md:567-578` 與 `README*.md`**，都不在搬入清單裡，plan 的「砍」處置正確
6. `1,835` / `564` / `62 KB` / `26 個 skill` 等數字全部實測吻合

---

## 主 agent 建議

### 判斷：Task 1-3 可留，Task 4 / 5 / 6 需重寫

四個視角**獨立得到同一結論**。問題的核心是一句話：**我把一個內容工程描述成了「機械性搬移」**。實際要做的是 1,835 行的繁化 ＋ 在地化 ＋ 死鏈修補 ＋ 範圍裁切，而 plan 給的是一張 9 處定點編輯表和一條恆綠的斷言。

### 三個需要 user 決策的 scope 問題

| # | 問題 | 為什麼不能由我決 |
|---|---|---|
| **S1** | **簡體 → 繁體要不要轉？** 轉：1,835 行的內容工程，且轉完就不再是「上游內容」而是改作。不轉：`skills/` 從 100% 繁中變成 26 繁 + 1 簡，違反 `CLAUDE.md` 第一條 | 這決定 B1 的量體與性質，也牽動 D23 的授權立場（改寫越多，「照搬」的說法越站不住，但「實質部分」的判斷也越模糊） |
| **S2** | **搬多少？** CEO 建議 6 檔 → 4 檔、1,835 → ~840 行（砍 `brand-asset-protocol` 250 ＋ `critique-guide` 221 ＋ `design-styles` 的 353）。Eng 建議 `design-styles` 只留 ~210 | 這是 scope 決策；砍掉的是能力，留下的是維護面積 |
| **S3** | **K4 的 `verify-done` gate 怎麼解？** 三個出路：排除提前到 B1 / Task 6 明寫 e2e 判 N/A 並落檔 / Task 5 移到 B2 | 第一個出路動到 B2 的檔，等於改階段邊界 |

### 必處理 / 建議處理

- **必處理**：K1-K11（十三條 Critical）＋ M1（憑空宣告專案規則）＋ M15（Task 6 無機械驗證）
- **建議處理**：M2-M14、M16
- **主 agent 自己抓到、四份都沒抓到的**：PowerShell 的 viewport 逗號問題
