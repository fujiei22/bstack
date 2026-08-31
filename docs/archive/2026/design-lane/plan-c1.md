# 設計 lane 階段 C1（全域守則）Implementation Plan · v2

> 對應 spec: `docs/work/feat/design-lane/spec.md`（階段序 **A → B → C**，D26 已改回三階）
> 前一版 plan: v1「最小 gate hook」，**經 Eng review 後由 D26 廢除**（記錄見 `review-c1.md`）
> Track: Dev | Tier: T2
> 建立: 2026-08-28（v2 重寫）
> 並行最大 group: 3（**全序列**）

**Goal**：把 spec 的 **S2** 從「靠 skill 文字」升到「靠**每個 session 必載**的 `CLAUDE.md` 強制守則」，並清掉 v1 遺留的 `.design-gate` 死重。

**為什麼 v1 被廢**（摘要，完整五條實據見 D26 與 `review-c1.md`）：
1. 既有兩支 hook 防的是**不可逆傷害**（main 寫入、密鑰外洩）；design-gate 防的是**可逆的品質問題**，類別不同
2. 本系統每一道 gate 都靠 CLAUDE.md 文字而非 hook（§事實核實、§決策點選單、Tier、§Docs 落檔、§Fail handling 全是）
3. **實測**：無任何 hook 攔 `Bash`，而 auto mode 指示優先用 sed / heredoc 改檔 → hook 幾乎不會被觸發
4. 會誤傷這台機器上所有其他前端專案（reviewer 沙盒 repo 實測 exit 2）
5. 錯誤訊息在教模型怎麼繞（`New-Item` 一行解鎖，成本遠低於跑 0b′）

**Architecture**：
- 條文加在 `CLAUDE.md` **強制守則**區塊，位置在 §DB 操作 之後、§Docs 落檔 之前——與 §DB 操作 同性質（領域專屬的操作規範）。
- **`.design-gate` 全面移除**：它在 skill 裡的定義就是「hook 的唯一輸入」，沒有 hook 就沒有讀者；它記的六個欄位 T1+ 已在 `spec.md` 的「設計方向」段落裡。
- **不做任何 hook、不動 `settings.json`。**

**符號慣例（實測）**：`CLAUDE.md` 全檔 `🔴` 0 次、`⚠️` 0 次，只用 `**粗體**`。新條文必須照此，不得引入新符號。

**Tech Stack**：Markdown。無新依賴、無程式碼。

**Risks**：
- **改的是全域必載檔**。`CLAUDE.md` 每個 session 都會整份載入，加的每一行都是固定成本 → 條文要短。
- `setup.ps1` 會把 repo 的 `CLAUDE.md` **直接覆蓋**到 `~/.claude/CLAUDE.md`（不備份）。改壞影響所有專案的所有 session。緩解：Task 3 同步後立刻比對。
- **S2 從此沒有機械保障**，這是 D26 明知並接受的取捨，spec 已照實改寫，不假裝有。

---

## Task 1: `CLAUDE.md` 新增 §設計語言對齊

**parallel-group**: 1
**files**:
- modify: `CLAUDE.md`（強制守則區塊，§DB 操作 之後、§Docs 落檔 之前）

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=CLAUDE.md; ok=1
for p in \
  "### §設計語言對齊" \
  "design-language" \
  "禁止用 Tier 推導" \
  "抽不到就說抽不到" \
  "0b′" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 位置：必須落在 §DB 操作 之後、§Docs 落檔 之前
