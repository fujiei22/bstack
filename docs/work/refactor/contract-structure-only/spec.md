# 契約瘦身：只守結構，語意交給 code-review
> Track: Dev | Tier: T2 | 建立: 2026-11-09

## 動機 / Why
`scripts/plugin-contract.mjs`（962 行、45 個 check id）裡有大量「某句規則文字還在不在」的字串檢查。這類檢查有兩個毛病：
- **假綠**：同一個字出現在別處，規則被改壞也照樣通過。
- **誤報**：改寫措辭就報紅。

PR #105 / #106 的實際問題都是 code-review 與外部審查員抓到的，不是契約抓到的。user 2026-11-09 決定：
- 契約只守「結構」：壞了會機械性出錯、可確定性判斷。
- 語意交給 code-review。

## 方案草圖
- 選定：全面盤點、逐段分類（user 選）。
- 放棄：只處理 P20–P22 並寫規則（舊字串檢查仍在）；只寫規則不刪（假綠與誤報都還在）。

## 目標 / Success criteria
- **盤點結果**（subagent 盤點，2026-11-09）：留 25 段、整段刪 7 段（P9a、P9d–P9i）、拆 13 段（P3b、P9b、P9c、P10b、P11、P12、P18、P13、P16、P19、P20、P21、P22），各段理由見施工紀錄。
- **結構（留）的定義**：
  - manifest 欄位、版本一致、檔案存在、名稱 / 計數一致、hooks matcher；
  - 產生器 `--check`、判定器 fixture、執行腳本驗輸出；
  - 表格固定欄位值（分流表類別欄）、hand-off 欄位名與 enum 值、frontmatter 白名單 / 黑名單；
  - 跨檔 id 或 `§` 標題錨點存在、多處清單逐值相等。
- **不確定項的定案**：
  - **留**：
    - P18 七項面向四處逐字相等（多處清單比值）；
    - P19 phases（從磁碟推導、含 AskUserQuestion 的 skill 都要有分流）、dispatchers（模板固定句）、hosts 列序；
    - P9b `plan_path.*null`（hand-off 允許 null 的值）；
    - P22 gate 列與 route-level 列互指 id。
  - **刪**：P13 `descHostNeutral`（描述措辭）。
- 刪除時搬好被後段共用的變數：`rulesMd / tierT2 / tierT3`、`bsMd / exMd`、`rrMd / dwMd`、`fbMd`、`dataJs`、`section()`。
- **腳本檔頭寫「契約只守結構」規則**，並附判準與「語意由 code-review 看」。`skills/write-skill/SKILL.md` 有提到契約的地方同步一句。
- **驗證**：
  - 刪減後 ALL PASS；
  - 每個保留的結構檢查抽樣「故意改壞一處 → 會 FAIL」（至少 6 處，涵蓋表格欄、enum、清單相等、標題錨點、frontmatter、版本）；
  - `--selftest` 照過；
  - `gen-codex-agents --check`、`build-references -Check` 綠。
- 版本升 1.16.1（只動檢查腳本與文件，不改行為）。

## 範圍 / Scope
**包含**：`scripts/plugin-contract.mjs`、`skills/write-skill/SKILL.md`（若有提契約）、三處版本號、`docs/js/references-data.js`（若 write-skill 有改則重產）。

**排除**：
- 改任何 skill 的規則內容。
- 新增結構檢查（只刪不增，例外是為了搬變數的必要重構）。

## 影響檔案 / Codebase impact
| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `scripts/plugin-contract.mjs` | edit（刪約 200 行） | 誤刪結構檢查 → 以後真的壞了不會紅；共用變數刪掉 → 後段報錯 |
| `skills/write-skill/SKILL.md` | edit | 一句 |
| 版本號 | edit | — |

## 設計方向
不碰前端。`design.involved=false`。

## 風險與 trade-off
- 刪掉的語意檢查改由 code-review 看。純文件 diff 依規則會跳過 code-review，這類 PR 的語意只剩 T3 對齊 subagent，或 T2 主 agent 自檢。這是本方案接受的取捨，PR body 寫明。

