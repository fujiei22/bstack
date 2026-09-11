# finder-B（removed-behavior auditor）findings

## 已核對、無問題

- execute-plan「其餘情境停在這裡等」仍定義明確：非 headless 的無人情境（無工具、無環境變數）走 hosts.md §決策點 文字提問退路；design-direction 的禁自選仍成立。
- receive-review 危險類 gating 完整：第 4 步 B 類、多 reviewer 衝突 B、reviewer fix 自己錯 B；只放寬 T3 不危險類「看 diff 才 commit」。
- rules.md headless 段落不與「禁文字 token NLP」衝突：parser 只認第一行編號；free text 只當 user 指示資料（等同平台 Other 選項），不當 gate 信號。
- docs/index.html「十條」正確：SKILLS 陣列 12 主流程 + 1 入口 = 13、10 跨流程、2 設計、4 meta = 29，與 skills/ 下 29 個目錄一致。
- plugin-contract.mjs P18 在 main 已存在（既有），位於第 565-584 行、介於 P12（560）與 P13（592）之間；P19 在 707。註解宣稱的順序「P12 P18 P13-P17 P19」屬實。
- finish-branch：所有 headless 路徑 auto-merge 仍被擋（§Squash merge、header、Red Flag 列、headless-mode 分流表 `finish-branch/merge` 永不）。

## Candidate findings

