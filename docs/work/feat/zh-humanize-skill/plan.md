# `zh-humanize` Implementation Plan **v2**

> 對應 spec: `docs/work/feat/zh-humanize-skill/spec.md`
> 對應 review: `docs/work/feat/zh-humanize-skill/review.md`（四視角，11 Critical / 17 Major）
> Track: Dev | Tier: T3
> 建立: 2026-09-02（v1 → v2 同日重寫）
> 並行最大 group: **9（全部串行，理由見 §為什麼不並行）**

**Goal**：把上游繁中去 AI 味能力搬進 `skills/zh-humanize/`，上游身分字串全面移除、第三方歸屬原樣保留，場景層換成開發者情境，三個機制衝突各有明文處置且**有斷言擋得住**。

**Architecture**：`SKILL.md` 放使用契約、執行流程、路由；樣本庫與情境表下放 `references/`；評測集下放 `evals/`。與 `design-direction`（repo 唯一多檔 skill）同構。

**上游 pin**：

```
Raymondhou0917/speak-human-tw @ 1146d868a3e05dd21168ab9fca6ece153563d581
2026-09-02T04:02:38Z
```

**所有 `gh api` 一律帶 `?ref=1146d868a3e05dd21168ab9fca6ece153563d581`。**

**Risks**：
1. `scenes.md` 與 `examples.md` 是自寫的，沒有上游驗證、benchmark 也量不到
2. 實際 113,914 bytes 進 repo
3. share-alike 那一層的評估超出本 plan 能判斷的範圍

---

## §v1 → v2 的變更（為什麼要重寫而不是修補）

四視角實測抓到 **v1 有 5 條斷言是壞的、1 個 task 對「什麼都沒做」給 PASS、1 個功能性缺陷會讓兩張矛盾的表一起出貨**。逐條列在 `review.md`，這裡只記結構性變更：

| # | v1 | v2 |
|---|---|---|
| 1 | `gh api` 解析 default branch 當下狀態 | **一律 pin `?ref=<sha>`** |
| 2 | 8 task、5 group（並行是假的） | **9 task 全部串行** |
| 3 | 只換 `references/scenes.md` | **同時處理 `SKILL.md` 內的權威力度表**（K1） |
| 4 | 去識別斷言 6/8 是空砲 | **只在真有識別字串的三個檔下該斷言**，其餘改為正向內容斷言 |
| 5 | 沒有 `NOTICE` / README / docs 數字 | **獨立成 Task 1** |
| 6 | 反向斷言在檔案不存在時假綠，只用註解提醒 | **每條反向斷言前加檔案存在守衛**（機制，不是提醒） |

---

## §驗證指令的寫作紀律（v1 四條 ＋ v2 新增三條）

v1 四條照舊：pattern 必須在 Step 3 原文逐字找得到、backtick 一律 `` \` ``、正向 pattern 鎖「改完後才會出現」的措辭、guard 用行首錨定或加足夠上下文。

**v2 新增，全部來自這次實測**：

| # | 病 | 規則 |
|---|---|---|
| 5 | **搬檔 task 的斷言對「什麼都沒做」給 PASS**（實測 Task 1 把上游原封不動放進去也全綠） | 每個搬檔 task 至少一條**正向內容斷言**（節數、逐字關鍵句），不能只有「檔案存在＋位元組下限」 |
| 6 | **反向斷言在檔案不存在時假綠** | 每條反向 grep 前加 `[ -f "$f" ] \|\| { echo "MISS: 檔案不存在，反向斷言無效"; ok=0; }`，用機制不用註解 |
| 7 | **Step 3 描述一個還沒讀過的外部檔案** → 敘述與上游實情不符（四類 vs 五類、第三段標題、刪除指示指錯檔） | Step 3 引用上游結構時，**必須是從 pinned SHA 實抓後寫下的**，不得憑印象 |

---

## §為什麼不並行

v1 把三個搬檔 task 標成 `parallel-group: 1`，實測有兩個問題：

1. Task 1 的兩條斷言是 `grep -r` 掃**整個 `references/` 目錄**，而同組的 Task 2 正往那個目錄寫檔 → Task 2 出問題會紅在 Task 1，實作者看不出原因
2. 三個 task 各自 `git commit`，同一 worktree 平行 commit 會撞 `.git/index.lock`

而 v1 自己在 §並行性總表 已寫「這三個只是各自搬檔、不需交換發現，串行跑完協調成本可能大於收益」——**標記與結論打架**。v2 直接串行。

---

## §檔案結構規劃

| 檔 | 職責 | 來源 |
|---|---|---|
| `NOTICE`（repo root） | 交代上游 MIT ＋ `patterns.md` 的 CC BY-SA 來源 ＋ pinned SHA | 自寫 |
| `skills/zh-humanize/SKILL.md` | 使用契約、執行流程、路由、三個衝突的處置 | 上游 **改寫** |
| `references/patterns.md` | 38 種 AI 痕跡樣本庫 | 照搬（**第三方歸屬保留**） |
| `references/humanize.md` | 加人味的 8 個正向目標 | 照搬 |
| `references/taiwan-localization.md` | 中國用語→台灣用語、全形標點 | 照搬 |
| `references/protected-list.md` | **五類**保護對象 ＋ 開發者情境項 | 照搬 ＋ 新增 |
| `references/scenes.md` | 五個開發者情境的力度表 ＋ 混合情境仲裁 | **重寫** |
| `references/examples.md` | 場景實例（**上限 6KB**） | **重寫** |
| `evals/benchmark.md` | 42 條 SF/SNF 用例 | 照搬 |
| `evals/run-eval.md` | 怎麼跑（無腳本） | 照搬 ＋ 刪 `codex exec` 段 |

---

## Task 1: `NOTICE` ＋ README ＋ docs 數字

**parallel-group**: 1
**files**: create `NOTICE`；modify `README.md`、`docs/index.html`

> 排第一的理由：它與 skill 檔案零交集，而且 `27 → 28` 這件事一旦漏掉，merge 當下三個對外位置同時變錯（README 是 clone 者唯一的目錄、`docs/` 是公開 GitHub Pages）。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)"; ok=1
[ -f NOTICE ] || { echo "MISS: NOTICE 不存在"; ok=0; }
if [ -f NOTICE ]; then
  for p in "speak-human-tw" "MIT" "1146d868a3e05dd21168ab9fca6ece153563d581" "CC BY-SA" "中文維基百科"; do
    grep -qF "$p" NOTICE || { echo "MISS(NOTICE): $p"; ok=0; }
  done
fi
# README：表加一列 ＋ 數字改對
grep -qF "\`zh-humanize\`" README.md || { echo "MISS: README 無 zh-humanize"; ok=0; }
grep -qF "## Skills（28）" README.md || { echo "MISS: README 標題未改 28"; ok=0; }
grep -qF "## Skills（27）" README.md && { echo "MISS: README 舊數字殘留"; ok=0; }
# docs 站兩處
grep -qF "27 個 skill" docs/index.html && { echo "MISS: docs 舊數字殘留"; ok=0; }
grep -c "28 個 skill" docs/index.html | grep -qx 2 || { echo "MISS: docs 應有兩處 28 個 skill"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL
# MISS：NOTICE 不存在（1）、README 無 zh-humanize（1）、README 標題未改（1）、
#       docs 兩處 28（1）—— 共 4 條
# 「README 舊數字殘留」「docs 舊數字殘留」兩條現在會亮（因為 27 還在），這是對的：
#   它們是反向斷言，Step 2 亮代表它們有作用；Step 4 必須全部熄掉
```

