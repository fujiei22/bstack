# Plan review 總結

> Plan: docs/work/refactor/skill-desc-and-body-slim/plan.md（v1 → v2）
> Tier: T3
> 視角: Eng + DX（依 spec §T3 review 視角；不派 Design）

## Critical 共識（兩視角同時指向守門有洞）

- **守門 v1 只凍結含選單的 code block、只抽 rules.md 的表格、步驟只比編號**（Eng M1 / M2 / M3）＋ **agent 檔內嵌規則若改成純指向，agent 在獨立 context 讀不到被指向的檔**（DX 1 / 2）。兩邊各自從機械面與讀者面指出同一件事：plan v1 的「零改變」有一大塊是靠 subagent 自律、不是靠守門。
- 處置：守門 v2 改成**所有 fenced block 逐塊比對（可整塊刪、不可改 / 新增 / 合併）**、**表格整張可刪不可刪單列**、**步驟動詞與反引號集合 ⊇ 基線**、**regex / 路徑型反引號不消失**、**agent 三段 bullet 數與粗體 ⊇ 基線**；守則 8 明寫 agent 內嵌規則逐條留、指向只能加不能取代。負向測 8 案全部符合預期（種植違規紅、允許改法綠）。

## Critical 各視角獨見

**Eng**
- C1 Task 2 × P9i 互鎖：design-direction 的 `T2 → 回 \`brainstorm\`` 恰兩處、一處在 description，砍描述會讓 P9i 紅（已 grep 驗證 L10 / L329）→ PROTECTED 加 design-direction、Task 2 保留清單加此句。
- C2 yaml「承上」與守門「欄名不減」矛盾、且守門不看值 → 採 Eng 建議 (b) 行級：每行 ∈ 基線 ∪ dev-workflow 主 yaml ∪ `# 承上`，消失的行 ⊆ 主 yaml。實測後承上能刪的行極少（多數 skill 的 yaml 值寫法與主 yaml 不同），plan Risks 如實註明。

**DX**
- 1 security-auditor §Checklist 主題 14 條、2 db-reviewer §使用 mysql MCP 三條 → 逐條留（守則 8）。
- 3 incident-investigate / context-snapshot 的六個 `>` 行是 code block 範本行、不是引言 → Task 7 / 14 砍點改寫；砍法 3 把「引言」定義寫死。
- 4 db-access 三個日期在 SQL 範例內 → Task 16 砍點改寫；砍法 3 註明 code block 內日期是資料。

## Major / Minor / Nit（去重後）

