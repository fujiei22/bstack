## Design 視角 review

> 標的：`docs/work/feat/headless-mode/spec.md` 與 `plan.md`
> 視角：跨模組契約與對外介面（skill 之間的 hand-off、對呼叫端 phase skill 與外層 harness 的介面）

### Critical（必須處理）

**C1. 下一輪找不到「本 issue 的 snapshot」，跨輪鏈在第一步就斷**
位置：`plan.md:277`（devwork 1.5「`docs/snapshots/` 有本 issue 的 snapshot」）、對照 `skills/context-snapshot/SKILL.md:104`、`skills/context-resume/SKILL.md:12`。
問題：snapshot 檔名是 `<topic-slug>-<ISO-ts>.md`，`topic-slug` 對齊 branch 名，**不含 issue 編號**；context-resume 既有的找法是「Glob 全部、取檔名 ts 最新」。plan 只寫「有本 issue 的 snapshot」，沒有定義怎麼判定「本 issue 的」。Task 4 雖然把 `source_issue` 加進快照 yaml，但 §偵測 與 devwork 1.5 都沒說要拿它過濾。
後果：同一個 workspace 只要有第二個任務（人自己跑過 `/devwork`、或 autopilot 處理過別的 issue），下一輪會撈到**別的任務**的 snapshot，帶著錯的 branch、錯的 `pending_question` 繼續做，而且它會誤把別人的 issue 留言當成自己的回覆。
建議：在 §偵測 加一步「定位本輪 snapshot」：`grep -l "source_issue: .*#<n>" docs/snapshots/*.md` 取檔名 ts 最新者，找不到才視為新任務；並把 issue 編號放進檔名（`docs/snapshots/issue-<n>-<topic-slug>-<ts>.md`）當第二道保險。P18 可加一條斷言守「§偵測 含 `source_issue` 字樣」。

**C2. workspace 沒持久時會把舊任務當新任務，每兩小時重做一次**
位置：`plan.md:140`（§偵測「前提」段）、`spec.md:33`、`spec.md:161`。
問題：「workspace 跨輪持久」目前只是一句聲明，沒有任何檢查。snapshot 不見時的行為未定義，落到預設路徑就是「當新任務跑 Phase 0」。
後果：部署一旦是每輪全新 clone（或 harness 在輪間清了工作區），同一個 issue 會被反覆從頭實作，每輪開一條新 branch、貼一則新的 `bstack-ask` 留言，而 §讀回覆 的「不重問」保護完全失效，因為每輪都是「第一次問」。
建議：§偵測 加一條可機械執行的前提檢查：issue 上已存在 `<!-- bstack-ask:` 留言、但本地找不到對應 snapshot → `blocked`（原因寫「workspace 未持久」），不得當新任務開始。這條比聲明式的「前提」有用得多。

**C3. `done` 之後沒有終止狀態，下一輪會整件事重做**
位置：`plan.md:209`（狀態表 `done` 列）、`plan.md:277`（devwork 1.5 只判 `pending_question` 非空）。
問題：`done` 定義為「finish-branch 開好 PR」，但 PR 開了不等於 issue 結束（等人 merge）。下一輪 devwork 找到 snapshot、`pending_question` 為 null，於是照 1.5 的 else 分支「照第 2 步往下」，也就是重進 Phase 0。
後果：PR 開好之後每兩小時重跑一次同一個任務，累積重複 branch 與重複 PR。這是本設計最貴的失效模式，而且它會在成功路徑上發生，不是邊角。
建議：state 加終止旗標（例如 `round_outcome: done` 或 `pr_url` 非空即視為終止），devwork 1.5 先判它：已 `done` 且 PR 仍 open → 只印 `done` 那一行結束，不進任何 phase；PR 已 merge 且 issue 未關 → 做 §Merge 後 docs 歸檔再結束。

