# 設計 lane 階段 B2（流程接點）Implementation Plan · v2

> 對應 spec：`docs/work/feat/design-lane/spec.md`（階段序 A → C1 → B1 → **B2** → C）
> 前一階驗收：`docs/work/feat/design-lane/verify-stage-b1.md`
> v1 review：四視角（CEO / Design / Eng / DX），**11 個 Critical**，四份一致判「不可進 execute-plan」
> Track: Dev | Tier: T3
> 建立: 2026-08-31（v2 依 review 重寫）
> group 數: 9 / 最大並行度: **1**（全序列）

**Goal**：把 B1 建好的 `design-direction` **接上 dev-workflow 九階段**，並補上兩個轉進點——`execute-plan` 中途轉進（S4／V6）與 `verify-done` 漏網複查（V7）。**本階段不新增 skill。**

---

## §v1 → v2 的五個結構變更

**1. 三方向的載入點從 0b′ 移到 branch 建立之後（Design C1）**
v1 把載入點寫成 0b′ 的第 5 步，條件是「合併確認的設計路徑選了出三版」。但 `brainstorm:19` 逐字寫「Phase 0 五子步驟（**0a → 0b → 0b′ → 0c → 0d**）」——**0b′ 在合併確認之前跑，那個條件永遠判不出來**。而且 `design-direction:37` 要求「必須 branch 已建立，Phase 0 期間仍在 `main`，`branch-safety.ps1` 會 `exit 2` 擋掉」，`brainstorm:20` 的 spec 落檔又在合併確認之後——在 0b′ 載入它等於**三個 subagent 跑完才被 hook 擋在寫檔那一步**。
v1 自己的 §Architecture 圖畫的順序是對的，是 Task 落點跟它矛盾。v2 把載入點放進 §spec 文件結構與落檔 之後。

**2. 設計路徑選單收窄成兩條（user 決定 · D32）**
v1 的選單承諾三版／單版／一主一變體，但 `design-direction` 對後兩者**沒有任何執行路徑**——全檔只有 `:29` `:270` 兩處提到、都只是「已經問過」，而 `:244` 硬性要求「`design-demos/` 下真的有 3 個 `.html`，少於 3 個 = 沒跑完」。
v2 收窄成：**① 出三版 ② 跳過三方向、直接做一版並把理由記入 `spec.md`**。②**根本不載入 `design-direction`**，所以不需要它支援非三版。代價：「一主一變體」這個折衷選項消失。

**3. 選單結構攤平，不巢狀（CEO C1 / Design C4 / DX M3）**
`AskUserQuestion` 的 `options` 是**平行陣列，沒有巢狀欄位，多題同時呈現**。v1 的「第 3 題選項 1 底下接著問」在機制上做不到；硬做只能發第二次呼叫，那違反 `brainstorm:120`「用一個 `AskUserQuestion` 一次確認」。
收窄成兩條之後剛好攤得平：`size=大改` 時第 3 題給 4 個選項，維持 3 題、單次呼叫。

**4. `pivots` 與 `design_recheck` 合併成 `design_rejudge`（DX m6，順帶解 DX C1）**
v1 讓 `execute-plan` 與 `verify-done` 各記一份重判結果，卻沒有交握——中途轉進處理過的檔，verify-done 會**再抓一次**；大改時 user 選了「之後再做」，verify-done 還會把同一件事**再問一次並升成 blocker**。
兩者本質是同一件事：**施工開始後對 `design.*` 的一次重判，只差在什麼時候發現**。合併成一個 list 之後，verify-done 只要看裡面有沒有這批檔就知道已處理過。

**5. 先講常規、再講例外（DX M4 / M5）**
實測 `execute-plan` 全檔對 `design` **零命中**。v1 在裡面加一整段講得很細的「例外處理」卻從不提常規——實作 agent 會合理推論「計畫內的前端檔不用特別做什麼」。**這是對比效應造成的主動誤導，比漏寫更糟**。
另外兩條新規則 v1 都掛在獨立章節，形成循環依賴：要先意識到有問題才會去讀那節，而那節的存在意義就是提醒你意識到。v2 把觸發掛進**每次都會讀的必經清單**（`execute-plan` §Task 推進規則 第 2 步、`verify-done` §使用契約），並明寫漏網複查**全 tier 都跑**——v1 的寫法讓它對 T3 有效、對 T1 無效，而「順手改一下」正是 T1 最常發生的事。

---

## §驗證指令的寫作紀律（v1 踩過的四種）

四視角在 v1 抓到的斷言缺陷全屬下列四類，v2 每個 task 收工前都要對照一遍：

| 病 | v1 實例 | 規則 |
|---|---|---|
| **pattern 在 Step 3 原文裡不存在** → Step 4 永遠紅 | Task 4 斷言找 `實際改動檔`，原文寫「實際改到了前端檔」 | Step 1 的每個 pattern 都要能在 Step 3 原文裡逐字找到 |
| **backtick 未跳脫** → 被 bash 當命令替換靜默弱化 | Task 2 的 `` `size=大改` `` 被執行成空字串 | 驗證指令裡的 backtick **一律** `\`` |
| **鎖到待刪的舊規則或恆存在的標題** → 恆綠 | Task 7 找 `B2 · 流程接點`（現在就有）；Task 1 找 `設計路徑`（只存在於要刪的 blockquote） | 正向 pattern 必須鎖**接上後才會出現**的措辭 |
| **guard 鎖太短的子字串** → 恆真 | 六欄 guard 的 `scope` 被 `scope_evidence` 餵飽（實測 `scope` 全檔 7 次命中） | guard 用行首錨定 `^    key: ` |

---

## §Architecture：接上之後的流程

```
brainstorm Phase 0（仍在 main，不寫任何檔）
  0b′ 判 design.* 六欄
    ├─ involved=false ───────────────────────────────► 0c（完全不變）
    └─ involved=true
         └─ 0c/0d 合併確認（單次呼叫，3 題；size=大改 時第 3 題 4 個選項）
              ↓
         git checkout -b <branch> → 寫 spec.md（brainstorm 使用契約第 3 步）
              ↓
              ├─ size=小改 ─────────────────────────► write-plan（不變）
              ├─ size=大改 ＋ 路徑=跳過三方向 ──────► 理由記入 spec.md → write-plan
              └─ size=大改 ＋ 路徑=出三版 ──────────► design-direction【B2 新接】
                                                         └─ 選定 → 回寫 spec.md
                                                              └─► write-plan（依定案方向拆 task）
execute-plan
  ├─ 常規：計畫內的前端檔 → task 前後載 design-language 跑對齊檢查
  └─ 例外：冒出計畫外的前端檔 → 暫停 → 補判 → 回寫 state.design ＋ design_rejudge → 接回【B2 新增】
verify-done
  └─ 全 tier：實際改動檔含前端副檔名，且該檔未被 design_rejudge 處理過 → 補判 + 對齊檢查【B2 新增】
```

**兩個轉進點的差別**：

