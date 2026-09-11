# headless 無人模式 Implementation Plan

> 對應 spec: `docs/work/feat/headless-mode/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-11
> 並行最大 group: 6

**Goal**: 讓 `/devwork` 在 `claude -p` / `codex exec` 這類無人環境（無 `AskUserQuestion` / `request_user_input`、`AUTOPILOT_LABEL` 非空）能走完流程：A 類決策採推薦並留紀錄，B 類決策寫到來源 GitHub issue 留言後結束本輪，下一輪讀回覆接續；merge 永不自動。

**Architecture**: 政策單一真相放新 skill `headless-mode`（跨流程、條件載入，不常駐）。rules.md / hosts.md 各加一兩句「headless → 載 headless-mode」的接線；11 個 phase skill 的每個決策點加一行分流指向 headless-mode §分流表。契約 P18 機械守「接線存在 + 11 個 skill 都有指向 + 新 skill 七節」；互動模式零改變靠每行的「headless 時」前提句，由 review-plan DX 視角與 code-review 看。

**Tech Stack**: markdown skill、node 契約腳本（零依賴）、pwsh build-references。

**Risks**: (1) A / B 分類寫錯 → 無人模式走錯路；靠 review-plan 三視角。(2) 前提句漏寫 → 互動模式行為變；P18 不守這點，靠 review。(3) P14 白名單：skill 內文不得出現 hosts.md 第一欄以外的工具名 token、不得寫 `/bstack:` 而不並列 `$bstack:`。(4) 改 SKILL.md 後 references-data.js 必重產，收尾鏈一律 `&&`。

---

## §檔案結構規劃

| 項 | 內容 |
|---|---|
| 新建 | `skills/headless-mode/SKILL.md` — 偵測、分流表、問人格式、讀回覆、本輪結束協定、hand-off state、Red Flags |
| 改動 | `scripts/plugin-contract.mjs` — 加 P18（P17 之後、summary 之前） |
| 改動 | `skills/devwork/rules.md` §決策點選單 — 加 headless 一段（2 行） |
| 改動 | `skills/devwork/hosts.md` §Host 判定 表加一列、§決策點 表 AskUserQuestion 列的「工具不在清單時」欄加分流句 |
| 改動 | `skills/devwork/SKILL.md` — 使用契約第 2 步前加 headless 入口（snapshot 有 pending_question → context-resume） |
| 改動 | `skills/dev-workflow/SKILL.md` — 使用契約第 5 條前提句、跨流程表加列、§Fail handling 加分流、state yaml 加四欄 |
| 改動 | `skills/brainstorm/SKILL.md` — 0a 第 3 點、合併確認、spec gate、spec 範本 §待釐清 |
| 改動 | `skills/context-snapshot/SKILL.md` — 第 2 步 headless 直接存；快照結構加 `source_issue` / `auto_decisions` / `pending_question` |
| 改動 | `skills/context-resume/SKILL.md` — 第 4 步 headless 讀回覆；state 不一致 B 類；Red Flags 首列加例外 |
| 改動 | `skills/dispatch-parallel/SKILL.md` 第 3 步、`skills/review-plan/SKILL.md` 第 6 步、`skills/receive-review/SKILL.md` 第 4-5 步 + 衝突兩處、`skills/execute-plan/SKILL.md` 前端大改 gate + fail、`skills/finish-branch/SKILL.md` conflict + §Squash merge + PR 模板、`skills/cmd-guard/SKILL.md` 第 3 步 — 各一行 |
| 改動 | `README.md`（28→29、跨流程列）、`docs/index.html`（meta ×3、hero、inventory、`SKILLS` 陣列） |
| 重產 | `docs/js/references-data.js` — 只能由 `scripts/build-references.ps1` 產 |
| 介面 | hand-off state 新欄：`headless: bool`、`source_issue: string\|null`、`auto_decisions: [{phase, question, chosen, reason}]`、`pending_question: {phase, asked_at, options, comment_url}\|null`；結束協定字串 `[bstack headless] <asked\|waiting\|done\|blocked>: <一句> · issue #<n> · branch <name>`；留言標記 `<!-- bstack-ask: <phase> \| <ISO-ts> -->` |
| 測試 | `scripts/plugin-contract.mjs` P18（本 repo 無 test runner，契約即測試） |

