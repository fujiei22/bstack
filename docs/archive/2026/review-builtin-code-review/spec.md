# request-review 改接內建 code-review

> Track: Dev | Tier: T2 | 建立: 2026-09-04

## 動機 / Why

PR #64 精簡 T2 lane 後，code review 仍是自寫 prompt 派 general-purpose subagent。官方 best practices 說「For a correctness check, run the bundled `/code-review` skill… To check the diff against your plan instead, write the review prompt yourself」——內建 skill 負責抓 bug 與可簡化處（有 8 個 finder 視角 + 逐條驗證），這件事自寫 prompt 做不到同樣覆蓋。自寫 reviewer 該留下的只剩「符合 spec / 規則書」這題。

另一個成本問題：純文件 diff（.md / 文案 / prompt）跑 code review 是燒 token 找不到東西——一致性靠契約腳本（P9 類）與 plan review 就夠。

本 spec 同時是 PR #64 新 T2 lane 的第一次實戰：施工清單在 spec 內、不寫 plan.md、不跑 review-plan。

## 目標 / Success criteria

- `rules.md §Tier 表` 的 review 欄改為新 lane，其他檔（request-review / dev-workflow Phase 5 / data.js 節點 label / 契約 P9c）與表一致
- request-review 依「改動副檔名 × Tier」分流：程式碼 + T2 → `/code-review medium` + 主 agent spec coverage 自檢；程式碼 + T3 → `/code-review high` + 一個 spec / 架構對齊 subagent；純文件 → 跳 code review
- `node scripts/plugin-contract.mjs`、`node docs/tools/docs-site-contract.mjs` 全綠；`pwsh -File scripts/build-references.ps1` 重產後 `-Check` exit 0
- 用一個真實 diff 實跑一次新流程，輸出樣本貼在 `## 施工紀錄`

## 範圍 / Scope

**包含**：
- `skills/devwork/rules.md` §Tier 表 review 欄（T2 / T3）
- `skills/request-review/SKILL.md` 全檔重寫分流（保留 §語言提示、§結果整合、hand-off state）
- `skills/dev-workflow/SKILL.md` Phase 5 路徑圖、§跨流程 skill 載入 表 lang-reviewer 列
- `docs/js/data.js` RevT2 / RevT3 / ReviewQ 節點 label（只改 label，不增減節點 / 邊）
- `scripts/plugin-contract.mjs` P9c 改驗新敘述
- `docs/js/references-data.js` 由 build-references.ps1 重產

**排除**：
- receive-review 行為不動（finding 分類 / auto-fix 規則照舊；只是 finding 來源多一種格式）
- `--fix` / `--comment` 兩個旗標不用（理由見 §實測結論）
- `ultra` 不用（雲端多 agent、計費、需 user 手動觸發）
- 純文件 diff 的一致性檢查不新增機制（沿用契約腳本 + T3 review-plan）
- README / landing 文案不動（現有敘述「review 派給獨立 context」對新 lane 仍成立）

## 影響檔案 / Codebase impact

| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `skills/devwork/rules.md` | edit（Tier 表 T2 / T3 review 欄） | 常駐每個 session，字數要省；P9a 驗這兩列 |
| `skills/request-review/SKILL.md` | edit（重寫 §使用契約 / 新增 §副檔名分流 / §T2 / §T3；刪視角 B） | P9c 驗 §語言提示 與不派 lang-reviewer |
| `skills/dev-workflow/SKILL.md` | edit（Phase 5 三行 + 跨流程表一列） | P9c 驗不殘留「+ lang-reviewer」 |
| `docs/js/data.js` | edit（3 個 label） | C8a 節點 / 邊數不能變 |
| `scripts/plugin-contract.mjs` | edit（P9c） | 契約自身改動要 --selftest 級別的自證：先讓它紅再綠 |
| `docs/js/references-data.js` | regenerate | build-references -Check |

## 設計方向

`design.involved=false`：改動檔剔除 `skills/*/SKILL.md` 後剩 `.md` / `.js` / `.mjs`，無 §前端副檔名 命中。`data.js` 是流程圖資料檔，不是介面樣式。

