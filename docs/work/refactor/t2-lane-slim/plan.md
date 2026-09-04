# T2 lane 精簡 Implementation Plan

> 對應 spec: `docs/work/refactor/t2-lane-slim/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-04
> 並行最大 group: 8

**Goal**: T2 不寫 plan.md / 不跑 review-plan（施工清單進 spec）、review 合一、pr-explain 限 T3、review fix 單 commit；rules / skills / agents / docs 站 / README 全部同步。

**Architecture**: 行為真相在 `rules.md §Tier 表`，routing 真相在 `dev-workflow`，兩端契約（brainstorm 產施工清單 ↔ execute-plan 吃施工清單）放同一個 task。機械守門用兩支既有零依賴驗證器：`scripts/plugin-contract.mjs` 新增 P9 系列（grep 式斷言各檔的 lane 敘述一致）、`docs/tools/docs-site-contract.mjs` 的 C8a EXPECT 改成新節點 / 邊數。docs 站的 skill 內嵌靠 `scripts/build-references.ps1` 重產。

**Tech Stack**: markdown / 純 JS 資料檔 / node 內建模組 / pwsh 7（產出器）。

**Risks**:
- `data-upto` 是「該段最後一個點名節點在 node 順序裡的 1-based 索引」——這是推斷，Task 6 Step 1 先用腳本對現況驗證再改。
- references-data.js 必須在 skill 全改完之後最後重產一次，中途重產會多一顆沒意義的大 diff。
- 本 PR 自己走舊規則（T3 雙視角 + lang-reviewer、security-audit、pr-explain）。

---

## 檔案結構

| 項 | 路徑 | 動什麼 |
|---|---|---|
| 改 | `scripts/plugin-contract.mjs` | P8 之後加 P9a-g（先紅） |
| 改 | `docs/tools/docs-site-contract.mjs:328` | `EXPECT` nodes 99→96、edges 136→133（先紅） |
| 改 | `skills/devwork/rules.md` | §Tier 表加 pr-explain 欄、T2 / T3 三格改寫；表下加兩句 |
| 改 | `skills/dev-workflow/SKILL.md` | Phase 1→2 分流、Phase 5、Phase 8、§跨流程表 lang-reviewer 列 |
| 改 | `skills/brainstorm/SKILL.md` | 使用契約第 4 步、§spec 文件結構加施工清單、§交棒 |
| 改 | `skills/execute-plan/SKILL.md` | 使用契約第 1 步、§Task fail 退回選項 |
| 改 | `skills/write-plan/SKILL.md`、`skills/review-plan/SKILL.md` | 前提改 T3 only、T2 誤入處置、frontmatter description |
| 改 | `skills/request-review/SKILL.md` | §T2 單 reviewer、§語言提示、§T3 兩 reviewer、拿掉 lang-reviewer dispatch、Red Flags |
| 改 | `skills/receive-review/SKILL.md` | §不危險處置單 commit、Red Flags |
| 改 | `skills/finish-branch/SKILL.md`、`skills/pr-explain/SKILL.md` | 下游依 Tier；description |
| 改 | `agents/lang-reviewer.md` | description 末句 |
| 改 | `README.md` | 4 列 |
| 改 | `docs/js/data.js` | 刪 3 節點、刪 7 邊、加 4 邊、改 6 個 label |
| 改 | `docs/index.html` | 節點數 2 處、b5 `data-nodes`、各段 `data-upto`、審查 beat 文案 |
| 產 | `docs/js/references-data.js` | `pwsh -File scripts/build-references.ps1` |

**兩端契約**（brainstorm ↔ execute-plan）：spec.md 末尾

```markdown
## 施工清單（T2；取代 plan.md）

| # | group | 檔 | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `path/a.js` | 加 X | `node test a` 由紅轉綠 |
```

- 標題字面固定 `## 施工清單`（P9b 與 execute-plan 都 grep 這個）
- ≤ 8 列；`group` 同號可並行；每列 = execute-plan 一個 task

---

### Task 1: 契約先紅（P9 系列 + C8a EXPECT）

**parallel-group**: 1
**files**:
- modify: `scripts/plugin-contract.mjs`（P8 之後、`console.log(failed…)` 之前）
- modify: `docs/tools/docs-site-contract.mjs:328`

