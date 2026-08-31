# 設計 lane 階段 B1（skill 本體）Implementation Plan · v2

> 對應 spec: `docs/work/feat/design-lane/spec.md`（階段序 A → C1 → **B1** → B2 → C）
> 前一版 review: `docs/work/feat/design-lane/review-b1.md`（四視角，13 Critical）
> Track: Dev | Tier: T3
> 建立: 2026-08-28（v2 重寫）
> group 數: 8 / 最大並行度: **1**（全序列）

**Goal**：建立 `design-direction` skill —— `design.size=大改` 時，鎖定該區設計語言後產出三個差異化方向讓 user 選。**本階段只建 skill 本體，不接上流程**（接點屬 B2）。

---

## §v1 → v2 的三個前提變更

**1. 「機械性搬移」是錯誤描述（review K1/K2/K3）**
v1 Task 4 開頭寫「這是機械性搬移 ＋ 定點編輯，不是重寫」。實際要做的是：

| 工項 | 量體 | v1 有沒有寫 |
|---|---|---|
| **繁化 ＋ 台灣用語轉換** | 約 1,345 行 | ❌ 完全沒提 |
| **修剪明文排除的內容** | 約 490 行 | ❌ 只提「按需讀」 |
| **死鏈修補** | ≥14 處 | ⚠️ 只寫「逐一確認」，且斷言恆綠 |
| 識別字串清除 | 12 處 | ✅ 有，但維度太窄 |

**2. scope 框架修正（D29）**
bstack 是**多專案共用的全域設定**，不是單一專案。v1 review 期間主 agent 與 CEO 視角共用了一個錯誤前提——用「bstack 只有 2 個前端檔、零第三方品牌」論證砍檔。**該判準作廢**：留不留一個能力，看的是產品定位（SKILL.md §適用邊界 涵不涵蓋），不是「這個 repo 用不用得到」。

**3. `verify-done` 的 e2e gate 提前到本階段修（D31）**
`verify-done:87` 對 T3 是「必跑、fail 不能放行」，而 `design_canvas.jsx` 實測 `export` / `<!DOCTYPE` / `<html` 命中 **0**——是靠 `Object.assign(window,…)` 導出的元件片段，上游用法是「inline 進 HTML `<script>` 標籤」，**沒有 HTML 宿主、e2e 無從跑起**。

---

## §Architecture

- `design-direction` 是 **bstack 第一個多檔 skill**：`SKILL.md` ＋ `references/`（6）＋ `assets/`（1）＋ `scripts/`（1）。
  **Eng 已實測驗證** `setup.ps1:296-310` 的 `Substring($skillsRoot.Length)` 在多層子目錄下計算正確，9 個檔會完整落到 `~/.claude/skills/design-direction/`，**不必改 setup.ps1**。
- **職責分工**：`design-language` 回答「這一區長什麼樣」（既有事實）；`design-direction` 回答「這一區的新東西該長什麼樣」（新設計決策）。前者是後者的**輸入**。
- 上游 `SKILL.md` 579 行 / 17 章節，改寫後目標 **≤ 260 行**。
- **6 個 reference 全留、逐檔修剪至約 1,345 行**（D30）。

**上游章節去留**（依 T1 適用邊界、D12、D23、D29）：

| 章節 | 處置 |
|---|---|
| 你是谁 / 核心哲学 / 反AI slop / 技术红线 / 产出要求 | 改寫保留（繁化、去識別、砍動畫相關列） |
| 使用前提 / 任务路由 | 大改——適用邊界改為依 `design.size` 分流 |
| 设计方向顾问（Fallback） | **核心，大改**——Phase 1-3 由 `brainstorm` 承擔，只留 3.5-5；豁免條款照 D9 重寫 |
| 工作流程 Step 1-8 / Step 10 | 改寫保留 |
| 异常处理 | 部分——豁免相關全刪（D9） |
| 工作流程 Step 9 / 9.5、App/iOS 原型、Starter Components 其餘 9 個、跨 Agent 适配 | **砍** |
| **Skill 推广水印** | **砍**（D23 硬約束） |
| **版本自检** | **砍**——會對 skill 目錄發 `git ls-remote` 並寫 `.last-update-check`；`~/.claude/skills/` 是 `setup.ps1` 複製出來的、不是 git clone |

**Tech Stack**：Markdown ＋ 一個 JSX 範本 ＋ 一個 Python 腳本（純標準庫，Eng 已實測 `ast.parse` 通過）。

**Risks**：
- **1,345 行的繁化是本階段最大的工作量**，且逐字修改的過程容易引入新的簡繁混雜。緩解：每個搬檔 task 的斷言都含「簡體字集零命中」。
- **`brand-asset-protocol.md` 需要結構性改寫**（`:163`/`:215` 的 `brand-spec.md` 獨立檔要求與 D14 衝突），不是清字串。
- **T1/T2 動的是已上線且全域生效的 skill**。repo revert 得掉，`~/.claude/` 那份要重跑 `setup.ps1` 才會回退。
- **T3 到 T7 之間，repo 裡的 `design-direction` 是一個路由表指向不存在檔案的半殘 skill**。緩解：repo 內的 skill 要 `setup.ps1` 跑過才會被載入，中間態不影響任何 session。

---

## §介面契約（同時寫進 SKILL.md，見 Task 3）

review M7 指出 v1 把契約只寫在 plan、沒進產物；對照 `design-language:54-80` 有完整 §對外契約。v2 兩邊都有。

**輸入**（B2 才接上流程；B1 由 user 顯式呼叫時手動提供）：

```yaml
design:                      # 來自 brainstorm 0b′，見 design-language §對外契約
  involved: true
  scope: <區塊名|null>
  scope_evidence: <path|null>
  size: 大改                  # 只有大改才進本 skill
  precedent: <bool>          # 決定三版的可變維度
  map_status: <ok|remapped|absent|unknown|pending>
design_language_summary: <design-language §設計語言抽取 的六類輸出|null>
alignment:                   # review M4：v1 漏了這三項，但流程實際會用到
  audience: <目標受眾>
  core_message: <核心訊息>
  output_size: <寬,高>        # 三版必須統一，否則無法橫向比較
  content_source: <真實內容從哪來>
```

**輸出**：三份 mockup HTML ＋ 截圖落 `docs/work/<branch>/design-demos/`（已 gitignore）；**定案方向文字描述 ＋ user 選擇原話**回寫 `spec.md`。截圖驗完即刪，**不得作為事後追溯依據**（D14）。

**`scope=null` 時**（`map_status` 為 `absent` 或 `remapped`）：`design_language_summary` 為 null，走 `precedent=false` 路徑，改以風格庫選出的三個方向為共用輸入。

---

## Task 1: `design-language` 排除 skill 定義目錄

