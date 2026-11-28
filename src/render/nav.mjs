export const TOOLS = [
  { key: 'match', icon: 'compass', tone: 'teal', path: '/', name: 'Destination finder', short: 'Destination finder', desc: 'Rank {cities} cities by your budget, passport, time zone and the weather you like.' },
  { key: 'year', icon: 'route', tone: 'rose', path: '/nomad-year-planner/', name: 'Nomad year planner', short: 'Year planner', desc: 'Plan 12 months across several cities: costs, flights, weather and Schengen days together.' },
  { key: 'cost', icon: 'wallet', tone: 'emerald', path: '/cost-of-living-calculator/', name: 'Cost of living calculator', short: 'Cost of living', desc: 'See what your lifestyle costs in {priced} countries, category by category.' },
  { key: 'visa', icon: 'passport', tone: 'violet', path: '/visa-free-countries/', name: 'Visa-free countries by passport', short: 'Visa-free countries', desc: 'Where your passport, or two passports combined, gets you in without a visa.' },
  { key: 'schengen', icon: 'calendar', tone: 'sky', path: '/schengen-calculator/', name: 'Schengen 90/180 calculator', short: 'Schengen 90/180', desc: 'Count the days you have used in the Schengen Area and how long you can still stay.' },
  { key: 'timezone', icon: 'clock', tone: 'indigo', path: '/time-zone-overlap-calculator/', name: 'Time zone overlap calculator', short: 'Time zone overlap', desc: 'Find cities where your working day overlaps with your team’s.' },
  { key: 'weather', icon: 'sun', tone: 'amber', path: '/where-to-go/', name: 'Where to go by month', short: 'Weather by month', desc: 'Find cities with the weather you want in any month of the year.' },
  { key: 'flight', icon: 'plane', tone: 'coral', path: '/flight-carbon-calculator/', name: 'Flight distance & CO₂ calculator', short: 'Flight CO₂', desc: 'Distance, flight time and emissions between any two places.' },
];
export const toolByKey = (k) => TOOLS.find((t) => t.key === k);
/** A tool's description with the current number of cities and priced countries filled in. */
export const toolDesc = (ctx, t) => t.desc.replace('{cities}', ctx.db.cities.length).replace('{priced}', pricedCount(ctx.db));
/** Countries with a price level, so the cost tools can be used for them. */
export const pricedCount = (db) => (db._priced ??= db.countries.filter((c) => c.pli).length);
