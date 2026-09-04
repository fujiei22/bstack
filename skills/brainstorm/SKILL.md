---
name: brainstorm
description: |
  需求釐清 + Phase 0 入口分流（繁中）。載入：dev-workflow 使用契約第 2 步；
  不因自然語言自動觸發。涵蓋：0a 對話釐清（+ 讀 memory）、0b 看 codebase、
  0b′ UI 面判定、0c Track 判定（Bug/Dev）、0d Tier 判定（T0-T3）、
  spec 落檔 docs/work/&lt;branch-name&gt;/spec.md。終態 → 交棒 write-plan（Dev）或 debug-systematic（Bug）。
---

# brainstorm

把模糊 idea 變成可實作的 spec，同時完成入口分流（Track + Tier）。

## 使用契約（強制）

**載入後立即動作**：

1. 進 Phase 0 五子步驟（0a → 0b → 0b′ → 0c → 0d），不跳過。
2. 0b′／0c／0d 的判定**合併成一個 `AskUserQuestion` 一次確認**（見 §Phase 0c/0d 合併確認）；**禁文字 token NLP 判斷**。
3. 完成後 spec 落檔 `docs/work/<branch-name>/spec.md`、commit。
3.5 **`design.size=大改` 且第 3 題選了「出三版」** → 此時 branch 已建立、spec 已落檔，**載入 `design-direction`** 走三方向流程；選定後**回寫本檔的「設計方向」段落**（`direction_decided` / `user_choice_quote` / 資產清單），再進第 4 步交棒。
   第 3 題選了「跳過三方向」→ 不載入 `design-direction`，把**理由**寫進「設計方向」段落，直接進第 4 步。
4. T0 → user 點頭後直接交實作；T1+ → 交棒 write-plan（Dev）或 debug-systematic（Bug）。

**硬規定**：任何實作動作（寫 code / 改檔 / 跑 build / 安裝套件）一律等 spec 與 tier 敲完。**包括 trivial 看起來「一行就好」的 task** — 由 Tier 判定，不是你決定。

---

## §Phase 0a — 對話釐清

**目的**：把 user 模糊敘述 → 可被你 reasoning 的明確需求。

動作：

1. **讀 memory**（必）：載入 `~/.claude/projects/.../memory/MEMORY.md`，吸收 user 偏好 / 領域背景 / 過去關鍵決策。**沒讀過不能進 0b**。
2. **Paraphrase**：用自己的話複述 user 想做的事（一兩句話）。
3. **如複述不準 / 有歧義** → 反問**一次一題**，preferring 多選（`AskUserQuestion`），open-ended 也可。
4. **抓 success criteria**：「做完什麼樣算對？」沒這條 0d 判 tier 會偏。

**反 pattern**：
- 一次問 5 個問題 → user 累、答不準
- 跳過 paraphrase 直接看 code → 容易解錯題
- 看 prompt 一眼就判 tier → 太早

---

## §Phase 0b — 看 codebase

**目的**：估改動範圍、發現潛在連動。

動作：

1. `Glob` / `Grep` 列出可能改動的檔（檔名 + 模組 + 大概行數）。
2. **若 prompt / 0a 敘述含 DB 關鍵詞**（DB / SQL / mysql / schema / table / 表 / 欄位 / migration / SELECT / INSERT / UPDATE / DELETE / DDL）→ **載入 `db-access` skill**、依其指示查 schema。
3. 注意點：
   - 既有 pattern / 命名慣例 → 後續實作對齊
   - 既有 lint / test / build script → 提前知道後續 verify 要跑什麼
   - 既有問題（巨型檔 / 模糊邊界）若**直接影響本 task**，列入 spec；無關 refactor 不主動納入
4. **Track 預判為 Bug 時額外收集**：症狀原文、錯誤訊息 / stack trace、重現步驟、
   最近一次正常的時間點或 commit。寫進 `state.bug_context`，交給 `debug-systematic`
   的 Triage 用——不在這裡收，Triage 第一步就得回頭再問使用者一次。
