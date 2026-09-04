# T2 lane 精簡 Implementation Plan（v2，依 review.md 修訂）

> 對應 spec: `docs/work/refactor/t2-lane-slim/spec.md`
> Track: Dev | Tier: T3
> 建立: 2026-09-04（v2 同日）
> 並行最大 group: 8

**Goal**: T2 不寫 plan.md / 不跑 review-plan（施工清單進 spec）、review 合一、pr-explain 限 T3、review fix 單 commit、T3 review-plan 視角依改動面向選（CEO 移除）；rules / 13 個 skill / 1 個 agent / docs 站 / README 全部同步、不留舊敘述。

**Architecture**: 真相層級寫死在 rules.md：**lane 行為唯一真相 = rules.md §Tier 表**；施工清單格式真相 = brainstorm §spec 文件結構；routing 真相 = dev-workflow。機械守門：`scripts/plugin-contract.mjs` 加 P9a-i（每條附「改處」）、`docs/tools/docs-site-contract.mjs` C8a EXPECT 96 / 134、C6a 基準拿掉 RPT2。docs 站 skill 內嵌靠 `scripts/build-references.ps1` 最後重產一次。

**Tech Stack**: markdown / 純 JS 資料檔 / node 內建模組 / pwsh 7。

**Risks**:
- `data-upto` 是手填累計進度數（Design / Eng 實測，非索引）；本 plan 用「舊值減去其前被刪節點數」校正，不重算全部。
- `LangAgent` 節點從圖上刪，但 `app.js` NODE_DOCS 的 `LangAgent` 條目必須**保留**（它是 lang-reviewer 文件唯一的索引入口，刪了 C18 紅）。
- 本 PR 自己走舊規則（雙視角 + lang-reviewer code review、security-audit、pr-explain）。

---

## 檔案結構

| 路徑 | 動什麼 |
|---|---|
| `scripts/plugin-contract.mjs` | P8 後加 P9a-i |
| `docs/tools/docs-site-contract.mjs` | `:243` BASELINE_KEYS 拿掉 `'RPT2'`；`:328-330` EXPECT 96/134 + 標籤 template literal |
| `skills/devwork/rules.md` | §Tier 表；表下三句；`:107` pr-review 行 |
| `skills/dev-workflow/SKILL.md` | `:76-92` 路徑圖區塊（完整替換）；Phase 5 三行；Phase 8；`:161-162` state 註解；`:189` Trace 範例；`:255` 跨流程表 lang-reviewer 列 |
| `skills/brainstorm/SKILL.md` | description；契約 3.5 / 4；範本加 `## 施工清單` + 規則 + `## 施工紀錄`；`:220`；spec gate 選單；§交棒；§補施工清單入口 |
| `skills/execute-plan/SKILL.md` | description；契約 1；§Task 推進 2；§Parallel-group 首句；§Task fail 第 3 點；施工紀錄句 |
| `skills/design-direction/SKILL.md` | `:10`、`:329` 下游 |
| `skills/write-plan/SKILL.md` | description；前提；`:202`；`:210` |
| `skills/review-plan/SKILL.md` | description；契約 2；`:27`；`:137`；`:189`；`:248`；`:259`；`:269-270` |
| `skills/request-review/SKILL.md` | description；契約 2；§T2（prompt task 來源、`{語言提示}`）；§語言提示（新）；§T3；§結果整合；Red Flags |
| `skills/receive-review/SKILL.md` | §不危險處置；Red Flags 末列 |
| `skills/finish-branch/SKILL.md` | description 下游；契約 6；`:216` PR body plan 行；§hand-off 下一 phase |
| `skills/pr-explain/SKILL.md` | description |
| `skills/dispatch-parallel/SKILL.md` | `:20`、`:22`、`:102`、`:162-167`、`:226` |
| `skills/verify-done/SKILL.md` | `:73` |
| `skills/context-snapshot/SKILL.md` `:51`、`skills/context-resume/SKILL.md` `:84` | plan_path 允許 null |
| `agents/lang-reviewer.md` | description 首句與末句 |
| `README.md` | `:5`、brainstorm / write-plan / review-plan / pr-explain / lang-reviewer 五列 |
| `docs/js/data.js` | 刪 3 節點、刪 7 邊、加 5 邊、改 9 個 label |
| `docs/js/app.js` | `:51-52` 註解；`:98` 刪 RPT2 條目；`:91` LangAgent 加註解；`:533` 註解 |
| `docs/index.html` | `:68` `:145` 節點數；7 段 `data-upto`；b5 `data-nodes`；`:87` 規劃 beat；`:95` 審查 beat；`:99` 留痕 beat |
| `docs/js/references-data.js` | 產出器重產 |

### 兩端契約（brainstorm ↔ execute-plan ↔ dispatch-parallel）

spec.md 末尾，標題**恰為** `## 施工清單`（裸、無括號；execute-plan 與 P9b 都精確比對這一行）：

```markdown
## 施工清單

| # | group | 檔（可多個） | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `path/a.js` | 加 X | `node test a` 由紅轉綠 |

## 施工紀錄

（execute-plan 施工中追加：四項對齊檢查結果與依據、執行偏差、實際產出）
```

規則：≤ 8 列，超過回 0d 升 T3；`group` 預設每列不同號、同號只在真的獨立且各自可驗時用；「怎麼驗」必須是可跑的 check 或可對照的引文 / 截圖。

### 視角依改動面向（review-plan、T3）

| brainstorm 0b `codebase_impact` 命中的面向 | 視角 |
|---|---|
| 有機械可驗的東西（regex / 資料檔 / 契約腳本 / 測試） | Eng（必派，下限） |
| 有人要讀的東西（規則、prompt、文案、README、API 文件） | DX |
| 跨模組兩端契約、對外介面（UI、API、流程圖、hand-off state） | Design |

命中幾個派幾個；brainstorm 在 state 寫 `review_perspectives: [...]`，review-plan 只讀不判。**CEO 視角移除**（user 2026-09-04 決定）：「該不該做、範圍、MVP」在 brainstorm 合併確認與 spec gate 已由 user 決定，plan 階段再問是重複；brainstorm self-review「scope 太大 → 拆」保留當替代。

---

### Task 1: 契約先紅

**parallel-group**: 1
**files**: `scripts/plugin-contract.mjs`（P8 後）、`docs/tools/docs-site-contract.mjs:243,328-330`

