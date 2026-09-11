# 對齊 review（spec / 規則書對齊 subagent）

> 標的：`git diff main...HEAD`（branch `feat/headless-mode`，12 個 commit）
> 依據：`docs/work/feat/headless-mode/{spec,plan,review}.md`、`skills/devwork/{rules,hosts}.md`、`skills/headless-mode/SKILL.md`
> 驗證：`node scripts/plugin-contract.mjs` ALL PASS、`--selftest` PASS、`build-references.ps1 -Check` exit 0、`docs/tools/docs-site-contract.mjs` ALL PASS

| 檢查項 | 結論 |
|---|---|
| 1 spec / plan 覆蓋 | plan v2 八個 task 全部落地、review.md 11 條必處理全部有落點；**spec.md 上半部沒跟上 v2**（Major 1） |
| 2 互動模式零改變 | 19 個 skill 逐行看過，每一處新增都帶「headless 時」前提，互動路徑語意不變。唯一例外是 `.gitignore`（Minor 5） |
| 3 規則打架 | rules.md 跨節例外條款有效，但 `design-direction` / `design-language` 沒接線且前者明寫反向禁令（Major 4） |
| 4 契約 P19 與 skill 內文 | 字樣七項與 `merge`+`永不` 全部對得上；parser 行為與 §讀回覆 有三處語意落差（Major 2、3，Minor 1、2） |
| 5 code 層 | CLI 判斷正確、import 不誤觸；`createdAt` 字串比較在兩端都來自 gh 時安全，`null` 時不安全（Critical 1、Major 3） |

---

## Critical

### C1. parser 取「最新一則留言」而不是「最新一則合格編號留言」，人答完後隨口再留一句就永久死鎖

- **位置**：`scripts/headless-reply.mjs:32-39`（`candidates.at(-1)` 之後才判第一行）
- **問題**：`candidates` 收的是 `askedAt` 之後所有受信留言，取最後一則再看它是否為編號。實測三則留言（提問 → `1` → 「順便問一下這個會影響 CI 嗎」）回傳 `{"status":"unparseable","commentId":3}`，編號 `1` 被跳過。`spec.md:121`（v1）原本寫的是「取標記之後、**最新一則第一行匹配** `^\s*(\d+)\s*$` 的留言」，v2 抽成純函式時語意被改掉了，`review.md` 沒有要求這個改動。
- **後果**：人在 issue 回了編號、又補了一句話（GitHub 上最自然的行為），下一輪走 `unparseable` 澄清一次，再下一輪 `reasked=true` 就一路 `waiting`。人以為答了、bot 以為沒答，任務永遠停住，而 `[bstack headless] waiting` 每兩小時印一次、看起來完全正常。
- **建議改法**：先過濾再取最新——

  ```js
  const answered = candidates.filter((c) => {
    const p = parseFirstLine(c.body);
    return p && p.option >= 0 && p.option <= optionCount;
  }).at(-1);
  ```

  有 `answered` 就回 `answered`；沒有才用 `candidates.at(-1)` 判 `unparseable` / `none`。契約 P19 補一個 fixture：`[mk(3,'1'), mk(4,'順便問…')]` 期望 `{status:'answered', option:1}`。

---

## Major

### M1. spec.md 的 §目標 / §範圍 / §影響檔案 仍是 v1，v2 差異摘要沒有涵蓋它們

- **位置**：`docs/work/feat/headless-mode/spec.md:12`、`:15`、`:25`、`:37-56`、`:53`、`:157`
- **問題**：`:68` 的 v2 差異摘要只宣告「**下面** v1 內容保留作歷史」，但 stale 的內容在它**上面**：
  - `:12` success criteria 寫「含新契約 P18」（實際是 P19；P18 早被 security-audit 佔用，正是 review.md K6）
  - `:15` 寫「下列 11 個 phase skill」並逐一列名（實際 19）
  - `:25` §範圍 寫「契約 P18（機械守：三處接線 + 11 個 skill + 新 skill 六節標題）」（實際九節）
  - `:37-56` §影響檔案表沒有 `scripts/headless-reply.mjs`、`.gitignore`、`docs/js/data.js`，也沒有後加的八個支線 skill（verify-done / security-audit / safety-guard / debug-systematic / request-review / incident-investigate / frontend-test / pr-explain）
  - `:53` 寫「加 P18；P3a 下限 28 不動」
  - `:157` 寫「契約 P18 不守這點」
