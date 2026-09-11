# Plan review 總結
> Plan: docs/work/feat/headless-mode/plan.md
> Tier: T3
> 視角: Eng + DX + Design（原始全文在 `out/review-{eng,dx,design}.md`）

## Critical 共識（多視角同時提）

| # | 問題 | 視角 | 處置 |
|---|---|---|---|
| K1 | **subagent 會把自己判成 headless**：被 spawn 的 agent 同樣沒有 AskUserQuestion、又繼承環境變數，三條偵測全中；hosts.md 新列排在既有 subagent 列之前先命中 → review-plan / security-audit 的 subagent 各自去 issue 留言、各自宣告本輪結束 | DX C1、Eng C4 | §偵測 加第 0 條「被 spawn 的 subagent → 不是 headless，照 hosts.md 既有列回報主 agent」；hosts.md 新列條件改「主 agent、都沒有、且變數非空」並排在 subagent 列**之後** |
| K2 | **snapshot 定位與遺失**：檔名 `<topic-slug>-<ts>` 不含 issue，context-resume 取最新一份 → 同 workspace 第二個 issue 會接錯任務；workspace 未持久時 issue 已有 bstack-ask 留言但本地無 snapshot → 每輪從 Phase 0 重做並重複提問 | Design C1、C2、DX C5 | headless snapshot 檔名 `issue-<n>-<topic>-<ts>.md`；§偵測 加「定位本 issue 的 snapshot」步（比對 `source_issue`）；issue 已有 `<!-- bstack-ask` 留言但找不到 snapshot → `blocked`（`snapshot-lost`），禁重跑 Phase 0 |
| K3 | **rules.md 其餘節的無條件句打架**：§Auto-fix「危險 → AskUserQuestion」、§Fail handling、§協作模式判定「一律等 user 選」、§Tier「必經 AskUserQuestion」都無條件，rules.md 位階最高且每 phase 重讀 → AI 挑 rules.md 就卡在等人 | Eng C3、DX C3、DX 15 | rules.md 新段改寫成**跨節例外條款**：「本檔各節寫的『必經 AskUserQuestion』『一律等 user 選』headless 時一律改讀 headless-mode §分流表」；§協作模式判定 那行加「（headless 例外）」；dispatch-parallel 第 3 步改寫「互動模式禁自行決定；headless 時依分流表」而非尾加 |
| K4 | **分流表沒兜底 + 漏接 skill + safety-guard 死結**：有 AskUserQuestion 的 skill 共 21 個只接 11；verify-done 失敗六選一、security-audit critical gate、debug-systematic（整條 Bug track）、frontend-test FAIL 沒分流；safety-guard 命中 secret 會 AskUserQuestion，而它是 B 類留言的**前置步驟** | Design C5、DX C2 | §分流表 末尾加兜底「表中未列的決策點一律 B 類」，rules.md 同句；接線擴到 15（+ verify-done、security-audit、safety-guard、debug-systematic；frontend-test 由 verify-done 帶）；safety-guard headless：secret → **不留言、不 push、blocked** |
| K5 | **finish-branch 授權口子**：`:12` `:139` `:201` 三處「session 級明授權可 auto-merge」沒改，headless 唯一 user 輸入就是 issue 留言，人留「可以 merge」就是現成依據；契約 `noMerge` 只驗一行 | DX C4、Eng M2 | 三處各加「headless 時無此例外」；契約改掃 §Squash merge 全節含 `headless` 行 ≥ 2 |
| K6 | **契約撞名**：P18 已被 security-audit 契約佔用（檔頭索引漏記）；`section` helper 已存在且既有那支（`^#{2,3} ` 停）比新寫的更正確（新的 `##` 節遇 `###` 子標題會提早截斷、標題比對是前綴式） | Eng C1、C2、m1、m2、Design n2 | 改 **P19**，變數 `p19` / `HEADS19` / `PHASE19`；刪自寫 helper、改用既有 `section(text, /^## §Host 判定[^\n]*\n/m)`；檔頭索引補 P18、P19 |
| K7 | **devwork 1.5 兩支都有洞**：resume 分支「不進第 2、3 步」跳過載 dev-workflow → 第二輪起九階段骨幹、跨流程表、Fail handling 全不在 context；`headless: true` 只寫在 else 分支 | Eng C5、DX 12 | 1.5 改「兩支都先寫 `state.headless` / `source_issue`；只跳第 2 步問答分流，第 3 步照載 dev-workflow，由它依 `pending_question` dispatch 到 context-resume」 |