| | `execute-plan` 中途轉進 | `verify-done` 漏網複查 |
|---|---|---|
| 何時發現 | **施工中**，還來得及改 | **施工後**，code 已寫完 |
| 觸發 | 要動的前端檔不在 `codebase_impact.files` 裡 | 實際改動檔含前端副檔名，且 `design.involved=false` 或 `scope` 對不上，**且未被 `design_rejudge` 處理過** |
| 做什麼 | 補判 → 依 `size` 分流 → 回寫 `state.design` ＋ `design_rejudge` → 大改才回寫 `plan.md` → 接回 | 補判 → 跑四項對齊檢查 → 記進 `design_rejudge`；大改升 blocker |
| 為什麼不同 | 施工中還能改 plan，所以要回寫 | 施工後叫三方向重做等於推翻已寫的 code，**成本不成比例**；只做對齊檢查，大改交 user 決定 |

---

## §B2 的 scope 與 spec 的落差（三處，全部明列）

1. **`brainstorm` / `dev-workflow` 兩列在 spec 標為 A**，但各有一項當時 defer 到 B：設計路徑那半（`brainstorm:134` 現在還有一句「不在本階段問」的 blockquote）、Dev track 路徑圖的「階段 B 啟用，目前未接」。
2. **多動 `write-plan`**（spec 未列）。`design-direction:327` 明寫「下游：`write-plan`」，而 `write-plan` 對 `design.` 欄位概念**零命中**（`grep -in design` 唯一命中是 `:201` 的「CEO + **Design** + Eng + DX」，是 review 視角名）。不補，定案方向會停在 `spec.md` 沒人讀。改動量：一條讀取指示。
3. **多動 `design-direction` 與 `design-language`**（spec 未列）。B1 在這兩個檔留了 5 處「還沒接上」的自述，其中 `design-direction:11` 在 **frontmatter `description`**——那是**每個 session 都會載入**的文字。不改的話 B2 上線後會變成「`dev-workflow` 叫它載、skill 自己說別載」，而說「別載」的那一方在更高的載入層。**這一階不收掉，B2 可能整個靜默失效。**

Task 9 會把 spec 的影響檔案表與階段表一起更新。

---

## Task 1: `brainstorm` — 合併確認第 3 題收窄選單

**parallel-group**: 1
**files**: modify `skills/brainstorm/SKILL.md`（`:117-134` §Phase 0c/0d 合併確認）

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/brainstorm/SKILL.md; ok=1
for p in \
  "判定正確，出三版" \
  "判定正確，跳過三方向" \
  "理由記入 \`spec.md\`" \
  "\`size=大改\` 時第 3 題 4 個選項" \
  "\`size=小改\` 時維持 3 個選項" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 舊 blockquote 必須消失（它與新規則直接矛盾）
