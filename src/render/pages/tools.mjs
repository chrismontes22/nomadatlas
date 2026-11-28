import { html } from '../html.mjs';
import { MONTHS, fmtMoney, fmtNum, listJoin, fmtHours } from '../../shared/format.mjs';
import { SCHENGEN } from '../../shared/schengen.mjs';
import { overlap, refDate } from '../../shared/tz.mjs';
import { HOUSING_BLEND, LIFESTYLES, CATEGORIES, basketTotal } from '../../shared/cost.mjs';
import { faqBlock, faqLd, sourceNote, toolGrid, pageHead, dataTable, countryPath, passportPath, monthPath, cityLabel, cityPath } from '../components.mjs';
import { shell, crumbsLd } from './common.mjs';
import { toolByKey, pricedCount } from '../nav.mjs';
import { costDefaults, costForm, costResults } from '../tools/cost.mjs';
import { visaDefaults, visaForm, visaResults, visaSummary, MAP_LEGEND } from '../tools/visa.mjs';
import { rankPassports } from '../../shared/visa.mjs';
import { schengenDefaults, schengenForm, schengenResults } from '../tools/schengen.mjs';
import { tzDefaults, tzForm, tzResults } from '../tools/timezone.mjs';
import { weatherDefaults, weatherForm, weatherResults } from '../tools/weather.mjs';
import { flightDefaults, flightForm, flightResults } from '../tools/flight.mjs';
import { yearDefaults, yearForm, yearResults, DEFAULT_LEGS, co2 } from '../tools/year.mjs';
import { planYear, parseLegs, sunChaser, legsToString } from '../../shared/year.mjs';
import { monthSpan } from '../../shared/insights.mjs';

function toolPage(ctx, key, { title, metaTitle, description, lede, tool, after = '', faq, sources, category = 'TravelApplication' }) {
  const t = toolByKey(key);
  const crumbs = [{ name: 'Home', path: '/' }, { name: t.name, path: t.path }];
  const body = shell(ctx, crumbs, html`${pageHead({ eyebrow: 'Free calculator', title, lede, icon: [t.icon, t.tone] })}
    ${tool}
    ${after}
    ${faqBlock(faq)}
    <section class="section"><h2>More tools</h2>${toolGrid(ctx, key)}</section>
    ${sourceNote(ctx, sources)}`);
  return {
    path: t.path, title: metaTitle, description, body, priority: 0.9, changefreq: 'monthly', og: key,
    jsonld: [crumbsLd(ctx, crumbs), { '@context': 'https://schema.org', '@type': 'WebApplication', name: t.name, url: ctx.site.url + t.path, applicationCategory: category, operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, description }, faqLd(faq)],
  };
}

