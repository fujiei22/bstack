# PR review：效率優化三項（skill 延遲載入 / dev-workflow 去重 / hook 改 node）

> PR: https://github.com/fujiei22/bstack/pull/71
> Branch: `refactor/skill-load-and-node-hook`（base: `main`）
> 對應 spec/plan: `docs/work/refactor/skill-load-and-node-hook/{spec,plan}.md`
> 25 檔、942 insertions / 368 deletions

## 為什麼要有這支 PR

user 明訂的硬前提：**流程邏輯零改變**。這不是加功能，是把三個「跑起來一樣、但每次都在燒 token 或燒秒數」的地方換掉：

1. **`design-language` 每個 task 必載約 17 KB**，但多數 task（純後端）只用得到它使用契約第 1 步那個「這批檔有沒有前端副檔名」的比對，比完就結束。等於為了一個布林值載整份 skill。
2. **`dev-workflow` 重貼了 `brainstorm` 已經有的 Track / Tier 判定表**。Phase 0 執行時 `brainstorm` 一定先載入，`dev-workflow` 那份從來沒被拿來做過判定，純粹是兩份文件會漂移的風險。
3. **兩支 pwsh hook（`branch-safety.ps1` + `file-type-guard.ps1`）每次 Write / Edit 都各起一個 `pwsh -NoProfile`**，實測合計約 3.2 秒（pwsh 啟動佔 9 成），一支 PR 六十次編輯等於燒 3 分鐘什麼都沒做；而且 pwsh 不在 PATH 時是**靜默失效**（見 memory `reference_claude_code_plugin_facts`），保護消失但沒人知道。

三項改動都不改「擋不擋、走哪條路」的判定結果，只改「怎麼算出這個結果、多快算出來」。因此整支 PR 的驗證重心不是「新功能對不對」，而是「新舊兩條路徑輸出是否逐位元相同」——這也是為什麼這支 PR 帶了一份一次性的對照測試腳本和永久契約檢查，篇幅比改動本身還大。

---

## `hooks/guard.mjs`（新增，228 行）— 取代兩支 pwsh hook 的核心

### 為何要重寫成一支 node 檔

- **效能**：pwsh 是兩支獨立程序，各自付一次直譯器啟動成本（約 1.1 秒）；node 空啟動約 0.3-0.5 秒，且合成一支後只啟動一次。實測（`README.md` diff）：repo 內檔案（含一次 `git rev-parse`）約 456 ms，repo 外約 268 ms，對比舊的約 3,200 ms。
- **可用性**：Claude Code 是 native binary、本身不帶 node（官方 `/setup` 文件），但 node 在一般開發機上比 pwsh 7 更常見，尤其 macOS/Linux 上 pwsh 是外裝品。這是「往好的方向換依賴」，但不是零風險（見下方「缺 node 時的行為」）。

### 結構怎麼對應舊 ps1

檔案分四塊，每塊都直接對應 spec `§等價清單` 的一條或多條規則：

**`targetOf(payload)`（第 51-62 行）** — 判斷這次工具呼叫是不是三類寫入之一（`Write` / `Edit` / `NotebookEdit`，大小寫不敏感，對應舊 pwsh `switch` 預設不分大小寫），並取出目標路徑。這裡有三層特意做的容錯，都對應等價清單裡的具體案例：
- `payload === undefined`（stdin 真的是空字串）→ 仍回 `isWrite: true`，讓後面的 branch 段照舊查 branch。這是舊 `branch-safety.ps1` 的既有行為：JSON 解析失敗才放行，**stdin 空不算解析失敗**，是直接跳過 scope check 去查 branch。這條在 plan 第一版漏掉（review 標為 Eng C1 級），v2 補進去。
- `payload === null` 或非物件（scalar JSON 如 `"x"` / `123`）→ `isWrite: false`。因為舊 ps1 對這種 payload 取 `.tool_name` 會得到 `null`，落到 `switch` 的 `default` 分支直接 exit 0。
- `file_path` / `notebook_path` 非字串（數字、物件）→ 一律當作「沒帶路徑」（`str()` 這個小 helper 只在型別是非空字串時才回傳原值）。這條是本 PR**唯一比舊版嚴格的地方**（等價清單 D3，security-audit 抓出的真實回歸，見下方「security-audit finding」）。

