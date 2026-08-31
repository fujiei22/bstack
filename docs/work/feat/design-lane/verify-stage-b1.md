# 階段 B1 驗收記錄

> 對應 plan：`docs/work/feat/design-lane/plan-b1.md`（v2.1）
> 對應 review：`docs/work/feat/design-lane/review-b1.md`（四視角）＋ 兩輪複驗
> 日期：2026-08-31
> 驗收對象：`skills/design-direction/`（新建 9 檔）＋ `design-language` / `verify-done` 各一處排除

**涵蓋範圍**：S5（三方向與豁免選單，skill 本體）、S6（識別字串清乾淨）、D28（排除 `skills/**`）、D31（`verify-done` e2e 排除）、V10 回歸。
**不涵蓋**：S4 中途轉進、S8 端到端（B2）、S7 孤兒偵測（C）。

---

## 一句話結論

**8 個 task 全序列跑完、全綠、逐 task commit。** 全域同步後 **27 skill / 2 hook / 6 agent**，`design-direction` 的 9 個檔在多層子目錄下**完整落地且逐檔與 repo 一致**——這證實了 plan §Architecture 那條「`setup.ps1` 的 `Substring` 在多層子目錄下計算正確、不必改 `setup.ps1`」的推斷，**現在是實測，不再是靜態讀碼**。

---

## 產出清單與量體

| 檔 | 行數 | 上游來源（sha256 前 16 碼 · 原行數） |
|---|---|---|
| `SKILL.md` | 345 | `6cdcaef51dda726a` · 579 行（大幅改寫，非搬移） |
| `references/content-guidelines.md` | 260 | `3c0bcf0e94b4f6cc` · 260 |
| `references/typography.md` | 263 | `5fbf83b9a916a986` · 260 |
| `references/react-setup.md` | 245 | `97dfcbbea673131b` · 280 |
| `references/design-styles.md` | 213 | `f62aaa191b2feece` · 564 |
| `references/critique-guide.md` | 215 | `3636ed8422bb88a1` · 221 |
| `references/brand-asset-protocol.md` | 213 | `bc476983114f0005` · 250 |
| `assets/design_canvas.jsx` | 213 | `5376c8ebdc59ec8b` · 205 |
| `scripts/fetch_images.py` | 108 | `6bb273e785513c96` · 94 |

**為什麼要記 sha256**：`huashu-design/` 被 `.gitignore` 排除、不進版控。merge 之後無法重跑 diff，這張表是這批內容**唯一的來源追溯憑據**（review M6）。上游包若更新，用 sha256 就能判斷手上這份是不是當時搬的那份。

---

## 逐 task 結果

| Task | 內容 | Step 2 紅燈 | Step 4 綠燈 | commit |
|---|---|---|---|---|
| 1 | `design-language` 排除 skill 定義目錄 | 5 條 MISS | PASS | `3f48b40` |
| 2 | `verify-done` e2e 排除 | 2 條 MISS | PASS | `aaec7e9` |
| 3 | `design-direction` 定位／契約／邊界／品味 | 11 條 MISS | PASS | `d442c84` |
| 4 | 三方向流程／選定落檔／6 維評審 | 12 條 MISS | PASS | `62ca0e2` |
| 5 | 3 個以繁化為主的 reference | 3 檔不存在 | PASS | `eb64e49` |
| 6 | 3 個需結構性修改的 reference | 3 檔不存在 | PASS | `67aaa65` |
| 7 | 2 個資產 | 2 檔不存在 ＋ UA ＋ proxy | PASS | `6b99647` |
| 8 | 驗收 | 記錄未落檔 | 本檔 | 本次 commit |

---

## 3a · 全 repo 掃描（五條，全部零命中）

| 檢查 | 範圍 | 結果 |
|---|---|---|
| 識別字串（`花叔` / `alchaincyf` / `design-philosophy` / `huashu` / `huasheng` / `nano-banana` / `yt-dlp` / `showcases` / `feedback_gemini` / `last-update-check`） | `skills/` 全樹 | 0 |
| 簡體字集 | `skills/` 全樹 | 0 |
| 大陸用語（`字体` / `数据` / `默认` / `用户` / `组件` / `布局` / `信息` / `软件` / `屏幕` / `质量` / `项目`） | `skills/` 全樹 | 0 |
| `🔴` | `skills/` 全樹 | 0 |
| `⚠️` | `skills/` 全樹 | 0 |