5. 不需要 100% 看完，估到能評 tier 即可。

---

---

## §Phase 0b′ — UI 面判定

**目的**：判斷本次改動有沒有碰前端、屬於哪一套設計語言、是小改還是大改。

**必跑**——包含看起來純後端的 task。成本極低：`design-language` 的第 1 步是零成本的副檔名比對，不命中就立刻回傳結束，不會去讀地圖也不會做偵測。

動作：

1. **載入 `design-language` skill**，把 0b 得到的 `codebase_impact.files` 交給它。
2. 取回六個欄位（`involved` / `scope` / `scope_evidence` / `size` / `precedent` / `map_status`），寫進 hand-off state 的 `design:` 區塊。
3. **`involved=false` → 到此為止**，繼續 0c。
4. **`involved=true`** → 判定結果進 §Phase 0c/0d 合併確認 的第 3 題一起問。

**本階段不寫任何檔（硬規則）**。Phase 0 執行時仍在 `main`，`hooks/branch-safety.ps1` 會 `exit 2` 擋掉 repo 內的寫入。`design-map.md` 的落檔延到 **branch 建立後**。判定結果只進 hand-off state 與 `spec.md` 的「設計方向」段落。

**禁止用 Tier 推導 `size`**。0d 還沒判，這裡也不准先看量體猜。細則見 `design-language` §兩根尺。

**判不出來時**：`map_status: absent`（專案尚無設計語言）照樣繼續、`precedent=false`，不要卡住流程。

**本階段只判不做**。`size=大改` 的三方向流程在 **branch 建立且 spec 落檔之後**才跑（見 §spec 文件結構與落檔），**不得在 Phase 0 期間載入 `design-direction`**——它要寫 `docs/work/<branch-name>/` 底下的檔，而 Phase 0 仍在 `main`，`hooks/branch-safety.ps1` 會 `exit 2` 擋掉。

## §Phase 0c — Track 判定

**Bug** or **Dev**。Heuristic：

| user prompt 關鍵詞 | 預判 |
|---|---|
| 修 / fix / bug / 壞了 / 不對 / 異常 / 失敗 / 沒反應 / report / 報錯 / 跑不起來 | Bug |
| 加 / 改 / 寫 / 實作 / build / feature / refactor / 重構 / 整合 / 升級 / 換 | Dev |
| 兼有 / 模糊 | Dev（保守、走完整流程；若中途發現純 bug 再 fallback） |

判定結果留給 §Phase 0c/0d 合併確認 一次問，**本節不單獨發問**。

---

## §Phase 0d — Tier 判定

T0 / T1 / T2 / T3。Heuristic：

| 量體訊號 | Tier |
|---|---|
| 1 行 / 純設定值 / typo / 註解 | T0 |
| ≤2 個檔 / 單模組局部 / 小 helper / 簡單 bug fix | T1 |
| 3-10 個檔 / 單模組 feature / 中型 refactor / 多步 bug fix | T2 |
| >10 個檔 / 跨模組 / 新建 module / DB schema 改動 / API 介面 / 架構決策 / 含 migration | T3 |

判定結果留給 §Phase 0c/0d 合併確認 一次問，**本節不單獨發問**。

**Tier 升降 trigger**：File-type 硬規則（見 rules.md）命中 DB migration / CI/CD / lock / infra 等 → 自動升至少 T2。

---

---

## §Phase 0c/0d 合併確認

0b′ / 0c / 0d 判完後，**用一個 `AskUserQuestion` 一次確認**，不要問三次。

| 情境 | 問幾題 |
|---|---|
| `design.involved=false` | 2 題：Track、Tier |
| `design.involved=true` | 3 題：Track、Tier、UI 判定 |

