// Cost model: a monthly basket priced at US price levels, re-priced for each country with category price level indices
// (ICP 2021 structure, latest World Bank level; United States = 100).
export const CATEGORIES = [
  { key: 'housing', label: 'Rent & utilities', desc: 'Furnished one-bedroom in a central area, with electricity, water and heating', pli: 'housing' },
  { key: 'groceries', label: 'Groceries', desc: 'Food and non-alcoholic drinks for cooking at home', pli: 'food' },
  { key: 'dining', label: 'Eating out', desc: 'Restaurants, cafés and takeaway', pli: 'restaurants' },
  { key: 'transport', label: 'Getting around', desc: 'Public transport, taxis and ride-hailing', pli: 'transport' },
  { key: 'connectivity', label: 'Phone & internet', desc: 'Mobile plan and home broadband', pli: 'communication' },
  { key: 'leisure', label: 'Coworking & leisure', desc: 'Coworking desk, gym, culture and nights out', pli: 'recreation' },
  { key: 'health', label: 'Health & personal care', desc: 'Pharmacy, doctor visits and personal care', pli: 'health' },
  { key: 'other', label: 'Everything else', desc: 'Clothing, toiletries and other spending', pli: 'misc' },
  { key: 'insurance', label: 'Travel health insurance', desc: 'International cover, priced the same wherever you are', fixed: true },
];

// Monthly spending at United States price levels (USD). These are editable assumptions, documented on /methodology/.
export const LIFESTYLES = {
  lean: { label: 'Lean', desc: 'Studio or room, mostly home cooking, public transport', basket: { housing: 1250, groceries: 350, dining: 180, transport: 90, connectivity: 60, leisure: 120, health: 50, other: 150, insurance: 60 } },
  comfortable: { label: 'Comfortable', desc: 'Furnished one-bedroom, eating out a few times a week, coworking', basket: { housing: 2000, groceries: 450, dining: 450, transport: 150, connectivity: 80, leisure: 300, health: 100, other: 250, insurance: 100 } },
  premium: { label: 'Premium', desc: 'Larger flat in the best area, frequent restaurants, taxis', basket: { housing: 3200, groceries: 600, dining: 900, transport: 300, connectivity: 100, leisure: 600, health: 150, other: 450, insurance: 180 } },
};
export const basketTotal = (b) => Object.values(b).reduce((a, v) => a + (+v || 0), 0);

// Short-term furnished rentals in central areas track the overall price level more closely than national average rents
// (which include rural and social housing). We weight ICP housing prices 30% and the overall consumption level 70%.
export const HOUSING_BLEND = 0.3;

export function priceIndex(country, cat) {
  const p = country?.pli;
  if (!p) return null;
  if (cat.fixed) return 100;
  if (cat.key === 'housing') return HOUSING_BLEND * p.housing + (1 - HOUSING_BLEND) * p.aic;
  return p[cat.pli] ?? p.aic;
}

/** Cost of a US-priced basket in a country, in USD. */
export function costIn(country, basket) {
  if (!country?.pli) return null;
  let total = 0;
  const lines = CATEGORIES.map((cat) => {
    const v = ((+basket[cat.key] || 0) * priceIndex(country, cat)) / 100;
    total += v;
    return { key: cat.key, label: cat.label, value: v, index: priceIndex(country, cat) };
  });
  return { total, lines };
}

/** Re-price spending observed in one country (any currency) for another country. */
export function translate(spend, home, dest) {
  if (!home?.pli || !dest?.pli) return null;
  let total = 0, homeTotal = 0;
  const lines = CATEGORIES.map((cat) => {
    const h = +spend[cat.key] || 0;
    const ratio = priceIndex(dest, cat) / priceIndex(home, cat);
    const v = h * ratio; total += v; homeTotal += h;
    return { key: cat.key, label: cat.label, home: h, value: v, ratio };
  });
  return { total, homeTotal, lines, ratio: homeTotal ? total / homeTotal : null };
}

export const toCur = (usd, cur, rates) => (usd == null ? null : usd * (rates?.rates?.[cur] ?? 1));
export const fromCur = (amt, cur, rates) => (amt == null ? null : amt / (rates?.rates?.[cur] ?? 1));
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'JPY', 'SGD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'BRL', 'MXN', 'ZAR', 'INR', 'HKD', 'KRW', 'THB', 'IDR', 'PHP', 'MYR', 'TRY', 'ILS', 'CNY', 'RON', 'ISK'];