**C4. `pending_question` 何時清成 null 只寫在 yaml 註解，§讀回覆 沒有這一步**
位置：`plan.md:220`（註解「讀回覆成功後清成 null」）、`plan.md:190-195`（§讀回覆 四步，無清除步驟）、`spec.md:133-144`（state 定義完全沒提清除）。
問題：清除語意只存在於註解，執行步驟裡沒有「清 `pending_question` 並重存 snapshot」的動作。
後果：讀到回覆、接續執行、然後這一輪因為任何理由沒走到結束協定（context 用完、被 timeout 砍），下一輪讀回舊 snapshot，`pending_question` 還在、那則回覆也還在 `asked_at` 之後，於是同一個決策被**再套用一次**。若該決策是 rollback 或退回上層 phase，就會反覆回捲。
建議：§讀回覆 第 3 步明寫「先清 `pending_question` 為 null、立刻重存 snapshot，再接續 phase」，順序不可顛倒；§hand-off state 的欄位說明同步寫入，不要只留註解。

**C5. 分流表外的決策點沒有預設行為，且 safety-guard 構成死結**
位置：`spec.md:15`、`plan.md:45`（P18 條目 e 的 11 個 skill）、對照 `skills/safety-guard/SKILL.md:75`、`skills/verify-done/SKILL.md:27`、`skills/security-audit/SKILL.md:46`、`skills/frontend-test/SKILL.md:100`。
問題：實際帶決策點的 skill 至少 21 個，本次只接線 11 個。漏掉的當中有四個在 T3 主路徑上必經：verify-done 失敗處置、security-audit critical gate、frontend-test FAIL 處置、safety-guard 的 secret 處置。而 §問人格式 又規定「留言前必載 safety-guard」，safety-guard 命中 secret 時自己要 `AskUserQuestion`：**B 類留言的前置步驟本身是一個沒有 headless 分流的決策點**，這是死結。
後果：P18 註解自己寫的那句就是後果，跑到沒分流的決策點會印一個沒人回答的問題然後那一輪白跑；safety-guard 這條更糟，它卡在「問人」這個動作的路上，連 `asked` 都印不出來。
建議：兩件事一起做。(1) §分流表 末尾加一條**兜底規則**：「表中未列的任何決策點一律 B 類」，rules.md §決策點選單 的 headless 段寫同一句，讓漏改的 skill 有安全預設。(2) 把 safety-guard、verify-done、security-audit、frontend-test 補進接線清單（11 → 15），其中 safety-guard 必須明寫「headless 時偵測到 secret → 不留言、不 push、直接 `blocked`」，避免把 secret 貼進 issue。

**C6. 人回了但格式不合，跟沒回是同一個處置**
位置：`plan.md:193-195`（regex `^\s*(\d+)\s*$` 與「沒有合格回覆 → `waiting`、不重問」）。
問題：真人回覆最常見的寫法是 `1.`、`選 1`、`#1`、`1、因為…`，全都不匹配裸數字 regex。設計把「格式不合」與「還沒回」歸為同一分支。
後果：人明明回了，AI 每輪印 `waiting` 不吭聲，任務永久靜默卡住，而且「不重問」這條刻意的保護讓人永遠收不到提示。這是可預期的高頻失敗。
建議：(1) regex 放寬為 `^\s*#?(\d+)\s*[.、)]?\s*$`。(2) 更關鍵的是分支要拆開：`asked_at` 之後**有新留言但無法解析** → 回一則澄清留言（帶 `<!-- bstack-reask -->` 標記，同一則提問只回一次，靠標記存在與否判斷）後結束本輪；`asked_at` 之後**完全沒有新留言** → 才是 `waiting` 且不留言。

**C7. `[bstack headless]` 與 `[Trace]` 都聲稱要在「最後一行」**
位置：`spec.md:123-126`、`plan.md:199`，對照 rules.md §Trace 標籤 與 `skills/dev-workflow/SKILL.md:149`（「每輪 AI 回覆結尾貼一行」）。
問題：兩條規則都宣告自己是結尾那一行，spec 與 plan 都沒處理衝突。rules.md 位階高於 skill，照現行文字 Trace 會贏。
後果：harness 取「最終訊息的尾巴」當短期記憶，抓到的是 Trace 而不是狀態行，整個結束協定對 harness 失效；而且每輪由模型自行擲筊決定誰在後面，輸出不穩定。
建議：在 headless-mode §本輪結束協定 **與** rules.md §Trace 標籤 兩處同時寫死順序：headless 時 `[Trace]` 在倒數第二行、`[bstack headless]` 在最後一行。P18 可順便守「rules.md §Trace 標籤 節內含 `bstack headless`」。另外明寫這一行不得包在 code fence 內，否則 harness 抓到的最後一行是 fence 結尾那三個反引號。

