## DX 視角 review

逐行檢查 plan Task 3-5 的每一處改法：文字層面都帶了「headless 時」前提句，互動模式讀起來不變；但有兩處是結構性改動而非加前提句（hosts.md §Host 判定 新列、brainstorm spec 範本註解），其中第一處會改變 subagent 的行為，列在 Critical 1。

### Critical（必須處理）

**1. subagent 會把自己判成 headless，然後自己去 issue 留言、自己做決定**
位置：plan Task 3 Step 3（hosts.md §Host 判定 加列）＋ Task 2 §偵測 三條（`skills/devwork/hosts.md` §Host 判定 現有第三列「都沒有（例如你是被 spawn 的 subagent）」）。
問題：偵測三條對任何 subagent 全部成立。被 spawn 的 agent 工具清單沒有 `AskUserQuestion`（第 1 條中），環境變數由父行程繼承，所以 `AUTOPILOT_LABEL` 與 `BSTACK_ISSUE` 也中（第 2、3 條中）。新列又插在「都沒有」那列之前，表格由上往下比對時先命中新列。
後果：headless 跑一輪 T3，review-plan 派三個視角 reviewer、security-audit 派 auditor，每一個都可能認定自己是 headless 主流程，各自 `gh issue comment` 留一則問題、各自宣告「本輪結束」。人在 issue 下看到四則互相矛盾的提問，且主 agent 的 `pending_question` 只有一筆，下一輪讀回覆會對不上。這同時破壞了「唯讀 fan-out 一律 subagent、獨立性本身就是產出價值」的前提。
建議改法：§偵測 加第 0 條並置於最前：「你是被 spawn 的 subagent（派工訊息由另一個 agent 給）→ **不是 headless**，照 hosts.md 既有列『不做決策點、把問題回報給主 agent』，禁 `gh issue comment`。」hosts.md 新列的條件欄改寫成「主 agent、工具清單都沒有、且 `AUTOPILOT_LABEL` 非空」，且**排在**既有 subagent 列之後，不是之前。

**2. 十一個 skill 的名單漏掉四個會走到的決策點，其中一個是 headless-mode 自己要用的**
位置：spec §目標第 4 條、plan Task 1 的 `PHASE18` 陣列、plan Task 5。
問題：磁碟上有 `AskUserQuestion` 的 skill 共 21 個，名單只收 11 個。漏掉的裡面有四個在主線上：`skills/verify-done/SKILL.md:27`（verify 失敗六選一）、`skills/security-audit/SKILL.md:46`（每個 critical 一個 gate）、`skills/safety-guard/SKILL.md:75`（secret 命中）、`skills/debug-systematic/SKILL.md`（Bug track Phase 3' 全程）。
後果：無人模式跑到 verify fail（無人值守最常發生的事）就印一個沒人回答的六選一，那一輪白跑，而 P18 全綠、契約不會紅。safety-guard 更直接：headless-mode §問人格式 規定「留言前必載 safety-guard 掃留言內容」，掃到東西它會 `AskUserQuestion`，於是連「問人」這個動作本身都卡住。Bug track 因為 debug-systematic 沒分流，等於整條 track 不可用，但 spec §排除 沒寫。
建議改法：名單擴到 15，分流表補四列（verify fail → B、security critical → B、safety-guard 不可自動類 → B 且不得把原值寫進留言、debug-systematic 的 gate → B）。若不想擴，就在 spec §排除 明寫「Bug track 與 security critical gate 本次不支援」，並在那四個 skill 各加一行「headless 時 → blocked，走 §本輪結束協定」，讓它至少是可觀測的停機而不是靜默空轉。

