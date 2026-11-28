// Opinionated, data-derived takes for city pages: short badges, one honest trade-off sentence, and cities with similar weather
// that cost less. Every claim is a comparison against the other cities in the atlas, so each page says something of its own.
import { comfort } from './climate.mjs';
import { overlap, refDate } from './tz.mjs';
import { MONTHS_SHORT, listJoin } from './format.mjs';

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const val = (x) => (Array.isArray(x) ? x[0] : x ?? null);
const COMFY = 75; // a month this comfortable or better counts as pleasant (the same threshold as "best months")

/** Short month span for a set of month indexes, e.g. [5, 6, 7] -> "Jun–Aug", wrapping round the new year. */
export function monthSpan(months) {
  const set = [...new Set(months)].sort((a, b) => a - b);
  if (!set.length) return '';
  if (set.length === 12) return 'all year';
  const runs = []; let a = set[0], p = set[0];
  for (const m of set.slice(1).concat([99])) { if (m === p + 1) { p = m; continue; } runs.push([a, p]); a = p = m; }
  if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === 11) { const last = runs.pop(); runs[0] = [last[0], runs[0][1]]; }
  return runs.map(([x, y]) => (x === y ? MONTHS_SHORT[x] : MONTHS_SHORT[x] + '–' + MONTHS_SHORT[y])).join(', ');
}

/** How similar two cities' weather is: RMS gap in monthly mean temperature (°C) plus the average monthly rain gap / 50 mm. */
export function weatherGap(a, b) {
  return Math.sqrt(mean(a.clim.t.map((t, i) => (t - b.clim.t[i]) ** 2))) + mean(a.clim.rain.map((r, i) => Math.abs(r - b.clim.rain[i]))) / 50;
}

// Percentile helpers over every city in the atlas, worked out once per database.
function stats(db) {
  if (db._insights) return db._insights;
  const metric = {
    cost: (c) => c.costComfort, climate: (c) => c.yearComfort, internet: (c) => c.country.net?.down ?? null,
    safety: (c) => c.parts.safety, health: (c) => c.parts.health, air: (c) => c.parts.air,
    cloud: (c) => mean(c.clim.cloud || [50]),
  };
  const sorted = Object.fromEntries(Object.entries(metric).map(([k, f]) => [k, db.cities.map(f).filter((v) => v != null && Number.isFinite(v)).sort((x, y) => x - y)]));
  return (db._insights = { metric, sorted });
}
/** Share of the other cities with a strictly lower (below) or higher (above) value, 0 to 1. */
function share(arr, v, dir) {
  let lo = 0, hi = arr.length;
  if (dir === 'below') { while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo / Math.max(1, arr.length - 1); }
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m + 1; else hi = m; }
  return (arr.length - lo) / Math.max(1, arr.length - 1);
}

const HUBS = { ny: 'America/New_York', berlin: 'Europe/Berlin', sg: 'Asia/Singapore' };
const than = (p) => (p >= 0.995 ? 'any other city we track' : Math.round(p * 100) + '% of the cities we track');

/**
 * Badges for a city: [{ key, label, tone: 'good' | 'warn' | 'info', note, strength }], strongest first, at most five, and
 * always including the strongest warning if there is one, so a page never reads as pure praise.
 */
