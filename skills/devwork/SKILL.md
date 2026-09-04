---
name: devwork
description: |
  bstack 九階段開發流程的唯一入口（繁中）。使用者輸入 `/devwork <要做的事>` 才啟動
  （打了出現 Unknown command 或載到別的東西時改打 `/bstack:devwork`）；
  **不因「寫 / 改 / 修 / 加」等自然語言自動載入**。載入後：讀 rules.md → 載 dev-workflow → Phase 0。
  沒下這個指令時，Claude Code 就是普通的 Claude Code。
---

# devwork

## 使用契約（強制）

1. **讀 `rules.md`**（同目錄）。它的位階等同 CLAUDE.md：與任何 skill 衝突時 rules.md 勝。
   若本 session 的 CLAUDE.md 已經 `@import` 了它（在 bstack repo 內開發時會這樣），不重讀。
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

以前這套流程靠 27 個 skill 描述裡的關鍵詞自動攔截，使用者沒有「這次不要走流程」的選項，
而且守則放在全域 CLAUDE.md、對所有專案生效。現在守則跟著 `/devwork` 走，不下指令就不生效。

## 顯式呼叫其他 skill

流程內的 skill 都能單獨呼叫（`/bstack:finish-branch`、`/bstack:retro`、`/bstack:context-snapshot` …），
它們預期 hand-off state 存在；單獨呼叫時缺的欄位由該 skill 用 AskUserQuestion 補問。
這是全 repo 唯一寫出 `/bstack:` 前綴清單的地方。