- **後果**：spec 是 request-review 對齊自檢與 Phase 8 pr-explain 的比對基準。照現在的 spec 檢查 diff，會得出「契約編號做錯了、接線多做了 8 個」的假 finding；merge 後進 archive，後人讀到的成功標準是錯的。
- **建議改法**：`:12` P18→P19；`:15` 的 11 個清單換成 19 個（或直接指向 P19 的 `PHASE19` 陣列）；`:25` 同步為「契約 P19（三處接線 + 19 個 skill + 新 skill 九節 + parser fixture）」；`:37-56` 補四類檔；`:53` 改「加 P19；P18 為既有 security-audit 契約，只補檔頭索引」；`:157` P18→P19。

### M2. `reasked` / `reminded` 是整個 issue 全域，不分 `decision_id` 也不看 `askedAt`

- **位置**：`scripts/headless-reply.mjs:30-31`
- **問題**：兩個旗標掃的是 bot 在這個 issue 的**所有**留言，只比對 `<!-- bstack-reask` / `<!-- bstack-remind` 前綴。標記本身帶了 `decision_id`（`skills/headless-mode/SKILL.md:113-114`），parser 卻沒收到 `decision_id`、也沒用時間切。
- **後果**：一個 issue 走完九階段會問很多次（0a 歧義、review-plan critical、verify fail、rebase conflict…）。只要第一個提問曾經澄清過一次，之後**每一個**提問的 `unparseable` 都不再澄清；只要提醒過一次，之後每一個提問的 12 輪提醒都不再發。人看到自己格式錯的回覆被無聲忽略，而 journal 只印 `waiting`。
- **建議改法**：`parseReply` 的 options 增加 `decisionId`，兩個旗標改成

  ```js
  const mineAfter = mine.filter((c) => String(c.createdAt) > String(askedAt));
  const reasked = mineAfter.some((c) => String(c.body).includes(`<!-- bstack-reask: ${decisionId}`));
  const reminded = mineAfter.some((c) => String(c.body).includes(`<!-- bstack-remind: ${decisionId}`));
  ```

  `headless-mode` §讀回覆 第 1 步的餵入清單加 `decisionId`；§hand-off state 不用改（`decision_id` 已在 `pending_question` 裡）。

### M3. `asked_at` 為 `null` 時 parser 永遠回 `none`

- **位置**：`scripts/headless-reply.mjs:32`（`String(c.createdAt) > String(askedAt)`）、`skills/headless-mode/SKILL.md:104-105`
- **問題**：§問人格式 第 5 步先存 `asked_at: null` 的 snapshot，留言成功後才「覆寫同一個 snapshot 檔補齊三欄」。這兩步之間本輪若被 timeout / context 耗盡砍掉（協定自己承認會發生，`:131`），snapshot 就停在 `asked_at: null`。此時 `String(null)` = `"null"`，任何 `2026-…` 都小於 `"null"`（`'2'` < `'n'`），候選集恆為空。實測確認回 `{"status":"none"}`。
- **後果**：留言已經貼出去、人也回了，bot 每輪都判「沒人回」，`waiting` 到永遠；12 輪後那則提醒還會貼出去，人更困惑。
- **建議改法**：兩層防護。
  1. parser：`askedAt` 非字串時退回「只過濾 self / authorAssociation，不做時間切」。
  2. skill §讀回覆 第 1 步前加一句：「`pending_question.asked_at` 為空 → 先用 `gh` 找回本 issue 最後一則自己的 `<!-- bstack-ask: <decision_id>` 留言，取其 `createdAt` 補寫回 snapshot 再往下。」

### M4. `design-direction` / `design-language` 有 `AskUserQuestion` 卻沒接線，前者還留著反向禁令

