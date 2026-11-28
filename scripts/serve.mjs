// Minimal static server for dist/ (no dependencies). Run: npm run serve  (http://localhost:4321)
// Listens on this computer only. Set HOST=0.0.0.0 to reach it from other devices on a network you trust, and PORT to change the port.
// It sends the headers from dist/_headers (except caching), so the Content-Security-Policy can be checked before deploying.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';

const ROOT = resolve(process.argv[2] || 'dist');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4321);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) { console.error('PORT must be a whole number from 0 to 65535'); process.exit(1); }
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

// _headers format (Netlify, Cloudflare Pages): a path pattern on its own line, then indented "Name: value" lines.
function parseHeaders(text) {
  const rules = []; let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { cur = { re: new RegExp('^' + line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'), headers: [] }; rules.push(cur); }
    else if (cur) { const i = line.indexOf(':'); if (i > 0) cur.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]); }
  }
  return rules;
}
const rules = parseHeaders(await readFile(join(ROOT, '_headers'), 'utf8').catch(() => ''));
const headersFor = (path) => Object.fromEntries(rules.filter((r) => r.re.test(path)).flatMap((r) => r.headers).filter(([k]) => k.toLowerCase() !== 'cache-control'));

/** The file inside ROOT for a URL path, or null when the path is malformed or points outside ROOT. */
function fileFor(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { return null; }
  // Site paths only use letters, digits, "-", "_", "." and "/". This also rules out "\\", ":", control characters and NUL.
  if (!/^\/[\w.\-/]*$/.test(p) || p.split('/').includes('..')) return null;
  const f = resolve(ROOT, '.' + p);
  return f === ROOT || f.startsWith(ROOT + sep) ? f : null;
}

createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
    const { pathname } = new URL(req.url, 'http://localhost');
    let f = fileFor(pathname);
    if (!f) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('Bad request'); }
    const extra = headersFor(pathname);
    let isDir = false;
    try { isDir = (await stat(f)).isDirectory(); } catch { /* missing: handled below */ }
    // Clean URLs: /cities/lisbon -> /cities/lisbon/, only for folders that exist (a missing page is a plain 404, not a
    // redirect to another 404). A single leading "/" keeps the redirect on this server.
    if (isDir && !pathname.endsWith('/')) { res.writeHead(301, { Location: '/' + pathname.replace(/^\/+/, '') + '/' }); return res.end(); }
    if (isDir) f = join(f, 'index.html');
    let body;
    try { body = await readFile(f); } catch {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...extra });
      return res.end(req.method === 'HEAD' ? undefined : await readFile(join(ROOT, '404.html')).catch(() => 'Not found'));
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...extra });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
}).listen(PORT, HOST, () => console.log('NomadAtlas running at http://' + (['127.0.0.1', '0.0.0.0', '::'].includes(HOST) ? 'localhost' : HOST) + ':' + PORT));
