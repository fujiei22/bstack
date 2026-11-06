## Eng 視角 review

實測基準：`node scripts/plugin-contract.mjs` 現況 `ALL PASS`（P1-P18 全綠）。`section()` 的四處抽取、P14 白名單、TOKEN14 掃描都用真實檔案跑過，結果寫在對應 finding 裡。

### Critical

**C1. P18 這個編號已經被佔用，新契約會撞名**

- 位置：`scripts/plugin-contract.mjs:575-587`（既有 `const p18` + `check('P18 T2 security-audit 七項面向…')`）vs plan Task 1 Step 1。
- 問題：實跑輸出已有一行 `PASS  P18 T2 security-audit 七項面向…`。檔頭第 10-17 行的契約索引也只排到 P17，漏記了這條既有 P18。
- 後果：輸出兩條 P18；plan 裡 Task 1/2/3/4/5 的 `grep -A1 "P18"` 與 `grep -E "P14|P18"` 全部會抓到兩條，Step 2「確認失敗」與 Step 4「確認通過」的判讀都失準。語法本身不會錯（新 code 包在 `{ }` 裡，內層 `const p18` 只是遮蔽外層），所以 CI 不會替你擋。
- 建議：新契約改編號 `P19`，變數改 `p19` / `HEADS19` / `PHASE19`，並補進檔頭第 13-15 行那張索引。

**C2. `section` 這個 helper 名稱也已存在，而且既有那支更正確**

- 位置：`scripts/plugin-contract.mjs:497` `const section = (text, startRe) => { … rest.search(/^#{2,3} /m) … }` vs plan Task 1 Step 1 新寫的 `section(text, head, level)`。
- 問題：新的包在 `{ }` 內是合法遮蔽、不會 `SyntaxError`（已驗），但同一個檔裡兩支同名不同簽名的 helper 是維護陷阱。既有那支用 `rest.search(/^#{2,3} /m)`，`##` 與 `###` 都會停，沒有下面 m1 的截斷問題。
- 建議：不要新增 helper，直接用既有的：`section(hostsMd, /^## §Host 判定[^\n]*\n/m)`、`section(rules16, /^### §決策點選單[^\n]*\n/m)`、`section(fb18, /^## §Squash merge[^\n]*\n/m)`。

**C3. rules.md 其餘三節的無條件句沒改，而 rules.md 位階最高**

- 位置：`skills/devwork/rules.md` §Auto-fix、§Fail handling、§協作模式判定 vs plan Task 3 只改 §決策點選單。
- 問題：§Auto-fix「危險 → `AskUserQuestion`」、§Fail handling「`AskUserQuestion` 提 retry / adjust+retry / rollback / 回上層 / escalate」、§協作模式判定「**禁自行開隊友**：判定只產生選項，**一律等 user 選**」三句都是無條件的。rules.md 自稱「與任何 skill 衝突時本檔勝」，而且每個 phase skill 載入時都會重讀它。
- 後果：AI 在 fail 或危險 finding 時讀到 rules.md 的無條件句，照它走 `AskUserQuestion`，headless 印一個沒人回答的問題、那一輪白跑，而且不會報錯（正是「兩條打架，AI 挑一條做」）。
- 建議：Task 3 的 rules.md 段落尾端補一句 blanket clause，例如「本規則書其餘各節（§Auto-fix / §Fail handling / §協作模式判定 / §Branch safety）凡寫 `AskUserQuestion` 之處，headless 時一律改依 `headless-mode` §分流表」。

**C4. hosts.md 新列會把「被 spawn 的 subagent」誤判成 headless**

- 位置：plan Task 3 Step 3 的 hosts.md §Host 判定 新列（插在「都沒有」列之前）vs `skills/devwork/hosts.md:9` 既有列「都沒有（例如你是被 spawn 的 subagent） | 不做決策點；把要問 user 的問題回報給主 agent」。
- 問題：subagent 同樣沒有 `AskUserQuestion`、同樣繼承 `AUTOPILOT_LABEL` 與 `BSTACK_ISSUE` 環境變數，spec §偵測 三條全中。新列排在前面就先命中。
- 後果：review-plan 的三個視角 subagent、request-review 的對齊 subagent、security-audit、pr-explain 在 autopilot 下會各自去 `gh issue comment` 問人、各自印 `[bstack headless] asked` 結束行。一輪 T3 可能刷出四五則留言，而且主 agent 收不到結論。`skills/dispatch-parallel/SKILL.md:159` 現有的「subagent 無 AskUserQuestion 通道；遇要 user 決定 → fail with 原因」會被這條新列蓋掉。
- 建議：§偵測 加第 0 條排除（「你是被 spawn 的 subagent → 不是 headless，照 hosts.md 既有列回報主 agent」），或改用 headless-mode 不可見的訊號（例如主 agent 才寫得到的 state 欄）當判準；hosts.md 新列也要把 subagent 例外寫進去。

