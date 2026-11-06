# Finder A：line-by-line diff scan（feat/headless-mode vs main）

驗證方式：`node scripts/plugin-contract.mjs` 全綠（含 P19）；下列每條 failure_scenario 都用真實 stdin JSON 餵 `node scripts/headless-reply.mjs` 重現過（標「verified」者）。

```json
[
  {
    "file": "D:\\GitHub\\bstack\\scripts\\headless-reply.mjs",
    "line": 30,
    "summary": "reasked / reminded 掃的是 bot 在整個 issue 的所有留言，沒有限縮到本題（createdAt > askedAt 或 decision_id）。前一題留過的 reask / remind 標記會永久壓掉之後每一題的澄清與提醒。",
    "failure_scenario": "Issue #7：第 1 題回覆格式錯，bot 留 <!-- bstack-reask: q1 -->，user 之後答對。稍後第 2 題提問，user 回「選 2 吧」。parser 回 unparseable 且 reasked=true（verified：askedAt 之前的 reask 標記仍被算進去），§讀回覆 第 3 步跳過澄清，本輪永遠停在 waiting（任何早期 remind 標記存在時提醒也一併被壓掉）。修法：`mine` 加 createdAt > askedAt 過濾，或比對標記內的 decision_id。"
  },
  {
    "file": "D:\\GitHub\\bstack\\scripts\\headless-reply.mjs",
    "line": 32,
    "summary": "askedAt 用原始字串比較（`String(c.createdAt) > String(askedAt)`）且不驗證。askedAt 為 null / undefined 或任何非 'Z' UTC 的 ISO 格式，都會每輪靜默回 'none' 而不是報錯。",
    "failure_scenario": "(a) 本輪在 `gh issue comment` 與 snapshot 覆寫之間死掉（§問人格式 第 5 步設計上 asked_at 先留空）→ 下一輪餵 askedAt:null → String(null)='null'，'2026…' > 'null' 為 false → 所有回覆被排除，永遠 'none'（verified）。(b) `gh issue comment` 只印留言 URL，asked_at 得由 agent 自己產；若用標記裡的本地時區 <ISO-ts>（`2026-09-11T10:30:00+08:00`），03:00Z 的合格回覆會被判成比提問早 → 'none'（verified）。parser 應兩邊 Date.parse，askedAt 缺或解析失敗時非零退出；skill 應寫明 asked_at 必須是留言的 UTC createdAt（用 `gh api repos/<r>/issues/comments/<id>` 取）。"
  },
  {
    "file": "D:\\GitHub\\bstack\\scripts\\headless-reply.mjs",
    "line": 14,
    "summary": "自我排除用 viewerDidAuthor || author.login === selfLogin。headless 跑的 GitHub 帳號與人回覆的帳號相同時（solo dev 用自己的 `gh auth login` 排程 `claude -p` 是預設情境），每一則人的回覆都被當成 self 丟掉。",
    "failure_scenario": "Owner 用個人 gh token 跑 cron；bot 提問，owner 用同一帳號回「1」。viewerDidAuthor=true → candidates 空 → 每輪 'none'；12 輪後補提醒（也是同帳號），task 永不前進。另外 §讀回覆 第 1 步要求的 `gh api user -q .login` 在 GitHub Actions GITHUB_TOKEN 下回 403，最常見的排程器上 selfLogin 的文件來源會失敗。較安全的 self 判定：只有 body 帶 bstack 標記（<!-- bstack-ask: / reask / remind / progress）或確認留言前綴的才算 mine，並在 skill 寫明共用帳號的支援方式或不支援。"
  },
  {
    "file": "D:\\GitHub\\bstack\\scripts\\headless-reply.mjs",
    "line": 37,
    "summary": "選 0 但第二行沒有文字時回 status 'answered'、option 0、freeText ''（空字串）。skill 第 2 步把它當成有效答案但沒有任何指示，沒有路徑導回 reask。",
    "failure_scenario": "user 只回一個 `0`（模板說 0 = 第二行起寫做法，所以裸 0 正是格式錯的情況）。parser 輸出 {\"status\":\"answered\",\"option\":0,\"freeText\":\"\"}（verified）。§讀回覆 第 2 步清掉 pending_question 並「等同 user 選了選項 0」繼續，但沒有指示；agent 不是自己編一個做法就是卡住，而 pending_question 已 null，這題再也問不回來。option===0 && rest==='' 應回 'unparseable'（或獨立 status）。"
  },
  {
    "file": "D:\\GitHub\\bstack\\scripts\\headless-reply.mjs",
    "line": 33,
    "summary": "`candidates.at(-1)` 取最新的受信留言，而不是最新「可解析」的那則。人在合格編號回覆之後再補任何一則留言，就把答案蓋掉。",
    "failure_scenario": "Owner 回「2」，5 分鐘後再補「補充：記得順便更新 README」。parser 回 unparseable、commentId 是補充那則（verified）；bot 留 bstack-reask「第一行請只寫編號」，即使合格答案已存在。此時 reasked 變 true，owner 下一則若又是文字就永遠 waiting。修法：candidates 由新到舊掃第一則可解析的；或在 §問人格式 模板明講只認最後一則留言。"
  },
  {
    "file": "D:\\GitHub\\bstack\\skills\\headless-mode\\SKILL.md",
    "line": 102,
    "summary": "§問人格式 第 4 步（duplicate-instance 偵測）拿既有 <!-- bstack-ask: 標記跟 `pending_question.asked_at` 比，但此時 pending_question 不是尚未存在（第 5 步才寫）就是 null（§讀回覆 第 2 步 answered 後清掉）。第一題之後的每一題基準都是未定義。",
    "failure_scenario": "同一 issue 第一題答完後的第二個 B 類問題：snapshot pending_question: null。第 4 步重讀 issue 找到 bot 自己先前的 bstack-ask 標記，要判它是否「比 null 更新」。照字面讀 → 之後每一題都 blocked duplicate-instance；寬鬆讀 → 因為沒有時間戳可比，真正的重複 instance 永遠偵測不到。此檢查需要一個持久化的「上一次自己提問的 ts」（例如 answered 後把 asked_at 留在 state 的另一欄，或跟 snapshot 已見過的最新標記比），而不是剛被清成 null 的欄位。另註：標記裡的 <ISO-ts> 是 agent 產的、asked_at 是 gh 的 createdAt，兩者即使都存在也不是同一時鐘 / 格式（呼應第 2 條）。"
  }
]
```

## 已檢查、無問題

- `rules16`、`hostsMd`、`section`、`lf`、`rd`、`exists`、`spawnSync` 都是頂層宣告，P19 block 內可見。
- HEADS19 的 regex 逃逸對 ASCII 與全形括號都可用；`使用契約（強制）` 標題命中。
- fixture 期望與實際行為一致（'bot 自己' → none、'格式錯' → commentId 3）；`Object.entries(want).every` 只比 want 有的 key，語意正確。
- dev-workflow「七欄」（含 `headless`）與 context-snapshot「六欄」（不含）起點不同，計數一致。
- `gh issue view --json comments` 會分頁抓全部留言，無 100 則上限問題。
- `mk()` 的 createdAt 用 `0${id}` 只是潛在問題（目前只用 id 1、3）；未來 id ≥ 10 會產生 `T010:` 排序錯，建議 `String(id).padStart(2,'0')`，非現行 bug。
