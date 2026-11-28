// Map images for city, country and month pages: dotted maps in the site's night style, drawn as small SVG files at build
// time from the Natural Earth shapes in data/map.json. Pages describe each image with a plain "spec" (see mapImage in
// src/render/components.mjs); scripts/build.mjs turns specs into files with renderMapCard.
import { equalEarth, rings } from './land.mjs';

const RES = 4; // raster cells per map unit
let R = null;

/** Rasterises every country once (scanline fill, even-odd), so each image is a quick lookup. */
function raster(map) {
  if (R && R.map === map) return R;
  const W = Math.ceil(map.w * RES), H = Math.ceil(map.h * RES) + 1;
  const px = new Uint16Array(W * H);
  const codes = Object.keys(map.paths), main = new Map();
  const dots = new Set(map.dots || []);
  codes.forEach((iso, ci) => {
    const rs = dots.has(iso) ? [] : rings(map.paths[iso]);
    let best = null, y0 = Infinity, y1 = -Infinity;
    for (const r of rs) {
      let a = Infinity, b = Infinity, c = -Infinity, e = -Infinity;
      for (const [x, y] of r) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > e) e = y; }
      if (b < y0) y0 = b; if (e > y1) y1 = e;
      if (!best || (c - a) * (e - b) > (best.x1 - best.x0) * (best.y1 - best.y0)) best = { x0: a, y0: b, x1: c, y1: e };
    }
    for (let row = Math.max(0, Math.floor(y0 * RES)); row <= Math.min(H - 1, Math.ceil(y1 * RES)); row++) {
      const y = (row + 0.5) / RES, xs = [];
      for (const r of rs) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j];
        if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.round(xs[k] * RES)), b = Math.min(W, Math.round(xs[k + 1] * RES));
        px.fill(ci + 1, row * W + a, row * W + Math.max(a, b));
      }
    }
    const cen = map.centroids?.[iso];
    if (!best && cen) {
      // Countries too small for the world map's shapes are drawn as a small disc at their centroid.
      const rad = 0.9 * RES, cx = cen[0] * RES, cy = cen[1] * RES;
      for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++)
        if (x >= 0 && y >= 0 && x < W && y < H && (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) px[y * W + x] = ci + 1;
      best = { x0: cen[0] - 1, y0: cen[1] - 1, x1: cen[0] + 1, y1: cen[1] + 1 };
    }
    if (best) main.set(iso, best);
  });
  return (R = { map, W, H, px, codes, main });
}

/** The country (ISO3) at a point on the rasterised map, or null for sea. Used to sanity-check the maps. */
export function countryAt(map, lat, lng) {
  const r = raster(map), [x, y] = equalEarth(lng, lat, map.proj);
  const v = r.px[Math.round(y * RES) * r.W + Math.round(x * RES)];
  return v ? r.codes[v - 1] : null;
}

