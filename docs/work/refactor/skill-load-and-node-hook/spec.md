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

**包含**：`skills/brainstorm/SKILL.md`（0b′）、`skills/design-language/SKILL.md`（frontmatter description「必載」與 §與 dev-workflow 銜接 那列改「命中才載」）、`skills/dev-workflow/SKILL.md`（去重 + 跨流程表 design-language 列）、`skills/devwork/rules.md`（§設計語言對齊 判定句、§Branch safety / §File-type 的檔名與「缺 pwsh 靜默失效」豁免句）、`hooks/guard.mjs`（新）、`hooks/hooks.json`、刪兩支 `.ps1`、`scripts/plugin-contract.mjs`（P2a ≥2 → ≥1、P2b / P2c / P4 檔名、新 P2d fixture、P11 副檔名清單一致）、`README.md`（hooks 表、pwsh 必需段、Prerequisites）、`docs/index.html`（8 處文字節點：meta description × 3、hero 一句、stat 數字、inventory 一列、第 75 行 hook 段、第 128 行安裝句、第 130 行「兩支」）、`scripts/install.ps1`（前置檢查加 node、兩句提醒）、`docs/js/data.js`（HBranch / HFile / LoadDLang 三個 label）、五個 skill 的檔名引用（brainstorm:57、design-direction:37、design-language:38、finish-branch:170、dispatch-parallel:136）、`docs/js/references-data.js` 重產。

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

`design.involved=true`（`docs/index.html` 在改動檔內）、`size=小改`、`scope=文件站`、`scope_evidence=docs/css/styles.css`、`map_status=absent`（本 repo 無 design-map.md）。**但**改動全是文字節點與 meta content（8 處，見 §範圍），rules.md §設計語言對齊 豁免：不碰 token / class / 屬性，四項對齊檢查 N/A。verify-done：diff 含 `docs/js/data.js`（.js）→ `text-only-diff.mjs` 依規則判 NOT-TEXT-ONLY → T3 派 frontend-e2e-runner 跑 docs 站（index + flow 兩頁）。**不豁免、不用 --ignore**（data.js 不是產出器重產的檔）。

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
| D2 | **刻意差異**：`TMP` / `TEMP` 指到一個檔案——ps1 `Join-Path` 噴 PowerShell 錯誤、tokenPath 變空、照樣印 WARN（指示是壞的） | 明報「state dir 建立失敗」；兩邊都 exit 2 |
| D3 | **刻意差異（比舊版嚴）**：`file_path` 非字串——ps1 對數字隱式轉字串（相對 cwd 解出來落在 repo 內 → 擋）、對物件 `GetFullPath` 拋錯 → exit 0 放行 | 一律當「沒帶路徑」：branch 段照查（protected → 擋）、file-type 段沒得判。security-audit 實測第一版會被數字繞過（`path.resolve` 拋錯被 catch 成「repo 外」），修正後補 fixture |

## 風險與 trade-off

- **hook 重寫是唯一有真實風險的項目**：靠 16+ 個 payload 對照測試與永久契約 P2d 守。等價的是 exit code 與 block / warn 分類，stderr 措辭允許差一個字（token 指令那行）。
- **brainstorm 多了一段比對邏輯**：0b′ 從 4 步仍是 4 步，但第 1 步的內容從「載入」變「比對；命中才載入」。清單雙寫靠契約 P11 守一致。
- **node 是新依賴**：官方 `/setup` 文件明說 Claude Code 是 native binary、**不自帶 node**（npm 裝法也只是下載 binary）。推斷（未量）：開發者環境有 node 的機率高於 pwsh 7，尤其 macOS / Linux 上 pwsh 罕見，所以是往好的方向換依賴；但公開文案不得寫「一律有 node」。install.ps1 前置檢查加 node。
- **frontend-e2e-runner 這輪要真跑**：docs 站兩頁，成本約一個 agent；這是規則要求，也順便驗剛 merge 的 text-only-diff 在真實 PR 上的行為。

