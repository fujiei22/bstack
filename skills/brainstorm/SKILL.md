---
name: brainstorm
description: |
  需求釐清 + Phase 0 入口分流（繁中）。觸發：寫 / 改 / 修 / 加 / 重構 / 實作 /
  開發 / 想做 / 規劃 / build / feature / fix / refactor / 改造 / 拆 / 整合 /
  spec / 釐清 / brainstorm / 想想 / 怎麼做 / 怎麼設計 / 探索 / proposal。
  涵蓋：0a 對話釐清（+ 讀 memory）、0b 看 codebase、0c Track 判定（Bug/Dev）、
  0d Tier 判定（T0-T3）、spec 落檔 docs/work/&lt;branch-name&gt;/spec.md。
  終態 → 交棒 write-plan（Dev）或 debug-systematic（Bug）。
---

# brainstorm

把模糊 idea 變成可實作的 spec，同時完成入口分流（Track + Tier）。

## 使用契約（強制）

**載入後立即動作**：

1. 進 Phase 0 五子步驟（0a → 0b → 0b′ → 0c → 0d），不跳過。
2. 0b′／0c／0d 的判定**合併成一個 `AskUserQuestion` 一次確認**（見 §Phase 0c/0d 合併確認）；**禁文字 token NLP 判斷**。
3. 完成後 spec 落檔 `docs/work/<branch-name>/spec.md`、commit。
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
4. 不需要 100% 看完，估到能評 tier 即可。

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

**本階段不寫任何檔（硬規則）**。Phase 0 執行時仍在 `main`，`hooks/branch-safety.ps1` 會 `exit 2` 擋掉 repo 內的寫入。`.design-gate` 與 `design-map.md` 的落檔一律延到 **branch 建立後、與寫 `spec.md` 同一步**（見 §spec 文件結構與落檔）。

**禁止用 Tier 推導 `size`**。0d 還沒判，這裡也不准先看量體猜。細則見 `design-language` §兩根尺。

**判不出來時**：`map_status: absent`（專案尚無設計語言）照樣繼續、`precedent=false`，不要卡住流程。

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

**Tier 升降 trigger**：File-type 硬規則（見 CLAUDE.md）命中 DB migration / CI/CD / lock / infra 等 → 自動升至少 T2。

---

---

## §Phase 0c/0d 合併確認

0b′ / 0c / 0d 判完後，**用一個 `AskUserQuestion` 一次確認**，不要問三次。

| 情境 | 問幾題 |
|---|---|
| `design.involved=false` | 2 題：Track、Tier |
| `design.involved=true` | 3 題：Track、Tier、UI 判定 |

**第 3 題（UI 判定）的選項**，題目描述必須同時顯示 `scope` / `scope_evidence` / `map_status` 三項，讓 user 看得到判斷依據：

1. `<區塊名>` ＋ `<小改/大改>`，正確（推薦）
2. 區塊判錯，我來指認
3. `size` 判錯

把三者並列在同一個選單，用意是讓 `Tier` 與 `design.size` 的錯位當場可見——「T1 ＋ 大改」（改一個站的整體視覺）或「T3 ＋ 小改」（10 個元件加同一個 loading state）都是合法組合。

> **設計路徑（三版／單版／一主一變體）不在本階段問**——三方向本體 `design-direction` 屬階段 B，在此問等於問一個系統當下答不出來的問題。

## §spec 文件結構與落檔

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

**`design.involved=true` 時**：與 `spec.md` 同一步寫出 `docs/work/<branch-name>/.design-gate`（KEY=VALUE，內容為 `design:` 六欄 ＋ `decided_at`）。**不進版控**（`.gitignore` 已排除）。此檔是階段 C1 的 gate hook 唯一輸入。

寫完跑「self-review」：
1. 找 TBD / TODO / placeholder → 補
2. section 互相矛盾 → 改
3. ambiguous 要求 → 收斂、選一個
4. scope 太大 → 提示 user 拆 sub-task

self-review 完 → user 看 spec：

```
spec 已寫至 docs/work/<branch-name>/spec.md。
請 review，若需修改告知；否則直接進 <write-plan|debug-systematic>。
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
  design:                     # 0b′；欄位語意見 design-language §對外契約
    involved: <bool>
    scope: <區塊名|null>
    scope_evidence: <token 來源檔路徑|null>
    size: <小改|大改|null>
    precedent: <bool>
    map_status: <ok|remapped|absent|unknown|pending>
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
