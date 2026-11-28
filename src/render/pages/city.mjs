import { html, raw } from '../html.mjs';
import { MONTHS, fmtMoney, fmtNum, fmtTemp, fmtMm, fmtPct, fmtCoord, fmtPop, listJoin, monthRanges, fmtSignedPct } from '../../shared/format.mjs';
import { CATEGORIES, LIFESTYLES, costIn, priceIndex } from '../../shared/cost.mjs';
import { describe } from '../../shared/climate.mjs';
import { stayLabel } from '../../shared/visa.mjs';
import { haversine, flightEstimate } from '../../shared/geo.mjs';
import { FACTORS, STATIC_QUERY } from '../../shared/scores.mjs';
import { fitTitle, fitDesc, scoreChip, meter, statList, climateChart, climateTable, faqBlock, faqLd, sourceNote, cityPath, countryPath, passportPath, cityLabel, cityFull, inCountry as ofCountry, cityCards, visaPill, median, monthPath, cityMapPath, mapFigure, mediaHead } from '../components.mjs';
import { shell, crumbsLd, offsetsLabel, overlapTable } from './common.mjs';
import { countryOptions } from '../tools/match.mjs';
import { cityBadges, cityTradeoff, cheaperTwins, weatherTwins } from '../../shared/insights.mjs';

const TONE_SR = { good: 'Pro: ', warn: 'Con: ', info: 'Note: ' };
const TONE_ORDER = { good: 0, info: 1, warn: 2 };
/** Data-derived pros and cons with one honest trade-off sentence (src/shared/insights.mjs). */
function takeBlock(ctx, c, label) {
  const badges = cityBadges(ctx.db, c, ctx.year).sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
  const t = cityTradeoff(ctx.db, c, { money: (v) => fmtMoney(v) });
  if (!t && !badges.length) return '';
  return html`<section class="take" aria-labelledby="take-h">
  <h2 id="take-h">${label} pros and cons at a glance</h2>
  ${t ? html`<p class="take__line"><b>${t.lead}:</b> ${t.text}</p>` : ''}
  ${badges.length ? html`<ul class="tags">${badges.map((b) => html`<li class="tag tag--${b.tone}"><b><span class="sr">${TONE_SR[b.tone]}</span>${b.label}</b><span>${b.note}</span></li>`)}</ul>` : ''}
  <p class="take__src">Compared with the other ${ctx.db.cities.length - 1} cities in the atlas, using the data on this page. <a href="${ctx.link('/methodology/')}">How we score</a></p>
</section>`;
}
const savingTxt = (s) => (s == null ? '' : s >= 10 ? fmtMoney(s) + '/mo less' : s <= -10 ? fmtMoney(-s) + '/mo more' : 'about the same cost');

export const COMMON_PASSPORTS = ['USA', 'GBR', 'CAN', 'AUS', 'DEU', 'FRA', 'IND', 'CHN', 'BRA', 'ZAF', 'NGA', 'MEX'];
/** Passports quoted as examples in visa FAQs. Pages skip the destination's own passport and take the next one. */
export const VISA_EXAMPLES = [['USA', 'United States citizens'], ['GBR', 'United Kingdom citizens'], ['IND', 'Indian citizens'], ['CAN', 'Canadian citizens']];
/** The M-Lab measurement period, from data/meta.json. */
export const mlabPeriod = (ctx) => ctx.db.meta?.vintages?.mlab || 'January to March 2024';
const val = (x) => (Array.isArray(x) ? x[0] : x ?? null);
const yr = (x) => (Array.isArray(x) ? x[1] : null);
/** For a score averaged from two inputs: a note when only one of them has data. */
const onlyOne = (a, b, onlyA, onlyB) => (a != null && b == null ? onlyA : a == null && b != null ? onlyB : null);
/** Where a country's price levels come from, in words. */
export function priceSource(k) {
  if (k.pliMethod === 'wdi-level') return 'the World Bank overall price level for ' + k.pliYear + '; there is no category detail for ' + k.name + ', so every category uses that level';
  if (k.pliMethod === 'icp2021') return 'World Bank ICP 2021 category prices (no newer overall price level is available)';
  return 'World Bank ICP 2021 category prices, scaled to the ' + k.pliYear + ' overall price level';
}

