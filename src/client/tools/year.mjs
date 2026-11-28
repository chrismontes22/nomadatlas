import { yearDefaults, yearResults, stopRow } from '../../render/tools/year.mjs';
import { sunChaser, parseLegs } from '../../shared/year.mjs';
import { readForm, writeForm, syncUrl, urlState, store, debounce, copyText } from '../ctx.mjs';
import { refresh } from './helpers.mjs';

export function mount(el, ctx) {
  const form = el.querySelector('form'), out = el.querySelector('[data-results]'), list = form.querySelector('[data-stops]');
  const defaults = yearDefaults(ctx);
  let id = list.children.length + 100;
  const rows = () => [...list.querySelectorAll('[data-stop]')];
  const renumber = () => rows().forEach((li, i) => { li.querySelector('label').textContent = 'Stop ' + (i + 1); });
  const setStops = (legs) => { list.innerHTML = legs.map((l, i) => stopRow(ctx, l, id++, i + 1).s).join(''); };
  const legsNow = () => rows().map((li) => li.querySelector('[name="city"]').value + ':' + li.querySelector('[name="months"]').value).join(',');
  const state = () => { const s = readForm(form, defaults); delete s.city; delete s.months; s.legs = legsNow(); return s; };
  const share = el.querySelector('[data-share]');
  if (ctx.mode !== 'static' && share) share.hidden = true;

  // A shared link wins, then this browser's last plan; the page itself shows the default plan.
  const initial = (ctx.mode === 'static' && urlState()) || store.get('na-year');
  let stale = !!initial;
  if (initial) {
    const { legs, ...rest } = initial;
    writeForm(form, rest);
    const parsed = legs ? parseLegs(ctx.db, legs) : [];
    if (parsed.length) setStops(parsed);
  } else if (String(form.elements.year.value) !== String(defaults.year)) { writeForm(form, { year: defaults.year }); stale = true; } // built last year

  const render = () => {
    const s = state();
    out.innerHTML = yearResults(ctx, s).s;
    refresh(out);
    syncUrl(ctx, s, defaults);
    store.set('na-year', Object.fromEntries(Object.entries(s).filter(([k, v]) => String(v) !== String(defaults[k]))));
  };
  const deb = debounce(render, 90);
  form.addEventListener('input', deb); form.addEventListener('change', deb);
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) {
      // A new stop starts at the best-rated city not already in the plan.
      const used = new Set(rows().map((li) => li.querySelector('[name="city"]').value));
      const next = ctx.db.citiesRanked.find((c) => !used.has(c.slug)) || ctx.db.citiesRanked[0];
      if (rows().length >= 8) return;
      list.insertAdjacentHTML('beforeend', stopRow(ctx, { city: next, months: 2 }, id++, rows().length + 1).s);
      list.lastElementChild.querySelector('select').focus();
      render();
    } else if (e.target.closest('[data-remove]')) {
      if (rows().length > 1) { e.target.closest('[data-stop]').remove(); renumber(); render(); }
    } else if (e.target.closest('[data-suggest]')) {
      const s = state();
      const months = rows().map((li) => +li.querySelector('[name="months"]').value);
      const legs = sunChaser(ctx.db, { year: +s.year, start: +s.start, months: months.length ? months : [3, 3, 3, 3], p: s.p, life: s.life });
      if (legs.length) { setStops(legs); render(); out.scrollIntoView?.({ block: 'nearest' }); }
    } else if (e.target.closest('[data-share]')) copyText(location.href, e.target.closest('[data-share]'));
  });
  if (stale) render();
}
