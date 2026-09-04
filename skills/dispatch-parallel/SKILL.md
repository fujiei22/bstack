---
name: dispatch-parallel
description: |
  平行派發（繁中）。載入：dev-workflow §跨流程 skill 載入 表所列時點（execute-plan 遇 parallel-group >1 task）。
  涵蓋：協作模式判定（Agent Teams vs subagent vs 串行）、spawn 多 subagent、
  隊友派工、傳 task prompt、收集結果、整合、處理 conflict、失敗 retry / rollback。
  上游：execute-plan（遇 parallel-group）。下游：execute-plan（整合完接下個 group）。
---

# dispatch-parallel

execute-plan 遇 `parallel-group` 同號多 task 時，把這些 task 平行跑、加速。

跑法有三種——**Agent Teams**（隊友互相通訊、共用任務清單）、**subagent 平行**（各做各的、只回報結果）、**單一 session 串行**。選哪種走 §協作模式判定，一律問 user。

## 使用契約（強制）

**載入後立即動作**：

1. **讀 hand-off state** 取當前 group 的 task 清單（task ID + 來源：plan Task N section（T3）／ spec `## 施工清單` 第 N 列（T2））。
2. **檢預設**：
   - group 內 task **真的無依賴**（T3 由 write-plan 標、T2 由 brainstorm 施工清單標；這裡是 T2 唯一一次驗）
   - 工作目錄 clean（無未 commit 改動）
3. **協作模式判定** → 走 §協作模式判定，`AskUserQuestion` 讓 user 選跑法。**禁自行決定**。
4. **依 user 選擇分流**：
   - Agent Teams → §隊友派工
   - subagent 平行 → §Spawn 細節
   - 單一 session 串行 → 退回 execute-plan 逐 task 跑，不用本 skill 後續流程
5. **等所有完成**：收集每個工作者的結果（diff + commit sha + verify 狀態）。
6. **整合**：主 agent 確認所有 commit 都進 branch、無 conflict、verify 都過。
7. **進下個 group**。

---

## §協作模式判定

### 判準

先確認**分水嶺**：判準不是「能不能平行」，是**工作者之間要不要互相講話**。三件事只有 Agent Teams 做得到——隊友互相反駁、user 中途切進單一工作者對話、工作者自己認領共用任務清單。三者皆不需要 → subagent 就夠，且便宜得多。

| 面向 | 選 Agent Teams | 選 subagent | 選串行 |
|---|---|---|---|
| 依賴 | ≥3 塊互不依賴 | 2+ 塊互不依賴 | 有先後順序 |
| 檔案歸屬 | 每塊擁有不同檔 / 目錄 | 同上 | 會撞同一批檔 |
| 產出性質 | 要討論、互相挑戰後收斂 | 只要結果 | — |
| 量體 | T2+ | T1+ | T0-T1 |
| 典型 | 多假設除錯互相打架、多視角審查、大範圍研究、跨前後端各自一塊、新模組各寫各的 | 各跑一個獨立 task 回報 | 單檔改、例行修 bug |

**規模**：3-5 個隊友起跳，每人 5-6 個 task。任務再多也別無限加隊友——三個專注的通常勝過五個散的。

### 開關偵測（判定前先跑）

Agent Teams 是實驗性功能、預設關閉。開關未設時 Claude **無法**開也無法提議開隊友。

1. 查環境變數 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`（settings.json 的 env 區塊會注入為環境變數；`scripts/extras.ps1` 的 env 項可一鍵設定）。
2. 未設 → 選單第一個選項改成「先開開關」，並附設定片段與「**需重開 session 才生效**、本輪先停」的說明。
3. **禁**在開關關閉時假裝開隊友、或靜默退成 subagent 不告知。

### 選單範本

```
AskUserQuestion:
  header: 跑法
  question: |
    這個 group 判定「可以開 Agent Teams」，依據：
    - 可切 <N> 塊互不依賴：<列每塊擁有的檔 / 目錄>
    - 需要互相講話的理由：<具體寫哪兩塊要對話；寫不出來就不該問這題>
    - 量體：<Tier>
    要用哪種跑法？
  options:
    - label: <推薦的那個>（推薦）
      description: <為何推薦——引上面判定實據>；代價：<token / 摩擦>
    - label: <次選>
      description: <好處>；缺點：<失去什麼>
    - label: <再次選>
      description: 同上
