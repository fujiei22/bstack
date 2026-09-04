---
name: write-skill
description: |
  寫新 skill 的 meta skill（繁中）。載入：dev-workflow §跨流程 skill 載入 表所列時點（要加 / 改 / 評 skill 本身）；亦可由使用者顯式呼叫。
  涵蓋：SKILL.md frontmatter / body 結構、繁中風格、命名、放置位置、
  與 dev-workflow / rules.md 相容性、Red Flags。
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
- 跟 rules.md 強制守則互動緊密
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
- **繁中**為主、英文專有名詞保留
- 第一段：一句總結這 skill 做什麼
- 第二段：「載入：」+ 一句「誰在哪個階段載入」（dev-workflow Phase N / §跨流程 skill 載入 表所列時點；可加「亦可由使用者顯式呼叫」）。**不寫「觸發：」+ 自然語言清單**——plugin 只由 `/devwork` 啟動，描述裡的觸發詞會讓沒下指令的對話也被攔（plugin-contract P3c 守）
- 第三段：「涵蓋：」+ 範疇 bullet
- 第四段（如有）：「上游 / 下游：」+ skill 間銜接

範例好的 description：
```
按 plan 推進實作（繁中）。載入：dev-workflow Phase 3（T3 由 review-plan user accept 後；
T1 / T2 由 brainstorm 直接交棒、plan_path 為 null）；亦可由使用者顯式呼叫。
涵蓋：讀 task 來源、逐 task 紅綠循環、parallel-group 派 subagent、verify、commit、
task fail 處置、blocker 升級。
上游：review-plan（T3）；brainstorm（T1 / T2，T2 的 task 來源 = spec ## 施工清單）。
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
| plugin（隨 bstack 發布） | repo `skills/<name>/SKILL.md` |
| 專案特定 | 該專案 `.claude/skills/<name>/SKILL.md` |
| 暫時 / experimental | 該專案 `.claude/skills/_experimental/<name>/SKILL.md`（user 自管）|

### §新 skill 落地 checklist（漏一處契約就紅）

1. `skills/<name>/SKILL.md`（name == 目錄名；描述寫「載入：」不寫「觸發：」）→ plugin-contract P3a / P3c
2. `docs/js/app.js` NODE_DOCS 加 `Load<X>: {p:'skills/<name>', n:'<name>', k:'skill'}` → docs-site-contract C6a / C18
3. `docs/js/data.js` 加節點與邊（或 ambient 區塊 docKey）→ C8a 節點 / 邊數
4. `docs/tools/docs-site-contract.mjs` BASELINE_KEYS 與 EXPECT → C6a / C8a
5. `pwsh -File scripts/build-references.ps1` → C8b / C18
6. `README.md` 「## Skills（N）」與表格一列 → plugin-contract P8
7. `docs/index.html` :8 :48 :87 三處計數 → P8

---

## §與 dev-workflow 相容

新 skill 若要嵌進 dev-workflow 9 階段流程：

1. **改 `skills/dev-workflow/SKILL.md`** — 加 routing / hand-off state 規則（§Track × Tier × Phase 路徑 / §跨流程 skill 載入 表）
2. **註明上下游 phase**：description 寫清楚、body 對齊

若 skill 是**橫向觸發**（非 phase 序列）：

1. 改 dev-workflow「§跨流程 skill 載入」表加一行
2. 列觸發條件
3. body 描述「載入後動作」、不必描 phase

---

## §Self-review checklist

寫完跑：

- [ ] `name` kebab-case、唯一
- [ ] `description` 觸發詞列足（含中英 / 同義詞）
- [ ] 上下游 skill 已標
- [ ] 使用契約段落清楚
- [ ] 對齊 rules.md（無衝突）
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
| 「英文 skill 比較專業」 | 繁中；對話風格依 rules.md |