**第 3 題（UI 判定）的選項**，題目描述必須同時顯示 `scope` / `scope_evidence` / `map_status` 三項，讓 user 看得到判斷依據。

**`size=小改` 時維持 3 個選項**：

1. `<區塊名>` ＋ 小改，正確（推薦）
2. 區塊判錯，我來指認
3. `size` 判錯

**`size=大改` 時第 3 題 4 個選項**（設計路徑攤平進來，仍是同一次呼叫、仍是 3 題）：

1. `<區塊名>` ＋ 大改，**判定正確，出三版**（推薦）
2. `<區塊名>` ＋ 大改，**判定正確，跳過三方向、直接做一版**——**理由記入 `spec.md`**
3. 區塊判錯，我來指認
4. `size` 判錯

> **為什麼攤平而不是加第 4 題**：`AskUserQuestion` 的 `options` 是平行陣列、沒有巢狀，多題也同時呈現，做不到「選了選項 1 之後再追問」。攤平之後路徑選擇仍然**是一個可機械讀取的選項**，滿足 rules.md §決策點選單「**禁文字 token NLP**」；而且維持 §使用契約 第 2 步「合併成一個 `AskUserQuestion` 一次確認」的不變式。
>
> **為什麼只有兩條路徑**：`design-direction` 目前沒有非三版的執行路徑（它的產出自檢硬性要求 `design-demos/` 下有 3 個 `.html`）。選項 2 **根本不載入 `design-direction`**，所以不需要它支援。介於兩者之間的折衷版數因此暫時不提供——要開放得先給 `design-direction` 一條非三版的執行路徑。
>
> **前移的代價**（明寫，不假裝是純賺）：在這裡問設計路徑時，user 還沒看到設計語言摘要、也還沒定輸出尺寸，判斷依據比在 `design-direction` §使用契約 第 2 步問時**少**。換到的是「不必先燒三個 subagent 才問要不要三版」。
>
> **只前移「設計路徑」這一項**。`design-direction` §使用契約 第 2 步的四項對齊（受眾 / 核心訊息 / **輸出尺寸** / 內容來源）**留在 design-direction**——那四項在 Phase 0 根本問不出來。

**`size=小改` 不問設計路徑**：小改沒有新視覺決策，問了是雜訊。

把三者並列在同一個選單，用意是讓 `Tier` 與 `design.size` 的錯位當場可見——「T1 ＋ 大改」（改一個站的整體視覺）或「T3 ＋ 小改」（10 個元件加同一個 loading state）都是合法組合。

## §spec 文件結構與落檔

**順序（硬規則）**：合併確認 → `git checkout -b <branch>` → 寫 `spec.md` → **（`size=大改` 且選了出三版時）載入 `design-direction`** → 回寫「設計方向」段落 → 交棒。三方向的產出全落在 `docs/work/<branch-name>/design-demos/`，**branch 不存在就跑不了**。

**T0** 不寫 spec。其餘按下面結構寫至 `docs/work/<branch-name>/spec.md`：

```markdown
# <task 短標題>

> Track: <Bug/Dev> | Tier: <T0-T3> | 建立: <YYYY-MM-DD>

## 動機 / Why

<為何要做、user 在意什麼>

## 目標 / Success criteria

- <可驗證的 outcome>
- ...

## 範圍 / Scope

**包含**：
- ...

**排除**（明寫避免 scope creep）：
- ...

## 影響檔案 / Codebase impact

| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| ... | new/edit/delete | ... |

## 設計方向（`design.involved=true` 時必填）

- 區塊（`scope`）：　依據（`scope_evidence`）：
- 地圖狀態（`map_status`）：
- `size`：小改 / 大改
- 設計語言摘要：<六類值的重點；N/A 的類別要寫依據>
- **以下 `size=大改` 走過三方向時才填**（小改留空並註明「小改，未走三方向」）：
  - `direction_decided`：<定案方向的文字描述>
  - `user_choice_quote`：<user 選擇原話>
  - 資產清單：<若設計裡出現具名第三方品牌，依 `design-direction` `references/brand-asset-protocol.md` §Step 5 把資產與**來源網址**列在這裡>
  > **跳過三方向時，這裡改記「跳過的理由」**（第 3 題選項 2 的 user 原話），三個欄位留空。
  > 三方向的 HTML 與截圖落在 `docs/work/<branch-name>/design-demos/`（不進版控、驗完即刪），**不得以截圖路徑作為事後追溯依據**——能留下的只有上面這幾項文字。

## DB 影響（如有）

- schema 改動：...
- migration：...
- mask 規則：...

## 風險與 trade-off

- ...

## 待釐清（如有）

- ...
```

