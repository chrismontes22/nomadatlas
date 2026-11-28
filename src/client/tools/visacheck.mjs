import { stayLabel, STATUS } from '../../shared/visa.mjs';
import { store } from '../ctx.mjs';
import { html } from '../../render/html.mjs';
export function mount(el, ctx) {
  const sel = el.querySelector('select'), out = el.querySelector('.visacheck__out'); const dest = el.dataset.dest;
  const d = ctx.db.byIso3.get(dest);
  const show = () => {
    const p = sel.value; if (!p) return;
    const c = ctx.db.byIso3.get(p);
    if (p === dest) { out.textContent = 'This is your own country.'; return; }
    const v = ctx.db.visa.get(p, dest);
    const note = !v ? 'No data for this passport.' : v.s === 'free' ? (v.days ? 'You can stay up to ' + v.days + ' days without a visa.' : 'No visa needed.') : v.s === 'voa' ? 'You get a visa at the border, usually for a fee.' : v.s === 'eta' ? 'Apply online for an electronic travel authorisation before you fly.' : v.s === 'evisa' ? 'Apply for an e-visa online before you travel.' : v.s === 'banned' ? 'Entry is currently not permitted.' : 'Apply for a visa at an embassy or consulate before you travel.';
    out.innerHTML = html`<span class="pill pill--${v?.s || 'na'}">${v ? stayLabel(v) : 'No data'}</span> ${c.name} passport to ${d.name}. ${note}`.s;
    store.set('na-passport', p);
  };
  const saved = store.get('na-passport');
  if (sel.value) show();
  else if (saved && [...sel.options].some((o) => o.value === saved)) { sel.value = saved; show(); }
  sel.addEventListener('change', show);
}
