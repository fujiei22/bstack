# 文本瘦身第二輪：description、未瘦身 skill body、agents、rules.md

> Track: Dev | Tier: T3 | 建立: 2026-09-07
> 基線 sha: `4de4e83`

## 動機 / Why

#69（接替 #67）只瘦了 11 個階段 skill 的散文（行 −38%、bytes −13%），沒碰 frontmatter description、其餘 17 個 skill、6 個 agents、rules.md。量測（基線，token 為估算：CJK 1.2 / 字、ASCII 3.8 字 / token）：

| 類別 | 量 | 載入時機 |
|---|---|---|
| 28 個 skill description | ~5,000 tok | **每 session 常駐**，所有啟用 plugin 的專案 |
| rules.md | ~6,100 tok（197 行 / 18,206 bytes） | `/devwork` 下常駐；本 repo 永遠常駐 |
| dev-workflow + brainstorm | ~10,000 tok | 每次 `/devwork` |
| 其餘 skill body | ~55,000 tok | 各 phase 用到才載 |
| 6 個 agents | ~11,600 tok | spawn 時載 |

冗在哪（實測）：description 每條 100–270 tok 都帶「涵蓋：…」「上游 / 下游」，body 與 dev-workflow 已寫同樣內容；21 個 skill 各有一段 `§結尾 Trace 標籤`（rules.md §Trace 標籤 已規定格式）；28 個 hand-off yaml 區塊共 344 行，多數重列上游欄；24 個 Red Flags 表（dispatch-parallel 13 列、frontend-test 12 列、dev-workflow / design-direction 10 列）；歷史敘事（「2026-09-03 實測…」）散在各檔。

## 目標 / Success criteria

1. **A description**：34 條（28 skill + 6 agent）合計 ≤2,000 tok（基線 ~5,000）。每條格式固定：第一行「是什麼」一句（docs 站文件抽屜只顯示第一行，`app.js` 的 `parseFrontmatterDesc`）＋「載入：<時點>」一句；devwork / dev-workflow / brainstorm 保留「不因自然語言自動觸發」；契約守的字樣保留（devwork `/devwork`、pr-explain `T3`、lang-reviewer `顯式`、security-auditor `純文件`、design-language `命中…才載`）；全部不含「觸發：」（P3c）。
2. **B body**：17 個 skill（dev-workflow / design-direction / design-language / dispatch-parallel / incident-investigate / frontend-test / write-skill / security-checklist / cmd-guard / safety-guard / lock-files / context-snapshot / context-resume / db-access / retro / debug-systematic / devwork）+ 6 agents 合計**非空行** 3,318 → ≤2,674（−19%）、bytes 175,771 → ≤140,600（−20%）。數非空行是 review Eng M7 的要求：`wc -l` 可被刪空行湊數（dev-workflow 光空行就 61 行）；每檔另有 bytes 目標（plan 表）。
3. **C rules.md**：非空 145 行 / 18,206 bytes → ≤110 非空行 / ≤14,000 bytes（Eng 算可砍區要壓 −31%、零餘裕；到不了攤數字、不動表）；16 個 § 標題一個不少、不改名（15 個被外部引用）。
4. **零改變**（機械可驗三層）：`node scripts/plugin-contract.mjs` ALL PASS + `--selftest`；`node docs/tools/docs-site-contract.mjs` ALL PASS；`build-references.ps1` 重產後 `-Check` exit 0；守門快照（`slim-guard-v2.mjs`）對基線比對零差異：使用契約步驟序與每步動詞 / 反引號 ⊇ 基線、被外部引用的 § 標題（白名單見下）、**所有 fenced block 逐塊比對（可整塊刪、不可改 / 新增 / 合併）**、yaml 行級（只准刪與 dev-workflow 主 yaml 逐字相同的行）、表格整張可刪不可刪單列、反引號不新增且 regex / 路徑型不消失、agents 三段 bullet 與粗體 ⊇ 基線。
5. 第四層：review-plan Eng 視角逐檔對 diff 抽驗「步驟 / 選單 / 欄位 / 數字」沒被動到。

## 範圍 / Scope

**包含**：A、B、C 三塊（user 2026-09-07 選定）。
**排除**：design-direction 的 4 份 references（33k tok，內容目錄非冗文、只在大改路徑載；user 同意不動）；#69 已瘦的 11 個 skill body 不再動（description 除外）；README / docs 站文案；契約腳本（只在 FAIL 點名時把字改回去，不改契約本身）。