**C5. devwork 1.5 的「不進第 2、3 步」會讓 dev-workflow 整份不載**

- 位置：plan Task 3 Step 3 的 devwork 1.5 vs `skills/devwork/SKILL.md` 使用契約第 3 步（「**載入 `bstack:dev-workflow`**」）。
- 問題：1.5 寫「`pending_question` 非空 → 直接載 `context-resume`（不進第 2、3 步）」。第 3 步才是載 dev-workflow。而 `skills/context-resume/SKILL.md:16` 第 5 步是「還原 state → 接續對應 phase skill（依 `current_phase`）」，它自己不載 dev-workflow。
- 後果：第二輪起，9 階段骨幹、§跨流程 skill 載入 表（包含 Task 4 新加的 `headless-mode` 列）、§Fail handling、§Trace 標籤 全部不在 context。等於 headless 的第一輪跑完整流程、第二輪起跑半套。
- 建議：1.5 改成「照第 3 步載 `dev-workflow`，由它依 state 的 `pending_question` dispatch 到 `context-resume`」，跳過的只有第 2 步的問答分流。

### Major

**M1. `dw16` 不是 dev-workflow，plan 的註解寫反了**

- 位置：`scripts/plugin-contract.mjs` P16 區 `const dw16 = exists('skills/devwork/SKILL.md') ? lf(rd('skills/devwork/SKILL.md')) : ''` vs plan Task 1 Step 3 註。
- 問題：plan 說「`dw16` 只拿來判 dev-workflow 檔存在」，實際上它是 **devwork**。`crossTable: /^\| \`headless-mode\` \|/m.test(lf(dw16 === '' ? '' : rd('skills/dev-workflow/SKILL.md')))` 這個守衛因此完全無效。
- 後果：今天歪打正著（兩個檔都在）。但 `skills/dev-workflow/SKILL.md` 一旦缺檔，`rd()` 丟例外、整支契約腳本 crash，不是紅一條，所有後面的契約都不跑。
- 建議：`crossTable: exists('skills/dev-workflow/SKILL.md') && /^\| \`headless-mode\` \|/m.test(lf(rd('skills/dev-workflow/SKILL.md')))`。

**M2. finish-branch §Squash merge 第 3 列的「唯一例外」沒改，跟新首列直接打架**

- 位置：`skills/finish-branch/SKILL.md:139`「唯一例外：user 對**整個 workflow / session** 明授權「這個流程可以自己 merge」、session 內延伸」vs plan Task 5 只改首列。
- 問題：新首列寫「headless 時 merge 永不自動：issue 留言不算授權、session 級授權不存在」，第 3 列還無條件寫著 session 級授權成立。
- 後果：AI 挑第 3 列就會自動 merge。而且新契約的 `noMerge` 只掃「同一行同時有 `headless` 與 `永不`」，首列改完就綠，擋不住第 3 列。
- 建議：第 3 列尾端補「（headless 時不適用）」；契約再加一條「§Squash merge 節內不得有沒標 headless 例外的『唯一例外』列」或直接掃全節。

**M3. receive-review 的 T3 diff 規則寫在兩處，plan 只改一處**

- 位置：`skills/receive-review/SKILL.md:16`（使用契約第 5 步，plan Task 5 有改）與 `skills/receive-review/SKILL.md:36`「**T3 特例**：批次完成後、進下 phase 前，整個 diff 給 user 過一眼」（plan 沒改）。
- 後果：headless 下 AI 讀到第 36 行照樣停下來等 user 看 diff。
- 建議：Task 5 的 receive-review 改動清單加上 §不危險處置 第 4 點。

**M4. dispatch-parallel Red Flags 沒改，而它自稱是防火線**

- 位置：`skills/dispatch-parallel/SKILL.md:213`「一律 `AskUserQuestion` 讓 user 選、講明開關狀態、每個選項寫代價」vs plan Task 5 只改第 3 步。
- 問題：第 3 步同一行還寫著「**禁自行決定**」，plan 是把 headless 句接在它後面。Red Flags 的定位是「內部 rationalization 防火線」，AI 讀到會優先服從。
- 建議：Task 5 同時把第 3 步那句的「禁自行決定」改成「互動模式禁自行決定」，並在 Red Flags 該列真相欄尾加「；headless 例外見 `headless-mode`」。

