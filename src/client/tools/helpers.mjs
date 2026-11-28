import { initSortable, initCharts } from '../ui.mjs';
import { readForm, writeForm, syncUrl, urlState, store, debounce } from '../ctx.mjs';
export const refresh = (el) => { initSortable(el); initCharts(el); };
export const navigate = (ctx, path) => { if (ctx.navigate) ctx.navigate(path); else location.href = ctx.link(path); };

/** Generic form + results tool: re-renders results from state on every input. */
export function simpleTool(el, ctx, { key, defaults, render, onState }) {
  const form = el.querySelector('form'), out = el.querySelector('[data-results]');
  if (!form || !out) return;
  let initial = (ctx.mode === 'static' && urlState()) || store.get(key);
  // The HTML was rendered for the build month. Unless a link or saved settings pick a month, show the current one (the default).
  if ('month' in defaults && form.elements.month && !(initial && 'month' in initial) && form.elements.month.value !== String(defaults.month)) initial = { ...initial, month: defaults.month };
  if (initial) writeForm(form, initial);
  const run = () => {
    const s = readForm(form, defaults);
    out.innerHTML = render(s).s;
    refresh(out);
    syncUrl(ctx, s, defaults);
    const diff = Object.fromEntries(Object.entries(s).filter(([k, v]) => String(v) !== String(defaults[k])));
    store.set(key, diff);
    onState?.(s);
  };
  const deb = debounce(run, 100);
  form.addEventListener('input', deb); form.addEventListener('change', deb);
  form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
  if (initial) run();
  return { run, form, out };
}