```

**硬規則**：

- 推薦哪個**依判定實據決定，不預設 Agent Teams**。第 2 條（要互相講話）只是勉強成立 → 推薦 subagent。
- 每個選項都要寫**代價**，不能只寫好處。Agent Teams 至少要寫這兩項：token 隨隊友數線性疊加（每個隊友是完整一份 Claude Code、各自載入全套 CLAUDE.md + skill）、隊友的權限確認全部彈回主視窗。
- 三條判準沒全中 → **不問這題**，直接照 §Spawn 細節走 subagent。多問一次選單也是成本。
- **唯讀 fan-out 不套這張判準表**：review / 驗證 / 稽核類——`review-plan` 多視角、`request-review` T3 對齊 subagent 與內建 code-review 的 finder、`incident-investigate` 多假設、`security-audit` + `db-reviewer`——一律 subagent，**連選單都不出**。兩個理由：
  - 判準 1「每塊擁有不同檔 / 目錄」的實質是防兩個隊友互蓋（見 §隊友專屬注意）。唯讀工作沒人在動檔，這條套不上；硬要讓它「通過」等於為它開例外。
  - 這類 fan-out 的**產出價值就是驗證者彼此不知道對方在驗什麼**。`incident-investigate` 的派工模板第一句是「你只看到這一條、不知道別的」，目的正是避免假設間交叉污染；`request-review` 要的也是不會自我合理化的獨立視角。開隊友讓他們互相講話，是把這個唯一紅利親手拆掉。

---

## §隊友派工

user 選 Agent Teams 後才走這節。

### 派工 prompt 範本

```
Context:
- repo: <repo root>
- branch: <branch name>
- 你負責的 task: <task ID + 摘要>
- 你擁有的檔 / 目錄: <明列；此範圍外的檔禁動>
- task 來源: <T3 貼 plan 全文；T2 貼 spec `## 施工清單` 全表>
- spec 全文: <貼 spec markdown>

你是這個團隊的隊友，**不是**接到新需求的主 agent：
- **禁**跑 dev-workflow 9 階段、禁 brainstorm、禁 write-plan。plan 已經寫好了。
- 直接依 tdd-cycle 走 5 step（紅 → 跑紅 → 綠 → 跑綠 → commit）。
- commit 用 rules.md §Commit 訊息 格式。
- 跑完自己 task 的 verify command。
- 有發現會影響別人負責範圍的事 → 直接訊息給該隊友，別默默改。

完成後：
- **用 `SendMessage` 把結論送回派工你的 agent**（主 session 通常是 `main`）。
  **你寫在回覆裡的東西不會自動傳給派工者——不送就等於沒交。**
- 送的內容要能單獨看懂：做了什麼、動了哪些檔、verify 結果、卡住的地方。
  派工者沒有你的對話歷史。

禁：
- 動你擁有範圍以外的檔（除非 plan 明列）
- 跑 push / open PR（lead 統一做）
- 自己再開隊友（隊友不能再開隊友；要幫手就開 subagent）
```

> **「完成後」這一段是 2026-09-03 補的，來自實測**：一輪 review 派了四個 subagent、
> 一次實跑派了一個，**五個全部在分析完成後只送 idle 訊號**，主 session 逐一
> `SendMessage` 去要才拿到結論。它們沒做錯——**沒有人告訴它們要送**，而
> 「工作做完了」跟「結論送到了」在 subagent 眼裡是同一件事。

### 隊友專屬注意

| 事項 | 處置 |
|---|---|
| 隊友會載入完整 CLAUDE.md 與全套 skill | 派工 prompt **必須**明講「不要跑 9 階段流程」，否則隊友會自己 brainstorm 起來 |
| 隊友不繼承 lead 的對話歷史 | spec / plan 全文要貼進派工 prompt，不能只給檔案路徑就算 |
| 權限確認彈回 lead 視窗 | 開工前先跟 user 講；常用操作可先進 `permissions.allow` 減少中斷 |
| 隊友沿用 lead 的權限模式與兩個 PreToolUse hook | branch-safety / file-type-guard 照常生效，不用另外處理 |
| 兩個隊友改同一檔會互相蓋掉 | 派工前檔案歸屬必須切乾淨；切不乾淨就不該選 Agent Teams |
| 隊友可能沒標完成就閒置、卡住後續 task | lead 要盯任務清單狀態，卡住就直接訊息該隊友 |
| 恢復對話不會還原隊友 | `/resume`、`/rewind` 後 lead 可能去找不存在的隊友；告訴 lead 重開 |

### 收工

隊友全部回報後，整合流程與 subagent 路線相同（見 §等所有完成 / §整合 / 衝突）。額外一步：確認每個隊友都已收工，用名字請 lead 送出關閉請求。

---

## §Spawn 細節

對每個非主 agent 跑的 task：

```
Agent tool call:
  description: "跑 Task <N>: <task name>"
  subagent_type: general-purpose
  prompt: |
    你是 dispatch-parallel 派發的 subagent。

    Context:
    - repo: <repo root>
    - branch: <branch name>
    - 你要跑的 task: <task ID + 摘要>
    - task 來源: <T3 貼 plan 全文；T2 貼 spec `## 施工清單` 全表>
    - spec 全文: <貼 spec markdown>
    - 你**只跑 task <N>**，其他 task 不動。

    流程：
    1. T3：Read plan 找 Task <N> section；T2：施工清單第 <N> 列，五步由 tdd-cycle 現場展開
    2. 依 tdd-cycle 走 5 step（紅 → 跑紅 → 綠 → 跑綠 → commit）
    3. commit 時用 rules.md §Commit 訊息 格式
    4. 跑該 task 的 verify command
    5. 回報下面 JSON：
       {
         "task_id": "<N>",
         "commit_sha": "<sha>",
         "files_changed": [...],
         "verify_result": "pass | fail",
         "verify_output_tail": "<最後 30 行>",
         "notes": "<重要觀察 / blocker>"
       }

    **禁**：
    - 動 task <N> 以外的檔（除非 plan 明列）
    - 跑 push / open PR（主 agent 統一做）
    - 互動 user（subagent 無 AskUserQuestion 通道；遇要 user 決定 → fail with 原因）
