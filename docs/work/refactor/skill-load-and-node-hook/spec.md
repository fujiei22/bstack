# 效率優化三項：design-language 延遲載入、dev-workflow 去重、hook 改 node

> Track: Dev | Tier: T3 | 建立: 2026-09-07
> 硬前提（user 明訂）：**流程邏輯零改變**。每一項都要能證明「判定結果 / 擋不擋 / 走哪條路」與改前一字不差。

## 動機 / Why

實測數字（2026-09-07，main 8dbb203）：
- 一條 T2 路徑必載 10 份 skill + rules.md ≈ 118 KB；其中 `design-language` 17 KB 每個 task 必載，只為它使用契約第 1 步那個零成本的副檔名比對——純後端 task 載完立刻回 `involved=false` 結束
- `dev-workflow` 重貼 brainstorm 的 Track / Tier heuristic 兩張表與 rules.md 的 Tier 自動升級段，Phase 0 執行時 brainstorm 一定已載入，dev-workflow 那份從來不是判定依據
- 兩支 pwsh PreToolUse hook 每次 Write / Edit 合計 **3.2 秒**（`pwsh -NoProfile` 啟動占 90%），一支 PR 約 60 次編輯 → 3 分鐘純等待；且 pwsh 不在 PATH 時**靜默失效**（memory `reference_claude_code_plugin_facts`）。node 空啟動 0.37 秒

## 目標 / Success criteria

1. **design-language 延遲載入**：brainstorm 0b′ 自己做副檔名比對（清單與「剔除 `skills/<name>/SKILL.md` 定義目錄」規則都**內嵌**在 brainstorm、不引用——不命中的情境正是沒載 design-language），不命中 → `design: {involved:false, scope:null, scope_evidence:null, size:null, precedent:false, map_status:unknown}` 直接進 0c、**不載** design-language；命中才載，並照它的使用契約從第 1 步跑（重算 involved 必為 true）。契約 P11 驗 brainstorm / design-language / rules.md 三處清單一致；verify-done §漏網複查 是 brainstorm 自判漏掉時的兜底
2. **dev-workflow 去重**：刪 §Phase 0 入口分流 底下的 Track / Tier heuristic 兩張表與「Tier 自動升級」段，改一行指回 `brainstorm §Phase 0c` / `§Phase 0d`；其餘（Phase 0 圖、路徑圖、hand-off 母版、跨流程表）不動
3. **hook 改 node**：`hooks/guard.mjs` 一支取代 `branch-safety.ps1` + `file-type-guard.ps1`，hooks.json 一個 command；擋的條件逐條移植（見 §等價清單）。**兩段都跑、兩邊訊息都印、任一 block 就 exit 2**——官方 hooks 文件：同 matcher 多個 hook 平行執行、stderr 合併、任一 exit 2 就 block，所以與現況等價。缺 node：官方文件說 hook 起不來是 non-blocking、印通知、**工具照跑、保護不存在**；Windows 是否真的印通知本 PR 實測一次再寫進文案（memory 記的是缺 pwsh 時完全靜默）
4. 對照測試：同一組約 26 個 stdin payload 餵舊 pwsh（從 git 8dbb203 取）與新 node，`max(舊 branch exit, 舊 file-type exit) == 新 exit`、stderr `[bstack]` 標記集合（目前在 / BLOCK / WARN / state dir）相等、WARN 案兩邊印的 token 路徑相等、token 案跑完 token 已刪且 consumed.log 多一行；結果表進 §施工紀錄。契約新增 P2d（import 純函式對 26 個 fixture）與 P2e（真 spawn 兩案）永久守
5. 三支驗證全綠：`plugin-contract`（含 `--selftest`）、`docs-site-contract`、`build-references -Check`；動 `skills/` 的檔跑守門快照（scratch `slim-guard.mjs`，基線 8dbb203）：使用契約步驟數 / 選單 / § 白名單 / 反引號零差異（brainstorm 0b′ 步驟數允許 4 → 4，只改內容）
6. 每次編輯 hook 總時間 3.2 秒 → ≤0.5 秒（實測寫進施工紀錄）

## 範圍 / Scope

