# 文本瘦身第二輪 Implementation Plan（v2，依 review.md 改）

> 對應 spec: `docs/work/refactor/skill-desc-and-body-slim/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-07
> 並行最大 group: 5
> 基線 sha: `4de4e83`

**Goal**：A 34 條 description 合計 ≤2,000 tok；B 17 skill body + 6 agents 合計 **非空行** 3,318 → ≤2,674（−19%；review Eng M7 改數非空行）、bytes 175,771 → ≤140,600（−20%）（軟目標，總量以 Task 27 的量測為準、到不了攤數字）、bytes 同步降；C rules.md 非空 145 行 → ≤110、18,206 bytes → ≤14,000。三契約全綠、守門快照零差異。

**Architecture**：先建守門腳本 v2 並對基線拍快照（Task 1），之後每個改動都能機械比對。A 與 C 由主 agent 親手改。B 每檔一個 subagent 平行改，**成品寫到 `docs/work/refactor/skill-desc-and-body-slim/out/<name>.md`、不碰 `skills/` `agents/`、不跑契約**（review Eng M10：22 個 subagent 在同一工作樹半改狀態下跑契約會間歇假紅、P2e 真 spawn 建刪 token 檔會競態）；subagent 只跑 `slim-guard-v2 check --only <name> --src out/<name>.md`。主 agent 逐檔 copy 進去、跑守門 + 三契約、commit。最後重產 references、總量斷言、施工紀錄。

**Risks**：description 砍太短讓 `/bstack:<name>` 顯式呼叫時辨識變差（第一行「是什麼」保留；design-language / design-direction 各留半句分工）；rules.md 改壞是全 repo 事故（主 agent 改 + 三契約 + 守門 + review-plan Eng 逐行）；yaml「承上」實際只能刪與 dev-workflow 主 yaml **逐字相同**的行（多數 skill 的 yaml 值寫法不同，例 `tier: <T2/T3>` vs `<T0|T1|T2|T3>`），省幅會遠小於 spec 估的 344 行——施工紀錄如實記。

---

## §共同施工守則（B 的每個 subagent prompt 逐字附上）

**目標**：把 `<檔>` 從 N 行砍到目標行（**軟目標**：差 ≤10% 可接受、**不得為湊數砍下面任何保護項**）、bytes 也要降，用途與邏輯零改變。

**不能動（八條）**：
1. frontmatter 整段一個字都不改（description 由主 agent 另一個 task 改，你不碰）。
2. 「## 使用契約」底下的**編號步驟數量與順序**；每步的動作動詞（讀 / 判 / spawn / 交棒 / 跑 / commit / 回傳 / 寫 / 載 / 派 / 問 / AskUserQuestion）與反引號片段保留，句子可縮。沒有使用契約段的檔（agents / security-checklist / db-access）：「角色職責」「§輸入契約」「§嚴格 output 格式」段的**每一條 bullet 與粗體關鍵詞**都保留，句子可縮。
3. **所有 AskUserQuestion 選單逐字保留**：含 `AskUserQuestion` 字樣的句子之後的第一個清單整塊不動。
4. **§ 標題只能整段刪、不能改名、不能新增**（守門用全等比對，「§Result handling（8a-8d 完整分支）」縮成「§Result handling」也算改名）；被外部引用的白名單 § 連刪都不行（task 各自列）。code block 內長得像標題的行（write-skill 範本 `## §<段一名>`、pr-explainer 格式 block `## 整體脈絡`）是內容不是標題，守門不掃、你也不動（守則 7）。
5. **不跑 `scripts/plugin-contract.mjs`、不跑 `build-references.ps1`**（跨檔契約在別人半改狀態下會假紅、P2e 有競態、`-Check` 從 Task 2 起就紅是刻意的）。契約由主 agent 收檔後跑；被點名到你的檔時主 agent 會附訊息重派。你只跑守門：`node docs/work/refactor/skill-desc-and-body-slim/slim-guard-v2.mjs check docs/work/refactor/skill-desc-and-body-slim/baseline-4de4e83.json --only <name> --src <你的成品路徑>`。
6. 指令 / 路徑 / 檔名 / regex / 反引號片段 / 數字精確保留（一般名詞片段可隨段落刪；**regex / 路徑 / 旗標型片段不准消失**）；**不新增反引號片段**。
7. **code block 只能整塊刪、不能改、不能新增、不能合併**（守門逐塊比對）。yaml 區塊例外走行級：只能刪與 dev-workflow §Skill hand-off state 主 yaml **逐字相同**的行、並補一行 `# 承上 dev-workflow §Skill hand-off state`；其餘行一個字不改。**表格**：整張可刪（改成指向），**不可刪單列、改列、新增列**；只有 §Red Flags 表可合併改寫（≤5 列）。
8. **agent 檔與跨流程 skill 裡「依 rules.md §X」後面內嵌的規則條目逐條留**——agent 在獨立 context 只有自己的 md，rules.md / security-checklist / 其他 skill 都讀不到；指向句可以加、**不能取代**內嵌條目（db-reviewer §使用 mysql MCP 三條、security-auditor §Checklist 主題 14 條、hypothesis-tester §PII、frontend-e2e-runner PII 段、lang-reviewer PII 行都屬此類）。

