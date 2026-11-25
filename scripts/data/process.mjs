// Turns data/raw into the compact datasets in data/. Run: npm run data:build
import { readFile, readdir } from 'node:fs/promises';
import { unzip, parseCSV, readJSON, writeJSON, slugify, exists } from '../lib/util.mjs';
import { WDI, WGI, ICP, SOURCES } from './sources.mjs';
import { CITY_LIST } from './cities.list.mjs';

const RAW = 'data/raw', OUT = 'data';
const log = (...a) => console.log('[process]', ...a);
const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Friendlier English short names (GeoNames names are used otherwise) and alternative names people search for.
const NAME_OVERRIDES = {
  USA: 'United States', GBR: 'United Kingdom', CZE: 'Czechia', TUR: 'Türkiye', KOR: 'South Korea', PRK: 'North Korea', PSE: 'Palestine',
  VAT: 'Vatican City', CIV: "Côte d'Ivoire", COD: 'DR Congo', COG: 'Republic of the Congo', MKD: 'North Macedonia', SWZ: 'Eswatini',
  TLS: 'Timor-Leste', CPV: 'Cabo Verde', MMR: 'Myanmar', FSM: 'Micronesia', MAC: 'Macao', HKG: 'Hong Kong', XKX: 'Kosovo', LAO: 'Laos',
  RUS: 'Russia', SYR: 'Syria', IRN: 'Iran', VNM: 'Vietnam', BRN: 'Brunei', BOL: 'Bolivia', VEN: 'Venezuela', TZA: 'Tanzania', MDA: 'Moldova',
  GMB: 'The Gambia', BHS: 'The Bahamas', STP: 'São Tomé and Príncipe', KNA: 'Saint Kitts and Nevis', VCT: 'Saint Vincent and the Grenadines', LCA: 'Saint Lucia', NLD: 'Netherlands',
};
// Official exchange rates in these economies do not reflect what visitors pay, so we publish no price estimate.
// Euro changeovers where the World Bank PPP series is already in EUR but the exchange-rate series is still in the old currency.
const EURO_CHANGEOVER = { BGR: 1.95583 };
const CURRENCY_OVERRIDES = { BGR: ['EUR', 'Euro'], HRV: ['EUR', 'Euro'] };
const PRICE_BLACKLIST = new Set(['IRN', 'SYR', 'YEM', 'ZWE', 'SDN', 'SSD', 'MMR', 'VEN', 'AFG', 'SOM', 'PRK', 'CUB', 'LBY']);
const AKA = { TUR: 'Turkey', CZE: 'Czech Republic', CIV: 'Ivory Coast', SWZ: 'Swaziland', MKD: 'Macedonia', MMR: 'Burma', CPV: 'Cape Verde', TLS: 'East Timor', COD: 'Democratic Republic of the Congo', NLD: 'Holland', GBR: 'UK', USA: 'USA', ARE: 'UAE' };
const SLUG_OVERRIDES = { TUR: 'turkey', CIV: 'ivory-coast' };
const REGION_NAMES = { ECS: 'Europe & Central Asia', LCN: 'Latin America & Caribbean', MEA: 'Middle East & North Africa', SSF: 'Sub-Saharan Africa', EAS: 'East Asia & Pacific', SAS: 'South Asia', NAC: 'North America' };
const PLUG = { 'NEMA 1-15': 'A', 'NEMA 5-15': 'B', Europlug: 'C', 'BS 546': 'D', 'Type E': 'E', Schuko: 'F', 'BS 1363': 'G', 'Type H': 'H', 'AS/NZS 3112': 'I', 'SN 441011': 'J', 'Type K': 'K', 'Type L': 'L', 'IEC 60906-1': 'N' };

