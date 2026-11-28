import { html, esc } from '../html.mjs';
import { fmtMoney, fmtNum, monthRanges } from '../../shared/format.mjs';
import { scoreChip, dataTable, cityPath, countryPath, cityLabel, cityFull, inCountry, pageHead, sourceNote } from '../components.mjs';
import { shell, crumbsLd } from './common.mjs';

export function citiesIndexPage(ctx) {
  const db = ctx.db;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Cities', path: '/cities/' }];
  const list = db.citiesRanked;
  const body = shell(ctx, crumbs, html`${pageHead({ eyebrow: db.cities.length + ' cities', title: 'Best cities for digital nomads, ranked', lede: 'Every city NomadAtlas covers, scored on cost for a comfortable lifestyle, year-round weather, internet, safety, healthcare and air quality. Sort any column, or use the destination finder to rank them for your own budget, passport and team.' })}
  <section class="section" data-tool="cityindex">
    <div class="worldmap worldmap--dots" data-map="cities" aria-hidden="true"><div class="worldmap__ph">Loading map…</div></div>
    <form class="panel filterbar" data-form autocomplete="off">
      <div class="field"><label for="ci-q">Search</label><input id="ci-q" name="q" type="search" placeholder="City or country"></div>
      <div class="field"><label for="ci-r">Region</label><select id="ci-r" name="region"><option value="">All regions</option>${db.regions.map((r) => html`<option>${r}</option>`)}</select></div>
    </form>
    ${dataTable({ caption: 'All cities by NomadAtlas score (default weights)', id: 'city-table',
      columns: [{ label: '#', num: true }, { label: 'City' }, { label: 'Score', num: true }, { label: 'Comfortable month', num: true }, { label: 'Best weather' }, { label: 'Internet', num: true }, { label: 'Safety', num: true }, { label: 'Healthcare', num: true }],
      rows: list.map((c) => ({ th: false, attrs: 'data-region="' + esc(c.country.region) + '" data-name="' + esc((cityLabel(c) + ' ' + c.country.name).toLowerCase()) + '"',
        cells: [c.rank, html`<a href="${ctx.link(cityPath(c))}">${cityLabel(c)}</a><span class="muted">${inCountry(c)}</span>`, scoreChip(c.score), fmtMoney(c.costComfort), monthRanges(c.best), c.country.net ? fmtNum(c.country.net.down) + ' Mbps' : '–', scoreChip(c.country.sc.safety), scoreChip(c.country.sc.health)],
        sort: [c.rank, cityLabel(c), c.score ?? '', c.costComfort ?? '', c.best[0] ?? '', c.country.net?.down ?? '', c.country.sc.safety ?? '', c.country.sc.health ?? ''] })) })}
  </section>
  ${sourceNote(ctx, ['World Bank', 'NASA POWER', 'M-Lab', 'GeoNames'])}`);
  return {
    path: '/cities/', title: `Best Cities for Digital Nomads (${ctx.year}): All ${db.cities.length} Ranked | NomadAtlas`,
    description: `${db.cities.length} remote-work cities ranked by cost of living, weather, internet speed, safety and healthcare. Top picks: ${list.slice(0, 4).map((c) => c.name).join(', ')}.`,
    jsonld: [crumbsLd(ctx, crumbs), { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Best cities for digital nomads', numberOfItems: list.length, itemListElement: list.slice(0, 50).map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: cityFull(c), url: ctx.site.url + cityPath(c) })) }],
    body, priority: 0.9, changefreq: 'weekly',
  };
}

export function countriesIndexPage(ctx) {
  const db = ctx.db;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Countries', path: '/countries/' }];
  const list = [...db.countries].sort((a, b) => a.name.localeCompare(b.name));
  const body = shell(ctx, crumbs, html`${pageHead({ eyebrow: db.countries.length + ' countries', title: 'Countries compared for remote workers', lede: 'Cost of living, internet, safety, healthcare, air quality and passport strength for every country, side by side. Click a column to sort.' })}
  <section class="section" data-tool="countryindex">
    <form class="panel filterbar" data-form autocomplete="off">
      <div class="field"><label for="co-q">Search</label><input id="co-q" name="q" type="search" placeholder="Country"></div>
      <div class="field"><label for="co-r">Region</label><select id="co-r" name="region"><option value="">All regions</option>${db.regions.map((r) => html`<option>${r}</option>`)}</select></div>
    </form>
    ${dataTable({ caption: 'All countries', id: 'country-table',
      columns: [{ label: 'Country' }, { label: 'Region' }, { label: 'Comfortable month', num: true }, { label: 'Price level (US = 100)', num: true }, { label: 'Internet', num: true }, { label: 'Safety', num: true }, { label: 'Healthcare', num: true }, { label: 'Air', num: true }, { label: 'Cities', num: true }],
      rows: list.map((c) => ({ attrs: 'data-region="' + esc(c.region) + '" data-name="' + esc((c.name + ' ' + (c.aka || '')).toLowerCase()) + '"',
        cells: [html`<a href="${ctx.link(countryPath(c))}">${c.name}</a>`, c.region, fmtMoney(c.costComfort), c.pli ? fmtNum(c.pli.aic) : '–', c.net ? fmtNum(c.net.down) + ' Mbps' : '–', scoreChip(c.sc.safety), scoreChip(c.sc.health), scoreChip(c.sc.air), c.cities.length || ''],
        sort: [c.name, c.region, c.costComfort ?? '', c.pli?.aic ?? '', c.net?.down ?? '', c.sc.safety ?? '', c.sc.health ?? '', c.sc.air ?? '', c.cities.length] })) })}
  </section>
  ${sourceNote(ctx, ['World Bank WDI, ICP and WGI', 'M-Lab', 'Passport Index Data'])}`);
  return {
    path: '/countries/', title: 'Countries for Digital Nomads: Cost, Internet & Safety | NomadAtlas',
    description: `Compare ${db.countries.length} countries on cost of living, internet speed, safety, healthcare, air quality and visas, using World Bank and M-Lab open data.`,
    jsonld: [crumbsLd(ctx, crumbs)], body, priority: 0.8, changefreq: 'monthly',
  };
}
