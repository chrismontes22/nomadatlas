const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
export const DEFAULT_CLIMATE = { tMin: 16, tMax: 25, maxRain: 150 };

/** 0-100 comfort for a month, from mean temperature (vs the preferred band), rainfall and muggy heat. */
export function comfort(clim, m, prefs = DEFAULT_CLIMATE) {
  const t = clim.t[m]; if (t == null) return null;
  const rain = clim.rain[m] ?? 0, rh = clim.rh[m] ?? 60;
  const d = t < prefs.tMin ? prefs.tMin - t : t > prefs.tMax ? t - prefs.tMax : 0;
  let s = 100 - d * (t < prefs.tMin ? 8 : 11);
  const maxRain = prefs.maxRain ?? 150;
  s -= clamp((rain - maxRain * 0.35) / (maxRain * 1.65), 0, 1) * 40;
  if (t > 22) s -= clamp((rh - 65) / 25, 0, 1) * clamp((t - 22) / 6, 0, 1) * 14;
  return Math.round(clamp(s));
}
export function yearComfort(clim, prefs = DEFAULT_CLIMATE) {
  const v = clim.t.map((_, m) => comfort(clim, m, prefs)).filter((x) => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}
export function bestMonths(clim, prefs = DEFAULT_CLIMATE, threshold = 75) {
  const s = clim.t.map((_, m) => comfort(clim, m, prefs));
  let best = s.map((v, m) => (v >= threshold ? m : -1)).filter((m) => m >= 0);
  if (best.length < 2) best = s.map((v, m) => [v, m]).sort((a, b) => b[0] - a[0]).slice(0, 3).map((x) => x[1]).sort((a, b) => a - b);
  return best;
}
export function describe(clim, m) {
  const t = clim.t[m], r = clim.rain[m] ?? 0, rh = clim.rh[m] ?? 60;
  if (t == null) return '';
  const temp = t < 0 ? 'freezing' : t < 8 ? 'cold' : t < 14 ? 'cool' : t < 20 ? 'mild' : t < 25 ? 'warm' : t < 29 ? 'hot' : 'very hot';
  const humid = t >= 23 && rh >= 75;
  const wet = r >= 200 ? 'very rainy' : r >= 100 ? 'rainy' : r < 25 && !humid ? 'dry' : null;
  const s = [temp, humid ? 'humid' : null, wet].filter(Boolean).join(', ');
  return s[0].toUpperCase() + s.slice(1);
}
