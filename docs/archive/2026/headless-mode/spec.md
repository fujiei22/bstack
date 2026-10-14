# headless 無人模式（headless-mode）
> Track: Dev | Tier: T3 | 建立: 2026-09-11

## 動機 / Why

bstack 的九階段在每個決策點走 `AskUserQuestion`。跑在 `claude -p` / `codex exec` 這類排程容器（例如 claude-autopilot）時沒有這個工具、也沒有人在終端前，現行 hosts.md 的退路是「文字提問、選項編號」——問題印出來那一輪就結束，沒人回答，流程永遠停在 Phase 0。

user 要的是：**AI 已有推薦答案的決策點自己採用並留紀錄；真正需要人的決策改寫到來源 GitHub issue 留言、結束本輪；下一輪讀到回覆接著做；merge 永遠不自動。**

## 目標 / Success criteria

- `node scripts/plugin-contract.mjs` 全綠（含新契約 P19；P18 是既有 security-audit 契約，只補檔頭索引），`--selftest` 綠，`build-references.ps1 -Check` exit 0，`docs/tools/docs-site-contract.mjs` 全綠。
- 新 skill `skills/headless-mode/SKILL.md` 存在，description 兩句式，含 §偵測 / §分流表 / §問人格式 / §讀回覆 / §本輪結束協定 / §hand-off state / §Red Flags。
- rules.md §決策點選單 與 hosts.md §Host 判定 / §決策點 明寫 headless 分流入口（單一真相在 headless-mode，兩處只指向）。
- 每個含 `AskUserQuestion` 的 skill（P19 從磁碟推導；只由 user 顯式呼叫的 retro / lock-files 除外）每個決策點有一行 headless 分流（A 類採推薦 / B 類問人），指向 headless-mode §分流表；引用的 `decision_id` 必須是分流表的列；8 個派工 skill 的 prompt 範本含 §子 agent 約束 字面句。
- README「Skills（29）」與 index.html 三處計數 + `SKILLS` 陣列同步（P8 綠）。
- 互動模式（有 `AskUserQuestion` / `request_user_input`）**零行為改變**：所有新規則以 headless 判定為前提句。

## 範圍 / Scope

**包含**
- 新 skill `headless-mode`（跨流程、條件載入）：政策的單一真相。
- rules.md / hosts.md 接線（各一兩句，指向 headless-mode）。
- 21 個 skill 的決策點加一行分流（含 design-language / design-direction）；8 個派工點貼約束句。
- 契約 P19（機械守：三處接線 + 推導清單 + decision_id 校驗 + 派工約束字面 + 新 skill 九節標題 + parser fixture）；`scripts/headless-reply.mjs` 回覆解析純函式。
- README / index.html 計數與索引卡；`docs/js/references-data.js` 重產。

**排除**（明寫避免 scope creep）
- claude-autopilot 那一側的 role（prompt.txt / settings.json / crontab / GitHub 版 toolkit）——另一個 repo、另一件事。
- plugin 版本升版（慣例另開 chore PR）。
- Agent Teams 在 headless 的支援：headless 一律不開隊友（沒有人可以「中途切進去」，判準 2 恆不成立）。
- 自動 merge：任何形式都不做，包含「issue 留言授權」。
- 把 snapshot 改成 commit：headless 假設 workspace 跨輪持久（autopilot 是 host volume mount）；每次跑在全新 clone 的部署不在本次支援範圍，寫進 skill §前提。

## 影響檔案 / Codebase impact

| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `skills/headless-mode/SKILL.md` | new | 政策寫錯 = 無人模式走錯路；靠 review-plan DX 視角 + 契約守六節 |
| `skills/devwork/rules.md` §決策點選單 | edit | 常駐成本 +2 行；rules.md 位階最高，這裡的前提句是互動模式零改變的保證 |
| `skills/devwork/hosts.md` §Host 判定 / §決策點 | edit | P16 守八節標題與四欄表頭，只加列不加節 |
| `skills/devwork/SKILL.md` | edit | headless 入口：snapshot 帶 pending_question → 走 context-resume 不走 Phase 0 |
| `skills/dev-workflow/SKILL.md` | edit | 使用契約第 5 條加前提句；跨流程表加列；§Fail handling 加分流 |
| `skills/brainstorm/SKILL.md` | edit | 0a 歧義 = B 類；合併確認 / spec gate = A 類；size=大改 = B 類 |
| `skills/dispatch-parallel/SKILL.md` | edit | 跑法 = A 類（不開隊友） |
| `skills/review-plan/SKILL.md` | edit | 無 critical = A 類 accept；有 critical = B 類 |
| `skills/receive-review/SKILL.md` | edit | 危險類 / reviewer 衝突 = B 類；T3「先 diff 再 commit」headless 直接 commit、diff 路徑記錄 |
| `skills/execute-plan/SKILL.md` | edit | fail = B 類；前端大改 gate = B 類 |
| `skills/finish-branch/SKILL.md` | edit | conflict = B 類；§Squash merge 加「headless 永不」；PR body 加「headless 自動決策」節 |
| `skills/context-resume/SKILL.md` | edit | headless：接續方向不問、改讀 issue 回覆；state 不一致 = B 類 |
| `skills/context-snapshot/SKILL.md` | edit | headless 直接存；快照結構加 `pending_question` / `source_issue` / `auto_decisions` |
| `skills/cmd-guard/SKILL.md` | edit | L2 / L3 = B 類；L4 拒絕不變 |
| `scripts/plugin-contract.mjs` | edit | 加 P19（P18 為既有 security-audit 契約，只補檔頭索引）；P3a 下限 28 不動（P8 精確） |
| `scripts/headless-reply.mjs` | new | 回覆解析純函式 + CLI；輸入壞掉 exit 2 |
| `.gitignore`、`docs/js/data.js` | edit | snapshots 不入 repo；流程圖 crosscut 加 headless-mode |
| 八個支線 skill + design-language / design-direction | edit | 決策點分流與派工約束（v2 擴充） |
| `README.md` | edit | 計數 28→29、跨流程列加 headless-mode |
| `docs/index.html` | edit | meta 三處 + hero + inventory 計數、`SKILLS` 陣列加一列（文字節點 / JS 資料，無 markup 變動） |
| `docs/js/references-data.js` | regenerate | 只能由 build-references.ps1 產 |

## 設計方向（`design.involved=true` 時必填）

- 區塊（`scope`）：docs 站首頁（landing）skill 索引卡　依據（`scope_evidence`）：`docs/reference/design-map.md`
- 地圖狀態（`map_status`）：ok
- `size`：小改
- 設計語言摘要：改動只有計數數字（文字節點）與 `SKILLS` JS 陣列加一列；索引卡由既有 JS 渲染、沿用既有 token，無新視覺決策。execute-plan 動 index.html 那個 task 前後載 design-language 跑四項對齊檢查（預期四項 N/A：沒有新元件狀態 / 斷點 / 表單 / dark mode 決策，依據＝diff 不含 class / style / 標籤）。
- 小改，未走三方向。

## 政策設計（v1 草案；v2 以 `skills/headless-mode/SKILL.md` 為準）

> **v2 差異摘要**（review.md + `out/codex-dialogue.md` 共識後）：偵測從三條改五條（第 0 條 subagent 排除、`BSTACK_HEADLESS=1` OR `AUTOPILOT_LABEL`、`gh auth status`）；snapshot 檔名帶 `issue-<n>-` 前綴並定位、`snapshot-lost` / `duplicate-instance` 兩種 blocked；分流表每列有 `decision_id`、加兜底「表外一律 B」、接線 11 → 19 個 skill；回覆解析抽成 `scripts/headless-reply.mjs` 純函式（放寬 `1.` `#１`、選項 0 自由文字、作者限 OWNER / MEMBER / COLLABORATOR、排除自己）；`unparseable` 澄清一次、`none` 12 輪提醒一次、answered 先清 `pending_question` 再確認留言；`done` 之後靠 `pr_url` 判 PR 狀態不重跑；結束行分隔符改 ` | `、Trace 倒數第二行；派工 prompt 必含 §子 agent 約束；`auto_decisions` 六欄、spec gate 後留一則進度留言。下面 v1 內容保留作歷史，**衝突處以 SKILL.md 為準**。

