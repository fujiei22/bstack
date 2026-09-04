---
name: dev-workflow
description: |
  自動化開發流程主入口（繁中）。載入：由 `devwork` skill 載入（使用者輸入 /devwork）；
  **不因自然語言自動觸發**。涵蓋：Phase 0 入口分流（Track / Tier）、9 階段順序、
  skill hand-off state、Trace 標籤、Auto-fix、Fail handling、Memory hook、跨流程 skill dispatch。
  規則書 `devwork/rules.md` 永遠優先於本 skill。
---

# dev-workflow

## 使用契約（強制）

**載入後立即動作**：

1. user prompt 由 `devwork` 交進來（`/devwork` 後面的文字）；純問答已在 devwork 過濾，這裡收到的一律是改動類。
2. 進 **Phase 0 入口分流**（5 子步驟，下節展開）。
3. 依 Phase 0 產出的 Track + Tier，**逐 Phase** 推進。每 Phase 結尾貼 Trace 標籤。
4. 階段間以**結構化 state** hand-off（見 §Skill hand-off）。
5. 任何 user 決策點走 `AskUserQuestion`，**禁文字 token NLP 判斷**。

**rules.md 永遠優先**：本 skill 描述 routing；rules.md「強制守則」與其他規範若與本 skill 衝突，rules.md 勝。

---

## §Phase 0 入口分流

brainstorm skill 內建。Phase 0 結尾產出 `{Track, Tier, spec, codebase-impact, design}` 五元組，feed 進後續 Phase。

```
0a 對話釐清    ← paraphrase + 讀 memory（user 偏好 / 領域 / 過去決策）
   ↓
0b 看 codebase ← Read / Grep 影響檔；DB 關鍵詞 → 載 db-access
   ↓
0b′ UI 面判定  ← 載 design-language；產出 design.* 六欄
   ↓
0c Track 判定  ← Bug or Dev
   ↓
0d Tier 判定   ← T0/T1/T2/T3
   ↓
三者一次 AskUserQuestion 確認（Track / Tier / UI 判定）
   ↓
若 T0 → 直接實作（跳所有後續 Phase）
若 T1 / T2 → 進階段 3（execute-plan；T2 的 task 來源 = spec §施工清單）
若 T3 → 進階段 2（write-plan）
```

**0b′ 與 0c/0d 的關係**：`design.size` 與 `Tier` 是**獨立的兩根尺**，禁止互推（細則見 `design-language` §兩根尺）。三者合併在同一個 `AskUserQuestion` 確認，讓錯位當場可見。

**Track 判定 heuristic**：
| 觸發詞 | 預判 Track |
|---|---|
| 修 / fix / bug / 壞了 / 不對 / 異常 / 失敗 / 沒反應 / report | Bug |
| 加 / 改 / 寫 / 實作 / build / feature / refactor / 重構 / 整合 / 升級 | Dev |
| 模糊 / 兩者皆可 | Dev（保守、走完整流程） |

**Tier 判定 heuristic**：
| 量體訊號 | 預判 Tier |
|---|---|
| 改 1 行 / 純設定值 / typo | T0 |
| 改 ≤2 個檔 / 單模組局部 / 小 helper | T1 |
| 改 3-10 檔 / 單模組 feature / 中型 refactor | T2 |
| >10 檔 / 跨模組 / 新建 module / DB schema / API 介面 / 架構決策 | T3 |

**Tier 自動升級（覆蓋上表的預判）**：改動命中 rules.md §File-type 硬規則的
DB migration / CI/CD / 鎖檔 / Infra 類 → **自動升至少 T2**，不論量體多小。
理由：這幾類的爆炸半徑與行數無關。細則見 `brainstorm` §Phase 0d。

**0b′／0c／0d 三者合併成一個 `AskUserQuestion` 一次確認**（推薦選項 = AI 預判結果）。

---

## §Track × Tier × Phase 路徑

### Dev track 完整路徑（9 階段）