export function yearPage(ctx) {
  const db = ctx.db, s = yearDefaults(ctx), legs = parseLegs(db, s.legs);
  // Three ready-made years, worked out at build time: the default loop and two sun-chasing plans.
  const examples = [
    { name: 'The classic loop', why: 'A cheap, dry winter in northern Thailand, spring in Lisbon, summer in Belgrade outside the Schengen Area and autumn in Mexico City. Spring in Lisbon runs one day over the Schengen limit, which the planner catches.', legs: DEFAULT_LEGS },
    { name: 'Endless spring', why: 'The sun-chaser’s pick for the most comfortable weather all year, one country per stop and short hops between them.', legs: legsToString(sunChaser(db, { year: s.year, start: 0 })) },
    { name: 'Sunshine on a budget', why: 'The same idea with every stop under $2,000 for a comfortable month.', legs: legsToString(sunChaser(db, { year: s.year, start: 0, maxCost: 2000 })) },
  ].map((e) => ({ ...e, plan: planYear(db, { ...s, legs: e.legs }) }));
  const schTxt = (p) => (!p.schengen.days ? 'No Schengen stops' : p.schengen.over ? (p.schengen.peak - 90) + ' day' + (p.schengen.peak - 90 === 1 ? '' : 's') + ' over the limit' : 'Within 90 in 180');
  const exampleCards = html`<ul class="yrex">${examples.map((e) => html`<li class="yrex__item">
    <h3>${e.name}</h3>
    <p class="yrex__route">${e.plan.stops.map((st, i) => html`${i ? ' → ' : ''}<a href="${ctx.link(cityPath(st.city))}">${cityLabel(st.city)}</a> <small>${monthSpan(st.months)}</small>`)}</p>
    <p>${e.why}</p>
    <dl class="yrex__facts"><div><dt>Living costs</dt><dd>${fmtMoney(e.plan.cost, 'USD', 100)}</dd></div><div><dt>Flight CO₂e</dt><dd>${co2(e.plan.flights.kg)}</dd></div><div><dt>Comfortable months</dt><dd>${e.plan.weather.pleasant} of ${e.plan.months}</dd></div><div><dt>Schengen</dt><dd>${schTxt(e.plan)}</dd></div></dl>
    <a class="arrowlink" href="${ctx.link('/nomad-year-planner/') + (ctx.mode === 'static' ? '?legs=' + e.legs : '')}">Open this plan</a>
  </li>`)}</ul>`;
  const faq = [
    { q: 'How does the planner check the Schengen 90/180 rule?', a: 'Every day you spend in a Schengen country counts, from the first day of a stop to the last. The planner checks the rule on every day of your plan: in any 180-day window you can spend at most 90 days in the Schengen Area. It assumes you start the plan with no Schengen days already used, so if you were there in the six months before, add those stays in the Schengen calculator. The rule does not apply to EU, EEA or Swiss citizens.' },
    { q: 'Where do the living costs come from?', a: 'Each stop uses the same monthly estimate as its city guide: the lifestyle you choose, priced with World Bank price levels for that country. They cover rent, food, transport, coworking, health and insurance, but not flights or visa fees.' },
    { q: 'How are the flight emissions estimated?', a: 'One way in economy between consecutive stops, using the great-circle distance and the ' + db.emissions.year + ' UK government (DESNZ) conversion factors including non-CO₂ warming effects, the same method as the flight CO₂ calculator.' },
    { q: 'What does “Suggest a sun-chasing year” do?', a: 'It keeps the number and length of your stops and fills each one with the city whose weather in those months is most comfortable (an average of 16 to 25 °C with moderate rain), favouring higher-rated cities and shorter flights, with one country per stop. If you set a passport it only picks places you can enter without a visa in advance and stays within visa-free limits, and it never breaks the Schengen 90/180 rule.' },
    { q: 'Can I share or save my plan?', a: 'Yes. The address in your browser updates as you plan, so you can copy it and send it to someone, and your latest plan is saved in this browser. Nothing is sent to a server.' },
  ];
  return toolPage(ctx, 'year', {
    title: 'Nomad year planner',
    metaTitle: 'Digital Nomad Year Planner: Costs, Weather & Schengen | NomadAtlas',
    description: 'Plan a year of remote work across several cities. See total living costs, flight CO₂, the weather month by month and Schengen 90/180 days in one place.',
    lede: 'Choose where you want to spend each part of the year. The planner adds up living costs and flight emissions, shows the weather month by month and warns you before a stay breaks the Schengen 90/180 rule or a visa-free limit.',
    tool: html`<section class="section toolwrap" data-tool="year" aria-labelledby="year-tool-h"><h2 id="year-tool-h" class="sr">Plan your year</h2>${yearForm(ctx, s, legs)}<div class="results" data-results aria-live="polite">${yearResults(ctx, s)}</div></section>`,
    after: html`<section class="section" aria-labelledby="yrex-h"><h2 id="yrex-h">Three ready-made years</h2><p>Starting points worked out from the same data, for ${s.year} with no passport set. Open one and make it yours.</p>${exampleCards}</section>
      <section class="section prose"><h2>How the planner works</h2>
      <p>Your stops follow one another from the first day of the month you start in. For each stop the planner takes the city’s monthly climate averages from NASA POWER, its estimated monthly cost for your lifestyle from World Bank price levels, and the great-circle flight from the previous stop. With a passport set, it also looks up the entry rule for each country in the Passport Index Data matrix.</p>
      <p>The Schengen check is the strict version of the rule: entry and exit days both count, and the limit applies across all ${SCHENGEN.length} Schengen countries together. Stays in the United Kingdom, Ireland, Cyprus and the Balkans outside the EU do not count, which is why many nomads spend the summer in places like Belgrade, Tirana or Sarajevo between two Schengen stays.</p></section>`,
    faq, sources: ['World Bank ICP 2021 and WDI (CC BY 4.0)', 'NASA POWER', 'UK DESNZ conversion factors ' + db.emissions.year + ' (OGL v3.0)', 'Passport Index Data (MIT)', 'Regulation (EU) 2016/399 (Schengen Borders Code)'],
  });
}

