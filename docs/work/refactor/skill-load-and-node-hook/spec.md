# 效率優化三項：design-language 延遲載入、dev-workflow 去重、hook 改 node

> Track: Dev | Tier: T3 | 建立: 2026-09-07
> 硬前提（user 明訂）：**流程邏輯零改變**。每一項都要能證明「判定結果 / 擋不擋 / 走哪條路」與改前一字不差。

## 動機 / Why

實測數字（2026-09-07，main 8dbb203）：
- 一條 T2 路徑必載 10 份 skill + rules.md ≈ 118 KB；其中 `design-language` 17 KB 每個 task 必載，只為它使用契約第 1 步那個零成本的副檔名比對——純後端 task 載完立刻回 `involved=false` 結束
- `dev-workflow` 重貼 brainstorm 的 Track / Tier heuristic 兩張表與 rules.md 的 Tier 自動升級段，Phase 0 執行時 brainstorm 一定已載入，dev-workflow 那份從來不是判定依據
- 兩支 pwsh PreToolUse hook 每次 Write / Edit 合計 **3.2 秒**（`pwsh -NoProfile` 啟動占 90%），一支 PR 約 60 次編輯 → 3 分鐘純等待；且 pwsh 不在 PATH 時**靜默失效**（memory `reference_claude_code_plugin_facts`）。node 空啟動 0.37 秒

## 目標 / Success criteria

1. **design-language 延遲載入**：brainstorm 0b′ 自己做副檔名比對（同一份清單、同一條 skill 目錄排除），不命中 → `design` 六欄填 `{involved:false, …, map_status:unknown}` 直接進 0c、**不載** design-language；命中才載並從它第 2 步接下去。契約驗 brainstorm 引用的清單與 design-language §前端副檔名 一致
2. **dev-workflow 去重**：刪 §Phase 0 入口分流 底下的 Track / Tier heuristic 兩張表與「Tier 自動升級」段，改一行指回 `brainstorm §Phase 0c` / `§Phase 0d`；其餘（Phase 0 圖、路徑圖、hand-off 母版、跨流程表）不動
3. **hook 改 node**：`hooks/guard.mjs` 一支取代 `branch-safety.ps1` + `file-type-guard.ps1`，hooks.json 一個 command；擋的條件逐條移植（見 §等價清單）。**兩支都跑、兩邊訊息都印、任一 block 就 exit 2**——與現在兩個獨立 hook 的可見行為相同。缺 node 時 Claude Code 會報 hook 執行失敗（不再靜默）
4. 對照測試：同一組 ≥16 個 stdin payload 餵舊 pwsh（從 git HEAD 取）與新 node，exit code 逐一相等、stderr 第一行的 `[bstack]` 標記（目前在 / BLOCK / WARN）相等；結果表進 §施工紀錄。契約新增 P2d 對 fixture 執行 guard.mjs（永久守）
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
| B1 | 只攔 Write / Edit / NotebookEdit（`notebook_path`）；其他 tool exit 0 | 同 |
| B2 | stdin 空 / JSON 壞 → exit 0 | 同 |
| B3 | repo = `$CLAUDE_PROJECT_DIR`，沒有就 cwd | 同 |
| B4 | 目標檔絕對路徑不在 repo 底下（大小寫不敏感、兩種分隔符）→ exit 0 | 同（`path.resolve` + toLowerCase） |
| B5 | `git rev-parse --abbrev-ref HEAD` 失敗（非 git / 無 commit / git 不在 PATH）→ exit 0 | 同 |
| B6 | branch ∈ main / master / production / prod / release → stderr 三行 + exit 2 | 同，三行原文 |
| F1 | 豁免 `.env.example / .sample / .template / .dist` | 同 |
| F2 | BLOCK 9 個 pattern（.env*、.key、.pem、.crt、.p12、.pfx、/credentials.、/id_rsa*、/id_ed25519*）→ stderr 三行 + exit 2、無 token | 同，regex 逐字搬、大小寫不敏感（ps1 的 -match 本來就是） |
| F3 | WARN 22 個 pattern → 有 token（不論過期）刪 token + 寫 consumed.log；未過期 exit 0、過期或無 token → exit 2 + 七行指示 | 同；token 建立指令改成 `node -e` 一行（跨平台），並列 pwsh 舊寫法 |
| F4 | token 路徑 = `<XDG_RUNTIME_DIR 或 tmp>/bstack-file-guard-<USERNAME 或 USER 或 user>/<sha256(normalized) 前 16 hex>.token`，TTL 300s | 同（`crypto.createHash('sha256')`、`os.tmpdir()`） |
| F5 | state dir 建不起來 → stderr 一行 + exit 2 | 同 |
| F6 | normalized = 反斜線→斜線、小寫 | 同 |
| C1 | 兩支獨立 hook：branch 先跑、file-type 後跑，各自可 exit 2，Claude 看到兩邊訊息 | 一支：兩段都跑、兩邊訊息都印、任一 block → exit 2 |
| C2 | stderr UTF-8 無 BOM | node 預設 UTF-8 |
| C3 | 缺 pwsh → 靜默失效 | 缺 node → Claude Code 報 hook 失敗（行為變好，rules.md 豁免句同步改） |

## 風險與 trade-off

- **hook 重寫是唯一有真實風險的項目**：靠 16+ 個 payload 對照測試與永久契約 P2d 守。等價的是 exit code 與 block / warn 分類，stderr 措辭允許差一個字（token 指令那行）。
- **brainstorm 多了一段比對邏輯**：0b′ 從 4 步仍是 4 步，但第 1 步的內容從「載入」變「比對；命中才載入」。清單雙寫靠契約 P11 守一致。
- **node 是新依賴**：Claude Code 本身就是 node 程式，環境有 node 的機率遠高於 pwsh；install.ps1 的前置檢查加 node。
- **frontend-e2e-runner 這輪要真跑**：docs 站兩頁，成本約一個 agent；這是規則要求，也順便驗剛 merge 的 text-only-diff 在真實 PR 上的行為。

## 待釐清

- 無。
