---
name: lock-files
description: |
  鎖定編輯範圍（繁中）。觸發：lock / freeze / 鎖檔 / 不要動 / 別改 /
  限制範圍 / restrict edits / production module / 敏感模組。
  涵蓋：user 顯式宣告哪些檔 / 目錄禁改、skill 啟動時把 lock list 寫到 state、
  寫入動作 pre-check、user 解鎖機制。
  使用：user 主動觸發；動 prod / 敏感模組 / 大改前用。
---

# lock-files

把指定檔 / 目錄宣告為**禁改**範圍。**Branch safety + file-type-guard 之外的第三層保護**。

> 跟 file-type-guard 的差異：file-type-guard 看**檔案類型**（.env、.gitignore 等）；lock-files 看**user 顯式指定**的具體路徑。

## 使用契約

**載入後立即動作**：

1. `AskUserQuestion` 問 user 要鎖哪些 path（檔 / 目錄 / glob）。
2. 寫進 `state.locked_paths`、印確認清單。
3. 此後**任何 Edit / Write / NotebookEdit**前，先檢 path 是否命中 locked：
   - 命中 → 拒絕、印警告、不執行
   - 不命中 → 放行
4. user 顯式 unlock → 移除 entry。

---

## §鎖檔 prompt

```
問：要把哪些檔 / 目錄鎖為禁改？
  輸入支援：
    - 具體檔（src/payment.ts）
    - 目錄（src/auth/）
    - glob（**/migrations/*.sql）
  以空格 / 換行分隔
```

user 提供後，主 agent 回覆：

```
已鎖：
  - src/payment.ts
  - src/auth/
  - **/migrations/*.sql

此後對命中 path 的 Write / Edit / NotebookEdit 將被阻擋。
unlock：說「unlock <path>」或「全 unlock」。
```

---

## §寫入 pre-check

每 Edit / Write / NotebookEdit 前：

1. 取 target `file_path`
2. 對 `state.locked_paths` 逐項比對（glob match）
3. 命中 → 拒絕：

```
[LOCK-FILES] 命中鎖檔：<file_path>
原因：user 已將此 path 列為禁改範圍。
若要修改，先說「unlock <path>」。
```

不執行 tool；視為流程被 block，等 user 指示。

---

## §unlock 流程

user 說：
- `unlock src/payment.ts` → 從 `state.locked_paths` 移該項
- `unlock src/auth/` → 移該項
- `全 unlock` / `unlock all` → 清空整個 list
- `lock` → 重啟此 skill 重新指定

**禁**：未經 user 顯式 unlock 就 bypass。

---

## §跟其他 skill 互動

- **Branch safety hook**：先擋；過 branch safety 才到 lock-files
- **file-type-guard hook**：跟 lock-files 並行；任一擋住都不動
- **execute-plan / receive-review**：發現要動 locked path → `AskUserQuestion` 問 user 是否 unlock；user 同意才繼續
- **finish-branch**：commit 前最後檢一遍 staged diff vs locked_paths

---

## §hand-off state

```yaml
state:
  locked_paths: [<path>, ...]
  lock_set_at: <ISO timestamp>
  unlock_history: [...]
```

不推進 phase（lock-files 是橫向 skill、隨需載入）。

---

## §結尾 Trace 標籤

lock-files 載入期不貼自身 phase trace；由呼叫 phase 帶。

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「locked 但 reviewer 建議改」 | 走 unlock 流程；不 bypass |
| 「locked 但 auto-fix 要修這檔」 | auto-fix 也擋；user 決定 unlock or 不修 |
| 「locked 用 Bash 繞」 | Bash 不過 lock-files（hook 沒擋 Bash 寫檔）；故 Bash 寫檔仍視為禁、AI 須自律 |
| 「unlock 之後忘了再 lock」 | unlock 是顯式 + 永久；要 lock 重設 |
