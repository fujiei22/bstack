# 設計 lane 階段 C（收尾）Implementation Plan · v2

> 對應 spec：`docs/work/feat/design-lane/spec.md`（階段序 A → C1 → B1 → B2 → **C**）
> v1 review：Eng 單視角，**3 個 Critical**，判「不可進 execute-plan」
> Track: Dev | Tier: **T2**（1 檔，但**具備刪除全域內容的能力**）
> 建立: 2026-08-31（v2 依 review 重寫）
> group 數: 3 / 最大並行度: **1**（全序列）

**Goal**：`setup.ps1` 跑完後，把 `~/.claude/skills` 與 `~/.claude/agents` 內「repo 沒有的」項目**列出來**，並在**取得明確同意**後才刪除（S7 / V9）。

---

## §v1 → v2 的三個結構變更

### 1. 三態砍成兩態，`Read-Host` 整條拿掉

v1 設計了三態，第三態靠 `[Environment]::UserInteractive` 判「非互動 → 只列不刪」。**實測那個判定在 Windows 上恆為 `True`**：

```
                    直接 -File   加 -NonInteractive   管線餵 stdin
UserInteractive        True           True               True
IsInputRedirected      True           True               True
```

`UserInteractive` 判的是「行程有沒有掛在互動式 window station」，跟 stdin 是不是 tty 無關——只有 Windows Service 才會是 `False`。**整個第三態不存在**，安全網實際上只有 `$Yes` 一個人在扛。

連帶暴露 v1 的另一個洞：非互動執行會落進 `Read-Host` 分支，而 `yes | pwsh -File setup.ps1` 會把每個 `Read-Host` 都餵到 `y`——**一條管線就完成無人值守刪除**，而使用者原本只是想跳過備份提醒。

v2 的處置不是修判定式，是**把整條互動分支拿掉**：

| | 行為 |
|---|---|
| 預設 | **只列出** ＋ 印出刪除指令，不刪任何東西 |
| `-RemoveOrphans` | 刪除（顯式 opt-in） |

理由：**「驗不到、又會刪東西」的分支，最好的處置是不要有**。v1 的 §Self-review 自己承認「`Read-Host` 那條路徑我驗不到」，而它同時是唯一的 fail-open 入口。

**「詢問」搬到正確的層級**：script 只負責列出；要不要刪由 **agent 走 `AskUserQuestion` 問 user**，同意後才用 `-RemoveOrphans` 重跑。這本來就是 CLAUDE.md §決策點選單 規定的做法。V9 的「並詢問」由這一層滿足。

### 2. 補上「repo 側為空就中止」的硬守衛

v1 的 `Get-OrphanItems` 規格是「repo 沒有同名 → 列入孤兒」，**沒有任何前提檢查**。reviewer 照規格實作後實測：

```
情境 A：正常 repo vs 真實 global    → Whole=0   Stale=0
情境 B：repo 完全沒有 skills/agents/ → Whole=33  Stale=0
情境 C：repo 有 skills/ 但目錄是空的 → Whole=33  Stale=0
```

**觸發路徑不是假想的**：`setup.ps1:451` 的 `$repoRoot` 取自 **cwd**（`git rev-parse --show-toplevel`），**完全沒驗證「這是不是 bstack repo」**。所以 `cd 任何其他 git repo && pwsh -File D:/GitHub/bstack/scripts/setup.ps1 -RemoveOrphans` 會刪掉全部 27 skill ＋ 6 agent。sparse-checkout、worktree、rebase 中途的 working tree 也都會踩到。

而且 `Invoke-SyncRepoFiles` 遇到 `skills/` 不存在是**靜默跳過**（`setup.ps1:297` 的 `if (Test-Path ...)`），最壞組合成立：**sync 什麼都沒做，刪除照跑全力**。

v2 加三道：
1. `Get-OrphanItems` 開頭硬檢查——repo 側 skill 或 agent 清單為空 → `Write-Warning` ＋ 回空，**絕不進刪除**
2. main 區加 **repo 身分哨兵**——`skills/dev-workflow/SKILL.md` 不存在就跳過孤兒偵測
3. **比例上限**——`Whole.Count` 超過 global 總數一半 → 判定為偵測異常，強制降級成「只列出」

### 3. 驗證層從「驗文件」改成「驗行為」

v1 的 14 條斷言裡，13 條是 `grep -qF` 找中文註解與訊息文字。**一個把 `Remove-Item -Recurse -Force ~/.claude` 寫死的實作，只要註解字寫齊就 14 條全綠。**