- [ ] **Step 1: 寫失敗檢查**

plugin-contract.mjs 在 P8 `check(...)` 之後插入：

```js
// ── P9 T2 lane 一致性（2026-09-04 精簡）────────────────────────────────────
// lane 定義散在 rules / 9 個 skill / 1 個 agent / README / landing，任一處留舊敘述，
// Claude 在那一步就照舊做。逐檔 grep 新舊字樣，舊的還在或新的沒到就紅，訊息附改處。
const rulesMd = rd('skills/devwork/rules.md');
const tierT2 = (rulesMd.match(/^\| \*\*T2\*\*.*$/m) || [''])[0];
const tierT3 = (rulesMd.match(/^\| \*\*T3\*\*.*$/m) || [''])[0];
const tierHead = (rulesMd.match(/^\| Tier \| 量體 \|.*$/m) || [''])[0];
check('P9a rules.md §Tier 表：T2 施工清單 + 1 subagent；T3 雙視角、視角依面向；表頭有 pr-explain 欄',
  /施工清單/.test(tierT2) && /1 subagent/.test(tierT2) && /雙視角/.test(tierT3) && /依改動面向/.test(tierT3) &&
    !/lang-reviewer/.test(tierT3) && /pr-explain/.test(tierHead) && !/T2-T3 詳/.test(rulesMd),
  `T2=「${tierT2.slice(0, 70)}」 T3 雙視角=${/雙視角/.test(tierT3)} 依面向=${/依改動面向/.test(tierT3)} ` +
    `表頭 pr-explain=${/pr-explain/.test(tierHead)} 殘留「T2-T3 詳」=${/T2-T3 詳/.test(rulesMd)}` +
    `（後果：Tier 表是 lane 唯一真相，沒改等於沒精簡；改處：rules.md「§Tier 機制」表與「§Docs 落檔」檔名固定那行）`);
const bsMd = rd('skills/brainstorm/SKILL.md'), exMd = rd('skills/execute-plan/SKILL.md');
check('P9b brainstorm 範本有裸標題「## 施工清單」與「## 施工紀錄」、spec gate 選單指 execute-plan；execute-plan 讀施工清單且允許 plan_path null',
  /^## 施工清單$/m.test(bsMd) && /^## 施工紀錄$/m.test(bsMd) && /進 execute-plan/.test(bsMd) && !/進 <write-plan\|debug-systematic>/.test(bsMd) &&
    /恰為 `## 施工清單`/.test(exMd) && /plan_path.*null/.test(exMd) && /施工紀錄/.test(exMd),
  `brainstorm 標題=${/^## 施工清單$/m.test(bsMd)} 紀錄=${/^## 施工紀錄$/m.test(bsMd)} gate=${/進 execute-plan/.test(bsMd)} ` +
    `execute-plan 精確比對=${/恰為 \`## 施工清單\`/.test(exMd)} null=${/plan_path.*null/.test(exMd)}` +
    `（後果：兩端契約缺一邊 T2 就卡；改處：brainstorm「§spec 文件結構」「§交棒」、execute-plan「§使用契約」第 1 步）`);
const rrMd = rd('skills/request-review/SKILL.md'), dwMd = rd('skills/dev-workflow/SKILL.md');
check('P9c request-review / dev-workflow 不再自動派 lang-reviewer，改語言提示',
  !/subagent_type:\s*lang-reviewer/.test(rrMd) && /§語言提示/.test(rrMd) && !/\+\s*lang-reviewer/.test(dwMd) && !/plan: <plan 內容>/.test(rrMd),
  `request-review 自動派發=${/subagent_type:\s*lang-reviewer/.test(rrMd)} 語言提示段=${/§語言提示/.test(rrMd)} ` +
    `dev-workflow 殘留「+ lang-reviewer」=${/\+\s*lang-reviewer/.test(dwMd)} T2 prompt 仍貼 plan=${/plan: <plan 內容>/.test(rrMd)}` +
    `（後果：T2 還是開三個 reviewer；改處：request-review「§T2 subagent dispatch」「§語言提示」、dev-workflow「Phase 5」「§跨流程 skill 載入」「§Trace 標籤」範例）`);
const fbMd = rd('skills/finish-branch/SKILL.md'), peFm = frontmatter(rd('skills/pr-explain/SKILL.md'));
check('P9d finish-branch 只在 T3 交棒 pr-explain、PR body plan 行允許 N/A；pr-explain 描述註明 T3',
  /T3 → 交棒 pr-explain/.test(fbMd) && /N\/A（T2/.test(fbMd) && /T3/.test(description(peFm)),
  `finish-branch T3 交棒=${/T3 → 交棒 pr-explain/.test(fbMd)} PR body N/A=${/N\/A（T2/.test(fbMd)} pr-explain.desc T3=${/T3/.test(description(peFm))}` +
    `（後果：T2 每次多燒數萬 token；改處：finish-branch「§使用契約」第 6 步、「§PR body 模板」Refs、「§hand-off state」；pr-explain frontmatter）`);
const rvMd = rd('skills/receive-review/SKILL.md');
check('P9e receive-review 不危險類一顆 commit',
  /處理 review finding/.test(rvMd) && /一顆 commit/.test(rvMd) && !/每 finding fix 一個 commit/.test(rvMd),
  `新句=${/處理 review finding/.test(rvMd)} 一顆=${/一顆 commit/.test(rvMd)} 舊句=${/每 finding fix 一個 commit/.test(rvMd)}` +
    `（後果：squash 後全消失的 commit 照做；改處：receive-review「§不危險處置」「§Red Flags」）`);
const lrFm = frontmatter(rd('agents/lang-reviewer.md'));
check('P9f lang-reviewer agent 描述改 user 顯式呼叫',
  !/動態 (spawn|dispatch)/.test(description(lrFm)) && /顯式/.test(description(lrFm)),
  `desc=「${description(lrFm).slice(-70)}」（後果：agent 描述與 request-review 打架；改處：agents/lang-reviewer.md description 首句與末句）`);
