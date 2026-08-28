# 設計 lane 階段 B1（skill 本體）Implementation Plan

> 對應 spec: `docs/work/feat/design-lane/spec.md`（階段序 A → C1 → **B1** → B2 → C）
> 前置階段: A（`design-language`、0b′、對齊清單）✅ 上線；C1（`CLAUDE.md` §設計語言對齊）✅ 上線
> Track: Dev | Tier: T3
> 建立: 2026-08-28
> 並行最大 group: 6（**全序列，無同 group 多 task**）

**Goal**：建立 `design-direction` skill —— `ui_size=大改` 時，鎖定該區設計語言後產出三個差異化方向、讓 user 選。**本階段只建 skill 本體，不接上流程**（接點屬 B2）。

**Architecture**：
- `design-direction` 是 **bstack 第一個多檔 skill**：`SKILL.md` ＋ `references/`（6 檔）＋ `assets/`（1 檔）＋ `scripts/`（1 檔）。
  依據：階段 A 已查證 `setup.ps1:296-310` 用 `Get-ChildItem -Recurse -File` ＋ `Substring($skillsRoot.Length)` 保留相對路徑 → **多檔結構零成本、不必改 setup.ps1**。階段 A 當時的「A 單檔、B 再拆」就是為此保留的空間。
- **職責分工**：`design-language` 回答「這一區長什麼樣」（既有事實）；`design-direction` 回答「這一區的新東西該長什麼樣」（新的設計決策）。前者是後者的**輸入**。
- 上游 `SKILL.md` 579 行 / 17 章節，改寫後目標 **≤ 250 行**（與 `design-language` 的 279 行同量級）。

**上游章節去留**（依 T1 適用邊界、D12 去蕪存菁、D23 識別字串約束）：

| 章節 | 處置 |
|---|---|
| 你是谁 / 核心哲学 / 反AI slop | **改寫保留**（去識別、砍動畫相關列） |
| 使用前提 / 任务路由 | **大改**——適用邊界改為依 `ui_size` 分流（T1/D3），砍動畫與 deck 兩條路由 |
| 设计方向顾问（Fallback） | **核心，大改**——Phase 1-3 由 `brainstorm` 承擔，只留 3.5-5；豁免條款照 D9 全刪重寫 |
| 工作流程 Step 1-8 / Step 10 | **改寫保留**（Step 10 評審） |
| 技术红线 / 产出要求 | **保留** |
| 异常处理 | **部分**——豁免相關全刪（D9），其餘保留 |
| 工作流程 Step 9 / 9.5 | **砍**（整條影片／音訊產線，D12） |
| App / iOS 原型专属守则 | **砍**（T1 已把適用邊界定在 production 前端） |
| Starter Components | **大砍**——10 個元件只留 `design_canvas` |
| 跨 Agent 环境适配说明 | **砍**（bstack 只跑 Claude Code） |
| **Skill 推广水印** | **砍**（D23 硬約束：「Created by Huashu-Design」） |
| **版本自检（静默）** | **砍**——它會對 skill 目錄發 `git ls-remote` 網路請求並寫 `.last-update-check` stray 檔；而 `~/.claude/skills/` 是 `setup.ps1` 複製出來的、不是 git clone |

**識別字串清除**（實測命中 12 處 / 4 檔；其餘 4 檔乾淨）：

| 檔 | 處數 | 位置 |
|---|---|---|
| `references/brand-asset-protocol.md` | 5 | `:10`、`:126`、`:144`（作者原話）、`:238`、`:240`（案例敘述含人名） |
| `references/design-styles.md` | 3 | `:383`、`:520`、`:559`（皆指向上游另一 skill `huashu-gpt-image`） |
| `scripts/fetch_images.py` | 3 | `:3`、`:23`、`:76`；**`:23` 是實際送往 Wikimedia 的 User-Agent header** |
| `references/typography.md` | 1 | `:163`（作者原話） |
| `content-guidelines.md` / `react-setup.md` / `critique-guide.md` / `design_canvas.jsx` | 0 | 乾淨 |