---

### Major（強烈建議）

**M1. `asked_at` 用本地時鐘，和 GitHub 的 `createdAt` 不同源**
位置：`spec.md:143`、`plan.md:193`（「只看 `asked_at` 之後的留言」）。
問題：`asked_at` 由 AI 在容器裡寫，比對的 `createdAt` 是 GitHub server 時間。容器時區沒設 UTC、或時鐘漂移，過濾就整個錯位；寫成本地時間會把先前的回覆誤判成新回覆。
後果：過濾窗口偏移，舊回覆被當新回覆重複套用，或新回覆被吃掉變成永久 `waiting`。
建議：留言後從 `gh` 回傳取該則的 `createdAt` 與 comment id 寫進 `pending_question`，過濾改用「id 大於它」或「createdAt 晚於它」。更乾淨的做法見 M6：直接用 `<!-- bstack-ask: -->` 標記那則留言當錨點，本地時鐘就完全不進入契約。

**M2. snapshot 與留言互為前置，順序有循環依賴**
位置：`plan.md:186`（留言前必做三項，第 3 項是「載 context-snapshot 存 `pending_question`」）、`plan.md:224`（`pending_question.comment_url`）。
問題：`comment_url`（和 M1 的 `createdAt`）只有留言之後才拿得到，但步驟要求留言前就把 `pending_question` 存進 snapshot。
後果：實作時只能二選一，於是 `comment_url` 永遠是空的，或 snapshot 根本沒寫成，下一輪定位不到那則提問。
建議：明寫三段順序：push 與 safety-guard → 存 snapshot（`pending_question` 先不含 `comment_url` / `asked_at`）→ 留言 → 用回傳值補齊並**覆寫同一個 snapshot 檔**（不是新開一個 ts 檔，否則 context-resume 取最新會拿到不完整的那份）。

**M3. `source_issue` 有三種表示法，且 `gh` 沒帶 `-R`**
位置：`spec.md:71`（接受 `123` 或 `owner/repo#123`）、`spec.md:135`（型別 `<owner/repo#n | null>`）、`spec.md:126`（協定字串印 `#<n>`）、`plan.md:169`、`plan.md:192`（`gh issue comment <n>` / `gh issue view <n>`）。
問題：同一個識別在契約裡有三種形狀；所有 `gh` 呼叫都只給編號，repo 靠 cwd 的 remote 推斷。
後果：fork、多 remote、或 workspace 的 origin 不是 issue 所在 repo 時，留言會貼到錯的 repo，而且不會報錯。
建議：state 統一存正規化後的 `owner/repo#n`（`BSTACK_ISSUE` 只給數字時用 `gh repo view --json nameWithOwner` 補），所有 `gh` 呼叫一律帶 `-R <owner/repo>`。

**M4. 第一輪的需求文字從哪來，沒有寫**
位置：`spec.md:71`、`plan.md:136`（§偵測 只解析 issue **編號**）。
問題：brainstorm 0a 要 paraphrase、0d 要抓 success criteria，這些需要需求敘述。harness 若只傳 `#123`，brainstorm 手上沒有任何內容。
後果：第一輪就走進 0a 歧義（B 類），每個任務的第一輪必然浪費在問一個 issue 裡早就寫好的問題。
建議：§偵測 之後加一步「headless 時任務敘述來源 = `gh issue view <n> --json title,body`，devwork 參數只當識別用」，並在 spec §動機 註明 issue 內容即 user prompt。

