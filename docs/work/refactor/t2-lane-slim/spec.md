# T2 lane 精簡：plan 進 spec、reviewer 合一、pr-explain 限 T3、review fix 單 commit

> Track: Dev | Tier: T3 | 建立: 2026-09-04

## 動機 / Why

T2 現在被當成小型 T3 在跑。2026-09-04 實測（PR #61，T2、5 檔約 150 行 code）：spec 到 merge 44 分鐘、plan 437 行是 code 的三倍、三個 review subagent、pr-explain 燒約 9 萬 token 寫一份 squash 後很少人讀的文件、receive-review 每 finding 一顆 commit 做了 8 顆全在 squash 時消失。同日 T1 任務（PR #62）5 分鐘完成，證明輕量 lane 可行。

外部依據：
- Anthropic 官方 best practices（現行版）原句「Plan mode is useful, but also adds overhead… If you could describe the diff in one sentence, skip the plan.」規劃的適用條件是「不確定做法、改多個檔、不熟那段 code」。
- superpowers（本流程的上游血緣）v6.3.0 release notes：「Ceremony now scales to the task… small tasks skip the two-document ritual.」bounded 類不寫 spec 檔、不寫 plan 檔；v6.0.0 把雙 reviewer 合成一個。

## 目標 / Success criteria

1. **T2 不再產 plan.md、不跑 review-plan**：brainstorm 在 T2 的 spec.md 內加「§施工清單」段（每 task 一行：檔 / 做什麼 / 怎麼驗 / parallel-group），與 spec 同一個 gate 確認；execute-plan 在 `plan_path=null` 時改讀 spec 的施工清單。write-plan / review-plan 只服務 T3。
2. **request-review 合一**：T2 = 一個 general-purpose reviewer，prompt 內依改動副檔名附語言 idiom 提示；T3 = 架構 × 除錯兩個 reviewer，各自 prompt 附語言提示。不再自動 spawn `lang-reviewer` agent；agent 檔保留給 user 顯式呼叫，description 改寫。
3. **pr-explain 限 T3**：finish-branch 在 T0-T2 開完 PR 即停（PR body 已含 why / what / test）；T3 才交棒 pr-explain。user 顯式 `/bstack:pr-explain` 不受影響。
4. **receive-review 單 commit**：不危險類 finding 全部修完後一顆 `fix: 處理 review finding（N 項）` commit，body 逐項列；危險類仍逐項 AskUserQuestion。T3 仍先 diff 給 user 看。
5. **rules.md §Tier 表**同步：T2 的 plan 欄改「施工清單（spec 內）」、review 欄改「1 subagent」；T3 review 欄改「雙視角 subagent」；新增 pr-explain 欄（T0-T2 跳、T3 用）。
6. **docs 站同步**：流程圖 data.js 的 RPSplit / RPT2 / LangAgent 節點與相關邊移除、PushPR 依 Tier 分流；契約 C8a 的 EXPECT 與 landing 兩處節點數更新；`build-references.ps1` 重跑讓內嵌 skill 全文一致；README 對應列更新。
7. `node docs/tools/docs-site-contract.mjs`、`node scripts/plugin-contract.mjs`、`pwsh -File scripts/build-references.ps1 -Check` 全綠。
8. 全 repo grep `lang-reviewer` 不再出現「自動派發 / 由主 agent 動態 spawn」語意；grep `T2` 的每一處與新 Tier 表一致（不留舊敘述）。
9. **T3 review-plan 視角依改動面向選**：brainstorm 0b 從 `codebase_impact` 判命中哪些面向——機械可驗（regex / 資料檔 / 契約 / 測試）→ Eng（下限）；有人要讀（規則 / prompt / 文案 / README）→ DX；跨模組兩端契約或對外介面（UI / API / 流程圖 / hand-off state）→ Design；產品取捨未定 → CEO。命中幾個派幾個，寫進 `state.review_perspectives`，review-plan 只讀不判。review-plan 使用契約、write-plan 交棒、rules.md T3 plan 欄、dev-workflow Phase 2、流程圖 RPT3 label、landing 規劃 beat 文案六處同步。
   依據（2026-09-04 本 branch 實測）：對「改規則書 / skill prompt」這種標的，CEO 視角只能複述已定的決策；Design 視角抓到兩端契約與 `data-upto` 語意錯誤、有實質價值；Eng / DX 對規則類標的必要。

## 範圍 / Scope

