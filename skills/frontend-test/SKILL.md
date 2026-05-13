---
name: frontend-test
description: |
  前端自動化驗證（繁中）。觸發：前端 / frontend / UI / 頁面 / 排版 / layout /
  樣式 / style / CSS / HTML / React / Vue / Svelte / Next / Nuxt / 元件 / component /
  page / form / button / 按鈕 / 互動 / interaction / responsive / 響應式 /
  跨瀏覽器 / cross-browser / visual / 視覺 / 視覺回歸 / .tsx / .jsx / .vue /
  .svelte / .html / .css / .scss / .sass / 改 UI / 改前端 / playwright / e2e /
  browser test / 跑 browser / 跑 e2e / 看畫面對不對。
  涵蓋：用 Playwright MCP 跑功能驗證（navigate / click / type / fill_form）、
  排版驗證（screenshot + 多 viewport）、console / network error 監測、
  互動 flow 驗證、跨 viewport responsive 驗證、測試報告落檔、失敗截圖證據。
  上游：verify-done（偵測前端檔改動）/ execute-plan（單 task 完前自檢）/
  user 顯式呼叫。下游：回 verify-done（整合 e2e 結果）→ request-review。
---

# frontend-test

verify-done 階段「UI / browser e2e」子流程的實作 skill。專責用 Playwright MCP 自動驗證前端**功能 + 排版 + 互動 + 跨 viewport**，回報 pass / fail + 證據。

> 與其他驗證的層次：
> - **verify-done**：總綱（test + lint + build + type-check + e2e）
> - **frontend-test**（本 skill）：e2e 子段，專責前端 browser 驗證
> - **tdd-cycle**：單元測試（function / component 邏輯）；非 user-flow 級

---

## §使用契約（強制）

**載入時機**：

| 觸發 | 是否載入 |
|---|---|
| T3 + UI / 前端檔改動 | **必載** |
| T2 + 前端檔改動（.tsx / .jsx / .vue / .svelte / .html / .css / .scss） | **可載**（AI 視改動量自判；牽動 user flow 建議載）|
| T1 + 前端改動 | 預設不載；user 明說再載 |
| user 明說「跑 e2e」「跑 playwright」「測一下前端」 | **必載**（不論 Tier） |
| 純後端 / 純 lib / 無 DOM 改動 | **禁載** |

**載入後立即動作**：

1. **讀 hand-off state**：取 `tier`、`codebase_impact.files`、`track`、`plan_path`。
2. **抽測試範圍**：依改動檔清單對應「哪些 page / route / component / flow」。
3. **確認 preview URL**：從 state / plan / user 取得 dev server / preview URL（沒有就 `AskUserQuestion` 問）。
4. **規劃測試矩陣**（§測試矩陣）。
5. **解析 `<branch-slug>`**（§測試流程「証據收納」fallback 鏈）並**建立本次測試專屬目錄** `docs/test-reports/<branch-slug>/<YYYYMMDD-HHmm>/`（含 `screenshots/` 子目錄）。
6. **跑 Playwright MCP**（§測試流程），截圖落該目錄 `screenshots/` 子目錄下。
7. **產測試報告** `report.md` 落該目錄根（§測試報告）。
8. 失敗 → 進 §Fail handling。
9. 全綠 → 寫回 hand-off state、交回 verify-done。

**禁**：

- 偵測到前端改動 + Tier 達門檻卻**跳過** e2e（verify-done 不算過）。
- 啟動前**不確認 dev / preview server 已起**就 `browser_navigate`（會測到 connection refused）。
- 截圖 / console log / network payload **未過 PII mask** 就落檔（CLAUDE.md §PII 安全底線；含 PII 時走 safety-guard）。
- 只回「pass / fail」**不附證據**（必含 screenshot path / console 摘要 / network 摘要）。
- 用 `browser_run_code_unsafe` 跑任意 JS（除非 user 明確授權；預設禁）。
- 在**正式環境 URL**（production / staging 共享）跑寫入類互動（提交表單、付款）；只能在 local dev / preview / ephemeral env 跑。

---

## §測試矩陣

依改動檔案 / 類型套對應 case：

| 改動類型 | 必跑 case |
|---|---|
| 新 page / route | `browser_navigate` → `browser_snapshot`（取 a11y tree）→ 主互動 click → 跨 viewport 排版 |
| 改既有 page | 改動區互動 + 該 page **既有 flow 不爛**（regression smoke） |
| 改 shared component | grep 引用該 component 的所有 page → 每個 page 跑 snapshot + 主互動 |
| 改 CSS / 樣式 / Tailwind class | `browser_take_screenshot` 多 viewport（desktop 1280 / tablet 768 / mobile 375） |
| 改 form / input | `browser_fill_form` / `browser_type` → 送出 → 驗證錯誤訊息 + 成功訊息 |
| 改 routing / navigation | 跨 page `browser_navigate` + `browser_navigate_back` + URL 正確 + state 保留 |
| 改 API 串接（fetch / axios / SWR / React Query） | navigate → 觸發 fetch → `browser_network_requests` 檢查 status / payload shape / 4xx-5xx |
| 改 modal / dialog / toast | 觸發 → snapshot 確認顯示 → 關閉互動 → 確認 dismiss |
| 改 auth / login flow | 登入流程 e2e + 失敗錯誤訊息 + 登出 + protected route 擋未登入 |
| 改 i18n / 多語 | 切語言後排版不爛、文案出來 |

