import { html, raw } from '../html.mjs';
import { fmtNum, fmtHours, fmtCoord } from '../../shared/format.mjs';
import { icon } from '../icons.mjs';
import { haversine, flightEstimate, CABINS } from '../../shared/geo.mjs';
import { cityLabel, cityFull, inCountry, cityPath, dataTable } from '../components.mjs';

export function places(ctx) {
  if (ctx.db._places) return ctx.db._places;
  const list = ctx.db.cities.map((c) => ({ id: 'c-' + c.slug, label: cityFull(c), lat: c.lat, lng: c.lng, iso3: c.iso3, city: c }));
  for (const k of ctx.db.countries) if (!k.cities.length && k.capLat != null && k.capital) list.push({ id: 'k-' + k.iso3.toLowerCase(), label: k.capital + ', ' + k.name, lat: k.capLat, lng: k.capLng, iso3: k.iso3 });
  list.sort((a, b) => a.label.localeCompare(b.label));
  ctx.db._places = list; ctx.db._placeById = new Map(list.map((p) => [p.id, p]));
  return list;
}
export const flightDefaults = () => ({ from: 'c-london', to: 'c-lisbon', cabin: 'economy', rt: '1', rf: true });
// Checkbox state is a boolean in the browser but '1' or 'true' when it comes from a shared link or older saved state.
const isOn = (v) => v === true || v === '1' || v === 'true';

export function flightForm(ctx, s) {
  const opts = (v) => places(ctx).map((p) => html`<option value="${p.id}"${p.id === v ? raw(' selected') : ''}>${p.label}</option>`);
  const sel = (a, b) => (a === b ? raw(' selected') : '');
  return html`<form class="panel finder finder--flat" data-form autocomplete="off"><div class="finder__main">
    <div class="field field--wide"><label for="f-from">From</label><select id="f-from" name="from">${opts(s.from)}</select></div>
    <div class="field field--wide"><label for="f-to">To</label><select id="f-to" name="to">${opts(s.to)}</select></div>
    <div class="field"><label for="f-cabin">Cabin</label><select id="f-cabin" name="cabin">${Object.entries(CABINS).map(([k, l]) => html`<option value="${k}"${sel(k, s.cabin)}>${l}</option>`)}</select></div>
    <div class="field"><label for="f-rt">Trip</label><select id="f-rt" name="rt"><option value="1"${sel('1', s.rt)}>Return</option><option value="0"${sel('0', s.rt)}>One way</option></select></div>
    <label class="check"><input type="checkbox" name="rf" value="1"${isOn(s.rf) ? raw(' checked') : ''}> Include non-CO₂ warming effects (radiative forcing)</label>
  </div></form>`;
}

export function flightResults(ctx, s) {
  places(ctx);
  const a = ctx.db._placeById.get(s.from), b = ctx.db._placeById.get(s.to);
  if (!a || !b) return html`<div class="empty"><p>Choose two places.</p></div>`;
  const d = haversine(a.lat, a.lng, b.lat, b.lng);
  const trips = s.rt === '1' ? 2 : 1; const rf = isOn(s.rf);
  const domestic = !!a.iso3 && a.iso3 === b.iso3;
  const est = flightEstimate(d, ctx.db.emissions, { cabin: s.cabin, rf, trips, domestic });
  const cabins = Object.entries(CABINS).map(([k, l]) => [l, flightEstimate(d, ctx.db.emissions, { cabin: k, rf, trips, domestic })]);
  const others = ctx.db.citiesRanked.slice(0, 40).filter((c) => 'c-' + c.slug !== s.from).slice(0, 12).map((c) => { const dd = haversine(a.lat, a.lng, c.lat, c.lng); return { c, dd, e: flightEstimate(dd, ctx.db.emissions, { cabin: s.cabin, rf, trips, domestic: !!a.iso3 && a.iso3 === c.iso3 }) }; }).sort((x, y) => x.dd - y.dd);
  const name = (p) => (p.city ? cityLabel(p.city) : p.label.split(', ')[0]), where = (p) => (p.city ? p.city.country.name : p.label.split(', ').slice(1).join(', '));
  const end = (p, k, cls = '') => html`<div class="routeslip__end${cls}"><span class="routeslip__k">${k}</span><b class="routeslip__city">${name(p)}</b><span class="routeslip__sub">${where(p)} · <span class="mono">${fmtCoord(p.lat, p.lng)}</span></span></div>`;
  return html`<div class="routeslip">
    ${end(a, 'From')}<div class="routeslip__path" aria-hidden="true"><span class="routeslip__plane">${icon('plane')}</span></div>${end(b, 'To', ' routeslip__end--to')}
    <div class="routeslip__stub"><span class="routeslip__k">Distance</span><b>${fmtNum(d)} km</b><span class="routeslip__k">Flight, one way</span><b>≈ ${fmtHours(est.hours * 60 - ((est.hours * 60) % 5))}</b></div>
  </div>
  <div class="flighthead">
    <div><span class="flighthead__n">${fmtNum(est.kg)}</span><span class="flighthead__u">kg CO₂e per passenger, ${trips === 2 ? 'return' : 'one way'}</span></div>
    <dl class="stats stats--compact"><div class="stats__item"><dt>Haul</dt><dd>${est.domestic ? 'Domestic' : est.longHaul ? 'Long-haul' : 'Short-haul'}</dd></div><div class="stats__item"><dt>Trips counted</dt><dd>${trips === 2 ? 'Return (2 flights)' : 'One way'}</dd></div><div class="stats__item"><dt>Factor</dt><dd>${est.factor} kg/pkm</dd></div></dl>
  </div>
  ${d < 50 ? html`<p class="hint">These places are very close; you probably wouldn't fly.</p>` : ''}
  ${est.domestic ? html`<p class="hint">Flights within one country use the domestic factor, an average across all seats, so every cabin class shows the same figure.</p>` : ''}
  ${domestic && est.longHaul ? html`<p class="hint">The domestic factor describes short UK domestic flights, so domestic routes of ${fmtNum(ctx.db.emissions.shortHaulMaxKm)} km or more use the long-haul factors instead.</p>` : ''}
  ${!est.domestic && !est.longHaul ? html`<p class="hint">DESNZ publishes no premium economy or first class factors for short-haul flights, so those rows use the economy and business class factors.</p>` : ''}
  <div class="tablewrap"><table class="table table--compact"><caption>By cabin class, ${trips === 2 ? 'return' : 'one way'}</caption><thead><tr><th scope="col">Cabin</th><th scope="col" class="num">kg CO₂e</th></tr></thead>
  <tbody>${cabins.map(([l, e]) => html`<tr><th scope="row">${l}</th><td class="num">${fmtNum(e.kg)}</td></tr>`)}</tbody></table></div>
  <h3 class="h3gap">From ${a.label} to top-rated cities</h3>
  ${dataTable({ caption: 'Distance and emissions to popular remote-work cities, ' + (trips === 2 ? 'return' : 'one way'), columns: [{ label: 'City' }, { label: 'Distance', num: true }, { label: 'kg CO₂e', num: true }], rows: others.map(({ c, dd, e }) => ({ cells: [html`<a href="${ctx.link(cityPath(c))}">${cityLabel(c)}</a><span class="muted">${inCountry(c)}</span>`, fmtNum(dd) + ' km', fmtNum(e.kg)], sort: [cityLabel(c), Math.round(dd), Math.round(e.kg)] })) })}`;
}
