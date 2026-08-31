# Plan review 總結（階段 C1）

> Plan: `docs/work/feat/design-lane/plan-c1.md`（**v1，已被 D26 廢除**）
> Tier: T2 | 視角: Eng-only（依 review-plan 對 T2 的規定）
> 日期: 2026-08-28

**結果：這份 review 直接導致 C1 被廢除（D26）。** 三條 Critical 都成立，主 agent 逐條實測驗證後，經 user 拍板改為「不做 hook，改寫進 `CLAUDE.md` 強制守則」。

---

## Critical（三條全部經主 agent 實測複驗屬實）

### C1 · gate 可被一行 Bash 繞過，auto mode 下幾乎必然繞過

`settings.json` 的 PreToolUse matcher 是 `Write|Edit|NotebookEdit`，**無任何 hook 攔 `Bash`**（主 agent 實測確認）。而 auto mode 的指示明寫「make file changes with **sed, heredocs, or short scripts**, rather than using the dedicated Read, Edit, or Write tools」。

**主 agent 自證**：本次 session 就跑在 auto mode 下，改 `spec.md` / `plan.md` / `interview-log.md` / `dev-workflow` / `brainstorm` 大多數走 python heredoc。若 `design-gate.ps1` 當時已裝，它一次都不會被觸發。

更糟的是錯誤訊息在教繞法——原設計明寫「缺少檔案：`docs/work/$branch/.design-gate`」，對被擋住的模型而言那是「建立這個檔就好」。`New-Item` 一行解鎖，成本遠低於跑 0b′。

**結論**：spec 的 S2「由 hook 機械保證、不靠模型自覺」不成立——它保證的只是「這支 branch 上有人建過一個檔」。驗收 V3 會通過（只測 hook 會不會 `exit 2`），但 S2 沒達成。

### C2 · 裝到全域後會擋死這台機器上所有其他前端專案

hook 沒有任何「這個專案有沒有在跑本套流程」的判斷。判定鏈：前端副檔名 → 在 repo 內 → 是 git repo → 非保護分支 → 無 gate 檔 → `exit 2`。而 `docs/work/` 是**本套流程專有的慣例**，別的專案永遠沒有。

reviewer 建了沙盒 repo 實跑：git worktree、branch `wt/br`、改 `docs/css/a.css`、無 `docs/work/` → **exit 2（誤擋）**。

配上 D25「無逃生門」，其他專案要工作得先去改全域 `~/.claude/settings.json`。reviewer 判定這是**相對 spec 的範圍溢出**——D25 是為 bstack 做的決定，不是為所有專案。

### C3 · T0 洞只補了三處中的一處，且負向斷言抓不到

`grep -n "同一步" skills/` 實測命中三處：

| 檔:行 | Task 1 有沒有改 |
|---|---|
| `skills/brainstorm/SKILL.md:192` | ✅ 有 |
| `skills/brainstorm/SKILL.md:78` | ❌ 沒有 |
| `skills/design-language/SKILL.md:38` | ❌ 沒有（Task 1 的 files 只列 brainstorm） |

且 Task 1 的負向斷言 grep 的是 `與 \`spec.md\` 同一步寫出`，而 `:78` 寫的是「與**寫** `spec.md` 同一步」——差一個字，`grep -F` 不會命中，改完 `:192` 驗證就回 PASS，但檔案內部自相矛盾。

**更關鍵**：位置放錯。`brainstorm:138` 那節開頭就是「T0 不寫 spec」，而 T0 路徑根本不會執行到那節（`dev-workflow:46`「若 T0 → 直接實作」）。T0 **會**讀到的是 `design-language:38`（0b′ 必載），而那裡寫的是錯的方向。

---

## Major（七條，主 agent 抽驗兩條屬實）

