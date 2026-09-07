# PR Review: 文本瘦身第二輪（description、body、rules.md）

> Branch: `refactor/skill-desc-and-body-slim`（base: `main`）
> 對應: [spec.md](spec.md) / [plan.md](plan.md) / [review.md](review.md)
> 44 檔、+1,258 / −1,724

## 為何要做這件事

上一輪瘦身（PR #69/接替 #67）只砍了 11 個階段 skill 的散文，沒碰三塊常駐成本最高的地方：28 個 skill 與 6 個 agent 的 frontmatter `description`（每個 session 只要載入 plugin 就常駐，不看有沒有下 `/devwork`）、其餘 17 個沒瘦過的 skill body 加 6 個 agent body、以及 `rules.md`（下了 `/devwork` 之後整段常駐，本 repo 自身開發時永遠常駐）。基線量測（commit `4de4e83`）顯示這三塊合計約 21,600 token，其中 description 與 rules.md 這兩塊「常駐」部分約 11,000 token，是目前占用 context 最貴、報酬率最高的瘦身標的。

前提只有一個，貫穿整條 PR：**用途與邏輯零改變**。這不是「順手精簡順便砍點規則」，而是同一批規則、同一套流程，換一種更省字的寫法。為了不淪為「相信 AI 沒改壞」，這條 PR 自己先寫了一支機械比對工具（`slim-guard-v2.mjs`），逐檔把「不能動的東西」拍成快照，砍完再逐項比對，比不過就是 FAIL、擋 commit。

## 整體結構：三塊 + 一層防護

diff 分四種性質，讀的時候建議按這個順序看：

1. **A．34 條 description**（`ddf740d`）——28 個 skill + 6 個 agent 的 frontmatter，全部改成兩句式。
2. **B．17 個 skill body + 6 個 agent body**（`8bb3ac0` ~ `246a9e6` 共 22 個 commit，每檔一個 subagent 平行改）+ devwork 主體。
3. **C．`rules.md`**（`b4a01fc`）——本 repo 位階最高的規則書，主 agent 親手改、不假手 subagent。
4. **守門與收尾**（`9ed9fee`、`a0d4cfb`、`d183fa4`、`220b908`、`2c86a46`、`6bc4ace`、`50e23aa`、`9cb7fef`）——量測 / 守門腳本本身，以及對齊 review 與 security-audit 抓到的問題修正。

`docs/work/refactor/skill-desc-and-body-slim/` 底下的四支 `.mjs` 是這條 PR 自己的施工工具，`spec.md`／`plan.md`／`review.md` 是完整的施工紀錄，`docs/js/references-data.js` 是被改動的 skill/rules 內容重新內嵌進 docs 站的自動產出檔，不必逐行看。

---

## 一、守門 v2：怎麼證明「零改變」

`docs/work/refactor/skill-desc-and-body-slim/slim-guard-v2.mjs`（203 行）是整條 PR 的可信度基礎。它的用法很單純：

```
node slim-guard-v2.mjs snapshot <out.json> --rev 4de4e83   # 對基線 commit 拍快照
node slim-guard-v2.mjs check <baseline.json> [--only <name>] [--src <path>]  # 砍完後比對
```

`snapshot` 帶 `--rev` 是刻意的：施工紀錄提到早期版本用 `git stash` 拍基線快照，結果拍到已經 commit 過的改動（Task 2 / 26），於是改成直接從 `git show <rev>:<path>` 讀，不受工作樹當下狀態影響。快照本身（`baseline-4de4e83.json`）**不進版控**——它 183KB、純衍生物，`node slim-guard-v2.mjs snapshot <out> --rev 4de4e83` 3.9 秒可逐 byte 重產，最後一個 commit（`9cb7fef`）把它從版控砍掉。這是個合理取捨：省一個大 blob 常駐 repo，換一個「用到時現拍」的三秒鐘。

它守六種東西，每一種都對應一種容易被 AI 順手改壞的地方：

