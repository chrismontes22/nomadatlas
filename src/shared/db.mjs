import { createVisa } from './visa.mjs';
import { countryScores, scoreCity, STATIC_QUERY } from './scores.mjs';
import { costIn, LIFESTYLES } from './cost.mjs';
import { yearComfort, bestMonths } from './climate.mjs';

/** Builds indexes and derived values. Mutates the parsed JSON objects (do not serialise the result). */
export function createDb({ countries, cities, visa, rates, emissions, meta, map }) {
  const byIso3 = new Map(), countryBySlug = new Map(), cityBySlug = new Map();
  for (const c of countries) { c.sc = countryScores(c); c.cities = []; byIso3.set(c.iso3, c); countryBySlug.set(c.slug, c); }
  for (const ci of cities) { ci.country = byIso3.get(ci.iso3); if (ci.country) ci.country.cities.push(ci); cityBySlug.set(ci.slug, ci); }
  const db = { countries, cities, byIso3, countryBySlug, cityBySlug, rates, emissions, meta, map, visa: visa ? createVisa(visa) : null };
  for (const c of countries) {
    c.costComfort = costIn(c, LIFESTYLES.comfortable.basket)?.total ?? null;
    c.costLean = costIn(c, LIFESTYLES.lean.basket)?.total ?? null;
  }
  for (const ci of cities) {
    const s = scoreCity(ci, ci.country, STATIC_QUERY, null);
    ci.score = s.total; ci.parts = s.parts;
    ci.costComfort = ci.country.costComfort; ci.costLean = ci.country.costLean;
    ci.yearComfort = yearComfort(ci.clim); ci.best = bestMonths(ci.clim);
  }
  const ranked = [...cities].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (a.costComfort ?? 1e9) - (b.costComfort ?? 1e9) || a.name.localeCompare(b.name));
  ranked.forEach((c, i) => { c.rank = i + 1; });
  for (const c of countries) c.cities.sort((a, b) => b.pop - a.pop);
  db.citiesRanked = ranked;
  db.regions = [...new Set(countries.map((c) => c.region))].sort();
  return db;
}
