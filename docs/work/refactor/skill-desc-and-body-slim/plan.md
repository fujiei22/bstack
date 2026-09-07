# 文本瘦身第二輪 Implementation Plan

> 對應 spec: `docs/work/refactor/skill-desc-and-body-slim/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-07
> 並行最大 group: 5
> 基線 sha: `4de4e83`

**Goal**：A 34 條 description 合計 ≤2,000 tok；B 17 skill body + 6 agents 合計 4,531 行 → ≤3,170（−30%）、175,771 bytes → ≤140,600（−20%）；C rules.md 197 行 → ≤150、18,206 bytes → ≤14,000。三契約全綠、守門快照零差異。

**Architecture**：先建守門腳本 v2 並對基線拍快照（Task 1），之後每個改動都能機械比對。A 與 C 由主 agent 親手改（A 是 34 檔各改幾行、拆給 subagent 反而貴；C 位階最高）。B 每檔一個 subagent 平行改、不 commit，主 agent 收回後跑契約 + 守門、逐檔 commit。最後重產 references、總量斷言、施工紀錄。

**Risks**：description 砍太短讓 `/bstack:<name>` 顯式呼叫時辨識變差（第一行「是什麼」保留即可）；rules.md 改壞是全 repo 事故（主 agent 改 + 三契約 + 守門 + review-plan Eng 逐行）；單檔目標達不到（軟目標，總量由 Task 27 守，到不了攤數字不砍保護項）。

---

## §共同施工守則（B 的每個 subagent prompt 逐字附上）

**目標**：把 `<檔>` 從 N 行砍到目標行（軟目標）、bytes 也要降，**用途與邏輯零改變**。

**不能動（七條）**：
1. frontmatter 整段（`---` 到 `---`）一個字都不改（description 由主 agent 另一個 task 改，你不碰）。
2. 「## 使用契約」底下的**編號步驟數量與順序**；每步的動作動詞（讀 / 判 / spawn / 交棒 / 跑 / commit / 回傳）保留，句子可縮。沒有使用契約段的檔（agents / security-checklist / db-access）：「角色職責」「§輸入契約」「§嚴格 output 格式」段的**每一條項目**都保留，句子可縮。
3. **所有 AskUserQuestion 選單逐字保留**：含 `AskUserQuestion` 字樣的句子之後的第一個清單（code block 內的 `選項：` 編號、縮排編號列、`- **x** — …` bullet）整塊不動。
4. **被外部引用的 § 標題不改名、不刪**（白名單見 spec §被外部引用的 § 標題白名單，task 各自列）；白名單外的 § 可合併 / 刪；**不新增本來沒有的 §**。
5. 契約斷言字樣：改完跑 `node scripts/plugin-contract.mjs 2>&1 | grep -E "FAIL|ALL PASS"`，**只處理錯誤訊息點名到自己這個檔的 FAIL**（把那句改回去），別檔的 FAIL 原樣回報、**不改契約**。
6. 指令 / 路徑 / 檔名 / regex / 反引號片段 / 數字精確保留（可整段刪，不可改寫、**不新增反引號片段**）。
7. yaml 區塊的**欄位名一個不少**；可把上游已定義的欄縮成一行 `# 承上 dev-workflow §Skill hand-off state` 註解＋只列本 skill 新增 / 改寫的欄（dev-workflow 自己那份是唯一真相、不縮）。agents 的 output 格式 code block 逐字保留。

**砍法（依序）**：
1. `§結尾 Trace 標籤` 整段 → 一行 `結尾貼 rules.md §Trace 標籤（Phase=<本 skill>）`。
2. §Red Flags ≤5 列（同義列合併；task 指定必留的照列）。
3. 「為什麼」引言與歷史敘事（含日期的「實測」經過）：每段留**恰一行** `> 為什麼<動作>：<機制一句>；不做會<後果一句>。`；純敘事（誰在哪天發現）刪。
4. 範例 code block：同類只留一個；`❌` 反例刪、`✅` 正例留（security-checklist 例外見 task）。
5. 別檔已有的表 / 清單 → 一行 `見 <skill> §<段名>` 或 `見 rules.md §<段名>`（指向的 § 必須真的存在，不確定就 grep）。
6. 空行 / `---` 分隔線可刪但不算數——bytes 也要降。