## Critical 各視角獨見

**Design**
- C3 **done 後沒有終止狀態**：PR 開好後下一輪 `pending_question` 為 null → 重進 Phase 0，每兩小時重做一次 → state 加 `pr_url`；devwork 1.5 先判：`pr_url` 非空且 PR open → 只印 `done` 行結束；已 merge → 做 docs 歸檔後結束。
- C4 **pending_question 清除只在註解**：讀到回覆後若本輪中途被砍，下一輪再套用同一決策 → §讀回覆 第 3 步明寫「先清 null、重存同一 snapshot、再接續」。
- C6 **格式不合與沒回是同一分支**：`1.` `選 1` `#1` 全不匹配 → regex 放寬 `^\s*[#＃]?\s*([0-9０-９]+)\s*[.)、。]?\s*$`；有新留言但解析不到 → 回一則 `<!-- bstack-reask -->` 澄清（同一提問只回一次）；完全沒新留言才 `waiting`。
- C7 **`[Trace]` 與 `[bstack headless]` 都要最後一行** → 寫死：headless 時 Trace 倒數第二行、狀態行最後一行、不包 code fence；rules.md §Trace 標籤 同步。

**Eng**：無其他（C1-C5 已併入 K3 / K4 / K6 / K7）。
**DX**：無其他（C1-C5 已併入 K1 / K3 / K4 / K5 / K2）。

## Major / Minor / Nit（去重後合併）

**採用的 Major**
- 回覆錨點改用留言 id / `createdAt`（留言後從 gh 回傳取），不用本地時鐘 `asked_at`（Design M1）；snapshot → 留言 → 用回傳值**覆寫同一 snapshot**，不是新開 ts 檔（Design M2）。
- `source_issue` 統一正規化 `owner/repo#n`（數字時用 `gh repo view --json nameWithOwner` 補），所有 gh 呼叫帶 `-R`（Design M3）。
- 需求文字來源 = `gh issue view -R <repo> <n> --json title,body`，devwork 參數只當識別（Design M4）。
- 模板固定加 `0. 以上皆非，直接寫你要的做法`；§讀回覆 定義 0 的處置（Design M5）。
- 回覆作者過濾：排除自己、只採 OWNER / MEMBER / COLLABORATOR（Design M6）。
- `blocked` 擴為「無法前進且不是在等人」統稱，列舉 gh 不可用 / push 失敗 / PR 開啟失敗 / snapshot-lost / cmd L4；`done` 無 PR 時貼 commit sha；「沒有這行 = 異常中止」（Design M7、M10、DX 14）。
- 主判準改 `BSTACK_HEADLESS=1`，`AUTOPILOT_LABEL` 非空為相容退路、取 OR（Design M8）。
- §偵測 第 4 條：`gh auth status` 不過 → `blocked`，動任何檔之前（Design M9、Eng M7）。
- `auto_decisions` 加 `alternatives` 與 `at`；PR 表六欄（Design M11）。
- `pending_question` 加 `decision_id`（分流表每列給固定 id）與 `resume_hint`（Design M12）。
- spec 落檔後在 issue 留一則**不帶標記**的進度留言（spec 摘要 + auto_decisions），不等回覆（Design M13）。
- 讀到合格回覆後回一行確認留言；`pending_question.reminded`，連續 waiting 12 輪補一次提醒（DX 9）。
- 新 skill 加「使用契約（強制）／載入後立即動作」段（DX 8）；導言定義 A / B 類（DX 22）。
- rules.md 新段補「遇決策點 context 找不到 §分流表 → 先重讀 `skills/headless-mode/SKILL.md`」；`state.headless` 為準（Eng M8）。
- receive-review `:36` T3 特例與 Red Flags `:88` 也改；review-plan Red Flags `:137` 加例外；dispatch-parallel Red Flags `:213` 加例外（Eng M3、M4、DX 6、7）。
- index.html `:505`「九條 → 十條」、`:660` 註解；README `:12` 目錄 anchor `#skills29`；`docs/js/data.js` crosscut 加 headless-mode；Task 6 驗證加 `node docs/tools/docs-site-contract.mjs`（Eng M5、M6、m9、m10、DX 11）。
- `crossTable` 守衛用 `exists()` 而非 `dw16`（devwork，不是 dev-workflow）（Eng M1）。
- T6 依賴 T2-T5 全部（references 內嵌全文）；並行分 group 的真正理由是三個 task 紅綠都比對同一條契約清單，並行會互相污染（Eng M9、m11）。

