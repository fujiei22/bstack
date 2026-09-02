# Plan review 總結（四視角）

> Plan: `docs/work/feat/zh-humanize-skill/plan.md`（v1，commit `68f34c7`）
> Spec: `docs/work/feat/zh-humanize-skill/spec.md`
> Tier: T3 → CEO / 介面 / 斷言一致性 / 維護者 四視角
> 日期: 2026-09-02

**四個視角的提問全部改寫過**：`review-plan` §視角 prompt 模板 是寫給 code 的（API shape、O(N²)、dependency 版本鎖、stack trace、log 點、CLI 預設值）。本次標的是一份**給 AI 讀的 markdown prompt**，那些問題套上去只會產生噪音，一條都沒用。

**user 決定（2026-09-02）**：① 全 vendor，plan 寫 v2 ② repo root 放 `NOTICE`。

---

## 這次 fan-out 到底有沒有用

**有，而且四個視角互相蓋到對方的責任區。**

主 session 在收到「斷言一致性」那份之前，已自行掃出 5 條壞斷言（未告知該 reviewer，以保留獨立性）。它**五條全中**，且每條都比主 session 的版本更精確：

| 主 session 的認定 | 該 reviewer 實測後的修正 |
|---|---|
| run-eval 的反向斷言「鎖錯字串」 | 「非互動環境」**根本不在 `run-eval.md` 全文 75 行裡**，那段在 `SKILL.md` —— Step 3 的刪除指示指錯檔案 |
| scenes 反向斷言「鎖太少」 | 實際造出「補回上游兩節仍全綠」的反證 |

而且**兩條斷言問題是「介面」視角抓到的、三條是「維護者」抓到的**——那本來都該是「斷言一致性」的守備範圍。單一視角會漏，這件事這次有實據。

**主 session 自己的機械掃描只覆蓋四種病裡的兩種**：抓得到「pattern 在原文不存在」與「backtick 未跳脫」，抓不到「鎖到恆綠的東西」「guard 太寬導致恆真」「反向斷言鎖錯字串」——後三種需要造出內容再跑，而那正是主 session 略過的一步。

---

## 主 session 逐條實測後**不採納**的

**不是所有 reviewer 結論都成立。** 下列經實查後推翻或降級：

| 原判 | 實測 | 處置 |
|---|---|---|
| 介面 M5：拔掉 `user-invocable` 等於拔掉 slash command | `grep -rl "user-invocable" skills/` → **0**。bstack 27 個 skill 從沒用過這個欄位 | **不採納**，前提不成立 |
| 介面 n2：`head -20` 抓不完 frontmatter | bstack 最長的 frontmatter 是 `design-direction` 12 行；斷言 reviewer 另實測上游 `license:` 落在第 20 行、要 18 行 description 才逃得掉 | **降 Nit**，改 awk 取整段是乾淨寫法而非修 bug |
| 介面 m1：Task 4/5 反向斷言會誤殺自己的 Step 3 | 實查「電子報」「銷售頁」各 2 次命中，**都是 Task 4:219 與 Task 5:275 兩條斷言行本身**，plan 內無自撞 | **降為風險提示**，非缺陷 |

---

## Critical（全部進 plan v2）

### K1 · 出貨的 skill 會帶兩張互相矛盾的情境表，八個 task 全綠
上游的**權威力度表在 `SKILL.md:90-98`**，不在 `references/scenes.md`。plan v1 的 Task 6 四處改寫不含它，Task 6 的反向斷言也抓不到情境詞。結果：`SKILL.md` 判「電子報／銷售頁／客服」、`scenes.md` 判「README／release notes」，而 `SKILL.md` 在更上層先被讀到。`spec.md` 要求場景層整片換掉，v1 只換了 references。

### K2 · 存在「全綠但保留禁止行為」的執行路徑（已實測重現）
只刪掉含「非互動」字眼的句子、保留兩個模式 bullet（這是「刪掉非互動段落」最自然的字面執行方式）→ 同一份 `SKILL.md` 一處寫「沒有人回答就停著」、另一處寫「沒有人回答就全部套用」，Task 6 八組斷言**全數通過**。

### K3 · Task 1 對「什麼都沒做」給 PASS（主 session 已獨立重現）
把上游三個 reference 檔**原封不動**放進目標路徑、去識別一步不做 → Task 1 完整斷言 **PASS**。三條 pattern 全是「檔案存在＋位元組下限」，而下限（24000/5500/4500）對上游（28393/6738/5408）過寬。Task 1 的綠燈證明不了 Step 3 的任何一項工作。

