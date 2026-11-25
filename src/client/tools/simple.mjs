import { tzDefaults, tzResults } from '../../render/tools/timezone.mjs';
import { weatherDefaults, weatherResults } from '../../render/tools/weather.mjs';
import { flightDefaults, flightResults } from '../../render/tools/flight.mjs';
import { scoreClass } from '../../shared/scores.mjs';
import { cityPath, cityLabel } from '../../render/components.mjs';
import { simpleTool, navigate } from './helpers.mjs';
import { readForm, debounce } from '../ctx.mjs';
import { drawMap } from '../worldmap.mjs';

export const timezone = (el, ctx) => simpleTool(el, ctx, { key: 'na-tz', defaults: tzDefaults(ctx), render: (s) => tzResults(ctx, s) });
export const weather = (el, ctx) => simpleTool(el, ctx, { key: 'na-weather', defaults: weatherDefaults(ctx), render: (s) => weatherResults(ctx, s) });
export const flight = (el, ctx) => simpleTool(el, ctx, { key: 'na-flight', defaults: flightDefaults(ctx), render: (s) => flightResults(ctx, s) });

function tableFilter(el, onFilter) {
  const form = el.querySelector('form'); const rows = [...el.querySelectorAll('tbody tr')];
  const run = () => {
    const s = readForm(form); const q = (s.q || '').trim().toLowerCase();
    const shown = new Set();
    for (const r of rows) { const ok = (!q || (r.dataset.name || '').includes(q)) && (!s.region || r.dataset.region === s.region); r.hidden = !ok; if (ok) shown.add(r); }
    onFilter?.(s, q);
  };
  form.addEventListener('input', debounce(run, 80)); form.addEventListener('submit', (e) => e.preventDefault());
  return run;
}
export function cityindex(el, ctx) {
  const mapEl = el.querySelector('[data-map]'); let api = null;
  const run = tableFilter(el, (s, q) => {
    if (!api) return;
    for (const d of api.svg.querySelectorAll('circle.dot')) { const c = ctx.db.cityBySlug.get(d.dataset.city); const ok = (!q || (cityLabel(c) + ' ' + c.country.name).toLowerCase().includes(q)) && (!s.region || c.country.region === s.region); d.classList.toggle('is-dim', !ok); }
  });
  drawMap(mapEl, {
    tooltip: (t) => { if (t.dataset.city) { const c = ctx.db.cityBySlug.get(t.dataset.city); return cityLabel(c) + ', ' + c.country.name + ' · score ' + c.score; } return ctx.db.byIso3.get(t.dataset.iso)?.name || null; },
    onClick: (t) => { if (t.dataset.city) navigate(ctx, cityPath(ctx.db.cityBySlug.get(t.dataset.city))); },
  }).then((a) => { api = a; a.dots(ctx.db.citiesRanked.slice().reverse().map((c) => ({ id: c.slug, lat: c.lat, lng: c.lng, cls: 'dot--' + scoreClass(c.score) }))); run(); }).catch(() => { mapEl.hidden = true; });
}
export function countryindex(el) { tableFilter(el); }