**砍法（依序）**：
1. `§結尾 Trace 標籤`：**有自身 phase 的 skill** → 一行 `結尾貼 rules.md §Trace 標籤（Phase=<本 skill>）`；**跨流程 skill**（cmd-guard / context-snapshot / lock-files / safety-guard / security-checklist）→ 一行 `不貼自身 trace，由呼叫 phase 帶`；context-resume / frontend-test / dispatch-parallel 的既有 Trace block 原樣留（本來就只有 3 行、且各有特殊寫法）。
2. §Red Flags ≤5 列（同義列合併；task 指定必留的照列）。
3. 「為什麼」引言與歷史敘事：定義 = **不在 code block 內、以 `> ` 開頭、含「為什麼」或「實測」的段**；code block 內以 `>` 開頭的範本行與 SQL 範例裡的日期是**資料**、不算敘事、不動。每段留**恰一行** `> 為什麼<動作>：<機制一句>；不做會<後果一句>。`（task 有列「一行必含」要素的照列）；純敘事（誰在哪天發現）刪。
4. 範例 code block：同類只留一個——**整塊刪多的那份**，不合併、不改寫；`❌` 反例塊刪、`✅` 正例塊留。
5. 別檔已有的表 / 清單 → 一行 `見 <skill> §<段名>` 或 `見 rules.md §<段名>`（**指向前先 grep 該標題存在**，把 `檔:行` 寫進回報；rules.md 的「Commit 訊息」「Branch 命名」「GitHub Flow」等標題**沒有 §**，指向時不帶 §）。
6. 空行 / `---` 分隔線可刪但不算數——bytes 也要降。

**產出（成品寫 `out/<name>.md`；不 commit、不動 `skills/` `agents/`）**：
```
檔：<原路徑> → 成品：docs/work/refactor/skill-desc-and-body-slim/out/<name>.md
非空行：N → M（目標 T）  bytes：B0 → B1（目標 ≤B）
守門：… check … --only <name> --src out/<name>.md → PASS | FAIL <訊息原文>
砍掉的段：<列>
刪掉的引言：<每條：原句一句摘要 + 基線 檔:行>
改寫（非刪除）的段：<列段名>
新增的指向：<每條：見 X §Y ← grep 到 檔:行>
Red Flags 合併對應：<哪幾列 → 哪一列>
yaml 承上刪掉的行：<列，或「無」>
被迫動到「不能動」項：無 | <哪一條、為什麼>
```

**失敗處置（主 agent）**：copy 進 `skills/` 後跑守門 + `node scripts/plugin-contract.mjs`；非空行差目標 ≤10% → 接受、施工紀錄註明；差 >10% 或守門 / 契約點名該檔紅 → `git checkout <檔>` 回基線、附上訊息重派一次；第二次仍到不了 → 接受現況、施工紀錄與 PR body 明列。**不得由 subagent 自行放寬。**