**採用的 Minor**
- `headless` 每輪由 §偵測 重算、不從 snapshot 還原；`blocked_reason` 進 state（Design m1、DX 13）。
- snapshot 既有「Open question」段落改為由 `pending_question` 產生的人讀摘要（Design m2）。
- branch 取 `git rev-parse --abbrev-ref HEAD`（Design m3）；狀態行分隔符改 ASCII ` | `、`<一句>` 禁換行（Design m4）。
- `review-fixes.diff` 走一次 safety-guard 再落檔（Design m5）；PR 模板改「headless 時新增此節」不帶空表（Design m6）。
- 本 repo `.gitignore` 補 `docs/snapshots/`（Design m7）。
- B 類結束本輪前：已 verify 的 task 照常 commit，未完成 `git stash` 並記 snapshot（Design m8）。
- 環境變數讀法寫「POSIX `printenv` / PowerShell `$env:`」；hosts.md 列自帶讀法（Eng m5、m6）。
- brainstorm 0a 第 4 點也補分流（Eng m7）；review-plan 留下的 major 數寫進 reason（Eng m8）。
- execute-plan `:51` 改寫而非尾加（DX 16）；brainstorm spec 範本不加註解行，規則寫在 gate 段（DX 17）。
- 模板：branch 用 GitHub 連結、去掉 snapshot 路徑、補「沒看到合格回覆就靜靜等，不再留言」（DX 19、20）；spec 錨定寫法對齊（DX 21）。
- 分流表類別欄粗體統一；「主分支」用語對齊 rules.md（DX 23、24、Design n3）；行號修正、hosts.md 改法用 fenced block、契約訊息壓短（Eng n1-n3）。

**略過**
- DX 18「phases 斷言收緊為含 headless 行數 ≥ 決策點數」：決策點數沒有機械定義，斷言會脆；改在契約失敗訊息列出每個 skill 應落點的段名。
- Design M9 抽象層：不做；只做 `gh auth status` 前提檢查，非 GitHub 明寫不支援。
- Eng n4：plan 註記「/bstack: 並列」是空的，刪註記即可。

## 主 agent 建議

- **必處理**：K1-K7 + Design C3 / C4 / C6 / C7（11 條）。
- **建議處理**：上列全部 Major 與 Minor（成本都是一兩行，且多數是同一批檔）。
- **略過**：DX 18、Design M9 抽象層、Eng n4（理由如上）。

結論：plan 需要**重寫** Task 1（P19 + 既有 helper）、Task 2（skill 全文）、Task 3（rules.md 例外條款 + hosts.md 列位置 + devwork 1.5）、Task 5 擴到 10 個 skill、Task 6 補四處；新增 Task 7（.gitignore、data.js、docs-site-contract）。工作量約 plan 原本 1.5 倍。