**M5. index.html 的 inventory 說明文字沒跟著改，數字會自相矛盾**

- 位置：`docs/index.html:505`「流程的十三個階段步驟、**九條**按需載入的跨流程 skill、兩條設計 lane、四條 meta」，尾端數字 `28`。
- 問題：plan Task 6 只把 `28` 改 `29`，敘述沒動。加總變成 13+9+2+4=28 但標 29。
- 後果：公開站上自己打自己。P8 只比數字不比敘述，契約會綠。
- 建議：Task 6 的 index.html 改動清單加上「九條 → 十條」。

**M6. README 目錄連結會斷**

- 位置：`README.md:12` `- [Skills（28）](#skills28)`。plan Task 6 只列第 3、86、100 行。
- 問題：標題改成 `## Skills（29）` 後 anchor 變 `#skills29`，第 12 行的連結指向不存在的錨點。
- 後果：README 目錄點了跳不到。P8 的 regex 是 `^## Skills（(\d+)）`，抓不到第 12 行，契約全綠。
- 建議：Task 6 加上 README 第 12 行。

**M7. 整套 B 類流程綁死 `gh`，但 §偵測 完全沒驗它**

- 位置：新 skill §問人格式 / §讀回覆 vs §偵測 三條。
- 問題：spec §風險 提了「`gh` 需在 PATH」，但沒有變成偵測條件或 fallback。autopilot 容器沒裝 `gh`、或 token 過期時，`gh issue comment` 失敗。
- 後果：那一輪既沒留言也沒 `blocked` 行，外層 harness 的 journal 看到的是「跑完了」，人永遠不知道被卡住。
- 建議：§偵測 加第 4 條（`gh auth status` 不過 → headless-blocked），或 §問人格式 加「留言失敗 → 改走 `blocked` 行並把問題全文印進最終訊息」。

**M8. headless-mode 被 context 摘要洗掉之後沒有復原機制**

- 位置：新 skill 全檔 vs `skills/devwork/rules.md` 開頭第 3 段（「經 `/devwork` 讀進來的內容會被 context 摘要洗掉，所以每個 phase skill 載入時若 context 找不到「§事實核實」這節，先重讀本檔再做事」）。
- 問題：rules.md 對自己有這個機制，plan 沒給 headless-mode 等價條款。phase skill 的分流句只寫「見 `headless-mode` §分流表」，那時 §分流表 可能已經不在 context。Task 3 的 rules.md 新段落確實會被重讀，但它只說「載 `headless-mode`」，沒說「遇決策點時找不到 §分流表 就重讀」。
- 後果：長流程（T3 跑到 Phase 5-7）遇到 B 類決策點，AI 手上只有「有個表」的記憶，沒有表本身，最可能的失敗是照互動模式走 `AskUserQuestion`。
- 建議：Task 3 的 rules.md 段落尾補一句「遇決策點時 context 找不到 §分流表 → 先重讀 `skills/headless-mode/SKILL.md`」；同時把 §偵測 結論固化到 hand-off state 的 `headless` 欄（plan 已有這欄，但沒寫「以 state 為準」）。

**M9. T6 的依賴不只 T2**

- 位置：plan §Self-review 第 4 點「T6 依賴 T2（P8 計數）」。
- 問題：`scripts/build-references.ps1:101-105` 是逐目錄列舉、把每份 SKILL.md 全文內嵌進 `docs/js/references-data.js`。所以 T3 / T4 / T5 改過的 11 個 SKILL.md 全文都會進產物。
- 後果：串行執行下最終結果正確，但 T3 / T4 / T5 那三顆 commit 各自留下過期的 references-data.js，`build-references.ps1 -Check` 在那三個點都不是 exit 0。誰把 T6 往前挪或跟 T3-T5 並行，`-Check` 就紅。
- 建議：把依賴改寫成「T6 依賴 T2-T5 全部完成」，並在 Task 6 Step 3 明寫「重產前先確認 T3-T5 已 commit」。

### Minor

**m1. `section()` 的 lookahead 實際展開與截斷行為（已推演並實測）**

