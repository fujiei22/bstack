# PR #55: refactor: 安裝模型改為 Claude Code plugin，/devwork 顯式啟動

> URL: https://github.com/fujiei22/bstack/pull/55
> Branch: refactor/plugin-install → main
> Track: Dev | Tier: T3
> 建立: 2026-09-04
> 對應 spec: `docs/work/refactor/plugin-install/spec.md`
> 對應 plan: `docs/work/refactor/plugin-install/plan.md`

## 整體脈絡

原本 `scripts/setup.ps1`（665 行）把整包內容直接覆蓋進使用者的 `~/.claude/`：CLAUDE.md、
statusline.sh、兩支 hook、27 個 skill、6 個 agent，並 merge `settings.json` 的
`hooks` / `statusLine` / `env`。後果是這套流程對使用者**所有專案**生效、不備份就覆蓋既有設定、
而且靠 27 個 skill 描述裡的自然語言關鍵詞（寫 / 改 / 修 / 加…）自動攔截，使用者沒有「這次不要走流程」
的選項。

本 PR 把整個 repo 改造成標準的 Claude Code plugin：`.claude-plugin/` 兩份 manifest、
`hooks/hooks.json`，不再有任何腳本寫入 `~/.claude/`。原 `CLAUDE.md` 全文搬進
`skills/devwork/rules.md` 當單一真相，新增入口 skill `devwork`，流程改由使用者輸入 `/devwork`
（保底 `/bstack:devwork`）顯式啟動，28 個 skill 與 3 個 agent 的 description 全部把「觸發：<自然語言清單>」
改成「載入：<誰在哪個階段載入>」。`setup.ps1` 改寫為 `scripts/extras.ps1`，plugin 規格帶不了的四項
個人偏好（statusLine / permissions / env / MCP）逐項選層級、可逆、含舊版遷移。docs 站與 README 同步改寫
安裝方式與流程圖。

共 59 個檔案變動（`docs/js/references-data.js` 除外都是手動改動，該檔是 `build-references.ps1` 的
產出物，由 Task 7 重新產生，不逐行審）：新增 2869 行、刪除 1243 行，17 個 commit。經過一輪四視角
plan review（`review.md`）與一輪主 + 架構 + 除錯 + lang-reviewer 四視角 code review（`code-review.md`）修正，
其中 code review 抓到兩個 Critical（docs 站內嵌規則書斷鏈、`permissions.allow` 單筆時被 unroll 成字串）
已在後續 commit 修掉並記入 `verify.md`。已知未做項目見文末「後續 follow-up」。

## 檔案改動清單

| 檔案群 | 類型 | 規模 | 改動性質 |
|---|---|---|---|
| `.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json`、`hooks/hooks.json` | 新增 | 43 行 | plugin 骨架三份 manifest |
| `CLAUDE.md` | 改 | 186→6 行 | 縮成 `@skills/devwork/rules.md` import 殼 |
| `skills/devwork/SKILL.md`、`skills/devwork/rules.md` | 新增 | 229 行 | 入口 skill + 規則書單一真相 |
| 27 個既有 `skills/*/SKILL.md`、3 個 `agents/*.md` | 改 | 各數行 | description「觸發：」→「載入：」，路徑字樣改寫 |
| `hooks/branch-safety.ps1`、`hooks/file-type-guard.ps1` | 改 | 各 +7~+21 行 | state dir 搬 temp、訊息白話化、`-LiteralPath` |
| `scripts/extras.ps1`、`templates/project-settings.json` | 新增 | 649 行 | 取代 setup.ps1；四項偏好選單 |
| `scripts/plugin-contract.mjs` | 新增 | 201 行 | P1–P8 plugin 結構契約 |
| `docs/tools/docs-site-contract.mjs` | 改 | +57/-19 | 新增 C8e/C8f/C8g、基線數字更新 |
| `docs/index.html`、`docs/js/data.js`、`docs/js/app.js`、`docs/js/references-data.js` | 改 | 共約 150 行 | 流程圖 prelude、hero 文案、安裝步驟 |
| `README.md` | 改 | +90/-51 | 安裝三步、確認載入、何時生效、遷移、完全移除、開發本 repo |
| `scripts/setup.ps1`、`settings.json`、`state/` | 刪除 | -728 行 | 全域 sync 路徑全數移除 |
| `statusline.sh` → `extras/statusline.sh` | 搬移 | 0 | 非 plugin 元件，手動選用 |
| `scripts/build-references.ps1` | 改 | +7/-5 | 內嵌來源改指 `rules.md` |
| `docs/work/refactor/plugin-install/*.md` | 新增 | 5 份文件 | spec / plan / review / code-review / verify |

---

## `.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json`、`hooks/hooks.json`

### 改動意圖

對應 spec §4a「plugin 骨架」與 §5 驗證 P1／P2。這三份是 Claude Code 判定「這個目錄是不是 plugin」
的必要檔案，repo 根目錄本身就是 plugin 根（`skills/` `agents/` `hooks/` 位置不變）。marketplace 指向
`source: "./"`，讓 repo 自己當自己的 marketplace，不必架外部 registry。

### 改動詳解

`plugin.json` 帶 `name` `version` `description` `author` `homepage` `repository` `license`
`keywords`；`marketplace.json` 的 `plugins[0]` 也帶一份 `name`/`source`/`description` — 兩邊 `name`
都是 `bstack`，`scripts/plugin-contract.mjs:80-87`（P1a/P1b）機械斷言這點一致，不一致會導致
`/plugin install bstack@bstack` 找不到套件。

`hooks/hooks.json:1-19` 註冊單一 `PreToolUse` 事件、matcher 為 `Write|Edit|NotebookEdit`，兩個
command 都用 `${CLAUDE_PLUGIN_ROOT}` 展開路徑，而非寫死本機絕對路徑——這是 plugin hooks 唯一能跨機器
生效的寫法（spec §3a 官方文件依據）。

