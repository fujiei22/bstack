# `zh-humanize` Implementation Plan

> 對應 spec: `docs/work/feat/zh-humanize-skill/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-02
> 並行最大 group: 5

**Goal**：把上游繁中去 AI 味能力搬進 `skills/zh-humanize/`，全面去識別，場景層換成開發者情境，三個機制衝突各有明文處置。

**Architecture**：`SKILL.md` 只放**使用契約 ＋ 執行流程 ＋ 路由**，樣本庫與情境表全部下放 `references/`，評測集下放 `evals/`。這與 `design-direction`（唯一有 `references/` 的既有 skill）同構，`setup.ps1` 已驗證能同步這種結構。

**Tech Stack**：純 markdown。無 test runner、無腳本、無新依賴。驗證用 grep 斷言（沿用 design-lane 那三輪的作法）。

**Risks**：
1. **場景層與實例是自寫的**，沒有上游驗證過，benchmark 也量不到（spec §已知限制）
2. **89KB 進 repo**，其中 47KB 是樣本庫，review 成本高
3. 去識別後與上游**雙向可追溯性斷裂**，上游季度更新我們拿不到

---

## §驗證指令的寫作紀律

沿用 `docs/archive/2026/design-lane/plan-b2.md` 的四條，**每個 task 收工前對照一遍**：

| 病 | 規則 |
|---|---|
| pattern 在 Step 3 原文裡不存在 → Step 4 永遠紅 | Step 1 的每個 pattern 都要能在 Step 3 原文裡逐字找到 |
| backtick 未跳脫 → 被 bash 當命令替換靜默弱化 | 驗證指令裡的 backtick 一律 `` \` `` |
| 鎖到待刪的舊規則或恆存在的標題 → 恆綠 | 正向 pattern 必須鎖**改完後才會出現**的措辭 |
| guard 鎖太短的子字串 → 恆真 | guard 用行首錨定或加足夠上下文 |

**本 plan 多加第五條**（本 task 特有）：

| 病 | 規則 |
|---|---|
| **搬檔類 task 的斷言只驗「有沒有搬到」，驗不到「搬對沒有」** | 每個搬檔 task 除了正向 pattern，**必跑去識別斷言**（`speak-human` / `Raymond` / `雷蒙` 零命中）與**行數 / 位元組下限**（防止只搬到一半） |

---

## §檔案結構規劃

| 檔 | 職責 | 來源 |
|---|---|---|
| `skills/zh-humanize/SKILL.md` | 使用契約、執行流程、路由、三個衝突的處置 | 上游 SKILL.md **改寫** |
| `references/patterns.md` | 38 種 AI 痕跡的樣本庫 | 照搬 ＋ 去識別 |
| `references/humanize.md` | 加人味的 8 個正向目標與兩道防護 | 照搬 ＋ 去識別 |
| `references/taiwan-localization.md` | 60+ 中國用語→台灣用語、全形標點 | 照搬 ＋ 去識別 |
| `references/protected-list.md` | 保護清單 | 照搬 ＋ **加開發者情境項** |
| `references/scenes.md` | 情境判定與改寫力度表 | **整片重寫**成開發者情境 |
| `references/examples.md` | 場景實例 | **重寫**成開發者情境 |
| `evals/benchmark.md` | 42 條 SF/SNF 用例 | 照搬 ＋ 去識別 |
| `evals/run-eval.md` | 怎麼跑（自然語言 ＋ 人工對照，無腳本） | 照搬 ＋ **移除非互動模式段落** |
| `skills/dev-workflow/SKILL.md` | 觸發表加一列 | modify |

**介面**：`SKILL.md` 對 `references/` 與 `evals/` 的引用一律用**相對路徑**（`references/patterns.md`），與 `design-direction` 一致。

---

## Task 1: 照搬層（patterns / humanize / taiwan-localization）

**parallel-group**: 1
**files**: create `skills/zh-humanize/references/{patterns,humanize,taiwan-localization}.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && d=skills/zh-humanize/references; ok=1
for f in patterns humanize taiwan-localization; do
  [ -f "$d/$f.md" ] || { echo "MISS: $f.md 不存在"; ok=0; continue; }