## 實測結論（Phase 0 第一步；2026-09-04，Claude Code 2.1.260）

### 1. 流程內能不能用 Skill 工具呼叫 code-review、帶什麼 args、輸出是什麼

**能。** `Skill(skill="code-review", args="<level> [target]")`，target 可省（當前 diff）、可給 PR 號 / branch / path。實測兩次：

| 呼叫 | 執行方式 | 工具呼叫 | 輸出格式 | 成本 |
|---|---|---|---|---|
| `low 65` | **forked 背景 agent**（Skill 工具立刻回「launched (forked execution, running in the background)」，主 agent 收 task-notification） | 1 次 `gh pr diff 65`；prompt 明寫「No subagents, no full-file reads」 | **純文字**：≤4 行 `path:line — 問題`，沒東西就 `(none)`；prompt 明寫「Do not call the ReportFindings tool even if it is available」 | 49k subagent token（大半是 fork 繼承的主 context）、48 秒（含我回問一次） |
| `medium 62` | 同上 forked 背景 | Phase 1 派 **8 個 finder subagent**（3 correctness + reuse / simplification / efficiency / altitude / conventions(CLAUDE.md)），Phase 2 每個 candidate 派 1 個 verifier（CONFIRMED / PLAUSIBLE / REFUTED） | **JSON 陣列**（≤8 筆 `{file, line, summary, failure_scenario}`），沒東西就 `[]`；同樣明寫不叫 ReportFindings | 見 §施工紀錄 |

三個對本 skill 有影響的事實：
- **結果回到主 agent 的方式是 task-notification 的 `<result>`**，內容就是 fork 的最後一段文字。主 agent 要等通知（`TaskOutput block=true` 在 fork 派出子 agent 等待期間會立刻回 completed，不可靠；等 notification 才對）。
- **fork 繼承主 context**（49k token 的 low run 只跑一個工具就是證據）。low 級是「同一個腦袋再看一次」，medium 以上真正獨立看 diff 的是 8 個 finder subagent。landing 「換一個沒有記憶的人看」對 medium+ 成立、對 low 不成立——所以本 skill 不用 low。
- **effort 決定的是流程不是 prompt 語氣**：low = 1 pass 純文字 ≤4；medium = 8 finder × ≤6 candidate、1-vote verify、≤8 findings；high 依 skill 描述「broader coverage, may include uncertain findings」（未實測，本 skill 只在 T3 用）。

### 2. `--fix` 怎麼不帶

`--fix` 是「review 完把 findings 套進 working tree」，與 receive-review「危險類要問」直接衝突。**不帶就不會動**：實測兩次（都沒帶）working tree 乾淨、agent 自述沒改檔。request-review 的呼叫範本固定為 `Skill("code-review", args="medium")` / `args="high"`，不寫 `--fix`；finding 一律交 receive-review 分類處置。

### 3. `--comment` 與 pr-explain 的 comment 會不會重複

**不適用，根本不會走到。** request-review 跑在 Phase 5，PR 要到 Phase 7 finish-branch 才開；Phase 5 時沒有 PR 可貼。`--comment` 是給「對既有 PR 做 review」的用法。pr-explain（Phase 8，T3）貼的是整份 pr-review.md 的單一 comment，兩者內容也不同。結論：request-review 不帶 `--comment`。

## 風險與 trade-off

- **内建 skill 的 prompt 不歸我們管**：Claude Code 升版可能改輸出格式（JSON → 別的）。緩解：request-review 寫「拿到什麼格式都轉成 §結果整合 的 Critical / Major / Minor / Nit 表」，不 parse JSON 欄位名。
- **medium 的 8 finder + N verifier 不便宜**：一次 review 十幾個 subagent。這是官方 lane 的成本，比原本 1 個 general-purpose reviewer 貴，但覆蓋面是它的十倍；純文件跳過抵一部分。
- **spec coverage 自檢在 T2 是主 agent 自己看**：有「我知道為什麼這樣寫」偏誤。接受：T2 量體小、施工清單 ≤8 列逐列對照可機械做。
- **fork 繼承 context**：medium 的 finder 是獨立 subagent，但 fork 本身看得到主 context。對 review 品質影響小（finder 才是找東西的人）。