---

### Task 1: 守門腳本 v2 + 基線快照 + 量測腳本

**parallel-group**: 1
**files**: `docs/work/refactor/skill-desc-and-body-slim/{slim-guard-v2.mjs, measure.mjs, baseline-4de4e83.json}`

- [ ] Step 1: 紅 = 檔不存在
- [ ] Step 3: 守門腳本自寫（#69 那輪的 slim-guard.mjs 只在當時 session 的 scratchpad、沒進 archive）；抽取與規則（review Eng C1 / C2 / M1 / M2 / M3 / m1 / m2 補強後）：
  - fmRest（frontmatter 去 description）逐字；description 第一行非空、無「觸發：」、PROTECTED 字樣仍在（devwork `/devwork` `不因`、dev-workflow / brainstorm `不因自然語言自動觸發`、pr-explain `T3`、design-language `命中` `才載`、**design-direction `T2 → 回 \`brainstorm\``（P9i 全檔計數 === 2，其中一處在 description）**、lang-reviewer `顯式`、security-auditor `純文件`）。
  - 使用契約步驟：編號序全等 + **每步動詞集合與反引號集合 砍後 ⊇ 基線**；沒有使用契約段的檔退到 body 第一個編號清單。
  - § 白名單必留、不新增 / 不改名（全等比對）；標題只掃 code block 之外。
  - `--src <path>`：用 out/ 成品當某檔現況比對（subagent 用）。
  - **所有 fenced block** normalize 後必須等於某個基線 block（可整塊刪、不可改 / 新增）；yaml 行級：砍後每行 ∈ 基線該檔 ∪ dev-workflow 主 yaml ∪ `# 承上`，消失的行 ⊆ 主 yaml。
  - AskUserQuestion 後不在 code block 的選單清單全等。
  - **表格以連續 `|` 行為一張**：整張可刪、不可刪單列 / 改列 / 新增列；§Red Flags 表除外（已改動時 ≤5 列）。
  - 反引號片段不新增；**regex / 路徑 / 旗標 / 檔名型片段不消失**。
  - agents「角色職責 / §輸入契約 / §嚴格 output 格式」bullet 數不減、粗體集合 ⊇ 基線。
  - 負向測 8 案（種植違規 → 紅、允許的改法 → 綠）寫在施工紀錄。
- [ ] Step 4: `snapshot` → `check` 自比對 ALL PASS；負向測 8 案全 OK；`node measure.mjs` 印基線表
- [ ] Step 5: commit `test: 文本瘦身守門腳本 v2（守 fenced block / 表格 / 步驟動詞 / yaml 行級）與基線快照`

### Task 2: A — 34 條 description（主 agent）

**parallel-group**: 2
**files**: 28 個 `skills/*/SKILL.md` + 6 個 `agents/*.md` 的 frontmatter（**只動 description 值**）

- [ ] Step 1: 紅 = `node measure.mjs` description 合計 >2,000 tok（基線 ~4,971）
- [ ] Step 3: 每條兩句式：第一行「<是什麼>（繁中）：<3-6 個名詞>」；第二句「載入：<時點>」。刪「涵蓋：」「上游 / 下游」「使用：」。**例外（第三句 / 保留字）**：
  - devwork / dev-workflow / brainstorm：「不因自然語言自動觸發」；devwork 另留「Unknown command 時改打 `/bstack:devwork`」與「沒下指令時就是普通的 Claude Code」。
  - **design-direction**：留下游句 `T2 → 回 \`brainstorm\` 3.5…`（P9i）+ 半句分工「既有設計語言查 design-language；改完驗畫面用 frontend-test」。
  - **design-language**：「brainstorm 0b′ 比對命中前端副檔名才載」+ 半句「新設計決策交 design-direction」。frontend-test 與其他 skill **不加**分工句。
  - **execute-plan**：留第三句「T0 不進本 skill」（body 沒有這句、契約沒守，砍了就消失）。
  - pr-explain `T3`；lang-reviewer「不自動派發；user 顯式要求時由主 agent spawn」；security-auditor「T3 程式碼 diff 必跑、純文件 diff 且無 File-type 硬規則命中跳」。
  - 三個沒有「載入：」子句的 agent 第二句**直接用**：frontend-e2e-runner「載入：frontend-test spawn。」、hypothesis-tester「載入：incident-investigate Test 階段 ≥3 假設時平行 spawn。」、pr-explainer「載入：pr-explain spawn。」
  - 全部維持 `description: |` 多行（docs 站抽屜 `app.js parseFrontmatterDesc` 讀第一行）。