| # | 來源 | finding | 處置 |
|---|---|---|---|
| M4 | Eng | Trace 一行式一刀切會把 5 個跨流程 skill 改成會自己冒 phase；context-resume / frontend-test / dispatch-parallel 各有特殊寫法 | 砍法 1 改兩模板 + 三檔 block 原樣留 |
| M5 | Eng | frontend-test「8a-8d 縮一句」撞守門選單規則；「兩個 yaml 合一」是不同物件 | Task 8 兩砍點刪除、目標 187 → ≤145 |
| M6 | Eng | 單檔目標可達性：cmd-guard / pr-explainer 硬下限就超過目標、retro / frontend-test / dev-workflow / incident 邊緣、各 task 目標加總 3,212 > 總量斷言 3,170 | 目標全部改成**非空行**並依 Eng 下限重算；incident 不合併範本（守門禁）只刪 summary 那份；總量斷言改 = 各 task 目標加總 |
| M7 | Eng | `wc -l` 目標可被刪空行湊數（dev-workflow 61 空行） | 目標改非空行 `grep -c .` + 每檔 bytes ≤ −20% 雙門檻 |
| M8 | Eng | rules.md 逐段砍點會動到實質：§設計語言對齊 / §Tier 機制 bullet 裡 P11 / P9a / P12 不查的規則句、§協作 gate 句、§Branch safety P2d 護欄與「hook 隨 plugin 生效」、§Settings.json 三規則、L1-5 blockquote 沒列 | Task 26 逐段列必留子句；bytes 零餘裕如實註明 |
| M9 | Eng | Task 18 指向 `rules.md §Commit 訊息`——該標題沒有 §；verify-done L72 指向 frontend-test 不存在的兩個 §（既有） | 指向不帶 §；砍法 5 註明；verify-done 懸空記 follow-up |
| M10 | Eng | 22 個 subagent 同一工作樹跑契約：跨檔 check 半改狀態假紅、P9h / P12 訊息點不出檔、P2e 真 spawn 建刪 token 競態 | subagent 成品寫 `out/<name>.md`、不碰 skills/ 不跑契約、只跑守門 `--src`；主 agent 逐檔 copy + 守門 + 契約 + commit |
| m1-m2 | Eng | 非白名單 § 改名算新增；headings 掃到 code block 內的 `##` | 守則 4 明寫「§ 只能刪不能改名」；守門標題只掃 code block 外 |
| m3-m8 | Eng | Task 3 漏 §跨流程 skill 載入 表；白名單抓取範圍沒寫；spec「#67 / 9 個」實為 #69 / 11 個；缺 Step 2；lang-reviewer 焦點不是表；`-Check` 紅要告知 subagent | 全部改進 plan / spec |
| nit | Eng | 加碽→加嚴、步驤→步驟、§Phase 0 圖正名；P9i 契約訊息提的 § 不存在（範圍外） | 前三改；最後記 follow-up |
| 5 | DX | design-language / design-direction 需要半句分工；frontend-test 與其他不加 | Task 2 |
| 6 | DX | execute-plan「T0 不進本 skill」只在 description | Task 2 留第三句 |
| 7 | DX | §Branch safety 豁免段有四個意思、P2d 括號是護欄、「實測」二字是要人跑 node --version 的理由 | Task 26 拆四句 |
| 8 | DX | design-language 五段引言各要含的要素；§對齊檢查清單 無限迴圈理由必留 | Task 5 逐條列 |
| 9 | DX | dispatch-parallel「完成後」一行必含「五個只送 idle、沒人告訴它們要送」 | Task 6 |
| 10 | DX | §設計語言對齊 豁免理由不整刪 | Task 26 一行無日期理由 |
| 11 | DX | 回報格式缺四欄 + 守門結果 | §共同施工守則 回報格式擴充 |
| 12 | DX | 施工紀錄要有砍法對照 + 刪除的「為什麼」索引 | Task 27 四段 |
| 13 | DX | §Docs 落檔 bullet 配對 | Task 26：時機單獨、保留「雙保險」；門檻問句逐字 |
| 14 | DX | §白話優先 保留 bullet 形式 | Task 26 |
| 15 | DX | §協作模式判定 一句必含「獨立性本身就是產出價值」 | Task 26 |
| 16 | DX | rules.md 日期 grep = 0 與「精簡依據見 archive」衝突 | Task 26 刪括號留主句 |
| 17 | DX | 三個 agent 沒有「載入：」子句可縮 | Task 2 直接給第二句 |
| 18 | DX nit | rules.md §協作模式判定 末句指向 §隊友派工 | Task 26 順手改 |
| 19 | DX nit | 守則第一行「砍到目標行」會被當硬目標 | 加「軟目標、不得為湊數砍保護項」 |
| 20 | DX nit | spec `app.js:132` 行號不準 | spec 改 `parseFrontmatterDesc` |

## 主 agent 建議

- **必處理**：兩視角 Critical 全部（已在 plan v2 與守門 v2 落地）。
- **建議處理**：Major / Minor 全部採納（都是具體到段名的改法、不加成本）。
- **略過**：無。

## 守門 v2 負向測（Task 1 Step 4 依據）

| 案 | 預期 | 結果 |
|---|---|---|
| 刪 safety-guard PII 身分證 regex 行 | 紅 | 紅（規則型反引號片段消失） |
| 刪 design-language §對外契約 表單列 | 紅 | 紅（整張可刪、不可刪單列） |
| 整張 §對外契約 表刪改指向 | 綠 | 綠 |
| cmd-guard Red Flags 合併改寫 ≤5 列 | 綠 | 綠 |
| debug-systematic yaml 刪主 yaml 共有行 + 承上註解 | 綠 | 綠 |
| debug-systematic yaml 改自有行的值 | 紅 | 紅 |
| hypothesis-tester §輸入契約 刪一個 bullet | 紅 | 紅（步驟動詞 + bullet 數） |
| security-checklist 整塊刪一個 code block | 綠 | 綠 |
| 另：devwork description 刪 `/devwork`、rules.md 改 Tier 表一字、pr-explainer 改格式 block 標題、dev-workflow 圖刪一行、security-audit 第 3 步 spawn 改字 | 紅 | 全紅 |
| `--src out/cmd-guard.md`（Red Flags 砍到 3 列的成品）對 baseline 檢查 | 綠 | 綠 |
