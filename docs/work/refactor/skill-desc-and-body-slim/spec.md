# 文本瘦身第二輪：description、未瘦身 skill body、agents、rules.md

> Track: Dev | Tier: T3 | 建立: 2026-09-07
> 基線 sha: `4de4e83`

## 動機 / Why

#67 只瘦了九階段 skill 的散文（行 −38%、bytes −13%），沒碰 frontmatter description、其餘 17 個 skill、6 個 agents、rules.md。量測（基線，token 為估算：CJK 1.2 / 字、ASCII 3.8 字 / token）：

| 類別 | 量 | 載入時機 |
|---|---|---|
| 28 個 skill description | ~5,000 tok | **每 session 常駐**，所有啟用 plugin 的專案 |
| rules.md | ~6,100 tok（197 行 / 18,206 bytes） | `/devwork` 下常駐；本 repo 永遠常駐 |
| dev-workflow + brainstorm | ~10,000 tok | 每次 `/devwork` |
| 其餘 skill body | ~55,000 tok | 各 phase 用到才載 |
| 6 個 agents | ~11,600 tok | spawn 時載 |

冗在哪（實測）：description 每條 100–270 tok 都帶「涵蓋：…」「上游 / 下游」，body 與 dev-workflow 已寫同樣內容；21 個 skill 各有一段 `§結尾 Trace 標籤`（rules.md §Trace 標籤 已規定格式）；28 個 hand-off yaml 區塊共 344 行，多數重列上游欄；24 個 Red Flags 表（dispatch-parallel 13 列、frontend-test 12 列、dev-workflow / design-direction 10 列）；歷史敘事（「2026-09-03 實測…」）散在各檔。

## 目標 / Success criteria

1. **A description**：34 條（28 skill + 6 agent）合計 ≤2,000 tok（基線 ~5,000）。每條格式固定：第一行「是什麼」一句（docs 站文件抽屜只顯示第一行，`app.js` 的 `parseFrontmatterDesc`）＋「載入：<時點>」一句；devwork / dev-workflow / brainstorm 保留「不因自然語言自動觸發」；契約守的字樣保留（devwork `/devwork`、pr-explain `T3`、lang-reviewer `顯式`、security-auditor `純文件`、design-language `命中…才載`）；全部不含「觸發：」（P3c）。
2. **B body**：17 個 skill（dev-workflow / design-direction / design-language / dispatch-parallel / incident-investigate / frontend-test / write-skill / security-checklist / cmd-guard / safety-guard / lock-files / context-snapshot / context-resume / db-access / retro / debug-systematic / devwork）+ 6 agents 合計行數 −30%、bytes −20%（bytes 門檻防刪空行灌水）。
3. **C rules.md**：197 行 / 18,206 bytes → ≤150 行 / ≤14,000 bytes；16 個 § 標題一個不少、不改名（15 個被外部引用）。
4. **零改變**（機械可驗三層）：`node scripts/plugin-contract.mjs` ALL PASS + `--selftest`；`node docs/tools/docs-site-contract.mjs` ALL PASS；`build-references.ps1` 重產後 `-Check` exit 0；守門快照（`slim-guard-v2.mjs`）對基線比對零差異：使用契約步驟數與順序、被外部引用的 § 標題（白名單見下）、所有 AskUserQuestion 選單 code block、反引號片段不新增、yaml 欄名不減。
5. 第四層：review-plan Eng 視角逐檔對 diff 抽驗「步驟 / 選單 / 欄位 / 數字」沒被動到。

## 範圍 / Scope

**包含**：A、B、C 三塊（user 2026-09-07 選定）。
**排除**：design-direction 的 4 份 references（33k tok，內容目錄非冗文、只在大改路徑載；user 同意不動）；#67 已瘦的 9 個 skill body 不再動（description 除外）；README / docs 站文案；契約腳本（只在 FAIL 點名時把字改回去，不改契約本身）。

## 零改變界線（user 確認）

**一字不動**：使用契約編號步驤數與順序、每步動作動詞；AskUserQuestion 選單全部選項文字；yaml 欄位名；契約斷言字樣；指令 / 路徑 / 檔名 / regex / 反引號片段 / 數字；被外部引用的 § 標題名。
**可砍**：措辭、重複說明、同類範例只留一個、歷史敘事（日期 + 實測經過 → 留「機制一句 + 後果一句」或整段刪）、別檔已有的表改一行指向、`§結尾 Trace 標籤` 整段改一行「結尾貼 rules.md §Trace 標籤」、hand-off yaml 只留本 skill 新增 / 改寫的欄（上游欄以「承上」一行代替；欄名一個不少）、Red Flags 表 ≤5 列（同義列合併）。