`level='###'` 與 `level='##'` 因為 `level.slice(0, 2)` 都是 `'##'`，展開後**是同一個** `(?=^###? |(?![\s\S]))`。也就是 `##` 層級的節會在遇到 `### ` 子標題時提早截斷。實測反例：`## §A\nline1\n### sub\nline2\n## §B` 抽出的只有 `"line1\n"`。

今天四處抽取全部正確，實測結果：

| 抽取目標 | 長度 | 行數 | 尾列 |
|---|---|---|---|
| rules.md `### §決策點選單` | 761 | 13 | `mcp__<server>__<tool>` 那列 |
| hosts.md `## §Host 判定` | 180 | 7 | 「都沒有」那列 |
| hosts.md `## §決策點` | 240 | 5 | `AskUserQuestion` 那列 |
| finish-branch `## §Squash merge` | 1046 | 11 | 「**禁** force push 到 `main / master`」 |

四個節目前都沒有 `###` 子標題，所以沒踩到。後果：日後有人在 §Squash merge 或 §Host 判定 底下加一個 `###` 子節，`noMerge` / `hosts` 會無聲變紅（fail-closed，可接受但訊息會誤導）。改用 C2 建議的既有 helper 就沒這問題。

**m2. 標題比對是前綴式，會吃到同前綴的節名**

`^##[ \t]+§決策點[^\n]*$` 的 `[^\n]*` 讓 `## §決策點選單` 也匹配。實測 `## §決策點選單\naaa\n## §決策點\nbbb` 用 `section(…, '決策點', '##')` 抽到的是 `"aaa\n"`。hosts.md 今天沒有 `§決策點選單` 這個節，所以沒撞；但 rules.md 正好有同前綴節名，兩邊只是剛好分在不同檔。建議把 `[^\n]*$` 收成 `[ \t]*$`。

**m3. `##` 節不會在 `# ` 停**

實測 `## §A\nline1\n# H1\nz` 抽到 `"line1\n# H1\nz\n"`。skill 檔只有一個 h1 且在最前，無影響。

**m4. `missPhase` 用 `rd()` 沒過 `lf()`**

只測 `/headless-mode/` 所以無害，但跟同 block 其他變數（`hm` / `fb18` 都有 `lf`）風格不一致，容易讓後人以為行尾已正規化。

**m5. `printenv AUTOPILOT_LABEL` 是 POSIX 專屬**

- 位置：spec §偵測 第 2 條、plan Task 2 Step 3 §偵測 第 2 點。
- 問題：hosts.md 第一行的護欄就是「本表裡的工具名是抽象動詞不是工具名」。`printenv` 在 Windows 上不存在，`claude -p` 跑在 Windows 排程時第 2 條恆不成立。P14 的 TOKEN14 沒有 `printenv` 所以不會紅。
- 建議：改寫成「讀環境變數 `AUTOPILOT_LABEL`（POSIX `printenv`／PowerShell `$env:`）」。

**m6. 偵測條件與載入時機循環定義**

hosts.md 新列要先知道 `AUTOPILOT_LABEL` 非空才判 headless、才載 `headless-mode`；但「怎麼讀 `AUTOPILOT_LABEL`」寫在 `headless-mode` §偵測 裡。建議 hosts.md 那列自帶讀法，或把三條偵測直接寫進 hosts.md（那裡本來就免 P14 掃描）。

**m7. brainstorm 0a 只改第 3 點**

`skills/brainstorm/SKILL.md:33` 第 3 點是「如複述不準 / 有歧義 → 反問一次一題」，第 34 行第 4 點是「抓 success criteria」。§分流表 那列寫的是「複述不準 **/ 抓不到 success criteria**」，plan Task 4 只改第 3 點。建議第 4 點也補，或把分流表那列縮成只講複述不準。

**m8. review-plan 的「無 critical → accept」等於 major 全部自動吞**

`skills/review-plan/SKILL.md:21` 的 gate 四選項裡「改某項」通常是為 major 準備的。headless 規則讓所有 major 無聲通過。spec §風險 有提到 A 類判斷力，但 PR body 的 auto_decisions 表沒有 major 數字欄。建議 Task 5 的 review-plan 那行補「留下的 major 數寫進 `auto_decisions` 的 reason」。

**m9. `docs/js/data.js:410-421` 的 crosscut 清單沒加 headless-mode**

那是手選的流程圖節點（只列 5 條，不是完整清單），沒有契約守，可不加；但 headless-mode 是條件載入的跨流程 skill，加進去比較一致。

**m10. `docs/index.html:660` 的 JS 註解「（28 skill + 6 agent + rules.md）」會變舊**