**P18 守的清單**（Task 1 寫死、後續 task 逐項變綠）：

| 項 | 斷言 |
|---|---|
| a | `skills/headless-mode/SKILL.md` 存在，七節標題行首錨定：`## §偵測`、`## §分流表`、`## §問人格式`、`## §讀回覆`、`## §本輪結束協定`、`## §hand-off state`、`## §Red Flags` |
| b | 新 skill 內文含 `BSTACK_ISSUE`、`AUTOPILOT_LABEL`、`<!-- bstack-ask:`、`[bstack headless]`，且有一行同時含 `merge` 與 `永不` |
| c | rules.md `### §決策點選單` 節內含 `headless-mode` 與 `AUTOPILOT_LABEL` |
| d | hosts.md `## §Host 判定` 節內含 `AUTOPILOT_LABEL` 與 `headless-mode`；`## §決策點` 節內含 `headless-mode` |
| e | 11 個 phase skill 各至少一行含 `headless-mode`：devwork、dev-workflow、brainstorm、dispatch-parallel、review-plan、receive-review、execute-plan、finish-branch、context-resume、context-snapshot、cmd-guard |
| f | dev-workflow §跨流程 skill 載入 表有 `` | `headless-mode` | `` 開頭的列 |
| g | finish-branch `## §Squash merge` 節內有一行含 `headless` 與 `永不` |

---

### Task 1: 契約 P18（先紅）
**parallel-group**: 1
**files**:
- modify: `scripts/plugin-contract.mjs`（P17 區塊之後、`console.log(failed === 0 …)` 之前）
- test: 同檔（契約即測試）