- **位置**：`skills/design-direction/SKILL.md:29`（以及 `:17`、`:22` 的兩個 `AskUserQuestion`）、`skills/design-language/SKILL.md:83`、`:140`
- **問題**：P19 的 `PHASE19` 是 19 個 skill 的固定清單，這兩個不在內，檔內完全沒有 `headless` 字樣。
  - `design-direction:29`：「**禁止**：…自行選定後繼續執行（含 autonomous / 無人值守）…」——正是 review.md K3 要消滅的那種無條件句，而且它比 `headless-mode` 的「表外一律 B」更具體、位置更近，AI 走到這裡會挑它、然後靜默停機。
  - `design-language:83`：「**`AskUserQuestion` 給 user 確認或修正**（必經，不得自行定案）」，而 rules.md §設計語言對齊 規定動任何前端檔之前必載它，這是 execute-plan 的主線。
  - 另外 `design-direction` 會「並行 spawn 3 個 subagent」，該派工點也沒有 §子 agent 約束 的落點（只靠 hosts.md §派 subagent 的通則列兜）。
- **後果**：headless 只要 `brainstorm/0cd-design-size` 被人回「出三版」，或任何前端 task 走到 design-language 首次偵測 / remapped，那一輪就停在一個沒人回答的問題上。P19 全綠、契約不會紅——跟 review.md K4 描述的 verify-done / safety-guard 是同一個洞，只是漏掉了這兩個。
- **建議改法**：`PHASE19` 擴到 21，兩檔各加分流：
  - `design-language:83`、`:140` 尾加「headless 時 → B 類 `design-language/confirm-map`（`headless-mode`）」
  - `design-direction:29` 改寫成「…自行選定後繼續執行（含 autonomous）；headless 走 `headless-mode` B 類 `design-direction/pick`（留言後結束本輪），其餘無人值守情境停在這裡等」
  - §分流表 補這三列，§子 agent 約束 在 design-direction 的三 subagent 派工範本加佔位行

  若決定不擴，至少要在 spec §排除 明寫「headless 不支援設計 lane（`size=大改` 一律 blocked）」——現在兩邊都沒有。

### M5. `frontend-test/preview-url` 定為 `blocked` 而不是 B 類，前端 lane 在 headless 變成不留痕跡的死路

- **位置**：`skills/headless-mode/SKILL.md:71` 與 `:129`
- **問題**：`blocked` 的定義是「本輪無法前進且**不是在等人**」，結束前只寫 snapshot、**不留任何 issue 留言**。但 preview URL 恰恰是人一句話就能給的東西，和 `cmd-guard/L2-L3`（B 類留言）同性質；`safety-guard/secret` 不留言有明確理由（不能外洩原值），這一條沒有。
- **後果**：T3 UI 改動走到 verify-done → frontend-test，每一輪都 `blocked: no-preview-url`，issue 上永遠不會出現任何訊息。人只有去翻 autopilot 的 journal 才看得到，而 journal 是給 harness 看的。
- **建議改法**：`:71` 改成 B 類 `frontend-test/preview-url`，選項列「1. 給 preview URL（第二行寫 URL）2. 跳過 e2e、在 PR body 標未驗證」，`allowFree: true`；`:129` 的 `blocked` 列舉拿掉 `no-preview-url`。`snapshot-lost` 有類似性質（人不知道要做什麼），但那一條至少是「本地狀態壞了、人也救不了」，preview URL 不是。

---

## Minor

### m1. `allowFree` 分支回 `option: null` 與整則本文，跟 §讀回覆 的描述對不上

`scripts/headless-reply.mjs:38` 對上 `skills/headless-mode/SKILL.md:112`。實測 `allowFree: true` + 第一行是出界編號 `9`，回 `{"status":"answered","option":null,"freeText":"9\n其實我想這樣"}`。但 §讀回覆 第 2 步規定 `answered` 之後要回一則「已讀到選項 `<n>`：<選項文字>」——`n` 是 null、選項文字不存在；而且 skill 說 freeText 是「第二行起的文字」，這裡是整則含第一行。後果：`brainstorm/0a-ambiguous`（唯一 `allowFree: true` 的決策點）每次都會產出一則語意破碎的確認留言。建議 §讀回覆 第 2 步拆兩句：「`option` 非 null → 回『已讀到選項 n』；`option` 為 null（allowFree）→ 回『已讀到你的說明，繼續 <phase>』」，並註明 allowFree 時 `freeText` 是整則。