**不這樣做會怎樣**：沒有 `.claude-plugin/` 兩份 manifest，Claude Code 完全不認得這個目錄是
plugin，`/plugin install` 直接失敗；hooks.json 若寫死路徑，換一台機器 clone 下來 hook 就全部失效。

### 關聯檔案

- `hooks/hooks.json` 指向的兩支腳本被 `scripts/plugin-contract.mjs:98-105`（P2a/P2b/P2c）機械驗證存在且都含 `${CLAUDE_PLUGIN_ROOT}`。
- `templates/project-settings.json:5-9` 的 `enabledPlugins.{"bstack@bstack": true}` 依賴這裡的 `name` 定義。
- 實測記錄（`verify.md` 「安裝路徑實測」）：本機跑過 `claude plugin marketplace add D:\GitHub\bstack` 與 `claude plugin install bstack@bstack -s user` 均成功，之後已還原（uninstall + marketplace remove）。這是**實測**，不是文件保證。

---

## `skills/devwork/SKILL.md`、`skills/devwork/rules.md`、`CLAUDE.md`

### 改動意圖

對應 spec §4b、review CC1（舊 `~/.claude/CLAUDE.md` 讓自動攔截復活）。這是整個 PR 的核心：把「9 階段
流程何時啟動」從「skill 描述含關鍵詞就自動載」改成「使用者顯式輸入 `/devwork`」。原 `CLAUDE.md`
186 行全文一字不改（只改 5 處字樣，見下）搬進 `skills/devwork/rules.md`，成為守則的單一真相；
repo 自身的 `CLAUDE.md` 縮成 6 行（`CLAUDE.md:1-6`），用 `@skills/devwork/rules.md` import。

### 改動詳解

#### 區塊 1：devwork 入口 skill 的使用契約

`skills/devwork/SKILL.md:1-8` frontmatter description 明講「使用者輸入 `/devwork <要做的事>` 才啟動…
不因「寫 / 改 / 修 / 加」等自然語言自動載入」。body 的使用契約（`:12-19`）四步：讀 `rules.md` →
判斷輸入是純問答還是改動類 → **命名空間載入 `bstack:dev-workflow`**（`:20`）→ 每輪貼 Trace。

- 命名空間載入的理由（`:20` 註解 + `verify.md` Task 4 一列）：user 級同名舊 skill 副本會遮蔽 plugin
  版（Claude Code 載入優先序 managed > user > project > plugin，見 spec §3a）。plan 原先只是「加這條
  規則」，**已實測驗證**——本機保留舊版 `~/.claude/skills/dev-workflow` 副本時，用命名空間仍載到
  plugin 版（`Base directory` 落在 `D:\GitHub\bstack\skills\…`）。這是**實測結論**，不是單純理論推導。

#### 區塊 2：單一橫幅、純問答出口

舊版 dev-workflow 被載入時自己印一行橫幅、devwork 也想印一行，會變成連噴兩條、且沒帶文字時順序
顛倒（review Design M3）。`skills/devwork/SKILL.md:23-26` 只保留 devwork 一條橫幅，
`skills/dev-workflow/SKILL.md` 對應改成「由 devwork 載入時不印橫幅」（見下段 dev-workflow diff）。
純問答出口是 review Design M4 的採納：`SKILL.md:14-15` 判斷輸入是「純問答 / 教學」就直接回答、不進
Phase 0，只在結尾提一句 `/devwork` 是給改動類用的——避免使用者打了 `/devwork` 問問題卻被拖進九階段流程。

**注意措辭**：PR body / SKILL.md description 都只寫「打了出現 Unknown command 或載到別的東西時改打
`/bstack:devwork`」，把裸 `/devwork` 可解析明確標成實作行為（`verify.md` Task 2/4 記錄：Claude Code
2.1.260 下 `/devwork` 由 harness 直接展開、Skill tool call 為 0 次），不是文件保證的介面。

#### 區塊 3：rules.md 開頭的前提修正

code review 架構視角抓到一個邏輯漏洞：`rules.md` 宣稱「位階等同 CLAUDE.md」，但它是透過
`/devwork` 用 Read 工具讀進來的一般 tool result，長 session 會被 context 摘要（compaction）洗掉，
「永遠優先」只是宣告、沒有機制保證。`skills/devwork/rules.md:5` 因此改寫成「前提是它還在 context
裡」，並在 `skills/dev-workflow/SKILL.md`（見下）加一條：下個 phase skill 載入時若 context 找不到
「§事實核實」標題，先重讀 `devwork/rules.md`。

#### 區塊 4：五處字樣改動（rules.md 相對舊 CLAUDE.md 的差異）

`skills/devwork/rules.md:51`（§Branch safety 首行改「plugin 的 `hooks/branch-safety.ps1`」）、`:56`
（§File-type 硬規則首行改「plugin 的 `hooks/file-type-guard.ps1`」）、`:158`（§Settings.json 整節改寫
成「專案 `.claude/settings.json`…個人偏好走 `scripts/extras.ps1`」，並加一句範本內
`Bash(cat/head/tail:*)` 是任意檔讀取的警語，這是 security audit Minor #3 的採納）。

**不這樣做會怎樣**：不搬進 `rules.md` 而只留 CLAUDE.md，守則就只在 bstack 自己開發時生效，plugin
使用者完全拿不到；不縮 CLAUDE.md 而兩邊各自維護，會出現 spec §3a 提到的「兩份守則漂移」。

### 關聯檔案

- `scripts/plugin-contract.mjs:183-185`（P6）機械驗證 `rules.md` 存在、含 `§事實核實`，且 `CLAUDE.md`
  含獨立一行 `@skills/devwork/rules.md`。
