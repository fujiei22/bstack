---
name: frontend-test
description: |
  前端自動化驗證（繁中）：測試矩陣、spawn frontend-e2e-runner 跑 Playwright、處置結果。
  載入：verify-done 偵測前端檔改動（T3 必載、T2 可選）；亦可顯式呼叫。
---

# frontend-test

verify-done 的「UI / browser e2e」子流程，**Mode A 架構**：規劃 / user gate / state 留主 context，Playwright 由 spawn 的 `frontend-e2e-runner` agent 跑（隔離 22 個 browser MCP tool 噪音）。

> 層次：verify-done 總綱 → 本 skill 協調殼 → frontend-e2e-runner 實際執行；單元測試歸 tdd-cycle。

## §載入時機

| 觸發 | 是否載入 |
|---|---|
| T3 + UI / 前端檔改動 | **必載**；例外：diff 只動文字節點 / `data-*`（verify-done §UI / browser e2e 用 `scripts/text-only-diff.mjs` 判 TEXT-ONLY）→ 不載、verify-done 主 agent 做 smoke |
| T2 + 前端檔改動（`.tsx / .jsx / .vue / .svelte / .html / .css / .scss`）| **可載**（牽動 user flow 建議載）|
| T1 + 前端改動 | 預設不載；user 明說再載 |
| user 明說「跑 e2e」「跑 playwright」「測一下前端」 | **必載** |
| 純後端 / 純 lib / 無 DOM 改動 | **禁載** |

## §流程（主 context 跑）

1. **讀 hand-off state** 取 `tier`、`codebase_impact.files`、`track`、`plan_path`。
2. **抽測試範圍**：依改動檔對 §測試矩陣。
3. **確認 preview URL**：state 有 → 用；沒有 → `AskUserQuestion` 問 user。
4. **解析 `<branch-name>`**（§branch-name fallback 鏈）、建 `docs/work/<branch-name>/test-reports/<YYYYMMDD-HHmm>/screenshots/`。
5. **規劃測試矩陣 table**（含 scenario / viewport / steps / expected 4 欄）。
6. **Spawn `frontend-e2e-runner` agent**（見 §Dispatch）。
7. **收 agent summary**（M PASS / F FAIL / I INCONCLUSIVE + report.md path）。
8. **Path 展開**：agent 回的相對路徑（如 `screenshots/login-step3.png`）→ repo-relative（如 `docs/work/<branch-name>/test-reports/<ts>/screenshots/login-step3.png`），寫進 hand-off state。
9. **處置 §Result handling**（8a-8d 分支）。
10. 寫 hand-off state、交回 verify-done。

## §Dispatch — spawn frontend-e2e-runner

```yaml
Agent:
  description: "Frontend e2e on <branch>"
  subagent_type: frontend-e2e-runner
  prompt: |
    preview_url: <url>
    output_dir: docs/work/<branch-name>/test-reports/<ts>/
    tier: <T1/T2/T3>

    test_matrix:
      - scenario: <id>
        viewport: <WxH>
        steps:
          - navigate <path>
          - <action>
          - assert <expected>
        expected: <success criterion>
      - ...

    按 system prompt 跑、寫 report.md 落 output_dir、回嚴格結構化 summary。
```

**Session lifecycle 由 agent 自管**：啟動 `browser_close` + `browser_navigate` 重置、結束 `browser_close` 清狀態（MCP session 跨對話共用）。

## §測試矩陣

| 改動類型 | 必跑 case |
|---|---|
| 新 page / route | navigate → snapshot（a11y）→ 主互動 click → 跨 viewport 排版 |
| 改既有 page | 改動區互動 + 既有 flow regression smoke |
| 改 shared component | grep 引用該 component 的 page → 每 page snapshot + 主互動 |
| 改 CSS / 樣式 / Tailwind class | 多 viewport screenshot（desktop / tablet / mobile） |
| 改 form / input | fill_form → 送出 → 驗錯誤訊息 + 成功訊息 |
| 改 routing / navigation | 跨 page navigate + navigate_back + URL 正確 + state 保留 |
| 改 API 串接（fetch / axios / SWR / React Query）| navigate → 觸發 fetch → 檢查 status / payload / 4xx-5xx |
| 改 modal / dialog / toast | 觸發 → snapshot 顯示 → 關閉互動 → dismiss |
| 改 auth / login flow | 登入 e2e + 失敗訊息 + 登出 + protected route 擋 |
| 改 i18n / 多語 | 切語言後排版不爛、文案出來 |

**Viewport 規格**（排版類跑三組；功能類只跑 desktop，除非明確涉 responsive）：