### 偵測（三條全中才是 headless）
1. 工具清單沒有 `AskUserQuestion` 也沒有 `request_user_input`。
2. `AUTOPILOT_LABEL` 環境變數非空（Bash `printenv AUTOPILOT_LABEL`）。
3. 來源 issue 可解析：`BSTACK_ISSUE` 環境變數（`123` 或 `owner/repo#123`）> devwork 參數裡的 `#<n>` > snapshot 的 `source_issue`。三者皆無 → **headless-blocked**：不問人、不猜，寫 §本輪結束協定 的 `blocked` 行後結束。

只中 1 不中 2 → 現行 hosts.md 退路（文字提問、編號）不變。中 2 不中 1 → 互動模式，照舊 `AskUserQuestion`。

### 分流表（單一真相）

| 決策點 | 類別 | headless 行為 |
|---|---|---|
| brainstorm 0a 複述不準 / 抓不到 success criteria | **B 問人** | 留言列可能解讀（編號）+ 推薦 |
| brainstorm 0c/0d 合併確認（Track / Tier / UI） | A 採推薦 | 記 auto_decisions；`size=大改` 的第 3 題例外 → B（三方向 vs 一版是設計決策） |
| branch 名（guard.mjs 擋在 main） | A | `<type>/<short-desc>` 自訂，type 依 Track |
| brainstorm spec gate | A | 選 1；spec §待釐清 必含 auto_decisions 清單 |
| review-plan user gate | A / B | 無 critical → accept；有 critical → B |
| dispatch-parallel 跑法 | A | subagent 平行或串行依判定實據；**不列 Agent Teams** |
| receive-review 不危險類 | A | 照舊自動修；T3「先 diff 再 commit」→ 直接 commit，diff 落 `docs/work/<branch>/review-fixes.diff` |
| receive-review 危險類 / 多 reviewer 衝突 / reviewer fix 自己錯 | **B** | 留言 |
| execute-plan / verify / review fail | **B** | 不 retry；留言列 retry / adjust / rollback / 回上層 / escalate |
| execute-plan 計畫外前端大改 gate | **B** | 留言 |
| cmd-guard L2 / L3 | **B** | 留言；L4 照舊拒絕 |
| finish-branch rebase conflict | **B** | 留言 |
| finish-branch merge | **永不** | 開 PR 印 URL 即止；issue 留言不算授權 |
| context-snapshot「要不要存」 | A | 一律存 |
| context-resume 接續方向 | A / 讀回覆 | 有 pending_question → 讀 issue 回覆；沒有 → 選 1 |
| context-resume state 不一致 | **B** | 留言 |

A 類每次都寫一筆 `state.auto_decisions[]`：`{phase, question, chosen, reason}`；brainstorm 寫進 spec §待釐清（子標題「headless 自動採用」），finish-branch 抄進 PR body。

### 問人格式（gh issue comment，固定模板）

```
<!-- bstack-ask: <phase> | <ISO-ts> -->
## bstack 需要你決定（<phase>）

**背景**：<一句白話：這是什麼、卡在哪>
**問題**：<一句>

選項：
1. <...>（推薦）— <代價>
2. <...> — <代價>

回覆方式：留一則新留言，**第一行只寫編號**（例 `1`），第二行起可補說明。
branch: `<branch>` · snapshot: `<path>`
```

留言前：B 類若已有 code → 先 `git push -u origin <branch>`（沒推的 branch 下一輪找不回）；跑 safety-guard 掃留言內容。

### 讀回覆（context-resume headless）

