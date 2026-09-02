# bstack

繁中台灣用語、零 marketplace 依賴的 Claude Code 開發流程包。

讓 Claude Code 自動走完整 9 階段開發流程（brainstorm → plan → execute → verify → review → security → finish → pr-explain → retro），並支援自動 Track / Tier 分流、subagent 隔離、TDD 紅綠循環、PR 自動解釋落檔。

---

## Features

- **9 階段 dev-workflow** — 任何「寫 / 改 / 修 / 加」類 prompt 自動進主流程，依 **Track**（Bug / Dev）+ **Tier**（T0–T3）決定嚴格度
- **CLAUDE.md 強制守則** — Task 追蹤、決策點 `AskUserQuestion` 全面取代自由文字 gate、Branch safety、File-type 硬規則、PII 安全底線、DB 唯讀政策
- **Subagent 隔離** — review / 安全稽核 / e2e / hypothesis 驗證跑獨立 context，避免重 tool 噪音與球員兼裁判
- **Hooks** — `branch-safety`（protected branch 寫入 block）、`file-type-guard`（密鑰 / migration / lockfile / CI / infra 自動把關）
- **Trace 標籤** — 每輪 AI 回覆結尾貼 `[Trace] Phase=… | Tier=… | Track=… | Skill=…`，phase 透明、隨時可審
- **設計 lane** — 動前端檔前先讀該區既有的設計語言、從實際檔案抄值；新頁 / 改版先出三個方向讓你挑，選定才落 code
- **繁中台灣用語** — 對話 / 註解 / commit / PR 全繁中，英文專有名詞（brainstorm / Tier / TDD / PR）保留原文

---

## Skills（28）

### Phase 主流程

| Skill | 在幹嘛 |
|---|---|
| **brainstorm** | 動工前先把需求問清楚、順便判斷這個 task 大不大、是新功能還是修 bug |
| **write-plan** | 把要做的事拆成一條條 task、落成計畫文件 |
| **review-plan** | 計畫寫好後找不同視角再 review 一遍 |
| **execute-plan** | 照計畫一條條做下去 |
| **tdd-cycle** | 寫實作前先寫測試、看到失敗再寫 code |
| **verify-done** | 收尾前跑一遍 test / lint / build、確認沒弄壞東西 |
| **request-review** | 改完 code 派 reviewer 看一遍 |
| **receive-review** | 處理 reviewer 回饋，小問題自動修、敏感的改動會問你 |
| **security-audit** | 改動涉認證 / 資料層 / 敏感邏輯時跑一輪安全稽核 |
| **security-checklist** | 寫敏感 code（auth / 上傳 / payment）對著 checklist 一條條檢查 |
| **finish-branch** | 把 branch 收尾、push、開 PR |
| **pr-explain** | PR 開完後另外寫一份「為什麼這樣改」的解說文件 |

### 跨流程 / 觸發式

| Skill | 在幹嘛 |
|---|---|
| **debug-systematic** | 修 bug 用的固定步驟，從重現到防回歸 |
| **incident-investigate** | 線上 incident 找根因用、可以平行驗多個假設 |
| **design-language** | 動前端檔前先查這塊屬於哪套設計語言、把實際的色碼字級抄出來 |
| **design-direction** | 新頁或改版時產三個差異化方向、附真實視覺讓你選 |
| **frontend-test** | 改前端時用 Playwright 跑 e2e |
| **db-access** | 動 DB / 寫 SQL 時的規範（唯讀、量限、PII 要 mask） |
| **cmd-guard** | 跑危險指令前（rm -rf / drop / force push）跳出來叫你二次確認 |
| **safety-guard** | 輸出前掃 PII / 密鑰，避免落到 log / commit |
| **lock-files** | 標某些檔禁改，避免不小心動到 |
| **context-snapshot** | 進度太長想換 session 時把狀態存下來 |
| **context-resume** | 把上次存的進度讀回來繼續做 |
| **zh-humanize** | 去掉中文的 AI 味、校正中國用語與半形標點；載入不等於改寫，沒點選就不動字 |

### Meta

| Skill | 在幹嘛 |
|---|---|
| **dev-workflow** | 整套流程的主入口、決定該走哪些 phase |
| **dispatch-parallel** | 多個 task 可以同時做時，派 subagent 平行跑 |
| **retro** | 回顧一段期間做了什麼，從中歸納 user 偏好寫回 memory |
| **write-skill** | 想自己加新 skill 時的範本與規格 |

---

## Agents（6）

獨立 context 跑的 subagent、跟主對話隔開，避免重 tool 噪音或球員兼裁判：

