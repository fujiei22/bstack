#!/usr/bin/env node
/**
 * headless 回覆解析（純函式 + CLI）。skill 用 gh 拉 issue 留言 JSON 餵進來，這裡只做「哪一則算回覆、選了幾號」的
 * 機械判定，不呼叫 gh、不看 issue body。規則書禁文字 token NLP：這裡只認第一行的受限編號（0-9 / 全形、可帶 # . ) 、。），
 * 第二行起原樣回傳給 skill 當 user 指示文字，本檔不解讀。
 *   stdin  {comments: [{id, body, createdAt, author:{login}, authorAssociation, viewerDidAuthor}], optionCount, askedAt, selfLogin, allowFree}
 *   stdout {status: 'answered'|'unparseable'|'none', option, freeText, commentId, reasked, reminded}
 * 契約 plugin-contract.mjs P19 對 8 個 fixture 跑 CLI。
 */
const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const FULL = '０１２３４５６７８９';
const norm = (s) => [...s].map((c) => (FULL.includes(c) ? String(FULL.indexOf(c)) : c)).join('');
const FIRST = /^\s*[#＃]?\s*(\d+)\s*[.)、。]?\s*$/;
const isSelf = (c, selfLogin) => Boolean(c.viewerDidAuthor) || c.author?.login === selfLogin;

/** 第一行是不是受限編號；回 {option, rest} 或 null。 */
export function parseFirstLine(body) {
  const [first, ...rest] = String(body).replace(/\r\n/g, '\n').split('\n');
  const m = norm(first).match(FIRST);
  return m ? { option: Number(m[1]), rest: rest.join('\n').trim() } : null;
}

/**
 * 從 issue 留言陣列判定回覆。
 * 只看 askedAt 之後、非自己、authorAssociation 受信的最新一則；reasked / reminded 看自己是否已留過對應標記。
 */
export function parseReply(comments, { optionCount, askedAt, selfLogin, allowFree = false }) {
  const list = [...comments].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const mine = list.filter((c) => isSelf(c, selfLogin));
  const reasked = mine.some((c) => String(c.body).includes('<!-- bstack-reask'));
  const reminded = mine.some((c) => String(c.body).includes('<!-- bstack-remind'));
  const candidates = list.filter((c) => String(c.createdAt) > String(askedAt) && !isSelf(c, selfLogin) && TRUSTED.has(c.authorAssociation));
  const last = candidates.at(-1);
  const out = (status, extra = {}) => ({ status, option: null, freeText: null, commentId: null, reasked, reminded, ...extra });
  if (!last) return out('none');
  const p = parseFirstLine(last.body);
  if (p && p.option >= 0 && p.option <= optionCount) return out('answered', { option: p.option, freeText: p.option === 0 ? p.rest : (p.rest || null), commentId: last.id });
  if (allowFree) return out('answered', { freeText: String(last.body).trim(), commentId: last.id });
  return out('unparseable', { commentId: last.id });
}

// CLI：stdin JSON → stdout JSON。用 argv[1] 尾端比對而不是 import.meta.url 全等，Windows 路徑分隔與大小寫都不必處理。
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/scripts/headless-reply.mjs')) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { input += d; });
  process.stdin.on('end', () => {
    try {
      const { comments = [], ...opts } = JSON.parse(input);
      process.stdout.write(JSON.stringify(parseReply(comments, opts)));
    } catch (e) {
      process.stderr.write(`headless-reply: ${e.message}\n`);
      process.exitCode = 2;
    }
  });
}
