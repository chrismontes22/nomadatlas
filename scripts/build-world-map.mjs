/**
 * Fetches Natural Earth 110m Admin-0 Countries (Public Domain — zero copyright / zero copyleft)
 * and pre-projects country boundaries using Tom Patterson's Natural Earth cartographic projection
 * into a lightweight ES module (`data/world-map.js`) with matching JS projection math for city pins.
 *
 * Run once (or whenever you want to refresh country borders):
 *   node scripts/build-world-map.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const NE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

const MAP_WIDTH = 960;
const MAP_HEIGHT = 460;

// Tom Patterson's Natural Earth projection (cropped gently at 82°N..-58°S so inhabited continents fill the frame)
export function rawNaturalEarth(lonDeg, latDeg) {
  const lam = (lonDeg * Math.PI) / 180;
  const phi = (Math.max(-58, Math.min(82, latDeg)) * Math.PI) / 180;
  const phi2 = phi * phi;
  const phi4 = phi2 * phi2;
  const phi6 = phi4 * phi2;
  const phi8 = phi4 * phi4;
  const phi10 = phi8 * phi2;
  const phi12 = phi8 * phi4;

  const x = lam * (0.8707 - 0.131979 * phi2 - 0.013791 * phi4 + 0.003971 * phi10 - 0.001529 * phi12);
  const y = phi * (1.007226 + 0.015085 * phi2 - 0.044475 * phi6 + 0.028874 * phi8 - 0.005916 * phi10);
  return [x, y];
}

// Compute bounds across [-180..180] lon, [-58..82] lat
const X_MIN = rawNaturalEarth(-180, 0)[0];
const X_MAX = rawNaturalEarth(180, 0)[0];
const Y_MIN = rawNaturalEarth(0, -58)[1];
const Y_MAX = rawNaturalEarth(0, 82)[1];

export function projectNE(lonDeg, latDeg, width = MAP_WIDTH, height = MAP_HEIGHT) {
  const [rx, ry] = rawNaturalEarth(lonDeg, latDeg);
  const padX = 14;
  const padY = 12;
  const x = padX + ((rx - X_MIN) / (X_MAX - X_MIN)) * (width - padX * 2);
  const y = padY + ((Y_MAX - ry) / (Y_MAX - Y_MIN)) * (height - padY * 2);
  return [x, y];
}

function ringToPath(ring) {
  const pts = [];
  let prevX = null, prevY = null;
  for (const [lon, lat] of ring) {
    // Skip polar artifacts
    if (lat < -58.5) continue;
    const [x, y] = projectNE(lon, lat);
    const rx = Math.round(x * 10) / 10;
    const ry = Math.round(y * 10) / 10;
    // Drop micro-segments < 0.7px to keep SVG crisp and compact
    if (prevX !== null && Math.hypot(rx - prevX, ry - prevY) < 0.7) continue;
    pts.push([rx, ry]);
    prevX = rx;
    prevY = ry;
  }
  if (pts.length < 3) return '';
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join('') + 'Z';
}

function geometryToPath(geom) {
  if (!geom) return '';
  const parts = [];
  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) {
      const p = ringToPath(ring);
      if (p) parts.push(p);
    }
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      for (const ring of poly) {
        const p = ringToPath(ring);
        if (p) parts.push(p);
      }
    }
  }
  return parts.join('');
}

async function main() {
  console.log('Downloading Natural Earth 110m Admin-0 Countries (Public Domain)...');
  const res = await fetch(NE_URL, { headers: { 'User-Agent': 'MeridianNomadAtlas/2.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading Natural Earth GeoJSON`);
  const geo = await res.json();

  const countries = [];
  for (const feat of geo.features) {
    const props = feat.properties || {};
    const iso2 = (props.ISO_A2_EH && props.ISO_A2_EH !== '-99') ? props.ISO_A2_EH : (props.ISO_A2 || '');
    const name = props.NAME || props.ADMIN || 'Unknown';
    if (iso2 === 'AQ' || name === 'Antarctica') continue; // Omit uninhabited Antarctica
    const d = geometryToPath(feat.geometry);
    if (!d) continue;
    countries.push({ iso2, name, d });
  }

  // Generate neat graticule meridian & parallel lines in the same projection
  const graticules = [];
  for (const lon of [-120, -60, 0, 60, 120]) {
    const pts = [];
    for (let lat = -56; lat <= 80; lat += 4) {
      const [x, y] = projectNE(lon, lat);
      pts.push(`${lat === -56 ? 'M' : 'L'}${(Math.round(x * 10) / 10)},${(Math.round(y * 10) / 10)}`);
    }
    graticules.push(pts.join(''));
  }
  for (const lat of [-40, -20, 0, 20, 40, 60]) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 6) {
      const [x, y] = projectNE(lon, lat);
      pts.push(`${lon === -180 ? 'M' : 'L'}${(Math.round(x * 10) / 10)},${(Math.round(y * 10) / 10)}`);
    }
    graticules.push(pts.join(''));
  }

  // Outer globe outline
  const outlinePts = [];
  for (let lat = -58; lat <= 82; lat += 2) outlinePts.push(projectNE(180, lat));
  for (let lon = 180; lon >= -180; lon -= 4) outlinePts.push(projectNE(lon, 82));
  for (let lat = 82; lat >= -58; lat -= 2) outlinePts.push(projectNE(-180, lat));
  for (let lon = -180; lon <= 180; lon += 4) outlinePts.push(projectNE(lon, -58));
  const globeOutline =
    outlinePts
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`)
      .join('') + 'Z';

  const output = `/**
 * Natural Earth 110m Admin-0 Countries — Public Domain (https://www.naturalearthdata.com/about/terms-of-use/)
 * Pre-projected with Tom Patterson's Natural Earth cartographic projection (${MAP_WIDTH}x${MAP_HEIGHT}).
 * Generated once via scripts/build-world-map.mjs.
 */

