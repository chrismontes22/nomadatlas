import { matchDefaults, toQuery, matchFilter, matchResults } from '../../render/tools/match.mjs';
import { rankCities } from '../../shared/scores.mjs';
import { readForm, writeForm, syncUrl, urlState, store, debounce, copyText } from '../ctx.mjs';
import { refresh } from './helpers.mjs';

export function mount(el, ctx) {
  const form = el.querySelector('form'), out = el.querySelector('[data-results]');
  const defaults = matchDefaults(ctx);
  let limit = 12;
  const initial = (ctx.mode === 'static' && urlState()) || store.get('na-match');
  if (initial) writeForm(form, initial);
  else { form.elements.month.value = String(defaults.month); const p = store.get('na-passport'); if (p) form.elements.p1.value = p; }
  const share = el.querySelector('[data-share]');
  if (ctx.mode !== 'static' && share) share.hidden = true;
  const outputs = () => { for (const w of form.querySelectorAll('.weight')) w.querySelector('output').textContent = w.querySelector('input').value; };
  const render = () => {
    const s = readForm(form, defaults);
    const ranked = rankCities(ctx.db, toQuery(s, ctx), matchFilter(s));
    out.innerHTML = matchResults(ctx, ranked, s, { limit }).s;
    refresh(out); outputs();
    syncUrl(ctx, s, defaults);
    store.set('na-match', Object.fromEntries(Object.entries(s).filter(([k, v]) => String(v) !== String(defaults[k]))));
    if (s.p1) store.set('na-passport', s.p1);
  };
  const rerender = debounce(() => { limit = 12; render(); }, 90);
  form.addEventListener('input', rerender); form.addEventListener('change', rerender);
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('reset', () => setTimeout(() => { store.del('na-match'); writeForm(form, defaults); limit = 12; render(); }, 0));
  share?.addEventListener('click', (e) => copyText(location.href, e.currentTarget));
  out.addEventListener('click', (e) => { if (e.target.closest('[data-more]')) { limit += 12; render(); } });
  render();
}
