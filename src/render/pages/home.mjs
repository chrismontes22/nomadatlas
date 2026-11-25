import { html } from '../html.mjs';
import { MONTHS, fmtMoney, fmtTemp } from '../../shared/format.mjs';
import { rankCities, FACTORS } from '../../shared/scores.mjs';
import { comfort, describe } from '../../shared/climate.mjs';
import { matchDefaults, toQuery, matchFilter, matchForm, matchResults } from '../tools/match.mjs';
import { toolGrid, faqBlock, faqLd, cityCards, monthPath } from '../components.mjs';

const FACTOR_INFO = {
  cost: ['Affordability', 'Your monthly budget against the estimated cost of your chosen lifestyle, priced category by category with World Bank purchasing-power data.'],
  climate: ['Weather', 'NASA POWER monthly averages for temperature, rain and humidity, scored against the temperature range you prefer.'],
  internet: ['Internet', 'Median measured download speed from M-Lab, plus the share of people online (World Bank).'],
  safety: ['Safety & stability', 'World Bank political-stability score and the intentional homicide rate.'],
  visa: ['Visa ease', 'Best entry option across up to two passports: visa-free days, visa on arrival, eTA, e-visa or visa required.'],
  timezone: ['Time-zone fit', 'Hours your working day overlaps with your team, with daylight saving for the month you pick.'],
  health: ['Healthcare', 'Life expectancy and health spending per person, adjusted for purchasing power.'],
  air: ['Air quality', 'Average PM2.5 exposure compared with the World Health Organization guideline.'],
};

export function homePage(ctx) {
  const s = matchDefaults(ctx);
  const ranked = rankCities(ctx.db, toQuery(s, ctx), matchFilter(s));
  const m = ctx.buildMonth;
  const monthPicks = [...ctx.db.cities].map((c) => ({ c, v: comfort(c.clim, m) * 0.6 + (c.score ?? 0) * 0.4 })).sort((a, b) => b.v - a.v).slice(0, 8).map((x) => x.c);
  const faq = [
    { q: 'How does NomadAtlas decide which city suits me?', a: 'Each city gets a 0 to 100 score on eight factors: affordability for your budget, weather in the month you pick, internet speed, safety and stability, visa ease for your passports, working-hours overlap with your team, healthcare and air quality. Your priority sliders set how much each factor counts, and the match score is the weighted average.' },
    { q: 'Where does the data come from?', a: 'Every figure comes from an openly licensed dataset: the World Bank (World Development Indicators, International Comparison Program and Worldwide Governance Indicators, CC BY 4.0), NASA POWER climate data, M-Lab internet measurements (CC0), GeoNames (CC BY 4.0), Wikidata (CC0), Natural Earth, the MIT-licensed Passport Index Data, European Central Bank exchange rates and UK government emission factors (Open Government Licence).' },
    { q: 'How accurate are the cost of living estimates?', a: 'They use national price levels for each spending category, so they are most reliable for comparing countries. Central neighbourhoods in big hubs such as London, Paris or New York usually cost more than the national estimate, and small towns cost less. Use the cost of living calculator to start from what you actually spend today.' },
    { q: 'Is NomadAtlas free?', a: 'Yes. All calculators are free, need no account and run in your browser. Settings you enter stay on your device.' },
    { q: 'Can I rely on the visa information?', a: 'Treat it as a starting point. Visa rules change often, and the visa matrix was last updated in February 2026. Always confirm entry requirements with the official government website of your destination before you book.' },
  ];
  const body = html`<section class="hero">
  <div class="wrap hero__inner">
    <p class="eyebrow">${ctx.db.cities.length} cities · ${ctx.db.visa.codes.length} passports · 12 open datasets</p>
    <h1>Where should you work from next?</h1>
    <p class="lede">Set your budget, passport, team time zone and the weather you like. NomadAtlas ranks ${ctx.db.cities.length} remote-work cities with open data from the World Bank, NASA, M-Lab and GeoNames, and shows the working behind every number.</p>
  </div>
</section>
<section class="wrap finderwrap" data-tool="match" aria-label="Destination finder">
  ${matchForm(ctx, s)}
  <div class="results" data-results aria-live="polite">${matchResults(ctx, ranked, s)}</div>
</section>
<section class="wrap section">
  <h2>What goes into a match</h2>
  <ul class="factors">${FACTORS.map((f) => html`<li><h3>${FACTOR_INFO[f.key][0]}</h3><p>${FACTOR_INFO[f.key][1]}</p></li>`)}</ul>
  <p><a class="arrowlink" href="${ctx.link('/methodology/')}">Read the full methodology</a></p>
</section>
<section class="wrap section">
  <div class="section__head"><h2>Good places to be in ${MONTHS[m]}</h2><a class="arrowlink" href="${ctx.link(monthPath(m))}">All ${MONTHS[m]} picks</a></div>
  ${cityCards(ctx, monthPicks, (c) => html`${fmtTemp(c.clim.t[m])} · ${describe(c.clim, m)} · ${fmtMoney(c.costComfort)}/mo`)}
</section>
<section class="wrap section">
  <h2>More calculators for remote workers</h2>
  ${toolGrid(ctx, 'match')}
</section>
<div class="wrap">${faqBlock(faq)}</div>`;
  return {
    path: '/',
    title: 'Digital Nomad Destination Finder & Calculators | NomadAtlas',
    ogTitle: 'Where should you work from next? NomadAtlas',
    description: `Find the best city to live and work remotely. Rank ${ctx.db.cities.length} cities by budget, passport, time zone, weather, internet and safety. Free, open data, no sign-up.`,
    og: 'default',
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: ctx.site.name, url: ctx.site.url + '/', description: ctx.site.description, inLanguage: 'en' },
      { '@context': 'https://schema.org', '@type': 'Organization', name: ctx.site.name, url: ctx.site.url + '/', logo: ctx.site.url + '/apple-touch-icon.png' },
      { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'NomadAtlas destination finder', url: ctx.site.url + '/', applicationCategory: 'TravelApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript for live updates', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, description: 'Ranks remote-work cities by budget, passport, time zone, weather, internet, safety, healthcare and air quality.' },
      faqLd(faq),
    ],
    body, priority: 1.0, changefreq: 'weekly',
  };
}