**3. dispatch-parallel 的新句與 rules.md 位階最高的禁令正面打架**
位置：plan Task 5（dispatch-parallel 第 3 步尾加）、`skills/dispatch-parallel/SKILL.md:16` 同一句的「**禁自行決定**」、`skills/devwork/rules.md` §協作模式判定「**禁自行開隊友**：判定只產生選項，一律等 user 選」。
問題：改法是在「禁自行決定。」後面接「headless 時 → A 類：依判定實據選 subagent 平行或串行」。同一行前後兩句相反，而更強的那條寫在 rules.md，且 rules.md 自稱「與任何 skill 衝突時本檔勝」。plan Task 3 只在 rules.md §決策點選單 加段，沒碰 §協作模式判定。
後果：正是這次 review 要抓的那種矛盾——AI 會挑一條照做而且不報錯。挑 rules.md 就卡在選單無限等待，挑 headless-mode 就違反位階最高的規則書，兩種都不會有任何診斷輸出說明它命中了哪一條。
建議改法：三處一起改。(a) rules.md 新段寫成跨節例外條款，不要只寫成 §決策點選單 的附註，例如：「**headless（無人模式）**：工具清單沒有 `AskUserQuestion` / `request_user_input` **且** `AUTOPILOT_LABEL` 非空 → 載 `headless-mode`。此時**本檔各節**寫的『必經 `AskUserQuestion`』『一律等 user 選』一律改讀 `headless-mode` §分流表；merge 永不自動。互動模式不受影響。」(b) rules.md §協作模式判定 那行尾加「（headless 例外見 `headless-mode`）」。(c) dispatch-parallel 第 3 步改寫成「互動模式禁自行決定；headless 時依 `headless-mode` §分流表」，不要用尾加。

**4. finish-branch 留了三個「session 級明授權」的口子沒堵，而 headless 唯一的 user 輸入就是 issue 留言**
位置：`skills/finish-branch/SKILL.md:12`、`:139`（§Squash merge 第三列「唯一例外：user 對整個 workflow / session 明授權」）、`:201`（Red Flags「session 級明授權才能 auto」）；plan Task 5 只改 §Squash merge 首列。
問題：headless-mode 寫「issue 留言不算授權」，但這三處仍寫著「session 級明授權就可以 auto-merge」。headless 下 AI 能讀到的 user 文字只有 issue 留言，人只要留一句「可以 merge」，這三行就是現成的合理化依據。P18 的 `noMerge` 只驗 §Squash merge 裡有一行同時含 `headless` 與 `永不`，驗不到這三處。
後果：merge 進 main 不可逆，而這是 spec 唯一標成「永不」的紅線。
建議改法：`:12` 句尾加「headless 時無此例外」；`:139` 那列加「**headless 時不適用**：無人環境沒有 session 級授權的成立條件」；`:201` Red Flags 真相欄加「headless 時連 session 級授權都不成立」。P18 把 `noMerge` 從「一行」改成「§Squash merge 節內含 `headless` 的行 ≥2」，成本一樣低。

**5. 下一輪找不回 snapshot，或找到別的 issue 的 snapshot**
位置：plan Task 3（devwork 1.5「`docs/snapshots/` 有本 issue 的 snapshot」）對上 `skills/context-resume/SKILL.md:12`（`Glob docs/snapshots/**/*.md` 依檔名 ts 取最新）與 `skills/context-snapshot/SKILL.md:104`（檔名 `<topic-slug>-<ISO-ts>.md`，不含 issue）。
問題：檔名裡沒有 issue 編號，`source_issue` 只在檔案內容裡，而 context-resume 的找法是「取最新一份」。同一個 workspace 排程跑兩個 issue，第二輪就會接到另一件事的 snapshot 繼續做。另外 `docs/snapshots/` 進 `.gitignore`，workspace 一旦重建 snapshot 就沒了，此時 issue 上已經有 `bstack-ask` 留言，AI 卻從 Phase 0 重跑，重開 branch、重寫 spec、重問一次同樣的問題。
後果：前者是接錯任務並 commit 到錯的 branch；後者是每輪都在 issue 下長出一則新的重複提問，正是 `waiting` 不重問想避免的洗版，只是換了個路徑發生。
建議改法：(a) context-snapshot 在 headless 時檔名帶 issue：`<issue-n>-<topic-slug>-<ts>.md`，或 context-resume 的 headless 分支改成「掃 `docs/snapshots/`，比對 `source_issue` == 本輪 issue，取其中最新」，兩者擇一寫死在 §讀回覆。(b) §偵測 補一條 blocked：「issue 已有 `<!-- bstack-ask` 留言、但本地找不到對應 snapshot → **blocked**，寫 `blocked_reason: snapshot-lost`，**禁**重跑 Phase 0。」這條同時把 spec §待釐清 的「全新 clone 不支援」從口頭前提變成可執行的偵測。

