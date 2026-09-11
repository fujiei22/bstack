# Code review 處置（request-review → receive-review）
> 來源：內建 `/code-review high`（8 finder，主 fork 未完成彙整、finder 直接回報）+ T3 對齊 subagent（`out/review-align.md`）+ finder 原文（`out/finder-*.md`）
> 分類依 rules.md §Auto-fix：全部屬不危險類（文件 / 腳本、無 DB / 認證 / payment），主 agent 自動修 + commit；T3 diff 由 PR 承載。

## 已修（依落點）

**`scripts/headless-reply.mjs`（重寫）**
- 取「最新一則**合格編號**留言」而非最新一則（align C1、finder-A 5）：人答完編號再閒聊不會蓋掉答案。
- `reasked` / `reminded` 只看 `askedAt` 之後、帶本 `decisionId` 的標記（simplify 1、finder-A 1、align M2）。
- `askedAt` 非 gh `createdAt` 原值（含 null / 本地時間）、`optionCount` 非整數 → throw，CLI exit 2（finder-A 2、finder-C 3、align M3）。
- 自己的留言改用內容判（`<!-- bstack-` 標記 / 「已讀到選項」前綴），不看 `viewerDidAuthor` / `selfLogin`：同帳號跑時人的回覆不會被吃掉；`gh api user` 呼叫與 `selfLogin` 欄位刪除（finder-A 3、simplify 2、eff 4）。
- 裸 `0`、出界編號 → `unparseable`；`freeText` 統一 `rest || null`；`allowFree` 刪除，自由文字一律走選項 0（finder-A 4、simplify 3、align m1 / m2、conv 2）。
- 接 snake_case 同義鍵（`asked_at` / `option_count` / `decision_id`），skill 的 snapshot 欄名直接餵（finder-C 1）。
- CLI 自偵測改 `realpathSync.native` + lowercase（同 guard.mjs）、stdin 改 `readFileSync(0)`（reuse 1、2）；regex 加全形括號與 `，`（align n7）。

**`scripts/plugin-contract.mjs` P19（重寫）**
- 契約編號 P18 → P19、用既有 `section()`（Eng C1 / C2）；檔頭索引補 P18 / P19。
- fixture 改直接 `import` 跑（17 例 + 3 throw）+ 1 次 CLI 冒煙（cwd REPO）；2 秒 → 毫秒級（eff 1、reuse 3）。
- 分流清單改從磁碟推導：含 `AskUserQuestion` 的 skill 都要有分流，白名單 retro / lock-files（alt 1、align M4）。
- skill 引用的 `decision_id` 必須是 §分流表 的列（simplify 6）。
- 8 個派工 skill 必含約束句字面（alt 2）；`.gitignore` 守 `docs/snapshots/`。
- heading regex 完整跳脫；`rdOr` helper；重用 `skillDirs`（reuse 4、eff 2 / 3）。

**`skills/headless-mode/SKILL.md`（重寫）**
- 重讀改「重新載入 skill」不用 repo 相對路徑（alt 3）。
- §偵測 第 3 條合併 `gh issue view --json title,body,comments` 一次拉（含 auth 檢查、需求文字、留言快取）；數字 issue 用 gh 補 repo 後仍以這次呼叫驗證（alt 4、eff 5）。
- snapshot 固定檔名 `issue-<n>.md`（simplify 5、finder-C 4、align m6）。
- 分流表加 `design-language/confirm-map`（A / 終止條件 B）、`design-direction/pick`（B）、`verify-done/fail` 獨立列；`frontend-test/preview-url` 改 B 類（align M4 / M5）；`security-audit/critical` 一次一題 + `pending_criticals[]`（finder-B 2）；`receive-review/safe-fix` 不落 diff 檔、PR body 列 sha（finder-B 6、Design m5）。
- 模板：選項 0 移到最後、承諾句對齊實際留言數（conv 3、align n4）。
- 留言前 duplicate 檢查改以 `asked_comment_ids[]` 為基準（finder-A 6、finder-B 4）；留言後從重拉的留言取 `<!-- bstack-ask: <id>` 那則的 `createdAt`（`gh issue comment` 無 `--json`，finder-C 2）；`asked_at` 空 → 先找回（align M3）。
- `done` 之後 MERGED → 不自己歸檔，留言請人搬（alt 5、finder-B 1）。
- §子 agent 約束改無條件貼；列出 db-reviewer / Codex reviewer / design-direction 三 subagent（finder-B 5、reuse 5）。
- hand-off state 加 `asked_comment_ids` / `pending_criticals`，`reminded` 改由 parser 推導、`headless` 不存 snapshot（simplify 1、Design m1、align m8）。

**其他 skill / 文件**
- rules.md 例外條款改「任何要 user 決定的句子（含二次確認、T3 先 diff 再 commit）」，重讀改載入 skill（conv 1、align m7）。
- hosts.md / review-plan 派工列改「逐字貼」不改寫（reuse 5）；dispatch-parallel `:159` 改「回報派工 agent」與約束句一致、第 4 步措辭（reuse 6、align n5）。
- 4 個 `<headless 時此處貼…>` 佔位改成字面句；request-review / pr-explain / design-direction / security-audit db-reviewer 補句（alt 2）。
- pr-explain headless 不走 `context: fork`，主 agent 直接 spawn（finder-B 3）。
- design-language `:83` `:140`、design-direction `:29` 接線（align M4、alt 1）。
- devwork 1.5 → 1b（markdown 清單不斷）、`state.headless` 值由偵測決定、`pending_question` 輪次在 1b 短路（waiting 不載後面的 skill 鏈）（align n1 / m8、eff 6、finder-C 4）；dev-workflow 契約 2 加 headless dispatch 到 context-resume（finder-C 4）。
- dev-workflow §Fail handling 依來源用 `execute-plan/fail` / `verify-done/fail`（align m3）。
- context-snapshot 契約 3 帶 headless 檔名、commit 分支註明已 ignore 的 repo 跳過（align m5 / m6）。
- brainstorm Red Flag「user approval 不可省」加 headless 例外（finder-B 6）。
- `docs/index.html:660` 35 份 → 36 份（align m4）；`:514` 35 個功能 → 36（e2e 抓到）。
- spec.md §目標 / §範圍 / §影響檔案 對齊 v2（align M1）。

## 略過（附理由）

- **snapshot 改以 issue 留言為狀態真相、支援全新 clone**（alt 6）：設計深度改動，spec §排除 已明寫不支援；記 follow-up。
- **`waiting` 輪由 harness 一行 gh 預檢、不啟動 agent**（eff 6 後半）：autopilot 側的事（`AUTOPILOT_PREFLIGHT`），不在本 repo。
- **rules.md 位階與 headless 例外的整體結構**（conv 15）：已由跨節條款覆蓋。
- **`docs/index.html` 功能總數改動態**：記 follow-up（P8 不守）。

## Follow-up（開 issue）

1. headless 狀態真相從 snapshot 升為 issue 留言（隱藏 `<!-- bstack-state -->`），支援 GitHub Actions 這類全新 clone 的排程。
2. `docs/flow.html:350-383` SVG 樣板在 JS 插值前被瀏覽器解析，34 個 console error（main 上既有）。
3. `docs/index.html:514` 功能總數改由陣列長度算並納入 P8。