## 影響檔案 / Codebase impact

| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| 28 個 `skills/*/SKILL.md` frontmatter description | edit | P3b / P3c / P9d / P9f / P11 / P12 守字樣；docs 站抽屜讀第一行 |
| 6 個 `agents/*.md` frontmatter description | edit | 同上；`tools:` 等其他欄不動 |
| 17 個 skill body（見目標 2） | edit | P9c / P9h / P9i / P10b / P11 / P12 讀其中 dev-workflow / design-language / dispatch-parallel / write-skill / frontend-test / context-snapshot |
| 6 個 agent body | edit | agent 之間互引 §輸入契約 / §嚴格 output 格式 / §使用 tool 範圍 / §回報格式 / §檢查焦點 |
| `skills/devwork/rules.md` | edit | 位階最高；P6 / P9a / P11 / P12 / C8e / C 交叉引用；16 個 § 全被引用 |
| `docs/js/references-data.js` | 重產 | 產出檔 |
| `docs/work/…/slim-guard-v2.mjs` | new（一次性） | 守門腳本，隨 spec 歸檔 |

## 被外部引用的 § 標題白名單（守門必留、不改名；xref 自動抓，基線 4de4e83）

- design-direction：`§對外契約` `§與 dev-workflow 銜接`
- design-language：`§前端副檔名` `§對外契約` `§兩根尺` `§首次偵測` `§設計語言抽取` `§對齊檢查清單` `§與 dev-workflow 銜接`
- dev-workflow：`§Track × Tier × Phase 路徑` `§Trace 標籤` `§Auto-fix 原則` `§Fail handling` `§Memory hook 點` `§跨流程 skill 載入` `§Skill hand-off state`
- dispatch-parallel：`§協作模式判定` `§隊友派工` `§Spawn 細節`
- frontend-test：`§載入時機` `§測試矩陣` `§branch-name fallback 鏈`
- write-skill：`§新 skill 落地 checklist`
- rules.md：全部 16 個（`§白話優先` `§事實核實` `§Task 追蹤` `§決策點選單` `§Branch safety` `§File-type 硬規則` `§PII 安全底線` `§DB 操作` `§設計語言對齊` `§Docs 落檔` `§Tier 機制` `§協作模式判定` `§Trace 標籤` `§Auto-fix` `§Fail handling` `§Settings.json`）
- agents：db-reviewer `§檢查焦點` `§回報格式`；frontend-e2e-runner / hypothesis-tester `§輸入契約` `§嚴格 output 格式` `§使用 tool 範圍`；lang-reviewer `§回報格式`；pr-explainer `§Tier 控詳盡度` `§文件結構標準` `§使用 tool 範圍`；security-auditor `§PII 安全底線` `§回報格式` `§使用 tool 範圍`
- 其餘 skill 的 § 只被自己引用，可合併 / 刪，**不得新增本來沒有的 §**。

## 設計方向

`design.involved=false`（改動檔全是 `.md`；`references-data.js` 是產出）。

## T3 review 視角

- **Eng**（下限）：機械可驗——守門腳本抓不到的字面改動（步驟動詞、yaml 欄名、數字）逐檔對 diff 抽驗。
- **DX**：有人要讀——砍完的 description 一眼看得出「是什麼、何時載」嗎；rules.md 壓縮後規則還讀得懂嗎；「見 X §Y」的指向是否都解析得到。
- 不派 Design：沒有跨模組契約變動（欄名 / 選單 / § 名都鎖死）。

## 風險與 trade-off

- **description 太短讓 Claude 選錯 skill**：bstack 的 skill 全由 devwork / dev-workflow 以名字鏈式載入，description 不是觸發依據；唯一靠 description 的是 user 顯式 `/bstack:<name>` 時的辨識，第一行「是什麼」足夠。
- **rules.md 改壞是全 repo 事故**：C 由主 agent 親手改、不派 subagent；改前後跑三契約 + 守門；review-plan Eng 對 rules.md 全 diff 逐行。
- **子 agent 越界**：沿用 #67 守則——subagent 只處理契約點名自己檔的 FAIL、不改契約、不 commit；主 agent 逐檔守門後 commit。#67 實測 11 個 subagent 零越界。
- **目標達不到**：行 / bytes 目標是總量軟目標，單檔差 ≤10% 接受；到不了就攤數字，不砍保護項（#67 bytes −13% 未達 −30% 就是這樣處理）。

## 待釐清

無。

## 施工紀錄

<!-- execute-plan 施工中追加 -->