awk '/^### §DB 操作/{a=NR} /^### §設計語言對齊/{b=NR} /^### §Docs 落檔/{c=NR} END{exit !(a&&b&&c&&a<b&&b<c)}' "$f" || { echo "MISS: §設計語言對齊 必須在 §DB 操作 與 §Docs 落檔 之間"; ok=0; }
# 符號慣例：不得引入 CLAUDE.md 從未使用的符號
[ "$(grep -c '🔴' "$f")" = "0" ] || { echo "MISS: CLAUDE.md 不得出現 🔴（全檔慣例為零）"; ok=0; }
[ "$(grep -c '⚠️' "$f")" = "0" ] || { echo "MISS: CLAUDE.md 不得出現 ⚠️（全檔慣例為零）"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL
# 本次拉紅：5 條正向 + 1 條順序檢查（§設計語言對齊 尚不存在）
# regression guard：兩條符號檢查（現況本來就是 0，用來確保新條文沒破壞慣例）
```

- [ ] **Step 3: 寫內容**

在 `CLAUDE.md` 的 `### §DB 操作` 區塊結束後、`### §Docs 落檔` 之前插入：

```markdown
### §設計語言對齊
動任何**前端檔**（`.css` `.scss` `.tsx` `.jsx` `.vue` `.svelte` `.html`）之前，**先讀該區塊的既有設計語言**——載 `design-language`，從實際檔案抄 exact values，不憑印象重畫。

- **判定** brainstorm Phase 0b′ 產出 `design.{involved, scope, scope_evidence, size, precedent, map_status}`，與 Track / Tier 合併一個 `AskUserQuestion` 一次確認。**0b′ 必跑**（含純後端 task；第一步是零成本的副檔名比對，不命中就結束）
- **小改**（沿用既有 token、無新視覺決策）→ 直接改 code，改完跑**四項對齊檢查**（元件狀態 / 斷點 / 表單 / dark mode；該區客觀上無此維度 → 標 N/A 並附依據）
- **大改**（新頁 / 新區塊 / 改版）→ 先出三方向真實視覺讓 user 選，選定才落 code
- **禁止用 Tier 推導 `design.size`** 兩根尺各自判：Tier 量 code 改動量體，`size` 量新視覺決策的量體，兩者系統性錯開
- **禁止拿別區的 token 值頂替** 抽不到就說抽不到——頂替就是「把前台樣式套到後台」的起點

細則 → `design-language`（區塊偵測 / 抽取 / 對齊清單）。
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1 指令，Expected: PASS

- [ ] **Step 5: commit**

```bash
git add CLAUDE.md
git commit -m "feat: CLAUDE.md 加入 §設計語言對齊 強制守則

取代原規劃的 design-gate hook（D26 廢除）。理由：既有兩支 hook 防的是
不可逆傷害，本項是可逆的品質問題；且本系統每一道 gate 都靠 CLAUDE.md
文字而非 hook。"
```

---

## Task 2: 移除 `.design-gate` 的所有遺留

**parallel-group**: 2
**files**:
- modify: `skills/design-language/SKILL.md`（`:38` 落檔時機）
- modify: `skills/brainstorm/SKILL.md`（`:78` 與 `:192` 兩處）
- modify: `.gitignore`（移除 `**/.design-gate` 與其註解行）

**這個 task 同時修掉 Eng review 的 C3**——那三處「與寫 `spec.md` 同一步」的不一致，隨 `.design-gate` 一起消失。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && ok=1
# 全 repo（排除 vendor 與 docs/work 的歷史紀錄）不得再有 .design-gate
n=$(grep -rl "design-gate" --include=*.md --include=*.ps1 --include=*.json --include=.gitignore . 2>/dev/null \
     | grep -v "^./huashu-design\|^./everything-claude-code\|^./gstack\|^./superpowers\|^./docs/work/" | wc -l)
[ "$n" = "0" ] || { echo "MISS: 仍有 $n 個檔提到 design-gate"; ok=0; }
# 三處「同一步」規則應已消失（Eng review C3）
[ "$(grep -rc "同一步" skills/ 2>/dev/null | grep -v ':0$' | wc -l)" = "0" ] || { echo "MISS: skills/ 仍有「同一步」落檔規則"; ok=0; }
# design-demos 那行必須留著
grep -qF "**/design-demos/" .gitignore || { echo "MISS: .gitignore 的 design-demos 不該被誤刪"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL
# 本次拉紅：3 個檔仍提到 design-gate（.gitignore / brainstorm / design-language）
#           + skills/ 仍有 3 處「同一步」
# regression guard：design-demos 那行（現況就在，確保 Task 2 沒誤刪）
```

- [ ] **Step 3: 寫內容**

**改動 1 — `skills/design-language/SKILL.md:38`**，把落檔時機那段改成：

```markdown
**落檔時機（硬規則）**：本 skill **不在 brainstorm Phase 0 當下寫任何檔**。Phase 0 執行時仍在 `main`，`hooks/branch-safety.ps1` 會 `exit 2` 擋掉 repo 內的寫入。`design-map.md` 的落檔一律延到 **branch 建立後**。
```

**改動 2 — `skills/brainstorm/SKILL.md:78`**（§Phase 0b′ 內），同樣把 `.design-gate` 拿掉：

```markdown
**本階段不寫任何檔（硬規則）**。Phase 0 執行時仍在 `main`，`hooks/branch-safety.ps1` 會 `exit 2` 擋掉 repo 內的寫入。`design-map.md` 的落檔延到 **branch 建立後**。判定結果只進 hand-off state 與 `spec.md` 的「設計方向」段落。
```

**改動 3 — `skills/brainstorm/SKILL.md:192`**，整句刪除（`.design-gate` 已無讀者；判定結果由 §spec 文件結構 的「設計方向」section 承載）。

**改動 4 — `.gitignore`**，刪掉這兩行：

```gitignore
# .design-gate：0b′ 判定結果，branch 生命週期內有效，階段 C1 的 hook 讀它
**/.design-gate
```

並把上方註解調整為只描述 `design-demos`。

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1 指令，Expected: PASS

- [ ] **Step 5: commit**

```bash
git add skills/design-language/SKILL.md skills/brainstorm/SKILL.md .gitignore
git commit -m "refactor: 移除 .design-gate（隨 design-gate hook 一併廢除）

該檔在 skill 裡的定義是「hook 的唯一輸入」，沒有 hook 就沒有讀者；
它記的六個欄位 T1+ 已在 spec.md 的設計方向段落裡。
順帶修掉 Eng review C3 的三處「與寫 spec.md 同一步」不一致。"
```

---

## Task 3: 同步生效並驗收

**parallel-group**: 3
**files**:
- create: `docs/work/feat/design-lane/verify-stage-c1.md`

對應 spec 驗收 **V3-取代**（條文存在且已同步）與 **V10**（setup 不壞既有行為）。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && ok=1
test -f docs/work/feat/design-lane/verify-stage-c1.md || { echo "MISS: 驗收記錄未落檔"; ok=0; }
for p in "§設計語言對齊" "V10" "26 skill" "2 hook" ; do
  grep -qF "$p" docs/work/feat/design-lane/verify-stage-c1.md 2>/dev/null || { echo "MISS(verify): $p"; ok=0; }
done
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗** — Expected: FAIL，5 條全 MISS

- [ ] **Step 3: 執行驗收**

**3a — 同步**：跑 `pwsh -NoProfile -File scripts/setup.ps1 -Yes`。
需 user 同意（它會**直接覆蓋不備份** `~/.claude/CLAUDE.md`）。

**3b — V3-取代**：比對 `CLAUDE.md` 與 `~/.claude/CLAUDE.md` 完全一致，且全域版含 `### §設計語言對齊`。

**3c — V10 回歸**：確認既有行為未壞——**26 skill**、**2 hook**（維持兩支，本階段不新增）、6 agent、`permissions.allow` 24 條、`env`、`/config` 寫的本機 key（`skipWorkflowUsageWarning`、`autoMode`）全部保留。

**3d — 落檔**：把 3a-3c 的實際輸出寫進 `verify-stage-c1.md`，並記載「本階段**不新增 hook**、S2 由守則承擔、無機械保障」這個取捨。

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1 指令，Expected: PASS

- [ ] **Step 5: commit**

```bash
git add docs/work/feat/design-lane/verify-stage-c1.md
git commit -m "docs: 加入階段 C1 驗收記錄"
```

---

## §並行性總表

| group | task | 檔案 |
|---|---|---|
| 1 | Task 1 | `CLAUDE.md` |
| 2 | Task 2 | `design-language` / `brainstorm` / `.gitignore` |
| 3 | Task 3 | 驗收記錄 |

**全序列，每 group 1 task** → `execute-plan` 不需載 `dispatch-parallel`。
依賴：Task 1 先立條文（Task 2 拿掉 `.design-gate` 之後，守則是唯一寫明「要讀設計語言」的必載層）→ Task 2 清遺留 → Task 3 同步驗收。

---

## §Self-review

**1. spec coverage**

| spec 項 | 對應 | 狀態 |
|---|---|---|
| S2（D26 改寫版：靠 CLAUDE.md 守則） | Task 1 | ✅ |
| V3-取代（條文存在且同步） | Task 3b | ✅ |
| V10 setup 不壞既有行為 | Task 3c | ✅ |
| Eng review C3（三處「同一步」不一致） | Task 2 | ✅ 隨 `.design-gate` 移除一併消失 |
| S4 中途轉進 / S5 三方向 | —— | 階段 B |
| S7 孤兒偵測 | —— | 階段 C |

**2. placeholder 掃**：無。Task 1 / Task 2 的 Step 3 都給出實際要寫入或刪除的完整文字。

**3. 型別一致**：條文裡的六個欄位名與 `design-language` §對外契約、`dev-workflow` §Skill hand-off state 逐字相同；副檔名清單七個與 `design-language` §前端副檔名 相同。

**4. 並行性檢查**：全序列。

**5. scope 檢查**：4 個檔。`CLAUDE.md` 為 D26 新增（spec 影響檔案表已補列）；其餘三個是移除 v1 遺留，屬同一階段的收尾。**未新增任何 hook、未動 `settings.json`。**

**6. 誠實聲明**：本階段完成後，**S2 沒有任何機械保障**。這是 D26 明知的取捨，不是遺漏。spec 的 S2 已照實改寫。
