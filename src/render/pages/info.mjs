import { html } from '../html.mjs';
import { fmtMoney, fmtNum } from '../../shared/format.mjs';
import { CATEGORIES, LIFESTYLES, HOUSING_BLEND, basketTotal } from '../../shared/cost.mjs';
import { DEFAULT_CLIMATE } from '../../shared/climate.mjs';
import { DEFAULT_WEIGHTS, FACTORS } from '../../shared/scores.mjs';
import { pageHead, toolGrid } from '../components.mjs';
import { shell, crumbsLd } from './common.mjs';

const page = (ctx, path, name, title, description, inner, extraLd = []) => {
  const crumbs = [{ name: 'Home', path: '/' }, { name, path }];
  return { path, title, description, body: shell(ctx, crumbs, inner), jsonld: [crumbsLd(ctx, crumbs), ...extraLd], priority: 0.5, changefreq: 'monthly' };
};

export function methodologyPage(ctx) {
  const m = ctx.db.meta;
  return page(ctx, '/methodology/', 'Methodology', 'Methodology: How NomadAtlas Scores Cities | NomadAtlas', 'How NomadAtlas scores cost of living, weather, internet, safety, healthcare, air quality, visas and time-zone fit: formulas, assumptions and limits.', html`
  ${pageHead({ eyebrow: 'Methodology', title: 'How we calculate', lede: 'Every score on NomadAtlas is a transparent formula over open data. This page lists each one, the assumptions behind it and where it falls short.' })}
  <div class="prose">
  <h2>The match score</h2>
  <p>Each city gets a 0 to 100 score on eight factors. The match score is the weighted average of the factors you give a weight above zero, using the priority sliders in the destination finder (defaults: ${FACTORS.map((f) => f.label.toLowerCase() + ' ' + DEFAULT_WEIGHTS[f.key]).join(', ')}). Visa ease only counts once you choose a passport and time-zone fit only once you choose a team time zone. Destinations that refuse entry to all your passports are left out.</p>
  <p>City pages and indexes show a <b>NomadAtlas score</b> that uses fixed inputs so cities can be compared without personal details: a comfortable lifestyle against a $3,000 monthly budget, the year-round weather average and the default weights for cost (3), weather (2), internet (2), safety (2), healthcare (1) and air quality (1).</p>

  <h2>Cost of living</h2>
  <p>We price a monthly basket at United States price levels and re-price each category with that country’s price level index (United States = 100).</p>
  <ul>
    <li><b>Category structure.</b> World Bank International Comparison Program (ICP) 2021 price level indices for ${CATEGORIES.filter((c) => !c.fixed).map((c) => c.label.toLowerCase()).join(', ')}, each divided by the country’s overall level for actual individual consumption.</li>
    <li><b>Overall level.</b> The latest price level ratio for household consumption from the World Development Indicators: the PPP conversion factor for private consumption divided by the market exchange rate. Where PPPs lag behind exchange rates (for example Argentina), we carry the PPP forward with consumer-price inflation relative to the United States, which is the standard extrapolation method. We publish no estimate for economies whose official exchange rates do not reflect what visitors pay (such as Iran, Syria, Venezuela and Zimbabwe).</li>
    <li><b>Rent.</b> Furnished short-term rentals in central areas track the overall price level more closely than national average rents, so rent uses ${Math.round(HOUSING_BLEND * 100)}% of the ICP housing level and ${Math.round((1 - HOUSING_BLEND) * 100)}% of the overall level.</li>
    <li><b>Insurance.</b> International health insurance is priced the same everywhere.</li>
  </ul>
  <div class="tablewrap"><table class="table table--compact"><caption>Monthly baskets at US price levels (USD)</caption>
    <thead><tr><th scope="col">Category</th>${Object.values(LIFESTYLES).map((l) => html`<th scope="col" class="num">${l.label}</th>`)}</tr></thead>
    <tbody>${CATEGORIES.map((c) => html`<tr><th scope="row">${c.label}</th>${Object.values(LIFESTYLES).map((l) => html`<td class="num">${fmtMoney(l.basket[c.key])}</td>`)}</tr>`)}</tbody>
    <tfoot><tr><th scope="row">Total</th>${Object.values(LIFESTYLES).map((l) => html`<td class="num"><b>${fmtMoney(basketTotal(l.basket))}</b></td>`)}</tr></tfoot></table></div>
  <p><b>Affordability score:</b> 100 when the estimate uses 65% of your budget or less, falling in a straight line to 0 at 130% of your budget.</p>
  <p><b>Limitations.</b> Price levels are national averages. Central neighbourhoods in big hubs such as London, Paris or New York cost more than the national estimate and small towns less. Exchange rates move: the estimate reflects the year of the latest price data, currently ${m.vintages?.wdi || 'recent years'}.</p>

  <h2>Weather comfort</h2>
  <p>Monthly averages from NASA POWER (MERRA-2 reanalysis, ${m.vintages?.nasa || '2001 to 2025'}) for mean, maximum and minimum temperature, precipitation and relative humidity. Each grid cell is roughly 50 by 60 km, so we adjust temperatures to the city’s elevation from GeoNames using a lapse rate of 6.5 °C per 1,000 m (at most 8 °C either way).</p>
  <p>A month scores 100 when the average temperature is inside your preferred range (default ${DEFAULT_CLIMATE.tMin} to ${DEFAULT_CLIMATE.tMax} °C). It loses 8 points per degree below the range and 11 per degree above, up to 40 points as rainfall rises from 35% of your rain limit to twice it (default limit ${DEFAULT_CLIMATE.maxRain} mm), and up to 14 points when it is hotter than 22 °C with relative humidity above 65%. Best months are those scoring 75 or more.</p>
  <p><b>Limitations.</b> Coastal cities can read 1 to 3 °C milder than a station in town because the grid cell includes sea, and valleys with temperature inversions may differ from the lapse-rate adjustment.</p>

  <h2>Internet</h2>
  <p>80% from the median download speed in M-Lab’s NDT measurements for the country (median of daily medians, ${m.vintages?.mlab || 'January to March 2024'}, the latest period the public statistics API provides) on a log scale from 4 Mbps (0) to 90 Mbps (100), and 20% from the share of people using the internet (World Bank), from 40% (0) to 100% (100). Countries with fewer than 1,000 tests have no speed figure.</p>
  <p><b>Limitations.</b> NDT measures a single connection to a nearby server, so it reads lower than multi-connection tests such as Ookla, and national medians include slow mobile connections. Use it to compare countries, not to predict your coworking space.</p>

  <h2>Safety and stability</h2>
  <p>The average of the World Bank Worldwide Governance Indicators score for political stability and absence of violence (0 to 100), and the intentional homicide rate per 100,000 people on a log scale from 0.5 (100) to 30 (0). Petty crime, scams and local hotspots are not captured; read your government’s travel advice.</p>

  <h2>Healthcare</h2>
  <p>The average of life expectancy at birth (62 years = 0, 84 years = 100) and current health expenditure per person in PPP dollars (log scale, $150 = 0 to $7,000 = 100).</p>

  <h2>Air quality</h2>
  <p>Mean annual exposure to PM2.5 (World Bank): 5 µg/m³, the World Health Organization guideline, scores 100, falling to 0 at 45 µg/m³. These are national population-weighted averages; individual cities can be cleaner or much worse.</p>

  <h2>Visa ease</h2>
  <p>The best option across your passports from Passport Index Data (updated ${ctx.db.visa.updated}): visa-free stays of 90 days or more, unlimited stays or your own country score 100, visa-free stays of 30 to 89 days 88, shorter visa-free stays 75, visa on arrival 85, electronic travel authorisation 80, e-visa 50 and visa required 10.</p>

  <h2>Time-zone fit</h2>
  <p>The hours your team’s working day overlaps with the window you are willing to work in the city’s local time, using IANA time zone rules for the 15th of the month you pick (so daylight saving is handled). Reaching the overlap you need scores 100; no overlap scores 0.</p>

  <h2>Flight emissions</h2>
  <p>Great-circle distance plus an 8% uplift, multiplied by the UK government (DESNZ) conversion factor for short-haul (under 3,700 km) or long-haul flights and the chosen cabin class, with radiative forcing by default.</p>

  <h2>Updates</h2>
  <p>The site is a static build. Running the data pipeline downloads fresh copies of every source and rebuilds all pages. This build was generated on ${ctx.buildDate}.</p>
  </div>`);
}

