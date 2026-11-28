import { costDefaults, costAmounts, costResults, step } from '../../render/tools/cost.mjs';
import { CATEGORIES } from '../../shared/cost.mjs';
import { readForm, writeForm, syncUrl, urlState, store, debounce } from '../ctx.mjs';
import { refresh } from './helpers.mjs';

export function mount(el, ctx) {
  const form = el.querySelector('form'), out = el.querySelector('[data-results]');
  const defaults = costDefaults(ctx);
  // Links from city and country pages preselect the destination with #to=ISO3 (a fragment, so every link points at the one
  // canonical calculator URL). It keeps your saved spending and home country.
  const linkTo = /^#to=([A-Z]{3})$/.exec(location.hash)?.[1];
  const saved = store.get('na-cost');
  const initial = (ctx.mode === 'static' && urlState()) || (linkTo ? { ...saved, to: linkTo } : saved);
  if (initial) {
    writeForm(form, initial);
    if (!CATEGORIES.some((c) => c.key in initial)) { const s = readForm(form, defaults); writeForm(form, costAmounts(ctx, s.from, s.life, s.cur)); }
  }
  let prevCur = form.elements.cur.value;
  const render = () => {
    const s = readForm(form, defaults);
    out.innerHTML = costResults(ctx, s).s; refresh(out);
    syncUrl(ctx, s, defaults);
    store.set('na-cost', Object.fromEntries(Object.entries(s).filter(([k, v]) => String(v) !== String(defaults[k]))));
  };
  const deb = debounce(render, 120);
  form.addEventListener('input', deb);
  form.addEventListener('change', (e) => {
    const n = e.target.name; const s = readForm(form, defaults);
    if (n === 'from' || n === 'life') writeForm(form, costAmounts(ctx, s.from, s.life, s.cur));
    if (n === 'cur') {
      const r = ctx.db.rates.rates; const k = (r[s.cur] ?? 1) / (r[prevCur] ?? 1);
      const st = step(s.cur);
      const conv = {}; for (const c of CATEGORIES) conv[c.key] = Math.round(((+s[c.key] || 0) * k) / st) * st;
      writeForm(form, conv); prevCur = s.cur;
    }
    deb();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  if (initial) render();
}