**產出（回報格式，不 commit、不動別的檔）**：
```
檔：<path>
行數：N → M（目標 T）  bytes：B0 → B1
砍掉的段：<列>
保留的引言：<逐行列出>
契約：ALL PASS | FAIL <點名自己檔的條目與處置> | 其他檔 FAIL：<原樣>
被迫動到「不能動」項：無 | <哪一條、為什麼>
```

**失敗處置（主 agent）**：行數差目標 ≤10% → 接受、施工紀錄註明；差 >10% 或動到「不能動」項或守門紅 → `git checkout <檔>` 回基線、附上守門訊息重派一次；第二次仍到不了 → 接受現況、施工紀錄與 PR body 明列。**不得由 subagent 自行放寬。**

---

### Task 1: 守門腳本 v2 + 基線快照 + 量測腳本

**parallel-group**: 1
**files**: create `docs/work/refactor/skill-desc-and-body-slim/slim-guard-v2.mjs`、`docs/work/refactor/skill-desc-and-body-slim/measure.mjs`、`docs/work/refactor/skill-desc-and-body-slim/baseline-4de4e83.json`

- [ ] Step 1: 紅 = 檔不存在（`test -f …/slim-guard-v2.mjs` FAIL）
- [ ] Step 3: 以 #67 的 `slim-guard.mjs` 為底擴成 v2，涵蓋 28 skill + 6 agents + rules.md：
  - 抽：frontmatter **去掉 description 後**的其餘欄（name / tools / model 等，逐字）；description 另抽 `{ firstLine, hasTrigger:/觸發：/, protected:[…] }`；使用契約編號步驟；所有 `## §` / `### §` 標題；含 `AskUserQuestion` / `選項` 的 code block；不在 code block 的選單清單（AskUserQuestion 後 15 行內第一個清單）；反引號片段集合；yaml 區塊內的欄位名集合（`^\s*([A-Za-z_][\w]*):` ）；rules.md 額外抽所有 `|` 表格行（normalize 空白）與 16 個 § 名。
  - 比對規則：fm 其餘欄相同；description firstLine 非空、無「觸發：」、protected 字樣仍在（devwork `/devwork`、pr-explain `T3`、lang-reviewer `顯式`、security-auditor `純文件`、design-language `命中` 與 `才載`、devwork / dev-workflow / brainstorm `不因自然語言自動觸發`）；步驟序相同；白名單 § 都在（白名單寫死在腳本、內容取自 spec）；無新增 §；選單 block 集合相同（normalize 空白）；反引號片段不新增；yaml 欄名不減；rules.md 表格行集合相同。
  - `node slim-guard-v2.mjs snapshot <json>` / `check <json>`，FAIL 逐檔列差異。
  - measure.mjs：每檔行 / bytes / 估 tok / description 估 tok，印總量表（供 Task 27 斷言）。
- [ ] Step 4: `node slim-guard-v2.mjs snapshot baseline-4de4e83.json && node slim-guard-v2.mjs check baseline-4de4e83.json` → 全 PASS（自比對必綠）；`node measure.mjs` 印出基線表
- [ ] Step 5: commit `test: 文本瘦身守門腳本 v2 與基線快照`

### Task 2: A — 34 條 description（主 agent）

**parallel-group**: 2
**files**: modify 28 個 `skills/*/SKILL.md` frontmatter、6 個 `agents/*.md` frontmatter（**只動 description 值**）