export function dataSourcesPage(ctx) {
  const m = ctx.db.meta;
  const ld = { '@context': 'https://schema.org', '@type': 'Dataset', name: 'NomadAtlas remote-work city and country indicators', description: 'Cost of living estimates, climate averages, internet speeds, governance and health indicators and visa requirements for 184 cities and 199 countries, compiled from openly licensed sources for comparing places to live and work remotely.', url: ctx.site.url + '/data-sources/', creator: { '@type': 'Organization', name: ctx.site.name }, license: 'https://creativecommons.org/licenses/by/4.0/', isAccessibleForFree: true, dateModified: ctx.buildDate, isBasedOn: m.sources.map((s) => s.url), keywords: ['digital nomad', 'cost of living', 'purchasing power parity', 'climate', 'internet speed', 'visa requirements'] };
  return page(ctx, '/data-sources/', 'Data sources', 'Data Sources & Licences | NomadAtlas', 'Every dataset behind NomadAtlas with its licence and attribution: World Bank, NASA POWER, M-Lab, GeoNames, Wikidata, Natural Earth and more.', html`
  ${pageHead({ eyebrow: 'Open data', title: 'Data sources and licences', lede: 'NomadAtlas uses only datasets that allow commercial reuse: public domain, CC0, MIT, CC BY 4.0 or attribution-only government licences. None of them are share-alike or non-commercial.' })}
  <div class="sources">${m.sources.map((s) => html`<article class="source" id="src-${s.id}">
    <h2>${s.name}</h2>
    <p class="source__pub">${s.publisher} · <a href="${s.licenseUrl}" rel="license noopener" target="_blank">${s.license}</a>${m.vintages?.[s.id] ? ' · ' + m.vintages[s.id] : ''}</p>
    <p>${s.use}</p>
    <p class="source__attr"><span>Attribution:</span> ${s.attribution}</p>
    <p><a href="${s.url}" rel="noopener" target="_blank">${s.url.replace(/^https?:\/\//, '')}</a></p>
  </article>`)}</div>
  <section class="section prose"><h2>Reusing NomadAtlas numbers</h2><p>You may reuse the derived figures on this site under CC BY 4.0, provided you credit NomadAtlas and keep the attributions of the underlying sources above. Visa information is provided as-is from Passport Index Data, whose README states it was compiled from passportindex.org; confirm entry rules with official government sources.</p></section>`, [ld]);
}

export function aboutPage(ctx) {
  return page(ctx, '/about/', 'About', 'About NomadAtlas', 'NomadAtlas is a set of free, open-data calculators that help remote workers decide where to live and work, with every number traceable to a public dataset.', html`
  ${pageHead({ eyebrow: 'About', title: 'About NomadAtlas', lede: 'Free calculators for people who can work from anywhere and want to choose well.' })}
  <div class="prose">
    <p>Moving somewhere for a month or a year means weighing rent against weather, visas against time zones and internet against safety. Most rankings hide how they get their numbers. NomadAtlas does the opposite: every score is a published formula over open data, and you can change the weights to match what you care about.</p>
    <h2>Principles</h2>
    <ul><li><b>Open data only.</b> Every source allows commercial reuse with attribution or less, and is listed with its licence.</li><li><b>Show the working.</b> The methodology page documents every formula and its limitations.</li><li><b>Your data stays with you.</b> Calculators run in your browser; settings are saved only on your device.</li></ul>
    <h2>Tools</h2>
  </div>
  ${toolGrid(ctx)}`);
}

export function privacyPage(ctx) {
  return page(ctx, '/privacy/', 'Privacy', 'Privacy | NomadAtlas', 'NomadAtlas has no accounts, no cookies and no tracking. Calculator inputs stay in your browser.', html`
  ${pageHead({ eyebrow: 'Privacy', title: 'Privacy', lede: 'Short version: no accounts, no cookies, no tracking.' })}
  <div class="prose">
    <p>All calculators run in your browser. Inputs such as your Schengen stays or theme preference are saved in your browser’s local storage so they are there next time; they are never sent to us. Clear your browser’s site data to remove them.</p>
    <p>Fonts are loaded from Google Fonts, which receives your IP address when your browser requests them. Our hosting provider may keep standard server logs for security.</p>
  </div>`);
}

export function notFoundPage(ctx) {
  const p = page(ctx, '/404.html', 'Page not found', 'Page not found | NomadAtlas', 'This page does not exist.', html`
  ${pageHead({ eyebrow: '404', title: 'This page is off the map', lede: 'The link may be old or mistyped. Try one of the tools instead.' })}
  ${toolGrid(ctx)}`);
  p.noindex = true; p.jsonld = []; return p;
}