```
1. brainstorm（Phase 0 內建，含 0b′ UI 面判定；0b 同時判 T3 review 視角 → state.review_perspectives）
   ↓
   design.size=大改 ＋ 路徑選「出三版」→ branch 建立、spec 落檔後載 design-direction 出三版
                                          → user 選定 → 回寫 spec.md
                                            → T3：write-plan 依方向拆 task
                                            → T2：brainstorm 3.5 依方向回寫 §施工清單、再確認一次 → execute-plan
   design.size=大改 ＋ 路徑選「跳過三方向」→ 理由記入 spec.md → 同上依 Tier 分流
   design.size=小改 → execute-plan 動前端檔的 task 前後載 design-language 跑對齊檢查
   ↓
   T1 / T2 → 3. execute-plan（plan_path null；T2 的 task 來源 = spec §施工清單）
   T3 → 2. write-plan ─→ docs/work/<branch-name>/plan.md（含並行性分析 parallel-group）
        ↓
        review-plan（視角依 state.review_perspectives：Eng 下限 / DX / Design）
   ↓
3. execute-plan + tdd-cycle
   遇 parallel-group >1 task → 載 dispatch-parallel 判跑法（Agent Teams / subagent / 串行）後平行
   └─ 計畫外的前端檔 → execute-plan §前端檔處理：暫停 → 補判 → 回寫 state.design ＋ design_rejudge → 接回
   ↓
4. verify-done
   ├─ T2+ = 多輪 verify（test + lint + build）
   └─ T3 + UI 改動 = 載 frontend-test（Playwright MCP 跑 e2e）；diff 只動文字節點 / data-* → 不派 runner、主 agent smoke（verify-done §UI / browser e2e 用 text-only-diff.mjs 判）
   └─ 全 tier：實際改動檔含前端副檔名且未被 design_rejudge 處理過 → verify-done §漏網複查
   ↓
5. request-review（先依副檔名分流：純文件 diff 跳 code-review；T2 只做 spec 自檢、T3 對齊 subagent 照派）
   ├─ T1 = self review
   ├─ T2 = 內建 code-review medium（不帶 --fix）+ 主 agent 對 spec 自檢
   └─ T3 = 內建 code-review high + 1 個 spec / 架構對齊 subagent（prompt 附語言提示）
   ↓
   receive-review（含 §Auto-fix）
   ↓
6. security-audit（OWASP + STRIDE）
   ├─ T2 = 涉認證 / 資料層 / API 邊界才用
   └─ T3 = 必用 + security-checklist + db-reviewer（DB 改動）
   ↓
7. finish-branch（含 git workflow 細則 + branch-safety）
   ↓
8. pr-explain（T3；T0-T2 跳）→ docs/work/<branch-name>/pr-review.md（依檔分 section）
   ↓
9. retro（手動觸發、不綁 tier；任意期間；Memory hook 補）
```

### Bug track 完整路徑

```
1. brainstorm（Phase 0 內建；0b 額外收集症狀 / log / 重現步驟）
   ↓
3'. debug-systematic
   ├─ T1 = 單 debug-systematic（Triage→Reproduce→Min Repro→Fix→Test）
   └─ T2+ = + incident-investigate（Observe→Hypothesize→Test→Conclude；自動產 incident report）
   ↓
4. verify-done（含回歸測試）
   ↓
5-8 同 Dev track
   ↓
9. retro
```

**Bug track 不跑 write-plan / review-plan**：fix 內容由 debug-systematic 直接導出。

---

## §Skill hand-off state

階段間以結構化 state 傳遞。每個 skill 收到此 state、寫回擴充欄位給下個 skill。