v2 保留字串斷言（它們驗的是「說明有寫」），但**加 4 條真的呼叫 `Get-OrphanItems` 的行為斷言**。`Get-OrphanItems` 是純比對、不刪東西，可以安全地在 scratchpad 造 fixture 直接呼叫。

---

## §範圍限縮（實測後更堅定）

reviewer 實際列了 `~/.claude/`，內容遠比 v1 想的多：

```
.credentials.json  backups  cache  daemon  downloads  feedback  file-history
history.jsonl  jobs  paste-cache  plugins  projects  session-env  sessions
settings.json  settings.local.json  shell-snapshots  state  stats-cache.json
tasks  teams  agents  skills  hooks  CLAUDE.md  statusline.sh
```

**只碰 `skills/` 與 `agents/` 兩個目錄**，其餘一律不掃、不列、不刪。

**為什麼只有這兩個安全**（實測依據）：
- `diff -rq` 確認 `~/.claude/skills` 與 `~/.claude/agents` 的內容 **100% 來自 repo**
- Claude Code 的內建 skill（`artifact-design` / `dataviz` / `code-review` 等）**不住在 `~/.claude/skills`**——`find ~/.claude -name artifact-design` 無結果，不會被掃進孤兒名單

**v1 那句標語是錯的**：「只要 repo 完好，全域永遠可以重建」——`settings.json` 是 merge 不是覆蓋、`projects/<專案>/memory/` 是跨 session 的記憶、`.credentials.json` 是 auth token、`sessions/` 與 `history.jsonl` 是對話紀錄，**這些都重建不回來**。

v2 改成有條件式：**「只要 `repo/skills` 與 `repo/agents` 非空且完整，這兩個目錄可以重建；其餘一律不在範圍內。」** 前半句的前提由 §v1→v2 第 2 點的三道守衛負責執行——v1 把安全性押在一個沒人檢查的前提上。

---

## §孤兒的兩種類型（分開列、分開處置）

| 類型 | 定義 | 例 |
|---|---|---|
| **A. 整包孤兒** | `~/.claude/skills/<name>/` 或 `~/.claude/agents/<name>.md` 在 repo 找不到同名 | repo 把某 skill 改名或刪除 |
| **B. 殘留檔** | skill 目錄兩邊都在，但 global 多出 repo 沒有的檔 | repo 從 `design-direction/references/` 拿掉一個檔，global 那份還在 |

**B 類可能誤報**：使用者可能刻意在 global 某個 skill 底下放自己的補充檔。所以兩類分開列，讓 user 能只清 A 不動 B。

---

## Task 1: `setup.ps1` 加入孤兒偵測（兩態，預設只列不刪）

**parallel-group**: 1
**files**: modify `scripts/setup.ps1`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=scripts/setup.ps1; ok=1
# --- 字串層：說明有沒有寫 ---
for p in \
  "RemoveOrphans" \
  "function Get-OrphanItems" \
  "function Invoke-DetectOrphans" \
  "孤兒偵測" \
  "預設不刪" \
  "整包孤兒" \
  "殘留檔" \
  "只掃 skills 與 agents" \
  "repo 側清單為空" \
  "身分哨兵" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
grep -qF "不代表同意刪除" "$f" || { echo "MISS: 缺 -Yes 語意聲明"; ok=0; }
grep -qE "^Invoke-DetectOrphans " "$f" || { echo "MISS: main 未呼叫"; ok=0; }
# --- 反向：互動分支必須不存在 ---
grep -qF "Read-Host" "$f" && [ "$(grep -c 'Read-Host' "$f")" != "1" ] && { echo "MISS: Read-Host 應只剩備份提醒那一處，實際 $(grep -c 'Read-Host' "$f") 處"; ok=0; }
grep -qF "UserInteractive" "$f" && { echo "MISS: 不得使用 UserInteractive（實測恆為 True）"; ok=0; }
# --- 語法解析（路徑由 pwsh 自己算，不跨 shell 傳）---
pwsh -NoProfile -Command "\$p=Join-Path (git rev-parse --show-toplevel) 'scripts/setup.ps1'; \$e=\$null; \$null=[System.Management.Automation.Language.Parser]::ParseFile(\$p,[ref]\$null,[ref]\$e); exit ([int](\$e.Count -gt 0))" \
  || { echo "MISS: PowerShell 語法解析失敗"; ok=0; }