## 零改變界線（user 確認）

**一字不動**：使用契約編號步驟數與順序、每步動作動詞；AskUserQuestion 選單全部選項文字；yaml 欄位名；契約斷言字樣；指令 / 路徑 / 檔名 / regex / 反引號片段 / 數字；被外部引用的 § 標題名。
**可砍**：措辭、重複說明、同類範例只留一個、歷史敘事（日期 + 實測經過 → 留「機制一句 + 後果一句」或整段刪）、別檔已有的表改一行指向、`§結尾 Trace 標籤` 整段改一行「結尾貼 rules.md §Trace 標籤」、hand-off yaml 只留本 skill 新增 / 改寫的欄（上游欄以「承上」一行代替；欄名一個不少）、Red Flags 表 ≤5 列（同義列合併）。

## 影響檔案 / Codebase impact

| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| 28 個 `skills/*/SKILL.md` frontmatter description | edit | P3b / P3c / P9d / P9f / P11 / P12 守字樣；docs 站抽屜讀第一行 |
| 6 個 `agents/*.md` frontmatter description | edit | 同上；`tools:` 等其他欄不動 |
| 17 個 skill body（見目標 2） | edit | P9c / P9h / P9i / P10b / P11 / P12 讀其中 dev-workflow / design-language / dispatch-parallel / write-skill / frontend-test / context-snapshot |
| 6 個 agent body | edit | agent 之間互引 §輸入契約 / §嚴格 output 格式 / §使用 tool 範圍 / §回報格式 / §檢查焦點 |
| `skills/devwork/rules.md` | edit | 位階最高；P6 / P9a / P11 / P12 / C8e / C 交叉引用；16 個 § 全被引用 |
| `docs/js/references-data.js` | 重產 | 產出檔 |
| `docs/work/…/slim-guard-v2.mjs` | new（一次性） | 守門腳本，隨 spec 歸檔 |

## 被外部引用的 § 標題白名單（守門必留、不改名；xref 自動抓，基線 4de4e83；抓取範圍 = 全部 skill / agent / rules.md / README / docs/index.html / docs/js/data.js / 兩支契約 / hooks/guard.mjs）

- design-direction：`§對外契約` `§與 dev-workflow 銜接`
- design-language：`§前端副檔名` `§對外契約` `§兩根尺` `§首次偵測` `§設計語言抽取` `§對齊檢查清單` `§與 dev-workflow 銜接`
- dev-workflow：`§Track × Tier × Phase 路徑` `§Trace 標籤` `§Auto-fix 原則` `§Fail handling` `§Memory hook 點` `§跨流程 skill 載入` `§Skill hand-off state`
- dispatch-parallel：`§協作模式判定` `§隊友派工` `§Spawn 細節`
- frontend-test：`§載入時機` `§測試矩陣` `§branch-name fallback 鏈`
- write-skill：`§新 skill 落地 checklist`
- rules.md：全部 16 個（`§白話優先` `§事實核實` `§Task 追蹤` `§決策點選單` `§Branch safety` `§File-type 硬規則` `§PII 安全底線` `§DB 操作` `§設計語言對齊` `§Docs 落檔` `§Tier 機制` `§協作模式判定` `§Trace 標籤` `§Auto-fix` `§Fail handling` `§Settings.json`）
- agents：db-reviewer `§檢查焦點` `§回報格式`；frontend-e2e-runner / hypothesis-tester `§輸入契約` `§嚴格 output 格式` `§使用 tool 範圍`；lang-reviewer `§回報格式`；pr-explainer `§Tier 控詳盡度` `§文件結構標準` `§使用 tool 範圍`；security-auditor `§PII 安全底線` `§回報格式` `§使用 tool 範圍`
- 其餘 skill 的 § 只被自己引用，可整段刪，**不得新增、不得改名**（守門全等比對）。
- 抓法看不到「引用了但目標不存在」：verify-done L72 指向 frontend-test 不存在的 §測試流程 / §測試報告、rules.md §協作模式判定 末句指向不存在的 dispatch-parallel「隊友派工範本」段名、契約 P9i 訊息提的 dispatch-parallel §subagent 派工 / §失敗處置 不存在——前兩個 Task 26 / follow-up 處理，契約訊息範圍外記 follow-up。