const readmeMd = rd('README.md');
const readmeLR = (readmeMd.match(/^\| \*\*lang-reviewer\*\*.*$/m) || [''])[0];
check('P9g README：lang-reviewer 列不寫「自動派發」、簡介標 T3 PR 解釋',
  readmeLR !== '' && !/自動派發/.test(readmeLR) && /T3 PR 自動解釋/.test(readmeMd),
  `lang-reviewer 列=「${readmeLR.slice(0, 60)}」 簡介 T3=${/T3 PR 自動解釋/.test(readmeMd)}（後果：README 說謊；改處：README.md 第 5 行與 Agents 表）`);
const rpMd = rd('skills/review-plan/SKILL.md'), wpMd = rd('skills/write-plan/SKILL.md');
check('P9h review-plan / write-plan 無 T2 分支、review-plan 視角依面向',
  !/T2.*Eng-only|Eng-only.*T2|T2 不能跳|T2 仍需/.test(rpMd) && /依改動面向|命中幾個派幾個/.test(rpMd) && !/Eng-only/.test(wpMd),
  `review-plan 殘留 T2=${/T2.*Eng-only|Eng-only.*T2|T2 不能跳|T2 仍需/.test(rpMd)} 依面向=${/依改動面向|命中幾個派幾個/.test(rpMd)} write-plan Eng-only=${/Eng-only/.test(wpMd)}` +
    `（後果：前提說 T2 不進、Red Flag 說 T2 不准跳，Claude 挑一條照做；改處：review-plan 全檔 8 處、write-plan「§落檔 + 交棒」）`);
const ddMd = rd('skills/design-direction/SKILL.md'), dpMd = rd('skills/dispatch-parallel/SKILL.md');
check('P9i design-direction 下游分 T2 / T3；dispatch-parallel task 來源含施工清單',
  /T2/.test(ddMd) && /施工清單/.test(ddMd) && /施工清單/.test(dpMd) && !/退 write-plan\*\* 改 parallel-group 標$/m.test(dpMd),
  `design-direction T2=${/T2/.test(ddMd)} dispatch-parallel 施工清單=${/施工清單/.test(dpMd)}` +
    `（後果：T2 大改定案後沒人回寫清單、T2 同 group 派工找不到 Task N；改處：design-direction description 與「§與 dev-workflow 銜接」下游、dispatch-parallel「§使用契約」1-2、「§隊友派工」「§subagent 派工」範本、「§失敗處置」）`);
