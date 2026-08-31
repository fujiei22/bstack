# 設計 lane 階段 B2（流程接點）Implementation Plan · v1

> 對應 spec：`docs/work/feat/design-lane/spec.md`（階段序 A → C1 → B1 → **B2** → C）
> 前一階驗收：`docs/work/feat/design-lane/verify-stage-b1.md`
> Track: Dev | Tier: T3
> 建立: 2026-08-31
> group 數: 7 / 最大並行度: **1**（全序列）

**Goal**：把 B1 建好的 `design-direction` **接上 dev-workflow 九階段**，並補上兩個轉進點——`execute-plan` 中途轉進（S4／V6）與 `verify-done` 漏網複查（V7）。**本階段不新增 skill，只改既有流程檔。**

---

## §為什麼這一階比 B1 危險

B1 動的是**新建檔**（`git revert` 即完整回退）＋ 兩處既有 skill 的**加法**（只加排除、不改既有判定）。

B2 動的四個檔——`brainstorm` / `write-plan` / `execute-plan` / `verify-done` ＋ `dev-workflow`——是**每一個 task 的必經之路**。改壞了不是設計 lane 壞掉，是**所有 task 都壞掉**。

三條紀律：

1. **只加分支，不改既有主線**。既有的「`involved=false` → 繼續 0c」「T3 e2e 必跑」「每 task 完 commit」等規則一律不動，每個 task 的斷言都要有 **regression guard** 把它們釘住。
2. **每個新分支都要有明確的回歸點**。中途轉進最容易寫成「轉出去就回不來」——每處都要寫「處理完接回哪裡」。
3. **禁止讓新分支變成必經**。轉進點的觸發條件都要可機械判斷，且預設不觸發。

---

## §Architecture：接上之後，流程長什麼樣

```
brainstorm Phase 0
  0b′ 判 design.* 六欄
    ├─ involved=false ─────────────────────────► 0c（不變）
    └─ involved=true
         └─ 0c/0d 合併確認（第 3 題現在多問「設計路徑」）
              ├─ size=小改 ──────────────────► write-plan（不變）
              └─ size=大改 ＋ 路徑=出三版 ──► design-direction【B2 新接】
                                                 └─ 選定 → 回寫 spec.md
                                                      └─► write-plan（讀定案方向拆 task）
execute-plan
  └─ 施工中冒出前端需求 ──► 暫停 → 補判 → 處理 → 回寫 plan.md → 接回原 task【B2 新增】
verify-done
  └─ 實際改到前端檔但 design.involved=false ──► 漏網補判 + 對齊檢查【B2 新增】
```

**兩個轉進點的差別**（寫進 skill，避免混用）：

| | `execute-plan` 中途轉進 | `verify-done` 漏網複查 |
|---|---|---|
| 什麼時候發現 | **施工中**，還來得及改 | **施工後**，code 已經寫完 |
| 觸發條件 | task 實作時發現要動的前端檔不在 `codebase_impact.files` 裡 | 本輪實際改動檔含前端副檔名，但 `design.involved=false` |
| 做什麼 | 暫停 → 補判 → 依 `size` 走小改／大改 → **回寫 `plan.md`** → 接回 | 補判 → 只跑**小改路徑的四項對齊檢查** → 記進 verify 結果 |
| 為什麼不一樣 | 施工中還能改 plan，所以要回寫 | 施工後叫三方向重做等於推翻已寫的 code，**成本不成比例**；漏網只做對齊檢查，大改則升級為 blocker 交 user 決定 |

---

## §B2 的 scope 與 spec 的落差（先講）

spec §影響檔案 把 `brainstorm` 與 `dev-workflow` 兩列標為 **A**，但那兩列的內容裡各有一項**當時刻意 defer 到 B**：

- `brainstorm`：「0c/0d 的 `AskUserQuestion` 合併為一次問四項**＋設計路徑**」——設計路徑那半沒做（`brainstorm:134` 現在還有一句 blockquote 明寫「不在本階段問」）
- `dev-workflow`：Dev track 路徑圖的「設計 lane」目前是 `（**階段 B 啟用**，目前未接）`