- [ ] Step 1: 紅 = `node measure.mjs` description 合計 >2,000 tok（基線 ~5,000）
- [ ] Step 3: 每條改成兩句：
  - 第一行「<是什麼>（繁中）。」——保留原第一句的名詞（例「需求釐清 + Phase 0 入口分流」「OWASP Top 10 + STRIDE 安全稽核」）。
  - 第二句「載入：<時點>」——取原文「載入：」子句的主幹（Phase 幾 / 誰交棒 / user 顯式呼叫），刪「涵蓋：…」「上游 / 下游」「分工」「使用：」整段。
  - 保留：devwork / dev-workflow / brainstorm 的「不因自然語言自動觸發」；devwork 的「打了出現 Unknown command… 改打 `/bstack:devwork`」；契約守的字樣（Task 1 protected 清單）；lang-reviewer 的「不自動派發；user 顯式要求時由主 agent spawn」；security-auditor 的「T3 程式碼 diff 必跑、純文件 diff 且無 File-type 硬規則命中跳」；design-language 的「brainstorm 0b′ 比對命中前端副檔名才載」。
  - 全部維持 `description: |` 多行寫法（契約 S1-S6 解析器兩種都吃，但 references-data.js 與 docs 站抽屜讀第一行，多行最穩）。
- [ ] Step 4: `node measure.mjs` description 合計 ≤2,000；`node slim-guard-v2.mjs check baseline-4de4e83.json` PASS（description 規則）；`node scripts/plugin-contract.mjs` ALL PASS（P3b / P3c / P9d / P9f / P11 / P12）
- [ ] Step 5: commit `refactor: 34 條 skill / agent description 改兩句式（是什麼 + 何時載）`

### Task 3–19: B — 17 個 skill body（subagent 各一，devwork 由主 agent）

**parallel-group**: 3
**files**: 各自 `skills/<name>/SKILL.md`

每個 task 五步相同：Step 1 紅 = `wc -l` > 目標；Step 3 依 §共同施工守則 + 下表砍點；Step 4 `wc -l` ≤ 目標（軟）、契約 ALL PASS、守門 PASS；Step 5 主 agent commit `refactor: <name> 文本瘦身`。