**`tokenPathFor(normalized, env, platform, dirExists)`（第 70-78 行）** — 算 confirm token 該放哪裡。這裡刻意**不用 `os.tmpdir()`**，因為 node 內建的 tmp 目錄搜尋順序（win32 上是 `TEMP → TMP`）跟舊 pwsh 用的 .NET `GetTempPath()` 順序（`TMP → TEMP → USERPROFILE → windir`）不一樣——如果直接用 `os.tmpdir()`，同一台機器新舊兩版算出的 token 路徑會對不上，等於升級當下所有還沒消費的 token 全部失效。所以這裡自己重新讀 `env` 手動排序，逐字照抄 .NET 的優先順序。`dirExists` 被設計成可注入的參數（預設 `existsSync`），這樣契約測試可以傳 `() => false` 避免真的碰磁碟。

**`decide(payload, ctx)`（第 88-157 行）** — 真正的判定邏輯，純函式、不做任何 IO，所有外部依賴（`repoDir`、`getBranch()`、`env`、`consumeToken()`、`ensureStateDir()`）都透過 `ctx` 注入。分兩段跑，**兩段都跑、兩邊訊息都印、任一 block 就 `exit 2`**（第 90-157 行的流程本身）：

- **branch-safety 段**（第 94-124 行）：只有目標路徑落在 repo 外時才跳過（`inScope` 判斷），取不到路徑時照舊查 branch。這裡有個叫 `canonical()` 的內部函式（第 97-107 行）專門處理 **Windows 8.3 短檔名**問題：舊版用的 .NET `GetFullPath()` 會自動把 `TOMMY_~1` 這種短檔名展開成 `tommy_sian`，但 node 的 `path.resolve()` 不會。如果 `CLAUDE_PROJECT_DIR` 用短檔名、`file_path` 用長檔名（或反過來），字串比對就會誤判「在 repo 外」而放行——这是 code-review 的 finder 實測抓到的行為差異（`removed-behaviour` finder，見下方「code-review finding」）。`canonical()` 的做法是用 `realpathSync.native` 把路徑展開到「最深仍存在的祖先目錄」，再把後面還不存在的路徑段接回去（因為要寫入的目標檔通常還不存在，不能整條路徑直接 realpath）。
- **file-type 段**（第 126-156 行）：**不看 repo scope**——這是刻意的，舊 `file-type-guard.ps1` 本來就沒有 scope check，repo 外的 `~/.gitconfig`、`~/.npmrc` 一樣要被 WARN，這正是 rules.md `§File-type` 表列 shell config 的用意。合成一支的風險是「把 branch 段的 repo-外放行邏輯錯誤地套用到 file-type 段」，等於靜默廢掉這條規則；等價清單專門列了 C4 這一條來標注這個邊界，契約 P2d 的 fixture #4（repo 外 `.gitconfig` + protected branch → 期望 WARN、不含「目前在」）就是守這個。