```yaml
state:
  task_id: <slug>             # brainstorm 0d 完成後 user 給的 task 識別
  track: <Bug|Dev>            # 0c
  tier: <T0|T1|T2|T3>         # 0d
  spec: <短文>                # 0a/0b 整合
  codebase_impact:            # 0b
    files: [...]
    modules: [...]
    db_involved: <bool>
  design:                     # 0b′；欄位語意見 design-language §對外契約
    involved: <bool>
    scope: <區塊名|null>
    scope_evidence: <token 來源檔路徑|null>
    size: <小改|大改|null>
    precedent: <bool>
    map_status: <ok|remapped|absent|unknown|pending>
    direction_decided: <定案方向文字|null>   # size=大改 且走過三方向才有
    user_choice_quote: <user 選擇原話|null>  # 同上
  memory_loaded: <bool>       # 0a 是否讀過 memory
  plan_path: <docs/work/<branch-name>/plan.md | null>  # T3 write-plan 完寫入；T1 / T2 為 null
  parallel_groups: [...]      # T3 來自 plan、T2 來自 spec 施工清單 group 欄
  review_perspectives: [...]  # T3；brainstorm 0b 依改動面向判（Eng 下限 / DX / Design）
  design_rejudge: [...]       # 施工開始後對 design.* 的重判（execute-plan 中途轉進／verify-done 漏網複查共用）
  current_phase: <名稱>
  trace_chain: [phase1, phase2, ...]  # 歷經 phase
  fail_history: [...]         # 每次 fail 的 retry / rollback 記錄
```

每個 phase 結束時：
- `current_phase` 推進
- `trace_chain` append
- 自身產出寫進 state（如 plan_path / review_summary / verify_result）
- **下一 phase skill 載入時，宣告它讀進來的 state 欄位**
- **下一 phase skill 載入時，若 context 內找不到 rules.md 的「§事實核實」標題 → 先重 Read `devwork/rules.md`**（經 `/devwork` 讀進來的規則書是普通 tool result，長 session 會被摘要洗掉；在 bstack repo 內因 CLAUDE.md @import 常駐則不必）

---

## §Trace 標籤

每輪 AI 回覆**結尾**貼一行：

```
[Trace] Phase=<phase-name> | Tier=<T0/T1/T2/T3> | Track=<Bug/Dev/—> | Skill=<active-skill>
```

範例：
```
[Trace] Phase=execute-plan | Tier=T2 | Track=Dev | Skill=execute-plan
[Trace] Phase=request-review | Tier=T3 | Track=Dev | Skill=request-review
```

**省略時機**：
- T0 task 全程不貼
- 對話為純問答 / 規劃對談、無 phase 推進

---

## §Auto-fix 原則

Review / 安全稽核 / verify 發現問題後：

| 類別 | 範例 | 處置 |
|---|---|---|
| **不危險類** | typo、lint、import 順序、變數名、格式、註解、純 refactor | AI **自動修** + 把 diff 貼給 user |
| **危險類** | DB schema、認證邏輯、payment、檔案刪除、dependency 改動、infra、migration | `AskUserQuestion` 問 user 該不該修、怎麼修 |

**T3 加碼**：即使「不危險類」也應該優先 diff 展示給 user 確認再 commit（不強制 prompt、但要顯式）。

---

## §Fail handling

Task fail / verify fail / review 嚴重打槍時：

1. **不靜默重試**
2. **評起因**：實作錯 / plan 錯 / test 設定錯 / 架構假設錯 / 需求理解錯
3. `AskUserQuestion` 提選項：
   - **retry** — 同樣作法再跑（適暫態 / 偶發）
   - **adjust + retry** — AI 提具體調整方案、user 點頭後跑
   - **rollback** — `git reset` 前一個 commit / clean working tree、從頭來
   - **回上層 Phase 重規劃** — T3 回 write-plan；T2 交棒 brainstorm §補施工清單入口（不重跑 Phase 0）；需求理解就錯才回 brainstorm 0a
   - **escalate** — user 接手
4. user 選後執行；`state.fail_history` append 記錄

---

## §Memory hook 點

Phase-bound memory 互動點（rules.md 開發流程 intro 內聲明）：

| Phase | 動作 |
|---|---|
| brainstorm 0a | **讀** memory：user 偏好 / 領域背景 / 過去關鍵決策 |
| retro | **補** memory：期間（user 選）git log + PR + TaskList 分析模式 → 產 proposal → user review → 寫入 |

其他 phase 不主動 hook。

---

## §跨流程 skill 載入

非 Phase 序列、依條件觸發：

