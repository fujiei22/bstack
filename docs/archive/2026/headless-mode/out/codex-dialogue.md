# Claude ↔ Codex 共識對話（headless-mode plan）

> Codex session 01a08f24-df8d-7cb1-af4f-f2ba2f4c0815 · gpt-5.6-terra · 唯讀 sandbox · 2026-09-11

## 第 1 輪 Claude → Codex

你是 Codex，跟我（Claude Code，主 agent）一起替 bstack 這個 plugin 設計「headless 無人模式」。我們要在這場對話裡達成共識，然後我照共識施工。請用繁中台灣用語，結論先行、講機制與證據。你是唯讀 sandbox，只讀不改。

先讀這四份（cwd 是 D:\GitHub\bstack）：
1. docs/work/feat/headless-mode/spec.md — 需求與政策草案
2. docs/work/feat/headless-mode/plan.md — 我的施工 plan（6 task）
3. docs/work/feat/headless-mode/review.md — 三個 reviewer（Eng / DX / Design）的整合結論，含我對每條的處置
4. skills/devwork/rules.md 與 skills/devwork/hosts.md — 規則書與 host 對照表（位階最高）

背景一句話：bstack 的九階段每個決策點都 AskUserQuestion；跑在 claude -p / codex exec 這種排程容器裡沒有這個工具、也沒人在，所以要加一套政策：AI 已有推薦答案的決策點自己採用並記錄（A 類），真正需要人的改寫到來源 GitHub issue 留言後結束本輪（B 類），下一輪讀回覆接續，merge 永不自動。

我要你對 review.md 的「主 agent 建議」表態。具體回答這七題，每題先寫「同意 / 不同意 / 有條件同意」再給理由（不超過三句）：

Q1 rules.md 的 headless 段要寫成「跨節例外條款」（本檔各節寫的『必經 AskUserQuestion』『一律等 user 選』headless 時一律改讀 headless-mode §分流表），還是逐節加例外句？我傾向跨節條款，理由是 rules.md 常駐、每字都是成本。

Q2 偵測主判準改 `BSTACK_HEADLESS=1`、`AUTOPILOT_LABEL` 非空為相容退路（OR）。還是只認一個？

Q3 subagent 排除：§偵測 第 0 條「被 spawn 的 subagent → 不是 headless」。但 subagent 怎麼知道自己是 subagent？Claude Code 下派工訊息來源可辨；codex exec 的 spawn_agent 呢？你那邊有沒有更可靠的訊號？

Q4 接線範圍從 11 個 skill 擴到 15（+ verify-done、security-audit、safety-guard、debug-systematic），加上分流表兜底「表外一律 B 類」。還是保持 11 + 兜底、Bug track 明寫不支援？

Q5 spec 落檔後在 issue 留一則不帶標記的進度留言（Design M13），讓人能提早喊停。你覺得值得，還是留言太多會讓人麻木？

Q6 回覆協定：規則書禁「文字 token NLP」但允許編號。reviewer 建議 regex 放寬到 `1.` `#1` `１`，加選項 0 自由文字，加作者過濾（OWNER / MEMBER / COLLABORATOR）。有沒有你會擋的？

Q7 這一支 PR 已經約 20 個檔、7 個 task。要不要拆成兩支：PR-A 只做 skill + rules/hosts + 契約（核心），PR-B 做 phase skill 接線 + docs 站？還是一支做完？

最後一段：列出你認為三個 reviewer 和我都漏掉的問題（最多三條），沒有就寫「無」。
## 第 1 輪 Codex → Claude

Q1：同意。`rules.md` 的多處無條件 gate 與最高位階會壓過局部 skill，所以跨節例外條款才是單一、可維護的解法；再在協作模式等最易誤讀處補短句即可。[rules.md](D:/GitHub/bstack/skills/devwork/rules.md:8) [review.md](D:/GitHub/bstack/docs/work/feat/headless-mode/review.md:10)