**CLI 段（`main()`，第 160-218 行）** — 讀 stdin、跑 git、做 token 檔的實際 IO。幾個值得注意的細節：
- `getBranch()`（第 187-199 行）在 `execFileSync('git', …)` 遇到 `ENOENT` 且平台是 win32 時，會**退回帶 shell 的方式重跑一次**。這是因為某些機器上 PATH 裡的 `git` 只有 `.cmd` / `.bat` 包裝，Node 的 `execFileSync` 不像 pwsh 那樣自動吃 `PATHEXT`，直接用 `spawn` 不帶 shell 會找不到執行檔而回 `ENOENT`；舊 pwsh 版本不會有這個問題。這條也是 code-review finder 實測出的行為差異，修法是「只在 `ENOENT` 且 win32 才多花約 50ms 重試」，不影響其他錯誤路徑（非 git repo、無 commit 這些原本就該放行的情況維持放行）。
- `--token <path>` 子命令（第 162-176 行）：讓 AI 照抄 WARN 訊息裡的指令去建 confirm token，不用再手動拼 PowerShell 的 `New-Item` 語法（也順便避開 Bash 工具會吃反斜線的問題，見下方 stderr 措辭那段）。這裡有個安全檢查（第 166-169 行）：只准把 token 建在「用當下 env 算出來的 state dir」底下，不能被當成任意路徑的 touch 工具，這是 security-audit 抓出的 Minor finding。建檔用 `writeFileSync`（不是 append）並手動 `utimesSync` 刷新 mtime——因為舊 pwsh 的 `New-Item -Force` 對已存在的檔案會整個重建、mtime 會刷新到當下，如果 node 版對既有 token 檔用 append，TTL 的起算點就會跟舊版對不上（這是 code-review high 找出的），改成先整個 `writeFileSync` 覆寫再手動戳時間，兩邊行為對齊。

### 為何非字串 `file_path` 改成「沒帶路徑」而不是放行

這是等價清單裡標記為「刻意比舊版嚴格」的 D3，背景是 security-audit 在稽核第一版草稿時**實測出一個真的能繞過 protected branch 保護的漏洞**：`file_path` 如果是數字（比如 AI 不小心把路徑寫成非字串型別），`path.resolve()` 會直接丟 `TypeError`，如果外層用 `try/catch` 把這個錯誤吞掉當成「解析失敗 = repo 外」處理，就會導致 branch-safety 段整段被跳過，main 分支上直接放行寫入。而舊 pwsh 版本因為隱式型別轉換的關係，反而會把數字轉成字串、算出一個落在 repo 內的路徑，照樣擋下來——也就是說如果不修，node 版會比舊版**更容易被繞過**，是真的 regression。修法是在 `targetOf()` 裡明確檢查型別，非字串一律當作「沒帶路徑」，branch 段照樣查（因為沒路徑本來就該照舊查 branch，等價清單 B2 那條），file-type 段自然沒得判。

---

## `hooks/hooks.json` — 兩個 command 併成一個

```
- pwsh -NoProfile -File "${CLAUDE_PLUGIN_ROOT}/hooks/branch-safety.ps1"
- pwsh -NoProfile -File "${CLAUDE_PLUGIN_ROOT}/hooks/file-type-guard.ps1"
+ node "${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs"
```

**為何这樣做等價於原本**：官方 hooks 文件說同一個 matcher 底下多個 hook 是平行執行、stderr 合併輸出、任一個 `exit 2` 就整體 block。所以兩支獨立 pwsh 和「一支腳本內部跑兩段邏輯、任一 block 就整支 exit 2」在使用者看到的行為上是等價的，唯一可觀察差異是 stderr 行的順序從「不定」變成「固定先印 branch 段」。這個差異在對照測試裡被視為可接受（不影響 exit code 也不影響訊息內容集合）。

**關聯**：`scripts/plugin-contract.mjs` 的 `P2a` 檢查從「至少 2 個 command」改成「至少 1 個 command 且必須是 `node "…"` 形式」，直接對這個檔案的結構做機械驗證。

---

## `hooks/branch-safety.ps1` / `hooks/file-type-guard.ps1`（刪除）

兩支檔案整支刪除，邏輯已完全搬進 `guard.mjs`。舊檔仍可透過 `git show 8dbb203:hooks/<x>.ps1` 取出，這也是對照測試腳本取「基準行為」的方式（見下方）。

