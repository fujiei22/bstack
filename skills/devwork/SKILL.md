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

## 為什麼要有這一層

以前流程靠 skill 描述的關鍵詞自動攔截、守則放全域 CLAUDE.md 對所有專案生效，使用者沒有「這次不要走流程」的選項；現在守則跟著 `/devwork` 走，不下指令就不生效。

## 顯式呼叫其他 skill

流程內的 skill 都能單獨呼叫（Claude Code `/bstack:finish-branch`、`/bstack:retro`、`/bstack:context-snapshot` …；Codex `$bstack:finish-branch`、`$bstack:retro`、`$bstack:context-snapshot` …），缺的 hand-off state 欄位由該 skill 用 AskUserQuestion 補問。這是全 repo 唯一寫出 `/bstack:` 與 `$bstack:` 前綴清單的地方。