## 設計方向

`design.involved=false`（改動檔全是 `.md`；`references-data.js` 是產出）。

## T3 review 視角

- **Eng**（下限）：機械可驗——守門腳本抓不到的字面改動（步驟動詞、yaml 欄名、數字）逐檔對 diff 抽驗。
- **DX**：有人要讀——砍完的 description 一眼看得出「是什麼、何時載」嗎；rules.md 壓縮後規則還讀得懂嗎；「見 X §Y」的指向是否都解析得到。
- 不派 Design：沒有跨模組契約變動（欄名 / 選單 / § 名都鎖死）。

## 風險與 trade-off

- **description 太短讓 Claude 選錯 skill**：bstack 的 skill 全由 devwork / dev-workflow 以名字鏈式載入，description 不是觸發依據；唯一靠 description 的是 user 顯式 `/bstack:<name>` 時的辨識，第一行「是什麼」足夠。
- **rules.md 改壞是全 repo 事故**：C 由主 agent 親手改、不派 subagent；改前後跑三契約 + 守門；review-plan Eng 對 rules.md 全 diff 逐行。
- **子 agent 越界**：沿用 #67 守則——subagent 只處理契約點名自己檔的 FAIL、不改契約、不 commit；主 agent 逐檔守門後 commit。#67 實測 11 個 subagent 零越界。
- **目標達不到**：行 / bytes 目標是總量軟目標，單檔差 ≤10% 接受；到不了就攤數字，不砍保護項（#67 bytes −13% 未達 −30% 就是這樣處理）。

## 待釐清

無。

## 施工紀錄

<!-- execute-plan 施工中追加 -->

### 1. 前後對照（基線 `4de4e83` vs HEAD；非空行 / bytes / 估 tok，同一把尺）

| 類別 | 前 | 後 | 變化 | 目標 | 達成 |
|---|---|---|---|---|---|
| A 34 條 description | ~4,971 tok | ~2,271 tok | −54% | ≤2,000 | **未達**：餘量是契約守的字樣（`/devwork` `T3` `顯式` `純文件` `命中…才載` `T2 → 回 brainstorm`）、三個 skill 的「不因自然語言自動觸發」、security-audit / security-auditor 的 T2 / T3 lane 條件句、design-* 兩處半句分工；再砍就改行為 |
| B 17 skill + 6 agent | 3,318 非空行 / 175,771 bytes | 2,511 / 146,787 | −24% / −16% | ≤2,674 / ≤140,600 | 行 **達**；bytes **未達**（−16.5% vs −20%）：每檔 subagent 都回報剩餘是凍結項（frontmatter + code block + 表 佔 45-60%），22 檔中 21 檔單檔在目標 +10% 內、lang-reviewer bytes +10.07% 接受 |
| C rules.md | 145 非空行 / 18,206 bytes | 131 / 16,832 | −10% / −8% | ≤110 / ≤14,000 | **未達**：review Eng M8 事先算出可砍區要壓 −31% 才到、零餘裕；三張表 + §事實核實 + 契約字樣佔六成，一輪壓完停手不動表 |
| 全部 35 檔 | 4,718 行 / 278,551 bytes / ~91,437 tok | 3,868 / 249,982 / ~81,853 | −18% / −10% / −10% | — | 常駐部分（description + rules.md）從 ~11,000 降到 ~7,900 tok |

逐檔數字見 plan v2 各 task 目標與 `node measure.mjs`；`node measure.mjs --assert` 最終 FAIL 五項（description / B bytes / lang-reviewer bytes / rules.md 行 / rules.md bytes），全部是上表註明的「到不了、不砍保護項」。

### 2. 砍法對照（每種一個例子）