### K4 · 「承諾條款」永遠紅 ＋ 漏掉整整一類保護對象
上游是 `## 五類保護對象`，第 5 類標題是**「承諾類文字」**（全檔無「承諾條款」四字）。plan v1 斷言 grep「承諾條款」→ 照搬必紅，實作者只能偷改上游用詞讓它變綠。同時 v1 寫「照搬上游四類」，**漏掉第 4 類「真實姓名與引號內原話」**——那類同時是 `CLAUDE.md §PII 安全底線` 的交界。

### K5 · `編號是內容不是 gate 信號` 永遠紅
原文是 `編號是**內容**不是 gate 信號`，粗體星號卡在字串中間，`grep -qF` 必然落空。**這是 plan 自己第一條紀律列的病，而主 session 在 Self-review 表對這一項打了「✅ 逐條對過」。** 打勾的動作變成了驗證的替代品。

### K6 · 上游 description 的「不要觸發」段會整段掉
上游 frontmatter 明列不觸發「程式碼／log／設定檔」。plan v1 寫「削成 bstack 三段式（觸發／涵蓋／使用）」——三段式沒有這一段的位置，斷言也沒鎖它。後果具體：bstack 主體是 27 份 `SKILL.md`，全是給 AI 讀的 prompt；它會照 `patterns.md` 砍掉「必」「禁」「一律」，而 `write-skill` 明文**要求**用這些字。

### K7 · spec 把後門引用成解法
`spec.md` 衝突 2 的處置寫「由呼叫端在 prompt 裡明講授權跳過（**上游本來就有這個例外條款**）」。但上游那條例外的判定方式**就是拿自由文字當 gate 信號**——與衝突 1 被禁的是同一件事、寫在同一份檔裡。前門上鎖、後門大開。

### K8 · 第三方授權層：`patterns.md` 之上還有一層歸屬
上游 `references/patterns.md:3` 逐字：

> 主要整理自[中文維基百科「AI生成文的特徵」](…)（WikiProject AI Cleanup 社群持續更新）、朱宥勳「AI腔」句型分析，以及英文維基「Signs of AI writing」的社群觀察

維基文本是 **CC BY-SA**（share-alike）。而 `spec.md` 的落選表把 `gwagjiug/technical-writing` 以「CC BY-NC-SA、**會傳染授權**、直接排除」處理掉——**同一個判準沒有對選中的那份跑過**。且 plan v1 的「移除任何 author／人名指涉」會把「朱宥勳」與維基歸屬一起清掉，那不是上游識別字串。

**處置**：user 已決定 root 放 `NOTICE`，該檔須同時交代 MIT 上游與這一層 CC BY-SA 歸屬；plan v2 須把「上游身分字串」與「第三方歸屬」分成兩類指示。

### K9 · 沒有 pin commit SHA，上游更新從第一天就追不了
plan v1 用 `gh api …/contents/<檔>` 解析 default branch **當下**狀態。上游 `master` 最後更新就是今天，Task 1 與 Task 3 隔幾小時跑就可能拿到不同內容，而 plan 裡沒有任何地方會發現。

維護者視角的關鍵論證：半年後要的是 `diff(上游@我們搬的那版, 上游@新版)`，**兩端都在上游**，本地有沒有 pristine 副本無所謂，**只要知道搬的是哪個 commit**。而落一份逐字 pristine 副本反而與「全面去識別」的立場衝突（那是帶 `author:` 的原件），故不落副本、只 pin SHA ＋ 存 sha256 表。

### K10 · README 不在 scope，`27` 三處會同時變錯
`README.md:21` `## Skills（27）` 三張表是 clone 下來的人唯一的目錄，不在表上等於沒交付。`docs/index.html:8`（meta description）與 `:46`（hero）另硬寫「27 個 skill」。plan Task 8 還特地斷言全域要變 28。

**附帶的反諷**：V7 指定的實跑素材正是那段 hero，而保護清單第一類就是「數字逐字保留」——skill 會忠實保護一個已經錯掉的數字，且 V7 會判它通過。

### K11 · 動機與觸發機制對不起來
`spec.md` 把動機寫成「文案讀起來怪，**而流程裡沒有任何一關會攔下它**」——缺口性質是「沒有 gate」。但 plan Task 7 的觸發表那列明文「**不自動觸發**」。用「使用者要自己記得叫它」補「沒有 gate」，八個 task 全綠缺口原封不動。

既有先例：`design-language` 是 0b′ **必跑**、`frontend-test` 是 verify-done 偵測。`zh-humanize` 會是唯一純手動的。

**處置**：採「**載入 ≠ 改寫**」——可被載入去分析、列清單，但沒有 `AskUserQuestion` 的明確選擇就不動任何一個字。這樣 V3（description ↔ 觸發表措辭互相 grep）與「不自動改寫」同時成立。