### Major（強烈建議）

**6. review-plan 的 Red Flags 與新句打架**
位置：`skills/review-plan/SKILL.md:137`「review 沒 critical 就直接過 → 仍要走 user gate」，plan Task 5 在第 6 步加「無 critical 採 accept」。
後果：AI 挑一條照做且不報錯。plan Task 4 記得改 dev-workflow、brainstorm、context-resume 三張 Red Flags 表，漏了這張。
建議改法：真相欄尾加「；headless 時無 critical 可 A 類 accept，見 `headless-mode`」。

**7. receive-review 的 T3「必給 user 看 diff」有兩處未改**
位置：`skills/receive-review/SKILL.md:36`（§不危險處置 第 4 點 T3 特例）、`:88`（Red Flags「T3 也偷偷 auto-fix 不告訴 user」），plan Task 5 只改第 5 步。
後果：T3 是 headless 最可能跑的量體，這兩行留著就是「headless 直接 commit」的反對票，而且 Red Flags 的措辭（「偷偷」）會讓 AI 傾向不照 headless-mode 走。
建議改法：兩處各加「headless 時直接 commit，diff 落 `docs/work/<branch-name>/review-fixes.diff`，路徑寫進 PR body」。

**8. 新 skill 缺「使用契約」段，載入後第一步做什麼沒寫**
位置：plan Task 2 Step 3 全文（frontmatter 之後直接進 §偵測）；對照 `skills/write-skill/SKILL.md` §SKILL.md 結構 要求的「## 使用契約（強制）／載入後立即動作」。
問題：其餘 27 個 skill 都有這段。headless-mode 的六節各自自足，但沒有一段說「被載入時先做什麼」——先跑 §偵測，還是先讀 state 的 `headless`？誰負責寫 `state.headless`（§hand-off state 註解說 devwork 寫，但 devwork 1.5 的 resume 分支沒寫，見 12）？
後果：接手的 AI 從中間某節開始讀，容易跳過偵測直接套分流表。
建議改法：§偵測 之前加「## 使用契約（強制）／載入後立即動作」四步：1 跑 §偵測 判定並寫 `state.headless` / `source_issue`；2 非 headless → 卸載本檔、照原流程；3 headless → 決策點一律查 §分流表，不自判；4 每輪最後一行照 §本輪結束協定。

**9. 人回了覆卻得不到任何確認，`waiting` 也沒有上限**
位置：Task 2 §讀回覆 第 4 點、§問人格式 模板。
問題：AI 讀到合格回覆後直接繼續做，不在 issue 留任何確認；沒讀到就靜靜結束，也不留任何痕跡。GitHub 通知上看到的是：我回了「1」，然後幾小時沒動靜。
後果：人無法分辨「已收到、正在做」「格式不合被忽略」「排程壞了」三種狀態，最可能的反應是再回一次、或改用自然語言回一次，而那更不會被接受。
建議改法：(a) 讀到合格回覆後，回一則一行留言：「已讀到選項 `<n>`：<選項文字>，繼續 <phase>。」成本一則留言，換掉整個猜測空間。(b) `pending_question` 加 `reminded: <bool>`，連續 `waiting` 超過 N 輪（建議 12，約一天）補一則提醒，只補一次，`reminded` 設 true 後永不再提。這仍然守住「不每輪刷留言」的原意。

**10. 編號解析太嚴，人用最自然的寫法回覆會被當成沒回**
位置：Task 2 §讀回覆 第 2 點 `^\s*(\d+)\s*$`。
問題：不吃 `1.`、`1)`、`#1`、全形「１」，也不吃「選 1」。手機輸入法常自動補標點。
後果：人以為答了，AI 每輪 `waiting`，配合 9 的無確認，整條任務靜止而雙方都認為球在對方那。
建議改法：放寬成 `^\s*[#＃]?\s*([0-9０-９]+)\s*[.)、。]?\s*$`，全形數字先正規化。這仍然是可窮舉、無歧義的比對，不觸犯 rules.md §決策點選單 禁的「文字 token NLP」。模板那句改成「第一行只寫編號（`1`，或 `1.`）」。