- [ ] **Step 1: 寫失敗測試** — 在 P17 區塊結束的 `}` 之後插入：
```js
// P18：headless 無人模式接線。政策單一真相在 skills/headless-mode/SKILL.md（條件載入、不常駐）；
//      rules.md / hosts.md 只指向它；每個有決策點的 phase skill 都要有一行分流指向它——漏一個 skill，
//      無人模式跑到那個決策點就會印一個沒人回答的問題然後結束那一輪。
//      刻意不守「前提句」（每行是否以 headless 為條件）：字樣 grep 守不住語意，交 review-plan DX 視角。
{
  const hm = exists('skills/headless-mode/SKILL.md') ? lf(rd('skills/headless-mode/SKILL.md')) : '';
  const HEADS18 = ['偵測', '分流表', '問人格式', '讀回覆', '本輪結束協定', 'hand-off state', 'Red Flags'];
  const missHead18 = HEADS18.filter((n) => !new RegExp(`^##[ \\t]+§${n}[ \\t]*$`, 'm').test(hm));
  const section = (text, head, level = '###') => (text.match(new RegExp(`^${level}[ \\t]+§${head}[^\\n]*$\\n([\\s\\S]*?)(?=^${level.slice(0, 2)}#? |(?![\\s\\S]))`, 'm')) || [])[1] || '';
  const rulesDP = section(rules16, '決策點選單');
  const hostsHost = section(hostsMd, 'Host 判定', '##'), hostsDP = section(hostsMd, '決策點', '##');
  const PHASE18 = ['devwork', 'dev-workflow', 'brainstorm', 'dispatch-parallel', 'review-plan', 'receive-review', 'execute-plan', 'finish-branch', 'context-resume', 'context-snapshot', 'cmd-guard'];
  const missPhase = PHASE18.filter((s) => !exists(`skills/${s}/SKILL.md`) || !/headless-mode/.test(rd(`skills/${s}/SKILL.md`)));
  const fb18 = exists('skills/finish-branch/SKILL.md') ? lf(rd('skills/finish-branch/SKILL.md')) : '';
  const squash18 = section(fb18, 'Squash merge', '##');
  const p18 = {
    skillHeads: hm !== '' && missHead18.length === 0,
    skillBody: /BSTACK_ISSUE/.test(hm) && /AUTOPILOT_LABEL/.test(hm) && /<!-- bstack-ask:/.test(hm) && /\[bstack headless\]/.test(hm) && hm.split('\n').some((l) => /merge/.test(l) && /永不/.test(l)),
    rules: /headless-mode/.test(rulesDP) && /AUTOPILOT_LABEL/.test(rulesDP),
    hosts: /AUTOPILOT_LABEL/.test(hostsHost) && /headless-mode/.test(hostsHost) && /headless-mode/.test(hostsDP),
    phases: missPhase.length === 0,
    crossTable: /^\| `headless-mode` \|/m.test(lf(dw16 === '' ? '' : rd('skills/dev-workflow/SKILL.md'))),
    noMerge: squash18.split('\n').some((l) => /headless/.test(l) && /永不/.test(l)),
  };
  check('P18 headless-mode skill 七節 + 四個契約字樣 + merge 永不；rules.md §決策點選單 / hosts.md §Host 判定 §決策點 指向它；11 個 phase skill 各有分流；dev-workflow 跨流程表有列；finish-branch §Squash merge 明寫 headless 永不',
    Object.values(p18).every(Boolean),
    `${Object.entries(p18).filter(([, v]) => !v).map(([k]) => k).join(', ')} 不過；缺節=[${missHead18.join(', ')}] 缺分流=[${missPhase.join(', ')}]（後果：無人模式跑到沒分流的決策點就印一個沒人回答的問題、那一輪白跑；或 rules.md 沒指向 → 根本不會載入政策；改處：skills/headless-mode/SKILL.md、skills/devwork/rules.md、skills/devwork/hosts.md、缺分流的那個 skill）`);
}
```
  註：`rules16` / `hostsMd` / `dw16` / `lf` / `exists` / `rd` 是 P14 / P16 已宣告的變數，P18 在其後可直接用；`dw16` 只拿來判 dev-workflow 檔存在，實際比對重讀一次以取得 CRLF 正規化後的內容。
- [ ] **Step 2: 跑測試確認失敗**（Expected: `FAIL  P18 …` 且 `1 FAIL`；其餘全 PASS）
```bash
node scripts/plugin-contract.mjs | tail -5
```
- [ ] **Step 3: 寫最小實作** — 本 task 無實作（紅的狀態就是目標，後續 task 逐項變綠）
- [ ] **Step 4: 確認 selftest 仍綠**（Expected: `SELFTEST PASS`）
```bash
node scripts/plugin-contract.mjs --selftest | tail -3
```
- [ ] **Step 5: commit**
```bash
git add scripts/plugin-contract.mjs
git commit -m "test: 契約 P18 守 headless-mode 接線（先紅）"
```

---

### Task 2: 新 skill `headless-mode`
**parallel-group**: 2
**files**:
- create: `skills/headless-mode/SKILL.md`
- test: `scripts/plugin-contract.mjs` P18 `skillHeads` / `skillBody`

- [ ] **Step 1: 寫失敗測試** — 已由 Task 1 提供（P18 `skillHeads`、`skillBody` 紅）
- [ ] **Step 2: 跑測試確認失敗**（Expected: P18 FAIL、訊息含 `skillHeads, skillBody`）
```bash
node scripts/plugin-contract.mjs | grep -A1 "P18"
```
- [ ] **Step 3: 寫 SKILL.md** — 全文如下（description 兩句式；不寫「觸發：」；工具名只用 hosts.md 第一欄有的；`/bstack:` 與 `$bstack:` 並列）：
````markdown
---
name: headless-mode
description: |
  無人模式政策（繁中）：偵測、決策點 A / B 分流、issue 留言問人、讀回覆、本輪結束協定。
  載入：hosts.md §Host 判定 判為 headless 時由 devwork 載；phase skill 遇決策點依本檔 §分流表 分流。
---

# headless-mode

沒有人在終端前時，決策點怎麼走。**互動模式（工具清單有 `AskUserQuestion` 或 `request_user_input`）完全不適用本檔**——所有 phase skill 的分流句都以「headless 時」為前提。

## §偵測

三條**全中**才是 headless；任一不中就不是：

1. 工具清單**沒有** `AskUserQuestion`、也**沒有** `request_user_input`。
2. 環境變數 `AUTOPILOT_LABEL` 非空（Bash：`printenv AUTOPILOT_LABEL`）。
3. 來源 issue 可解析，優先序：環境變數 `BSTACK_ISSUE`（`123` 或 `owner/repo#123`）> devwork 參數裡的 `#<n>` > snapshot 的 `source_issue`。

