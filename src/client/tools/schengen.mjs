import { schengenResults, tripRow } from '../../render/tools/schengen.mjs';
import { todayISO, toDay } from '../../shared/schengen.mjs';
import { store, debounce } from '../ctx.mjs';

export function mount(el, ctx) {
  const form = el.querySelector('form'), out = el.querySelector('[data-results]'), list = form.querySelector('[data-trips]');
  const note = () => form.querySelector('[data-example-note]');
  const saved = store.get('na-schengen');
  let n = list.children.length;
  if (saved?.trips) {
    list.innerHTML = saved.trips.map((t, i) => tripRow(t, i).s).join('') || tripRow({ entry: '', exit: '' }, 0).s;
    n = list.children.length; note()?.remove();
    if (saved.plan) form.elements.plan.value = saved.plan;
  }
  form.elements.check.value = todayISO();
  const trips = () => [...list.querySelectorAll('[data-trip]')].map((li) => ({ entry: li.querySelector('[name="entry"]').value, exit: li.querySelector('[name="exit"]').value }));
  const render = (save) => {
    for (const li of list.querySelectorAll('[data-trip]')) {
      const a = toDay(li.querySelector('[name="entry"]').value), b = toDay(li.querySelector('[name="exit"]').value);
      li.querySelector('[data-days]').textContent = Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a + 1 + ' d' : '';
    }
    const s = { trips: trips(), check: form.elements.check.value || todayISO(), plan: form.elements.plan.value };
    out.innerHTML = schengenResults(ctx, s).s;
    if (save) { note()?.remove(); store.set('na-schengen', { trips: s.trips, plan: s.plan }); }
  };
  const deb = debounce(() => render(true), 150);
  form.addEventListener('input', deb); form.addEventListener('change', deb);
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) { list.insertAdjacentHTML('beforeend', tripRow({ entry: '', exit: '' }, n++).s); list.lastElementChild.querySelector('input').focus(); }
    else if (e.target.closest('[data-remove]')) { e.target.closest('[data-trip]').remove(); if (!list.children.length) list.insertAdjacentHTML('beforeend', tripRow({ entry: '', exit: '' }, n++).s); render(true); }
    else if (e.target.closest('[data-clear]')) { list.innerHTML = tripRow({ entry: '', exit: '' }, n++).s; render(true); }
  });
  render(false);
}
