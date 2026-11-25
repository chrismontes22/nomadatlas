import { visaResults, visaSummary } from '../../render/tools/visa.mjs';
import { STATUS, stayLabel } from '../../shared/visa.mjs';
import { countryPath } from '../../render/components.mjs';
import { readForm, writeForm, syncUrl, urlState, store, debounce } from '../ctx.mjs';
import { drawMap } from '../worldmap.mjs';
import { refresh, navigate } from './helpers.mjs';

export function mount(el, ctx) {
  const form = el.querySelector('form'), out = el.querySelector('[data-results]'), sum = el.querySelector('[data-summary]'), mapEl = el.querySelector('[data-map]');
  const db = ctx.db;
  const defaults = { p1: form.elements.p1.value, p2: '', status: '', region: '', q: '' };
  const isIndex = !defaults.p1;
  const initial = (ctx.mode === 'static' && urlState()) || (isIndex && store.get('na-passport') ? { p1: store.get('na-passport') } : null);
  if (initial) writeForm(form, initial);
  let api = null;
  const pps = () => { const s = readForm(form, defaults); return [s.p1, s.p2].filter(Boolean); };
  const paint = () => {
    if (!api) return; const pp = pps();
    api.color((iso) => { if (pp.includes(iso)) return 'v-home'; if (!pp.length || !db.visa.has(iso)) return ''; const v = db.visa.best(pp, iso); return v ? 'v-' + v.s : ''; });
  };
  if (mapEl) drawMap(mapEl, {
    tooltip: (t) => { const c = db.byIso3.get(t.dataset.iso); if (!c) return null; const pp = pps(); if (!pp.length) return c.name; if (pp.includes(c.iso3)) return c.name + ': your passport'; return c.name + ': ' + stayLabel(db.visa.best(pp, c.iso3)); },
    onClick: (t) => { const c = db.byIso3.get(t.dataset.iso); if (c) navigate(ctx, countryPath(c)); },
  }).then((a) => { api = a; paint(); }).catch(() => { mapEl.hidden = true; });
  const render = () => {
    const s = readForm(form, defaults);
    out.innerHTML = visaResults(ctx, s).s; refresh(out);
    if (sum) sum.innerHTML = s.p1 || s.p2 ? visaSummary(ctx, s).s : '';
    paint(); syncUrl(ctx, s, defaults);
    if (s.p1 && isIndex) store.set('na-passport', s.p1);
  };
  const deb = debounce(render, 100);
  form.addEventListener('input', deb); form.addEventListener('change', deb);
  form.addEventListener('submit', (e) => e.preventDefault());
  if (initial) render();
}
