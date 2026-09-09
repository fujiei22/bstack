# bstack

bstack 是一套給 coding agent 的開發流程：28 個 skill、6 個 agent、1 支 hook 與一份規則書，裝成 plugin，Claude Code 與 Codex 共用同一份。繁中台灣用語。

## 目錄

- [它怎麼運作](#它怎麼運作)
- [安裝](#安裝)
  - [Claude Code](#claude-code)
  - [Codex CLI](#codex-cli)
- [九階段流程](#九階段流程)
- [Skills（28）](#skills28)
- [Agents（6）](#agents6)
- [Hook](#hook)
- [Claude Code 與 Codex 的差異](#claude-code-與-codex-的差異)
- [原則](#原則)
- [開發本 repo](#開發本-repo)
- [License](#license)

## 它怎麼運作

你打 `/devwork 要做的事`（Codex 上是 `$bstack:devwork 要做的事`）。agent 不會直接開始寫 code，它先問清楚你要什麼、看一遍 codebase，判這件事是修 bug 還是做功能、量體多大（T0–T3），用選單跟你確認。

確認後它切 branch、把 spec 寫成檔給你看。大的改動再拆成一條條 task 落成計畫、派不同視角 review 計畫。你點頭之後才動工，每條 task 走紅綠 TDD、可平行的派 subagent。

做完自己跑 verify，派內建 code review 與獨立 context 的 reviewer 看一遍，敏感的改動再跑一輪安全稽核，然後收 branch、開 PR、把「為什麼這樣改」寫成文件。每一步結尾都貼一行 Trace，你隨時看得出它在哪一個 phase。

不打指令時，它就是普通的 Claude Code / Codex；只有一支 hook 例外，它在啟用 plugin 的專案一律生效：在 main 上寫檔會被擋、碰到 `.env` / migration / lockfile / CI 這類檔會先問你。

## 安裝

兩個 host 裝的是同一份 plugin，指令不同而已。前置：node（hook 要用）、git。細節、坑、移除、舊版遷移全在 [docs/install.md](docs/install.md)。

### Claude Code

- 專案層級（推薦）：把 `templates/project-settings.json` 複製成你專案的 `.claude/settings.json`，開新 session 就會自動裝。
- 或手動：

  ```
  /plugin marketplace add fujiei22/bstack
  /plugin install bstack@bstack
  ```

- 個人偏好（statusLine、唯讀權限白名單、Agent Teams 開關、playwright MCP）可選裝：

  ```pwsh
  pwsh -File scripts/extras.ps1
  ```

- 開新 session，打 `/bstack:devwork 要做的事`。

### Codex CLI

- 一站式（裝 plugin、複製 agent TOML、開 `tools.update_plan`）：

  ```pwsh
  git clone https://github.com/fujiei22/bstack.git
  cd bstack
  pwsh -File scripts/install-codex.ps1
  ```

- 或手動只裝 plugin：

  ```
  codex plugin marketplace add fujiei22/bstack
  codex plugin add bstack@bstack
  ```

- 開新 session，先打 `/hooks` 信任 bstack 的 PreToolUse（Codex 對 plugin hook 預設不信任，不信任就沒有 branch 保護），再打 `$bstack:devwork 要做的事`。
- 有防毒即時掃描的機器 GitHub 來源會一直「存取被拒」，改用本機 clone 當來源，見 [docs/install.md](docs/install.md#有防毒的機器github-來源會失敗)。

## 九階段流程

1. **brainstorm** — 問清楚要做什麼、判 Track / Tier，切 branch、落 spec。T2 順手列施工清單。
2. **write-plan** — T3 才寫：拆成一條條 task、並行性分析。
3. **review-plan** — T3 才跑：依改動面向派 1–3 個視角 review 計畫。
4. **execute-plan + tdd-cycle** — 照計畫做，每條 task 紅 → 綠 → commit；可平行的派 subagent。
5. **verify-done** — test / lint / build / e2e 全跑一遍，不綠不進 review。
6. **request-review → receive-review** — 內建 code review + 獨立 reviewer；小問題自動修、敏感的問你。
7. **security-audit** — 涉認證 / 資料層 / hook 這類改動跑 OWASP / STRIDE / PII 稽核。
8. **finish-branch** — rebase、push、開 PR；merge 由你按。
9. **pr-explain** — T3 PR 自動解釋：獨立 context 重讀 diff，寫成「為什麼這樣改」落檔並貼 PR。

另有手動觸發的 **retro**：回顧一段期間的工作，把 user 偏好寫回 memory。

## Skills（28）

**主流程**
- **devwork** — 唯一入口，讀規則書後交給 dev-workflow
- **dev-workflow** — 九階段 routing 與 hand-off state
- **brainstorm** / **write-plan** / **review-plan** / **execute-plan** / **tdd-cycle** / **verify-done** / **request-review** / **receive-review** / **security-audit** / **security-checklist** / **finish-branch** / **pr-explain** — 上面九階段各自的定義

**跨流程 / 觸發式**
- **debug-systematic** — 修 bug 的固定步驟：重現 → 最小重現 → 修 → 防回歸
- **incident-investigate** — 線上 incident 找根因，多假設平行驗
- **design-language** / **design-direction** — 動前端前先抄該區既有設計語言；新頁或改版先出三個方向讓你選
- **frontend-test** — Playwright e2e
- **db-access** — DB 唯讀、量限、PII 要 mask
- **cmd-guard** / **safety-guard** / **lock-files** — 危險指令二次確認、輸出前掃 PII / 密鑰、標檔禁改
- **context-snapshot** / **context-resume** — 換 session 時存 / 讀進度

**Meta**
- **dispatch-parallel** — 多 task 平行時派 subagent 或 Agent Teams
- **retro** — 回顧並寫 memory
- **write-skill** — 新 skill 的範本與落地 checklist

## Agents（6）

獨立 context 跑，跟主對話隔開：

| Agent | 在幹嘛 |
|---|---|
| **db-reviewer** | DB schema / migration / SQL 改得對不對 |
| **frontend-e2e-runner** | 跑 Playwright e2e，把 browser log 隔在自己 context |
| **hypothesis-tester** | incident 調查時一個 agent 驗一個假設 |
| **lang-reviewer** | 你點名才派的語言專家：按語言抓 idiom 跟 pitfall。T2 的 review 交給內建 code-review，T3 才有自寫的對齊 reviewer |
| **pr-explainer** | PR 開完重讀 diff，寫詳盡解說 |
| **security-auditor** | OWASP / STRIDE / PII 安全稽核 |

## Hook

`hooks/guard.mjs`，PreToolUse、兩段：**branch-safety** 在 `main / master / production / prod / release` 上擋寫檔；**file-type** 對密鑰硬擋，對 migration / lockfile / CI / infra / shell config 先擋、你確認後 AI 建一次性 token 放行。Claude Code 攔 Write / Edit / NotebookEdit，Codex 攔 `apply_patch`。需要 node 在 PATH；Codex 另需 `/hooks` 信任。細節見 [docs/install.md](docs/install.md#hook-的前置node)。

## Claude Code 與 Codex 的差異

流程一樣，工具不同：決策選單（`AskUserQuestion` ↔ `request_user_input`）、任務追蹤（`TaskCreate` ↔ `update_plan`）、派 subagent（`Agent` ↔ `spawn_agent`）、code review（內建 `/code-review` ↔ 一個唯讀 reviewer subagent）。Codex 沒有 Agent Teams，唯讀 agent 的 sandbox 在非互動模式下靠自律。完整對照與退路在 `skills/devwork/hosts.md`，限制清單在 [docs/install.md](docs/install.md#已知限制)。

## 原則

- **先問再做** — 需求、Track、Tier 都用選單確認，不靠猜
- **紅綠 TDD** — 先寫測試看到紅，再寫最小實作
- **事實核實** — 資料模型的結論要同時看實際資料與 codebase 使用點
- **獨立 context 審** — reviewer、稽核、e2e 不跟寫 code 的同一個 context
- **證據優先** — 說「實測」就要有指令與輸出；推論就標推論

規則書本體在 `skills/devwork/rules.md`。

## 開發本 repo

```bash
claude --plugin-dir .                            # /devwork 與 hook 在本 repo 生效
node scripts/plugin-contract.mjs                 # plugin 結構契約（Git Bash 跑）
node docs/tools/docs-site-contract.mjs           # docs 站契約
pwsh -File scripts/build-references.ps1 -Check   # 內嵌文件是否過期；改了 skill 就重跑不帶 -Check
pwsh -File scripts/extras.ps1 -SelfTest          # extras 行為斷言
node scripts/gen-codex-agents.mjs --check        # 改了 agents/*.md 就不帶 --check 重跑
```

新增 skill：見 `skills/write-skill/SKILL.md` §新 skill 落地 checklist。新增 agent：寫 `agents/<name>.md` → `node scripts/gen-codex-agents.mjs` → 把 `codex/agents/<name>.toml` 一起 commit → 上面 Agents 表 +1。

## License

[MIT License](LICENSE) © 2026 Tommy Sian
