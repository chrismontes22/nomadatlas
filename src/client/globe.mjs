// Dotted globe drawn on a canvas: land dots from the build-time land grid (see scripts/lib/land.mjs), orthographic
// projection, optional city markers and animated flight arcs between them, and optionally real daylight: the night side in
// shadow, the golden-hour band in warm light and city lights after dark. Used by the home-page hero.
import { gridPoints } from '../shared/landgrid.mjs';
import { subsolar } from '../shared/sun.mjs';
import { getCtx } from './ctx.mjs';

const LAND = typeof __LAND__ !== 'undefined' ? __LAND__ : '';
const RAD = Math.PI / 180, TAU = Math.PI * 2;
let PTS = null;

/** Unit vectors for land points, plus a thinned set of sea points for a faint texture. */
function points() {
  if (PTS) return PTS;
  let bin = '';
  try { bin = atob(LAND); } catch { /* no land data: sea texture only */ }
  const land = [], sea = []; let i = 0, s = 0;
  gridPoints((lat, lng) => {
    const on = bin ? (bin.charCodeAt(i >> 3) >> (i & 7)) & 1 : 0; i++;
    const p = lat * RAD, l = lng * RAD, c = Math.cos(p);
    if (on) land.push(c * Math.sin(l), Math.sin(p), c * Math.cos(l));
    else if (s++ % 3 === 0) sea.push(c * Math.sin(l), Math.sin(p), c * Math.cos(l));
  });
  return (PTS = { land: new Float32Array(land), sea: new Float32Array(sea) });
}
const vec = (lat, lng) => { const p = lat * RAD, l = lng * RAD, c = Math.cos(p); return [c * Math.sin(l), Math.sin(p), c * Math.cos(l)]; };
const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3));

/** Great-circle path from a to b, lifted off the surface in the middle. */
function arcPath(a, b, n = 48) {
  const A = vec(a.lat, a.lng), B = vec(b.lat, b.lng);
  const dot = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])), w = Math.acos(dot), sw = Math.sin(w) || 1;
  const lift = 0.06 + 0.22 * (w / Math.PI), out = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, f0 = Math.sin((1 - t) * w) / sw, f1 = Math.sin(t * w) / sw, h = 1 + lift * Math.sin(Math.PI * t);
    out.push([(f0 * A[0] + f1 * B[0]) * h, (f0 * A[1] + f1 * B[1]) * h, (f0 * A[2] + f1 * B[2]) * h]);
  }
  return out;
}

/**
 * opts: layout(w, h) -> {cx, cy, r}; view {lat, lng}; spin (degrees per second); dot (px); seaAlpha;
 * paint(ctx, g) -> CanvasGradient for land dots; body(ctx, g) and rim(ctx, g, t, project) draw the sphere under and over the
 * dots (project(x, y, z) turns a unit vector into view coordinates [X, Y, Z], visible when Z > 0);
 * markers [{lat, lng, label}]; arcs (bool); markerColor; arcColor; still (no animation);
 * sun() -> unit vector towards the sun (turns on day and night shading); lights [{lat, lng}] glow on the night side.
 */