## 待釐清

- 無。

## 施工清單

| # | group | 檔（可多個） | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `skills/devwork/rules.md` | §Tier 表 T2 review 欄改「程式碼：/code-review medium + 主 agent spec 自檢；純文件跳」、T3 改「/code-review high + 1 spec / 架構 subagent；純文件跳」；§Tier 機制 下方補一句「程式碼 / 純文件的判定見 request-review §副檔名分流」 | `grep -n "code-review" skills/devwork/rules.md` 命中 T2 / T3 兩列；P9a 綠 |
| 2 | 2 | `skills/request-review/SKILL.md` | 重寫：§使用契約 加第 2 步「副檔名分流」（程式碼副檔名表 / 純文件 → 跳）、§T2 改為 Skill 呼叫範本 + spec coverage 自檢清單、§T3 改為 Skill high + 保留視角 A prompt（改名「spec / 架構對齊 reviewer」）、刪視角 B、§結果整合 加「code-review 輸出（純文字 / JSON）→ 四級表」轉換規則、hand-off state 加 `code_review_level` / `code_review_skipped_reason`、frontmatter description 同步 | P9c 綠；`grep -c "視角 B"` = 0；`grep -n 'Skill(' skills/request-review/SKILL.md` 有 medium / high 兩處 |
| 3 | 3 | `skills/dev-workflow/SKILL.md` | Phase 5 三行改新 lane、§跨流程 skill 載入 表 lang-reviewer 列同步、§Trace 範例不動 | P9c 綠；`grep -n "code-review" skills/dev-workflow/SKILL.md` 命中 Phase 5 |
| 4 | 4 | `docs/js/data.js` | ReviewQ label 改「依 Tier × 副檔名分流」、RevT2 / RevT3 label 改新敘述（純文件路徑寫進 label） | `node docs/tools/docs-site-contract.mjs` C8a 仍 96/135 |
| 5 | 5 | `scripts/plugin-contract.mjs` | P9c 加驗：request-review 含 `code-review`、含「純文件」、不含「視角 B」；dev-workflow Phase 5 含 `code-review` | 先在改 skill 前跑一次確認 P9c 紅，改完綠 |
| 6 | 6 | `docs/js/references-data.js` | `pwsh -File scripts/build-references.ps1` 重產 | `pwsh -File scripts/build-references.ps1 -Check` exit 0；docs-site-contract 全綠 |
| 7 | 7 | （本 branch 自身 diff） | verify-done 綠後照新流程跑一次：本 diff 含 `.mjs` 契約檔與 `.js` 流程圖資料 → 依 §副檔名分流 是程式碼 diff、T2 → `Skill("code-review", args="medium")` + 主 agent spec 自檢，輸出貼 §施工紀錄 | §施工紀錄 有 medium 輸出樣本與 token / 時間 |

## 施工紀錄

（execute-plan 追加）

### 執行偏差

- 施工清單 #5 只寫 P9c，實際 P9a 也得改：它原本斷言 T2 列含「1 subagent」、T3 列含「雙視角」，新 lane 一改就紅。P9a 改驗 `code-review medium` / `code-review high`。
- receive-review 後 P9a 再加一條全 repo「雙視角」反向掃描（skills / agents / README / data.js / index.html；archive 不掃，那是歷史）。理由見下方 finding 4。
- 施工清單 #7 原文把本 diff 寫成「純文件、依規則應跳」，與 §副檔名分流（`.mjs .js` = 程式碼）自打嘴巴，code-review 自己抓到（finding 5），已改。

### Spec coverage 自檢（T2）

| 施工清單 # | 做了 | 有測 | 偏差 |
|---|---|---|---|
| 1 rules.md | yes | P9a | 多加一條「code review 先看副檔名再看 Tier」bullet（清單寫「補一句」，範圍內） |
| 2 request-review | yes | P9c | — |
| 3 dev-workflow | yes | P9c | — |
| 4 data.js | yes | C8a 96/135 不變 | — |
| 5 plugin-contract | yes | 改 skill 前 P9c 紅、改後綠（實跑確認） | P9a 一併改（見上） |
| 6 references-data | yes | -Check exit 0 | — |
| 7 實跑 | yes | 本節 | — |