- **frontmatter 除 description 外逐字比對**：description 由主 agent 改，body 的 subagent 不該碰到 `name` / `tools` 這些欄。
- **description 規則**：第一行非空、不含「觸發：」（plugin-contract P3c 守——bstack 只由 `/devwork` 顯式啟動，若 description 塞觸發詞清單，等於讓沒下指令的自然語言對話也被攔進來）、契約守的關鍵字樣（`PROTECTED` 表，例如 devwork 要留 `/devwork`、pr-explain 要留 `T3`）仍在。design-direction 特別列了 `` T2 → 回 `brainstorm` ``，因為這句在全檔恰好出現兩次、其中一次就在 description 裡（下面「守門三次自我修正」有細節）。
- **使用契約步驟**：編號序必須全等；每一步的動作動詞（讀/判/spawn/交棒/跑/commit……）與反引號片段集合，砍完後必須是基線的**超集合**（可以少廢話，動詞和精確片段不能少）。沒有「使用契約」段的檔（agent、security-checklist、db-access）退而比對「角色職責」等段的 bullet 數與粗體集合。
- **所有 fenced code block 逐塊比對**：每個 code block 正規化空白後拿去跟基線比，能整塊刪、不能改一個字、不能新增、不能合併兩塊成一塊。yaml block 是唯一例外，走「行級」比對——下面單獨講。
- **表格整張比對**：以連續的 `|` 行圈出一張表，可以整張刪（改成「見 X §Y」的指向），但不能刪單列、改列、新增列。只有 `§Red Flags` 表因為已經被規則允許合併改寫，放寬到「≤5 列」。
- **反引號片段**：不准新增；其中「regex / 路徑 / 旗標型」的片段（用一個正則式 `[\\\[\]{}^$*+?]|^--|^[.~]?\/|\/\w|\.(mjs|ps1|md|js|json|yml|yaml|sql|env)\b` 辨識）一個字都不能消失——這類片段通常就是規則本體，比如 `safety-guard` 的 PII 偵測 regex、`cmd-guard` 的危險指令 pattern。

### yaml 的「行級」例外和「承上」的落空

`spec.md` 一開始樂觀估計 22 個 skill 的 hand-off yaml 有 344 行跟 dev-workflow 主 yaml 逐字相同、可以砍成一句「承上」。守門 v2 的規則是：yaml block 內每一行，砍完後必須屬於「基線該檔的 yaml 行 ∪ dev-workflow 主 yaml 行 ∪ `# 承上` 註解」，消失的行必須屬於「主 yaml」子集合——換句話說，只有跟主 yaml **逐字相同**的行才准刪。

實測結果是**零行**：多數 skill 的 yaml 值寫法本來就跟主 yaml 不同（例如某 skill 寫 `tier: <T2/T3>`，主 yaml 寫 `<T0|T1|T2|T3>`），一個字不同就不算「逐字相同」，於是那 344 行的估計完全落空。這件事在 plan v2 的 Risks 段已經先寫明，施工紀錄也如實記了「承上：零行，如 Risks 預告」。這不是執行失誤，是估計本身高估了，值得 reviewer 知道 description 目標為何達不到部分也有牽連（見下）。

### 三個施工中自己抓到的守門 bug

施工紀錄記了三個守門 v2 自己的 bug，都是在真的跑起來後才暴露：

1. **表格分隔列誤判**：`|---|---|` 這種分隔列在每張表都長一樣，如果算進「表格行」集合，會讓「整張表刪掉」被誤判成「少了一列」（因為分隔列本身也算一行、但它在其他表裡也存在，導致比對邏輯混淆）。修法是分隔列不計入。
2. **`git stash` 拍到已 commit 的改動**：如上，改用 `--rev` 直接從 git 歷史讀。
3. **選單啟發式誤判 rules.md**：判斷「AskUserQuestion 後面是選單」的啟發式對 rules.md 裡的規則 bullet（本來就不是選單）產生誤判，鎖住了不該鎖的行。修法是 rules.md 不套用這條規則——它本來就沒有 AskUserQuestion 選單，選項都寫在同一句括號裡，rules.md 的內容改由表格/反引號/§標題/契約字樣四層守住。