| # | 內容 | 主 agent 複驗 |
|---|---|---|
| M1 | Task 2 的 PowerShell 語法檢查是空包彈，永遠 PASS。`ParseFile` 不丟例外，錯誤寫進第三個 `[ref]` 參數，而 plan 傳 `[ref]$null` 等於丟掉 | ✅ **實測**：語法錯誤的檔案，plan 版回 `exit=0`；接出錯誤的版本回 `ParseError=2, exit=1` |
| M2 | Task 4a「直接餵 JSON」沒給指令，照 plan 現況不可執行。附兩個坑：`$LASTEXITCODE` 要在 pipeline 完整結束後才讀；Windows 沒有 `touch` | 未複驗（C1 已廢） |
| M3 | reviewer 自行補跑 17 個情境，只有一個沒過（路徑結尾帶 `\` 的目錄形式，非實務情境）。建議補進驗收表的：detached HEAD、非 git repo、branch 名特殊字元、**別的專案** | 未複驗（C1 已廢） |
| M4 | fail-open 成立，但成立的理由是「只有一條路走得到 `exit 2`」這個結構事實，不是那三個 `try/catch`。**後果：任何未來加在 `exit 2` 之前的邏輯只要誤判就是硬擋，try/catch 保護不到** | 未複驗（C1 已廢） |
| M5 | 「Task 2 / Task 3 分兩 commit，出事只 revert 後者」是**假的保證**——repo 根的 `settings.json` 不是 Claude Code 讀的檔，是 `setup.ps1` 的同步模板。真正的生效開關是跑 `setup.ps1` | 未複驗（C1 已廢） |
| M6 | 寫死「兩個 hook」的地方實測有五處，plan 只提兩處。漏的：`setup.ps1:484`（跑完給 user 看的結語，會直接說謊）、`README.md:14/:83`、`skills/dispatch-parallel/SKILL.md:127` | ✅ **實測屬實**（C1 廢除後三處仍然正確，不需改） |
| M7 | 「T0 必須開 branch」這條規則沒寫在任何地方，只是靠 `branch-safety` 的副作用推出來的；CLAUDE.md §Docs 落檔 只寫「**T1+** 先 checkout -b」 | 未複驗（C1 已廢） |

## Minor / Nit（五條 + 三條）

reviewer 實測驗證的幾條值得留存，因為它們是**下次寫 PowerShell hook 時會再遇到的**：

- **`Test-Path` / `Push-Location` 沒用 `-LiteralPath`，repo 路徑含 `[ ]` 會壞**：實測 `Push-Location` 對 `...\re[po]\` 直接報找不到路徑（`[po]` 被當 wildcard 字元集）。後果不對稱——`Push-Location` 失敗會讓 git 在別的 repo 跑；`Test-Path` 被 wildcard 吃掉會誤擋。branch 名不會有這問題（`git check-ref-format` 本來就禁 `[`、空白等），但 repo 所在路徑沒人管得住。
- **`Join-Path` 三層巢狀 ＋ branch 含 `/` 實測沒問題**：`Join-Path 'D:\GitHub\bstack' (Join-Path 'docs/work' (Join-Path 'feat/design-lane' '.design-gate'))` → `D:\GitHub\bstack\docs\work\feat\design-lane\.design-gate`，PowerShell 7 會把 `/` 正規化成 `\`。
- **`exit 0` 在 `try/finally` 內，`Pop-Location` 確實會跑**：實測 `try { exit 7 } finally { Pop-Location }` → finally 有執行、exit code 保持 7。
- `$ext.ToLower()` 建議改 `ToLowerInvariant()`（拿掉 culture 依賴）。
- 錯誤訊息 9 行、比 `branch-safety`（2 行）長 4 倍，三支 hook 同時觸發時 stderr 會很擠。

## N/A

dependency / supply-chain、performance / scalability、DB / API —— 皆不涉。

---

## 處置

**user 決定：廢掉 hook，改寫進 `CLAUDE.md` 強制守則（D26）。**

決定的關鍵不只是這三條 Critical，還有 user 提出的一個更根本的問題——**「為什麼需要存在這個 hook？」** 檢視後發現：

1. 既有兩支 hook 防的都是**不可逆傷害**（main 寫入難以乾淨復原、密鑰 commit 不可逆外洩）；design-gate 防的是**可逆的品質問題**（改錯 `git checkout --` 就回來），類別不同。
2. **本系統每一道 gate 都靠 CLAUDE.md 文字而非 hook**——§事實核實、§決策點選單、Tier 判定、§Docs 落檔、§Fail handling 全都是。CEO 視角當初「用『模型會自覺遵守新規則』解『模型不自覺』是循環論證」的論證**證明太多**：照該邏輯 CLAUDE.md 每一條都是循環論證。

user 原話：「我認為開 auto mode 什麼都沒有阻攔到很合理，但只要全域設定內也有說到要檢查的事項，就算不是硬性規定也沒關係，因為整個作業流程的 gate 也是建築在此一基礎之上。」

**這份 review 的價值**：它花一個 agent 的成本，擋掉了一個「會誤傷所有專案、又防不了主要路徑、還會製造假安全感」的東西進入 codebase。
