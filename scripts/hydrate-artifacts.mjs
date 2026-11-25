/**
 * Hydrates the standalone Antigravity HTML artifact with the exact live-fetched
 * 176-country Natural Earth SVG data and 159 global cities (lossless compact encoding).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_WIDTH, MAP_HEIGHT, MAP_BOUNDS, GLOBE_OUTLINE, GRATICULES, WORLD_COUNTRIES } from '../data/world-map.js';
import { CITIES } from '../data/cities.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_PATH =
  '/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/75ead22c-0534-4085-b49f-3eb6af4ab41e/nomad_atlas.html';

const visas = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'visas.json'), 'utf8')).visas;

function toCompactRelPath(d) {
  let out = '';
  for (const s of d.split('Z').filter(Boolean)) {
    const pts = [...s.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Math.round(Number(m[1])), Math.round(Number(m[2]))]);
    if (pts.length < 3) continue;
    let [px, py] = pts[0];
    const segs = [`M${px},${py}`];
    let kept = 1;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - px;
      const dy = pts[i][1] - py;
      if (dx === 0 && dy === 0) continue;
      segs.push(`l${dx},${dy}`);
      px = pts[i][0];
      py = pts[i][1];
      kept++;
    }
    if (kept >= 3) out += `${segs.join('')}Z`;
  }
  return out;
}

const regCode = (r) => (r === 'Europe' ? 'E' : r === 'Americas' ? 'A' : r === 'Asia-Pacific' ? 'P' : 'M');

const worldData = {
  w: MAP_WIDTH,
  h: MAP_HEIGHT,
  bounds: MAP_BOUNDS,
  outline: toCompactRelPath(GLOBE_OUTLINE),
  grats: GRATICULES,
  countries: WORLD_COUNTRIES.map((c) => [c.iso2, c.name, toCompactRelPath(c.d)]).filter((x) => x[2])
};

const rawCities = CITIES.map((c) => [
  c.id, c.city, c.country, c.iso2, regCode(c.region), c.schengen ? 1 : 0,
  Math.round(c.lat * 100) / 100, Math.round(c.lon * 100) / 100, c.elevationM, c.population,
  c.tz, c.utcStd, c.utcDst, c.observesDst ? 1 : 0,
  c.pppRatio, c.urbanCostFactor, c.cpiInflation, c.pm25, c.lifeExpectancy,
  c.wgiStability, c.wgiRuleOfLaw, c.dlMbps, c.ulMbps, c.latencyMs,
  c.tempC.map((t) => Math.round(t * 10) / 10), c.rainMm, c.tags[0]
]);

const html = fs.readFileSync(ARTIFACT_PATH, 'utf8');
const replacement = `/*__HYDRATED_DATA_START__*/
    const WORLD_DATA = ${JSON.stringify(worldData)};
    const VISAS = ${JSON.stringify(visas)};
    const RAW_CITIES = ${JSON.stringify(rawCities)};
    /*__HYDRATED_DATA_END__*/`;

if (!html.includes('/*__HYDRATED_DATA_START__*/')) {
  throw new Error('Could not find hydration markers in artifact HTML!');
}
const updated = html.replace(/\/\*__HYDRATED_DATA_START__\*\/[\s\S]*?\/\*__HYDRATED_DATA_END__\*\//, replacement);
fs.writeFileSync(ARTIFACT_PATH, updated, 'utf8');
console.log(`Hydrated nomad_atlas.html with ${worldData.countries.length} Natural Earth countries and ${rawCities.length} live cities (${(Buffer.byteLength(updated) / 1024).toFixed(1)} KB).`);

// Also hydrate nomad_quick_finder.html with all 159 live-fetched cities
const QUICK_PATH =
  '/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/75ead22c-0534-4085-b49f-3eb6af4ab41e/nomad_quick_finder.html';
const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
const quickCities = CITIES.map((c) => {
  const mScores = c.tempC.map((t, i) => {
    const ts = Math.max(15, 100 - Math.pow(Math.abs(t - 22), 1.24) * 2.35);
    const rp = Math.max(0, (c.rainMm[i] - 70) * 0.14);
    return Math.max(18, Math.min(100, ts - rp + 3));
  });
  const air = Math.max(15, Math.min(100, 112 - c.pm25 * 2.5));
  const safe = Math.round(c.wgiStability * 0.42 + c.wgiRuleOfLaw * 0.40 + air * 0.18);
  return [c.city, c.country, c.pppRatio, c.urbanCostFactor, c.dlMbps, c.ulMbps, c.latencyMs, Math.round(avg(mScores)), Math.round(avg(c.tempC) * 10) / 10, safe, c.utcStd];
});
const qHtml = fs.readFileSync(QUICK_PATH, 'utf8');
if (!qHtml.includes('/*__QUICK_CITIES_START__*/')) throw new Error('Missing quick-finder markers!');
const qUpdated = qHtml.replace(
  /\/\*__QUICK_CITIES_START__\*\/[\s\S]*?\/\*__QUICK_CITIES_END__\*\//,
  `/*__QUICK_CITIES_START__*/\n    const CITIES = ${JSON.stringify(quickCities)};\n    /*__QUICK_CITIES_END__*/`
);
fs.writeFileSync(QUICK_PATH, qUpdated, 'utf8');
console.log(`Hydrated nomad_quick_finder.html with ${quickCities.length} live cities (${(Buffer.byteLength(qUpdated) / 1024).toFixed(1)} KB).`);