只中 1 不中 2 → hosts.md 既有退路（文字提問、選項編號），不載本檔。中 1、2 不中 3 → **headless-blocked**：不問、不猜，走 §本輪結束協定 的 `blocked` 行後結束。

**前提**：workspace 跨輪持久（snapshot 在 `docs/snapshots/`、預設不 commit）。每輪全新 clone 的部署不支援。

## §分流表

**A 類 = 採推薦並記錄**；**B 類 = 留言問人後結束本輪**。表是單一真相，phase skill 只指向這裡。

| 決策點 | 類別 | headless 行為 |
|---|---|---|
| brainstorm 0a 複述不準 / 抓不到 success criteria | **B** | 留言列可能解讀（編號）+ 推薦；0a 允許自由文字回覆 |
| brainstorm 0c/0d 合併確認（Track / Tier / UI） | A | 採推薦；`size=大改` 的第 3 題例外 → **B**（三方向 vs 一版是設計決策） |
| branch 名（guard 擋在受保護 branch） | A | `<type>/<short-desc>`，type 依 Track（Bug→fix、Dev→feat） |
| brainstorm spec gate | A | 選「spec 正確」；spec §待釐清 必含 `auto_decisions` 清單 |
| review-plan user gate | A / **B** | 無 critical → accept；有 critical → B |
| dispatch-parallel 跑法 | A | subagent 平行或串行依判定實據；**不列 Agent Teams**（沒有人能中途切進去） |
| receive-review 不危險類 | A | 照舊自動修；T3「先 diff 再 commit」→ 直接 commit，diff 落 `docs/work/<branch-name>/review-fixes.diff` |
| receive-review 危險類 / 多 reviewer 衝突 / reviewer fix 自己錯 | **B** | 留言 |
| execute-plan / verify / review fail | **B** | 不 retry；留言列 retry / adjust+retry / rollback / 回上層 / escalate |
| execute-plan 計畫外前端大改 gate | **B** | 留言 |
| cmd-guard L2 / L3 | **B** | 留言；L4 照舊拒絕 |
| finish-branch rebase conflict | **B** | 留言 |
| finish-branch merge | **永不** | 開 PR、印 URL 即止；issue 留言**不算**授權，headless 下 merge 永不自動 |
| context-snapshot「要不要存」 | A | 一律存 |
| context-resume 接續方向 | A / 讀回覆 | 有 `pending_question` → §讀回覆；沒有 → 接續下一步 |
| context-resume state 不一致 | **B** | 留言 |

**A 類每次寫一筆** `state.auto_decisions[]`：`{phase, question, chosen, reason}`。brainstorm 抄進 spec §待釐清（子標題「headless 自動採用」）；finish-branch 抄進 PR body。

## §問人格式

B 類一律 `gh issue comment <n> --body-file <tmp>`，內容固定模板：