- [ ] Step 4: measure ≤2,000；守門 PASS（description 規則 + fmRest）；`node scripts/plugin-contract.mjs` ALL PASS
- [ ] Step 5: commit `refactor: 34 條 skill / agent description 改兩句式（是什麼 + 何時載）`

### Task 3–19: B — 17 個 skill body（subagent 各一，devwork 由主 agent）

**parallel-group**: 3
**files**: 各自 `skills/<name>/SKILL.md`

五步相同（Step 2「跑紅」併入 Step 1 的量測、不另列）：Step 1 紅 = **非空行** `grep -c . <檔>` > 目標；Step 3 依 §共同施工守則 + 下表；Step 4 非空行 ≤ 目標（軟）**且 bytes ≤ 基線 −20%**（兩個都要，防刪空行湊數——dev-workflow 光刪空行就從 290 到 229）、契約 ALL PASS、守門 PASS；Step 5 主 agent commit `refactor: <name> 文本瘦身`。

| Task | 檔 | 行 → 目標 | 白名單 § | 砍點 / 必留 |
|---|---|---|---|---|
| 3 | dev-workflow | 非空 229 → ≤185（bytes ≤11,300） | §Track × Tier × Phase 路徑 §Skill hand-off state §Trace 標籤 §Auto-fix 原則 §Fail handling §Memory hook 點 §跨流程 skill 載入 | §Phase 0 入口分流 的圖、Dev / Bug track 圖、主 yaml 三個 block 逐字（守門逐塊比）；**§跨流程 skill 載入 表整張逐字**（P9c / P10b / P11 讀其中三列）；§Trace 標籤 留格式 + 省略時機、範例刪一個 block；§Auto-fix / §Fail handling 各縮成「見 rules.md §同名」+ 本 skill 特有一句（T3 加嚴 / fail_history append）；§跟 rules.md 的關係 表**整張留或整張刪**（不縮列）→ 刪、改一句；§載入此 skill 後第一句台詞 留台詞 block；Red Flags 10→5（留「trivial 不用走流程」「不問 user 直接決定 tier」「risky 改動我評估安全」「skill 之間自由跳」「fail 多 retry」） |
| 4 | design-direction | 非空 240 → ≤175（bytes ≤16,000） | §對外契約 §與 dev-workflow 銜接 | §核心哲學 / §反 AI slop 散文各縮半、清單項不刪；三 subagent prompt block 逐字；§References 路由 表整張留；§圖片是不是必需 縮散文、表留；body 的 `T2 → 回 \`brainstorm\`` 那句逐字（P9i）；Red Flags 10→5 |
| 5 | design-language | 非空 203 → ≤150（bytes ≤14,000） | §前端副檔名 §對外契約 §兩根尺 §首次偵測 §設計語言抽取 §對齊檢查清單 §與 dev-workflow 銜接 | §前端副檔名 block 與 `.sass` 註記逐字（P11）；§對外契約 表逐字；§`design-map.md` 格式 範例表整張留（不縮列）、欄說明表留；§失效檢查 三條件、終止條件、bash block 留；引言處理（**一行必含要素**）：「為什麼這步必須在最前面」→ 每專案每 task 付偵測成本；「為什麼錨定 `*/SKILL.md`」→ 產品目錄叫 skills/ 會被靜默排除；「為什麼要兜底」→ 失效方式是**靜默**說沒設計語言；§失效檢查「第 3 條治的是」→ 新區塊長在舊 glob 底下、前兩條不響、比沒地圖更糟；「為什麼不用數量門檻」→ **保留 26 vs 34 兩個數字**；§對齊檢查清單「什麼時候要回去補讀」的括號理由（前一版無限迴圈）**留一行**；Red Flags 8→5（必留「T1 這麼小」「抽不到拿隔壁區頂替」「先寫 design-map」） |
| 6 | dispatch-parallel | 非空 218 → ≤165（bytes ≤11,000） | §協作模式判定 §隊友派工 §Spawn 細節 | §協作模式判定 判準表、選單範本 block、硬規則四點、「唯讀 fan-out」兩理由逐字（rules.md 指向這裡）；派工 prompt / Spawn prompt block 逐字；「完成後」引言縮一行**必含**：五個 subagent 全部只送 idle 訊號、原因是沒人告訴它們要送；§隊友專屬注意 表**整張留**（不縮列）；§跟 user 互動 縮半；P9i 守 `施工清單` 在、無 `→ 退 write-plan$`；Red Flags 13→5（必留「能平行就開 Agent Teams」「多視角 review 互辯」「判定完直接開隊友」） |
| 7 | incident-investigate | 非空 209 → ≤175（bytes ≤7,700） | （無外部引用） | **沒有「為什麼」引言**（六個 `>` 行是 report 範本 block 內的資料，不動）；四個 Step 的 report 範本 block 重疊：**只整塊刪 §產出檔結構（summary）那份重複範本**（Observe / Conclude 兩份 block 各有用途、守門禁合併，都留）；hypothesis-tester 派工 prompt block 逐字、「只看到這一條」句留；Step 說明散文縮；Red Flags 8→5 |
| 8 | frontend-test | 非空 152 → ≤125（bytes ≤7,650） | §載入時機 §測試矩陣 §branch-name fallback 鏈 | §載入時機 表整張留（P11 讀 `\| T2 + 前端檔改動` 行）；Dispatch `Agent:` yaml 與 hand-off yaml **兩個都原樣留**（不同物件，不合一）；§Result handling 8a-8d **整塊留**（含 AskUserQuestion）；Trace block 原樣；可砍：§流程 散文、§測試矩陣 說明、五段引言縮一行；Red Flags 12→5 |
| 9 | write-skill | 非空 177 → ≤140（bytes ≤6,100） | §新 skill 落地 checklist | §SKILL.md 結構 範本 block 逐字（範本內的 Red Flags 是 block 內容、不算本檔 Red Flags）；§Frontmatter 詳解 表整張留、說明縮；§Body 風格規則 清單留、範例 block 刪多的；本檔 Red Flags 8→5；P9h 守無 `T1 由 brainstorm 直接交棒` |
| 10 | security-checklist | 非空 225 → ≤175（bytes ≤6,500） | （無） | 12 主題 checklist 項目文字逐條留；FAIL / PASS 範例 block：**每主題留一組（一 ❌ 一 ✅ 或只 ✅）、多的整塊刪**；§載入 / 結束 縮；Trace 段改「不貼自身 trace，由呼叫 phase 帶」一行 |
| 11 | cmd-guard | 非空 127 → ≤105（bytes ≤4,000；散文只 24 行、其餘是凍結的 pattern 表與兩個模板，Eng 算硬下限 120 含空行） | （無） | §自查 pattern 表整張留；§AskUserQuestion 模板 block 逐字；§safer 替代建議 表整張留；Trace 一行式（跨流程版）；Red Flags 5 不動 |
| 12 | safety-guard | 非空 122 → ≤100（bytes ≤4,200） | （無） | §PII pattern / §Secret pattern 的 regex 反引號**一個不少**（守門守規則型片段）；§報告格式 block 留；五段引言縮一行；Trace 跨流程版；Red Flags 5 |
| 13 | lock-files | 非空 84 → ≤68（bytes ≤2,750） | （無） | §鎖檔 prompt 選單留；§寫入 pre-check 邏輯留、範例 block 刪多的；Trace 跨流程版 |
| 14 | context-snapshot | 非空 127 → ≤100（bytes ≤3,700） | （無） | **沒有「為什麼」引言**（六個 `>` 行是快照檔頭範本，不動）；§快照結構 block 逐字；§存哪些東西 / §存哪裡 / §commit snapshot 不？ 三段**各縮成 2-3 句 bullet**（不做成新表——守門禁新增表格行）；P9h 守無 `4 視角`；Trace 跨流程版 |
| 15 | context-resume | 非空 110 → ≤92（bytes ≤3,300；Eng 算無餘裕） | （無） | §印 progress 範本 block 留；§接續方向確認 選單留；§State 還原 步驟留、範例 block 刪多的；§跟 brainstorm 的差異 縮三行；Trace block 原樣 |
| 16 | db-access | 非空 67 → ≤58（bytes ≤2,500） | （無；rules.md §DB 操作 指向本檔） | 唯一 blockquote（phase 編號更正史）整段刪；讀 / 寫 / PII 三節規則逐條留；SQL 範例 block 只留 EXPLAIN 一個與 mask 一個（**block 內 `'2026-01-01'` 等日期是資料，不動**） |
| 17 | retro | 非空 134 → ≤115（bytes ≤4,900；報告範本 + hook 流程 + 指令 block 凍結） | （無） | §報告結構 範本 block 留；§Memory hook 流程 步驟留、說明縮；§資料蒐集細節 指令 block 留、說明縮；Red Flags 7→5 |
| 18 | debug-systematic | 非空 129 → ≤105（bytes ≤4,000） | （無） | 五 Step 的產出 / 判準留、說明縮；§commit 規範 → 「見 rules.md「Commit 訊息」」（rules.md 該標題**沒有 §**，寫 `§Commit` 會 grep 不到）+ 本 skill 特有一句（範例 block 整塊刪）；Red Flags 6→5 |
| 19 | devwork（主 agent） | 非空 29 → ≤26（bytes ≤2,100） | （無） | 「為什麼要有這一層」縮兩行；台詞、契約四步、顯式呼叫清單逐字 |

