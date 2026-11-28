// Single-page preview: renders any NomadAtlas page client-side and routes on location.hash (#cities--lisbon).
import { createDb } from '../shared/db.mjs';
import { renderPath, notFoundPage } from '../render/pages/index.mjs';
import { siteHeader, siteFooter } from '../render/layout.mjs';
import { setCtx, fetchJSON } from './ctx.mjs';
import { boot } from './main.mjs';

const V = typeof __DATA_VERSION__ !== 'undefined' ? __DATA_VERSION__ : 'dev';
const toHash = (p) => { const c = p.replace(/[?#].*$/, ''); return c === '/' ? 'home' : c.replace(/^\/|\/$/g, '').replace(/\//g, '--'); };
const toPath = (h) => (!h || h === 'home' ? '/' : '/' + h.replace(/--/g, '/') + '/');

async function start() {
  const main = document.getElementById('main'), head = document.getElementById('na-header'), foot = document.getElementById('na-footer');
  let core, visa;
  try { [core, visa] = await Promise.all([fetchJSON('data/core.json?v=' + V), fetchJSON('data/visa.json?v=' + V)]); }
  catch (e) { main.innerHTML = '<div class="wrap page"><p class="alert alert--bad">The data files could not be loaded. Reload the page to try again.</p></div>'; return; }
  const db = createDb({ ...core, visa });
  const now = new Date();
  const ctx = { db, site: { url: '', name: 'NomadAtlas' }, mode: 'spa', link: (p) => '#' + toHash(p), year: now.getFullYear(), buildMonth: now.getMonth(), buildDate: now.toISOString().slice(0, 10), assets: {} };
  ctx.navigate = (p) => { location.hash = toHash(p); };
  setCtx(ctx);
  foot.innerHTML = siteFooter(ctx).s;
  const show = (path) => {
    let page = null;
    try { page = renderPath(ctx, path); } catch (e) { console.error(e); }
    if (!page) page = notFoundPage(ctx);
    head.innerHTML = siteHeader(ctx, page).s;
    main.innerHTML = page.body.s;
    document.title = page.title.replace(/ \| NomadAtlas$/, '') + ' · NomadAtlas';
    window.scrollTo(0, 0);
    boot(document);
  };
  const route = () => {
    let h = location.hash.slice(1);
    try { h = decodeURIComponent(h); } catch { /* malformed escape: route on the raw hash */ }
    // A plain in-page anchor (an element id that is not a page) scrolls instead of routing.
    const el = h && h !== 'home' ? document.getElementById(h) : null;
    if (el && !renderPath(ctx, toPath(h))) { el.scrollIntoView(); return; }
    show(toPath(h));
  };
  window.addEventListener('hashchange', route);
  route();
}
start();