export function cityBadges(db, c, year) {
  const { metric, sorted } = stats(db), k = c.country, cl = c.clim, out = [];
  const add = (key, label, tone, strength, note) => out.push({ key, label, tone, strength, note });
  const cost = metric.cost(c);
  if (cost != null) {
    const cheaper = share(sorted.cost, cost, 'above'), pricier = share(sorted.cost, cost, 'below');
    if (cheaper >= 0.8) add('cost', 'Budget-friendly', 'good', cheaper, 'Cheaper than ' + than(cheaper));
    else if (pricier >= 0.88) add('cost', 'Expensive', 'warn', pricier, 'Pricier than ' + than(pricier));
  }
  const down = metric.internet(c);
  if (down != null) {
    const faster = share(sorted.internet, down, 'below'), slower = share(sorted.internet, down, 'above');
    if (faster >= 0.8) add('internet', 'Fast internet', 'good', faster, 'Faster measured internet than ' + than(faster));
    else if (slower >= 0.85) add('internet', 'Slow internet', 'warn', slower, 'Slower measured internet than ' + than(slower));
  }
  const comf = cl.t.map((_, m) => comfort(cl, m)), nice = comf.filter((v) => v >= COMFY).length;
  if (nice === 12) add('climate', 'Pleasant all year', 'good', 0.95, 'Every month is in the comfortable range');
  else if (nice >= 9) add('climate', 'Mild most of the year', 'good', 0.75, nice + ' comfortable months a year');
  else if (nice <= 2 && c.yearComfort < 50) add('climate', 'Few comfortable months', 'warn', 0.7, (nice ? nice : 'No') + ' month' + (nice === 1 ? '' : 's') + ' in the comfortable range');
  const hot = cl.t.map((t, m) => (t >= 29 ? m : -1)).filter((m) => m >= 0);
  if (hot.length) add('heat', 'Very hot ' + monthSpan(hot), 'warn', 0.8, 'Average temperature (day and night) of 29 °C or more');
  const cold = cl.t.map((t, m) => (t < 3 ? m : -1)).filter((m) => m >= 0);
  if (cold.length) add('cold', cl.t.some((t) => t < -3) ? 'Freezing winters' : 'Cold winters', 'info', 0.6, 'Average temperature below 3 °C in ' + monthSpan(cold));
  const wet = cl.rain.map((r, m) => (r >= 200 ? m : -1)).filter((m) => m >= 0);
  if (wet.length >= 2) add('rain', 'Wet season ' + monthSpan(wet), 'warn', 0.72, '200 mm of rain or more a month in ' + monthSpan(wet));
  else if (wet.length === 1) add('rain', 'Very wet ' + MONTHS_SHORT[wet[0]], 'info', 0.5, 'Over 200 mm of rain in ' + MONTHS_SHORT[wet[0]]);
  const sunny = share(sorted.cloud, metric.cloud(c), 'above');
  if (sunny >= 0.85) add('sun', 'Sunny skies', 'good', 0.7, 'Clearer skies than ' + than(sunny));
  const S = c.parts;
  if (S.safety != null && S.safety >= 85) add('safety', 'Very safe', 'good', 0.8, 'Safety and stability score ' + S.safety + '/100');
  else if (S.safety != null && S.safety <= 35) add('safety', 'Lower safety scores', 'warn', 0.75, 'Safety and stability score ' + S.safety + '/100');
  const healthier = S.health != null ? share(sorted.health, S.health, 'below') : 0;
  if (healthier >= 0.85) add('health', 'Top healthcare', 'good', 0.6, 'Better healthcare indicators than ' + than(healthier));
  if (S.air != null && S.air <= 30) add('air', 'Poor air quality', 'warn', 0.8, val(k.ind?.pm25) != null ? 'PM2.5 ' + val(k.ind.pm25).toFixed(1) + ' µg/m³ on average, ' + (val(k.ind.pm25) / 5).toFixed(1) + ' times the WHO guideline' : 'Air quality score ' + S.air + '/100');
  else if (S.air != null && S.air >= 92) add('air', 'Clean air', 'good', 0.55, 'Air quality score ' + S.air + '/100');
  // Working hours: a 9-to-5 team, and you willing to work 08:00 to 20:00 locally, in January.
  const ov = (tz) => overlap({ tz, start: 9, end: 17 }, { tz: c.tz, start: 8, end: 20 }, refDate(year, 0))?.minutes ?? 0;
  const ny = ov(HUBS.ny) / 60, eu = ov(HUBS.berlin) / 60, sg = ov(HUBS.sg) / 60, region = k.region;
  if (region !== 'North America' && region !== 'Europe & Central Asia' && ny >= 4 && eu >= 6) add('tz', 'Bridges US and Europe hours', 'good', 0.78, Math.round(ny) + ' h overlap with New York, ' + Math.round(eu) + ' h with Berlin');
  else if (region === 'Europe & Central Asia' && ny >= 5) add('tz', 'Works with US East hours', 'good', 0.5, Math.round(ny) + ' h overlap with a New York team');
  else if (region !== 'North America' && ny >= 6) add('tz', 'US-friendly time zone', 'good', 0.7, Math.round(ny) + ' h overlap with a New York team');
  else if (region !== 'Europe & Central Asia' && eu >= 7) add('tz', 'Europe-friendly time zone', 'good', 0.65, Math.round(eu) + ' h overlap with a Berlin team');
  else if (region !== 'East Asia & Pacific' && sg >= 6) add('tz', 'Asia-friendly time zone', 'good', 0.6, Math.round(sg) + ' h overlap with a Singapore team');
  if (db.visa) {
    const open = db.visa.openness(k.iso3) / Math.max(1, db.visa.codes.length - 1);
    if (open >= 0.7) add('visa', 'Easy entry', 'good', 0.55, Math.round(open * 100) + '% of passports need no visa in advance');
    else if (open <= 0.15) add('visa', 'Visa needed for most', 'warn', 0.6, 'Only ' + Math.round(open * 100) + '% of passports can enter without a visa in advance');
  }
  if (c.pop >= 5e6) add('size', 'Megacity', 'info', 0.4, 'Population ' + (c.pop / 1e6).toFixed(1) + ' million');
  else if (c.pop && c.pop < 200000) add('size', 'Small city', 'info', 0.4, 'Population under 200,000');
  out.sort((a, b) => b.strength - a.strength);
  const top = out.slice(0, 5), warn = out.find((b) => b.tone === 'warn');
  if (warn && !top.includes(warn)) top[top.length - 1] = warn;
  return top;
}

