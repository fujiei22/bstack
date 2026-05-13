---
name: dev-workflow
description: |
  自動化開發流程主入口（繁中）。觸發：寫 / 改 / 修 / 加 / 重構 / 實作 / 開發 /
  build / fix / refactor / implement / feature / bug / 加功能 / 修 bug / 改 module /
  寫 test / 加欄位 / 整理 / 補 / 新增 / 升級 / 換 / 翻 / 升 / 拔 / 整合 /
  patch / hotfix / 拆 / 套 / 串 / 對 / migrate / 整 / 翻新 / 換寫法 / 重做 / 重整。
  涵蓋：Phase 0 入口分流（Track / Tier）、9 階段順序、skill hand-off state、
  Trace 標籤、Auto-fix、Fail handling、Memory hook、跨流程 skill dispatch。
  **任何 code 改動類 prompt 一律先載此 skill；CLAUDE.md「強制守則」永遠優先。**
---

# dev-workflow

## 使用契約（強制）

**載入後立即動作**：

1. 確認 user prompt 屬「code 改動類」（寫 / 改 / 修 / 加 / 重構 / 實作 / build / fix）。**純問答 / 教學 / 規劃對談**不適用，直接答。
2. 進 **Phase 0 入口分流**（4 子步驟，下節展開）。
3. 依 Phase 0 產出的 Track + Tier，**逐 Phase** 推進。每 Phase 結尾貼 Trace 標籤。
4. 階段間以**結構化 state** hand-off（見 §Skill hand-off）。
5. 任何 user 決策點走 `AskUserQuestion`，**禁文字 token NLP 判斷**。

**CLAUDE.md 永遠優先**：本 skill 描述 routing；CLAUDE.md「強制守則」與其他規範若與本 skill 衝突，CLAUDE.md 勝。

---

## §Phase 0 入口分流

brainstorm skill 內建。Phase 0 結尾產出 `{Track, Tier, spec, codebase-impact}` 四元組，feed 進後續 Phase。

```
0a 對話釐清    ← paraphrase + 讀 memory（user 偏好 / 領域 / 過去決策）
   ↓
0b 看 codebase ← Read / Grep 影響檔；DB 關鍵詞 → 載 db-access
   ↓
0c Track 判定  ← Bug or Dev（AskUserQuestion 確認）
   ↓
0d Tier 判定   ← T0/T1/T2/T3（AskUserQuestion 確認）
   ↓
若 T0 → 直接實作（跳所有後續 Phase）
若 T1+ → 進階段 2 起跑
```

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
| 改 <3 個檔 / 單模組局部 / 小 helper | T1 |
| 改 3-10 檔 / 單模組 feature / 中型 refactor | T2 |
| >10 檔 / 跨模組 / 新建 module / DB schema / API 介面 / 架構決策 | T3 |

預判完務必 `AskUserQuestion` 確認（推薦選項 = AI 預判結果）。

---

## §Track × Tier × Phase 路徑

### Dev track 完整路徑（9 階段）

```
1. brainstorm（Phase 0 內建）
   ↓
2. write-plan ─→ docs/plans/<plan-name>.md（含並行性分析 parallel-group）
   ↓
   review-plan
     ├─ T2 = Eng-only 視角
     └─ T3 = CEO + Design + Eng + DX 4 視角
   ↓
3. execute-plan + tdd-cycle
   遇 parallel-group >1 task → 載 dispatch-parallel 派 subagent 平行
   ↓
4. verify-done
   ├─ T2+ = 多輪 verify（test + lint + build）
   └─ T3 + UI 改動 = 載 frontend-test（Playwright MCP 跑 e2e）
   ↓
5. request-review
   ├─ T1 = self review
   ├─ T2 = subagent + lang-reviewer（依改動副檔名 dispatch）
   └─ T3 = 雙視角 subagent（架構 × 除錯）+ lang-reviewer
   ↓
   receive-review（含 §Auto-fix）
   ↓
6. security-audit（OWASP + STRIDE）
   ├─ T2 = 涉認證 / 資料層 / API 邊界才用
   └─ T3 = 必用 + security-checklist + db-reviewer（DB 改動）
   ↓
7. finish-branch（含 git workflow 細則 + branch-safety）
   ↓
8. pr-explain → docs/reviews/<pr-id>.md（依檔分 section）
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
  memory_loaded: <bool>       # 0a 是否讀過 memory
  plan_path: docs/plans/<...>.md  # write-plan 完寫入
  parallel_groups: [...]      # write-plan 內 task 並行 grouping
  current_phase: <名稱>
  trace_chain: [phase1, phase2, ...]  # 歷經 phase
  fail_history: [...]         # 每次 fail 的 retry / rollback 記錄
```

