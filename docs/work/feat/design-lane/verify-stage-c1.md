# 階段 C1 驗收記錄

> 對應 plan: `docs/work/feat/design-lane/plan-c1.md`（v2「全域守則」；v1「最小 gate hook」已由 D26 廢除）
> 日期: 2026-08-28
> 驗收對象: `CLAUDE.md` 與全域 `~/.claude/`

**涵蓋範圍**：**V3-取代**（守則條文存在且已同步）、**V10**（setup 不壞既有行為）。

**本階段最重要的事實**：**沒有新增任何 hook。** 原規劃的 `hooks/design-gate.ps1` 經 Eng review 後由 D26 廢除，改為 `CLAUDE.md` 強制守則。**S2 因此沒有機械保障**——這是明知的取捨，不是遺漏，spec 的 S2 已照實改寫。

---

## V3-取代 · 守則條文存在且已同步

| 檢查 | 結果 |
|---|---|
| `CLAUDE.md` 新增 `### §設計語言對齊` | ✅ +11 行 |
| 位置（`§DB 操作` 之後、`§Docs 落檔` 之前） | ✅ awk 順序斷言通過 |
| 符號慣例（`🔴` / `⚠️` 全檔仍為 0） | ✅ 只用 `**粗體**`，與全檔一致 |
| `setup.ps1` 同步後 repo 與 `~/.claude/CLAUDE.md` | ✅ `diff -q` 完全一致 |
| 全域版含 `§設計語言對齊` | ✅ 命中 1 次 |

**條文涵蓋**（五條）：前端副檔名清單、0b′ 判定與六欄位、小改路徑的四項對齊檢查、大改路徑的三方向、禁止用 Tier 推導 `size`、禁止拿別區 token 頂替。細則指向 `design-language`。

**為什麼放在必載層**：`design-language` 與 `brainstorm` 都是**選載**的 skill，`CLAUDE.md` 是**每個 session 必載**。寫進必載層才接得住「該載卻沒載」的情況——那正是這條守則要防的失效模式。

---

## V10 · setup 不壞既有行為

| 項 | 全域 | repo | 判定 |
|---|---|---|---|
| skill 數 | 26 | 26 | ✅ 一致 |
| **hook 數** | **2** | **2** | ✅ **維持兩支，本階段未新增** |
| agent 數 | 6 | 6 | ✅ 一致 |
| 孤兒（全域有、repo 沒有） | 無 | —— | ✅ |
| `~/.claude/hooks/` 內容 | `branch-safety.ps1`、`file-type-guard.ps1` | —— | ✅ 無 `design-gate.ps1` 殘留 |
| `settings.json` merge | hooks / statusLine 取 repo、其餘本機保留 | —— | ✅（前一階段已驗過同一機制） |

---

## 連帶清理：`.design-gate` 全面移除

`.design-gate` 在 skill 裡的定義是「`hooks/design-gate.ps1` 的唯一輸入」。hook 廢除後它沒有讀者，且它記的六個欄位在 T1+ 已由 `spec.md` 的「設計方向」段落承載。

移除位置（實測 grep 確認全 repo 零殘留）：

| 檔 | 動作 |
|---|---|
| `skills/design-language/SKILL.md:38` | 落檔時機只留 `design-map.md` |
| `skills/brainstorm/SKILL.md:78` | 同上，並改為「判定結果只進 hand-off state 與 spec.md 的設計方向段落」 |
| `skills/brainstorm/SKILL.md:192` | 整句刪除 |
| `.gitignore` | 移除 `**/.design-gate` 與其註解行；`**/design-demos/` 保留 |

**同時修掉 Eng review 的 C3**：那三處「與寫 `spec.md` 同一步」的落檔規則不一致，隨 `.design-gate` 一起消失。
前一版 plan 只打算改**一處**（`brainstorm:192`），而 review 實測命中**三處**（`brainstorm:78`、`:192`、`design-language:38`），且原本的負向斷言因為措辭差一個字（「與寫 `spec.md` 同一步」vs「與 `spec.md` 同一步寫出」）**抓不到另外兩處**。

---

## 未達成 / 已知限制

| 項 | 狀態 |
|---|---|
| **S2 無機械保障** | D26 明知的取捨。守則寫在必載層是目前這個工具鏈下能做到的最強保證 |
| **auto mode 下無任何寫入攔截** | 實測：`settings.json` 的 PreToolUse matcher 為 `Write\|Edit\|NotebookEdit`，**無 hook 攔 `Bash`**；而 auto mode 指示改檔優先用 sed / heredoc。這是既有事實，非本階段引入 |
| **條文的固定成本** | `CLAUDE.md` +11 行，每個 session 都會載入 |
| S4 中途轉進 / S5 三方向 | 階段 B |
| S7 `setup.ps1` 孤兒偵測 | 階段 C |

## 這一階真正的產出

不是程式碼，是**一個被擋下來的錯誤決定**。Eng review 花一個 agent 的成本，攔住了一個「防不了主要路徑（auto mode 下不觸發）、會誤傷這台機器上所有其他前端專案、錯誤訊息還在教模型怎麼繞」的 hook 進入 codebase，並讓 S2 從一個**假的機械保證**降級為**誠實的守則約束**。
