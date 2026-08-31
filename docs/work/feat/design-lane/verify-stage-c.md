# 階段 C 驗收記錄

> 對應 plan：`docs/work/feat/design-lane/plan-c.md`（v2）
> 對應 review：Eng 單視角，3 個 Critical，判「不可進 execute-plan」→ plan 重寫為 v2
> 日期：2026-08-31
> 驗收對象：`scripts/setup.ps1` 的孤兒偵測（S7 / V9）

**涵蓋**：S7（孤兒列出與刪除）、V9（造真孤兒實測）、V10 回歸。

---

## 一句話結論

**3 個 task 跑完、全綠。** 孤兒偵測上線，**預設只列不刪**，刪除需顯式 `-RemoveOrphans`。實測造出真孤兒 → 列出 → `-Yes` 不刪 → `-RemoveOrphans` 刪掉 → 再跑回「無孤兒」，全程 27 skill / 6 agent 一個沒少、`~/.claude/` 底下無任何項目消失。**攻擊守衛也實測擋住了**：在別的 git repo 裡跑 `-RemoveOrphans`，身分哨兵直接跳過偵測。

---

## 最終設計：兩態，沒有互動確認

| | 行為 |
|---|---|
| 預設（含 `-Yes`） | **只列出** ＋ 印出刪除指令 |
| `-RemoveOrphans` | 刪除 |

**為什麼不做 `Read-Host`**：v1 設計了三態，第三態靠 `[Environment]::UserInteractive` 判「非互動 → 只列不刪」。**實測那個判定恆為 `True`**：

```
                    直接 -File   加 -NonInteractive   管線餵 stdin
UserInteractive        True           True               True
IsInputRedirected      True           True               True
```

它判的是「行程有沒有掛在互動式 window station」，跟 stdin 是不是 tty 無關——只有 Windows Service 才是 `False`。**第三態根本不存在**，而非互動執行會落進 `Read-Host` 分支，`yes | pwsh -File setup.ps1` 一條管線就完成無人值守刪除。

v2 的處置不是修判定式，是**把整條互動分支移除**——「驗不到、又會刪東西」的分支，最好的處置是不要有。**「詢問」搬到 agent 層**：script 只列出，要不要刪由 agent 走 `AskUserQuestion` 問 user，同意後才用 `-RemoveOrphans` 重跑。V9 的「並詢問」由這一層滿足。

---

## 三道守衛（全部實測）

| 守衛 | 防什麼 | 實測結果 |
|---|---|---|
| **repo 側清單為空即中止** | `cd` 到別的 repo 或空 working tree 執行 → 33 個項目全被判成孤兒 | ✅ repo skills 為空 → `Whole=0` ＋ warning；agents 為空同 |
| **身分哨兵** `skills/dev-workflow/SKILL.md` | `$repoRoot` 取自 **cwd**，原本完全沒驗證「這是不是 bstack repo」 | ✅ 見 3h |
| **比例上限**（孤兒 > global 總數一半 → 強制降級） | 前兩道萬一都漏掉時的最後一層 | 未觸發（實測情境孤兒數 1，遠低於門檻） |

---

## Task 1 · `setup.ps1` 加入孤兒偵測

**Step 2 紅燈 12 條**（與 plan 的 Expected 完全吻合）。**Step 4 PASS**。

改動：489 → 662 行，六處全是加法。commit `3e5c26d`、`cfa2cf1`。

### 施工中被斷言擋下三次

| # | 發生什麼 | 處置 |
|---|---|---|
| 1 | 斷言 `^Invoke-DetectOrphans ` 用行首錨定，但 plan 的 Step 3 規定呼叫要包在身分哨兵的 `if` 裡、必然縮排 | **改斷言**——它與 plan 自己的 Step 3 矛盾，是斷言寫錯。改成 `grep -qF "Invoke-DetectOrphans -RepoRoot"` |
| 2 | 「`Read-Host` 只剩 1 處」與「不得使用 `UserInteractive`」兩條被**我自己的 docstring** 觸發（我在說明裡解釋為什麼不用它們） | **改內容不改斷言**。說明有價值（它防的正是「以後有人把 `UserInteractive` 加回來」），所以改措辭保住說明、讓 guard 維持嚴格 |

處置原則沿用 B2 的：**預設改內容；要改斷言必須先說明它為什麼錯，且改完仍要有鑑別力。**

---

## Task 2 · 行為驗證

### 行為斷言抓到一個字串斷言看不見的真 bug

`Get-OrphanItems` 原本 `return @{ Whole = ,$whole; Stale = ,$stale }`——我把「函式回傳陣列」用的 `,` 技巧套在 hashtable 值上，多包了一層：

