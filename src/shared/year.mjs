// Nomad year planner: a run of stays (a city and a number of months each) through the year, with living costs, weather,
// flights, visas and the Schengen 90/180 rule worked out together. Shared by the build (example plans) and the browser.
import { costIn, LIFESTYLES } from './cost.mjs';
import { comfort, DEFAULT_CLIMATE } from './climate.mjs';
import { haversine, flightEstimate } from './geo.mjs';
import { SCHENGEN, EU_NON_SCHENGEN } from './schengen.mjs';

export const MAX_STOPS = 8, MAX_MONTHS = 24, PLEASANT = 75;
const DAY = 864e5;
const EASY = new Set(['free', 'voa', 'eta', 'home']);
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

const legParts = (str) => String(str || '').split(',').map((p) => p.trim()).filter(Boolean);
/**
 * "lisbon:3,chiang-mai:2" -> [{ city, months }]. Unknown cities are dropped; months are 1 to 12; at most 8 stops. The plan
 * ends at the first stop that would take it past 24 months (stops are a route, so a later stop never jumps the queue).
 */
export function parseLegs(db, str) {
  let total = 0;
  const out = [];
  for (const p of legParts(str).slice(0, MAX_STOPS)) {
    const [slug, m] = p.split(':'), city = db.cityBySlug.get(slug);
    if (!city) continue;
    const months = Math.max(1, Math.min(12, Math.round(+m) || 1));
    if (total + months > MAX_MONTHS) break;
    total += months;
    out.push({ city, months });
  }
  return out;
}
export const legsToString = (legs) => legs.map((l) => l.city.slug + ':' + l.months).join(',');

/** Entry rule for a passport (or null when no passport is chosen). */
function visaFor(db, passport, iso3) {
  if (!passport || !db.visa) return null;
  return passport === iso3 ? { s: 'home', days: null } : db.visa.get(passport, iso3);
}
/** True when the Schengen 90/180 rule applies to this passport (everyone except EU, EEA and Swiss citizens). */
export const schengenApplies = (passport) => !(passport && (SCHENGEN.includes(passport) || EU_NON_SCHENGEN.includes(passport)));

/**
 * Days in the Schengen Area across the plan, checked against "at most 90 days in any 180" on every day.
 * flags: one 0/1 per plan day. Returns { days, peak, overDay, used } with overDay the first day spent in the area over the
 * limit (or -1) and used the count of the 180 days up to each day.
 */
function schengenWindow(flags) {
  const P = [0];
  for (let i = 0; i < flags.length; i++) P.push(P[i] + flags[i]);
  let peak = 0, overDay = -1;
  const used = new Array(flags.length);
  for (let i = 0; i < flags.length; i++) {
    used[i] = P[i + 1] - P[Math.max(0, i - 179)];
    if (used[i] > peak) peak = used[i];
    if (used[i] > 90 && flags[i] && overDay < 0) overDay = i;
  }
  return { days: P[flags.length], peak, overDay, used };
}

/**
 * Works out a plan. s: { year, start (first month, 0 to 11), p (passport ISO3 or ''), life (lifestyle key), legs (string) }.
 * Assumes no Schengen days were used in the 180 days before the plan starts.
 */
