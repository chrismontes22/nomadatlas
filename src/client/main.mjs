import { initTheme, initDropdowns, initSortable, initCharts } from './ui.mjs';
import { getCtx, store } from './ctx.mjs';

const LOADERS = {
  match: () => import('./tools/match.mjs').then((m) => m.mount),
  visa: () => import('./tools/visa.mjs').then((m) => m.mount),
  visacheck: () => import('./tools/visacheck.mjs').then((m) => m.mount),
  cost: () => import('./tools/cost.mjs').then((m) => m.mount),
  schengen: () => import('./tools/schengen.mjs').then((m) => m.mount),
  year: () => import('./tools/year.mjs').then((m) => m.mount),
  timezone: () => import('./tools/simple.mjs').then((m) => m.timezone),
  weather: () => import('./tools/simple.mjs').then((m) => m.weather),
  flight: () => import('./tools/simple.mjs').then((m) => m.flight),
  cityindex: () => import('./tools/simple.mjs').then((m) => m.cityindex),
  countryindex: () => import('./tools/simple.mjs').then((m) => m.countryindex),
};

export async function boot(root = document) {
  initTheme(); initDropdowns(); initSortable(root); initCharts(root);
  const globe = root.querySelector('canvas[data-globe]');
  if (globe) import('./globe.mjs').then((m) => m.mountHeroGlobe(globe)).catch((e) => console.error('Globe failed:', e));
  const now = root.querySelector('[data-now]');
  if (now) import('./now.mjs').then((m) => m.mountNow(now)).catch((e) => console.error('Right-now line failed:', e));
  const els = [...root.querySelectorAll('[data-tool]')].filter((el) => LOADERS[el.dataset.tool] && !el.dataset.mounted);
  if (!els.length) return;
  // City and country pages only have the small passport check. Its page is fully rendered already, so the data (about 450 KB
  // before compression) loads when someone reaches for the passport list, or at once if this browser has a saved passport.
  const later = store.get('na-passport') ? [] : els.filter((el) => LAZY.has(el.dataset.tool));
  for (const el of later) {
    const on = ['focusin', 'pointerdown', 'change'];
    const go = () => { for (const t of on) el.removeEventListener(t, go); mountAll([el]); };
    for (const t of on) el.addEventListener(t, go);
  }
  await mountAll(els.filter((el) => !later.includes(el)));
}
const LAZY = new Set(['visacheck']);
async function mountAll(els) {
  els = els.filter((el) => !el.dataset.mounted);
  if (!els.length) return;
  for (const el of els) el.dataset.mounted = '1';
  let ctx;
  try { ctx = await getCtx(); } catch (e) { console.error(e); for (const el of els) delete el.dataset.mounted; return; }
  for (const el of els) {
    try { const mount = await LOADERS[el.dataset.tool](); mount(el, ctx); } catch (e) { console.error('Tool failed:', el.dataset.tool, e); }
  }
}
if (!window.__NA_SPA__) boot();
