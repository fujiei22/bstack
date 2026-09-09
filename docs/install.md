# bstack 安裝與環境細節

README 只留最短的裝法；這份是完整版：前置、三種 Claude Code 裝法、個人偏好、Codex 的坑與限制、遷移、移除、驗證。標「實測」的是實際跑出來的結果，其餘是官方文件或推斷。

## 目錄

- [Prerequisites](#prerequisites)
- [Claude Code](#claude-code)
  - [一站式](#一站式)
  - [A. 啟用 plugin](#a-啟用-plugin)
  - [B. 個人偏好（可跳過）](#b-個人偏好可跳過)
  - [C. 開新 session，下指令](#c-開新-session下指令)
  - [確認 plugin 有載入](#確認-plugin-有載入)
  - [從舊版（setup.ps1）遷移](#從舊版setupps1遷移)
- [Codex CLI](#codex-cli)
  - [安裝](#安裝)
  - [有防毒的機器：GitHub 來源會失敗](#有防毒的機器github-來源會失敗)
  - [生效條件](#生效條件)
  - [MCP（mysql / playwright）](#mcpmysql--playwright)
  - [供應鏈與寫入範圍](#供應鏈與寫入範圍)
  - [與 Claude Code 的差異](#與-claude-code-的差異)
  - [已知限制](#已知限制)
  - [從舊版遷移](#從舊版遷移)
- [Hook 的前置：node](#hook-的前置node)
- [什麼時候生效](#什麼時候生效)
- [完全移除](#完全移除)

## Prerequisites

| 項目 | 用途 |
|---|---|
| **Node.js**（含 npx） | **hook 必需**（缺了 hook 起不來、保護不存在，見 [Hook 的前置](#hook-的前置node)）；MCP 也用 |
| **git** | repo 操作 |
| **pwsh 7+** | 只有 `scripts/install.ps1` / `scripts/extras.ps1` / `scripts/install-codex.ps1` 這三支可選腳本、與開發本 repo（`build-references.ps1`）需要 |
| **bash + jq** | 只有選了 statusLine 才需要（`winget install jqlang.jq` / `brew install jq`） |
| **Codex CLI 0.153+** | 只有走 Codex 才需要（`powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 \| iex"`） |

## Claude Code

### 一站式

```pwsh
git clone https://github.com/fujiei22/bstack.git
cd bstack
pwsh -File scripts/install.ps1
```

五步逐一問你：前置檢查 → 清舊 setup.ps1 副本（搬進備份目錄不刪）→ 裝 plugin（問使用者層級 / 目前專案 / 只印試用指令）→ 個人偏好四項逐項選 → 驗證並提醒重開 Claude Code。每步都能跳過；它自己不寫任何檔，寫入都交給 extras.ps1（可 `-Uninstall`）與 claude CLI（可 `/plugin uninstall`）。非互動：`-Yes -Scope user`；只看會做什麼：`-WhatIf`。下面 A / B / C 是它每一步各自的手動版。

### A. 啟用 plugin

三種方式，依推薦順序：

**A1. 專案層級（推薦）**：把 `templates/project-settings.json` 複製成你專案的 `.claude/settings.json`（已有的話把 `extraKnownMarketplaces` 與 `enabledPlugins` 兩段合進去；`permissions` 段自行取捨，它會與你團隊既有的 allow 合併不是覆蓋）。它同時帶了唯讀權限白名單，**這份也是 extras.ps1 白名單的唯一來源**，往裡面加東西前想一下是否也適合使用者層級。

兩件事複製前要知道：
- 白名單裡的 `Bash(cat:*)` / `Bash(head:*)` / `Bash(tail:*)` 是任意檔**讀取**，不受 file-type-guard 保護（hook 只管寫入）。`cat .env` 不會被擋、內容會進對話 context。專案內有密鑰檔的話，把這三條拿掉或改成 `ask`。
- `extraKnownMarketplaces` 指向 `fujiei22/bstack`，Claude Code 的 marketplace source 目前沒有版本 pin，隊友拿到的是該 repo 當下的內容，而 hook 是每次寫檔都會跑的程式碼。要更嚴格就 fork 一份自己管控的 repo、把 `repo` 改成你的。開新 session 後若 `/devwork` 沒反應，手動裝一次：

```
/plugin marketplace add fujiei22/bstack
/plugin install bstack@bstack
```

`bstack@bstack` 不是打錯：前面是 plugin 名、後面是 marketplace 名，剛好一樣。clone 這個專案的隊友是否會被自動安裝 plugin，官方文件沒明說，所以範本與這兩行都留著。

**A2. 使用者層級**：不放範本、直接跑上面兩行。Claude Code 會把 plugin 快取在 `~/.claude/plugins/`、在它自己的 settings 記一筆 `enabledPlugins`。這是 Claude Code 的登記機制，`/plugin uninstall bstack@bstack` 可反悔，**不會覆蓋你任何既有設定**。代價：hook 會在你所有專案生效。

**A3. 試用**：不安裝，只在這個 session 載入：

```bash
git clone https://github.com/fujiei22/bstack.git
claude --plugin-dir ./bstack
```

### B. 個人偏好（可跳過）

plugin 規格帶不了的四項（statusLine、`permissions.allow` 唯讀白名單、`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`、playwright MCP），每項各問一次裝到哪一層：

```pwsh
pwsh -File scripts/extras.ps1
```

- `[u]` 使用者層級（你的 Claude 設定目錄裡的 settings.json）、`[p]` 目前專案 `.claude/settings.json`、`[s]` 跳過（預設）。不選就什麼都不寫。
- MCP 的 `[p]` 寫的是專案根 `.mcp.json`，**會進 git、隊友共用**。mysql MCP 含帳密，腳本只印指令範本讓你自己填。
- 寫入走 merge、先備份、只記真的新增的 key 到 `~/.claude/bstack-extras.json`（本腳本唯一**不經你選擇**就會寫的檔；選 `[u]` 寫的 settings.json 是你選的）。`-Uninstall` 只拆自己加的，你本來就有的不碰。備份檔 `settings.json.bak-<時間>` 是原檔明文快照，若你的 settings 裡放過帳密之類的 `env`，記得定期清。
- 請從 clone 的 repo 跑：statusLine 會指到 `extras/statusline.sh` 的絕對路徑。clone 搬家後重跑、選 statusLine 的 `[r]` 重裝。
- 非互動：`pwsh -File scripts/extras.ps1 -Yes -Items statusLine,env -Scope user`。

### C. 開新 session，下指令

既有 session 不會載入新 plugin，開新的才生效。然後：

```
/bstack:devwork 要做的事
```

裸 `/devwork` 目前也可以（實測 Claude Code 2.1.260 會直接解析），但那是實作行為不是文件保證；打了出現 Unknown command 或載到別的東西，就改打帶前綴的寫法。沒下指令時，Claude Code 就是普通的 Claude Code。

### 確認 plugin 有載入

1. 輸入 `/devwork`，應看到第一行 `[bstack devwork · plugin] 已載入守則。…`。
2. 沒有 → 輸入 `/plugin`，看 bstack 是否列為 enabled；沒有就回 A 裝。
3. 仍沒有 → 用 `claude --plugin-dir <clone 路徑>` 開一個 session 對照：這樣能載就是登記問題，不能載就是 manifest 問題，開 issue 時請附這一步的結果。
4. 看到**第二行** `[已載入 dev-workflow]` → 你機器上還有舊版 setup.ps1 留在 `~/.claude/skills/` 的副本，它遮蔽了 plugin 版。跑 `pwsh -File scripts/extras.ps1 -Migrate`，重開 session。

### 從舊版（setup.ps1）遷移

舊版把 skill / agent / hook / CLAUDE.md 複製進 `~/.claude/`。兩件事會讓新版失效：

- **user 級同名 skill 會遮蔽 plugin skill**：舊版的 `~/.claude/skills/dev-workflow` 還在，`/devwork` 載到的就是舊版。
- **舊版 setup.ps1 留下的 `~/.claude/CLAUDE.md`** 有一句「寫 / 改 / 修 / 加類 prompt 一律進 dev-workflow」，會讓自動攔截復活。

```pwsh
pwsh -File scripts/extras.ps1 -Migrate
```

它會列出舊副本（skills / agents / hooks / statusline / state、settings.json 內指向舊 hook 的條目），只認有 bstack 簽名的檔、同名但你自己寫的不動；確認後**搬進** `~/.claude/bstack-migrate-bak-<時間>/`（不直接刪，誤判可救回）；`~/.claude/CLAUDE.md` 若與 bstack 舊版一致就改名成 `CLAUDE.md.bstack-bak-<時間>`，被你改過的則不動、印出那一行的行號請你自行拿掉。之後重開 session。

## Codex CLI

同一份 skill / hook 也能裝進 Codex CLI（OpenAI）；skill 內文用抽象動詞寫，由 `skills/devwork/hosts.md` 對照到各 host 的實際工具，不是兩份分叉的複本。以下標「實測」的是 2026-09-09 在 Codex CLI 0.153.4 / Windows 11 跑出來的結果。

### 安裝

一站式（推薦）：

```pwsh
git clone https://github.com/fujiei22/bstack.git
cd bstack
pwsh -File scripts/install-codex.ps1
```

它依序做：前置檢查（codex / node / git）→ 列出並搬走 `~/.agents/skills/` 的舊同名副本（搬進備份目錄、不刪）→ `codex plugin marketplace add` + `codex plugin add` → 複製 `codex/agents/*.toml` 到 `~/.codex/agents/` → 在 `~/.codex/config.toml` 開 `tools.update_plan`。非互動 `-Yes`；只印會做什麼 `-WhatIf`；改用本機來源 `-Source local`（把這個 clone 的目前 branch 精簡 clone 到 `~/.codex/bstack-src` 當 marketplace root，見下一節為什麼）。後兩步不做也能用，只是降級：subagent 退成內建 `explorer`、任務追蹤退成勾 checkbox。

手動只裝 plugin（等同上面第三步）：

```
codex plugin marketplace add fujiei22/bstack
codex plugin add bstack@bstack
```

`bstack@bstack` 不是打錯：前面是 plugin 名、後面是 marketplace 名，剛好一樣。Codex 讀的是 `.agents/plugins/marketplace.json`（實測：`codex plugin list --json` 回的 `installPolicy` / `authPolicy` 只有這份 manifest 有，legacy 的 `.claude-plugin/marketplace.json` 沒有）。

**本機來源為什麼是精簡 clone、不是 working tree 本身**（都是實測）：`codex plugin add` 會**複製 marketplace root 底下全部檔案**，連 `.gitignore` 掉的目錄都抄——直接指 working tree 就是 7,621 個項目、144 MB、約 60 秒，然後複製完立刻 rename 進 cache 時撞 `failed to activate plugin cache entry: 存取被拒 (os error 5)`（連續 4 次失敗）。只帶版控檔的 clone 是 27 MB，一次就過。`-Source local` 因此固定用 `~/.codex/bstack-src` 這份精簡 clone；`-Uninstall` 會連它和 marketplace 條目一起拆。

### 有防毒的機器：GitHub 來源會失敗

有防毒即時掃描的機器，GitHub 來源每次都失敗（實測 Trellix Endpoint Security）：`codex plugin marketplace add fujiei22/bstack` 回 `failed to install marketplace at ~/.codex/.tmp/marketplaces/bstack: 存取被拒 (os error 5)`。根因實測：`git clone` 完的目錄在約 10 秒內 rename 都會被拒（掃描器還抓著剛寫入的檔），Codex 是 clone 完立刻 rename，所以連續 5 次都撞、重跑也沒用；`plugin add` 對大樹的失敗是同一個機制，樹小到掃描趕得上 rename 就過。這種機器手動裝法：

```
git clone https://github.com/fujiei22/bstack.git
codex plugin marketplace add <clone 的絕對路徑>      # 剛 clone 下來的乾淨樹、沒有 ignored 目錄
codex plugin add bstack@bstack
```

`install-codex.ps1` 偵測到這個錯誤會自動改走精簡 clone。要根治只能請 IT 把 `~/.codex` 加進掃描排除。

### 生效條件

三件事都要，缺一件就有東西不生效：

| 條件 | 沒做會怎樣 |
|---|---|
| 開**新** session | 既有 session 不會載入新 plugin |
| 在新 session 跑 `/hooks` 信任 bstack 的 PreToolUse | hook 完全不跑：branch safety 與 file-type 硬規則都不存在。安裝腳本代不了你信任（信任綁 hook 內容的 hash，設計上要人審） |
| `tools.update_plan.enabled = true` | 任務追蹤工具叫不動（官方文件：Codex 0.152 起預設關）。`install-codex.ps1` 會寫；手動裝要自己開，沒開時流程退成用 spec 施工清單 / plan.md 自身的勾選格 |

裝好後在 Codex 打：

```
$bstack:devwork 要做的事
```

實測：28 個 skill 在模型看到的清單裡全叫 `bstack:<name>`，所以呼叫名帶 `bstack:` 前綴。

### MCP（mysql / playwright）

流程裡兩個 skill 靠 MCP：`db-access` 用 `mcp__mysql__mysql_query`（rules.md §DB 操作 的唯讀查詢），`frontend-test` 用 `mcp__playwright__browser_*`（e2e）。工具名的格式兩個 host 一樣：`mcp__<server 名>__<工具>`，所以 **server 名必須恰為 `mysql` 與 `playwright`**，取別的名字 skill 就找不到工具。

Claude Code 這邊由 `extras.ps1` 幫你加 playwright、印 mysql 的指令範本；Codex 這邊沒有對應腳本（含帳密、不該由腳本寫），自己跑：

```
# playwright（版本 pin 到 2026-09-09 實測的 0.0.68；@latest 也行）
codex mcp add playwright -- npx -y @playwright/mcp@0.0.68

# mysql：用唯讀帳號，三個 ALLOW_* 預設就是 false、明寫只是為了看得見
codex mcp add mysql --env MYSQL_HOST=127.0.0.1 --env MYSQL_PORT=3306 --env MYSQL_USER=<唯讀帳號> --env MYSQL_PASS=<密碼> --env MYSQL_DB=<庫名> --env ALLOW_INSERT_OPERATION=false --env ALLOW_UPDATE_OPERATION=false --env ALLOW_DELETE_OPERATION=false -- npx -y @benborla29/mcp-server-mysql

codex mcp list        # 兩個都要是 enabled
```

已經在 `~/.codex/config.toml` 裡但 `enabled = false` 的，把那行改成 `true`（或刪掉那行）就好，不用重 add。`codex/agents/*.toml` 裡也有同一組範本（註解掉的 `[mcp_servers.*]`），那是給你想把 MCP 綁在單一 agent 上時用的，一般不用碰。

### 供應鏈與寫入範圍

- marketplace source **沒有版本 pin**（跟 Claude Code 那邊同一個問題）：`codex plugin add` 拿到的是 `fujiei22/bstack` 當下的內容，而 hook 是每次寫檔都會跑的程式碼。要更嚴格就 fork 一份自己管控的 repo，把來源改成你的。
- `install-codex.ps1` 只寫兩個地方：`~/.codex/agents/`（6 個 agent 的 TOML）與 `~/.codex/config.toml` 的一個 `[tools.update_plan]` 表（改前先備份成 `.bak-<時間>`）。寫過什麼記在 `~/.codex/bstack-codex.json`，`pwsh -File scripts/install-codex.ps1 -Uninstall` 照這份記錄拆，不碰你其他 Codex 設定。

### 與 Claude Code 的差異

| 做什麼 | Claude Code | Codex |
|---|---|---|
| 決策點問你 | `AskUserQuestion` | `request_user_input`（官方標 experimental；不可用時退成文字列選項、你回編號） |
| 任務追蹤 | `TaskCreate` | `update_plan`（要先開 `tools.update_plan.enabled`） |
| 派 subagent | `Agent` | `spawn_agent` |
| code review | 內建 `/code-review` | read-only 的 reviewer subagent |
| MCP 工具名 | `mcp__<server>__<tool>` | 同格式 |
| memory 路徑 | 見 `skills/devwork/hosts.md` §Memory 路徑 | 同左，路徑依 host 不同 |
| 停用 plugin | `/plugin disable bstack@bstack` | `/plugins` 選 bstack 按 Space（hook 另需 `/hooks` 信任才會跑） |

完整對照（含「工具不在清單時」的退路）在 `skills/devwork/hosts.md`。

### 已知限制

- **Codex 的 IDE extension 不支援 plugin**（官方文件），只有 CLI 裝得起來。
- **沒有 Agent Teams**：多個 subagent 平行跑可以，但「隊友之間互相對話、你中途切進去改方向」那套只有 Claude Code 有。
- **shell 寫檔兩個 host 都攔不到**：hook 只看寫檔工具（Claude Code 的 Write / Edit、Codex 的 `apply_patch`），繞道 shell 重導向寫檔一律放行。
- **reviewer 覆蓋面比較低**：Claude Code 走內建 code-review 的 8 個 finder，Codex 這邊是一個 read-only reviewer subagent。
- **agent TOML 的 `sandbox_mode = "read-only"` 不一定生效**：實測 `codex exec`（不論 `-s workspace-write` 或 `-c sandbox_mode=…`）spawn 出來的 `security-auditor` 拿到父 session 的 workspace-write、真的把檔改掉了；`model` 與 `developer_instructions` 有載入。官方文件說父 turn 有 runtime 覆寫（`/permissions`、`--yolo`、CLI 旗標）時子 agent 一律沿用父的；互動 session 沒覆寫時才用檔內值——這條沒法非互動驗，當作「唯讀 agent 的唯讀性在 Codex 上靠自律」。
- **`request_user_input` 在 `codex exec` 沒有**：實測 `$bstack:devwork` 走到 Phase 0a 時模型自己判「工具不在清單」、改成編號選項讓你回數字（hosts.md §決策點 的退路），Trace 標籤照印。互動 session 是否有這個工具未實測。
- **Codex 不把 exit 2 當 block**（Windows 實測：exit 2 + stderr、或 exit 2 + stdout JSON 都照寫檔，只認 stdout JSON `permissionDecision: "deny"` + exit 0）。guard.mjs 用兩個訊號判 Codex（payload 帶 Codex 專屬的 `turn_id`、或 `tool_name` 是 `apply_patch`，任一成立）：Codex 走 JSON deny、Claude Code 維持官方的 exit 2。
- **本機 marketplace 間歇 `os error 5`**（見上，重跑即可）。

### 從舊版遷移

`~/.agents/skills/` 裡若還有舊版 bstack 副本（實測本機有 `dev-workflow` / `db-access` / `huashu-design`），Codex **不合併、兩份並列**出現在 skill 清單裡，而舊版 `dev-workflow` 是關鍵詞自動攔截版、會搶先觸發。

```pwsh
pwsh -File scripts/install-codex.ps1 -Migrate
```

它列出符合的舊副本並搬進 `~/.agents/bstack-migrate-bak-<時間>/`（不刪，誤判可救回）。`~/.codex/AGENTS.md` 是你的全域指示檔，腳本只警告不動——裡面若有「寫 / 改 / 修 / 加一律進 dev-workflow」這類句子，自己拿掉，否則自動攔截照樣復活。

## Hook 的前置：node

一支 PreToolUse hook（`hooks/guard.mjs`，兩段檢查）由 plugin 的 `hooks/hooks.json` 註冊，在**啟用 plugin 的專案一律生效、不需要 `/devwork`**。每次寫檔會起一個 node 程序：實測（node 22、Windows 11）repo 內的檔約 0.45 秒（含一次 `git rev-parse`）、repo 外約 0.27 秒。

**hook 需要 `node` 在啟動 Claude Code / Codex 的環境 PATH 內**（`node --version` 驗；macOS 從 Dock 開的 app 不一定吃到 brew 的 PATH）。兩個 host 都是 native binary、不自帶 node。缺了會怎樣：Claude Code 官方 hooks 文件說 hook 起不來會印一行 non-blocking 通知、工具照跑；Windows 實測（2026-09-07，`claude -p` stream-json）連通知都沒有、檔案照寫——**保護一樣不存在**。

| 段 | 用途 |
|---|---|
| **branch-safety 段** | 命中 `main / master / production / prod / release` 直接 block 寫入動作，訊息附開 branch 的做法；只管 project repo 底下的檔（Codex 的 apply_patch 相對路徑一律視為 repo 內） |
| **file-type 段** | 按副檔名 / 路徑分流：密鑰類硬擋；migration / lockfile / CI / infra / shell config 類先擋，二次確認後由 AI 用 `node hooks/guard.mjs --token <path>` 在系統 temp 建一次性 token 放行；**不看 repo 範圍**，`~/.gitconfig` 也擋 |

Codex 實測（2026-09-09，`codex exec --dangerously-bypass-hook-trust`）：Codex 會帶 `CLAUDE_PLUGIN_ROOT` 呼叫這支 hook，main 上的 `apply_patch` 被擋、feature branch 放行、`.env` BLOCK、一個 patch 兩個敏感檔給兩行 token 指令。企業設定 `allow_managed_hooks_only` 會整批跳過 plugin hook。

## 什麼時候生效

| 東西 | 生效範圍 |
|---|---|
| hook（`guard.mjs` 兩段） | 啟用 plugin 的專案，**所有 session**，不需要 `/devwork`（Codex 另需 `/hooks` 信任） |
| rules.md 守則與九階段流程 | 只在 `/devwork` / `$bstack:devwork` 之後、那個 session 內 |
| extras 四項 | 你在選單選的層級 |

## 完全移除

| 指令 | 拆什麼 | 不碰什麼 |
|---|---|---|
| `/plugin uninstall bstack@bstack` | Claude Code：plugin 核心（skills / agents / hooks / 守則） | 你的 settings、extras 寫的東西 |
| `pwsh -File scripts/extras.ps1 -Uninstall` | extras 加過的 key 與 playwright MCP（依 manifest） | 你本來就有的同名設定 |
| `pwsh -File scripts/extras.ps1 -Migrate` | 舊版 setup.ps1 留在 `~/.claude/` 的副本 | 你自己的 skill / hook / 被改過的 CLAUDE.md |
| `pwsh -File scripts/install-codex.ps1 -Uninstall` | Codex：plugin、agents TOML、config 的 `[tools.update_plan]` 表 | 你的其他 Codex 設定、marketplace 條目 |
