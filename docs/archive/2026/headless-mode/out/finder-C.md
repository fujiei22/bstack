# finder-C（cross-file tracer）findings

## 已驗證、無問題的契約

- `gh issue view --json comments` 每則欄位（實測 `gh issue view 1 -R cli/cli --json comments -q '.comments[0] | keys'`）：`author, authorAssociation, body, createdAt, id, includesCreatedEdit, isMinimized, minimizedReason, reactionGroups, url, viewerDidAuthor`。parser 期望的欄位全在；`id` 是 GraphQL node id 字串，parser 原樣回傳，fixture 用數字 id 無影響。
- `gh issue comment` 沒有 `--json`（實測 `--help`），只印留言 URL。
- flow.html 的 doc drawer 用 `docIndex[name]`（skill 名）解析，不用 `docKey`；references-data.js 已含 `references/skills/headless-mode/SKILL.md`，`LoadHL` 連結可用。
- P8 對 README / hero / inventory / meta / SKILLS 清單 vs 磁碟 skill 數做精確比對，全部已更新為 29；P3a 是下限。
- dev-workflow「以下七欄」（含 `headless` 自身）與 context-snapshot「以下六欄」（從 `source_issue` 起算）一致。
- 各 phase skill 引用的 decision_id 全部存在於 §分流表。表列 `branch/name`、`receive-review/safe-fix`、`finish-branch/merge`、`context-snapshot/save`、`context-resume/direction` 在對應 skill 只以文字描述、未貼 id；表宣告為單一真相，可接受。

## Findings