- [ ] **Step 3: 寫內容**

`NOTICE`（repo root）：

```
本專案的 skills/zh-humanize/ 改作自：

  speak-human-tw
  https://github.com/Raymondhou0917/speak-human-tw
  MIT License
  取用版本：1146d868a3e05dd21168ab9fca6ece153563d581（2026-09-02）

該專案的 references/patterns.md 自陳其內容主要整理自中文維基百科
「AI生成文的特徵」（WikiProject AI Cleanup）、朱宥勳「AI腔」句型分析，
以及英文維基「Signs of AI writing」的社群觀察。維基百科文本採 CC BY-SA。
本專案保留該歸屬聲明於 skills/zh-humanize/references/patterns.md。
```

`README.md`：`## Skills（27）` → `（28）`；「跨流程 / 觸發式」表加一列。
`docs/index.html`：`:8` 與 `:46` 的「27 個 skill」→「28 個 skill」。**只動數字，不動文案。**

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `docs: 加入 NOTICE 並更新 skill 數字為 28`

---

## Task 2: 照搬層（patterns / humanize / taiwan-localization）

**parallel-group**: 2
**files**: create `skills/zh-humanize/references/{patterns,humanize,taiwan-localization}.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && d=skills/zh-humanize/references; ok=1
for f in patterns humanize taiwan-localization; do
  [ -f "$d/$f.md" ] || { echo "MISS: $f.md 不存在"; ok=0; }
done
# 位元組下限（pinned SHA 實測值的 95%）
[ -f "$d/patterns.md" ]           && [ "$(wc -c < "$d/patterns.md")" -ge 26900 ]           || { echo "MISS: patterns.md 過小"; ok=0; }
[ -f "$d/humanize.md" ]           && [ "$(wc -c < "$d/humanize.md")" -ge 6400 ]            || { echo "MISS: humanize.md 過小"; ok=0; }
[ -f "$d/taiwan-localization.md" ] && [ "$(wc -c < "$d/taiwan-localization.md")" -ge 5100 ] || { echo "MISS: taiwan-localization.md 過小"; ok=0; }
# 【紀律 5】正向內容斷言 —— 位元組下限擋不住尾巴被截
n=$(grep -c '^### [0-9]' "$d/patterns.md" 2>/dev/null)
[ "$n" = 38 ] || { echo "MISS: patterns 應為 38 節，實際 $n"; ok=0; }
# 【V4b】第三方歸屬必須原樣保留 —— 反向驗證去識別沒有清過頭
grep -qF "中文維基百科" "$d/patterns.md" || { echo "MISS: 維基歸屬被清掉"; ok=0; }
grep -qF "朱宥勳"       "$d/patterns.md" || { echo "MISS: 具名作者歸屬被清掉"; ok=0; }
# 【紀律 6】反向斷言的檔案存在守衛
for f in patterns humanize taiwan-localization; do
  [ -f "$d/$f.md" ] || { echo "MISS: 反向斷言無效（$f.md 不存在）"; ok=0; }
done
grep -rlP '[这个们说话见发对开关问题时间]' "$d" && { echo "MISS: 簡體殘留"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

> **本 task 不下去識別斷言。** 實測 pinned SHA：識別字串在 `references/` 六個檔**全部 0 次命中**，下了也不會亮，只會讓紀律 5 看起來已滿足（v1 正是這樣充數的）。真有識別字串的是 `SKILL.md`(4)、`benchmark.md`(1)、`run-eval.md`(1)，斷言下在 Task 4 與 Task 7。

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL
# 三個檔不存在 → 3 條 MISS ＋ 三條下限 MISS ＋ 38 節 MISS ＋ 兩條歸屬 MISS ＋ 三條守衛 MISS
```