async function wbSeries(file) {
  const j = await readJSON(file);
  const m = new Map();
  for (const r of j[1] || []) {
    if (r.value == null || r.value === '') continue;
    const iso = r.countryiso3code || r.country?.id;
    if (!iso) continue;
    if (!m.has(iso)) m.set(iso, new Map());
    m.get(iso).set(+r.date, +r.value);
  }
  return m;
}
const latest = (m, iso, maxYear = 2100) => {
  const s = m.get(iso); if (!s) return null;
  const ys = [...s.keys()].filter((y) => y <= maxYear); if (!ys.length) return null;
  const y = Math.max(...ys); return { v: s.get(y), y };
};

// ---------- Map projection (Equal Earth) ----------
const EE = { A1: 1.340264, A2: -0.081106, A3: 0.000893, A4: 0.003796, M: Math.sqrt(3) / 2 };
function equalEarth(lon, lat) {
  const l = (lon * Math.PI) / 180, p = (lat * Math.PI) / 180;
  const t = Math.asin(EE.M * Math.sin(p)); const t2 = t * t, t6 = t2 * t2 * t2;
  return [(l * Math.cos(t)) / (EE.M * (EE.A1 + 3 * EE.A2 * t2 + t6 * (7 * EE.A3 + 9 * EE.A4 * t2))), t * (EE.A1 + EE.A2 * t2 + t6 * (EE.A3 + EE.A4 * t2))];
}
function simplify(pts, tol) {
  if (pts.length <= 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]]; const tol2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop(); let maxD = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b]; const dx = bx - ax, dy = by - ay; const L = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]; let d;
      if (L === 0) d = (px - ax) ** 2 + (py - ay) ** 2;
      else { let t = ((px - ax) * dx + (py - ay) * dy) / L; t = Math.max(0, Math.min(1, t)); d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2; }
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol2 && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const ringArea = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };

async function buildMap(validIso3) {
  const ne = await readJSON(`${RAW}/naturalearth/ne_50m_admin_0_countries.geojson`);
  const W = 1000; const s = W / (2 * equalEarth(180, 0)[0]);
  const NE_FIX = { KOS: 'XKX', SDS: 'SSD', PSX: 'PSE', SAH: 'ESH' };
  const shapes = [];
  let minY = Infinity, maxY = -Infinity;
  for (const f of ne.features) {
    const p = f.properties; let iso = p.ISO_A3_EH !== '-99' ? p.ISO_A3_EH : p.ADM0_A3; iso = NE_FIX[iso] || NE_FIX[p.ADM0_A3] || iso;
    if (iso === 'ATA' || iso === 'ATF') continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const rings = [];
    for (const poly of polys) for (const ring of poly) {
      const pr = ring.map(([lo, la]) => { const [x, y] = equalEarth(lo, la); return [W / 2 + x * s, -y * s]; });
      rings.push(pr);
      for (const [, y] of pr) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    shapes.push({ iso, name: p.NAME, rings });
  }
  const pad = 2; const ty = -minY + pad; const H = Math.ceil(maxY - minY + pad * 2);
  const paths = {}; const centroids = {}; const dots = {};
  for (const sh of shapes) {
    const simp = sh.rings.map((r) => simplify(r.map(([x, y]) => [x, y + ty]), 0.45)).filter((r) => r.length >= 4);
    const areas = simp.map(ringArea); const maxA = Math.max(...areas, 0);
    let d = '';
    simp.forEach((r, i) => {
      if (areas[i] < 0.8 && areas[i] < maxA) return;
      const q = r.map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)]);
      let seg = 'M' + q[0][0] / 10 + ' ' + q[0][1] / 10 + 'l';
      const parts = [];
      for (let k = 1; k < q.length - 1; k++) { const dx = q[k][0] - q[k - 1][0], dy = q[k][1] - q[k - 1][1]; if (dx || dy) parts.push(dx / 10 + ' ' + dy / 10); }
      seg += parts.join(' ').replace(/ -/g, '-') + 'z';
      d += seg;
    });
    if (!d) {
      // Too small to draw at this scale (Singapore, Malta, Maldives...): draw a dot so the country stays visible and clickable.
      const all = sh.rings.flat(); if (!all.length) continue;
      const cx = all.reduce((a, q) => a + q[0], 0) / all.length, cy = all.reduce((a, q) => a + q[1], 0) / all.length + ty; const r = 2.4;
      d = `M${round(cx - r, 1)} ${round(cy, 1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 -${2 * r} 0z`;
      (dots[sh.iso] = true);
      if (!centroids[sh.iso]) centroids[sh.iso] = [round(cx, 1), round(cy, 1), 0];
    }
    paths[sh.iso] = (paths[sh.iso] || '') + d;
    const big = simp[areas.indexOf(maxA)];
    if (big && (!centroids[sh.iso] || maxA > centroids[sh.iso][2])) {
      const cx = big.reduce((a, p) => a + p[0], 0) / big.length, cy = big.reduce((a, p) => a + p[1], 0) / big.length;
      centroids[sh.iso] = [round(cx, 1), round(cy, 1), maxA];
    }
  }
  for (const k of Object.keys(centroids)) centroids[k] = centroids[k].slice(0, 2);
  const missing = [...validIso3].filter((c) => !paths[c]);
  if (missing.length) log('map: no shape for', missing.join(','));
  return { w: W, h: H, proj: { name: 'Equal Earth', scale: round(s, 5), tx: W / 2, ty: round(ty, 4) }, paths, centroids, dots: Object.keys(dots) };
}

