export const TOOLS = [
  { key: 'match', path: '/', name: 'Destination finder', short: 'Destination finder', desc: 'Rank 184 cities by your budget, passport, time zone and the weather you like.' },
  { key: 'cost', path: '/cost-of-living-calculator/', name: 'Cost of living calculator', short: 'Cost of living', desc: 'See what your lifestyle costs in 180+ countries, category by category.' },
  { key: 'visa', path: '/visa-free-countries/', name: 'Visa-free countries by passport', short: 'Visa-free countries', desc: 'Where your passport, or two passports combined, gets you in without a visa.' },
  { key: 'schengen', path: '/schengen-calculator/', name: 'Schengen 90/180 calculator', short: 'Schengen 90/180', desc: 'Count the days you have used in the Schengen Area and how long you can still stay.' },
  { key: 'timezone', path: '/time-zone-overlap-calculator/', name: 'Time zone overlap calculator', short: 'Time zone overlap', desc: 'Find cities where your working day overlaps with your team’s.' },
  { key: 'weather', path: '/where-to-go/', name: 'Where to go by month', short: 'Weather by month', desc: 'Find cities with the weather you want in any month of the year.' },
  { key: 'flight', path: '/flight-carbon-calculator/', name: 'Flight distance & CO₂ calculator', short: 'Flight CO₂', desc: 'Distance, flight time and emissions between any two places.' },
];
export const toolByKey = (k) => TOOLS.find((t) => t.key === k);
