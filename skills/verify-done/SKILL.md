---
name: verify-done
description: |
  task 完成前的綜合驗證（繁中）。載入：dev-workflow Phase 4（execute-plan 全 task 完 / tdd-cycle 單 task 完）；亦可由使用者顯式呼叫。
  涵蓋：test / lint / build / type-check 全跑、T2+ 多輪 verify、
  T3 UI 改動加 browser e2e、verify fail 處置。
  上游：execute-plan（task 全完）/ tdd-cycle（單 task 完）。
  下游：request-review。
---

# verify-done
把 task 全跑完後到 PR 之間的「綠燈關卡」。**不過 = 不進 review**。
## 使用契約（強制）
1. **讀 hand-off state** 取 `tier`、`codebase_impact`、`commits`。
2. **依 tier 跑驗證套餐**（§Verify 套餐；T0 不進本 skill——rules.md §Tier 表 T0 全跳，直接實作後進 finish-branch）。
2.5 **跑 §漏網複查 的觸發判斷**（**全 tier 都跑**，成本是 1 個 `git diff`）。
3. **每項 verify 印 command + output**（讓 user 看得到）。
4. 全綠 → 交棒 request-review。
5. 非綠 → 走 §verify 失敗處置。
## §Verify 套餐（按 tier）
| 項目 | T1 | T2 | T3 |
|---|---|---|---|
| 基本盤：動到的測試檔 + lint（T1 動到範圍、T2 起全 repo 改動範圍）+ type-check（如有） | ✓ | ✓ | ✓ |
| 周邊回歸（動到的 module + 依賴它的 module 的測試）+ build | | ✓ | ✓ |
| 整個 test suite；改動含 DB → migration dry-run + schema diff 對齊 | | | ✓ |
| browser e2e：**載入 `frontend-test` skill** 跑 Playwright MCP e2e（必跑）；觸發與例外見 §UI / browser e2e | | | ✓ |
## §verify 失敗處置
特別 case 先分流：lint warning 但功能對 → 走 §Auto-fix 不危險類自動修；test flaky 反覆 3+ 次仍 flaky → 標 flaky、列入 `state.flaky_tests` 給 review 階段看、不阻塞；type error 在改動範圍外 → 標 unrelated、不阻塞但提示 user。其餘走 rules.md §Fail handling：
1. 不靜默 retry；評起因（flaky / 環境 / 真 bug / verify command 寫錯）
2. `AskUserQuestion` 提：
   - **retry**（flaky / 暫態）
   - **adjust + retry**（AI 提具體 fix）
   - **rollback** 該 commit / 從前一個綠的 state 重來
   - **退回 execute-plan 改 task 實作**
   - **退回 write-plan 改 plan**（T3）／ **交棒 brainstorm §補施工清單入口**（T2）
   - **escalate**
   - **退回 execute-plan 補做**（漏網複查判為大改時）
   - **退回 brainstorm 重判**（設計判定從一開始就錯）
   - **接受現況並記入技術債**（這一輪先出去，方向另案處理）
3. 選後執行；`state.fail_history` append

## §UI / browser e2e

改動含 UI / 前端檔（.tsx / .jsx / .vue / .svelte / .html / .css / .scss）時觸發。**載入 `frontend-test` skill** 委派執行：

　**例外**：落在 skill 定義目錄底下的前端檔（`skills/*/assets/`、`skills/*/references/` 等）**不觸發** —— 那些是**工具範本、非可執行頁面**（例如只靠 `Object.assign(window,…)` 導出、沒有 HTML 宿主的元件片段），e2e 無從跑起。判準與 `design-language` §使用契約 第 1 步一致。

| Tier | 行為 |
|---|---|
| T1 | 預設不跑；user 明說再跑 |
| T2 | 可選；AI 視改動量自判（牽動 user flow 建議跑） |
| T3 | **必跑**（fail 不能放行 verify-done）；**文字節點豁免**見下 |

**文字節點豁免（T3 也適用）**：diff 裡的 HTML 行只動**文字節點**或 **`data-*` 屬性值**——`class / style / id / href` 等屬性集合與標籤結構不變、沒有 `.css / .scss` 進 diff——就不派 `frontend-e2e-runner` 重跑整套（整套驗的是互動，這種改動沒有互動可驗），改主 agent 做 smoke。判準與 rules.md §設計語言對齊 的文字節點豁免同構。**用下面這行判，不用感覺判**（把舊行與新行剝掉文字節點與 `data-*` 後的標籤骨架做集合比對；純文字行不計，所以段落重排斷行不影響；有 CSS 檔就直接 NOT）：

```bash
node -e 'const r=process.argv[1]||"main...HEAD";const d=require("child_process").execSync(`git diff -U0 ${r} -- "*.html" "*.css" "*.scss"`,{encoding:"utf8"});if(/^diff --git .*\.s?css\b/m.test(d)){console.log("NOT-TEXT-ONLY: css");process.exit(1)}const sig=l=>{const s=l.slice(1);if(!/[<>]/.test(s))return "";return s.replace(/\sdata-[\w-]+=(?:"[^"]*"|\x27[^\x27]*\x27)/g,"").replace(/>[^<]*</g,"><").replace(/^[^<]*</,"<").replace(/>[^<]*$/,">").trim()};const rm=[],ad=[];for(const l of d.split("\n")){if(/^-[^-]/.test(l)){const s=sig(l);if(s)rm.push(s)}else if(/^\+[^+]/.test(l)){const s=sig(l);if(s)ad.push(s)}}const ok=rm.sort().join("\n")===ad.sort().join("\n");console.log(ok?"TEXT-ONLY":"NOT-TEXT-ONLY: 標籤/屬性骨架有變");process.exit(ok?0:1)' "<base>...HEAD"
```