**M5. 模板沒有「以上皆非」，違反 rules.md §決策點選單**
位置：`plan.md:171-184`（§問人格式 模板）。
問題：rules.md 要求選單附 `Other`。模板只有編號選項，且 §讀回覆 只解析數字，人寫自由文字等於沒回。
後果：人想給第三條路（最常見的情況就是「你問錯問題了」），沒有合法的表達方式，只能被系統忽略。
建議：模板固定加一列 `0. 以上皆非，請直接寫你要的做法`，§讀回覆 定義 `0` 的處置（第二行起的文字當 user 指示，寫進 state 供該 phase 使用），0a 開放題的自由文字規則併入這條。

**M6. 回覆來源沒有作者過濾，任何路人都能左右流程**
位置：`plan.md:192-194`。
問題：只按時間與第一行格式取留言，沒看 `author`。AI 自己的 `done` 留言目前剛好第一行是 URL 所以不會誤中，但這是巧合不是契約；公開 repo 上任何人留一個 `2` 就能替專案做 Tier、rollback、conflict resolution 的決定。
後果：信任邊界外的人可以指揮除 merge 以外的每一個決策；同一組 token 跑兩個容器時也會互相吃到對方的留言。
建議：§讀回覆 明寫兩層過濾：排除作者等於自己（`gh api user --jq .login`）的留言；只採信 `authorAssociation` 屬於 OWNER / MEMBER / COLLABORATOR 的留言，其餘忽略並在下一則澄清留言註明。同時把 `<!-- bstack-ask: -->` 標記升格為機器錨點（現在它只給人看，P18 也只 grep 字樣），用它定位最後一則提問。

**M7. 四個狀態沒涵蓋全部結束路徑**
位置：`spec.md:126`、`plan.md:205-210`。
問題：至少四條路徑落在四狀態之外。
1. T0 直接實作完，不進 finish-branch、沒有 PR URL，`done` 的必做事項不成立。
2. verify 全綠但 `gh pr create` 失敗（權限、無 remote、PR 已存在），這是工具錯誤不是決策，列成 B 類去問人也問不出選項。
3. devwork 第 2 步判為純問答，沒有任何 issue 決策。
4. 本輪被 timeout 或 context 耗盡砍掉，不會印任何行。

後果：harness 的 journal 出現無法歸類的輪次，或是硬塞進錯的狀態（例如把工具失敗記成 `asked`，人卻看不到任何要回答的問題）。
建議：把 `blocked` 的定義從「偵測第 3 條不中、或 cmd-guard L4」擴寫成「本輪無法前進且不是在等人回答」的統稱，並列舉 `gh` 不可用、push 或 PR 開啟失敗、workspace 不一致；`done` 的必做事項改成「有 PR 則貼 URL，T0 無 PR 則貼 commit sha」；明寫「沒有這一行 = 本輪異常中止」的語意，讓 harness 能分辨。

**M8. `AUTOPILOT_LABEL` 把 bstack 綁在某個 harness 的實作細節上**
位置：`spec.md:70`、`plan.md:135`，P18 條目 c / d 也把這個字樣寫進契約。
問題：`AUTOPILOT_LABEL` 是 claude-autopilot 的變數名，卻被拿來當「我是不是無人模式」的判準。換成 cron 加 `claude -p`、GitHub Actions、Jenkins，都得偽造一個叫這個名字的變數。
後果：別的排程器要用這個模式，必須設一個跟自己毫無關係的環境變數；契約腳本又把這個外來名字釘死，以後改名要動 rules.md、hosts.md、skill 與 P18 四處。
建議：主判準改用自家命名空間 `BSTACK_HEADLESS=1`，`AUTOPILOT_LABEL` 非空保留為相容退路，兩者取 OR。契約守兩個字樣都在。`BSTACK_ISSUE` 命名沒問題，維持。