## 待釐清

- 無（本次）。**記錄不修**：`git rev-parse --abbrev-ref HEAD` 在 branch 名有歧義時回 `heads/main`，舊新兩邊都放行（都錯）；`hook-equivalence.mjs` 靠 `git show 8dbb203:` 取舊檔，未來 rewrite history 就跑不了，屬預期。


## 施工紀錄

### 三項的落地與證明

| 項 | 做了 | 證明 |
|---|---|---|
| 1 design-language 延遲載入 | brainstorm 0b′ 四步改寫（仍四步）：清單與剔除規則內嵌、不命中不載、命中才載並照其契約從第 1 步跑；design-language description / §前端副檔名 例外句 / 銜接表 / Red Flags 同步；rules.md §設計語言對齊 說明句 | P11 綠（三處清單 tokenize 相等、含「不命中」「不載」「命中才載」「SKILL.md」）；守門快照：使用契約步驟數 / 選單 / § 白名單零差異，反引號新增 11 個（內嵌的清單與剔除規則，刻意） |
| 2 dev-workflow 去重 | 刪 Track / Tier heuristic 兩表與自動升級段（理由句先搬到 brainstorm 0d）、換一行指回；Phase 0 圖第 35 行、分工表、跨流程 design-language 列同步 | P11 綠；P9c / P10b 仍綠；守門快照零差異 |
| 3 hook 改 node | hooks/guard.mjs 一支兩段、hooks.json 一個 command、兩支 ps1 刪；scripts/hook-equivalence.mjs 對照 | P2a-e 綠（P2d 24 fixture + tokenPathFor 兩案；P2e 真 spawn 兩案）；對照測試 31 案 ALL EQUAL（下表）；守門快照 finish-branch 反引號新增 hooks/guard.mjs 一個（刻意） |

### hook 對照測試（舊 pwsh 兩支 vs 新 node 一支）

exit 規則：新 == max(舊 branch, 舊 file-type)。stderr 允許差異：僅 token 指令行（新版印 `node "<guard.mjs>" --token "<path>"`、正斜線）。只在 Windows 實測，Linux 為推斷。