**parallel-group**: 1
**files**: modify `skills/design-language/SKILL.md`（§使用契約 第 1 步 ＋ frontmatter description 的分工行）

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/design-language/SKILL.md; ok=1
for p in "skill 定義目錄" "工具範本" "先剔除" "新設計決策 → \`design-direction\`" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 排除必須寫在第 1 步的「先剔除」動作裡，不能只在事後補述
awk '/^1\. \*\*先算/{a=1} a&&/先剔除/{seen=1} /^2\. \*\*判/{if(!seen) exit 1} END{exit !seen}' "$f" \
  || { echo "MISS: 排除必須是第 1 步的動作，不能寫在「立即回傳」之後"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，3 條正向 MISS + 順序檢查
# 實測現況：skills/ 在本檔只出現一處（involved 判定的 blockquote，講 setup.ps1 同步），
#   §首次偵測 的排除清單（node_modules/dist/build/vendor/gitignore/design-demos）根本沒提 skills/
#   （v1 的 Step 2 註解把理由寫反了，結論對、理由錯）
```

- [ ] **Step 3: 寫內容**

§使用契約 第 1 步改成（**排除併進第一句，不是事後補述**——review m3）：

```markdown
1. **先算 `involved`（零成本，必為第一步）**：拿呼叫端給的改動檔清單，**先剔除落在 skill 定義目錄底下的檔**（`~/.claude/skills/**`，或 repo 內含 `*/SKILL.md` 的 `skills/**`）——那些是**工具範本**（元件骨架、腳本），不是這個專案的介面——再比對 §前端副檔名。
   **剩下的全部不命中 → 立即回傳且不讀地圖**：`{involved:false, scope:null, scope_evidence:null, size:null, precedent:false, map_status:unknown}`，結束。
   > 為什麼這步必須在最前面：本 skill 由 `setup.ps1` 同步到 `~/.claude/skills/`，**全域生效**。若把讀地圖／偵測放在前面，這台機器上每個專案的每個 task（含純後端）都要付一次偵測成本。
   > 為什麼錨定「含 `*/SKILL.md`」而非裸 `skills/`：某個專案可能有叫 `skills/` 的產品目錄（例如做技能系統的產品），裸比對會把真實介面靜默排除。
```

**改動 2 — frontmatter 的分工行**（review M10：職責消歧目前只有單向。`design-direction` 那邊寫了三向分工，`design-language` 這邊沒提它；而 description 是 skill 選擇時**唯一**被讀到的文字，body 裡寫了也來不及）：

```markdown
  分工：既有事實（這區長什麼樣）→ 本 skill；新設計決策 → `design-direction`；改**完**要驗畫面 → `frontend-test`。
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/design-language/SKILL.md
git commit -m "fix: design-language 的 involved 判定排除 skill 定義目錄"
```

---

## Task 2: `verify-done` 排除 skill 定義目錄的 e2e 觸發

**parallel-group**: 2
**files**: modify `skills/verify-done/SKILL.md`（`:52` T3 套餐、`:81` §UI / browser e2e）

**依 D31 提前到本階段**。與 Task 1 是同一類修正。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/verify-done/SKILL.md; ok=1
# 兩處清單都要有排除句
[ "$(grep -cF 'skill 定義目錄' "$f")" = "2" ] \
  || { echo "MISS: 兩處前端副檔名清單都要加排除句，實際 $(grep -cF 'skill 定義目錄' "$f") 處"; ok=0; }
grep -qF "工具範本、非可執行頁面" "$f" || { echo "MISS: 理由句"; ok=0; }
# T3 必跑那條規則本身不得被動到
grep -qF "**必跑**（fail 不能放行 verify-done）" "$f" || { echo "MISS: T3 必跑規則不該被改動"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，前兩條 MISS
# regression guard：第三條（T3 必跑規則）現況存在，用來確保本 task 只加排除、不鬆綁 gate
```

- [ ] **Step 3: 寫內容**

`:52`（T3 套餐）與 `:81`（§UI / browser e2e）兩處的副檔名清單後各補一句：

```markdown
　**例外**：落在 skill 定義目錄底下的前端檔（`skills/*/assets/`、`skills/*/references/` 等）**不觸發** —— 那些是**工具範本、非可執行頁面**（例如只靠 `Object.assign(window,…)` 導出、沒有 HTML 宿主的元件片段），e2e 無從跑起。判準與 `design-language` §使用契約 第 1 步一致。
```

**不得改動** `:87` 的「T3 | **必跑**（fail 不能放行 verify-done）」——本 task 只加排除範圍，不鬆綁 gate 本身。

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/verify-done/SKILL.md
git commit -m "fix: verify-done 的 e2e 觸發排除 skill 定義目錄

skill 的附屬資產是工具範本、沒有 HTML 宿主，e2e 無從跑起；
T3 必跑規則本身不動。"
```

---

## Task 3: `design-direction` SKILL.md —— 定位、契約、邊界、品味

**parallel-group**: 3
**files**: create `skills/design-direction/SKILL.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/design-direction/SKILL.md; ok=1
for p in \
  "name: design-direction" \
  "§對外契約" \
  "§適用邊界" \
  "§核心哲學" \
  "§反 AI slop" \
  "§技術紅線" \
  "design_language_summary" \
  "output_size" \
  "本節路徑相對於本 skill 目錄" \
  "誠實的 placeholder" \
  "不憑空發明新顏色" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
grep -qiE "花叔|alchaincyf|design-philosophy|huashu|huasheng" "$f" && { echo "MISS: 上游識別字串"; ok=0; }
grep -qE "[这样图对动为过级须将产业们点发题应网络设计资产]" "$f" && { echo "MISS: 簡體字"; ok=0; }
[ "$(grep -c '🔴' "$f")" = "0" ] || { echo "MISS: 不得引入 🔴（skills/ 現況 0，2026-08-28 實測）"; ok=0; }
[ "$(grep -c '⚠️' "$f")" = "0" ] || { echo "MISS: 不得引入 ⚠️（skills/ 現況 0，同上）"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，11 條正向全 MISS（檔案不存在）
# regression guard：識別字串 / 簡體 / 🔴 / ⚠️ 四條（現況皆 0）
```

- [ ] **Step 3: 寫內容**

建立 `skills/design-direction/SKILL.md`：

````markdown
---
name: design-direction
description: |
  定設計方向（繁中）。觸發：三方向 / 設計方向 / 出幾版 / 視覺提案 /
  mockup / 改版 / 新頁面 / 新區塊 / 反 slop / 設計評審 / 這樣好不好看。
  涵蓋：三方向硬門、可變維度（有無先例）、三 subagent 並行、產出落檔、
  反 AI slop、React+Babel 技術紅線、6 維度評審。
  分工：既有事實（這區長什麼樣）→ `design-language`；新設計決策 → 本 skill；
  改完要驗畫面 → `frontend-test`。
  上游：`design-language`（供給設計語言）。下游：`write-plan`（依定案方向拆 task）。
  現況：**流程自動載入待階段 B2 接上**，目前僅 user 顯式呼叫。
---

# design-direction

`design.size=大改` 時，產出三個差異化方向讓 user 選。

**你不是在寫 HTML，你是在做設計決策。** HTML 只是媒介——交付標準是「看得出有人做過選擇」，不是「能跑」。

## 使用契約（強制）

**載入前提**：`design.size=大改`，且**設計語言由 `design-language` 供給**（本 skill 不自己抽 token）。

**載入後依序執行**：

1. 讀 §對外契約 的輸入欄位。
2. **對齊假設 ＋ 確認設計路徑**：
   - 受眾 / 核心訊息 / **輸出尺寸** / 真實內容來源 —— 四項缺任一走 `AskUserQuestion` 問。**輸出尺寸必須在這一步定案**，三版共用；不統一就無法橫向比較。
   - **同一個選單問設計路徑**：三版（預設）／單版／一主一變體。**必須在 spawn 之前問**——問在後面等於先燒完三個 subagent 才問要不要三版。
   > 階段 B2 接上流程後，設計路徑會前移到 `brainstorm` 0b′ 的合併選單；在那之前由本 skill 自己問。**豁免一律來自選單，不得從對話文字推斷。**
3. 依 `design.precedent` 決定**可變維度**（見 §可變維度）。
4. 圖片前置：判斷圖片是不是**內容必需**（判準見 §圖片是不是必需）。必需就先取齊真圖，三版共用同一批。
5. **並行 spawn 3 個 subagent**，各產一版真實視覺（見 §三個 subagent 的跑法）。
6. 三版一起攤出來，走 `AskUserQuestion` 讓 user 選（見 §選定與落檔）。
7. 定案方向 ＋ user 選擇原話回寫 `spec.md`。

**落檔時機（硬規則）**：本 skill 寫的檔（3 份 HTML ＋ 3 張截圖 ＋ 回寫 `spec.md`）**全部落在 `docs/work/<branch-name>/` 底下，必須 branch 已建立**。Phase 0 期間仍在 `main`，`hooks/branch-safety.ps1` 會 `exit 2` 擋掉。`<branch-name>` 的解析沿用 `frontend-test` §branch-name fallback 鏈（feature branch → `task-<id>` → `manual-<sha>`），`/` 保留為目錄層。

**禁止**：
- 讓 user 在「只有文字、沒看到真實視覺」時選方向——沒有依據的選擇是無效的
- 自行選定後繼續執行（含 autonomous / 無人值守情境）
- 從對話文字推斷 user 想跳過（違反 CLAUDE.md §決策點選單「**禁文字 token NLP**」）

---

## §對外契約

**輸入**：

```yaml
design:                      # 來自 brainstorm 0b′，見 design-language §對外契約
  involved: true
  scope: <區塊名|null>
  scope_evidence: <path|null>
  size: 大改
  precedent: <bool>
  map_status: <ok|remapped|absent|unknown|pending>
design_language_summary: <design-language §設計語言抽取 的六類輸出|null>
alignment:
  audience: <目標受眾>
  core_message: <核心訊息>
  output_size: <寬,高>
  content_source: <真實內容從哪來>
```

**輸出**：

```yaml
design_demos_dir: docs/work/<branch-name>/design-demos/   # 3 HTML + 3 截圖，不進版控
direction_decided: <定案方向的文字描述>                     # 回寫 spec.md
user_choice_quote: <user 選擇原話>                         # 回寫 spec.md
```

**`scope=null` 時**（`map_status` 為 `absent` / `remapped`）：`design_language_summary` 為 null，走 `precedent=false` 路徑，改以風格庫選出的三個方向為共用輸入。

**截圖驗完即刪**（D14），所以 `spec.md` 記的是 `direction_decided` 與 `user_choice_quote` 兩段文字，**不得以截圖路徑作為事後追溯依據**。

---

## §檔案路徑解析

本 skill 是多檔結構（`references/` / `assets/` / `scripts/`）。**本節路徑相對於本 skill 目錄**：

- 全域安裝時：`~/.claude/skills/design-direction/<相對路徑>`
- repo 內開發時：`<repo>/skills/design-direction/<相對路徑>`

Read 工具需要絕對路徑，**引用 reference 前先解析成絕對路徑**。解析不到就明說解析不到，**不要拿 SKILL.md 的摘要當作已讀過細則**。

---

## §適用邊界

**適用**：這個專案裡要新增或改版的**介面**——新頁、新區塊、既有區塊的視覺改版。

**不適用**：
- `design.size=小改`（沿用既有 token、無新視覺決策）→ 由 `design-language` §對齊檢查清單 承接
- 純後端 / 無 DOM 改動
- 一次性的簡報、資訊圖、動畫、影片——本 skill 不涵蓋這些產線

---

## §核心哲學

依優先序，衝突時上位者勝。

**1. 從既有 context 長出來，不憑空畫**
`design.precedent=true` 時設計語言已由 `design-language` 抄出 exact values——**用那些值，不要臨場發明**。

**2. 先對齊假設，再動手做**
四項對齊（受眾 / 核心訊息 / 輸出尺寸 / 內容來源）是 §使用契約 第 2 步，不是選配。**理解錯了早改比晚改便宜得多。**

**3. 給 variations，不給「最終答案」**
交三個跨不同維度的版本，讓 user 能 mix and match（「A 版的結構 ＋ B 版的層級」是合法選擇）。

**4. Placeholder 優於爛實現**
沒圖示就留灰色方塊 ＋ 文字標籤，別畫爛 SVG。沒資料就寫註解說明等真資料，別編造看起來像資料的假數字。**一個誠實的 placeholder 比一個拙劣的真實嘗試好。**

**5. 系統優先，不要填充**
每個元素都要 earn its place。空白是設計問題，用構圖解決。特別警惕三種填充：沒用的數字與 stats、每個標題都配 icon、所有背景都上漸層。

---

## §反 AI slop

**什麼是 slop**：AI 訓練語料裡最常見的「視覺最大公約數」。它們之所以是 slop，不是因為本身醜，而是**不攜帶任何品牌資訊**——用了等於把這個產品稀釋成「又一個 AI 做的頁面」。

| 元素 | 為什麼是 slop | 什麼情況可以用 |
|---|---|---|
| 激進紫色漸層 | 「科技感」的萬能公式，出現在每一個 SaaS / AI 落地頁 | 該區設計語言本來就用紫漸層 |
| Emoji 當圖示 | 「不夠專業就用 emoji 湊」的病 | 該區既有元件本來就這樣用 |
| 圓角卡片 ＋ 左彩色 border accent | 2020-2024 時期的爛大街組合，已成視覺噪音 | user 明確要求，或該組合在既有設計語言裡 |
| SVG 手畫人物 / 場景 | AI 畫的 SVG 人物永遠五官錯位、比例詭異 | 幾乎沒有——有圖用真圖，沒圖留誠實 placeholder |
| Inter / Roboto / Arial 當 display | 太常見，讀者分不出「有設計」還是「demo 頁」 | 該區設計語言明訂用這些 |
| 均勻深藍底 ＋ 通用青紫霓虹 glow | 這**一種特定組合**是爛大街複製 | 開發者工具產品且該區本來走這方向 |

**唯一合法的破例理由是「該區設計語言本來就這樣」**——此時它不是 slop，是既有風格。

**別把整片暗色一起誤殺**：要禁的只是「均勻深藍底 ＋ 通用霓虹」這一種偷懶解。有作者意圖的暗色不在禁區。

**正向做什麼**：
- `text-wrap: pretty`、CSS Grid、container queries 這類排版細節——會用這些的產出看起來像有人設計過
- **不憑空發明新顏色**：用 `design-language` 抄出來的值，或從中推導
- 一個細節做到 120%，其餘做到 80%——品味是在對的地方用力，不是均勻用力

完整清單見 `references/content-guidelines.md`。

---

## §技術紅線

三版 mockup 用 HTML ＋ inline React + Babel 時，以下不可違反（**細節與實際的 script 標籤見 `references/react-setup.md`**）：

1. **不要**寫 `const styles = {...}`——多元件時命名衝突會炸。**必須**給唯一名字（`heroStyles`）
2. **多個 `<script type="text/babel">` 之間 scope 不共享**，必須用 `Object.assign(window, {...})` 導出
3. **不要**用 `scrollIntoView`——會破壞容器捲動
4. React / Babel 一律用 **pinned 版本 ＋ `integrity` hash**。那六個 sha384 值在 `references/react-setup.md`，**產 HTML 的 subagent 必須先讀那個檔**——自己生不出來，省略 `integrity` 等於拿掉 CDN 被劫持時的唯一防線

**可讀性硬底線（任何風格都不豁免）**：正文 ≥14px、行動端 ≥16px、標籤 ≥12px、正文對比度 ≥4.5:1、hit target ≥44×44。留白必須是**構圖**（首屏有明確視覺錨點），不是內容缺席。
````

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/design-direction/SKILL.md
git commit -m "feat: 加入 design-direction skill 的定位、對外契約與品味判準"
```

---

## Task 4: `design-direction` SKILL.md —— 三方向流程

**parallel-group**: 4
**files**: modify `skills/design-direction/SKILL.md`（append）

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/design-direction/SKILL.md; ok=1
for p in \
  "§可變維度" "§圖片是不是必需" "§三個 subagent 的跑法" "§選定與落檔" \
  "§評審" "§References 路由" "§與 dev-workflow 銜接" "§Red Flags" \
  "骨架必須互異" "獨立 context、互不參考" "不開 Agent Teams" \
  "本選單刻意不標推薦" "重跑上限" "骨架差在哪" "先讀" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
grep -qF "禁文字 token NLP" "$f" || { echo "MISS: 豁免須明寫禁文字 token NLP"; ok=0; }
# 評審維度數：必須是 6，且含權重最高的「概念」
grep -qF "6 維度" "$f" || { echo "MISS: 評審是 6 維（上游實測 :9-:93）"; ok=0; }
grep -qF "概念" "$f" || { echo "MISS: 漏掉權重最高的概念維"; ok=0; }
# viewport 參數必須帶引號（PowerShell 下逗號會被拆）
grep -qF '"--viewport-size=' "$f" || { echo "MISS: viewport 參數必須帶引號"; ok=0; }
grep -qE "[这样图对动为过级须将产业们点发题应网络设计资产]" "$f" && { echo "MISS: 簡體字"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL
# 本次拉紅：除「先讀」以外全部。「先讀」已由 Task 3 的 §技術紅線 第 4 條寫入，
#   在此為 regression guard（確保 Task 4 append 沒把它弄丟），不是本次的紅燈來源。
```

- [ ] **Step 3: 寫內容**

append：

````markdown
---

## §可變維度

三版要差在哪，取決於 `design.precedent`：

| `precedent` | 鎖死 | 可變 |
|---|---|---|
| **`true`**（該區有可繼承的設計語言） | 色彩 token / 字體 / 元件庫（用 `design-language` 抄出的 exact values） | 版面結構、資訊層級、互動模式 |
| **`false`**（0→1 或全新區塊、無先例） | —— | 連設計語言本身一起變 |

**`precedent=true` 時的硬要求**：三版的**骨架必須互異**——導航 / 構圖 / 內容區結構至少一項結構性不同。**不許兩版共用同一骨架只換色換字體**，那會被一眼看穿是換皮。

**`precedent=false` 時**：從 `references/design-styles.md` §網頁風格庫 取三個差異化方向。

**兩條路徑都要讀**：`references/design-styles.md` §色彩推導協議——它的標題就是「用任何風格前先走這三步」，決定色彩時一律適用。

---

## §圖片是不是必需

§使用契約 第 4 步的判準：

| 內容類型 | 判定 |
|---|---|
| 介紹一個具體事物（產品 / 地點 / 人物 / 生物 / 歷史） | 圖片**內容必需** |
| 工具 / 資料 / 文件 / 純觀點型 | 可能不需要 |
| 拿不準 | **按內容必需處理**（寧可取真圖） |

**真圖誠實性測試**：「去掉這張圖，資訊是否有損？」有損才用。無損 = 裝飾 = slop，不加。

**取圖**：`scripts/fetch_images.py`（Wikimedia Commons 公共領域）。取材原則：搜尋 5 輪、找到 10 個素材、選 2 個好的，每個需 8/10 以上——**寧缺毋濫**，湊數的素材比沒有更糟。

**取不到時三級兜底（不許卡死）**：① 換其他公共領域來源 → ② 標「圖待補」的**誠實 placeholder** 並在三版說明裡註明 → ③ **繼續 spawn 三版，不卡流程**。取圖失敗是「降級繼續」，不是停止。

設計裡若要出現**具名的第三方產品或品牌**，另走 `references/brand-asset-protocol.md`。
**取到的 logo / 產品圖與截圖同處理**：落 `docs/work/<branch-name>/design-demos/assets/`（不進版控），並把**資產清單與來源網址**寫進 `spec.md` 的設計方向段落——路徑會隨 branch 消失，來源記錄才留得住。三個 subagent 共用同一批。

---

## §三個 subagent 的跑法

**用 subagent 平行，不開 Agent Teams，也不問 user。**

依據 CLAUDE.md §協作模式判定三判準：可切 3 塊 ✓、不同檔（`design-demos/*.html`）✓、T2+ ✓，但判準 2「工作者之間需要互相反駁或交換發現」**明確不成立**——三版必須**獨立 context、互不參考**才不會趨同。§協作模式判定 也明訂「唯讀 fan-out 一律 subagent、不開隊友也不問」。

**spawn 範本**（三個各一，只換 `<方向名>` 與可變維度的指派）：

```yaml
Agent:
  description: "design-direction 方向 <方向名>"
  subagent_type: general-purpose
  prompt: |
    你要產出一版真實的設計視覺（純 HTML/CSS，必要時 inline React）。

    **開工前必讀**（用絕對路徑 Read，讀不到就說讀不到、不要憑摘要做）：
    - <skill 絕對路徑>/references/content-guidelines.md   # 反 slop 與可讀性底線
    - <skill 絕對路徑>/references/typography.md            # 字體配對
    - <skill 絕對路徑>/references/react-setup.md           # 用 inline React 時必讀，含 6 個 integrity hash
    - <skill 絕對路徑>/references/design-styles.md §色彩推導協議   # 一律讀（決定色彩就要）
    - <skill 絕對路徑>/references/design-styles.md §網頁風格庫     # 僅 precedent=false 時

    設計語言（必須照抄 exact values，不得臨場發明）：<design_language_summary>
    對齊假設：受眾 <audience> / 核心訊息 <core_message> / 輸出尺寸 <output_size>
    真實內容：<content_source 提供的實際文字，不是 Lorem>
    真圖：<共用的那批圖，或「無，用誠實 placeholder」>
    你這一版的可變維度指派：<結構 / 層級 / 互動 三選一的具體方向>

    產出：
    1. 一份 HTML 落 docs/work/<branch>/design-demos/<方向名>.html
    2. 一句話說明「本版的骨架差在哪」（導航 / 構圖 / 內容區結構挑一項）

    禁止參考其他兩版；禁止 Lorem；禁止發明新顏色。
```

**截圖**（`--viewport-size` **必須帶引號**——PowerShell 下逗號會被當參數分隔，實測回 `Invalid viewport size format`）：

```bash
npx playwright screenshot "file:///<絕對路徑>.html" "<輸出>.png" "--viewport-size=<output_size>"
```

> 實測本機可跑（browser binary 來自 `@playwright/mcp` 安裝的副產物）。**沒有 playwright CLI 時改用 `frontend-test`**，不要現場下載。

**產出自檢（進 §選定與落檔 前必查）**：
- `design-demos/` 下真的有 **3 個 `.html`**。少於 3 個 = 沒跑完，補齊再往下
- **三版各有一句「骨架差在哪」，且三句不是在講同一件事**。三句雷同 = 換皮，退回重產

---

## §選定與落檔

**三版全部完成後一起攤出來**，每版標明：可變維度上做了什麼選擇、骨架差在哪、一句話說為什麼。並排展示用 `assets/design_canvas.jsx`（讀取內容 → inline 進一份展示 HTML 的 `<script>` 標籤 → 把三版 slot 進去）。

**走 `AskUserQuestion`**（CLAUDE.md §決策點選單；**禁文字 token NLP**——不得從對話裡的「就這個吧」「不錯」推斷選擇）：

1. A 版 —— `<骨架差異一句話>`
2. B 版 —— `<骨架差異一句話>`
3. C 版 —— `<骨架差異一句話>`
4. 混合（選了之後我再問你要取哪版的哪部分）
5. 都不對，重跑三版

> **本選單刻意不標推薦**：三版是等價的，標其中一版等於預先替 user 做選擇，違背 §核心哲學 3。CLAUDE.md §決策點選單 的「推薦選項放第一」規則在此不適用。

**重跑上限**：同一次 task 內**最多重跑 1 次**。第 2 次仍全否 → 走 `AskUserQuestion`：① 改由 user 描述想要的方向、我做一版 ② 退回 `brainstorm` 重釐清需求 ③ 暫停。三版重跑的成本是 3 個 subagent ＋ 截圖，不設上限會無限迴圈。

**落檔**：
- 三份 HTML ＋ 截圖 → `docs/work/<branch-name>/design-demos/`，**不進版控**
- **截圖驗完即刪** —— 所以 `spec.md` 記的是 `direction_decided`（定案方向的文字描述）與 `user_choice_quote`（user 原話）
- 回寫 `spec.md` 的「設計方向」段落

**豁免**：在 §使用契約 **第 2 步**已問過（三版 / 單版 / 一主一變體），此處不重複問。豁免要記進 `spec.md`。

---

## §評審

user 提「評審 / 好不好看 / 打分」，或你對產出有疑慮想主動質檢時，按 `references/critique-guide.md` 走 **6 維度**評分，各 0-10：

| 維 | 名稱 | 備註 |
|---|---|---|
| 0 | **概念 / 立意** | **權重最高**，且有一票否決：概念 ≤5 分時總評封頂 6.0 |
| 1 | 哲學一致性 | `precedent=false` 走風格庫時才有明確輸入；否則以該區設計語言為對照 |
| 2 | 視覺層級 | |
| 3 | 細節執行 | |
| 4 | 功能性 | |
| 5 | 創新性 | |

輸出：總評 ＋ Keep（做得好的）＋ Fix（分致命 / 重要 / 優化）＋ 5 分鐘內能做的前 3 件事。

**評設計，不評設計師。**

---

## §References 路由

路徑解析見 §檔案路徑解析。分**必讀**與**條件讀**兩塊——條件讀那塊的條件都是可機械判斷的。

**必讀**（每次三方向都要）：

| 檔 | 為什麼 |
|---|---|
| `references/content-guidelines.md` | 反 slop 與可讀性底線，每一版都要對 |
| `references/typography.md` | 每一版都要選字體 |

**條件讀**：

| 條件 | 讀 |
|---|---|
| `precedent=false`（要從風格庫取方向） | `references/design-styles.md` §網頁風格庫 |
| 決定色彩時（兩條路徑都適用） | `references/design-styles.md` §色彩推導協議 |
| 三版要用 inline React + Babel | `references/react-setup.md`（**含 6 個 integrity hash，subagent 必讀**） |
| 走 §評審 | `references/critique-guide.md` |
| 設計裡要出現具名的第三方產品 / 品牌 | `references/brand-asset-protocol.md` |

| 資產 | 用途 |
|---|---|
| `assets/design_canvas.jsx` | 三版並排展示的網格版面（讀內容 → inline 進展示 HTML） |
| `scripts/fetch_images.py` | 從 Wikimedia Commons 取公共領域真圖 |

---

## §與 dev-workflow 銜接

| 呼叫端 | 何時 | 期待輸出 |
|---|---|---|
| user 顯式呼叫 | 「出三版看看」「這個要改版」 | 三版 ＋ 選定結果回寫 `spec.md` |
| `brainstorm`（**階段 B2 才接上，目前未接**） | 0b′ 判 `design.size=大改` 且設計路徑選「出三版」 | 同上 |

**上游**：`design-language`（供給設計語言）。**下游**：`write-plan`（依定案方向拆 task）。

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「需求很清楚，直接做一版就好」 | 大改一律三版；豁免只能來自選單選項 |
| 「先給文字方案讓 user 選方向」 | 沒看到真實視覺的選擇是無效的選擇 |
| 「三版換個色換個字體就好」 | `precedent=true` 時骨架必須互異；三句「骨架差在哪」雷同就是換皮 |
| 「三個 subagent 讓它們互相看一下比較一致」 | 獨立 context 是產出價值本身；趨同就白跑了 |
| 「user 說『這個不錯』就是選 A 版」 | 禁文字 token NLP；一律走 `AskUserQuestion` |
| 「reference 讀不到就先照 SKILL.md 的摘要做」 | 摘要不是細則。讀不到就說讀不到——尤其 `integrity` hash 自己生不出來 |
| 「截圖路徑寫進 spec 就好」 | 截圖驗完即刪；spec 記文字描述與 user 原話 |
| 「先開 Agent Teams 跑三版比較快」 | 三判準的第 2 條不成立；subagent 平行即可，不問也不開 |
| 「輸出尺寸之後再說」 | 尺寸是 §使用契約 第 2 步的產物；三版不同尺寸就無法橫向比較 |
| 「都不對，那就一直重跑」 | 重跑上限 1 次，之後走選單改路徑 |
````

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/design-direction/SKILL.md
git commit -m "feat: design-direction 加入三方向流程、選定落檔與 6 維評審"
```

---

## Task 5: 搬入 3 個「以繁化為主」的 reference

**parallel-group**: 5
**files**: create `skills/design-direction/references/{content-guidelines,typography,react-setup}.md`

| 檔 | 原 | 目標 | 除繁化外還要做 |
|---|---|---|---|
| `content-guidelines.md` | 260 | 260 | 無（六個裡最貼合） |
| `typography.md` | 260 | ~250 | ① `:163`/`:182` 的「本仓库規範」改中性敘述 ② `:117-137` 中文字體地圖 10 款只有 1 款繁體導向，補繁體選項並標明 SC/TC |
| `react-setup.md` | 280 | ~245 | 砍 `:140-175`「選項B：真調 Anthropic API」——那是把 API key 貼進 HTML 的可用範例，會進公開 repo ＋ 全域 `~/.claude/skills/` |

**繁化不只是字形**：`字体`→`字型`、`数据`→`資料`、`默认`→`預設`、`用户`→`使用者`、`组件`→`元件`、`布局`→`版面`、`信息`→`資訊`、`软件`→`軟體`、`屏幕`→`螢幕`、`质量`→`品質`、`项目`→`專案`、`代码块`→`程式碼區塊`。

**M1 特別註記**：`typography.md:163` **不得**改寫成「本專案規範：中英之間不加空格」。**實測本 repo 是 2563 : 0——中英之間一律加空格**。改成**純機制描述、不帶祈使語氣**：「中英之間的視覺留白由 fallback 字型的字面寬度提供」——不寫「不靠手動敲空格」那種規範語氣（複驗指出斷言擋不到祈使句，而本 repo 實測是加空格的）。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && d=skills/design-direction/references; ok=1
for n in content-guidelines typography react-setup; do
  test -f "$d/$n.md" || { echo "MISS: $n.md"; ok=0; }
done
# 繁化：簡體字集零命中
grep -rqE "[这样图对动为过级须将产业们点发题应网络设计资产严]" "$d" 2>/dev/null && { echo "MISS: 仍有簡體字"; ok=0; }
# 大陸用語零命中
grep -rqE "字体|数据|默认|用户|组件|布局|信息|软件|屏幕|质量|项目|代码块" "$d" 2>/dev/null && { echo "MISS: 仍有大陸用語"; ok=0; }
# 上游權威指涉零命中
grep -rqE "本仓库|本库|web harness|Phase [0-9]" "$d" 2>/dev/null && { echo "MISS: 上游權威指涉殘留"; ok=0; }
# 識別字串
grep -rqiE "花叔|alchaincyf|design-philosophy|huashu|huasheng|nano-banana|yt-dlp" "$d" 2>/dev/null && { echo "MISS: 識別字串或缺失依賴"; ok=0; }
# API key 那節必須已砍
grep -rqF "x-api-key" "$d" && { echo "MISS: react-setup 的 API key 範例應已砍"; ok=0; }
# 中英之間空格：不得宣告相反的專案規範
grep -rqF "中英之間不加空格" "$d" && { echo "MISS: 不得宣告與本 repo 相反的規範（實測 2563:0 是加空格）"; ok=0; }
# 死鏈：bare 檔名掃描（v1 的路徑前綴 regex 只抓得到 1 筆，恆綠）
for p in $(grep -rhoE '[A-Za-z0-9_-]+\.(md|jsx|py)' "$d" 2>/dev/null | sort -u); do
  # design-styles.md 由 Task 6 建立，本 task 尚不存在 → 白名單放行，由 Task 8 的 3b 全掃時才驗
  case "$p" in components.jsx|pages.jsx|app.jsx|router.jsx|primitives.jsx|settings.jsx|home.jsx|detail.jsx|terminal.jsx|sidebar.jsx|brand-spec.md|design-styles.md) continue;; esac
  test -e "skills/design-direction/references/$p" -o -e "skills/design-direction/assets/$p" -o -e "skills/design-direction/scripts/$p" \
    || { echo "MISS(死鏈): $p"; ok=0; }
done
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，3 個檔不存在
# 註：目錄不存在時 grep 回空、死鏈迴圈不跑，那幾條在此輪不算拉紅；
#     它們在 Step 4 才是真正的把關（v1 把這種情況誤標為 regression guard）
```

- [ ] **Step 3: 執行搬移、繁化與修剪**

依上表逐檔處理。**每個檔搬完立刻跑一次 Step 1 的簡體與大陸用語兩條 grep**，不要三個都做完才驗。

死鏈處理（本批已知）：
- `typography.md` 引用 `design-context.md` → 該檔階段 A 已吸收進 `design-language`，改成「見 `design-language` §設計語言抽取」
- `typography.md` 引用 `design-styles.md` 的「安靜/中性/大膽三檔」→ 該檔會搬入，保留但確認章節名稱一致
- `react-setup.md:108` 的「web harness」→ 改「容器捲動」

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/design-direction/references/
git commit -m "feat: 搬入 3 個 reference（繁化 + 台灣用語 + 砍 API key 範例）"
```

---

## Task 6: 搬入 3 個「需結構性修改」的 reference

**parallel-group**: 6
**files**: create `skills/design-direction/references/{design-styles,critique-guide,brand-asset-protocol}.md`

| 檔 | 原 | 目標 | 結構性修改 |
|---|---|---|---|
| `design-styles.md` | 564 | ~210 | **砍 `:212-364` PPT 20 種、`:365-517` 信息圖 20 種、`:518-537` AI 生圖、`:547-564` 生圖提示詞**（合計 353 行）。留：`:8-21` 怎麼用、`:22-60` 色彩推導協議、`:61-211` 網頁 20 種、`:538-546` 審美禁區。
> **v2.1 修正**：v2 同一格裡寫「砍 `:518-546`」又寫「留 `:538-546`」，**自己重疊 9 行**。實測章節邊界為 `:518` AI 生圖 / `:538` 審美禁區 / `:547` 生圖提示詞。

**另修保留區內部對被砍段落的依賴**（三處，斷言抓不到，只能逐處讀）：
1. `:8-21`「這個庫怎麼用」第 1 步是**網頁／PPT／資訊圖三選一的分區判據**——砍掉兩區後前提消失，改寫成「本庫只涵蓋網頁」
2. 同段的方向 A/B/C 分派邏輯引用上游 SKILL 的隨機選風格機制——新 SKILL.md 無此概念，改寫成「三個方向依 §可變維度 指派」
3. `:538-546` 審美禁區的「合法暗色」白名單舉三例，**其中兩例在要砍的 PPT 區**——只有 Linear 暗色發光（`:152`）在保留的網頁區。刪掉指向被砍條目的兩例

**檔頭標題與 `:564` 的「適用」行必須同步改**，否則檔頭與內容不符 |
| `critique-guide.md` | 221 | ~180 | **修正為 6 維**（原 plan 誤寫 5 維且漏掉權重最高的維度 0「概念/立意」與其一票否決規則）。
**改寫維度 1「哲學一致性」的評分表與評審要點**：上游該維的五段評分標準全繞著「有沒有用某位設計師／機構的標誌性手法」寫，而本 skill 只有 `precedent=false` 走風格庫時才有流派錨點。改寫成兩路判準——`precedent=false` 對照風格庫條目標的參考案例；`precedent=true` 對照該區設計語言的 token 體系（色彩／字型／版面是否自洽）。**不改寫的話，SKILL.md 說一套、reference 說另一套。**
砍 §場景評審側重 裡屬排除產線的五列（公眾號封面 / 資訊圖 / PPT / PDF 白皮書 / 社群配圖），以及 **§常見設計問題 Top 10 的第 10 條**（整條是 PPT／封面／資訊圖／PDF 的密度建議）。
`:3`「Phase 7 的詳細參考」與 `:25`「呼應 SKILL.md 的 form 推導」兩處死鏈改寫 |
| `brand-asset-protocol.md` | 250 | ~200 | **① `:163` Step 5「固化為 `brand-spec.md` 檔案」與 `:215`「所有 HTML 必須引用 `brand-spec.md`」改寫**——依 D14，`brand-spec.md` **不開獨立檔**，改成「寫進 `spec.md` 的『設計方向』段落之下」。**② 拿掉 `nano-banana-pro`（`:107`/`:133`/`:228`）與 `yt-dlp` ＋ `ffmpeg`（`:105`）依賴**——本專案沒有這些工具，改成「有生圖能力時另行處理／無則走誠實 placeholder」。**③ 5 處作者原話改中性敘述**，保留案例事實與教訓。**④ `:3-4` 的「從 SKILL.md 核心哲學 #1.a 下沉／回 SKILL.md 看精簡版」兩處死鏈改寫**（新 SKILL.md 無 #1.a 編號）。**⑤ `:110` 硬寫的第三方官網 URL 改成通則描述** |

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && d=skills/design-direction/references; ok=1
for n in design-styles critique-guide brand-asset-protocol; do
  test -f "$d/$n.md" || { echo "MISS: $n.md"; ok=0; }
done
# design-styles 必須砍到 250 行以內，且排除產線的章節必須消失
[ "$(wc -l < "$d/design-styles.md" 2>/dev/null || echo 9999)" -le 250 ] || { echo "MISS: design-styles 應 ≤250 行，實際 $(wc -l < "$d/design-styles.md")"; ok=0; }
grep -qE "^## (PPT|資訊圖|信息图).*風格庫|^## .*生圖" "$d/design-styles.md" 2>/dev/null && { echo "MISS: 排除產線章節未砍"; ok=0; }
grep -qF "§色彩推導協議" "$d/design-styles.md" 2>/dev/null || grep -qE "^## 色彩推導協議" "$d/design-styles.md" 2>/dev/null || { echo "MISS: 色彩推導協議應保留"; ok=0; }
# critique-guide 必須是 6 維且含維度 0
grep -qE "^### 0\." "$d/critique-guide.md" 2>/dev/null || { echo "MISS: critique-guide 缺維度 0（權重最高）"; ok=0; }
grep -qF "一票否決" "$d/critique-guide.md" 2>/dev/null || { echo "MISS: 缺維度 0 的一票否決規則"; ok=0; }
# brand-asset-protocol 的 D14 衝突必須已改寫
grep -qE "固化為 .brand-spec\.md. 檔案|固化为 .brand-spec\.md. 文件" "$d/brand-asset-protocol.md" 2>/dev/null && { echo "MISS: brand-spec.md 獨立檔要求未改寫（違反 D14）"; ok=0; }
# 三檔共同：繁化、用語、識別字串、缺失依賴
grep -rqE "[这样图对动为过级须将产业们点发题应网络设计资产严]" "$d" && { echo "MISS: 簡體字"; ok=0; }
grep -rqE "字体|数据|默认|用户|组件|布局|信息|软件|屏幕|质量|项目" "$d" && { echo "MISS: 大陸用語"; ok=0; }
grep -rqiE "花叔|alchaincyf|design-philosophy|huashu|huasheng|nano-banana|yt-dlp|showcases" "$d" && { echo "MISS: 識別字串 / 缺失依賴 / 未搬資產"; ok=0; }
grep -rqE "本仓库|本库|Phase [0-9]" "$d" && { echo "MISS: 上游權威指涉或 Phase 編號殘留"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗** — Expected: FAIL，3 個檔不存在

- [ ] **Step 3: 執行搬移、繁化與結構性修改**

依上表逐檔處理。三個檔各自的結構性修改是**本階段最需要判斷力的部分**，不是機械替換——特別是 `brand-asset-protocol.md` 的 D14 衝突：原文要求產生一份獨立的資產規格檔並讓所有 HTML 引用它，改寫後要保留「資產路徑要記下來、HTML 要用真資產不用 CSS 剪影」這個實質，但載體改成 `spec.md` 的段落。

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/design-direction/references/
git commit -m "feat: 搬入 3 個需結構性修改的 reference

- design-styles 砍 353 行排除產線（PPT / 資訊圖 / AI 生圖）
- critique-guide 修正為 6 維，補回權重最高的概念維與一票否決
- brand-asset-protocol 改寫 brand-spec.md 獨立檔要求以符 D14，
  並拿掉 nano-banana-pro / yt-dlp / ffmpeg 依賴"
```

---

## Task 7: 搬入 2 個資產

**parallel-group**: 7
**files**: create `skills/design-direction/assets/design_canvas.jsx`、`skills/design-direction/scripts/fetch_images.py`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && d=skills/design-direction; ok=1
test -f "$d/assets/design_canvas.jsx" || { echo "MISS: design_canvas.jsx"; ok=0; }
test -f "$d/scripts/fetch_images.py" || { echo "MISS: fetch_images.py"; ok=0; }
grep -rqE "[这样图对动为过级须将产业们点发题应网络设计资产]" "$d/assets" "$d/scripts" && { echo "MISS: 簡體字（design_canvas 的 docstring 全簡體）"; ok=0; }
grep -rqiE "花叔|alchaincyf|huashu|huasheng|feedback_gemini|Phase [0-9]" "$d/assets" "$d/scripts" && { echo "MISS: 識別字串 / 私人 memory 引用 / Phase 編號"; ok=0; }
grep -qF "<owner>" "$d/scripts/fetch_images.py" && { echo "MISS: UA 仍是未填的 placeholder"; ok=0; }
grep -qE "^UA = .bstack" "$d/scripts/fetch_images.py" || { echo "MISS: UA 未改成本專案識別"; ok=0; }
# proxy 清除必須改成可選
grep -qF "BSTACK_FETCH_CLEAR_PROXY" "$d/scripts/fetch_images.py" || { echo "MISS: proxy 清除未改成可選"; ok=0; }
python -c "import ast,io; ast.parse(io.open('$d/scripts/fetch_images.py',encoding='utf-8').read())" 2>/dev/null || { echo "MISS: Python 語法解析失敗"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，兩個檔不存在 + UA + proxy + ast.parse
# ast.parse 是真檢查（Eng 已實測：語法壞掉會真的丟 SyntaxError）
```

- [ ] **Step 3: 執行搬移與修改**

**`design_canvas.jsx`**：內容邏輯原樣，但 `:2-24` 的 docstring **全簡體，必須繁化**（v1 誤判為「零識別字串、原樣複製」）。另在檔頭加註：容器樣式（`#F5F5F0` 底、`PingFang SC`）**不屬於任何一版**，是中性外框——避免三版比的是「誰跟這個底色比較配」。

**`fetch_images.py`** 逐處：

| 行 | 現有 | 改成 |
|---|---|---|
| `:3` | docstring 提上游 skill 名與 Phase 3.5 | 「供 `design-direction` 三方向流程取真圖用」 |
| `:10`, `:78` | `--out 项目/assets/img` | `docs/work/<branch>/design-demos/img`（對齊 D14 落檔） |
| `:13`, `:71`, `:89` | 「走 Phase 3.5 取圖三級兜底」×3 | 改指 SKILL.md §圖片是不是必需 的三級兜底 |
| `:17-19` | 無條件清空 6 個 proxy 環境變數，註解指向上游作者的私人 memory 檔 | **改成可選**：只在 `BSTACK_FETCH_CLEAR_PROXY=1` 時才清；註解改中性敘述（「某些環境下 proxy 會導致 TLS 失敗，需要時可用此開關」）。**理由：企業網路下無條件清 proxy 會 100% 連不上，且失敗訊息看不出根因** |
| `:23` | UA 含上游網域 | `UA = "bstack-design-image-fetcher/1.0 (+https://github.com/fujiei22/bstack)"`，**上方加一行註解說明這是實際送往 Wikimedia 的 header、sync 上游時不要改回去** |
| `:76` | argparse description 含上游名與 Phase | 「Wikimedia Commons 真圖抓取（design-direction 三方向取圖）」 |
| `:5`, `:12`, `:87` | 簡體散文 | 繁化 |

**已知限制（寫進 verify-stage-b1.md，不在本階段修）**：`fetch_images.py` 對 Wikimedia **沒有任何 rate limit 處理**——無 retry、無 backoff、無 429 判讀、無請求間隔。`--query` 給 N 個關鍵字 × `--count` 張 = N + N×count 次連發請求。

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/design-direction/assets/ skills/design-direction/scripts/
git commit -m "feat: 搬入並排展示元件與取圖腳本

- design_canvas.jsx docstring 繁化，加註容器樣式非任一版
- fetch_images.py 的 UA 改為本專案識別（那是實際送往 Wikimedia 的 header）
- proxy 清除改成環境變數可選，避免企業網路下必然失敗"
```

---

## Task 8: 驗收

**parallel-group**: 8
**files**: create `docs/work/feat/design-lane/verify-stage-b1.md`

**v1 的 Task 6 只驗「報告裡有沒有出現那四個詞」**（review M15）——寫一份「3a 失敗」的誠實報告照樣 PASS。v2 把檢查本身寫成斷言。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && ok=1
# 驗收記錄存在
test -f docs/work/feat/design-lane/verify-stage-b1.md || { echo "MISS: 驗收記錄未落檔"; ok=0; }
# ↓ 以下是把 3a-3e 的檢查本身寫成斷言，不是驗報告裡有沒有寫
grep -rqiE "花叔|alchaincyf|design-philosophy|huashu|huasheng|nano-banana|yt-dlp|showcases|feedback_gemini|last-update-check" skills/ && { echo "MISS(3a): skills/ 有識別字串"; ok=0; }
grep -rqE "[这样图对动为过级须将产业们点发题应网络设计资产严]" skills/ && { echo "MISS(3a): skills/ 有簡體字"; ok=0; }
grep -rqE "字体|数据|默认|用户|组件|布局|信息|软件|屏幕|质量|项目" skills/ && { echo "MISS(3a): skills/ 有大陸用語"; ok=0; }
[ "$(grep -ro '🔴' skills/ | wc -l)" = "0" ] || { echo "MISS(3a): skills/ 出現 🔴"; ok=0; }
[ "$(grep -ro '⚠️' skills/ | wc -l)" = "0" ] || { echo "MISS(3a): skills/ 出現 ⚠️"; ok=0; }
[ "$(ls -d skills/*/ | wc -l)" = "27" ] || { echo "MISS(3d): skill 數應為 27，實際 $(ls -d skills/*/ | wc -l)"; ok=0; }
[ "$(ls skills/design-direction/references/*.md | wc -l)" = "6" ] || { echo "MISS: reference 應 6 個"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗** — Expected: FAIL（驗收記錄未落檔 ＋ skill 數為 26）

- [ ] **Step 3: 執行驗收**

**3a — 全 repo 掃描**：跑上面 Step 1 的五條 grep（識別字串 / 簡體 / 大陸用語 / 🔴 / ⚠️），全部須零命中。

**3b — 死鏈全掃**：對 `skills/design-direction/` 用 **bare 檔名** regex（非路徑前綴——v1 那版只抓得到 1 筆）掃描並逐一確認。

**3c — 多檔 skill 同步**：跑 `pwsh -NoProfile -File scripts/setup.ps1 -Yes`，確認 `~/.claude/skills/design-direction/` 底下 9 個檔全部到位。
⚠️ **依 CLAUDE.md §Auto-fix 屬危險類（覆寫全域），走 `AskUserQuestion` 取得同意再跑。**

**3d — V10 回歸**：**27 skill**、2 hook、6 agent、`permissions.allow` 24 條、`env`、本機 key 全保留、無孤兒。

**3e — 排除生效**：確認 `design_canvas.jsx` 這個 `.jsx` 落在 `skills/**` 底下 → 依 Task 1 判 `involved=false`、依 Task 2 不觸發 e2e。

**3f — 落檔**：把實際輸出寫進 `verify-stage-b1.md`，並記載：
- **上游來源的可追溯資訊**（review M6）：`huashu-design/` 被 `.gitignore` 排除、merge 後無法重跑 diff。**必須記下各來源檔的 sha256 與行數**，否則這批內容會成為無來源的孤兒
- **D23 授權立場**：本階段搬入的是大量具體表達，比階段 A 更接近 MIT 所稱「實質部分」。user 已於 D23 知情並選擇不放聲明。**本項驗收只證明識別字串已清除，不代表授權合規**
- **已知限制**：`fetch_images.py` 無 rate limit 處理

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add docs/work/feat/design-lane/verify-stage-b1.md
git commit -m "docs: 加入階段 B1 驗收記錄"
```

---

## §並行性總表

| group | task | 檔案 |
|---|---|---|
| 1 | Task 1 | `skills/design-language/SKILL.md` |
| 2 | Task 2 | `skills/verify-done/SKILL.md` |
| 3 | Task 3 | `skills/design-direction/SKILL.md`（new） |
| 4 | Task 4 | 同上（append） |
| 5 | Task 5 | `references/`（3 個以繁化為主） |
| 6 | Task 6 | `references/`（3 個需結構性修改） |
| 7 | Task 7 | `assets/`、`scripts/` |
| 8 | Task 8 | 驗收記錄 |

**全序列，每 group 1 task** → `execute-plan` **不需載 `dispatch-parallel`**。

依賴：**Task 1、2 必須最前**（不先排除，Task 7 放 `.jsx` 會同時觸發設計 lane 與 e2e 必跑 gate）→ Task 3/4 同檔須分組 → Task 5/6 補齊路由表指到的 reference → Task 7 補齊資產 → Task 8 驗收。

**回退路徑**：Task 1/2 動的是已上線且全域生效的 skill——repo `git revert` 得掉，但 `~/.claude/` 那份要**重跑 `setup.ps1`** 才會回退。Task 3-7 全是新建檔，`git revert` 即完整回退；且 repo 內的 skill 要 `setup.ps1` 跑過才會被載入，中間態不影響任何 session。

---

## §Self-review

**1. spec coverage**

| spec 項 | 對應 | 狀態 |
|---|---|---|
| S5 三方向與豁免選單 | Task 4 | ✅ skill 本體；**接上流程屬 B2** |
| S6 識別字串清乾淨 | Task 5/6/7 ＋ Task 8 的 3a | ✅ 且檢查維度已擴（含簡體、大陸用語、缺失依賴、上游權威指涉） |
| S8 `docs/` 端到端（大改側） | —— | ⚠️ **B2**（要接上 brainstorm 才跑得動） |
| S4 中途轉進 | —— | B2 |
| S7 孤兒偵測 | —— | C |
| D28 排除 `skills/**` | Task 1 | ✅ |
| D31 `verify-done` e2e 排除 | Task 2 | ✅（本輪新增） |

**2. placeholder 掃**：無。Task 3/4 給出完整 SKILL.md 內容；Task 5/6/7 給出逐檔的目標行數、結構性修改清單與逐處改寫指定。**UA 的 `<owner>` 已填實際值並加斷言把關**（v1 的 §Self-review 宣稱「無 placeholder」是錯的）。

**3. 型別一致**：`design.*` 六欄與 `design-language` §對外契約、`dev-workflow` §Skill hand-off state 逐字相同。**全篇統一用 `design.size`，無 `ui_size`**（v1 混用三處）。評審統一為 **6 維**（v1 誤寫 5 維）。

**4. 並行性檢查**：全序列。Task 1/2 的「必須最前」有明確理由（兩個 gate 都會被 `.jsx` 觸發）。

**5. scope 檢查**：新增 `skills/design-direction/`（9 檔）＋ 改 `design-language`、`verify-done` 各一處。`verify-done` 原列 B2，經 D31 提前，spec 影響檔案表需同步。**未動 `execute-plan` / `brainstorm` / `dev-workflow`**。

**6. 誠實聲明**：
- **K6 的接收端推到 B2**：v2 定義了 `direction_decided` / `user_choice_quote` 兩個輸出欄，但 `brainstorm` 的 spec 範本「設計方向」段落目前只有 4 個判定欄、`dev-workflow` 的 `design:` 也只有六欄——**兩個接收端都還沒建**。本階段刻意不動那兩個檔（屬 B2）。**後果**：B1 期間 user 顯式呼叫本 skill 時，第 7 步「回寫 `spec.md`」是寫進一個尚無對應欄位的段落，要自行補欄。
- 本階段完成後 `design-direction` **尚未接上流程**——`brainstorm` 不會呼叫它，只有 user 顯式呼叫才會載入。這是 D27 拆兩輪的預期中間態，已寫進 skill 的 description 與 §與 dev-workflow 銜接。
- **D23 授權立場**：搬入的 6 個 reference 是大量具體表達。user 已知情並選擇不放聲明。V8 通過**不代表授權合規**。
- **本階段最大的工作量是 1,345 行的繁化**，不是搬檔。若執行中發現量體超出預期，回報而不是降低品質。