這三個 bug 都用「負向測 8 案」重跑過確認：種下已知違規（例如刪 `safety-guard` 的 PII regex 行、改 `pr-explainer` 格式 block 的標題、改 `dev-workflow` 圖裡一行）要出紅燈；允許的改法（例如 `debug-systematic` 的 yaml 刪掉跟主 yaml 相同的行並補上 `# 承上` 註解、`cmd-guard` 的 Red Flags 合併成 5 列）要出綠燈。8 案全部符合預期，這是 review.md 附的表格可以逐行核對的。

---

## 二、rules.md：砍了什麼、什麼是刻意留的

`skills/devwork/rules.md` 是位階最高的規則書，這條 PR 唯一沒有交給 subagent 改的檔——理由寫在 spec：「rules.md 改壞是全 repo 事故」。commit `b4a01fc` 把非空行從 145 壓到 131（−10%）、bytes 從 18,206 壓到 16,832（−8%），沒有動到任何一個 `§` 標題（16 個全部逐字留著、不改名——這是外部有 15 個引用點守著的）、沒有動到任何一張表的內容。

砍法逐段看（對照 `git diff main...HEAD -- skills/devwork/rules.md`）：

- **`§白話優先`**：把三個術語範例（`file watcher` / `idempotent` / `overlap coefficient`）縮成留一個當代表；「寫法」四點各留一句粗體片語（原本每點還有一句舉例說明，砍掉說明只留規則本身）；「區分實測與推論」與「底線」兩段各壓成一句。
- **`§Branch safety` 豁免段**：這段被拆成四句話，是 review 兩個視角都點名的地方（Eng M8 + DX 7）。刻意留的：`（刻意如此，契約 P2d 守；非設計缺陷）` 這括號——它是防下一個貢獻者把這個豁免行為當 bug「修掉」的護欄；`hook 隨 plugin 在啟用它的每個專案生效、不需要 /devwork` 這句明寫著（不是「懂的人自己會知道」）；`Windows 實測連通知都沒有` 的「實測」二字保留，因為它是要求讀者去跑 `node --version` 事前確認的依據，不是隨口一句。砍掉的是日期（`2026-09-07`）與「官方 setup 文件」這類出處敘事——規則本身不因為知道是哪天測的而改變。
- **`§設計語言對齊`**：豁免的 blockquote 從三段壓成兩句 + 一行無日期的理由（原本寫著「實測依據：2026-09-03 潤 docs/index.html 文案時撞到」，改寫成「為什麼有此豁免：……不寫明則每次都由執行的 agent 自己推」——保留機制與後果，去掉日期）；五個 bullet 各縮成一句，但**必留子句**——`0b′ 必跑（含純後端 task）`、`四項對齊檢查（元件狀態/斷點/表單/dark mode）`、`該區客觀上無此維度 → 標 N/A 並附依據`——這些是契約沒有另外守著、只活在 rules.md 這段文字裡的規則,砍掉就是真的丟失資訊,不是精簡。
- **`§Docs 落檔`**：11 條 bullet 併成 6 條（同義合併，例如「目錄」與「檔名固定」合成一條、「覆寫」與「檔名不放日期」合成一條），逐字留住「這份寫的是規則還是做過一次的紀錄？規則才進」這句判準句。
- **`§Tier 機制`**：表格逐字不動；bullet 各縮一半但保留「本表是 lane 的唯一真相」「超過表列上限代表 Tier 判低了，回 0d 升 T3」這類 P9a/P12 沒有另外守、只活在這裡的關鍵句；把原本括號裡的「（2026-09-04 merge 後歸檔）」日期刪掉，只留「精簡依據見 docs/archive/2026/ 的 t2-lane-slim 主題」。
- **`§協作模式判定`**：`唯讀 fan-out 一律 subagent` 那句刻意保留「不開隊友、也不問」與「獨立性本身就是產出價值」這兩個關鍵片語——這是實際的 gate 邏輯，砍掉等於把行為改了。末尾原本指向一個不存在的「隊友派工範本」段名，這次順手修成指向 `dispatch-parallel §協作模式判定` / `§隊友派工` 兩個真實存在的標題。
- **`§Settings.json`**：縮寫但保留「僅限 read-only」「寫入類一律 prompt」「不主動寫使用者層級 settings」三條規則、範本 URL、以及有密鑰檔要把 `Bash(cat/head/tail:*)` 拿掉那句提醒。

