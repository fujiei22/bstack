---
name: security-checklist
description: |
  安全實作 checklist（繁中）。觸發：security checklist / 安全檢查 / 跑 checklist /
  寫認證 / 寫 API endpoint / 處理 user input / 處理 secret / 上傳 / payment /
  涉敏感資料 / 涉 PII。
  涵蓋：secret 管理、input validation、SQL injection、XSS / CSRF、auth、
  session、file upload、rate limit、secure header、error handling、log mask。
  附 FAIL / PASS 範例。security-audit 跑 STRIDE 後載此 skill 做具體實作對齊。
---

# security-checklist

具體**實作層級**安全檢查清單，配 FAIL / PASS code 範例。

> security-audit 跑 STRIDE 找架構威脅；security-checklist 找實作 bug。**兩者互補**。

## 使用契約

**載入後**：

1. 依改動命中的主題（命中 1 個就跑該主題、不必全跑）
2. 對改動 grep / 看 diff、對 checklist 每項 verify
3. 違反項目產 finding；交 receive-review 或 security-audit 處置

---

## §1. Secret 管理

### ❌ FAIL
```ts
const apiKey = "sk-proj-xxxx"             // hardcoded
const dbPwd  = "P@ssw0rd123"              // 進 source
```

### ✅ PASS
```ts
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
```

### Verify checklist
- [ ] 無 hardcoded API key / token / password / private key
- [ ] 所有 secret 從 env / vault 載
- [ ] `.env*`（除 `.env.example`）在 `.gitignore`
- [ ] git history 無 secret（用 `git log -S 'KEY=' --all` 抽查）
- [ ] production secret 由 hosting 平台 secret manager 管

---

## §2. Input validation

### ❌ FAIL
```ts
function createUser(input) {
  return db.users.create(input)  // 直 forward user input
}
```

### ✅ PASS
```ts
import { z } from 'zod'
const Schema = z.object({
  email: z.string().email(),
  name:  z.string().min(1).max(100),
  age:   z.number().int().min(0).max(150),
})

function createUser(input: unknown) {
  const data = Schema.parse(input)   // throw on invalid
  return db.users.create(data)
}
```

### Verify checklist
- [ ] 所有 user input 過 schema 驗證
- [ ] **whitelist**（允許清單）非 blacklist
- [ ] 拒絕後 error 訊息**不漏內部結構** / 不透露 schema 細節
- [ ] 邊界值（空、巨大、Unicode、emoji、SQL 字元、HTML tag）都驗
- [ ] file upload 額外驗：大小、MIME、副檔名（三層驗）

---

## §3. SQL Injection

### ❌ FAIL
```ts
const q = `SELECT * FROM users WHERE email = '${userEmail}'`  // 字串接
await db.query(q)
```

### ✅ PASS
```ts
// parameterized
const { data } = await db.query('SELECT * FROM users WHERE email = $1', [userEmail])

// ORM
const user = await prisma.user.findFirst({ where: { email: userEmail } })
```

### Verify checklist
- [ ] 全部 SQL 參數化（$1 / ? placeholder）或 ORM
- [ ] 沒有 raw 字串接 + user input
- [ ] 動態 column / table name → whitelist 限制
- [ ] 跑 EXPLAIN 確認 query plan 合理（隱含拒絕 N+1 / 全表掃）

---

## §4. XSS（前端輸出）

### ❌ FAIL
```html
<div>{{userBio | rawHtml}}</div>          <!-- 直接 render HTML -->
```
```jsx
<div dangerouslySetInnerHTML={{__html: userInput}} />
```

### ✅ PASS
```jsx
<div>{userBio}</div>                        // 預設 escape
// 必須 render HTML？用 DOMPurify
<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(userInput)}} />
```

### Verify checklist
- [ ] 預設 escape；不直接 rawHtml
- [ ] 必 render HTML → DOMPurify / sanitize-html
- [ ] CSP header 配 nonce / hash、不 `unsafe-inline`
- [ ] user input 在 `<script>` / `style` / `href="javascript:..."` 預設禁

---

## §5. CSRF

### ❌ FAIL
```ts
app.post('/transfer', (req, res) => {
  // 無 CSRF token check
  doTransfer(req.user, req.body)
})
```

### ✅ PASS
```ts
// SameSite cookie + double-submit
app.use(csrf())            // 中介層產 token
app.post('/transfer', (req, res) => {
  // csrf middleware 已驗 token vs cookie
  doTransfer(req.user, req.body)
})
```

