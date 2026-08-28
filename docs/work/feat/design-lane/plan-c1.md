# 設計 lane 階段 C1（最小 gate）Implementation Plan

> 對應 spec: `docs/work/feat/design-lane/spec.md`（階段序 A → **C1** → B → C2）
> 前一階段: `plan.md`（階段 A，已完成並上線）／`verify-stage-a.md`（階段 A 驗收記錄）
> Track: Dev | Tier: T2
> 建立: 2026-08-28
> 並行最大 group: 4（**全序列，無同 group 多 task**）

**Goal**：讓 spec 的 **S2** 從「靠自覺」變成「機械保證」——動任何前端檔之前，若這支 branch 沒跑過 0b′ UI 面判定，就擋下來。

**Tier 判定**：4 個檔、單一關注點 → **T2**。但**風險等級高於一般 T2**：它新增一個會 `exit 2` 的 hook，且會裝到全域 `~/.claude/`，影響這台機器上每一個專案。故驗收比一般 T2 嚴（見 Task 4）。

**Architecture**：
- `hooks/design-gate.ps1`：PreToolUse(`Write`|`Edit`)，與既有兩個 hook 掛同一個 matcher block。
- **判定條件只有一個**（D25）：`docs/work/<branch>/.design-gate` 存不存在。存在＝這支 branch 跑過 0b′ ＝ 放行。
- **「大改是否已出三方向」的檢查不在 C1**，那需要 spec 的定案方向段格式（階段 B 才定），屬 C2。
- **Fail-open 原則**：hook 自身出任何錯（JSON 解析失敗、git 失敗、路徑解析失敗）一律 `exit 0` 放行。沿用 `branch-safety.ps1` 的既有哲學——「hook 不該因自身錯誤 block」。

**逃生門（D25）**：**沒有。** 唯一的解鎖方式就是跑一次 0b′。
理由：`Write`/`Edit` hook 收到的 JSON 只有 `file_path` 與內容，**沒有地方 inline 帶環境變數**（上游那個 hook 攔的是 Bash 指令才做得到）；skip 檔會 sticky 且藏在 `.gitignore` 裡看不見；skip 欄位依賴 `.design-gate` 先存在，而「檔根本不在」正是最常被擋的情境。
**誤擋時的唯一出路**：手動改 `~/.claude/settings.json` 拿掉那條 hook。這條要寫進 hook 的錯誤訊息裡。

**Tech Stack**：PowerShell 7（與既有兩個 hook 一致）。無新依賴。

**Risks**：
- **這個 hook 會擋你自己的編輯**。它一裝上，任何前端檔的 `Write`/`Edit` 在沒跑過 0b′ 的 branch 上都會被擋。緩解：Task 4 先用**直接餵 JSON** 的方式測完六種情境，確認不誤擋，才裝到全域。
- **T0 洞（D24）**：`brainstorm` 原本規定 `.design-gate` 與 `spec.md` 同一步寫，而 T0 不寫 spec → T0 永遠沒有 gate 檔 → 永遠被擋。Task 1 先修掉這個，再裝 hook。**順序不可顛倒。**
- `settings.json` 的 `hooks` 是 `setup.ps1` 的 RepoOwned key（以 repo 為準強制覆蓋），所以只改本機無效、必須改 repo 版。

---

## §Hook 判定邏輯（Task 2 的規格）

```
輸入：stdin JSON（tool_name / tool_input.file_path）

1. tool_name ∉ {Write, Edit}                      → exit 0
2. JSON 解析失敗 / 取不到 file_path                → exit 0（fail-open）
3. file_path 副檔名 ∉ §前端副檔名                  → exit 0
4. file_path 不在 $CLAUDE_PROJECT_DIR 之下         → exit 0（全域 / 外部檔）
5. 非 git repo / git 失敗                          → exit 0（fail-open）
6. branch ∈ {main,master,production,prod,release}  → exit 0
      （branch-safety 已擋，不重複擋、不發出第二個訊息混淆）
7. branch = "HEAD"（detached）                     → exit 0（無法定路徑，fail-open）
8. <repo>/docs/work/<branch>/.design-gate 存在      → exit 0
9. 以上皆非                                        → exit 2 + 訊息
```