`grep -c "20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]"` 對砍完的 rules.md 跑出 0——所有帶日期的歷史敘事都被清掉了，這是驗收條件之一。

**目標沒有達到**：目標是非空行 ≤110、bytes ≤14,000，實際停在 131 行 / 16,832 bytes。施工紀錄裡寫得很直白：review 的 Eng 視角事先算過，要達標「可砍區要壓 −31%，零餘裕」——意思是理論上能砍的字數空間，比目標要求的砍幅還小,除非動到三張表或 `§事實核實` 這個最高指導原則段（兩者都在「零改變」界線內、不准動）。壓完一輪，主 agent 選擇停手而不是犧牲保護項去湊數字。這是「軟目標到不了就攤數字、不砍保護項」這條施工原則的具體案例。

---

## 三、為什麼「承上」省幅為零、為什麼 description 到不了 2,000

這兩個「沒達標」的項目值得放在一起看，因為根因類似：**估計時看到的是「理論上可以」，真的逐字比對後發現「其實不行」**。

**yaml 承上省幅為零**：上面已經講過，守門要求逐字相同才准刪,而 22 個 skill 的 hand-off yaml 值寫法沒有一個真的跟主 yaml 逐字相同。

**description 到不了 2,000 token**：34 條 description 從約 4,971 token 砍到約 2,271 token（−54%，是這條 PR 單項壓縮率最高的部分），但仍超出 2,000 的目標。餘量分佈在：

- 契約守著的關鍵字樣：devwork 要留 `/devwork`、`不因`；dev-workflow / brainstorm 要留「不因自然語言自動觸發」；pr-explain 要留 `T3`；design-language 要留「命中」「才載」；lang-reviewer 要留「顯式」；security-auditor 要留「純文件」。
- design-direction / design-language 各多留半句「跟誰分工」（前者留 `T2 → 回 \`brainstorm\`` 這句 P9i 契約守著、全檔恰好出現兩次的字串之一；後者留「新設計決策交 design-direction」）。
- security-audit / security-auditor 的 T2 / T3 lane 條件句本身就長（要說清楚「T2 涉認證/資料層才 audit、T3 程式碼 diff 必跑、純文件 diff 且無 File-type 硬規則命中跳」這種條件邏輯，沒有比較短的說法）。

這些不是「懶得再砍」，是「再砍就要動到契約守的字樣或改變行為判準」，跟 rules.md 同一種取捨。

---

## 四、對齊 review 抓到的兩個 Major：什麼樣的漂移、怎麼修

T3 流程在 B 塊全部改完後，跑了一個對齊 subagent（比對每檔改動是否偏離 spec/rules.md 的原意），結果是 0 Critical / 2 Major / 7 Minor / 9 Nit，全部採納修正（commit `6bc4ace`）。兩個 Major 都是同一種漂移模式：**瘦身時把「規則描述」錯當成「範例列舉」去砍，砍完等於改變了觸發判準或教學內容，而不只是換句話說。**

### Major 1：cmd-guard 的自我觸發判準被縮窄

`skills/cmd-guard/SKILL.md` 原本的自我觸發邏輯是：

```
自我觸發：每次 Bash tool 即將跑 command 前，主 agent 自查是否落入以下類型；落入 → 載此 skill。
```

