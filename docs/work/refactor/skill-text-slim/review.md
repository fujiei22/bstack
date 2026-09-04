# Plan review 總結

> Plan: docs/work/refactor/skill-text-slim/plan.md
> Tier: T3
> 視角: Eng + DX（review_perspectives；純文件無跨模組契約，Design 不派）

## Critical 共識（兩視角同時提）

1. **守則 2「hand-off yaml 只留新增欄、其餘見 dev-workflow 母版」是空指令**：母版沒有下游 22 個欄（review_summary_path / verify_results / code_review_level / commits / pr_url …），下游 skill 是照上游貼的 yaml 讀、不是照母版；`design_rejudge` 的 entry 結構只在 execute-plan / verify-done 兩檔。→ 守則 2 改：yaml 不砍，只有 verify-done 的 `design_rejudge` 結構改指向 execute-plan。
2. **守則 4「§ 標題名不改」與 Task 5 / Task 10 直接矛盾**（Task 5 要合併四個 §、Task 10 寫的 §Rebase vs Merge 其實是 `###`）。→ 改成「被別檔引用的 § 白名單不改名，其餘可合併 / 刪」，白名單直接列在 plan。
3. **`wc -l` 可被空行與 `---` 灌水**（Eng 實測：空行 703 + 分隔線 122 = 33%）。→ 加 byte 斷言（11 檔現 97,861 bytes），每 task 同時報 `wc -l` / `wc -c`。

## Critical 各視角獨見

**DX**：砍「為什麼」沒有下限，且 spec 前提「理由已在 archive」不成立（blame：review-plan §第 2 / 4 段 09-03、receive-review / request-review Red Flag 09-04、brainstorm 0c/0d 與 execute-plan §前端檔處理 08-31，都不在 archive）。→ 固定格式 `> 為什麼<動作>：<機制>。不做會<後果>（實測 <日期>）`，每檔指定必留清單、Step 4 `grep -c '^> 為什麼'`。

## Major（去重合併）

- **契約只守 ~20 字串，AskUserQuestion 選單與使用契約步驟數一個都沒守**（Eng 4 / DX M1）→ 主 agent 用基線快照腳本比對四項：使用契約編號步驟、選單區塊（三種排版：code block / 縮排編號 / bullet `- **x**`）、§ 白名單、反引號片段集合 ⊆ 改前。守則 3 附選單識別規則。
- **同 group 的 subagent 跑契約會互看半成品誤紅**（P9b 讀 brainstorm + execute-plan、P9h 讀 review-plan + write-plan）→ group 1 拆兩個；守則 5 改「只處理錯誤訊息點名自己檔的 FAIL，其餘原樣回報」。
- **四檔目標低於受保護內容下限**（brainstorm / finish-branch / tdd-cycle / pr-explain）→ 單檔目標改軟目標（240 / 230 / 220 / 70），總量由 Task 12 守；tdd-cycle 明寫「❌ 反例可刪、✅ 留」。
- **Task 7 自相矛盾**（合併回報範本 vs prompt 不動；自檢表欄名被 §結果整合 引用）→ 只把 T1 範本併入；T2 表與 T3 prompt 不動；「等 task-notification、不用 TaskOutput 輪詢」是動作必留。
- **失敗處置缺一半**（行數到不了、被迫動到不能動項）→ 差 ≤10% 接受並記錄；差 >10% 或動到保護項 → 以「不動保護項」為準接受現況、施工紀錄註明、PR body 列給 user。
- **Red Flags 挑選標準 subagent 判不出來**（DX M2）→ plan 直接指定每檔留哪幾條。
- **pr-explain 沒有 § / hand-off / Red Flags**（DX M3 / Eng 14）→ 豁免骨架與 Red Flags 下限；守則加「不新增缺的段」。
- **Task 1 / 4 grep 與實檔不合**（Eng 10 / DX M5）→ brainstorm :260 也有「≤ 8 列」；execute-plan 第 1 步也有「自拆 1-3 個 task」。

## Minor / Nit（採納）

- verify-done T3 套餐的 e2e 例外段與 §UI / browser e2e 逐字重複 → 改一句指向（任務 3 要改那節）
- receive-review 表用「項目 | 判定 | 條件」三欄
- review-plan 第 2 段對照表（5 列）與 `要 review 的不是程式，是 <標的>` 模板句保留，砍實例敘述
- 一行指向格式固定 `見 <name> §<段>`（docs-site C8f 解析 `<name>.md §<段>`）
- Red Flags 列數統一「3-6 列、下限 3」；守則 6 加「spec 兩個 nit 例外」
- finish-branch 內文「§Squash merge / WHO / WHEN」合併後改「§Squash merge」；execute-plan:148 引用的「§Verify fail 流程」實際標題是「§verify 失敗處置」，白名單寫實際標題、本次不修引用

## 略過（附理由）

- DX C1(b) 在 dev-workflow 母版加「各 phase 新增欄一覽」：dev-workflow 不在本次 11 檔範圍；改成不砍 yaml 就沒有「見母版」的需求。母版 :175 名字錯（`review_summary` / `verify_result`）記入 spec 待辦，留給下一支。
- Eng 1(b) byte 目標 ≤58,700（−40%）：行數才是 user 給的指標；byte 定 −30%（≤68,500）當「沒灌水」的證據，不當硬門檻。

## 主 agent 建議

- 必處理：Critical 3 條共識 + DX 獨見 → 全部進新版 plan
- 建議處理：Major 8 條 → 全部採納
- user gate：選項 1「修 plan 後進 execute-plan」（user 在啟動訊息已授權整段跑到開 PR，未另問）
