// Renders Open Graph images and PNG icons with a local Chromium-based browser (Edge or Chrome) in headless mode.
// Run: npm run og   (set BROWSER=/path/to/chrome if auto-detection fails). Output goes to static/ and is committed.
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TOOLS } from '../src/render/nav.mjs';
import { icon as lineIcon } from '../src/render/icons.mjs';
import { gridPoints } from '../src/shared/landgrid.mjs';
import { landBits } from './lib/land.mjs';

const CANDIDATES = [process.env.BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const BROWSER = CANDIDATES.find((p) => existsSync(p));
if (!BROWSER) { console.error('No Chromium-based browser found. Set BROWSER=/path/to/chrome'); process.exit(1); }
// A new private temp folder for each run, removed however the script ends.
const TMP = await mkdtemp(join(tmpdir(), 'nomadatlas-og-'));
process.on('exit', () => { try { rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ } });
const map = JSON.parse(await readFile('data/map.json', 'utf8'));
const logo = await readFile('static/favicon.svg', 'utf8');

function render(html, out, w, h, scale = 1) {
  const f = join(TMP, 'page-' + Math.random().toString(36).slice(2) + '.html');
  return writeFile(f, html).then(() => {
    const prof = join(TMP, 'prof-' + Math.random().toString(36).slice(2));
    execFileSync(BROWSER, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--user-data-dir=' + prof, '--virtual-time-budget=4000', '--force-device-scale-factor=' + scale, '--window-size=' + w + ',' + h, '--screenshot=' + resolve(out), pathToFileURL(f).href], { stdio: 'ignore', timeout: 120000 });
  });
}
// A dotted globe for the cards, drawn as SVG from the same land grid as the site's globe.
const land = Buffer.from(landBits(map), 'base64');
function globeSvg({ lat0 = 18, lng0 = -22, r = 290, size = 640 } = {}) {
  const R = Math.PI / 180, c = size / 2, sl = Math.sin(lng0 * R), cl = Math.cos(lng0 * R), sp = Math.sin(lat0 * R), cp = Math.cos(lat0 * R);
  const proj = (lat, lng) => { const p = lat * R, l = lng * R, k = Math.cos(p), x = k * Math.sin(l), y = Math.sin(p), z = k * Math.cos(l); const X = x * cl - z * sl, Z1 = x * sl + z * cl; return [X, y * cp - Z1 * sp, y * sp + Z1 * cp]; };
  let i = 0, dots = '';
  gridPoints((lat, lng) => {
    const on = (land[i >> 3] >> (i & 7)) & 1; i++;
    if (!on) return;
    const [X, Y, Z] = proj(lat, lng);
    if (Z > 0) dots += '<circle cx="' + (c + X * r).toFixed(1) + '" cy="' + (c - Y * r).toFixed(1) + '" r="' + (1.05 + 0.85 * Z).toFixed(2) + '" opacity="' + (0.35 + 0.65 * Z).toFixed(2) + '"/>';
  });
  const hubs = [[38.72, -9.14], [6.24, -75.58], [-33.92, 18.42], [19.43, -99.13], [41.39, 2.17]];
  const pins = hubs.map(([a, b]) => proj(a, b)).filter((p) => p[2] > 0.1).map(([X, Y]) => '<circle cx="' + (c + X * r).toFixed(1) + '" cy="' + (c - Y * r).toFixed(1) + '" r="13" fill="url(#pin)"/><circle cx="' + (c + X * r).toFixed(1) + '" cy="' + (c - Y * r).toFixed(1) + '" r="3.2" fill="#fff"/>').join('');
  return '<svg class="globe" viewBox="0 0 ' + size + ' ' + size + '"><defs>'
    + '<radialGradient id="halo"><stop offset=".86" stop-color="#5eead4" stop-opacity=".28"/><stop offset="1" stop-color="#818cf8" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="body" cx=".34" cy=".3" r=".75"><stop offset="0" stop-color="#1d3b66"/><stop offset=".65" stop-color="#0f2142"/><stop offset="1" stop-color="#0a1630"/></radialGradient>'
    + '<linearGradient id="land" gradientUnits="userSpaceOnUse" x1="' + (c - r) + '" y1="' + (c - r) + '" x2="' + (c + r) + '" y2="' + (c + r) + '"><stop offset="0" stop-color="#5eead4"/><stop offset=".5" stop-color="#93c5fd"/><stop offset="1" stop-color="#c4b5fd"/></linearGradient>'
    + '<radialGradient id="pin"><stop offset="0" stop-color="#fda478" stop-opacity=".95"/><stop offset="1" stop-color="#fda478" stop-opacity="0"/></radialGradient>'
    + '</defs><circle cx="' + c + '" cy="' + c + '" r="' + (r * 1.2) + '" fill="url(#halo)"/><circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="url(#body)" stroke="rgba(165,243,252,.3)"/>'
    + '<g fill="url(#land)">' + dots + '</g>' + pins + '</svg>';
}
const GLOBE = globeSvg();
const card = (title, sub, tool) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Inter:wght@500&family=JetBrains+Mono:wght@500&display=block"><style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0a1124;font-family:Inter,sans-serif;color:#fff}
.bg{position:absolute;inset:0;background:radial-gradient(50% 80% at 0% 0%,rgba(20,184,166,.42),transparent 65%),radial-gradient(45% 78% at 100% 0%,rgba(124,58,237,.5),transparent 65%),radial-gradient(50% 60% at 72% 112%,rgba(236,72,153,.32),transparent 66%),radial-gradient(40% 55% at 18% 110%,rgba(59,130,246,.32),transparent 62%)}
.grid{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.08) 1.2px,transparent 1.5px);background-size:30px 30px}
.globe{position:absolute;right:-170px;top:20px;width:660px;height:660px;overflow:visible}
.wrap{position:absolute;left:72px;top:62px;width:640px;bottom:58px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:14px;font:700 34px 'Bricolage Grotesque';letter-spacing:-.02em}.brand svg{width:52px;height:52px}
.brand b{background:linear-gradient(100deg,#5eead4,#93c5fd 55%,#c4b5fd);-webkit-background-clip:text;background-clip:text;color:transparent}
.tile{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;margin:auto 0 22px;background:linear-gradient(135deg,var(--t1),var(--t2));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 14px 30px -12px var(--t2)}
.tile svg{width:32px;height:32px;fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
h1{font:800 74px/1.02 'Bricolage Grotesque';letter-spacing:-.035em;margin:0 0 18px}
.wrap:not(.has-tile) h1{margin-top:auto}
h1 span{background:linear-gradient(100deg,#5eead4,#93c5fd 40%,#c4b5fd 70%,#fda4af);-webkit-background-clip:text;background-clip:text;color:transparent}
p{font:500 27px/1.35 Inter;color:rgba(226,232,240,.86);margin:0;max-width:600px}
.foot{margin-top:30px;font:500 19px 'JetBrains Mono';letter-spacing:.06em;color:#5eead4;text-transform:uppercase}
</style></head><body><div class="bg"></div><div class="grid"></div>${GLOBE}<div class="wrap${tool ? ' has-tile' : ''}"><div class="brand">${logo}<span>Nomad<b>Atlas</b></span></div>${tool ? '<div class="tile" style="--t1:' + TONES[tool.tone][0] + ';--t2:' + TONES[tool.tone][1] + '">' + lineIcon(tool.icon).s.replace(' class="icon"', '') + '</div>' : ''}<h1>${title}</h1><p>${sub}</p><div class="foot">184 cities · 199 passports · open data</div></div></body></html>`;
const TONES = { teal: ['#2dd4bf', '#0d9488'], emerald: ['#34d399', '#059669'], violet: ['#a78bfa', '#7c3aed'], sky: ['#38bdf8', '#2563eb'], indigo: ['#818cf8', '#4f46e5'], amber: ['#fbbf24', '#ea580c'], coral: ['#fb923c', '#e11d48'], rose: ['#f9a8d4', '#db2777'] };

await mkdir('static/og', { recursive: true });
await render(card('Where should you <span>work from next?</span>', 'Match remote-work cities to your budget, passport, time zone and weather.'), 'static/og/default.png', 1200, 630);
for (const t of TOOLS.filter((t) => t.key !== 'match')) await render(card(t.name, t.desc, t), 'static/og/' + t.key + '.png', 1200, 630);
const icon = (size) => `<!doctype html><html><body style="margin:0;background:transparent"><div style="width:512px;height:512px">${logo.replace('<svg ', '<svg width="512" height="512" ')}</div></body></html>`;
for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon-32.png', 32]]) await render(icon(size), 'static/' + name, 512, 512, size / 512);
console.log('[og] wrote static/og/*.png and icons using ' + BROWSER);