環境：2026-09-07 · 基線 8dbb203 · pwsh 7.4.19 · node v22.14.0 · win32
| # | 案 | branch | token | 舊 b | 舊 f | 舊 max | 新 | 舊標記 | 新標記 | token 路徑 | token 消耗 | 等價 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | protected + repo 內 a.ts | main | none | 2 | 0 | 2 | 2 | branch | branch | n/a | n/a | ✓ |
| 2 | feat + repo 內 a.ts | feat/x | none | 0 | 0 | 0 | 0 | - | - | n/a | n/a | ✓ |
| 3 | repo 外 settings.json（main） | main | none | 0 | 0 | 0 | 0 | - | - | n/a | n/a | ✓ |
| 4 | repo 外 .gitconfig（main）→ WARN 不看 scope | main | none | 0 | 2 | 2 | 2 | WARN | WARN | same | n/a | ✓ |
| 5 | protected + .env 雙訊息 | main | none | 2 | 2 | 2 | 2 | BLOCK+branch | BLOCK+branch | n/a | n/a | ✓ |
| 6 | .env.example | feat/x | none | 0 | 0 | 0 | 0 | - | - | n/a | n/a | ✓ |
| 7 | .env.local | feat/x | none | 0 | 2 | 2 | 2 | BLOCK | BLOCK | n/a | n/a | ✓ |
| 8 | NotebookEdit id_rsa | feat/x | none | 0 | 2 | 2 | 2 | BLOCK | BLOCK | n/a | n/a | ✓ |
| 9 | 裸 credentials.json（相對路徑） | feat/x | none | 0 | 0 | 0 | 0 | - | - | n/a | n/a | ✓ |
| 10 | .venv/x | feat/x | none | 0 | 0 | 0 | 0 | - | - | n/a | n/a | ✓ |
| 11 | migrations 無 token | feat/x | none | 0 | 2 | 2 | 2 | WARN | WARN | same | n/a | ✓ |
| 12 | migrations token valid | feat/x | valid | 0 | 0 | 0 | 0 | - | - | n/a | both-consumed | ✓ |
| 13 | migrations token expired | feat/x | expired | 0 | 2 | 2 | 2 | WARN | WARN | same | both-consumed | ✓ |
| 14 | package-lock.json | feat/x | none | 0 | 2 | 2 | 2 | WARN | WARN | same | n/a | ✓ |
| 15 | Dockerfile | feat/x | none | 0 | 2 | 2 | 2 | WARN | WARN | same | n/a | ✓ |
| 16 | tool_name 小寫 edit + .env | feat/x | none | 0 | 2 | 2 | 2 | BLOCK | BLOCK | n/a | n/a | ✓ |
| 17 | branch Release（大小寫） | Release | none | 2 | 0 | 2 | 2 | branch | branch | n/a | n/a | ✓ |
| 18 | detached HEAD | detached | none | 0 | 0 | 0 | 0 | - | - | n/a | n/a | ✓ |
| 19 | 空 repo 無 commit | false | none | 0 | 0 | 0 | 0 | - | - | n/a | n/a | ✓ |
| 20 | 非 git 目錄 | false | none | 0 | 0 | 0 | 0 | - | - | n/a | n/a | ✓ |
| 21 | CLAUDE_PROJECT_DIR 未設、cwd=repo（main） | main | none | 2 | 0 | 2 | 2 | branch | branch | n/a | n/a | ✓ |
| 22 | 相對路徑 src/a.ts（main、cwd=repo） | main | none | 2 | 0 | 2 | 2 | branch | branch | n/a | n/a | ✓ |
| 23 | repo 路徑大小寫不同（main） | main | none | 2 | 0 | 2 | 2 | branch | branch | n/a | n/a | ✓ |
| 24 | repo/../other/a.ts 走出 repo（main） | main | none | 0 | 0 | 0 | 0 | - | - | n/a | n/a | ✓ |
| 25 | 正斜線 Windows 路徑（main） | main | none | 2 | 0 | 2 | 2 | branch | branch | n/a | n/a | ✓ |
| 26 | 空 stdin（main） | main | none | 2 | 0 | 2 | 2 | branch | branch | n/a | n/a | ✓ |
| 27 | Write 無 tool_input（main） | main | none | 2 | 0 | 2 | 2 | branch | branch | n/a | n/a | ✓ |
| 28 | Write 無 file_path（main） | main | none | 2 | 0 | 2 | 2 | branch | branch | n/a | n/a | ✓ |
| 29 | 未知 tool（main） | main | none | 0 | 0 | 0 | 0 | - | - | n/a | n/a | ✓ |
| 30 | 壞 JSON（main） | main | none | 0 | 0 | 0 | 0 | - | - | n/a | n/a | ✓ |
| 31 | file_path 是數字 123（main） | main | none | 2 | 0 | 2 | 2 | branch | branch | n/a | n/a | ✓ |
| 32 | file_path 是物件（main）→ 新版更嚴 | main | none | 0 | 0 | 0 | 2 | - | branch | n/a | n/a | ✓（刻意差異 D3） |
| 33 | main + Dockerfile + token valid（file 段吃 token、branch 段擋） | main | valid | 2 | 0 | 2 | 2 | branch | branch | n/a | both-consumed | ✓ |
| 34 | CLAUDE_PROJECT_DIR 指到不存在目錄（main） | main | none | 0 | 0 | 0 | 0 | - | - | n/a | n/a | ✓（刻意差異 D1） |
| 35 | TEMP 指到檔案 + Dockerfile → state dir 失敗 | feat/x | none | 0 | 2 | 2 | 2 | WARN | statedir | DIFF | n/a | ✓（刻意差異 D2） |

ALL EQUAL（35 案）

