// Rasterises the Natural Earth country shapes in data/map.json (Equal Earth projection) onto the globe grid in
// src/shared/landgrid.mjs. Returns base64 bits: 1 where a grid point falls on land. Used by the build for the dotted globe.
import { gridPoints } from '../../src/shared/landgrid.mjs';

const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
/** Equal Earth projection into data/map.json coordinates (p = map.proj). */
export function equalEarth(lng, lat, p) {
  const l = Math.asin(M * Math.sin((lat * Math.PI) / 180)), l2 = l * l, l6 = l2 * l2 * l2;
  const x = ((lng * Math.PI) / 180) * Math.cos(l) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)));
  const y = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2));
  return [p.tx + p.scale * x, p.ty - p.scale * y];
}

/** Rings of one SVG path made of M, l and z commands. Arc commands (the dots drawn for tiny countries) are skipped. */
export function rings(d) {
  const out = [];
  for (const part of d.split(/(?=M)/)) {
    if (/a/.test(part)) continue;
    const nums = part.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) || [];
    if (nums.length < 6) continue;
    let x = nums[0], y = nums[1]; const ring = [[x, y]];
    for (let i = 2; i + 1 < nums.length; i += 2) { x += nums[i]; y += nums[i + 1]; ring.push([x, y]); }
    out.push(ring);
  }
  return out;
}

export function landBits(map) {
  const shapes = Object.values(map.paths).map((d) => {
    const rs = rings(d); if (!rs.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of rs) for (const [x, y] of r) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { rs, x0, y0, x1, y1 };
  }).filter(Boolean);
  const inside = (px, py) => {
    for (const s of shapes) {
      if (px < s.x0 || px > s.x1 || py < s.y0 || py > s.y1) continue;
      let c = false;
      for (const r of s.rs) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
      }
      if (c) return true;
    }
    return false;
  };
  const bits = [];
  gridPoints((lat, lng) => { const [x, y] = equalEarth(lng, lat, map.proj); bits.push(inside(x, y) ? 1 : 0); });
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((b, i) => { if (b) bytes[i >> 3] |= 1 << (i & 7); });
  return Buffer.from(bytes).toString('base64');
}