**M9. `gh` 硬綁 GitHub，且沒有啟動前檢查**
位置：全篇 §問人格式 / §讀回覆 / §本輪結束協定。
問題：repo 既有設計原則是把工具抽象成動詞（hosts.md 的整張對照表就是為了這個），headless-mode 直接寫死 `gh`，GitLab 要換 `glab`、Gitea 要換 `tea`。而且 `gh` 未安裝或未認證時，會在流程中段才炸掉，那時可能已經開了 branch、寫了 code。
後果：非 GitHub 部署不是「不支援」而是「跑到一半壞掉」，留下一堆半成品 branch。
建議：不必真的做抽象層，但 §偵測 要把「GitHub 加 `gh` 在 PATH 且已認證」寫成**可檢查的第 4 條前提**：`gh auth status` 失敗 → `blocked`，在動任何檔之前就結束。非 GitHub 部署明寫不支援。

**M10. push 失敗沒有處置，B 類留言會指向不存在的 branch**
位置：`spec.md:115`、`plan.md:186`（「留言前必 push」）。
問題：只寫必做，沒寫失敗怎麼辦。憑證過期、被 pre-push hook 擋、branch 保護規則都會讓它失敗。
後果：留言寫著 `branch: feat/xxx`，人去 remote 找不到；下一輪也以為 code 已經在 remote 上。
建議：push 失敗 → `blocked`，留言（若還能留）明寫「code 未推上 remote」，並在 snapshot 記 `blocked_reason`。

**M11. `auto_decisions` 只有 `chosen` 與一句 `reason`，人無法反推當時的判斷**
位置：`spec.md:96`、`spec.md:137-138`、`plan.md:351`（PR 模板四欄）。
問題：`reason` 一句在實務上多半會寫成「符合 T2 判準」這類同義反覆。spec §風險 自己說「Tier 推薦錯會走錯 lane，但錯的 Tier 會在 PR body 被人看到」，可是人只看到 chosen，看不到**當時有哪些選項**，也就看不出錯在哪、錯得多遠。
後果：PR body 的表變成「AI 說它做了什麼」而不是「人可以複查的決策紀錄」，事後追責與修正都少一半資訊。
建議：`auto_decisions` 加 `alternatives`（未採用的選項文字，逗號分隔即可）與 `at`（ISO 時間，用來分辨哪一輪決的），PR 表擴成六欄。成本是每筆多一句，換到的是決策可稽核。

**M12. `pending_question` 缺「回到哪個決策點」的定位資訊**
位置：`spec.md:139-144`、`plan.md:220-224`。
問題：`phase` 只到 skill 粒度。brainstorm 一個 skill 內就有三個 gate（0a 歧義、0c/0d 合併確認、spec gate），receive-review 有四處。下一輪拿到「回覆是 2」，光靠 `phase` 加 `current_phase` 無法回到正確的決策點。
後果：接續時把編號套到錯的選單上，等於人選了 A 系統做了 B。
建議：`pending_question` 加 `decision_id`（例如 `brainstorm/spec-gate`、`execute-plan/task-fail#3`）與 `resume_hint`（一句「收到編號後要做什麼」），§分流表 每一列順便給一個固定的 `decision_id`，這張表就同時是 id 的單一真相。

**M13. headless 下 spec 沒有任何人看過就直接施工**
位置：`spec.md:82`（spec gate = A 類選 1）、`plan.md:151`。
問題：A 類的 spec gate 意味著範圍、Track、Tier 全是 AI 自己定，而且 spec 內容不進 issue。人第一次看到內容是 PR 階段，那時 code 已經全寫完。
後果：方向錯的任務要跑完整條 lane 才被發現，浪費的是整批 token 與一條 branch。
建議：spec 落檔後在 issue 留一則**不帶 `bstack-ask` 標記**的進度留言，附 spec 摘要與 `auto_decisions` 清單，**不等回覆、不結束本輪**。人若發現走偏可以當場喊停，成本遠低於 PR 才發現。這也讓 issue 成為完整的決策軌跡。

---

### Minor（可選）

**m1. `blocked_reason` 與 `headless` 兩欄在三處不一致**
`plan.md:210` 的狀態表提到 snapshot 要寫 `blocked_reason`，但 §hand-off state（`spec.md:133-144`、`plan.md:214-225`）沒有這個欄位。另外 Task 4 只把 `source_issue` / `auto_decisions` / `pending_question` 三欄加進快照結構（`plan.md:316`），`headless` 沒加，resume 後這個旗標從哪來沒寫。建議補齊 `blocked_reason`，並明寫「`headless` 每輪由 §偵測 重算、不從 snapshot 還原」，這樣人接手同一個 workspace 時才會自動回到互動模式。

