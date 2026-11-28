import { html } from '../html.mjs';
import { MONTHS, fmtMoney, fmtTemp } from '../../shared/format.mjs';
import { rankCities, FACTORS } from '../../shared/scores.mjs';
import { comfort, describe } from '../../shared/climate.mjs';
import { matchDefaults, toQuery, matchFilter, matchForm, matchResults } from '../tools/match.mjs';
import { toolGrid, faqBlock, faqLd, cityCards, monthPath, cityLabel } from '../components.mjs';
import { iconTile } from '../icons.mjs';
import { raw } from '../html.mjs';

// The traveller from the old daily intro, now standing on top of the hero globe and greeting the sun (seen from behind:
// hair bun, backpack with a sleeping mat and a water bottle). Purely decorative, inside the aria-hidden globe box.
const TRAVELLER = raw('<svg class="trav" viewBox="0 0 120 200" aria-hidden="true" focusable="false"><g class="trav__body"><g class="trav__arm trav__arm--l"><path d="M52.9 75.5L41.7 48.6A4.9 4.9 0 0 0 32.5 51.9L40.9 79.8A6.4 6.4 0 1 0 52.9 75.5Z"/><path d="M41.8 49.2L33.9 22A3.4 3.4 0 0 0 27.3 23.6L32.5 51.4A4.8 4.8 0 1 0 41.8 49.2Z"/><path d="M26.2 18.6C25.2 13.8 26.2 8.8 29.2 8.1C32.4 7.4 34.2 11.4 34.2 15.8C34.2 19.8 32.8 23.2 30.4 23.6C28.2 24 26.8 22 26.2 18.6Z"/><path d="M33.1 22.1L35.9 16.5A1.5 1.5 0 0 0 33.4 15L29.8 20.1A1.9 1.9 0 1 0 33.1 22.1Z"/></g><g class="trav__arm trav__arm--r"><path d="M79.1 79.9L88.3 51A4.9 4.9 0 0 0 79.1 47.6L67.1 75.5A6.4 6.4 0 1 0 79.1 79.9Z"/><path d="M88.3 50.6L94.7 22.8A3.4 3.4 0 0 0 88.2 20.9L79.1 48A4.8 4.8 0 1 0 88.3 50.6Z"/><path d="M95.8 17.6C96.8 12.8 95.8 7.8 92.8 7.1C89.6 6.4 87.8 10.4 87.8 14.8C87.8 18.8 89.2 22.2 91.6 22.6C93.8 23 95.2 21 95.8 17.6Z"/><path d="M92.2 19.1L88.6 14A1.5 1.5 0 0 0 86.1 15.5L88.9 21.1A1.9 1.9 0 1 0 92.2 19.1Z"/></g><path d="M44.4 116.3L45.6 150.2A5.6 5.6 0 0 0 56.7 150.8L61.5 117.2A8.6 8.6 0 1 0 44.4 116.3Z"/><path d="M45.6 150L45.5 161.9A6.1 6.1 0 0 0 57.7 161.5L56.8 149.6A5.6 5.6 0 1 0 45.6 150Z"/><path d="M45.5 162.7L48.3 186.5A3.9 3.9 0 0 0 56.1 186.3L57.7 162.4A6.1 6.1 0 1 0 45.5 162.7Z"/><path d="M58.6 117.9L65.9 149.8A5.6 5.6 0 0 0 77 148.3L75.6 115.6A8.6 8.6 0 1 0 58.6 117.9Z"/><path d="M65.8 148.4L65.5 160.3A6.1 6.1 0 0 0 77.7 160.1L77 148.2A5.6 5.6 0 1 0 65.8 148.4Z"/><path d="M65.6 161.8L70.8 185.8A3.9 3.9 0 0 0 78.5 184.9L77.7 160.3A6.1 6.1 0 1 0 65.6 161.8Z"/><path d="M46.4 183.6C45.8 189.4 44.4 194.2 45.8 197.2C47 199.1 57.8 199.3 59 197.4C60.2 195.3 58.8 189 58 183.6Z"/><path d="M68.8 182.6C68.2 188.4 67.4 193.4 69.2 196.4C70.6 198.5 81.2 198.3 82.2 196C83 193.7 80.8 187.8 79.8 182.4Z"/><path d="M43 80C42.8 74.2 49.8 71 60 71C70.2 71 77.2 74.2 77 80L76 105C75.8 110.2 70.2 112.8 60 112.8C49.8 112.8 44.2 110.2 44 105Z"/><path d="M44.8 101.6C50.8 99.2 69.2 99.2 75.2 101.6C77.4 109.4 77 117.6 73.8 123.6C66.2 125.6 53.8 125.6 46.2 123.6C43 117.6 42.6 109.4 44.8 101.6Z"/><path d="M60 44.2C66.2 44.2 70.4 49.4 70.2 56C70 62.8 65.6 67.6 60 67.6C54.4 67.6 50 62.8 49.8 56C49.6 49.4 53.8 44.2 60 44.2Z"/><path d="M47.3 55.6L48 59.7A2 2 0 0 0 52 59.4L52.1 55.3A2.4 2.4 0 1 0 47.3 55.6Z"/><path d="M67.9 55.3L68 59.4A2 2 0 0 0 72 59.7L72.7 55.6A2.4 2.4 0 1 0 67.9 55.3Z"/><path d="M60 37.4C63.8 37.4 65.6 39.9 65.2 42.8C64.8 45.5 62.5 46.6 60 46.6C57.5 46.6 55.2 45.5 54.8 42.8C54.4 39.9 56.2 37.4 60 37.4Z"/><path d="M55 63.4L53.8 73.3A6.2 6.2 0 0 0 66.2 73.3L65 63.4A5 5 0 1 0 55 63.4Z"/><path class="trav__pack" d="M40.4 81.6C40.4 74.8 45.2 70.8 52 70.6L68 70.6C74.8 70.8 79.6 74.8 79.6 81.6L80.4 106.4C80.4 113.2 76 116.8 69.6 116.8L50.4 116.8C44 116.8 39.6 113.2 39.6 106.4Z"/><path class="trav__lid" d="M42.6 78.8C42.6 72.6 49.4 68.6 60 68.6C70.6 68.6 77.4 72.6 77.4 78.8C77.4 81.2 75.6 82.4 73 82.4L47 82.4C44.4 82.4 42.6 81.2 42.6 78.8Z"/><path class="trav__pocket" d="M47.6 92.6C47.6 90.4 49.2 89 51.4 89L68.6 89C70.8 89 72.4 90.4 72.4 92.6L72.4 105.4C72.4 107.8 70.8 109.2 68.6 109.2L51.4 109.2C49.2 109.2 47.6 107.8 47.6 105.4Z"/><path class="trav__bottle" d="M79.8 93.4C79.8 92 80.8 91.2 82.2 91.2L84 91.2C85.4 91.2 86.4 92 86.4 93.4L86.4 108.8C86.4 110.4 85.4 111.2 84 111.2L82.2 111.2C80.8 111.2 79.8 110.4 79.8 108.8Z"/><path class="trav__roll" d="M41 125.1L79 125.1A4.9 4.9 0 0 0 79 115.3L41 115.3A4.9 4.9 0 1 0 41 125.1Z"/></g></svg>');