## 施工清單
| # | group | 檔（可多個） | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `scripts/plugin-contract.mjs` | 整段刪 P9a、P9d–P9i，搬共用變數；檔頭加「契約只守結構」規則 | ALL PASS；`--selftest` 照過 |
| 2 | 2 | `scripts/plugin-contract.mjs` | 拆 P3b、P9b、P9c、P10b、P11、P12、P13、P16、P18 的措辭子條件 | ALL PASS |
| 3 | 3 | `scripts/plugin-contract.mjs` | 拆 P19、P20、P21、P22 的措辭子條件；更新檔頭索引 | ALL PASS |
| 4 | 4 | （驗證） | 抽 ≥6 個保留檢查，在暫存副本故意改壞一處各跑一次，確認 FAIL；改完還原 | 每個都 FAIL、還原後 ALL PASS；結果寫施工紀錄 |
| 5 | 5 | `skills/write-skill/SKILL.md`、版本號、references | 同步規則一句、升 1.16.1 | ALL PASS、`build-references -Check`、`gen-codex-agents --check` 綠 |

## 施工紀錄
### 2026-11-09
- 列 1–3：`plugin-contract.mjs` 962 → 778 行（−184）。每列一個 commit，ALL PASS、`--selftest` PASS。
  - 偏差：P9c 的拆分在列 1 一起做。
- **新結構檢查抓到真問題**：P12 改守 hand-off 欄位兩端後，發現 request-review §hand-off state 沒列 `code_review_applicable`，但 security-audit 第 2 步要讀它。舊檢查只確認這個字出現在 request-review 某處，所以一直沒發現。已補欄位，屬範圍外的必要修正。
- 列 4 變異測試（`scratchpad/mutate.py`，每次用乾淨副本、各改壞一處）：9 處全部轉紅。
  - P20 ×3：分流表類別、db-access 標題、db-reviewer 加回 tools；
  - P22：enum；
  - P11：副檔名清單；
  - P13：版本，另帶出 P15；
  - P12：hand-off 欄位；
  - P9b：施工清單標題；
  - P21：route-sketch 類別。
- 列 5：write-skill 落地 checklist 補「只守結構」一段；升 1.16.1。
- 第一輪審查：code-review medium 10 項，外部審查員（沿用前幾個 PR 的同一位）。修正如下：
  - **補回誤刪的結構**：偵測環境變數三處一致、`finish-branch/merge` 類別=永不、Tier 表 review / security 欄與 request-review 檔位一致、`/devwork` 與 `$bstack:devwork` 入口名、finish-branch / design-direction 路由、execute-plan 施工紀錄端。
  - **改寫**：Codex 工具名改成 rules.md 與 hosts.md 兩表逐值比對；P10b 的 enum 只看 hand-off state 區塊。
  - **判準**補三類：介面名、hand-off 路由、模板固定句，並加上「改名後有沒有機械步驟斷」的測法。
  - 清死碼與過時註解。
- user 問「有沒有串通審查員」後，改用新方法：每個 PR 換全新審查員，派工只給 branch 名、不附摘要，複審看完整 diff。新審查員 `bstack-68-review-slim` 的結論是需修改後 merge，修正全收：
  - request-review §副檔名分流 純文件列的理由句改成如實：契約只守結構，純文件語意只靠 T2 自檢 / T3 對齊；user 2026-11-09 接受這個缺口。
  - 判準新增「安全不變式」：禁用 DB CLI 三處同組、算寫語句三處都列，逐值比對。
  - P9b 補回 brainstorm spec gate 的路由。
- **偏離「只刪不增」**：新增 P16 codexTools、P19 envNames / hostsOrder / mergeNever、P9c Tier 欄比對、P9d 路由、P20 安全不變式。原因都是審查指出這些是被刪掉、或原本就沒守的結構；舊版是字串存在檢查，新版改成逐值或欄位比對。