**m2. snapshot 有兩處表達同一件事**
`skills/context-snapshot/SKILL.md:82-84` 既有的 `## Open question / pending user input` 段落，與新增的 `pending_question` yaml 欄語意重疊，誰是真相沒寫。建議明定 yaml 欄為機器真相，該段落改成人讀摘要並註明「由 `pending_question` 產生」。

**m3. state 沒有 `branch_name`，但協定字串與留言模板都要印 branch**
`branch_name` 目前只在 finish-branch 的 hand-off state 出現（`skills/finish-branch/SKILL.md:186`），而 B 類留言大多發生在 finish-branch 之前。建議 headless 明寫「branch 取 `git rev-parse --abbrev-ref HEAD`」，或把 `branch_name` 提升到 dev-workflow 的共用 state。

**m4. 協定字串的分隔符與內嵌文字沒有約束**
`·` 是 U+00B7，某些 log 管線會轉碼；`<一句>` 若含 `·` 或換行就破壞欄位切分。建議明寫 `<一句>` 禁含 `·` 與換行、長度上限，並把 issue 與 branch 固定放在尾端。

**m5. `review-fixes.diff` 是新的落檔產物，沒進 rules.md §Docs 落檔**
`spec.md:85`、`plan.md:154`。這個檔會隨 `docs/work/<branch-name>/` 被 finish-branch 搬進 archive，且內容是完整 diff、可能含 secret，而 safety-guard 目前只掃留言。建議在 rules.md §Docs 落檔 或 receive-review 明列這個檔名與保留期，並讓它走一次 safety-guard。

**m6. PR 模板「headless 時必填，否則刪」**
`plan.md:352`。互動模式要記得刪掉一個空表，很容易忘。建議改成「headless 時在測試節之後**新增**此節」，模板本身不帶它。

**m7. `docs/snapshots/` 不在本 repo 的 `.gitignore`**
`skills/context-snapshot/SKILL.md:109` 寫「`docs/snapshots/` 進 `.gitignore`」，但本 repo 的 `.gitignore` 實際沒有這一條。headless 把「不 commit」從慣例升格成正確性前提，這個落差值得順手補掉，否則 snapshot 可能被 `git add` 帶進 PR，裡面有 issue 內容與決策紀錄。

**m8. dispatch-parallel 的 subagent 遇 B 類時，未 commit 的成果沒有交代**
subagent 沒有 issue context，hosts.md 的規則是回報主 agent 由它問；主 agent 在 headless 下會把它變成留言並結束本輪。此時其他 subagent 已完成但未 commit 的工作要保留還是丟棄，plan 沒寫。建議明寫「結束本輪前，已完成且 verify 過的 task 照常 commit，未完成的 `git stash` 並在 snapshot 記錄」。

---

### Nit（風格）

**n1. 同一個行為三處措辭不同**
context-resume 沒有 `pending_question` 時的處置，`spec.md:93` 寫「選 1」、`plan.md:162` 寫「接續下一步」、`plan.md:317` 寫「選項 1」。語意相同但讀起來像三條規則，建議統一成「接續下一步（等同既有選單的選項 1）」。

**n2. P18 的 `section` 與腳本既有的同名函式簽章不同**
`plan.md:67` 在 P18 的 block 內宣告 `const section = (text, head, level)`，而 `scripts/plugin-contract.mjs:497` 已有 `const section = (text, startRe)`。block scope 讓它合法，但同名不同簽章對後續維護者是陷阱。建議改名 `sec18`，或直接複用既有那支。

**n3. §分流表「branch 名」那一列的括號說明與現況不符**
`plan.md:150` 寫「guard 擋在受保護 branch」，`spec.md:81` 寫「guard.mjs 擋在 main」。受保護清單是五個（`main / master / production / prod / release`），spec 的寫法會讓人以為只有 main。以 plan 的措辭為準即可。