export function costPage(ctx) {
  const s = costDefaults(ctx);
  const cheap = ctx.db.countries.filter((c) => c.costComfort && c.cities.length).sort((a, b) => a.costComfort - b.costComfort);
  const L = LIFESTYLES.comfortable.basket;
  const faq = [
    { q: 'How does the cost of living calculator work?', a: 'It takes what you spend in each category today and multiplies it by the ratio between the destination price level and your home price level for that category. Price levels come from the World Bank International Comparison Program (2021 benchmark) scaled to each country’s latest price level for household consumption.' },
    { q: 'Why might my city cost more than the estimate?', a: 'Price levels are national averages. Central areas of big hubs such as London, Paris, New York or Sydney are usually more expensive than the national figure, and small towns are cheaper. If you are comparing two big cities, the differences tend to cancel out.' },
    { q: 'Which countries are cheapest for digital nomads?', a: 'Among countries with NomadAtlas cities, the lowest comfortable monthly budgets are in ' + listJoin(cheap.slice(0, 5).map((c) => c.name + ' (about ' + fmtMoney(c.costComfort) + ')')) + '.' },
    { q: 'Which countries are the most expensive?', a: 'The highest comfortable monthly budgets are in ' + listJoin(cheap.slice(-4).reverse().map((c) => c.name + ' (about ' + fmtMoney(c.costComfort) + ')')) + '.' },
    { q: 'How are currencies converted?', a: 'Amounts are converted with European Central Bank reference rates from ' + ctx.db.rates.date + '. Price levels themselves already account for exchange rates in the year they were measured.' },
  ];
  return toolPage(ctx, 'cost', {
    title: 'Cost of living calculator for remote workers',
    metaTitle: 'Cost of Living Calculator: Compare ' + pricedCount(ctx.db) + ' Countries | NomadAtlas',
    description: 'Compare the cost of living between countries, category by category. See what your current lifestyle costs in ' + pricedCount(ctx.db) + ' countries, using World Bank price data.',
    lede: 'Enter what you spend each month where you live now. We re-price every category, from rent to restaurants, for ' + pricedCount(ctx.db) + ' countries using World Bank purchasing-power data.',
    tool: html`<section class="section toolwrap" data-tool="cost" aria-labelledby="cost-tool-h"><h2 id="cost-tool-h" class="sr">Cost of living calculator</h2>${costForm(ctx, s)}<div class="results" data-results aria-live="polite">${costResults(ctx, s)}</div></section>`,
    after: html`<section class="section prose"><h2>How the estimate works</h2>
      <p>Each spending category has its own price level. Food is close to world prices almost everywhere, while rent, restaurants and services vary far more. We use the World Bank’s <b>International Comparison Program (ICP) 2021</b> price level indices for food, housing, restaurants and hotels, transport services, communication, health, recreation and other goods, and scale each country to its latest overall price level for household consumption from the <b>World Development Indicators</b>.</p>
      <p>Short-term furnished flats in central neighbourhoods follow the overall price level more closely than national average rents, which include rural and social housing, so rent uses ${Math.round(HOUSING_BLEND * 100)}% of the ICP housing level and ${Math.round((1 - HOUSING_BLEND) * 100)}% of the overall level. Travel health insurance is priced the same everywhere.</p>
      <p>The typical spending presets are monthly baskets at US prices: ${Object.values(LIFESTYLES).map((l) => l.label.toLowerCase() + ' ' + fmtMoney(basketTotal(l.basket))).join(', ')}. A comfortable month includes ${fmtMoney(L.housing)} for a furnished one-bedroom, ${fmtMoney(L.dining)} for eating out and ${fmtMoney(L.leisure)} for coworking and leisure.</p></section>`,
    faq, sources: ['World Bank ICP 2021 and WDI (CC BY 4.0)', 'European Central Bank'], category: 'FinanceApplication',
  });
}

