// Static site build: renders every page to dist/ with full SEO metadata. Run: npm run build
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import * as esbuild from 'esbuild';
import { SITE } from '../site.config.mjs';
import { createDb } from '../src/shared/db.mjs';
import { allPaths, renderPath, notFoundPage } from '../src/render/pages/index.mjs';
import { documentHtml, THEME_SCRIPT } from '../src/render/layout.mjs';
import { landBits } from './lib/land.mjs';
import { renderMapCard } from './lib/mapcards.mjs';

const OUT = 'dist';
const J = async (f) => readFile('data/' + f + '.json', 'utf8');
const put = async (p, s) => { await mkdir(dirname(p), { recursive: true }); await writeFile(p, s); };

export async function loadData() {
  const txt = Object.fromEntries(await Promise.all(['countries', 'cities', 'visa', 'rates', 'emissions', 'meta', 'map'].map(async (k) => [k, await J(k)])));
  return txt;
}
export function makeCtx(db, extra = {}) {
  const now = new Date();
  return { site: SITE, db, mode: 'static', link: (p) => p, buildDate: now.toISOString().slice(0, 10), buildMonth: now.getUTCMonth(), year: now.getUTCFullYear(), ...extra };
}

async function main() {
  const t0 = Date.now();
  if (SITE.url.includes('example.com')) console.warn('[build] SITE_URL is not set; canonical URLs use ' + SITE.url + '. Set SITE_URL=https://your-domain before deploying.');
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT + '/assets', { recursive: true });
  const txt = await loadData();
  // Client data (written before createDb mutates the objects)
  const metaLite = JSON.parse(txt.meta); delete metaLite.sources;
  // Pipeline diagnostics no page reads (they stay in data/cities.json and data/countries.json for checking the numbers).
  const slimCity = ({ climAdj, coastal, gridElev, tempSource, ...c }) => ({ ...c, clim: (({ wetDays, ...cl }) => cl)(c.clim) });
  const slimCountry = (k) => (k.pli ? { ...k, pli: (({ clothing, ...p }) => p)(k.pli) } : k);
  const core = JSON.stringify({ countries: JSON.parse(txt.countries).map(slimCountry), cities: JSON.parse(txt.cities).map(slimCity), rates: JSON.parse(txt.rates), emissions: JSON.parse(txt.emissions), meta: metaLite });
  const version = createHash('sha1').update(core + txt.visa + txt.map).digest('hex').slice(0, 10);
  await put(OUT + '/data/core.json', core);
  await put(OUT + '/data/visa.json', txt.visa);
  await put(OUT + '/data/map.json', txt.map);

  // Assets
  const cssRes = await esbuild.build({ entryPoints: ['src/styles/site.css'], bundle: true, minify: true, write: false, outdir: OUT + '/assets', entryNames: 'site-[hash]', logLevel: 'warning' });
  const cssFile = cssRes.outputFiles[0]; await put(cssFile.path, cssFile.contents);
  const land = JSON.stringify(landBits(JSON.parse(txt.map)));
  const jsRes = await esbuild.build({ entryPoints: ['src/client/main.mjs'], bundle: true, splitting: true, format: 'esm', minify: true, target: 'es2020', outdir: OUT + '/assets', entryNames: 'main-[hash]', chunkNames: 'chunk-[hash]', define: { __DATA_VERSION__: JSON.stringify(version), __LAND__: land }, metafile: true, logLevel: 'warning' });
  const outFor = (res, entry) => '/' + Object.entries(res.metafile.outputs).find(([, o]) => o.entryPoint === entry)[0].replace(/\\/g, '/').replace(/^dist\//, '');
  const assets = { css: '/assets/' + cssFile.path.split(/[\\/]/).pop(), js: outFor(jsRes, 'src/client/main.mjs') };

  // Pages
  const db = createDb({ countries: JSON.parse(txt.countries), cities: JSON.parse(txt.cities), visa: JSON.parse(txt.visa), rates: JSON.parse(txt.rates), emissions: JSON.parse(txt.emissions), meta: JSON.parse(txt.meta) });
  const ctx = makeCtx(db, { assets });
  const paths = allPaths(db);
  const sitemap = [];
  let bytes = 0;
  const mapJson = JSON.parse(txt.map), images = new Set();
  for (const path of paths) {
    const page = renderPath(ctx, path);
    if (!page) throw new Error('No page for ' + path);
    const html = documentHtml(ctx, page);
    bytes += html.length;
    await put(OUT + (path.endsWith('/') ? path + 'index.html' : path), html);
    // Map images for city, country and month pages (scripts/lib/mapcards.mjs)
    for (const img of page.images || []) if (!images.has(img.src)) { images.add(img.src); await put(OUT + img.src, renderMapCard(mapJson, img.spec)); }
    if (!page.noindex) sitemap.push({ loc: SITE.url + path, priority: page.priority ?? 0.5, changefreq: page.changefreq || 'monthly', images: (page.images || []).map((i) => SITE.url + i.src) });
  }
  await put(OUT + '/404.html', documentHtml(ctx, notFoundPage(ctx)));

  // SEO files
  // Image entries help search engines find the map images (Google image sitemap extension).
  await put(OUT + '/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + sitemap.map((u) => '  <url><loc>' + u.loc + '</loc><lastmod>' + ctx.buildDate + '</lastmod><changefreq>' + u.changefreq + '</changefreq><priority>' + u.priority.toFixed(1) + '</priority>' + u.images.map((i) => '<image:image><image:loc>' + i + '</image:loc></image:image>').join('') + '</url>').join('\n') + '\n</urlset>\n');
  // /data/ stays crawlable: search engines render pages with JavaScript and the tools and maps load these files. The
  // X-Robots-Tag header in _headers keeps the JSON itself out of search results.
  await put(OUT + '/robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: ' + SITE.url + '/sitemap.xml\n');
  await put(OUT + '/site.webmanifest', JSON.stringify({ name: SITE.name, short_name: SITE.name, description: SITE.tagline, start_url: '/', display: 'standalone', background_color: '#f7f6f2', theme_color: '#0a1124', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }, null, 2));
  // Security headers (read by Netlify and Cloudflare Pages; npm run serve sends them too). The page's only inline script is the
  // theme snippet, allowed by its hash; JSON-LD and chart data are data blocks, which the policy does not block.
  const csp = ["default-src 'self'", "script-src 'self' 'sha256-" + createHash('sha256').update(THEME_SCRIPT).digest('base64') + "'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data:", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join('; ');
  await put(OUT + '/_headers', [
    '/assets/*', '  Cache-Control: public, max-age=31536000, immutable',
    '/data/*', '  Cache-Control: public, max-age=3600', '  X-Robots-Tag: noindex',
    '/img/*', '  Cache-Control: public, max-age=86400',
    '/*', '  X-Content-Type-Options: nosniff', '  Referrer-Policy: strict-origin-when-cross-origin', '  Content-Security-Policy: ' + csp,
    '  X-Frame-Options: DENY', '  Permissions-Policy: camera=(), microphone=(), geolocation=()', '  Strict-Transport-Security: max-age=31536000',
  ].join('\n') + '\n');
  if (existsSync('static')) await cp('static', OUT, { recursive: true });
  for (const f of ['favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og/default.png']) if (!existsSync(join(OUT, f))) console.warn('[build] missing static/' + f + ' (run npm run og to generate images)');
  console.log('[build] ' + images.size + ' map images');
  console.log('[build] ' + paths.length + ' pages, ' + (bytes / 1e6).toFixed(1) + ' MB HTML, data v' + version + ', ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) main().catch((e) => { console.error(e); process.exit(1); });
