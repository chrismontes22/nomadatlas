import { costIn, LIFESTYLES } from './cost.mjs';
import { comfort, yearComfort, DEFAULT_CLIMATE } from './climate.mjs';
import { visaEase } from './visa.mjs';
import { overlap, refDate } from './tz.mjs';

const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const lin = (v, lo, hi) => clamp(((v - lo) / (hi - lo)) * 100);
const logScale = (v, lo, hi) => clamp(((Math.log(Math.max(v, 1e-6)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * 100);
const weighted = (parts) => { let s = 0, w = 0; for (const [v, k] of parts) if (v != null && Number.isFinite(v)) { s += v * k; w += k; } return w ? Math.round(s / w) : null; };
const val = (x) => (Array.isArray(x) ? x[0] : x ?? null);

/** Internet: M-Lab median download (log scale, 4 to 90 Mbps) 80%, share of people online 20%. */
export function internetScore(c) {
  const down = c.net?.down, users = val(c.ind?.internetUsers);
  return weighted([[down != null ? logScale(down, 4, 90) : null, 0.8], [users != null ? lin(users, 40, 100) : null, 0.2]]);
}
/** Safety & stability: WGI political stability score and intentional homicide rate (log scale, 0.5 to 30 per 100k). */
export function safetyScore(c) {
  const stab = val(c.gov?.stability), hom = val(c.ind?.homicide);
  return weighted([[stab, 0.5], [hom != null ? 100 - logScale(hom, 0.5, 30) : null, 0.5]]);
}
/** Healthcare: life expectancy (62 to 84 years) and health spending per person (PPP, log scale $150 to $7,000). */
export function healthScore(c) {
  const le = val(c.ind?.lifeExp), hx = val(c.ind?.healthExp);
  return weighted([[le != null ? lin(le, 62, 84) : null, 0.5], [hx != null ? logScale(hx, 150, 7000) : null, 0.5]]);
}
/** Air quality: annual mean PM2.5 exposure, 5 µg/m³ (WHO guideline) = 100 down to 45 µg/m³ = 0. */
export function airScore(c) {
  const pm = val(c.ind?.pm25);
  return pm == null ? null : Math.round(100 - lin(pm, 5, 45));
}
export const countryScores = (c) => ({ internet: internetScore(c), safety: safetyScore(c), health: healthScore(c), air: airScore(c) });

export const FACTORS = [
  { key: 'cost', label: 'Affordability', short: 'Cost' },
  { key: 'climate', label: 'Weather', short: 'Weather' },
  { key: 'internet', label: 'Internet', short: 'Internet' },
  { key: 'safety', label: 'Safety & stability', short: 'Safety' },
  { key: 'visa', label: 'Visa ease', short: 'Visa' },
  { key: 'timezone', label: 'Time-zone fit', short: 'Time zone' },
  { key: 'health', label: 'Healthcare', short: 'Health' },
  { key: 'air', label: 'Air quality', short: 'Air' },
];
export const DEFAULT_WEIGHTS = { cost: 3, climate: 2, internet: 2, safety: 2, visa: 2, timezone: 2, health: 1, air: 1 };

/** 100 when the estimate uses 65% of the budget or less, 0 at 130% of the budget. Without a budget: log scale $1,100 to $6,000. */
export function affordability(costUsd, budgetUsd) {
  if (costUsd == null) return null;
  if (!(budgetUsd > 0)) return Math.round(100 - logScale(costUsd, 1100, 6000));
  return Math.round(clamp(((1.3 - costUsd / budgetUsd) / (1.3 - 0.65)) * 100));
}

export function scoreCity(city, country, q, visa) {
  const parts = {};
  const cost = costIn(country, q.basket);
  parts.cost = cost ? affordability(cost.total, q.budgetUsd) : null;
  parts.climate = q.month == null ? yearComfort(city.clim, q.climate) : comfort(city.clim, q.month, q.climate || DEFAULT_CLIMATE);
  const sc = country.sc || {};
  parts.internet = sc.internet ?? null; parts.safety = sc.safety ?? null; parts.health = sc.health ?? null; parts.air = sc.air ?? null;
  let v = null;
  if (q.passports?.length && visa) { v = visa.best(q.passports, country.iso3); if (q.passports.includes(country.iso3)) v = { s: 'home', days: null }; parts.visa = visaEase(v); }
  else parts.visa = null;
  let ov = null;
  if (q.team?.tz) {
    ov = overlap(q.team, { tz: city.tz, start: q.me?.start ?? 8, end: q.me?.end ?? 20 }, refDate(q.year || new Date().getUTCFullYear(), q.month ?? new Date().getUTCMonth()));
    const need = Math.max(0.5, q.needOverlap ?? 4) * 60;
    parts.timezone = ov ? Math.round(clamp((ov.minutes / need) * 100)) : null;
  } else parts.timezone = null;
  let s = 0, sw = 0;
  for (const f of FACTORS) { const w = +(q.weights?.[f.key] ?? 0); const p = parts[f.key]; if (w > 0 && p != null) { s += w * p; sw += w; } }
  return { city, country, total: sw ? Math.round(s / sw) : null, parts, costUsd: cost?.total ?? null, costLines: cost?.lines ?? null, visa: v, overlap: ov, banned: v?.s === 'banned' };
}

export function rankCities(db, q, filter) {
  const out = [];
  for (const c of db.cities) {
    const r = scoreCity(c, c.country, q, db.visa);
    if (r.total == null || r.banned) continue;
    if (filter && !filter(r)) continue;
    out.push(r);
  }
  return out.sort((a, b) => b.total - a.total || (a.costUsd ?? 1e9) - (b.costUsd ?? 1e9) || a.city.name.localeCompare(b.city.name));
}

// Passport-independent score used on city pages and indexes: default weights, year-round weather, comfortable lifestyle, $3,000 budget.
export const STATIC_QUERY = { month: null, climate: DEFAULT_CLIMATE, budgetUsd: 3000, basket: LIFESTYLES.comfortable.basket, weights: { ...DEFAULT_WEIGHTS, visa: 0, timezone: 0 } };
export const scoreClass = (v) => (v == null ? 'na' : v >= 75 ? 'hi' : v >= 55 ? 'mid' : v >= 35 ? 'lo' : 'vlo');