- `scripts/build-references.ps1:82-93` 內嵌來源已改指向 `skills/devwork/rules.md`（見「docs 站與
  README」section 的 C1 修正）。
- 被 `skills/dev-workflow/SKILL.md:281-290`（§跟 rules.md 的關係表）引用，衝突時定義為
  `rules.md > dev-workflow skill > phase skill`。

---

## 28 個 skill / 3 個 agent 描述去自動觸發

### 改動意圖

對應 spec §4c、plugin-contract P3c/P7。舊版每個 skill description 都有一段「觸發：<落落長的中英文
關鍵詞清單>」，Claude Code 用這段文字決定是否自動載入——這正是「沒下指令也被攔」的根源
（spec §3c 事實依據：27/27 個 SKILL.md 都含「觸發：」，grep 計數）。本 PR 把全部改成「載入：
<誰在哪個階段載入>」的一句話，body 內同義的「§跨流程 skill 觸發」標題也一併改名「載入」。

### 改動詳解

#### 區塊 1：dev-workflow 與 brainstorm（Task 5a，先動的兩個核心）

`skills/dev-workflow/SKILL.md` description（`:1-10`）從落落長的「觸發：寫 / 改 / 修 / 加…36 個詞」
改成「載入：由 `devwork` skill 載入…不因自然語言自動觸發」，body 使用契約第 1 點（`:16`）從
「確認 user prompt 屬『code 改動類』」改成「user prompt 由 devwork 交進來…純問答已在 devwork
過濾」——這是責任邊界的轉移：純問答判斷從 dev-workflow 挪到 devwork，dev-workflow 收到的一律是
改動類。`§跨流程 skill 觸發`（原 `:242`）改名 `§跨流程 skill 載入`；第一句台詞（原
`[已載入 dev-workflow]`）改成有條件印：由 devwork 載入時不印（避免雙橫幅），單獨呼叫時才印
`[bstack dev-workflow · plugin] Phase 0 入口分流啟動。`

`skills/brainstorm/SKILL.md` description（`:3-6`）同樣改寫，並新增 `0b′ UI 面判定` 到涵蓋範圍（這是
既有的 design-language 判定步驟，原本沒寫進 description）。body 內三處 `CLAUDE.md §` 字樣（`:118`
File-type Tier 升降 trigger、`:148` 決策點選單引用、`:229` self-review gate 引用）改為 `rules.md §`。

#### 區塊 2：其餘 25 個 skill + 3 個 agent（Task 5b）

一致的模式：description 第二段從「觸發：<詞清單>」改成「載入：<誰在哪個階段載入 / §跨流程 skill
載入 表所列時點>；亦可由使用者顯式呼叫」。三類 agent（`agents/db-reviewer.md:4-5`、
`agents/lang-reviewer.md:6-8`、`agents/security-auditor.md:4-6`）同步改寫，並把 body 內所有
`CLAUDE.md §xxx` 引用改成 `rules.md §xxx`（`agents/frontend-e2e-runner.md`、
`agents/hypothesis-tester.md` 也各改一處，即使 frontmatter 未動觸發詞）。

