/**
 * 判一段 git range 的前端改動是否「只動文字節點 / data-* 屬性值」——verify-done §UI / browser e2e 的文字節點豁免判定器。
 *
 * 為什麼是檔級不是行級：第一版用 `git diff -U0` 逐行比骨架，被 code-review 實測繞過四次——
 * `.tsx` 不在 pathspec、`<script>` 內容沒有 <> 被當純文字、空 diff 兩邊都空判成 TEXT-ONLY、
 * 多行標籤的屬性行與整行重排靠 sort 過關。檔級比對把整份 HTML 剝成骨架後**依序**比，這四條全擋。
 *
 * 骨架 = 剝掉「標籤之間的文字節點」與「data-* 屬性的值」，其餘一字不動：
 *   - <script> / <style> 區塊整段保留（內容是程式 / 樣式，不是文字節點）
 *   - <!-- 註解 --> 內容剝掉、只留殼（註解不影響渲染）
 *   - data-x="..." → data-x=""（值可變、屬性本身增刪不行）
 *   - 其他屬性（class / style / id / href …）與標籤結構原樣
 *
 * Fail-closed：任何「不確定」都回 NOT-TEXT-ONLY——有程式 / 樣式檔進 diff、沒有 HTML 改動、
 * working tree 還有未 commit 的前端改動、git show 讀不到檔。豁免只在完全確定時給。
 *
 * 用法（在被施工的專案根目錄）：
 *   node <plugin 根>/scripts/text-only-diff.mjs <base>...<head> [--ignore <路徑前綴>]   # 例 main...HEAD
 * 輸出一行 TEXT-ONLY / NOT-TEXT-ONLY: <理由>；exit 0 才豁免。
 * 被 import 時不跑 CLI，只匯出 skeleton / judgeFiles / judgeRange 供契約 P10a 對 fixture 測。
 */
import { execFileSync } from 'node:child_process';

const CODE_OR_STYLE = /\.(css|scss|sass|less|js|mjs|cjs|ts|tsx|jsx|vue|svelte)$/i;

/** 把一份 HTML 剝成骨架字串（規則見檔頭）。純函式、無 IO。 */
export function skeleton(html) {
  const keep = [];
  // 1) script / style 整段抽出保留（先做，免得裡面的 > < 被當成標籤邊界）。
  //    佔位符要長得像標籤 <@N@>，否則第 4 步會把它當「標籤之間的文字」剝掉、兩邊都少了 script 就假相等（P10a 抓到的）
  let s = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => { keep.push(m); return `<@${keep.length - 1}@>`; });
  // 2) 註解只留殼
  s = s.replace(/<!--[\s\S]*?-->/g, '<!---->');
  // 3) data-* 屬性值歸零（雙引號 / 單引號 / 無引號三種寫法）
  s = s.replace(/(\sdata-[\w-]+)=(?:"[^"]*"|'[^']*'|[^\s>]+)/g, '$1=""');
  // 4) 標籤之間的文字節點剝掉（含換行 / 縮排）；標籤內部原樣
  s = s.replace(/>[^<]*</g, '><').replace(/^[^<]*</, '<').replace(/>[^<]*$/, '>');
  // 5) 標籤內多餘空白折成一格，避免純排版差異誤判
  s = s.replace(/\s+/g, ' ');
  // 6) script / style 放回去（內容原樣，所以改了 JS / CSS 內容一定判 NOT）
  s = s.replace(/<@(\d+)@>/g, (_, i) => keep[Number(i)]);
  return s;
}

/**
 * 對一組 {path, before, after} 做判定。before / after 為 null 代表新增 / 刪除檔（→ NOT）。
 * 回 {ok, reason}。
 */
export function judgeFiles(files) {
  if (!files.length) return { ok: false, reason: 'no html changes（fail-closed：沒有 HTML 改動就沒有豁免的對象）' };
  for (const f of files) {
    if (f.before == null || f.after == null) return { ok: false, reason: `${f.path} 是新增 / 刪除檔` };
    if (skeleton(f.before) !== skeleton(f.after)) return { ok: false, reason: `${f.path} 標籤 / 屬性骨架有變（含順序、script / style 內容、data-* 增刪）` };
  }
  return { ok: true, reason: `${files.length} 個 HTML 檔只動文字節點 / data-* 值` };
}

/**
 * git range → 判定。base / head 從 `a...b` 或 `a..b` 拆；head 省略視為 HEAD。
 * ignore：路徑前綴清單，命中的檔不參與判定——只給「產出器重產且另有契約守著」的檔用
 * （例本 repo 的 docs/js/references-data.js 由 build-references.ps1 -Check 守），不是萬用白名單。
 */
export function judgeRange(range, ignore = []) {
  const m = range.match(/^(.+?)(?:\.\.\.|\.\.)(.*)$/);
  if (!m) return { ok: false, reason: `range 格式要是 <base>...<head>，收到「${range}」` };
  const base = m[1], head = m[2] || 'HEAD';
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const names = git('diff', '--name-only', `${base}...${head}`).split('\n').filter(Boolean)
    .filter((n) => !ignore.some((p) => n.startsWith(p)));
  const code = names.filter((n) => CODE_OR_STYLE.test(n));
  if (code.length) return { ok: false, reason: `程式 / 樣式檔在 diff 內：${code.slice(0, 3).join(', ')}` };
  if (head === 'HEAD') {
    const dirty = git('status', '--porcelain').split('\n').filter((l) => /\.(html|css|scss|js|mjs|ts|tsx|jsx|vue|svelte)$/i.test(l.trim()));
    if (dirty.length) return { ok: false, reason: `working tree 有未 commit 的前端改動：${dirty[0].trim()}（先 commit 再判）` };
  }
  const htmls = names.filter((n) => /\.html?$/i.test(n));
  const show = (ref, p) => { try { return git('show', `${ref}:${p}`); } catch { return null; } };
  const mergeBase = range.includes('...') ? git('merge-base', base, head).trim() : base;
  return judgeFiles(htmls.map((p) => ({ path: p, before: show(mergeBase, p), after: show(head, p) })));
}

// 直接執行才跑 CLI；被 import（契約 P10a）時只匯出函式
if (process.argv[1] && /text-only-diff\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) {
  const args = process.argv.slice(2);
  const ignore = [];
  for (let i = 0; i < args.length; i++) if (args[i] === '--ignore' && args[i + 1]) ignore.push(args[++i]);
  const range = args.find((a, i) => a !== '--ignore' && args[i - 1] !== '--ignore') || 'main...HEAD';
  let r;
  try { r = judgeRange(range, ignore); }
  catch (e) { r = { ok: false, reason: `git 指令失敗（range「${range}」是否存在？）：${(e.message || '').split('\n')[0]}` }; }  // 壞 range 也 fail-closed，不噴 stack
  console.log(r.ok ? `TEXT-ONLY（${r.reason}）` : `NOT-TEXT-ONLY: ${r.reason}`);
  process.exit(r.ok ? 0 : 1);
}
