import { initTheme, initDropdowns, initSortable, initCharts } from './ui.mjs';
import { getCtx } from './ctx.mjs';

const LOADERS = {
  match: () => import('./tools/match.mjs').then((m) => m.mount),
  visa: () => import('./tools/visa.mjs').then((m) => m.mount),
  visacheck: () => import('./tools/visacheck.mjs').then((m) => m.mount),
  cost: () => import('./tools/cost.mjs').then((m) => m.mount),
  schengen: () => import('./tools/schengen.mjs').then((m) => m.mount),
  timezone: () => import('./tools/simple.mjs').then((m) => m.timezone),
  weather: () => import('./tools/simple.mjs').then((m) => m.weather),
  flight: () => import('./tools/simple.mjs').then((m) => m.flight),
  cityindex: () => import('./tools/simple.mjs').then((m) => m.cityindex),
  countryindex: () => import('./tools/simple.mjs').then((m) => m.countryindex),
};

export async function boot(root = document) {
  initTheme(); initDropdowns(); initSortable(root); initCharts(root);
  const els = [...root.querySelectorAll('[data-tool]')].filter((el) => LOADERS[el.dataset.tool] && !el.dataset.mounted);
  if (!els.length) return;
  let ctx;
  try { ctx = await getCtx(); } catch (e) { console.error(e); return; }
  for (const el of els) {
    el.dataset.mounted = '1';
    try { const mount = await LOADERS[el.dataset.tool](); mount(el, ctx); } catch (e) { console.error('Tool failed:', el.dataset.tool, e); }
  }
}
if (!window.__NA_SPA__) boot();
