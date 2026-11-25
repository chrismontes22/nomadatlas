import { html, raw } from '../html.mjs';
import { fmtNum, fmtHours } from '../../shared/format.mjs';
import { haversine, flightEstimate, CABINS } from '../../shared/geo.mjs';
import { cityLabel, cityPath, dataTable } from '../components.mjs';

export function places(ctx) {
  if (ctx.db._places) return ctx.db._places;
  const list = ctx.db.cities.map((c) => ({ id: 'c-' + c.slug, label: cityLabel(c) + ', ' + c.country.name, lat: c.lat, lng: c.lng, city: c }));
  for (const k of ctx.db.countries) if (!k.cities.length && k.capLat != null && k.capital) list.push({ id: 'k-' + k.iso3.toLowerCase(), label: k.capital + ', ' + k.name, lat: k.capLat, lng: k.capLng });
  list.sort((a, b) => a.label.localeCompare(b.label));
  ctx.db._places = list; ctx.db._placeById = new Map(list.map((p) => [p.id, p]));
  return list;
}
export const flightDefaults = () => ({ from: 'c-london', to: 'c-lisbon', cabin: 'economy', rt: '1', rf: '1' });

export function flightForm(ctx, s) {
  const opts = (v) => places(ctx).map((p) => html`<option value="${p.id}"${p.id === v ? raw(' selected') : ''}>${p.label}</option>`);
  const sel = (a, b) => (a === b ? raw(' selected') : '');
  return html`<form class="panel finder finder--flat" data-form autocomplete="off"><div class="finder__main">
    <div class="field field--wide"><label for="f-from">From</label><select id="f-from" name="from">${opts(s.from)}</select></div>
    <div class="field field--wide"><label for="f-to">To</label><select id="f-to" name="to">${opts(s.to)}</select></div>
    <div class="field"><label for="f-cabin">Cabin</label><select id="f-cabin" name="cabin">${Object.entries(CABINS).map(([k, l]) => html`<option value="${k}"${sel(k, s.cabin)}>${l}</option>`)}</select></div>
    <div class="field"><label for="f-rt">Trip</label><select id="f-rt" name="rt"><option value="1"${sel('1', s.rt)}>Return</option><option value="0"${sel('0', s.rt)}>One way</option></select></div>
    <label class="check"><input type="checkbox" name="rf" value="1"${s.rf === '1' ? raw(' checked') : ''}> Include non-CO₂ warming effects (radiative forcing)</label>
  </div></form>`;
}

export function flightResults(ctx, s) {
  places(ctx);
  const a = ctx.db._placeById.get(s.from), b = ctx.db._placeById.get(s.to);
  if (!a || !b) return html`<div class="empty"><p>Choose two places.</p></div>`;
  const d = haversine(a.lat, a.lng, b.lat, b.lng);
  const trips = s.rt === '1' ? 2 : 1; const rf = s.rf === '1';
  const est = flightEstimate(d, ctx.db.emissions, { cabin: s.cabin, rf, trips });
  const cabins = Object.entries(CABINS).map(([k, l]) => [l, flightEstimate(d, ctx.db.emissions, { cabin: k, rf, trips })]);
  const others = ctx.db.citiesRanked.slice(0, 40).filter((c) => 'c-' + c.slug !== s.from).slice(0, 12).map((c) => { const dd = haversine(a.lat, a.lng, c.lat, c.lng); return { c, dd, e: flightEstimate(dd, ctx.db.emissions, { cabin: s.cabin, rf, trips }) }; }).sort((x, y) => x.dd - y.dd);
  return html`<div class="flighthead">
    <div><span class="flighthead__n">${fmtNum(est.kg)}</span><span class="flighthead__u">kg CO₂e per passenger, ${trips === 2 ? 'return' : 'one way'}</span></div>
    <dl class="stats stats--compact"><div class="stats__item"><dt>Great-circle distance</dt><dd>${fmtNum(d)} km</dd></div><div class="stats__item"><dt>Flight time, one way</dt><dd>≈ ${fmtHours(est.hours * 60 - ((est.hours * 60) % 5))}</dd></div><div class="stats__item"><dt>Haul</dt><dd>${est.longHaul ? 'Long-haul' : 'Short-haul'}</dd></div><div class="stats__item"><dt>Factor</dt><dd>${est.factor} kg/pkm</dd></div></dl>
  </div>
  ${d < 50 ? html`<p class="hint">These places are very close; you probably wouldn't fly.</p>` : ''}
  <div class="tablewrap"><table class="table table--compact"><caption>By cabin class, ${trips === 2 ? 'return' : 'one way'}</caption><thead><tr><th scope="col">Cabin</th><th scope="col" class="num">kg CO₂e</th></tr></thead>
  <tbody>${cabins.map(([l, e]) => html`<tr><th scope="row">${l}</th><td class="num">${fmtNum(e.kg)}</td></tr>`)}</tbody></table></div>
  <h3 class="h3gap">From ${a.label} to top-rated cities</h3>
  ${dataTable({ caption: 'Distance and emissions to popular remote-work cities', columns: [{ label: 'City' }, { label: 'Distance', num: true }, { label: 'kg CO₂e', num: true }], rows: others.map(({ c, dd, e }) => ({ cells: [html`<a href="${ctx.link(cityPath(c))}">${cityLabel(c)}</a><span class="muted">, ${c.country.name}</span>`, fmtNum(dd) + ' km', fmtNum(e.kg)], sort: [cityLabel(c), Math.round(dd), Math.round(e.kg)] })) })}`;
}
