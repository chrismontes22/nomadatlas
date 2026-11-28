import { html } from '../html.mjs';
import { MONTHS, fmtTemp, fmtMm, fmtMoney, listJoin } from '../../shared/format.mjs';
import { comfort, describe } from '../../shared/climate.mjs';
import { fitTitle, faqBlock, faqLd, sourceNote, cityPath, cityLabel, cityFull, inCountry, monthPath, cityCards, monthMapPath, mapFigure, mediaHead } from '../components.mjs';
import { shell, crumbsLd } from './common.mjs';
import { weatherTable } from '../tools/weather.mjs';

const REGION_ORDER = ['Europe & Central Asia', 'Latin America & Caribbean', 'East Asia & Pacific', 'South Asia', 'Middle East & North Africa', 'Sub-Saharan Africa', 'North America'];

export function monthPage(ctx, m) {
  const db = ctx.db; const M = MONTHS[m];
  const rows = db.cities.map((c) => ({ c, comfort: comfort(c.clim, m), v: comfort(c.clim, m) * 0.6 + (c.score ?? 0) * 0.4 })).sort((a, b) => b.v - a.v);
  const top = rows.slice(0, 30);
  const byRegion = REGION_ORDER.map((r) => [r, rows.filter((x) => x.c.country.region === r && x.comfort >= 60).slice(0, 4)]).filter(([, l]) => l.length);
  const cheapWarm = rows.filter((x) => x.comfort >= 70 && x.c.costComfort && x.c.clim.t[m] >= 20).sort((a, b) => a.c.costComfort - b.c.costComfort).slice(0, 8);
  const avoid = rows.filter((x) => x.c.score >= 65 && (x.c.clim.rain[m] > 220 || x.c.clim.t[m] > 31 || x.c.clim.t[m] < 3)).sort((a, b) => b.c.score - a.c.score).slice(0, 8);
  const why = (c) => (c.clim.rain[m] > 220 ? 'heavy rain, ' + fmtMm(c.clim.rain[m]) : c.clim.t[m] > 31 ? 'very hot, average ' + fmtTemp(c.clim.t[m]) : 'cold, average ' + fmtTemp(c.clim.t[m]));
  const faq = [
    { q: `Where is the best place for digital nomads in ${M}?`, a: `Weighing ${M} weather with cost, internet, safety and healthcare, the top picks are ${listJoin(top.slice(0, 5).map((x) => (inCountry(x.c) ? cityLabel(x.c) + ' (' + x.c.country.name + ')' : cityLabel(x.c))))}.` },
    cheapWarm.length && { q: `Where is warm and cheap in ${M}?`, a: `For warm, comfortable weather on a budget in ${M}, look at ${listJoin(cheapWarm.slice(0, 5).map((x) => cityLabel(x.c) + ' (about ' + fmtMoney(x.c.costComfort) + ' a month)'))}.` },
    avoid.length && { q: `Which popular nomad cities should I avoid in ${M}?`, a: `${listJoin(avoid.slice(0, 4).map((x) => cityLabel(x.c) + ' (' + why(x.c) + ')'))} are less pleasant in ${M}.` },
    { q: 'How is the weather score calculated?', a: 'Each city gets a 0 to 100 comfort score for the month from NASA POWER climate averages (temperatures 2015 to 2024, rain and humidity 2001 to 2025): full marks when the average temperature is between 16 and 25 °C, with deductions for cold, heat, heavy rain and muggy humidity. The ranking on this page blends weather (60%) with the overall NomadAtlas score (40%).' },
  ].filter(Boolean);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Where to go', path: '/where-to-go/' }, { name: M, path: monthPath(m) }];
  const mAlt = 'World map of the best places for digital nomads in ' + M + ': ' + listJoin(top.slice(0, 5).map((x) => cityLabel(x.c))) + ' and more';
  const mapImg = { src: monthMapPath(m), w: 1000, h: 470, alt: mAlt, caption: 'The top ' + Math.min(30, top.length) + ' cities for ' + M + ' on the map; the top 10 have larger markers. Map data: Natural Earth.',
    spec: { kind: 'world', pins: top.slice(0, 30).map((x) => [x.c.lat, x.c.lng]), alt: mAlt } };
  const body = shell(ctx, crumbs, html`
<header class="pagehead ${mediaHead(ctx)}">
  <div class="pagehead__main">
  <p class="eyebrow">Where to go by month</p>
  <h1>Best places for digital nomads in ${M}</h1>
  <p class="lede">Where the weather is comfortable in ${M}, weighed against cost of living, internet, safety and healthcare. ${listJoin(top.slice(0, 3).map((x) => cityLabel(x.c)))} lead this month.</p>
  <nav class="monthnav" aria-label="Other months">${MONTHS.map((mm, i) => (i === m ? html`<span aria-current="page">${mm.slice(0, 3)}</span>` : html`<a href="${ctx.link(monthPath(i))}">${mm.slice(0, 3)}</a>`))}</nav>
  </div>
  ${mapFigure(ctx, mapImg)}
</header>
<section class="section"><h2>Top 30 cities in ${M}</h2>
  ${weatherTable(ctx, top, m, { caption: 'Ranked by ' + M + ' weather (60%) and overall score (40%)' })}
  <p><a class="arrowlink" href="${ctx.link('/where-to-go/')}">Set your own temperature range</a></p>
</section>
<section class="section"><h2>Best in each region in ${M}</h2>
  <div class="cols cols--3">${byRegion.map(([r, l]) => html`<div><h3>${r}</h3><ul class="plainlist">${l.map((x) => html`<li><a href="${ctx.link(cityPath(x.c))}">${cityLabel(x.c)}</a>${inCountry(x.c)} <span class="muted">· ${fmtTemp(x.c.clim.t[m])}, ${describe(x.c.clim, m).toLowerCase()}</span></li>`)}</ul></div>`)}</div>
</section>
${cheapWarm.length ? html`<section class="section"><h2>Warm and affordable in ${M}</h2>${cityCards(ctx, cheapWarm.map((x) => x.c), (c) => html`${fmtTemp(c.clim.t[m])} · ${fmtMoney(c.costComfort)}/mo`)}</section>` : ''}
${avoid.length ? html`<section class="section"><h2>Popular cities to skip in ${M}</h2><ul class="plainlist">${avoid.map((x) => html`<li><a href="${ctx.link(cityPath(x.c))}">${cityLabel(x.c)}</a>${inCountry(x.c)} <span class="muted">· ${why(x.c)}</span></li>`)}</ul></section>` : ''}
${faqBlock(faq)}
${sourceNote(ctx, ['NASA POWER', 'World Bank', 'M-Lab', 'GeoNames'])}
`);
  return {
    path: monthPath(m),
    title: `Best Places for Digital Nomads in ${M}: Weather, Cost & Wi-Fi`,
    // Longest wording that fits in 160 characters: up to three city names, then "and N more cities", always a full sentence.
    description: fitTitle([3, 2, 1].flatMap((n) => { const names = top.slice(0, n).map((x) => x.c.name).join(', '); return [
      `Where to live and work remotely in ${M}: ${names} and ${top.length - n} more cities, ranked by weather, cost of living, internet and safety.`,
      `Where to work remotely in ${M}: ${names} and ${top.length - n} more cities ranked by weather, cost, internet and safety.`]; }), 160),
    jsonld: [crumbsLd(ctx, crumbs), { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Best places for digital nomads in ' + M, image: ctx.site.url + mapImg.src, itemListOrder: 'https://schema.org/ItemListOrderDescending', numberOfItems: top.length, itemListElement: top.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: cityFull(x.c), url: ctx.site.url + cityPath(x.c) })) }, faqLd(faq)],
    body, images: [mapImg], priority: 0.7, changefreq: 'monthly',
  };
}