export const MAP_WIDTH = ${MAP_WIDTH};
export const MAP_HEIGHT = ${MAP_HEIGHT};

export const MAP_BOUNDS = {
  xMin: ${X_MIN},
  xMax: ${X_MAX},
  yMin: ${Y_MIN},
  yMax: ${Y_MAX}
};

export function projectNaturalEarth(lonDeg, latDeg, width = MAP_WIDTH, height = MAP_HEIGHT) {
  const lam = (lonDeg * Math.PI) / 180;
  const phi = (Math.max(-58, Math.min(82, latDeg)) * Math.PI) / 180;
  const p2 = phi * phi, p4 = p2 * p2, p6 = p4 * p2, p8 = p4 * p4, p10 = p8 * p2, p12 = p8 * p4;
  const rx = lam * (0.8707 - 0.131979 * p2 - 0.013791 * p4 + 0.003971 * p10 - 0.001529 * p12);
  const ry = phi * (1.007226 + 0.015085 * p2 - 0.044475 * p6 + 0.028874 * p8 - 0.005916 * p10);
  const padX = 14, padY = 12;
  const x = padX + ((rx - MAP_BOUNDS.xMin) / (MAP_BOUNDS.xMax - MAP_BOUNDS.xMin)) * (width - padX * 2);
  const y = padY + ((MAP_BOUNDS.yMax - ry) / (MAP_BOUNDS.yMax - MAP_BOUNDS.yMin)) * (height - padY * 2);
  return [x, y];
}

export const GLOBE_OUTLINE = ${JSON.stringify(globeOutline)};
export const GRATICULES = ${JSON.stringify(graticules)};
export const WORLD_COUNTRIES = ${JSON.stringify(countries)};
`;

  const outPath = path.join(ROOT, 'data', 'world-map.js');
  fs.writeFileSync(outPath, output, 'utf8');
  const kb = (Buffer.byteLength(output, 'utf8') / 1024).toFixed(1);
  console.log(`Saved ${countries.length} real country outlines to data/world-map.js (${kb} KB).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