```markdown
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

留言**前**必做：(1) 已有 code → `git push -u origin <branch>`（沒推的 branch 下一輪找不回）；(2) 載 `safety-guard` 掃留言內容；(3) 載 `context-snapshot` 存 `pending_question`。留言**後**：走 §本輪結束協定 的 `asked` 行。

## §讀回覆

context-resume 在 headless 且 snapshot 有 `pending_question` 時：

1. `gh issue view <n> --comments --json comments --jq '.comments[] | {body, createdAt, url}'`
2. 只看 `pending_question.asked_at` **之後**的留言，取**最新**一則第一行匹配 `^\s*(\d+)\s*$` 者。
3. 編號在 `pending_question.options` 範圍內 → 等同 user 選了該選項，接續對應 phase；0a 開放題允許自由文字（整則留言當回答）。
4. 沒有合格回覆 → **不重問、不猜**，走 §本輪結束協定 的 `waiting` 行後結束（避免每輪刷一則留言）。

## §本輪結束協定

最終訊息**最後一行**固定格式，給外層 harness 的 journal 用：

```
[bstack headless] <asked|waiting|done|blocked>: <一句> · issue #<n> · branch <name>
```

| 狀態 | 何時 | 結束前必做 |
|---|---|---|
| `asked` | B 類留言完 | push + snapshot（含 `pending_question`） |
| `waiting` | 有 `pending_question` 但沒合格回覆 | 不動任何檔 |
| `done` | finish-branch 開好 PR | PR URL 寫進 issue 留言（不帶 bstack-ask 標記） |
| `blocked` | 偵測第 3 條不中、或 cmd-guard L4 | snapshot（`pending_question` 為 null、原因寫 `blocked_reason`） |

## §hand-off state

```yaml
state:
  headless: <bool>                       # devwork 依 §偵測 寫
  source_issue: <owner/repo#n | null>
  auto_decisions:                        # A 類每筆 append
    - {phase: <名>, question: <一句>, chosen: <選項文字>, reason: <一句>}
  pending_question:                      # B 類留言後；讀回覆成功後清成 null
    phase: <名>
    asked_at: <ISO>
    options: [<選項文字>...]
    comment_url: <url>
