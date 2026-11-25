import { html, raw } from '../html.mjs';
import { MONTHS, fmtTemp, fmtMm, fmtMoney, fmtNum } from '../../shared/format.mjs';
import { comfort, describe, DEFAULT_CLIMATE } from '../../shared/climate.mjs';
import { scoreChip, cityPath, cityLabel, dataTable } from '../components.mjs';

export const weatherDefaults = (ctx) => ({ month: ctx.buildMonth, tmin: DEFAULT_CLIMATE.tMin, tmax: DEFAULT_CLIMATE.tMax, rain: DEFAULT_CLIMATE.maxRain, region: '', minc: 60, sort: 'match' });

export function weatherForm(ctx, s) {
  const sel = (a, b) => (String(a) === String(b) ? raw(' selected') : '');
  return html`<form class="panel finder finder--flat" data-form autocomplete="off"><div class="finder__main">
    <div class="field"><label for="w-month">Month</label><select id="w-month" name="month">${MONTHS.map((m, i) => html`<option value="${i}"${sel(i, s.month)}>${m}</option>`)}</select></div>
    <div class="field"><label for="w-tmin">Coolest average (°C)</label><input id="w-tmin" name="tmin" type="number" min="-10" max="35" value="${s.tmin}"></div>
    <div class="field"><label for="w-tmax">Warmest average (°C)</label><input id="w-tmax" name="tmax" type="number" min="0" max="40" value="${s.tmax}"></div>
    <div class="field"><label for="w-rain">Max rain (mm/month)</label><input id="w-rain" name="rain" type="number" min="20" max="400" step="10" value="${s.rain}"></div>
    <div class="field"><label for="w-region">Region</label><select id="w-region" name="region"><option value="">Anywhere</option>${ctx.db.regions.map((r) => html`<option${sel(r, s.region)}>${r}</option>`)}</select></div>
    <div class="field"><label for="w-sort">Sort by</label><select id="w-sort" name="sort"><option value="match"${sel('match', s.sort)}>Weather, then overall score</option><option value="cost"${sel('cost', s.sort)}>Cheapest first</option><option value="warm"${sel('warm', s.sort)}>Warmest first</option></select></div>
  </div></form>`;
}

export function weatherRows(ctx, s) {
  const m = +s.month; const prefs = { tMin: +s.tmin, tMax: +s.tmax, maxRain: +s.rain };
  let rows = ctx.db.cities.filter((c) => !s.region || c.country.region === s.region).map((c) => ({ c, comfort: comfort(c.clim, m, prefs) })).filter((r) => r.comfort >= (+s.minc || 0));
  const key = { match: (a, b) => b.comfort - a.comfort || (b.c.score ?? 0) - (a.c.score ?? 0), cost: (a, b) => (a.c.costComfort ?? 1e9) - (b.c.costComfort ?? 1e9), warm: (a, b) => b.c.clim.t[m] - a.c.clim.t[m] }[s.sort] || ((a, b) => b.comfort - a.comfort);
  return rows.sort(key);
}

export function weatherTable(ctx, rows, m, { caption, limit } = {}) {
  const list = limit ? rows.slice(0, limit) : rows;
  return dataTable({
    caption,
    columns: [{ label: 'City' }, { label: 'Avg high', num: true }, { label: 'Avg low', num: true }, { label: 'Rain', num: true }, { label: 'Conditions', sortable: false }, { label: 'Weather', num: true }, { label: 'Comfortable month', num: true }, { label: 'Score', num: true }],
    rows: list.map(({ c, comfort: cf }) => ({
      cells: [html`<a href="${ctx.link(cityPath(c))}">${cityLabel(c)}</a><span class="muted">, ${c.country.name}</span>`, fmtTemp(c.clim.hi[m]), fmtTemp(c.clim.lo[m]), fmtMm(c.clim.rain[m]), describe(c.clim, m), scoreChip(cf, 'Weather comfort'), fmtMoney(c.costComfort), scoreChip(c.score, 'NomadAtlas score')],
      sort: [cityLabel(c), c.clim.hi[m], c.clim.lo[m], c.clim.rain[m], '', cf, c.costComfort ?? '', c.score ?? ''],
    })),
  });
}

export function weatherResults(ctx, s) {
  const rows = weatherRows(ctx, s);
  const m = +s.month;
  return html`<p class="results__summary"><b>${rows.length}</b> cities feel comfortable in ${MONTHS[m]} at ${s.tmin} to ${s.tmax} °C with up to ${s.rain} mm of rain</p>
    ${rows.length ? weatherTable(ctx, rows, m, { caption: 'Cities that suit your weather in ' + MONTHS[m], limit: 60 }) : html`<div class="empty"><p>Nothing fits. Widen the temperature range or allow more rain.</p></div>`}`;
}
