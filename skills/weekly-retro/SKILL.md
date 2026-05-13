---
name: weekly-retro
description: |
  週回顧（繁中）。觸發：retro / 回顧 / 週回顧 / weekly retro / 看本週 /
  本週做了什麼 / weekly summary / 看習慣。
  涵蓋：抓 git log + PR + TaskList 分析、識別模式、產 retro 報告、
  Memory hook 寫入（依 CLAUDE.md「§Memory hook」）。
  使用：**user 主動觸發**，不在 9 階段流程中。
---

# weekly-retro

回顧本週工作節奏、找重複出現的模式、把「該記」的東西寫進 memory。**不綁 tier、不自動觸發**。

## 使用契約

**載入後立即動作**：

1. 確認 user 想跑 retro（觸發詞已明示，無需 paraphrase）。
2. **資料來源蒐集**：
   - `git log` 本週 commit（branch 切換、commit pattern、commit type 分佈）
   - PR 清單（`gh pr list --search "created:>=YYYY-MM-DD"`）
   - 本機 TaskList（已 completed 的 task 看 task 拆分品質）
3. **分析模式**：什麼順、什麼不順、反覆出現的事情。
4. **產 retro 報告**（結構化 markdown）。
5. **Memory hook**（依 CLAUDE.md「§Memory hook」）：分析中發現「值得長期記住」的東西 → 產 memory 更新 proposal → user review → 寫入。
6. **不修 code、不開 PR**（retro 是 reflection、不是動作）。

---

## §報告結構

```markdown
# 週回顧 <YYYY-W##>

> 期間: <YYYY-MM-DD> ~ <YYYY-MM-DD>
> commit: <N>，PR: <M>，task 完成: <K>

## 本週做了什麼

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

## 下週調什麼
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
問：發現本週反覆出現的模式：<簡述>
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
| 把 retro 結果直接 commit 進 repo（如 `.claude/retro/<week>.md`） | retro 是給 user 看的、不該污染 repo |
| 直接寫 CLAUDE.md | CLAUDE.md 是聖旨；改要走 review |
| 把 PII / 敏感 commit 內容貼進 retro 報告 | 對話歷史可能被 share；CLAUDE.md §PII 適用 |
| 在 retro 動 code / 改 plan | retro 只反思、不執行 |
| 一週退兩次 retro | 太頻會雜訊；建議每週 1 次 |

---

## §資料蒐集細節

### git log
```bash
# 本週 commit
git log --since="<7 days ago>" --pretty="%h %s %an %ar" --no-merges

# commit type 分佈
git log --since="<7 days ago>" --pretty="%s" --no-merges | grep -oE "^(feat|fix|refactor|docs|chore|test|hotfix)" | sort | uniq -c
```

### PR
```bash
gh pr list --search "created:>=<YYYY-MM-DD>" --json number,title,state,createdAt,mergedAt
```

### TaskList
- 主 agent 在本對話內可用 TaskList 工具讀
- 跨 session 的 task 已不可見（task 是 session-bound）

---

## §結尾 Trace 標籤

```
[Trace] Phase=weekly-retro | Tier=— | Track=— | Skill=weekly-retro
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