const xml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Crop window (map units) for a regional map, 16:10. */
function regionWindow(r, spec, P) {
  const mb = r.main.get(spec.iso) || { x0: 480, y0: 180, x1: 520, y1: 210 };
  const mcx = (mb.x0 + mb.x1) / 2, mcy = (mb.y0 + mb.y1) / 2, ratio = 1.6;
  let cx, cy, w;
  if (spec.focus) {
    const [fx, fy] = P(spec.focus.lat, spec.focus.lng);
    const dist = Math.hypot(fx - mcx, fy - mcy);
    cx = fx; cy = fy;
    w = clamp(Math.max((mb.x1 - mb.x0) * 1.7, (mb.y1 - mb.y0) * 1.7 * ratio, dist * 2.3 + 8), 34, 170);
  } else {
    let x0 = mb.x0, y0 = mb.y0, x1 = mb.x1, y1 = mb.y1;
    for (const p of spec.pins || []) {
      const [x, y] = P(p[0], p[1]);
      if (Math.hypot(x - mcx, y - mcy) > 90) continue; // far-off territories would zoom the map out too far
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
    w = clamp(Math.max((x1 - x0) * 1.5, (y1 - y0) * 1.5 * ratio), 34, 230);
  }
  const h = w / ratio;
  return { x0: cx - w / 2, y0: cy - h / 2, w, h };
}

const BG = (W, H) => '<defs>'
  + '<radialGradient id="a1" cx="0" cy="0" r="' + W * 0.55 + '" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#14b8a6" stop-opacity=".34"/><stop offset="1" stop-color="#14b8a6" stop-opacity="0"/></radialGradient>'
  + '<radialGradient id="a2" cx="' + W + '" cy="0" r="' + W * 0.5 + '" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7c3aed" stop-opacity=".38"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></radialGradient>'
  + '<radialGradient id="a3" cx="' + W * 0.68 + '" cy="' + H * 1.05 + '" r="' + W * 0.45 + '" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ec4899" stop-opacity=".22"/><stop offset="1" stop-color="#ec4899" stop-opacity="0"/></radialGradient>'
  + '<linearGradient id="hl" x1="0" y1="0" x2="' + W + '" y2="' + H + '" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5eead4"/><stop offset=".5" stop-color="#93c5fd"/><stop offset="1" stop-color="#c4b5fd"/></linearGradient>'
  + '<radialGradient id="pin"><stop offset="0" stop-color="#fb923c" stop-opacity=".9"/><stop offset=".35" stop-color="#fb7185" stop-opacity=".35"/><stop offset="1" stop-color="#fb7185" stop-opacity="0"/></radialGradient>'
  + '<radialGradient id="dim"><stop offset="0" stop-color="#e2e8f0" stop-opacity=".5"/><stop offset="1" stop-color="#e2e8f0" stop-opacity="0"/></radialGradient>'
  + '</defs><rect width="' + W + '" height="' + H + '" fill="#0b1430"/><rect width="' + W + '" height="' + H + '" fill="url(#a1)"/><rect width="' + W + '" height="' + H + '" fill="url(#a2)"/><rect width="' + W + '" height="' + H + '" fill="url(#a3)"/>';

/** Dots on a regular grid; each row's runs of land become one dashed line, which keeps the files small. */
function dotLayer(r, win, W, H, S, focusIso) {
  const focus = focusIso ? r.codes.indexOf(focusIso) + 1 : -1;
  const d = ['', '', ''];
  for (let y = S / 2; y < H; y += S) {
    let cls = -1, start = 0, n = 0;
    const flush = () => { if (n) d[cls] += 'M' + start + ' ' + y + 'h' + ((n - 1) * S + 0.01).toFixed(2).replace(/\.?0+$/, ''); };
    for (let x = S / 2; x < W; x += S) {
      const mx = win.x0 + (x / W) * win.w, my = win.y0 + (y / H) * win.h;
      const cx = Math.round(mx * RES), cy = Math.round(my * RES);
      const v = cx < 0 || cy < 0 || cx >= r.W || cy >= r.H ? 0 : r.px[cy * r.W + cx];
      const c = v === 0 ? 0 : v === focus ? 2 : 1;
      if (c === cls) { n++; continue; }
      if (cls >= 0) flush();
      cls = c; start = x; n = 1;
    }
    flush();
  }
  return '<g fill="none" stroke-linecap="round" stroke-dasharray="0 ' + S + '">'
    + '<path d="' + d[0] + '" stroke="#94a3b8" stroke-opacity=".13" stroke-width="' + (S * 0.26).toFixed(1) + '"/>'
    + '<path d="' + d[1] + '" stroke="#94a3b8" stroke-opacity=".5" stroke-width="' + (S * 0.56).toFixed(1) + '"/>'
    + (focus > 0 ? '<path d="' + d[2] + '" stroke="url(#hl)" stroke-width="' + (S * 0.64).toFixed(1) + '"/>' : '')
    + '</g>';
}

function pill(x, y, text, size, W, lift = 0) {
  const w = Math.round(text.length * size * 0.58 + size * 1.5), h = Math.round(size * 1.9);
  const left = x + w + 22 > W ? x - w - 22 : x + 22;
  return '<g transform="translate(' + Math.round(left) + ' ' + Math.round(Math.max(8, y - h / 2 - lift)) + ')"><rect width="' + w + '" height="' + h + '" rx="' + h / 2 + '" fill="#0a1024" fill-opacity=".82" stroke="#fff" stroke-opacity=".22"/>'
    + '<text x="' + Math.round(size * 0.75) + '" y="' + Math.round(h / 2 + size * 0.36) + '" fill="#fff" font-family="Inter, \'Segoe UI\', system-ui, sans-serif" font-weight="600" font-size="' + size + '">' + xml(text) + '</text></g>';
}

/** spec.kind: 'region' (spec.iso highlighted; spec.focus {lat, lng, label} for a city; spec.pins [[lat, lng]] for the
 *  country's cities; spec.others [[lat, lng]] for nearby cities; spec.title; spec.note) or 'world' (spec.pins [[lat, lng]], best first). */
export function renderMapCard(map, spec) {
  const r = raster(map);
  const P = (lat, lng) => equalEarth(lng, lat, map.proj);
  const world = spec.kind === 'world';
  const W = world ? 1000 : 800, H = world ? 470 : 500, S = 8;
  const win = world ? { x0: 0, y0: (map.h - (map.w * H) / W) / 2, w: map.w, h: (map.w * H) / W } : regionWindow(r, spec, P);
  const toPx = (lat, lng) => { const [x, y] = P(lat, lng); return [((x - win.x0) / win.w) * W, ((y - win.y0) / win.h) * H]; };
  const inside = ([x, y]) => x > 6 && y > 6 && x < W - 6 && y < H - 6;
  let out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">'
    + (spec.alt ? '<title>' + xml(spec.alt) + '</title>' : '')
    + '<style>.pulse{transform-box:fill-box;transform-origin:center;animation:p 2.4s ease-out infinite}@keyframes p{from{transform:scale(.6);opacity:.95}to{transform:scale(2.6);opacity:0}}@media (prefers-reduced-motion:reduce){.pulse{animation:none;opacity:.5}}</style>'
    + BG(W, H) + dotLayer(r, win, W, H, S, world ? null : spec.iso);
  for (const p of spec.others || []) { const q = toPx(p[0], p[1]); if (inside(q)) out += '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="8" fill="url(#dim)"/><circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="2.6" fill="#e2e8f0" fill-opacity=".85"/>'; }
  (spec.pins || []).forEach((p, i) => {
    const q = toPx(p[0], p[1]); if (!inside(q)) return;
    const big = world ? i < 10 : true, x = q[0].toFixed(1), y = q[1].toFixed(1);
    out += '<circle cx="' + x + '" cy="' + y + '" r="' + (big ? 18 : 11) + '" fill="url(#pin)"/><circle cx="' + x + '" cy="' + y + '" r="' + (big ? 4 : 2.8) + '" fill="#fff" stroke="#fb923c" stroke-width="' + (big ? 2 : 1.4) + '"/>';
  });
  if (spec.focus) {
    const [x, y] = toPx(spec.focus.lat, spec.focus.lng);
    out += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="46" fill="url(#pin)"/>'
      + '<circle class="pulse" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="12" fill="none" stroke="#fdba74" stroke-width="2"/>'
      + '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="6.5" fill="#fff" stroke="#fb923c" stroke-width="3"/>'
      + pill(x, y, spec.focus.label, 19, W, 30);
  }
  if (spec.title) out += pill(4, 44, spec.title, 21, W);
  const foot = 'font-family="\'JetBrains Mono\', Consolas, monospace" font-size="14" fill="#e2e8f0" fill-opacity=".62"';
  if (spec.note) out += '<text x="22" y="' + (H - 20) + '" ' + foot + '>' + xml(spec.note) + '</text>';
  out += '<text x="' + (W - 22) + '" y="' + (H - 20) + '" text-anchor="end" font-family="Inter, \'Segoe UI\', system-ui, sans-serif" font-weight="700" font-size="15" fill="#fff" fill-opacity=".55">NomadAtlas</text>';
  return out + '</svg>';
}
