import { createDb } from '../shared/db.mjs';
const V = typeof __DATA_VERSION__ !== 'undefined' ? __DATA_VERSION__ : 'dev';
let ctxPromise = null, mapPromise = null;
const base = () => window.__NA_BASE__ ?? document.documentElement.dataset.base ?? '/';
export const fetchJSON = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error('Could not load ' + u); return r.json(); });
export function setCtx(ctx) { ctxPromise = Promise.resolve(ctx); }
export function getCtx() {
  return (ctxPromise ||= (async () => {
    const [core, visa] = await Promise.all([fetchJSON(base() + 'data/core.json?v=' + V), fetchJSON(base() + 'data/visa.json?v=' + V)]);
    const db = createDb({ ...core, visa });
    const now = new Date();
    return { db, site: { url: location.origin, name: 'NomadAtlas' }, mode: 'static', link: (p) => p, year: now.getFullYear(), buildMonth: now.getMonth(), buildDate: now.toISOString().slice(0, 10) };
  })());
}
export const loadMap = () => (mapPromise ||= fetchJSON(base() + 'data/map.json?v=' + V));
export const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
export const debounce = (fn, ms = 120) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/** Read a form into a flat state object; checkboxes become booleans. */
export function readForm(form, defaults = {}) {
  const s = { ...defaults };
  for (const [k, v] of new FormData(form)) s[k] = v;
  for (const el of form.querySelectorAll('input[type="checkbox"][name]')) s[el.name] = el.checked;
  return s;
}
export function writeForm(form, st) {
  for (const [k, v] of Object.entries(st)) {
    const el = form.elements.namedItem(k);
    if (!el) continue;
    if (el instanceof RadioNodeList) { for (const r of el) r.checked = String(r.value) === String(v); }
    else if (el.type === 'checkbox') el.checked = v === true || v === '1' || v === 'true';
    else el.value = v;
  }
}
/** Non-default state as URL params (static site only). */
export function syncUrl(ctx, s, defaults) {
  if (ctx.mode !== 'static') return;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(s)) { const d = defaults[k]; if (v === undefined || String(v) === String(d) || (v === false && !d)) continue; p.set(k, v === true ? '1' : v); }
  const q = p.toString();
  history.replaceState(history.state, '', location.pathname + (q ? '?' + q : ''));
}
export function urlState() { const p = new URLSearchParams(location.search); return [...p.keys()].length ? Object.fromEntries(p) : null; }
export async function copyText(text, btn) {
  const done = (msg) => { if (!btn) return; const o = btn.textContent; btn.textContent = msg; setTimeout(() => { btn.textContent = o; }, 1800); };
  try { await navigator.clipboard.writeText(text); done('Link copied'); } catch { window.prompt?.('Copy this link', text); done('Copy the link from the address bar'); }
}