---

## Major（進 plan v2）

| # | 問題 | 來源 |
|---|---|---|
| J1 | `parallel-group: 1` 三個 task 不是真的互不相干——Task 1 的 `grep -r` 掃的是 Task 2 正在寫的目錄；三個各自 `git commit` 會撞 `.git/index.lock`。plan 自己已寫「串行跑完就好」卻仍標同組 | 斷言 |
| J2 | 全程沒載入 `write-skill`。實跑全綠版：`使用契約`=0、`[Trace]`=0、`Red Flags`=0、`hand-off`=0，而 repo 現況 25/27 有使用契約 | 斷言 |
| J3 | 6/8 去識別斷言是空砲——識別字串在上游只存在於 `SKILL.md`(4)、`benchmark.md`(1)、`run-eval.md`(1)，`references/` 六個檔**全部 0** | 斷言（主 session 已重現） |
| J4 | Step 3 敘述與上游實情不符三處：四類 vs 五類、`examples.md` 第三段標題是「改了什麼」不是「為什麼這樣改」、run-eval 刪除指示指錯檔 | 斷言 |
| J5 | Task 4/5 的上游情境反向斷言只蓋五個裡的三個，殘留「社群貼文」「辦公文書」整節仍全綠 | 斷言／維護者 |
| J6 | V3 全程無機械斷言（`spec.md` 特地註明「這是 B2 那輪吃過虧的地方」，這次做了一半）；V5 的 spec 反向斷言未實作 | 斷言／介面 |
| J7 | Task 2/3 缺位元組下限，違反 plan 自訂第五條 | 斷言 |
| J8 | 四選項缺「（推薦）」與 `Other`，直接違反 `CLAUDE.md §決策點選單` | 斷言 |
| J9 | 「我指定編號」之後三件事全未定義：授權在哪一刻成立、編號越界/自然語言回覆怎麼辦、要不要複誦再動筆 | 介面／斷言 |
| J10 | 缺 §檔案路徑解析（`design-direction:81-88` 有現成形制）與上游的 §單檔兜底規則——「模型讀完 SKILL.md 覺得懂了、references 一個都不開」是無聲失效 | 維護者 |
| J11 | 上游「動筆前不得覆蓋原始檔案」沒被斷言保住。bstack 實測「auto mode 下無 hook 攔 `Bash`」，這條是唯一防線 | 維護者 |
| J12 | 輸出不說自己命中哪一條規則 → 出錯要讀 47KB 三個檔才能定位。上游 `patterns.md` 本來就是 `### 1.`–`### 38.` 穩定編號，加第五欄不需新增內容 | 維護者 |
| J13 | `skills/` 內沒有任何地方標「這部分是自寫的」。現成先例：`design-language:152`「後三欄是本專案自寫、上游沒有的」 | 維護者 |
| J14 | `verify.md` 規格太薄（只要求 ✅/❌）。自寫層唯一的證據是 V7 那一次實跑，它若只是一個 ✅，這輪等於沒留下可覆核的東西 | 維護者 |
| J15 | `evals/` 24.5KB 現在用不到，且 spec 的「89KB」不含它——**實際 113,914 bytes**，論證體積可接受的數字低估 27% | CEO |
| J16 | `examples.md` 的「~19KB」是抄上游檔案大小當目標，但該檔在 plan 是整片自寫、Task 5 只要求 5 組。照 spec 數字灌水會生產最多品質風險最高的內容 | CEO |
| J17 | 五情境兩處分不開（README vs 使用文件、README vs 產品站文案）、缺 commit message / PR body、缺仲裁規則——**上游 `scenes.md:77` 有 `## 混合情境` 正是仲裁規則，v1 把它丟了** | 介面（＋主 session 補查） |

---

## 已知限制

- **V1／V2 未經實跑**（斷言 reviewer 無寫 `~/.claude/` 授權）。Task 8 執行時才會第一次驗證。
- **簡體字抽查依賴 locale**：本機 `zh_TW.UTF-8` 下實測對 `skills/` 27 檔、`CLAUDE.md`、上游六個 reference 全部乾淨、無誤報；`LC_ALL=C` 下 PCRE 字元類可能退化（**未驗證**，本機無法重現）。
- **`review-plan` 的視角模板本身該修**：四個模板全是 code 導向，對 markdown skill 這類標的不適用。本次靠手動改寫繞過，但下一個 T3 的 markdown task 會再撞一次。列 follow-up。
- **派工時未在 prompt 明寫「用 SendMessage 回傳結論」**：四個 reviewer 都在完成分析後只送 idle 訊號，主 session 逐一去要才拿到。下次派工要補。
