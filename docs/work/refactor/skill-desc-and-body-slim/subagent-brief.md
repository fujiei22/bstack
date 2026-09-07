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

