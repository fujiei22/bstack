# session-team：主 session 持續拆工、主動派工
> Track: Dev | Tier: T1 | 建立: 2026-10-15

## 動機 / Why
PMIS 專案用 session-team 帶 worker 時，主 session 照字面只在載入時跑一次拆工判定、worker 數卡在預設上限 2。結果一個 worker 交件後被排去「等另一個 PR merge 才能做」，空等好幾天的排程；user 提醒後才補開第 3 個 worker 做不撞檔的工作。user 原話：「你身為調度員協調 + 檢查者，你要自己知道怎麼拆任務分派增進效率」「bstack 裡的這個 skill 可以修改一下」。

## 目標 / Success criteria
- 主 session 迴圈有明確的重派觸發點與動作（§持續派工）
- 有「user 長期授權」路徑：授權後只看記憶體門檻自行加開、一句話告知；上限 2 改成無授權時的預設
- Red Flags 有「等前一個 PR merge 再派下一件」
- §起 worker 補上 pmis-61 2026-10-15 實測：出現時間、別的 repo 起 worker
- 派工訊息限 worker 只在自己的 worktree 做事
- `node scripts/plugin-contract.mjs` 與 `build-references.ps1 -Check` 綠

## 範圍 / Scope
**包含**：`skills/session-team/SKILL.md`；`docs/js/references-data.js`（腳本重產）
版本升 1.11.0（`.claude-plugin/*.json`、`.codex-plugin/plugin.json`、`codex/agents/*.toml` 由 gen-codex-agents 重產）：依 user 要求一起升，不另開 chore PR
**排除**：README、`docs/install.md`（那行 1.10.0 是歷史描述）、brainstorm / dev-workflow 的 session-team 描述（仍正確）

## 決策（pmis-61 轉 user 選，2026-10-15）
- 記憶體門檻 6 GB，文件註明是保守設定：這台機器曾在 3 個 session + e2e 時把記憶體用光，不是測出來的臨界點
- 長期授權下的軟上限 5 個 worker（不算主 session）；第 6 個起先 `AskUserQuestion` 問 user。user 原話：「主 session 只看記憶體夠不夠就能加開 worker，但我覺得設個軟上限 5個，要超過5個要先問 user」
- 「禁迴圈輪詢 ListAgents」的例外只限起 worker 後確認有沒有出現、最多 3 次

## 施工紀錄
- 派工訊息原寫工具名 `EnterWorktree`，被契約 P14（工具名須在 hosts.md 第一欄）擋下；改寫成「用切換 worktree 的工具」，不動 hosts.md
- 驗證：`build-references.ps1 -Check` PASS、`plugin-contract.mjs` ALL PASS
