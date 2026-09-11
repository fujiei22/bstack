---
name: devwork
description: |
  bstack 九階段開發流程的唯一入口（繁中）。
  載入：Claude Code 輸入 `/devwork <要做的事>`（Unknown command 時改打 `/bstack:devwork`）；Codex 輸入 `$bstack:devwork <要做的事>`。不因「寫 / 改 / 修 / 加」等自然語言自動載入；沒下指令時就是普通的 Claude Code / Codex。
---

# devwork

## 使用契約（強制）

1. **讀 `rules.md` 與 `hosts.md`**（同目錄）。rules.md 的位階等同 CLAUDE.md：與任何 skill 衝突時 rules.md 勝；hosts.md 定義所有 skill 裡 `AskUserQuestion` / `TaskCreate` / `Agent` / `mcp__<server>__<tool>` 等抽象動詞在 Claude Code 與 Codex 各對應哪個工具。
   若本 session 的 CLAUDE.md / AGENTS.md 已引用 rules.md（在 bstack repo 內開發時會這樣），rules.md 不重讀、hosts.md 照讀。
1b. **headless 入口**：hosts.md §Host 判定 判為 headless → 載 `headless-mode` 跑 §偵測，寫 `state.headless`（值由偵測結果決定）/ `source_issue`；偵測結論 blocked 就依其協定結束。之後依 snapshot 分三支：
   - `pr_url` 非空 → 依 `headless-mode` §本輪結束協定「done 之後的輪次」處理後結束。
   - 有 `pending_question` → **先在這裡**跑 `headless-mode` §讀回覆 第 1-2 步（`node scripts/headless-reply.mjs`）：`none` / `unparseable` → 更新 snapshot、印 `waiting` 行結束，**不載後面的 skill 鏈**（等人回覆的輪次不必燒 context）；`answered` → 跳過第 2 步、照第 3 步載 `bstack:dev-workflow`（Codex `$bstack:dev-workflow`），它會依 `pending_question` dispatch 到 `context-resume` 接續。
   - 其餘照第 2 步往下，需求文字取自 issue（§偵測）。
2. **判斷 `/devwork` 後面的文字**：
   - 純問答 / 教學（「這個函式在做什麼」「X 和 Y 差在哪」）→ 直接回答，不進 Phase 0，結尾提一句「`/devwork` 是給改動類任務用的」。
   - 改動類 → 進第 3 步。
   - 沒有文字 → 用一般文字問「要做什麼？一句話描述這次的改動」（開放題，**不用** AskUserQuestion）。
3. **載入 `bstack:dev-workflow`**（用命名空間，避免被使用者層級的舊副本遮蔽），進 Phase 0 入口分流。
4. 之後每輪結尾照 rules.md §Trace 標籤 貼 `[Trace] …`。

## 第一句台詞（只印這一條；dev-workflow 被本 skill 載入時不另印）

- 有文字：`[bstack devwork · plugin] 已載入守則。這件事：<一句改述>。先做 Phase 0 判定。`
- 沒文字：`[bstack devwork · plugin] 已載入守則。要做什麼？一句話描述這次的改動。`

**若接著又出現一行 `[已載入 dev-workflow]`**，代表載到的是舊版 setup.ps1 留在使用者層級的副本、它遮蔽了 plugin 版：請使用者跑 `pwsh -File scripts/extras.ps1 -Migrate` 後重開 session。

## 顯式呼叫其他 skill

流程內的 skill 都能單獨呼叫（Claude Code `/bstack:finish-branch`、`/bstack:retro`、`/bstack:context-snapshot` …；Codex `$bstack:finish-branch`、`$bstack:retro`、`$bstack:context-snapshot` …），缺的 hand-off state 欄位由該 skill 用 AskUserQuestion 補問。這是全 repo 唯一寫出 `/bstack:` 與 `$bstack:` 前綴清單的地方。
