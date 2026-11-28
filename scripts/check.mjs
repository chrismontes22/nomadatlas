// Post-build checks: internal links, SEO metadata and structured data on every page. Run: npm run check
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
const ROOT = 'dist';
async function* walk(d) { for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) yield* walk(p); else if (e.name.endsWith('.html') && !e.name.startsWith('_')) yield p; } }
const problems = []; const warn = (f, m) => problems.push(f.replace(/\\/g, '/') + ': ' + m);
const titles = new Map(), descs = new Map();
const indexable = new Set(), ogImages = new Set();
/** The URL path a file in dist/ is served at: dist/cities/lisbon/index.html -> /cities/lisbon/ */
const pathOf = (f) => '/' + f.replace(/\\/g, '/').replace(/^dist\//, '').replace(/index\.html$/, '');
let pages = 0, links = 0, ld = 0, images = 0;
for await (const f of walk(ROOT)) {
  pages++;
  const h = await readFile(f, 'utf8');
  const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  const canon = (h.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  const h1s = (h.match(/<h1[\s>]/g) || []).length;
  const noindex = /content="noindex/.test(h);
  const tl = title.replace(/&(amp|lt|gt|quot|#39);/g, 'x').length;
  if (!title) warn(f, 'missing <title>'); else if (tl > 70) warn(f, 'title ' + tl + ' chars: ' + title);
  if (!desc) warn(f, 'missing meta description'); else if (!noindex && (desc.length < 70 || desc.length > 165)) warn(f, 'description ' + desc.length + ' chars');
  if (!canon && !noindex) warn(f, 'missing canonical');
  if (canon && noindex) warn(f, 'canonical on a noindex page');
  if (canon) { const p = new URL(canon).pathname; if (p !== pathOf(f)) warn(f, 'canonical points to: ' + p); indexable.add(p); }
  const og = (h.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
  if (!og) warn(f, 'missing og:image'); else ogImages.add(new URL(og).pathname);
  if (h1s !== 1) warn(f, h1s + ' <h1> elements');
  if (!noindex) { if (titles.has(title)) warn(f, 'duplicate title with ' + titles.get(title)); titles.set(title, f); if (descs.has(desc)) warn(f, 'duplicate description with ' + descs.get(desc)); descs.set(desc, f); }
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); ld++; } catch (e) { warn(f, 'invalid JSON-LD: ' + e.message); } }
  for (const m of h.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/g)) warn(f, 'img without alt');
  for (const m of h.matchAll(/<img\b[^>]*>/g)) {
    images++;
    const src = (m[0].match(/\bsrc="(\/[^"#?]*)"/) || [])[1];
    if (src && !existsSync(join(ROOT, src))) warn(f, 'missing image ' + src);
    if (!/\bwidth="\d+"/.test(m[0]) || !/\bheight="\d+"/.test(m[0])) warn(f, 'img without width and height');
    if (/\balt=""/.test(m[0])) warn(f, 'img with empty alt');
  }
  for (const m of h.matchAll(/href="(\/[^"#?]*)/g)) {
    const u = m[1]; links++;
    const target = u.endsWith('/') ? join(ROOT, u, 'index.html') : join(ROOT, u);
    if (!existsSync(target)) warn(f, 'broken link ' + u);
  }
}
// Site-wide files
const sitemap = await readFile(join(ROOT, 'sitemap.xml'), 'utf8').catch(() => '');
if (!sitemap) warn('dist/sitemap.xml', 'missing');
else {
  const locs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname));
  for (const p of indexable) if (!locs.has(p)) warn('dist/sitemap.xml', 'indexable page not in the sitemap: ' + p);
  for (const p of locs) if (!indexable.has(p)) warn('dist/sitemap.xml', 'lists a page that is missing or not indexable: ' + p);
}
for (const p of [...ogImages, '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/site.webmanifest']) if (!existsSync(join(ROOT, p))) warn('dist' + p, 'missing (referenced by pages or the manifest)');
const robots = await readFile(join(ROOT, 'robots.txt'), 'utf8').catch(() => '');
if (!robots) warn('dist/robots.txt', 'missing');
if (/example\.com/.test(robots)) warn('dist/robots.txt', 'SITE_URL was not set when building, so canonical URLs, Open Graph tags and the sitemap point to example.com. Build with SITE_URL=https://your-domain');
if (/^Disallow:\s*\/(data|assets)\b/im.test(robots)) warn('dist/robots.txt', 'blocks /data/ or /assets/, which pages need when search engines render them');
const uniq = [...new Set(problems)];
console.log('[check] ' + pages + ' pages, ' + links + ' internal links, ' + images + ' images, ' + ld + ' JSON-LD blocks');
if (uniq.length) {
  const groups = new Map();
  for (const p of uniq) { const k = p.replace(/^[^:]+: /, '').replace(/\d+ chars.*/, 'length out of range').replace(/broken link .*/, 'broken link').replace(/missing image .*/, 'missing image').replace(/(indexable page not in the sitemap|lists a page that is missing or not indexable|canonical points to): .*/, '$1').replace(/duplicate (title|description) with .*/, 'duplicate $1').replace(/^\d+ <h1>.*/, 'h1 count'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  console.log('[check] ' + uniq.length + ' problems:');
  for (const [k, list] of groups) { console.log('  ' + k + ' (' + list.length + ')'); for (const p of list.slice(0, 4)) console.log('    - ' + p); }
  process.exitCode = 1;
} else console.log('[check] no problems found');