「以下類型」指的是整份 `§危險度分級` 表（L1 到 L4，四個等級各自有處置方式，包括 L1「印 + 直接執行不問」、L2「一般確認」）。瘦身時把這句改寫成只比對 `§自查 pattern` 底下列的 L3/L4 keyword 清單，L1、L2 兩級的判準等於在觸發邏輯裡消失了——不是文字變短，是**行為變了**：原本 L1/L2 的指令理論上也該被 cmd-guard 認出（哪怕處置只是印一下就放行），改完後這兩級可能連被辨識的機會都沒有。

修法是把觸發句改回「落入 `§危險度分級` 任一級（keyword 見 `§自查 pattern`）」，讓四個等級全部回到判準範圍內，`§自查 pattern` 只是輔助的 keyword 清單、不是判準本身。現在 diff 裡能看到的版本已經是修過的：

```
自我觸發：每次 Bash 即將跑 command 前，主 agent 自查是否落入 §危險度分級 任一級（keyword 見 §自查 pattern）；落入 → 載此 skill，然後：
```

### Major 2：write-skill 的 description 教法用了舊格式

`skills/write-skill/SKILL.md` 是教別人怎麼寫新 skill description 的 meta skill，它自己的 `§Frontmatter 詳解` 段原本示範的是舊的「四段式」格式（一句總結 + 載入時機 + 涵蓋範疇 + 上游/下游），但這條 PR 的整個 A 塊（34 條 description）已經把所有 description 改成「兩句式」（是什麼 + 載入：何時）。如果 write-skill 教學段沒跟著更新，就會出現「這條 PR 自己違反自己剛定的規範」的矛盾——往後有人照著 write-skill 的範例寫新 skill，寫出來的會是舊格式。

修法（可在 diff 看到）：`§Frontmatter 詳解` 的 `description` 說明改成直接講兩句式規則本身（第一行「是什麼：3-6 個名詞」、第二行「載入：」），範例改成指向「現行 `execute-plan` skill 的 description」而不是內嵌一段舊格式文字；`§Self-review checklist` 也同步把「`description` 觸發詞列足」改成「`description` 第一行一眼看得出是什麼、無觸發詞、無『涵蓋/上游/下游』」。

**注意**：`§SKILL.md 結構` 段落裡還有一個範本 code block，那裡面也內嵌了一份舊格式的 description 範例——這個沒有改。原因是它是「code block 內容」而不是獨立說明文字，守門規則規定 code block 只能整塊刪、不能改一個字（避免 AI 順手把範本內容也跟著改，範本改壞比說明改壞更難察覺）。這個殘留在施工紀錄裡明確記成 follow-up，不是漏改。

---

## 五、四支腳本各做什麼、為何基線 JSON 不入版控

全部在 `docs/work/refactor/skill-desc-and-body-slim/` 底下，是這條 PR 的施工工具，隨 spec 一起歸檔（不是要長期維護的正式程式碼）：

| 腳本 | 做什麼 |
|---|---|
| `slim-guard-v2.mjs`（203 行） | 上面詳述的守門主體：`snapshot` 拍某個 git rev 的「不能動」快照、`check` 拿現況跟快照比對 |
| `measure.mjs`（48 行） | 量每檔非空行 / bytes / 估算 token（CJK 每字 1.2 token、其餘每 3.8 字元 1 token 的粗估公式，前後兩次量測用同一把尺）；`--assert` 模式對 plan 訂的各項目標斷言，不過就非零結束碼 |
| `intake.mjs`（35 行） | 收件用：把 22 個 subagent 各自產在 `out/<name>.md` 的成品，逐檔跑守門 + 量測，印驗收表；`--apply` 才會真的把 PASS 的檔複製進 `skills/`/`agents/`（不 commit） |
| `quote-index.mjs`（38 行） | 專門找「刪掉的『為什麼』引言」：掃基線與現況裡「不在 code block 內、以 `> ` 開頭、含『為什麼』或『實測』」的段落,列出被刪或縮寫的清單,供施工紀錄的「引言索引」表用 |