路徑字樣同批清掉：`skills/finish-branch/SKILL.md:274-275`（Hook 段改指 plugin 路徑）、
`skills/design-direction/SKILL.md:84`（`~/.claude/skills/…` 改 `${CLAUDE_PLUGIN_ROOT}/skills/…`）、
`skills/design-language/SKILL.md:22,24`（「剔除 `~/.claude/skills/**`」改成「剔除任何路徑含
`skills/<name>/SKILL.md` 的 skill 定義目錄」，涵蓋 plugin 快取／專案 `.claude/skills/`／repo
`skills/` 三種情況）、`skills/execute-plan/SKILL.md:56`（同一句話同步改）、
`skills/dispatch-parallel/SKILL.md:55`（讀 `~/.claude/settings.json` 的 `env` 改成「查環境變數
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`」，因為 plugin 的 settings.json 不再是全域寫入點）。

#### 區塊 3：write-skill 的新 skill 落地 checklist

`skills/write-skill/SKILL.md:171-177`（放置表）把「Global / 跨專案」列的 `~/.claude/skills/<name>/`
（走 setup.ps1 sync）改成「plugin（隨 bstack 發布）→ repo `skills/<name>/SKILL.md`」，並新增
一節 §新 skill 落地 checklist（`:174-180`）：列出加一個新 skill 要動的 7 個地方
（SKILL.md → NODE_DOCS → data.js 節點/邊 → docs-site-contract 基線 → 重跑
build-references → README 計數 → index.html 三處計數），每項附對應契約 ID。這是 DX 視角 review
M3「加 skill 要動 7 處」的直接產物，也是本 PR 自己（Task 7 加 `LoadDevwork`）走過一遍的路徑。

**不這樣做會怎樣**：description 若仍留「觸發：」字樣，`scripts/plugin-contract.mjs:125-126`（P3c）
會紅——這條契約就是防止「改了入口機制、但某個 skill description 忘了改」的機械判定。

### 關聯檔案

- 全部 28 個 skill 由 `scripts/plugin-contract.mjs:120-121`（P3a）驗證數量 ≥28 且 `name` 等於目錄名。
- `docs/js/app.js:60-100`（NODE_DOCS）與 `docs/tools/docs-site-contract.mjs:244-247`（BASELINE_KEYS）
  同步加了 `LoadDevwork` 一項，對應這批 skill 改動裡新增的入口。
- 實測（`verify.md` Task 5b）：`-p "幫我改一下 README 的錯字"`（無斜線）跑 stream-json 數
  `"name":"Skill"` 為 0 次，證實自然語言不再觸發任何 skill 載入。

---

## `hooks/branch-safety.ps1`、`hooks/file-type-guard.ps1`

### 改動意圖

對應 spec §4e、review CC2（hooks 隨 plugin 在所有啟用的專案生效，沒下 `/devwork` 也擋，訊息卻指向
沒載入的守則）與 security audit Major #1（token 目錄在 Linux 上是共用 `/tmp`，可被同機他人預建繞過）。
兩支 hook 都是 PreToolUse，攔截行為本身完全不變，只改三件事：訊息白話化並附出口、token 狀態目錄搬離
plugin 目錄且改成 per-user、路徑處理改用 `-LiteralPath`。

### 改動詳解

#### 區塊 1：訊息白話化、fail-open 的刻意設計

`branch-safety.ps1:81-83` 的 block 訊息從「[BRANCH-SAFETY] …走 §決策點選單規則…」改成
`[bstack] 目前在 '$branch'…`，不再引用一個使用者可能沒載入的規則書章節名，並在第三行加
`若你沒在用 bstack 流程、不想要這個檢查：/plugin disable bstack@bstack`（`:83`）。
`file-type-guard.ps1` 的 BLOCK（`:138-140`）與 WARN（`:180-187`）段落同樣加 `[bstack]` 前綴與
`/plugin disable` 出口。這是 hooks 隨 plugin 全域生效、但只有跑過 `/devwork` 的人才讀過 rules.md
術語的直接應對——訊息本身必須自成一套、不依賴任何前置 context。

hook 本身維持 **fail-open** 的既有設計（非 git repo、`git rev-parse` 失敗、detached HEAD、
git 不在 PATH → 一律放行，`branch-safety.ps1:8-11` docstring 明講），這是刻意保留、非本 PR 引入。
`verify.md`「沒有 pwsh 7」一列記錄了另一種 fail-open：PATH 裡拿掉 pwsh 7 後，Claude Code 對 hook
執行失敗**完全靜默**、檔案照寫、不印任何錯誤——這是**實測**發現的既有平台限制，非本 PR 造成，
已寫進 README troubleshooting（見下）。

#### 區塊 2：state dir 搬離 plugin 目錄、改 per-user

`file-type-guard.ps1:85-92`：舊版 `$stateDir` 算式是 `$PSScriptRoot/../state/file-guard`（相對 hook
腳本所在目錄）。plugin 安裝後 `$PSScriptRoot` 落在 `~/.claude/plugins/` 快取內，每次 plugin 更新會被
清空、也不該被 hook 寫入快取——這是 spec §3c 事實依據裡明列的問題。改法是 `[System.IO.Path]::GetTempPath()`
為底，並在 security audit（Major #1）抓到「Linux 的 `GetTempPath()` 是**共用** `/tmp`，token 檔名由
路徑 hash 決定、可預測，同機他人可預建 token 繞過二次確認」後，再加一層 per-user 目錄名
（`bstack-file-guard-$env:USERNAME`，優先用 `$XDG_RUNTIME_DIR`）。`:116-117`（Test-And-Consume-Token
內）額外在同目錄寫一行 `consumed.log`，供事後回溯「何時、哪個檔用 token 放行過」——這是同一個 Major
finding 的第二個處置（安全稽核 Minor #1）。

state dir 的建立也從「每次呼叫都先建」改成延到 WARN 命中時才建（`:95-106` `Ensure-StateDir`
函式），因為 99% 的 hook 呼叫不命中 WARN，不必每次都碰磁碟；建不起來時印明確訊息而非指示 AI 去建一個
不可能的路徑（`:102-104`）。

#### 區塊 3：`-LiteralPath`

`branch-safety.ps1:72` 把 `Push-Location $repo` 改成 `Push-Location -LiteralPath $repo`——這是
review 除錯視角實跑抓到的：路徑含 `[` `]` 時 `Push-Location` 會把它當萬用字元解析、找不到目錄，
接著在錯誤的 cwd 跑 `git`，會**靜默放行**（不是報錯，是判斷邏輯建立在錯的 cwd 上，結果剛好放行）。
`verify.md` Task 3 用含空白的路徑 `…\bstack probe\` 做了一次實測，確認訊息與擋下行為正常；含
`[` `]` 的路徑本 PR 未見額外實測記錄，屬於推斷修法。

**不這樣做會怎樣**：state dir 不搬走，plugin 每次更新使用者的二次確認 token 全部消失、正在等待
放行的操作會卡住；不做 per-user 隔離，Linux 多人共用機器上任何人都能預先建好 token 檔跳過
file-type-guard 的二次確認機制。

### 關聯檔案

- 兩支 hook 被 `hooks/hooks.json` 以 `${CLAUDE_PLUGIN_ROOT}` 相對路徑呼叫（見前段）。
- state dir 的字樣被 `scripts/plugin-contract.mjs:103-105`（P2c）機械驗證不再含
  `state/file-guard` 或 `../state`。
- `skills/devwork/rules.md:51,56` 的守則文字直接對應這兩支 hook 現在的行為描述。

---

## `scripts/extras.ps1`（取代 `scripts/setup.ps1`）

### 改動意圖

對應 spec §4g、review CC3/CC4/CC5/CC6 與 code review C2（Critical）。plugin 規格的 `settings.json`
元件只認 `agent` / `subagentStatusLine` 兩個 key，statusLine / permissions / env / MCP 四項個人偏好
plugin 帶不進去，必須另外處理。舊 `setup.ps1` 的做法是「全部塞、覆蓋不備份」，`extras.ps1`
改成「四項各自選層級（使用者 / 專案 / 跳過），merge 而非覆蓋，manifest 記錄、可逆」。

### 改動詳解

#### 區塊 1：manifest 模型 —— 只記真的新增的 key

`extras.ps1:194-215`（`Get-AddedKeys`）比較 merge 前後的物件，只把「$after 有、$before 沒有」的葉
key 記進 manifest（`permissions.allow` 特例列成 `permissions.allow[<值>]`）。`:219-234`
（`Save-Manifest`）把這份 key 清單存進 `~/.claude/bstack-extras.json`，這是本腳本**唯一**不經使用者
[U]/[P] 選擇就會寫的檔（`:15` docstring 說明）。`-Uninstall`（`:327-369` `Invoke-Uninstall`）只依
manifest 拔掉這些 key，使用者本來就有的值不動。這套模型直接對應 review CC5：舊 plan 版本原本用
「靜態 key 清單」，若使用者本機已有同名 key 會被誤刪，改成「diff 出來真的新增的」解掉這個問題。

`:269`（`if ($Force -and $added.Count -eq 0)`）與 `:221-222`（`Save-Manifest` docstring 講的
keys 與既有紀錄**聯集**、實作在 `:230`）是 code review Major「statusLine [R] 重裝後 -Uninstall
拆不掉」的修法：重裝時 diff 算出來是空的（因為新值跟舊值一樣），若直接覆蓋 manifest 會把「這個
key 是我們加的」這件事洗掉，導致 `-Uninstall` 之後再也拆不掉它。`verify.md` Task 6 記錄 r1/r2
兩條斷言驗過這個路徑。

#### 區塊 2：Critical 修正 —— `permissions.allow` 單筆時的 unroll bug

`extras.ps1:261-266`（`Add-Item` 內 `permissions` 分支）與 `:203-207`（`Get-AddedKeys` 內同一個
分支）都用 `@(if (...) {...} else {...})` 整段包起來。註解直接寫明原因：PowerShell 的
`$have = if (...) {...}` 在賦值時，若 if 分支只回傳一個元素，會被 unroll 成純量而非單元素陣列，
後面 `+` 運算就從「陣列合併」變成「字串串接」——code review 除錯視角**實跑**抓到這個 Critical：
使用者 `permissions.allow` 只有一筆時，整個 allow 陣列被毀成一個垃圾字串。`verify.md` Task 6 記錄
u1/u2 兩條斷言（單筆陣列、allow 本身是字串兩種情況）驗證修復。

#### 區塊 3：`-Migrate` 的簽名判定與搬移備份

`extras.ps1:383-469`（`Invoke-Migrate`）不是憑檔名判斷所有權，而是看內容簽名：skill 看
frontmatter `name` 等於目錄名且描述含「（繁中）」（`:371-377` `Test-BstackSkillDir`）、agent 同、
hook 看 `[bstack]` 或官方通稱以外的專屬標記（`:411-412`，並排除「PreToolUse hook」這種官方文件本身
就會用的措辭——security audit Major #2 抓到用官方通稱當簽名會誤判使用者自己寫的同名 hook）、
舊 `CLAUDE.md` 看**只有舊版才有**的「一律進 `dev-workflow`」那句加 `§事實核實`（`:434`），並用
非空行重疊 ≥90% 判斷「是否被使用者改過」（`:436-439`）——這是 code review Major 修正：舊版簽名字串
在新版 `rules.md` 裡也存在，會誤改名使用者刻意複製現版守則當全域規則的情況（`verify.md` e7 驗證）。

刪除動作也從舊版的 `Remove-Item` 直接刪，改成先搬進
`~/.claude/bstack-migrate-bak-<時間戳>/`（`:455-465`），理由是簽名判定終究是推定、可能誤判，
搬移讓使用者能救回來（security audit Major #2 的第二個處置，`verify.md` e3b 驗證搬進去的檔案
可還原）。

#### 區塊 4：SelfTest 涵蓋範圍

`extras.ps1:473-578`（`Invoke-SelfTest`）在 temp 目錄偽造 `BSTACK_CLAUDE_HOME`，不碰真實設定、
不呼叫 `claude` CLI（mcp 項只走 `-WhatIf`），共約 33 條斷言，覆蓋：
本機已有值不覆蓋（a1）、allow 聯集且保本機值（a2）、既有 key 不動（a3）、同檔只備份一次（b）、
manifest 只記真的新增（c1/c2）、project scope 隔離（p/p2）、冪等（i）、壞 JSON /
根非 object 以 `FormatException` 回報（j/j2）、`permissions.allow` 單筆或字串的 unroll bug
（u1/u2，本節區塊 2）、Uninstall 還原（d1-d5）、重裝路徑（r1/r2，本節區塊 1）、
Migrate 全流程 e1-e7（含同名非 bstack 的 skill/hook 不動、搬移備份可救回、現版 rules.md
當全域 CLAUDE.md 不誤判）。`verify.md` 記錄第一版跑出多個假綠（`Get-AddedKeys` 用 `,$out` 造成
陣列被 join 成字串、`-Force` 洗掉 manifest keys 等），修完後全 PASS。

**不這樣做會怎樣**：不做 merge-only + manifest，四項偏好只能靠使用者手動 diff `settings.json` 才能
知道哪些是這個腳本加的，`-Uninstall` 無從精準拆除；不修 unroll bug，任何本機唯讀白名單只有一筆的
使用者（少見但可能）跑一次腳本就會把自己的 `permissions.allow` 整個毀掉。

### 關聯檔案

- `templates/project-settings.json:5-15` 是 `permissions` 項白名單的**唯一來源**
  （`extras.ps1:85-87` `Get-TemplateAllow` 直接讀這份檔，不另抄一份）。
- `hooks/file-type-guard.ps1` 與 `branch-safety.ps1` 靠 `-Migrate` 清掉的舊副本簽名字樣
  （`[bstack]` / `BRANCH-SAFETY]` / `FILE-TYPE-GUARD]`）就是本節區塊 3 判定所依賴的字串。
- `scripts/plugin-contract.mjs:180`（P5）驗證 `scripts/extras.ps1` 與 `extras/statusline.sh` 存在。

---

## 契約：`scripts/plugin-contract.mjs`、`docs/tools/docs-site-contract.mjs` 新增項

### 改動意圖

對應 spec §5「驗證」。repo 沒有 test runner，plugin 化牽動的「manifest 對不對、觸發詞清乾淨沒有、
全域路徑字樣殘留沒有、多處計數同不同步」只能靠肉眼核對，這支把它們變成機械判定。這是全 repo
唯一一份新增的驗證腳本，Task 1 先寫（先紅）、其餘 Task 落地後逐條轉綠。

### 改動詳解

#### 區塊 1：P1–P8 涵蓋範圍

`scripts/plugin-contract.mjs:80-201`：P1（manifest 合法 + `name` 一致）、P2（hooks.json 合法 +
`${CLAUDE_PLUGIN_ROOT}` + 腳本存在 + state dir 不再指 plugin 內）、P3（skill 數量與 `name` == 目錄名 +
devwork 入口存在 + 無「觸發：」）、P4（無 `~/.claude/{skills,hooks,agents,settings.json,CLAUDE.md,
statusline.sh}` 字樣，白名單行除外）、P5（`setup.ps1`/`settings.json`/`state/` 已刪、`extras.ps1` 與
範本到位）、P6（rules.md 單一真相）、P7（agent frontmatter 齊 + README 計數一致）、P8（README /
index.html 的 skill 計數 == 磁碟數）。

#### 區塊 2：`description()` 解析器的 fail-closed 修正

`:52-58`（`description()`）：支援 YAML block scalar 四種指示符（`|` `|-` `>` `>-`），並刻意 fail-closed
——單行分支若只抓到指示符本身（`|` `>` `|-` 這幾個字元），回傳空字串而非把指示符當內容。docstring
（`:42-51`）直接寫出這是**兩輪**實跑抓到的問題：第一輪用 `\s` 而非 `[ \t]`，導致捕獲群組吃掉換行
連同下一行縮排、退回單行分支抓到 `"|"` 本身，讓 P3c（無「觸發：」）與 P7（agent 描述無「觸發：」）
斷言恆綠——就算 description 裡確實還留著「觸發：」字樣，因為解析器根本沒抓到真正內容，比對永遠
不命中。`--selftest`（`:61-71`）用合成 frontmatter 驗這個解析器本身，含 S4（區塊內空行不截斷）、
S5（`>-` 折疊寫法）、S6（只有指示符 → 空字串）。

#### 區塊 3：P4 白名單行數上限

`:147-149`：白名單正則從第一版的「舊版|不寫入|不碰」（過寬，任何句子只要提到這幾個詞就能合法
提及全域路徑）收緊成「`-Migrate|setup.ps1|遮蔽|bstack-bak|plugins/`」，且限制白名單行數
`ALLOW_MAX = 6`——這是 code review Minor 採納：白名單本身若可以無限增長，等於留了一個「拿遷移措辭
掩護新的全域路徑字樣」的漏洞，加上限比對，若某次改動把白名單行數推過 6，契約會紅、逼人回頭看
是不是白名單被濫用。

#### 區塊 4：`docs-site-contract.mjs` 新增 C8e/C8f/C8g

`docs/tools/docs-site-contract.mjs:362-370`（C8e）：把原本的「C8e CLAUDE.md 在內嵌包裡」改成
「rules.md 在內嵌包裡且含 §事實核實」。這是 code review 架構視角 Critical（C1）的直接產物：
docs 站內嵌的「根規則」原本指向 repo 根 `CLAUDE.md`，plugin 化後那份只剩 6 行 `@import` 殼，
內嵌它會讓文件索引面板的「根規則」點開是空殼、而契約字面上還是綠的（只檢查「檔案存在」不檢查
「內容有沒有實質內容」）——**空洞通過**。

`:372-393`（C8f）：內嵌正文裡每個 `<name>.md §` 交叉引用的 `name` 都要能在 app.js 的
`DOC_ID_BY_NAME` 對得到，這是同一個 Critical 的第二層——原本 35 處 `CLAUDE.md §…` 交叉引用改成
`rules.md §…` 後，若 `app.js` 的 `EXTRA_DOCS` 沒跟著改名（見下段），這 35 條連結會**靜默斷掉**，
兩支契約都不會紅。C8f 把它變成機械判定。

`:395-404`（C8g）：`index.html` 的 hero `<b>N</b><span>節點</span>` 與節點鏈計數器
`/ N 個節點` 兩處數字要等於 `data.js` 的節點數。舊版曾經同時停在 100（圖已經是 98），
C8a 只守 `data.js` 本身、守不到 HTML 裡另外手抄的兩個數字，C8g 補這個洞。

**不這樣做會怎樣**：不修 `description()` 解析器，P3c/P7 這兩條「觸發詞清乾淨了嗎」的核心斷言
永遠是假綠，等於整個「不因自然語言自動觸發」的承諾沒有機械驗證守著；不加 C8e/C8f/C8g，
docs 站的規則書連結會在使用者點開時才發現是空的或斷的，而不是在 CI／本地契約跑的時候。

### 關聯檔案

- P8 與 `docs/tools/docs-site-contract.mjs` 的 C8a／C8g 一起守 skill 計數（27→28）在
  `README.md`、`docs/index.html`、`docs/js/data.js` 三處是否同步。
- `scripts/build-references.ps1`（見下段）是 C8e/C8f 檢查的資料來源，其產出物
  `docs/js/references-data.js` 未逐行審。
- `verify.md`「Task 7」記錄兩支契約與 `build-references.ps1 -Check` 的最終跑法與結果。

---

## docs 站與 README

### 改動意圖

對應 spec §4d。docs 站是公開 GitHub Pages（merge 即上線），內容必須跟新的安裝模型一致：不再有
「同步進 `~/.claude/`」的四步驟，改成 plugin 三步；流程圖 prelude 要多一個 `devwork` 入口節點；
landing hero 三句與新模型矛盾（review Design M1）。README 同步改寫安裝章節、新增確認 / 遷移 / 移除
三份對照表。

### 改動詳解

#### 區塊 1：`docs/js/data.js` 新增 `LoadDevwork` 節點

`docs/js/data.js:54-57`（nodes）新增 `LoadDevwork` 節點插在 `Start` 與 `ClaudeMd` 之間，`Start`
label 從「user prompt」改成「user 輸入 /devwork + 要做的事\n不下指令 = 普通 Claude Code」
（`:54`）。`:190-192`（edges）原本 `Start → ClaudeMd`（邊上文字「寫 / 改 / 修 / 加」）拆成三條：
`Start → LoadDevwork → ClaudeMd → DevWfSkill`，淨增 1 節點、拆 1 邊補 2 邊淨增 1 邊——對應
`docs/tools/docs-site-contract.mjs:325-331`（C8a）EXPECT 從 98/135 改成 99/136。
`docs/js/app.js:61`（NODE_DOCS）加 `LoadDevwork:{p:'skills/devwork', n:'devwork', k:'skill'}`。

#### 區塊 2：`EXTRA_DOCS` 改名 `rules.md`（承接 C1 Critical 修正）

`docs/js/app.js:511-513`：`CLAUDE: {...key: 'references/CLAUDE.md'}` 改成
`RULES: {...n: 'rules.md', key: 'references/rules.md'}`。這是前段「契約」章節 C1 的另一半——
光改契約抓不出來還不夠，實際要把 docs 站指向正確的內嵌來源，兩者是同一個 commit 一起改的。

#### 區塊 3：landing hero 三句改文

`docs/index.html:44`（kicker：「零 marketplace 依賴」→「裝成 plugin、一個指令啟動」）、`:46`
（sub：「一份誰都繞不過的規則書，同步進 `~/.claude/` 就生效」→「一份規則書。打 `/devwork` 才啟動，
不打就是普通的 Claude Code」）、`:57`（攔截段落追加一句「兩支 hook 在啟用 plugin 的專案一律生效，
不需要 `/devwork`」）。h1（「讓它每一次都用同一種方式聰明」，`:45`）依 memory 記錄不動——這句
改過兩輪都更差，本次沿用既有結論、未再嘗試。`:61` 「每個請求進來先跑 Phase 0」加上「每個
`/devwork` 請求」的限定詞，避免讀者誤以為沒下指令也會跑 Phase 0。

#### 區塊 4：安裝步驟改三步、主推專案層級

`docs/index.html:109-115`（`#install` 區塊）從四步（clone → 同步進 `~/.claude/` → 裝兩個 MCP →
開新 session）改成三步：① 啟用 plugin（**推薦專案層級**，複製 `templates/project-settings.json`
到專案 `.claude/settings.json`；使用者層級與 `--plugin-dir` 試用列為選項並附代價說明「hooks 會在你
所有專案生效」）② 個人偏好走 `extras.ps1`，可跳過 ③ 開新 session 輸入
`/bstack:devwork`（註明裸 `/devwork` 目前也可）。README.md 對應改寫成 §A/§B/§C 三段
（`README.md` 「### A. 啟用 plugin」起），並新增四個小節：「確認 plugin 有載入」（4 步排錯路徑，
含「看到第二行 `[已載入 dev-workflow]` → 舊副本遮蔽」的判斷依據）、「什麼時候生效」（hooks／
rules.md／extras 三列生效範圍對照表，直接對應 review CC2）、「從舊版遷移」、「完全移除」
（`/plugin uninstall` / `extras.ps1 -Uninstall` / `extras.ps1 -Migrate` 三者各自拆什麼、不碰什麼）。