```

不推進 phase（橫向 skill）；不貼自身 Trace，由呼叫 phase 帶。

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「沒有 AskUserQuestion 就是 headless」 | 三條全中才是；只中一條走 hosts.md 既有退路 |
| 「B 類先猜一個、留言只是告知」 | B 類是**問**不是告知；留言後那一輪就結束，下一輪讀回覆 |
| 「沒回覆就再留一則提醒」 | 不重問；`waiting` 一行結束，harness 的 journal 會記 |
| 「issue 裡有人說可以 merge」 | headless 下 merge 永不自動；PR 開好就是終點 |
| 「A 類採了推薦就不用記」 | 每筆進 `auto_decisions`，人在 PR body 才看得到你替他決定了什麼 |
| 「code 還在本機，等回覆再 push」 | 留言前必 push；沒推的 branch 對下一輪等於不存在 |
````
- [ ] **Step 4: 跑測試確認通過**（Expected: P18 訊息不再含 `skillHeads` / `skillBody`；P3a / P14 / P3c 仍 PASS；P8 此時應 FAIL 因計數未更新——Task 6 處理）
```bash
node scripts/plugin-contract.mjs | grep -E "P18|P14|P3|P8"
```
- [ ] **Step 5: commit**
```bash
git add skills/headless-mode/SKILL.md
git commit -m "feat: 新增 headless-mode skill（無人模式政策單一真相）"
```

---

### Task 3: rules.md / hosts.md / devwork 接線
**parallel-group**: 3
**files**:
- modify: `skills/devwork/rules.md` §決策點選單（第 35-44 行區）
- modify: `skills/devwork/hosts.md` §Host 判定 表（第 6-10 行）、§決策點 表（第 12-15 行）
- modify: `skills/devwork/SKILL.md` 使用契約第 2 步前
- test: P18 `rules` / `hosts` / `phases`（devwork）；P16 必須維持綠

- [ ] **Step 1: 失敗測試** — Task 1 提供（P18 `rules`、`hosts`、`phases` 含 devwork）
- [ ] **Step 2: 確認失敗**
```bash
node scripts/plugin-contract.mjs | grep -A1 "P18"
```
- [ ] **Step 3: 實作**
  - rules.md §決策點選單，在「本檔與各 skill 寫的工具名是抽象動詞」那段**之前**加：
    ```markdown
    **headless（無人模式）**：工具清單沒有 `AskUserQuestion` / `request_user_input` **且** `AUTOPILOT_LABEL` 非空 → 載 `headless-mode`，決策點依其 §分流表：A 類採推薦並記 `auto_decisions`、B 類 `gh issue comment` 問人後結束本輪；merge 永不自動。互動模式不受影響。
    ```
  - hosts.md §Host 判定 表加一列（在「都沒有」列之前）：
    ```markdown
    | 都沒有、且 `AUTOPILOT_LABEL` 非空 | headless：載 `headless-mode`，決策點依其 §分流表（A 類採推薦 / B 類 issue 留言後結束本輪） |
    ```
  - hosts.md §決策點 表 `AskUserQuestion` 列的第四欄尾端加：`；若同時 `AUTOPILOT_LABEL` 非空 → headless，見 `headless-mode` §分流表，不用文字提問`
  - devwork SKILL.md 使用契約第 1 步之後插入 1.5：
    ```markdown
    1.5 **headless 入口**：hosts.md §Host 判定 判為 headless → 載 `headless-mode` 走 §偵測；`docs/snapshots/` 有本 issue 的 snapshot 且 `pending_question` 非空 → 直接載 `context-resume`（不進第 2、3 步）；否則照第 2 步往下，state 帶 `headless: true`、`source_issue`。
    ```
- [ ] **Step 4: 確認通過**（Expected: P18 訊息不再含 `rules, hosts`、缺分流不含 devwork；P16 PASS）
```bash
node scripts/plugin-contract.mjs | grep -E "P16|P18"
```
- [ ] **Step 5: commit**
```bash
git add skills/devwork/rules.md skills/devwork/hosts.md skills/devwork/SKILL.md
git commit -m "feat: rules / hosts / devwork 接線 headless-mode"
```

---

### Task 4: dev-workflow / brainstorm / context-snapshot / context-resume（state 與進出口）
**parallel-group**: 4
**files**:
- modify: `skills/dev-workflow/SKILL.md`（使用契約第 5 條；§Skill hand-off state yaml；§Fail handling 第 3 點；§跨流程 skill 載入 表；§Red Flags 第 2 列）
- modify: `skills/brainstorm/SKILL.md`（0a 第 3 點；§Phase 0c/0d 合併確認 首段；spec gate 段；spec 範本 §待釐清；§Red Flags「我猜 tier」列）
- modify: `skills/context-snapshot/SKILL.md`（第 2 步；§快照結構 yaml；§commit snapshot 不？）
- modify: `skills/context-resume/SKILL.md`（第 4 步；§State 還原 不一致；§Red Flags 第 1 列）
- test: P18 `phases`（四個）、`crossTable`

- [ ] **Step 1: 失敗測試** — Task 1 提供
- [ ] **Step 2: 確認失敗**（Expected: 缺分流含這四個、`crossTable` 不過）
```bash
node scripts/plugin-contract.mjs | grep -A1 "P18"
```
- [ ] **Step 3: 實作**（每處一行，前提句必寫「headless 時」）
  - dev-workflow 第 5 條改為：`5. user 決策點走 \`AskUserQuestion\`，**禁文字 token NLP 判斷**；headless 時依 \`headless-mode\` §分流表（A 類採推薦記 \`auto_decisions\`、B 類留言後結束本輪）。`
  - dev-workflow state yaml 在 `fail_history` 後加四欄（註解「headless-mode 寫」）：`headless: <bool>`、`source_issue: <owner/repo#n | null>`、`auto_decisions: [...]`、`pending_question: <obj | null>`
  - dev-workflow §Fail handling 第 3 點前加一句：`headless 時 → B 類：不 retry，五個選項寫進 issue 留言（\`headless-mode\` §問人格式）後結束本輪。`
  - dev-workflow 跨流程表加列：`| \`headless-mode\` | devwork 依 hosts.md §Host 判定 判為 headless 時載；phase skill 遇決策點依其 §分流表，不各自判 |`
  - dev-workflow Red Flags「不問 user 直接決定 tier」列真相欄尾加：`；headless 時採推薦但必記 auto_decisions`
  - brainstorm 0a 第 3 點尾加：`headless 時 → B 類（\`headless-mode\` §問人格式），留言後結束本輪。`
  - brainstorm §Phase 0c/0d 合併確認 首段尾加：`headless 時 → A 類採推薦、每題記 \`auto_decisions\`；\`size=大改\` 的第 3 題例外 → B 類。`
  - brainstorm spec gate code block 之後加：`headless 時 → A 類選 1；spec §待釐清 先寫入「headless 自動採用」子清單（每筆 \`auto_decisions\`）。`
  - brainstorm spec 範本 `## 待釐清（如有）` 下加註解行：`<!-- headless 時必有子標題「headless 自動採用」：每筆 {phase, question, chosen, reason} -->`
  - brainstorm Red Flags「我猜 tier 算了不問」真相欄尾加：`；headless 例外見 \`headless-mode\``
  - context-snapshot 第 2 步尾加：`headless 時一律存、不問。`；§快照結構 yaml `fail_history` 後加 `source_issue` / `auto_decisions` / `pending_question` 三欄（註解「headless-mode」）；§commit snapshot 不？ 加一句：`headless 時不 commit、靠 workspace 持久（\`headless-mode\` §偵測 前提）。`
  - context-resume 第 4 步改為：`4. \`AskUserQuestion\` 確認接續方向；headless 時不問：snapshot 有 \`pending_question\` → 走 \`headless-mode\` §讀回覆，沒有 → 選項 1。`；§State 還原 不一致段尾加：`headless 時 → B 類留言後結束本輪。`；Red Flags 第 1 列真相欄尾加：`；headless 例外見 \`headless-mode\``
