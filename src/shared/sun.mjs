// Where the sun is right now: the subsolar point and the sun's elevation anywhere on Earth, from NOAA's low-precision solar
// position formulas (good to a fraction of a degree, plenty for shading the home-page globe and spotting golden hour).
const RAD = Math.PI / 180;

/** The point on Earth where the sun is directly overhead at an instant, as {lat, lng} in degrees. */
export function subsolar(date = new Date()) {
  const y = date.getUTCFullYear(), leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = (date.getTime() - Date.UTC(y, 0, 1)) / 864e5; // days since 1 January 00:00 UTC
  const g = ((2 * Math.PI) / (leap ? 366 : 365)) * (days - 0.5); // fractional year in radians, as NOAA defines it
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g)); // minutes
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const utcMin = (date.getTime() - Date.UTC(y, date.getUTCMonth(), date.getUTCDate())) / 6e4;
  // Local solar noon is where true solar time (UTC minutes + equation of time + 4 minutes per degree east) reaches 12:00.
  const lng = (((720 - utcMin - eqt) / 4 + 540) % 360) - 180;
  return { lat: decl / RAD, lng };
}

/** Sun elevation above the horizon in degrees (negative below it), for a place and a subsolar point. Ignores refraction. */
export function sunElevation(lat, lng, sun) {
  const p = lat * RAD, d = sun.lat * RAD, h = (lng - sun.lng) * RAD;
  return Math.asin(Math.max(-1, Math.min(1, Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(h)))) / RAD;
}

/** Golden hour: the sun between 4° below and 6° above the horizon, the band photographers use. */
export const GOLDEN = [-4, 6];
export const inGolden = (lat, lng, sun) => { const e = sunElevation(lat, lng, sun); return e > GOLDEN[0] && e < GOLDEN[1]; };

/**
 * Places in golden hour at an instant (in the order given), or, when there are none, the first place to reach it in the next
 * eight hours and how many minutes away that is.
 */
export function goldenHour(places, date = new Date()) {
  const sun = subsolar(date);
  const now = places.filter((p) => inGolden(p.lat, p.lng, sun));
  if (now.length) return { sun, now, next: null };
  for (let k = 1; k <= 96; k++) {
    const s = subsolar(new Date(date.getTime() + k * 5 * 6e4));
    const hit = places.find((p) => inGolden(p.lat, p.lng, s));
    if (hit) return { sun, now: [], next: { place: hit, minutes: k * 5 } };
  }
  return { sun, now: [], next: null };
}
