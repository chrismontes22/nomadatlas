// Post-build checks: internal links, SEO metadata and structured data on every page. Run: npm run check
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
const ROOT = 'dist';
async function* walk(d) { for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) yield* walk(p); else if (e.name.endsWith('.html') && !e.name.startsWith('_')) yield p; } }
const problems = []; const warn = (f, m) => problems.push(f.replace(/\\/g, '/') + ': ' + m);
const titles = new Map(), descs = new Map();
let pages = 0, links = 0, ld = 0;
for await (const f of walk(ROOT)) {
  pages++;
  const h = await readFile(f, 'utf8');
  const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  const canon = (h.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  const h1s = (h.match(/<h1[\s>]/g) || []).length;
  const noindex = /content="noindex/.test(h);
  const tl = title.replace(/&amp;/g, '&').length;
  if (!title) warn(f, 'missing <title>'); else if (tl > 70) warn(f, 'title ' + tl + ' chars: ' + title);
  if (!desc) warn(f, 'missing meta description'); else if (!noindex && (desc.length < 70 || desc.length > 165)) warn(f, 'description ' + desc.length + ' chars');
  if (!canon && !noindex) warn(f, 'missing canonical');
  if (h1s !== 1) warn(f, h1s + ' <h1> elements');
  if (!noindex) { if (titles.has(title)) warn(f, 'duplicate title with ' + titles.get(title)); titles.set(title, f); if (descs.has(desc)) warn(f, 'duplicate description with ' + descs.get(desc)); descs.set(desc, f); }
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); ld++; } catch (e) { warn(f, 'invalid JSON-LD: ' + e.message); } }
  for (const m of h.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/g)) warn(f, 'img without alt');
  for (const m of h.matchAll(/href="(\/[^"#?]*)/g)) {
    const u = m[1]; links++;
    const target = u.endsWith('/') ? join(ROOT, u, 'index.html') : join(ROOT, u);
    if (!existsSync(target)) warn(f, 'broken link ' + u);
  }
}
const uniq = [...new Set(problems)];
console.log('[check] ' + pages + ' pages, ' + links + ' internal links, ' + ld + ' JSON-LD blocks');
if (uniq.length) {
  const groups = new Map();
  for (const p of uniq) { const k = p.replace(/^[^:]+: /, '').replace(/\d+ chars.*/, 'length out of range').replace(/broken link .*/, 'broken link').replace(/duplicate (title|description) with .*/, 'duplicate $1').replace(/^\d+ <h1>.*/, 'h1 count'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  console.log('[check] ' + uniq.length + ' problems:');
  for (const [k, list] of groups) { console.log('  ' + k + ' (' + list.length + ')'); for (const p of list.slice(0, 4)) console.log('    - ' + p); }
  process.exitCode = 1;
} else console.log('[check] no problems found');