export function costTable(ctx, k, label) {
  const cols = Object.entries(LIFESTYLES).map(([key, l]) => ({ key, l, cost: costIn(k, l.basket) }));
  return html`<div class="tablewrap"><table class="table table--cost">
    <caption>Estimated monthly spending in ${label}${label !== k.name ? ' at national price levels' : ''}, US dollars</caption>
    <thead><tr><th scope="col">Category</th><th scope="col" class="num">Price level <small>US = 100</small></th>${cols.map((c) => html`<th scope="col" class="num">${c.l.label}</th>`)}</tr></thead>
    <tbody>${CATEGORIES.map((cat, i) => html`<tr><th scope="row">${cat.label}<small>${cat.desc}</small></th><td class="num">${cat.fixed ? '–' : fmtNum(priceIndex(k, cat))}</td>${cols.map((c) => html`<td class="num">${fmtMoney(c.cost.lines[i].value)}</td>`)}</tr>`)}</tbody>
    <tfoot><tr><th scope="row">Total per month</th><td></td>${cols.map((c) => html`<td class="num"><b>${fmtMoney(c.cost.total)}</b></td>`)}</tr></tfoot>
  </table></div>`;
}

export function livingMeters(ctx, k) {
  const n = k.net, I = k.ind, G = k.gov;
  return html`<div class="meters">
    ${meter('Internet', k.sc.internet, n ? `Median download ${fmtNum(n.down)} Mbps, upload ${fmtNum(n.up)} Mbps, latency ${fmtNum(n.rtt)} ms across ${fmtNum(n.samples)} M-Lab tests (${mlabPeriod(ctx)}).${val(I.internetUsers) != null ? ` ${fmtNum(val(I.internetUsers))}% of people use the internet.` : ''}` : 'No recent speed measurements.')}
    ${meter('Safety & stability', k.sc.safety, [val(G.stability) != null ? `Political stability ${fmtNum(val(G.stability))}/100 (World Bank WGI, ${yr(G.stability)}).` : null, val(I.homicide) != null ? `${fmtNum(val(I.homicide), 1)} intentional homicides per 100,000 people (${yr(I.homicide)}).` : null, onlyOne(val(G.stability), val(I.homicide), 'There is no recent homicide figure, so the score uses political stability alone.', 'There is no political stability score, so the score uses the homicide rate alone.')].filter(Boolean).join(' ') || 'No data.')}
    ${meter('Healthcare', k.sc.health, [val(I.lifeExp) != null ? `Life expectancy ${fmtNum(val(I.lifeExp), 1)} years.` : null, val(I.healthExp) != null ? `Health spending ${fmtMoney(val(I.healthExp), 'USD', 10)} per person a year (PPP, ${yr(I.healthExp)}).` : null, onlyOne(val(I.lifeExp), val(I.healthExp), 'There is no health spending figure, so the score uses life expectancy alone.', 'There is no life expectancy figure, so the score uses health spending alone.')].filter(Boolean).join(' ') || 'No data.')}
    ${meter('Air quality', k.sc.air, val(I.pm25) != null ? `Average PM2.5 exposure ${fmtNum(val(I.pm25), 1)} µg/m³, ${fmtNum(val(I.pm25) / 5, 1)} times the WHO guideline (${yr(I.pm25)}).` : 'No data.')}
  </div>`;
}

export function practical(ctx, k, extra = []) {
  return statList([
    ...extra,
    k.currency && { label: 'Currency', value: k.currency + (k.currencyName ? ' · ' + k.currencyName : '') },
    k.plugs.length && { label: 'Plug types', value: k.plugs.map((p) => 'Type ' + p).join(', ') },
    k.volts.length && { label: 'Mains voltage', value: k.volts.join(' / ') + ' V' },
    k.drive && { label: 'Traffic drives on the', value: k.drive === 'left' ? 'Left' : k.drive === 'right' ? 'Right' : 'Left and right' },
    k.phone && { label: 'Calling code', value: k.phone },
  ], 'stats--compact');
}