註解不影響渲染、無契約守，順手改。

**m11. 並行性判斷（問題 4 的結論）**

T3-T5 的檔案集合確認互不重疊（T3 動 devwork 三檔、T4 動 dev-workflow / brainstorm / context-snapshot / context-resume、T5 動其餘六個），技術上可並行。**保守分 group 是對的，但 plan 給的理由（量小、平行無收益、多一次問答）不是最強的那個**：真正的理由是 T3 / T4 / T5 的 Step 2「確認失敗」與 Step 4「確認通過」都在比對同一條契約的 `missPhase` 清單，並行跑的話那份清單隨時在變，三個 task 的紅綠判讀會互相污染，紅綠循環就沒意義了。建議把這句寫進 §Self-review 第 4 點取代現有理由。T6 依賴 T2 的判斷方向對，但範圍寫窄了，見 M9。

### Nit

**n1. 行號小幅偏移**

plan §檔案結構規劃 寫 hosts.md「§Host 判定 表加一列（第 6-10 行）」，實際表格在第 5-9 行；「§決策點 表（第 12-15 行）」實際在第 11-14 行。rules.md §決策點選單 第 35-44 行、execute-plan 第 43 / 81 行都精確。

**n2. Task 3 Step 3 的 hosts.md 改法排版有歧義**

`；若同時 \`AUTOPILOT_LABEL\` 非空 → headless，見 \`headless-mode\` §分流表，不用文字提問` 是反引號字串內又包反引號，施工者要猜。建議改成 fenced block，跟同一 Step 其他三處一致。

**n3. 契約訊息偏長**

新條的 detail 串了「不過的 key + 缺節 + 缺分流 + 後果 + 改處」四段。既有契約最長的 P12 也只到三段。建議把「後果」壓成一句。

**n4. Task 2 Step 3 括號註記「`/bstack:` 與 `$bstack:` 並列」在全文裡沒有對應**

實際掃過 plan 貼的 SKILL.md 全文，`/bstack:` 與 `$bstack:` 兩者都沒出現，這句註記是空的。留著無妨但容易讓人以為文中有。

---

### 附：已實測通過的部分（不列為 finding）

**plan 貼的 SKILL.md 全文可以通過 P14。** P14 白名單實跑抽出 12 項：`AskUserQuestion`、`apply_patch`、`spawn_agent`、`TaskCreate`、`TaskUpdate`、`TaskList`、`TaskOutput`、`Agent`、`subagent_type`、`SendMessage`、`code-review`、`mcp__`。

新 skill 全文命中 TOKEN14 的只有 `AskUserQuestion`（三處）與「不列 Agent Teams」裡的 `Agent`（`\bAgent\b` 會命中），兩者都在白名單內。BAN14 五條全部不命中：沒有 `SendMessage`、沒有 `/bstack:`、沒有 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`、沒有 `@skills/devwork/rules.md`、沒有 `~/.claude/projects`，也沒有單寫 `.claude/skills`。P3c（描述不得含「觸發：」）與 P3a（name 等於目錄名、描述非空）同樣過。

**Task 1 的 P18 code 不會語法錯、不會引用未宣告變數。** `rules16`（P16 區）、`hostsMd`（P14 區）、`dw16`（P16 區）、`lf`（P13 前）、`exists` / `rd`（檔頭）都在同一個 `else` 區塊內、且宣告位置都在 P17 之前，插入點拿得到。`p18` 與 `section` 兩個名字雖然撞名，但因為新 code 包在 `{ }` 裡屬於 block scope 遮蔽，不會觸發 `SyntaxError: Identifier has already been declared`。問題是撞名本身（C1 / C2），不是語法。

**其餘既有契約不會被誤傷。** P11 的 `bs0b` 只切 brainstorm §Phase 0b′，Task 4 不動那節；P12 的 `dwSecT3` / `fbSecLine` 與既有 P18 的 `dwSecT2` 都錨在 dev-workflow 9 階段圖第 6 行與 finish-branch checklist 行，Task 4 / Task 5 不動；P10 的 `fbTpl` 是整檔讀，PR 模板加一節不影響 `/e2e: <pass \| smoke/`；P16 的 `headers` 只管四欄節的表頭，§Host 判定 被排除在外，Task 3 加列安全；P13 / P15 / P17 與本次改動無關。`scripts/build-references.ps1` 是逐目錄列舉 skills，新 skill 會自動進 references-data.js，不需要手加清單。
