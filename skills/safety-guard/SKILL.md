---
name: safety-guard
description: |
  PII / 密鑰 / token 外洩偵測（繁中）：原值 PII 與 secret pattern 掃描、mask 建議。
  載入：寫入 / commit / push / 寫 PR body 前；亦可顯式呼叫。
---

# safety-guard

寫入 / 落檔 / commit / push 前**最後一道**偵測 PII + secret 外洩。

> 層次：file-type-guard hook 擋檔案類型（.env 全擋）、本 skill 掃**內容**的 pattern；總則 rules.md §PII 安全底線、實作層 security-checklist。

## 使用契約

**載入時機**：

1. 寫 commit message / PR body 前
2. 落檔到 `docs/` 任何 markdown 前
3. 寫對話輸出含 grep 結果 / log / DB query result 前
4. Edit / Write 大量 content 前（>50 行）

**載入後**：

1. 對目標內容跑 regex pattern 掃
2. 命中 → 列出 + 建議 mask
3. 全 clean → 放行

## §PII pattern（依 rules.md「§PII 安全底線」）

- **Email**：`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`；mask `<2 字 abbrev>***@<domain>`，例 `to***@example.com`
- **Phone**：手機 `09\d{2}-?\d{3}-?\d{3}`、市話 `0\d-?\d{6,8}`、國際 `\+\d{1,3}[-\s]?\d{2,4}[-\s]?\d{4}[-\s]?\d{4}`；mask `09**-***-<後 3 碼>`
- **身分證 / ID**：台灣 `[A-Z][12]\d{8}`；mask `<首字>****<尾 4 碼>`
- **信用卡**：`\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}`，Luhn 過才報（避誤殺隨機 16 位）；mask `****-****-****-<尾 4 碼>`
- **地址**：「市 / 區 / 路 / 街 / 號 / 樓」連續模式；regex 難準、人工複檢
- **其他 id_number / userId**：純數字 6-20 位 + context 含「user / id / member」；mask `<首 2 碼>***<尾 2 碼>`

## §Secret pattern

| 類型 | pattern |
|---|---|
| AWS Access Key | `AKIA[0-9A-Z]{16}` |
| AWS Secret | `[A-Za-z0-9/+=]{40}`（context 含 AWS / S3） |
| GitHub PAT | `ghp_[A-Za-z0-9]{36}` / `github_pat_[A-Za-z0-9_]{82}` |
| OpenAI | `sk-[A-Za-z0-9]{20,}` |
| Anthropic | `sk-ant-[A-Za-z0-9-_]+` |
| Stripe | `sk_live_[A-Za-z0-9]+` / `pk_live_[A-Za-z0-9]+` |
| Generic JWT | `eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]+` |
| Private key block | `-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----` |
| Bearer token in URL | `[?&]token=[A-Za-z0-9-_]{20,}` |
| Password in connection string | `://[^:]+:[^@]+@` |

Generic：`password\s*[:=]\s*['"][^'"]+['"]` / `secret\s*[:=]\s*['"][^'"]+['"]` / `api_?key\s*[:=]\s*['"][^'"]+['"]`

## §報告格式

```
[SAFETY-GUARD] 發現 <N> 個 PII / secret 候選

### 命中清單

1. PII (email)
   - 位置: <file:line> 或 「對話輸出第 X 段」
   - 原值: <擷取 ±20 字 context、原值用 ***>
   - 建議 mask: <mask 後字串>

2. Secret (OpenAI key)
   - 位置: ...
   - 建議: 移除原值、改用 `<env:OPENAI_API_KEY>` placeholder
```

## §處置

1. **可自動 mask 類**（email / phone / id_number 等 PII）→ 套 mask、續流程
2. **不可自動類**（secret / private key / 密碼）→ **拒寫 / 拒 commit**、`AskUserQuestion` 問 user（headless 時 → **不留言、不 push**、blocked `safety-guard/secret`，見 `headless-mode`；原值不得出現在任何輸出）：
   ```
   發現可能的 secret：<簡述、不貼原值>
   options:
     1. 移除 secret 不要 commit / 不要寫進 output（推薦）
     2. user 確認是測試 / placeholder、可寫
     3. 取消整個動作
   ```

## §hand-off state

```yaml
state:
  safety_guard_scans:
    - { target: <path | "dialog">, pii_found: <N>, secret_found: <N>, action: <auto-mask | user-decided | aborted> }
```

不推進 phase（橫向 skill）。

## §False positive 處理

- 「user@example.com」文件 placeholder → user 可說 OK 放行；`sk-test_abc` stripe test key → 仍建議移、不嚴擋；`AskUserQuestion` 給 user override（選項 2）

## §跟 git 互動

**禁**自動 `git filter-branch` / `git filter-repo` 清歷史；只擋當下要 commit 的東西、**不動既有 history**，清理由 user 走 BFG / GitHub support。

## §結尾 Trace 標籤

不貼自身 trace，由呼叫 phase 帶。

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「pattern 太嚴會誤殺」 | 命中 → 列出讓 user 看；不直接擋（除 L3+ secret）|
| 「secret 是測試的 OK」 | 仍走 AskUserQuestion 確認；test key 也可能誤外洩 |
| 「歷史已有 secret、我 amend 改一下」 | amend 不清歷史；走完整 history rewrite 流程 |
| 「PII mask 太麻煩、整段刪」 | 整段刪比留原值好；但 mask 是 better |
| 「commit body 沒 PII OK」 | message 也算輸出；同等檢 |