| Agent | 在幹嘛 |
|---|---|
| **db-reviewer** | 專門看 DB schema / migration / SQL 改得對不對 |
| **frontend-e2e-runner** | 跑 Playwright e2e 的專人、把 browser 那一大堆 log 隔在自己 context 裡 |
| **hypothesis-tester** | incident 調查時一個 agent 驗一個假設、互不知對方在驗什麼 |
| **lang-reviewer** | 依改的檔自動派發、按語言抓對應的 idiom 跟 pitfall（python / TS / SQL / Go …） |
| **pr-explainer** | PR 開完重新讀一遍 diff、把為什麼這樣改寫成詳盡解說 |
| **security-auditor** | 用獨立 context 跑 OWASP / STRIDE / PII 安全稽核 |

---

## Hooks

| Hook | 用途 |
|---|---|
| **branch-safety.ps1** | PreToolUse hook，命中 `main / master / production / prod / release` 直接 block 寫入動作 |
| **file-type-guard.ps1** | PreToolUse hook，按副檔名 / 路徑分流：密鑰禁 commit、migration 載 db-access、lockfile 二次確認、CI / infra 自動升 T2 |

---

## 安裝

### Prerequisites

| 項目 | 用途 |
|---|---|
| **git** | repo 操作 |
| **jq** | `statusline.sh` 解 JSON 重度依賴（`winget install jqlang.jq` / `choco install jq` / `scoop install jq`） |
| **Node.js + npx** | 兩個 MCP 透過 `npx -y` 執行 |
| **MySQL** | mysql MCP 連線目標（local 或 remote、可選） |

### Step 1 — Clone

```bash
git clone https://github.com/fujiei22/bstack.git
cd bstack
```

### Step 2 — Sync skill pack → `~/.claude/`

```pwsh
pwsh -File scripts/setup.ps1
```

動作（檔案**直接覆蓋、不備份**；先手動備份既有 `~/.claude/` 內容再跑）：

- `CLAUDE.md`、`statusline.sh` → `~/.claude/`
- `hooks/*.ps1` → `~/.claude/hooks/`
- `skills/<name>/SKILL.md`（及附屬檔）→ `~/.claude/skills/<name>/`
- `agents/*.md` → `~/.claude/agents/`
- `settings.json` → `~/.claude/settings.json`（**merge、非覆蓋**，見下）
- `settings.json` 內 `${CLAUDE_PROJECT_DIR}` 自動轉 global 絕對路徑

`settings.json` 的 merge 語意（**本機優先**，避免洗掉 `/config` 寫的設定）：

| 區塊 | 誰為準 |
|---|---|
| `hooks`、`statusLine` | repo（同步 hook 路徑正是本腳本目的） |
| `permissions.*`（含 `allow` / `deny` / `ask` 陣列） | 本機既有值原封保留 |
| 其他所有 key（`model` / `theme` / `defaultMode` / …） | 本機既有值原封保留 |
| 本機沒有的 key | 補上 repo 的值（新機器仍拿到完整設定） |

含意：改 repo 的 `permissions.allow` **不會**再同步到已裝過的機器；要更新請手動編 `~/.claude/settings.json`（或刪掉該區塊後重跑）。單機臨時權限建議寫 `~/.claude/settings.local.json`——本腳本完全不碰該檔。

### Step 3 — 裝兩個 MCP

兩個 MCP 都裝到 user scope。

#### 3a. mysql MCP（[@benborla29/mcp-server-mysql](https://www.npmjs.com/package/@benborla29/mcp-server-mysql)）

搭配 `db-access` skill 的「MCP 唯讀、寫操作交付 SQL 給 user」政策，**全部 ALLOW 設 false**：

```bash
claude mcp add mysql --scope user --env MYSQL_HOST=127.0.0.1 --env MYSQL_PORT=3306 --env MYSQL_USER=<your-readonly-user> --env MYSQL_PASS=<your-password> --env ALLOW_INSERT_OPERATION=false --env ALLOW_UPDATE_OPERATION=false --env ALLOW_DELETE_OPERATION=false -- npx -y @benborla29/mcp-server-mysql
```

**強烈建議**用一個 `唯獨` 權限的 DB user，雙保險。

#### 3b. playwright MCP（[@playwright/mcp](https://www.npmjs.com/package/@playwright/mcp)）

供 `frontend-test` skill + `frontend-e2e-runner` agent 跑 e2e：

```bash
claude mcp add playwright --scope user -- npx -y @playwright/mcp@latest
```

#### 驗證

```bash
claude mcp list
```

應看到：

```
mysql: npx -y @benborla29/mcp-server-mysql - ✓ Connected
playwright: npx -y @playwright/mcp@latest - ✓ Connected
```

### Step 4 — 開新 session

既有 Claude Code session **不會**載入新 skill；開新 session 才生效。

---

## License

[MIT License](LICENSE) © 2026 Tommy Sian