### Task 20–25: B — 6 個 agents（subagent 各一）

**parallel-group**: 3
**files**: 各自 `agents/<name>.md`

| Task | 檔 | 行 → 目標 | 白名單 § | 砍點 / 必留 |
|---|---|---|---|---|
| 20 | db-reviewer | 非空 113 → ≤92（bytes ≤3,800） | §檢查焦點 §回報格式 | §檢查焦點 每焦點留「查什麼 + 紅線」、範例句刪；結論範本 block 逐字；§使用 mysql MCP **三條規則逐條留**（agent 讀不到 rules.md），只刪四條「例：」 |
| 21 | frontend-e2e-runner | 非空 160 → ≤125（bytes ≤6,800） | §輸入契約 §嚴格 output 格式 §使用 tool 範圍 | §Session lifecycle 步驟留、理由縮；§判定標準 表整張留；output 格式 block 逐字；**PII 段內嵌規則逐條留**；Red Flags 8→5 |
| 22 | hypothesis-tester | 非空 102 → ≤85（bytes ≤4,900） | §輸入契約 §嚴格 output 格式 §使用 tool 範圍 §PII | output 格式 block 逐字；§三種 Verdict / §Confidence 標準 各縮句（**不合成新表**）；§Unexpected findings 的價值 縮一段；**§PII 內嵌規則逐條留**；Red Flags 6→5 |
| 23 | lang-reviewer | 非空 134 → ≤115（bytes ≤4,550） | §回報格式 | §語言檢查焦點 88 行是 `###` 分語言 + bullet（不是表）：**九個語言小節與每條 bullet 都留**，只縮 bullet 內說明句；§通用 review 框架 縮；結論範本 block 逐字；**PII 行留** |
| 24 | pr-explainer | 非空 107 → ≤100（bytes ≤3,700；75 行是兩個逐字留的格式 block，Eng 算硬下限 110 含空行） | §Tier 控詳盡度 §文件結構標準 §使用 tool 範圍 | §文件結構標準 範本 block 逐字（pr-explain 指向）；「風格」段縮；六段引言縮一行；Red Flags 7→5 |
| 25 | security-auditor | 非空 120 → ≤98（bytes ≤5,300） | §PII 安全底線 §回報格式 §使用 tool 範圍 | STRIDE / OWASP 兩表整張留、說明縮；**§Checklist 主題 14 條主題名逐條留**（可縮到主題名 + 括號 2-3 關鍵字；agent 讀不到 security-checklist），只刪「STRIDE 抓架構威脅 → checklist 抓實作 bug」類說明句、指向句可加不可取代；結論範本 block 逐字；Red Flags 7→5 |