**前端副檔名**（與 `design-language` §前端副檔名 對齊，暫不含 `.sass`，見 spec §待釐清 5）：
`.css` `.scss` `.tsx` `.jsx` `.vue` `.svelte` `.html`

**branch 名轉路徑**：照原樣保留 `/` 為目錄層（`feat/design-lane` → `docs/work/feat/design-lane/`）。與 `frontend-test` §branch-name fallback 鏈 `:106` 的既有規則一致。

---

## Task 1: 修 T0 洞 —— `.design-gate` 落檔改綁 `involved`

**parallel-group**: 1
**files**:
- modify: `skills/brainstorm/SKILL.md`（§spec 文件結構與落檔 的落檔句）

**必須排在 Task 2 之前**：hook 裝上去之前這個洞就要補好，否則 T0 的前端改動會被永久擋死。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=skills/brainstorm/SKILL.md; ok=1
for p in \
  "不論 Tier" \
  "T0 也要寫" \
  "T0 仍不寫 spec.md" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
grep -qF "與 \`spec.md\` 同一步寫出" "$f" && { echo "MISS: 舊的「與 spec.md 同一步」措辭應已改掉"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL
# 本次拉紅：3 條正向 + 1 條負向（「與 `spec.md` 同一步寫出」現存於 brainstorm:192）
```

- [ ] **Step 3: 寫內容**

把 §spec 文件結構與落檔 內現有的那句：

```markdown
**`design.involved=true` 時**：與 `spec.md` 同一步寫出 `docs/work/<branch-name>/.design-gate`（KEY=VALUE，內容為 `design:` 六欄 ＋ `decided_at`）。**不進版控**（`.gitignore` 已排除）。此檔是階段 C1 的 gate hook 唯一輸入。
```

改成：

```markdown
**`design.involved=true` 時**：在 branch 建立後寫出 `docs/work/<branch-name>/.design-gate`（KEY=VALUE，內容為 `design:` 六欄 ＋ `decided_at`）。**不進版控**（`.gitignore` 已排除）。此檔是 `hooks/design-gate.ps1` 的唯一輸入。

🔴 **這個檔綁 `involved`、不論 Tier**——**T0 也要寫**（T0 仍不寫 `spec.md`，但 gate 檔照寫）。
理由：hook 的規則是「檔不在就擋」，若沿用「與 spec 同一步」，T0 永遠不會產生此檔 → T0 的前端改動會被永久擋死，而 T0 正是「改 1 行 / typo / 純設定值」這類最常見的小改。
T0 要改 repo 內的前端檔本來就得先開 branch（否則 `branch-safety.ps1` 先擋），開了 branch 就寫得出這個檔。
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1 指令，Expected: PASS

- [ ] **Step 5: commit**

```bash
git add skills/brainstorm/SKILL.md
git commit -m "fix: .design-gate 落檔改綁 involved 不綁 Tier

T0 不寫 spec，若沿用「與 spec 同一步」規則，T0 的前端改動
永遠不會產生 gate 檔，裝上 C1 hook 後會被永久擋死。"
```

---

## Task 2: 新增 `hooks/design-gate.ps1`

**parallel-group**: 2
**files**:
- create: `hooks/design-gate.ps1`

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && f=hooks/design-gate.ps1; ok=1
test -f "$f" || { echo "MISS: 檔案不存在"; ok=0; }
for p in \
  ".design-gate" \
  "fail-open" \
  "設計 lane gate" \
  "0b′" \
  "settings.json" ; do
  grep -qF "$p" "$f" 2>/dev/null || { echo "MISS: $p"; ok=0; }
done
# 語法檢查（不執行，只解析）
pwsh -NoProfile -Command "\$null = [System.Management.Automation.Language.Parser]::ParseFile('$PWD/$f', [ref]\$null, [ref]\$null); if (\$?) { exit 0 } else { exit 1 }" 2>/dev/null || { echo "MISS: PowerShell 語法解析失敗"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，檔案不存在 + 5 條字串 MISS
# 本次拉紅：全部（含語法檢查，因檔案不存在）
```

- [ ] **Step 3: 寫內容**

建立 `hooks/design-gate.ps1`：

```powershell
#!/usr/bin/env pwsh
<#
.SYNOPSIS
  PreToolUse hook — 設計 lane gate：沒跑過 UI 面判定就不准改前端檔。

.DESCRIPTION
  Claude Code 呼叫 Write / Edit 前先跑此 hook。
    - 只管前端副檔名（.css .scss .tsx .jsx .vue .svelte .html）；其餘 exit 0。
    - 檢查 <repo>/docs/work/<branch>/.design-gate 存不存在。
      該檔由 brainstorm §Phase 0b′ 在 branch 建立後寫出，代表這支 branch
      已經跑過 UI 面判定（知道改的是哪一區、那一區的設計語言長什麼樣）。
    - 檔不在 → exit 2 阻擋。

  為什麼要這個 hook：設計 lane 的規則全寫在 markdown 裡給 AI 看，AI 會不會照做
  不保證。這是唯一「不照做就真的動不了」的機制。

  **沒有逃生門**（設計決策，非疏漏）：Write / Edit hook 收到的 JSON 只有
  file_path 與內容，沒有地方 inline 帶環境變數；skip 檔會 sticky 且藏在
  .gitignore 裡看不見。解鎖方式就是跑一次 0b′——那本來就是想要的行為。
  誤擋（hook 自身 bug）時的唯一出路：手動改 ~/.claude/settings.json 拿掉本 hook。

  fail-open：本 hook 自身出任何錯（JSON 解析 / git / 路徑解析失敗）一律 exit 0
  放行。沿用 branch-safety.ps1 的哲學——hook 不該因自身錯誤 block。
#>

$ErrorActionPreference = 'Continue'

# === stderr UTF-8 setup（避免 Claude Code 收到 CP950 亂碼）===
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$errStream = [Console]::OpenStandardError()
$err = New-Object System.IO.StreamWriter $errStream, $utf8NoBom
$err.AutoFlush = $true

function Write-Err { param([string]$msg) $err.WriteLine($msg) }

# 前端副檔名（與 design-language §前端副檔名 對齊；.sass 暫不收，見 spec §待釐清 5）
$frontendExt = @('.css', '.scss', '.tsx', '.jsx', '.vue', '.svelte', '.html')

# --- 讀 stdin event payload ---
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }

$targetPath = $null
try {
    $payload = $raw | ConvertFrom-Json
    switch ($payload.tool_name) {
        'Edit'  { $targetPath = $payload.tool_input.file_path }
        'Write' { $targetPath = $payload.tool_input.file_path }
        default { exit 0 }   # NotebookEdit 等一律放行
    }
} catch {
    exit 0   # fail-open：解析失敗不該 block
}
if (-not $targetPath) { exit 0 }

# --- 只管前端副檔名 ---
$ext = [System.IO.Path]::GetExtension($targetPath)
if ($frontendExt -notcontains $ext.ToLower()) { exit 0 }

# --- 確認在 project dir 內（全域 / 外部檔放行）---
$repo = $env:CLAUDE_PROJECT_DIR
if (-not $repo) { $repo = (Get-Location).Path }
try {
    $absTarget = [System.IO.Path]::GetFullPath($targetPath)
    $absRepo   = [System.IO.Path]::GetFullPath($repo).TrimEnd('\', '/')
    $prefixWin = ($absRepo + [System.IO.Path]::DirectorySeparatorChar).ToLower()
    $prefixAlt = ($absRepo + '/').ToLower()
    if (-not $absTarget.ToLower().StartsWith($prefixWin) -and
        -not $absTarget.ToLower().StartsWith($prefixAlt)) {
        exit 0
    }
} catch {
    exit 0   # fail-open
}

Push-Location $repo
try {
    $branch = git rev-parse --abbrev-ref HEAD 2>$null
    if ($LASTEXITCODE -ne 0) { exit 0 }        # 非 git repo，放行
    if ($branch -eq 'HEAD') { exit 0 }         # detached HEAD，無法定路徑，放行

    # 主分支交給 branch-safety 擋，本 hook 不重複發訊息
    if ($branch -match '^(main|master|production|prod|release)$') { exit 0 }

    # branch 名照原樣當路徑，'/' 保留為目錄層（同 frontend-test §branch-name fallback 鏈）
    $gatePath = Join-Path $repo (Join-Path 'docs/work' (Join-Path $branch '.design-gate'))
    if (Test-Path $gatePath) { exit 0 }

    Write-Err "[DESIGN-GATE] 這支 branch ('$branch') 尚未跑過 UI 面判定，禁止改前端檔。"
    Write-Err "  改動目標：$targetPath"
    Write-Err "  缺少檔案：docs/work/$branch/.design-gate"
    Write-Err ""
    Write-Err "處置：載入 brainstorm skill 跑 §Phase 0b′ UI 面判定（載 design-language），"
    Write-Err "      判定完在 branch 上寫出 .design-gate，再 retry 這個 tool call。"
    Write-Err "      0b′ 對純後端改動是零成本的（副檔名比對不中就結束）。"
    Write-Err ""
    Write-Err "本 hook 沒有逃生門（設計決策）。若確認是 hook 自身誤擋，"
    Write-Err "唯一出路是手動改 ~/.claude/settings.json 移除 design-gate.ps1 那條。"
    exit 2
}
finally {
    Pop-Location
}
```

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1 指令，Expected: PASS

- [ ] **Step 5: commit**

```bash
git add hooks/design-gate.ps1
git commit -m "feat: 加入 design-gate hook（尚未註冊生效）

沒跑過 0b′ UI 面判定就不准改前端檔。本 commit 只加檔、
不改 settings.json，所以還不會生效。"
```

---

## Task 3: 註冊 hook 並讓 `setup.ps1` 同步它

**parallel-group**: 3
**files**:
- modify: `settings.json`（`hooks.PreToolUse[0].hooks` 加第三條）
- modify: `scripts/setup.ps1`（`$singleFiles` 加 `hooks/design-gate.ps1`）

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && ok=1
grep -qF "hooks/design-gate.ps1" settings.json || { echo "MISS: settings.json 未註冊"; ok=0; }
grep -qF "hooks/design-gate.ps1" scripts/setup.ps1 || { echo "MISS: setup.ps1 \$singleFiles 未加"; ok=0; }
python -c "import json,io,sys; d=json.load(io.open('settings.json',encoding='utf-8-sig')); c=[h['command'] for e in d['hooks']['PreToolUse'] for h in e['hooks']]; sys.exit(0 if len(c)==3 else 1)" || { echo "MISS: PreToolUse 應有 3 條 hook command"; ok=0; }
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗**

```bash
# Expected: FAIL，3 條全 MISS（現況 PreToolUse 只有 2 條 command）
```

- [ ] **Step 3: 寫內容**

**改動 1 — `settings.json`**，在 `file-type-guard.ps1` 那條之後加入：

```json
          {
            "type": "command",
            "command": "pwsh -NoProfile -File \"${CLAUDE_PROJECT_DIR}/hooks/design-gate.ps1\""
          }
```

**改動 2 — `scripts/setup.ps1`** 的 `$singleFiles` 陣列，在 `file-type-guard.ps1` 那列之後加入：

```powershell
        @{ Src = 'hooks/design-gate.ps1';        Dst = 'hooks/design-gate.ps1' }
```

並同步更新 `Show-BackupWarning` 的檔案清單（現列兩個 hook，改列三個）與 `.SYNOPSIS` 的說明區塊。

- [ ] **Step 4: 跑驗證確認通過** — 同 Step 1 指令，Expected: PASS

- [ ] **Step 5: commit**

```bash
git add settings.json scripts/setup.ps1
git commit -m "feat: 註冊 design-gate hook 並納入 setup.ps1 同步清單"
```

---

## Task 4: 驗收（V3 ＋ V10）

**parallel-group**: 4
**files**:
- create: `docs/work/feat/design-lane/verify-stage-c1.md`

**驗收順序不可顛倒**：先用**直接餵 JSON** 的方式在隔離狀態下測完六種情境，確認不誤擋，**再**跑 `setup.ps1` 裝到全域。

- [ ] **Step 1: 寫驗證指令**

```bash
cd "$(git rev-parse --show-toplevel)" && ok=1
test -f docs/work/feat/design-lane/verify-stage-c1.md || { echo "MISS: 驗收記錄未落檔"; ok=0; }
for p in "V3" "V10" "情境 1" "情境 6" "exit 2" "exit 0" ; do
  grep -qF "$p" docs/work/feat/design-lane/verify-stage-c1.md 2>/dev/null || { echo "MISS(verify): $p"; ok=0; }
done
[ $ok = 1 ] && echo PASS || echo FAIL
```

- [ ] **Step 2: 跑驗證確認失敗** — Expected: FAIL，7 條全 MISS

- [ ] **Step 3: 執行驗收**

**4a — 隔離測試（直接餵 JSON，不裝）**：六種情境各餵一次，記錄實際 exit code。

| # | 情境 | 輸入 | 預期 |
|---|---|---|---|
| 1 | 前端檔 ＋ 無 gate 檔 | `{"tool_name":"Edit","tool_input":{"file_path":"<repo>/docs/css/styles.css"}}` | **exit 2** |
| 2 | 前端檔 ＋ 有 gate 檔 | 同上，但先 `touch docs/work/<branch>/.design-gate` | exit 0 |
| 3 | 非前端檔 | `file_path` 指向 `<repo>/README.md` | exit 0 |
| 4 | repo 外的檔 | `file_path` 指向 `~/.claude/skills/foo/SKILL.md` | exit 0 |
| 5 | 非 Write/Edit | `{"tool_name":"NotebookEdit",...}` | exit 0 |
| 6 | 壞 JSON | 非 JSON 字串 | exit 0（fail-open） |

**4b — 裝到全域**：跑 `pwsh scripts/setup.ps1 -Yes`。
⚠️ **這一步會讓 hook 對這台機器上每一個專案生效**，執行前需 user 明確同意。

**4c — V10 回歸**：setup 跑完確認既有行為未壞——26 skill、**3** hook、6 agent、`permissions.allow` 24 條、`env`、`/config` 寫的本機 key（`skipWorkflowUsageWarning`、`autoMode`）全部保留。

**4d — 實地測（V3）**：在本 branch 實際 `Edit` 一個前端檔。
本 branch **有** `.design-gate` 嗎？——階段 A 的 0b′ 判定沒有落檔（那時規則還是「與 spec 同一步」且 spec 早已寫完），所以**沒有**。故預期：第一次 Edit 會被擋 → 補寫 `.design-gate` → 再 Edit 成功。**這正好是最真實的驗收情境。**

**4e — 落檔**：把 4a-4d 的實際 exit code 與輸出寫進 `verify-stage-c1.md`。

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
| 1 | Task 1 | `skills/brainstorm/SKILL.md` |
| 2 | Task 2 | `hooks/design-gate.ps1`（new） |
| 3 | Task 3 | `settings.json`、`scripts/setup.ps1` |
| 4 | Task 4 | 驗收記錄 |

**全序列，每 group 1 task** → `execute-plan` 不需載 `dispatch-parallel`。
依賴鏈：Task 1 先補 T0 洞（否則 hook 一裝就把 T0 擋死）→ Task 2 寫 hook 但不生效 → Task 3 才讓它生效 → Task 4 驗收。**這個順序讓「hook 存在」與「hook 生效」分成兩個 commit，出事可以只 revert 後者。**

---

## §Self-review

**1. spec coverage**

| spec 項 | 對應 | 狀態 |
|---|---|---|
| S2 hook 機械保證 | Task 2、3、4 | ✅ 本階段的全部目的 |
| V3 hook 真的擋 | Task 4（4a 隔離測 ＋ 4d 實地測） | ✅ |
| V10 setup 不壞既有行為 | Task 4c | ✅ |
| D24 T0 洞 | Task 1 | ✅ |
| D25 無逃生門 | Task 2（寫進 hook 註解與錯誤訊息） | ✅ |
| 大改方向驗證 | —— | ⚠️ **階段 C2**（需 B 的 spec 定案方向段格式） |
| `setup.ps1` 孤兒偵測 | —— | ⚠️ **階段 C2** |

**2. placeholder 掃**：無。Task 2 的 hook 是完整可執行的 PowerShell，非骨架。

**3. 型別一致**：前端副檔名清單與 `design-language` §前端副檔名 逐項相同（7 個，不含 `.sass`）。`.design-gate` 路徑格式與 `brainstorm` §spec 落檔、`.gitignore` 的 `**/.design-gate` 一致。

**4. 並行性檢查**：全序列，無同 group 多 task。

**5. scope 檢查**：4 個檔全部在 spec §影響檔案 表內（`hooks/design-gate.ps1` / `settings.json` / `scripts/setup.ps1` 標 C1；`skills/brainstorm/SKILL.md` 原標 A，本階段因 D24 再改一次——這是階段 A 埋下、C1 引爆的洞，已在 D24 記錄）。