async function main() {
  // ---------- GeoNames country info ----------
  const ciTxt = await readFile(`${RAW}/geonames/countryInfo.txt`, 'utf8');
  const gn = new Map();
  for (const l of ciTxt.split('\n')) {
    if (!l || l.startsWith('#')) continue;
    const f = l.split('\t');
    gn.set(f[1], { iso2: f[0], iso3: f[1], name: f[4], capital: f[5], area: +f[6] || null, population: +f[7] || null, continent: f[8], currency: f[10], currencyName: f[11], phone: f[12], languages: f[15], neighboursIso2: f[17] ? f[17].split(',') : [] });
  }
  const iso2to3 = new Map([...gn.values()].map((c) => [c.iso2, c.iso3]));

  // ---------- Passport matrix ----------
  const csv = parseCSV(await readFile(`${RAW}/passport/passport-index-tidy-iso3.csv`, 'utf8')).slice(1).filter((r) => r.length >= 3);
  const passports = [...new Set(csv.map((r) => r[0]))].sort();
  const pIndex = new Map(passports.map((c, i) => [c, i]));
  const ENC = { 'visa free': 'F', 'visa on arrival': 'A', eta: 'T', 'e-visa': 'E', 'visa required': 'R', 'no admission': 'N' };
  const matrix = passports.map(() => new Array(passports.length).fill('R'));
  for (const [p, d, req] of csv) {
    const r = req.trim(); const tok = r === '-1' ? '-' : /^\d+$/.test(r) ? r : ENC[r] ?? 'R';
    if (pIndex.has(p) && pIndex.has(d)) matrix[pIndex.get(p)][pIndex.get(d)] = tok;
  }
  const readme = await readFile(`${RAW}/passport/README.md`, 'utf8');
  const passportUpdated = (readme.match(/Last updated:\s*\*\*([^*]+)\*\*/) || [])[1] || null;
  await writeJSON(`${OUT}/visa.json`, { updated: passportUpdated, codes: passports, rows: matrix.map((r) => r.join(',')) });
  log('visa matrix', passports.length, 'x', passports.length, 'updated', passportUpdated);

  // ---------- World Bank ----------
  const wbCountries = (await readJSON(`${RAW}/wb/countries.json`))[1].filter((c) => c.region.value !== 'Aggregates');
  const wbMeta = new Map(wbCountries.map((c) => [c.id, c]));
  const wdi = {}; for (const [code, key] of Object.entries(WDI)) wdi[key] = await wbSeries(`${RAW}/wb/wdi-${code}.json`);
  for (const [iso, rate] of Object.entries(EURO_CHANGEOVER)) { const s = wdi.fx.get(iso); if (s) for (const [y, v] of s) if (v > 1.3) s.set(y, v / rate); }
  const wgi = {}; for (const [code, key] of Object.entries(WGI)) wgi[key] = await wbSeries(`${RAW}/wb/wgi-${code}.json`);
  const icp = {};
  for (const [code, key] of Object.entries(ICP)) {
    const j = await readJSON(`${RAW}/wb/icp-${code}.json`);
    const m = new Map();
    for (const row of j.source?.data || []) {
      const c = row.variable.find((v) => v.concept === 'Country')?.id;
      if (c && row.value != null) m.set(c, +row.value);
    }
    icp[key] = m;
  }

  // ---------- Wikidata ----------
  const wd = async (k) => (await readJSON(`${RAW}/wikidata/${k}.json`)).results.bindings;
  const plugs = new Map(), volts = new Map(), drive = new Map();
  for (const b of await wd('plugs')) {
    const iso = b.iso.value; const lab = b.plugLabel.value;
    const t = PLUG[lab] || (/British/.test(lab) ? 'G' : null); if (!t) continue;
    if (!plugs.has(iso)) plugs.set(iso, new Set()); plugs.get(iso).add(t);
  }
  for (const b of await wd('voltage')) { const iso = b.iso.value; if (!volts.has(iso)) volts.set(iso, new Set()); volts.get(iso).add(Math.round(+b.v.value)); }
  for (const b of await wd('driving')) { const side = b.sideLabel.value; if (side === 'left' || side === 'right') { if (!drive.has(b.iso.value)) drive.set(b.iso.value, new Set()); drive.get(b.iso.value).add(side); } }

  // ---------- M-Lab ----------
  const mlab = new Map();
  for (const fn of await readdir(`${RAW}/mlab`)) {
    const j = await readJSON(`${RAW}/mlab/${fn}`);
    if (j.none || j.download == null) continue;
    const iso3 = iso2to3.get(j.iso2); if (iso3) mlab.set(iso3, j);
  }

  // ---------- Countries ----------
  // Latest private-consumption price level ratio (US = 1). If PPPs lag behind exchange rates, carry the PPP forward
  // with relative inflation (CPI, else GDP deflator) against the US: the standard PPP extrapolation method.
  const infl = (iso, y) => wdi.inflation.get(iso)?.get(y) ?? wdi.deflator.get(iso)?.get(y);
  const plrOf = (iso, income) => {
    if (PRICE_BLACKLIST.has(iso)) return null;
    const ppp = wdi.pppPrivate.get(iso), fx = wdi.fx.get(iso);
    if (!ppp || !fx) return null;
    const common = [...ppp.keys()].filter((y) => fx.has(y)).sort((a, b) => b - a);
    if (!common.length) return null;
    let y0 = common[0]; let v = ppp.get(y0); let extrapolated = 0;
    const yFx = Math.max(...fx.keys());
    for (let y = y0 + 1; y <= yFx && extrapolated < 5; y++) {
      const ic = infl(iso, y), iu = infl('USA', y);
      if (ic == null || iu == null || !fx.has(y)) break;
      v = (v * (1 + ic / 100)) / (1 + iu / 100); y0 = y; extrapolated++;
    }
    const plr = v / fx.get(y0);
    if (!Number.isFinite(plr) || plr < 0.08 || y0 < 2019) return null;
    if (plr > 1.6 && income !== 'High income') return null;
    return { v: plr, y: y0, extrapolated };
  };
  const countries = [];
  const usIcp = Object.fromEntries(Object.keys(icp).map((k) => [k, icp[k].get('USA')]));
  for (const iso3 of passports) {
    const g = gn.get(iso3); const w = wbMeta.get(iso3);
    if (!g) { log('WARNING: no GeoNames info for', iso3); continue; }
    const name = NAME_OVERRIDES[iso3] || g.name;
    const ind = {};
    for (const key of Object.values(WDI)) { if (key === 'pppPrivate' || key === 'fx' || key === 'deflator') continue; const l = latest(wdi[key], iso3); if (l) ind[key] = [round(l.v, l.v > 1000 ? 0 : 2), l.y]; }
    const gov = {};
    for (const key of Object.values(WGI)) { const l = latest(wgi[key], iso3); if (l) gov[key] = [round(l.v, 1), l.y]; }
    // Price levels: latest private-consumption price level ratio (US = 1), plus ICP 2021 category structure.
    // Overall level from the latest WDI price level ratio; the split across spending categories from ICP 2021
    // (each category's price level relative to the country's overall consumption price level).
    const plr = plrOf(iso3, w?.incomeLevel?.value);
    let pli = null, pliMethod = null;
    const hasIcp = icp.aic.has(iso3) && !PRICE_BLACKLIST.has(iso3);
    if (hasIcp) {
      const aicRatio = icp.aic.get(iso3) / usIcp.aic;
      const level = plr ? plr.v : aicRatio;
      pli = Object.fromEntries(Object.keys(icp).map((k) => [k, icp[k].has(iso3) ? round(((icp[k].get(iso3) / usIcp[k]) / aicRatio) * level * 100, 1) : round(level * 100, 1)]));
      pliMethod = plr ? 'icp2021-structure+wdi-level' : 'icp2021';
    } else if (plr) {
      pli = Object.fromEntries(Object.keys(icp).map((k) => [k, round(plr.v * 100, 1)]));
      pliMethod = 'wdi-level';
    }
    const fx = latest(wdi.fx, iso3);
    const m = mlab.get(iso3);
    countries.push({
      iso3, iso2: g.iso2, name, aka: AKA[iso3] || null, slug: SLUG_OVERRIDES[iso3] || slugify(name),
      region: w ? REGION_NAMES[w.region.id] || w.region.value : (iso3 === 'TWN' ? 'East Asia & Pacific' : 'Europe & Central Asia'),
      income: w?.incomeLevel?.value || null, continent: g.continent,
      capital: g.capital || null, capLat: w?.latitude ? +w.latitude : null, capLng: w?.longitude ? +w.longitude : null,
      area: g.area, currency: CURRENCY_OVERRIDES[iso3]?.[0] || g.currency || null, currencyName: CURRENCY_OVERRIDES[iso3]?.[1] || g.currencyName || null, phone: g.phone ? '+' + g.phone.replace(/^\+/, '') : null,
      neighbours: g.neighboursIso2.map((c) => iso2to3.get(c)).filter((c) => c && pIndex.has(c)),
      plr: plr ? [round(plr.v, 3), plr.y, plr.extrapolated] : null, pli, pliMethod, pliYear: plr ? plr.y : pli ? 2021 : null,
      fx: fx ? [round(fx.v, 4), fx.y] : null,
      ind, gov,
      net: m && m.dlSamples >= 1000 ? { down: round(m.download, 1), up: round(m.upload, 1), rtt: round(m.rtt, 0), samples: m.dlSamples, low: m.dlSamples < 5000 || undefined, from: m.from, to: m.to } : null,
      plugs: plugs.has(iso3) ? [...plugs.get(iso3)].sort() : [],
      volts: volts.has(iso3) ? [...volts.get(iso3)].sort((a, b) => a - b) : [],
      drive: drive.has(iso3) ? [...drive.get(iso3)].join('/') : null,
    });
  }
  // unique slugs
  const seen = new Set(); for (const c of countries) { if (seen.has(c.slug)) c.slug += '-' + c.iso3.toLowerCase(); seen.add(c.slug); }
  await writeJSON(`${OUT}/countries.json`, countries);
  log('countries', countries.length, '| with price levels', countries.filter((c) => c.pli).length, '| with M-Lab', countries.filter((c) => c.net).length);

  // ---------- Cities ----------
  const resolved = await readJSON(`${RAW}/cities-resolved.json`);
  const wanted = new Set(CITY_LIST.map(([n, cc]) => n + '|' + cc));
  const byIso3 = new Map(countries.map((c) => [c.iso3, c]));
  const cities = [];
  for (const c of resolved) {
    if (!wanted.has(c.name + '|' + c.cc)) continue;
    const iso3 = iso2to3.get(c.cc); const country = byIso3.get(iso3);
    if (!country) { log('WARNING: city without country', c.name); continue; }
    const nf = `${RAW}/nasa/${c.geonameid}.json`;
    if (!(await exists(nf))) { log('WARNING: no climate for', c.name); continue; }
    const nasa = await readJSON(nf); const P = nasa.properties.parameter;
    const gridElev = nasa.geometry.coordinates[2];
    const elev = c.elevation;
    let dT = elev != null && gridElev != null ? -0.0065 * (elev - gridElev) : 0;
    dT = Math.max(-8, Math.min(8, dT));
    const arr = (k, f = (v) => v) => MONTHS.map((mm, i) => { const v = P[k]?.[mm]; return v == null || v <= -998 ? null : round(f(v, i), 1); });
    const df = `${RAW}/nasa-daily/${c.geonameid}.json`;
    const daily = (await exists(df)) ? await readJSON(df) : null;
    const dly = (k) => (daily && daily.months.every(Boolean) ? daily.months.map((x) => round(x[k] + dT, 1)) : null);
    cities.push({
      id: c.geonameid, name: c.name, alias: c.alias, iso3, iso2: c.cc,
      lat: round(c.lat, 4), lng: round(c.lng, 4), pop: c.population, elev, tz: c.tz,
      clim: {
        t: dly('t') || arr('T2M', (v) => v + dT), hi: dly('hi') || arr('T2M_MAX', (v) => v + dT), lo: dly('lo') || arr('T2M_MIN', (v) => v + dT),
        wetDays: daily ? daily.months.map((x) => x?.wetDays ?? null) : null,
        rain: arr('PRECTOTCORR', (v, i) => v * DAYS_IN_MONTH[i]), rh: arr('RH2M'), cloud: arr('CLOUD_AMT'), sun: arr('ALLSKY_SFC_SW_DWN'),
      },
      climAdj: round(dT, 2), gridElev: round(gridElev, 0), tempSource: daily ? 'daily-2015-2024' : 'climatology',
    });
  }
  // slugs
  const counts = {}; for (const c of cities) { const s = slugify(c.name); counts[s] = (counts[s] || 0) + 1; }
  for (const c of cities) { const s = slugify(c.name); c.slug = counts[s] > 1 ? s + '-' + byIso3.get(c.iso3).slug : s; }
  await writeJSON(`${OUT}/cities.json`, cities);
  log('cities', cities.length);

  // ---------- Map ----------
  const map = await buildMap(new Set(passports));
  await writeJSON(`${OUT}/map.json`, map);
  log('map', Object.keys(map.paths).length, 'shapes', JSON.stringify(map).length, 'bytes');

  // ---------- ECB rates ----------
  const xml = await readFile(`${RAW}/ecb/eurofxref-daily.xml`, 'utf8');
  const date = (xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/) || [])[1];
  const eur = Object.fromEntries([...xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)].map((m) => [m[1], +m[2]]));
  const usdPerEur = eur.USD;
  const rates = { USD: 1, EUR: round(1 / usdPerEur, 6) };
  for (const [k, v] of Object.entries(eur)) if (k !== 'USD') rates[k] = round(v / usdPerEur, 6);
  await writeJSON(`${OUT}/rates.json`, { date, base: 'USD', rates });
  log('ECB rates', date, Object.keys(rates).length);

  // ---------- DESNZ flight factors ----------
  const xbuf = await readFile(`${RAW}/desnz/ghg-conversion-factors-2026-flat.xlsx`);
  const xf = unzip(xbuf, (n) => n === 'xl/sharedStrings.xml' || /xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const ss = [...xf.get('xl/sharedStrings.xml').toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''));
  const factors = {};
  for (const [name, buf] of xf) {
    if (!name.includes('worksheets')) continue;
    for (const rm of buf.toString('utf8').matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [];
      for (const cm of rm[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const v = ((cm[3] || '').match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        cells[[...cm[1]].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1] = v === undefined ? '' : /t="s"/.test(cm[2]) ? ss[+v] : v;
      }
      if (cells[2] !== 'Business travel- air' || cells[7] !== 'passenger.km' || cells[8] !== 'kg CO2e') continue;
      const key = [cells[4], cells[5], cells[6]].join(' | ');
      factors[key] = round(+cells[9], 5);
    }
  }
  const pick = (haul, cls, rf) => factors[[haul, cls, rf].join(' | ')] ?? null;
  const emissions = {
    year: 2026, unit: 'kg CO2e per passenger-km', distanceUplift: 0.08, shortHaulMaxKm: 3700,
    domestic: { avg: { rf: pick('Domestic, to/from UK', 'Average passenger', 'With RF'), noRf: pick('Domestic, to/from UK', 'Average passenger', 'Without RF') } },
    shortHaul: { economy: { rf: pick('Short-haul, to/from UK', 'Economy class', 'With RF'), noRf: pick('Short-haul, to/from UK', 'Economy class', 'Without RF') }, business: { rf: pick('Short-haul, to/from UK', 'Business class', 'With RF'), noRf: pick('Short-haul, to/from UK', 'Business class', 'Without RF') } },
    longHaul: { economy: { rf: pick('Long-haul, to/from UK', 'Economy class', 'With RF'), noRf: pick('Long-haul, to/from UK', 'Economy class', 'Without RF') }, premium: { rf: pick('Long-haul, to/from UK', 'Premium economy class', 'With RF'), noRf: pick('Long-haul, to/from UK', 'Premium economy class', 'Without RF') }, business: { rf: pick('Long-haul, to/from UK', 'Business class', 'With RF'), noRf: pick('Long-haul, to/from UK', 'Business class', 'Without RF') }, first: { rf: pick('Long-haul, to/from UK', 'First class', 'With RF'), noRf: pick('Long-haul, to/from UK', 'First class', 'Without RF') } },
  };
  await writeJSON(`${OUT}/emissions.json`, emissions, true);
  log('emissions', JSON.stringify(emissions.longHaul.economy), JSON.stringify(emissions.shortHaul.economy));

  // ---------- Meta ----------
  const wdiYears = countries.flatMap((c) => Object.values(c.ind).map((x) => x[1]));
  await writeJSON(`${OUT}/meta.json`, {
    built: new Date().toISOString().slice(0, 10),
    vintages: {
      wdi: `${Math.min(...wdiYears)} to ${Math.max(...wdiYears)} (latest available year per country)`,
      icp: '2021 benchmark, carried forward to the latest year with each country’s private-consumption price level',
      wgi: String(Math.max(...countries.flatMap((c) => Object.values(c.gov).map((x) => x[1])))),
      passport: passportUpdated, ecb: date, nasa: 'temperatures from daily data 2015 to 2024; rain, humidity and cloud from the 2001 to 2025 climatology',
      mlab: 'January to March 2024', desnz: '2026 conversion factors (revised July 2026)', geonames: 'cities1000 + countryInfo, retrieved ' + new Date().toISOString().slice(0, 10),
      wikidata: 'retrieved ' + new Date().toISOString().slice(0, 10), naturalearth: '1:50m Admin 0, version 5',
    },
    sources: SOURCES,
  }, true);
  log('done');
}
main().catch((e) => { console.error(e); process.exit(1); });