| Skill | 觸發 |
|---|---|
| `db-access` | **固定載入點**：brainstorm 0b 偵測到 DB 關鍵詞。其餘（write-plan 涉 schema、execute-plan 動 DB、review 涉 SQL）是**規則適用範圍**，那些 skill 本身沒有載入它的步驟 |
| `design-language` | brainstorm 0b′（**必跑**，含純後端 task）／ `design.involved=true` 且 `size=小改` 時，execute-plan **動到前端檔的 task 前後**／ execute-plan §前端檔處理 的中途轉進補判／ verify-done §漏網複查 的補判／ user 顯式問設計語言 |
| `design-direction` | brainstorm 0c/0d 合併確認第 3 題選「出三版」，且 **branch 已建立、`spec.md` 已落檔**／ user 顯式要求出方向、評審設計。**選「跳過三方向」不載入** |
| `lock-files` | user 顯式要鎖某些檔（動 prod / 敏感模組）|
| `cmd-guard` | AI 將執行 rm -rf / drop / force push / sudo / dd 等危險指令 |
| `safety-guard` | 寫入 / commit 前掃 PII / 密鑰 / token 殘留 |
| `context-snapshot` | user 顯式存進度 / context 接近 auto-compact 閾值 |
| `context-resume` | 新 session 開始、user 顯式接續舊 task |
| `dispatch-parallel` | execute-plan 遇 parallel-group >1 task |
| `lang-reviewer` | user 顯式要求時由主 agent spawn；request-review 不自動派，語言提示寫進 T3 對齊 subagent 的 prompt（T2 交內建 code-review，沒有自寫 prompt） |
| `db-reviewer` | T3 + DB 改動，security 階段內 |
| `frontend-test` | verify-done 偵測前端檔改動（.tsx / .jsx / .vue / .svelte / .html / .css / .scss）；T3 UI 改動必載、T2 可選；user 顯式呼叫 e2e 也載。**豁免**：diff 只動文字節點 / `data-*`（verify-done §UI / browser e2e 用 `scripts/text-only-diff.mjs` 判 TEXT-ONLY）→ 不載、主 agent smoke |
| `write-skill` | user 要加 / 改 / 評 skill 本身 |

---

## §Red Flags（內部 rationalization 防火線）

收到 prompt 時這些念頭出現 = 停下、回到本流程：

| 想法 | 真相 |
|---|---|
| 「這是 trivial 不用走流程」 | T0 由 0d 判定，不是你跳 |
| 「先看 codebase 比較快」 | 看 codebase 是 0b、不是 Phase 0 之前 |
| 「我先想一下」 | brainstorm 0a 就是「想」、要結構化 |
| 「直接寫 plan / code」 | 跳 Phase 0 = 沒 Track / Tier 依據 |
| 「不問 user 直接決定 tier」 | tier 必經 AskUserQuestion |
| 「fail 多 retry 一次就好」 | 不靜默重試（見 §Fail handling）|
| 「risky 改動我評估安全」 | Auto-fix 危險類**必須**問 user |
| 「Trace 標籤跳一兩次沒差」 | 每輪都貼（T0 除外）|
| 「memory 太雜不讀」 | brainstorm 0a 必讀 |
| 「skill 之間自由跳」 | 嚴格按 Phase 序、hand-off 用 state |

---

## §跟 rules.md 的關係

| 項目 | 落點 |
|---|---|
| 強制守則（Task / 決策點 / Branch / File-type / PII / DB / Settings） | rules.md（聖旨）|
| Track / Tier / Phase / Trace / Auto-fix / Fail / Memory hook **政策** | rules.md（聲明）|
| Track / Tier / Phase 詳細 **routing 表 + hand-off state + heuristic** | 本 skill |
| 各 phase 自身行為 | 對應 phase skill（brainstorm / write-plan / ...）|

衝突時：**rules.md > 本 skill > phase skill**。

---

## §載入此 skill 後第一句台詞

**由 devwork 載入時不印橫幅**（devwork 已印 `[bstack devwork · plugin] …`，第二條橫幅只會讓使用者以為載到舊副本）。
被單獨呼叫（沒經過 devwork）時才印：

```
[bstack dev-workflow · plugin] Phase 0 入口分流啟動。先進 0a 對話釐清。
```

之後立刻進 brainstorm skill（內含 Phase 0 5 子步驟）。
