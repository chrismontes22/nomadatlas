// The "Right now" line in the home-page hero: which atlas cities are in golden hour at this moment, with their local time.
// The page ships with a fixed line ("Somewhere, it is golden hour…") of the same one-line height, so swapping in the live
// text never moves anything else on the page.
import { getCtx } from './ctx.mjs';
import { goldenHour } from '../shared/sun.mjs';
import { esc } from '../render/html.mjs';
import { cityPath, cityLabel } from '../render/components.mjs';

const clocks = new Map();
const clock = (tz, d) => {
  try {
    if (!clocks.has(tz)) clocks.set(tz, new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
    return clocks.get(tz).format(d);
  } catch { return ''; }
};
const link = (ctx, c, d) => '<a href="' + esc(ctx.link(cityPath(c))) + '">' + esc(cityLabel(c)) + '</a> <span class="mono">' + esc(clock(c.tz, d)) + '</span>';
const inMinutes = (m) => (m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''));

function line(ctx) {
  const d = new Date(), g = goldenHour(ctx.db.citiesRanked, d);
  if (g.now.length) {
    // Best-ranked first, one city per country, so a sunset over Spain doesn't fill the line with Spanish cities.
    const seen = new Set(), pick = [];
    for (const c of g.now) { if (seen.has(c.iso3)) continue; seen.add(c.iso3); pick.push(c); if (pick.length === 3) break; }
    return 'Golden hour in ' + pick.map((c) => link(ctx, c, d)).join(' · ');
  }
  if (g.next) return 'Next golden hour: ' + link(ctx, g.next.place, d) + ' in ' + inMinutes(g.next.minutes);
  return null;
}

export async function mountNow(el) {
  if (el.dataset.ready) return; el.dataset.ready = '1';
  const out = el.querySelector('[data-now-text]');
  let ctx;
  try { ctx = await getCtx(); } catch { return; } // keep the fixed line
  const update = () => { if (!el.isConnected) { clearInterval(timer); return; } const s = line(ctx); if (s) { out.innerHTML = s; el.classList.add('is-live'); } };
  const timer = setInterval(() => { if (document.visibilityState === 'visible') update(); }, 60000);
  update();
}
