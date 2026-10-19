# 借鏡 pstack：前提連敗停手、安全依據分級、教訓先做成機制
> Track: Dev | Tier: T2 | 建立: 2026-10-19

## 動機 / Why
讀過 backnotprop/pstack（cursor/plugins/pstack 的鏡像）後，挑出三個 bstack 缺、又不跟規則書衝突的做法：

1. **attack-the-premise**：bstack 的 §Fail handling 只擋「靜默重試」，沒擋「換個寫法再試同一個錯方向」。兩次修法共用同一個前提都失敗時，第三次修法大概率也錯。
2. **blast-radius 的證據階梯**：bstack 要求「區分實測與推論」，但「這樣改是安全的」沒有可檢查的強度標準，PR 裡容易只寫一句宣稱。
3. **correct 的「架構 > 型別 / lint > 測試 > 文字」**：retro 的 memory hook 現在只產 memory proposal，能做成 hook / 契約檢查的教訓也被寫成文字，只能靠模型自律（例：memory「收尾鏈用 && 且改 SKILL.md 後必跑 -Check」）。

不搬的：poteto-mode 整套（「不問人直接做」「不做規劃」「刪註解」與 rules.md 衝突）、unslop / technical-writing（英文寫作規則）、show-me-your-work（headless `auto_decisions` 已涵蓋）、reflect（與 retro 重疊）。

## 目標 / Success criteria
- 同一前提連敗兩次後，流程文字明確要求先寫下並驗證前提，才可再修
- verify-done 在 T2+ 產出「安全依據」並標證據等級；T3 至少一條到「實跑」，到不了就在 PR body 標 unproven
- retro 每個 proposal 先判「能否做成機制」，能的話推薦開 issue 而不是寫 memory
- finish-branch 在每個任務收尾時自動收教訓：有 fail 或 user 糾正才問，候選先判能否做成機制；user 不必記得跑 retro
- `node scripts/plugin-contract.mjs` 全綠；`pwsh scripts/build-references.ps1 -Check` exit 0

## 範圍 / Scope
**包含**：rules.md §Fail handling、dev-workflow §Fail handling 與 hand-off state、debug-systematic、verify-done、finish-branch PR 模板、retro §Memory hook。
**排除**：新增 skill；跨模型審查（選項 4，user 未選）；把 pstack 原則整批翻譯進來；改 hook / 契約腳本本身。

## 影響檔案 / Codebase impact
| 檔 / 模組 | 改動類型 | 風險 |
|---|---|---|
| `skills/devwork/rules.md` | edit | 常駐 context，加字要短 |
| `skills/dev-workflow/SKILL.md` | edit | fail 選單文字與 state 欄位 |
| `skills/debug-systematic/SKILL.md` | edit | 低 |
| `skills/verify-done/SKILL.md` | edit | 契約 P10b 守 §UI 段與 yaml 的 e2e 行，不可動到 |
| `skills/finish-branch/SKILL.md` | edit | PR 模板一行 |
| `skills/retro/SKILL.md` | edit | 低 |
| `docs/js/references-data.js` 等 | 重產 | 由 build-references.ps1 產生 |

## 設計方向
不涉及前端檔（0b′ 副檔名比對未命中）。

## 風險與 trade-off
- 「同一前提」靠模型自判，沒有機械檢查；用 `fail_history` 記 `premise` 欄讓 user 事後看得到
- 安全依據等級是自評，可能灌水；T3 要求附實跑的指令與輸出，降低空口宣稱

## 待釐清
無。

## 施工清單
| # | group | 檔（可多個） | 做什麼 | 怎麼驗 |
|---|---|---|---|---|
| 1 | 1 | `skills/devwork/rules.md`、`skills/dev-workflow/SKILL.md`、`skills/debug-systematic/SKILL.md` | 加「同前提連敗兩次 → 先寫下並驗前提」；fail_history 加 premise | grep「前提」三檔皆命中；契約全綠 |
| 2 | 2 | `skills/verify-done/SKILL.md`、`skills/finish-branch/SKILL.md` | 加 §安全依據（L1-L5）、state 欄位、PR 模板一行 | grep `safety_facts` 兩檔命中；契約 P10b 仍綠 |
| 3 | 3 | `skills/retro/SKILL.md` | memory hook 前先判能否做成機制，能則推薦開 issue | grep「機制」命中 §Memory hook 段 |
| 5 | 5 | `skills/finish-branch/SKILL.md`、`skills/headless-mode/SKILL.md`、`skills/dev-workflow/SKILL.md` | 加 §教訓收集（施工中追加：user 指出自己不跑 retro，教訓得在必經的收尾點收） | grep `finish-branch/lesson` 兩檔命中；契約 P19 綠 |
| 4 | 4 | 產出檔 | 跑 build-references 重產、跑契約 | `build-references.ps1 -Check` exit 0 且契約全綠 |

## 施工紀錄
- 四項對齊檢查：N/A（無前端檔改動）
- 1-4 列依序完成，每列一個 commit
- 偏差：PR 開出後 user 指出不跑 retro，第 3 列對他無效；追加第 5 列，把教訓收集放進每個任務必經的 finish-branch
- verify：`node scripts/plugin-contract.mjs` ALL PASS；`build-references.ps1 -Check` exit 0
- review：純文件 diff，跳內建 code-review；spec 自檢四條 Success criteria 皆達成
- 安全依據：契約腳本守的既有字面（P10b verify-done yaml e2e 行、P19 headless 分流）未被改動，契約實跑全綠（L4）
