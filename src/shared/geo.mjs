const R = 6371.0088;
const rad = (d) => (d * Math.PI) / 180;
export function haversine(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Flight emissions with UK DESNZ conversion factors (kg CO2e per passenger-km). DESNZ already builds the recommended 8%
// great-circle distance uplift into these factors (2025 methodology paper, para 8.39), so they apply to plain great-circle km.
// Flights within one country use DESNZ's domestic factor (an average-passenger figure, so the cabin class does not change it).
export const CABINS = { economy: 'Economy', premium: 'Premium economy', business: 'Business', first: 'First' };
export function flightEstimate(distKm, em, { cabin = 'economy', rf = true, trips = 1, domestic = false } = {}) {
  if (!em || !Number.isFinite(distKm)) return null;
  const longHaul = distKm >= em.shortHaulMaxKm;
  const useDomestic = domestic && !longHaul && em.domestic?.avg?.rf != null;
  const band = longHaul ? em.longHaul : em.shortHaul;
  const cls = useDomestic ? em.domestic.avg : band[cabin] || (cabin === 'first' ? band.business : band.economy);
  const factor = rf ? cls.rf : cls.noRf;
  const billed = distKm * (1 + (em.distanceUplift || 0));
  return {
    distKm, billedKm: billed, longHaul, domestic: useDomestic, factor,
    kg: billed * factor * trips,
    hours: distKm / 820 + 0.5,
  };
}

// Equal Earth projection matching data/map.json
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
export function project(proj, lat, lng) {
  const l = rad(lng), p = rad(lat);
  const t = Math.asin(M * Math.sin(p)); const t2 = t * t, t6 = t2 * t2 * t2;
  const x = (l * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [proj.tx + x * proj.scale, -y * proj.scale + proj.ty];
}