**包含**：`skills/brainstorm/SKILL.md`（0b′）、`skills/design-language/SKILL.md`（frontmatter description「必載」與 §與 dev-workflow 銜接 那列改「命中才載」）、`skills/dev-workflow/SKILL.md`（去重 + 跨流程表 design-language 列）、`skills/devwork/rules.md`（§設計語言對齊 判定句、§Branch safety / §File-type 的檔名與「缺 pwsh 靜默失效」豁免句）、`hooks/guard.mjs`（新）、`hooks/hooks.json`、刪兩支 `.ps1`、`scripts/plugin-contract.mjs`（P2a ≥2 → ≥1、P2b / P2c / P4 檔名、新 P2d fixture、P11 副檔名清單一致）、`README.md`（hooks 表、pwsh 必需段、Prerequisites）、`docs/index.html`（第 128 行一句文字節點）、`scripts/install.ps1`（hook 提醒句）、`docs/js/data.js`（HBranch / HFile / LoadDLang 三個 label）、五個 skill 的檔名引用（brainstorm:57、design-direction:37、design-language:38、finish-branch:170、dispatch-parallel:136）、`docs/js/references-data.js` 重產。

**排除**：`scripts/extras.ps1` 第 411 行的舊 hook 檔名清單不動——那是 `-Migrate` 用來清 setup.ps1 時代裝在 `~/.claude/hooks/` 的舊副本，檔名就是舊的；security-audit 純文件跳（第 4 項）另開 PR；SKILL.md 拆 references 不做（DX 視角點名過 references 可能不被讀）。

## 影響檔案 / Codebase impact

| 檔 | 改動 | 契約 / 風險 |
|---|---|---|
| `hooks/guard.mjs` | 新，約 150 行 | P2b / P2c / P2d；重寫是本 PR 最大風險，靠對照測試 |
| `hooks/hooks.json` | 兩 command → 一 | P2a 門檻改 ≥1 |
| `hooks/*.ps1` | 刪 | P4 掃描清單改 |
| `skills/brainstorm/SKILL.md` | 0b′ 四步改寫（步驟數不變） | P9b 不碰；守門快照 |
| `skills/design-language/SKILL.md` | description 一句、§與 dev-workflow 銜接 一列 | frontmatter description 改動：P3c 只驗「觸發：」 |
| `skills/dev-workflow/SKILL.md` | 刪 20 行表、跨流程表一列 | P9c / P10b 讀的行不動 |
| `skills/devwork/rules.md` | 三處措辭 | P6 驗 §事實核實 標題在；P9a Tier 表不動 |
| `scripts/plugin-contract.mjs` | P2 系列改、新 P2d / P11 | 先紅後綠 |
| `README.md` / `docs/index.html` / `scripts/install.ps1` | pwsh 必需 → 只 extras / install 需要；hook 需 node | P8 計數不動；index.html 純文字節點 |
| `docs/js/data.js` | 3 個 label | C8a 節點 / 邊數不變 |
| 5 個 skill 檔名引用 | `branch-safety.ps1` → `guard.mjs（branch-safety）` | 守門快照反引號片段：新增片段要列白名單說明 |

## 設計方向

`design.involved=true`（`docs/index.html` 在改動檔內）、`size=小改`、`scope=文件站`、`scope_evidence=docs/css/styles.css`、`map_status=absent`（本 repo 無 design-map.md）。**但**改動是第 128 行一句文字節點，rules.md §設計語言對齊 豁免：不碰 token / class / 屬性，四項對齊檢查 N/A。verify-done：diff 含 `docs/js/data.js`（.js）→ `text-only-diff.mjs` 依規則判 NOT-TEXT-ONLY → T3 派 frontend-e2e-runner 跑 docs 站（index + flow 兩頁）。**不豁免、不用 --ignore**（data.js 不是產出器重產的檔）。

## §等價清單（hook 移植逐條對照）