hook 延遲數字（`README.md` §Hooks 段）從原本「數百毫秒」的推斷改成**實測**數字：branch-safety
1310ms、file-type-guard 1168ms（pwsh 7.4、Windows 11、`Measure-Command` 餵 Write payload），
合計約 2.5 秒，主因是 pwsh 啟動時間，這條數字連著寫進「沒 pwsh 靜默失效」的 troubleshooting，
一併說明 Windows 是實測、macOS/Linux 是推斷（code review 架構視角採納意見）。

### 關聯檔案

- `docs/js/references-data.js` 是本節改動觸發 `build-references.ps1` 重跑的產出物，本 review 不逐行審。
- `docs/tools/docs-site-contract.mjs` 的 C8a/C8e/C8f/C8g（見前段）機械驗證本節列的所有數字與連結。
- `verify.md`「Task 7」與「紅線 grep」記錄 `docs-site-contract.mjs` 37 條全 PASS、
  `plugin-contract.mjs` 全 PASS、`build-references.ps1 -Check` PASS（35 份文件）的最終結果。

---

## 刪除 / 搬移的檔

### 改動意圖

對應 spec §4a「刪除」清單。這些是舊安裝模型的直接產物，plugin 化後不再需要或需要搬到非 plugin
路徑。

### 改動詳解

