---
name: write-skill
description: |
  寫新 skill 的 meta skill（繁中）。觸發：write skill / 寫 skill /
  加新 skill / 改 skill / new skill / SKILL.md 怎麼寫 / skill format /
  skill 規格 / extend dev-workflow / 自訂 skill。
  涵蓋：SKILL.md frontmatter / body 結構、繁中風格、命名、放置位置、
  與 dev-workflow / CLAUDE.md 相容性、Red Flags。
---

# write-skill

寫新 skill 的指引。**Skill 是 prompt、不是 code** — 給 AI 看的指令、不是給 user 看的文件。

## 使用契約

**載入時機**：

1. user 要加 / 改 / 評既有 skill
2. AI 自身需要決定「這值得抽 skill 嗎」

**載入後立即動作**：

1. 確認目標（新 skill / 改既有）
2. 跑下面 §Skill 結構模板
3. 寫完跑 §Self-review checklist
4. 落檔 `skills/<skill-name>/SKILL.md`、commit

---

## §什麼時候該寫 skill / 不該寫

### 該寫
- 反覆出現的工作 pattern（≥3 次）
- 涉多步驟、需 紀律
- 需 trigger 詞偵測（user 一講某些詞就該載）
- 跟 CLAUDE.md 強制守則互動緊密
- 跨 task 重複用

### 不該寫
- 一次性工作 — 寫 task 就好
- 純資料表 / reference doc — 放 `docs/` markdown
- 對個別專案才有用 — 放該專案 `.claude/skills/` 而非 global
- 跟既有 skill 大量重疊 — 改既有、不新增

---

## §SKILL.md 結構

```markdown
---
name: <kebab-case slug>
description: |
  <一句總結 + 觸發詞清單，繁中。觸發詞越完整、AI 越能 trigger 載入。>
  涵蓋：<bullet 簡列做什麼>
  上游 / 下游：<指明前後 skill，銜接 dev-workflow>
---

# <skill name>

<一段 overview，2-3 句說明此 skill 解決什麼問題。>

## 使用契約（強制）

**載入後立即動作**：

1. <第一步>
2. <第二步>
3. ...

**禁**：
- <禁的行為>
- ...

---

## §<段一名>

<具體規則 / 流程>

## §<段二名>

...

## §hand-off state

```yaml
state:
  <新加 / 改的 state field>
  current_phase: <phase-name>-done
```

**下一 phase**：→ `<next skill>`

## §結尾 Trace 標籤

```
[Trace] Phase=<phase> | Tier=<...> | Track=<...> | Skill=<this skill>
```

## §Red Flags

| 想法 | 真相 |
|---|---|
| ... | ... |
```

---

## §Frontmatter 詳解

### `name`
- kebab-case
- 唯一（跨 skills/ 不重複）
- 簡潔（最好 1-3 字）
- 避用既有 plugin 同名（不用 `superpowers-brainstorming`、用 `brainstorm`）

### `description`
- **繁中**為主、英文 trigger 詞混入
- 第一段：一句總結這 skill 做什麼
- 第二段：「觸發：」+ 觸發詞清單（盡量列、含中英、含同義詞）
- 第三段：「涵蓋：」+ 範疇 bullet
- 第四段（如有）：「上游 / 下游：」+ skill 間銜接

範例好的 description：
```
按 plan 推進實作（繁中）。觸發：跑 plan / execute plan / 實作 plan / 照 plan 做 /
start coding / 開工 / 進 implementation / 寫 code。
涵蓋：讀 plan、逐 task 紅綠循環、parallel-group 派 subagent、verify、commit、
task fail 處置、blocker 升級。
上游：review-plan（user accept）或 brainstorm（T0 直接進）。
下游：verify-done（全 task 完）。
```

---

## §Body 風格規則

### 對話風格
- **繁中、台灣用語**
- 英文專有名詞保留原文（commit / branch / hook / Tier 等）
- **不**自誇（不寫「我是最好的 skill」/「我能完美處理」）
- **第二人稱**指 AI 自己（你必須 / 你要） — 因為 AI 是 user

### 結構
- **§<段名>** 用 `## §` prefix（方便 grep）
- 表格優先（key/value 對比清晰）
- code block 範例優先（具體勝抽象）
- bullet 列、不大段 prose

### 強制語氣
- **強制**規則用 **bold**
- **禁**字明確列、不繞
- 用「必」「禁」「應」、不用「建議」「最好」（除非真的是 soft 建議）

### Red Flags 表
每 skill 結尾**必**含 Red Flags 表 — 防 AI 自己 rationalize 跳規則：

```markdown
## §Red Flags

| 想法 | 真相 |
|---|---|
| 「<rationalization 範例>」 | <為何不對 + 該怎麼做> |
```

---

## §放置位置

| Skill 類型 | 路徑 |
|---|---|
| Global / 跨專案 | `~/.claude/skills/<name>/SKILL.md`（透過 repo `skills/<name>/` 經 setup.ps1 sync） |
| 專案特定 | 該專案 `.claude/skills/<name>/SKILL.md` |
| 暫時 / experimental | `~/.claude/skills/_experimental/<name>/SKILL.md`（user 自管）|

新 skill 通常放 `D:\GitHub\b\skills\<name>\SKILL.md`（global、走 setup.ps1 sync）。

---

## §與 dev-workflow 相容

新 skill 若要嵌進 dev-workflow 9 階段流程：

1. **改 `skills/dev-workflow/SKILL.md`** — 加 routing / hand-off state 規則（§Track × Tier × Phase 路徑 / §跨流程 skill 觸發 表）
2. **註明上下游 phase**：description 寫清楚、body 對齊

若 skill 是**橫向觸發**（非 phase 序列）：

1. 改 dev-workflow「§跨流程 skill 觸發」表加一行
2. 列觸發條件
3. body 描述「載入後動作」、不必描 phase

---

## §Self-review checklist

寫完跑：

- [ ] `name` kebab-case、唯一
- [ ] `description` 觸發詞列足（含中英 / 同義詞）
- [ ] 上下游 skill 已標
- [ ] 使用契約段落清楚
- [ ] 對齊 CLAUDE.md（無衝突）
- [ ] Red Flags 表 ≥3 個
- [ ] hand-off state 已列
- [ ] Trace 標籤格式
- [ ] 繁中、英文專有名詞保留
- [ ] 無 plugin 名（superpowers / gstack / ecc）出現於 user-facing 文字

---

## §改既有 skill

改既有 skill 注意：

- 仍走 dev-workflow 完整流程（自己改自己的 skill 也要 brainstorm → plan → ... ）
- **特別**：要改 dev-workflow 本身 → tier 自動升 T3（這是大改 + 影響全 repo）
- skill 之間銜接的 hand-off state 改動 → 所有引用的 skill 都要同步改

---

## §結尾 Trace 標籤

```
[Trace] Phase=write-skill | Tier=<T1+> | Track=Dev | Skill=write-skill
```

寫 / 改 skill 是 Dev track 任務。

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「1 次性 task 寫 skill 比較整齊」 | 1 次性 = 用 task；skill 是 reusable 行為 |
| 「skill 是文件」 | skill 是 **prompt**；給 AI 看的紀律性指令 |
| 「自誇好 skill 更威」 | description 純功能描述；AI 不看花言巧語 |
| 「不寫 Red Flags 沒差」 | Red Flags 是 anti-rationalization；必寫 |
| 「skill 引用其他 skill 不必標 hand-off」 | hand-off state 是流程連貫的關鍵；必標 |
| 「英文 skill 比較專業」 | 繁中；對話風格依 CLAUDE.md |