- [ ] **Step 1: 寫失敗檢查**

`scripts/plugin-contract.mjs` 在 P8 的 `check(...)` 之後插入：

```js
// ── P9 T2 lane 一致性（2026-09-04 精簡後）────────────────────────────────────
// T2 的 lane 定義散在 rules / 5 個 skill / 1 個 agent / README / landing，任何一處
// 留著舊敘述，Claude 就會在那一步照舊做。這裡逐檔 grep 新舊字樣，舊的還在就紅。
const rules = rd('skills/devwork/rules.md');
const tierT2 = (rules.match(/^\| \*\*T2\*\*.*$/m) || [''])[0];
const tierHead = (rules.match(/^\| Tier \| 量體 \|.*$/m) || [''])[0];
check('P9a rules.md §Tier 表 T2 列有施工清單、表頭有 pr-explain 欄',
  /施工清單/.test(tierT2) && /1 subagent/.test(tierT2) && /pr-explain/.test(tierHead),
  `T2 列=「${tierT2.slice(0, 80)}」表頭含 pr-explain=${/pr-explain/.test(tierHead)}（後果：Tier 表是聖旨，沒改等於沒精簡）`);
const bs = rd('skills/brainstorm/SKILL.md'), ex = rd('skills/execute-plan/SKILL.md');
check('P9b brainstorm 有「## 施工清單」範本且 execute-plan 會讀它',
  /## 施工清單/.test(bs) && /施工清單/.test(ex) && /plan_path/.test(ex),
  `brainstorm=${/## 施工清單/.test(bs)} execute-plan=${/施工清單/.test(ex)}（後果：兩端契約缺一邊，T2 進 execute-plan 就卡）`);
const rr = rd('skills/request-review/SKILL.md'), dw = rd('skills/dev-workflow/SKILL.md');
check('P9c request-review / dev-workflow 不再自動派 lang-reviewer，改語言提示',
  !/subagent_type:\s*lang-reviewer/.test(rr) && /語言提示/.test(rr) && !/subagent \+ lang-reviewer/.test(dw) && !/\+ lang-reviewer/.test(dw),
  `rr.autoDispatch=${/subagent_type:\s*lang-reviewer/.test(rr)} rr.hint=${/語言提示/.test(rr)} dw.old=${/\+ lang-reviewer/.test(dw)}（後果：T2 還是開三個 reviewer）`);
const fb = rd('skills/finish-branch/SKILL.md'), pe = frontmatter(rd('skills/pr-explain/SKILL.md'));
check('P9d finish-branch 只在 T3 交棒 pr-explain，pr-explain 描述註明 T3',
  /T3.*pr-explain|pr-explain.*T3/.test(fb) && /T3/.test(description(pe)),
  `finish-branch=${/T3.*pr-explain|pr-explain.*T3/.test(fb)} pr-explain.desc=${/T3/.test(description(pe))}（後果：T2 每次多燒數萬 token 寫沒人讀的文件）`);
const rv = rd('skills/receive-review/SKILL.md');
check('P9e receive-review 不危險類一顆 commit',
  /處理 review finding/.test(rv) && !/每 finding fix 一個 commit/.test(rv),
  `newText=${/處理 review finding/.test(rv)} oldText=${/每 finding fix 一個 commit/.test(rv)}（後果：squash 後全消失的 commit 照做）`);
const lr = frontmatter(rd('agents/lang-reviewer.md'));
check('P9f lang-reviewer agent 描述不再寫「由主 agent 動態 spawn」',
  !/動態 spawn/.test(description(lr)) && /顯式/.test(description(lr)),
  `desc=「${description(lr).slice(-60)}」（後果：agent 描述與 request-review 打架）`);
const readmeLR = (rd('README.md').match(/^\| \*\*lang-reviewer\*\*.*$/m) || [''])[0];
check('P9g README 的 lang-reviewer 列不寫「自動派發」',
  readmeLR !== '' && !/自動派發/.test(readmeLR),
  `列=「${readmeLR.slice(0, 80)}」（後果：README 說謊）`);
```

`docs/tools/docs-site-contract.mjs:328` 改：
```js
const EXPECT = { nodes: 96, edges: 133, phases: 15, types: 8 };
```

- [ ] **Step 2: 跑確認失敗**

```bash
node scripts/plugin-contract.mjs | grep -E 'P9|FAIL'
# Expected: P9a-g 七條 FAIL，其餘 PASS；結尾 "7 FAIL"
node docs/tools/docs-site-contract.mjs | grep -E 'C8a|FAILED'
# Expected: C8a FAIL（實際 99 / 136）；結尾 "1 FAILED"
```

- [ ] **Step 3-4**: 本 task 只紅。

- [ ] **Step 5: commit**

```bash
git add scripts/plugin-contract.mjs docs/tools/docs-site-contract.mjs
git commit -m "test: 加 P9 守 T2 lane 一致性、C8a 改新節點數（先紅）" -m "刻意先紅：對應改動在 Task 2-7。"
```

---

### Task 2: rules.md §Tier 表與說明

**parallel-group**: 2
**files**:
- modify: `skills/devwork/rules.md` §Tier 機制

- [ ] **Step 1: 測試** — P9a。
- [ ] **Step 2**: `node scripts/plugin-contract.mjs | grep P9a` → FAIL。
- [ ] **Step 3: 改寫**

表換成：
```markdown
| Tier | 量體 | brainstorm | plan | TDD | review | security | pr-explain |
|---|---|---|---|---|---|---|---|
| **T0** | 1 行 / typo / 設定 | 跳 | 跳 | 跳 | 跳 | 跳 | 跳 |
| **T1** | ≤2 檔 / 單模組小改 | 對話釐清 | 跳 | 1-2 關鍵測試 | self | 跳 | 跳 |
| **T2** | 3-10 檔 / 單模組 feature | 完整 | 施工清單（spec 內、≤8 列；不寫 plan.md、不跑 review-plan） | 紅綠循環 | 1 subagent（prompt 附語言 idiom） | 涉認證 / 資料層才 audit | 跳（PR body 已含 why / what / test） |
| **T3** | >10 檔 / 跨模組 / 架構 / DB schema | 完整 | plan.md + review (4 視角) | 紅綠、80% 目標 | 雙視角 subagent（架構 × 除錯，各附語言 idiom） | audit + checklist + db-reviewer | 用 |
```

表下「Track（Bug / Dev）+ Tier 在 brainstorm 0c / 0d 判定…」那句之後加：
```markdown
- **T2 的施工清單**格式見 `brainstorm` §spec 文件結構；超過 8 列代表 Tier 判低了，回 0d 升 T3。
- **`lang-reviewer` agent 不再自動派發**：語言 idiom / pitfall 提示由 request-review 依副檔名寫進 reviewer prompt；user 顯式要「用 lang-reviewer 看」才 spawn。
- 精簡依據（2026-09-04）：Anthropic best practices「If you could describe the diff in one sentence, skip the plan」；superpowers v6.3.0「Ceremony now scales to the task」；PR #61 實測 T2 的 plan 是 code 三倍長、pr-explain 燒 9 萬 token。
```

- [ ] **Step 4**: `node scripts/plugin-contract.mjs | grep P9a` → PASS。
- [ ] **Step 5: commit** `git commit -m "refactor: rules.md Tier 表精簡 T2 lane、加 pr-explain 欄"`

---

### Task 3: brainstorm ↔ execute-plan 施工清單契約

**parallel-group**: 3
**files**:
- modify: `skills/brainstorm/SKILL.md`（使用契約第 4 步、§spec 文件結構、§交棒）
- modify: `skills/execute-plan/SKILL.md`（使用契約第 1 步、§Task fail 第 3 點）

- [ ] **Step 1: 測試** — P9b。
- [ ] **Step 2**: grep P9b → FAIL。
- [ ] **Step 3: 改寫**

brainstorm 使用契約第 4 步：
```markdown
4. T0 → user 點頭後直接交實作；T1 → 交棒 execute-plan（無 plan）；**T2 → spec 末尾附「## 施工清單」後交棒 execute-plan**（不進 write-plan / review-plan）；T3 → 交棒 write-plan。Bug track 一律 debug-systematic。
```

brainstorm §spec 文件結構的 markdown 範本，在「## 待釐清」之後加：
```markdown
## 施工清單（T2 必填；T1 / T3 刪掉本段）

| # | group | 檔 | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `exact/path` | <一句> | <可跑的 check 或目測依據> |
```
範本後加規則：
```markdown
**施工清單規則（T2）**：≤ 8 列，超過回 0d 升 T3；`group` 同號可並行（語意 = plan 的 parallel-group）；「怎麼驗」必須是 execute-plan 能跑或能對照的東西，不寫「確認正常」。這張表跟 spec 在同一個 gate 確認，確認後 execute-plan 逐列當 task。
```

brainstorm §交棒 的「下一 phase」：
```markdown
- T0 → 直接實作（不交 skill）
- T1 → `execute-plan`（無 plan，依對話釐清結果）
- T2 Dev → `execute-plan`（`plan_path: null`，task 來源 = spec §施工清單）
- T3 Dev → `write-plan`
- T1+ Bug → `debug-systematic`
```
並在 state 範本 `spec_path` 下加 `plan_path: <docs/work/<branch-name>/plan.md | null>   # T2 為 null`。

execute-plan 使用契約第 1 步：
```markdown
1. **讀 task 來源**：`plan_path` 有值（T3）→ Read plan.md；`plan_path` 為 null（T1 / T2）→ Read `spec_path`，T2 取「## 施工清單」表、每列一個 task（`group` 欄 = parallel-group、「怎麼驗」欄 = verify command），T1 依 spec 的 success criteria 自拆 1-3 個 task。T2 的 spec 沒有「## 施工清單」→ 停下、退回 brainstorm 補，不自己編。
```
§Task fail 第 3 點的「退到 write-plan 重寫 plan」改成「退到 write-plan（T3）/ 退回 brainstorm 改施工清單（T2）」。

- [ ] **Step 4**: grep P9b → PASS。
- [ ] **Step 5: commit** `git commit -m "refactor: T2 施工清單進 spec，brainstorm 產、execute-plan 讀"`

---

### Task 4: request-review 合一 + dev-workflow + lang-reviewer agent + README 該列

**parallel-group**: 4
**files**:
- modify: `skills/request-review/SKILL.md`
- modify: `skills/dev-workflow/SKILL.md`（Phase 5 三行、§跨流程表 lang-reviewer 列）
- modify: `agents/lang-reviewer.md` description 末句
- modify: `README.md` lang-reviewer 列

- [ ] **Step 1: 測試** — P9c、P9f、P9g。
- [ ] **Step 2**: grep 'P9[cfg]' → 3 FAIL。
- [ ] **Step 3: 改寫**

request-review：
- frontmatter description 改「T1 self review / T2 單一 subagent（prompt 附語言提示）/ T3 雙視角 subagent（架構 × 除錯，各附語言提示）」
- 使用契約第 2 步：`T2 = 1 subagent（綜合 review + 語言提示）`、`T3 = 2 subagent（架構 × 除錯，各附語言提示）`
- §T2 subagent dispatch 的「主 reviewer subagent」prompt 末尾加一段 `{語言提示}` 佔位；**整段「### lang-reviewer dispatch」刪除**，換成：

```markdown
### §語言提示（寫進 reviewer prompt，不另開 agent）

依改動副檔名組一段貼進每個 reviewer 的 prompt：

| 副檔名 | 提示 |
|---|---|
| `.py` | Python：mutable default arg、裸 except、f-string 裡的 SQL、type hint 與實際回傳不符 |
| `.ts / .tsx / .js / .jsx / .mjs` | JS/TS：`==` 與 truthy 比較、未 await 的 promise、regex 對 CRLF、`any` 逃逸 |
| `.sql` | SQL：無 LIMIT 的重 query、隱式型別轉換讓 index 失效、migration 無回滾 |
| `.go` | Go：err 未檢、goroutine 洩漏、defer 在迴圈內 |
| `.rs` | Rust：unwrap 在非測試碼、clone 掩蓋 borrow 問題 |
| `.java / .cs / .cpp / .c / .h` | 資源釋放、null / 未初始化、例外吞掉 |
| 其他 | 不附語言段 |

格式：「本 diff 含 <語言>，請特別看：<該列提示>」。多語言就多列。

`lang-reviewer` agent 保留給 user 顯式要求（「用 lang-reviewer 看這段 SQL」），本 skill 不自動 spawn。
```
- §T3 雙視角：兩個 prompt 各加 `{語言提示}`；**「T2 全部 + 再 spawn 一個」改成「spawn 視角 A 與 B 兩個 subagent，不另開綜合 reviewer」**
- §結果整合 的 Reviewers 範例改 `<self | 綜合 reviewer | 架構 + 除錯>`
- §Red Flags：刪「subagent_type 用 python-reviewer…」與「lang-reviewer 找不到對應 language section」兩列，加 `| 「多開一個 lang-reviewer 比較保險」 | 語言 idiom 已在 prompt；三個 reviewer 讀同一份 diff 是浪費，user 顯式要才派 |`

dev-workflow：
- Phase 5 三行改 `T1 = self review` / `T2 = 1 subagent（prompt 附語言提示）` / `T3 = 雙視角 subagent（架構 × 除錯，各附語言提示）`
- §跨流程表 `lang-reviewer` 列改「user 顯式要求時由主 agent spawn；request-review 不自動派發，語言提示寫進 reviewer prompt」

agents/lang-reviewer.md description 末句改：「載入：request-review 不再自動派發；user 顯式要求「用 lang-reviewer 看 <語言>」時由主 agent spawn。」

README lang-reviewer 列改：`| **lang-reviewer** | 你點名才派的語言專家：按語言抓 idiom 跟 pitfall（python / TS / SQL / Go …）；平常的 review 已把語言提示寫進 reviewer prompt |`

- [ ] **Step 4**: grep 'P9[cfg]' → 3 PASS；`node scripts/plugin-contract.mjs | grep P7` PASS（description 無「觸發：」）。
- [ ] **Step 5: commit** `git commit -m "refactor: review 合一，語言提示寫進 reviewer prompt、不再自動派 lang-reviewer"`

---

### Task 5: pr-explain 限 T3、receive-review 單 commit、write-plan / review-plan 標 T3 only

**parallel-group**: 5
**files**:
- modify: `skills/finish-branch/SKILL.md`（使用契約第 6 步、§hand-off 下一 phase、description 下游）
- modify: `skills/pr-explain/SKILL.md`（description）
- modify: `skills/receive-review/SKILL.md`（§不危險處置、Red Flags）
- modify: `skills/write-plan/SKILL.md`、`skills/review-plan/SKILL.md`（description + 前提）
- modify: `skills/dev-workflow/SKILL.md`（Phase 1→2 分流兩行、Phase 8 一行）

- [ ] **Step 1: 測試** — P9d、P9e。
- [ ] **Step 2**: grep 'P9[de]' → 2 FAIL。
- [ ] **Step 3: 改寫**

finish-branch 使用契約第 6 步：
```markdown
6. **印 PR URL**。**T3 → 交棒 pr-explain**；T0-T2 → 到此為止、等 user merge（PR body 已含動機 / 改動 / 測試，pr-explain 對這個量體是純成本）。**禁順手 `gh pr merge`**（除非 session 級明授權；見 §Squash merge / WHO / WHEN）。
```
§hand-off「下一 phase」：`T3 → pr-explain；T0-T2 → 無（等 merge；merge 後做 §Merge 後：docs 歸檔）`。description 的「下游：pr-explain」改「下游：pr-explain（T3）」。

pr-explain description 第一句改：「PR diff 詳盡解釋落檔（繁中）。載入：dev-workflow Phase 8（**T3** finish-branch 開好 PR 後）；T0-T2 不自動跑、user 顯式呼叫可。」

receive-review §不危險處置：
```markdown
對全部不危險 finding：

1. 逐條寫 fix（可一次改完）
2. 跑該 tier 的 verify（契約 / test）
3. **一顆 commit**：`fix: 處理 review finding（N 項）`，body 逐項列「finding 簡述 → 怎麼修」
4. 印 `git diff HEAD~1` 給 user 看
```
Red Flags 把「全 fix 完一次 commit 就好 | 違反…」那列換成 `| 「每 finding 一顆 commit 才好 bisect」 | squash merge 後只剩 PR title，bisect 不到；一顆 commit 的 body 列 finding 資訊等價 |`。

write-plan / review-plan：description 的「載入：dev-workflow Phase 2」後加「（**T3 only**；T2 的施工清單在 spec 內，不進本 skill）」；使用契約「前提」加一句「`state.tier` 不是 T3 → 回報「T2 不進 write-plan」並交棒 execute-plan，不寫 plan.md」。

dev-workflow Dev track 路徑圖：`1. brainstorm` 下的三行改成
```
   T1 / T2 → execute-plan（T2 的 task 來源 = spec §施工清單）
   T3 → 2. write-plan → review-plan（4 視角）
```
Phase 8 行改 `8. pr-explain（T3；T0-T2 跳）`。

- [ ] **Step 4**: grep 'P9[de]' → 2 PASS。
- [ ] **Step 5: commit** `git commit -m "refactor: pr-explain 限 T3、review fix 單 commit、write-plan / review-plan 標 T3 only"`

---

### Task 6: 流程圖 data.js + landing index.html

**parallel-group**: 6
**files**:
- modify: `docs/js/data.js`
- modify: `docs/index.html`（`:68` 節點數、`:145` 計數器、`:94` b5 data-nodes、各段 data-upto、`:95` 審查 beat 文案）

- [ ] **Step 1: 先驗 `data-upto` 語意**（推斷 → 實測）

```bash
node -e "
const fs=require('fs');global.window={};eval(fs.readFileSync('docs/js/data.js','utf8'));
const keys=Object.keys(window.FLOW_DATA.nodes);
const html=fs.readFileSync('docs/index.html','utf8');
for(const m of html.matchAll(/id=\"(b\d)\" data-upto=\"(\d+)\" data-nodes=\"([^\"]+)\"/g)){
  const last=m[3].split(',').pop();console.log(m[1],'upto=',m[2],'lastIdx=',keys.indexOf(last)+1);}"
# Expected: 每段 upto == lastIdx（語意確認）。不相等 → 停下回報，改用實際語意重算
```

- [ ] **Step 2**: `node docs/tools/docs-site-contract.mjs | grep -E 'C8[acg]'` → C8a FAIL。

- [ ] **Step 3: 改**

data.js 節點：刪 `RPSplit`、`RPT2`、`LangAgent` 三行；改 label：
- `RevT2` → `'T2：1 subagent\n（prompt 附語言 idiom）'`
- `RevT3` → `'T3：雙視角 subagent\n（架構 × 除錯，各附語言 idiom）'`
- `LoadPrEx` → `'載入 skill：pr-explain（T3）'`
- `WritePlan` → `'寫 docs/work/<branch-name>/plan.md（T3）\nbite-sized task + 並行性分析'`

data.js 邊：刪 `['LoadRP','RPSplit']`、`['RPSplit','RPT2']`、`['RPSplit','RPT3']`、`['RPT2','UG1']`、`['RevT2','LangAgent']`、`['RevT3','LangAgent']`、`['LangAgent','LoadRecv']`；
加 `['LoadRP','RPT3','','solid']`、`['RevT2','LoadRecv','','solid']`、`['RevT3','LoadRecv','','solid']`、`['PushPR','MergeGate','T0-T2：PR 開好即停，等 user merge','solid']`；
改 label：`['TrackSplit','LoadExec']` → `'Dev + T1 / T2\n跳 Phase 2（T2 的 task 來源 = spec §施工清單）'`、`['TrackSplit','LoadWP']` → `'Dev + T3'`、`['PushPR','LoadPrEx']` → `'T3：PR 開好即交棒'`、`['TaskFail','LoadWP']` 與 `['VerifyFail','LoadWP']` → `'退回 write-plan（T3）/ brainstorm 改施工清單（T2）'`。
上方註解「T1 依 rules.md §Tier 機制…」改成「T1 / T2 依 rules.md §Tier 表跳 Phase 2：T2 的 task 來源是 spec §施工清單；review-plan 只服務 T3」。

index.html：`<b>99</b><span>節點</span>` → 96；`/ 99 個節點` → 96；b5 `data-nodes="LoadReq,RevT3,LangAgent,AutoFixQ"` → `"LoadReq,RevT2,RevT3,AutoFixQ"`；各段 `data-upto` 用 Step 1 腳本重算後填入；審查 beat（`:95`）「<code>lang-reviewer</code> 依改的檔自動派發、按語言抓對應的 idiom 與 pitfall」改「語言的 idiom 與 pitfall 提示直接寫進 reviewer 的 prompt，<code>lang-reviewer</code> 你點名才派」。

- [ ] **Step 4**: `node docs/tools/docs-site-contract.mjs` → ALL PASS（C8a 96/133、C8c 無孤兒、C8g 兩處 96）。
- [ ] **Step 5: commit** `git commit -m "docs: 流程圖與 landing 同步 T2 lane 精簡"`

---

### Task 7: README 其餘三列 + 重產 references-data.js + 全套驗證

**parallel-group**: 7
**files**:
- modify: `README.md`（write-plan / review-plan / pr-explain 三列）
- generate: `docs/js/references-data.js`

- [ ] **Step 1: 測試** — C8b / C18 / `build-references.ps1 -Check`。
- [ ] **Step 2**: `pwsh -NoProfile -File scripts/build-references.ps1 -Check; echo $?` → 非 0（skill 改了、內嵌沒跟）。
- [ ] **Step 3**:

README 三列：
```markdown
| **write-plan** | T3 才寫：把要做的事拆成一條條 task、落成計畫文件。T2 的施工清單直接寫在 spec 裡 |
| **review-plan** | T3 才跑：計畫寫好後找四個視角再 review 一遍 |
| **pr-explain** | T3 才自動跑：PR 開完後另外寫一份「為什麼這樣改」的解說文件；其他 tier 你點名才跑 |
```
然後 `pwsh -NoProfile -File scripts/build-references.ps1`。

- [ ] **Step 4**:
```bash
pwsh -NoProfile -File scripts/build-references.ps1 -Check   # exit 0
node docs/tools/docs-site-contract.mjs | tail -1               # ALL PASS
node scripts/plugin-contract.mjs | tail -1                     # ALL PASS
grep -rn 'subagent + lang-reviewer\|動態 spawn\|自動派發' skills agents README.md docs/index.html | grep -v 'references-data'   # 0 行
```
- [ ] **Step 5: commit**（兩顆）`docs: README 標 write-plan / review-plan / pr-explain 為 T3` 與 `chore: 重產 references-data.js`

---

### Task 8: landing 實測 + 設計對齊紀錄

**parallel-group**: 8
**files**: 無（只驗）

- [ ] **Step 1**: 起本機 http（scratchpad 的 serve-docs.mjs）、Playwright 開 index.html，捲到每段確認節點鏈 `data-nodes` 都找得到節點（landing.js:149 找不到會靜默跳過），計數器最後停在 96、進度條 100%；開 flow.html 確認圖渲染、無 console error、`RevT2 → LoadRecv` 邊存在。
- [ ] **Step 2**: 四項對齊檢查：元件狀態 N/A（無新互動元件）、斷點 N/A（未動 CSS）、表單 N/A、dark mode N/A（未動色值）；依據記進本檔。
- [ ] **Step 3-5**: 無 code、無 commit；結果寫回本檔 Task 8 下方。

---

## Self-review

| spec success criteria | task |
|---|---|
| 1 T2 施工清單進 spec、write-plan / review-plan T3 only | 3、5；P9b |
| 2 review 合一、lang-reviewer 不自動派 | 4；P9c / P9f |
| 3 pr-explain 限 T3 | 5；P9d |
| 4 receive-review 單 commit | 5；P9e |
| 5 rules.md Tier 表 | 2；P9a |
| 6 docs 站同步 | 6、7；C8a / C8c / C8g / C8b / C18 |
| 7 三支驗證器全綠 | 7 Step 4 |
| 8 grep 無舊敘述 | 7 Step 4 最後一行；P9g |

- placeholder：無。
- 名稱一致：`## 施工清單` 標題在 brainstorm 範本、execute-plan 讀法、P9b 三處同字面；`plan_path: null` 在 brainstorm 交棒與 execute-plan 讀法同名。
- 並行性：Task 2-5 動不同檔、理論可並行，但每個 5-40 行、共用同一支 P9 契約逐條轉綠，串行讓紅綠對得上哪條；開 subagent 的協調成本高於收益，故分開 group。Task 6 依賴 Task 4（b5 文案）與 Task 5 無依賴但同在 docs；Task 7 必須最後（產出器）。
- scope：未動 T1 / T0 / Bug track / security-audit 條件 / verify-done 套餐 / hooks，與 spec 排除清單一致。