- **`scripts/setup.ps1`（665 行，刪除）**：功能被 `scripts/extras.ps1` 取代（見前段），但職責範圍
  刻意縮小——舊版連 plugin 核心（skill/agent/hook/CLAUDE.md）都一起 sync，新版明確「plugin 核心
  請用 `/plugin install`，本腳本只處理帶不進 plugin 的四項」（`extras.ps1:7` docstring）。
- **`settings.json`（63 行，repo 根目錄，刪除）**：原本靠 `setup.ps1` merge 進使用者的
  `~/.claude/settings.json`。其中 `permissions.allow` 唯讀白名單搬進
  `templates/project-settings.json` 當唯一來源；`env` 只留
  `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`（`ENABLE_TODO_TOOLS` 因無 skill 依賴而丟棄，plan §4a
  記錄理由）；原本的 `attribution` 區塊定案不接——spec 與 review Eng N9 都記錄這是作者個人偏好、
  與流程無關，不隨 plugin 散布。
- **`state/`（未追蹤目錄，刪除）**：舊版 file-type-guard 的 token 狀態目錄，功能被
  `hooks/file-type-guard.ps1` 改指系統 temp 取代（見「hooks 兩支腳本」章節）。
- **`statusline.sh` → `extras/statusline.sh`（100% 相似度搬移，內容不變）**：非 plugin 元件（plugin
  的 `settings.json` 元件只認 `agent`/`subagentStatusLine`，`statusLine` 不支援），改放
  `extras/` 表示「手動選用、由 `extras.ps1` 的 statusLine 項指到這裡的絕對路徑」。