實測（2026-09-04）：PR #64（文字 + `data-upto`）與 #66（一句文案）TEXT-ONLY；PR #62（動 CSS）與 #61（新增 meta 標籤）NOT-TEXT-ONLY。exit 0 才豁免；輸出 NOT 或腳本本身出錯都照原規則派 runner（保守方向）。**注意**：這行含正則反斜線，從本檔複製、不要經會吃反斜線的工具轉貼。

**smoke 三步（主 agent 自己跑 Playwright MCP，不派 agent）**：
1. 起靜態伺服器（Playwright MCP 擋 `file://`）：`node -e 'require("http").createServer((q,s)=>{const f=require("path").join("docs",decodeURIComponent(q.url.split("?")[0]).replace(/\/$/,"/index.html"));require("fs").readFile(f,(e,b)=>{s.writeHead(e?404:200);s.end(e?"":b)})}).listen(8765)'`（背景跑；路徑依專案）→ `browser_navigate` 改到的頁
2. `browser_console_messages` 只看 error 級：必須零筆；有就是 FAIL，不豁免、退回派 runner
3. 改動處存在：改文字 → `browser_find` / snapshot 找得到新文字；改 `data-*` 且它驅動 JS（例 `data-upto` 控制節點鏈）→ 看**渲染結果**不是原始碼（例：snapshot 裡該段落的節點鏈長度對得上）

結果寫 `state.verify_results.e2e = smoke`（不是 `pass`——讓 request-review / PR body 看得出這輪沒跑整套），`state.frontend_test.ran = false`、`report_path` 寫 snapshot 或截圖路徑。

frontend-test 跑完（沒豁免時）寫回 `state.verify_results.e2e` + `state.frontend_test.*`、本 skill 整合進綜合驗證結果。

詳見 `frontend-test` skill §測試矩陣 / §測試流程 / §測試報告。
## §漏網複查

**要防的事**：Phase 0b′ 判 `design.involved=false`（或 `scope` 判錯），但這一輪**實際改動檔**含前端副檔名——判定漏了，而且沒有任何 gate 會發現。**全 tier 都跑**：這種漏網最常發生在「T1，兩個檔，順手改一下」，只在 T3 跑等於對最需要的情境無效。

**觸發條件**：

1. 取本 branch 的改動清單。`<base>` = `state.commits` 第一個 commit 的 parent；**`state.commits` 不存在**（verify-done 被單獨呼叫、或上游是 tdd-cycle）→ fallback `$(git merge-base origin/main HEAD)`；兩者都取不到 → **不觸發**，在結果標 `design_rejudge` 未執行與原因。
2. **副檔名與排除判準一律依 `design-language`**（§前端副檔名 ＋ §使用契約 第 1 步的 skill 定義目錄排除 ＋ §首次偵測 的 `node_modules` / `dist` / `build` / `vendor` / gitignore 命中 / `design-demos` 排除）。**不在本檔重列清單，也不得用裸 `skills/` 比對。**
3. **已被 `design_rejudge` 處理過的檔不重複觸發**——`execute-plan` 中途轉進處理過的，不必在這裡再來一次。
4. 剩下的清單非空，且 `state.design.involved` 為 `false`、或該檔不在 `state.design.scope` 對應的範圍內（`scope` 對不上）→ 觸發。

**動作**：

1. 載入 `design-language` 補判，取回 `design.*` 六欄，append 進 `state.design_rejudge`（`stage: verify-done`）。
2. **跑 `design-language §對齊檢查清單` 四項對齊檢查**，結果記進 verify 結果。
3. **補判結果是大改 → 標為 blocker**，走 §verify 失敗處置 的 design 專屬三選項。

**界線（硬規則）**：**不在 verify-done 補做三方向。** 這時 code 已經寫完，叫三方向重來等於推翻已經寫好的實作——成本與收益不成比例。verify-done 的職責是**把漏網這件事變成看得見的**，不是把它就地補完。
## §hand-off state
```yaml
state:
  verify_results:
    test: pass | fail
    lint: pass | fail | warn
    build: pass | fail
    type_check: pass | fail
    e2e: pass | fail | skipped | smoke   # smoke = 文字節點豁免、主 agent 三步 smoke 代替整套
  frontend_test:
    ran: <bool>
    report_dir: <path | null>
    report_path: <path | null>
    pass_count: <n>
    fail_count: <n>
    viewports_tested: [...]
    blocker: <bool>
  design_rejudge: [...]         # 結構同 execute-plan §hand-off state：stage: verify-done、task_id: null、action 無大改-user-gate；沒發生就是空 list
  flaky_tests: [...]
  current_phase: verify-done-done
```
## §結尾 Trace 標籤
```
[Trace] Phase=verify-done | Tier=<T1-T3> | Track=<Bug/Dev> | Skill=verify-done
```
## §Red Flags
| 想法 | 真相 |
|---|---|
| 「lint warning 算過」 | warning 跟 error 看實質；warning 也該處 |
| 「e2e 慢、跳過」 | T3 UI 改動 e2e 是 must（載 frontend-test）；T1 預設不跑、T2 可選 |
| 「只改了幾個字，感覺不用跑」 | 用 §UI / browser e2e 那行 `node -e` 判，TEXT-ONLY 才走 smoke；「感覺」不是豁免依據 |
| 「文字節點豁免也懶得 smoke」 | 豁免的是整套 runner，不是驗證；smoke 三步必做、`e2e=smoke` 必寫 |
| 「環境問題不算 verify fail」 | 仍要 escalate，user 環境壞 user 才能修 |