**授權立場（D23，如實記載）**：user 決定**照搬上游內容且不放 MIT 版權聲明**。本階段搬入的 6 個 reference 是**大量具體表達**（`design-styles.md` 564 行的 60 種風格描述、`typography.md` 的配對規則、`brand-asset-protocol.md` 的五步協議），比階段 A 只改寫一份 213 行方法論的情況更接近 MIT 所稱的「實質部分」。主 agent 已於 D23 告知此點，user 看過後仍選此項。**本 plan 照此執行，但不記載為「已符合授權要求」。**

**Tech Stack**：Markdown ＋ 一個 JSX 範本 ＋ 一個 Python 腳本（`fetch_images.py` 依賴 `urllib`，標準庫，無新套件）。

**Risks**：
- **搬 1,835 行進 repo**。`design-styles.md` 單檔 564 行 / 62 KB——它只在「無先例」路徑用得到，但那條路徑是 `has_precedent=false` 才走。緩解：`SKILL.md` 的 References 路由表要寫清楚「什麼時候才讀」，避免每次都全讀。
- **`fetch_images.py` 會對外發 HTTP 請求**（Wikimedia Commons）。UA 字串必須改成本專案的，否則對外宣稱自己是上游的 client。
- **T1 必須排第一**：`design-language` 排除 `skills/**` 沒先做，T5 放 `.jsx` 進去就會觸發整條設計 lane。

---

## §介面契約（`design-direction` 對外）

**輸入**（由呼叫端提供，B2 才接上）：

```yaml
design:                      # 來自 brainstorm 0b′，見 design-language §對外契約
  involved: true
  scope: <區塊名|null>
  scope_evidence: <path|null>
  size: 大改                  # 只有大改才進本 skill
  precedent: <bool>          # 決定三版的可變維度
  map_status: <ok|remapped|absent|unknown>
設計語言摘要: <design-language §設計語言抽取 的六類輸出>
```

**輸出**：三份 mockup HTML ＋ 截圖落 `docs/work/<branch>/design-demos/`（已 gitignore）；定案方向文字描述 ＋ user 選擇原話回寫 `spec.md` 的「設計方向」段落。**不得以截圖路徑作為事後追溯依據**（D14：截圖驗完即刪）。

---

## Task 1: `design-language` 排除 `skills/**`

**parallel-group**: 1
**files**:
- modify: `skills/design-language/SKILL.md`（§使用契約 第 1 步）