export function createGlobe(canvas, opts) {
  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas'), octx = off.getContext('2d');
  const { land, sea } = points();
  const view = { lat: opts.view?.lat ?? 20, lng: opts.view?.lng ?? 0 };
  let target = null, raf = 0, last = 0, running = false, w = 0, h = 0, dpr = 1, g = null, grad = null;
  let markers = [], arcs = [], arcT0 = 0, lights = [], glow = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.max(1, rect.width); h = Math.max(1, rect.height);
    for (const c of [canvas, off]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    g = opts.layout(w, h);
    grad = opts.paint(octx, g);
    if (!running) draw(performance.now());
  }
  function setMarkers(list) {
    markers = (list || []).filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)).map((m) => ({ ...m, v: vec(m.lat, m.lng) }));
    arcs = opts.arcs ? markers.slice(0, -1).map((m, i) => arcPath(m, markers[i + 1])) : [];
    arcT0 = performance.now();
  }
  function setLights(list) { lights = (list || []).filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)).map((m) => vec(m.lat, m.lng)); if (!running) draw(performance.now()); }
  // A soft glow drawn once and stamped for every city light: far cheaper than a new gradient per light per frame.
  function glowSprite() {
    if (glow) return glow;
    const s = 48, c = document.createElement('canvas'); c.width = c.height = s;
    const x = c.getContext('2d'), gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,244,214,1)'); gr.addColorStop(0.18, 'rgba(255,214,150,.75)'); gr.addColorStop(0.5, 'rgba(255,170,90,.2)'); gr.addColorStop(1, 'rgba(255,150,80,0)');
    x.fillStyle = gr; x.fillRect(0, 0, s, s);
    return (glow = c);
  }
  function focus(lat, lng) {
    target = { lat: Math.max(-35, Math.min(45, lat * 0.6 + 8)), lng };
    if (opts.still) { view.lat = target.lat; view.lng = target.lng; target = null; draw(performance.now()); }
  }

  function draw(now) {
    if (!g) return;
    const { cx, cy, r } = g;
    const sl = Math.sin(view.lng * RAD), cl = Math.cos(view.lng * RAD), sp = Math.sin(view.lat * RAD), cp = Math.cos(view.lat * RAD);
    const project = (x, y, z) => { const X = x * cl - z * sl, Z1 = x * sl + z * cl; return [X, y * cp - Z1 * sp, y * sp + Z1 * cp]; };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    opts.body?.(ctx, g);
    // Daylight: S points at the sun. A dot is in daylight when it faces S (dot product above 0.1, the sun more than about 6°
    // up), in golden hour within 0.1 of the terminator, and in night beyond it.
    const S = opts.sun ? opts.sun() : null;
    const lit = (x, y, z) => (S ? x * S[0] + y * S[1] + z * S[2] : 1);
    if (S) nightShade(ctx, cx, cy, r, project(S[0], S[1], S[2]));

    octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.clearRect(0, 0, w, h);
    if (opts.seaAlpha) {
      const day = new Path2D(), night = new Path2D(), s = Math.max(0.8, r / 260);
      for (let i = 0; i < sea.length; i += 3) {
        const [X, Y, Z] = project(sea[i], sea[i + 1], sea[i + 2]);
        if (Z > 0.05) (lit(sea[i], sea[i + 1], sea[i + 2]) < -0.05 ? night : day).rect(cx + X * r - s / 2, cy - Y * r - s / 2, s, s);
      }
      octx.fillStyle = 'rgba(255,255,255,' + opts.seaAlpha + ')'; octx.fill(day);
      octx.fillStyle = 'rgba(255,255,255,' + opts.seaAlpha * 0.4 + ')'; octx.fill(night);
    }
    const DEPTH = [0.35, 0.55, 0.78, 1], LIGHT = S ? [1, 0.8, 0.3] : [1];
    const dot = opts.dot ?? Math.max(1, r / 190), buckets = DEPTH.map(() => LIGHT.map(() => new Path2D())), dusk = new Path2D();
    for (let i = 0; i < land.length; i += 3) {
      const [X, Y, Z] = project(land[i], land[i + 1], land[i + 2]);
      if (Z <= 0) continue;
      const px = cx + X * r, py = cy - Y * r, rr = dot * (0.5 + 0.5 * Z), b = Z > 0.75 ? 3 : Z > 0.5 ? 2 : Z > 0.25 ? 1 : 0;
      let l = 0;
      if (S) { const L = lit(land[i], land[i + 1], land[i + 2]); l = L > 0.1 ? 0 : L > -0.1 ? 1 : 2; if (l === 1) { dusk.moveTo(px + rr, py); dusk.arc(px, py, rr, 0, TAU); } }
      buckets[b][l].moveTo(px + rr, py); buckets[b][l].arc(px, py, rr, 0, TAU);
    }
    DEPTH.forEach((a, b) => LIGHT.forEach((k, l) => { octx.fillStyle = 'rgba(255,255,255,' + a * k + ')'; octx.fill(buckets[b][l]); }));
    octx.globalCompositeOperation = 'source-atop'; octx.fillStyle = grad; octx.fillRect(0, 0, w, h); octx.globalCompositeOperation = 'source-over';
    ctx.drawImage(off, 0, 0, w, h);
    if (S) {
      // Golden hour sweeping round the planet, then city lights on the night side.
      ctx.fillStyle = opts.duskColor || 'rgba(253,186,116,.72)'; ctx.fill(dusk);
      if (lights.length) {
        const sp = glowSprite(), base = Math.max(5, r / 34);
        for (let i = 0; i < lights.length; i++) {
          const v = lights[i], L = lit(v[0], v[1], v[2]);
          if (L > 0.03) continue;
          const [X, Y, Z] = project(v[0], v[1], v[2]);
          if (Z <= 0.04) continue;
          const tw = opts.still ? 1 : 0.72 + 0.28 * Math.sin(now / 650 + i * 2.3), rad = base * (0.6 + 0.4 * Z);
          ctx.globalAlpha = Math.min(1, (0.03 - L) / 0.12) * Math.min(1, Z * 2.5) * tw;
          ctx.drawImage(sp, cx + X * r - rad, cy - Y * r - rad, rad * 2, rad * 2);
        }
        ctx.globalAlpha = 1;
      }
    }
    opts.rim?.(ctx, g, now, project);

    // Flight arcs, drawn one after another, held, then faded and replayed.
    if (arcs.length) {
      const per = 1300, gap = 250, hold = 2200, fade = 700, cycle = arcs.length * (per + gap) + hold + fade;
      const t = opts.still ? cycle - fade - 1 : (now - arcT0) % cycle;
      const fadeA = t > cycle - fade ? 1 - (t - (cycle - fade)) / fade : 1;
      ctx.lineWidth = Math.max(1.2, r / 200); ctx.lineCap = 'round';
      arcs.forEach((pts, i) => {
        const p = ease((t - i * (per + gap)) / per); if (p <= 0) return;
        const end = Math.max(1, Math.round(p * (pts.length - 1)));
        ctx.beginPath(); let pen = false, head = null;
        for (let k = 0; k <= end; k++) {
          const [X, Y, Z] = project(pts[k][0], pts[k][1], pts[k][2]);
          const vis = Z > 0 || X * X + Y * Y > 1;
          if (vis) { const px = cx + X * r, py = cy - Y * r; pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py); pen = true; head = [px, py]; } else { pen = false; head = null; }
        }
        ctx.strokeStyle = opts.arcColor(0.85 * fadeA); ctx.stroke();
        if (p < 1 && head) {
          const hg = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], 9);
          hg.addColorStop(0, opts.arcColor(fadeA)); hg.addColorStop(1, opts.arcColor(0));
          ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(head[0], head[1], 9, 0, TAU); ctx.fill();
        }
      });
    }
    // City markers with a pulse ring; the first one can carry a label.
    markers.forEach((m, i) => {
      const [X, Y, Z] = project(m.v[0], m.v[1], m.v[2]);
      if (Z <= 0.02) return;
      const px = cx + X * r, py = cy - Y * r, a = Math.min(1, Z * 3), big = i === 0 && (typeof opts.labelFirst === 'function' ? opts.labelFirst() : opts.labelFirst);
      const ph = opts.still ? 0.35 : ((now / 2000 + i * 0.37) % 1);
      ctx.strokeStyle = opts.markerColor((1 - ph) * 0.8 * a); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(px, py, (big ? 4 : 3) + ph * (big ? 16 : 11), 0, TAU); ctx.stroke();
      const mg = ctx.createRadialGradient(px, py, 0, px, py, big ? 12 : 8);
      mg.addColorStop(0, opts.markerColor(0.9 * a)); mg.addColorStop(1, opts.markerColor(0));
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(px, py, big ? 12 : 8, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + a + ')'; ctx.beginPath(); ctx.arc(px, py, big ? 2.8 : 2, 0, TAU); ctx.fill();
      if (big && m.label && Z > 0.15) {
        ctx.font = '600 12.5px Inter, system-ui, sans-serif';
        const tw = ctx.measureText(m.label).width, bx = Math.min(px + 14, w - tw - 26), by = py - 34;
        ctx.globalAlpha = Math.min(1, (Z - 0.15) * 4);
        ctx.fillStyle = 'rgba(10,16,36,.78)'; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, tw + 22, 24, 12) : ctx.rect(bx, by, tw + 22, 24); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(m.label, bx + 11, by + 12.5);
        ctx.globalAlpha = 1;
      }
    });
  }

  function tick(now) {
    if (!running) return;
    if (!canvas.isConnected) { stop(); return; }
    const dt = Math.min(0.064, (now - (last || now)) / 1000); last = now;
    if (target) {
      const k = 1 - Math.exp(-dt * 2.6), dl = wrap180(target.lng - view.lng);
      view.lng += dl * k; view.lat += (target.lat - view.lat) * k;
      if (Math.abs(dl) < 0.05 && Math.abs(target.lat - view.lat) < 0.05) target = null;
    } else if (opts.spin) view.lng = wrap180(view.lng - opts.spin * dt);
    draw(now);
    raf = requestAnimationFrame(tick);
  }
  function start() { if (running || opts.still) { draw(performance.now()); return; } running = true; last = 0; raf = requestAnimationFrame(tick); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  setMarkers(opts.markers);
  resize();
  return { start, stop, resize, setMarkers, setLights, focus, draw: () => draw(performance.now()), get running() { return running; } };
}