### m2. `option: 0` 但沒有第二行時 `freeText` 是空字串，skill 未定義

實測回 `{"status":"answered","option":0,"freeText":""}`。§分流表 `:112` 說「`option: 0` → 第二行起的文字當 user 指示」，沒說空的時候怎麼辦；空字串是 falsy，很容易被當成「沒有指示」而靜默採推薦——那就違反了 §使用契約 的「禁靜默猜 B 類答案」。建議 parser 在 `option === 0 && rest === ''` 時回 `status: 'unparseable'`，或 skill 明寫「0 但無內容 → 視同 `unparseable`，走澄清」。

### m3. `dev-workflow` §Fail handling 的 headless 行寫死 `execute-plan/fail`

`skills/dev-workflow/SKILL.md:169`。這一節是 task / verify / review 三種 fail 的共用出口，verify 另有 `verify-done/fail`、security 另有 `security-audit/critical`。寫死一個 id 會讓 `auto_decisions` / `pending_question` 的 `decision_id` 記錯來源，`resume_hint` 接續時也會接到錯的 phase。建議改成「headless 時 → B 類（依來源取 `execute-plan/fail` 或 `verify-done/fail`）」。

### m4. `docs/index.html:660` 的「35 份」沒跟著 29 改

下一行已改成「29 skill + 6 agent + rules.md」，29+6+1 = 36，註解自相矛盾。review.md Eng M6 點名的是 `:660`，改了數字沒改總數。建議改 36。

### m5. `.gitignore` 新增 `docs/snapshots/` 讓 context-snapshot 的 commit 分支變成不可執行

`.gitignore:21-23` 對上 `skills/context-snapshot/SKILL.md:117-119`。skill 仍寫「user 要跨機器 / 跨 session 用 → `AskUserQuestion` 問是否 commit → 確認 sensitive content 已被 safety-guard 篩過才 commit」，但被 ignore 的檔 `git add` 會直接報錯（rules.md §Docs 落檔 自己也寫了「docs 被 `.gitignore` 排除的專案就不 commit，別硬 `git add`」）。**這是本次唯一一處互動模式行為被動到的地方。** 建議該分支補一句「本 repo 已 ignore `docs/snapshots/`，要 commit 需 `git add -f`」。

### m6. headless snapshot 檔名規則只寫在 §存哪裡，使用契約第 3 步沒帶

`skills/context-snapshot/SKILL.md:23` 仍是 `docs/snapshots/<topic-slug>-<ISO-ts>.md`，headless 的 `issue-<n>-` 前綴與「覆寫同一檔而非新開」在 `:111`。使用契約是「載入後立即動作」的清單，AI 照第 3 步寫檔就會少掉前綴，而 `headless-mode` §偵測 靠前綴定位，找不到就 `snapshot-lost` blocked。建議第 3 步尾加「headless 時檔名見 §存哪裡」。

### m7. rules.md 跨節例外條款列的是封閉字樣清單，漏掉 §File-type 硬規則 的「二次確認」

`skills/devwork/rules.md:38`。條款說「本檔各節寫的『必經 `AskUserQuestion`』『一律等 user 選』『危險類必問』一律改讀 §分流表」，但 §File-type 硬規則 表裡 ignore 檔 / 鎖檔 / Shell config 三列的處置是「二次確認」，三個字樣都不命中。實務上靠「表外一律 B」兜得住，但兩條規則要接力兩次才成立。建議把列舉改成「本檔各節任何要 user 決定的句子（含『二次確認』）」。

### m8. `devwork` 1.5「兩支都先寫 `state.headless: true`」與 `headless-mode` 使用契約第 2 步衝突

`skills/devwork/SKILL.md:14` 對上 `skills/headless-mode/SKILL.md:16-17`。1.5 命令「載 `headless-mode` 跑 §偵測，**兩支都先寫** `state.headless: true` / `source_issue`」，但 §偵測 第 3、4 條不中時結論是 `blocked`、第 1 或 2 條不中時結論是「不是 headless」，此時 `headless: true` 是錯的。K7 的原意是「resume 支與非 resume 支都要寫」，不是「不論偵測結果都寫 true」。建議改「**兩支都先寫** `state.headless` / `source_issue`（值由 §偵測 決定）」。

