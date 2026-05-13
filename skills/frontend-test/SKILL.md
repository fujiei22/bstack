---
name: frontend-test
description: |
  前端自動化驗證（繁中）。觸發：前端 / frontend / UI / 頁面 / 排版 / layout /
  樣式 / style / CSS / HTML / React / Vue / Svelte / Next / Nuxt / 元件 / component /
  page / form / button / 按鈕 / 互動 / interaction / responsive / 響應式 /
  跨瀏覽器 / cross-browser / visual / 視覺 / 視覺回歸 / .tsx / .jsx / .vue /
  .svelte / .html / .css / .scss / .sass / 改 UI / 改前端 / playwright / e2e /
  browser test / 跑 browser / 跑 e2e / 看畫面對不對。
  涵蓋：規劃測試矩陣、spawn frontend-e2e-runner agent 跑 Playwright（隔離
  browser tool 噪音）、收結構化 summary、處置 PASS / FAIL / INCONCLUSIVE。
  上游：verify-done（偵測前端檔改動）/ execute-plan（單 task 完前自檢）/
  user 顯式呼叫。下游：回 verify-done（整合 e2e 結果）→ request-review。
---

# frontend-test

verify-done 的「UI / browser e2e」子流程。**Mode A 架構**：skill 留主 context 做規劃 / user gate / state、實際 Playwright 執行 spawn `frontend-e2e-runner` agent 跑（隔離 22 個 browser MCP tool 的噪音、避免污染主 pipeline）。

> 層次：
> - **verify-done**：總綱（test + lint + build + type-check + e2e）
> - **frontend-test**（本 skill）：e2e 子段、協調殼
> - **frontend-e2e-runner**（agent）：實際 Playwright 執行
> - **tdd-cycle**：單元測試、非 user-flow 級

## §載入時機

| 觸發 | 是否載入 |
|---|---|
| T3 + UI / 前端檔改動 | **必載** |
| T2 + 前端檔改動（`.tsx / .jsx / .vue / .svelte / .html / .css / .scss`）| **可載**（牽動 user flow 建議載）|
| T1 + 前端改動 | 預設不載；user 明說再載 |
| user 明說「跑 e2e」「跑 playwright」「測一下前端」 | **必載** |
| 純後端 / 純 lib / 無 DOM 改動 | **禁載** |

## §流程（主 context 跑）

1. **讀 hand-off state** 取 `tier`、`codebase_impact.files`、`track`、`plan_path`。
2. **抽測試範圍**：依改動檔對應 §測試矩陣 找哪些 page / route / component / flow 需驗。
3. **確認 preview URL**：state 有 → 用；沒有 → `AskUserQuestion` 問 user。
4. **解析 `<branch-slug>`**（§branch-slug fallback 鏈）、建 `docs/test-reports/<branch-slug>/<YYYYMMDD-HHmm>/screenshots/`。
5. **規劃測試矩陣 table**（含 scenario / viewport / steps / expected 4 欄）。
6. **Spawn `frontend-e2e-runner` agent**（見 §Dispatch）。
7. **收 agent summary**（M PASS / F FAIL / I INCONCLUSIVE + report.md path）。
8. **Path 展開**：agent 回的相對路徑（如 `screenshots/login-step3.png`）→ repo-relative（如 `docs/test-reports/<branch>/<ts>/screenshots/login-step3.png`），寫進 hand-off state。
9. **處置 §Result handling**（8a-8d 分支）。
10. 寫 hand-off state、交回 verify-done。

## §Dispatch — spawn frontend-e2e-runner

```yaml
Agent:
  description: "Frontend e2e on <branch>"
  subagent_type: frontend-e2e-runner
  prompt: |
    preview_url: <url>
    output_dir: docs/test-reports/<branch-slug>/<ts>/
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

**Session lifecycle 由 agent 自管**：啟動 `browser_close` + `browser_navigate` 重置、結束 `browser_close` 清狀態（Playwright MCP session 跨對話共用、必須顯式管理；驗證見 PR commit message）。

## §測試矩陣

依改動檔案 / 類型套對應 case：

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

**Viewport 規格**（跨 viewport 統一用這組）：

| 名稱 | 寬 x 高 |
|---|---|
| desktop | 1280 x 720 |
| tablet | 834 x 1194 |
| mobile | 390 x 844 |

排版類 case 跑三組 viewport、功能類預設只跑 desktop（除非改動明確涉 responsive）。

## §branch-slug fallback 鏈

依序試：

1. feature branch（`git rev-parse --abbrev-ref HEAD`）→ branch 名 `/` 轉 `-`（`feat/user-auth-jwt` → `feat-user-auth-jwt`）
2. 不在 feature + state 有 `task_id` → `task-<task-id>`
3. 兩者皆無（user 手動呼叫、無流程 state）→ `manual-<git-short-sha>`

## §Result handling（8a-8d 完整分支）

**前提**：agent 端 INCONCLUSIVE **語意窄** — 只給「環境性、可重試」失敗（connection / navigate timeout / 中斷 / port 不對）。selector 失效 / element missing 是 spec drift 或 code 改動、agent 端判 **FAIL**、不會落到 INCONCLUSIVE。所以 8c 不必處理 code 層問題。

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

**特殊規則**（沿用原版）：
- screenshot 對但 console 有 error → **仍 FAIL**（regression 訊號）
- mobile FAIL / desktop PASS → 不算過、必修
- 既有 flow regression（不在改動範圍但壞了）→ **必 FAIL**、回 execute-plan

## §hand-off state（本 skill 寫入欄位）

```yaml
state:
  frontend_test:
    ran: <bool>
    branch_slug: <branch with / replaced by ->
    report_dir: docs/test-reports/<branch-slug>/<YYYYMMDD-HHmm>/
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

T3 UI 改動 frontend-test 有 FAIL → verify-done **必 fail**、不能短路。
T2 frontend-test FAIL 視為一般 verify fail（走 §Result handling）。

**下一 phase**：→ 回 `verify-done` → `request-review`

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
| 「unit test 過了不必跑 browser」 | unit ≠ user 體驗；前端改動達門檻必跑 e2e 才算 verify-done |
| 「截圖太麻煩、PASS / FAIL 就好」 | 失敗截圖是診斷關鍵；T3 連 PASS 也落、用作 visual baseline |
| 「desktop 過就算過」 | 響應式時代必跨 viewport；至少 desktop + mobile |
| 「dev server 沒起就直接 navigate」 | 必先確認 server 起；否則測的是 connection refused |
| 「console error 不影響功能可忽略」 | regression 訊號；必抓、必回報、原則必修 |
| 「Playwright MCP browser session 只能主 context 跑、不能 spawn subagent」 | **錯**（PR #16 驗過）；session 跨對話共用、agent 內可正常呼叫 browser tool。**但**必加 lifecycle 管理 |
| 「production URL 也能跑」 | 禁；只在 local / preview / ephemeral；正式環境寫入類會污染 |
| 「screenshot 直接貼對話」 | 對話貼 path、檔案落 docs/test-reports/；含 user 資料先 mask |
| 「跑一次過就算過」 | flaky 至少 retry 確認；連續 3 次仍 flaky 標 flaky_tests |
| 「Playwright MCP 沒在就跳過」 | 必告知 user、不能跳；T3 UI 改動沒 e2e 不能 ship |
| 「branch 名含 / 就直接當目錄名」 | filesystem `/` = 分隔；必轉 `-` |
| 「INCONCLUSIVE 看起來像失敗、當 FAIL 處」 | 環境問題 vs code 問題下游處置不同、必分流 |