/**
 * Darkens the night side of the sphere. On an orthographic view the terminator is half an ellipse: along the direction of the
 * sun (u) it crosses at -sz, and it meets the rim where the perpendicular axis does. sv is the sun in view coordinates.
 * Three stacked layers with slightly different edges give it a soft dusk instead of a hard line.
 */
function nightShade(ctx, cx, cy, r, sv) {
  const [sx, sy, sz] = sv, m = Math.hypot(sx, sy);
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  if (m < 1e-3) {
    if (sz < 0) { ctx.fillStyle = 'rgba(2,6,23,.55)'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
    ctx.restore(); return;
  }
  const ux = sx / m, uy = -sy / m, aw = Math.atan2(ux, -uy);
  for (const [k, a] of [[-0.09, 0.2], [0, 0.2], [0.09, 0.2]]) {
    const e = -sz + k, p = new Path2D();
    for (let i = 0; i <= 40; i++) {
      const y = -1 + i / 20, x = e * Math.sqrt(Math.max(0, 1 - y * y));
      const X = cx + r * (x * ux - y * uy), Y = cy + r * (x * uy + y * ux);
      i ? p.lineTo(X, Y) : p.moveTo(X, Y);
    }
    p.arc(cx, cy, r * 1.02, aw, aw + Math.PI, false);
    p.closePath();
    ctx.fillStyle = 'rgba(2,6,23,' + a + ')'; ctx.fill(p);
  }
  ctx.restore();
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The home-page hero globe: shows the current top matches, turns to face the best one when the finder changes, and lights
 *  the planet as it is right now, with the night side in shadow and every NomadAtlas city glowing after dark. */
export function mountHeroGlobe(canvas) {
  if (canvas.dataset.ready) return; canvas.dataset.ready = '1';
  let initial = [];
  try { initial = JSON.parse(canvas.dataset.points || '[]').map(([lat, lng, label]) => ({ lat, lng, label })); } catch { /* keep empty */ }
  if (window.__naMatches) initial = window.__naMatches;
  const still = reduceMotion();
  const narrow = matchMedia('(max-width: 900px)'); // on phones the globe sits behind the headline, so it carries no label
  // The sun moves a quarter of a degree a minute, so its position is worked out at most twice a minute.
  let sunAt = 0, sunVec = null;
  const sun = () => { const t = Date.now(); if (!sunVec || t - sunAt > 30000) { const s = subsolar(new Date(t)); sunVec = vec(s.lat, s.lng); sunAt = t; } return sunVec; };
  const globe = createGlobe(canvas, {
    still, spin: 5, arcs: true, labelFirst: () => !narrow.matches, seaAlpha: 0.13, sun,
    view: initial[0] ? { lat: Math.max(-35, Math.min(45, initial[0].lat * 0.6 + 8)), lng: initial[0].lng + 25 } : { lat: 18, lng: 10 },
    markers: initial,
    layout: (w, h) => ({ cx: w / 2, cy: h / 2, r: Math.min(w, h) * 0.43 }),
    paint: (c, { cx, cy, r }) => { const gr = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gr.addColorStop(0, '#5eead4'); gr.addColorStop(0.5, '#93c5fd'); gr.addColorStop(1, '#c4b5fd'); return gr; },
    body: (c, { cx, cy, r }) => {
      const halo = c.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.22);
      halo.addColorStop(0, 'rgba(94,234,212,.26)'); halo.addColorStop(0.45, 'rgba(129,140,248,.10)'); halo.addColorStop(1, 'rgba(129,140,248,0)');
      c.fillStyle = halo; c.beginPath(); c.arc(cx, cy, r * 1.22, 0, TAU); c.fill();
      const s = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
      s.addColorStop(0, '#1d3b66'); s.addColorStop(0.65, '#0f2142'); s.addColorStop(1, '#0a1630');
      c.fillStyle = s; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    },
    rim: (c, { cx, cy, r }) => {
      const sh = c.createRadialGradient(cx - r * 0.45, cy - r * 0.5, 0, cx, cy, r * 1.02);
      sh.addColorStop(0, 'rgba(255,255,255,.07)'); sh.addColorStop(0.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(3,7,24,.5)');
      c.fillStyle = sh; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(165,243,252,.28)'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
    },
    markerColor: (a) => 'rgba(253,164,120,' + a + ')',
    arcColor: (a) => 'rgba(255,214,170,' + a + ')',
  });
  canvas.classList.add('is-live');
  const ro = new ResizeObserver(() => globe.resize()); ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? globe.start() : globe.stop()));
  io.observe(canvas);
  document.addEventListener('na:matches', (e) => { if (!canvas.isConnected) return; globe.setMarkers(e.detail); if (e.detail[0]) globe.focus(e.detail[0].lat, e.detail[0].lng); });
  // City lights: every city in the atlas. The destination finder on the same page loads this data anyway.
  getCtx().then((ctx) => globe.setLights(ctx.db.cities)).catch(() => { /* no lights, the globe still works */ });
}