- [ ] **Step 3: 寫內容**

```bash
SHA=1146d868a3e05dd21168ab9fca6ece153563d581
gh api "repos/Raymondhou0917/speak-human-tw/contents/references/<檔>.md?ref=$SHA" --jq '.content' | base64 -d
```

三個檔照搬，**規則內容一字不改**（改動即失去上游驗證過的價值）。

**去識別只做一件事**：這三個檔實測無上游身分字串，所以實際上是純搬。
**第三方歸屬（`patterns.md:3` 的維基與朱宥勳）原樣保留**——那不是上游的識別字串，是上游對更上游的致謝，spec §第三方授權層 已定。

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: 加入 zh-humanize 的痕跡樣本庫與台灣用語層`

---

## Task 3: `protected-list.md` — 五類 ＋ 開發者情境項

**parallel-group**: 3
**files**: create `skills/zh-humanize/references/protected-list.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/zh-humanize/references/protected-list.md; ok=1
[ -f "$f" ] || { echo "MISS: 檔案不存在"; ok=0; }
[ -f "$f" ] && [ "$(wc -c < "$f")" -ge 3700 ] || { echo "MISS: 過小"; ok=0; }
# 上游【五】類 —— v1 寫成四類且斷言用了不存在的「承諾條款」
grep -qF "五類保護對象"           "$f" 2>/dev/null || { echo "MISS: 五類標題"; ok=0; }
for p in "價格與數字" "專有名詞" "網址與連結文字" "真實姓名與引號內原話" "承諾類文字"; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS(上游五類): $p"; ok=0; }
done
# 新增的開發者情境保護項
for p in "指令與參數" "檔案路徑" "版本號" "error message" "code block"; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS(新增): $p"; ok=0; }
done
grep -qF "數字與它修飾的對象一起保留" "$f" 2>/dev/null || { echo "MISS: 數字綁定規則"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL —— 檔案不存在，13 條全 MISS
```

- [ ] **Step 3: 寫內容**

照搬上游**五類**（實抓 pinned SHA 確認：`## 五類保護對象`，第 4 類「真實姓名與引號內原話」、第 5 類「承諾**類文字**」）。v1 寫「四類」並用「承諾條款」下斷言，兩者都與上游不符。

**新增一節「開發者情境的保護項」**：

| 項 | 為什麼不能動 |
|---|---|
| 指令與參數 | 改一個字就跑不起來，而讀者會直接複製貼上 |
| 檔案路徑 | 同上 |
| 版本號 | `v1.4.0` 改成「最新版」等於把可驗證資訊改成不可驗證 |
| error message | 使用者是拿它去搜尋的，一字不能差 |
| code block | 整塊不進改寫範圍 |

並補「數字與它修飾的對象一起保留」——`p95 從 480ms 降到 160ms` 不得變成「大幅降低」。

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: 加入 zh-humanize 保護清單（五類 + 開發者情境項）`

---

## Task 4: `evals/` — benchmark ＋ run-eval

**parallel-group**: 4
**files**: create `skills/zh-humanize/evals/{benchmark,run-eval}.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && d=skills/zh-humanize/evals; ok=1
for f in benchmark run-eval; do [ -f "$d/$f.md" ] || { echo "MISS: $f.md 不存在"; ok=0; }; done
[ -f "$d/benchmark.md" ] && [ "$(wc -c < "$d/benchmark.md")" -ge 19800 ] || { echo "MISS: benchmark 過小"; ok=0; }
[ -f "$d/run-eval.md" ]  && [ "$(wc -c < "$d/run-eval.md")"  -ge 2800 ]  || { echo "MISS: run-eval 過小"; ok=0; }
n=$(grep -c "^### SF-"  "$d/benchmark.md" 2>/dev/null); [ "$n" = 27 ] || { echo "MISS: SF 應 27，實際 $n"; ok=0; }
n=$(grep -c "^### SNF-" "$d/benchmark.md" 2>/dev/null); [ "$n" = 15 ] || { echo "MISS: SNF 應 15，實際 $n"; ok=0; }
for p in "不換湯" "保真" "提示注入自查"; do
  grep -qF "$p" "$d/run-eval.md" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
grep -qF "本評測沒有腳本" "$d/run-eval.md" 2>/dev/null || { echo "MISS: 未明寫無腳本"; ok=0; }
# 反向：識別字串（這兩個檔是真的有，實測 benchmark 1 次、run-eval 1 次）
for f in benchmark run-eval; do
  [ -f "$d/$f.md" ] || { echo "MISS: 反向斷言無效（$f.md 不存在）"; ok=0; }
done
grep -rniE "speak-human|Raymond|雷蒙" "$d" && { echo "MISS: 識別字串殘留"; ok=0; }
grep -qF "codex exec" "$d/run-eval.md" && { echo "MISS: Codex 改寫端段落未移除"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL —— 兩檔不存在，前段 10 條 MISS ＋ 兩條守衛 MISS
# 三條反向（識別字串、codex exec）此時因檔案不存在而不亮，守衛已把這件事顯性化
```

- [ ] **Step 3: 寫內容**

`benchmark.md` 照搬 42 條，**不改用例**；清掉 `:426` 的識別字串（實測該處是唯一一次命中）。

`run-eval.md` 照搬，**只刪一段**：`:49-54` 的「Codex 改寫端指令範例」（`codex exec` 命中 1 次，且 `cd speak-human-tw` 同時是識別字串）。

> **v1 這裡指示錯了**：v1 說要從 `run-eval.md` 刪「非互動環境」的判定與「跳過確認、事後摘要」——實測 `run-eval.md` 全文 75 行**沒有「非互動環境」四個字**，那段在 `SKILL.md`，歸 Task 7 處理。

**新增一句**：

> **本評測沒有腳本。** 判定由模型與人做，通過率由人工彙整。上游是寫進 `results-v<版本>.md`，**本 repo 未搬入那兩份結果檔**。能機械判定的只有「保真」與「不換湯」，且需先替 42 條加結構化欄位與自建同族詞表——評估後不做，理由見 spec §已定事項 2。

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: 加入 zh-humanize 評測集`

---

## Task 5: `scenes.md` — 開發者情境 ＋ 混合情境仲裁

**parallel-group**: 5
**files**: create `skills/zh-humanize/references/scenes.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/zh-humanize/references/scenes.md; ok=1
[ -f "$f" ] || { echo "MISS: 檔案不存在"; ok=0; }
for p in "README" "release notes" "使用文件" "issue 與 PR 回覆" "產品站文案"; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS(情境): $p"; ok=0; }
done
grep -qF "| 情境 | 力度 | 禁改項 |" "$f" 2>/dev/null || { echo "MISS: 力度表結構"; ok=0; }
# 力度尺要枚舉（v1 出現「中偏重」但沒定義有幾檔）
grep -qF "力度只有三檔：輕 / 中 / 重" "$f" 2>/dev/null || { echo "MISS: 力度尺未枚舉"; ok=0; }
# 仲裁規則（上游 scenes.md:77 有 混合情境，v1 丟掉了）
grep -qF "混合情境" "$f" 2>/dev/null || { echo "MISS: 缺仲裁規則"; ok=0; }
grep -qF "取最輕的力度、取兩者禁改項的聯集" "$f" 2>/dev/null || { echo "MISS: 仲裁規則沒寫死"; ok=0; }
# 文體邊界（本 skill 不管文體）
grep -qF "文體選擇不歸本 skill 管" "$f" 2>/dev/null || { echo "MISS: 文體邊界"; ok=0; }
# 【紀律 6】反向斷言守衛
[ -f "$f" ] || { echo "MISS: 反向斷言無效（檔案不存在）"; ok=0; }
# 上游【五個】情境必須全部換掉 —— v1 只擋三個，殘留兩節仍全綠（已實測）
for p in "社群貼文" "電子報" "銷售頁" "客服" "辦公文書"; do
  grep -qE "^\| $p" "$f" && { echo "MISS: 上游情境列殘留: $p"; ok=0; }
done
[ $ok = 1 ] && echo PASS || echo FAIL
```

> 反向斷言用 `^\| ` 行首錨定表格列，不鎖裸關鍵字——否則寫一句「上游原本的『銷售頁』情境換成產品站文案」這種遷移註記就會誤紅。

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL —— 檔案不存在，5 情境 ＋ 表結構 ＋ 力度尺 ＋ 混合情境 ＋ 仲裁 ＋ 文體邊界 ＋ 守衛 = 11 條 MISS
```

- [ ] **Step 3: 寫內容**

明寫「**力度只有三檔：輕 / 中 / 重**」（v1 出現「中偏重」但沒定義幾檔，表頭斷言也鎖不到）。

| 情境 | 力度 | 禁改項 |
|---|---|---|
| README | 中 | 第一段的類別名詞、安裝指令、版本需求 |
| release notes | 輕 | 版本號、行為描述、破壞性變更的措辭 |
| 使用文件 | 中 | 步驟順序、指令、參數名 |
| issue 與 PR 回覆 | 中 | 責任歸屬、條件語氣、引用的原話 |
| 產品站文案 | 中 | 數字、連結、CTA 文字 |

**混合情境**（照上游形制，v1 丟掉的）：一份檔命中兩列時，**取最輕的力度、取兩者禁改項的聯集**。

最後明寫：**文體選擇不歸本 skill 管**（工具站文體 vs 轉化行銷文體是另一個 skill 的事），本 skill 只去 AI 味。

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: zh-humanize 情境層換成開發者情境`

---

## Task 6: `examples.md` — 實例重寫（上限 6KB）

**parallel-group**: 6
**files**: create `skills/zh-humanize/references/examples.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/zh-humanize/references/examples.md; ok=1
[ -f "$f" ] || { echo "MISS: 檔案不存在"; ok=0; }
for p in "README" "release notes" "使用文件" "issue 與 PR 回覆" "產品站文案"; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS(情境): $p"; ok=0; }
done
n_b=$(grep -c '^\*\*改寫前\*\*' "$f" 2>/dev/null); n_b=${n_b:-0}
n_a=$(grep -c '^\*\*改寫後\*\*' "$f" 2>/dev/null); n_a=${n_a:-0}
n_c=$(grep -c '^\*\*改了什麼\*\*' "$f" 2>/dev/null); n_c=${n_c:-0}
[ "$n_b" -ge 5 ] || { echo "MISS: 改寫前少於 5 組（實際 $n_b）"; ok=0; }
[ "$n_b" = "$n_a" ] && [ "$n_b" = "$n_c" ] || { echo "MISS: 三段不成套（前 $n_b / 後 $n_a / 說明 $n_c）"; ok=0; }
# 上限（spec：v1 把上游 19KB 抄成目標，會生產最多、品質風險最高的內容）
[ -f "$f" ] && [ "$(wc -c < "$f")" -le 6144 ] || { echo "MISS: 超過 6KB 上限"; ok=0; }
# 至少一組示範保護清單生效
grep -qF "保護清單生效" "$f" 2>/dev/null || { echo "MISS: 缺保護清單示範"; ok=0; }
[ -f "$f" ] || { echo "MISS: 反向斷言無效（檔案不存在）"; ok=0; }
for p in "社群貼文" "電子報" "銷售頁" "客服" "辦公文書"; do
  grep -qE "^## $p" "$f" && { echo "MISS: 上游情境節殘留: $p"; ok=0; }
done
[ $ok = 1 ] && echo PASS || echo FAIL
```

> **第三段標題是「改了什麼」不是「為什麼這樣改」。** 實測上游 `examples.md`：`改寫前` 13 次、`改寫後` 13 次、`為什麼這樣改` **0 次**。v1 的 Step 3 寫「沿用上游三段式（改寫前 / 改寫後 / 為什麼這樣改）」，照上游做會紅、照斷言做那句話就是錯的。

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL —— 檔案不存在，5 情境 ＋ 成套 ＋ 上限 ＋ 保護示範 ＋ 守衛 = 9 條 MISS
# 註：n_b/n_a/n_c 已用 ${x:-0} 兜底，不會像 v1 那樣噴 integer expression expected 又假綠
```

- [ ] **Step 3: 寫內容**

五個情境各一組，三段式（`**改寫前**` / `**改寫後**` / `**改了什麼**`）。**實例文本一律合成**，不指向真實專案。

至少一組標「保護清單生效」：改寫前後的指令、版本號、error message 逐字不動。

**總量控制在 6KB 內**——這是自寫、無上游驗證、benchmark 也量不到的內容，寫多不是寫好。

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: zh-humanize 實例重寫成開發者情境`

---

## Task 7: `SKILL.md` — 本體、三個衝突、bstack 形狀

**parallel-group**: 7
**files**: create `skills/zh-humanize/SKILL.md`

> **本 task 是 v2 改動最大的一個**，v1 在這裡有 K1 / K2 / K5 / K6 / J2 / J10 / J11 / J12 八個問題。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/zh-humanize/SKILL.md; ok=1
[ -f "$f" ] || { echo "MISS: 檔案不存在"; ok=0; }
# frontmatter 只有兩欄（用 awk 取整段，不用 head -20）
fm=$(awk '/^---$/{c++; next} c==1' "$f" 2>/dev/null)
echo "$fm" | grep -qE "^(version|author|tags|license|maturity|review_cadence|last-updated|user-invocable|changelog):" \
  && { echo "MISS: frontmatter 有上游額外欄位"; ok=0; }
grep -qE "^name: zh-humanize$" "$f" || { echo "MISS: name 欄"; ok=0; }
# 【K6】不要觸發段，含 bstack 專屬兩條
grep -qF "不要觸發" "$f" || { echo "MISS: 缺不要觸發段"; ok=0; }
grep -qF "SKILL.md 與 CLAUDE.md 這類給 AI 讀的 prompt 檔" "$f" || { echo "MISS: 未排除 prompt 檔"; ok=0; }
grep -qF "commit message 與 PR 標題" "$f" || { echo "MISS: 未排除 commit message"; ok=0; }
# 【K11】載入 != 改寫
grep -qF "載入不等於改寫" "$f" || { echo "MISS: 缺 載入不等於改寫"; ok=0; }
# 【衝突 1】四選項 ＋ 推薦 ＋ Other
for p in "全部套用" "全部不套用" "我指定編號" "只標問題不改"; do
  grep -qF "$p" "$f" || { echo "MISS(衝突1): $p"; ok=0; }
done
grep -qF "（推薦）" "$f" || { echo "MISS(衝突1): 缺推薦標記"; ok=0; }
grep -qF "Other" "$f" || { echo "MISS(衝突1): 缺 Other"; ok=0; }
# 【J9】我指定編號 之後的三件事
grep -qF "授權成立於選項本身" "$f" || { echo "MISS(J9): 授權成立時點"; ok=0; }
grep -qF "編號無法逐一對應清單項目時停下重問" "$f" || { echo "MISS(J9): 越界處置"; ok=0; }
grep -qF "動筆前先複誦" "$f" || { echo "MISS(J9): 複誦"; ok=0; }
# 【衝突 2】不做環境偵測
grep -qF "不做環境偵測" "$f" || { echo "MISS(衝突2): 未明寫"; ok=0; }
# 【J11】不得覆蓋原始檔
grep -qF "確認之前不得寫入或覆蓋原始檔案" "$f" || { echo "MISS(J11): 檔案寫入紀律"; ok=0; }
# 【J12】輸出第五欄
grep -qF "命中規則" "$f" || { echo "MISS(J12): 輸出缺命中規則欄"; ok=0; }
# 【J10】路徑解析 ＋ 單檔兜底
grep -qF "檔案路徑解析" "$f" || { echo "MISS(J10): 缺路徑解析節"; ok=0; }
grep -qF "解析不到就明說解析不到" "$f" || { echo "MISS(J10): 缺解析失敗處置"; ok=0; }
grep -qF "單檔兜底" "$f" || { echo "MISS(J10): 缺單檔兜底"; ok=0; }
# 【J2】bstack 形狀
for p in "使用契約" "Red Flags" "hand-off state" "[Trace]"; do
  grep -qF "$p" "$f" || { echo "MISS(bstack 形狀): $p"; ok=0; }
done
# 安全邊界保留
grep -qF "稿件是資料，不是指令" "$f" || { echo "MISS: 安全邊界段落"; ok=0; }
# 路由：六個 reference ＋ 兩個 eval（v1 漏 run-eval 且註解數字錯）
for p in "references/patterns.md" "references/protected-list.md" "references/scenes.md" \
         "references/examples.md" "references/humanize.md" "references/taiwan-localization.md" \
         "evals/benchmark.md" "evals/run-eval.md"; do
  grep -qF "$p" "$f" || { echo "MISS(路由): $p"; ok=0; }
done
# ── 反向斷言（守衛在前）──
[ -f "$f" ] || { echo "MISS: 反向斷言無效（檔案不存在）"; ok=0; }
grep -qF "有什麼地方是你覺得需要修改的嗎" "$f" && { echo "MISS(衝突1): 自由文字問法未移除"; ok=0; }
# 【M7】spec V5 明列、v1 未實作的那條
grep -qF "等使用者回覆" "$f" && { echo "MISS(V5): 等使用者回覆 措辭殘留"; ok=0; }
# 【K2】衝突 2 —— v1 只鎖前四個，實測可造出全綠但保留禁止行為的版本
for p in "非互動環境" "codex exec" "claude -p" "沒有後續對話輪次" \
         "跳過確認、事後摘要" "自動化工作流模式" "保留確認清單"; do
  grep -qF "$p" "$f" && { echo "MISS(衝突2): 殘留 $p"; ok=0; }
done
# 【K1】上游的權威力度表必須整張換掉（v1 完全沒管，兩張矛盾的表會一起出貨）
for p in "社群貼文" "電子報" "銷售頁" "客服" "辦公文書"; do
  grep -qF "$p" "$f" && { echo "MISS(K1): SKILL.md 內殘留上游情境 $p"; ok=0; }
done
grep -rniE "speak-human|Raymond|雷蒙" "$f" && { echo "MISS: 識別字串殘留"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL —— 檔案不存在，正向約 33 條全 MISS ＋ 守衛 1 條
# 所有反向斷言此時因檔案不存在而不亮 —— 守衛那條已把這件事顯性化。
# Step 4 才是反向斷言真正被驗的時候。
```

- [ ] **Step 3: 寫內容**

以 pinned SHA 的上游 `SKILL.md` 為底，**九處改動**：

1. **frontmatter** 削成 `name` ＋ `description`（bstack 四段式：觸發 / 涵蓋 / 使用 / **不要觸發**）。觸發詞同步換成開發者情境，不留電子報／銷售頁那組。
2. **不要觸發**（K6）：保留上游的（逐字翻譯、模仿品牌 voice、事實查核、程式碼/log/設定檔），**加 bstack 專屬兩條**——`SKILL.md 與 CLAUDE.md 這類給 AI 讀的 prompt 檔`、`commit message 與 PR 標題`（後者有 `CLAUDE.md §Commit 訊息` 的硬格式）。
3. **刪掉上游 `:90-98` 的權威力度表**（K1），改為指向 `references/scenes.md`。**這是 v1 最大的漏洞**：不刪的話出貨的 skill 會帶兩張互相矛盾的情境表，而 `SKILL.md` 那張在更上層先被讀到。
4. **確認機制**（衝突 1）：清單照列；推進走 `AskUserQuestion` 四選項，**第一個標「（推薦）」、附 `Other`**。
5. **「我指定編號」的三件事**（J9）：
   - `授權成立於選項本身`，後續編號只界定範圍、不重新判定推進與否
   - `編號無法逐一對應清單項目時停下重問`，不猜、不部分套用
   - `動筆前先複誦`「將套用第 N、M 條，其餘保留」
6. **非互動段落整段刪除**（衝突 2 / K2），改為一句「**不做環境偵測**。沒有人回答就停在這裡等。」**上游的孿生後門條款（『明確授權跳過確認』）一併刪除**——spec §衝突 2 已定。
7. **`確認之前不得寫入或覆蓋原始檔案`**（J11）：bstack 實測 auto mode 下無 hook 攔 `Bash`，這條是唯一防線。
8. **輸出格式加第五欄「命中規則」**（J12）：值域 `patterns #N` / `taiwan-localization` / `scenes:<情境>` / `humanize`。上游 `patterns.md` 本來就是 `### 1.`–`### 38.` 穩定編號，這欄不新增內容、只是把已有的編號帶到輸出上。
9. **補 bstack 形狀**（J2 / J10）：`§使用契約`、`§檔案路徑解析`（照 `design-direction:81-88` 形制，含「解析不到就明說解析不到」）、`§單檔兜底`（保留上游的降級路徑）、`§Red Flags`、`§hand-off state`、結尾 `[Trace]`。

**動工前先載入 `write-skill`**（`dev-workflow:256` 明列「user 要加 skill」是它的觸發條件，v1 全程沒載），跑它的 §Skill 結構模板 與 §Self-review checklist。

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: 加入 zh-humanize skill 本體並處置三個機制衝突`

---

## Task 8: `dev-workflow` 觸發表

**parallel-group**: 8
**files**: modify `skills/dev-workflow/SKILL.md`

> **排在 Task 7 之後**（v1 把兩者放同一 group）：V3 要求 description 與觸發表措辭互相 grep 得到，而 description 在 Task 7 才定稿。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/dev-workflow/SKILL.md; s=skills/zh-humanize/SKILL.md; ok=1
grep -qF "\`zh-humanize\`" "$f" || { echo "MISS: 觸發表無 zh-humanize"; ok=0; }
# 【V3 兩邊都驗】—— v1 只驗了 dev-workflow 這一半
for p in "去 AI 味" "說人話"; do
  grep -qF "$p" "$f" || { echo "MISS(V3-表): $p"; ok=0; }
  grep -qF "$p" "$s" || { echo "MISS(V3-skill): $p"; ok=0; }
done
grep -qF "載入不等於改寫" "$f" || { echo "MISS: 觸發表未寫 載入不等於改寫"; ok=0; }
# regression guard（行首錨定表格列）
for p in "\`design-language\` |" "\`design-direction\` |" "\`lock-files\` |" "\`write-skill\` |"; do
  grep -qF "| $p" "$f" || { echo "MISS(reg): 既有列 $p 被動到"; ok=0; }
done
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL —— zh-humanize 那列不存在（1）、V3 四條（表側 2 ＋ skill 側 2 中，
#   skill 側因 Task 7 已完成應為綠）、載入不等於改寫（1）
# 四條 regression guard 現況已實測為綠（v1 已驗過），本輪須保持綠
```

- [ ] **Step 3: 寫內容**

```
| `zh-humanize` | user 顯式要求**去 AI 味 / 說人話 / 潤稿 / 校對**對外文字；或改 README、release notes、使用文件、產品站文案等給人讀的內容時。**載入不等於改寫**——可載入分析並列清單，但沒有 `AskUserQuestion` 的明確選擇就不動任何一個字 |
```

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `feat: dev-workflow 觸發表加入 zh-humanize`

---

## Task 9: 驗收 ＋ 全域同步

**parallel-group**: 9
**files**: create `docs/work/feat/zh-humanize-skill/verify.md`；modify `spec.md`

- [ ] **Step 1: 寫驗證指令（spec V1-V11 全覆蓋）**

```bash
cd "$(git rev-parse --show-toplevel)"; ok=1
# V1 同步
[ -d ~/.claude/skills/zh-humanize/references ] || { echo "MISS V1: 全域無 references"; ok=0; }
diff -rq skills/zh-humanize ~/.claude/skills/zh-humanize >/dev/null 2>&1 || { echo "MISS V1: repo 與全域不一致"; ok=0; }
# V2 回歸 —— 改成名單比對，不綁全域總數（外裝 skill 不該讓這條紅）
for s in $(ls skills/); do
  [ -d ~/.claude/skills/"$s" ] || { echo "MISS V2: 全域缺 $s"; ok=0; }
done
[ -d ~/.claude/skills/zh-humanize ] || { echo "MISS V2: 全域缺 zh-humanize"; ok=0; }
[ "$(ls ~/.claude/hooks/*.ps1 | wc -l)" = 2 ] || { echo "MISS V2: hook 數異常"; ok=0; }
[ "$(ls ~/.claude/agents/*.md | wc -l)" = 6 ] || { echo "MISS V2: agent 數異常"; ok=0; }
# V4 / V4b
grep -rniE "speak-human|Raymond|雷蒙" skills/ && { echo "MISS V4: 身分字串殘留"; ok=0; }
grep -qF "中文維基百科" skills/zh-humanize/references/patterns.md || { echo "MISS V4b: 第三方歸屬被清掉"; ok=0; }
# V6 複跑（與 Task 7 同一組七個關鍵詞，v1 這裡只複跑兩個）
for p in "非互動環境" "codex exec" "claude -p" "沒有後續對話輪次" \
         "跳過確認、事後摘要" "自動化工作流模式" "保留確認清單"; do
  grep -qF "$p" skills/zh-humanize/SKILL.md && { echo "MISS V6: 殘留 $p"; ok=0; }
done
# V9 NOTICE
grep -qF "1146d868a3e05dd21168ab9fca6ece153563d581" NOTICE || { echo "MISS V9: NOTICE 無 pinned SHA"; ok=0; }
# V10 數字
grep -rn "27 個 skill" docs/index.html && { echo "MISS V10: docs 舊數字"; ok=0; }
grep -qF "## Skills（27）" README.md && { echo "MISS V10: README 舊數字"; ok=0; }
# V11 零行為改動
git diff --name-only main -- skills/ | grep -v '^skills/zh-humanize/' | grep -v '^skills/dev-workflow/SKILL.md$' \
  && { echo "MISS V11: 動到不該動的 skill"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```
# Expected: FAIL —— V1/V2 因為還沒跑 setup.ps1 而 MISS
```

- [ ] **Step 3: 執行**

1. `pwsh -NoProfile -File scripts/setup.ps1 -Yes`
2. **V7 實跑兩份稿**（spec 已改成兩份）：
   - 一份**已知有 AI 味**的（證明抓得到該抓的）
   - `docs/index.html` 的 hero 段落（證明不亂改不該改的）
   - 兩份的**輸入原文與完整輸出逐字貼進 `verify.md`**，不是摘要
3. **V3 交叉檢查**已由 Task 8 斷言機械化，這裡複跑
4. **V8** 由 Task 3 斷言覆蓋，這裡複跑
5. 寫 `verify.md`，**至少四塊**（J14）：
   - ① **來源表**：檔名 / 我方行數 / 上游 path / **上游 sha256 前 16 碼** / 上游原行數 / **照搬 or 自寫**（最後一欄是關鍵——delta 對照搬的檔可直接套，對自寫的只有參考價值）
   - ② 逐 task 紅綠與 commit
   - ③ V7 兩份稿的完整輸入輸出
   - ④ 已知限制表
6. 同步 `spec.md` 驗收表補實測結果

**pinned SHA 的 sha256 基準**（已實抓，直接填進來源表）：

```
SKILL.md                           20872  83659ca11673d3e4
references/patterns.md             28393  61a56a00b3442ced
references/examples.md             19392  66c91993711f6900
references/humanize.md              6738  0c782b76ac05540b
references/taiwan-localization.md   5408  881f1606fcc49fad
references/scenes.md                4691  23b2d6e2d4c05804
references/protected-list.md        3958  59d981e3425bdef5
evals/benchmark.md                 20892  98525979d1edfbad
evals/run-eval.md                   3570  f13a28d6b9401c29
```

- [ ] **Step 4: 跑驗證確認通過** → `PASS`
- [ ] **Step 5: commit** `docs: 加入 zh-humanize 驗收記錄並同步 spec`

---

## §還沒解決的（明寫，不假裝 v2 全補了）

| # | 問題 | 為什麼不在 v2 |
|---|---|---|
| 1 | **K11 的動機矛盾只解了一半** | v2 採「載入 ≠ 改寫」，讓 skill 可被自動載入分析。但 spec 動機說的「沒有一關會攔」要真正關上，得在 `verify-done` 加一個偵測點（改到 README / CHANGELOG / `docs/**/*.md` 就載入做只標不改）。**那超出目前 success criteria，是另一個 branch。** |
| 2 | `docs/js/references-data.js` 少兩個 skill、產出器不在 repo | merge 後 repo 28 個 skill、docs 站文件抽屜 27 個。follow-up |
| 3 | `review-plan` 的四個視角模板全是 code 導向 | 本次靠手動改寫繞過，下一個 markdown 類 T3 會再撞。follow-up |
| 4 | `skills/` 內標「這部分是自寫的」（J13） | **已納入**：Task 5 / 6 的 Step 3 要在檔頭自陳，形制照 `design-language:152`。但沒有斷言鎖住，可能被後續編輯順手刪掉 |
| 5 | share-alike 對衍生作品的要求 | 超出本 plan 能判斷的範圍。`NOTICE` 記錄已知事實與已採取的處置 |

---

## §Self-review

**v1 的教訓：這張表打勾不能代替實跑。** v1 對「每個 Step 1 的 pattern 都能在 Step 3 原文裡逐字找到」打了 ✅，實測有 5 條是壞的。

| 檢查 | 結果 |
|---|---|
| 無 `TBD` / `TODO` / placeholder | ✅ |
| **每條正向 pattern 在 Step 3 原文逐字存在** | ✅ **機械驗過**：抽出所有 `\|\|` 型正向 pattern 比對 plan 全文，只有兩條命中 1 次——`## Skills（28）`（標的是 README 改後狀態）與 `稿件是資料，不是指令`（標的是 SKILL.md，實查上游 `SKILL.md:31` 逐字存在），其餘全部連續存在。**這是 v1 失敗的那一項** |
| 反向斷言在真實檔案上的行為 | ⏳ **驗不了**——那要等檔案存在。每條反向前已加檔案存在守衛，Step 4 才是真正被驗的時候 |
| 「鎖到恆綠的東西」「guard 太寬導致恆真」 | ⏳ **機械掃描抓不到**，需造出內容再跑。四視角的斷言 reviewer 用這個方法抓到 K2；本 plan 未再跑一次 |
| 驗證指令的 backtick 已跳脫 | ✅ Task 1 / 8 的 `` \` `` |
| 每條反向斷言前有檔案存在守衛 | ✅ Task 2/4/5/6/7 |
| 每個搬檔 task 有正向內容斷言（紀律 5） | ✅ Task 2 的 38 節、Task 3 的五類、Task 4 的 SF/SNF 計數 |
| 去識別斷言只下在真有識別字串的檔 | ✅ Task 4、7；Task 2/3/5/6 改為正向內容斷言 |
| 所有 `gh api` 帶 `?ref=` | ✅ Task 2 Step 3 |
| 對齊 spec 的 12 個驗收項 | ✅ V1/V2/V4/V4b/V6/V9/V10/V11 在 Task 9；V3 在 Task 8；V5 在 Task 7；V7 在 Task 9 Step 3；V8 在 Task 3 |