```

主 agent **自己**也跑一個 task（不浪費 idle）— 走 tdd-cycle 同樣 5 step。

---

## §等所有完成

主 agent 自己跑完後，等剩餘 subagent 都返回。

收集：
- N 個 task 的 commit sha 清單
- N 個 verify 結果
- 任何 blocker / fail report

---

## §整合 / 衝突

理論上 group 內 task 無依賴 → 無 conflict。但驗：

1. `git status` 看 working tree 是否 clean
2. `git log <pre-group-sha>..HEAD --pretty="%h %s"` 看是否 N 個 commit 都進 branch
3. 跑 group 範圍的 test 一次（subagent 跑的 verify 是各自的；整合測再跑保險）

衝突案例（理論上不該發生、但 fallback）：
- 兩 subagent 改到同一檔同行 → conflict → 走 finish-branch §Conflict 流程
- 兩 commit 互相破壞（A 加新 function、B 移該 function） → parallel 標錯（T3 在 plan、T2 在施工清單 group 欄） → 退 write-plan（T3）／ 交棒 brainstorm §補施工清單入口（T2）

---

## §Subagent fail 處置

任一 subagent 回 `verify_result: fail`：

1. 主 agent 印 subagent 回報的 `verify_output_tail`
2. 走 rules.md §Fail handling：
   - **retry**（重 spawn 同 subagent、prompt 加 「前次 fail 原因：<...>」）
   - **adjust + retry**（主 agent 提具體 plan task 改動、user 點頭再 retry）
   - **rollback**：`git reset --hard <pre-group-sha>` → 整 group 重來
   - **退 execute-plan** 改一般串行 spawn（不平行）
   - **退 write-plan**（T3）／ **交棒 brainstorm §補施工清單入口**（T2）改 group 標
3. 不靜默 retry

---

## §結果整合 + hand-off state

完成（含所有 fail handling 後）：

```yaml
state:
  parallel_groups_done: [..., <current-group-N>]
  group_commits:
    <group-N>: [<sha1>, <sha2>, ...]
  parallel_fail_history: [...]
  current_phase: execute-plan-continuing
```

控制權**還給 execute-plan**、推進下個 group。

---

## §跟 user 互動

dispatch-parallel 期間：

- 判定完先問跑法（§協作模式判定），user 沒選前不 spawn 任何東西
- spawn 前印 「group <N> 派 M task 平行跑（跑法：<user 選的>）」
- 走 Agent Teams 時另外告知：隊友列在輸入框下方的面板，上下鍵選、Enter 進去直接對話
- 等待期間每 30s 印 「子 task 進度：<N done / M total>」（不刷屏）
- 完成印 「group <N> 完成：M task / M commit」
- fail 印詳細 + 走 §Fail handling

**禁**：靜默跑、user 不知道在幹嘛。

---

## §結尾 Trace 標籤

```
[Trace] Phase=execute-plan | Tier=<T2/T3> | Track=Dev | Skill=execute-plan+dispatch-parallel
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「group 內看似獨立、直接平行」 | 仍要 pre-check（git status / 預設 verify） |
| 「subagent 自己 push / 開 PR」 | 禁；主 agent 統一 |
| 「subagent fail 重 spawn 多次自動」 | 禁靜默 retry；走 §Fail handling |
| 「conflict 自作主張 resolve」 | 走 finish-branch §Conflict 流程 |
| 「parallel 跑得快、跳 verify」 | 整合測必跑 |
| 「subagent prompt 不含完整 spec」 | 必含；subagent 無 context |
| 「能平行就開 Agent Teams」 | 判準是要不要互相講話；不用溝通 → subagent，便宜得多 |
| 「多視角 review 天生會打架、正好開隊友互辯」 | 唯讀 fan-out 一律 subagent、連選單都不出；獨立性就是產出價值，互相聽到彼此結論 = 污染 |
| 「判定完直接開隊友」 | 禁；一律 `AskUserQuestion` 讓 user 選跑法 |
| 「開關關著、悄悄退 subagent」 | 禁靜默降級；要講開關狀態與開啟方式 |
| 「隊友派工只給檔案路徑」 | 隊友不繼承對話歷史；spec / plan 全文必貼 |
| 「隊友自己再開隊友」 | 不支援；隊友只能開 subagent |
| 「選單只寫每個選項的好處」 | 必寫代價，尤其 Agent Teams 的 token 疊加與權限確認集中 |