**關聯**：五個 skill 檔（`brainstorm`、`design-language`、`dev-workflow`、`devwork/rules.md`、`design-direction`、`finish-branch`、`dispatch-parallel`）裡所有寫死這兩個檔名的地方都要同步改成 `hooks/guard.mjs`（branch-safety 段 / file-type 段），否則文件會指向不存在的檔案。`scripts/extras.ps1` 第 411 行的舊 hook 檔名清單**刻意不動**——那是 `-Migrate` 用來清理 `setup.ps1` 時代裝在 `~/.claude/hooks/` 的舊副本，檔名本來就該是舊的，改了反而會讓遷移腳本找不到要清的東西。

---

## `docs/work/refactor/skill-load-and-node-hook/hook-equivalence.mjs`（新增，一次性腳本）

### 為何存在、為何不放進 `scripts/`

這是本 PR 風險最高的部分（重寫 hook 邏輯）唯一的「地毯式」驗證方式：對同一組約 37 個 stdin payload，分別餵給舊的兩支 pwsh（用 `git show 8dbb203:` 從 git history 取出來還原到暫存目錄）和新的一支 node，逐案比較。之所以不放進 `scripts/` 當永久測試，是因為：
1. 它需要 pwsh 7+ 在 PATH（本 PR 之後 pwsh 已經不再是必需依賴，一支永久測試卻反過來要求 pwsh，方向矛盾）；
2. 它靠 git history 取舊檔，未來如果 rewrite history 這支就跑不了，屬於「一次性量測」的性質，不適合當永久契約。

真正要永久守住的邏輯改成契約裡的 `P2d`（直接 import `decide()` 對 fixture 跑，不碰磁碟）和 `P2e`（真的 `spawnSync` 兩案，測 CLI 層）。這支腳本產出的證據（37 案 ALL EQUAL）連同對照表整份貼進了 `spec.md` 的施工紀錄，等於是「留一份體檢報告」而不是把體檢儀器留在 repo 裡長期維護。

### 比對邏輯要點

- 判等規則：`max(舊 branch exit, 舊 file-type exit) == 新 exit`，外加 `[bstack]` 開頭的訊息標記集合（目前在 / BLOCK / WARN / state dir）要相等，WARN 案兩邊印出的 token 路徑要相等（正規化分隔符後），token 案跑完要驗證 token 檔真的被刪除、`consumed.log` 各多一行。
- 開頭會先探測 pwsh 是否真的可用（`pwshProbe`），探測失敗直接 `process.exit(2)` 停下——這是吸取了 code-review 抓到的一個坑：`spawnSync` 沒跑起來時 `status` 會是 `null`，`Math.max(null, null)` 算出來是 `0`，如果沒防這一手，會把「舊 hook 根本沒執行」誤記成「舊 hook 判定放行」，整張對照表會假綠。
- 也修過一次真的環境問題：第一輪跑出 5 案假紅，原因是量測環境給的 `TMP` 是 Windows 8.3 短檔名（`TOMMY_~1`），.NET `GetTempPath()` 回傳長檔名而 node 照 env 原樣印出短檔名，兩邊字串對不上；後來在腳本裡用 `realpathSync.native` 把工作目錄先展開成長檔名，全部案例才對齊。

---

## `scripts/plugin-contract.mjs`（新增約 90 行檢查邏輯）

### P2a / P2b / P2c（改寫既有檢查）

配合 `hooks.json` 從兩個 command 變一個，`P2a` 的門檻從「≥2 個 command」改成「≥1 個 command 且每個都是 `node "…"` 開頭」；`P2c` 從只檢查 `file-type-guard.ps1` 不寫 plugin 目錄內的 state 目錄，改成檢查 `guard.mjs` 沒有這個問題**並且**確認兩支舊 `.ps1` 真的已經刪除（避免「新舊並存」這種半吊子狀態被漏掉）。

### P2d（新增）— 對純函式跑 fixture，30 案