**T1** spec 可短至 30 行；**T2+** 內容完整、所有 section 都要寫。

寫完跑「self-review」：
1. 找 TBD / TODO / placeholder → 補
2. section 互相矛盾 → 改
3. ambiguous 要求 → 收斂、選一個
4. scope 太大 → 提示 user 拆 sub-task

self-review 完 → user 看 spec。**走 `AskUserQuestion`，不要用自由文字問**——
rules.md §決策點選單 禁止拿文字回覆當 gate 信號，這裡是決策點：

```
問：spec 已寫至 docs/work/<branch-name>/spec.md，請看一下。
選項：
  1. spec 正確，進 <write-plan|debug-systematic>（推薦）
  2. 我要改 spec（告訴我改哪裡）
  3. 退回 0a 重新釐清需求
```

---

## §交棒（hand-off state）

寫進 dev-workflow state：

```yaml
state:
  task_id: <topic-slug>
  track: <Bug|Dev>
  tier: <T0|T1|T2|T3>
  spec_path: docs/work/<branch-name>/spec.md
  codebase_impact:
    files: [...]
    modules: [...]
    db_involved: <bool>
  bug_context:                # 0b 第 4 點；只在 Track=Bug 時有值，給 debug-systematic Triage 用
    symptom: <症狀原文|null>
    error: <錯誤訊息 / stack trace|null>
    repro_steps: [...]
    last_known_good: <時間點或 commit|null>
  design:                     # 0b′；欄位語意見 design-language §對外契約
    involved: <bool>
    scope: <區塊名|null>
    scope_evidence: <token 來源檔路徑|null>
    size: <小改|大改|null>
    precedent: <bool>
    map_status: <ok|remapped|absent|unknown|pending>
    direction_decided: <定案方向文字|null>   # size=大改 且走過三方向才有
    user_choice_quote: <user 選擇原話|null>  # 同上
  memory_loaded: true
  current_phase: brainstorm-done
```

**下一 phase**：
- T0 → 直接實作（不交 skill）
- T1+ Dev → `write-plan`
- T1+ Bug → `debug-systematic`

---

## §結尾 Trace 標籤

```
[Trace] Phase=brainstorm | Tier=<T0-T3> | Track=<Bug/Dev> | Skill=brainstorm
```

T0 task 不貼。

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「user 看起來知道要做什麼，跳 0a」 | 0a 就是要把「知道」結構化 |
| 「memory 太雜不用讀」 | 必讀；user 偏好若漏會走錯路 |
| 「typo fix 跳 Phase 0 直接做」 | T0 由 0d 判，不是你 |
| 「我猜 tier 算了不問」 | tier 必經 `AskUserQuestion` |
| 「spec 短到不用落檔」 | T1+ 都要落 docs/work/ |
| 「設計這麼簡單還要 spec」 | spec 短也要、user approval 不可省 |
| 「純後端 task，0b′ 跳過」 | 0b′ 必跑；第 1 步是零成本副檔名比對，不命中就結束 |
| 「T1 這麼小，不用問 UI 判定」 | 禁止用 Tier 推導 size；兩根尺各自判 |