export function planYear(db, s) {
  const legs = parseLegs(db, s.legs);
  const basket = (LIFESTYLES[s.life] || LIFESTYLES.comfortable).basket;
  const year = +s.year || new Date().getUTCFullYear(), m0 = Math.max(0, Math.min(11, +s.start || 0)), t0 = Date.UTC(year, m0, 1);
  let mi = 0, runDays = 0, runStops = 0;
  const stops = legs.map((l, i) => {
    const c = l.city, prev = legs[i - 1]?.city, from = Date.UTC(year, m0 + mi, 1), to = Date.UTC(year, m0 + mi + l.months, 1) - DAY;
    const months = Array.from({ length: l.months }, (_, k) => (m0 + mi + k) % 12);
    mi += l.months;
    const perMonth = costIn(c.country, basket)?.total ?? null;
    const comf = months.map((m) => comfort(c.clim, m, DEFAULT_CLIMATE));
    let flight = null;
    if (prev && prev !== c) {
      const km = haversine(prev.lat, prev.lng, c.lat, c.lng);
      flight = { km, ...flightEstimate(km, db.emissions, { domestic: prev.iso3 === c.iso3 }) };
    }
    const days = Math.round((to - from) / DAY) + 1, visa = visaFor(db, s.p, c.iso3), schengen = SCHENGEN.includes(c.iso3);
    // Back-to-back stops in one country are one stay as far as a visa-free limit goes (you never leave the country).
    const sameRun = prev && prev.iso3 === c.iso3, before = sameRun ? runDays : 0;
    runDays = before + days; runStops = sameRun ? runStops + 1 : 0;
    const notes = [];
    if (visa) {
      if (visa.s === 'banned') notes.push('no admission on this passport');
      else if (!EASY.has(visa.s)) notes.push('you need ' + (visa.s === 'evisa' ? 'an e-visa' : 'a visa') + ' before you go');
      else if (visa.s === 'free' && visa.days && !schengen && runDays > visa.days) {
        notes.push(before ? 'with the ' + (runStops > 1 ? runStops + ' stops' : 'stop') + ' before it, you would spend ' + runDays + ' days in a row in ' + c.country.name + ', longer than the ' + visa.days + ' days visa-free' : 'your ' + days + '-day stay is longer than the ' + visa.days + ' days visa-free');
      }
    }
    return { i, city: c, months, from: iso(from), to: iso(to), days, startDay: Math.round((from - t0) / DAY), perMonth, cost: perMonth != null ? perMonth * l.months : null, comf, avgComf: Math.round(mean(comf)), temps: months.map((m) => c.clim.t[m]), rain: months.map((m) => c.clim.rain[m]), flight, visa, schengen, notes };
  });
  const totalDays = stops.length ? stops[stops.length - 1].startDay + stops[stops.length - 1].days : 0;
  const flags = new Array(totalDays).fill(0);
  for (const st of stops) if (st.schengen) for (let d = 0; d < st.days; d++) flags[st.startDay + d] = 1;
  const sch = schengenWindow(flags), applies = schengenApplies(s.p);
  const over = applies && sch.overDay >= 0 ? sch.overDay : -1;
  const overStop = over >= 0 ? stops.find((st) => over >= st.startDay && over < st.startDay + st.days) : null;
  const flights = stops.filter((st) => st.flight);
  const comfAll = stops.flatMap((st) => st.comf).filter((v) => v != null);
  return {
    year, start: m0, stops, months: mi, totalDays,
    // Stops asked for but not planned (past the 24-month limit, or unknown cities in a hand-edited link).
    dropped: Math.min(MAX_STOPS, legParts(s.legs).length) - legs.length,
    cost: stops.every((st) => st.cost != null) ? stops.reduce((a, st) => a + st.cost, 0) : null,
    flights: { n: flights.length, km: flights.reduce((a, st) => a + st.flight.km, 0), kg: flights.reduce((a, st) => a + (st.flight.kg || 0), 0) },
    weather: { avg: comfAll.length ? Math.round(mean(comfAll)) : null, pleasant: comfAll.filter((v) => v >= PLEASANT).length },
    schengen: { applies, days: sch.days, peak: sch.peak, over: over >= 0, overDate: over >= 0 ? iso(t0 + over * DAY) : null, leaveBy: over >= 0 ? iso(t0 + (over - 1) * DAY) : null, overStop },
    // For the timeline: days counted in the 180 up to the end of each month, and whether any day of that month spent in the
    // Schengen Area was over the limit.
    schengenByMonth: Array.from({ length: mi }, (_, k) => {
      const a = Math.round((Date.UTC(year, m0 + k, 1) - t0) / DAY), b = Math.round((Date.UTC(year, m0 + k + 1, 1) - t0) / DAY) - 1;
      let over = false;
      if (applies) for (let d = a; d <= b; d++) if (flags[d] && sch.used[d] > 90) { over = true; break; }
      return { n: sch.used[b] ?? 0, over };
    }),
  };
}

/**
 * A sun-chasing year: for each stop length in turn, the city whose weather in those months is most comfortable, nudged towards
 * higher-rated cities and shorter flights, one country per stop. With a passport it only picks places you can enter without a
 * visa in advance and never breaks the Schengen rule; maxCost caps the monthly cost of the chosen lifestyle (USD).
 */
export function sunChaser(db, { year, start = 0, months = [3, 3, 3, 3], p = '', life = 'comfortable', maxCost = null } = {}) {
  const basket = (LIFESTYLES[life] || LIFESTYLES.comfortable).basket, picks = [], applies = schengenApplies(p);
  const y = +year || new Date().getUTCFullYear(), t0 = Date.UTC(y, start, 1);
  let m = start, flags = [];
  for (const len of months) {
    const ms = Array.from({ length: len }, (_, k) => (m + k) % 12);
    const days = Math.round((Date.UTC(y, m + len, 1) - Date.UTC(y, m, 1)) / DAY);
    let best = null;
    for (const c of db.citiesRanked) {
      if (picks.some((x) => x.city.iso3 === c.iso3)) continue;
      const v = visaFor(db, p, c.iso3);
      if (p && (!v || !EASY.has(v.s))) continue;
      if (v?.s === 'free' && v.days && days > v.days && !SCHENGEN.includes(c.iso3)) continue; // longer than the visa-free stay
      const cost = costIn(c.country, basket)?.total;
      if (cost == null || (maxCost && cost > maxCost)) continue;
      if (applies && SCHENGEN.includes(c.iso3)) {
        const f = flags.concat(new Array(days).fill(1));
        if (schengenWindow(f).overDay >= 0) continue;
      }
      const prev = picks[picks.length - 1]?.city;
      const score = mean(ms.map((mm) => comfort(c.clim, mm, DEFAULT_CLIMATE))) + 0.25 * (c.score ?? 0) - (prev ? haversine(prev.lat, prev.lng, c.lat, c.lng) / 1500 : 0);
      if (!best || score > best.score) best = { c, score };
    }
    if (!best) break;
    picks.push({ city: best.c, months: len });
    flags = flags.concat(new Array(days).fill(applies && SCHENGEN.includes(best.c.iso3) ? 1 : 0));
    m += len;
  }
  return picks;
}