export function visaIndexPage(ctx) {
  const s = visaDefaults();
  const ranking = rankPassports(ctx.db.countries, ctx.db.visa);
  const faq = [
    { q: 'Which passport gives visa-free access to the most countries?', a: 'On this dataset, ' + listJoin(ranking.slice(0, 3).map((r) => r.c.name + ' (' + r.n.easy + ' destinations)')) + ' offer the widest access without a visa in advance.' },
    { q: 'What is the difference between visa on arrival, eTA and e-visa?', a: 'A visa on arrival is issued at the border, usually for a fee. An electronic travel authorisation (eTA), such as the US ESTA or the UK ETA, is a quick online pre-clearance. An e-visa is a full visa application made online before you travel and can take days or weeks.' },
    { q: 'Can I combine two passports?', a: 'Yes. Pick a second passport and the tool shows the better option for each destination, along with which passport to use. Enter and leave a country on the same passport.' },
    { q: 'How current is this visa data?', a: 'The matrix comes from Passport Index Data, last updated ' + ctx.db.visa.updated + '. Visa policies change often, so check the destination government’s official website before you travel.' },
  ];
  return toolPage(ctx, 'visa', {
    title: 'Visa-free countries by passport',
    metaTitle: 'Visa-Free Countries by Passport (' + ctx.year + ') + Dual Citizenship | NomadAtlas',
    description: 'Every country you can visit visa-free, on arrival or with an eTA, for ' + ctx.db.visa.codes.length + ' passports. Combine two passports and see stay lengths on a world map.',
    lede: 'Pick one passport, or two if you hold dual citizenship, to see where you can go without a visa, where you get a visa on arrival or eTA, and how long you can stay.',
    tool: html`<section class="section toolwrap" data-tool="visa" aria-labelledby="visa-tool-h"><h2 id="visa-tool-h" class="sr">Visa checker</h2>
      <div data-summary>${s.p1 ? visaSummary(ctx, s) : ''}</div>
      <div class="worldmap" data-map="visa" aria-hidden="true"><div class="worldmap__ph">Loading map…</div></div>
      ${MAP_LEGEND}
      ${visaForm(ctx, s)}<div class="results" data-results aria-live="polite">${visaResults(ctx, s)}</div></section>`,
    after: html`<section class="section"><h2>Passport ranking: easy access</h2><p>All ${ranking.length} passports ranked by destinations reachable without applying for a visa in advance (visa-free, on arrival or eTA).</p>
      ${dataTable({ caption: 'Passports ranked by easy-access destinations', id: 'passport-rank', columns: [{ label: 'Passport' }, { label: 'Easy access', num: true }, { label: 'Visa-free', num: true }, { label: 'On arrival', num: true }, { label: 'eTA', num: true }, { label: 'e-Visa', num: true }, { label: 'Visa required', num: true }],
        rows: ranking.map(({ c, n }) => ({ cells: [html`<a href="${ctx.link(passportPath(c))}">${c.name}</a>`, n.easy, n.free, n.voa, n.eta, n.evisa, n.required], sort: [c.name, n.easy, n.free, n.voa, n.eta, n.evisa, n.required] })) })}</section>`,
    faq, sources: ['Passport Index Data (MIT)', 'Natural Earth (public domain)'],
  });
}