const FACT = {
  cost: { label: 'cost', strong: (w, x) => 'is cheaper than ' + w + ' (about ' + x.money + ' for a comfortable month)', weak: (w, x) => 'it costs more than ' + w + ' (about ' + x.money + ' a month)' },
  climate: { label: 'weather', strong: (w, x) => 'has more comfortable weather than ' + w + ' (' + (x.nice === 12 ? 'pleasant all year' : x.nice + ' pleasant months a year') + ')', weak: (w, x) => 'its weather is less comfortable than ' + w + ' (' + (x.nice ? x.nice + ' pleasant month' + (x.nice === 1 ? '' : 's') + ' a year' : 'no month in the comfortable range') + ')' },
  internet: { label: 'internet speed', strong: (w, x) => 'has faster measured internet than ' + w + ' (' + x.down + ' Mbps national median)', weak: (w, x) => 'its internet measures slower than ' + w + ' (' + x.down + ' Mbps national median)' },
  safety: { label: 'safety and stability', strong: (w) => 'scores higher for safety and stability than ' + w, weak: (w) => 'it scores lower for safety and stability than ' + w },
  health: { label: 'healthcare', strong: (w) => 'has stronger healthcare indicators than ' + w, weak: (w) => 'its healthcare indicators trail ' + w },
  air: { label: 'air quality', strong: (w, x) => 'has cleaner air than ' + w + (x.pm != null ? ' (PM2.5 ' + x.pm + ' µg/m³)' : ''), weak: (w, x) => 'its air is more polluted than ' + w + (x.pm != null ? ' (PM2.5 ' + x.pm + ' µg/m³, ' + (x.pm / 5).toFixed(1) + ' times the WHO guideline)' : '') },
};

/**
 * One sentence on what a city is best and worst at compared with every other city in the atlas, as { lead, text } where lead is
 * a short label. fmt.money formats dollars. Factors without data are skipped.
 */