**符號那兩條不是形式主義**：`critique-guide` 的上游輸出樣板用 `⚠️致命 / ⚡重要 / 💡優化` 標嚴重度，`fetch_images.py` 的輸出也帶 `⚠️` 與 `❌`。照搬會讓 `skills/` 從 0 個 `⚠️` 變成有——那會讓「看到 `⚠️` 代表這裡有特別的事」這個訊號在 27 個 skill 裡失效。已改為純文字標籤（`致命 / 重要 / 優化`）。

---

## 3b · 死鏈全掃（bare 檔名 regex）

掃 `skills/design-direction/` 全樹，逐一確認：

| 命中 | 判定 |
|---|---|
| `design-styles.md`、`typography.md` | ✅ 同目錄實檔 |
| `components.jsx`、`pages.jsx`、`app.jsx`、`router.jsx`、`primitives.jsx`、`settings.jsx`、`home.jsx`、`detail.jsx`、`terminal.jsx`、`sidebar.jsx` | ✅ `react-setup.md` 裡的**教學範例檔名**，本來就不該存在 |
| `SKILL.md` | ✅ **非死鏈**：指 `skills/design-direction/SKILL.md`，實檔存在 |
| `CLAUDE.md` | ✅ **非死鏈**：指 repo root ／ `~/.claude/CLAUDE.md`，兩處都存在 |
| `spec.md` | ✅ **非死鏈**：指 `docs/work/<branch-name>/spec.md`，是 D14 指定的 runtime 落檔位置 |

**掃描器的侷限要寫下來**：Task 5 的死鏈迴圈只在 skill 目錄底下 `test -e`，所以 `SKILL.md` / `CLAUDE.md` / `spec.md` 這三個**指向 skill 目錄外的合法引用**會被它報成死鏈。**這三筆是誤報，不是漏網**——已逐筆人工確認目標存在。B2 若要保留這條檢查，白名單要補這三個。

---

## 3c · 多檔 skill 同步（本階段最關鍵的實測）

跑 `pwsh -NoProfile -File scripts/setup.ps1 -Yes`（依 CLAUDE.md §Auto-fix 危險類，已取得同意再跑）。

| 檢查 | 結果 |
|---|---|
| `~/.claude/skills/design-direction/` 檔數 | **9**（`SKILL.md` ＋ `references/` 6 ＋ `assets/` 1 ＋ `scripts/` 1） |
| 子目錄層級是否保留 | ✅ `references/` / `assets/` / `scripts/` 三層都在，未被壓平 |
| 逐檔 `diff` repo vs 全域 | ✅ **9 檔全部一致** |
| 是否需要改 `setup.ps1` | ❌ 不需要 —— 推斷經實測確認 |

---

## 3d · V10 回歸

| 項 | 全域 | repo | 判定 |
|---|---|---|---|
| skill 數 | **27** | **27** | ✅ 從 26 增為 27，增量正是 `design-direction` |
| hook 數 | 2 | 2 | ✅ 維持兩支（D26 廢除的 `design-gate.ps1` 未死灰復燃） |
| agent 數 | 6 | 6 | ✅ |
| 孤兒（全域有、repo 無） | 無 | —— | ✅ |
| `permissions.allow` | 24 條 | —— | ✅ 本機保留 |
| `env` / `statusLine` / `hooks` | 全在（7 個 top-level key） | —— | ✅ merge 未吃掉本機設定 |
| `CLAUDE.md` repo vs 全域 | `diff -q` 一致 | —— | ✅ |

---

## 3e · 排除生效

`skills/design-direction/assets/design_canvas.jsx` 是 `.jsx`，**副檔名確實命中 §前端副檔名**——所以這是一個真的會被誤判的檔，不是假想案例。

| Gate | 排除句處數 | 判定 |
|---|---|---|
| `design-language` §使用契約 第 1 步 | 1 | 先剔除 → `involved=false`，不進副檔名比對 |
| `verify-done`（T3 套餐 ＋ §UI/browser e2e） | 2 | e2e 不觸發 |