**11. docs 站有兩處會靜默過期，且 plan 沒跑 docs 站契約**
位置：`docs/index.html:505` 的 inventory 敘述「流程的十三個階段步驟、**九條**按需載入的跨流程 skill、兩條設計 lane、四條 meta」（13+9+2+4=28）、`docs/js/data.js:414-422` 的 `crosscut` 清單（目前 5 項，headless-mode 該進去）；plan Task 6 只改數字，且 Step 4 只跑 `plugin-contract` 與 `build-references -Check`。
問題：P8 的 inventory 斷言是 `>skills</span>` 後 400 字內的數字，抓不到「九條」這三個字；data.js 的 crosscut 清單沒有任何契約守。
後果：站上寫 29 個 skill，但拆解加起來是 28，且左側「跨流程 skill」列表查不到 headless-mode——而這支 skill 正是條件載入型、最需要被查到的那類。
建議改法：Task 6 Step 3 併改「九條→十條」與 data.js crosscut 加 `{ name: 'headless-mode', docKey: 'LoadHL', desc: '無人環境的決策點分流' }`；Step 4 的驗證指令加 `node docs/tools/docs-site-contract.mjs`（C18 會驗新 skill 能不能在站上點開，那條是這次唯一真正相關的守）。

**12. devwork 1.5 的 resume 分支沒寫 state**
位置：plan Task 3 Step 3 devwork 1.5：「…→ 直接載 `context-resume`（不進第 2、3 步）；否則照第 2 步往下，state 帶 `headless: true`、`source_issue`。」
問題：`headless: true` 只寫在「否則」那一支。走 resume 的那一支跳過第 2、3 步，state 由 snapshot 還原——但 snapshot 若是上一輪 `blocked` 存的、或欄位缺漏，就沒有 `headless`。
後果：接續的 phase skill 讀不到 `state.headless`，分流句的前提判不出來，行為退回互動模式並印出沒人回答的問題。
建議改法：1.5 改成「兩支都先寫 `state.headless: true` 與 `source_issue`，再分流」。

**13. `blocked_reason` 用到但沒定義**
位置：Task 2 §本輪結束協定 表最後一列用 `blocked_reason`，§hand-off state 的 yaml 四個欄位裡沒有它。
後果：契約 P18 不驗欄位，下一輪讀 snapshot 的 AI 不知道該去哪裡找停機原因，只能重跑。
建議改法：§hand-off state yaml 加 `blocked_reason: <一句 | null>`，並同步進 plan Task 4 的 context-snapshot §快照結構 三欄改四欄。

**14. cmd-guard L4 的收尾說法兩處不一致**
位置：Task 2 §分流表「cmd-guard L2 / L3 → B；L4 照舊拒絕」對上 §本輪結束協定「`blocked` ← 偵測第 3 條不中、或 cmd-guard L4」。
問題：「照舊拒絕」的原文（`skills/cmd-guard/SKILL.md:24`）是「要 user 顯式說『我知道風險、跑』才執行」，也就是拒絕後流程還在原地等；結束協定卻說這輪應該以 `blocked` 收掉。
後果：AI 拒絕了危險指令之後不知道該繼續跑下一步、還是結束本輪，兩種都能從文件裡讀出來。
建議改法：分流表那列改成「L4 拒絕並 **blocked** 結束本輪（`blocked_reason: cmd-L4`）；L2 / L3 → B」。

**15. rules.md 新段放 §決策點選單 合理，但不能只放 hosts.md**
位置：review 問題 5 的直接回答，作法併在 Critical 3 的建議 (a)。
理由：跟 headless 打架的絕對禁令全部寫在 rules.md 本體——§協作模式判定「一律等 user 選」、§Tier「Tier 必經 `AskUserQuestion` 確認」、§Auto-fix「危險類必問」、§Fail handling。hosts.md 位階低於 rules.md，只在 hosts.md 指向解不掉位階衝突，AI 照「rules.md 勝」就會忽略它。維持 2 行、但措辭要能覆蓋全檔（「本檔各節寫的『必經』『一律等』改讀 §分流表」），常駐成本不變而覆蓋面從一節變成整份。