刻意差異三筆（spec §等價清單 D1-D3）：D1 `CLAUDE_PROJECT_DIR` 不存在（舊擋新放，只驗兩邊跑完）；D2 TMP 指到檔案（舊印壞的 WARN、新明報 state dir 失敗，兩邊 exit 2）；D3 `file_path` 是物件（舊 exit 0、新當沒帶路徑照查 branch）。其餘 32 案 exit / 標記 / token 路徑 / token 消耗全等。

### 耗時（PowerShell Measure-Command，各 5 次取中位數，Windows 11 / node 22.14 / pwsh 7.4.19）

| | 舊（兩支 pwsh） | 新（一支 node） |
|---|---|---|
| repo 內檔（含 git rev-parse） | 約 3,200 ms（Bash time；pwsh 單支啟動 1,129 ms） | **456 ms** |
| repo 外檔（不跑 git） | 同上 | **268 ms** |

### 缺 node 實測（2026-09-07）

hooks.json 暫改成 `node-nope`、`claude --plugin-dir <臨時 plugin> -p "用 Write 建 probe.txt" --output-format stream-json`：輸出裡 **零筆** 含 hook / non-blocking / node-nope 的訊息，probe.txt 照樣被寫。結論：Windows 非互動模式下 command 不存在是**完全靜默**、保護不存在——與官方文件「印 non-blocking 通知」不符（互動模式是否印通知未測）。文案照此寫：兩種說法下保護都不存在，只能 `node --version` 事前確認。

### 執行偏差

- 對照測試第一輪 5 案假紅：測試環境給的 TMP 是 Windows 8.3 短檔名（TOMMY_~1），.NET GetTempPath 回長檔名、node 照 env 印；改用 realpathSync.native 解開後全等。
- P11 第一版對 design-language 那節整段 tokenize 會抓到「現況分歧」註記的 .sass；改成只抓 fenced block，且要容 CRLF。
- Task 6 依 review 建議把 brainstorm / design-language 的檔名替換併進 Task 3；index.html 除了 spec 列的三行還有 meta description × 3、hero 一句、stat 數字、inventory 一列寫「2 個 hook」，一併改成「1 支兩段式」。
- guard.mjs 主程式判斷用 argv[1] 檔名 regex（同 text-only-diff.mjs 先例）。

### verify-done：frontend-test（frontend-e2e-runner，docs 站）

`text-only-diff.mjs` 對本 branch 判 NOT-TEXT-ONLY（diff 含 `docs/js/data.js` 與 `.mjs`），依規則派 runner。伺服器 `node scripts/static-serve.mjs docs 8765`。

| scenario | viewport | 結果 | 依據 |
|---|---|---|---|
| index-load | 1280×720 | PASS | console 零 error；hero stat「1 hook」；第一段含 guard.mjs、無舊檔名 / 「兩支 hook」；安裝段含 node 與「pwsh 7+ 只有 install.ps1 / extras.ps1」 |
| index-mobile | 390×844 | PASS | scrollWidth == clientWidth（無水平捲軸） |
| flow-hook-nodes | 1280×720 | PASS | 圖上找到「guard.mjs（branch-safety 段）」「guard.mjs（file-type 段）」與 design-language 新 label；點 design-language → 文件面板含「唯一例外」 |
| flow-index-panel-consistency | 1280×720 | INCONCLUSIVE | 測試矩陣假設 rules.md 在索引有獨立項目，實際設計是 ambient 短摘要、不可點；data.js 全文對舊檔名 0 命中，內容確為重產版。**既有缺陷（非本 PR）**：文件索引的 CLAUDE.md 項目點了不開抽屜，console「NODE_DOCS 查無此節點：CLAUDE」（app.js:968），本 branch 未動 app.js，另開 issue |

截圖：`test-reports/20260907-e2e/screenshots/{index-desktop,index-mobile,flow-doc-panel,flow-ambient-panel}.png`。`verify_results.e2e = pass`、`frontend_test.ran = true`。