**反向驗證**：`docs/css/styles.css` 不在 `skills/` 底下 → 不被剔除，仍正常進判定。排除的是 skill 定義目錄，不是把整條規則關掉。

**`verify-done` 的 T3 必跑規則本身未被動到**——該條的 `grep` 斷言是 regression guard，全程綠。本 task 只加排除範圍，沒鬆綁 gate。

---

## 相對 plan 的偏離（照實記）

| 項 | plan 目標 | 實際 | 說明 |
|---|---|---|---|
| `SKILL.md` 行數 | ≤260 | **345** | plan §Architecture 訂 ≤260，但 plan 的 Task 3／4 逐字給的內容本身就是 345 行——**是 plan 自己的目標與內容互相矛盾**，不是執行時擴寫。無斷言把關此數字。內容未刪減，照 plan 給的原文落地 |
| `typography.md` | ~250 | 263 | 為滿足「補繁體選項並標明 SC/TC」，字型地圖多了一欄「字集」＋ 4 款 TC 字型與一段取用告誡 |
| `critique-guide.md` | ~180 | 215 | 為滿足「維度 1 改寫成 `precedent` 兩路判準」，多了一張路徑對照表與兩路的評審要點 |
| `brand-asset-protocol.md` | ~200 | 213 | D14 改寫（資產清單改寫進 `spec.md`）需要交代「為什麼不開獨立檔」，比原文長 |
| `design_canvas.jsx` 字型堆疊 | plan 只要求 docstring 繁化 | 另把 `PingFang SC` 改成 `PingFang TC, PingFang SC` | **超出 plan 一個 token**。理由：容器是繁中工具鏈的一部分，留 SC 版直接違反本階段剛寫進 `typography.md` 的 §反模式「繁體內容用 SC 版字型」。fallback 保留 SC，不會在只有 SC 字型的機器上退化 |

`design-styles.md` 213 行、`content-guidelines.md` 260 行、`react-setup.md` 245 行，均命中目標。

---

## 三個檔的結構性改寫，實際做了什麼

**`design-styles.md`（564 → 213）**
- 砍：PPT 20 種、資訊圖 20 種、AI 生圖專用風格、生圖提示詞心法（合計 353 行，全部屬 `design-direction` §適用邊界 明列的「不適用」產線）
- 留：怎麼用、色彩推導協議、網頁 20 種、審美禁區
- **修保留區對被砍段落的依賴（三處）**：① 開頭的「三選一分區判據」改寫成「本庫只涵蓋網頁」② 方向 A/B/C 的分派邏輯原本引用上游 SKILL 的隨機選風格機制，改成「依 §可變維度 指派」③ 審美禁區的「合法暗色」白名單原本舉三例，其中兩例在被砍的 PPT 區，只留下網頁區的「暗色發光 ＋ Bento」
- 檔尾「適用」行同步改寫，不再宣稱涵蓋 PPT／PDF／資訊圖／封面

**`critique-guide.md`（221 → 215）**
- **補回權重最高的維度 0「概念／立意」與它的一票否決規則**（概念 ≤5 分 → 總評封頂 6.0）。plan v1 誤寫 5 維，漏掉的正是這一維
- **維度 1「哲學一致性」整段改寫**：上游五段評分標準全繞著「有沒有用某位設計師／機構的標誌性手法」寫，而本 skill 只有 `precedent=false` 走風格庫時才有流派錨點。改成兩路判準——`false` 對照風格庫條目、`true` 對照該區設計語言的 token 體系。**不改的話 SKILL.md 說一套、reference 說另一套**
- 砍 §場景評審側重 裡屬排除產線的五列，改成四列網頁向場景
- 砍 §常見設計問題 第 10 條（整條是 PPT／封面／資訊圖／PDF 的密度建議），Top 10 → Top 9
- 兩處死鏈改寫：「Phase 7 的詳細參考」→ `design-direction` §評審；「呼應 SKILL.md 的 form 推導」→ §核心哲學 1