`gh issue view <n> --comments --json comments` → 取 `<!-- bstack-ask -->` 標記之後、最新一則第一行匹配 `^\s*(\d+)\s*$` 的留言 → 編號在選項範圍內 → 當作該選項執行（等同 user 選了）；0a 開放題允許自由文字。沒有合格回覆 → 不重問、不猜，寫 `waiting` 行後結束本輪（避免每兩小時刷一則留言）。

### 本輪結束協定

最終訊息最後一行固定格式，給外層 harness 的 journal 用：

```
[bstack headless] <asked|waiting|done|blocked>: <一句> · issue #<n> · branch <name>
```

`asked` / `waiting` / `blocked` 前必跑 context-snapshot（含 `pending_question`）。

### 新增 hand-off state 欄位

```yaml
state:
  headless: <bool>
  source_issue: <owner/repo#n | null>
  auto_decisions:            # A 類每筆
    - {phase: <名>, question: <一句>, chosen: <選項文字>, reason: <一句>}
  pending_question:          # B 類留言後
    phase: <名>
    asked_at: <ISO>
    options: [<選項文字>...]
    comment_url: <url>
```

## DB 影響

無。

## 風險與 trade-off

- **A 類判斷力**：Tier 推薦錯會走錯 lane；但錯的 Tier 會在 PR body 的 auto_decisions 被人看到，且 review 階段仍跑。
- **留言洗版**：`waiting` 不重問是刻意的；代價是人若沒看到留言，任務就靜靜等。autopilot 的 journal 會每輪記 `waiting`。
- **常駐成本**：rules.md 只加 2 行，政策放條件載入的 skill；description 兩句式。
- **互動模式回歸**：所有改動前置「headless 時」；契約 P19 不守這點，靠 review-plan DX 視角與 code-review 檢查前提句（code-review 逐行確認：唯一動到互動模式的是 `.gitignore` 加 `docs/snapshots/`，context-snapshot 的 commit 分支已同步註明）。
- **Codex host**：`codex exec` 同樣沒有 `request_user_input`，偵測同一套；`gh` 需在 PATH。skill 內文須過 P14（不寫 Claude 專屬字面）。

## 待釐清

- `BSTACK_ISSUE` / `BSTACK_HEADLESS` 兩個環境變數名是本 spec 定的（autopilot 那側 role 的 `env` 檔要跟著設）；user 未指定，先用這個。
- 每輪全新 clone 的部署（snapshot 消失）：本次不支援，skill §偵測 前提明寫，並以 `snapshot-lost` blocked 可觀測。
- subagent 排除靠「第 0 條 + 派工 prompt 強制標示」雙保險，Codex 側沒有可辨別子 agent 的保證訊號（Codex Q3 結論），是防呆不是保證。

## 施工紀錄

- **設計語言四項對齊（execute-plan Task 7，`docs/index.html`）**：diff 以 `git diff --word-diff=porcelain` 驗證，只動三處 meta 的 `28`→`29`、hero `28`→`29`、inventory 「九條」→「十條」與 `28`→`29`、JS 註解 `28`→`29`、`SKILLS` 陣列加一列；無任何 `class` / `style` / 標籤 / 色彩變動。元件狀態 N/A（無新互動元件）、斷點 N/A（無版面改動）、表單 N/A（無表單）、dark mode N/A（無新色彩）。
- **執行偏差**：plan Task 7 預期 `node docs/tools/docs-site-contract.mjs` 全綠；實際 C8d「data.js FLOW_DATA 與 HEAD 相同」在 commit 前紅（該契約比對工作樹 vs HEAD，設計上守「不要動 data.js」），commit 後重跑綠。crosscut 加 headless-mode 是刻意的內容變更（review DX 11）。
- **契約 P19 一路紅→綠的順序**：Task 1 parser 綠 → Task 2 skillHeads / skillBody → Task 3 rules / hosts → Task 4 crossTable + 4 skill → Task 5 noMerge + 6 skill → Task 6 8 skill → Task 7 gitignore。每個 task 的 Step 2 / Step 4 都對照 P19 失敗訊息的 key 清單判讀。
