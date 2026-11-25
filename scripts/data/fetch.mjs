// Downloads every raw source into data/raw (cached). Run: npm run data:fetch  (add --force to refresh)
import { cached, download, writeJSON, exists, unzip, pool, fold, sleep } from '../lib/util.mjs';
import { CITY_LIST } from './cities.list.mjs';
import { WDI, WGI, ICP } from './sources.mjs';

const FORCE = process.argv.includes('--force');
const RAW = 'data/raw';
const log = (...a) => console.log('[fetch]', ...a);


async function wbAll(file, url) {
  const buf = await cached(file, url, { force: FORCE });
  const j = JSON.parse(buf.toString('utf8'));
  if (!Array.isArray(j) || !j[1]) throw new Error('Unexpected WB response for ' + url + ': ' + buf.toString('utf8').slice(0, 200));
  return j;
}

async function main() {
  log('World Bank country list');
  await wbAll(`${RAW}/wb/countries.json`, 'https://api.worldbank.org/v2/country?format=json&per_page=400');
  await pool(Object.keys(WDI), 4, async (id) => {
    await wbAll(`${RAW}/wb/wdi-${id}.json`, `https://api.worldbank.org/v2/country/all/indicator/${id}?format=json&per_page=20000&date=2012:2026`);
    log('WDI', id);
  });
  await pool(Object.keys(WGI), 4, async (id) => {
    await wbAll(`${RAW}/wb/wgi-${id}.json`, `https://api.worldbank.org/v2/country/all/indicator/${id}?source=3&format=json&per_page=20000&date=2015:2026`);
    log('WGI', id);
  });
  await pool(Object.keys(ICP), 4, async (s) => {
    const buf = await cached(`${RAW}/wb/icp-${s}.json`, `https://api.worldbank.org/v2/sources/90/country/all/series/${s}/classification/PX.WL/time/YR2021/data?format=json&per_page=2000`, { force: FORCE });
    JSON.parse(buf.toString('utf8'));
    log('ICP 2021 series', s);
  });

  log('Passport index (imorte/passport-index-data)');
  await cached(`${RAW}/passport/passport-index-tidy-iso3.csv`, 'https://raw.githubusercontent.com/imorte/passport-index-data/main/passport-index-tidy-iso3.csv', { force: FORCE });
  await cached(`${RAW}/passport/README.md`, 'https://raw.githubusercontent.com/imorte/passport-index-data/main/README.md', { force: FORCE });

  log('GeoNames countryInfo + cities1000');
  const countryInfo = (await cached(`${RAW}/geonames/countryInfo.txt`, 'https://download.geonames.org/export/dump/countryInfo.txt', { force: FORCE })).toString('utf8');
  const zip = await cached(`${RAW}/geonames/cities1000.zip`, 'https://download.geonames.org/export/dump/cities1000.zip', { force: FORCE });

  log('Natural Earth 50m admin-0');
  await cached(`${RAW}/naturalearth/ne_50m_admin_0_countries.geojson`, 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson', { force: FORCE });

  log('ECB reference rates');
  await cached(`${RAW}/ecb/eurofxref-daily.xml`, 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', { force: FORCE });

  log('DESNZ GHG conversion factors 2026 (flat file)');
  await cached(`${RAW}/desnz/ghg-conversion-factors-2026-flat.xlsx`, 'https://assets.publishing.service.gov.uk/media/6a6c9748862aaf18d9c62ac9/ghg-conversion-factors-2026-flat-format-revised.xlsx', { force: FORCE });

  const sparql = {
    plugs: 'SELECT ?iso ?plugLabel WHERE { ?c wdt:P298 ?iso; wdt:P2853 ?plug. FILTER NOT EXISTS { ?c wdt:P576 ?end } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }',
    voltage: 'SELECT ?iso ?v WHERE { ?c wdt:P298 ?iso; wdt:P2884 ?v. FILTER NOT EXISTS { ?c wdt:P576 ?end } }',
    frequency: 'SELECT ?iso ?f WHERE { ?c wdt:P298 ?iso; wdt:P2144 ?f. FILTER NOT EXISTS { ?c wdt:P576 ?end } }',
    driving: 'SELECT ?iso ?sideLabel WHERE { ?c wdt:P298 ?iso; wdt:P1622 ?side. FILTER NOT EXISTS { ?c wdt:P576 ?end } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }',
    demonym: 'SELECT ?iso ?d WHERE { ?c wdt:P298 ?iso; wdt:P1549 ?d. FILTER(LANG(?d) = "en") FILTER NOT EXISTS { ?c wdt:P576 ?end } }',
  };
  for (const [k, q] of Object.entries(sparql)) {
    log('Wikidata', k);
    await cached(`${RAW}/wikidata/${k}.json`, 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { force: FORCE, headers: { Accept: 'application/sparql-results+json' } });
    await sleep(400);
  }

  log('Resolving cities');
  const txt = unzip(zip, (n) => n.endsWith('.txt')).values().next().value.toString('utf8');
  const byCC = new Map();
  for (const line of txt.split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    if (f[6] !== 'P') continue;
    const rec = { id: +f[0], name: f[1], ascii: f[2], alt: f[3], lat: +f[4], lng: +f[5], fcode: f[7], cc: f[8], admin1: f[10], pop: +f[14], elev: f[15] === '' ? null : +f[15], dem: +f[16], tz: f[17] };
    if (!byCC.has(rec.cc)) byCC.set(rec.cc, []);
    byCC.get(rec.cc).push(rec);
  }
  const resolved = []; const missing = [];
  for (const [name, cc, lookup, alias] of CITY_LIST) {
    const want = fold(lookup || name);
    const cands = (byCC.get(cc) || []).filter((r) => fold(r.name) === want || fold(r.ascii) === want || r.alt.split(',').some((a) => fold(a) === want));
    if (!cands.length) { missing.push(name + ' ' + cc); continue; }
    const rank = (r) => (r.fcode === 'PPLC' ? 3 : r.fcode.startsWith('PPLA') ? 2 : 1) * 1e9 + r.pop;
    cands.sort((a, b) => rank(b) - rank(a));
    const r = cands[0];
    resolved.push({ name, cc, alias: alias || null, geonameid: r.id, gnName: r.name, fcode: r.fcode, lat: r.lat, lng: r.lng, population: r.pop, elevation: r.elev ?? r.dem, tz: r.tz, admin1: r.admin1 });
  }
  if (missing.length) log('WARNING unresolved cities:', missing.join('; '));
  await writeJSON(`${RAW}/cities-resolved.json`, resolved, true);
  log('resolved', resolved.length, 'cities');

  const params = 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,CLOUD_AMT,ALLSKY_SFC_SW_DWN';
  await pool(resolved, 3, async (c) => {
    const file = `${RAW}/nasa/${c.geonameid}.json`;
    if (!FORCE && (await exists(file))) return;
    const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=${params}&community=RE&longitude=${c.lng.toFixed(4)}&latitude=${c.lat.toFixed(4)}&format=JSON`;
    try {
      const j = JSON.parse((await download(url, { timeout: 90000 })).toString('utf8'));
      if (!j.properties?.parameter?.T2M) throw new Error('bad response');
      await writeJSON(file, j);
    } catch (e) { log('NASA POWER failed', c.name, e.message); }
  });
  log('NASA POWER climatology done');

  // Daily data (2015-2024) for true average daily highs/lows and rainy days: climatology T2M_MAX/MIN are monthly extremes.
  await pool(resolved, 4, async (c) => {
    const file = `${RAW}/nasa-daily/${c.geonameid}.json`;
    if (!FORCE && (await exists(file))) return;
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR&community=RE&longitude=${c.lng.toFixed(4)}&latitude=${c.lat.toFixed(4)}&start=20150101&end=20241231&format=JSON`;
    try {
      const j = JSON.parse((await download(url, { timeout: 120000 })).toString('utf8'));
      const P = j.properties?.parameter; if (!P?.T2M) throw new Error('bad response');
      const acc = Array.from({ length: 12 }, () => ({ t: 0, hi: 0, lo: 0, n: 0, wet: 0, years: new Set() }));
      for (const day of Object.keys(P.T2M)) {
        const t = P.T2M[day], hi = P.T2M_MAX[day], lo = P.T2M_MIN[day], pr = P.PRECTOTCORR[day];
        if ([t, hi, lo].some((v) => v == null || v <= -998)) continue;
        const m = +day.slice(4, 6) - 1; const a = acc[m];
        a.t += t; a.hi += hi; a.lo += lo; a.n++; a.years.add(day.slice(0, 4));
        if (pr != null && pr >= 1) a.wet++;
      }
      const r1 = (v) => Math.round(v * 10) / 10;
      await writeJSON(file, { elev: j.geometry.coordinates[2], from: 2015, to: 2024, months: acc.map((a) => (a.n ? { t: r1(a.t / a.n), hi: r1(a.hi / a.n), lo: r1(a.lo / a.n), wetDays: r1(a.wet / a.years.size) } : null)) });
    } catch (e) { log('NASA POWER daily failed', c.name, e.message); }
  });
  log('NASA POWER daily done');

  const countries = countryInfo.split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t')).map((f) => ({ iso2: f[0], continent: f[8] }));
  const mlabYear = 2024;
  await pool(countries, 8, async ({ iso2, continent }) => {
    const file = `${RAW}/mlab/${iso2}.json`;
    if (!FORCE && (await exists(file))) return;
    let rows;
    try {
      rows = JSON.parse((await download(`https://statistics.measurementlab.net/v0/${continent}/${iso2}/${mlabYear}/histogram_daily_stats.json`, { retries: 2, timeout: 120000 })).toString('utf8'));
    } catch (e) {
      if (e.status === 404) { await writeJSON(file, { iso2, none: true }); return; }
      log('M-Lab failed', iso2, e.message); return;
    }
    const days = new Map();
    for (const r of rows) if (!days.has(r.date)) days.set(r.date, r);
    const d = [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    const med = (arr) => { const a = arr.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    const sum = (k) => d.reduce((s, r) => s + (r[k] || 0), 0);
    await writeJSON(file, {
      iso2, year: mlabYear, days: d.length, from: d[0]?.date, to: d[d.length - 1]?.date,
      download: med(d.map((r) => r.download_MED)), upload: med(d.map((r) => r.upload_MED)), rtt: med(d.map((r) => r.download_minRTT_MED)),
      dlSamples: sum('dl_samples_day'), ulSamples: sum('ul_samples_day'),
    });
  });
  log('M-Lab done');
  log('All raw sources ready.');
}

main().catch((e) => { console.error(e); process.exit(1); });
