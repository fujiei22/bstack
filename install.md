# Superpowers + gstack 整合安裝使用手冊

> 環境：Windows + PowerShell
> 前提：Claude Code 已安裝、用過
> 整合策略：superpowers 為骨幹、gstack 選用補強、CLAUDE.md 為最高優先底線

---

## 目錄

1. [事前準備](#1-事前準備)
2. [安裝 superpowers](#2-安裝-superpowers)
3. [安裝 gstack（選用 skill 模式）](#3-安裝-gstack選用-skill-模式)
4. [部署 CLAUDE.md](#4-部署-claudemd)
5. [建立 Branch safety hook](#5-建立-branch-safety-hook)
6. [完整安裝驗證](#6-完整安裝驗證)
7. [日常使用流程](#7-日常使用流程)
8. [常見問題與排錯](#8-常見問題與排錯)
9. [升級與維護](#9-升級與維護)

---

## 1. 事前準備

### 1.1 確認 Claude Code 版本

```powershell
claude --version
```

需要 **2.0.13 以上**（superpowers 的 plugin 系統需求）。版本不夠先升級：

```powershell
npm install -g @anthropic-ai/claude-code
```

### 1.2 確認必要工具

```powershell
# 都要有
git --version
node --version    # 建議 v20 以上
npm --version
```

### 1.3 確認 PowerShell 執行政策

hook 腳本（.ps1）需要能執行。檢查：

```powershell
Get-ExecutionPolicy
```

若回 `Restricted`，改成 `RemoteSigned`：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 1.4 確認 Claude 目錄存在

```powershell
Test-Path $HOME\.claude
```

若 `False`，先隨便開一次 Claude Code 讓它自己建。

---

## 2. 安裝 superpowers

### 2.1 加入 marketplace

開一個新的 Claude Code session：

```powershell
claude
```

在 Claude Code 裡執行：

```
/plugin marketplace add obra/superpowers-marketplace
```

成功會顯示 marketplace 已加入。

### 2.2 安裝 superpowers plugin

接著：

```
/plugin install superpowers@superpowers-marketplace
```

### 2.3 重啟 Claude Code

**重要：必須完全退出再開**（不是 reload）。

```powershell
# 在 Claude Code 裡
/exit

# 然後重開
claude
```

### 2.4 驗證 superpowers 啟用

新 session 開頭應該看到類似這段注入訊息：

```
<session-start-hook><EXTREMELY_IMPORTANT>
You have Superpowers. **RIGHT NOW, go read**:
@~/.claude/plugins/cache/Superpowers/skills/getting-started/SKILL.md
</EXTREMELY_IMPORTANT></session-start-hook>
```

或執行 `/help` 應該看到新指令：

- `/superpowers:brainstorm`
- `/superpowers:write-plan`
- `/superpowers:execute-plan`

看到任一條就是裝好了。

---

## 3. 安裝 gstack（選用 skill 模式）

### 3.1 Clone 到 Claude skills 目錄

退出 Claude Code 後在 PowerShell 執行：

```powershell
# 確保父目錄存在
New-Item -ItemType Directory -Force -Path "$HOME\.claude\skills"

# Clone
cd $HOME\.claude\skills
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git
```

### 3.2 跑 setup（用 --prefix 模式）

```powershell
cd $HOME\.claude\skills\gstack
```

gstack 的 `setup` 是 shell script，Windows 上用 `bash` 跑（需要 Git Bash 或 WSL bash）：

```powershell
bash ./setup --prefix
```

`--prefix` 會把 slash command 全部前綴成 `/gstack-xxx`，避免跟 superpowers 撞名。

> **如果沒有 bash**：裝 Git for Windows（會附帶 Git Bash），或手動執行 setup 內的步驟（看 setup 腳本內容、把 symlink / 檔案複製改成 PowerShell 的 `New-Item -ItemType SymbolicLink`）。建議直接裝 Git for Windows，省事。

### 3.3 setup 後手動精簡 skills

gstack 預設會啟用全部 20 幾個 skill，我們只要 5 個。檢查 `.claude/skills/gstack/` 下的 skill 目錄：

```powershell
Get-ChildItem $HOME\.claude\skills\gstack\skills
```

**保留**這幾個目錄（其他用不到的可以留著、靠 CLAUDE.md 規則約束 Claude 不去呼叫，但若想徹底乾淨可刪）：

- `codex` → `/gstack-codex`
- `cso` → `/gstack-cso`
- `freeze` → `/gstack-freeze`
- `careful` → `/gstack-careful`
- `retro` → `/gstack-retro`（看習慣）

> 建議**先不刪**，只靠 CLAUDE.md 的「不啟用」清單約束 Claude，跑一陣子確定不會誤觸再刪。

### 3.4 驗證 gstack 啟用

重啟 Claude Code，執行 `/help`，應該能看到 `/gstack-codex`、`/gstack-cso` 等指令。

---

## 4. 部署 CLAUDE.md

### 4.1 決定放置位置

兩種放法：

| 位置 | 適用 | 說明 |
| --- | --- | --- |
| `$HOME\.claude\CLAUDE.md` | 全域預設 | 所有專案共用 |
| `<專案根>\CLAUDE.md` | 單一專案 | 蓋過全域，專案優先 |

建議**先放全域**，特殊專案再放專案版蓋過。

### 4.2 放檔案

把前面整合好的 CLAUDE.md 放到目標位置：

```powershell
# 全域
Copy-Item .\CLAUDE.md $HOME\.claude\CLAUDE.md

# 或專案
Copy-Item .\CLAUDE.md C:\path\to\project\CLAUDE.md
```

### 4.3 驗證 Claude Code 有讀到

開 Claude Code：

```powershell
claude
```

問它：

```
你的對話風格設定是什麼？
```

如果回「繁中台灣用語、caveman lite 級」之類的，就是讀到了。

---

## 5. 建立 Branch safety hook

你的 CLAUDE.md 寫到 `.claude/hooks/branch-safety.ps1`，需要實際建出這個檔案。

### 5.1 建目錄

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\.claude\hooks"
```

### 5.2 建立 hook 腳本

把以下內容存成 `$HOME\.claude\hooks\branch-safety.ps1`：

```powershell
# branch-safety.ps1
# PreToolUse hook：寫入動作前檢查當前 branch
# 命中保護 branch → 回傳非零 exit code 讓 Claude Code 擋下

$ErrorActionPreference = "Stop"

# 從 stdin 讀 hook payload（Claude Code 規格）
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json

# 只攔 Write / Edit / NotebookEdit
$toolName = $payload.tool_name
if ($toolName -notin @("Write", "Edit", "NotebookEdit")) {
    exit 0
}

# 取得當前 branch
try {
    $branch = git rev-parse --abbrev-ref HEAD 2>$null
} catch {
    # 非 git repo 不擋
    exit 0
}

if (-not $branch) { exit 0 }

# 保護 branch 清單
$protected = @("main", "master", "production", "prod", "release")

if ($branch -in $protected) {
    Write-Host "BLOCKED: 目前在保護 branch ($branch)，禁直接寫入。" -ForegroundColor Red
    Write-Host "處置：先 git checkout -b <new-branch> 再 retry。" -ForegroundColor Yellow
    exit 2  # exit 2 = Claude Code block
}

exit 0
```

### 5.3 註冊 hook

編輯 `$HOME\.claude\settings.json`（沒有就建）：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "pwsh -NoProfile -File \"%USERPROFILE%\\.claude\\hooks\\branch-safety.ps1\""
          }
        ]
      }
    ]
  }
}
```

> 如果用 Windows PowerShell 5.x（而非 PowerShell 7+），把 `pwsh` 改成 `powershell`。

### 5.4 驗證 hook

在某個 git repo 切到 main：

```powershell
cd C:\some\repo
git checkout main
claude
```

在 Claude Code 裡叫它改檔：

```
幫我在 README.md 加一行 "test"
```

預期：Claude Code 嘗試 Write/Edit 時被 hook 擋下，Claude 收到 block 訊息後會走 `AskUserQuestion` 問你 branch 名。

---

## 6. 完整安裝驗證

跑一遍 checklist 確認全部 OK：

### 6.1 元件清單

```powershell
# superpowers 裝好
Test-Path "$HOME\.claude\plugins\cache\Superpowers"

# gstack 裝好
Test-Path "$HOME\.claude\skills\gstack"

# CLAUDE.md 就位
Test-Path "$HOME\.claude\CLAUDE.md"

# hook 就位
Test-Path "$HOME\.claude\hooks\branch-safety.ps1"

# settings.json 含 hook 註冊
Get-Content "$HOME\.claude\settings.json" | Select-String "branch-safety"
```

全部回 `True` / 有東西 = 過。

### 6.2 行為驗證

開新 session：

```powershell
claude
```

依序測：

**測 1：CLAUDE.md 讀到**
```
請列出本對話的強制守則有哪幾條
```
應該列出 §Task 追蹤 / §決策點選單 / Branch safety / PII 安全底線 / DB 操作。

**測 2：superpowers 自動觸發**
```
我想做一個簡單的 todo CLI 工具
```
應該觸發 brainstorming，問你 spec 而不是直接寫 code。

**測 3：gstack 選用範圍**
```
請列出本對話允許用的 gstack skills
```
應該只列 `/gstack-codex` `/gstack-cso` `/gstack-freeze` `/gstack-careful` `/gstack-retro`。

**測 4：決策點走 AskUserQuestion**
spec 確認階段，Claude 應該用 `AskUserQuestion` 給選項，**不是**「這樣 OK 嗎請回 yes/no」。

**測 5：Branch safety hook**
在保護 branch 上叫它改檔，應該被擋下。

5 項都過 = 整合成功。

---

## 7. 日常使用流程

### 7.1 標準 feature 開發流

```
[1] 開新 session，描述你要做什麼
        ↓
[2] superpowers brainstorming 自動觸發
    Claude 用 AskUserQuestion 問 spec
        ↓
[3] spec 定案 → superpowers write-plan
    Claude 用 AskUserQuestion 確認 plan
        ↓
[4] plan 定案 → 你手動觸發 /gstack-cso
    （動架構 / 認證 / 資料層才需要，trivial 跳過）
        ↓
[5] 開新 branch（hook 會擋 main → AskUserQuestion 取名）
        ↓
[6] superpowers execute-plan 跑 TDD
    每個 task 進 TaskCreate/TaskUpdate
        ↓
[7] superpowers subagent review
        ↓
[8] /gstack-codex 跑跨模型 second opinion
        ↓
[9] superpowers finishing-a-development-branch 收尾
    squash merge → PR（commit 走繁中格式）
```

### 7.2 動 prod / 敏感模組

```
[1] 進 session 先 /gstack-freeze 鎖定編輯範圍
[2] /gstack-careful 開危險指令防呆
[3] 跑標準流程
[4] 結束 /gstack-unfreeze 解鎖
```

### 7.3 安全稽核

```
[1] 動架構前：/gstack-cso 跑 OWASP + STRIDE
[2] 修完安全議題後再進 superpowers 流程
```

### 7.4 週回顧

每週五或 sprint 結束：

```
/gstack-retro
```

會產 lines changed / commits / patterns / 改進建議。

### 7.5 trivial 任務豁免

單行修 typo / 改設定值 / 改 README 錯字這種小事，可以直接叫 Claude 做，不用走 superpowers 全套——但你的 CLAUDE.md 強制守則（task tracking、AskUserQuestion gate、branch safety、PII、DB）**仍然適用**。

---

## 8. 常見問題與排錯

### Q1: superpowers 沒自動觸發 brainstorming

**原因 A**：session-start hook 沒注入。重啟 Claude Code（完全退出再開，不是 reload）。

**原因 B**：plugin 沒裝成功。檢查：

```powershell
Test-Path "$HOME\.claude\plugins\cache\Superpowers\skills\getting-started\SKILL.md"
```

回 `False` 就是沒裝好，重跑 §2。

### Q2: gstack slash command 找不到

**原因 A**：setup 沒跑或跑失敗。重跑：

```powershell
cd $HOME\.claude\skills\gstack
bash ./setup --prefix
```

**原因 B**：忘了 `--prefix`，指令變成 `/codex` 而不是 `/gstack-codex`。重跑加 `--prefix`。

### Q3: Branch safety hook 沒擋住

**檢查 1**：hook 註冊路徑對不對

```powershell
Get-Content "$HOME\.claude\settings.json"
```

**檢查 2**：手動跑一遍腳本看會不會錯

```powershell
'{"tool_name":"Write"}' | pwsh -NoProfile -File "$HOME\.claude\hooks\branch-safety.ps1"
echo $LASTEXITCODE  # 在 main 上應該回 2
```

**檢查 3**：PowerShell 版本。`pwsh` 是 PS 7+，若你只裝 PS 5.x，settings.json 裡改用 `powershell`。

### Q4: Claude 用自由文字當 gate 信號（違反規則）

CLAUDE.md 「§決策點選單」那條的措辭可以再加重。把：

> **禁文字 token NLP 判斷**

改成：

> **禁文字 token NLP 判斷（任何來源、任何階段、無例外）**

並把該條規則複製一份到 superpowers 段落結尾再強調。

### Q5: superpowers / gstack 的 commit 訊息變英文

CLAUDE.md「Commit 訊息格式（繁中）」那條已經寫到 plugin 也適用，但 Claude 偶爾還是會忘。處置：

- session 開頭加一句：「所有 commit 一律用繁中、本文件格式」
- 或在 CLAUDE.md 那段加強：「Plugin skill 自動 commit **發現英文格式立刻 amend 改繁中**」

### Q6: DB 操作 plugin skill 還是想用 bash mysql

CLAUDE.md 已經寫了，但若 Claude 還是嘗試，session 開頭重申：

```
本 session DB 存取一律 mysql MCP，禁 bash CLI（含任何 plugin skill）
```

### Q7: gstack setup 在 Windows 跑不起來（bash 找不到）

裝 Git for Windows：<https://git-scm.com/download/win>，安裝時記得勾「Git Bash」。裝完重開 PowerShell，`bash --version` 應該能跑。

### Q8: 太多 plugin command 在 /help 看起來很雜

不裝 gstack 不要的 skills。如 §3.3 所述，可以把 `$HOME\.claude\skills\gstack\skills\` 底下不用的 skill 目錄刪掉（建議先備份 gstack 整個目錄再刪）：

```powershell
# 備份
Copy-Item -Recurse $HOME\.claude\skills\gstack $HOME\.claude\skills\gstack.bak

# 刪不要的（範例：刪 office-hours）
Remove-Item -Recurse $HOME\.claude\skills\gstack\skills\office-hours
```

### Q9: 我想暫時關掉 superpowers 試純 Claude Code

```
/plugin disable superpowers
```

要開回來：

```
/plugin enable superpowers
```

---

## 9. 升級與維護

### 9.1 升級 superpowers

```
/plugin update superpowers
```

或直接：

```
/plugin marketplace update obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

升級後重啟 Claude Code。

### 9.2 升級 gstack

```powershell
cd $HOME\.claude\skills\gstack
git pull
bash ./setup --prefix
```

### 9.3 更新 CLAUDE.md

直接編輯 `$HOME\.claude\CLAUDE.md`。修改後下一個新 session 就會生效（當前 session 不會中途重讀）。

### 9.4 升級 hook

直接編輯 `$HOME\.claude\hooks\branch-safety.ps1`。下個工具呼叫就會用新版。

### 9.5 全部備份

定期備份這幾個位置：

```powershell
$backupDir = "$HOME\claude-backup-$(Get-Date -Format yyyyMMdd)"
New-Item -ItemType Directory -Force -Path $backupDir

Copy-Item $HOME\.claude\CLAUDE.md $backupDir\
Copy-Item $HOME\.claude\settings.json $backupDir\
Copy-Item -Recurse $HOME\.claude\hooks $backupDir\
# plugin 跟 gstack 都能重裝，不一定要備
```

### 9.6 完全重置

如果想砍掉重練：

```powershell
# 移除 superpowers
# 在 Claude Code 裡：/plugin uninstall superpowers

# 移除 gstack
Remove-Item -Recurse $HOME\.claude\skills\gstack

# 移除 CLAUDE.md
Remove-Item $HOME\.claude\CLAUDE.md

# 移除 hook
Remove-Item $HOME\.claude\hooks\branch-safety.ps1
# 並編輯 settings.json 拿掉 hook 註冊
```

然後重跑 §2 ~ §5。

---

## 附錄：快速指令速查

| 行為 | 指令 |
| --- | --- |
| 開始新 feature | 直接描述需求，superpowers 會接手 |
| 規劃前做安全稽核 | `/gstack-cso` |
| 跑 TDD | superpowers 自動，無需手動觸發 |
| Code review | superpowers 自動 + 手動跑 `/gstack-codex` |
| 動 prod 防呆 | `/gstack-freeze` + `/gstack-careful` |
| 解除防呆 | `/gstack-unfreeze` |
| 週回顧 | `/gstack-retro` |
| 收尾 PR | superpowers `finishing-a-development-branch` |
| 看可用指令 | `/help` |
| 暫停 plugin | `/plugin disable <name>` |

---

**最後一個提醒**：第一週跑的時候不要趕進度，挑 1-2 個 trivial feature 跑完整流程練手感。重點觀察 superpowers brainstorming 的 gate 是不是真的走 `AskUserQuestion`、TDD commit 訊息是不是繁中、Branch safety hook 有沒有實際擋住。發現 plugin 行為跟 CLAUDE.md 衝突時，回去 §8 對應條目調 CLAUDE.md 措辭——這是個漸進收斂的過程，不會一次到位。