done
# 內容下限（防只搬一半）：實測上游位元組數
[ -f "$d/patterns.md" ] && [ "$(wc -c < "$d/patterns.md")" -ge 24000 ] || { echo "MISS: patterns.md 過小"; ok=0; }
[ -f "$d/humanize.md" ] && [ "$(wc -c < "$d/humanize.md")" -ge 5500 ] || { echo "MISS: humanize.md 過小"; ok=0; }
[ -f "$d/taiwan-localization.md" ] && [ "$(wc -c < "$d/taiwan-localization.md")" -ge 4500 ] || { echo "MISS: taiwan-localization.md 過小"; ok=0; }
# 去識別
grep -rniE "speak-human|Raymond|雷蒙" "$d" && { echo "MISS: 識別字串殘留"; ok=0; }
# 簡體字抽查（bstack 全套繁中）
grep -rlP '[这个们说话见发对开关问题时间]' "$d" && { echo "MISS: 簡體殘留"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL — 三個檔都不存在，前三條 MISS
```

- [ ] **Step 3: 寫內容**

用 `gh api repos/<上游>/contents/references/<檔>.md --jq .content | base64 -d` 取原文，逐檔：

1. 移除任何 `author` / 人名指涉
2. 檢查交叉引用路徑（上游是同層 `references/`，我們一致，**不需改**）
3. **不改規則內容**——這三個檔是樣本庫，改動即失去上游驗證過的價值

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: 加入 zh-humanize 的痕跡樣本庫與台灣用語層`

---

## Task 2: `protected-list.md` — 照搬 ＋ 加開發者情境保護項

**parallel-group**: 1
**files**: create `skills/zh-humanize/references/protected-list.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/zh-humanize/references/protected-list.md; ok=1
# 上游既有的保護項要在
for p in "價格與數字" "專有名詞" "網址與連結" "承諾條款"; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS(上游): $p"; ok=0; }
done
# 新增的開發者情境保護項（本 branch 自寫，spec V8）
for p in "指令與參數" "檔案路徑" "版本號" "error message" "code block"; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS(新增): $p"; ok=0; }
done
# 「一起保留」的紀律：數字不能脫離它修飾的對象
grep -qF "數字與它修飾的對象一起保留" "$f" || { echo "MISS: 數字綁定規則"; ok=0; }
grep -rniE "speak-human|Raymond|雷蒙" "$f" && { echo "MISS: 識別字串殘留"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL — 檔案不存在，10 條 pattern 全 MISS
```

- [ ] **Step 3: 寫內容**

照搬上游四類，**新增一節「開發者情境的保護項」**：

| 項 | 為什麼不能動 |
|---|---|
| 指令與參數 | 改一個字就跑不起來，而讀者會直接複製貼上 |
| 檔案路徑 | 同上 |
| 版本號 | `v1.4.0` 改成「最新版」等於把可驗證資訊改成不可驗證 |
| error message | 使用者是拿它去 google 的，一字不能差 |
| code block 內全部內容 | 整塊不進改寫範圍 |

並補上「數字與它修飾的對象一起保留」——`p95 從 480ms 降到 160ms` 不得變成「大幅降低」。

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: 加入 zh-humanize 保護清單並補開發者情境項`

---

## Task 3: `evals/` — benchmark ＋ run-eval

**parallel-group**: 1
**files**: create `skills/zh-humanize/evals/{benchmark,run-eval}.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && d=skills/zh-humanize/evals; ok=1
grep -qF "42 條" "$d/benchmark.md" 2>/dev/null || { echo "MISS: 用例總數"; ok=0; }
grep -qcF "### SF-" "$d/benchmark.md" >/dev/null 2>&1 || { echo "MISS: SF 用例"; ok=0; }
n_sf=$(grep -c "^### SF-" "$d/benchmark.md" 2>/dev/null); [ "$n_sf" = 27 ] || { echo "MISS: SF 應為 27，實際 $n_sf"; ok=0; }
n_snf=$(grep -c "^### SNF-" "$d/benchmark.md" 2>/dev/null); [ "$n_snf" = 15 ] || { echo "MISS: SNF 應為 15，實際 $n_snf"; ok=0; }
# run-eval 的三個判定要在
for p in "不換湯" "保真" "提示注入自查"; do
  grep -qF "$p" "$d/run-eval.md" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 衝突 2：非互動模式段落必須消失（本 branch 不做環境偵測）
grep -qF "codex exec" "$d/run-eval.md" && { echo "MISS: 非互動模式段落未移除"; ok=0; }
grep -qF "非互動環境" "$d/run-eval.md" && { echo "MISS: 環境偵測描述未移除"; ok=0; }
# 明寫「無腳本」
grep -qF "本評測沒有腳本" "$d/run-eval.md" || { echo "MISS: 未明寫無腳本"; ok=0; }
grep -rniE "speak-human|Raymond|雷蒙" "$d" && { echo "MISS: 識別字串殘留"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL — 兩檔不存在。
# 註：`codex exec` / `非互動環境` 兩條是「必須不存在」的反向斷言，檔案不存在時它們已綠；
#     真正要盯的是 Step 4 那次——搬進來之後它們不能變紅。
```

- [ ] **Step 3: 寫內容**

`benchmark.md` 照搬（42 條原樣，**不改用例**——改了就失去上游 96% / 0 誤殺那組數字的參照意義）。

`run-eval.md` 照搬並**刪掉兩段**：

1. 「非互動環境」的判定與「跳過確認、事後摘要」——依 spec §衝突 2，本 skill 不做環境偵測
2. 「Codex 改寫端指令範例」的 `codex exec` 段落——它預設了非互動模式

**新增一句**明寫現況，免得後人以為漏了腳本：

> **本評測沒有腳本。** 判定由模型與人做，通過率是人工彙整後寫進 `results-v<版本>.md` 的。能機械判定的只有「保真」與「不換湯」兩項，且需要先替 42 條用例加結構化欄位與自建同族詞表——評估後不做，理由見 spec §已定事項 2。

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: 加入 zh-humanize 評測集，移除非互動模式段落`

---

## Task 4: `scenes.md` — 情境與力度表整片重寫

**parallel-group**: 2
**files**: create `skills/zh-humanize/references/scenes.md`

> **依賴**：無檔案依賴，但**必須先於 Task 5**——`examples.md` 的實例要對應這裡定義的情境。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/zh-humanize/references/scenes.md; ok=1
# 五個開發者情境（spec §已定事項 1）
for p in "README" "release notes" "使用文件" "issue 與 PR 回覆" "產品站文案"; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 力度表三欄
grep -qF "| 情境 | 力度 | 原則 |" "$f" || { echo "MISS: 力度表結構"; ok=0; }
# 上游的五個情境必須消失（換掉不是並存）
for p in "電子報" "銷售頁" "客服"; do
  grep -qF "$p" "$f" && { echo "MISS: 上游情境 $p 未換掉"; ok=0; }
done
# 每個情境要有「禁改項」——這是力度表以外的硬約束
grep -qF "禁改項" "$f" || { echo "MISS: 禁改項"; ok=0; }
grep -rniE "speak-human|Raymond|雷蒙" "$f" && { echo "MISS: 識別字串殘留"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL — 檔案不存在，5 個情境 ＋ 力度表 ＋ 禁改項 共 7 條 MISS
```

- [ ] **Step 3: 寫內容**

保留上游的表格結構（情境 / 力度 / 原則），五列換成：

| 情境 | 力度 | 原則 |
|---|---|---|
| README | 中 | 砍宣傳語與空泛承諾；**第一段的類別名詞不能砍**（讀者靠它判斷這是什麼） |
| release notes / CHANGELOG | 輕 | 幾乎只砍套話開場；**版本號、行為描述、破壞性變更的措辭一律不動** |
| 使用文件 / 教學 | 中 | 砍避險墊片與冗餘鋪陳；**步驟順序、指令、參數名不動** |
| issue 與 PR 回覆 | 中 | 砍罐頭腔（「感謝你的回報」開場、先頒獎再回答）；**保留責任歸屬與條件語氣** |
| 產品站文案 | 中偏重 | 砍浮誇宣傳語；**但這裡只管 AI 味，文體對不對不歸本 skill 管** |

每列補一行「禁改項」。最後一列要明寫邊界：文體選擇（工具站 vs 轉化行銷）**不是本 skill 的職責**。

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: zh-humanize 情境層換成開發者情境`

---

## Task 5: `examples.md` — 實例重寫

**parallel-group**: 3
**files**: create `skills/zh-humanize/references/examples.md`

> **依賴 Task 4**：實例必須對應 `scenes.md` 定義的五個情境。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/zh-humanize/references/examples.md; ok=1
# 五個情境各至少一組實例
for p in "README" "release notes" "使用文件" "issue 與 PR 回覆" "產品站文案"; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: 缺 $p 的實例"; ok=0; }
done
# 每組實例三段式（沿用上游格式）
n_before=$(grep -c "^\*\*改寫前\*\*" "$f" 2>/dev/null)
n_after=$(grep -c "^\*\*改寫後\*\*" "$f" 2>/dev/null)
[ "$n_before" -ge 5 ] || { echo "MISS: 改寫前 少於 5 組（實際 $n_before）"; ok=0; }
[ "$n_before" = "$n_after" ] || { echo "MISS: 前後不成對（$n_before vs $n_after）"; ok=0; }
grep -qF "為什麼這樣改" "$f" || { echo "MISS: 缺說明段"; ok=0; }
# 上游情境的實例必須消失
for p in "電子報" "銷售頁" "課程"; do
  grep -qF "$p" "$f" && { echo "MISS: 上游情境實例 $p 未換掉"; ok=0; }
done
grep -rniE "speak-human|Raymond|雷蒙" "$f" && { echo "MISS: 識別字串殘留"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL — 檔案不存在，5 個情境 ＋ 成對檢查 ＋ 說明段 共 8 條 MISS
```

- [ ] **Step 3: 寫內容**

每個情境至少一組，格式沿用上游三段式（改寫前 / 改寫後 / 為什麼這樣改）。**實例文本一律合成**，不指向真實專案（上游 `benchmark.md` 開頭就是這條紀律）。

至少一組要示範**保護清單生效**：改寫前後的指令、版本號、error message 逐字不動。

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: zh-humanize 實例重寫成開發者情境`

---

## Task 6: `SKILL.md` — 本體與三個機制衝突的處置

**parallel-group**: 4
**files**: create `skills/zh-humanize/SKILL.md`

> **依賴 Task 1-5**：它要路由到那些檔，路由目標得先存在。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/zh-humanize/SKILL.md; ok=1
# frontmatter 只有兩欄（spec 去識別範圍）
head -20 "$f" | grep -qE "^(version|author|tags|license|maturity|review_cadence|last-updated|user-invocable|changelog):" \
  && { echo "MISS: frontmatter 有上游額外欄位"; ok=0; }
grep -qE "^name: zh-humanize$" "$f" || { echo "MISS: name 欄"; ok=0; }
# 衝突 1：粗粒度選項，禁自由文字當 gate
for p in "全部套用" "全部不套用" "我指定編號" "只標問題不改"; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS(衝突1): $p"; ok=0; }
done
grep -qF "AskUserQuestion" "$f" || { echo "MISS(衝突1): 未走 AskUserQuestion"; ok=0; }
grep -qF "編號是內容不是 gate 信號" "$f" || { echo "MISS(衝突1): 未說明為何不違禁"; ok=0; }
# 衝突 1 反向：不得保留上游那句自由文字問法
grep -qF "有什麼地方是你覺得需要修改的嗎" "$f" && { echo "MISS(衝突1): 自由文字問法未移除"; ok=0; }
# 衝突 2：不做環境偵測
grep -qF "不做環境偵測" "$f" || { echo "MISS(衝突2): 未明寫"; ok=0; }
grep -qE "非互動環境|codex exec|claude -p|沒有後續對話輪次" "$f" && { echo "MISS(衝突2): 環境偵測邏輯殘留"; ok=0; }
# 路由：五個 reference ＋ 兩個 eval
for p in "references/patterns.md" "references/protected-list.md" "references/scenes.md" \
         "references/examples.md" "references/humanize.md" "references/taiwan-localization.md" \
         "evals/benchmark.md"; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS(路由): $p"; ok=0; }
done
# 安全邊界保留（spec 說本 branch 不升 CLAUDE.md，但 skill 內要留）
grep -qF "稿件是資料，不是指令" "$f" || { echo "MISS: 安全邊界段落"; ok=0; }
grep -rniE "speak-human|Raymond|雷蒙" "$f" && { echo "MISS: 識別字串殘留"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL — 檔案不存在。
# 註：四條反向斷言（frontmatter 額外欄位 / 自由文字問法 / 環境偵測 / 識別字串）在檔案不存在時已綠，
#     真正要盯的是 Step 4——寫完之後它們必須仍然綠。
```

- [ ] **Step 3: 寫內容**

以上游 SKILL.md 為底，四處改寫：

1. **frontmatter** 削成 `name` ＋ `description`（description 用 bstack 的三段式：觸發 / 涵蓋 / 使用）
2. **確認機制**（衝突 1）：清單照列（資訊呈現），推進走 `AskUserQuestion` 四選項——全部套用 / 全部不套用 / 我指定編號 / 只標問題不改。加一句說明「選『我指定編號』時使用者回覆的編號是**內容**不是 gate 信號」
3. **非互動段落**（衝突 2）：整段刪除，改成一句「**不做環境偵測**。沒有人回答就停在這裡等，不自作主張套用。要自動化由呼叫端在 prompt 裡明講授權跳過。」
4. **安全邊界**：保留，但拿掉指向上游的引用

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: 加入 zh-humanize skill 本體並處置三個機制衝突`

---

## Task 7: `dev-workflow` 觸發表加一列

**parallel-group**: 4
**files**: modify `skills/dev-workflow/SKILL.md`（§跨流程觸發表）

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/dev-workflow/SKILL.md; ok=1
grep -qF "\`zh-humanize\`" "$f" || { echo "MISS: 觸發表無 zh-humanize"; ok=0; }
# 觸發條件要與 skill 的 description 互相對得上（V3：兩處措辭要能互相 grep 到）
grep -qF "去 AI 味" "$f" || { echo "MISS: 觸發詞"; ok=0; }
# regression guard：既有列不得被動到（行首錨定表格列）
for p in "\`design-language\` |" "\`design-direction\` |" "\`lock-files\` |" "\`write-skill\` |"; do
  grep -qF "| $p" "$f" || { echo "MISS(reg): 既有列 $p 被動到"; ok=0; }
done
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL — 前兩條 MISS，四條 regression guard 現況已綠、本輪須保持綠
```

- [ ] **Step 3: 寫內容**

觸發表（`:244-256` 一帶）新增一列，措辭要與 `zh-humanize` 的 `description` 對得上：

```
| `zh-humanize` | user 顯式要求去 AI 味 / 說人話 / 潤稿 / 校對對外文字；改 README、release notes、使用文件、產品站文案等**給人讀的內容**時 user 主動觸發。**不自動觸發**——它會改寫文字，不該在 user 沒要求時動 |
```

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: dev-workflow 觸發表加入 zh-humanize`

---

## Task 8: 驗收 ＋ 全域同步 ＋ 同步 spec

**parallel-group**: 5
**files**: create `docs/work/feat/zh-humanize-skill/verify.md`；modify `spec.md`

- [ ] **Step 1: 寫驗證指令**（spec V1-V8 逐項）

```bash
cd "$(git rev-parse --show-toplevel)"; ok=1
# V1 同步
[ -d ~/.claude/skills/zh-humanize/references ] || { echo "MISS V1: 全域無 references"; ok=0; }
diff -rq skills/zh-humanize ~/.claude/skills/zh-humanize >/dev/null || { echo "MISS V1: repo 與全域不一致"; ok=0; }
# V2 回歸
n=$(ls -d ~/.claude/skills/*/ | wc -l); [ "$n" = 28 ] || { echo "MISS V2: skill 數應 28，實際 $n"; ok=0; }
n=$(ls ~/.claude/hooks/*.ps1 | wc -l); [ "$n" = 2 ] || { echo "MISS V2: hook 數應 2，實際 $n"; ok=0; }
n=$(ls ~/.claude/agents/*.md | wc -l); [ "$n" = 6 ] || { echo "MISS V2: agent 數應 6，實際 $n"; ok=0; }
# V4 識別字串（全 skills/ 掃）
grep -rniE "speak-human|Raymond|雷蒙" skills/ && { echo "MISS V4: 識別字串殘留"; ok=0; }
# V5 / V6 見 Task 6 的斷言，這裡複跑
bash -c 'grep -qF "有什麼地方是你覺得需要修改的嗎" skills/zh-humanize/SKILL.md' && { echo "MISS V5"; ok=0; }
bash -c 'grep -qE "非互動環境|codex exec" skills/zh-humanize/SKILL.md' && { echo "MISS V6"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL — V1/V2 因為還沒跑 setup.ps1 而 MISS
```

- [ ] **Step 3: 執行**

1. `pwsh -NoProfile -File scripts/setup.ps1 -Yes`
2. **V7 實跑**：拿 `docs/index.html` 的 hero 副標 ＋ 一個 beat 段落餵給 skill，確認產出是編號清單、且數字 / 指令 / `<code>` 內容逐字不動
3. **V3 交叉檢查**：`zh-humanize` 的 `description` 觸發詞與 `dev-workflow` 那列互相 grep 得到
4. 寫 `verify.md`：V1-V8 逐項 ✅/❌ ＋ 實測輸出
5. 同步 `spec.md`：驗收表補實測結果

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `docs: 加入 zh-humanize 驗收記錄並同步 spec`

---

## §並行性總表

| group | task | 可並行的理由 |
|---|---|---|
| 1 | Task 1、2、3 | 三組互不相干的新建檔，無交叉引用 |
| 2 | Task 4 | `examples.md` 要對應它定義的情境，必須先完成 |
| 3 | Task 5 | 依賴 Task 4 |
| 4 | Task 6、7 | 不同檔；Task 6 依賴 1-5 的檔案存在，Task 7 完全獨立 |
| 5 | Task 8 | 驗收，必須全部做完 |

**注意**：group 1 的三個 task 雖可並行，但**判準是「要不要互相講話」**（CLAUDE.md §協作模式判定）。這三個只是各自搬檔、不需交換發現，**subagent 就夠、不開 Agent Teams**；量體上也可以直接串行跑完，協調成本可能大於收益。

---

## §Self-review

| 檢查 | 結果 |
|---|---|
| 無 `TBD` / `TODO` / placeholder | ✅ |
| 每個 Step 1 的 pattern 都能在 Step 3 原文裡逐字找到 | ✅ 逐條對過 |
| 驗證指令的 backtick 已跳脫 | ✅ Task 7 的 `` \` `` |
| 正向 pattern 鎖「改完後才會出現」的措辭 | ✅ 未借用待刪文字 |
| 反向斷言在「檔案不存在」時會假綠 | ⚠️ **已在 Task 3、6 的 Step 2 明寫**，要盯 Step 4 那次 |
| 對齊 spec 的 8 個驗收項 | ✅ V1-V6 在 Task 8，V7/V8 在 Task 8 Step 3 |
| spec 說「不改 benchmark 用例」 | ✅ Task 3 Step 3 明寫 |
| spec 說「場景層換掉不是並存」 | ✅ Task 4、5 有反向斷言擋上游情境 |