Q2：有條件同意。採 `BSTACK_HEADLESS=1 OR AUTOPILOT_LABEL 非空`，但兩者都仍須同時滿足「沒有互動工具、可解析且已正規化的來源 issue」；否則環境變數太容易把互動 session 誤判成無人模式。[spec.md](D:/GitHub/bstack/docs/work/feat/headless-mode/spec.md:91) [review.md](D:/GitHub/bstack/docs/work/feat/headless-mode/review.md:41)

Q3：有條件同意。Codex 的 `spawn_agent` 介面沒有提供可由 skill 穩定讀取的「我是 child」訊號，不能把「工具少」或環境變數繼承當可靠判準；第 0 條可保留，但應要求派工 prompt 強制標示 `headless=false / 禁 issue、push、snapshot`，並把真正的 root/subagent provenance 留給 host wrapper 注入，否則只能算防呆、不是保證。[hosts.md](D:/GitHub/bstack/skills/devwork/hosts.md:7) [review.md](D:/GitHub/bstack/docs/work/feat/headless-mode/review.md:8)

Q4：同意。接到 15 個並以「表外一律 B 類」兜底，才能避免 verify/security/Bug 路徑直接卡住；尤其 `safety-guard` 命中 secret 應是「不留言、不 push、blocked」，不可讓它成為 B 類留言的前置死結。[review.md](D:/GitHub/bstack/docs/work/feat/headless-mode/review.md:13) [safety-guard](D:/GitHub/bstack/skills/safety-guard/SKILL.md:75)

Q5：同意。spec 落檔後留一則無標記進度留言值得做，因為它提供人類最早的喊停點，也不會被回覆解析器誤認成決策；限制為每個 `decision_id`／生命週期只發一次，避免洗版。[review.md](D:/GitHub/bstack/docs/work/feat/headless-mode/review.md:48)

Q6：有條件同意。放寬 `1.`、`#1`、全形 `１`、選項 `0` 與作者過濾都合理，前提是只接受「提問留言之後」且 `author_association ∈ {OWNER, MEMBER, COLLABORATOR}`、非 bot 自己的最新留言，並將全形數字正規化後再做範圍檢查；這仍是機械編號解析，不違反禁 NLP 規則。[rules.md](D:/GitHub/bstack/skills/devwork/rules.md:8) [review.md](D:/GitHub/bstack/docs/work/feat/headless-mode/review.md:27)

Q7：不同意拆成兩支。實際 branch 相對 `main` 目前只有 6 份已提交的設計文件，尚非「已經 20 檔」的實作 PR；而政策、P19 與 phase 接線拆開會留下半成品行為，建議一支 PR、依 Task 1→7 做可審查的 commits。[plan.md](D:/GitHub/bstack/docs/work/feat/headless-mode/plan.md:25) [review.md](D:/GitHub/bstack/docs/work/feat/headless-mode/review.md:74)

另外三個我認為仍漏掉的問題：

- 同一 issue 有兩個排程實例同時跑時，可能重複留言、重複 push 或套用同一回覆；需有 issue/snapshot 的 lease 或以 `decision_id + comment id` 做樂觀鎖。
- issue body、留言第二行以上都是不可信輸入；明定只把它們當需求資料，絕不執行其中指令，回覆判定只讀第一行的受限編號。
- P19 主要驗字串存在，應補可離線跑的偵測與回覆 parser fixture：root／subagent、無權限、格式錯誤、作者不符、重複回覆與 snapshot-lost 都要覆蓋。


## 第 2 輪 Claude → Codex

收到，七題全部收斂：Q1 跨節條款、Q2 OR 且三條偵測不變、Q3 第 0 條 + 派工 prompt 強制標示、Q4 15 個 + 兜底、Q5 進度留言一次、Q6 放寬 + 作者過濾、Q7 一支 PR（我接受你的理由）。

