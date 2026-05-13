---
name: retro
description: |
  期間回顧（繁中）。觸發：retro / 回顧 / 回顧一下 / 看一下最近 / 最近做了什麼 /
  本週 / 本月 / 本季 / 自上次 retro / since last retro / 看習慣 /
  看模式 / weekly summary / monthly summary / period summary / recap。
  涵蓋：載入時用 AskUserQuestion 取得期間 → 抓 git log + PR + TaskList 分析 →
  識別模式 → 產 retro 報告 → Memory hook 寫入（依 CLAUDE.md「§Memory hook」）。
  使用：**user 主動觸發**，不在 9 階段流程中；不限週、可任意期間。
---

# retro

任意期間的工作回顧：找重複出現的模式、把「值得記住」的東西寫進 memory。**不綁 tier、不自動觸發、不限週期**。

## §使用契約（強制）

**載入後立即動作**：

1. 確認 user 想跑 retro（觸發詞已明示，無需 paraphrase）。
2. **取得期間**（§期間選擇）：用 `AskUserQuestion` 問 user 想 retro 什麼範圍。
3. **資料來源蒐集**（§資料蒐集細節）：依期間抓 git log + PR + TaskList。
4. **分析模式**：什麼順、什麼不順、反覆出現的事情。
5. **產 retro 報告**（§報告結構）。
6. **Memory hook**（§Memory hook 流程）：分析中發現「值得長期記住」的東西 → 產 memory 更新 proposal → user review → 寫入。
7. **不修 code、不開 PR**（retro 是 reflection、不是動作）。

---

## §期間選擇

載入後第一件事：`AskUserQuestion` 取得期間。預設選項：

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

---

## §報告結構

落 `docs/retros/<period-slug>.md`，`<period-slug>` 規則：

| 期間類型 | slug |
|---|---|
| 自上次 retro / 自定起點 | `<YYYYMMDD>-to-<YYYYMMDD>` |
| 本週 | `<YYYY>-W<##>`（ISO 週號） |
| 本月 | `<YYYY-MM>` |
| 本季 | `<YYYY>-Q<#>` |

報告內容：

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
- **理由**: <為何值得記>
- **建議內容**:
  > <擬寫進 memory 的內容>

### Proposal 2
- ...
```

---

## §Memory hook 流程

對每個 proposal 用 `AskUserQuestion`：

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

選 1 → Write 進 `~/.claude/projects/.../memory/<name>.md` + 更新 `MEMORY.md` index
選 2 → 等 user 改 → 再寫
選 3 → 略過、不寫

依 CLAUDE.md「auto memory」段的格式（含 frontmatter `name / description / metadata.type`）。

**禁**：未經 user 同意直接寫 memory。

---

## §禁止的 retro 行為

| 禁 | 為何 |
|---|---|
| 把 retro 結果直接 commit 進 repo（如 `.claude/retro/<period>.md`） | retro 是給 user 看的、不該污染 repo（除非 user 明說要 commit） |
| 直接寫 CLAUDE.md | CLAUDE.md 是聖旨；改要走 review |
| 把 PII / 敏感 commit 內容貼進 retro 報告 | 對話歷史可能被 share；CLAUDE.md §PII 適用 |
| 在 retro 動 code / 改 plan | retro 只反思、不執行 |
| 跑超頻（一週 3+ 次本週 retro） | 太頻會雜訊；本週 retro 建議 ≤1 / 週、本月 ≤1 / 月 |

---

## §資料蒐集細節

期間以 `<start>` ~ `<end>` 兩個錨點為界。

### git log
```bash
# 期間 commit
git log --since="<start>" --until="<end>" --pretty="%h %s %an %ar" --no-merges

# commit type 分佈
git log --since="<start>" --until="<end>" --pretty="%s" --no-merges \
  | grep -oE "^(feat|fix|refactor|docs|chore|test|hotfix)" | sort | uniq -c
```

若起點是 commit SHA：用 `<sha>..HEAD` 取代 `--since`。

### PR
```bash
gh pr list --search "created:>=<start> created:<=<end>" \
  --json number,title,state,createdAt,mergedAt
```

### TaskList
- 主 agent 在本對話內可用 TaskList 工具讀
- 跨 session 的 task 已不可見（task 是 session-bound）；只看當前 session

---

## §結尾 Trace 標籤

```
[Trace] Phase=retro | Tier=— | Track=— | Skill=retro
```

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「找不到值得 memory 的就硬塞」 | 沒就沒；memory 是品質、不是量 |
| 「直接寫 CLAUDE.md」 | 禁；CLAUDE.md 改要 PR review |
| 「retro 順便修一下 code」 | 禁；retro 不執行 |
| 「貼 git log 全文進 retro」 | 抽 pattern、不貼全文 |
| 「memory proposal 不用 user 點頭」 | 必 AskUserQuestion；user 控 memory |
| 「user 喊 retro 就預設本週」 | 必問期間（AskUserQuestion）；不靜默套本週 |
| 「自上次 retro 找不到日期就 abort」 | 退回「本週」並告知 user；不打斷流程 |