### Verify checklist
- [ ] state-changing endpoint（POST/PUT/PATCH/DELETE）有 CSRF token
- [ ] cookie 設 `SameSite=Strict`（或 `Lax`）
- [ ] cookie 設 `HttpOnly` / `Secure`
- [ ] CORS allow-list 不含 `*`

---

## §6. Authentication / Authorization

### ❌ FAIL
```ts
app.get('/admin/users', (req, res) => {
  res.json(db.users.findAll())   // 無 role check
})
```

### ✅ PASS
```ts
app.get('/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  res.json(db.users.findAll())
})
```

### Verify checklist
- [ ] 每個 protected endpoint 都過 auth middleware
- [ ] role check 是 deny-by-default（缺 role = 拒）
- [ ] 不靠 client 提供 user ID 來決定權限（一律從 server-side session 取）
- [ ] password 用 bcrypt / argon2 / scrypt，**不**用 md5 / sha1
- [ ] timing-safe 比對 token / hash（防 timing attack）

---

## §7. Session

### Verify checklist
- [ ] session ID 隨機足量（≥128 bit）
- [ ] 登入後 rotate session ID（防 fixation）
- [ ] logout 立即 invalidate server-side
- [ ] 過期時間設合（idle + absolute）
- [ ] cookie 設 HttpOnly / Secure / SameSite
- [ ] JWT 用對稱 / 非對稱簽章；不用 `alg: none`

---

## §8. File upload

### Verify checklist
- [ ] 大小上限驗（避免 OOM / 耗 disk）
- [ ] MIME 驗（用 magic bytes 比對，**不只**信 `Content-Type`）
- [ ] 副檔名 whitelist
- [ ] 存到 user 可訪 path？務必 **不執行**（noexec mount / static-only serve）
- [ ] 圖檔 → 走 image-magick / sharp 過一次（剝除 EXIF + 確保不是偽裝）
- [ ] 上傳到外部 storage（S3）+ 短期 signed URL

---

## §9. Rate limiting

### Verify checklist
- [ ] 公開 endpoint 加 rate limit（per-IP + per-user）
- [ ] 登入 / 註冊 endpoint **特別**嚴（防 brute force / enum）
- [ ] expensive query / file processing 加 quota
- [ ] 429 response 含 `Retry-After`
- [ ] 用 sliding window 或 token bucket（不單純 fixed window）

---

## §10. Secure headers

### Verify checklist
- [ ] `Content-Security-Policy`（nonce / hash 嚴格）
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`（或 CSP `frame-ancestors`）
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Strict-Transport-Security`（HSTS、含 preload）
- [ ] `Permissions-Policy` 限制 sensor / camera 等 API

---

## §11. Error handling

### ❌ FAIL
```ts
catch (err) {
  res.status(500).json({ error: err.stack })   // 把 stack 給 client
}
```

### ✅ PASS
```ts
catch (err) {
  logger.error({ err, requestId }, 'unexpected error')   // log 內部
  res.status(500).json({ error: 'Internal Server Error', requestId })
}
```

### Verify checklist
- [ ] error message 對 user → 通用、不含內部 path / SQL / stack
- [ ] internal log → 完整、有 requestId / traceId
- [ ] 不暴露 stack trace 到 production response
- [ ] 不暴露 DB error（如 SQL syntax）給 user

---

## §12. Log / PII mask

依 CLAUDE.md「§PII 安全底線」：

### ❌ FAIL
```ts
logger.info({ user }, 'user logged in')   // user 含 email / phone 原值
```

### ✅ PASS
```ts
logger.info({
  userId: user.id,
  emailMasked: maskEmail(user.email),     // foo***@example.com
}, 'user logged in')
```

### Verify checklist
- [ ] log 不含 PII 原值（mask 或只記 ID）
- [ ] log 不含 secret / token / password（hash 也不該記）
- [ ] error 含 user input → mask 該欄位
- [ ] structured log（JSON），不純 string concat

---

## §載入 / 結束

無 hand-off state、被 security-audit / receive-review / brainstorm 0b 等隨需載入。

跑完該主題、產 finding 交呼叫方。

---

## §結尾 Trace 標籤

被載入時不貼自身 phase trace；由呼叫方 phase trace 帶。