直接 `import '../hooks/guard.mjs'`，拿到 `decide` 和 `tokenPathFor` 兩個 export，對照 spec `§等價清單`逐案跑。特別要指出這裡的 `ctxOf()` helper（第 100-107 行左右）把 `realpath` 注入成一個永遠 `throw` 的函式——用意是讓 `canonical()` 退回到單純的 `path.resolve()` 分支，因為 fixture 用的路徑（`C:\repo`、`C:\Users\x\...`）在跑測試的機器上根本不存在，不能真的呼叫 `realpathSync.native`。案例涵蓋大小寫、雙訊息、token 三態、shell config 不看 scope、非字串 `file_path`、8.3 短檔名混合等等，其中第 30 案專門驗證短檔名情境（`repoDir` 給短檔名、`file_path` 給長檔名，注入的 `realpath` 把兩者都轉成長檔名）仍然判定為「在 repo 內、擋下來」。

### P2e（新增）— 為何要真的 `spawnSync`

P2d 全部用 mock，不會碰到「CLI 有沒有真的接上 `decide()`」「有沒有真的呼叫 git」「`--token` 子命令的檔案 IO 對不對」這幾件事——如果 `main()` 裡漏接一段、或者參數傳錯，P2d 一樣會綠燈。所以 P2e 用 `spawnSync(process.execPath, ['hooks/guard.mjs'])` 真的起一個 node 子程序，並且**真的建了一個臨時 git repo**（`git init -b main`、commit 一次）來測試 `getBranch()` 真的能拿到 branch 名字並判定擋下來。同時測 WARN → 用回傳的 stderr 抓出 `--token` 指令 → 真的執行子命令建 token → 再跑一次確認放行、token 檔案已被刪除、`consumed.log` 真的多了一行 `valid=True`。這是 code-review 的 Major finding：「永久契約沒有一案真的 spawn git」和「`--token` 子命令與 consumeToken 的真實 IO 零測試」的直接回應。

### P11（新增）— 守三處（實為七處）副檔名清單一致

因為延遲載入的設計是「`brainstorm` 自己內嵌一份前端副檔名清單去做零成本比對，不命中才不載入 `design-language`」，這份清單现在**多處重複**：判定用的三處（`brainstorm §Phase 0b′`、`design-language §前端副檔名`、`rules.md §設計語言對齊`）加上觸發用的四處（`frontend-test`、`verify-done`、`dev-workflow` 跨流程表、流程圖 `DesignQ` label）。任何一處漂掉都可能導致 `brainstorm` 對某個副檔名判「不命中」而漏掉本該做的設計對齊。P11 用 `section()` 這個 helper 先按標題正則切出對應區段，再用 `exts()` 把區段內容 tokenize 成排序後的副檔名清單做比較（不是直接字串比對，因為各處格式不同，直接比字串會被空白或標點差異咬死）。切片邏輯本身在開發過程中修過一次：第一版對 `design-language` 那節整段做 tokenize 會不小心抓到「現況分歧」那則備註裡提到的 `.sass`，改成只抓 fenced code block 內容，並且要容忍 CRLF 換行。

---

## Skill 文本改動 — 哪些是搬字、哪些是新增判定步驟

### `skills/brainstorm/SKILL.md` §Phase 0b′

這是三項改動裡**唯一新增了判定邏輯**的地方，其餘幾乎都是「搬字」（改檔名引用、改措辭讓句子跟新流程一致）。

原本四步是：「載入 design-language → 取六欄 → involved=false 就結束 → involved=true 進合併確認」。新四步是：「**自己做副檔名比對**（不載入）→ 不命中就直接把六欄寫成空值、不載入 design-language、進 0c → **命中才載入**、載入後照 design-language 自己的使用契約從第 1 步重跑一次 → involved=true 進合併確認」。

步驟數維持四步，但第 1 步的**內容**從「載入」變成「比對；命中才載入」——這正是效率提升的落點：不命中的情境（絕大多數純後端 task）現在完全不用把 17 KB 的 `design-language` skill 讀進 context。