| Task | 檔 | 行 → 目標 | 白名單 § | 砍點 / 必留 |
|---|---|---|---|---|
| 3 | dev-workflow | 290 → ≤200 | §Track × Tier × Phase 路徑 §Skill hand-off state §Trace 標籤 §Auto-fix 原則 §Fail handling §Memory hook 點 §跨流程 skill 載入 | §Phase 0 圖與 §Track × Tier × Phase 路徑 兩張 ASCII 圖**逐字留**（P10b / P11 / P12 讀其中行）；§Skill hand-off state yaml 逐字留（唯一真相）；§Trace 標籤 只留格式與省略時機、範例刪一個；§Auto-fix / §Fail handling 各縮成指向 rules.md 同名 § 加本 skill 特有的一句（T3 加碽、fail_history append）；§跟 rules.md 的關係 表縮三列；§載入此 skill 後第一句台詞 留台詞本體；Red Flags 10→5（留「trivial 不用走流程」「不問 user 直接決定 tier」「risky 改動我評估安全」「skill 之間自由跳」「fail 多 retry」） |
| 4 | design-direction | 346 → ≤240 | §對外契約 §與 dev-workflow 銜接 | §核心哲學 / §反 AI slop 兩段散文各縮半、清單項不刪；§三個 subagent 的跑法 的 prompt code block 逐字留、外圍說明縮；§References 路由 表留、說明縮；§圖片是不是必需 縮成判定表 + 一句；P9i 守 `T2 → 回 \`brainstorm\`` **恰兩處**；Red Flags 10→5 |
| 5 | design-language | 279 → ≤195 | §前端副檔名 §對外契約 §兩根尺 §首次偵測 §設計語言抽取 §對齊檢查清單 §與 dev-workflow 銜接 | §前端副檔名 code block 與 `.sass` 分歧註記逐字留（P11 讀 fenced block）；§對外契約 表逐字留；§`design-map.md` 格式 範例表縮到兩列 + 欄說明表留；§失效檢查 三條件與終止條件留、bash 範例留、說明縮；§設計語言抽取 六類表留、「為什麼不用數量門檻」留一行；五段引言各縮一行；Red Flags 8→5（必留「T1 這麼小」「抽不到拿隔壁區頂替」「先寫 design-map」） |
| 6 | dispatch-parallel | 287 → ≤200 | §協作模式判定 §隊友派工 §Spawn 細節 | §協作模式判定 判準表、選單範本 code block、硬規則四點、「唯讀 fan-out」兩理由**逐字留**（rules.md §協作模式判定 指向這裡）；§隊友派工 prompt 範本逐字留、「完成後」引言縮一行；§隊友專屬注意 表 7→5 列合併；§Spawn 細節 prompt 逐字留；§跟 user 互動 縮半；P9i 守 `施工清單` 在、無 `→ 退 write-plan$`；Red Flags 13→5（必留「能平行就開 Agent Teams」「多視角 review 互辯」「判定完直接開隊友」） |
| 7 | incident-investigate | 303 → ≤210 | （無外部引用；§Step 1-4 §產出檔結構 §hand-off state 自留） | 四個 Step 的 report 範本 code block 合併成一個完整範本（現在 Observe / Conclude 各有一份重疊）；Step 3 fan-out 的 hypothesis-tester 派工 prompt 逐字留、「只看到這一條」句留；六段引言縮一行；Red Flags 8→5 |
| 8 | frontend-test | 187 → ≤130 | §載入時機 §測試矩陣 §branch-name fallback 鏈 | §載入時機 表中 `\| T2 + 前端檔改動` 那行逐字留（P11 讀）；§Dispatch prompt 逐字留；§Result handling 8a-8d 四分支各縮成一句 + 處置；兩個 yaml 合一（欄名不少）；Red Flags 12→5 |
| 9 | write-skill | 248 → ≤170 | §新 skill 落地 checklist | §SKILL.md 結構 範本 code block 留但內部的 `§<段一名>` 佔位段縮；§Frontmatter 詳解 表留、說明縮；§Body 風格規則 清單留、範例刪半；兩個 §Red Flags（一個在範本內、一個是本 skill 的）：範本內留 3 列示意、本 skill 的 8→5；P9h 守無 `T1 由 brainstorm 直接交棒` |
| 10 | security-checklist | 293 → ≤220 | （無） | 12 主題各保留 checklist 項目文字；FAIL / PASS 範例：**每主題留一組**（現在多數有兩組以上）、❌ 刪保留 ✅（description 說「附 FAIL / PASS 範例」，每主題至少一組才不算改用途）；§載入 / 結束 縮 |
| 11 | cmd-guard | 172 → ≤120 | （無） | §自查 pattern 表留、說明縮；§AskUserQuestion 模板 逐字留；§safer 替代建議 表留；Red Flags 5 不動 |
| 12 | safety-guard | 171 → ≤120 | （無） | §PII pattern / §Secret pattern 兩表留、regex 逐字；§報告格式 code block 留；五段引言縮一行；Red Flags 5 |
| 13 | lock-files | 119 → ≤85 | （無） | §鎖檔 prompt 選單留；§寫入 pre-check 邏輯留、範例縮 |
| 14 | context-snapshot | 182 → ≤125 | （無） | §快照結構 範本 code block 留、外圍說明縮；§存哪些東西 / §存哪裡 / §commit snapshot 不？ 三段合一表；P9h 守無 `4 視角`；六段引言縮一行 |
| 15 | context-resume | 152 → ≤105 | （無） | §印 progress 範本留；§接續方向確認 選單留；§State 還原 步驟留、範例縮；§跟 brainstorm 的差異 縮三行 |
| 16 | db-access | 88 → ≤70 | （無；rules.md §DB 操作 指向本檔） | 三個含日期的實測敘事各縮一行機制；讀 / 寫 / PII 三節規則逐條留 |
| 17 | retro | 188 → ≤130 | （無） | §報告結構 範本留；§Memory hook 流程 步驟留、說明縮；§資料蒐集細節 指令留、說明縮；Red Flags 7→5 |
| 18 | debug-systematic | 186 → ≤130 | （無） | 五 Step 的產出 / 判準留、說明縮；§commit 規範 指向 rules.md §Commit 訊息 + 本 skill 特有的一句；Red Flags 6→5 |
| 19 | devwork（主 agent） | 39 → ≤32 | （無） | 「為什麼要有這一層」縮兩行；台詞、契約四步、顯式呼叫清單逐字留；P3b 守 description 含 `/devwork` |