# --- regression guard ---
grep -qF "function Invoke-SyncRepoFiles" "$f" || { echo "MISS(reg): sync 函式被動到"; ok=0; }
grep -qF "hooks / statusLine 取 repo；其餘本機設定保留" "$f" || { echo "MISS(reg): settings merge 語意被動到"; ok=0; }
grep -qF "跳備份提醒（適 CI / 自動化）" "$f" || { echo "MISS(reg): -Yes 原語意被改寫"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，正向 10 條 + -Yes 語意 + main 呼叫 共 12 條 MISS
# 註：v1 的語法斷言把 bash 的 $PWD 塞進 pwsh 路徑，實測 errCount=1 **永遠紅**，
#     Step 4 拿不到 PASS。v2 改由 pwsh 端 Join-Path 自己算（實測 errCount=0）。
# 「不得使用 UserInteractive」與「Read-Host 只剩 1 處」是反向 guard，現況綠
# 語法解析與 3 條 regression guard 現況已綠
```

- [ ] **Step 3: 寫內容**

| # | 位置 | 內容 |
|---|---|---|
| 1 | `param` 區 | 加 `[switch]$RemoveOrphans` |
| 2 | 檔頭 `.PARAMETER` | 說明 `-RemoveOrphans`；明寫「`-Yes` **不代表同意刪除**——它只跳備份提醒」 |
| 3 | 檔頭 `.DESCRIPTION` | 動作清單補第 5 點「孤兒偵測：列出 global 有、repo 沒有的 skill / agent（**預設不刪**）」 |
| 4 | `Invoke-EnsurePlaywrightMcp` 之後 | 新增 `Get-OrphanItems` 與 `Invoke-DetectOrphans` |
| 5 | main 區 ＋ Summary | 插入呼叫（含身分哨兵）；Summary 加一行 |

**`Get-OrphanItems`** —— 純比對，不刪任何東西。docstring 首行明寫「**只掃 skills 與 agents，不碰其他任何東西**」。

前置守衛（**在任何比對之前**）：
- repo 側 `skills/` 子目錄清單為空、或 `agents/*.md` 清單為空 → `Write-Warning "repo 側清單為空，孤兒偵測中止"` ＋ 回 `@{ Whole=@(); Stale=@() }`

比對邏輯：
- global 每個 skill 子目錄：repo 無同名 → 列入 `Whole`，`continue`（整包已列，不再逐檔列）
- 兩邊都有 → 逐檔比相對路徑（`Substring` ＋ `TrimStart('\','/')`，與 `setup.ps1:304` 既有 sync 同招）；global 有 repo 無 → 列入 `Stale`
- global 每個 `agents/*.md`：repo 無同名 → 列入 `Whole`
- **所有 `Get-ChildItem` 一律用 `-LiteralPath`**（路徑含 `[` `]` 時 `-Path` 會靜默回空，導致該 skill 底下每個檔都被誤判成殘留）
- 回 `@{ Whole = <list>; Stale = <list> }`；**存回 hashtable 時用 `,$arr` 包一層**，避免空陣列變 `$null`、單元素變純量（`setup.ps1:146` 註解已記錄過同一個坑）

**`Invoke-DetectOrphans`** —— 兩態，**沒有 `Read-Host`**：
- 參數：`-RepoRoot` `-GlobalDir` `-AutoRemove`
- 開頭擋版本：`$PSVersionTable.PSVersion.Major -lt 7` → `Write-Warning` ＋ return（舊版 PS 5.1 有 recurse-through-junction 的資料遺失史）
- 兩類都空 → 印「無孤兒」return
- 有孤兒 → **先全部列出**（兩類分開標題）
- **比例上限**：`Whole.Count` > global 總數的一半 → 印警告「偵測異常，強制只列出」，**忽略 `-AutoRemove`**
- `-AutoRemove` → 刪除；否則印「**只列出，不刪**」＋ 印出 `pwsh -NoProfile -File scripts/setup.ps1 -RemoveOrphans`
- 刪除用 `Remove-Item -LiteralPath`，整包 `-Recurse -Force`、殘留檔 `-Force`
- 沒刪的類別要印「保留未刪」，不要靜默

**main 區的呼叫（含身分哨兵）**：

```powershell
$sentinel = Join-Path $repoRoot 'skills/dev-workflow/SKILL.md'
if (Test-Path -LiteralPath $sentinel) {
    Invoke-DetectOrphans -RepoRoot $repoRoot -GlobalDir $globalDir -AutoRemove:$RemoveOrphans
} else {
    Write-Warning "身分哨兵 $sentinel 不存在，跳過孤兒偵測（這可能不是 bstack repo）"
}
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1，Expected: PASS
- [ ] **Step 5: commit**

```bash
git add scripts/setup.ps1
git commit -m "feat: setup.ps1 加入孤兒偵測（兩態，預設只列不刪）"
```

---

## Task 2: 行為驗證（造真孤兒 ＋ 攻擊守衛）

**parallel-group**: 2
**files**: 無檔案改動（純驗證）

**v1 的 Task 2 只測「造孤兒 → 刪掉」**。v2 加上**攻擊守衛**——因為 review 證明真正會出事的不是「該刪的沒刪」，是「**不該刪的被刪**」。

- [ ] **Step 1: 寫驗證指令**

在 scratchpad 造 fixture，**直接 dot-source `setup.ps1` 取得 `Get-OrphanItems` 後呼叫**（它是純比對、不刪東西，安全）：

```
斷言 1（守衛）repo 側 skills 為空        → Whole.Count -eq 0  且印出 warning
斷言 2（守衛）repo 側 agents 為空        → Whole.Count -eq 0
斷言 3（正報）假 global 有 zz-x/、repo 無 → Whole 恰含 1 項，路徑以 skills\zz-x 結尾
斷言 4（範圍）回傳的每一個路徑都必須以 <GlobalDir>\skills\ 或 <GlobalDir>\agents\ 開頭
```

- [ ] **Step 2: 跑驗證確認失敗** — `Get-OrphanItems` 尚不存在，4 條全紅

- [ ] **Step 3: 執行實測**

**3a — 乾淨狀態誤報檢查**：真實 repo vs 真實 global 跑一次，應回「無孤兒」。**這一步比造完孤兒才第一次跑更有意義**——它驗的是偵測器不會誤報。

**3b — 造整包孤兒**：`~/.claude/skills/zz-orphan-test/SKILL.md`。**不動任何真 skill。**

**3c — 造殘留檔**：`~/.claude/skills/design-direction/references/zz-stale.md`。

**3d — 預設跑**（不帶任何旗標）：確認 ① 兩類都列出且分開 ② **沒刪任何東西**（兩個測試檔仍在）③ 印出 `-RemoveOrphans` 提示。

**3e — 帶 `-Yes` 跑**：確認**仍然不刪**——`-Yes` 只跳備份提醒，不含刪除權。

**3f — 帶 `-RemoveOrphans` 跑**：確認 ① 兩個測試檔被刪 ② **27 skill / 6 agent 一個都沒少** ③ `diff -rq skills/ ~/.claude/skills/` 完全一致。

**3g — 再跑一次**（idempotent）：回「無孤兒」。

**3h — 攻擊守衛（v1 沒有這一格）**：在 scratchpad 造一個空的 git repo，`cd` 進去跑 `setup.ps1 -RemoveOrphans`，確認 **身分哨兵擋下來、什麼都沒刪**。跑完立刻用 `diff -rq skills/ ~/.claude/skills/` 確認 global 完好。

**3i — 邊界快照 diff**（取代 v1 手寫清單）：
```bash
# 跑之前
ls -la ~/.claude/ | awk '{print $NF, $6, $7, $8}' | sort > /tmp/claude-before.txt
# 跑之後
ls -la ~/.claude/ | awk '{print $NF, $6, $7, $8}' | sort > /tmp/claude-after.txt
diff /tmp/claude-before.txt /tmp/claude-after.txt   # 除 skills/agents 外應無差異
```
> v1 手寫的清單裡有 `todos/`——**實測那個目錄根本不存在**。手寫清單會隨 Claude Code 版本失效，快照 diff 不會。且 `.credentials.json`、`settings.local.json`、`projects/`、`sessions/` 都會自動進快照。

- [ ] **Step 4: 跑驗證確認通過** — 3a-3i 全綠
- [ ] **Step 5: commit** — 無檔案改動；結果寫進 Task 3

---

## Task 3: 驗收記錄 ＋ 同步 spec

**parallel-group**: 3
**files**: create `docs/work/feat/design-lane/verify-stage-c.md`；modify `docs/work/feat/design-lane/spec.md`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && ok=1
test -f docs/work/feat/design-lane/verify-stage-c.md || { echo "MISS: 驗收記錄未落檔"; ok=0; }
grep -qE "C · 收尾.*\|[^|]*已完成[^|]*\|" docs/work/feat/design-lane/spec.md || { echo "MISS: spec 階段表未標完成"; ok=0; }
grep -qF "不涵蓋 hooks" docs/work/feat/design-lane/verify-stage-c.md || { echo "MISS: 未明列不涵蓋範圍"; ok=0; }
grep -qF "重建不回來" docs/work/feat/design-lane/verify-stage-c.md || { echo "MISS: 未寫明哪些東西重建不回來"; ok=0; }
# spec V10 的過期數字要修（實測現況 27，spec 寫 25）
grep -qF "既有 25 skill" docs/work/feat/design-lane/spec.md && { echo "MISS: spec V10 的 25 未更正為 27"; ok=0; }
# 回歸
[ "$(ls -d skills/*/ | wc -l)" = "$(ls -d ~/.claude/skills/*/ | wc -l)" ] || { echo "MISS(reg): skill 數不一致"; ok=0; }
[ "$(ls agents/*.md | wc -l)" = "$(ls ~/.claude/agents/*.md | wc -l)" ] || { echo "MISS(reg): agent 數不一致"; ok=0; }
diff -rq skills/ "$HOME/.claude/skills/" >/dev/null 2>&1 || { echo "MISS(reg): repo 與 global skills 有落差"; ok=0; }
test -f "$HOME/.claude/settings.json" || { echo "MISS(reg): settings.json 不見了"; ok=0; }
test -f "$HOME/.claude/.credentials.json" || { echo "MISS(reg): .credentials.json 不見了"; ok=0; }
[ "$(ls ~/.claude/hooks/*.ps1 | wc -l)" = "2" ] || { echo "MISS(reg): hook 數不是 2"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗** — Expected: FAIL（記錄未落檔 ＋ spec 未標完成 ＋ 兩條內容要求 ＋ spec 的 25）

- [ ] **Step 3: 寫內容**

驗收記錄必含：
- Task 2 的 3a-3i **實際輸出**（貼出來，不是說「有跑過」）
- **`-Yes` 不刪的證據**（3e）——這是最容易寫錯的一條規則
- **3h 攻擊守衛的結果**——空 repo 進不來
- **3i 快照 diff** 逐項
- **明列不涵蓋**：`hooks/`、`settings.json`、以及 Claude Code 自有資料
- **明列重建不回來的東西**：`projects/<專案>/memory/`、`settings.local.json`、`.credentials.json`、`sessions/`、`history.jsonl`、`file-history/`
- **已知限制**：B 類可能誤報；互動確認由 agent 走 `AskUserQuestion` 承擔，script 不做

spec：階段表 C 標「✅ 已完成」；**V10 的「25 skill」改成 27**；V9 標達成。

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
| 2 | Task 2 | 無（行為驗證 ＋ 攻擊守衛） |
| 3 | Task 3 | 驗收記錄 ＋ `spec.md` |

**全序列**。依賴：Task 1 → 2 → 3 嚴格順序。

**回退路徑**：Task 1 是單檔加法，`git revert` 即完整回退。Task 2 的實測會真的刪東西，但刪的是自己造的 `zz-` 測試檔；萬一誤刪真 skill，**重跑 `setup.ps1` 可從 repo 補回 `skills/` 與 `agents/` 這兩個目錄**（見 §範圍限縮 的有條件式，其餘不在此保證內）。

---

## §Self-review

**1. spec coverage**：S7 ✅（Task 1）／ V9 ✅（Task 2 實測 ＋ agent 層的 `AskUserQuestion`）／ V10 回歸 ✅（Task 3 斷言，含 spec 數字更正）。

**2. placeholder 掃**：無。

**3. 型別一致**：`Get-OrphanItems` 回 `@{ Whole; Stale }`，兩處同名 key；存回時用 `,$arr` 包一層。

**4. 並行性檢查**：全序列。

**5. scope 檢查**：只動 `scripts/setup.ps1` ＋ 兩份 docs。

**6. 誠實聲明**：
- **`-Yes` 語意被擴充**：原本只是「跳備份提醒」，現在還要明確**不含刪除權**。既有行為不受影響，但讀 `-Yes` 的人要多知道一件事。
- **B 類可能誤報**：使用者刻意放在 global skill 底下的補充檔會被列出。所以兩類分開、預設不刪。
- **不涵蓋 `hooks/`**：S7 原文只講 skills 與 agents；hook 是可執行檔，誤刪後果更重。
- **互動確認不由 script 做**：script 只列出，要不要刪由 agent 走 `AskUserQuestion`。這是 v1 review 逼出來的設計——把「驗不到又會刪東西」的分支整條移除，而不是想辦法修好它。
- **`-RemoveOrphans` 這條路徑我會實跑，但只在自己造的 `zz-` fixture 上**。真的誤刪 27 個 skill 是什麼樣子，這一階不會去驗——那條路徑靠三道守衛（空清單、身分哨兵、比例上限）擋，**守衛本身會被 3h 攻擊測試**。
