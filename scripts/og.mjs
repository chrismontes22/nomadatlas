// Renders Open Graph images and PNG icons with a local Chromium-based browser (Edge or Chrome) in headless mode.
// Run: npm run og   (set BROWSER=/path/to/chrome if auto-detection fails). Output goes to static/ and is committed.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TOOLS } from '../src/render/nav.mjs';

const CANDIDATES = [process.env.BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const BROWSER = CANDIDATES.find((p) => existsSync(p));
if (!BROWSER) { console.error('No Chromium-based browser found. Set BROWSER=/path/to/chrome'); process.exit(1); }
const TMP = join(tmpdir(), 'nomadatlas-og'); await mkdir(TMP, { recursive: true });
const map = JSON.parse(await readFile('data/map.json', 'utf8'));
const logo = await readFile('static/favicon.svg', 'utf8');

function render(html, out, w, h, scale = 1) {
  const f = join(TMP, 'page-' + Math.random().toString(36).slice(2) + '.html');
  return writeFile(f, html).then(() => {
    const prof = join(TMP, 'prof-' + Math.random().toString(36).slice(2));
    execFileSync(BROWSER, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--user-data-dir=' + prof, '--virtual-time-budget=4000', '--force-device-scale-factor=' + scale, '--window-size=' + w + ',' + h, '--screenshot=' + resolve(out), pathToFileURL(f).href], { stdio: 'ignore' });
  });
}
const paths = Object.values(map.paths).map((d) => '<path d="' + d + '"/>').join('');
const card = (title, sub) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Inter:wght@500&family=JetBrains+Mono:wght@500&display=block"><style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#f2f4f1;font-family:Inter,sans-serif;color:#12202a}
.map{position:absolute;right:-120px;top:70px;width:980px;opacity:.9}.map path{fill:#dbe3df;stroke:#f2f4f1;stroke-width:.6}
.grid{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(18,32,42,.05) 0 1px,transparent 1px 60px),repeating-linear-gradient(90deg,rgba(18,32,42,.05) 0 1px,transparent 1px 60px)}
.wrap{position:absolute;left:72px;top:64px;right:72px;bottom:60px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:14px;font:700 34px 'Bricolage Grotesque';letter-spacing:-.02em}.brand svg{width:52px;height:52px}
h1{font:800 76px/1.02 'Bricolage Grotesque';letter-spacing:-.035em;margin:auto 0 18px;max-width:900px}
p{font:500 28px/1.35 Inter;color:#435260;margin:0;max-width:820px}
.foot{margin-top:34px;font:500 20px 'JetBrains Mono';letter-spacing:.04em;color:#0c6870;text-transform:uppercase}
</style></head><body><div class="grid"></div><svg class="map" viewBox="0 0 ${map.w} ${map.h}">${paths}</svg><div class="wrap"><div class="brand">${logo}<span>Nomad<b>Atlas</b></span></div><h1>${title}</h1><p>${sub}</p><div class="foot">184 cities · 199 passports · open data</div></div></body></html>`;

await mkdir('static/og', { recursive: true });
await render(card('Where should you work from next?', 'Match remote-work cities to your budget, passport, time zone and weather.'), 'static/og/default.png', 1200, 630);
for (const t of TOOLS.filter((t) => t.key !== 'match')) await render(card(t.name, t.desc), 'static/og/' + t.key + '.png', 1200, 630);
const icon = (size) => `<!doctype html><html><body style="margin:0;background:transparent"><div style="width:512px;height:512px">${logo.replace('<svg ', '<svg width="512" height="512" ')}</div></body></html>`;
for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon-32.png', 32]]) await render(icon(size), 'static/' + name, 512, 512, size / 512);
await rm(TMP, { recursive: true, force: true });
console.log('[og] wrote static/og/*.png and icons using ' + BROWSER);
