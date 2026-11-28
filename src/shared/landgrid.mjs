// A near-equal-area grid of points on the globe, used for the dotted globe on the home page and the social images.
// scripts/lib/land.mjs marks which points are on land (from data/map.json); the browser rebuilds the same grid and reads those bits.
export const LAND_STEP = 1.5;

/** Calls cb(lat, lng) for every grid point, south to north, west to east. Rows are LAND_STEP degrees apart and points in a row
 *  are spaced so each covers about the same area. */
export function gridPoints(cb, step = LAND_STEP) {
  const rows = Math.round(180 / step), base = Math.round(360 / step);
  for (let i = 0; i < rows; i++) {
    const lat = -90 + step / 2 + i * step;
    const n = Math.max(1, Math.round(base * Math.cos((lat * Math.PI) / 180)));
    for (let j = 0; j < n; j++) cb(lat, -180 + ((j + 0.5) * 360) / n);
  }
}