為什麼這仍算「零邏輯改變」：`design-language` 本身使用契約的第一步向來就是這個副檔名比對，只是以前不管命不命中都要先把整份 skill 載進來才能跑到那一步。現在把這一步「搬到」呼叫端先做，判定邏輯的內容一字不差（清單、剔除 skill 定義目錄的規則都是照抄），只是**誰來執行**這一步變了。命中之後仍然完整走一遍 `design-language` 的契約（從第 1 步開始），第 1 步會重算一次 `involved`，理論上必然是 `true`——這是刻意設計的「自我校驗」，如果重算結果不是 true 代表兩處判定邏輯不一致，而不是把這步省略掉。

比對邏輯裡有一條容易被忽略的細節：**要先剔除路徑含 `skills/<name>/SKILL.md` 的 skill 定義目錄底下的檔**，再做副檔名比對，並且**不能用裸 `skills/` 字串比對**——因為有些專案本身就有一個叫 `skills/` 的產品目錄（跟 plugin 系統的 skill 目錄同名但語意完全不同），裸比對會把這種專案的真實前端介面靜默排除在判定之外。這條規則以前只在 `design-language` 裡定義一份，`brainstorm` 引用它；現在因為 `brainstorm` 判定時根本沒載入 `design-language`，這條規則必須**整句內嵌**進 `brainstorm` 自己的文本（第一版 plan 只寫「規則同 design-language 第 1 步」，review 的 DX/Eng 視角都指出這是死引用——不命中的情境正是沒載入對方的情境，引用形同虛設，plan v2 改成內嵌並讓 P11 守 `SKILL.md` 這個字樣有出現）。

### `skills/design-language/SKILL.md`

改動集中在三處措辭，邏輯不變：
- frontmatter `description` 的「必載」改成「比對命中才載」，讓 skill 自己的描述跟新的載入時機一致；
- `§前端副檔名` 那節加了一句「唯一例外」，說明 `brainstorm` 和 `rules.md` 是**判定用**允許重列這份清單的兩處（因為它們要在「沒載入本 skill」的情境下也能判斷），另外還點名四處**觸發用**的引用，並註明 P11 守七處一致；
- Red Flags 表裡「純後端 task，這個 skill 跳過」那條的說明,從「反正第一步零成本，不用跳」改成「純後端 task 這個 skill現在根本不會被載入，不用在這裡重判要不要跑」——這句話的變化準確反映了架構上的位移：以前是「載入了但快速結束」，現在是「壓根不載入」。

### `skills/dev-workflow/SKILL.md`

純去重，沒有新增邏輯。刪掉的是「Track 判定 heuristic」表、「Tier 判定 heuristic」表、以及「Tier 自動升級」這一整段（約 20 行），換成一行文字指向 `brainstorm §Phase 0c` / `§Phase 0d`。理由是 Phase 0 執行時 `brainstorm` 一定已經載入，`dev-workflow` 裡的這兩張表從來不是任何判定的依據，純粹是「同一份規則抄了兩份」的維護負擔，兩份表格內容也確實是子集關係（`dev-workflow` 被刪的表沒有一列是 `brainstorm` 對應章節沒有的）。同步改了 Phase 0 流程圖裡 `0b′` 那一行的文字（「載 design-language」→「比對前端副檔名，命中才載」）、skill 分工表的一列、以及跨流程 skill 載入表裡 `design-language` 那一列的觸發條件敘述。

### `skills/devwork/rules.md`

三處措辭同步：`§Branch safety` 和 `§File-type` 的檔名引用改成 `hooks/guard.mjs`（並標注是 branch-safety 段還是 file-type 段）；`§Branch safety` 的豁免說明句尾加了一段解釋 node 版「缺 node」時的行為（見下一節）；`§設計語言對齊` 的判定句改寫，強調「規則不變，只是比對這一步搬到 brainstorm」。

---

## 契約新增檢查各守什麼（總覽表）