export function cityTradeoff(db, c, fmt) {
  const { metric, sorted } = stats(db), N = db.cities.length;
  const better = (key) => { const v = metric[key](c); if (v == null) return null; return key === 'cost' ? share(sorted.cost, v, 'above') : share(sorted[key], v, 'below'); };
  const worse = (key) => { const v = metric[key](c); if (v == null) return null; return key === 'cost' ? share(sorted.cost, v, 'below') : share(sorted[key], v, 'above'); };
  const keys = Object.keys(FACT).filter((k) => metric[k](c) != null);
  if (keys.length < 2) return null;
  // Factors with no data (Taiwan has no World Bank safety, healthcare or air data) can't be compared, so the sentence says so
  // and never claims the city has no weak spot.
  const gaps = Object.keys(FACT).filter((k) => !keys.includes(k)).map((k) => FACT[k].label);
  const gapTxt = gaps.length ? ' There is no data on its ' + listJoin(gaps) + ', so ' + (gaps.length > 1 ? 'those are' : 'that is') + ' not compared.' : '';
  const x = { money: c.costComfort != null ? fmt.money(c.costComfort) : '', down: Math.round(c.country.net?.down ?? 0), pm: val(c.country.ind?.pm25) != null ? Math.round(val(c.country.ind.pm25) * 10) / 10 : null, nice: c.clim.t.filter((_, m) => comfort(c.clim, m) >= COMFY).length };
  const best = keys.map((k) => [k, better(k)]).sort((a, b) => b[1] - a[1])[0];
  const worst = keys.filter((k) => k !== best[0]).map((k) => [k, worse(k)]).sort((a, b) => b[1] - a[1])[0];
  const pct = (p) => Math.round(p * 100) + '%';
  const all = (p, first) => (p >= 0.995 ? 'any other city we track' : first ? pct(p) + ' of the ' + N + ' cities we track' : pct(p) + ' of them');
  if (best[1] < 0.6) return { lead: 'Middle of the road', text: c.name + ' is an all-rounder rather than a standout: its best factor, ' + FACT[best[0]].label + ', beats ' + pct(best[1]) + ' of the ' + N + ' cities we track, and its weakest, ' + FACT[worst[0]].label + ', trails ' + pct(worst[1]) + ' of them.' + gapTxt };
  // "Better than" counts only cities it strictly beats, so ties don't inflate the share.
  if (worst[1] < 0.5) return { lead: gaps.length ? 'Strong where we have data' : 'No weak spot', text: c.name + ' ' + FACT[best[0]].strong(all(best[1], true), x) + ', and even its lowest-ranked ' + (gaps.length ? 'measured ' : '') + 'factor, ' + FACT[worst[0]].label + ', is better than ' + pct(better(worst[0])) + ' of them.' + gapTxt };
  return { lead: 'The trade-off', text: c.name + ' ' + FACT[best[0]].strong(all(best[1], true), x) + ', but ' + FACT[worst[0]].weak(all(worst[1], false), x) + '.' + gapTxt };
}

/** Cities in other countries whose weather is closest to this one's, closest first (any cost). */
export function weatherTwins(db, c, n = 4) {
  return db.cities.filter((x) => x.country !== c.country).map((x) => ({ city: x, gap: weatherGap(c, x), saving: c.costComfort != null && x.costComfort != null ? c.costComfort - x.costComfort : null }))
    .sort((a, b) => a.gap - b.gap).slice(0, n);
}

/** Cities in other countries with weather like this one's that cost at least 10% less, closest weather first. */
export function cheaperTwins(db, c, n = 4) {
  if (c.costComfort == null) return [];
  return db.cities.filter((x) => x.country !== c.country && x.costComfort != null && x.costComfort <= c.costComfort * 0.9)
    .map((x) => ({ city: x, gap: weatherGap(c, x), saving: c.costComfort - x.costComfort })).filter((o) => o.gap <= 3)
    .sort((a, b) => a.gap - b.gap).slice(0, n);
}