**另外多動一個 spec 沒列的檔：`write-plan`。** 理由：`design-direction` §與 dev-workflow 銜接 明寫「下游：`write-plan`（依定案方向拆 task）」，而 `write-plan` 全檔對 `design` **零命中**（實測）。不補這一行，定案方向會停在 `spec.md` 裡沒人讀。改動量是**加一條讀取指示**，不動 plan 結構。

Task 7 會把 spec 的影響檔案表與階段表一起更新，讓文件與實際對得上。

---

## Task 1: `brainstorm` — 0b′ 大改轉進 ＋ 設計路徑併進第 3 題

**parallel-group**: 1
**files**: modify `skills/brainstorm/SKILL.md`（`:75-76` 0b′ 步驟、`:126-134` 合併確認第 3 題）

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/brainstorm/SKILL.md; ok=1
for p in "size=大改" "載入 \`design-direction\`" "設計路徑" "三版（預設）" "一主一變體" "選定後回寫" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 那句「不在本階段問」的 blockquote 必須消失
grep -qF "設計路徑（三版／單版／一主一變體）不在本階段問" "$f" && { echo "MISS: 舊 blockquote 未移除，會與新規則直接矛盾"; ok=0; }
# regression guard：既有主線三條不得被動到
grep -qF "**\`involved=false\` → 到此為止**，繼續 0c。" "$f" || { echo "MISS(regression): involved=false 主線被改動"; ok=0; }
grep -qF "**必跑**——包含看起來純後端的 task" "$f" || { echo "MISS(regression): 0b′ 必跑規則被改動"; ok=0; }
grep -qF "**禁止用 Tier 推導 \`size\`**" "$f" || { echo "MISS(regression): 兩根尺規則被改動"; ok=0; }
# 選單題數表必須同步（involved=true 仍是 3 題，設計路徑併進第 3 題、不另開第 4 題）
grep -qF "3 題：Track、Tier、UI 判定" "$f" || { echo "MISS: 題數表應維持 3 題"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL
# 正向 6 條全 MISS ＋「舊 blockquote 未移除」1 條
# regression guard 4 條現況存在 → 本輪應保持綠，用來確保只加分支不改主線
```

- [ ] **Step 3: 寫內容**

**改動 1 — `:75-76` 0b′ 的步驟 3/4 後追加一步**（原兩步不動）：

```markdown
5. **`size=大改` 且合併確認的設計路徑選了「出三版」** → **載入 `design-direction`**，走三方向流程；**選定後回寫 `spec.md` 的「設計方向」段落**，再進 `write-plan`。
   路徑選「單版」或「一主一變體」→ 同樣載入 `design-direction`，由它依選項調整產出版數，不跳過設計決策。
   > **不在這裡自行決定路徑**：路徑一律來自合併確認的選單選項（CLAUDE.md §決策點選單「**禁文字 token NLP**」）。
```

**改動 2 — `:126-134` 第 3 題加設計路徑，並刪掉 `:134` 的 blockquote**：

第 3 題選項改為（`size=大改` 時才出現設計路徑那三個子選項）：

```markdown
1. `<區塊名>` ＋ `<小改/大改>`，正確（推薦）
   - `size=大改` 時，本選項要接著問**設計路徑**：**三版（預設）** / 單版 / 一主一變體
2. 區塊判錯，我來指認
3. `size` 判錯
```

`:134` 的 blockquote 整句刪除，換成：

```markdown
> **`size=大改` 才問設計路徑**。小改沒有新視覺決策，問了是雜訊。三版是預設值——選單把它標為預設，不是因為「推薦」，是因為 §核心哲學 3「給 variations，不給最終答案」；單版與一主一變體是**豁免**，豁免只能來自這個選單。
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/brainstorm/SKILL.md
git commit -m "feat: brainstorm 0b′ 判大改後轉進 design-direction，設計路徑併進合併確認"
```

---

## Task 2: `brainstorm` — spec 範本與交棒 state 補三個輸出欄

**parallel-group**: 2
**files**: modify `skills/brainstorm/SKILL.md`（`:168-173` spec 範本「設計方向」、`:227` 交棒 state）

**這是 B1 §Self-review 誠實聲明裡「K6 的接收端推到 B2」那一條。** `design-direction` 定義了 `direction_decided` / `user_choice_quote` 兩個輸出欄，`brand-asset-protocol` §Step 5 另外要求把**資產清單**寫進同一個段落——三者現在都**沒有對應欄位可寫**。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/brainstorm/SKILL.md; ok=1
for p in "direction_decided" "user_choice_quote" "資產清單" "`size=大改` 走過三方向時才填" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 兩個欄位在 spec 範本與交棒 state 各出現一次 → 全檔各 2 次
[ "$(grep -cF 'direction_decided' "$f")" = "2" ] || { echo "MISS: direction_decided 應在 spec 範本與 state 各一處，實際 $(grep -cF 'direction_decided' "$f")"; ok=0; }
[ "$(grep -cF 'user_choice_quote' "$f")" = "2" ] || { echo "MISS: user_choice_quote 應各一處，實際 $(grep -cF 'user_choice_quote' "$f")"; ok=0; }
# 欄名必須與 design-direction §對外契約 逐字一致
grep -qF "direction_decided" skills/design-direction/SKILL.md || { echo "MISS: 欄名與 design-direction 對不上"; ok=0; }
grep -qF "user_choice_quote" skills/design-direction/SKILL.md || { echo "MISS: 欄名與 design-direction 對不上"; ok=0; }
# regression guard：既有六欄不得減少
for k in involved scope scope_evidence size precedent map_status; do
  grep -qF "$k" "$f" || { echo "MISS(regression): design 六欄少了 $k"; ok=0; }
done
# 截圖不得成為追溯依據（D14）
grep -qF "不以截圖路徑作為事後追溯依據" "$f" || { echo "MISS: 缺 D14 的截圖不留存聲明"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，正向 4 條 + 兩個計數條 MISS
# regression guard（六欄、design-direction 欄名）現況已綠
```

- [ ] **Step 3: 寫內容**

**改動 1 — spec 範本「設計方向」段落**（`:173` 之後追加）：

```markdown
- **以下三項 `size=大改` 走過三方向時才填**（小改留空並註明「小改，未走三方向」）：
  - `direction_decided`：<定案方向的文字描述>
  - `user_choice_quote`：<user 選擇的原話>
  - 資產清單：<若設計裡出現具名第三方品牌，依 `design-direction` `references/brand-asset-protocol.md` §Step 5 把資產與**來源網址**列在這裡>
  > 三方向的 HTML 與截圖落在 `docs/work/<branch-name>/design-demos/`（不進版控、驗完即刪），**不以截圖路徑作為事後追溯依據**——能留下的只有上面這三項文字。
```

**改動 2 — 交棒 state 的 `design:` 區塊**（`:227` `map_status` 之後追加兩行，維持同一縮排層級）：

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

## Task 3: `execute-plan` — 中途轉進（S4 / V6）

**parallel-group**: 3
**files**: modify `skills/execute-plan/SKILL.md`（§Task 推進規則 之後新增 §中途轉進；§hand-off state 補欄）

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/execute-plan/SKILL.md; ok=1
for p in "§中途轉進" "不在 \`codebase_impact.files\`" "暫停" "補判" "回寫 \`plan.md\`" "接回原 task" "pivots" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 大改必須升級成 user gate，不得自行往下做
grep -qF "AskUserQuestion" "$f" || { echo "MISS: 大改轉進須走選單"; ok=0; }
# regression guard：既有主線不得被動到
grep -qF "跳 task / 重排序" "$f" || { echo "MISS(regression): 禁跳 task 規則被改動"; ok=0; }
grep -qF "多 task 累一個大 commit" "$f" || { echo "MISS(regression): 每 task 一 commit 規則被改動"; ok=0; }
grep -qF "**禁猜**：don't guess your way through。" "$f" || { echo "MISS(regression): Blocker 禁猜規則被改動"; ok=0; }
# 轉進不得寫成「blocker 就停」——必須有明確回歸點
grep -qF "接回原 task 的第" "$f" || { echo "MISS: 缺明確回歸點（接回哪一步）"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，正向 7 條 + 回歸點 1 條 MISS
# 「AskUserQuestion」與三條 regression guard 現況已綠
```

- [ ] **Step 3: 寫內容**

在 §Task 推進規則 之後插入新章節：

````markdown
## §中途轉進（施工中冒出前端需求）

**觸發條件（可機械判斷，預設不觸發）**：正在做的 task 實作時，發現**要動的前端檔不在 `codebase_impact.files` 裡**——也就是 Phase 0 沒看到它。

判斷用 `design-language` §前端副檔名 那份清單，並套同一條排除（`skills/**` 底下的工具範本不算）。

**動作（五步，不許只做前兩步就繼續寫 code）**：

1. **暫停當前 task**，`TaskUpdate` 維持 `in_progress`，**不 commit 半成品**。
2. **補判**：載入 `design-language`，把新冒出的檔交給它，取回 `design.*` 六欄。
3. **依 `size` 分流**：
   - **小改** → 直接跑 §對齊檢查清單 四項，通過就繼續寫 code
   - **大改** → **升級為 user gate**，走 `AskUserQuestion`：① 現在轉進三方向（`design-direction`）② 縮回小改範圍、只做沿用既有 token 的版本 ③ 把它切成獨立 task 之後再做 ④ 暫停整個 plan 重新 brainstorm
     > **不得自行選定後繼續**。大改代表有新的視覺決策要做，那是 user 的決定不是實作細節。
4. **回寫 `plan.md`**：把實際跑過的樣子寫回去——在該 task 底下追加一段 `轉進紀錄`（觸發的檔、補判的六欄、走了哪條分流、user 選了什麼）。**plan 要長成實際跑過的樣子，不是原本規劃的樣子**，否則下一個接手的人會照著一份沒發生過的 plan 做事。
5. **接回原 task 的第 3 步**（tdd-cycle 紅綠循環），繼續原本的實作。

**state 補欄**（`§hand-off state` 的 `state:` 底下）：

```yaml
  pivots:                       # 中途轉進紀錄；沒轉進過就是空 list
    - task_id: <轉進發生在哪個 task>
      trigger_files: [...]      # 觸發的前端檔
      design: {...}             # 補判回來的六欄
      branch: <小改|大改>
      user_choice: <大改時 user 選的選項|null>
```

**禁止**：
- 發現前端檔卻只在心裡記一下就繼續寫（**這正是 S4 要防的**）
- 把中途轉進當 §Blocker 處理然後停在那裡——轉進**有明確回歸點**，是繞路不是撞牆
- 為了不轉進而把前端改動拆到別的 branch 偷做
````

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/execute-plan/SKILL.md
git commit -m "feat: execute-plan 加入中途轉進——施工中冒出前端需求的暫停補判回歸路徑"
```

---

## Task 4: `verify-done` — 漏網複查（V7）

**parallel-group**: 4
**files**: modify `skills/verify-done/SKILL.md`（§UI / browser e2e 之後新增 §漏網複查；§hand-off state 補欄）

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/verify-done/SKILL.md; ok=1
for p in "§漏網複查" "design.involved=false" "實際改動檔" "四項對齊檢查" "design_recheck" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 漏網時大改必須是 blocker，不得自行補做三方向
grep -qF "不在 verify-done 補做三方向" "$f" || { echo "MISS: 缺「不補做三方向」的界線"; ok=0; }
# 排除必須沿用同一條判準（B1 Task 2 已寫入）
[ "$(grep -cF 'skill 定義目錄' "$f")" -ge 2 ] || { echo "MISS(regression): B1 的排除句被動到"; ok=0; }
# regression guard：T3 e2e 必跑不得鬆綁
grep -qF "**必跑**（fail 不能放行 verify-done）" "$f" || { echo "MISS(regression): T3 必跑規則被改動"; ok=0; }
grep -qF "全綠 → 交棒 request-review" "$f" || { echo "MISS(regression): 交棒條件被改動"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，正向 5 條 + 「不補做三方向」1 條 MISS
# 三條 regression guard（排除句 2 處、T3 必跑、交棒條件）現況已綠
```

- [ ] **Step 3: 寫內容**

在 §UI / browser e2e 之後插入：

````markdown
## §漏網複查

**要防的事**：Phase 0b′ 判 `design.involved=false`，但這一輪**實際改到了前端檔**——判定漏了，而且沒有任何 gate 會發現。

**觸發條件（機械判斷）**：

```bash
git diff --name-only <base>..HEAD | grep -E '\.(css|scss|tsx|jsx|vue|svelte|html)$' | grep -v '^skills/'
```

有輸出且 `state.design.involved` 為 `false` → 觸發。（排除 `skills/**` 的理由與 §UI / browser e2e 的例外相同。）

**動作**：

1. 載入 `design-language`，把這批檔交給它補判，取回 `design.*` 六欄，寫進 `state.design_recheck`。
2. **只跑小改路徑的四項對齊檢查**（元件狀態 / 斷點 / 表單 / dark mode），結果記進 verify 結果。
3. **補判結果是大改 → 標為 blocker，交 user 決定**，走 §verify 失敗處置 的選單（退回 execute-plan 補做 / 退回 brainstorm 重判 / 接受現況並記入技術債）。

**界線（硬規則）**：**不在 verify-done 補做三方向。** 這時 code 已經寫完，叫三方向重來等於推翻已經寫好的實作——成本與收益不成比例。verify-done 的職責是**把漏網這件事變成看得見的**，不是把它就地補完。

**state 補欄**：

```yaml
  design_recheck:               # 沒觸發就是 null
    triggered: <bool>
    files: [...]                # 觸發的前端檔
    design: {...}               # 補判回來的六欄
    alignment_checked: <bool>   # 四項對齊檢查有沒有跑
    blocker: <bool>             # 補判為大改時 true
```
````

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/verify-done/SKILL.md
git commit -m "feat: verify-done 加入漏網複查——判定漏了前端改動時補判並跑對齊檢查"
```

---

## Task 5: `write-plan` — 讀定案方向拆 task

**parallel-group**: 5
**files**: modify `skills/write-plan/SKILL.md`（§使用契約 加一條讀取指示）

**spec 沒列這個檔**（理由見 §B2 的 scope 與 spec 的落差）。`design-direction` §與 dev-workflow 銜接 明寫下游是 `write-plan`，而 `write-plan` 全檔對 `design` **零命中**（實測）——定案方向會停在 `spec.md` 沒人讀。改動量：**一條讀取指示，不動 plan 結構**。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/write-plan/SKILL.md; ok=1
for p in "direction_decided" "設計方向" "不得推翻已定案的方向" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 欄名與上游逐字一致
grep -qF "direction_decided" skills/brainstorm/SKILL.md || { echo "MISS: 欄名與 brainstorm 對不上（Task 2 應先完成）"; ok=0; }
# regression guard：既有契約不得被動到
grep -qF "parallel-group" "$f" || { echo "MISS(regression): 並行性分析被改動"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，正向 3 條 MISS
# 依賴：Task 2 必須先完成（欄名一致性那條會抓）
```

- [ ] **Step 3: 寫內容**

§使用契約 加一條：

```markdown
- **`design.size=大改` 且 `direction_decided` 有值時**：先讀 `spec.md` 的「設計方向」段落，**依定案方向拆 task**（哪些區塊要改、改成什麼樣子照那份描述走）。
  **不得推翻已定案的方向**——方向是 user 看過三版真實視覺後選的，plan 階段改方向等於把那次選擇作廢。覺得方向有問題 → 回報，不要自己換。
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/write-plan/SKILL.md
git commit -m "feat: write-plan 依 spec 的定案設計方向拆 task"
```

---

## Task 6: `dev-workflow` — 路徑圖接上、state 補欄、觸發表加一列

**parallel-group**: 6
**files**: modify `skills/dev-workflow/SKILL.md`（`:78` 路徑圖、`:152` state、`:238` 觸發表）

**這個檔是流程的目錄**——前五個 task 改的是各 skill 內部，這一個負責讓「從外面看」也對得上。三處若沒同步，會出現「skill 做得到但 dev-workflow 說做不到」的矛盾。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/dev-workflow/SKILL.md; ok=1
# 三處「待階段 B 啟用」字樣必須全部消失
grep -qF "階段 B 啟用" "$f" && { echo "MISS: 仍有「階段 B 啟用」字樣（實測原有 2 處）"; ok=0; }
for p in "design-direction" "direction_decided" "user_choice_quote" "中途轉進" "漏網複查" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 觸發表必須有 design-direction 獨立一列
grep -qE "^\| \`design-direction\` \|" "$f" || { echo "MISS: 觸發表缺 design-direction 一列"; ok=0; }
# state 的兩個新欄與 brainstorm 逐字一致
for k in direction_decided user_choice_quote; do
  grep -qF "$k" skills/brainstorm/SKILL.md || { echo "MISS: 欄名與 brainstorm 對不上（Task 2 應先完成）"; ok=0; }
done
# regression guard：兩根尺與 0b′ 必跑不得被動到
grep -qF "禁止互推" "$f" || { echo "MISS(regression): 兩根尺規則被改動"; ok=0; }
grep -qF "0b′ UI 面判定" "$f" || { echo "MISS(regression): 0b′ 從流程圖消失"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL
# 「階段 B 啟用」實測 2 處（:78 路徑圖、:238 觸發表）→ 拉紅
# design-direction / 兩個新欄 / 中途轉進 / 漏網複查 全 MISS
# regression guard 2 條現況已綠
```

- [ ] **Step 3: 寫內容**

**改動 1 — `:78` 路徑圖**：

```
   design.size=大改 → 載 design-direction 出三版 → user 選定 → 回寫 spec.md → write-plan 依方向拆 task
   design.size=小改 → execute-plan 動前端檔的 task 前後載 design-language 跑對齊檢查
```

並在 `4. verify-done` 底下補一行 `└─ 漏網複查：實際改到前端檔但 design.involved=false → 補判 + 對齊檢查`，
在 `3. execute-plan` 底下補一行 `└─ 中途轉進：冒出計畫外的前端檔 → 暫停 → 補判 → 回寫 plan.md → 接回`。

**改動 2 — `:152` state 的 `design:` 區塊**：補 `direction_decided` / `user_choice_quote` 兩行（與 Task 2 的 brainstorm 交棒逐字相同）。

**改動 3 — `:238` 觸發表**：`design-language` 那列末尾的「以下待**階段 B 啟用**：execute-plan 中途轉進、verify-done 漏網複查」改成正式觸發條件；新增一列：

```markdown
| `design-direction` | `design.involved=true` 且 `size=大改`，brainstorm 0c/0d 合併確認的設計路徑選了三版／單版／一主一變體任一 ／ user 顯式要求出方向、評審設計 |
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add skills/dev-workflow/SKILL.md
git commit -m "feat: dev-workflow 接上設計 lane 與兩個轉進點"
```

---

## Task 7: 桌上推演驗收 ＋ 同步 spec

**parallel-group**: 7
**files**: create `docs/work/feat/design-lane/verify-stage-b2.md`；modify `docs/work/feat/design-lane/spec.md`

**先講清楚這個 task 驗得到什麼、驗不到什麼**：

| 驗收項 | 本 task 能做到 | 做不到的部分 |
|---|---|---|
| **V6** 中途轉進 | 桌上推演：拿一個假想情境對著寫好的規則走一遍，記錄每一步落在哪一句 | 沒有真的在施工中觸發過 |
| **V7** 漏網複查 | **可機械驗**：真的建一個 `design.involved=false` 但改到 `.css` 的情境，跑觸發條件那行 `git diff \| grep`，確認它會有輸出 | 補判與對齊檢查的實際執行 |
| **V5** 大改路徑端到端 | **做不到** | 需要真的跑三方向：3 個 subagent ＋ 截圖 ＋ user 選定。**這是一次獨立的實跑，不是 plan 的一部分** |

**桌上推演不等於實跑**——它抓得到「規則互相矛盾」「轉進出去沒有回歸點」「欄名對不上」這類**靜態**問題，抓不到「實際跑起來卡住」。這一點要寫進驗收記錄，不要讓它看起來像 V5/V6 已經驗過。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && ok=1
test -f docs/work/feat/design-lane/verify-stage-b2.md || { echo "MISS: 驗收記錄未落檔"; ok=0; }
# 全鏈欄名一致：三個檔都要有這兩個欄名
for k in direction_decided user_choice_quote; do
  n=$(grep -lF "$k" skills/brainstorm/SKILL.md skills/dev-workflow/SKILL.md skills/write-plan/SKILL.md 2>/dev/null | wc -l)
  [ "$n" = "3" ] || { echo "MISS: $k 應在 brainstorm/dev-workflow/write-plan 三檔都有，實際 $n 檔"; ok=0; }
done
# 「待階段 B 啟用」全 repo 零殘留
grep -rqF "階段 B 啟用" skills/ && { echo "MISS: skills/ 仍有「階段 B 啟用」"; ok=0; }
# B1 的成果不得被本階段打壞
[ "$(ls -d skills/*/ | wc -l)" = "27" ] || { echo "MISS(regression): skill 數不再是 27"; ok=0; }
[ "$(grep -ro '⚠️' skills/ | wc -l)" = "0" ] || { echo "MISS(regression): skills/ 出現 ⚠️"; ok=0; }
grep -rqE "[这样图对动为过级须将产业们点发题应网络设计资产严]" skills/ && { echo "MISS(regression): skills/ 出現簡體字"; ok=0; }
# spec 階段表必須把 B2 標為完成
grep -qF "B2 · 流程接點" docs/work/feat/design-lane/spec.md || { echo "MISS: spec 階段表對不上"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗** — Expected: FAIL（驗收記錄未落檔 ＋ 欄名三檔一致 ＋ 「階段 B 啟用」殘留）

- [ ] **Step 3: 執行驗收**

**3a — 全鏈欄名一致性**：`design.*` 六欄 ＋ `direction_decided` / `user_choice_quote` 兩欄，在 `design-language` / `design-direction` / `brainstorm` / `dev-workflow` / `write-plan` 五個檔逐字比對。

**3b — 「待啟用」殘留掃描**：全 `skills/` 掃 `階段 B 啟用` / `目前未接` / `尚未接上`，逐筆確認該講的是不是都已改成正式規則（`design-direction` 自己的 `description` 與 §與 dev-workflow 銜接 也要一起改，否則 skill 會自述「我還沒接上」）。

**3c — V7 機械驗**：真的造一個情境驗觸發條件那行指令會有輸出——在 scratchpad 建一個含 `.css` 的假 diff 情境，跑 `git diff --name-only | grep -E ... | grep -v '^skills/'`，確認 ① 前端檔會被撈出來 ② `skills/**` 底下的 `.jsx` 不會。

**3d — V6 桌上推演**：情境「後端 task 做到一半，發現要改 `docs/css/styles.css`」，對著 `execute-plan` §中途轉進 逐步走，記錄每一步落在哪一句、`size` 兩條分流各走到哪、回歸點是不是明確。

**3e — 反向推演（最容易漏的）**：`design.involved=false` 的純後端 task 從頭走到尾，確認**沒有任何一步被新規則卡住**。新分支若讓純後端 task 多付成本，就是接錯了。

**3f — B1 回歸**：27 skill / 2 hook / 6 agent、`⚠️` 與簡體零命中、`design-direction` 9 檔完整。

**3g — 同步 spec**：階段表把 B2 標為完成；影響檔案表補 `write-plan` 一列、把 `brainstorm` 與 `dev-workflow` 兩列的「階」欄從 `A` 改成 `A／B2` 並註明哪半是 B2 做的。

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
| 1 | Task 1 | `skills/brainstorm/SKILL.md`（0b′ ＋ 合併確認） |
| 2 | Task 2 | 同上（spec 範本 ＋ state） |
| 3 | Task 3 | `skills/execute-plan/SKILL.md` |
| 4 | Task 4 | `skills/verify-done/SKILL.md` |
| 5 | Task 5 | `skills/write-plan/SKILL.md` |
| 6 | Task 6 | `skills/dev-workflow/SKILL.md` |
| 7 | Task 7 | 驗收記錄 ＋ `spec.md` |

**全序列，每 group 1 task** → `execute-plan` **不需載 `dispatch-parallel`**。

**依賴**：Task 1、2 同檔須分組且 1 在前（0b′ 的轉進要先存在，spec 範本才有東西可寫）→ Task 5、6 的欄名一致性斷言會抓 Task 2 有沒有先完成 → Task 7 驗全鏈，必須最後。

**回退路徑**：六個 task 全是既有檔的**加法**，`git revert` 得掉；但這些檔已由 B1 的 `setup.ps1` 同步到全域，**`~/.claude/` 那份要重跑 `setup.ps1` 才會回退**。中間態不影響任何 session——repo 內的 skill 沒跑 setup 不會被載入。

---

## §Self-review

**1. spec coverage**

| spec 項 | 對應 | 狀態 |
|---|---|---|
| S4 中途轉進 | Task 3 | ✅ 規則就位；V6 只有桌上推演 |
| S5 三方向與豁免選單（**接上流程**） | Task 1 | ✅ 豁免來自選單，不靠文字偵測 |
| V7 漏網複查 | Task 4 | ✅ 觸發條件可機械驗 |
| S8 大改路徑端到端 | —— | ⚠️ **本階段做不到**，需獨立實跑（見 Task 7 表） |
| K6 接收端（B1 遺留） | Task 2、5、6 | ✅ 三個接收端補齊 |
| S7 孤兒偵測 | —— | 階段 C |

**2. placeholder 掃**：無。六個編輯 task 都給了逐處的錨點行號與要寫的原文。

**3. 型別一致**：`design.*` 六欄 ＋ 兩個新欄，在五個檔逐字相同，由 Task 5／6／7 的斷言把關。**`pivots` 與 `design_recheck` 是本階段新增的 state 欄**，只出現在各自的 skill，未進 `dev-workflow` 的總 state——**這是刻意的**：它們是執行期產物，不是 Phase 0 的交棒欄位。

**4. 並行性檢查**：全序列，理由見依賴段。

**5. scope 檢查**：改 5 個 skill ＋ 1 個 workflow 檔 ＋ 2 份 docs。**多動了 spec 沒列的 `write-plan`**，理由與改動量已在 §B2 的 scope 與 spec 的落差 交代。**未動 `design-language` / `design-direction` 本體**——只有 Task 7 的 3b 會改 `design-direction` 的 `description` 與銜接段（把「目前未接」改掉），那是自述狀態，不是行為。

**6. 誠實聲明**：
- **V5 做不到**。三方向端到端要 3 個 subagent ＋ 截圖 ＋ user 選定，是一次獨立實跑。本 plan 只讓那條路徑「接得上」，沒有證明它「跑得動」。
- **桌上推演的侷限**：抓得到靜態矛盾，抓不到執行期卡住。Task 7 的記錄要明寫，不要讓它看起來像 V5/V6 驗過了。
- **這一階最大的風險不在設計 lane**：改的是所有 task 的必經之路。每個 task 都放了 regression guard 釘既有主線，但 guard 只擋「字串被刪掉」，擋不掉「語意被改壞」——這是 review-plan 四視角要看的重點。