```json
[
  {
    "file": "D:\\GitHub\\bstack\\skills\\headless-mode\\SKILL.md",
    "line": 111,
    "summary": "§讀回覆 tells the agent to feed `asked_at` (snake, the snapshot field) into headless-reply.mjs, but the script destructures `askedAt` (camel, line 6/27 of the script). No mapping is stated anywhere. With `askedAt` undefined the filter `String(c.createdAt) > String(askedAt)` compares against the literal string \"undefined\" and is false for every ISO timestamp.",
    "failure_scenario": "Agent builds stdin JSON with the snapshot's key `asked_at`. Parser returns `{status:'none'}` for every round even though the owner replied `1`. Round loops `waiting` 12 times, posts one reminder, then waits forever. The P19 fixtures never exercise a missing/misnamed askedAt, so the contract stays green."
  },
  {
    "file": "D:\\GitHub\\bstack\\skills\\headless-mode\\SKILL.md",
    "line": 105,
    "summary": "「留言後：從 gh 回傳取該則 id / url / createdAt」 is not satisfiable. `gh issue comment` has no `--json` flag and prints only the comment URL. `createdAt` cannot be obtained from it at all, and the only id in the URL is the numeric `#issuecomment-<n>` database id, which differs from the GraphQL node id that `gh issue view --json comments` returns and that the parser emits as `commentId`.",
    "failure_scenario": "Agent either leaves `asked_at` null (parser then compares against \"null\", always `none`, same stall as above) or fills it from its own clock (e.g. local `+08:00` or second-truncated ISO). The comparison is a plain string compare, so a local-time stamp sorts after GitHub's UTC `Z` stamp and the human's reply is filtered out. Fix at the doc level: after commenting, re-run `gh issue view --json comments` and take the last `viewerDidAuthor` entry's id/url/createdAt."
  },
  {
    "file": "D:\\GitHub\\bstack\\scripts\\headless-reply.mjs",
    "line": 32,
    "summary": "parseReply silently degrades to `none` when `askedAt` is missing, null, or not an ISO string, and when `optionCount` is undefined (`p.option <= undefined` is false, so every numbered reply becomes `unparseable`). The CLI exits 0 in these cases. Since the skill's caller is an LLM assembling JSON by hand, an input-shape guard is the only thing that would surface the contract mismatches above.",
    "failure_scenario": "Snapshot written at §問人格式 step 5 (before the comment is posted) has `asked_at: null`; the comment call then fails. Next round context-resume finds `pending_question`, feeds null askedAt, gets `none`, and the flow waits 12 rounds for a question that was never posted instead of going `blocked`. Suggest: exit 2 with a message when askedAt is not a parseable ISO timestamp or optionCount is not an integer, and add a fixture for it."
  },
  {
    "file": "D:\\GitHub\\bstack\\skills\\devwork\\SKILL.md",
    "line": 14,
    "summary": "Step 1.5 says dev-workflow will 「dispatch 到 context-resume 走 §讀回覆」, but dev-workflow has no such branch: its 使用契約 step 2 (D:\\GitHub\\bstack\\skills\\dev-workflow\\SKILL.md:13) unconditionally enters Phase 0, and the only mention of context-resume is the cross-skill table row (line 200) with trigger 「新 session 開始、user 顯式接續舊 task」, no headless/pending_question wording. Also, rounds that ended `blocked` (pending_question null, pr_url null, e.g. `push-failed`) fall into 「其餘照第 2 步往下」, so an existing snapshot mid-execute-plan is never resumed.",
    "failure_scenario": "Round N ends `blocked: push-failed` on branch feat/x with 3 committed tasks. Round N+1: devwork 1.5 sees no pr_url and no pending_question, goes to step 2 → dev-workflow → brainstorm 0a with the issue text, re-runs Track/Tier, tries `git checkout -b`, posts a second `<!-- bstack-progress -->` (the 「每個 issue 只發一次」 rule is unenforceable because the snapshot was never read). The `snapshot-lost` guard does not fire because the snapshot exists."
  },
  {
    "file": "D:\\GitHub\\bstack\\skills\\design-language\\SKILL.md",
    "line": 83,
    "summary": "design-language step 5 is a mandatory AskUserQuestion (「必經，不得自行定案」) with an obvious recommended option, plus a second one at line 140. It is reachable in headless (execute-plan loads it before/after any front-end task; verify-done §漏網複查). It has no headless line and is not in PHASE19, so P19 stays green. Same for design-direction (D:\\GitHub\\bstack\\skills\\design-direction\\SKILL.md:24 user picks a version, :193 rerun limit) which is reachable once a human answers `brainstorm/0cd-design-size` with 「出三版」, and whose 3-subagent spawn template (line 140) lacks the §子 agent 約束 paragraph.",
    "failure_scenario": "Headless T2 touching one .tsx file in a repo with no design-map.md: execute-plan loads design-language, step 5 hits AskUserQuestion, agent applies 「表外一律 B」 → posts `fallback/design-language` asking 「表正確，寫入？」 and ends the round. A whole round is burned on a question whose recommended answer is the default; the table should either classify it A or list it explicitly. For design-direction the three spawned subagents receive no 禁 gh issue comment / push clause."
  },
  {
    "file": "D:\\GitHub\\bstack\\skills\\context-snapshot\\SKILL.md",
    "line": 111,
    "summary": "Headless filename `issue-<n>-<topic-slug>-<ISO-ts>.md` with 「後續存檔覆寫同一檔」 conflicts with the two consumers that select by filename ts (headless-mode §偵測 line 36 「取檔名 ts 最新者」, context-resume line 12). Overwriting keeps the original ts, so 'latest' is meaningless; and the first headless snapshot can be written during Phase 0 (`brainstorm/0a-ambiguous` is a B point before `git checkout -b`), when `<topic-slug>` (= branch name) does not exist yet.",
    "failure_scenario": "Round 1 asks at 0a and saves `issue-42-<unknown>-2026-09-11T02-00-00.md`. Round 3, after the branch exists, an agent following the generic rule 「<topic-slug>-<ISO-ts>」 writes a second file `issue-42-feat-x-2026-09-11T05-00-00.md` (the overwrite instruction says 同一檔 but the slug in the name changed, so a fresh file is the literal outcome). Round 4 picks by ts and gets whichever was written last; if round 3 crashed after a partial write, the stale round-1 file with `pending_question` still set is re-read and the answered question is asked again. Suggest a fixed name per issue (e.g. `issue-<n>.md`) and drop ts from the headless filename."
  }
]
```

## Nit（無功能影響）

- `D:\GitHub\bstack\docs\index.html:660` 註解寫「側欄索引有 35 份（29 skill + 6 agent + rules.md）」，加總是 36。