- [ ] **Step 4: 確認通過**（Expected: 缺分流不含這四個、`crossTable` 過）
```bash
node scripts/plugin-contract.mjs | grep -A1 "P18"
```
- [ ] **Step 5: commit**
```bash
git add skills/dev-workflow/SKILL.md skills/brainstorm/SKILL.md skills/context-snapshot/SKILL.md skills/context-resume/SKILL.md
git commit -m "feat: dev-workflow / brainstorm / snapshot / resume 加 headless 分流與 state 欄位"
```

---

### Task 5: 其餘六個 phase skill 的決策點分流
**parallel-group**: 5
**files**:
- modify: `skills/dispatch-parallel/SKILL.md` 第 3 步
- modify: `skills/review-plan/SKILL.md` 第 6 步
- modify: `skills/receive-review/SKILL.md` 第 4、5 步；「多 reviewer 衝突」「Reviewer 給的 fix 自己錯」兩處
- modify: `skills/execute-plan/SKILL.md` 前端大改 gate（第 43 行區）；fail 第 3 點（第 81 行區）
- modify: `skills/finish-branch/SKILL.md` §Conflict 第 2 點；§Squash merge 首列；§PR 模板（加「headless 自動決策」節）
- modify: `skills/cmd-guard/SKILL.md` 第 3 步
- test: P18 `phases`（六個）、`noMerge`

- [ ] **Step 1: 失敗測試** — Task 1 提供
- [ ] **Step 2: 確認失敗**
```bash
node scripts/plugin-contract.mjs | grep -A1 "P18"
```
- [ ] **Step 3: 實作**（每處一行）
  - dispatch-parallel 第 3 步尾加：`headless 時 → A 類：依判定實據選 subagent 平行或串行，不列 Agent Teams（\`headless-mode\` §分流表）。`
  - review-plan 第 6 步尾加：`headless 時 → 無 critical 採 accept、有 critical B 類留言後結束本輪（\`headless-mode\` §分流表）。`
  - receive-review 第 4 步尾加：`headless 時 → B 類留言後結束本輪（\`headless-mode\`）。`；第 5 步尾加：`headless 時直接 commit，diff 落 \`docs/work/<branch-name>/review-fixes.diff\`。`；「多 reviewer 衝突」與「Reviewer 給的 fix 自己錯」兩處各尾加：`headless 時 → B 類。`
  - execute-plan 前端大改 gate 段尾加：`headless 時 → B 類留言後結束本輪（\`headless-mode\` §分流表）。`；fail 第 3 點尾加：`headless 時 → B 類：五個選項寫進留言、結束本輪。`
  - finish-branch §Conflict 第 2 點前加：`headless 時 → B 類留言後結束本輪（\`headless-mode\`）。`；§Squash merge 首列改為：`- **AI 預設不自動 \`gh pr merge\`**：…（原文）。**headless 時 merge 永不自動**：issue 留言不算授權、session 級授權不存在。`；§PR 模板 在測試欄之後加一節：
    ```markdown
    ## headless 自動決策（headless 時必填，否則刪）
    | phase | 問題 | 採用 | 理由 |
    |---|---|---|---|
    ```
  - cmd-guard 第 3 步尾加：`headless 時 L2 / L3 → B 類留言後結束本輪、L4 照舊拒絕（\`headless-mode\` §分流表）。`