grep -qF "設計路徑（三版／單版／一主一變體）不在本階段問" "$f" && { echo "MISS: 舊 blockquote 未移除"; ok=0; }
# 收窄的證據：單版／一主一變體 不得再出現在 brainstorm
grep -qF "一主一變體" "$f" && { echo "MISS: 選單已收窄為兩條，不得再提一主一變體"; ok=0; }
# regression guard（行首錨定，避免恆真）
grep -qF "**必跑**——包含看起來純後端的 task" "$f" || { echo "MISS(reg): 0b′ 必跑規則被動到"; ok=0; }
grep -qF "**\`involved=false\` → 到此為止**，繼續 0c。" "$f" || { echo "MISS(reg): involved=false 主線被動到"; ok=0; }
grep -qF "**禁止用 Tier 推導 \`size\`**" "$f" || { echo "MISS(reg): 兩根尺規則被動到"; ok=0; }
grep -qF "合併成一個 \`AskUserQuestion\` 一次確認" "$f" || { echo "MISS(reg): 單次呼叫不變式被動到"; ok=0; }
grep -qF "3 題：Track、Tier、UI 判定" "$f" || { echo "MISS(reg): 題數維持 3 題"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL
# 正向 5 條全 MISS ＋「舊 blockquote 未移除」＋「不得再提一主一變體」共 7 條
# regression guard 5 條現況已綠（實測），本輪須保持綠
# 註：v1 的 Expected 寫「6 條全 MISS」是錯的——`設計路徑`／`一主一變體` 當時因舊 blockquote 而已綠。
#     v2 的正向 pattern 全部鎖「接上後才會出現」的措辭，不再借用待刪文字。
```

- [ ] **Step 3: 寫內容**

`:126-134` 整段改寫：

````markdown
**第 3 題（UI 判定）的選項**，題目描述必須同時顯示 `scope` / `scope_evidence` / `map_status` 三項，讓 user 看得到判斷依據。

**`size=小改` 時維持 3 個選項**：

1. `<區塊名>` ＋ 小改，正確（推薦）
2. 區塊判錯，我來指認
3. `size` 判錯

**`size=大改` 時第 3 題 4 個選項**（設計路徑攤平進來，仍是同一次呼叫、仍是 3 題）：

1. `<區塊名>` ＋ 大改，**判定正確，出三版**（推薦）
2. `<區塊名>` ＋ 大改，**判定正確，跳過三方向、直接做一版**——**理由記入 `spec.md`**
3. 區塊判錯，我來指認
4. `size` 判錯

> **為什麼攤平而不是加第 4 題**：`AskUserQuestion` 的 `options` 是平行陣列、沒有巢狀，多題也同時呈現，做不到「選了選項 1 之後再追問」。攤平之後路徑選擇仍然**是一個可機械讀取的選項**，滿足 CLAUDE.md §決策點選單「**禁文字 token NLP**」；而且維持 `brainstorm` §使用契約 第 2 步「合併成一個 `AskUserQuestion` 一次確認」的不變式。
>
> **為什麼只有兩條路徑**：`design-direction` 目前沒有非三版的執行路徑（`:244` 硬性要求 `design-demos/` 下有 3 個 `.html`）。選項 2 **根本不載入 `design-direction`**，所以不需要它支援。「一主一變體」這個折衷選項因此暫時不提供。
>
> **前移的代價**（明寫，不假裝是純賺）：在這裡問設計路徑時，user 還沒看到設計語言摘要、也還沒定輸出尺寸，判斷依據比在 `design-direction` §使用契約 第 2 步問時**少**。換到的是「不必先燒三個 subagent 才問要不要三版」。
>
> **只前移「設計路徑」這一項**。`design-direction` §使用契約 第 2 步的四項對齊（受眾 / 核心訊息 / **輸出尺寸** / 內容來源）**留在 design-direction**——那四項在 Phase 0 根本問不出來。

**`size=小改` 不問設計路徑**：小改沒有新視覺決策，問了是雜訊。
````

把三者並列在同一個選單，用意是讓 `Tier` 與 `design.size` 的錯位當場可見——「T1 ＋ 大改」或「T3 ＋ 小改」都是合法組合。

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/brainstorm/SKILL.md
git commit -m "feat: brainstorm 合併確認第 3 題加入設計路徑（收窄為兩條）"
```

---

## Task 2: `brainstorm` — 三方向載入點（branch 建立之後）

**parallel-group**: 2
**files**: modify `skills/brainstorm/SKILL.md`（§使用契約 第 3 步、§Phase 0b′ 末尾加 forward reference、§spec 文件結構與落檔）

**這是 v1 最嚴重的錯誤所在**（Design C1）。載入點必須在 **branch 已建立、spec 已落檔**之後。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/brainstorm/SKILL.md; ok=1
for p in \
  "branch 建立且 spec 落檔之後" \
  "載入 \`design-direction\`" \
  "回寫本檔的「設計方向」段落" \
  "不得在 Phase 0 期間載入" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 載入點必須出現在 §spec 文件結構與落檔 之後，不得在 §Phase 0b′ 之內
awk '/^## §Phase 0b′/{a=1} /^## §Phase 0c —/{a=0} a && /載入 `design-direction`/{print "MISS: 載入點誤放在 0b′ 內"; f=1} END{exit f}' "$f" || ok=0
awk '/^## §spec 文件結構與落檔/{a=1} a && /載入 `design-direction`/{seen=1} END{exit !seen}' "$f" \
  || { echo "MISS: 載入點不在 §spec 文件結構與落檔 之內"; ok=0; }
# regression guard：0b′ 不寫檔的硬規則不得被動到
grep -qF "**本階段不寫任何檔（硬規則）**" "$f" || { echo "MISS(reg): 0b′ 不寫檔硬規則被動到"; ok=0; }
grep -qF "**\`involved=true\`** → 判定結果進 §Phase 0c/0d 合併確認 的第 3 題一起問。" "$f" || { echo "MISS(reg): 0b′ 第 4 步被動到"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，正向 4 條 MISS ＋「載入點不在 §spec 文件結構與落檔 之內」
# 「載入點誤放在 0b′ 內」那條現況不會報（還沒有載入點），它是本 task 的反向 guard
# regression guard 2 條現況已綠
```

- [ ] **Step 3: 寫內容**

**改動 1 — §Phase 0b′ 末尾加一句 forward reference**（不加載入動作）：

```markdown
**本階段只判不做**。`size=大改` 的三方向流程在 **branch 建立且 spec 落檔之後**才跑（見 §spec 文件結構與落檔），**不得在 Phase 0 期間載入 `design-direction`**——它要寫 `docs/work/<branch-name>/` 底下的檔，而 Phase 0 仍在 `main`，`hooks/branch-safety.ps1` 會 `exit 2` 擋掉。
```

**改動 2 — §使用契約 第 3 步之後插入第 3.5 步**：

```markdown
3.5 **`design.size=大改` 且第 3 題選了「出三版」** → 此時 branch 已建立、spec 已落檔，**載入 `design-direction`** 走三方向流程；選定後**回寫本檔的「設計方向」段落**（`direction_decided` / `user_choice_quote` / 資產清單），再進第 4 步交棒。
   第 3 題選了「跳過三方向」→ 不載入 `design-direction`，把**理由**寫進「設計方向」段落，直接進第 4 步。
```

**改動 3 — §spec 文件結構與落檔 開頭補一段順序聲明**：

```markdown
**順序（硬規則）**：合併確認 → `git checkout -b <branch>` → 寫 `spec.md` → **（`size=大改` 且選了出三版時）載入 `design-direction`** → 回寫「設計方向」段落 → 交棒。三方向的產出全落在 `docs/work/<branch-name>/design-demos/`，**branch 不存在就跑不了**。
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/brainstorm/SKILL.md
git commit -m "feat: 三方向載入點定在 branch 建立且 spec 落檔之後"
```

---

## Task 3: `brainstorm` — spec 範本與交棒 state 補三個輸出欄

**parallel-group**: 3
**files**: modify `skills/brainstorm/SKILL.md`（`:168-173` spec 範本「設計方向」、`:227` 交棒 state）

**B1 §Self-review 誠實聲明裡「K6 的接收端推到 B2」那一條。** `design-direction` 定義了 `direction_decided` / `user_choice_quote`，`brand-asset-protocol` §Step 5 另外要求把**資產清單**寫進同一段落——三者現在都沒有欄位可寫。

**措辭逐字對齊**（Eng m5）：`design-direction:76` 寫「**不得以**截圖路徑作為事後追溯依據」、`:71` 的 placeholder 是 `<user 選擇原話>`。本 task 一律照抄，不自行改字。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/brainstorm/SKILL.md; ok=1
for p in \
  "direction_decided" \
  "user_choice_quote" \
  "資產清單" \
  "\`size=大改\` 走過三方向時才填" \
  "跳過三方向時，這裡改記「跳過的理由」" \
  "不得以截圖路徑作為事後追溯依據" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
[ "$(grep -cF 'direction_decided' "$f")" -ge 2 ] || { echo "MISS: direction_decided 應在 spec 範本與 state 各一處"; ok=0; }
[ "$(grep -cF 'user_choice_quote' "$f")" -ge 2 ] || { echo "MISS: user_choice_quote 應各一處"; ok=0; }
# 欄名與 design-direction §對外契約 逐字一致
for k in direction_decided user_choice_quote; do
  grep -qF "$k" skills/design-direction/SKILL.md || { echo "MISS: $k 與 design-direction 對不上"; ok=0; }
done
# regression guard：state 的 design 六欄用行首錨定（避免 scope 被 scope_evidence 餵飽）
for k in involved scope scope_evidence size precedent map_status; do
  grep -qE "^    ${k}: " "$f" || { echo "MISS(reg): state 的 design 區塊少了行首欄位 $k"; ok=0; }
done
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，正向 6 條 + 兩個計數條 MISS
# 註：v1 這裡的 `size=大改` 未跳脫 backtick，被 bash 當命令替換執行、pattern 縮成「 走過三方向時才填」（實測）。v2 已跳脫。
# 註：v1 的六欄 guard 用裸 grep，`scope` 會被 `scope_evidence` 餵飽而恆真（實測 scope 全檔 7 次命中）。v2 改行首錨定。
# regression guard 現況已綠
```

- [ ] **Step 3: 寫內容**

**改動 1 — spec 範本「設計方向」段落**（`:173` 之後追加）：

```markdown
- **以下 `size=大改` 走過三方向時才填**（小改留空並註明「小改，未走三方向」）：
  - `direction_decided`：<定案方向的文字描述>
  - `user_choice_quote`：<user 選擇原話>
  - 資產清單：<若設計裡出現具名第三方品牌，依 `design-direction` `references/brand-asset-protocol.md` §Step 5 把資產與**來源網址**列在這裡>
  > **跳過三方向時，這裡改記「跳過的理由」**（第 3 題選項 2 的 user 原話），三個欄位留空。
  > 三方向的 HTML 與截圖落在 `docs/work/<branch-name>/design-demos/`（不進版控、驗完即刪），**不得以截圖路徑作為事後追溯依據**——能留下的只有上面這幾項文字。
```

**改動 2 — 交棒 state 的 `design:` 區塊**（`:227` `map_status` 之後追加兩行，維持 4 空格縮排）：

```yaml
    direction_decided: <定案方向文字|null>   # size=大改 且走過三方向才有
    user_choice_quote: <user 選擇原話|null>  # 同上
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/brainstorm/SKILL.md
git commit -m "feat: brainstorm 的 spec 範本與 state 補上三方向的定案輸出欄"
```

---

## Task 4: `design-direction` / `design-language` — 收掉「還沒接上」的自述

**parallel-group**: 4
**files**: modify `skills/design-direction/SKILL.md`（`:11` description、`:29-30` 使用契約第 2 步、`:270` §豁免、`:326` 銜接表）、`skills/design-language/SKILL.md`（`:262` `:263`）

**四個視角全部獨立點名這一條。** 最關鍵的是 `design-direction:11` 在 **frontmatter `description`**——那是 skill 清單裡**每個 session 都會載入**的文字，而模型正是靠 description 決定要不要自動載入 skill。不改的話 B2 上線後會變成「`dev-workflow` 叫它載、skill 自己說別載」，設計 lane 靜默不觸發、不報錯。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && ok=1
# 全 skills/ 不得再有任何「還沒接上」的自述（regex 一次蓋住四種措辭）
grep -rqE "階段 B[0-9]? ?(啟用|接上|才接上)|目前未接|尚未接上|（階段 B）" skills/ \
  && { echo "MISS: 仍有待啟用字樣"; grep -rnE "階段 B[0-9]? ?(啟用|接上|才接上)|目前未接|尚未接上|（階段 B）" skills/ | cut -c1-80; ok=1; ok=0; }
d=skills/design-direction/SKILL.md
# description 要改成正式觸發，且不得再說「僅 user 顯式呼叫」
grep -qF "僅 user 顯式呼叫" "$d" && { echo "MISS: description 仍自述僅顯式呼叫"; ok=0; }
grep -qF "brainstorm 0c/0d 合併確認第 3 題選「出三版」時自動載入" "$d" || { echo "MISS: description 未改成正式觸發"; ok=0; }
# 使用契約第 2 步：設計路徑已前移，此處不得再問
grep -qF "設計路徑已於 \`brainstorm\`" "$d" || { echo "MISS: 第 2 步未標明設計路徑已前移"; ok=0; }
grep -qF "一主一變體" "$d" && { echo "MISS: 選單已收窄為兩條，不得再提一主一變體"; ok=0; }
# §豁免 不得再指向不存在的「第 2 步已問過」
grep -qF "在 §使用契約 **第 2 步**已問過" "$d" && { echo "MISS: §豁免 仍指向已前移的步驟"; ok=0; }
# 四項對齊必須留在本檔（只前移設計路徑）
grep -qF "輸出尺寸" "$d" || { echo "MISS(reg): 四項對齊被誤刪"; ok=0; }
# regression guard：三版硬門與落檔硬規則不得鬆綁
grep -qF "少於 3 個 = 沒跑完" "$d" || { echo "MISS(reg): 三版產出自檢被動到"; ok=0; }
grep -qF "必須 branch 已建立" "$d" || { echo "MISS(reg): 落檔硬規則被動到"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL
# 實測待啟用字樣現有 8 處：brainstorm:134（Task 1 已刪）、design-direction:11/:30/:326、
#   design-language:262/:263、dev-workflow:78/:238（Task 8 處理）
# 本 task 負責 design-direction 4 處與 design-language 2 處；跑完仍會因 dev-workflow 2 處而紅，
#   → 因此本條「全 skills/ 零殘留」在 Task 8 完成後才會真正轉綠，Step 4 只驗本檔的 6 條。
```

> **Step 4 的例外說明**：上面那條 `grep -r` 掃的是全 `skills/`，而 `dev-workflow` 由 Task 8 處理。**本 task 的 Step 4 只驗 `design-direction` 與 `design-language` 兩檔**（把 `grep -r` 的範圍縮到這兩個檔），全 repo 零殘留由 **Task 9** 驗。這樣寫是為了不讓 Task 4 卡在一個它管不到的檔上。

- [ ] **Step 3: 寫內容**

| 位置 | 現況 | 改成 |
|---|---|---|
| `design-direction:11` | `現況：**流程自動載入待階段 B2 接上**，目前僅 user 顯式呼叫。` | `觸發：brainstorm 0c/0d 合併確認第 3 題選「出三版」時自動載入；user 亦可顯式呼叫。` |
| `design-direction:29` | 「**同一個選單問設計路徑**：三版（預設）／單版／一主一變體。**必須在 spawn 之前問**」 | 「**設計路徑已於 `brainstorm` 0c/0d 合併確認第 3 題選定**（出三版／跳過三方向）；走到本 skill 就是選了出三版，**此處不重複問**。本步只對齊四項假設：受眾 / 核心訊息 / **輸出尺寸** / 真實內容來源。」 |
| `design-direction:30` | `> 階段 B2 接上流程後，設計路徑會前移到 brainstorm 0b′ 的合併選單；在那之前由本 skill 自己問。` | 整句刪除（前移已完成） |
| `design-direction:270` | 「**豁免**：在 §使用契約 **第 2 步**已問過（三版 / 單版 / 一主一變體），此處不重複問。」 | 「**豁免**：設計路徑在 `brainstorm` 合併確認第 3 題已選定，此處不重複問。選了「跳過三方向」的 task 根本不會走到本 skill。」 |
| `design-direction:326` | `| \`brainstorm\`（**階段 B2 才接上，目前未接**） | 0b′ 判 \`design.size=大改\` 且設計路徑選「出三版」 | 同上 |` | `| \`brainstorm\` | 合併確認第 3 題選「出三版」，且 branch 已建立、spec 已落檔 | 同上 |` |
| `design-language:262` `:263` | 兩列標「（階段 B）」 | 拿掉「（階段 B）」，改為正式觸發條件 |

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，但 `grep -r` 範圍縮到 `skills/design-direction/ skills/design-language/`，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/design-direction/SKILL.md skills/design-language/SKILL.md
git commit -m "fix: 收掉 design-direction 與 design-language 的「還沒接上」自述

design-direction 的 description 每個 session 都載入，
留著會變成 dev-workflow 叫它載、skill 自己說別載。"
```

---

## Task 5: `execute-plan` — 常規 ＋ 中途轉進（S4 / V6）

**parallel-group**: 5
**files**: modify `skills/execute-plan/SKILL.md`（§Task 推進規則 第 2 步、其後新增 §前端檔處理、§hand-off state 補欄）

**實測 `execute-plan` 全檔對 `design` 零命中**——常規規則只寫在別人的檔裡（`design-language` frontmatter、`dev-workflow:238`），做事的這個檔一個字都沒有。v1 只加例外不加常規，會造成對比誤導（DX M4）。v2 先講常規、再講例外，且**把觸發掛進第 2 步**這個每次都會讀的地方（DX M5）。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/execute-plan/SKILL.md; ok=1
for p in \
  "§前端檔處理" "先講常規" "本節其餘講的是例外" \
  "不在 \`codebase_impact.files\`" "暫停" "補判" \
  "回寫 \`state.design\`" "design_rejudge" \
  "接回 §Task 推進規則 第 3 步（tdd-cycle）" \
  "design-language §對齊檢查清單" \
  "升級為 user gate**，走 \`AskUserQuestion\`" \
  "無人值守" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 觸發必須掛進 §Task 推進規則 第 2 步（不能只放在獨立章節）
awk '/^## §Task 推進規則/{a=1} /^## §前端檔處理/{a=0} a && /codebase_impact.files/{seen=1} END{exit !seen}' "$f" \
  || { echo "MISS: 觸發未掛進 §Task 推進規則"; ok=0; }
# 排除判準必須錨定 SKILL.md，不得裸比對
grep -qF "含 \`*/SKILL.md\` 的 \`skills/**\`" "$f" || { echo "MISS: 排除未錨定 */SKILL.md"; ok=0; }
grep -qE "grep -v '\^skills/'" "$f" && { echo "MISS: 出現裸 ^skills/ 比對（design-language:26 明文禁止）"; ok=0; }
# regression guard（既有主線）
grep -qF "跳 task / 重排序" "$f" || { echo "MISS(reg): 禁跳 task 規則被動到"; ok=0; }
grep -qF "多 task 累一個大 commit" "$f" || { echo "MISS(reg): 每 task 一 commit 規則被動到"; ok=0; }
grep -qF "**禁猜**：don't guess your way through。" "$f" || { echo "MISS(reg): Blocker 禁猜規則被動到"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，正向 12 條全 MISS ＋「觸發未掛進第 2 步」＋「排除未錨定」共 14 條
# 註：v1 用 `grep -qF "AskUserQuestion"` 當斷言，但 execute-plan:97 本來就有這字串（實測），
#     改前改後都綠、零資訊。v2 改鎖新章節的完整措辭。
# 「出現裸 ^skills/」是反向 guard，現況不報
# regression guard 3 條現況已綠
```

- [ ] **Step 3: 寫內容**

**改動 1 — §Task 推進規則 第 2 步**改成：

```markdown
2. 讀 task 5 個 step，**並比對要動的檔是否都在 `codebase_impact.files` 內**；有前端檔不在清單 → 進 §前端檔處理 的例外分支
```

**改動 2 — §Task 推進規則 之後插入新章節**：

````markdown
## §前端檔處理

**先講常規**：task 要動的前端檔**在** `codebase_impact.files` 裡 → 照 §Task 推進規則 第 3 步之前載 `design-language`、寫完跑 `design-language §對齊檢查清單` 四項（元件狀態 / 斷點 / 表單 / dark mode）。這是既有規則，見 `dev-workflow` §跨流程 skill 觸發。

**本節其餘講的是例外**：施工中發現要動的前端檔**不在** `codebase_impact.files` 裡——也就是 Phase 0 沒看到它。

判斷副檔名用 `design-language` §前端副檔名 那份清單（**不在本檔重列**），排除同樣照 `design-language` §使用契約 第 1 步：剔除 `~/.claude/skills/**`，或 repo 內**含 `*/SKILL.md` 的 `skills/**``。**不得用裸 `skills/` 比對**——`design-language:26` 明文說明理由：某個專案可能有叫 `skills/` 的產品目錄，裸比對會把真實介面靜默排除。

**動作（五步）**：

1. **暫停當前 task**，`TaskUpdate` 維持 `in_progress`，**不 commit 半成品**。
2. **補判**：載入 `design-language`，把新冒出的檔交給它，取回 `design.*` 六欄。
3. **依 `size` 分流**：
   - **小改** → 跑 `design-language §對齊檢查清單` 四項，通過就繼續寫 code
   - **大改** → **先查 `spec.md` 是否已有 `direction_decided`**：有值代表本 task 走過三方向，**照已定案方向做，不重問**。沒有才**升級為 user gate**，走 `AskUserQuestion`：
     ① 現在轉進三方向（`design-direction`）
     ② 縮回小改範圍、只做沿用既有 token 的版本
     ③ 這個前端改動其實不必要，撤掉
     ④ 切成本 branch 內的獨立 task 之後再做（**不另開 branch**）
     ⑤ 接受它是大改、照既有 token 做完並記入技術債
     ⑥ 暫停整個 plan 重新 brainstorm——此時未 commit 的改動一律 `git stash`，不丟棄
     > **不得自行選定後繼續**。大改代表有新的視覺決策要做，那是 user 的決定不是實作細節。
     > **無人值守**時停在這裡等，**不得自選**（對齊 `design-direction` §使用契約 的同一條禁令）。
4. **回寫 state**：把補判結果寫回 `state.design`（`involved=true`、`size` 依補判），原值存進 `design_rejudge[].design_before`。**大改才另外回寫 `plan.md`**（在該 task 底下追加 `轉進紀錄`）——小改只進 state，不必動 plan，否則「順手多改一個 `.css`」的成本過重。
   > 為什麼一定要回寫 `state.design`：不回寫的話 `verify-done` §漏網複查 會對同一批檔**再觸發一次**；大改情境甚至會把 user 五分鐘前答過的問題再問一次並升成 blocker。
5. **接回 §Task 推進規則 第 3 步（tdd-cycle）**，從中斷處繼續，**不必整個紅綠循環重來**。

**state 補欄**（`§hand-off state` 的 `state:` 底下，2 空格縮排）：

```yaml
  design_rejudge:               # 施工開始後對 design.* 的重判；沒發生就是空 list
    - stage: execute-plan       # execute-plan | verify-done
      task_id: <轉進發生在哪個 task>
      trigger_files: [...]
      design_before: {...}      # 補判前的六欄
      design: {...}             # 補判後的六欄
      action: <小改對齊|大改-user-gate|blocker>
      user_choice: <大改時 user 選的選項|null>
```

**禁止**：
- 發現前端檔卻只在心裡記一下就繼續寫（**這正是 S4 要防的**）
- 把中途轉進當 §Blocker 處理然後停在那裡——轉進**有明確回歸點**，是繞路不是撞牆
- 為了不轉進而把前端改動拆到別的 branch 偷做（選項 ④ 指的是**本 branch 內**的新 task）
````

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/execute-plan/SKILL.md
git commit -m "feat: execute-plan 補上前端檔常規處理與中途轉進"
```

---

## Task 6: `verify-done` — 漏網複查（V7）

**parallel-group**: 6
**files**: modify `skills/verify-done/SKILL.md`（§使用契約 插入 2.5 步、§UI / browser e2e 之後新增 §漏網複查、§verify 失敗處置 補三個 design 專屬選項、§hand-off state 補欄）

v1 的四個問題一起修：pattern 對不上原文（Eng C1）、裸 `^skills/`（Eng M1 / Design M2）、`<base>` 未定義（三個視角都提）、掛在 T1/T2 走不到的地方（DX M5）。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/verify-done/SKILL.md; ok=1
for p in \
  "§漏網複查" "全 tier 都跑" "實際改動檔" \
  "design.involved=false" "scope\` 對不上" \
  "design_rejudge" "已被 \`design_rejudge\` 處理過的檔不重複觸發" \
  "四項對齊檢查" "不在 verify-done 補做三方向" \
  "state.commits\` 不存在" "merge-base" \
  "退回 execute-plan 補做" "退回 brainstorm 重判" "接受現況並記入技術債" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 觸發必須掛進 §使用契約（不能只放在獨立章節，否則 T1/T2 走不到）
awk '/^## 使用契約/{a=1} /^## §Verify 套餐/{a=0} a && /漏網複查/{seen=1} END{exit !seen}' "$f" \
  || { echo "MISS: 觸發未掛進 §使用契約"; ok=0; }
# 排除與副檔名一律引用 design-language，不得裸比對、不得重列清單
grep -qE "grep -v '\^skills/'" "$f" && { echo "MISS: 出現裸 ^skills/ 比對"; ok=0; }
grep -qF "副檔名與排除判準一律依 \`design-language\`" "$f" || { echo "MISS: 未引用 design-language 的清單"; ok=0; }
# regression guard
[ "$(grep -cF 'skill 定義目錄' "$f")" -ge 2 ] || { echo "MISS(reg): B1 的排除句被動到"; ok=0; }
grep -qF "**必跑**（fail 不能放行 verify-done）" "$f" || { echo "MISS(reg): T3 e2e 必跑規則被動到"; ok=0; }
grep -qF "全綠 → 交棒 request-review" "$f" || { echo "MISS(reg): 交棒條件被動到"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，正向 14 條全 MISS ＋「觸發未掛進 §使用契約」＋「未引用 design-language」共 16 條
# 註：v1 的 pattern「實際改動檔」在 Step 3 原文裡不存在（原文寫「實際改到了前端檔」），
#     Step 4 永遠 PASS 不了（Eng C1 實測）。v2 的 Step 3 原文已統一用「實際改動檔」。
# regression guard 3 條現況已綠
```

- [ ] **Step 3: 寫內容**

**改動 1 — §使用契約 第 2 步與第 3 步之間插入**：

```markdown
2.5 **跑 §漏網複查 的觸發判斷**（**全 tier 都跑**，成本是 1 個 `git diff`）。
```

**改動 2 — §UI / browser e2e 之後插入新章節**：

````markdown
## §漏網複查

**要防的事**：Phase 0b′ 判 `design.involved=false`（或 `scope` 判錯），但這一輪**實際改動檔**含前端副檔名——判定漏了，而且沒有任何 gate 會發現。**全 tier 都跑**：這種漏網最常發生在「T1，兩個檔，順手改一下」，只在 T3 跑等於對最需要的情境無效。

**觸發條件**：

1. 取本 branch 的改動清單。`<base>` = `state.commits` 第一個 commit 的 parent；**`state.commits` 不存在**（verify-done 被單獨呼叫、或上游是 tdd-cycle）→ fallback `$(git merge-base origin/main HEAD)`；兩者都取不到 → **不觸發**，在結果標 `design_rejudge` 未執行與原因。
2. **副檔名與排除判準一律依 `design-language`**（§前端副檔名 ＋ §使用契約 第 1 步的 skill 定義目錄排除 ＋ §首次偵測 的 `node_modules` / `dist` / `build` / `vendor` / gitignore 命中 / `design-demos` 排除）。**不在本檔重列清單，也不得用裸 `skills/` 比對。**
3. 篩掉**已被 `design_rejudge` 處理過的檔**（`execute-plan` 中途轉進已經處理過的不重複觸發）。
4. 剩下的清單非空，且 `state.design.involved` 為 `false`、或該檔不在 `state.design.scope` 對應的範圍內（`scope` 對不上）→ 觸發。

**動作**：

1. 載入 `design-language` 補判，取回 `design.*` 六欄，append 進 `state.design_rejudge`（`stage: verify-done`）。
2. **跑 `design-language §對齊檢查清單` 四項對齊檢查**，結果記進 verify 結果。
3. **補判結果是大改 → 標為 blocker**，走 §verify 失敗處置 的 **design 專屬三選項**。

**界線（硬規則）**：**不在 verify-done 補做三方向。** 這時 code 已經寫完，叫三方向重來等於推翻已經寫好的實作——成本與收益不成比例。verify-done 的職責是**把漏網這件事變成看得見的**，不是把它就地補完。

**state 補欄**（`§hand-off state` 的 `state:` 底下，2 空格縮排；與 `execute-plan` 共用同一個 list）：

```yaml
  design_rejudge:               # 與 execute-plan 共用；沒發生就是空 list
    - stage: verify-done
      task_id: null             # verify 階段沒有 task 歸屬
      trigger_files: [...]
      design_before: {...}
      design: {...}
      action: <小改對齊|blocker>
      user_choice: <blocker 時 user 選的選項|null>
```
````

**改動 3 — §verify 失敗處置 的 `AskUserQuestion` 選項清單末尾補三項**：

```markdown
   - **退回 execute-plan 補做**（漏網複查判為大改時）
   - **退回 brainstorm 重判**（設計判定從一開始就錯）
   - **接受現況並記入技術債**（這一輪先出去，方向另案處理）
```

> v1 直接宣稱「走 §verify 失敗處置 的選單（退回 execute-plan 補做 / 退回 brainstorm 重判 / 接受現況並記入技術債）」，但實測那節只有 retry / adjust+retry / rollback / 退回 execute-plan 改 task 實作 / 退回 write-plan 改 plan / escalate——**後兩項根本不存在**，執行者照著找會找不到。v2 補進去。

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/verify-done/SKILL.md
git commit -m "feat: verify-done 加入漏網複查（全 tier）與 design 專屬失敗選項"
```

---

## Task 7: `write-plan` — 讀定案方向拆 task

**parallel-group**: 7
**files**: modify `skills/write-plan/SKILL.md`（§使用契約 加一條）

**spec 沒列這個檔**（理由見 §B2 的 scope 與 spec 的落差 第 2 點）。改動量：一條讀取指示，不動 plan 結構。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/write-plan/SKILL.md; ok=1
for p in "direction_decided" "spec.md\` 的「設計方向」段落" "不得推翻已定案的方向" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
grep -qF "direction_decided" skills/brainstorm/SKILL.md || { echo "MISS: 欄名與 brainstorm 對不上（Task 3 應先完成）"; ok=0; }
grep -qF "parallel-group" "$f" || { echo "MISS(reg): 並行性分析被動到"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗** — Expected: FAIL，正向 3 條 MISS

- [ ] **Step 3: 寫內容**

§使用契約 加一條：

```markdown
- **`design.size=大改` 且 `direction_decided` 有值時**：先讀 `spec.md` 的「設計方向」段落，**依定案方向拆 task**。
  **不得推翻已定案的方向**——方向是 user 看過三版真實視覺後選的，plan 階段改方向等於把那次選擇作廢。覺得方向有問題 → 回報，不要自己換。
  選了「跳過三方向」時該段落記的是**跳過的理由**，`direction_decided` 為空——照一般流程拆 task 即可。
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/write-plan/SKILL.md
git commit -m "feat: write-plan 依 spec 的定案設計方向拆 task"
```

---

## Task 8: `dev-workflow` — 路徑圖接上、state 補欄、觸發表加一列

**parallel-group**: 8
**files**: modify `skills/dev-workflow/SKILL.md`（`:78` 路徑圖、`:87` `:90` 兩個轉進點、`:152` state、`:238` 觸發表）

**這個檔是流程的目錄**——前七個 task 改的是各 skill 內部，這一個負責讓「從外面看」也對得上。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/dev-workflow/SKILL.md; ok=1
grep -qE "階段 B[0-9]? ?(啟用|接上|才接上)|目前未接|尚未接上" "$f" && { echo "MISS: 仍有待啟用字樣（實測原有 2 處）"; ok=0; }
for p in \
  "design-direction" "direction_decided" "user_choice_quote" \
  "execute-plan §前端檔處理" "verify-done §漏網複查" \
  "design_rejudge" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
grep -qE "^\| \`design-direction\` \|" "$f" || { echo "MISS: 觸發表缺 design-direction 一列"; ok=0; }
# state 兩個新欄用行首錨定
for k in direction_decided user_choice_quote; do
  grep -qE "^    ${k}: " "$f" || { echo "MISS: state 的 $k 未用行首欄位寫法"; ok=0; }
  grep -qF "$k" skills/brainstorm/SKILL.md || { echo "MISS: 欄名與 brainstorm 對不上（Task 3 應先完成）"; ok=0; }
done
# regression guard
grep -qF "禁止互推" "$f" || { echo "MISS(reg): 兩根尺規則被動到"; ok=0; }
grep -qF "0b′ UI 面判定" "$f" || { echo "MISS(reg): 0b′ 從流程圖消失"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL
# 「待啟用字樣」實測 2 處（:78 路徑圖、:238 觸發表）→ 拉紅
# 正向 6 條全 MISS ＋ 觸發表一列 ＋ 兩個行首欄位
# 註：v1 用 `中途轉進` / `漏網複查` 當正向 pattern，但這兩個詞當時只存在於 :238 那句
#     「以下待階段 B 啟用」的宣告裡（實測），改前就綠、分不出接上與否。
#     v2 改鎖接上後才會出現的完整措辭「execute-plan §前端檔處理」「verify-done §漏網複查」。
# regression guard 2 條現況已綠
```

- [ ] **Step 3: 寫內容**

**改動 1 — `:78` 路徑圖的兩行**：

```
   design.size=大改 ＋ 路徑選「出三版」→ branch 建立、spec 落檔後載 design-direction 出三版
                                          → user 選定 → 回寫 spec.md → write-plan 依方向拆 task
   design.size=大改 ＋ 路徑選「跳過三方向」→ 理由記入 spec.md → write-plan
   design.size=小改 → execute-plan 動前端檔的 task 前後載 design-language 跑對齊檢查
```

**改動 2 — `:87` `3. execute-plan` 底下補一行**：

```
   └─ 計畫外的前端檔 → execute-plan §前端檔處理：暫停 → 補判 → 回寫 state.design ＋ design_rejudge → 接回
```

**改動 3 — `:90` `4. verify-done` 底下補一行**：

```
   └─ 全 tier：實際改動檔含前端副檔名且未被 design_rejudge 處理過 → verify-done §漏網複查
```

**改動 4 — `:152` state 的 `design:` 區塊**：補 `direction_decided` / `user_choice_quote` 兩行（與 Task 3 的 brainstorm 交棒**逐字相同**，4 空格縮排）。並在 `state:` 底下補 `design_rejudge`（2 空格，結構與 `execute-plan` 相同）。

**改動 5 — `:238` 觸發表**。`design-language` 那列改成（**去掉「以下待階段 B 啟用」整句**）：

```markdown
| `design-language` | brainstorm 0b′（**必跑**，含純後端 task）／ `design.involved=true` 且 `size=小改` 時，execute-plan **動到前端檔的 task 前後**／ execute-plan §前端檔處理 的中途轉進補判／ verify-done §漏網複查 的補判／ user 顯式問設計語言 |
```

新增一列：

```markdown
| `design-direction` | brainstorm 0c/0d 合併確認第 3 題選「出三版」，且 **branch 已建立、`spec.md` 已落檔**／ user 顯式要求出方向、評審設計。**選「跳過三方向」不載入** |
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/dev-workflow/SKILL.md
git commit -m "feat: dev-workflow 接上設計 lane 與兩個轉進點"
```

---

## Task 9: 驗收 ＋ 同步 spec ＋ 全域生效

**parallel-group**: 9
**files**: create `docs/work/feat/design-lane/verify-stage-b2.md`；modify `docs/work/feat/design-lane/spec.md`

**先講清楚驗得到什麼、驗不到什麼**：

| 驗收項 | 本 task 做得到 | 做不到 |
|---|---|---|
| **V6** 中途轉進 | 桌上推演 ＋ **組合推演**（中途轉進之後跑 verify-done，確認不重複觸發） | 沒有真的在施工中觸發過 |
| **V7** 漏網複查 | **可機械驗**：造情境跑觸發判斷 | 補判與對齊檢查的實際執行 |
| **V5** 大改路徑端到端 | **做不到** | 需真的跑三方向：3 個 subagent ＋ 截圖 ＋ user 選定。**是一次獨立實跑** |

**桌上推演不等於實跑**——抓得到「規則互相矛盾」「轉進出去沒回歸點」「欄名對不上」這類**靜態**問題，抓不到「實際跑起來卡住」。驗收記錄要明寫，不要讓它看起來像 V5/V6 驗過了。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && ok=1
test -f docs/work/feat/design-lane/verify-stage-b2.md || { echo "MISS: 驗收記錄未落檔"; ok=0; }
# 全鏈欄名一致（行首錨定，避免子字串餵飽）
for k in direction_decided user_choice_quote; do
  n=$(grep -lF "$k" skills/brainstorm/SKILL.md skills/dev-workflow/SKILL.md skills/write-plan/SKILL.md skills/design-direction/SKILL.md 2>/dev/null | wc -l)
  [ "$n" = "4" ] || { echo "MISS: $k 應在 brainstorm/dev-workflow/write-plan/design-direction 四檔都有，實際 $n"; ok=0; }
done
# 「還沒接上」字樣全 repo 零殘留（regex 蓋住四種措辭）
grep -rqE "階段 B[0-9]? ?(啟用|接上|才接上)|目前未接|尚未接上|（階段 B）" skills/ \
  && { echo "MISS: skills/ 仍有待啟用字樣"; ok=0; }
# 裸 skills/ 比對零殘留
grep -rqE "grep -v '\^skills/'" skills/ && { echo "MISS: 出現裸 ^skills/ 比對"; ok=0; }
# spec 階段表：必須同時鎖住該列與「完成」狀態（v1 只鎖列名，現在就綠）
grep -qE "B2 · 流程接點.*\|[^|]*已完成[^|]*\|" docs/work/feat/design-lane/spec.md \
  || { echo "MISS: spec 階段表未把 B2 標為已完成"; ok=0; }
# 「完成後可用」欄不得再宣稱大改路徑可用（V5 未實跑）
grep -qF "大改路徑接通（V5 端到端未實跑）" docs/work/feat/design-lane/spec.md \
  || { echo "MISS: spec 仍宣稱大改路徑可用"; ok=0; }
# B1 回歸（相對斷言，不硬編總數）
[ "$(find skills/design-direction -type f | wc -l)" = "9" ] || { echo "MISS(reg): design-direction 不再是 9 檔"; ok=0; }
[ "$(grep -ro '⚠️' skills/ | wc -l)" = "0" ] || { echo "MISS(reg): skills/ 出現 ⚠️"; ok=0; }
grep -rqE "[这样图对动为过级须将产业们点发题应网络设计资产严]" skills/ && { echo "MISS(reg): skills/ 出現簡體字"; ok=0; }
diff -rq skills/ "$HOME/.claude/skills/" >/dev/null 2>&1 || { echo "MISS: 全域未同步（3g 的 setup.ps1 未跑或有落差）"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗** — Expected: FAIL（驗收記錄、四檔欄名、待啟用殘留、spec 兩條、全域未同步）

- [ ] **Step 3: 執行驗收**

**3a — 全鏈欄名一致性**：`design.*` 六欄 ＋ 兩個新欄，在 `design-language` / `design-direction` / `brainstorm` / `dev-workflow` / `write-plan` 五檔逐字比對。連 placeholder 措辭一起對（`<user 選擇原話>` 不要寫成 `<user 選擇的原話>`）。

**3b — 「還沒接上」殘留掃描**：用上面那條 regex 全 `skills/` 掃，零命中。

**3c — V7 機械驗**：造情境驗觸發判斷 ① 前端檔撈得出來 ② `skills/**` 底下的 `.jsx` 被排掉 ③ `dist/` 這類建置產物被排掉 ④ `state.commits` 不存在時走 `merge-base` fallback。

**3d — V6 桌上推演**：情境「後端 task 做到一半發現要改 `docs/css/styles.css`」，對著 `execute-plan` §前端檔處理 逐步走，記錄每一步落在哪一句、兩條分流各走到哪、回歸點是否明確。

**3e — 組合推演（v1 沒有這一格）**：**中途轉進觸發過之後跑 verify-done**，確認 §漏網複查 因 `design_rejudge` 已有該檔而**不重複觸發**；大改情境 user 選了「④ 之後再做」時，確認 verify-done 不會再問一次也不升 blocker。

**3f — 反向推演**：`design.involved=false` 的純後端 task 從頭走到尾，確認**沒有任何一步被新規則卡住**、**沒有多問 user 任何問題**。

**3g — 同步 spec**：階段表把 B2 狀態改成「✅ 已完成」；**「完成後可用」欄改成「大改路徑接通（V5 端到端未實跑）」**；補一列或加註**V5 實跑是 B2 之後、階段 C 之前的獨立一次**，對象照 `spec.md` 已指定的 bstack 自家 `docs/` 站。影響檔案表補 `write-plan` / `design-direction` / `design-language` 三列，並把 `brainstorm` 與 `dev-workflow` 的「階」欄改成 `A／B2`。

**3h — 全域生效**：commit 完**實跑 `pwsh -NoProfile -File scripts/setup.ps1 -Yes`**，`diff -rq` 確認 `~/.claude/skills/` 與 repo 一致。
> 依 CLAUDE.md §Auto-fix 屬危險類（覆寫全域），走 `AskUserQuestion` 取得同意再跑。
> **不跑的話 B2 做完了、全域用的還是舊版**，而你會以為已經生效。

**3i — 記進驗收的未決項**：`.sass` 仍**未納入** `design-language` §前端副檔名（`frontend-test:8` 是全 repo 唯一含它的一處）。本階段**不做決定**，維持 spec §待釐清 5 的未決狀態——不要讓它被實作順手決掉。

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add docs/work/feat/design-lane/verify-stage-b2.md docs/work/feat/design-lane/spec.md
git commit -m "docs: 加入階段 B2 驗收記錄並同步 spec"
```

---

## §並行性總表

| group | task | 檔案 |
|---|---|---|
| 1 | Task 1 | `brainstorm`（合併確認第 3 題） |
| 2 | Task 2 | `brainstorm`（三方向載入點） |
| 3 | Task 3 | `brainstorm`（spec 範本 ＋ state） |
| 4 | Task 4 | `design-direction`、`design-language`（收自述） |
| 5 | Task 5 | `execute-plan` |
| 6 | Task 6 | `verify-done` |
| 7 | Task 7 | `write-plan` |
| 8 | Task 8 | `dev-workflow` |
| 9 | Task 9 | 驗收記錄 ＋ `spec.md` ＋ 全域同步 |

**全序列，每 group 1 task** → `execute-plan` **不需載 `dispatch-parallel`**。

**依賴**：
- Task 1 → 2 → 3 同檔須分組且照此序（選單先收窄，載入點才引用得到「選了出三版」；spec 範本要引用載入點的產物）
- Task 4 依賴 Task 1（收窄後才知道 `design-direction` 的第 2 步要改成什麼）
- Task 7、8 的欄名一致性斷言會抓 Task 3 有沒有先完成
- Task 9 驗全鏈，必須最後；其中「待啟用字樣全 repo 零殘留」要 Task 4 ＋ Task 8 都完成才會綠

**回退路徑**：九個 task 全是既有檔的加法或改寫，`git revert` 得掉；但這些檔已由 B1 的 `setup.ps1` 同步到全域，**`~/.claude/` 那份要重跑 `setup.ps1` 才會回退**。
**回退窗口**：B2 一旦跑完 3h 同步到全域，下一個 task（階段 C）就跑在新規則上。**C 施工中若發現 B2 有問題，先 `git revert` ＋ 重跑 `setup.ps1` 回到 B1 狀態再處理**，不要在新舊規則混用的狀態下繼續。

---

## §Self-review

**1. spec coverage**

| spec 項 | 對應 | 狀態 |
|---|---|---|
| S4 中途轉進 | Task 5 | ✅ 規則就位；V6 只有桌上推演 ＋ 組合推演 |
| S5 三方向與豁免選單 | Task 1、2、4 | ✅ 豁免來自選單、可機械讀取；**選單收窄為兩條**（D32） |
| V7 漏網複查 | Task 6 | ✅ 觸發判斷可機械驗、全 tier |
| S8 大改路徑端到端 | —— | **本階段做不到**，V5 需獨立實跑（Task 9 表已列，3g 給它明確歸屬） |
| K6 接收端（B1 遺留） | Task 3、7、8 | ✅ 三個接收端補齊 |
| S7 孤兒偵測 | —— | 階段 C |

**2. placeholder 掃**：`<base>` 在 v1 是未定義的 placeholder，而 v1 §Self-review 宣稱「placeholder 掃：無」——**那句是錯的**。v2 的 Task 6 把它定義成「`state.commits` 第一個 commit 的 parent，取不到則 `merge-base origin/main HEAD`，再取不到則不觸發」。其餘 task 的 `<…>` 都是要寫進 skill 的 yaml 佔位符（例如 `<定案方向文字|null>`），屬**產出內容的一部分**，不是 plan 未填的洞。

**3. 型別一致**：`design.*` 六欄 ＋ 兩個新欄，在五個檔逐字相同，由 Task 7／8／9 的斷言把關。**`design_rejudge` 取代 v1 的 `pivots` ＋ `design_recheck`**——兩者本質是同一件事（施工開始後的重判），合併後新概念從 2 個降到 1 個，且 `verify-done` 得以靠它判斷「這批檔 `execute-plan` 已經處理過」。

**4. 並行性檢查**：全序列，依賴鏈見上。

**5. scope 檢查**：改 6 個 skill ＋ 1 個 workflow 檔 ＋ 2 份 docs。**多動 spec 沒列的 `write-plan` / `design-direction` / `design-language` 三個檔**，理由已在 §B2 的 scope 與 spec 的落差 逐條交代，Task 9 的 3g 會把 spec 補齊。

**6. 誠實聲明**：
- **V5 做不到**。三方向端到端要 3 個 subagent ＋ 截圖 ＋ user 選定，是一次獨立實跑。本 plan 只讓那條路徑「接得上」，沒有證明它「跑得動」。**已知地雷**：`verify-stage-b1.md` 記過 `npx playwright screenshot` 的引號問題（未加引號回 `Invalid viewport size format`），這類問題只在實跑時出現，而**卡住的時點是已經燒完 3 個 subagent 之後**。因此 3g 要求把 V5 實跑排在階段 C **之前**。
- **桌上推演的侷限**：抓得到靜態矛盾，抓不到執行期卡住。
- **「一主一變體」被砍掉**（D32）。原本它是三版與單版之間的折衷；現在大改只剩「燒三個 subagent」或「完全不做設計決策」兩極，中間地帶沒了。要補回來得先給 `design-direction` 一條非三版的執行路徑。
- **這一階最大的風險不在設計 lane**：改的是所有 task 的必經之路。失敗模式**全部是靜默的**——不拋例外、不 build fail、沒有一行 log，症狀是「幾週後某個專案的某個 task 行為跟預期差一點」，而且因為 `setup.ps1` 已同步到 `~/.claude/`，錯誤在**所有專案同時生效**。
- **v1 的教訓**：四個視角在 v1 找到 11 個 Critical，其中**沒有一條是 grep 抓得到的語意問題，但有四條是連字面層都沒守住**（pattern 對不上原文、backtick 未跳脫、鎖到待刪的舊規則、guard 鎖太短的子字串）。v2 開頭的 §驗證指令的寫作紀律 就是為此而立——**語意層的擔憂成立，但要先把字面層補齊**。