### Task 20–25: B — 6 個 agents（subagent 各一）

**parallel-group**: 3
**files**: 各自 `agents/<name>.md`

| Task | 檔 | 行 → 目標 | 白名單 § | 砍點 / 必留 |
|---|---|---|---|---|
| 20 | db-reviewer | 151 → ≤110 | §檢查焦點 §回報格式 | §檢查焦點 68 行：每焦點留「查什麼 + 紅線」兩行、範例刪；結論範本 code block 逐字留；§使用 mysql MCP 指向 rules.md §DB 操作 + 本 agent 特有一句 |
| 21 | frontend-e2e-runner | 206 → ≤145 | §輸入契約 §嚴格 output 格式 §使用 tool 範圍 | §Session lifecycle 步驟留、理由縮；§判定標準 表留；output 格式 code block 逐字留；Red Flags 8→5 |
| 22 | hypothesis-tester | 152 → ≤110 | §輸入契約 §嚴格 output 格式 §使用 tool 範圍 §PII | output 格式逐字留；§三種 Verdict / §Confidence 標準 合一表；§Unexpected findings 的價值 縮一段；Red Flags 6→5 |
| 23 | lang-reviewer | 175 → ≤140 | §回報格式 | §語言檢查焦點 88 行是內容表（9 語言 × 焦點）**留**，只縮每語言的說明句；§通用 review 框架 縮；結論範本留；P9f 守 description（主 agent 改） |
| 24 | pr-explainer | 155 → ≤110 | §Tier 控詳盡度 §文件結構標準 §使用 tool 範圍 | §文件結構標準 範本逐字留（pr-explain 指向）；「風格」段縮；六段引言縮一行；Red Flags 7→5 |
| 25 | security-auditor | 162 → ≤115 | §PII 安全底線 §回報格式 §使用 tool 範圍 | STRIDE / OWASP 兩表留、說明縮；§Checklist 主題 指向 security-checklist 各 §；結論範本逐字留；Red Flags 7→5 |

### Task 26: C — rules.md（主 agent）

**parallel-group**: 4
**files**: modify `skills/devwork/rules.md`