```

docs-site-contract.mjs：`:243` 那行 `'RPT2', 'RPT3',` 改 `'RPT3',`（RPT2 節點已刪，NODE_DOCS 條目同步刪）；`:328-330` 改：
```js
const EXPECT = { nodes: 96, edges: 134, phases: 15, types: 8 };
check(
  `C8a 資料契約 ${EXPECT.nodes} nodes / ${EXPECT.edges} edges / ${EXPECT.phases} phases / ${EXPECT.types} types`,
```

- [ ] **Step 2: 跑確認失敗**
```bash
node scripts/plugin-contract.mjs | grep -E '^FAIL|FAIL$'   # Expected: P9a-i 九條 FAIL，結尾 "9 FAIL"
node docs/tools/docs-site-contract.mjs | grep -E 'C6a|C8a|FAILED'   # Expected: C6a FAIL（app.js 仍有 RPT2）、C8a FAIL；"2 FAILED"
```
- [ ] **Step 5: commit** `test: 加 P9a-i 守 T2 lane 一致性、C8a / C6a 改新基準（先紅）`，body「刻意先紅：對應改動在 Task 2-7」。

---

### Task 2: rules.md

**parallel-group**: 2
**files**: `skills/devwork/rules.md` §Tier 機制、`:107`

- [ ] **Step 2**: `grep P9a` → FAIL。
- [ ] **Step 3**: 表換成：
```markdown
| Tier | 量體 | brainstorm | plan | TDD | review | security | pr-explain |
|---|---|---|---|---|---|---|---|
| **T0** | 1 行 / typo / 設定 | 跳 | 跳 | 跳 | 跳 | 跳 | 跳 |
| **T1** | ≤2 檔 / 單模組小改 | 對話釐清 | 跳 | 1-2 關鍵測試 | self | 跳 | 跳 |
| **T2** | 3-10 檔 / 單模組 feature | 完整 | 施工清單（spec 內、≤8 列；不寫 plan.md、不跑 review-plan） | 紅綠循環 | 1 subagent（prompt 附語言 idiom） | 涉認證 / 資料層才 audit | 跳（PR body 已含 why / what / test） |
| **T3** | >10 檔 / 跨模組 / 架構 / DB schema | 完整 | plan.md + review-plan（視角依改動面向 1-3） | 紅綠、80% 目標 | 雙視角 subagent（架構 × 除錯，各附語言 idiom） | audit + checklist + db-reviewer | 用 |
```
表下那句之後加：
```markdown
- **本表是 lane 的唯一真相**；與任何 skill 衝突以本表為準。施工清單格式以 `brainstorm` §spec 文件結構為準；超過 8 列代表 Tier 判低了，回 0d 升 T3。
- **`lang-reviewer` agent 不自動 spawn**：語言 idiom / pitfall 提示由 request-review 依副檔名寫進 reviewer prompt；user 顯式要「用 lang-reviewer 看」才派。
- **T3 review-plan 視角依改動面向**：機械可驗 → Eng（下限）；有人要讀 → DX；跨模組契約 / 對外介面 → Design。命中幾個派幾個，brainstorm 0b 判、寫進 state。「該不該做 / 範圍」在 brainstorm 就定案，plan 階段不再設策略視角。
- 精簡依據見 `docs/archive/2026/t2-lane-slim/spec.md`（2026-09-04；不在此重述，避免常駐吃 context）。
```
`:107` 改：`/ \`pr-review.md\`（pr-explain 覆寫；T3 自動、其他 tier 顯式呼叫才有）`。
- [ ] **Step 4**: `grep P9a` → PASS。
- [ ] **Step 5: commit** `refactor: rules.md Tier 表精簡 T2 lane、視角依面向、加 pr-explain 欄`

---

### Task 3: brainstorm ↔ execute-plan ↔ design-direction

**parallel-group**: 3
**files**: `skills/brainstorm/SKILL.md`、`skills/execute-plan/SKILL.md`、`skills/design-direction/SKILL.md:10,329`

- [ ] **Step 2**: `grep 'P9[bi]'` → 2 FAIL（P9i 的 dispatch 半邊在 Task 4 綠）。
- [ ] **Step 3**:

**brainstorm**
- description 第 7 行「終態 → 交棒 write-plan（Dev）或 debug-systematic（Bug）」→「終態 → T1 / T2 交棒 execute-plan（T2 的施工清單在 spec 內）、T3 交棒 write-plan、Bug 交棒 debug-systematic」。
- 契約 3.5 末尾加：「**T2 且走過三方向** → 依 `direction_decided` 回寫 `## 施工清單`，只對這張表再 `AskUserQuestion` 確認一次（不重問 spec），再進第 4 步。」
- 契約 4 改：「T0 → user 點頭後直接交實作；T1 → 交棒 execute-plan（無 plan）；**T2 → spec 末尾附 `## 施工清單` 後交棒 execute-plan**（不進 write-plan / review-plan）；T3 → 交棒 write-plan。Bug track 一律 debug-systematic。」
- 0b 尾加一步：「6. **T3 視角判定**：依 rules.md §Tier 機制「視角依改動面向」，從 `codebase_impact` 判命中哪些面向，寫 `state.review_perspectives`。」
- 範本「## 待釐清」之後加（標題裸、指示放註解）：
```markdown
## 施工清單

<!-- T2 必填；T1 / T3 刪掉本段與下一段 -->

| # | group | 檔（可多個） | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `exact/path` | <一句> | <可跑的 check，或可對照的引文 / 截圖> |

## 施工紀錄

<!-- execute-plan 施工中追加：四項對齊檢查（N/A 附依據）、執行偏差、實際產出 -->
```
範本後加規則段：「**施工清單規則（T2）**：≤ 8 列，超過回 0d 升 T3；`group` 預設每列不同號，同號只在真的獨立且各自可驗時用（同號會觸發 dispatch-parallel 的協作模式問句）；「怎麼驗」不寫「確認正常」。這張表跟 spec 同一個 gate 確認；確認後 execute-plan 逐列當 task。」
- `:220`「**T2+** 內容完整、所有 section 都要寫」→「**T2+** 內容完整、所有 section 都要寫（T3 不含施工清單兩段）」。
- spec gate 選單改：
```
問：spec 已寫至 docs/work/<branch-name>/spec.md，請看一下。（T2：末尾的施工清單就是全部的計畫，這是最後一次看計畫，下一步直接施工）
選項：
  1. spec 正確，進 execute-plan（T1 / T2）／ write-plan（T3）／ debug-systematic（Bug）（推薦）
  2. 我要改 spec（告訴我改哪裡）
  3. 退回 0a 重新釐清需求
```
- 新增段 `## §補施工清單入口`：「state 已有 `tier=T2` 且 `spec_path` 存在（execute-plan 或 dispatch-parallel 退回來補）→ **不跑 Phase 0**，只做：Read spec → 改寫 `## 施工清單` → 同一顆 spec gate 只問這張表 → 交棒 execute-plan。」
- §交棒 state 加 `plan_path: <docs/work/<branch-name>/plan.md | null>   # T1 / T2 為 null` 與 `review_perspectives: [Eng, DX, ...]   # T3 才有`；「下一 phase」改：
```
- T0 → 直接實作（不交 skill）
- T1 → `execute-plan`（plan_path null，依 spec 自拆 1-3 task）
- T2 Dev → `execute-plan`（plan_path null，task 來源 = spec `## 施工清單`）
- T3 Dev → `write-plan`
- T1+ Bug → `debug-systematic`
```
- Red Flags 加 `| 「T2 也寫個 plan.md 比較保險」 | rules.md §Tier 表：T2 的計畫就是施工清單，寫 plan.md 是走回舊 lane |`。

**execute-plan**
- description 第 4、7 行：「載入：dev-workflow Phase 3（T3 由 review-plan user accept 後；T1 / T2 由 brainstorm 直接交棒）」「上游：review-plan（T3）；brainstorm（T1 / T2，`plan_path` null）」。
- 契約 1 改：
```markdown
1. **讀 task 來源**：`plan_path` 有值（T3）→ Read plan.md。`plan_path` 為 null → Read `spec_path`：T2 取標題行**恰為** `## 施工清單` 的那張表、每列一個 task（`group` = parallel-group、「怎麼驗」= verify command）；T1 依 success criteria 自拆 1-3 個 task。T2 的 spec 沒這段 → 交棒 brainstorm §補施工清單入口，不自己編。
   載入時宣告一句給 user 看：「Tier=T2：依 rules.md §Tier 表不寫 plan.md、不跑 review-plan；task 來源 = spec §施工清單（N 列）」。
```
- §Task 推進 2 改：「讀 task 的 5 個 step（T3）或施工清單那一列（T2：紅 =「怎麼驗」、綠 =「做什麼」、五步由 tdd-cycle 現場展開；「怎麼驗」是目測依據時以截圖 / 引文代替 output），並比對要動的檔…」
- §Parallel-group 首句「讀 plan 看到下面情境」→「讀 plan（T3）或施工清單 `group` 欄（T2）看到下面情境」。
- §Task fail 第 3 點「退到 write-plan 重寫 plan」→「退到 write-plan 重寫 plan（T3）／ 交棒 brainstorm §補施工清單入口（T2）」；末段「三處刻意同一套」不動。
- §Verify 規則後加：「**T2 施工紀錄**：對齊檢查結果與依據、執行偏差、實際產出，追加寫進 spec 的 `## 施工紀錄` 段並 commit（squash 後這是唯一留下的施工帳本）。」

**design-direction** `:10` 與 `:329`：「下游：`write-plan`（依定案方向拆 task）」→「下游：T3 → `write-plan`（依定案方向拆 task）；T2 → 回 `brainstorm` 3.5 依方向回寫 `## 施工清單` 後交 execute-plan」。

- [ ] **Step 4**: `grep P9b` → PASS。
- [ ] **Step 5: commit** `refactor: T2 施工清單進 spec：brainstorm 產、execute-plan 讀、design-direction 分 T2 / T3 出口`，body 提一句「順帶修掉 brainstorm §交棒『T1+ Dev → write-plan』與 execute-plan description『T1 由 brainstorm 直接交棒』既有矛盾」。

---

### Task 4: request-review 合一 + dev-workflow + lang-reviewer + dispatch-parallel + README 該列

**parallel-group**: 4
**files**: `skills/request-review/SKILL.md`、`skills/dev-workflow/SKILL.md:101-102,161-162,189,255`、`agents/lang-reviewer.md:4-7`、`skills/dispatch-parallel/SKILL.md:20,22,102,162-167,226`、`README.md` lang-reviewer 列

- [ ] **Step 2**: `grep 'P9[cfi]'` → 3 FAIL。
- [ ] **Step 3**:

**request-review**
- description：「T1 self review / T2 單一 subagent（prompt 附語言提示）/ T3 雙視角 subagent（架構 × 除錯，各附語言提示）」。
- 契約 2：`T2 = 1 subagent（綜合 review + 語言提示）`、`T3 = 2 subagent（架構 × 除錯，各附語言提示）`。
- §T2 prompt 的 `- plan: <plan 內容>` → `- task 來源: <T2 = spec §施工清單；T3 = plan 內容>`，prompt 末尾加一行 `{語言提示}`。
- **整段「### lang-reviewer dispatch」（含表格與兩段引言）刪除**，換：
```markdown
### §語言提示（寫進 reviewer prompt，不另開 agent）

依改動副檔名組一段貼進每個 reviewer 的 prompt，格式「本 diff 含 <語言>，請特別看：<提示>」，多語言多列：

| 副檔名 | 提示 |
|---|---|
| `.py` | mutable default arg、裸 except、f-string 拼 SQL、type hint 與實際回傳不符 |
| `.ts .tsx .js .jsx .mjs` | `==` 與 truthy 比較、未 await 的 promise、regex 對 CRLF、`any` 逃逸 |
| `.sql` | 無 LIMIT 的重 query、隱式型別轉換讓 index 失效、migration 無回滾 |
| `.go` | err 未檢、goroutine 洩漏、defer 在迴圈內 |
| `.rs` | unwrap 在非測試碼、clone 掩蓋 borrow 問題 |
| `.java .cs .cpp .c .h` | 資源釋放、null / 未初始化、例外吞掉 |
| 其他 | 不附語言段 |

`lang-reviewer` agent 保留給 user 顯式要求（「用 lang-reviewer 看這段 SQL」），本 skill 不自動 spawn。
```
- §T3：「T2 全部 + **再 spawn 一個 subagent**」→「spawn 視角 A 與 B 兩個 subagent，不另開綜合 reviewer」；兩個 prompt 的 `<diff>` 下各加 `{語言提示}`。
- §結果整合：Reviewers 範例 `<self | 綜合 reviewer | 架構 + 除錯>`；「Critical 各自獨見」刪 `lang-reviewer(<lang>)` 列。
- Red Flags：刪「lang-reviewer 找不到對應 language section」與「subagent_type 用 python-reviewer…」兩列，加 `| 「多開一個 lang-reviewer 比較保險」 | 語言 idiom 已在 prompt；三個 reviewer 讀同一份 diff 是浪費，user 顯式要才派 |`。

**dev-workflow**
- `:100-102`：`T1 = self review` / `T2 = 1 subagent（prompt 附語言提示）` / `T3 = 雙視角 subagent（架構 × 除錯，各附語言提示）`。
- `:161-162`：`plan_path: <docs/work/<branch-name>/plan.md | null>  # T3 write-plan 完寫入；T1 / T2 為 null` / `parallel_groups: [...]      # T3 來自 plan、T2 來自 spec 施工清單 group 欄`；下一行加 `review_perspectives: [...]  # T3；brainstorm 0b 依改動面向判`。
- `:189` Trace 範例 `Skill=request-review+lang-reviewer` → `Skill=request-review`。
- `:255` 跨流程表 lang-reviewer 列 → `| \`lang-reviewer\` | user 顯式要求時由主 agent spawn；request-review 不自動派，語言提示寫進 reviewer prompt |`。

**agents/lang-reviewer.md** description：首句「動態 dispatch：主 dispatcher 在 spawn 時 prompt 內標 language」→「由主 agent 在 spawn 時於 prompt 標 language」；末句「載入：dev-workflow Phase 5 request-review 階段，依改動副檔名由主 agent 動態 spawn。」→「載入：request-review 不自動派發；user 顯式要求「用 lang-reviewer 看 <語言>」時由主 agent spawn。」

**dispatch-parallel**
- `:20`「（task ID + plan section path）」→「（task ID + 來源：plan Task N section（T3）／ spec `## 施工清單` 第 N 列（T2））」。
- `:22`「write-plan 階段標的應已驗過、但再驗一次」→「T3 由 write-plan 標、T2 由 brainstorm 施工清單標；這裡是 T2 唯一一次驗」。
- `:102` 與 `:162`「plan 全文: <貼 plan markdown>」→「task 來源: <T3 貼 plan 全文；T2 貼 spec `## 施工清單` 全表>」。
- `:167`「Read plan 找 Task <N> section」→「T3：Read plan 找 Task <N> section；T2：施工清單第 <N> 列，五步由 tdd-cycle 現場展開」。
- `:226`「**退 write-plan** 改 parallel-group 標」→「**退 write-plan**（T3）／ **交棒 brainstorm §補施工清單入口**（T2）改 group 標」。

**README** lang-reviewer 列 → `| **lang-reviewer** | 你點名才派的語言專家：按語言抓 idiom 跟 pitfall（python / TS / SQL / Go …）。平常 review 時語言重點已經寫進 reviewer 的指示裡 |`。

- [ ] **Step 4**: `grep 'P9[cfi]'` → 3 PASS；`grep P7` PASS。
- [ ] **Step 5: commit** `refactor: review 合一、語言提示進 prompt、dispatch-parallel 接施工清單`

---

### Task 5: pr-explain 限 T3、receive-review 單 commit、write-plan / review-plan T3 only、其餘 plan_path null

**parallel-group**: 5
**files**: `skills/finish-branch/SKILL.md:8,26,216,310`、`skills/pr-explain/SKILL.md:4`、`skills/receive-review/SKILL.md` §不危險處置 + Red Flags 末列、`skills/write-plan/SKILL.md:4,16-17(前提),202,210`、`skills/review-plan/SKILL.md:4-6,18-23,27,137,189,248,259,269-270`、`skills/verify-done/SKILL.md:73`、`skills/context-snapshot/SKILL.md:51`、`skills/context-resume/SKILL.md:84`、`skills/dev-workflow/SKILL.md:76-92, Phase 8 行`

- [ ] **Step 2**: `grep 'P9[deh]'` → 3 FAIL。
- [ ] **Step 3**:

**finish-branch**：`:8`「下游：pr-explain」→「下游：pr-explain（T3）；T0-T2 開完 PR 即停」；契約 6 →「**印 PR URL**。**T3 → 交棒 pr-explain**；T0-T2 → 到此為止、等 user merge（PR body 已含動機 / 改動 / 測試）。**禁順手 `gh pr merge`**（…原句）」；`:216` → `- plan: <docs/work/<branch-name>/plan.md（T3）| N/A（T2 施工清單在 spec）>`；`:310` →「T3 → `pr-explain`；T0-T2 → 無（等 merge；merge 後做 §Merge 後：docs 歸檔）」。

**pr-explain** description 第 4 行 →「PR diff 詳盡解釋落檔（繁中）。載入：dev-workflow Phase 8（**T3** finish-branch 開好 PR 後）；T0-T2 不自動跑，user 顯式呼叫可。」

**receive-review** §不危險處置整段 →
```markdown
對全部不危險 finding：

1. 逐條寫 fix（可一次改完）
2. 跑該 tier 的 verify（契約 / test）
3. **一顆 commit**：`fix: 處理 review finding（N 項）`，body 逐項列「finding 簡述 → 怎麼修」
4. 印 `git diff HEAD~1` 給 user 看
```
Red Flags 末列 → `| 「每 finding 一顆 commit 才好 bisect」 | squash merge 後只剩 PR title，bisect 不到；一顆 commit 的 body 列 finding 資訊等價 |`。

**write-plan**：description 第 4 行加「（**T3 only**；T2 的施工清單在 spec 內）」；「**前提**：必須有 spec_path。沒 spec → 退回 brainstorm。」後加「`state.tier` 不是 T3 → 回報「T2 不進 write-plan」並交棒 execute-plan，不寫 plan.md。」；`:201-203`「下一 phase → review-plan」下的兩行 →「- 視角依 `state.review_perspectives`（brainstorm 0b 判）」；`:210` Trace `Tier=<T1-T3>` → `Tier=T3`。

**review-plan**：
- description `:4-6` →「Implementation plan 多視角 review（繁中）。載入：dev-workflow Phase 2（**T3** write-plan 產出 plan 後）；亦可由使用者顯式呼叫。涵蓋：視角依改動面向 1-3（Eng 下限 / DX / Design）；每視角 spawn subagent、主 agent 整合 → 提 user gate。」
- 契約 2 →「**讀 `state.review_perspectives`**（brainstorm 0b 依改動面向判：機械可驗 → Eng；有人要讀 → DX；跨模組契約 / 對外介面 → Design）。命中幾個派幾個，Eng 是下限；state 沒這欄 → 依 rules.md §Tier 機制自判並回寫。「該不該做」不在這裡問，那是 brainstorm 的事。」
- `:27`「**禁止跳階**：T2 不能跳 Eng review；T3 不能少視角。」→「**禁止跳階**：state 標了的視角不能少；T2 進了本 skill 就是路徑錯，回報並交棒 execute-plan。」
- **整段「### 視角 1：CEO（策略） — T3 only」刪除**（含其 prompt）；它裡面的「回報格式」區塊搬到 Eng 模板內，Design / DX 模板的「回報格式：同 CEO 視角」改「同 Eng 視角」。剩下三個視角重新編號：1 Eng（— 必派，下限）、2 DX（— 有人要讀的東西時）、3 Design（— 跨模組契約 / 對外介面時）。
- §結果整合範本的「**CEO**：」列刪除。
- `:189`「視角: <Eng | CEO + Design + Eng + DX>」→「視角: <依 state.review_perspectives，例 Eng + DX>」。
- `:248`「review_perspectives: [CEO, Design, Eng, DX]  # T3 / 或 [Eng] T2」→「review_perspectives: [...]  # 來自 brainstorm 0b，本 skill 只讀」。
- `:259` Trace `Tier=<T2/T3>` → `Tier=T3`。
- `:269-270` 兩列 →「| 「T2 進來了就順便審」 | T2 不進本 skill；回報並交棒 execute-plan |」「| 「視角少一個沒差」 | state 標的視角是 0b 依改動面向判的；少一個就是那個面向沒人看 |」。

**verify-done** `:73` →「- **退回 write-plan 改 plan**（T3）／ **交棒 brainstorm §補施工清單入口**（T2）」。
**context-snapshot** `:51`、**context-resume** `:84`：`plan_path: <docs/work/<branch-name>/plan.md | null>`。

**dev-workflow** `:76-92` 整塊替換為：
```
1. brainstorm（Phase 0 內建，含 0b′ UI 面判定；0b 同時判 T3 review 視角 → state.review_perspectives）
   ↓
   design.size=大改 ＋ 路徑選「出三版」→ branch 建立、spec 落檔後載 design-direction 出三版
                                          → user 選定 → 回寫 spec.md
                                            → T3：write-plan 依方向拆 task
                                            → T2：brainstorm 3.5 依方向回寫 §施工清單、再確認一次 → execute-plan
   design.size=大改 ＋ 路徑選「跳過三方向」→ 理由記入 spec.md → 同上依 Tier 分流
   design.size=小改 → execute-plan 動前端檔的 task 前後載 design-language 跑對齊檢查
   ↓
   T1 / T2 → 3. execute-plan（plan_path null；T2 的 task 來源 = spec §施工清單）
   T3 → 2. write-plan ─→ docs/work/<branch-name>/plan.md（含並行性分析 parallel-group）
        ↓
        review-plan（視角依 state.review_perspectives，Eng 下限）
   ↓
3. execute-plan + tdd-cycle
```
（`3.` 之後原有的兩行子項保留。）Phase 8 行 →「8. pr-explain（T3；T0-T2 跳）→ docs/work/<branch-name>/pr-review.md」。

- [ ] **Step 4**: `grep 'P9[deh]'` → 3 PASS；`node scripts/plugin-contract.mjs | tail -1` → ALL PASS。
- [ ] **Step 5: commit** `refactor: pr-explain 限 T3、review fix 單 commit、review-plan 視角依面向、plan_path 允許 null`

---

### Task 6: 流程圖 data.js + app.js + landing index.html

**parallel-group**: 6
**files**: `docs/js/data.js`、`docs/js/app.js:51-52,91,98,533`、`docs/index.html`

- [ ] **Step 2**: `node docs/tools/docs-site-contract.mjs | grep -E 'C6a|C8[acg]'` → C6a、C8a FAIL。
- [ ] **Step 3**:

**data.js 節點**：刪 `RPSplit`、`RPT2`、`LangAgent`。改 label：
- `RPT3` → `'T3：依改動面向 1-3 視角\nEng 下限 / DX / Design'`
- `RevT2` → `'T2：1 subagent\n（prompt 附語言 idiom）'`
- `RevT3` → `'T3：雙視角 subagent\n（架構 × 除錯，各附語言 idiom）'`
- `LoadPrEx` → `'載入 skill：pr-explain（T3）'`
- `WritePlan` → `'寫 docs/work/<branch-name>/plan.md（T3）\nbite-sized task + 並行性分析'`
- `TaskFail` → `'§Task fail 處置（4 選項）\nretry / adjust+retry / rollback 該 task\n/ 退 write-plan（T3）或 brainstorm 補施工清單（T2）/ escalate'`
- `VerifyFail` 內「/ 退 write-plan / 退 brainstorm 重判設計」→「/ 退 write-plan（T3）或補施工清單（T2）/ 退 brainstorm 重判設計」
- `SpecGate` → `'spec 交 user 看（AskUserQuestion）\nT2：施工清單同一個 gate 確認，之後直接施工'`
- phases `:37` → `'Phase 2：write-plan + review-plan（T3）'`、`:44` → `'Phase 8：pr-explain（T3）'`；ambient `:402` desc → `'T0-T3 決定 brainstorm / plan / TDD / review / security / pr-explain 深度'`

**data.js 邊**：刪 `['LoadRP','RPSplit']`、`['RPSplit','RPT2']`、`['RPSplit','RPT3']`、`['RPT2','UG1']`、`['RevT2','LangAgent']`、`['RevT3','LangAgent']`、`['LangAgent','LoadRecv']`；加 `['LoadRP','RPT3','','solid']`、`['RevT2','LoadRecv','','solid']`、`['RevT3','LoadRecv','','solid']`、`['PushPR','MergeGate','T0-T2：PR 開好即停，等 user merge','solid']`、`['UGDesign','LoadExec','T2：回寫施工清單、再確認 → execute-plan','solid']`；改 label：`['TrackSplit','LoadExec']` → `'Dev + T1 / T2\n跳 Phase 2（T2 的 task 來源 = spec §施工清單）'`、`['TrackSplit','LoadWP']` → `'Dev + T3'`、`['PushPR','LoadPrEx']` → `'T3：PR 開好即交棒'`、`['TaskFail','LoadWP']` 與 `['VerifyFail','LoadWP']` → `'退 write-plan（T3）'`、`:285` → `'Dev + T3 + 大改\n第 3 題選「跳過三方向」\n理由記入 spec.md'`、`:291` → `'T3：user 描述方向 → 做一版'`、`:293` → `'T3 選定：write-plan 2.5 讀定案'`。`:235-236` 註解改「T1 / T2 依 rules.md §Tier 表跳 Phase 2：T2 的 task 來源是 spec §施工清單；review-plan 只服務 T3」。

**app.js**：`:98` 刪 `RPT2:` 那行（前一行註解「這兩筆」改「這一筆」、「RPT2 / RPT3 兩個節點」改「RPT3 節點」）；`:51-52`「**37 個 key 對應 35 個相異文件**——LoadRP / RPT2 / RPT3 三個 key 共用」→「**36 個 key 對應 35 個相異文件**——LoadRP / RPT3 兩個 key 共用」；`:533`「LoadRP / RPT2 / RPT3 三個」→「LoadRP / RPT3 兩個」；`:91` LangAgent 行尾加註解 `// 2026-09-04 起不在圖上（request-review 不自動派），保留給文件索引面板`。

**index.html**：`:68` `<b>99</b>` → 96；`:145` `/ 99 個節點` → 96；`data-upto`：b3 38→36、b4 55→53、b5 75→72、b7 96→93（b1 / b2 / b6 不變）；b5 `data-nodes="LoadReq,RevT3,LangAgent,AutoFixQ"` → `"LoadReq,RevT2,RevT3,AutoFixQ"`；`:87` h2「大改動要先把計畫<br>拆給四個人看」→「大改動要先把計畫<br>拆給別人看」、段落「計畫寫完派四個視角各看一遍：策略上該不該現在做、介面上會不會難用、架構上失敗了怎麼回退、接手的人讀不讀得懂。四份意見整合完、你點頭了才進實作。」→「計畫寫完看改動碰到什麼就派誰看：有機械可驗的東西派工程視角，有人要讀的派接手者視角，跨模組的契約派介面視角。該不該做、做多大，在計畫之前就問過你了。意見整合完、你點頭了才進實作。」；`:95`「<code>lang-reviewer</code> 依改的檔自動派發、按語言抓對應的 idiom 與 pitfall；」→「<code>lang-reviewer</code> 你點名才派、按語言抓對應的 idiom 與 pitfall（平常的 review 已把語言提示寫進 reviewer 的 prompt）；」；`:99`「PR 開完之後還有一個 agent 重讀一次 diff」→「T3 的 PR 開完之後還有一個 agent 重讀一次 diff」。

- [ ] **Step 4**: `node docs/tools/docs-site-contract.mjs` → ALL PASS（C6a 36 key、C8a 96/134、C8c 0/0、C8g 兩處 96）。
- [ ] **Step 5: commit** `docs: 流程圖、索引與 landing 同步 T2 lane 精簡`

---

### Task 7: README 其餘 + 重產 references-data.js + 全套驗證

**parallel-group**: 7
**files**: `README.md:5,28-30,39`、`docs/js/references-data.js`（產）

- [ ] **Step 2**: `pwsh -NoProfile -File scripts/build-references.ps1 -Check; echo $LASTEXITCODE` → 非 0；`grep P9g` → FAIL。
- [ ] **Step 3**: README `:5`「PR 自動解釋落檔」→「T3 PR 自動解釋落檔」；`:28` brainstorm 列末加「；T2 會順手列一張施工清單、不另寫計畫」；write-plan 列 →「T3 才寫：把要做的事拆成一條條 task、落成計畫文件。T2 的施工清單直接寫在 spec 裡」；review-plan 列 →「T3 才跑：計畫寫好後看改動碰到什麼面向，派對應的視角再 review 一遍」；pr-explain 列 →「T3 才自動跑：PR 開完後另外寫一份「為什麼這樣改」的解說文件；其他 tier 你點名才跑」。然後 `pwsh -NoProfile -File scripts/build-references.ps1`。
- [ ] **Step 4**:
```bash
pwsh -NoProfile -File scripts/build-references.ps1 -Check; echo $LASTEXITCODE   # 0
node docs/tools/docs-site-contract.mjs | tail -1      # ALL PASS
node scripts/plugin-contract.mjs | tail -1            # ALL PASS
# 舊句掃描（只抓舊語意；新句「不自動派發」不在 pattern 內）
grep -rn '依改的檔自動派發\|依改動副檔名.*dispatch\|動態 spawn\|subagent + lang-reviewer\|T2 Eng-only\|T2 = Eng-only' skills agents README.md docs/index.html docs/js/data.js docs/js/app.js   # 0 行
# write-plan 逐處人工判「T2 仍會經過嗎」——每行看完在 commit body 列結論
grep -rn 'write-plan' skills docs/index.html docs/js/data.js | grep -v 'references-data' | grep -v 'T3'
```
- [ ] **Step 5: commit** 兩顆：`docs: README 同步 T2 lane 精簡`、`chore: 重產 references-data.js`（body 列 grep 逐處判斷結論）。

---

### Task 8: landing 實測 + 對齊紀錄

**parallel-group**: 8

- [ ] Step 1：起 scratchpad 靜態伺服器，Playwright 開 index.html：捲到每段，`data-nodes` 的節點都存在（landing.js:149 找不到會靜默跳過）、計數器最後 96、進度條在 b7 為 93/96 未滿、coda 段補滿；開 flow.html：無 console error、`RevT2 → LoadRecv` 與 `UGDesign → LoadExec` 邊存在、`LangAgent` 不在圖上但文件索引面板仍列 lang-reviewer。
- [ ] Step 2：四項對齊檢查全 N/A（無新互動元件 / 未動 CSS / 無表單 / 未動色值），依據記本檔。
- [ ] Step 3-5：無 code。

---

## Self-review

| spec success criteria | task / 契約 |
|---|---|
| 1 施工清單進 spec、write-plan / review-plan T3 only | 3、5；P9b / P9h |
| 2 review 合一、lang-reviewer 不自動派 | 4；P9c / P9f |
| 3 pr-explain 限 T3 | 5；P9d |
| 4 receive-review 單 commit | 5；P9e |
| 5 rules.md Tier 表 | 2；P9a |
| 6 docs 站同步 | 6、7；C6a / C8a / C8c / C8g / C8b / C18 |
| 7 三支驗證器全綠 | 7 Step 4 |
| 8 grep 無舊敘述 | 7 Step 4；P9g |
| 9 視角依改動面向 | 2、3（0b 判）、5（review-plan / write-plan）、6（RPT3、landing）；P9a / P9h |

- review.md 逐條對照：C1 → Task 3（brainstorm 3.5、design-direction）+ Task 6（UGDesign→LoadExec、三條邊 T3 前綴）；C2 → Task 3（gate 選單、description、宣告句）；C3 → Task 7 grep 改寫；Major 1 → Task 5 review-plan 8 處 + write-plan 2 處 + P9h；Major 2 → Task 6 data-upto；Major 3 → 兩端契約段 + P9b 精確比對；Major 4 → Task 4 dispatch-parallel + P9i；Major 5 → Task 3 §補施工清單入口；Major 6 → Task 5 dev-workflow 完整區塊；Major 7 → Task 4 / 5 plan_path null 四處；Major 8 → Task 1 C6a + Task 6 app.js；Major 9 → Task 2 `:107`；Major 10 → Task 3 施工紀錄；Major 11 → Task 6 `:99`；Major 12 → P9 每條改處。Minor / Nit 全部落在對應 task 的 Step 3。
- 並行性：group 1→8 串行。Task 2-5 動不同檔但共用 P9 逐條轉綠，串行讓紅綠對得上；Task 6 只真依賴 Task 1（C6a / C8a 先紅）；Task 7 產出器必最後。
- scope：未動 T1 / T0 / Bug track / security-audit 條件 / verify-done 套餐 / hooks。

---

## Task 8 實測紀錄（2026-09-04）

- **landing**（Playwright，`http://127.0.0.1:8765/index.html`）：七段 `data-nodes` 的節點全部存在；計數與進度條逐段 7 / 22 / 30 / 36 / 53 / 72 / 93、捲到 `#install` 收滿 96 與 100%；hero「96 節點」；規劃 beat h2「拆給別人看」、留痕 beat「T3 的 PR 開完之後」；console 0 error。
- **flow.html**：96 nodes / 134 edges、`#flow` 321 個 `g`；`RevT2→LoadRecv`、`UGDesign→LoadExec`、`PushPR→MergeGate` 三條新邊在；`LangAgent` / `RPT2` 不在圖上；文件索引仍列 lang-reviewer；RPT3 label 為「T3：依改動面向 1-3 視角」；console 0 error。
- **四項對齊檢查**：元件狀態 N/A（無新互動元件）；斷點 N/A（`docs/css` 零改動）；表單 N/A（index.html 無 `<form>` / `<input>`）；dark mode N/A（未動色值）。index.html 的 diff 以屬性集合比對，只有 `data-upto` ×4 與 `data-nodes` ×1 依計畫變動，無 class / style / id / href 變動。
- **執行偏差**：(1) P9b 的「恰為」regex 沒容忍粗體標記，補 `\*{0,2}`；(2) request-review / review-plan 的區塊改寫用 node 腳本，錨點命中數用 global 旗標計，且 request-review 是 CRLF 檔，`.*\n` 要寫 `.*\r?\n`；(3) design-direction `:329` 的「**下游**」帶粗體，Task 3 的 replace 沒命中，Task 7 人工掃到補改；(4) `TrackSplit→LoadWP` 有兩條邊，先改設計 lane 那條再改一般那條。
- **驗證器**：`docs-site-contract` ALL PASS、`plugin-contract` ALL PASS（含 P9a-i）、`build-references.ps1 -Check` exit 0、舊句掃描 0 行。