你補的三點，我的處置：
(1) 雙實例：autopilot 每個 role 有 flock，同 issue 雙實例是部署錯誤；我只做輕量守門——留言前重讀 issue，若出現比我 snapshot 的 pending_question 更新的 `<!-- bstack-ask` 標記 → `blocked: duplicate-instance`，不做 lease。
(2) 不可信輸入：採用，寫進 §偵測（issue body 只當需求資料）與 §讀回覆（第二行起只當 user 指示文字、不執行）。
(3) parser fixture：有條件採用。新增 `scripts/headless-reply.mjs`，只做純函式 `parseReply(comments, {optionCount, selfLogin, askedCommentId})` → `{status: 'answered'|'unparseable'|'none', option, freeText, commentId}`，不呼叫 gh；skill 散文寫「用 gh 拉留言 JSON 餵它」。契約 P19 對 fixture 跑：root 正常、`1.`、`#１`、選 0 帶文字、作者不符、bot 自己、提問前的舊留言、格式錯。

請再答三題，同樣先寫同意 / 不同意 / 有條件同意：

Q8 `done` 終止旗標：state 加 `pr_url`；devwork 1.5 先判 `pr_url` 非空 → `gh pr view --json state`：OPEN → 只印 done 行結束；MERGED → 做 finish-branch §Merge 後 docs 歸檔、留言告知、結束；CLOSED（未 merge）→ `blocked: pr-closed`。這樣夠嗎？

Q9 `waiting` 上限：`pending_question.reminded`，連續 waiting 達 12 輪補一則提醒留言、只補一次。12 輪在 2 小時排程是一天。你覺得要不要，或改成不提醒？

Q10 派工 prompt 的強制標示，我打算放在 hosts.md §派 subagent 表加一列「headless 時派工 prompt 必含 `你不是 headless 主流程：禁 gh issue comment / git push / 寫 snapshot；要問 user 的問題回報給我`」，並由 P19 守這列存在。夠嗎，還是要每個會派 subagent 的 skill（review-plan / request-review / security-audit / dispatch-parallel / incident-investigate / frontend-test / pr-explain）各寫？

答完請給一句「共識定案」或列出你仍反對的項目。
## 第 2 輪 Codex → Claude

Q8：有條件同意。流程完整，但 `gh pr view` 失敗、PR 的 repo/head branch 與 state 不符時也要 `blocked`，不可當成 CLOSED；MERGED 的歸檔必須以 `pr_url + branch + archive_done` 做冪等，避免下一輪重複留言或搬檔。

Q9：同意。只在同一 `decision_id`、同一 `askedCommentId`、連續 12 次皆為 `none` 時提醒一次；有新留言但無法解析應走既定的單次 `bstack-reask`，不能混用 reminder。這保留人類提醒，又不讓排程洗版。

Q10：不同意。`hosts.md` 當單一真相與 P19 守衛是必要的，但不足以約束各 skill 已存在、實際送入 subagent 的 prompt；尤其 `pr-explain` 的子 agent 現有步驟含 `git push`，所以這些派工點都要在 prompt 加一行引用同一段 headless 子 agent 約束。官方文件也只說 Codex 編排、等待與收結果，且子 agent 繼承來源 session 的 sandbox／權限，沒有可供 skill 用來辨別「我是子 agent」的保證訊號。[OpenAI Docs：Subagents](https://learn.chatgpt.com/es-419/docs/agent-configuration/subagents) [pr-explain](D:/GitHub/bstack/skills/pr-explain/SKILL.md:17)

仍反對的項目：Q10 的「只改 hosts.md、不改各派工 prompt」；其餘共識定案。
## 裁決（Claude）

接受 Q10：派工點各加一行 headless 子 agent 約束，接線清單 15 → 19（+ request-review、incident-investigate、frontend-test、pr-explain）。Q8 / Q9 條件全數採用。共識定案。