每個 phase 結束時：
- `current_phase` 推進
- `trace_chain` append
- 自身產出寫進 state（如 plan_path / review_summary / verify_result）
- **下一 phase skill 載入時，宣告它讀進來的 state 欄位**

---

## §Trace 標籤

每輪 AI 回覆**結尾**貼一行：

```
[Trace] Phase=<phase-name> | Tier=<T0/T1/T2/T3> | Track=<Bug/Dev/—> | Skill=<active-skill>
```

範例：
```
[Trace] Phase=execute-plan | Tier=T2 | Track=Dev | Skill=execute-plan
[Trace] Phase=request-review | Tier=T3 | Track=Dev | Skill=request-review+lang-reviewer
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
   - **回上層 Phase 重規劃** — 回 brainstorm 或 write-plan
   - **escalate** — user 接手
4. user 選後執行；`state.fail_history` append 記錄

---

## §Memory hook 點

依 CLAUDE.md「§Memory hook」執行：

| Phase | 動作 |
|---|---|
| brainstorm 0a | **讀** memory：user 偏好 / 領域背景 / 過去關鍵決策 |
| retro | **補** memory：期間（user 選）git log + PR + TaskList 分析模式 → 產 proposal → user review → 寫入 |

其他 phase 不主動 hook。

---

## §跨流程 skill 觸發

非 Phase 序列、依條件觸發：

| Skill | 觸發 |
|---|---|
| `db-access` | prompt 含 DB 關鍵詞 / brainstorm 0b 偵測 DB / write-plan 涉 schema / execute-plan 動 DB / review 涉 SQL |
| `lock-files` | user 顯式要鎖某些檔（動 prod / 敏感模組）|
| `cmd-guard` | AI 將執行 rm -rf / drop / force push / sudo / dd 等危險指令 |
| `safety-guard` | 寫入 / commit 前掃 PII / 密鑰 / token 殘留 |
| `context-snapshot` | user 顯式存進度 / context 接近 auto-compact 閾值 |
| `context-resume` | 新 session 開始、user 顯式接續舊 task |
| `dispatch-parallel` | execute-plan 遇 parallel-group >1 task |
| `lang-reviewer` | request-review 階段、依改動副檔名動態 dispatch（python / typescript / sql / golang / ...）|
| `db-reviewer` | T3 + DB 改動，security 階段內 |
| `frontend-test` | verify-done 偵測前端檔改動（.tsx / .jsx / .vue / .svelte / .html / .css / .scss）；T3 UI 改動必載、T2 可選；user 顯式呼叫 e2e 也載 |
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

## §跟 CLAUDE.md 的關係

| 項目 | 落點 |
|---|---|
| 強制守則（Task / 決策點 / Branch / File-type / PII / DB / Settings） | CLAUDE.md（聖旨）|
| Track / Tier / Phase / Trace / Auto-fix / Fail / Memory hook **政策** | CLAUDE.md（聲明）|
| Track / Tier / Phase 詳細 **routing 表 + hand-off state + heuristic** | 本 skill |
| 各 phase 自身行為 | 對應 phase skill（brainstorm / write-plan / ...）|

衝突時：**CLAUDE.md > 本 skill > phase skill**。

---

## §載入此 skill 後第一句台詞

```
[已載入 dev-workflow]
Phase 0 入口分流啟動。先進 0a 對話釐清。
```

之後立刻進 brainstorm skill（內含 Phase 0 4 子步驟）。