---

## Nit

1. **`skills/devwork/SKILL.md:14` 的 `1.5` 行首會被 markdown 誤解**：`1.5 **headless 入口**：…` 在 CommonMark 會被當成新的 `1.` 清單項、內容是「5 **headless 入口**」，並把原本 1→2 的清單截斷成兩段。docs 站的 references 頁渲染這份 markdown。改成 `1b.` 或縮排成第 1 點的子項即可。
2. **`skills/incident-investigate/SKILL.md:101` 的佔位行拆散成對的兩行**：插在 `**Expected if true**` 與 `**Expected if false**` 之間。挪到 `**Repo**` 那一段之後比較自然。
3. **節名字面對不上**：`skills/headless-mode/SKILL.md:133` 寫「做 finish-branch §Merge 後 docs 歸檔」，實際節名是 `## §Merge 後：docs 歸檔`（`skills/finish-branch/SKILL.md:150`），差一個全形冒號。節名比對是 P16 / P19 那類契約的慣用手法，字面對齊比較保險。
4. **模板對人的承諾與實際留言數不符**：`skills/headless-mode/SKILL.md:94` 告訴人「沒看到合格回覆就靜靜等，一天後提醒一次，不會再多留言」，但實際還可能收到 `<!-- bstack-reask -->` 澄清、`<!-- bstack-remind -->` 提醒、以及讀到回覆後的確認留言，共三種。改成「除了一次格式澄清與一天後的一次提醒，不會再多留言」。
5. **`skills/dispatch-parallel/SKILL.md:16` 第 4 步仍寫「依 user 選擇分流」**，且三個分支含 Agent Teams。headless 走 A 類自選、且明定不開隊友；第 3 步雖然講了，第 4 步讀起來像還有個 user。改「依選定的跑法分流（headless 時依第 3 步的 A 類結果，不走 Agent Teams 分支）」。
6. **parser 的兩個 `export` 沒有測試涵蓋**：P19 的 8 個 fixture 全部走 `spawnSync` CLI，`parseFirstLine` / `parseReply` 從沒被 import 過。純函式抽出來的理由就是可被 import，建議加一個 fixture 走 import 路徑，順便釘住「被 import 時不觸發 CLI」這個行為。
7. **`FIRST` regex（`scripts/headless-reply.mjs:13`）收 `#＃` 與 `.)、。`，但不收 `（1）`、`1．`、`1,`**。全形括號在繁中 issue 回覆裡不罕見，加進字元類的成本是一個字元。
8. **檢查 5 的兩項實測確認，供後續施工參考**：
   - `process.argv[1]` 在 `node scripts/headless-reply.mjs`（相對路徑）下由 Node 解析成絕對路徑，Windows 上是 `D:\GitHub\bstack\scripts\headless-reply.mjs`，經 `.replace(/\\/g,'/')` 後尾端比對成立，實測 CLI 正常吐 JSON；絕對路徑呼叫同理。被 `import` 時 `argv[1]` 是匯入方的入口檔路徑，不會誤觸 CLI 分支。判斷寫法**沒有問題**。
   - `createdAt` 字串比較在兩端都取自 `gh`（同為 RFC 3339 `…Z`、無毫秒）時**安全**。不安全的兩種情況是 `askedAt` 為 `null`（M3）與任何一端改用 `new Date().toISOString()`（帶毫秒的 `.` U+002E 排在 `Z` U+005A 之前，會把同秒的留言判成更早）。建議在 §hand-off state 的 `asked_at` 欄註明「只能是 gh 回傳的 `createdAt` 原值，禁用本地時鐘」。
   - `candidates.at(-1)` 用的是 `Array.prototype.at`（Node 16.6+），node ≥ 20 的前提下安全；全形數字由 `norm()` 轉成 ASCII 後才進 `\d`，`\s` 也涵蓋 U+3000 全形空白，全形處理正確。