export function schengenPage(ctx) {
  const s = schengenDefaults(ctx);
  const members = SCHENGEN.map((i) => ctx.db.byIso3.get(i)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const faq = [
    { q: 'How does the Schengen 90/180 rule work?', a: 'Visitors who do not need a Schengen visa, or who hold a short-stay Schengen visa, can spend at most 90 days in any 180-day period across all Schengen countries combined. On any given day, count back 180 days: the days you spent in the area in that window must not exceed 90.' },
    { q: 'Do the days I enter and leave count?', a: 'Yes. Both the day of entry and the day of exit count as full days in the Schengen Area, even if you arrive late at night or leave early in the morning.' },
    { q: 'Does time in the UK, Ireland or Cyprus count?', a: 'No. The United Kingdom, Ireland and Cyprus are not in the Schengen Area, so days there do not count towards your 90. Bulgaria and Romania became full members in January 2025 and do count.' },
    { q: 'What happens if I overstay?', a: 'Overstaying can lead to fines, deportation and entry bans, and is recorded by the EU’s electronic Entry/Exit System. If you need longer, look at national long-stay visas such as digital nomad visas, which are issued by individual countries.' },
    { q: 'Is this calculator official?', a: 'No. It applies the published rule to the dates you enter, but border guards make the final decision. The European Commission publishes an official short-stay calculator you can use to double-check.' },
  ];
  return toolPage(ctx, 'schengen', {
    title: 'Schengen 90/180 calculator',
    metaTitle: 'Schengen Calculator: 90/180 Day Rule Counter | NomadAtlas',
    description: 'Free Schengen 90/180 calculator. Add your stays to see days used, days left, when days free up and how long you can stay on your next trip.',
    lede: 'Add your past and planned stays to see how many of your 90 days you have used, when days free up again, and how long you can stay on your next trip.',
    tool: html`<section class="section toolwrap toolwrap--split" data-tool="schengen" aria-label="Schengen calculator">${schengenForm(ctx, s)}<div class="results" data-results aria-live="polite">${schengenResults(ctx, s)}</div></section>`,
    after: html`<section class="section prose"><h2>The 29 Schengen countries</h2><p>Days anywhere in these countries count together towards the same 90-day limit:</p>
      <ul class="chips">${members.map((c) => html`<li><a href="${ctx.link(countryPath(c))}">${c.name}</a></li>`)}</ul>
      <p>Monaco, San Marino and Vatican City are not members, but they have open borders with Schengen countries and can only be reached through them, so in practice days there count too.</p>
      <p>Some nationalities have older bilateral agreements that allow extra time in individual countries, and residence permits or national long-stay visas pause the count. When in doubt, ask the consulate of the country you will spend most time in.</p></section>`,
    faq, sources: ['Regulation (EU) 2016/399 (Schengen Borders Code)'],
  });
}

export function timezonePage(ctx) {
  const s = tzDefaults(ctx);
  const best = (tz) => { const d = refDate(ctx.year, 0); return ctx.db.citiesRanked.map((c) => ({ c, m: overlap({ tz, start: 9, end: 17 }, { tz: c.tz, start: 8, end: 20 }, d)?.minutes ?? 0 })).filter((x) => x.c.country.region !== 'North America' && x.m >= 240).slice(0, 5); };
  const us = best('America/New_York'), eu = best('Europe/Berlin');
  const faq = [
    { q: 'How many overlapping hours does a remote team need?', a: 'Many distributed teams aim for three to four shared hours a day for meetings and quick questions, and do the rest of the work asynchronously. Set the overlap you need and the calculator scores each city against it.' },
    { q: 'Does daylight saving time change the overlap?', a: 'Yes. Clocks change on different dates in North America and Europe, and most of the tropics and Asia do not change at all, so overlap can shift by an hour for part of the year. Pick the month you are planning for and the calculator uses the correct offsets.' },
    { q: 'Where can I live abroad and still work with a US East Coast team?', a: 'With a 9:00 to 17:00 New York team and a working day between 08:00 and 20:00, top-rated options with at least four hours of overlap in January include ' + listJoin(us.map((x) => cityLabel(x.c) + ' (' + fmtHours(x.m) + ')')) + '.' },
    { q: 'What about working with a team in central Europe?', a: 'For a 9:00 to 17:00 Berlin team, top-rated cities outside North America with at least four hours of overlap in January include ' + listJoin(eu.map((x) => cityLabel(x.c) + ' (' + fmtHours(x.m) + ')')) + '.' },
  ];
  return toolPage(ctx, 'timezone', {
    title: 'Time zone overlap calculator for remote teams',
    metaTitle: 'Time Zone Overlap Calculator for Remote Teams | NomadAtlas',
    description: 'Find cities where your working day overlaps with your team. Compare overlap hours in ' + ctx.db.cities.length + ' remote-work cities, with daylight saving handled.',
    lede: 'Tell us when your team works and the earliest and latest hours you are willing to work. We calculate the overlap in every city, with daylight saving for the month you choose.',
    tool: html`<section class="section toolwrap" data-tool="timezone" aria-label="Time zone overlap calculator">${tzForm(ctx, s)}<div class="results" data-results aria-live="polite">${tzResults(ctx, s)}</div></section>`,
    faq, sources: ['IANA time zone database', 'GeoNames (CC BY 4.0)'],
  });
}

export function weatherPage(ctx) {
  const s = weatherDefaults(ctx);
  const faq = [
    { q: 'Where does the weather data come from?', a: 'NASA’s POWER project, based on the MERRA-2 reanalysis on a grid of about 50 by 60 km. Temperatures are averages of daily data for 2015 to 2024; rain and humidity come from the 2001 to 2025 climatology. We adjust temperatures to each city’s elevation using the standard lapse rate of 6.5 °C per kilometre, or half that (at most 3 °C) for coastal cities below their grid cell, which sea air keeps cooler.' },
    { q: 'How is the weather comfort score calculated?', a: 'A month gets full marks when its average temperature (day and night) is inside your preferred range. It loses 8 points per degree below and 11 per degree above, up to 40 points for rain beyond your limit, and up to 14 points for heat combined with high humidity.' },
    { q: 'Why does a coastal city look milder than I expected?', a: 'Each grid cell blends land and sea, so coastal cities can read 1 to 3 °C milder than a weather station in town. Treat the numbers as typical conditions for the area.' },
  ];
  return toolPage(ctx, 'weather', {
    title: 'Where to go by month',
    metaTitle: 'Where to Go by Month: Find Your Ideal Weather | NomadAtlas',
    description: 'Find cities with the weather you like in any month. Filter ' + ctx.db.cities.length + ' remote-work cities by temperature and rain using NASA climate averages.',
    lede: 'Choose a month and the temperature and rain you are comfortable with. We check NASA climate averages for ' + ctx.db.cities.length + ' remote-work cities and rank the ones that fit.',
    tool: html`<section class="section toolwrap" data-tool="weather" aria-label="Weather finder">${weatherForm(ctx, s)}<div class="results" data-results aria-live="polite">${weatherResults(ctx, s)}</div></section>`,
    after: html`<section class="section"><h2>Best places by month</h2><ul class="monthgrid">${MONTHS.map((m, i) => html`<li><a href="${ctx.link(monthPath(i))}">${m}</a></li>`)}</ul></section>`,
    faq, sources: ['NASA POWER', 'GeoNames (CC BY 4.0)'],
  });
}

export function flightPage(ctx) {
  const s = flightDefaults();
  const em = ctx.db.emissions;
  const faq = [
    { q: 'How are flight emissions calculated?', a: 'We take the great-circle distance between the two places and multiply it by the ' + em.year + ' UK government (DESNZ) conversion factor for the haul and cabin class, in kg CO₂e per passenger-kilometre. DESNZ already builds in the recommended 8% for indirect routing and holding patterns, so we do not add it again. Flights within one country use the DESNZ domestic factor if they are shorter than ' + em.shortHaulMaxKm.toLocaleString('en-US') + ' km; longer domestic flights, such as New York to Los Angeles, use the long-haul factors.' },
    { q: 'What is radiative forcing?', a: 'Aircraft also warm the climate through contrails and nitrogen oxides at altitude. Including radiative forcing raises the estimate to reflect those effects; DESNZ recommends including it for the full climate impact.' },
    { q: 'Why do business and first class emit more?', a: 'Premium seats take up more space, so each passenger accounts for a larger share of the aircraft’s fuel burn.' },
  ];
  return toolPage(ctx, 'flight', {
    title: 'Flight distance and CO₂ calculator',
    metaTitle: 'Flight CO₂ Calculator: Distance & Emissions by Cabin | NomadAtlas',
    description: 'Flight distance, time and CO₂ emissions between nearly 300 cities and capitals, by cabin class, using ' + em.year + ' UK government conversion factors.',
    lede: 'Pick two places to see the distance, a typical flight time and the emissions per passenger, using the UK government’s ' + em.year + ' greenhouse gas conversion factors.',
    tool: html`<section class="section toolwrap" data-tool="flight" aria-labelledby="flight-tool-h"><h2 id="flight-tool-h" class="sr">Flight carbon calculator</h2>${flightForm(ctx, s)}<div class="results" data-results aria-live="polite">${flightResults(ctx, s)}</div></section>`,
    faq, sources: ['UK DESNZ greenhouse gas conversion factors ' + em.year + ' (OGL v3.0)', 'GeoNames (CC BY 4.0)'],
  });
}