### 對齊 reviewer（request-review T3）finding 與處置

| 級 | finding | 處置 |
|---|---|---|
| Major | 永久契約沒有一案真的 spawn git（P2d 全 mock、P2e 兩案都不進 git） | P2e 加臨時 `git init -b main` repo 真跑 → 擋 |
| Major | `--token` 子命令與 consumeToken 的真實 IO 零測試 | P2e 加 WARN → `--token` 建檔 → 再跑放行、token 已刪、consumed.log 有 `valid=True` |
| Major | design-language「唯一例外」寫成事實，實際同一份清單 7 處（另 4 處是觸發用） | P11 擴到七處；design-language 那句改寫 |
| Major | `argv[1]` 檔名 regex 當主程式判斷會被同名 importer 誤觸 | 改 realpath 比對（`realpathSync.native` + 小寫），同名 importer 實測不誤觸 |
| Minor | scalar JSON / 只有空白的 stdin 舊版是 exit 0，新版當空 stdin 查 branch | 照舊：只有完全空字串走查 branch；scalar → isWrite=false；P2d 加案 |
| Minor | `tokenPathFor` 用 `existsSync` 是 IO，不算純函式 | `dirExists` 注入，契約傳 `() => false` |
| Minor | 對照測試缺 D1、C1 怪癖；D2 沒進 §等價清單 | 三筆補齊（D1 exit 舊擋新放、只驗兩邊跑完；C1 兩邊都 exit 2 且 token 被吃） |
| Minor | index.html / install.ps1「Windows 實測不會報錯」範圈講大 | 補「非互動模式」 |
| Minor | spec §範圍 / §設計方向 只寫 index.html 一句，實際 8 處文字節點；plan TMPDIR 順序寫錯 | 改正 |
| Nit | guard.mjs 檔頭「1.4 秒」無出處、缺 node 寫成肯定句；`<code>file-type</code>` 誤導 | 改 1.1 秒 / 3.2 秒並附 Windows caveat；改 `<code>guard.mjs</code> 的 file-type 段` |
| Nit | dev-workflow 去重的零改變是論證不是機械檢查 | 記在此：brainstorm §Phase 0c / 0d 的表是被刪那兩張的超集（多 report / 報錯 / 跑不起來 / 換 / 多步 bug fix），刪掉的沒有一列不在 brainstorm |

code-review high 中途另抓：`--token` 用 `appendFileSync` 對既存檔不刷新 mtime，舊 `New-Item -Force` 會重建 → TTL 起算點不同 → 改 `writeFileSync` + `utimesSync(now)`。


### security-audit（T3 必跑）finding 與處置

| 級 | finding | 處置 |
|---|---|---|
| **Major（實測繞過）** | `file_path` 是數字時 `path.resolve` 拋 TypeError、catch 成「repo 外」→ branch 段整段跳過、main 上放行；舊 pwsh 隱式轉字串反而擋得住（真 regression） | `targetOf` 驗型別：非字串一律當「沒帶路徑」→ branch 照查；P2d 加 3 案（數字 / 物件 / tool_input 是字串）、對照測試加 2 案；列 D3 |
| Minor | `.env.`（尾端句點）不被 BLOCK regex 命中——舊版同缺口，實測建出的檔名就是字面 `.env.`，dotenv 讀不到、無實際危害 | 零改變原則下不改 regex，記錄 |
| Minor | `--token <path>` 不驗路徑，可當通用 touch 工具 | 只准建在當下 env 算出的 state dir 底下，否則 exit 1 並印期望目錄 |
| N/A | token 機制（AI 可自建、hash 可預算、per-user temp）與舊版等價，是既有信任假設 | — |
| N/A | PII / secret：diff 與 docs/work 三份文件 grep 本機路徑 / email / IP 零命中 | — |
| 待辦 | UNC 與超長路徑的 `path.resolve` vs .NET `GetFullPath` 正規化差異未實測 | 記 spec 待釐清，不擋本 PR |