```
修正前：Whole 型別 System.Object[]   Whole.Count: 1   ← 空的卻回報 1
        攤平後實際內容: 0
修正後：Whole.Count: 0
```

**後果很嚴重**：`Invoke-DetectOrphans` 判「無孤兒」靠 `$wholeList.Count -eq 0`，這個判斷**永遠為 false**；帶 `-RemoveOrphans` 時還會拿一個空陣列去餵 `Remove-Item -LiteralPath`。

**Task 1 的 14 條字串斷言當時全綠。** 這正是 review M2 的論點——「一個把 `Remove-Item -Recurse -Force ~/.claude` 寫死的實作，只要註解字寫齊就全綠」。行為斷言是唯一抓得到的東西。commit `cfa2cf1`。

### 四條行為斷言 ＋ 3a：7 項全 PASS

用 AST 從**已 commit 的實檔**抽出 `Get-OrphanItems` 呼叫（不執行 main）：

```
=== 3a 乾淨狀態誤報檢查（真 repo vs 真 global，唯讀）===
  PASS  無誤報：Whole=0
  PASS  無誤報：Stale=0
=== 斷言 1-2：repo 側為空的守衛 ===
  WARNING: repo 側清單為空（skills=0 / agents=1），孤兒偵測中止，不刪任何東西。
  PASS  斷言1 repo skills 為空 → Whole=0（不刪 33 個）
  WARNING: repo 側清單為空（skills=1 / agents=0），孤兒偵測中止，不刪任何東西。
  PASS  斷言2 repo agents 為空 → Whole=0
=== 斷言 3-4：正報與範圍 ===
  PASS  斷言3 恰含 1 項
  PASS  斷言3 路徑以 skills\zz-x 結尾
  PASS  斷言4 所有回傳路徑都在 <GlobalDir>\skills 或 \agents 底下
PASS=7  FAIL=0
```

### 3b-3g · 端到端（造真孤兒 → 列 → 不刪 → 刪 → 回無孤兒）

**3b/3c 造孤兒**：`~/.claude/skills/zz-orphan-test/SKILL.md`（整包孤兒）＋ `~/.claude/skills/design-direction/references/zz-stale.md`（殘留檔）。global skill 數 27 → 28。

> 造完之後這個 session 的 skill 清單裡真的出現了 `zz-orphan-test`——fixture 是真的生效的，不是假的。

**3d/3e 帶 `-Yes` 跑**（`-Yes` 不含刪除權的證據）：

```
== Step 3: 孤兒偵測（global 有、repo 沒有） ==

  整包孤兒（repo 已無同名 skill / agent）：
    C:\Users\tommy_sian\.claude\skills\zz-orphan-test

  殘留檔（skill 還在，但這些檔 repo 已無）：
    C:\Users\tommy_sian\.claude\skills\design-direction\references\zz-stale.md

  **預設不刪**。確認要刪的話，重跑並加上 -RemoveOrphans：
    pwsh -NoProfile -File scripts/setup.ps1 -RemoveOrphans
```
```
  zz-orphan-test: True      ← 沒被刪
  zz-stale.md   : True      ← 沒被刪
```

**兩類分類正確**：整包孤兒是目錄、殘留檔是活 skill 內的檔，沒有混在一起。

**3f 帶 `-RemoveOrphans` 跑**：

```
  [del  ] C:\Users\tommy_sian\.claude\skills\zz-orphan-test
  [del  ] C:\Users\tommy_sian\.claude\skills\design-direction\references\zz-stale.md
  已刪除 1 個整包孤兒、1 個殘留檔。
```
```
  zz-orphan-test 還在: False
  zz-stale.md 還在   : False
  global skill 數: 27  (repo 27)
  global agent 數: 6   (repo 6)
  diff -rq skills/ ~/.claude/skills/  → 完全一致
```

**3g 再跑一次**（idempotent）：`無孤兒：global 的 skills / agents 與 repo 一致。`

### 3h · 攻擊守衛（review C2 抓到的洞）

在 scratchpad 造一個空的 git repo，`cd` 進去跑 `setup.ps1 -Yes -RemoveOrphans`：

```
  cwd = ...\scratchpad\fakerepo
  git rev-parse = .../scratchpad/fakerepo

WARNING: 身分哨兵 ...\fakerepo\skills\dev-workflow\SKILL.md 不存在，
         跳過孤兒偵測（這可能不是 bstack repo）

  [del] 行數: 0
  skill 目錄數: 28   agent 檔數: 6   zz-orphan-test 還在: True
```

