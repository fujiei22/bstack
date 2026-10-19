---
name: retro
description: |
  期間回顧（繁中）：git log + PR + TaskList（Claude Code）或 plan.md / 施工清單勾選狀態（Codex）找模式、產報告、memory proposal。
  載入：Phase 9，user 顯式呼叫；不綁 tier、不自動接在 pr-explain 後。
---

# retro

找期間內重複出現的模式、把值得記住的寫進 memory。**不綁 tier、不自動觸發、不限週期**。

## §使用契約（強制）

1. 確認 user 想跑 retro（觸發詞明示、免 paraphrase）。
2. **取得期間**（§期間選擇）：`AskUserQuestion` 問範圍。
3. **資料來源蒐集**（§資料蒐集細節）：依期間抓 git log + PR + TaskList（Claude Code）或 plan.md / 施工清單勾選狀態（Codex）。
4. **分析模式**：什麼順、什麼不順、反覆出現的事情。
5. **產 retro 報告**（§報告結構）。
6. **Memory hook**（§Memory hook 流程）：分析中發現「值得長期記住」的東西 → 產 memory 更新 proposal → user review → 寫入。
7. **不修 code、不開 PR**（retro 是 reflection、不是動作）。

## §期間選擇

`AskUserQuestion` 選項：

| 選項 | 對應期間 |
|---|---|
| 自上次 retro（**推薦**） | 抓上一次 retro 報告日期；首次跑則退回「本週」 |
| 本週 | 過去 7 天 |
| 本月 | 過去 30 天 |
| 本季 | 過去 90 天 |
| 自定（日期或 commit） | user 給起點：`<YYYY-MM-DD>` / `<commit-sha>` / `<branch-name>` |

**「自上次 retro」判定**：

1. `ls docs/retros/` 看最新一份報告檔名取日期
2. 若無報告 → 退回「本週」並告知 user
3. 取得起點後 → 印「本次 retro 期間：<start> ~ <end>」給 user 確認

## §報告結構

落 `docs/retros/<period-slug>.md`，slug 規則：

| 期間類型 | slug |
|---|---|
| 自上次 retro / 自定起點 | `<YYYYMMDD>-to-<YYYYMMDD>` |
| 本週 | `<YYYY>-W<##>`（ISO 週號） |
| 本月 | `<YYYY-MM>` |
| 本季 | `<YYYY>-Q<#>` |

```markdown
# 回顧 <period-slug>

> 期間: <YYYY-MM-DD> ~ <YYYY-MM-DD>
> commit: <N>，PR: <M>，task 完成: <K>

## 本期做了什麼

### 大事
- <PR / 大 feature 列出>

### 小修
- <小 fix / chore 列出，3-5 句 summary>

## 順的地方
- <具體；列 evidence。例：「Tier 機制讓 trivial task 不再走 brainstorm，平均 1 task 從 8 min → 2 min」>

## 不順的地方
- <具體；含起因。例：「3 次 review 都漏掉 PII mask；可能 reviewer prompt 不夠強調」>

## 反覆出現的模式
- <user 偏好 / AI 反覆犯錯 / 領域 lesson>

## 下期調什麼
- <具體可執行；不空泛>

## 對 CLAUDE.md / memory 系統的 proposal

> 以下為「值得寫進 memory」的觀察。每項需 user 點頭才寫。

### Proposal 1
- **類型**: feedback / user / project / reference
- **能否做成機制**: <能：架構 / hook / 契約腳本 / 測試 擇一，附為何更高層做不到；不能：一句理由>
- **理由**: <為何值得記>
- **建議內容**:
  > <擬寫進 memory 的內容>

### Proposal 2
- ...
```

## §Memory hook 流程

**先判能否做成機制**。memory 和規則書是文字，模型沒讀到或忘了就不生效；機制則是犯錯當下直接失敗。每個 proposal 由高往低試，停在第一個做得到的層級：

1. **架構**：刪掉會犯錯的那條路（一個任務只留一種做法、刪掉會被抄的舊寫法）
2. **檢查**：hook（例 `hooks/guard.mjs`）或契約腳本（例 `scripts/plugin-contract.mjs`）攔下，錯誤訊息直接寫該怎麼改
3. **測試**：寫一個在錯誤重演時會 fail 的測試
4. **文字**：前三層都做不到（需要判斷的事）才寫 memory

判到 1-3 層 → 選單第 1 項改成「開 issue 追蹤（推薦）」，issue 內文附這次的證據與建議層級；retro 本身仍不改 code。

每個 proposal 各問一次 `AskUserQuestion`：

```
問：發現本期反覆出現的模式：<簡述>
  類型: <feedback / user / project / reference>
  proposal 內容:
  > <擬寫的 memory>

選項：
  1. 寫進 memory（推薦）
  2. 修改後再寫（user 給細節）
  3. 不寫
```

選「開 issue」→ `gh issue create`，標題寫要防的錯、內文附證據與層級；選 1 → Write 進 memory 的 `<name>.md`（路徑依 `devwork/hosts.md` §Memory 路徑）+ 更新 `MEMORY.md` index；選 2 → 等 user 改再寫；選 3 → 略過。
格式依 CLAUDE.md「auto memory」段（`name / description / metadata.type`）；**禁**未經 user 同意寫 memory。

## §禁止的 retro 行為

| 禁 | 為何 |
|---|---|
| 把 retro 結果直接 commit 進 repo（如 `.claude/retro/<period>.md`） | retro 是給 user 看的、不該污染 repo（除非 user 明說要 commit） |
| 直接寫 CLAUDE.md | CLAUDE.md 是聖旨；改要走 review |
| 把 PII / 敏感 commit 內容貼進 retro 報告 | 對話歷史可能被 share；rules.md §PII 適用 |
| 在 retro 動 code / 改 plan | retro 只反思、不執行 |
| 跑超頻（一週 3+ 次本週 retro） | 太頻會雜訊；本週 retro 建議 ≤1 / 週、本月 ≤1 / 月 |

## §資料蒐集細節

### git log
```bash
# 期間 commit
git log --since="<start>" --until="<end>" --pretty="%h %s %an %ar" --no-merges

# commit type 分佈
git log --since="<start>" --until="<end>" --pretty="%s" --no-merges \
  | grep -oE "^(feat|fix|refactor|docs|chore|test|hotfix)" | sort | uniq -c
```

起點是 commit SHA 時用 `<sha>..HEAD` 取代 `--since`。

```bash
gh pr list --search "created:>=<start> created:<=<end>" \
  --json number,title,state,createdAt,mergedAt
```

TaskList（Claude Code）：工具直接讀；task 是 session-bound、只看當前 session。工具不在清單時（Codex）改讀 plan.md / 施工清單的勾選狀態，見 `devwork/hosts.md` §任務追蹤。

## §結尾 Trace 標籤

結尾貼 rules.md §Trace 標籤（Phase=retro）。

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「找不到值得 memory 的就硬塞」「proposal 不用 user 點頭」 | 沒就沒，memory 是品質不是量；必 AskUserQuestion |
| 「這條教訓寫進 memory 就好」 | 先判能否做成機制（§Memory hook 流程）；能就開 issue，文字是最後手段 |
| 「直接寫 CLAUDE.md」「retro 順便修一下 code」 | 禁；CLAUDE.md 改要 PR review、retro 不執行 |
| 「貼 git log 全文進 retro」 | 抽 pattern、不貼全文 |
| 「喊 retro 就預設本週」「找不到上次日期就 abort」 | 必問期間（AskUserQuestion）；找不到日期退回「本週」並告知 user、不打斷 |
