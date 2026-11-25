// Time zone helpers built on the browser's/Node's Intl API (IANA tz database).
const dtfCache = new Map();
function dtf(tz) {
  if (!dtfCache.has(tz)) dtfCache.set(tz, new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  return dtfCache.get(tz);
}
/** UTC offset in minutes for a zone at an instant. */
export function tzOffset(tz, date = new Date()) {
  try {
    const p = Object.fromEntries(dtf(tz).formatToParts(date).map((x) => [x.type, x.value]));
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  } catch { return null; }
}
/** Mid-month reference instant (DST-aware comparisons for a given month). */
export const refDate = (year, month) => new Date(Date.UTC(year, month, 15, 12));

const span = (start, end) => { let s = start * 60, e = end * 60; if (e <= s) e += 1440; return [s, e]; };

/**
 * Overlap between a team's working hours and the hours you are willing to work, in minutes.
 * team: { tz, start, end } hours in the team's local time; me: { tz, start, end } hours in your local time.
 */
export function overlap(team, me, date) {
  const oT = tzOffset(team.tz, date), oM = tzOffset(me.tz, date);
  if (oT == null || oM == null) return null;
  const [ts, te] = span(team.start, team.end).map((x) => x - oT);
  const [ms, me2] = span(me.start, me.end).map((x) => x - oM);
  let total = 0; let first = null;
  for (const k of [-1440, 0, 1440]) {
    const a = Math.max(ts, ms + k), b = Math.min(te, me2 + k);
    if (b > a) { total += b - a; if (!first) first = [a + oM - k, b + oM - k]; }
  }
  return { minutes: total, localStart: first ? first[0] : null, localEnd: first ? first[1] : null, diff: oM - oT };
}

export const COMMON_ZONES = [
  ['America/Los_Angeles', 'Los Angeles / San Francisco'], ['America/Denver', 'Denver'], ['America/Chicago', 'Chicago / Austin'],
  ['America/New_York', 'New York / Toronto'], ['America/Mexico_City', 'Mexico City'], ['America/Bogota', 'Bogotá / Lima'], ['America/Sao_Paulo', 'São Paulo'],
  ['America/Argentina/Buenos_Aires', 'Buenos Aires'], ['Europe/London', 'London / Dublin / Lisbon'], ['Europe/Berlin', 'Berlin / Paris / Madrid'],
  ['Europe/Athens', 'Athens / Kyiv'], ['Europe/Istanbul', 'Istanbul'], ['Asia/Dubai', 'Dubai'], ['Asia/Kolkata', 'India'],
  ['Asia/Bangkok', 'Bangkok / Jakarta'], ['Asia/Singapore', 'Singapore / Manila'], ['Asia/Tokyo', 'Tokyo / Seoul'],
  ['Australia/Sydney', 'Sydney / Melbourne'], ['Pacific/Auckland', 'Auckland'], ['UTC', 'UTC'],
];