**不這樣做會怎樣**：不刪 `setup.ps1` 而是與 `extras.ps1` 並存，會出現兩套安裝路徑同時有效、
使用者不知道該跑哪一個，且舊版覆蓋不備份的行為仍是活的風險；不搬 `statusline.sh`，plugin 根目錄
會混著「plugin 元件」與「plugin 帶不了、需要另外裝的東西」，破壞 plugin 目錄結構的可讀性。

### 關聯檔案

- `scripts/plugin-contract.mjs:169-180`（P5）機械驗證 `settings.json`、`scripts/setup.ps1`、
  `state/` 都已不存在，且 `scripts/extras.ps1`、`extras/statusline.sh` 都存在。
- `scripts/extras.ps1:93-99`（`ItemDefs.statusLine.Fragment`）讀取
  `extras/statusline.sh` 的絕對路徑組出 `statusLine` 設定片段。
- README.md 的「Prerequisites」段落已把 `jq` 從必要依賴改成「只有選了 statusLine 才需要」，
  反映這個依賴現在是可選項而非固定安裝步驟的一部分。

---

## 全域 patterns / cross-cutting

- **命名一致性**：全 repo 統一用「`rules.md §<章節>`」取代舊的「`CLAUDE.md §<章節>`」引用寫法，
  包含 skill/agent body、docs 站文案、README。這不是逐字替換——`skills/write-skill/SKILL.md:239`
  Red Flags 表最後一條刻意保留「CLAUDE.md」泛稱（「SKILL.md 與 CLAUDE.md 這類給 AI 讀的 prompt
  檔」），因為那裡講的是檔案類型的通稱，不是本 repo 這份特定守則的引用。
