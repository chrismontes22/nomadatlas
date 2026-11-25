// Theme toggle, dropdown behaviour, sortable tables and chart tooltips.
export function initTheme(root = document) {
  const btn = root.querySelector('[data-theme-toggle]');
  if (!btn || btn.dataset.ready) return; btn.dataset.ready = '1';
  btn.addEventListener('click', () => {
    const d = document.documentElement;
    const dark = d.dataset.theme ? d.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    d.dataset.theme = next;
    try { localStorage.setItem('na-theme', next); } catch { /* ignore */ }
  });
}
export function initDropdowns(root = document) {
  if (document.body.dataset.ddReady) return; document.body.dataset.ddReady = '1';
  document.addEventListener('click', (e) => { for (const d of document.querySelectorAll('details.dropdown[open]')) if (!d.contains(e.target)) d.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') for (const d of document.querySelectorAll('details.dropdown[open]')) { d.open = false; d.querySelector('summary')?.focus(); } });
}
export function initSortable(root = document) {
  for (const table of root.querySelectorAll('table[data-sortable]')) {
    if (table.dataset.ready) continue; table.dataset.ready = '1';
    table.addEventListener('click', (e) => {
      const btn = e.target.closest('.sortbtn'); if (!btn) return;
      const th = btn.closest('th'); const col = +th.dataset.col;
      const dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
      for (const h of table.querySelectorAll('thead th')) h.setAttribute('aria-sort', 'none');
      th.setAttribute('aria-sort', dir);
      const tbody = table.tBodies[0]; const rows = [...tbody.rows];
      const key = (r) => r.cells[col]?.dataset.sort ?? '';
      const numeric = rows.every((r) => key(r) === '' || !Number.isNaN(+key(r)));
      rows.sort((a, b) => {
        const x = key(a), y = key(b);
        if (x === '' && y !== '') return 1; if (y === '' && x !== '') return -1;
        const c = numeric ? +x - +y : x.localeCompare(y);
        return dir === 'ascending' ? c : -c;
      });
      tbody.append(...rows);
    });
  }
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function initCharts(root = document) {
  for (const fig of root.querySelectorAll('figure[data-chart="climate"]')) {
    if (fig.dataset.ready) continue; fig.dataset.ready = '1';
    const data = JSON.parse(fig.querySelector('.chart__data')?.textContent || '{}');
    const tip = fig.querySelector('.chart__tip'); const svg = fig.querySelector('svg');
    const f = (c) => Math.round(c) + '°C (' + Math.round((c * 9) / 5 + 32) + '°F)';
    const show = (rect) => {
      const i = +rect.dataset.i;
      for (const r of svg.querySelectorAll('.ch-hit.is-on')) r.classList.remove('is-on');
      rect.classList.add('is-on');
      tip.innerHTML = '<b>' + MONTHS[i] + '</b>High ' + f(data.hi[i]) + '<br>Low ' + f(data.lo[i]) + '<br>Rain ' + Math.round(data.rain[i]) + ' mm · Humidity ' + Math.round(data.rh[i]) + '%';
      tip.hidden = false;
      const fr = fig.getBoundingClientRect(), rr = rect.getBoundingClientRect();
      let left = rr.left - fr.left + rr.width / 2 - tip.offsetWidth / 2;
      left = Math.max(8, Math.min(fr.width - tip.offsetWidth - 8, left));
      tip.style.left = left + 'px'; tip.style.top = Math.max(4, rr.top - fr.top - 4) + 'px';
    };
    svg.addEventListener('pointerover', (e) => { const r = e.target.closest('.ch-hit'); if (r) show(r); });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; for (const r of svg.querySelectorAll('.ch-hit.is-on')) r.classList.remove('is-on'); });
  }
}