清單外改動：無（receive-review 的 8 項 fix 屬 Phase 5 產出，另列下方）
註解：契約新增段落有註解說明為什麼要全 repo 掃
PII / File-type：無命中

### 新流程實跑（本 branch，verify 綠後）

`git diff main...HEAD --name-only` 含 `scripts/plugin-contract.mjs`、`docs/js/data.js` → `code_review_applicable=true`；Tier=T2 → `Skill("code-review", args="medium")`（不帶 target、不帶 `--fix`）。

| 項目 | 值 |
|---|---|
| 執行方式 | forked 背景 agent，Skill 工具立即回；結果在 task-notification `<result>` |
| 時間 | 464 秒（約 7.7 分鐘） |
| fork 本身 token | 130,760（finder / verifier 另計，未曝露） |
| fork 工具呼叫 | 22 次 |
| 輸出 | JSON 陣列 8 筆（上限 8），全部帶 `file / line / summary / failure_scenario` |
| working tree | 未動（`git status` 乾淨） |

8 筆 finding 摘要與處置（全屬不危險類，一顆 commit）：

| # | 檔:行 | 一句話 | 分級 | 處置 |
|---|---|---|---|---|
| 1 | rules.md:126 | T3 純文件路徑三處寫法不同（表格「跳」/ dev-workflow「只做自檢」/ request-review「派對齊 subagent」），rules 說表格為準 → T3 純文件零 review | Critical | 表格改「跳 code-review、對齊 subagent 照派」，dev-workflow / data.js 同步 |
| 2 | request-review:180 | 自檢結果沒規則進 `critical_count` / `major_count`，receive-review 只讀這兩個欄位 → 清單外改動被短路 | Critical | §結果整合 加一列分級規則，明寫計入計數 |
| 3 | request-review:39 | `.yml` 歸純文件，但 §File-type 硬規則 CI / Infra 寫「套 review」→ 升 T2 就為了 review，結果跳過 | Major | 分流表加「硬規則 CI / Infra / migration 類 → true 不看副檔名」 |
| 4 | rules.md:147 | §協作模式判定 與 dispatch-parallel:84 殘留「request-review 雙視角」，P9a 只掃 Tier 表那列 | Major | 兩處改字；P9a 加全 repo 反向掃描 |
| 5 | request-review:192 | 範例與 spec #7 把 `.js` / `.mjs` diff 當純文件，與表格自打嘴巴；根因是沒有「產出器重產的檔」豁免 | Major | 範例改 `.md .json`、spec #7 改、分流表加 references-data.js 豁免與 path target 用法 |
| 6 | request-review:127 | 對齊 subagent prompt 寫死「bug 另有 code-review 在看、不管邊界值」，純文件路徑沿用同 prompt → 唯一 reviewer 被叫去跳過沒人看的東西 | Major | 兩句改成 `{code-review 有跑時附 / 跳過時改附}` 條件段 |
| 7 | request-review:81 | 舊 T2 reviewer 的「每個改動都有測？」沒人接手 | Major | 自檢加「有測」欄、對齊 prompt 加第二題 |
| 8 | index.html:95 / README:77 | 公開文案說「平常 review 已把語言提示寫進 prompt」，T2 已無自寫 prompt | Minor | 兩處改字（index.html 純文字節點，design-language 豁免） |

**對照舊 lane**：PR #64 的 T2 自寫 prompt 單 reviewer 做不到 finding 1 / 4 這種「三個檔互相矛盾、契約假綠」的跨檔追蹤——那是 cross-file tracer + conventions(CLAUDE.md) 兩個 finder 的產出。代價是 7.7 分鐘與 fork 13 萬 token；舊 lane 一個 general-purpose reviewer 約 2-3 分鐘。

**Phase 0 實測補充**：`low 65` 49k token / 48 秒（含回問一次）、`medium 62` 108k token / 420 秒、3 筆 finding。