export function visaTable(ctx, k) {
  const v = ctx.db.visa;
  const rows = COMMON_PASSPORTS.filter((p) => p !== k.iso3).map((p) => [ctx.db.byIso3.get(p), v.get(p, k.iso3)]).filter(([c, x]) => c && x);
  return html`<div class="tablewrap"><table class="table table--compact"><caption>Entry rules for common passports</caption>
    <thead><tr><th scope="col">Passport</th><th scope="col">Entry to ${k.name}</th></tr></thead>
    <tbody>${rows.map(([c, x]) => html`<tr><th scope="row"><a href="${ctx.link(passportPath(c))}">${c.name}</a></th><td>${visaPill(x)}</td></tr>`)}</tbody></table></div>`;
}

export function visaCheck(ctx, k) {
  return html`<div class="visacheck panel" data-tool="visacheck" data-dest="${k.iso3}">
    <label for="vc-${k.iso3}">Check your passport</label>
    <select id="vc-${k.iso3}" name="passport">${countryOptions(ctx, '', 'Choose a passport')}</select>
    <p class="visacheck__out" aria-live="polite">Pick a passport to see the entry rule for ${k.name}.</p>
  </div>`;
}

export function cityPage(ctx, c) {
  const db = ctx.db, k = c.country, y = ctx.year;
  const label = cityLabel(c);
  const prem = costIn(k, LIFESTYLES.premium.basket)?.total;
  const best = monthRanges(c.best);
  const cl = c.clim;
  const warm = cl.t.indexOf(Math.max(...cl.t)), cold = cl.t.indexOf(Math.min(...cl.t)), wet = cl.rain.indexOf(Math.max(...cl.rain));
  const regionCities = db.cities.filter((x) => x.country.region === k.region && x.costComfort);
  const regMed = median(regionCities.map((x) => x.costComfort));
  const open = db.visa.openness(k.iso3);
  const parts = FACTORS.filter((f) => c.parts[f.key] != null).map((f) => [f, c.parts[f.key]]).sort((a, b) => b[1] - a[1]);
  const strong = parts.slice(0, 2).map(([f]) => f.label.toLowerCase());
  const weak = parts[parts.length - 1]?.[0].label.toLowerCase();
  const nearby = db.cities.filter((x) => x !== c).map((x) => ({ x, d: haversine(c.lat, c.lng, x.lat, x.lng) })).sort((a, b) => a.d - b.d).slice(0, 6);
  // Cities with weather like this one's: cheaper ones when there are at least two, otherwise the closest weather at any cost.
  const cheaper = cheaperTwins(db, c), twins = cheaper.length >= 2 ? cheaper : weatherTwins(db, c);
  const inCountry = k.cities.filter((x) => x !== c);
  const visaEx = VISA_EXAMPLES.filter(([p]) => p !== k.iso3).slice(0, 3).map(([p, who]) => who + ', ' + stayLabel(db.visa.get(p, k.iso3)).toLowerCase());
  // Factors with no data for this country are left out of the score (Taiwan has no World Bank indicators, for example): say so.
  const missing = FACTORS.filter((f) => STATIC_QUERY.weights[f.key] > 0 && c.parts[f.key] == null).map((f) => f.label.toLowerCase());
  const missWhy = missing.length ? `as there is no World Bank data on ${missing.length > 1 ? 'them' : 'it'} for ${k.name}` : '';
  const missTxt = missing.length ? `leaving out ${listJoin(missing)}, ${missWhy}` : '';
  const pl = k.pli ? Math.round(k.pli.aic) : null;
  const lede = `${label} scores ${c.score}/100 for remote workers, #${c.rank} of ${db.cities.length} cities on NomadAtlas${missTxt ? ' (' + missTxt + ')' : ''}. ${k.pli ? `A comfortable month costs about ${fmtMoney(c.costComfort)}, with ${k.name} consumer prices at ${pl}% of US levels` : 'Price data is not available for ' + k.name}${k.net ? `, median measured download speed is ${fmtNum(k.net.down)} Mbps` : ''}, and the weather is most pleasant ${best === 'all year' ? 'all year round' : 'in ' + best}.`;
  const faq = [
    { q: `Is ${c.name} good for digital nomads?`, a: `${c.name} ranks #${c.rank} of ${db.cities.length} cities on NomadAtlas with a score of ${c.score}/100 using default weights. It does best on ${listJoin(strong)} and weakest on ${weak}.${missing.length ? ' The score leaves out ' + listJoin(missing) + ', ' + missWhy + '.' : ''} Change the weights in the destination finder to rank it for your own priorities.` },
    k.pli && { q: `How much does it cost to live in ${c.name} as a digital nomad?`, a: `Roughly ${fmtMoney(c.costLean)} a month on a lean budget, ${fmtMoney(c.costComfort)} comfortable and ${fmtMoney(prem)} premium, including a furnished place, food, transport, coworking and travel insurance. Estimates use national price levels for ${k.name}: ${priceSource(k)}. Central neighbourhoods in popular areas can cost more.` },
    { q: `What is the best time to visit ${c.name}?`, a: `For comfortable weather, ${best === 'all year' ? 'any time of year' : best}. ${MONTHS[warm]} is the warmest month (average ${fmtTemp(cl.t[warm])}, highs around ${fmtTemp(cl.hi[warm])}) and ${MONTHS[cold]} the coolest (average ${fmtTemp(cl.t[cold])}). ${MONTHS[wet]} is the wettest, with about ${fmtMm(cl.rain[wet])} of rain.` },
    { q: `Do I need a visa for ${k.name}?`, a: `It depends on your passport. ${open} of ${db.visa.codes.length - 1} passports can enter ${k.name} visa-free, on arrival or with an electronic travel authorisation. For example: ${visaEx.join('; ')}. Confirm with official sources before travelling.` },
    { q: `What time zone is ${c.name} in?`, a: `${c.name} uses the ${c.tz.replace(/_/g, ' ')} time zone (${offsetsLabel(c.tz, y)}).` },
    cheaper.length && { q: `Which cities have weather like ${c.name} but cost less?`, a: `${listJoin(cheaper.map((o) => cityFull(o.city) + ' (about ' + fmtMoney(o.saving) + ' a month less)'))}. Among cities where a comfortable month costs at least 10% less than in ${c.name}, ${cheaper.length > 1 ? 'these have' : 'this has'} the closest monthly temperatures and rainfall.` },
    k.net && { q: `How fast is the internet in ${c.name}?`, a: `Across ${k.name}, M-Lab speed tests from ${mlabPeriod(ctx)} had a median download speed of ${fmtNum(k.net.down)} Mbps and upload of ${fmtNum(k.net.up)} Mbps. These single-connection tests read lower than multi-connection tests such as Ookla, and fibre in cities and coworking spaces is usually faster.` },
  ].filter(Boolean);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Cities', path: '/cities/' }, { name: label, path: cityPath(c) }];
  const mapAlt = ofCountry(c) ? 'Map showing where ' + label + ' is in ' + k.name : 'Map of ' + label;
  const mapImg = { src: cityMapPath(c), w: 800, h: 500, alt: mapAlt, caption: (ofCountry(c) ? 'Where ' + label + ' is in ' + k.name : 'Map of ' + label) + '. Map data: Natural Earth.',
    spec: { kind: 'region', iso: k.iso3, focus: { lat: c.lat, lng: c.lng, label }, others: db.cities.filter((x) => x !== c).map((x) => [x.lat, x.lng]), note: fmtCoord(c.lat, c.lng), alt: mapAlt } };
  const body = shell(ctx, crumbs, html`
<header class="pagehead cityhead ${mediaHead(ctx)}">
  <div class="pagehead__main">
  <p class="eyebrow mono">${fmtCoord(c.lat, c.lng)} · ${c.tz.replace(/_/g, ' ')} · ${offsetsLabel(c.tz, y)}</p>
  <h1><span class="hl">${label}</span> for digital nomads</h1>
  <p class="cityhead__country"><a href="${ctx.link(countryPath(k))}">${k.name}</a> · ${k.region}</p>
  <p class="lede">${lede}</p>
  </div>
  ${mapFigure(ctx, mapImg)}
  <div class="scoreline">
    <div class="bigscore"><span class="bigscore__n">${c.score}</span><span class="bigscore__l">NomadAtlas score<br>#${c.rank} of ${db.cities.length}${missing.length ? html`<br>partial data` : ''}</span></div>
    ${statList([
      k.pli && { label: 'Comfortable month', value: fmtMoney(c.costComfort), note: regMed ? fmtSignedPct((c.costComfort / regMed - 1) * 100) + ' vs ' + k.region + ' median' : null },
      k.pli && { label: 'Lean month', value: fmtMoney(c.costLean) },
      { label: 'Best weather', value: best === 'all year' ? 'All year' : best },
      k.net && { label: 'Median download', value: fmtNum(k.net.down) + ' Mbps', note: 'Country median' },
      { label: 'Visa-free or easy entry', value: open + ' passports', note: 'of ' + (db.visa.codes.length - 1) },
    ])}
  </div>
</header>
${takeBlock(ctx, c, label)}

<section class="section" aria-labelledby="cost-h">
  <div class="section__head"><h2 id="cost-h">Cost of living in ${c.name}</h2><a class="arrowlink" href="${ctx.link('/cost-of-living-calculator/#to=' + k.iso3)}">Compare with where you live</a></div>
  ${k.pli ? html`<p>Monthly budgets for three lifestyles, priced with ${k.name} price levels for each category. The US-priced baskets are documented in the <a href="${ctx.link('/methodology/')}">methodology</a>; insurance is priced the same everywhere.</p>${costTable(ctx, k, label)}` : html`<p>The World Bank does not publish reliable price levels for ${k.name}, so we cannot estimate living costs here.</p>`}
</section>

<section class="section" aria-labelledby="weather-h">
  <div class="section__head"><h2 id="weather-h">Weather and the best time to go</h2><a class="arrowlink" href="${ctx.link(monthPath(warm))}">Where else is good in ${MONTHS[warm]}</a></div>
  <p>The most comfortable months in ${c.name} are <b>${best}</b>. Average temperatures run from ${fmtTemp(cl.t[cold])} (${fmtTemp(cl.t[cold], 'F')}) in ${MONTHS[cold]} to ${fmtTemp(cl.t[warm])} (${fmtTemp(cl.t[warm], 'F')}) in ${MONTHS[warm]}, and ${MONTHS[wet]} brings the most rain (${fmtMm(cl.rain[wet])}).</p>
  ${climateChart(c)}
  ${climateTable(c)}
  <p class="hint">NASA POWER data on a roughly 50 km grid: temperatures averaged from daily data for 2015 to 2024, rain and humidity from the 2001 to 2025 climatology.${c.elev != null ? ` Temperatures are adjusted to the city's elevation of ${fmtNum(c.elev)} m.` : ''} Coastal cities can read 1 to 3 °C milder than local weather stations.</p>
</section>

<section class="section" aria-labelledby="visa-h">
  <div class="section__head"><h2 id="visa-h">Visas for ${k.name}</h2><a class="arrowlink" href="${ctx.link('/visa-free-countries/')}">Check all destinations for your passport</a></div>
  <p>${open} of ${db.visa.codes.length - 1} passports can enter ${k.name} without applying for a visa in advance (visa-free, on arrival or with an eTA). ${k.iso3 && db.byIso3.get(k.iso3) ? '' : ''}Data last updated ${db.visa.updated}.</p>
  <div class="split">${visaCheck(ctx, k)}${visaTable(ctx, k)}</div>
</section>

<section class="section" aria-labelledby="tz-h">
  <h2 id="tz-h">Time zone and working hours</h2>
  <p>${c.name} runs on ${offsetsLabel(c.tz, y)}. The table shows how much of a standard 9-to-5 day in other hubs you can cover if you work between 08:00 and 20:00 local time, accounting for daylight saving.</p>
  ${overlapTable(ctx, c.tz, c.name)}
  <p><a class="arrowlink" href="${ctx.link('/time-zone-overlap-calculator/')}">Use your own team's hours</a></p>
</section>

<section class="section" aria-labelledby="life-h">
  <h2 id="life-h">Internet, safety, healthcare and air</h2>
  <p>National indicators for ${k.name}, scored 0 to 100 against the world.</p>
  ${livingMeters(ctx, k)}
</section>

<section class="section" aria-labelledby="prac-h">
  <h2 id="prac-h">Practical details</h2>
  ${practical(ctx, k, [{ label: 'Population', value: fmtPop(c.pop) }, c.elev != null && { label: 'Elevation', value: fmtNum(c.elev) + ' m' }])}
</section>

<section class="section" aria-labelledby="near-h">
  <h2 id="near-h">Nearby and similar places</h2>
  <div class="cols">
    <div><h3>Closest cities</h3><ul class="plainlist">${nearby.map(({ x, d }) => { const f = flightEstimate(d, db.emissions, { domestic: x.iso3 === c.iso3 }); return html`<li><a href="${ctx.link(cityPath(x))}">${cityLabel(x)}</a>${ofCountry(x)}<span class="muted"> · ${fmtNum(d)} km${d > 300 ? html` · ≈${fmtNum(f.kg)} kg CO₂e one-way by air` : ''}</span></li>`; })}</ul></div>
    <div><h3>${twins === cheaper ? 'Similar weather for less' : 'Similar weather'}</h3><ul class="plainlist">${twins.map((o) => html`<li><a href="${ctx.link(cityPath(o.city))}">${cityLabel(o.city)}</a>${ofCountry(o.city)} <span class="muted">· ${savingTxt(o.saving) || 'score ' + o.city.score}</span></li>`)}</ul></div>
    ${inCountry.length ? html`<div><h3>More in ${k.name}</h3><ul class="plainlist">${inCountry.map((x) => html`<li><a href="${ctx.link(cityPath(x))}">${cityLabel(x)}</a> <span class="muted">· score ${x.score}</span></li>`)}</ul></div>` : ''}
  </div>
</section>

${faqBlock(faq)}
${sourceNote(ctx, ['World Bank WDI, ICP 2021 and WGI', 'NASA POWER', 'M-Lab', 'GeoNames', 'Passport Index Data', 'Wikidata', 'UK DESNZ'])}
`);
  return {
    path: cityPath(c),
    title: fitTitle([`${cityFull(c)} for Digital Nomads: Cost, Weather & Visas`, `${cityFull(c)}: Digital Nomad Cost, Weather & Visas`, `${label} for Digital Nomads: Cost, Weather & Visas`, `${label}: Cost of Living, Weather & Visas`, `${c.name} for Digital Nomads`]),
    description: fitDesc([`${cityFull(c)} scores ${c.score}/100 for remote work.`, k.pli ? `About ${fmtMoney(c.costComfort)} a month on a comfortable budget.` : null, `Best weather: ${best}.`, k.net ? `Internet ${fmtNum(k.net.down)} Mbps median.` : null, 'Visas, time zones and safety.']),
    jsonld: [
      crumbsLd(ctx, crumbs),
      { '@context': 'https://schema.org', '@type': 'City', name: c.name, alternateName: c.alias || undefined, url: ctx.site.url + cityPath(c), image: ctx.site.url + mapImg.src, geo: { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lng, elevation: c.elev ?? undefined }, containedInPlace: { '@type': 'Country', name: k.name, url: ctx.site.url + countryPath(k) } },
      faqLd(faq),
    ],
    body, images: [mapImg], priority: 0.8, changefreq: 'monthly', ogType: 'article',
  };
}