- [ ] **Step 4: 確認通過**（Expected: P18 PASS；P14 PASS）
```bash
node scripts/plugin-contract.mjs | grep -E "P14|P18"
```
- [ ] **Step 5: commit**
```bash
git add skills/dispatch-parallel/SKILL.md skills/review-plan/SKILL.md skills/receive-review/SKILL.md skills/execute-plan/SKILL.md skills/finish-branch/SKILL.md skills/cmd-guard/SKILL.md
git commit -m "feat: 六個 phase skill 決策點加 headless 分流；finish-branch 明寫 merge 永不"
```

---

### Task 6: README / index.html 計數與索引卡 + references 重產
**parallel-group**: 6
**files**:
- modify: `README.md`（第 3 行「28 個 skill」、第 86 行 `## Skills（28）`、第 100 行跨流程列）
- modify: `docs/index.html`（第 7、18、25 行 meta「28 個 skill」；第 342 行 hero `28`；inventory 列的 `28`；`SKILLS` 陣列 context-resume 之後加一列）
- regenerate: `docs/js/references-data.js`
- test: P8；`build-references.ps1 -Check`

- [ ] **Step 1: 失敗測試** — P8 已紅（Task 2 之後磁碟 29、文件 28）
- [ ] **Step 2: 確認失敗**（Expected: `FAIL  P8 … README=28 hero=28 …`）
```bash
node scripts/plugin-contract.mjs | grep -A1 "P8 "
```
- [ ] **Step 3: 實作** — 動 index.html 前載 `design-language` 跑四項對齊檢查（預期四項 N/A，依據：diff 不含 class / style / 標籤，只有數字與 JS 陣列一列），結果寫 spec §施工紀錄
  - README：`28 個 skill` → `29 個 skill`；`## Skills（28）` → `## Skills（29）`；第 100 行改為 `- **context-snapshot** / **context-resume** / **headless-mode** — 換 session 時存 / 讀進度；無人環境的決策點分流`
  - index.html：三處 meta 與 hero、inventory 的 `28` → `29`（inventory 列用 `grep -n ">skills</span>" docs/index.html` 定位）；`SKILLS` 陣列在 `['context-resume', …]` 之後加 `['headless-mode', '無人環境：決策點採推薦或留言問人', '跨流程'],`
  - 重產：
    ```bash
    pwsh -NoProfile -File scripts/build-references.ps1
    ```
- [ ] **Step 4: 確認通過**（Expected: `ALL PASS`；`-Check` exit 0）
```bash
node scripts/plugin-contract.mjs | tail -2 && pwsh -NoProfile -File scripts/build-references.ps1 -Check; echo exit=$?
```
- [ ] **Step 5: commit**
```bash
git add README.md docs/index.html docs/js/references-data.js docs/work/feat/headless-mode/spec.md
git commit -m "docs: skill 計數 29、索引卡加 headless-mode、重產 references"
```

---

## §Self-review

1. **spec coverage**：契約全綠（T1-T6）✓；新 skill 七節（T2）✓；rules / hosts 接線（T3）✓；11 個 skill 分流（T3 devwork、T4 四個、T5 六個 = 11）✓；README / index.html / P8（T6）✓；互動模式零改變 → 每行前提句「headless 時」（T4 / T5 實作內容逐行寫明）✓。
2. **placeholder**：T2 skill 全文貼出；T3-T5 每處改法逐字寫；無 TBD。
3. **型別一致**：state 欄名 `headless` / `source_issue` / `auto_decisions` / `pending_question` 在 T2 skill、T4 dev-workflow yaml、T4 snapshot yaml 三處相同；結束協定與留言標記字串在 T1 契約與 T2 skill 逐字相同（`[bstack headless]`、`<!-- bstack-ask:`）。
4. **並行性**：T3-T5 檔案互不重疊、實際可並行，但每 task 量小、平行無收益且 dispatch-parallel 會多一次問答，刻意分開 group（保守）。T6 依賴 T2（P8 計數）。
5. **scope**：不碰 autopilot 側、不升版、不做 Agent Teams、不 commit snapshot——都在 spec 排除。
