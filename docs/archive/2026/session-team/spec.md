# spec：session-team（多 session 分工）

- Track：Dev　Tier：T2　branch：`feat/session-team-skill`
- 需求來源：pmis-3f（PMIS 主 session）轉述 user 需求與 2026-10-06 兩個 worker 的實測心得；Phase 0 四題由 user 在 pmis-3f 選（T2、名稱 session-team、brainstorm 0d 主動提議、授權分兩級＋worker 開在 Windows Terminal 分頁）

## 要解決什麼

devwork 能把一件事拆成多個獨立 PR，交給多個完整的 Claude Code session 平行做。worker 不自己開選單，問題傳回主 session 由 user 回答；不可反悔的事由 user 切到 worker 的分頁親自確認。

## success criteria

1. 主 session 能程式化開出 worker，worker 開在同一個 Windows Terminal 視窗的分頁裡，`ListAgents` 看得到、雙向訊息都通（實測）
2. skill 規定派工訊息、回報格式、答覆格式、授權分級、資源排隊、收尾
3. brainstorm 0d 能判出「可拆 ≥2 個獨立 PR」並在合併確認提議
4. plugin-contract、docs-site-contract、build-references -Check 全綠（C8d commit 後綠）

## 查證紀錄（實測 / 官方 / 推斷）

| 事實 | 依據 |
|---|---|
| `env -u CLAUDE_CODE_CHILD_SESSION wt.exe -w <視窗> new-tab -d <repo> claude -w <slug> -n <名字> "<prompt>"` 起的 session 註冊進 `ListAgents`、雙向訊息通 | 實測（probe7） |
| 不拿掉 `CLAUDE_CODE_CHILD_SESSION`：只有 `.key` 沒 `.json` 登記檔、不進 `ListAgents`、收不到訊息；畫面顯示 `Transcript saving is off — inherited CLAUDE_CODE_CHILD_SESSION marker` | 實測（probe2 / 4 / 5 / 6，截圖） |
| `wt -w <名>` 第二個分頁進同一視窗 | 實測（視窗數 1 → 1） |
| 互動模式 `-w` 自動建 `.claude/worktrees/<slug>`、從 origin 預設 branch 切、執行中 `locked` | 實測 + 官方 cli-reference |
| `claude --bg` 也可行，但背景、要 `claude attach` | 實測（probe）；user 否決 |
| `from-mode` 是權限類別（prompting / bypass）；同類直接送達 | 官方 cross-session-messaging；屬性名官方查無（推斷） |
| `notify_when_idle` 一次性、分不出做完或等人、12 小時過期 | 官方 + 實測 |
| Agent Teams split-pane 不支援 VS Code 終端與 Windows Terminal；隊友不能各開 worktree | 官方 agent-teams |
| VS Code 內建終端機程式化開分頁 | 查無官方做法 |
| 每個 worker 各帶一套 MCP server | 實測（程序樹） |

## 施工清單

| # | 做什麼 | 檔 | 怎麼驗 | group |
|---|---|---|---|---|
| 1 | 新增 session-team skill | `skills/session-team/SKILL.md` | plugin-contract P3a / P14 / P19 綠 | 1 |
| 2 | brainstorm 0d 加拆 PR 提議、合併確認表加一列 | `skills/brainstorm/SKILL.md` | grep「拆 PR 提議」；合併確認仍是一次呼叫、最多 4 題 | 2 |
| 3 | dev-workflow 跨流程表加一列 | `skills/dev-workflow/SKILL.md` | grep `` `session-team` `` 列 | 3 |
| 4 | README / index.html 計數 29→30、功能 36→37、索引卡加一列；data.js crosscut 加一列 | `README.md`、`docs/index.html`、`docs/js/data.js` | P8 綠、docs-site-contract 綠（C8d commit 後） | 4 |
| 5 | 重產 references | `docs/js/references-data.js` | `build-references.ps1 -Check` 綠 | 5 |

## 設計語言對齊

`docs/index.html` 只改文字節點（數字）與 `const SKILLS` 陣列一列資料，不碰 class / style / 標籤：四項對齊檢查 N/A（無新元件狀態、斷點、表單、dark mode 變動）。

## 排除 / follow-up

- PowerShell 起 worker 的寫法未實測（skill 只寫 Git Bash 版）
- 中文 / 多行 prompt 經 `wt` 命令列未驗證，所以派工全文改走傳訊
- worker `/exit` 時的 worktree 保留詢問未實測
- write-skill §新 skill 落地 checklist 的 `docs/js/app.js` 與 index.html 行號已過期（headless PR 的 finder 已指出），本 PR 不修
- plugin 版本升級另開 chore PR（照 #86 / #90 慣例）