**`brand-asset-protocol.md`（250 → 213）**
- **D14 衝突已解**：Step 5 從「固化為 `brand-spec.md` 檔案」改成「把資產清單寫進 `spec.md` 的『設計方向』段落」，並交代理由（資產檔本身落在不進版控的 `design-demos/assets/`，能留下的只有 `spec.md` 裡的來源記錄；再開一個獨立檔只是多一份同樣會消失的東西）。原本「所有 HTML 必須引用 `brand-spec.md`」同步改成「引用清單裡的實際資產檔」——**實質紀律保留，載體換掉**
- 拿掉 `nano-banana-pro`（3 處）與 `yt-dlp` ＋ `ffmpeg`（1 處）。**`ffmpeg` / `ffprobe` 本機實測不存在**，留著等於寫一條必然失敗的路徑
- 5 處作者原話改中性敘述，案例事實與教訓全留（憑記憶猜色、示範品牌汙染、只抽色值不取資產、抽完色沒記下來、並列多產品卻沒取 logo）
- 檔頭兩處死鏈（「從 SKILL.md 核心哲學 #1.a 下沉」「回 SKILL.md 看精簡版」）改寫——新 SKILL.md 沒有 `#1.a` 這個編號
- Step 4 的 UI 截圖驗證補上 **PII 遮蔽**要求（截圖裡的姓名／email／帳號），對齊 CLAUDE.md §PII 安全底線

---

## 已知限制（明知，不在本階段修）

| 項 | 說明 |
|---|---|
| **`fetch_images.py` 無 rate limit 處理** | 無 retry、無 backoff、無 429 判讀、無請求間隔。`--query` 給 N 個關鍵字 × `--count` 張 ＝ N + N×count 次連發請求。已寫進該檔 docstring |
| **`design-direction` 尚未接上流程** | `brainstorm` 不會呼叫它，只有 user 顯式呼叫才載入。這是 D27 拆兩輪的預期中間態，已寫進 skill 的 `description` 與 §與 dev-workflow 銜接 |
| **K6 的兩個接收端還沒建** | `direction_decided` / `user_choice_quote` 兩個輸出欄已定義，但 `brainstorm` 的 spec 範本「設計方向」段落只有 4 個判定欄、`dev-workflow` 的 `design:` 也只有六欄。B1 期間顯式呼叫本 skill 時，第 7 步「回寫 `spec.md`」要自行補欄。屬 B2 |
| **三方向流程本身未實跑過** | 本階段只建 skill 本體。`npx playwright screenshot` 的引號問題已實測（未加引號回 `Invalid viewport size format`），但完整的「spawn 3 個 subagent → 截圖 → 選定」端到端沒跑過 |
| **`.sass` 是否納入 §前端副檔名** | spec §待釐清 5，未決 |

---

## D23 授權立場（必須明寫）

本階段搬入的 6 個 reference ＋ 2 個資產，是**大量的具體表達**——1,730 行改寫後內容，比階段 A 更接近 MIT 授權所稱的「實質部分」。

**user 已於 D23 知情並選擇不放版權聲明。**

- 本節記錄的是**事實與 user 的決定**，不是法律意見
- **3a 的零命中只證明「上游識別字串已清除」，不代表授權合規**——這兩件事無關
- 若日後要改為合規，作法是把 `huashu-design/LICENSE` 的 MIT 聲明加進 `skills/design-direction/`（例如檔頭或一份 `NOTICE`），內容不必動

---

## 這一階真正的產出

不是 1,730 行文字，是**把一個「給簡體使用者、涵蓋 6 條產線、綁定上游作者權威」的包，拆成一個「繁中、只做網頁、判準全部可機械判斷、與 bstack 既有守則對得上」的 skill**。

三個最能說明差別的地方：

1. `critique-guide` 維度 1 若照搬，SKILL.md 講的判準和 reference 講的判準會**互相矛盾**——這種矛盾不會報錯，只會讓每次評審結果飄移
2. `brand-asset-protocol` 若照搬，會要求產生一份 `brand-spec.md` 獨立檔，而它落在不進版控的目錄裡——**規則本身會製造孤兒**
3. `design_canvas.jsx` 是一個 `.jsx`，副檔名確實命中前端判定。Task 1／2 的排除若不先做，它一進 repo 就會同時觸發設計 lane 與 T3 e2e 必跑 gate——**而它沒有 HTML 宿主，e2e 永遠跑不起來**