const FACTOR_ICON = { cost: ['wallet', 'emerald'], climate: ['sun', 'amber'], internet: ['wifi', 'sky'], safety: ['shield', 'violet'], visa: ['passport', 'teal'], timezone: ['clock', 'indigo'], health: ['heart', 'rose'], air: ['wind', 'cyan'] };
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
    { q: 'Can I rely on the visa information?', a: `Treat it as a starting point. Visa rules change often, and the visa matrix was last updated on ${ctx.db.visa.updated}. Always confirm entry requirements with the official government website of your destination before you book.` },
  ];
  // The hero globe starts on the default ranking; the finder updates it in the browser (src/client/globe.mjs).
  const globePts = ranked.slice(0, 8).map((r, i) => [r.city.lat, r.city.lng, i ? cityLabel(r.city) : cityLabel(r.city) + ' · ' + r.total]);
  const body = html`<section class="hero">
  <div class="wrap hero__inner">
    <div class="hero__copy">
      <p class="hero__chips"><span>${ctx.db.cities.length} cities</span> <span>${ctx.db.visa.codes.length} passports</span> <span>12 open datasets</span></p>
      <h1>Where should you <span class="hero__hl">work from next?</span></h1>
      <p class="lede">Set your budget, passport, team time zone and the weather you like. NomadAtlas ranks ${ctx.db.cities.length} remote-work cities with open data from the World Bank, NASA, M-Lab and GeoNames, and shows the working behind every number.</p>
      <p class="hero__cta"><a class="btn btn--glow" href="#finder">Find my city</a><a class="btn btn--glass" href="${ctx.link('/cities/')}">Browse all ${ctx.db.cities.length} cities</a></p>
      <p class="hero__now" data-now><span class="hero__nowk">Right now</span><span class="hero__nowv" data-now-text>Somewhere, it is golden hour. Go find it.</span></p>
    </div>
    <div class="hero__globe" aria-hidden="true"><canvas data-globe data-points="${JSON.stringify(globePts)}" width="560" height="560"></canvas>${TRAVELLER}<span class="hero__globecap">Your top matches, in today’s daylight</span></div>
  </div>
</section>
<section class="wrap finderwrap" id="finder" data-tool="match" aria-labelledby="finder-h">
  <h2 id="finder-h" class="sr">Destination finder</h2>
  ${matchForm(ctx, s)}
  <div class="results" data-results aria-live="polite">${matchResults(ctx, ranked, s)}</div>
</section>
<section class="wrap section">
  <h2>What goes into a match</h2>
  <ul class="factors">${FACTORS.map((f) => html`<li>${iconTile(...FACTOR_ICON[f.key])}<div><h3>${FACTOR_INFO[f.key][0]}</h3><p>${FACTOR_INFO[f.key][1]}</p></div></li>`)}</ul>
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
