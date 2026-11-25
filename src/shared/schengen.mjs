// Schengen short-stay rule: at most 90 days in any rolling 180-day period. Entry and exit days both count.
export const SCHENGEN = ['AUT', 'BEL', 'BGR', 'HRV', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'ISL', 'ITA', 'LVA', 'LIE', 'LTU', 'LUX', 'MLT', 'NLD', 'NOR', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE', 'CHE'];
const DAY = 86400000;
export const toDay = (s) => { const t = Date.parse(String(s) + 'T00:00:00Z'); return Number.isFinite(t) ? Math.floor(t / DAY) : NaN; };
export const fromDay = (d) => new Date(d * DAY).toISOString().slice(0, 10);
export const todayISO = () => new Date().toISOString().slice(0, 10);

export function daySet(trips) {
  const set = new Set();
  for (const t of trips || []) {
    const a = toDay(t.entry), b = toDay(t.exit);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a || b - a > 3660) continue;
    for (let d = a; d <= b; d++) set.add(d);
  }
  return set;
}
export function usedOn(days, d) { let n = 0; for (let x = d - 179; x <= d; x++) if (days.has(x)) n++; return n; }

/** Longest stay starting on entry day without breaking the rule (also protects later planned trips). */
export function maxStay(trips, entryISO) {
  const days = daySet(trips); const e = toDay(entryISO);
  if (!Number.isFinite(e)) return null;
  const future = [...days].filter((d) => d >= e);
  let n = 0;
  for (let k = 0; k < 90; k++) {
    const d = e + k;
    if (days.has(d)) { n++; continue; }
    days.add(d);
    const ok = usedOn(days, d) <= 90 && future.every((f) => f <= d || usedOn(days, f) <= 90);
    if (!ok) { days.delete(d); break; }
    n++;
  }
  return { days: n, lastDay: n ? fromDay(e + n - 1) : null };
}

export function analyze(trips, checkISO) {
  const days = daySet(trips); const cd = toDay(checkISO);
  const used = usedOn(days, cd);
  const sorted = [...days].sort((a, b) => a - b);
  const overstays = sorted.filter((d) => usedOn(days, d) > 90);
  // first date on/after check when a full 90 days is available again
  let resetDay = null;
  for (let d = cd; d < cd + 400; d++) { if (usedOn(days, d) === 0 && !days.has(d)) { resetDay = d; break; } }
  const series = [];
  for (let d = cd - 179; d <= cd + 180; d++) series.push({ d, used: usedOn(days, d), present: days.has(d) });
  return { used, remaining: Math.max(0, 90 - used), overstays: overstays.map(fromDay), firstOverstay: overstays.length ? fromDay(overstays[0]) : null, resetDate: resetDay ? fromDay(resetDay) : null, series, checkDay: cd, totalDays: days.size };
}