| 砍法 | 例 |
|---|---|
| Trace 段 → 一行指向 rules.md | incident-investigate `§結尾 Trace 標籤` 8 行 → §hand-off state 末一行「結尾貼 rules.md §Trace 標籤（Phase=incident-investigate）」；跨流程 skill（cmd-guard 等 5 檔）用「不貼自身 trace，由呼叫 phase 帶」 |
| Red Flags ≤5 列 | dispatch-parallel 13 → 5（「subagent 自己 push」「fail 重 spawn」「conflict 自 resolve」「prompt 不含 spec」「只給路徑」「隊友再開隊友」六列併一列） |
| 引言縮一行（機制 + 後果） | dispatch-parallel「完成後」四行 → 一行（含「五個 subagent 全部只送 idle、原因是沒人告訴它們要送」） |
| 範例 block 只留一 | security-checklist 每主題只留一組 FAIL / PASS，多的整塊刪（17 → 12 block）；write-skill 刪 §Body 風格規則 內重複的 Red Flags 範本 block |
| 表改指向（整張刪） | dev-workflow §Auto-fix 原則 三欄表 → 「見 rules.md §Auto-fix」+ T3 加嚴一句；design-direction §與 dev-workflow 銜接 呼叫端表刪（description 已載） |
| yaml 承上 | **零行**：22 檔的 hand-off yaml 沒有一行與 dev-workflow 主 yaml 逐字相同（值寫法不同，例 `tier: <T2/T3>` vs `<T0|T1|T2|T3>`），spec 估的 344 行省幅落空，如 plan v2 Risks 預告 |

### 3. 刪除 / 縮寫的「為什麼」索引（`node quote-index.mjs` 機械比對 + 人工核對）

基線含「為什麼 / 實測」的 blockquote 共 9 段：原樣 4、縮成一行 5、刪除 0。

| 檔 | 基線 行 | 原引言 | 現況 |
|---|---|---|---|
| design-direction | 241 | 實測本機可跑（browser binary 來自 `@playwright/mcp`）；沒 playwright CLI 改用 frontend-test | 縮：`> 為什麼沒 playwright CLI 就改用 frontend-test：…不做會卡在現場下載`（腳本因首句改寫判成刪，人工核對為縮） |
| design-language | 181 | 為什麼需要終止條件：未被 import 的新建檔永遠歸不了區 | 縮一行，要素全在 |
| design-language | 213 | 為什麼不用數量門檻：940 行檔 26 vs 34 | 縮一行，四個數字保留 |
| dispatch-parallel | 124 | 「完成後」是 2026-09-03 補的：五個 subagent 全部只送 idle | 縮：`> 為什麼要寫「完成後」：實測五個 subagent 全部只送 idle…原因是沒人告訴它們要送`（同上，人工核對為縮） |
| rules.md | 81 | 設計語言豁免 + 實測依據 2026-09-03 | 縮：規則兩句 + 邊界一句 + 一行無日期理由（含 `docs/index.html` 例） |

design-language 另三段（「這步必須在最前面」「錨定 `*/SKILL.md`」「為什麼要兜底」）與 rules.md §Branch safety 的 node 敘事不含「為什麼 / 實測」關鍵詞、不在腳本統計內，subagent 回報均縮一行且含 plan 指定要素。

### 4. 什麼沒砍

見 spec §零改變界線：步驟 / 選單 / yaml 欄 / 契約字樣 / 數字 / 被外部引用的 § 一字不動；design-direction references 33k tok 不在範圍。機械證據：守門 v2 對 35 檔 ALL PASS（fenced block 逐塊、表格整張、步驟動詞、規則型反引號、agent bullet、rules.md 表格行）、plugin-contract ALL PASS + selftest、docs-site-contract ALL PASS、`build-references -Check` exit 0。

### 執行偏差

- **守門 v2 三個 bug 施工中抓到並修**：(a) `|---|---|` 分隔列各表相同，整張刪表被誤判「少一列」（dev-workflow subagent 實測）→ 分隔列不計；(b) 用 `git stash` 拍基線快照拍到已 commit 的 Task 2 / 26 改動 → 加 `--rev 4de4e83` 直接從 git 讀；(c) AskUserQuestion 選單啟發式對 rules.md 的規則 bullet 誤判為選單 → rules.md 不套（它沒有選單）。這些改動都以負向測 8 案重跑確認。
- **選單啟發式過寬**：design-language / dispatch-parallel / lang-reviewer / frontend-test 的 subagent 都回報「AskUserQuestion 字樣後 15 行內的第一個清單」把非選單的編號步驟鎖住、無法縮。保守方向的誤判，接受；下輪可改成只認 code block 內 `選項：` 與 `- **x** —` 兩型。
- **subagent 越界：零**。22 個成品全在 out/、無人動 skills/ agents/、無人跑契約；9 個回報被 16k 字截斷，改用守門 + intake + quote-index 機械驗收，不再要回報。
- **CRLF**：成品為 LF，磁碟原檔 CRLF；本表 bytes 以 git blob（LF）為準。
- follow-up（不在本 PR）：verify-done L72 指向 frontend-test 不存在的 §測試流程 / §測試報告；契約 P9i 訊息提的 dispatch-parallel §subagent 派工 / §失敗處置 不存在。