- **命名空間 vs 裸名**：全 repo只有一處明寫 `/bstack:` 前綴清單——`skills/devwork/SKILL.md`
  §顯式呼叫其他 skill 段（design Minor m4/n2 採納：其他 25 個 skill description 不重複寫前綴，
  避免使用者以為每個 skill 都要記一套呼叫語法）。
- **fail-closed 貫穿契約腳本**：`plugin-contract.mjs` 的 `description()` 解析器與
  `docs-site-contract.mjs` 的 C8e 都刻意選擇「抓不到內容就當作沒抓到」而非「抓到指示符字元就當作
  有內容」，這個設計哲學同時出現在兩支獨立契約腳本裡，是 code review 過程中共同抓出的一類 bug
  （測試腳本本身的假綠）。
- **搬移優於刪除**：`extras.ps1` 的 `-Migrate` 對疑似舊副本一律搬進備份目錄而非直接刪除
  （security audit Major #2），這個「判定用推定、動作要可逆」的原則沒有推廣到 `-Uninstall`——
  `-Uninstall` 對 manifest 記錄的 key 是直接拔除，因為那些 key 的所有權是機械記錄下來的、不是推定。

---

## 後續 follow-up

- [ ] hooks 只有 pwsh 版本；`sh` 包裝跨平台降級（架構視角 M4）留作 follow-up issue，spec §4f 明列
      本次不做，理由是不改 hook 語言範圍。
- [ ] clone 者的 `enabledPlugins` 是否自動安裝未經 post-merge 實測驗證（spec §7 風險列表、README
      已保守寫「若沒自動裝再手動 `/plugin install`」）。
- [ ] hooks.json WARN token 流程的互動式驗證（Dockerfile 建 token 放行的完整往返）未實測——
      `-p` 單輪模式不穩定跑不出多輪互動，`verify.md` 記為「留 post-merge 互動驗證」。
- [ ] marketplace source 目前無版本 pin（平台限制，非本 PR 可解），README §A1 已加警語建議
      需要更嚴格控管的使用者 fork 自管。

---

## 安全 / PII 檢查

- **secret / API key**：本 PR 未新增任何寫死的密鑰或憑證；`scripts/extras.ps1` 的 mysql MCP
  相關程式碼（`:304-306`）刻意只印指令範本讓使用者自己填帳密，不寫進任何檔案。
- **PII mask**：無涉及使用者個資的改動。`docs/work/refactor/plugin-install/verify.md` 內出現的
  `tommy_sian`（本機使用者名，用於 per-user token 目錄示例）是作者本機的系統帳號名，不是外部
  使用者 PII，且已隨 PR 進版控（作者本人資訊）。
- **file-type 硬規則命中**：本 PR 動到 `.github/` 以外無 CI/CD 檔、無 DB migration、無鎖檔、無
  Dockerfile/infra 檔，未觸發任何硬規則升級 Tier 的條件（本次 Tier=T3 是量體判定，非規則觸發）。
- **已知安全接受風險**（security audit 記錄、非本 PR 需解）：守則只在 `/devwork` 後生效（user
  已定案接受）、沒 pwsh 時 hook 靜默失效（已在 README 揭露）、hook fail-open（既有刻意設計）、
  symlink 別名繞過 file-type-guard（既有行為、非本 PR 引入）。
