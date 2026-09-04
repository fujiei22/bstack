/**
 * 最小靜態伺服器，給 verify-done 的文字節點豁免 smoke 用（Playwright MCP 擋 file://，見 memory）。
 *   node <plugin 根>/scripts/static-serve.mjs [root=docs] [port=8765]
 * 有 MIME 表（`<script type="module">` 在空 Content-Type 下會被瀏覽器以 strict-MIME 擋掉、console 直接紅）、
 * 有 error handler（port 被占用時明確報 EADDRINUSE 而不是讓 browser_navigate 撞到別人的舊 server）、
 * 目錄請求補 index.html。跑完要主動結束（verify-done smoke 第 4 步）。
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.argv[2] || 'docs';
const port = Number(process.argv[3] || 8765);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(root, p));
  if (!file.startsWith(normalize(root))) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
server.on('error', (e) => { console.error(`static-serve: ${e.code} on port ${port}（${e.code === 'EADDRINUSE' ? '有舊 server 沒關，先 kill' : e.message}）`); process.exit(1); });
server.listen(port, () => console.log(`static-serve: http://localhost:${port}/ ← ${root}`));