| 檢查 | 守什麼 | 為什麼需要 |
|---|---|---|
| P2a（改） | `hooks.json` 只剩一個 command、且是 `node "…"` 形式 | 防止合併失敗回退成兩個 command、或誤寫成裸指令沒用變數 |
| P2b（沿用） | `hooks.json` 指到的腳本檔案真的存在 | 防止路徑打錯導致每次編輯都噴 hook 執行失敗 |
| P2c（改） | `guard.mjs` 不寫 plugin 目錄內的 state/、且兩支舊 ps1 真的刪了 | 防止 token 誤寫進 plugin 快取（更新即清空），或新舊兩套 hook 半吊子並存 |
| P2d（新） | `decide()` / `tokenPathFor()` 對 30 個 fixture 給出正確判定 | 純函式層級的地毯式回歸測試，覆蓋等價清單列出的每一條行為 |
| P2e（新） | 真的 `spawnSync` 兩案（含真 git repo、真 token 檔案 IO） | P2d 全 mock 測不到「CLI 有沒有真的接上邏輯」這件事，這裡補上 |
| P11（新） | 前端副檔名清單七處（三處判定、四處觸發）內容一致 | 延遲載入設計必然造成清單多處重複，這裡防止漂移 |

---

## 缺 node 時的行為，以及文件怎麼寫

這是本 PR 一個容易被誇大或講錯的地方，plan review 階段的 Design 和 DX 視角都對此提出過 Critical 級意見。

**官方文件怎麼說**：Claude Code hooks 官方文件的說法是，hook 命令本身起不來（比如找不到 `node`）屬於「non-blocking」失敗，會印一行通知，但**工具呼叫照樣執行**——也就是說即便印了通知，保護本身依然不存在，差別只在「使用者看不看得到」。

**這支 PR 實測了什麼**：把 `hooks.json` 的 command 暫改成一個不存在的指令（`node-nope`），用 `claude --plugin-dir <臨時 plugin> -p "用 Write 建 probe.txt" --output-format stream-json` 在非互動模式下跑一次。結果是輸出裡**完全沒有**任何提到 hook / non-blocking / node-nope 的訊息，`probe.txt` 照樣被寫入——也就是說在 Windows 非互動模式下，這件事是**完全靜默**的，跟官方文件說的「會印一行通知」不符（互動模式底下是否會印通知，這次沒測）。

**文件怎麼寫**：`rules.md`、`README.md`、`docs/index.html`、`scripts/install.ps1` 四處統一措辭成「兩種說法下保護都不存在，只能靠 `node --version` 事前確認」——不管官方文件說的通知有沒有印出來，結論都一樣：不能指望這個機制會主動告訴你保護消失了。`install.ps1` 額外在前置檢查加了 `Get-Command node`，缺的話直接印安裝指令（`winget install OpenJS.NodeJS.LTS` / `brew install node`）並讓腳本失敗退出，這是**主動**攔一次，跟 hook 本身「被動、可能靜默」的性質互補。

---

## 公開文案（`README.md`、`docs/index.html`）

改動全是文字節點和 meta content，沒有動任何 CSS / class / 屬性。共 8 處：`docs/index.html` 的三個 meta description（`<meta name="description">`、`og:description`、`twitter:description`）、hero 段落一句、stat 數字區塊（`2 hooks` → `1 hook`）、inventory 清單一列、第一段落的攔截說明（把「兩支 hook」「branch-safety.ps1」「file-type-guard.ps1」全部改寫成「一支 guard.mjs，兩段檢查」的敘述）、安裝段落的前置需求說明。`README.md` 的 Hooks 表格從「兩個 hook 各自一列」改成「一個 hook、兩段各一列」，Prerequisites 表格把 pwsh 從「hook 必需」改寫成「只有 `install.ps1` / `extras.ps1` 這兩支輔助腳本需要」，Node.js 從「只有選了 MCP 才需要」改寫成「hook 必需（MCP 也用）」——這是**改寫既有列**而不是新增一列。

