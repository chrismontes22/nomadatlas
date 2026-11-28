export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const MONTH_SLUGS = MONTHS.map((m) => m.toLowerCase());

const nf = new Map();
const getNf = (key, opts) => { if (!nf.has(key)) nf.set(key, new Intl.NumberFormat('en-US', opts)); return nf.get(key); };

export function fmtNum(v, d = 0) {
  if (v == null || !Number.isFinite(+v)) return '–';
  return getNf('n' + d, { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
}
export function fmtMoney(v, cur = 'USD', step = 10) {
  if (v == null || !Number.isFinite(+v)) return '–';
  const r = step ? Math.round(v / step) * step : v;
  try { return getNf('c' + cur, { style: 'currency', currency: cur, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(r); }
  catch { return cur + ' ' + fmtNum(r); }
}
export const fmtPct = (v, d = 0) => (v == null || !Number.isFinite(+v) ? '–' : fmtNum(v, d) + '%');
export function fmtSignedPct(v) {
  if (v == null || !Number.isFinite(v)) return '–';
  const r = Math.round(v);
  return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r) + '%';
}
export const cToF = (c) => (c * 9) / 5 + 32;
export function fmtTemp(c, unit = 'C') {
  if (c == null || !Number.isFinite(c)) return '–';
  return unit === 'F' ? Math.round(cToF(c)) + '°F' : Math.round(c) + '°C';
}
export const fmtMm = (mm) => (mm == null || !Number.isFinite(+mm) ? '–' : fmtNum(mm) + ' mm');
export function fmtCoord(lat, lng) {
  return Math.abs(lat).toFixed(2) + '°' + (lat >= 0 ? 'N' : 'S') + ' ' + Math.abs(lng).toFixed(2) + '°' + (lng >= 0 ? 'E' : 'W');
}
export function fmtOffset(min) {
  if (min == null || !Number.isFinite(min)) return '–';
  const s = min >= 0 ? '+' : '−'; const a = Math.abs(min);
  const h = Math.floor(a / 60), m = a % 60;
  return 'UTC' + s + h + (m ? ':' + String(m).padStart(2, '0') : '');
}
export function fmtHours(min) {
  if (min == null || !Number.isFinite(min)) return '–';
  const t = Math.round(Math.abs(min)), h = Math.floor(t / 60), m = t % 60;
  return (min < 0 && t ? '−' : '') + (m ? h + 'h ' + m + 'm' : h + 'h');
}
export const fmtClock = (minOfDay) => {
  const m = ((Math.round(minOfDay) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
};
export function fmtPop(n) {
  if (!n) return '–';
  if (n >= 1e6) return fmtNum(n / 1e6, n >= 1e7 ? 0 : 1) + ' million';
  if (n >= 1e3) return fmtNum(Math.round(n / 1000)) + ',000';
  return fmtNum(n);
}
export function listJoin(arr, word = 'and') {
  const a = arr.filter(Boolean);
  if (a.length <= 1) return a.join('');
  return a.slice(0, -1).join(', ') + ' ' + word + ' ' + a[a.length - 1];
}
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** "a" or "an" before a country name used as an adjective ("an India passport", "a United States passport"). */
export const an = (name) => (/^[AEIO]/.test(name) || /^U[zr]/.test(name) ? 'an ' : 'a ') + name;export function monthRanges(months) {
  // [0,1,2,6,7] -> "January–March, July–August"
  const set = [...new Set(months)].sort((a, b) => a - b);
  if (!set.length) return '';
  if (set.length === 12) return 'all year';
  const runs = []; let start = set[0], prev = set[0];
  for (const m of set.slice(1).concat([99])) {
    if (m === prev + 1) { prev = m; continue; }
    runs.push([start, prev]); start = prev = m;
  }
  // merge wrap-around (Dec–Jan)
  if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === 11) { const last = runs.pop(); runs[0] = [last[0], runs[0][1]]; }
  return runs.map(([a, b]) => (a === b ? MONTHS[a] : MONTHS[a] + '–' + MONTHS[b])).join(', ');
}
