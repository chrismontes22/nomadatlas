// Static site build: renders every page to dist/ with full SEO metadata. Run: npm run build
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import * as esbuild from 'esbuild';
import { SITE } from '../site.config.mjs';
import { createDb } from '../src/shared/db.mjs';
import { allPaths, renderPath, notFoundPage } from '../src/render/pages/index.mjs';
import { documentHtml } from '../src/render/layout.mjs';

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
  const core = JSON.stringify({ countries: JSON.parse(txt.countries), cities: JSON.parse(txt.cities), rates: JSON.parse(txt.rates), emissions: JSON.parse(txt.emissions), meta: metaLite });
  const version = createHash('sha1').update(core + txt.visa + txt.map).digest('hex').slice(0, 10);
  await put(OUT + '/data/core.json', core);
  await put(OUT + '/data/visa.json', txt.visa);
  await put(OUT + '/data/map.json', txt.map);

  // Assets
  const cssRes = await esbuild.build({ entryPoints: ['src/styles/site.css'], bundle: true, minify: true, write: false, outdir: OUT + '/assets', entryNames: 'site-[hash]', logLevel: 'warning' });
  const cssFile = cssRes.outputFiles[0]; await put(cssFile.path, cssFile.contents);
  const jsRes = await esbuild.build({ entryPoints: ['src/client/main.mjs'], bundle: true, splitting: true, format: 'esm', minify: true, target: 'es2020', outdir: OUT + '/assets', entryNames: 'main-[hash]', chunkNames: 'chunk-[hash]', define: { __DATA_VERSION__: JSON.stringify(version) }, metafile: true, logLevel: 'warning' });
  const jsOut = Object.entries(jsRes.metafile.outputs).find(([, o]) => o.entryPoint === 'src/client/main.mjs')[0];
  const assets = { css: '/assets/' + cssFile.path.split(/[\\/]/).pop(), js: '/' + jsOut.replace(/\\/g, '/').replace(/^dist\//, '') };

  // Pages
  const db = createDb({ countries: JSON.parse(txt.countries), cities: JSON.parse(txt.cities), visa: JSON.parse(txt.visa), rates: JSON.parse(txt.rates), emissions: JSON.parse(txt.emissions), meta: JSON.parse(txt.meta) });
  const ctx = makeCtx(db, { assets });
  const paths = allPaths(db);
  const sitemap = [];
  let bytes = 0;
  for (const path of paths) {
    const page = renderPath(ctx, path);
    if (!page) throw new Error('No page for ' + path);
    const html = documentHtml(ctx, page);
    bytes += html.length;
    await put(OUT + (path.endsWith('/') ? path + 'index.html' : path), html);
    if (!page.noindex) sitemap.push({ loc: SITE.url + path, priority: page.priority ?? 0.5, changefreq: page.changefreq || 'monthly' });
  }
  await put(OUT + '/404.html', documentHtml(ctx, notFoundPage(ctx)));

  // SEO files
  await put(OUT + '/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + sitemap.map((u) => '  <url><loc>' + u.loc + '</loc><lastmod>' + ctx.buildDate + '</lastmod><changefreq>' + u.changefreq + '</changefreq><priority>' + u.priority.toFixed(1) + '</priority></url>').join('\n') + '\n</urlset>\n');
  await put(OUT + '/robots.txt', 'User-agent: *\nAllow: /\nDisallow: /data/\n\nSitemap: ' + SITE.url + '/sitemap.xml\n');
  await put(OUT + '/site.webmanifest', JSON.stringify({ name: SITE.name, short_name: SITE.name, description: SITE.tagline, start_url: '/', display: 'standalone', background_color: '#f2f4f1', theme_color: '#0c6870', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }, null, 2));
  await put(OUT + '/_headers', '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/data/*\n  Cache-Control: public, max-age=3600\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
  if (existsSync('static')) await cp('static', OUT, { recursive: true });
  for (const f of ['favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og/default.png']) if (!existsSync(join(OUT, f))) console.warn('[build] missing static/' + f + ' (run npm run og to generate images)');
  console.log('[build] ' + paths.length + ' pages, ' + (bytes / 1e6).toFixed(1) + ' MB HTML, data v' + version + ', ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) main().catch((e) => { console.error(e); process.exit(1); });