### Task 26: C — rules.md（主 agent）

**parallel-group**: 4
**files**: modify `skills/devwork/rules.md`

- [ ] Step 1: 紅 = 非空行 `grep -c .` 145 > 110
- [ ] Step 3: 逐段（**所有表格逐字**；守門守 16 § 與表格行）：
  - L1-5 開頭 blockquote（含「找不到『§事實核實』這節先重讀本檔」）**不動**。
  - §白話優先：術語範例三個留一個 + 「同時給的用意」那句；「寫法」四點**各留一條 bullet**（四條是獨立規則）、每點只留粗體片語；「區分實測與推論」「底線」「不適用」各一行。約 9-10 行。
  - §事實核實：逐字留。
  - §Branch safety 豁免段**拆四句**：(1) 只管 `$CLAUDE_PROJECT_DIR` 底下；(2) repo 外 / 非 git / 解析失敗放行**（刻意如此，契約 P2d 守；非設計缺陷）**——這六個字是防下個貢獻者把豁免當 bug 修掉的護欄；(3) **明寫**「hook 隨 plugin 在啟用它的每個專案生效、不需要 `/devwork`」、關法 `/plugin disable bstack@bstack`；(4) 缺 node：官方說印 non-blocking 通知、Windows **實測**連通知都沒有，兩種說法下保護都不存在，靠 `node --version` 事前確認。刪日期與「官方 setup 文件」出處敘事。
  - §File-type 硬規則：表逐字；前導句縮。
  - §設計語言對齊：blockquote 留規則兩句 + 邊界一句 + **一行無日期的理由** `> 為什麼有此豁免：規則字面命中 .html、實質無設計決策，載 design-language 只得到一份用不上的摘要；不寫明則每次都由執行的 agent 自己推。`；五個 bullet 各縮一句、粗體關鍵詞留，**必留子句**（P11 對 rules.md 只比副檔名集合、不查這些）：「0b′ 必跑（含純後端 task）」「不命中就不載、命中照舊必載」「四項對齊檢查（元件狀態 / 斷點 / 表單 / dark mode）」「該區客觀上無此維度 → 標 N/A 並附依據」；「細則 → design-language」留。
  - §Docs 落檔：表逐字；bullet 11→6：目錄 + 檔名固定合一；**時機單獨一條、保留「雙保險」**；覆寫 + 檔名不放日期合一；merge 後搬檔 + 進 reference 門檻合一、**「這份寫的是規則還是做過一次的紀錄？規則才進」逐字留**；commit 與否一句；遷移一句。
  - §Tier 機制：表逐字；bullet 各縮半、關鍵句留（「本表是 lane 的唯一真相」「超過表列上限代表 Tier 判低了，回 0d 升 T3」「code review 先看副檔名再看 Tier」「不帶 `--fix`、finding 交 receive-review」「T2 主 agent 自檢、T3 派一個 subagent」「security 同樣先看副檔名再看 Tier」「state 沒這欄就當程式碼 diff 照跑」「T2 條件與 db-reviewer 條件不變」「lang-reviewer 不自動 spawn」「T3 review-plan 視角依改動面向」——P9a / P12 只查表格 cell，不查這些 bullet）；「精簡依據見 docs/archive/2026/ 的 t2-lane-slim 主題」留主句、**刪括號日期**。
  - §協作模式判定：三條判準逐字；四個 bullet 各縮一句、「唯讀 fan-out」那句**必含「不開隊友、也不問」+「review / 驗證 / 稽核類」類別詞 + 「獨立性本身就是產出價值」**（這條是實際的 gate）；末句指向改「→ dispatch-parallel §協作模式判定 / §隊友派工」（既有指錯，順手改）。
  - §Settings.json：縮，但**必留**「僅限 read-only」「寫入類一律 prompt」「不主動寫使用者層級 settings」三條規則 + 範本 URL + `Bash(cat/head/tail:*)` 有密鑰檔就拿掉。
  - 其餘段不動或只刪空行。