| 名稱 | 寬 x 高 |
|---|---|
| desktop | 1280 x 720 |
| tablet | 834 x 1194 |
| mobile | 390 x 844 |

## §branch-name fallback 鏈

決定 `docs/work/<branch-name>/` 那一段，依序試（`/` 保留為目錄層、不轉 `-`，報告才與同 branch 的 spec / plan 同夾）：

1. feature branch（`git rev-parse --abbrev-ref HEAD`）→ **branch 名照原樣當路徑**（`feat/user-auth-jwt` → `docs/work/feat/user-auth-jwt/`）
2. 不在 feature + state 有 `task_id` → `task-<task-id>`
3. 兩者皆無（user 手動呼叫、無流程 state）→ `manual-<git-short-sha>`

## §Result handling（8a-8d 完整分支）

**前提**：agent 端 INCONCLUSIVE **語意窄**，只給環境性可重試失敗（connection / timeout / port 不對）；selector 失效是 spec drift 或 code 改動、判 **FAIL**；8c 不處理 code 層問題。

```
8a. 全 PASS（無 FAIL / INCONCLUSIVE）→ 直接 hand-off
8b. 有 FAIL（不論是否同時有 INCONCLUSIVE）→ AskUserQuestion：
      1. retry（單純偶發 / async race、補 wait 條件重跑）
      2. adjust + retry（AI 提具體 fix：補 selector / wait / viewport / 改 spec）
      3. rollback（回前一 commit、放棄此次前端改動）
      4. 回 execute-plan 改實作
      5. escalate（user 接手）
8c. 僅 INCONCLUSIVE（無 FAIL）→ AskUserQuestion（**純環境問題**處置）：
      1. retry（等 dev server 起 / 重跑）
      2. 跳該 scenario、其餘照常 hand-off
      3. 暫停整批、user 修環境後再來
8d. FAIL + INCONCLUSIVE 並存 → 單次 AskUserQuestion：
      列 FAIL 清單（要 retry / fix / rollback）
      + 列 INCONCLUSIVE 清單（要 retry / skip / 暫停）
      user 一次決
```

**特殊規則**：screenshot 對但 console 有 error → **仍 FAIL**；mobile FAIL / desktop PASS → 不算過；既有 flow regression → **必 FAIL**、回 execute-plan。

## §hand-off state（本 skill 寫入欄位）

```yaml
state:
  frontend_test:
    ran: <bool>
    branch_name: <branch 名照原樣、/ 保留為目錄層>
    report_dir: docs/work/<branch-name>/test-reports/<YYYYMMDD-HHmm>/
    report_path: <report_dir>/report.md
    pass_count: <n>
    fail_count: <n>
    inconclusive_count: <n>
    viewports_tested: [...]
    blocker: <bool>
    preview_url: <url>
    unexpected_findings: [<從 agent summary 抓>]
  current_phase: verify-done-frontend-test-done
```

T3 UI 改動有 FAIL → verify-done **必 fail**、不能短路；T2 FAIL 走 §Result handling。**下一 phase**：→ 回 `verify-done` → `request-review`

## §結尾 Trace 標籤

verify-done 子流程：
```
[Trace] Phase=verify-done | Tier=<T2/T3> | Track=<Dev/Bug> | Skill=frontend-test
```

user 直接呼叫：
```
[Trace] Phase=frontend-test | Tier=<…> | Track=— | Skill=frontend-test
```

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「unit test 過了不必跑 browser」「Playwright MCP 沒在就跳過」 | unit ≠ user 體驗，達門檻必跑 e2e；MCP 沒在必告知 user，T3 UI 沒 e2e 不能 ship |
| 「截圖太麻煩」「screenshot 直接貼對話」「branch 名含 / 要轉成 `-`」 | 失敗截圖是診斷關鍵，T3 連 PASS 也落作 baseline；對話貼 path、檔落 docs/work/<branch-name>/test-reports/、`/` 不轉；含 user 資料先 mask |
| 「desktop 過就算過」「console error 可忽略」「跑一次過就算過」 | 至少 desktop + mobile；console error 是 regression 訊號、必修；flaky 至少 retry，連續 3 次仍 flaky 標 flaky_tests |
| 「dev server 沒起就 navigate」「INCONCLUSIVE 當 FAIL 處」「production URL 也能跑」 | 先確認 server 起，否則測的是 connection refused；環境 vs code 問題下游處置不同、必分流；只跑 local / preview / ephemeral |
| 「Playwright MCP session 只能主 context 跑、不能 spawn subagent」 | **錯**；session 跨對話共用、agent 內可呼叫 browser tool，**但**必加 lifecycle 管理 |