`intake.mjs` 用 `execFileSync` 帶參數陣列（不是字串拼接跑 shell），是 security-audit 抓到的 Major 修正——原本是用字串組出命令再丟給 shell 執行,如果 `out/` 底下的檔名含 `&`、`|`、`^` 這類 shell 特殊字元,理論上可以被利用來注入第二條命令。修完後也用一個真的取名為 `foo & bar.md` 的檔實測過,確認會被擋下而不是被當成命令的一部分執行。同一個修正也把 TARGETS 白名單擋在檔名進入任何命令之前——`out/` 底下如果有不在 plan 列表裡的檔名,會直接跳過、不會被送進任何 exec。

基線快照 `baseline-4de4e83.json`（183KB）最後一個 commit 從版控移除,理由是它是純衍生物、`node slim-guard-v2.mjs snapshot <out> --rev 4de4e83` 3.9 秒可以逐 byte 重新生出來（`cmp` 驗證過一致）——比起讓一個 183KB 的一次性快照長期留在 repo 歷史裡,重產成本很低,不值得付版控的重量。

---

## 其他值得知道的事

- **request-review 的 code-review high 中途被 user 決定停止**：diff 裡唯一算「程式碼」的是 `docs/work/` 底下四支一次性腳本,依 request-review 的副檔名分流規則,`.mjs` 一律算程式碼會觸發 T3 high 級 code review。user 判斷對一批用完即歸檔的工具跑滿整套 review 不值得（約 10 分鐘 / 15 萬 token）,在 finder 階段就停了。已經跑出來的兩個 finder（simplify / conventions）原始輸出裡確定成立的問題已經修：註解裡有 `\u` 轉義殘留（原本該是可讀中文,被 Edit 工具寫成逃逸序列）、snapshot 強制要求 `--rev`、四支腳本的 repo 根從硬編路徑改成問 git、補齊函式 docstring。這個 lane 缺口（一次性腳本被當成正式程式碼同等對待）本身被記成 follow-up,建議 request-review 的副檔名分流表加一條「`docs/work/**` 腳本不算程式碼 diff」,但那是規則面的改變,這條 PR 沒有動它。
- **security-audit 只抓到一個 Major**（上面提到的 `intake.mjs` 命令注入),其餘全部 PASS：rules.md 的 `§PII` / `§File-type` 段與 main 逐 byte相同、safety-guard 的六類 PII regex 與 mask 規則、security-checklist 的 12 個主題、各 agent 的 STRIDE/OWASP/PII 規則都沒有被削弱。
- **守門一次假綠**：施工過程中有一次驗證鏈寫成 `grep -v "^PASS"` 接 `&&`,結果 write-skill 新增了一個不該有的反引號片段,FAIL 訊息沒有真的擋住 commit（`grep -v` 在沒匹配時的結束碼判斷有問題）。下一顆 commit 補修了這個問題,驗證鏈改成 `tail -1 | grep -q "ALL PASS"`,靠明確比對最後一行文字而不是靠 grep 反向過濾的結束碼。

## 讀 diff 時發現的疑點

沒有發現需要另外指出的疑點。施工紀錄本身對「未達標」「執行偏差」「follow-up」都寫得完整且誠實,三份文件（spec/plan/review）與實際 diff 交叉核對後一致,守門機制的邏輯讀下來能自洽解釋每一種「允許改法」與「不允許改法」的界線。唯一提醒 reviewer 特別看一眼的是上面第四節的兩個 Major(cmd-guard 觸發判準、write-skill 教學範例),因為那是「守門機制本身管不到、只能靠人讀出語意漂移」的那類問題——守門能保證字面沒被亂改,但不能保證「縮寫後語意還一樣」,這兩個案例正是語意被壓縮過程悄悄改變的實例。
