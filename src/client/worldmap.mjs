import { loadMap } from './ctx.mjs';
import { project } from '../shared/geo.mjs';

/** Draws the Natural Earth world map into a container. Returns helpers to recolour shapes or place dots. */
export async function drawMap(container, { names = {}, onClick, tooltip } = {}) {
  const map = await loadMap();
  const paths = Object.entries(map.paths).map(([iso, d]) => '<path data-iso="' + iso + '" d="' + d + '"></path>').join('');
  container.innerHTML = '<svg viewBox="0 0 ' + map.w + ' ' + map.h + '" preserveAspectRatio="xMidYMid meet" role="presentation"><g class="shapes">' + paths + '</g><g class="dots"></g></svg><div class="maptip" hidden></div>';
  const svg = container.querySelector('svg'); const tip = container.querySelector('.maptip');
  const move = (e, text) => {
    if (!text) { tip.hidden = true; return; }
    tip.textContent = text; tip.hidden = false;
    const r = container.getBoundingClientRect();
    let x = e.clientX - r.left + 12, y = e.clientY - r.top + 12;
    if (x + tip.offsetWidth > r.width - 4) x = e.clientX - r.left - tip.offsetWidth - 12;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  svg.addEventListener('pointermove', (e) => { const t = e.target.closest('[data-iso],[data-city]'); move(e, t && tooltip ? tooltip(t) : null); });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  svg.addEventListener('click', (e) => { const t = e.target.closest('[data-iso],[data-city]'); if (t && onClick) onClick(t); });
  return {
    map, svg,
    color(fn) { for (const p of svg.querySelectorAll('path[data-iso]')) { p.setAttribute('class', fn(p.dataset.iso) || ''); } },
    dots(list) { svg.querySelector('.dots').innerHTML = list.map((d) => { const [x, y] = project(map.proj, d.lat, d.lng); return '<circle class="dot ' + (d.cls || '') + '" data-city="' + d.id + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (d.r || 3.6) + '"></circle>'; }).join(''); },
  };
}
