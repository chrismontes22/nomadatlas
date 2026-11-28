import { html } from '../html.mjs';
import { fmtMoney, fmtNum, fmtPct, listJoin, fmtPop, monthRanges, an } from '../../shared/format.mjs';
import { LIFESTYLES, costIn } from '../../shared/cost.mjs';
import { stayLabel, rankPassports } from '../../shared/visa.mjs';
import { fitTitle, fitDesc, scoreChip, statList, faqBlock, faqLd, sourceNote, cityPath, countryPath, passportPath, cityCards, dataTable, median, cityLabel, countryMapPath, mapFigure, mediaHead } from '../components.mjs';
import { shell, crumbsLd } from './common.mjs';
import { costTable, livingMeters, practical, visaTable, visaCheck, VISA_EXAMPLES } from './city.mjs';

const val = (x) => (Array.isArray(x) ? x[0] : x ?? null);
const yr = (x) => (Array.isArray(x) ? x[1] : null);

export function countryPage(ctx, k) {
  const db = ctx.db;
  const open = db.visa.openness(k.iso3);
  const power = db.visa.counts([k.iso3]);
  // The same ranking as the passport table on /visa-free-countries/
  if (!db._power) db._power = new Map(rankPassports(db.countries, db.visa).map((r) => [r.c.iso3, r.rank]));
  const powerRank = db._power.get(k.iso3);
  const pl = k.pli ? Math.round(k.pli.aic) : null;
  const regionCountries = db.countries.filter((c) => c.region === k.region && c.costComfort);
  const regMed = median(regionCountries.map((c) => c.costComfort));
  const prem = costIn(k, LIFESTYLES.premium.basket)?.total;
  const neighbours = k.neighbours.map((n) => db.byIso3.get(n)).filter(Boolean);
  const I = k.ind, G = k.gov;
  const cityState = k.cities.some((c) => c.name === k.name);
  const travel = [power.free + ' visa-free', power.voa + ' visa on arrival', power.eta + ' eTA', power.evisa + ' e-visa', power.required + ' visa required', power.banned ? power.banned + ' no admission' : null];
  // Compare the amounts as shown (rounded to $10), so the sentence never reads "$2,770, above the median of $2,770".
  const vsMedian = !regMed ? '' : fmtMoney(k.costComfort) === fmtMoney(regMed) ? ', right at the ' + k.region + ' median' : (k.costComfort < regMed ? ', below' : ', above') + ' the ' + k.region + ' median of ' + fmtMoney(regMed);
  const visaEx = VISA_EXAMPLES.filter(([p]) => p !== k.iso3).slice(0, 2).map(([p, who]) => who + ': ' + stayLabel(db.visa.get(p, k.iso3)).toLowerCase() + '.');
  const lede = [
    k.pli ? `Consumer prices in ${k.name} are about ${pl}% of US levels, so a comfortable remote-work month costs around ${fmtMoney(k.costComfort)}${vsMedian}.` : `Reliable price data is not available for ${k.name}.`,
    `${open} of ${db.visa.codes.length - 1} passports can enter without applying for a visa in advance, and the ${k.name} passport itself opens ${power.easy} destinations.`,
    k.cities.length ? `NomadAtlas covers ${k.cities.length} ${k.cities.length === 1 ? 'city' : 'cities'} here: ${listJoin(k.cities.slice(0, 4).map((c) => c.name))}.` : '',
  ].join(' ');
  const indicators = [
    ['GDP per person (PPP, current international $)', I.gdpPcPpp, (v) => fmtMoney(v, 'USD', 100)],
    ['Inflation, consumer prices', I.inflation, (v) => fmtNum(v, 1) + '%'],
    ['Population', I.population, (v) => fmtPop(v)],
    ['People using the internet', I.internetUsers, (v) => fmtNum(v, 1) + '%'],
    ['Fixed broadband subscriptions per 100 people', I.broadband, (v) => fmtNum(v, 1)],
    ['Mobile subscriptions per 100 people', I.mobileSubs, (v) => fmtNum(v, 0)],
    ['Access to electricity', I.electricity, (v) => fmtNum(v, 1) + '%'],
    ['Intentional homicides per 100,000 people', I.homicide, (v) => fmtNum(v, 1)],
    ['PM2.5 air pollution, mean annual exposure (µg/m³)', I.pm25, (v) => fmtNum(v, 1)],
    ['Life expectancy at birth (years)', I.lifeExp, (v) => fmtNum(v, 1)],
    ['Health spending per person (PPP $)', I.healthExp, (v) => fmtMoney(v, 'USD', 10)],
    ['Physicians per 1,000 people', I.physicians, (v) => fmtNum(v, 1)],
    ['Political stability and absence of violence (0 to 100)', G.stability, (v) => fmtNum(v, 1)],
    ['Rule of law (0 to 100)', G.ruleOfLaw, (v) => fmtNum(v, 1)],
    ['Control of corruption (0 to 100)', G.corruption, (v) => fmtNum(v, 1)],
    ['Government effectiveness (0 to 100)', G.govEffect, (v) => fmtNum(v, 1)],
  ].filter(([, x]) => x);
  const faq = [
    k.pli && { q: `Is ${k.name} expensive for digital nomads?`, a: `Consumer prices in ${k.name} are about ${pl}% of US levels (World Bank, ${k.pliYear}). A remote worker spends roughly ${fmtMoney(k.costLean)} a month on a lean budget, ${fmtMoney(k.costComfort)} comfortable and ${fmtMoney(prem)} premium. Rent and eating out vary most between cities.` },
    { q: `Do I need a visa to visit ${k.name}?`, a: `${open} passports can enter ${k.name} visa-free, on arrival or with an electronic travel authorisation. ${visaEx.join(' ')} Check the official government website before you travel.` },
    { q: `How strong is the ${k.name} passport?`, a: `${k.name} passport holders can visit ${power.easy} destinations without applying for a visa in advance: ${power.free} visa-free, ${power.voa} with a visa on arrival and ${power.eta} with an eTA. That ranks #${powerRank} of ${db.countries.length} passports on NomadAtlas.` },
    k.plugs.length && { q: `What plugs and voltage does ${k.name} use?`, a: `${k.name} uses plug type${k.plugs.length > 1 ? 's' : ''} ${listJoin(k.plugs)}${k.volts.length ? ' and ' + k.volts.join(' / ') + ' V mains electricity' : ''}.` },
    k.sc.safety != null && { q: `Is ${k.name} safe?`, a: `${k.name} scores ${k.sc.safety}/100 for safety and stability on NomadAtlas${val(G.stability) != null ? ', based on a World Bank political stability score of ' + fmtNum(val(G.stability)) + '/100' : ''}${val(I.homicide) != null ? ' and ' + fmtNum(val(I.homicide), 1) + ' intentional homicides per 100,000 people' : ''}. Check your government's travel advice for current local risks.` },
  ].filter(Boolean);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Countries', path: '/countries/' }, { name: k.name, path: countryPath(k) }];
  const kAlt = k.cities.length ? 'Map of ' + k.name + ' showing ' + listJoin(k.cities.slice(0, 4).map((c) => cityLabel(c))) : 'Map showing where ' + k.name + ' is';
  const mapImg = { src: countryMapPath(k), w: 800, h: 500, alt: kAlt, caption: k.name + ' on the map' + (k.cities.length ? ', with the ' + (k.cities.length === 1 ? 'city' : k.cities.length + ' cities') + ' NomadAtlas covers' : '') + '. Map data: Natural Earth.',
    spec: { kind: 'region', iso: k.iso3, title: k.name, pins: k.cities.map((c) => [c.lat, c.lng]), others: db.cities.filter((c) => c.country !== k).map((c) => [c.lat, c.lng]), alt: kAlt } };
  const body = shell(ctx, crumbs, html`
<header class="pagehead ${mediaHead(ctx)}">
  <div class="pagehead__main">
  <p class="eyebrow">${k.region}${k.capital ? ' · Capital: ' + k.capital : ''}${k.currency ? ' · ' + k.currency : ''}</p>
  <h1>${k.name} for digital nomads${cityState ? ': visas, passport and country data' : ''}${k.aka ? html` <span class="h1-aka">(${k.aka})</span>` : ''}</h1>
  <p class="lede">${lede}</p>
  </div>
  ${mapFigure(ctx, mapImg)}
  ${statList([
    k.pli && { label: 'Comfortable month', value: fmtMoney(k.costComfort) },
    k.pli && { label: 'Price level', value: pl + '% of US', note: 'World Bank, ' + k.pliYear },
    k.net && { label: 'Median download', value: fmtNum(k.net.down) + ' Mbps' },
    { label: 'Safety & stability', value: scoreChip(k.sc.safety) },
    { label: 'Passport opens', value: power.easy + ' destinations', note: '#' + powerRank + ' of ' + db.countries.length },
  ])}
</header>

${k.cities.length ? html`<section class="section" aria-labelledby="cities-h"><h2 id="cities-h">Cities in ${k.name}</h2>${cityCards(ctx, k.cities, (c) => 'Best weather: ' + monthRanges(c.best))}</section>` : ''}

<section class="section" aria-labelledby="cost-h">
  <div class="section__head"><h2 id="cost-h">Cost of living in ${k.name}</h2><a class="arrowlink" href="${ctx.link('/cost-of-living-calculator/#to=' + k.iso3)}">Compare with your home country</a></div>
  ${k.pli ? html`<p>Price levels by category compared with the United States (US = 100), and what three remote-work lifestyles cost per month. ${k.pliMethod === 'wdi-level' ? 'Category detail is not available for ' + k.name + ', so every category uses the overall price level.' : 'Category structure from the World Bank ICP 2021, scaled to the ' + k.pliYear + ' price level.'}</p>${costTable(ctx, k, k.name)}` : html`<p>The World Bank does not publish a reliable price level for ${k.name}, so we cannot estimate living costs.</p>`}
</section>

<section class="section" aria-labelledby="visa-h">
  <h2 id="visa-h">Visas</h2>
  <div class="cols">
    <div><h3>Entering ${k.name}</h3><p>${open} of ${db.visa.codes.length - 1} passports need no visa in advance.</p>${visaCheck(ctx, k)}</div>
    <div><h3>Travelling on ${an(k.name)} passport</h3><p>${listJoin(travel)}.</p><p><a class="arrowlink" href="${ctx.link(passportPath(k))}">Where ${k.name} passport holders can go</a></p></div>
  </div>
  ${visaTable(ctx, k)}
</section>

<section class="section" aria-labelledby="life-h">
  <h2 id="life-h">Internet, safety, healthcare and air</h2>
  ${livingMeters(ctx, k)}
</section>

<section class="section" aria-labelledby="ind-h">
  <h2 id="ind-h">Key indicators</h2>
  ${!indicators.length ? html`<p>The World Bank publishes none of these indicators for ${k.name}.</p>` : html`<div class="tablewrap"><table class="table table--compact"><caption>Latest available values for ${k.name}</caption>
    <thead><tr><th scope="col">Indicator</th><th scope="col" class="num">Value</th><th scope="col" class="num">Year</th></tr></thead>
    <tbody>${indicators.map(([l, x, f]) => html`<tr><th scope="row">${l}</th><td class="num">${f(val(x))}</td><td class="num">${yr(x)}</td></tr>`)}</tbody></table></div>`}
</section>

<section class="section" aria-labelledby="prac-h">
  <h2 id="prac-h">Practical details</h2>
  ${practical(ctx, k, [k.capital && { label: 'Capital', value: k.capital }, k.area && { label: 'Area', value: fmtNum(k.area, k.area < 10 ? 2 : 0) + ' km²' }])}
</section>

${neighbours.length ? html`<section class="section" aria-labelledby="nb-h"><h2 id="nb-h">Compared with its neighbours</h2>
  ${dataTable({ caption: 'Neighbouring countries', columns: [{ label: 'Country' }, { label: 'Comfortable month', num: true }, { label: 'Internet', num: true }, { label: 'Safety', num: true }, { label: 'Healthcare', num: true }],
    rows: [k, ...neighbours].map((c) => ({ cells: [html`<a href="${ctx.link(countryPath(c))}">${c.name}</a>`, fmtMoney(c.costComfort), c.net ? fmtNum(c.net.down) + ' Mbps' : '–', scoreChip(c.sc.safety), scoreChip(c.sc.health)], sort: [c.name, c.costComfort ?? '', c.net?.down ?? '', c.sc.safety ?? '', c.sc.health ?? ''], attrs: c === k ? 'class="is-current"' : '' })) })}
</section>` : ''}

${faqBlock(faq)}
${sourceNote(ctx, ['World Bank WDI, ICP 2021 and WGI', 'M-Lab', 'GeoNames', 'Passport Index Data', 'Wikidata'])}
`);
  return {
    path: countryPath(k),
    title: fitTitle([`${k.name} for Digital Nomads: Cost of Living, Visas & Internet`, `${k.name} for Digital Nomads: Cost, Visas & Internet`, `${k.name}: Cost of Living & Visas for Nomads`, `${k.name} for Digital Nomads`]),
    description: fitDesc([k.pli ? `A comfortable month in ${k.name} costs about ${fmtMoney(k.costComfort)} (${pl}% of US prices).` : `${k.name} for remote workers: visas, safety, healthcare and practical details.`, `${open} passports can enter ${k.name} without a visa in advance.`, k.net ? `Median internet ${fmtNum(k.net.down)} Mbps.` : null, 'Safety, healthcare and plugs.']),
    jsonld: [crumbsLd(ctx, crumbs), { '@context': 'https://schema.org', '@type': 'Country', name: k.name, alternateName: k.aka || undefined, url: ctx.site.url + countryPath(k), identifier: k.iso3, image: ctx.site.url + mapImg.src }, faqLd(faq)],
    body, images: [mapImg], priority: 0.7, changefreq: 'monthly', ogType: 'article',
  };
}