**Viewport 規格**（跨 viewport 驗證統一用這組）：

| 名稱 | 寬 x 高 |
|---|---|
| desktop | 1280 x 800 |
| tablet | 768 x 1024 |
| mobile | 375 x 812 |

---

## §測試流程（每個 case）

每個 case 套這套 step：

1. `browser_resize`（設 viewport）
2. `browser_navigate`（到目標 URL）
3. `browser_wait_for`（等 selector / text 出現 / network idle）
4. `browser_snapshot`（取 a11y tree、判頁面結構 / 元素存在）
5. 互動 step：`browser_click` / `browser_type` / `browser_fill_form` / `browser_select_option` / `browser_hover` / `browser_press_key`
6. `browser_take_screenshot`（落證據；fail 必落 / pass 視 Tier 落）
7. `browser_console_messages`（抓 error / warning）
8. `browser_network_requests`（抓 4xx / 5xx / 失敗 request）
9. 記錄 pass / fail + 證據路徑

**跨 viewport 處理**：

排版驗證類 case 用同一 URL 重跑 desktop / tablet / mobile 三組、各取 screenshot；功能驗證類 case 預設只跑 desktop（除非改動明確涉 responsive）。

**証據收納**：

以 **branch 名為父目錄**、**時戳為子目錄**，report + 截圖都收進子目錄。同 branch 多次跑全部聚集在同一個 parent 底下，方便跨次比對 / 一次清。目錄結構固定：

```
docs/test-reports/
└── <branch-slug>/                      ← branch 名（/ → -；見下）
    ├── <YYYYMMDD-HHmm>/                ← 本次測試專屬子目錄
    │   ├── report.md                   ← 測試報告
    │   └── screenshots/                ← 所有截圖
    │       ├── <case-slug>-<viewport>.png
    │       └── ...
    └── <YYYYMMDD-HHmm>/                ← 同 branch 下一次跑（不覆蓋）
        ├── report.md
        └── screenshots/
```

**`<branch-slug>` 解析規則**（fallback 鏈，依序試）：

1. 當前在 feature branch（`git rev-parse --abbrev-ref HEAD`）→ 取 branch 名，把 `/` 轉 `-`（例 `feat/user-auth-jwt` → `feat-user-auth-jwt`）
2. 不在 feature branch（detached HEAD / 罕見場景）+ state 有 `task_id` → 用 `task-<task-id>`
3. 兩者皆無（user 手動呼叫、無流程 state）→ 用 `manual-<git-short-sha>`

`<YYYYMMDD-HHmm>` 為本次跑的時間戳（同 branch 多次跑 → 多個獨立子目錄、不互相覆蓋）。報告 markdown 內引用截圖一律用**相對路徑** `screenshots/<file>.png`。

---

## §測試報告

落 `docs/test-reports/<branch-slug>/<YYYYMMDD-HHmm>/report.md`：

```markdown
# Frontend Test Report — <branch-slug> @ <YYYYMMDD-HHmm>

**時間**：<ISO timestamp>
**Branch**：<原 branch 名，未轉換>
**Commit**：<git short SHA>
**Tier**：<T1/T2/T3>
**Track**：<Dev/Bug>
**Preview URL**：<url>
**改動範圍**：
- <file 1>
- <file 2>

## 測試矩陣

| # | Case | Viewport | 狀態 | 證據 |
|---|---|---|---|---|
| 1 | 登入流程 e2e | desktop | ✅ Pass | screenshots/login-desktop.png |
| 2 | 排版檢查 / 首頁 | mobile 375 | ❌ Fail（CTA 按鈕被截斷） | screenshots/home-mobile.png |
| ... | ... | ... | ... | ... |

## Console 錯誤摘要

| Page | Level | Message |
|---|---|---|
| /home | error | Uncaught TypeError: Cannot read property 'x' of undefined |

（無 → 寫「無」）

## Network 異常摘要

| URL | Status | Page |
|---|---|---|
| /api/users | 500 | /profile |

（無 → 寫「無」）

## 結論

- Pass: X / Y
- Fail: Z
- 建議下一步：<retry / 修 / escalate>
- 阻塞 verify-done：<是 / 否>
```

**PII**：報告內所有 user 輸入 / 顯示欄位若可能含 PII，依 CLAUDE.md §PII 安全底線 mask；不確定的丟 safety-guard。