```json
[
  {
    "file": "D:\\GitHub\\bstack\\skills\\headless-mode\\SKILL.md",
    "line": 133,
    "summary": "「done 之後的輪次」MERGED 時要無人執行 finish-branch §Merge 後 docs 歸檔，但該節在 docs 進版控的專案（bstack 本身 docs/work 是 tracked）是 git mv + chore commit「併進下一支 branch」，且含「搬之前先問有沒有規則性質」這個決策點。headless 沒有下一支 branch、也沒指定在哪個 branch 上 commit / 要不要 push。",
    "failure_scenario": "PR merge 後下一輪：agent 在已 merge、remote 已刪的 feature branch 上 git mv + commit（永遠進不了 main，archive 等於沒做但 archive_done=true），或 checkout main 直接 commit + push（git push 不經 guard hook，違反 finish-branch 禁直接 push main、繞過 PR）。另外「搬之前先問」依表外一律 B 會寫 pending_question，但 devwork 1.5 先看 pr_url 非空走 done 分支，這個提問永遠不會被 §讀回覆 讀到。"
  },
  {
    "file": "D:\\GitHub\\bstack\\skills\\security-audit\\SKILL.md",
    "line": 47,
    "summary": "「每個 critical 一則 B 類留言」與 headless-mode 的 B 類定義（留言後結束本輪）和 state 結構（pending_question 是單一物件、asked_comment_id 單值）衝突；headless-reply.mjs 也只取 askedAt 之後最後一則受信留言。",
    "failure_scenario": "audit 出 2 個 critical：agent 連發兩則 bstack-ask，snapshot 的 pending_question 被第二則覆寫、第一個 critical 的選項與 resume_hint 遺失；user 依序回「1」「2」兩則，parser 只認最後一則的「2」並套到第二題，第一個 critical 的決定被靜默吃掉，或被誤套到錯的問題。若 agent 反而遵守「留言後結束本輪」，第二個 critical 根本沒問就結束、下一輪也不知道還有一題。"
  },
  {
    "file": "D:\\GitHub\\bstack\\skills\\pr-explain\\SKILL.md",
    "line": 17,
    "summary": "新增「headless 時交給 pr-explainer 的 prompt 必含 §子 agent 約束、git push 改由主 agent 代推」，但 Claude Code 路徑是 harness 依 frontmatter context: fork 自動 fork，prompt 固定為 SKILL 本文，主 agent 唯一能塞的通道是 $ARGUMENTS，而 §1 把 $ARGUMENTS 非空值直接當 PR number。步驟 4「git push」與步驟 5「gh pr comment」也沒有 headless 分流。",
    "failure_scenario": "Claude Code headless T3：主 agent 為了照規則把約束段塞進 args，fork 的 §1 拿整段文字跑 gh pr view <那段文字> 失敗，回「找不到 PR、無法解釋」，Phase 8 白跑；或主 agent 無處可塞、fork 照 §4 自己 git push——規則「主 agent 代推」變成死文字，兩邊都推或都不推（pr-review.md 留在本機、PR comment 引用的檔不在 branch 上）。"
  },
  {
    "file": "D:\\GitHub\\bstack\\skills\\headless-mode\\SKILL.md",
    "line": 102,
    "summary": "duplicate-instance 判定「已有比 snapshot pending_question.asked_at 更新的 bstack-ask」在 pending_question 為 null 時（首次提問、或上一題 answered 後已清 null）沒有定義比較基準。",
    "failure_scenario": "同一 issue 第二次遇到 B 類：上一題 answered 後 pending_question 已清成 null，issue 裡仍留著舊的 bstack-ask 標記；agent 把「沒有 asked_at」讀成「任何 bstack-ask 都算更新」→ blocked duplicate-instance、永遠問不出第二題；讀成「跳過檢查」則兩個並行實例可同時留言，保護形同虛設。兩種讀法都是無人環境下沒人會發現的靜默停擺。"
  },
  {
    "file": "D:\\GitHub\\bstack\\skills\\devwork\\hosts.md",
    "line": 10,
    "summary": "headless 判定靠環境變數，而 subagent 繼承主 agent 的 BSTACK_HEADLESS=1；排除只靠 §偵測 第 0 條的「prompt 含『你不是 headless 主流程』」。但有派工點沒帶約束段：security-audit 第 44 行的 db-reviewer（有 Bash）、request-review §Codex reviewer prompt（T2 / T3 的 Codex reviewer）、Claude Code 內建 code-review 的 finder。bstack repo 的 CLAUDE.md 又 import 整份 rules.md，這些 subagent 都會讀到新加的 headless 段落。§Host 判定 第 3 列「都沒有」與第 4 列同時命中主 agent，表格沒寫優先序，只靠 P19 固定列序暗示。",
    "failure_scenario": "headless T3 涉 migration：db-reviewer 讀到 rules.md §決策點選單 headless 段，printenv 看到 BSTACK_HEADLESS=1、工具清單無 AskUserQuestion、又沒收到「你不是 headless 主流程」那句，判自己 headless，對 issue 發一則 bstack-ask 或 gh issue comment；主 agent 下一個 B 類走 §問人格式 第 4 步看到更新的 bstack-ask → blocked duplicate-instance，整條流程停擺。"
  },
  {
    "file": "D:\\GitHub\\bstack\\skills\\receive-review\\SKILL.md",
    "line": 36,
    "summary": "headless T3 把 git diff HEAD~1 落到 docs/work/<branch>/review-fixes.diff（tracked 目錄），但 §不危險處置 第 3 步與契約 P9e 要求 fix 只能「一顆 commit」，而 diff 檔只能在那顆 commit 之後才產生；同時 safety-guard 被排在 commit 之後才掃。brainstorm 第 239 行 Red Flag「user approval 不可省」也未同步 spec-gate 已改 A 類。",
    "failure_scenario": "headless T3 review 後：agent 為了守一顆 commit 而 amend 把 review-fixes.diff 塞進同一顆 commit（diff 內容自我引用、與實際 diff 不符），或另開第二顆 docs commit 讓 P9e 的「一顆 commit」在無人模式下失守；若 diff 裡有 secret，safety-guard 在 commit 後才命中 → blocked secret，但 secret 已在本機 commit 歷史裡，下一輪 §問人格式 第 2 步「已有 commit → push」沒有再掃一次的規定。"
  }
]
```