因為這些改動屬於「只改文字節點」，依 `rules.md §設計語言對齊` 的豁免條款不需要走 `design-language` 對齊流程；但 `verify-done` 仍然對 diff 跑了 `text-only-diff.mjs`，因為 diff 裡混了 `docs/js/data.js`（.js 檔）和多個 `.mjs` 檔，判定結果是 NOT-TEXT-ONLY，所以 T3 仍然照規則派了一個 `frontend-e2e-runner` 去跑 docs 站的 index 頁和 flow 頁的截圖驗證（結果見 spec 施工紀錄，全數 PASS，一項因既有缺陷判 INCONCLUSIVE 但註明「非本 PR 造成」）。

---

## `docs/js/data.js` — 流程圖三個 label

`HBranch`、`HFile` 兩個節點的 label 從 `branch-safety.ps1 hook` / `file-type-guard.ps1 hook` 改成 `guard.mjs（branch-safety 段）` / `guard.mjs（file-type 段）`；`LoadDLang` 節點的 label 從「必跑（第 1 步是零成本副檔名比對）」改成「0b′ 比對命中前端副檔名才載（比對在 brainstorm）」，準確反映判定邏輯已經搬到 `brainstorm` 這件事。這三個 label 改動也被 P11 的「觸發用四處」裡的 `data.js DesignQ` 那一項間接覆蓋。

---

## 其餘檔名引用同步

`skills/design-direction/SKILL.md`、`skills/finish-branch/SKILL.md`、`skills/dispatch-parallel/SKILL.md` 三處都只是把寫死的 `hooks/branch-safety.ps1` 換成 `hooks/guard.mjs`（branch-safety 段），純文字替換，沒有邏輯變化。`dispatch-parallel` 額外把「兩個 PreToolUse hook」改成「一支 PreToolUse hook（兩段檢查）」。`docs/js/references-data.js` 是 `build-references.ps1` 重新產生的衍生檔，本身不是手改的。

---

## 讀 diff 時發現的疑點

沒有發現需要回報的新問題。以下幾點值得記錄但都已經在 spec 的施工紀錄裡有明確處置或明確標記為「已知、不擋」，重讀 diff 後同意這些處置：

1. **`plugin-contract.mjs` 的 P2e 用了三次動態 `await import(...)`（`node:child_process`、`node:os`、`node:fs`）**，而不是在檔案頂端統一 import。看程式碼註解是因為這段邏輯寫在條件分支（`if`/`else`）內、不能用靜態 `import` 宣告；這是 ES module 的語法限制，不是疏漏，只是讀起來稍微不直覺，不影響正確性。
2. **`docs/work/refactor/skill-load-and-node-hook/hook-equivalence.mjs` 依賴 git history 上的 `8dbb203` 這個 commit** 才能取出舊版 `.ps1` 檔案內容。這在 spec `§待釐清` 裡已經明確記錄為「未來 rewrite history 就跑不了，屬預期」，因為這支腳本本來就是一次性的、不是永久契約，沒有進一步動作需要。
3. **`scripts/extras.ps1` 第 411 行仍然保留舊 `.ps1` 檔名的字面字串**，是 diff 之外的檔案、本 PR 沒有動它。這是刻意排除（spec `§範圍` 的「排除」一項有寫明），因為那個清單是給 `-Migrate` 用來清理舊版 `setup.ps1` 時代裝在 `~/.claude/hooks/` 的殘留副本，語意上就該保留舊檔名，不算遺漏。
4. **P2d 第 30 案（8.3 短檔名混合）注入的 `realpath` 是一個簡單的字串取代**（`p.replace(/TOMMY_~1/i, 'tommy_sian')`），跟真實環境裡 `realpathSync.native` 的行為只是形似而非完全模擬。這樣測出來的其實是「`canonical()` 的路徑拼接邏輯在拿到展開後的路徑時是否正確」，而不是「短檔名展開本身對不對」——短檔名展開的正確性是靠 node 內建的 `realpathSync.native`，不是這支程式碼要驗的範圍，所以用簡化的 mock 是合理的，不是測試造假。

## 落檔路徑

`docs/work/refactor/skill-load-and-node-hook/pr-review.md`
