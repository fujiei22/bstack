#!/usr/bin/env node
/**
 * headless 回覆解析（純函式 + CLI）。skill 用 gh 拉 issue 留言 JSON 餵進來，這裡只做「哪一則算回覆、選了幾號」的
 * 機械判定，不呼叫 gh、不看 issue body。規則書禁文字 token NLP：這裡只認第一行的受限編號（0-9 / 全形、可帶 # ( . ) 、。,），
 * 第二行起原樣回傳給 skill 當 user 指示文字，本檔不解讀。
 *
 *   stdin  {comments: [{id, body, createdAt, authorAssociation}], optionCount, askedAt, decisionId}
 *          （snake_case 同義鍵 option_count / asked_at / decision_id 也收：skill 的 snapshot 欄位是 snake）
 *   stdout {status: 'answered'|'unparseable'|'none', option, freeText, commentId, reasked, reminded}
 *   exit 2：askedAt 不是 gh 回傳的 RFC 3339 `…Z` 字串、optionCount 不是 ≥1 的整數、stdin 不是 JSON。
 *          fail-loud：這兩個值錯掉時安靜回 none 會讓流程永遠 waiting（code-review 實測抓到）。
 *
 * 「自己的留言」不看帳號：headless 可能用人自己的帳號跑（solo dev 的 gh token），viewerDidAuthor 對人的回覆也是 true。
 * 改認內容——bstack 留的每一則都帶 `<!-- bstack-… -->` 標記或「已讀到選項」前綴，人不會寫這些；但標記留言仍要求
 * authorAssociation 受信（bstack 用的 token 必然是 OWNER / MEMBER / COLLABORATOR），路人偽造標記不算數。
 * 契約 plugin-contract.mjs P19 對 fixture 直接 import 跑，另跑一次 CLI 冒煙。
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const FULL = '０１２３４５６７８９';
const norm = (s) => String(s).replace(/[０-９]/g, (c) => String(FULL.indexOf(c)));
const FIRST = /^\s*[#＃（(]?\s*(\d+)\s*[.)．、。,，）]?\s*$/;
const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
// 標記留言也要求作者受信：路人貼一則假 <!-- bstack-reask --> 不能把狀態機弄髒（security-audit M1）
const isMine = (c) => TRUSTED.has(c.authorAssociation) && (/<!-- bstack-/.test(String(c.body)) || /^\s*已讀到選項/.test(String(c.body)));

/** 第一行是不是受限編號；回 {option, rest} 或 null。 */
export function parseFirstLine(body) {
  const [first, ...rest] = String(body).replace(/\r\n/g, '\n').split('\n');
  const m = norm(first).match(FIRST);
  return m ? { option: Number(m[1]), rest: rest.join('\n').trim() } : null;
}

/**
 * 從 issue 留言陣列判定回覆。
 * - 只看 askedAt 之後、非 bstack 自己（內容判）、authorAssociation 受信的留言。
 * - answered = 其中**最新一則第一行是合格編號**的留言（人答完編號再閒聊一句不會蓋掉答案）；
 *   `0` 但第二行起沒內容 → 不算合格（0 的定義就是「寫你要的做法」）。
 * - 有候選但沒合格編號 → unparseable（帶最後一則 id 給澄清用）；沒候選 → none。
 * - reasked / reminded：askedAt 之後、帶本 decisionId 的 bstack-reask / bstack-remind 標記是否已存在。
 */
export function parseReply(comments, opts = {}) {
  const optionCount = opts.optionCount ?? opts.option_count;
  const askedAt = opts.askedAt ?? opts.asked_at;
  const decisionId = opts.decisionId ?? opts.decision_id ?? '';
  if (!Number.isInteger(optionCount) || optionCount < 1) throw new Error(`optionCount 必須是 ≥1 的整數，收到 ${JSON.stringify(optionCount)}`);
  if (typeof askedAt !== 'string' || !ISO_Z.test(askedAt)) throw new Error(`askedAt 必須是 gh 回傳的 createdAt 原值（RFC 3339 …Z），收到 ${JSON.stringify(askedAt)}；為空代表上一輪留言後沒存回 snapshot，先用 gh 找回 <!-- bstack-ask: ${decisionId || '<decision_id>'} 那則的 createdAt`);
  const list = [...comments].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const after = list.filter((c) => String(c.createdAt) > askedAt);
  const mine = after.filter(isMine);
  const has = (tag) => mine.some((c) => String(c.body).includes(`<!-- bstack-${tag}${decisionId ? ':' : ''}${decisionId ? ' ' + decisionId : ''}`) || (!decisionId && String(c.body).includes(`<!-- bstack-${tag}`)));
  const reasked = has('reask'), reminded = has('remind');
  const candidates = after.filter((c) => !isMine(c) && TRUSTED.has(c.authorAssociation));
  const out = (status, extra = {}) => ({ status, option: null, freeText: null, commentId: null, reasked, reminded, ...extra });
  if (candidates.length === 0) return out('none');
  const answered = candidates.map((c) => ({ c, p: parseFirstLine(c.body) }))
    .filter(({ p }) => p && p.option >= 0 && p.option <= optionCount && (p.option !== 0 || p.rest !== ''))
    .at(-1);
  if (answered) return out('answered', { option: answered.p.option, freeText: answered.p.rest || null, commentId: answered.c.id });
  return out('unparseable', { commentId: candidates.at(-1).id });
}

// CLI：stdin JSON → stdout JSON。isMain 比 realpath（同 hooks/guard.mjs）：磁碟機大小寫、8.3 短檔名都消掉；被 import 時不觸發。
function isMainModule() {
  if (!process.argv[1]) return false;
  const n = (p) => { try { return realpathSync.native(p).replace(/\\/g, '/').toLowerCase(); } catch { return path.resolve(p).replace(/\\/g, '/').toLowerCase(); } };
  return n(process.argv[1]) === n(fileURLToPath(import.meta.url));
}
if (isMainModule()) {
  let raw = '';
  try { raw = (await import('node:fs')).readFileSync(0, 'utf8'); } catch { raw = ''; }
  try {
    const { comments = [], ...opts } = JSON.parse(raw);
    process.stdout.write(JSON.stringify(parseReply(comments, opts)));
  } catch (e) {
    process.stderr.write(`headless-reply: ${e.message}\n`);
    process.exitCode = 2;
  }
}