---

## §Fail handling

E2e fail 處置走 CLAUDE.md §Fail handling，**不靜默重試**：

1. **評起因**（典型）：
   - selector 改名 / DOM 結構變 → 真 bug 或 test 假設過時
   - CSS broken / 排版爛 → 真 bug
   - async race / 等待不夠 → 加 `browser_wait_for` 條件
   - dev server 沒起 / port 變 → 環境問題
   - console error 雖不影響顯示但仍 fail → 真 bug
   - 跨 viewport 只 mobile fail → responsive 設計問題
2. `AskUserQuestion` 提：
   - **retry**（單純偶發 / async race，加 wait 條件後重跑）
   - **adjust + retry**（AI 提具體 fix：補 selector / 補 wait / 改 viewport）
   - **rollback**（回前一個 commit、放棄此次前端改動）
   - **回 execute-plan 改實作**
   - **escalate**（user 接手）
3. 選後執行；`state.fail_history` append。

**特殊**：
- screenshot 看起來對但 console 有 error → **仍 fail**（CLAUDE.md regression 訊號）
- 排版 mobile fail / desktop pass → 不算過、必修
- 既有 flow regression（不在本次改動範圍但壞了）→ **必 fail**、回 execute-plan

---

## §跟 verify-done 的銜接

`verify-done` skill 偵測 `codebase_impact.files` 含前端副檔名 → 載 frontend-test。執行完寫回：

```yaml
state:
  verify_results:
    e2e: pass | fail
  frontend_test:
    ran: true
    branch_slug: feat-user-auth-jwt
    report_dir: docs/test-reports/feat-user-auth-jwt/20260513-1430/
    report_path: docs/test-reports/feat-user-auth-jwt/20260513-1430/report.md
    pass_count: <n>
    fail_count: <n>
    viewports_tested: [desktop, tablet, mobile]
    blocker: <bool>
```

T3 UI 改動 frontend-test fail → verify-done **必 fail**，不能短路放行。

T2 frontend-test fail 視為一般 verify fail（走 §Fail handling）。

---

## §hand-off state（本 skill 寫入欄位）

```yaml
state:
  frontend_test:
    ran: <bool>
    branch_slug: <branch name with / replaced by ->
    report_dir: <docs/test-reports/<branch-slug>/<YYYYMMDD-HHmm>/>
    report_path: <report_dir>/report.md   # report markdown 路徑
    pass_count: <n>
    fail_count: <n>
    viewports_tested: [...]
    blocker: <bool>
    preview_url: <url>
  current_phase: verify-done-frontend-test-done
```

**下一 phase**：→ 回 `verify-done`（整合綜合驗證結果）→ `request-review`

---

## §結尾 Trace 標籤

本 skill 作為 verify-done 子流程，Trace 仍掛 verify-done：

```
[Trace] Phase=verify-done | Tier=<T2/T3> | Track=<Dev/Bug> | Skill=frontend-test
```

user 直接呼叫的情境：

```
[Trace] Phase=frontend-test | Tier=<…> | Track=— | Skill=frontend-test
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「unit test 過了不必跑 browser」 | unit ≠ user 體驗；前端改動達門檻必跑 browser e2e 才算 verify-done |
| 「截圖太麻煩、pass / fail 就好」 | 失敗截圖是診斷關鍵；T3 連 pass 也建議落、用作 visual baseline |
| 「desktop 過就算過」 | 響應式時代必跨 viewport；至少 desktop + mobile |
| 「dev server 沒起就直接 navigate localhost」 | 必先確認 server 起；不然測的是 connection refused、不是 UI |
| 「console error 不影響功能可忽略」 | console error 是 regression 訊號；必抓、必回報、原則上必修 |
| 「自己 spawn 一個 subagent 跑就好」 | Playwright MCP browser session 是 main agent 直跑；subagent 不持有 MCP 連線 |
| 「production URL 也能跑測試」 | 禁；只在 local dev / preview / ephemeral env 跑；正式環境寫入類互動會污染 |
| 「screenshot 直接貼對話」 | 對話貼 path、檔案落 docs/test-reports/；含 user 資料先 mask |
| 「跑一次過就算過」 | flaky 至少 retry 確認；連續 3 次仍 flaky 標 flaky_tests 給 review 看 |
| 「Playwright MCP 沒在就跳過」 | 必告知 user MCP 未連、不能跳；T3 UI 改動沒 e2e 不能 ship |
| 「branch 名含 / 就直接當目錄名」 | filesystem 上 `/` = 路徑分隔；必先轉 `-`（feat/x → feat-x）才當目錄名 |
| 「在 main 上跑直接命名 main/」 | 流程上幾乎不會跑到（branch-safety hook 擋）；真遇到走 fallback 鏈、不要污染 main/ 目錄 |
