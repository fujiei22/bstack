# 設計 lane 階段 C（收尾）Implementation Plan · v1

> 對應 spec：`docs/work/feat/design-lane/spec.md`（階段序 A → C1 → B1 → B2 → **C**）
> Track: Dev | Tier: **T2**（1 檔、約 60 行，但**具備刪除全域內容的能力**）
> 建立: 2026-08-31
> group 數: 3 / 最大並行度: **1**（全序列）

**Goal**：`setup.ps1` 跑完後，把 `~/.claude/skills` 與 `~/.claude/agents` 內「repo 沒有的」項目**列出來**，並在**取得明確同意**後才刪除（S7 / V9）。

---

## §為什麼這一階要寫得比前幾階保守

前三階動的是 markdown，寫錯了是「規則沒被執行到」；**這一階寫錯是「刪掉使用者的檔案」**，而且刪的是 `~/.claude/`——那裡除了本 repo 同步過去的東西，還有 Claude Code 自己的資料。

三條紀律：

1. **預設絕不刪**。偵測到孤兒的預設行為是**列出來 ＋ 印出可以自己貼的刪除指令**，不是刪。
2. **刪除必須是顯式 opt-in**，且 `-Yes`（CI 用）**不得**隱含同意刪除——`-Yes` 現在的語意只是「跳備份提醒」，擴張它等於讓所有自動化流程獲得刪除權。
3. **範圍嚴格限縮在 skills 與 agents**（S7 的原文）。`~/.claude/` 底下其他東西一律不碰：`settings.json`、`CLAUDE.md`、`statusline.sh`、`hooks/`、`projects/`、`todos/`、`shell-snapshots/`、`.credentials.json`、以及任何我們不認識的目錄。

---

## §非互動環境的硬約束（決定了整個設計）

**本 script 會被 agent 用非互動方式執行**——Bash / PowerShell tool 的 stdin 接的是 null device，`Read-Host` 會立刻 EOF 或丟例外。若把「詢問」寫成必經的 `Read-Host`，結果是 **agent 一跑就壞**，而不是「安全地不刪」。

所以三態設計：

| 情境 | 行為 |
|---|---|
| `-RemoveOrphans` 明確指定 | **刪除**（顯式 opt-in，不再問） |
| 互動終端、且未帶 `-Yes` | 列出 → `Read-Host` 逐類確認 → 依答案刪或不刪 |
| 非互動（agent／CI）、或帶 `-Yes` | **只列出、不刪**，並印出「要刪就自己跑這行」 |

**`-Yes` 落在「只列出」那一格**，不是「同意刪除」。

---

## §孤兒的兩種類型（分開列、分開確認）

| 類型 | 定義 | 例 |
|---|---|---|
| **A. 整包孤兒** | `~/.claude/skills/<name>/` 或 `~/.claude/agents/<name>.md` 在 repo 找不到同名 | repo 把某 skill 改名或刪除 |
| **B. 殘留檔** | skill 目錄兩邊都在，但全域多出 repo 沒有的檔 | repo 從 `design-direction/references/` 拿掉一個檔，全域那份還在 |

**為什麼要分開**：A 是「整包不該存在」，B 是「包還在、裡面有舊東西」。B 的風險判斷不同——使用者可能刻意在全域某個 skill 底下放自己的補充檔。分開列讓使用者能只清 A 不動 B。

---

## Task 1: `setup.ps1` 加入孤兒偵測（預設只列不刪）

**parallel-group**: 1
**files**: modify `scripts/setup.ps1`（param 區加 `-RemoveOrphans`；新增 `Get-OrphanItems` 與 `Invoke-DetectOrphans`；main 區插入呼叫；Summary 與檔頭說明各加一行）

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=scripts/setup.ps1; ok=1
for p in \
  "RemoveOrphans" \
  "function Get-OrphanItems" \
  "function Invoke-DetectOrphans" \
  "孤兒偵測" \
  "預設不刪" \
  "整包孤兒" \
  "殘留檔" \
  "UserInteractive" \
  "只掃 skills 與 agents" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