**必須排第一**：T5 要把 `design_canvas.jsx` 放進 `skills/design-direction/assets/`，而 `.jsx` 在 §前端副檔名 清單裡。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/design-language/SKILL.md; ok=1
for p in "skills/**" "skill 資產是工具範本" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 排除必須寫在「第 1 步 involved 判定」內，不能只寫在 §首次偵測
awk '/^1\. \*\*先算 `involved`/{a=1} /^2\. \*\*判 `size`/{b=1; if(!seen) exit 1} a&&/skills\/\*\*/{seen=1} END{exit !seen}' "$f" || { echo "MISS: skills/** 排除必須落在 involved 判定那一步（不能只在 §首次偵測）"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL
# 本次拉紅：2 條正向 + 1 條位置檢查
# 實測現況：skills/ 只出現在 §首次偵測 第 2 步的排除清單之外，involved 判定那步完全沒提
```

- [ ] **Step 3: 寫內容**

把 §使用契約 第 1 步改成（新增第三句）：

```markdown
1. **先算 `involved`（零成本，必為第一步）**：拿呼叫端給的改動檔清單，比對 §前端副檔名。
   **全部不命中 → 立即回傳且不讀地圖**：`{involved:false, scope:null, scope_evidence:null, size:null, precedent:false, map_status:unknown}`，結束。
   **落在 `skills/**` 底下的檔一律視為不命中**——skill 資產是工具範本（元件骨架、腳本），不是這個專案的介面。
   > 為什麼這步必須在最前面：本 skill 由 `setup.ps1` 同步到 `~/.claude/skills/`，**全域生效**。若把讀地圖／偵測放在前面，這台機器上每個專案的每個 task（含純後端）都要付一次偵測成本。
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS

- [ ] **Step 5: commit**

```bash
git add skills/design-language/SKILL.md
git commit -m "fix: design-language 的 involved 判定排除 skills/**

skill 的 .jsx / .html 附屬資產是工具範本、不是專案介面，
不排除的話每次動它們都會白跑一遍區塊偵測與對齊檢查。"
```

---

## Task 2: `design-direction` SKILL.md —— 定位、邊界、品味判準

**parallel-group**: 2
**files**:
- create: `skills/design-direction/SKILL.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/design-direction/SKILL.md; ok=1
for p in \
  "name: design-direction" \
  "§適用邊界" \
  "§核心哲學" \
  "§反 AI slop" \
  "§技術紅線" \
  "設計語言由 \`design-language\` 供給" \
  "誠實的 placeholder" \
  "不憑空發明新顏色" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
grep -qiE "花叔|alchaincyf|design-philosophy|huashu" "$f" 2>/dev/null && { echo "MISS: 上游識別字串應為零命中"; ok=0; }
[ "$(grep -c '🔴' "$f")" = "0" ] || { echo "MISS: 不得引入 🔴（skills/ 全域慣例為 0）"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，8 條正向全 MISS（檔案不存在）
# regression guard：識別字串與 🔴 兩條（本來就 0）
```

- [ ] **Step 3: 寫內容**

建立 `skills/design-direction/SKILL.md`：

````markdown
---
name: design-direction
description: |
  定設計方向（繁中）。觸發：三方向 / 設計方向 / 出幾版 / mockup / 原型 /
  改版 / 新頁面 / 新區塊 / 視覺提案 / 反 slop / 設計評審 / 這樣好不好看。
  涵蓋：三方向硬門、可變維度（有無先例）、三 subagent 並行、產出落檔、
  反 AI slop、React+Babel 技術紅線、5 維度評審。
  **強制**：brainstorm 0b′ 判 `design.size=大改` 時載入。
  分工：既有事實（這區長什麼樣）→ `design-language`；新設計決策 → 本 skill。
---

# design-direction

`design.size=大改` 時，產出三個差異化方向讓 user 選。

**你不是在寫 HTML，你是在做設計決策。** HTML 只是媒介——交付標準是「看得出有人做過選擇」，不是「能跑」。

## 使用契約（強制）

**載入前提**：`brainstorm` 0b′ 已判出 `design.size=大改`，且**設計語言由 `design-language` 供給**（本 skill 不自己抽 token）。

**載入後依序執行**：

1. 讀 hand-off state 的 `design.*` 六欄與 `design-language` 的六類設計語言摘要。
2. 依 `design.precedent` 決定**可變維度**（見 §可變維度）。
3. 圖片前置：判斷這個設計「圖片是不是內容必需」，必需就先取齊真圖（`scripts/fetch_images.py`），三版共用同一批。
4. **並行 spawn 3 個 subagent**，各產一版真實視覺（見 §三個 subagent 的跑法）。
5. 三版一起攤出來，走 `AskUserQuestion` 讓 user 選（見 §選定與落檔）。
6. 定案方向 ＋ user 選擇原話回寫 `spec.md` 的「設計方向」段落。

**禁止**：
- 讓 user 在「只有文字、沒看到真實視覺」時選方向——沒有依據的選擇是無效的
- 自行選定後繼續執行（含 autonomous / 無人值守情境）
- 從對話文字推斷 user 想跳過（違反 CLAUDE.md §決策點選單「禁文字 token NLP」）

---

## §適用邊界

**適用**：這個專案裡要新增或改版的**介面**——新頁、新區塊、既有區塊的視覺改版。

**不適用**：
- `design.size=小改`（沿用既有 token、無新視覺決策）→ 不進本 skill，由 `design-language` §對齊檢查清單 承接
- 純後端 / 無 DOM 改動
- 一次性的簡報、資訊圖、動畫、影片——本 skill 不涵蓋這些產線

> 上游原版把適用邊界寫成「不適用生產級 Web App」，本專案的用法**正好相反**：這裡就是要用在 production 前端上。差別在於加了 `design.size` 這根尺——大改才走三方向，小改直接改 code。

---

## §核心哲學

依優先序，衝突時上位者勝。

**1. 從既有 context 長出來，不憑空畫**
好的設計一定是從已有的東西長出來的。`design.precedent=true` 時，設計語言已經由 `design-language` 抄出 exact values——**用那些值，不要臨場發明**。

**2. 先對齊假設，再動手做**
不要一頭扎進去做大招。三版產出之前先確認：受眾是誰、核心訊息是什麼、輸出尺寸多少。**理解錯了早改比晚改便宜得多。**

**3. 給 variations，不給「最終答案」**
不要交一個「完美方案」——交三個跨不同維度的版本，讓 user 能 mix and match（「A 版的結構 ＋ B 版的層級」是合法選擇）。

**4. Placeholder 優於爛實現**
沒圖示就留灰色方塊 ＋ 文字標籤，別畫爛 SVG。沒資料就寫註解說明等真資料，別編造看起來像資料的假數字。**一個誠實的 placeholder 比一個拙劣的真實嘗試好。**

**5. 系統優先，不要填充**
每個元素都要 earn its place。空白是設計問題，用構圖解決，不是靠編造內容填滿。特別警惕三種填充：沒用的數字與 stats、每個標題都配 icon、所有背景都上漸層。

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
- **不憑空發明新顏色**：用 `design-language` 抄出來的值，或從中推導。臨場發明的色都會拉低一致性
- 一個細節做到 120%，其餘做到 80%——品味是在對的地方用力，不是均勻用力

---

## §技術紅線

三版 mockup 用 HTML ＋ inline React + Babel 時，以下不可違反（細節見 `references/react-setup.md`）：

1. **不要**寫 `const styles = {...}`——多元件時命名衝突會炸。**必須**給唯一名字（`heroStyles`）
2. **多個 `<script type="text/babel">` 之間 scope 不共享**，必須用 `Object.assign(window, {...})` 導出
3. **不要**用 `scrollIntoView`——會破壞容器捲動
4. **固定尺寸內容必須自己實作 JS 縮放**（auto-scale ＋ letterboxing）
5. React / Babel 一律用 **pinned 版本 ＋ integrity hash**（見 `references/react-setup.md`），不用 `@latest`

**可讀性硬底線（任何風格都不豁免）**：正文 ≥14px、行動端 ≥16px、標籤 ≥12px、正文對比度 ≥4.5:1、hit target ≥44×44。留白必須是**構圖**（首屏有明確視覺錨點），不是內容缺席。
````

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS

- [ ] **Step 5: commit**

```bash
git add skills/design-direction/SKILL.md
git commit -m "feat: 加入 design-direction skill 的定位、邊界與品味判準"
```

---

## Task 3: `design-direction` SKILL.md —— 三方向流程

**parallel-group**: 3
**files**:
- modify: `skills/design-direction/SKILL.md`（append）

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/design-direction/SKILL.md; ok=1
for p in \
  "§可變維度" \
  "§三個 subagent 的跑法" \
  "§選定與落檔" \
  "§評審" \
  "§References 路由" \
  "§與 dev-workflow 銜接" \
  "§Red Flags" \
  "骨架必須互異" \
  "獨立 context、互不參考" \
  "不開 Agent Teams" \
  "截圖驗完即刪" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 豁免必須是選單選項，不得從對話文字推斷（D9）
grep -qF "禁文字 token NLP" "$f" || { echo "MISS: 豁免須明寫禁文字 token NLP"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，12 條全 MISS
# 本次拉紅：全部（Task 2 只寫到 §技術紅線）
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

**`precedent=false` 時**：從 `references/design-styles.md` 的風格庫取三個差異化方向。該檔 564 行，**只在這條路徑讀**，不要每次都載。

---

## §三個 subagent 的跑法

**用 subagent 平行，不開 Agent Teams，也不問 user。**

依據 CLAUDE.md §協作模式判定三判準：可切 3 塊 ✓、不同檔（`design-demos/*.html`）✓、T2+ ✓，但判準 2「工作者之間需要互相反駁或交換發現」**明確不成立**——三版必須**獨立 context、互不參考**才不會趨同。讓它們互相聽到彼此結論反而破壞產出價值。§協作模式判定 也明訂「唯讀 fan-out 一律 subagent、不開隊友也不問」。

**三個 subagent 共用的輸入**（缺一版就會飄）：
- `design-language` 的六類設計語言摘要（含 `scope_evidence`）
- 真實內容（不是 Lorem）
- 同一批真圖（若圖片是內容必需）
- **同一個輸出尺寸**（不統一就無法橫向比較）
- `precedent` 決定的可變維度

**各自產出**：一份純 HTML/CSS（必要時 inline React）落 `docs/work/<branch>/design-demos/<方向名>.html`，並截圖。

**截圖指令**：
```bash
npx playwright screenshot "file:///<絕對路徑>.html" "<輸出>.png" --viewport-size=1440,900
```

**產出自檢（進 §選定與落檔 前必查）**：確認 `design-demos/` 下真的有 **3 個 `.html`**。少於 3 個 = 沒跑完，補齊再往下。

---

## §選定與落檔

**三版全部完成後一起攤出來**，每版標明：可變維度上做了什麼選擇、一句話說為什麼。

**走 `AskUserQuestion`**（CLAUDE.md §決策點選單；**禁文字 token NLP**——不得從對話裡的「就這個吧」「不錯」推斷選擇）：

1. A 版 —— `<一句話特徵>`
2. B 版 —— `<一句話特徵>`
3. C 版 —— `<一句話特徵>`
4. 混合（說明要取哪版的哪部分）
5. 都不對，重跑三版

**落檔**：
- 三份 HTML ＋ 截圖 → `docs/work/<branch-name>/design-demos/`，**不進版控**（`.gitignore` 已排除）
- **截圖驗完即刪** —— 所以 `spec.md` 記的是**定案方向的文字描述 ＋ user 選擇原話**，不得以截圖路徑作為事後追溯依據
- 回寫 `spec.md` 的「設計方向」段落：定案方向、為何選它、user 原話

**豁免**：`ui_size=大改` 但 user 不想出三版時，豁免來自 0b′ 那個合併選單的「設計路徑」選項（三版 / 單版 / 一主一變體），**不是**從對話文字推斷。豁免要記進 `spec.md`。

---

## §評審

user 提「評審 / 好不好看 / 打分」，或你對產出有疑慮想主動質檢時，按 `references/critique-guide.md` 走 5 維度評分（哲學一致性 / 視覺層級 / 細節執行 / 功能性 / 創新性，各 0-10），輸出總評 ＋ Keep ＋ Fix（分致命 / 重要 / 優化）＋ 5 分鐘內能做的前 3 件事。

**評設計，不評設計師。**

---

## §References 路由

**按需讀，不要全載**（六個檔合計 1,835 行）：

| 什麼時候讀 | 讀哪個 |
|---|---|
| `precedent=false`，要從風格庫取方向 | `references/design-styles.md`（564 行，**只在這條路徑**） |
| 判斷產出有沒有 slop、內容規範 | `references/content-guidelines.md` |
| 字體配對、中文排印 | `references/typography.md` |
| 三版要用 inline React + Babel | `references/react-setup.md` |
| 走 §評審 | `references/critique-guide.md` |
| 設計裡要出現具名的第三方產品 / 品牌 | `references/brand-asset-protocol.md` |

| 資產 | 用途 |
|---|---|
| `assets/design_canvas.jsx` | 三版並排展示的網格版面 |
| `scripts/fetch_images.py` | 從 Wikimedia Commons 取公共領域真圖 |

---

## §與 dev-workflow 銜接

| 呼叫端 | 何時 | 期待輸出 |
|---|---|---|
| `brainstorm`（**階段 B2 接上**） | 0b′ 判 `design.size=大改` 且設計路徑選「出三版」 | 三版 ＋ 選定結果回寫 `spec.md` |
| user 顯式呼叫 | 「出三版看看」「這個要改版」 | 同上 |

**上游是 `design-language`**（供給設計語言）、**下游是 `write-plan`**（依定案方向拆 task）。

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「需求很清楚，直接做一版就好」 | 大改一律三版；豁免只能來自 0b′ 的選單選項 |
| 「先給文字方案讓 user 選方向」 | 沒看到真實視覺的選擇是無效的選擇 |
| 「三版換個色換個字體就好」 | `precedent=true` 時骨架必須互異，換皮會被一眼看穿 |
| 「三個 subagent 讓它們互相看一下比較一致」 | 獨立 context 是產出價值本身；趨同就白跑了 |
| 「user 說『這個不錯』就是選 A 版」 | 禁文字 token NLP；一律走 `AskUserQuestion` |
| 「這區沒有設計語言，我憑感覺定一套」 | `precedent=false` 才走風格庫，且要說明選了哪個方向 |
| 「截圖路徑寫進 spec 就好」 | 截圖驗完即刪；spec 記文字描述與 user 原話 |
| 「先開 Agent Teams 跑三版比較快」 | 三判準的第 2 條不成立；subagent 平行即可，不問也不開 |
````

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS

- [ ] **Step 5: commit**

```bash
git add skills/design-direction/SKILL.md
git commit -m "feat: design-direction 加入三方向流程、選定落檔與評審"
```

---

## Task 4: 搬入 6 個 reference 並清除識別字串

**parallel-group**: 4
**files**:
- create: `skills/design-direction/references/{design-styles,content-guidelines,typography,react-setup,critique-guide,brand-asset-protocol}.md`

**這是機械性搬移 ＋ 定點編輯**，不是重寫。來源 `huashu-design/references/`，目的地 `skills/design-direction/references/`。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && d=skills/design-direction/references; ok=1
for n in design-styles content-guidelines typography react-setup critique-guide brand-asset-protocol; do
  test -f "$d/$n.md" || { echo "MISS: $n.md 不存在"; ok=0; }
done
# 識別字串零命中（含上游其他 skill 名）
grep -rqiE "花叔|alchaincyf|design-philosophy|huashu" "$d" 2>/dev/null && { echo "MISS: references 內有上游識別字串"; ok=0; }
# 死鏈檢查：指向本 skill 內不存在的檔
for p in $(grep -rhoE '(references|assets|scripts)/[A-Za-z0-9_./-]+\.(md|jsx|js|py|html)' "$d" 2>/dev/null | sort -u); do
  case "$p" in *xxx*) continue;; esac
  test -e "skills/design-direction/$p" || { echo "MISS(死鏈): $p"; ok=0; }
done
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，6 個檔全不存在
# 本次拉紅：6 條存在性
# regression guard：識別字串與死鏈兩條（目錄不存在時 grep 回空、迴圈不跑，故現況也算過）
```

- [ ] **Step 3: 執行搬移與清除**

**3a — 複製**：`huashu-design/references/<name>.md` → `skills/design-direction/references/<name>.md`（6 個）。

**3b — 清除識別字串（9 處，逐處指定）**：

| 檔:行 | 現有內容要點 | 改成 |
|---|---|---|
| `brand-asset-protocol.md:10` | v1.1 重構說明含作者原話（「除了所謂的品牌色…否則我們在表達什麼呢？」） | 刪去引號原話與人名，保留結論：「本協議從只抽色值升級為抽核心資產——logo / 產品圖 / UI 截圖比色值更重要」 |
| `:126` | 「花叔原話：我們的原則是搜索 5 輪…」 | 改中性敘述：「取材原則：搜尋 5 輪、找到 10 個素材、選 2 個好的，每個需 8/10 以上」 |
| `:144` | 「花叔的哲學：寧缺毋濫」 | 改「原則：寧缺毋濫」 |
| `:238` | DJI Pocket 4 案例，結尾引用作者原話 | 保留案例事實與教訓，刪去人名與引號原話 |
| `:240` | 五大 Coding Agent PPT 案例，含「被花叔抓現行」 | 同上，改「被 review 抓出」 |
| `design-styles.md:383` | 「有生圖能力時用 huashu-gpt-image 生插畫」 | 改「有生圖能力時另行處理插畫元素」 |
| `:520` | 「走 `huashu-gpt-image` 時才作為候選」 | 改「確認有生圖能力時才作為候選」 |
| `:559` | 「完整 AI 生圖方法論 → `huashu-gpt-image` skill」 | **整行刪除**（本專案無此 skill，留著是死鏈） |
| `typography.md:163` | 「這是本倉庫規範（花叔明確不用盤古之白）」 | 改「本專案規範：中英之間不加空格」 |

**3c — 死鏈檢查**：6 個檔內凡引用 `references/*`、`assets/*`、`scripts/*` 的路徑，逐一確認在 `skills/design-direction/` 底下存在；指向未搬入的檔（動畫、deck、影片相關）一律**改寫或刪除該引用**，不留死鏈。

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS

- [ ] **Step 5: commit**

```bash
git add skills/design-direction/references/
git commit -m "feat: 搬入 design-direction 的 6 個 reference 並清除識別字串

清除 9 處：brand-asset-protocol 5、design-styles 3、typography 1。
其中 design-styles 的 3 處是指向上游另一個 skill 的死鏈，一併處理。"
```

---

## Task 5: 搬入 2 個資產

**parallel-group**: 5
**files**:
- create: `skills/design-direction/assets/design_canvas.jsx`
- create: `skills/design-direction/scripts/fetch_images.py`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && d=skills/design-direction; ok=1
test -f "$d/assets/design_canvas.jsx" || { echo "MISS: design_canvas.jsx"; ok=0; }
test -f "$d/scripts/fetch_images.py" || { echo "MISS: fetch_images.py"; ok=0; }
grep -rqiE "花叔|alchaincyf|design-philosophy|huashu" "$d/assets" "$d/scripts" 2>/dev/null && { echo "MISS: 資產內有上游識別字串"; ok=0; }
# UA 必須改成本專案的，且不得留上游網域
grep -qF "huasheng.ai" "$d/scripts/fetch_images.py" && { echo "MISS: UA 仍含上游網域"; ok=0; }
grep -qE "^UA = " "$d/scripts/fetch_images.py" || { echo "MISS: 找不到 UA 定義"; ok=0; }
# Python 語法必須真的能解析（不是只 grep 字串）
python -c "import ast,io; ast.parse(io.open('$d/scripts/fetch_images.py',encoding='utf-8').read())" 2>/dev/null || { echo "MISS: fetch_images.py 語法解析失敗"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，兩個檔不存在 + UA 檢查 + 語法解析
# 本次拉紅：存在性 2 條 + UA 定義 1 條 + 語法 1 條
# 註：語法檢查用 ast.parse，會真的丟 SyntaxError——不是 C1 那種恆綠的空包彈
```

- [ ] **Step 3: 執行搬移與清除**

**3a**：`huashu-design/assets/design_canvas.jsx` → `skills/design-direction/assets/`（**內容零識別字串，原樣複製**）。

**3b**：`huashu-design/scripts/fetch_images.py` → `skills/design-direction/scripts/`，清除 3 處：

| 行 | 現有 | 改成 |
|---|---|---|
| `:3` | docstring 提「供 huashu-design『內容型設計取真圖』用（Phase 3.5）」 | 「供 `design-direction` 三方向流程取真圖用」 |
| `:23` | `UA = "huashu-design-image-fetcher/1.0 (https://huasheng.ai; skill contact)"` | `UA = "bstack-design-image-fetcher/1.0 (+https://github.com/<owner>/bstack)"` —— **這是實際送往 Wikimedia 的 HTTP header**，不改等於對外宣稱自己是上游的 client |
| `:76` | argparse description 含 `huashu-design Phase 3.5` | 改「Wikimedia Commons 真圖抓取（design-direction 三方向取圖）」 |

**3c**：確認 `fetch_images.py` 只用標準庫（`urllib` / `argparse` / `json` / `pathlib`），無新依賴。

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS

- [ ] **Step 5: commit**

```bash
git add skills/design-direction/assets/ skills/design-direction/scripts/
git commit -m "feat: 搬入 design-direction 的並排展示元件與取圖腳本

fetch_images.py 的 User-Agent 改為本專案識別——那是實際送往
Wikimedia 的 HTTP header，沿用上游的等於對外冒名。"
```

---

## Task 6: 驗收

**parallel-group**: 6
**files**:
- create: `docs/work/feat/design-lane/verify-stage-b1.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && ok=1
test -f docs/work/feat/design-lane/verify-stage-b1.md || { echo "MISS: 驗收記錄未落檔"; ok=0; }
for p in "27 skill" "識別字串" "多檔 skill" "setup.ps1" ; do
  grep -qF "$p" docs/work/feat/design-lane/verify-stage-b1.md 2>/dev/null || { echo "MISS(verify): $p"; ok=0; }
done
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗** — Expected: FAIL，5 條全 MISS

- [ ] **Step 3: 執行驗收**

**3a — 全 repo 識別字串掃描**（階段 B 的主要驗收工具，spec V8 已記此指令）：

```bash
grep -rniE "花叔|alchaincyf|design-philosophy|huashu-gpt-image|huashu-md-html|Huashu-Design|huasheng\.ai" skills/
```
須**零命中**。

**3b — 死鏈全掃**：`skills/design-direction/` 內所有 `references/*`、`assets/*`、`scripts/*` 引用逐一確認存在。

**3c — 多檔 skill 同步驗證**（bstack 第一個多檔 skill，這是新行為）：跑 `pwsh -NoProfile -File scripts/setup.ps1 -Yes`，確認 `~/.claude/skills/design-direction/` 底下 `SKILL.md` ＋ `references/`（6）＋ `assets/`（1）＋ `scripts/`（1）**全部到位**，共 9 個檔。
⚠️ 需 user 同意（會覆蓋全域）。

**3d — V10 回歸**：**27 skill**（26 ＋ design-direction）、2 hook、6 agent、`permissions.allow` 24 條、`env`、本機 key 全保留、無孤兒。

**3e — `design-language` 排除生效**：確認 `skills/design-direction/assets/design_canvas.jsx` 這個 `.jsx` 落在 `skills/**` 底下 → 依 Task 1 的規則判 `involved=false`。

**3f — 落檔**：把 3a-3e 的實際輸出寫進 `verify-stage-b1.md`，並如實記載 **D23 的授權立場**（照搬不放聲明，本項驗收只證明識別字串已清除、不代表授權合規）。

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
| 2 | Task 2 | `skills/design-direction/SKILL.md`（new） |
| 3 | Task 3 | 同上（append） |
| 4 | Task 4 | `skills/design-direction/references/`（6 檔） |
| 5 | Task 5 | `skills/design-direction/assets/`、`scripts/` |
| 6 | Task 6 | 驗收記錄 |

**全序列，每 group 1 task** → `execute-plan` 不需載 `dispatch-parallel`。
依賴：**Task 1 必須第一**（不先排除 `skills/**`，Task 5 放 `.jsx` 就會觸發設計 lane）→ Task 2/3 同檔須分組 → Task 4/5 補齊 References 路由指到的檔（Task 3 已寫入路由表，Task 4/5 讓那些引用不再是死鏈）→ Task 6 驗收。

---

## §Self-review

**1. spec coverage**

| spec 項 | 對應 | 狀態 |
|---|---|---|
| S5 三方向與豁免選單 | Task 3 | ✅ skill 本體；**接上流程屬 B2** |
| S6 識別字串清乾淨 | Task 4、5、6（3a） | ✅ 12 處全數處理 |
| S8 `docs/` 端到端（大改側） | —— | ⚠️ **B2**（要接上 brainstorm 才跑得動） |
| S4 中途轉進 | —— | B2 |
| S7 孤兒偵測 | —— | C |
| D28 排除 `skills/**` | Task 1 | ✅ |

**2. placeholder 掃**：無。Task 2/3 給出完整 SKILL.md 內容；Task 4/5 是搬移，給出逐處的來源行號與改寫後文字。

**3. 型別一致**：`design.*` 六欄與 `design-language` §對外契約、`dev-workflow` §Skill hand-off state 逐字相同。`precedent` 的兩種取值與 D8 的兩種玩法對應一致。

**4. 並行性檢查**：全序列。Task 1 的「必須第一」有明確理由（不是形式排序）。

**5. scope 檢查**：新增 `skills/design-direction/`（9 檔）＋ 改 `skills/design-language/SKILL.md` 一處。**未動 `execute-plan` / `verify-done` / `dev-workflow`**——那三個屬 B2，本階段刻意不碰。

**6. 誠實聲明**：
- 本階段完成後 `design-direction` **尚未接上任何流程**——`brainstorm` 不會呼叫它，只有 user 顯式呼叫才會載入。這是 D27 拆兩輪的預期中間態。
- **D23 授權立場**：搬入的 6 個 reference 是大量具體表達，比階段 A 的情況更接近 MIT 所稱「實質部分」。user 已於 D23 知情並選擇不放聲明。本 plan 照此執行，V8 通過**不代表授權合規**。