**身分哨兵擋下來了，孤兒偵測整段跳過、零刪除。** 若沒有這道守衛，這一次執行會刪掉全部 27 skill ＋ 6 agent——review 已用實作模擬證明 `Whole.Count=33`。

### 3i · 邊界快照 diff

跑前跑後各取 `ls -la ~/.claude/` 快照（33 項）比對。**4 處差異，全是 mtime，沒有任何項目消失**：

| 差異 | 原因 |
|---|---|
| `.`（目錄本身） | 底下有檔案異動 |
| `skills` | `setup.ps1` 每次都 sync（設計如此） |
| `settings.json` | `setup.ps1` 每次都 merge（設計如此） |
| `history.jsonl` | **Claude Code 自己在寫**，與 `setup.ps1` 無關 |

敏感項目逐項確認仍在：`settings.json`、`settings.local.json`、`.credentials.json`、`CLAUDE.md`、`statusline.sh`、`hooks/`、`projects/`、`sessions/`、`history.jsonl`。

`settings.json` 內容完好：9 個 top-level key、`permissions.allow` 24 條、hook 路徑仍是絕對路徑（`C:/Users/tommy_sian/.claude/hooks/*.ps1`）、`statusLine` 在。

---

## 範圍：涵蓋什麼、不涵蓋什麼

**只碰 `~/.claude/skills/` 與 `~/.claude/agents/`。**

**不涵蓋 hooks**——S7 原文只講 skills 與 agents；hook 是可執行檔，誤刪後果比 skill 嚴重。也不涵蓋 `settings.json`、`CLAUDE.md`、`statusline.sh`，以及 Claude Code 的自有資料。

實測 `~/.claude/` 底下有 33 項，遠多於本功能碰的兩個：

```
.credentials.json  backups  cache  daemon  downloads  feedback  file-history
history.jsonl  jobs  paste-cache  plugins  projects  session-env  sessions
settings.json  settings.local.json  shell-snapshots  state  stats-cache.json
tasks  teams  agents  skills  hooks  CLAUDE.md  statusline.sh  ...
```

**為什麼只有這兩個安全**：`diff -rq` 確認它們的內容 100% 來自 repo；Claude Code 的內建 skill（`artifact-design` / `dataviz` / `code-review` 等）**不住在 `~/.claude/skills`**，不會被掃進孤兒名單。

### 重建不回來的東西（都不在本功能範圍內）

plan v1 曾寫「只要 repo 完好，全域永遠可以重建」——**那句話是錯的**。真正重建不回來的：

- `projects/<專案>/memory/`（跨 session 的記憶）
- `settings.local.json`、`.credentials.json`（auth token）
- `sessions/`、`history.jsonl`、`file-history/`（對話與檔案歷史）
- `settings.json` 是 **merge 不是覆蓋**，本機設定被刪就沒了

v2 改成有條件式：**「只要 `repo/skills` 與 `repo/agents` 非空且完整，這兩個目錄可以重建；其餘一律不在範圍內。」** 前半句的前提由三道守衛負責執行——v1 把安全性押在一個沒人檢查的前提上。

---

## 已知限制

| 項 | 說明 |
|---|---|
| **B 類（殘留檔）可能誤報** | 使用者若刻意在 global 某個 skill 底下放自己的補充檔，會被列成殘留。所以兩類分開列、預設不刪 |
| **比例上限未被實測觸發** | 實測情境的孤兒數是 1，遠低於門檻。這道守衛只有靜態程式碼檢查，沒有實跑證據 |
| **PS < 7 的路徑未測** | `Invoke-DetectOrphans` 開頭會擋 `$PSVersionTable.PSVersion.Major -lt 7` 並跳過，但這條分支沒實跑過 |
| **互動確認不由 script 做** | 由 agent 走 `AskUserQuestion`。這是設計決策不是遺漏——理由見上方「為什麼不做 `Read-Host`」 |

---

## 這一階真正的產出

不是 173 行 PowerShell，是**兩件在 plan 階段看不出來的事**：

1. **`[Environment]::UserInteractive` 在 Windows 上是廢的**。整個 v1 的安全設計押在它身上，而它恆為 `True`。這件事 review 實測抓到，我獨立複驗確認——**光讀 code 看不出來，要真的跑**。
2. **字串斷言在「會刪東西的功能」上完全不夠**。`,$arr` 那個 bug 讓「無孤兒」判斷永遠不成立，而 Task 1 的 14 條字串斷言當時**全綠**。行為斷言（真的呼叫函式、檢查回傳值）是唯一抓得到的東西。

這兩件都指向同一個結論：**越危險的功能，驗證越不能停在「文件裡有沒有寫」那一層。**