grep -qF "不代表同意刪除" "$f" || { echo "MISS: 缺 -Yes 語意聲明"; ok=0; }
grep -qE "^Invoke-DetectOrphans " "$f" || { echo "MISS: main 未呼叫 Invoke-DetectOrphans"; ok=0; }
# 語法必須可解析（真檢查：壞掉會回非 0）
pwsh -NoProfile -Command "\$e=\$null; \$null=[System.Management.Automation.Language.Parser]::ParseFile('$PWD/scripts/setup.ps1',[ref]\$null,[ref]\$e); if (\$e -and \$e.Count -gt 0) { exit 1 } else { exit 0 }" \
  || { echo "MISS: PowerShell 語法解析失敗"; ok=0; }
# regression guard：既有行為不得被動到
grep -qF "function Invoke-SyncRepoFiles" "$f" || { echo "MISS(reg): sync 函式被改名或刪除"; ok=0; }
grep -qF "hooks / statusLine 取 repo；其餘本機設定保留" "$f" || { echo "MISS(reg): settings merge 語意被動到"; ok=0; }
grep -qF "跳備份提醒（適 CI / 自動化）" "$f" || { echo "MISS(reg): -Yes 原語意被改寫"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，正向 9 條 + -Yes 語意 + main 呼叫 共 11 條 MISS
# 語法解析與 3 條 regression guard 現況已綠（現行檔案本來就能解析）
```

- [ ] **Step 3: 寫內容**

分五處改，全部是加法，不動既有邏輯：

| # | 位置 | 內容 |
|---|---|---|
| 1 | `param` 區 | 加 `[switch]$RemoveOrphans` |
| 2 | 檔頭 `.PARAMETER` | 說明 `-RemoveOrphans`；明寫「`-Yes` **不代表同意刪除**——它只跳備份提醒」 |
| 3 | 檔頭 `.DESCRIPTION` 動作清單 | 補第 5 點「孤兒偵測：列出 global 有、repo 沒有的 skill / agent（**預設不刪**）」 |
| 4 | `Invoke-EnsurePlaywrightMcp` 之後、`main` 之前 | 新增 `Get-OrphanItems` 與 `Invoke-DetectOrphans` 兩個函式（內容見下） |
| 5 | main 區 ＋ Summary | 插入呼叫；Summary 加「✔ 孤兒偵測完成（預設不刪；要刪請加 -RemoveOrphans）」 |

**`Get-OrphanItems`** —— 純比對，不刪任何東西：
- 掃 `~/.claude/skills` 的每個子目錄；repo 沒有同名 → 列入 **Whole**（整包孤兒），並 `continue`（整包已列，不再逐檔列它底下的檔）
- 兩邊都有的 skill → 逐檔比相對路徑；global 有而 repo 無 → 列入 **Stale**（殘留檔）
- 掃 `~/.claude/agents/*.md`；repo 沒有同名 → 列入 **Whole**
- 回 `@{ Whole = <list>; Stale = <list> }`
- docstring 首行明寫「**只掃 skills 與 agents，不碰其他任何東西**」

**`Invoke-DetectOrphans`** —— 三態決策：
- 參數：`-RepoRoot` `-GlobalDir` `-AutoRemove` `-NonInteractive`
- 兩類都空 → 印「無孤兒」直接 return
- 有孤兒 → **先全部列出來**（兩類分開、各自標題）
- `-AutoRemove` → 兩類都刪
- `-NonInteractive` → 印「**只列出，不刪**」＋ 印出 `pwsh -NoProfile -File scripts/setup.ps1 -RemoveOrphans` 這行讓 user 自己貼，然後 return
- 否則（互動）→ 逐類 `Read-Host` 問 `(y/N)`，只有輸入 `y` 才刪
- 刪除用 `Remove-Item -LiteralPath`（避開萬用字元被誤解），整包用 `-Recurse -Force`、殘留檔用 `-Force`
- 沒刪的那一類要印「保留未刪」，不要靜默

**main 區的呼叫**（`-NonInteractive` 的判定是關鍵）：

```powershell
Invoke-DetectOrphans -RepoRoot $repoRoot -GlobalDir $globalDir `
    -AutoRemove:$RemoveOrphans `
    -NonInteractive:($Yes -or -not [Environment]::UserInteractive)
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add scripts/setup.ps1
git commit -m "feat: setup.ps1 加入孤兒偵測（預設只列不刪）"
```

---

## Task 2: V9 實測（造一個真的孤兒）

**parallel-group**: 2
**files**: 無檔案改動（純驗證）

**這一 task 不改檔，但它是這一階唯一能證明「刪除邏輯真的對」的東西。** 桌上推演在這裡不夠——刪錯了是刪掉使用者的檔案，而 grep 斷言只驗得到「程式碼裡有這幾個字」，驗不到「它刪對了東西」。

- [ ] **Step 1: 寫驗證指令**

驗證本身就是下面 3c-3f 的實測，斷言寫在每一步的預期輸出裡。

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# 尚未造孤兒時跑一次，Invoke-DetectOrphans 應印「無孤兒」——
# 這一步是在確認「偵測器在乾淨狀態下不會誤報」，比造完孤兒才第一次跑更有意義
```

- [ ] **Step 3: 執行實測**

**3a — 造一個整包孤兒**：在 `~/.claude/skills/` 底下建 `zz-orphan-test/SKILL.md`（repo 沒有的名字）。**不要動任何真的 skill。**

**3b — 造一個殘留檔**：在 `~/.claude/skills/design-direction/references/` 放一個 `zz-stale.md`。

**3c — 非互動跑**（`-Yes`，模擬 agent／CI）：確認
- ① 兩類都被列出、分開標示
- ② **沒有刪除任何東西**（兩個測試檔跑完仍在）
- ③ 印出 `-RemoveOrphans` 提示行

**3d — 帶 `-RemoveOrphans` 跑**：確認
- ① 兩個測試檔被刪
- ② **27 個真 skill 與 6 個真 agent 一個都沒少**
- ③ `diff -rq skills/ ~/.claude/skills/` 完全一致

**3e — 再跑一次**（idempotent）：確認回「無孤兒」。

**3f — 邊界檢查**：確認 `~/.claude/` 底下這些**原封未動**——`settings.json`、`CLAUDE.md`、`statusline.sh`、`hooks/`（2 支）、`projects/`、`todos/`。比對存在性與 mtime。

> **3f 是這一階最重要的一步**。前面三步驗的是「該刪的有刪」，3f 驗的是「**不該刪的沒被碰**」——後者才是這個功能真正的風險所在。

- [ ] **Step 4: 跑驗證確認通過** — 3c-3f 全綠
- [ ] **Step 5: commit** — 無檔案改動，不 commit；結果寫進 Task 3 的驗收記錄

---

## Task 3: 驗收記錄 ＋ 同步 spec

**parallel-group**: 3
**files**: create `docs/work/feat/design-lane/verify-stage-c.md`；modify `docs/work/feat/design-lane/spec.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && ok=1
test -f docs/work/feat/design-lane/verify-stage-c.md || { echo "MISS: 驗收記錄未落檔"; ok=0; }
grep -qE "C · 收尾.*\|[^|]*已完成[^|]*\|" docs/work/feat/design-lane/spec.md || { echo "MISS: spec 階段表未把 C 標為已完成"; ok=0; }
grep -qF "不涵蓋 hooks" docs/work/feat/design-lane/verify-stage-c.md || { echo "MISS: 驗收記錄未明列不涵蓋範圍"; ok=0; }
# 回歸：真 skill / agent 一個都沒少
[ "$(ls -d skills/*/ | wc -l)" = "$(ls -d ~/.claude/skills/*/ | wc -l)" ] || { echo "MISS(reg): repo 與 global skill 數不一致"; ok=0; }
[ "$(ls agents/*.md | wc -l)" = "$(ls ~/.claude/agents/*.md | wc -l)" ] || { echo "MISS(reg): agent 數不一致"; ok=0; }
diff -rq skills/ "$HOME/.claude/skills/" >/dev/null 2>&1 || { echo "MISS(reg): repo 與 global skills 有落差"; ok=0; }
test -f "$HOME/.claude/settings.json" || { echo "MISS(reg): settings.json 不見了"; ok=0; }
[ "$(ls ~/.claude/hooks/*.ps1 | wc -l)" = "2" ] || { echo "MISS(reg): hook 數不是 2"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗** — Expected: FAIL（驗收記錄未落檔 ＋ spec 未標完成 ＋ 不涵蓋聲明）

- [ ] **Step 3: 寫內容**

驗收記錄要包含：
- Task 2 的 3c-3f **實際輸出**（不是「有跑過」，是貼出來）
- **`-Yes` 不刪的證據**——這是本階段最容易寫錯的一條規則
- **3f 邊界檢查逐項結果**
- **明列不涵蓋的範圍**：`hooks/`、`settings.json`、Claude Code 自有資料（`projects/` / `todos/` / `shell-snapshots/` / `.credentials.json`）一律不掃
- **已知限制**：B 類（殘留檔）可能誤報——使用者刻意放在全域 skill 底下的補充檔會被列出來

spec：階段表 C 標為「✅ 已完成」；V9 標達成；V10 補這一輪的回歸結果。

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add docs/work/feat/design-lane/verify-stage-c.md docs/work/feat/design-lane/spec.md
git commit -m "docs: 加入階段 C 驗收記錄並同步 spec"
```

---

## §並行性總表

| group | task | 檔案 |
|---|---|---|
| 1 | Task 1 | `scripts/setup.ps1` |
| 2 | Task 2 | 無（V9 實測） |
| 3 | Task 3 | 驗收記錄 ＋ `spec.md` |

**全序列** → `execute-plan` 不需載 `dispatch-parallel`。依賴：Task 1 → 2 → 3 嚴格順序（沒有 Task 1 就沒東西可測；沒有 Task 2 的實測結果就沒東西可寫進驗收）。

**回退路徑**：Task 1 是單檔加法，`git revert` 即完整回退。**Task 2 的實測會真的刪東西**，但刪的是自己造的 `zz-` 測試檔；萬一誤刪真 skill，**重跑 `setup.ps1` 就能從 repo 補回來**。

> **這是這一階最重要的安全網：只要 repo 完好，全域永遠可以重建。** 孤兒偵測之所以敢做，前提就是 repo 是 source of truth——這也是為什麼它只碰 `skills/` 與 `agents/`（這兩個目錄的內容 100% 來自 repo），不碰 `settings.json`（本機優先 merge，刪了救不回）。

---

## §Self-review

**1. spec coverage**：S7 ✅（Task 1）／ V9 ✅（Task 2 實測）／ V10 回歸 ✅（Task 3 斷言）。

**2. placeholder 掃**：無。三個 task 都給了要寫的位置、行為規格與實測步驟。

**3. 型別一致**：`Get-OrphanItems` 回 `@{ Whole; Stale }`，`Invoke-DetectOrphans` 兩處使用同名 key。

**4. 並行性檢查**：全序列，依賴鏈有實質理由。

**5. scope 檢查**：只動 `scripts/setup.ps1` ＋ 兩份 docs。**不動任何 skill、agent、hook、CLAUDE.md。**

**6. 誠實聲明**：
- **`-Yes` 的語意被擴充**——原本只是「跳備份提醒」，現在還兼「非互動 → 不刪」。這是擴充不是改變（既有行為不受影響），但**任何讀 `-Yes` 的人現在要多知道一件事**，驗收記錄要寫明。
- **B 類偵測可能誤報**：使用者若刻意在全域某 skill 底下放補充檔，會被列成殘留。所以兩類分開問，且預設不刪。
- **不涵蓋 `hooks/`**：S7 原文只講 skills 與 agents。hook 是可執行檔、誤刪後果比 skill 嚴重，這一階不碰。
- **Task 2 是這一階唯一的真驗證**。前幾階可以靠 grep 斷言收尾，這一階的核心是「刪對東西、不該刪的沒碰」，**grep 驗不到，必須真的造孤兒、真的跑刪除**。
- **`Read-Host` 那條路徑我驗不到**：agent 執行環境永遠是非互動，所以「互動終端逐類確認」這一支只能靠 code review，沒辦法實測。這是明知的缺口。