### Minor（可選）

**16. execute-plan 前端大改 gate 的「無人值守時停在這裡等」該改寫而非尾加**
位置：`skills/execute-plan/SKILL.md:51`，plan Task 5 是在該段尾加一句。
問題：原文「**無人值守**時停在這裡等，**不得自選**」在 headless 語境等同靜默停機，和新句的「留言後結束本輪」是同一件事的兩種說法。
建議改法：直接把 `:51` 改寫成「**無人值守**時不得自選：headless 走 `headless-mode` B 類（留言後結束本輪），其餘情境停在這裡等」。

**17. brainstorm spec 範本的註解行會出現在每一份互動模式 spec 裡**
位置：plan Task 4「brainstorm spec 範本 `## 待釐清（如有）` 下加註解行 `<!-- headless 時必有子標題… -->`」。
問題：範本是所有 T1+ task 共用的，這行會被抄進每一份 spec，包含完全與 headless 無關的。
建議改法：改寫進 brainstorm 的 spec gate 段落內文（「headless 時先寫入『headless 自動採用』子清單」已經寫了），範本本身不動。

**18. P18 的 `phases` 斷言只驗字樣存在**
位置：plan Task 1 `missPhase` 的 `/headless-mode/.test(...)`。
問題：某個 skill 只要在 Red Flags 表提一句就會綠，加不加在真正的決策點上驗不出來。plan 註解已誠實承認這點。
建議改法：至少把斷言收緊成「該檔含 `headless` 的行 ≥ 該檔決策點數」，或在 P18 的失敗訊息裡列出每個 skill 應該落點的段名，讓下一個改這支契約的人知道該去哪裡看。

**19. 留言模板的 `snapshot: <path>` 對手機讀者是噪音**
位置：Task 2 §問人格式 最後一行。
問題：本地路徑對在 GitHub 通知裡看到這則留言的人沒有任何可操作性，而 branch 名沒有連結。
建議改法：換成 branch 的 GitHub 連結（`https://github.com/<repo>/tree/<branch>`）；snapshot 路徑留在 snapshot 自己和 state 裡就好。

**20. 模板沒寫「不回會怎樣」**
位置：同上。
建議改法：回覆方式那行後補一句：「我下一輪會回來看；沒看到合格回覆就靜靜等，不會再留言。」一句話解掉「AI 是不是死了」，跟 Major 9 的一次性提醒互補。

**21. spec 與 skill 的回覆錨定方式不一致**
位置：spec.md:119「取 `<!-- bstack-ask -->` 標記之後、最新一則…」對上 Task 2 §讀回覆 第 2 點「只看 `pending_question.asked_at` 之後的留言」。
問題：skill 是單一真相沒錯，但 spec 留著另一套寫法，後續改這塊的人會以為有兩層條件。
建議改法：施工時順手把 spec 那句對齊成 `asked_at`，或明寫「標記只給人看、機器用 `asked_at`」。

### Nit（風格）

**22. 「A 類 / B 類」在 description 先出現、正文到 §分流表 才定義**
位置：Task 2 frontmatter 第一行「決策點 A / B 分流」對上 §分流表 開頭的定義。
建議改法：§偵測 之前的導言那段補半句「決策點分兩類：A 類自己採推薦並記錄、B 類留言問人後結束本輪，對照表見 §分流表」。

**23. 分流表的粗體用法不一致**
位置：Task 2 §分流表 類別欄，`**B**` 多數加粗、`A` 不加粗、`A / **B**` 混用。
問題：讀起來像粗體帶有額外語意（更嚴格？必須？），實際只是強調。
建議改法：類別欄一律不加粗，或 A、B 都加粗，二選一。

**24. 「guard 擋在受保護 branch」與 rules.md 用語不一致**
位置：Task 2 §分流表 branch 名那列。
建議改法：rules.md §Branch safety 的用語是「主分支（`main / master / production / prod / release`）」，沿用同一個詞。