### request-review / security-audit 紀錄

- **code-review high 中途停止（user 決定）**：diff 唯一的程式碼是 `docs/work/` 底下四支一次性腳本，request-review 分流表把 `.mjs` 歸程式碼、觸發 T3 high；user 判對丟棄式工具不值 10 分鐘 / 15 萬 token，停在 finder 階段。已到的兩個 finder 原始輸出（simplify / conventions）裡確定成立的已修：註解 `\u` 逃逸、snapshot 強制 `--rev`、四支腳本硬編 `D:/GitHub/bstack` 改問 git、函式 docstring；其餘（選單啟發式過寬、腳本間重複、Red Flags 合併可讀性、Trace stub §）記 follow-up 未驗證。
- **lane 缺口（follow-up）**：`docs/work/**` 一次性腳本與 `scripts/` 正式程式碼被同等對待；request-review §副檔名分流 可加一條「`docs/work/**` 腳本 → 不算程式碼 diff」，是 lane 改變、另開 PR。
- **security-audit**：T3、`code_review_applicable=true` → 跑。結果 1 Major（intake.mjs `execSync` 字串拼命令，檔名可注入）已修成 `execFileSync` 參數陣列 + TARGETS 白名單、以 `foo & bar.md` 實測擋下；其餘 PASS——rules.md §PII / §File-type 與 main 逐 byte 相同，safety-guard 六類 PII regex 與 mask、security-checklist 十二主題、agents 的 STRIDE / OWASP / PII 規則零削弱。

### 對齊 review（request-review T3）與 finder 結果處置

- **對齊 subagent**：0 Critical / 2 Major / 7 Minor / 9 Nit，逐檔看完 35 檔、rules.md 必留子句 22 條全 grep 到。全部採納並修：cmd-guard 觸發判準改回「落入 §危險度分級 任一級」（瘦身把「類型」縮成 L3 / L4 keyword 清單，L1 / L2 處置形同刪除）；write-skill 的 description 教法改兩句式、checklist 改「無觸發詞、無涵蓋 / 上游下游」、舊四段式範例 block 整塊刪；devwork description 補回「沒下指令時就是普通的 Claude Code」；design-direction description 補回「改完驗畫面用 frontend-test」；rules.md 補回「plan 階段不再設策略視角」「以 brainstorm §spec 文件結構與落檔 為準」「其餘照常」「（會直接報錯）」；lang-reviewer「Bash 只讀」；safety-guard placeholder 可放行 / test key 建議移分開；design-language §首次偵測 補前置條件；dev-workflow Red Flags 補「我先想一下」；db-access 主操作在前預檢在後；security-checklist 句號。**未修（守門凍結、記 follow-up）**：write-skill 範本 block 內的 description 範例仍是舊四段式（block 不能改）；`.sass` 註記說 frontend-test description 有 `.sass` 但實際沒有（基線既有不準）。
- **code-review high 已到的 finder（simplify / conventions / reuse / efficiency / altitude 部分）**：確定成立並已修——註解 `\u` 逃逸、snapshot 強制 `--rev`、四支腳本 repo 根改問 git、函式 docstring、`--only` 只抽該檔、intake `execFileSync`；**基線快照 JSON（183 KB）不再入版控**，`node slim-guard-v2.mjs snapshot <out> --rev 4de4e83` 3.9 秒可逐 byte 重產（cmp 驗過）。記 follow-up 未做：四支腳本共用 frontmatter / fences / FILES / TARGETS helper 並 import plugin-contract 的解析器；契約加 P3d 守 description 兩句式；P9d / P9f / P9i / P12 對 description 的斷言改指 body；write-skill 範本更新；Trace stub § 四檔可整段刪；20 個 #69 skill 的 Trace block 可縮；選單啟發式改只認兩型；Red Flags 合併可讀性。
- **守門一次假綠**：`grep -v "^PASS"` 接 `&&` 讓 write-skill 新增反引號的 FAIL 沒擋住 commit，下一顆補修；驗證鏈改 `tail -1 | grep -q "ALL PASS"`。