| # | 舊行為（ps1） | 新（guard.mjs） |
|---|---|---|
| B1 | 只攔 Write / Edit / NotebookEdit（`notebook_path`）；其他 tool exit 0；tool_name 比對**大小寫不敏感**（pwsh switch 預設） | 同 |
| B2 | JSON 壞 → exit 0。**但** stdin 空、或 Write / Edit 沒有 `tool_input` / `file_path`：branch 段**跳過 scope check 直接查 branch**（main 上 exit 2）；file-type 段 exit 0 | 同（零改變照搬） |
| B3 | repo = `$CLAUDE_PROJECT_DIR`，沒有就 cwd | 同 |
| B4 | 目標檔絕對路徑不在 repo 底下（大小寫不敏感、兩種分隔符）→ exit 0 | 同（`path.resolve` + toLowerCase） |
| B5 | `git rev-parse --abbrev-ref HEAD` 失敗（非 git / 無 commit / git 不在 PATH）→ exit 0 | 同 |
| B6 | branch ∈ main / master / production / prod / release（**大小寫不敏感**，`Main` / `RELEASE` 也擋）→ stderr 三行 + exit 2 | 同，三行原文、`/i` |
| F1 | 豁免 `.env.example / .sample / .template / .dist` | 同 |
| F2 | BLOCK 9 個 pattern（.env*、.key、.pem、.crt、.p12、.pfx、/credentials.、/id_rsa*、/id_ed25519*）→ stderr 三行 + exit 2、無 token | 同，regex 逐字搬、大小寫不敏感（ps1 的 -match 本來就是） |
| F3 | WARN 22 個 pattern → 有 token（不論過期）刪 token + 寫 consumed.log（布林印 `True/False`）；未過期 exit 0、過期或無 token → exit 2 + 七行指示 | 同；token 建立指令改 `node "<guard.mjs>" --token "<tokenPath>"`、兩個路徑印**正斜線**（Bash tool 會吃反斜線）——stderr 唯一允許差異 |
| F4 | token 路徑 = `<XDG_RUNTIME_DIR 或 tmp>/bstack-file-guard-<USERNAME 或 USER 或 user>/<sha256(normalized) 前 16 hex>.token`，TTL 300s；tmp 依 .NET GetTempPath 順序：win32 `TMP → TEMP → USERPROFILE`、其他 `TMPDIR → /tmp` | 同（自己讀 env 照 .NET 順序，**不用** os.tmpdir()，它的順序是 TEMP → TMP） |
| F5 | state dir 建不起來 → stderr 一行 + exit 2 | 同 |
| F6 | normalized = 反斜線→斜線、小寫 | 同 |
| C1 | 兩支獨立 hook 平行跑（官方文件），各自可 exit 2，Claude 看到兩邊 stderr 合併 | 一支：兩段都跑、兩邊訊息都印、任一 block → exit 2；唯一差別是 stderr 順序從不定變固定（branch 先）。既有怪癖保留：main 上改 Dockerfile 且有 token → file 段吃掉 token、branch 段 block，開完 branch 要重建 token |
| C2 | stderr UTF-8 無 BOM | node 預設 UTF-8 |
| C3 | 缺 pwsh → 靜默失效（memory 實測 Windows） | 缺 node → 官方文件說印 non-blocking 通知、工具照跑；本機實測見施工紀錄，rules.md 豁免句照實測寫 |
| C4 | **file-type 段不看 repo scope**：repo 外的 `~/.gitconfig` / `~/.npmrc` 也 WARN（§File-type 列 shell config 的用意）；只有 branch 段有 B4 的 repo 外放行 | 同——B4 只 early-return branch 段，file-type 段照跑 |
| D1 | **刻意差異**：`CLAUDE_PROJECT_DIR` 指到不存在的目錄——ps1 `Push-Location` 失敗後 git 在原 cwd 跑、結果依 cwd 而定 | node spawn 失敗 → catch → branch null → 放行 |

## 風險與 trade-off

- **hook 重寫是唯一有真實風險的項目**：靠 16+ 個 payload 對照測試與永久契約 P2d 守。等價的是 exit code 與 block / warn 分類，stderr 措辭允許差一個字（token 指令那行）。
- **brainstorm 多了一段比對邏輯**：0b′ 從 4 步仍是 4 步，但第 1 步的內容從「載入」變「比對；命中才載入」。清單雙寫靠契約 P11 守一致。
- **node 是新依賴**：官方 `/setup` 文件明說 Claude Code 是 native binary、**不自帶 node**（npm 裝法也只是下載 binary）。推斷（未量）：開發者環境有 node 的機率高於 pwsh 7，尤其 macOS / Linux 上 pwsh 罕見，所以是往好的方向換依賴；但公開文案不得寫「一律有 node」。install.ps1 前置檢查加 node。
- **frontend-e2e-runner 這輪要真跑**：docs 站兩頁，成本約一個 agent；這是規則要求，也順便驗剛 merge 的 text-only-diff 在真實 PR 上的行為。

## 待釐清

- 無（本次）。**記錄不修**：`git rev-parse --abbrev-ref HEAD` 在 branch 名有歧義時回 `heads/main`，舊新兩邊都放行（都錯）；`hook-equivalence.mjs` 靠 `git show 8dbb203:` 取舊檔，未來 rewrite history 就跑不了，屬預期。