- [ ] Step 4: 非空行 ≤110、bytes ≤14,000（Eng 算可砍區要壓 −31%、零餘裕；到不了攤數字、不動表）；三契約 ALL PASS；守門 PASS；`grep -c "20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]" rules.md` = 0
- [ ] Step 5: commit `refactor: rules.md 壓縮敘事、表格與規則字樣不動`

### Task 27: 守門總比對 + 重產 references + 總量斷言 + 施工紀錄

**parallel-group**: 5
**files**: `docs/js/references-data.js`（重產）、spec.md（施工紀錄）

- [ ] Step 1: 紅 = `build-references.ps1 -Check` exit 1
- [ ] Step 3: 守門 check 全 PASS；`node measure.mjs --assert`（斷言值 = 各 task 目標加總：B 非空行 ≤2,674、B bytes ≤140,600；description ≤2,000 tok；rules.md 非空 ≤110 / ≤14,000 bytes）；follow-up 記入 spec：verify-done L72 指向 frontend-test 不存在的 §測試流程 / §測試報告（既有懸空、本輪範圍外）；重產 references；施工紀錄寫四段：(1) 前後對照表（每檔行 / bytes / tok）與目標達成度、未達項與理由；(2) **砍法對照**：六種砍法各一列 + 一個檔的例子；(3) **刪除的「為什麼」索引**：由 subagent 回報「刪掉的引言」彙整，列檔、原句一句、基線 `4de4e83 檔:行`；(4) 什麼沒砍：引 spec §零改變界線 一行。subagent 越界 / 重派紀錄。PR body 同步 (2)(3) 的標題與索引位置（歸檔後 PR body 是留在 GitHub 上唯一不搬的入口）。
- [ ] Step 4: `-Check` exit 0 && `node scripts/plugin-contract.mjs` ALL PASS && `--selftest` && `node docs/tools/docs-site-contract.mjs` ALL PASS（**用 `&&` 串**）
- [ ] Step 5: commit `chore: 重產 references-data.js、施工紀錄（前後對照 / 砍法對照 / 引言索引）`

---

## Self-review（v2）

1. spec coverage：目標 1 → Task 2；目標 2 → Task 3-25；目標 3 → Task 26；目標 4 → Task 1 + 27。
2. 守門與守則一致：守則 7（block 整塊刪 / yaml 行級 / 表格整張）= 守門規則；守則 6 規則型片段 = 守門 RULEISH；守則 2 agent bullet = 守門 bullets。
3. 並行：group 2（frontmatter）先 commit 再開 group 3（body），同檔不會兩處同時改。
4. 與 review 的對應：Eng C1 → PROTECTED design-direction；C2 → yaml 行級 + Risks 註明省幅小；M1 → 所有 block 逐塊比；M2 → 表格整張 / 規則型片段；M3 → 步驟動詞 + agent bullet；M4 → Trace 兩模板；M5 → Task 8 兩砍點刪除。DX 1/2 → 守則 8；DX 3/4 → 砍法 3 定義 + Task 7 / 14 / 16 改寫；DX 5/6/17 → Task 2；DX 7/10/13-16/18 → Task 26；DX 8/9 → Task 5 / 6；DX 11 → 回報格式；DX 12 → Task 27。
