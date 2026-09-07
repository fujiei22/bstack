# security-audit：T3 純文件 diff 跳 audit

> Track: Dev | Tier: T2 | 建立: 2026-09-07

## 動機 / Why

T3 現行「security-audit 必跑」不看 diff 內容。本 repo 近四支 T3 PR（#67 skill 瘦身、#69、#71 三項效率優化的文件部分、#64 lane 精簡）diff 主體是 `.md` / 流程圖 label / prompt 文字，security-auditor 對這種 diff 的產出是 PASS 清單加零到兩筆「文件敘述可能誤導」——那不是安全 finding，是 review-plan DX 視角的事。一次 audit 約 3–5 分鐘、4–6 萬 token。

request-review 在 #66 已經對同一件事做過判定：`§副檔名分流` 產出 `code_review_applicable`，純文件 diff 跳內建 code-review。security-audit 沿用同一個判定結果即可，不另發明第二套副檔名表。

**這是 lane 改變**（rules.md §Tier 表 T3 security 欄從「必跑」變「程式碼 diff 必跑、純文件跳」），與 #71 的「流程邏輯零改變」三項刻意分開成獨立 PR。user 2026-09-07 已點頭「4 要做」。

## 目標 / Success criteria

1. T3、`code_review_applicable=false`（request-review 判為純文件 diff）、且 diff 沒命中 rules.md §File-type 硬規則任一類型 → security-audit **不 spawn** security-auditor、不載 security-checklist，state 寫 `security_skipped_reason`，直接交 finish-branch。
2. 上述三條任一不成立 → 行為與現在完全相同（T3 audit + checklist + db-reviewer；T2 涉認證 / 資料層才 audit）。
3. rules.md §Tier 表、security-audit skill、dev-workflow 9 階段圖、流程圖 `SecQ` label、security-auditor agent 描述、finish-branch PR 模板 checklist 六處敘述一致；契約 P12 守住任一處回寫成「T3 必跑」就紅。
4. 契約腳本、docs-site 契約、`build-references -Check` 全綠。

## 範圍 / Scope

**包含**：
- 跳過判定只吃 request-review 已產出的 `code_review_applicable` / `code_review_skipped_reason`，加一條 File-type 硬規則例外。
- 六處文字同步 + 一條契約。

**排除**：
- 不動 T2 的 audit 條件（「涉認證 / 資料層才 audit」不變）。
- 不動 db-reviewer 條件（DB schema / migration 是 File-type 硬規則命中，本來就不會被跳）。
- 不改 request-review 的副檔名表；security-audit 不自己再比對副檔名。
- 不動 security-auditor agent 的檢查內容。

## 為什麼要有 File-type 例外

`.yml` / `.toml` / `Dockerfile` 在 request-review 表裡歸「純文件」（沒有可執行邏輯、code-review finder 找不到會壞的情境），但 `.github/workflows/*.yml`、`docker-compose.yml`、`.npmrc`、`migrations/*.sql` 是安全面最該看的檔——secret 洩漏、CI 權限、supply chain 都在這裡。所以判定是「純文件 **且** 沒命中硬規則表」才跳，硬規則表直接引 rules.md §File-type 硬規則，不重列。

判定順序：
```
T3？ → 否 → 走 T2 條件（不變）
  ↓ 是
code_review_applicable === false？ → 否 → audit（不變）
  ↓ 是
diff 檔名命中 rules.md §File-type 硬規則任一列？ → 是 → audit（不變）
  ↓ 否
跳：security_skipped_reason = "純文件 diff：<副檔名列表>；無 File-type 硬規則命中" → finish-branch
```

## 影響檔案 / Codebase impact

| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `skills/devwork/rules.md` §Tier 表 T3 security 欄 | edit | lane 唯一真相；措辭要跟 review 欄的「純文件 diff 跳 code-review」同型 |
| `skills/security-audit/SKILL.md` description + 使用契約第 2 步 + hand-off state + Red Flags | edit | 判定邏輯落點 |
| `skills/dev-workflow/SKILL.md` 9 階段圖第 6 行 | edit | 只改一行 |
| `docs/js/data.js` `SecQ` label | edit | 流程圖節點；`.js` 非前端副檔名表項，design-language 不涉 |
| `agents/security-auditor.md` description「T3 必跑」 | edit | agent 描述是 Claude 選 agent 的依據 |
| `skills/finish-branch/SKILL.md` PR 模板 checklist 那行 | edit | 一行 |
| `scripts/plugin-contract.mjs` 新增 P12 | edit | 守六處一致 |
| `docs/js/references-data.js` | 重產 | 產出檔 |

