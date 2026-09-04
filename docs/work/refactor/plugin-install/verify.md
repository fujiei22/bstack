# verify：plugin 化實測記錄

環境：Claude Code 2.1.260、pwsh 7.4、Windows 11。日期 2026-09-04。標「實測」= 本機跑過；標「推斷」= 未驗。

## Task 2 / 4：plugin 載入與 /devwork

| 項目 | 指令 | 結果 |
|---|---|---|
| manifest 可載 | `claude --plugin-dir . -p "/bstack:brainstorm 只回 OK"` | 回 `OK`，無 Unknown plugin |
| 裸 `/devwork` 由 harness 展開 | `-p "/devwork" --output-format stream-json` 數 `"name":"Skill"` | 0 次（模型沒有自己去載，是指令解析） |
| 沒文字的橫幅 | `-p "/devwork"` | `[bstack devwork · plugin] 已載入守則。要做什麼？一句話描述這次的改動。` |
| 純問答出口 | `-p "/devwork 這個 plugin 的 hooks 目錄裡兩支腳本各在做什麼？"` | 印橫幅後標「純問答，不進 Phase 0」直接回答 |
| CLAUDE.md `@import` | repo 內 `claude -p "§事實核實 第一句"` | 引出 rules.md 原文，並指出內容來自 `skills/devwork/rules.md` |
| 舊副本遮蔽（Task 4 Step 4(c)） | 本機 `~/.claude/skills/dev-workflow` 舊副本仍在時跑 `-p "/devwork 幫我把 README.md 的錯字修掉"`，看 stream-json 的 skill 載入紀錄 | 載入 `bstack:dev-workflow`、`bstack:brainstorm`，Base directory 都是 `D:\GitHub\bstack\skills\…`（plugin 版）。**命名空間可繞過 user 級同名 skill 的遮蔽**，devwork SKILL.md 第 3 步維持命名空間寫法 |
| 自然語言不自動觸發（Task 5b Step 4） | `-p "幫我改一下 README 的錯字"`（無斜線）數 `"name":"Skill"` | 0 次。注意：本機全域 CLAUDE.md 仍是舊版（含「一律進 dev-workflow」）也沒觸發，但這是 `-p` 單輪的結果；互動 session 是否會被舊 CLAUDE.md 驅動，merge 後跑 `-Migrate` 前再驗一次 |

## Task 3：hooks

| 項目 | 條件 | 結果 |
|---|---|---|
| main 上 Write 被擋 | 目錄 `…\bstack probe\`（含空白）、`git init -b main` | 擋下；stderr 為新版 `[bstack] 目前在 'main'…` 三行，含 `/plugin disable bstack@bstack` 出口。`${CLAUDE_PLUGIN_ROOT}` 展開為 `D:\GitHub\bstack`（反斜線 + 正斜線混用，pwsh 可吃） |
| **沒有 pwsh 7** | 把 `C:\Program Files\PowerShell\7` 從 PATH 拿掉、同樣在 main 上 Write | **hook 靜默失效**：檔案照寫、Claude Code 沒有印任何 hook 錯誤或警告。使用者不會知道保護沒生效 |
| WARN token 流程（Dockerfile） | 未跑：需要模型多回合互動建 token，`-p` 模式不穩定 | **留 post-merge 互動驗證**；hook 印出的 `$tokenPath` 已改為系統 temp 絕對路徑，code 路徑與舊版相同 |

## Task 6：extras.ps1

| 項目 | 結果 |
|---|---|
| `-SelfTest` | 31 條斷言全 PASS（S0 反向刻意紅後扣回）。第一版抓到 `Get-AddedKeys` 用 `,$out` 回傳造成 keys 被 join 成一個字串、空陣列被算一筆；code review 再抓到 allow 只有一筆時 `if` 表達式 unroll 成字串（u1 / u2）、`-Force` 重裝洗掉 manifest keys（r1 / r2）、`-Migrate` 簽名在新版 rules.md 也存在（e7）、同名非 bstack skill 被刪（e1b）、project「已裝」跨專案誤報（p2）、allow 拆空留空殼（d5）、根非 object（j2），全部補斷言後修掉 |
| `-Yes -Items statusLine,env -Scope user -WhatIf`（經 `-File` 傳逗號字串） | 第一版 ValidateSet 直接拒絕；改成進腳本後 split 驗集合，現在接受並印出兩層目標路徑與舊副本清單 |
| `-Yes -Items env -Scope user -WhatIf` | 真實 `~/.claude/settings.json` hash 不變、manifest 未建立 |
| `-WhatIf` 雜訊 | `ForEach-Object Name` 會印「Retrieve the value for property」，改成 script block 後消失 |

## Task 7：docs 站 / README

| 項目 | 結果 |
|---|---|
| `docs-site-contract.mjs` | 37 條 ALL PASS（C8a 99/136、C8b 35、C18 28 skill） |
| `plugin-contract.mjs` | P1–P8 ALL PASS |
| `build-references.ps1 -Check` | PASS，35 份 |
| 紅線 grep（setup.ps1 / marketplace 依賴 / 繞不過 / `~/.claude/{skills,hooks,agents,CLAUDE}`，排除白名單行） | index.html / README.md 皆無 |
| docs 站規則書內嵌（code review 架構視角抓到） | 第一版內嵌的是 repo 根 CLAUDE.md 三行殼、35 處 `rules.md §` 交叉引用斷鏈而契約全綠。改 build-references 內嵌 `skills/devwork/rules.md` 為 `references/rules.md`、app.js EXTRA_DOCS 改名 `rules.md`，契約加 C8e（含 §事實核實）/ C8f（交叉引用可解析）/ C8g（index.html 兩處節點數 == data.js） |

## 安裝路徑實測（code review 主 reviewer 建議：不用等 merge）

| 指令 | 結果 |
|---|---|
| `claude plugin marketplace add D:\GitHub\bstack` | `Successfully added marketplace: bstack (declared in user settings)`——`marketplace.json` 的 `source: "./"` 被接受 |
| `claude plugin install bstack@bstack -s user` | `Successfully installed plugin: bstack@bstack (scope: user)`，`claude plugin list` 顯示 Version 1.0.0、enabled |
| 不帶 `--plugin-dir`、從空目錄 `claude -p "/devwork"` | 印 `[bstack devwork · plugin] 已載入守則。要做什麼？…`——純安裝路徑可用 |
| 還原 | `claude plugin uninstall bstack@bstack`、`claude plugin marketplace remove bstack` 皆成功，作者機器回原狀 |

## hook 延遲（README 措辭依據）

`Measure-Command` 餵 Write payload：branch-safety 1310 ms、file-type-guard 1168 ms（pwsh 7.4、Windows 11、NoProfile）。兩支合計約 2.5 秒，主要是 pwsh 啟動時間。README 原寫「數百毫秒」是推斷，已改為實測數字。

**沒 pwsh 靜默失效的處置**：hooks.json 的 command 沒有辦法在不知道 shell 的前提下寫 fallback；列為已知限制，README prerequisites 與 troubleshooting 明寫「pwsh 7+ 是 hook 必需，缺了不會報錯、保護直接不存在」，並給 mac / Linux / Windows 的安裝指令。