- [ ] Step 1: 紅 = `wc -l` 197 > 150
- [ ] Step 3: 逐段：
  - §白話優先（24 行）：三個術語範例留一個；「寫法」四點、「區分實測與推論」、「底線」、「不適用」各留一句，合併成一段 ≤10 行。
  - §事實核實：**逐字留**（最高指導原則、C8e / P6 / dev-workflow 讀）。
  - §Branch safety（5 行但每行極長）：「豁免」段拆成三句：只管 `$CLAUDE_PROJECT_DIR` 底下、repo 外 / 非 git / 解析失敗放行、缺 node 兩種說法下保護都不存在——刪「契約 P2d 以 fixture 守」「官方 setup 文件」「Windows 實測（2026-09-07…）」等出處敘事（出處在 spec 歸檔）；`hooks/guard.mjs`、`node --version`、`/plugin disable bstack@bstack` 反引號片段留。
  - §File-type 硬規則：表逐字留；前導句縮。
  - §設計語言對齊：blockquote「豁免：只改文字節點時不適用」留規則兩句 + 邊界一句，**刪「實測依據：2026-09-03…」**；五個 bullet 各縮成一句、粗體關鍵詞留；「細則 → design-language」留。
  - §Docs 落檔（23 行）：表逐字留；bullet 11 條合併成 6 條（目錄 + 檔名固定合一；時機 + 覆寫合一；merge 後搬檔 + 進 reference 門檻合一；檔名不放日期 + commit 與否 + 遷移各留一句）。
  - §Tier 機制：表逐字留（P9a / P11 / P12 讀）；表下五個 bullet 各縮半、關鍵句（「本表是 lane 的唯一真相」「code review 先看副檔名再看 Tier」「security 同樣先看副檔名再看 Tier」「lang-reviewer 不自動 spawn」「T3 review-plan 視角依改動面向」）留；「精簡依據見 docs/archive」一句留。
  - §協作模式判定（17 行）：三條判準逐字留；四個 bullet 各縮一句；「觸發點：只有一個」留一句。
  - §Settings.json：縮兩句，範本 URL 與 `Bash(cat/head/tail:*)` 留。
  - 其餘（§Task 追蹤 / §決策點選單 / §PII / §DB 操作 / §Trace / §Auto-fix / §Fail handling / 程式碼規範 / 版本控管）已經是最密度，不動或只刪空行。
- [ ] Step 4: `wc -l` ≤150、bytes ≤14,000；三契約 ALL PASS；守門 PASS（16 § 在、表格行集合相同）；`grep -c "20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]" rules.md` = 0
- [ ] Step 5: commit `refactor: rules.md 壓縮敘事、表格與規則字樣不動`

### Task 27: 守門總比對 + 重產 references + 總量斷言 + 施工紀錄

**parallel-group**: 5
**files**: modify `docs/js/references-data.js`（重產）、`docs/work/refactor/skill-desc-and-body-slim/spec.md`（施工紀錄）

- [ ] Step 1: 紅 = `pwsh -NoProfile -File scripts/build-references.ps1 -Check` exit 1（skill 改了快照過期）
- [ ] Step 3: `node slim-guard-v2.mjs check baseline-4de4e83.json` 全 PASS；`node measure.mjs` 對 spec 目標斷言（description ≤2,000 tok；B 行 ≤3,170、bytes ≤140,600；rules.md ≤150 行 / ≤14,000 bytes）；`pwsh -NoProfile -File scripts/build-references.ps1` 重產；施工紀錄寫前後對照表（每檔行 / bytes / tok）、目標達成度、未達項與理由、subagent 越界 / 重派紀錄。
- [ ] Step 4: `-Check` exit 0 && `node scripts/plugin-contract.mjs` ALL PASS && `--selftest` && `node docs/tools/docs-site-contract.mjs` ALL PASS（**用 `&&` 串**）
- [ ] Step 5: commit `chore: 重產 references-data.js、施工紀錄（前後對照 / 守門結果）`

---

## Self-review

1. **spec coverage**：目標 1 → Task 2；目標 2 → Task 3-25；目標 3 → Task 26；目標 4 → Task 1 + 27；目標 5 → review-plan Eng（不在 plan 內，是 phase）。
2. **placeholder**：無 TBD；每 task 砍點具體到段名。
3. **並行性**：group 3 的 23 個 task 各自一檔、契約可能跨檔誤紅 → 守則 5 只處理點名自己檔的 FAIL；group 2（A 改 frontmatter）必須先於 group 3（B 改 body）完成並 commit，否則同檔兩處同時改會互蓋——這是把 A 放 group 2 而非與 B 同 group 的理由。
4. **一致性**：守門白名單 = spec 白名單；protected 字樣清單 Task 1 與 Task 2 同一份。
5. **scope**：不動 references、不動 #67 九檔 body、不改契約。