**包含**（行為改變）：
- `skills/devwork/rules.md` §Tier 表、§Tier 機制文字
- `skills/dev-workflow/SKILL.md` §Track × Tier × Phase 路徑（Phase 2 / 5 / 8 的 tier 條件）
- `skills/brainstorm/SKILL.md` §spec 文件結構（T2 加 §施工清單）、§交棒（T2 → execute-plan）
- `skills/write-plan/SKILL.md`、`skills/review-plan/SKILL.md` 使用契約改「T3 only」，T2 誤入時的處置；review-plan 第 2 步改「依標的選視角：Eng + DX 預設，CEO / Design 條件加入」，§視角 prompt 模板各視角標「何時用」
- `docs/index.html` 規劃 beat（`:87`）h2「拆給四個人看」與段落「派四個視角」改成不寫死數字的說法（文字節點）
- `skills/execute-plan/SKILL.md` 讀 plan 步驟接受 `plan_path=null` → 讀 spec §施工清單
- `skills/request-review/SKILL.md` §T2 / §T3 dispatch、拿掉 lang-reviewer 自動派發、加語言提示模板
- `skills/receive-review/SKILL.md` §不危險處置改單 commit
- `skills/finish-branch/SKILL.md` 下游依 Tier 分流
- `skills/pr-explain/SKILL.md` description 註明 T3 / 顯式呼叫
- `agents/lang-reviewer.md` description「載入」句改為 user 顯式呼叫
- `docs/js/data.js` 節點 / 邊；`docs/tools/docs-site-contract.mjs` EXPECT；`docs/index.html` 節點數與 T2 相關文案；`docs/js/references-data.js`（產出器重跑）
- `README.md` write-plan / review-plan / pr-explain / lang-reviewer 四列

**排除**：
- skill 文本瘦身（Red Flags 表、重複範本）→ 另開 `refactor/skill-text-slim`
- T1 / T0 路徑不動；Bug track 不動；security-audit 條件不動
- verify-done 的 T2 套餐不動（官方 best practices 把「可跑的 check」列為第一優先）
- 不改 hooks、不改 install / extras 腳本

## 影響檔案 / Codebase impact

| 檔 | 改動 | 風險 |
|---|---|---|
| `skills/devwork/rules.md` | edit §Tier 表 + 2 段文字 | 中；CLAUDE.md @import，全 session 常駐，措辭錯會直接影響行為 |
| `skills/dev-workflow/SKILL.md` | edit 路徑圖 3 處 | 中；routing 真相 |
| `skills/brainstorm/SKILL.md` | edit spec 結構 + 交棒 | 中；T2 施工清單格式是 execute-plan 的輸入契約 |
| `skills/execute-plan/SKILL.md` | edit 讀 plan 步驟 | 中；同上契約另一端 |
| `skills/write-plan/SKILL.md`、`skills/review-plan/SKILL.md` | edit 使用契約 | 低 |
| `skills/request-review/SKILL.md` | edit dispatch 兩段 + 新語言提示模板 | 中；reviewer 品質 |
| `skills/receive-review/SKILL.md` | edit 一段 | 低 |
| `skills/finish-branch/SKILL.md`、`skills/pr-explain/SKILL.md` | edit 下游 / description | 低 |
| `agents/lang-reviewer.md` | edit description 一句 | 低；P7 檢查 description 無「觸發：」 |
| `docs/js/data.js` | 刪 3 節點、刪 7 邊、加 5 邊、改 9 個 label | 中；C8a / C8c / C8g 三條契約鎖著；`data-upto` 索引可能位移 |
| `docs/tools/docs-site-contract.mjs` | edit EXPECT | 低 |
| `docs/index.html` | 文字節點：節點數 2 處 + T2 文案 | 低；文字節點豁免 design-language |
| `docs/js/references-data.js` | 產出器重跑 | 低；不手改 |
| `README.md` | 4 列 | 低 |

15 檔 → T3。

## 設計方向

- 區塊：文件站（依據 `docs/css/styles.css`）；map_status ok；size 小改，未走三方向
- index.html 只改文字節點（節點數、文案），不碰 token / class / 版面 → rules.md §設計語言對齊 豁免條款
- data.js 非前端副檔名；流程圖配色由 `data-type` 驅動、節點型別不新增

## 施工清單契約（新格式，給 brainstorm 與 execute-plan 兩端）

T2 spec.md 末尾新增：

```markdown
## 施工清單（T2；取代 plan.md）

| # | group | 檔 | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `path/a.js` | 加 X | `node test a` 由紅轉綠 |
| 2 | 2 | `path/b.css` | 改 Y | contract C12 綠 |
```

- ≤ 8 列；超過代表 Tier 判低了，回 0d 升 T3
- `group` 同號可並行（語意同 plan 的 parallel-group）
- execute-plan 逐列 TaskCreate、紅綠循環、一 task 一 commit，規則不變

## DB 影響

無。

## 風險與 trade-off

- **兩端契約要同時改**：brainstorm 產施工清單、execute-plan 吃施工清單，漏一邊 T2 就卡住。plan 要把這兩檔放同一個 task。
- **流程圖節點數變動**牽動 `data-upto`（landing 每段對應的節點索引）與 C8g 的兩處數字；改完要開 landing 實測鏈的段落對齊沒跑掉。
- **references-data.js 必須重產**，否則 C8b / C18 紅；產出器需 pwsh 7。
- **本 PR 自己走舊規則**（T3：雙視角 + lang-reviewer、security-audit、pr-explain）——規則在 merge 前不生效。review-plan 例外：四視角派出後 user 於 2026-09-04 決定停掉 CEO（Design 已跑完），實際採 Eng + Design + DX 三視角，這個決定本身就是第 9 條的依據。
- 少了 review-plan 的 T2 會失去「plan 文字錯誤」這類發現，但那類錯誤多數是 plan 過細自己製造的；設計缺口交由 code review 抓（PR #61 的 C20f 那類 code reviewer 一樣看得到）。

## 待釐清

無。