## 設計方向

`design.involved=false`（改動檔副檔名 `.md` / `.js` / `.mjs`，無 `.css .scss .tsx .jsx .vue .svelte .html`）。小改，未走三方向。

## 風險與 trade-off

- **漏看真正的安全問題**：純文件 diff 也可能把密鑰寫進 README。緩解：`hooks/guard.mjs` file-type 段在寫入當下就擋密鑰檔；rules.md §PII 安全底線與 `safety-guard` 在 commit 前掃 PII / token 殘留，這兩層不受本改動影響。
- **判定依賴 request-review 的產出**：user 顯式呼叫 `/bstack:security-audit` 時 state 可能沒有 `code_review_applicable`。處置：沒這欄就當 `true`（照跑），不自己補判。
- **本表是 lane 唯一真相**：改 rules.md 表格一格就改了所有 T3 的行為，所以要 P12 契約守六處同步。

## 待釐清

無。

## 施工清單

| # | group | 檔（可多個） | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `scripts/plugin-contract.mjs` | 先寫 P12（紅）：rules.md T3 security 欄含「純文件 diff」且無裸「必跑」；security-audit 第 2 步讀 `code_review_applicable`、提 File-type 硬規則、state 有 `security_skipped_reason`；dev-workflow 第 6 行、data.js SecQ label、security-auditor 描述、finish-branch checklist 各含「純文件」；全 repo（排除 archive）無「T3 必跑」「T3 必用」殘留 | `node scripts/plugin-contract.mjs` → P12 FAIL、其餘 PASS |
| 2 | 2 | `skills/devwork/rules.md`、`skills/security-audit/SKILL.md` | T3 security 欄改「audit + checklist + db-reviewer；純文件 diff 且無 File-type 硬規則命中跳 audit」；security-audit description、第 2 步加判定順序、state 加 `security_skipped_reason`、Red Flags 加兩列（「純文件就跳」要先查硬規則；「沒 code_review_applicable 就自己判」不行） | `node scripts/plugin-contract.mjs` → P12 仍 FAIL 但只剩四處文字落點 |
| 3 | 3 | `skills/dev-workflow/SKILL.md`、`docs/js/data.js`、`agents/security-auditor.md`、`skills/finish-branch/SKILL.md` | 四處文字同步 | `node scripts/plugin-contract.mjs` ALL PASS |
| 4 | 4 | `docs/js/references-data.js` | `pwsh -File scripts/build-references.ps1` 重產 | `build-references.ps1 -Check` exit 0；`node docs/tools/docs-site-contract.mjs` ALL PASS |

## 施工紀錄

<!-- execute-plan 施工中追加 -->

### 執行紀錄（2026-09-07）

| 項 | 結果 |
|---|---|
| 施工清單 4 列 | 4 commit，P12 先紅（9 子條件全 FAIL）→ Task 2 後剩 6 → Task 3 後 ALL PASS |
| 施工清單外的改動 | P12 殘留掃描多抓到 `skills/security-checklist/SKILL.md:284`「T3 必用」，spec 影響檔表沒列；併入 Task 3 一起改。教訓：列「要同步的處」時先 grep 一次舊字樣，別憑記憶列 |
| 設計語言四項對齊 | N/A（依據：改動檔副檔名 `.md .js .mjs`，不含 design-language §前端副檔名 七項；`docs/index.html` 未動） |
| 契約 | plugin-contract ALL PASS（含 P12）、docs-site-contract ALL PASS、`build-references -Check` exit 0、`node --check docs/js/data.js` OK |
| request-review | T2：`Skill("code-review", args="medium scripts/plugin-contract.mjs")`（純文件佔大宗、只送程式碼檔）+ 主 agent 對 spec 自檢 |
| 自檢 finding | 1 筆：security-audit 第 2 步範例「純文件 diff：.md .js」自相矛盾（`.js` 是程式碼副檔名），改 `.md .json` |
| security-audit | T2 不涉認證 / 資料層 → 跳（本 PR 自己就是在改這條規則；依現行 T2 條件本來就不跑） |
