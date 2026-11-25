import { CITIES, MONTHS, CURRENCIES, HOME_BASES, TEAM_TIMEZONES, US_BASELINE_MONTHLY } from './data/cities.js';
import { OPEN_DATASETS, EXCLUDED_DATASETS_AUDIT } from './data/datasets.js';
import {
  PRESETS,
  MAP_WIDTH,
  MAP_HEIGHT,
  GLOBE_OUTLINE,
  GRATICULES,
  WORLD_COUNTRIES,
  projectNaturalEarth,
  estimateMonthlyCost,
  computeTimezoneOverlap,
  scoreCity,
  formatMoney,
  projectGeoArbitrage,
  LIFESTYLE_MULT
} from './data/calculator.js';

const state = {
  activeTab: 'explore',
  currency: 'USD',
  monthlyIncomeUsd: 5500,
  lifestyle: 'comfortable',
  housing: 'studio',
  monthIndex: -1,
  idealTemp: 22,
  teamUtc: -5,
  localStart: 9,
  localEnd: 18,
  minSpeed: 0,
  maxBudget: 5000,
  region: 'All',
  countryIso2: '',
  searchQuery: '',
  visibleCount: 18,
  sortBy: 'composite',
  viewMode: 'cards',
  activePreset: 'balanced',
  weights: { ...PRESETS.balanced.weights },
  advancedOpen: false,
  homeBaseId: 'nyc',
  targetCityId: 'lisbon',
  liquidSavingsUsd: 25000,
  investReturnPct: 7,
  tzTeamUtc: -5,
  tzLocalStart: 9,
  tzLocalEnd: 18,
  tzRegion: 'All',
  tzSearch: '',
  tzShowAll: false,
  itinerary: [
    'chiang-mai', 'chiang-mai', 'tokyo',
    'lisbon', 'porto', 'split',
    'tallinn', 'prague', 'barcelona',
    'medellin', 'oaxaca', 'mexico-city'
  ],
  selectedCityId: null
};

const $ = (id) => document.getElementById(id);

function readUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('tab')) state.activeTab = params.get('tab');
  if (params.has('income')) state.monthlyIncomeUsd = Math.max(1500, Math.min(20000, Number(params.get('income')) || 5500));
  if (params.has('city')) state.selectedCityId = params.get('city');
  if (params.has('target')) state.targetCityId = params.get('target');
  if (params.has('cur') && CURRENCIES[params.get('cur')]) state.currency = params.get('cur');
}

function updateSeoState() {
  const titles = {
    explore: `Meridian Nomad Atlas — ${CITIES.length}-City Digital Nomad Cost, Weather & Map Calculator`,
    budget: 'Digital Nomad Cost of Living & 5-Year Savings Calculator — Meridian Atlas',
    timezones: 'Remote Work Time Zone Overlap Calculator — Meridian Atlas',
    planner: '12-Month Digital Nomad Trip & 183-Day Stay Planner — Meridian Atlas',
    provenance: 'Free Commercial Open Datasets (CC BY / CC0 / Public Domain) & SEO — Meridian Atlas'
  };
  if (state.selectedCityId) {
    const c = CITIES.find((x) => x.id === state.selectedCityId);
    if (c) {
      document.title = `${c.city}, ${c.country} Cost of Living, Internet & Weather — Meridian Atlas`;
      return;
    }
  }
  document.title = titles[state.activeTab] || titles.explore;
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.mode-tab').forEach((btn) => {
    btn.setAttribute('aria-selected', btn.dataset.tab === tabId ? 'true' : 'false');
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `panel-${tabId}`);
  });
  updateSeoState();
  renderCurrentTab();
}

function getScoredCities() {
  return CITIES.map((city) =>
    scoreCity(city, {
      monthlyIncomeUsd: state.monthlyIncomeUsd,
      lifestyle: state.lifestyle,
      housing: state.housing,
      monthIndex: state.monthIndex,
      idealTemp: state.idealTemp,
      teamUtc: state.teamUtc,
      localStart: state.localStart,
      localEnd: state.localEnd,
      weights: state.weights
    })
  );
}

function renderScoreRing(score, size = 54) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = ((score / 100) * circ).toFixed(1);
  const color = score >= 70 ? '#0f5c52' : score >= 58 ? '#9b6c16' : '#b95730';
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#e8e2d6" stroke-width="5" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="5"
        stroke-linecap="round" stroke-dasharray="${dash} ${circ.toFixed(1)}"
        transform="rotate(-90 ${size / 2} ${size / 2})" />
      <text x="${size / 2}" y="${size / 2 + 5}" text-anchor="middle" font-family="JetBrains Mono, monospace"
        font-size="14" font-weight="700" fill="#161b1d">${score}</text>
    </svg>`;
}

function renderTempSparkline(temps, activeMonth) {
  const w = 130, h = 26, pad = 4;
  const minT = Math.min(...temps, 5), maxT = Math.max(...temps, 28);
  const span = Math.max(8, maxT - minT);
  const pts = temps.map((t, i) => [
    pad + (i / 11) * (w - pad * 2),
    pad + (1 - (t - minT) / span) * (h - pad * 2)
  ]);
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const dot = activeMonth >= 0
    ? `<circle cx="${pts[activeMonth][0].toFixed(1)}" cy="${pts[activeMonth][1].toFixed(1)}" r="3.4" fill="#0f5c52" stroke="#fff" stroke-width="1.4" />`
    : '';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${path}" fill="none" stroke="#b95730" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />${dot}</svg>`;
}

/* ==================== NATURAL EARTH INTERACTIVE WORLD MAP ==================== */
function renderWorldMap(allScored, filteredList) {
  const countriesWithCities = new Set(allScored.map((x) => x.city.iso2));
  const grats = GRATICULES.map((d) => `<path d="${d}" fill="none" stroke="#e2dccd" stroke-width="0.65" stroke-dasharray="2.5 3.5" />`).join('');

  const countryPaths = WORLD_COUNTRIES.map((c) => {
    const has = countriesWithCities.has(c.iso2);
    const sel = state.countryIso2 && state.countryIso2 === c.iso2;
    const cls = `country-shape${has ? ' has-cities' : ''}${sel ? ' selected' : ''}`;
    return `<path class="${cls}" data-country-iso="${c.iso2}" data-country-name="${c.name}" d="${c.d}" />`;
  }).join('');

  const top5Ids = new Set(filteredList.slice(0, 5).map((x) => x.city.id));
  const pins = [...filteredList].reverse().map((item) => {
    const [x, y] = projectNaturalEarth(item.city.lon, item.city.lat);
    const isTop = top5Ids.has(item.city.id);
    const color = item.composite >= 70 ? '#0f5c52' : item.composite >= 60 ? '#9b6c16' : '#b95730';
    return `
      <g class="map-pin" data-map-city="${item.city.id}" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})" role="button" tabindex="0" aria-label="${item.city.city}: match ${item.composite}">
        ${isTop ? `<circle r="8.5" fill="${color}" opacity="0.22" />` : ''}
        <circle class="pin-core" r="${isTop ? 4.8 : 3.2}" fill="${color}" stroke="#ffffff" stroke-width="${isTop ? 1.5 : 0.9}" />
      </g>`;
  }).join('');

  $('world-map-stage').innerHTML = `
    <svg class="world-svg" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" role="img" aria-label="Natural Earth world map showing ${filteredList.length} digital nomad cities">
      <path d="${GLOBE_OUTLINE}" fill="#edf4f3" stroke="#d5d0c3" stroke-width="1" />
      ${grats}
      ${countryPaths}
      ${pins}
    </svg>`;

  const tip = $('map-tooltip');
  const stage = $('world-map-panel');

  // Country hover & click-to-filter
  $('world-map-stage').querySelectorAll('.country-shape.has-cities').forEach((el) => {
    const iso = el.dataset.countryIso;
    const name = el.dataset.countryName;
    const count = allScored.filter((x) => x.city.iso2 === iso).length;

    const showCountryTip = (ev) => {
      tip.innerHTML = `
        <div style="font-weight:700;">${name}</div>
        <div style="color:var(--ink-secondary);margin-top:2px;">${count} ${count === 1 ? 'city' : 'cities'} tracked</div>
        <div style="font-size:11px;color:var(--accent);margin-top:3px;">Click country to filter</div>`;
      const rect = stage.getBoundingClientRect();
      tip.style.left = `${Math.min(rect.width - 195, Math.max(10, ev.clientX - rect.left + 12))}px`;
      tip.style.top = `${Math.max(10, ev.clientY - rect.top - 64)}px`;
      tip.classList.add('show');
    };
    el.addEventListener('mouseenter', showCountryTip);
    el.addEventListener('mousemove', showCountryTip);
    el.addEventListener('mouseleave', () => tip.classList.remove('show'));
    el.addEventListener('click', () => {
      state.countryIso2 = state.countryIso2 === iso ? '' : iso;
      state.visibleCount = 18;
      renderExplore();
    });
  });

  // City pin hover & click-to-open dossier
  $('world-map-stage').querySelectorAll('[data-map-city]').forEach((el) => {
    const item = filteredList.find((x) => x.city.id === el.dataset.mapCity);
    if (!item) return;

    const showTip = (ev) => {
      ev.stopPropagation();
      tip.innerHTML = `
        <div style="font-weight:700;font-size:13.5px;">${item.city.city}, ${item.city.country}</div>
        <div style="color:var(--accent);font-weight:700;margin:2px 0;">Match ${item.composite}/100 · ${item.fitLabel}</div>
        <div style="color:var(--ink-secondary);">${formatMoney(item.monthlyCost, state.currency)}/mo · ${item.city.dlMbps} Mbps · ${item.climate.tempC}°C</div>
        <div style="font-size:11px;color:var(--ink-muted);margin-top:3px;">Click dot for full city guide</div>`;
      const rect = stage.getBoundingClientRect();
      tip.style.left = `${Math.min(rect.width - 205, Math.max(10, ev.clientX - rect.left + 12))}px`;
      tip.style.top = `${Math.max(10, ev.clientY - rect.top - 78)}px`;
      tip.classList.add('show');
    };

    el.addEventListener('mouseenter', showTip);
    el.addEventListener('mousemove', showTip);
    el.addEventListener('mouseleave', () => tip.classList.remove('show'));
    el.addEventListener('click', (ev) => { ev.stopPropagation(); openDossier(item.city.id); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDossier(item.city.id); } });
  });
}

/* ==================== TAB 1: CITY FINDER ==================== */
function renderExplore() {
  const allScored = getScoredCities();
  const q = state.searchQuery.trim().toLowerCase();

  const filtered = allScored.filter((item) => {
    if (state.region !== 'All' && item.city.region !== state.region) return false;
    if (state.countryIso2 && item.city.iso2 !== state.countryIso2) return false;
    if (item.city.dlMbps < state.minSpeed) return false;
    if (item.monthlyCost > state.maxBudget) return false;
    if (q) {
      const hay = `${item.city.city} ${item.city.country} ${item.city.region} ${item.city.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (state.sortBy === 'cost') return a.monthlyCost - b.monthlyCost;
    if (state.sortBy === 'internet') return b.city.dlMbps - a.city.dlMbps;
    if (state.sortBy === 'climate') return b.climate.score - a.climate.score;
    if (state.sortBy === 'stability') return b.scores.stability - a.scores.stability;
    if (state.sortBy === 'timezone') return b.tz.hours - a.tz.hours;
    return b.composite - a.composite;
  });

  renderWorldMap(allScored, filtered);

  // Active country badge if filtered on map
  if (state.countryIso2) {
    const cName = CITIES.find((x) => x.iso2 === state.countryIso2)?.country || state.countryIso2;
    $('active-country-badge').innerHTML = `
      <span class="country-pill">
        Country: ${cName} (${filtered.length})
        <button type="button" id="clear-country-btn" style="border:0;background:transparent;font-weight:700;padding:0 2px;" aria-label="Clear country filter">&times;</button>
      </span>`;
    $('clear-country-btn').addEventListener('click', () => { state.countryIso2 = ''; renderExplore(); });
  } else {
    $('active-country-badge').innerHTML = '';
  }

  const top = filtered[0];
  const maxSavingsCity = [...filtered].sort((a, b) => b.monthlySavings - a.monthlySavings)[0];
  const fastestCity = [...filtered].sort((a, b) => b.city.dlMbps - a.city.dlMbps)[0];
  const avgCost = filtered.length ? Math.round(filtered.reduce((s, x) => s + x.monthlyCost, 0) / filtered.length) : 0;

  $('explore-kpis').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Best Overall Match</div>
      <div class="kpi-value">${top ? top.city.city : '—'}</div>
      <div class="kpi-note">${top ? `${top.composite}/100 · Est. ${formatMoney(top.monthlyCost, state.currency)}/mo` : 'Try relaxing a filter'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Most Money Left Over</div>
      <div class="kpi-value">${maxSavingsCity ? formatMoney(maxSavingsCity.monthlySavings, state.currency) : '—'}</div>
      <div class="kpi-note">${maxSavingsCity ? `${maxSavingsCity.city.city} (saves ${maxSavingsCity.savingsRate}%)` : '—'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Fastest Internet</div>
      <div class="kpi-value">${fastestCity ? `${fastestCity.city.dlMbps} Mbps` : '—'}</div>
      <div class="kpi-note">${fastestCity ? `${fastestCity.city.city} · ${fastestCity.city.latencyMs}ms delay` : '—'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Matching Cities (${filtered.length}/${CITIES.length})</div>
      <div class="kpi-value">${formatMoney(avgCost, state.currency)}</div>
      <div class="kpi-note">Average monthly living cost</div>
    </div>
  `;

  const container = $('explore-results');
  if (!filtered.length) {
    container.innerHTML = `
      <div class="panel" style="text-align:center; padding:42px 24px;">
        <h3 class="panel-title">No cities match your current filters</h3>
        <p class="panel-subtitle">Try clearing the search box, clicking the selected country again, or raising your max monthly cost.</p>
      </div>`;
    return;
  }

  const slice = state.viewMode === 'table' ? filtered : filtered.slice(0, state.visibleCount);

  if (state.viewMode === 'table') {
    container.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th><th>City</th><th>Match</th><th>Est. Cost/mo</th><th>Left Over/mo</th>
              <th>Internet</th><th>Weather</th><th>Safety</th><th>Team Calls</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${slice.map((item, idx) => `
              <tr data-city="${item.city.id}" style="cursor:pointer;">
                <td class="num">${idx + 1}</td>
                <td><strong>${item.city.city}</strong><br><span style="font-size:12px;color:var(--ink-muted);">${item.city.country}</span></td>
                <td class="num"><strong>${item.composite}</strong>/100</td>
                <td class="num">${formatMoney(item.monthlyCost, state.currency)}</td>
                <td class="num" style="color:${item.monthlySavings >= 0 ? 'var(--accent)' : 'var(--danger)'};">${formatMoney(item.monthlySavings, state.currency)}</td>
                <td class="num">${item.city.dlMbps} Mbps</td>
                <td><span class="num">${item.climate.tempC}°C</span> <span style="font-size:12px;color:var(--ink-muted);">· ${item.climate.summary.split(' · ')[0]}</span></td>
                <td>${item.safetyVerdict}</td>
                <td class="num">${item.tz.hours}h · ${item.tz.tier}</td>
                <td><button type="button" class="btn btn-outline btn-sm">Details</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } else {
    const remaining = filtered.length - slice.length;
    container.innerHTML = `
      <div class="city-grid">
        ${slice.map((item, idx) => `
          <article class="city-card" data-city="${item.city.id}" tabindex="0" aria-label="Open guide for ${item.city.city}">
            <div class="city-card-head">
              <div>
                <div class="city-rank">#${idx + 1} · ${item.city.region}</div>
                <h3 class="city-name">${item.city.city}</h3>
                <div class="city-country">${item.city.country} · ${item.city.tags[0]}</div>
              </div>
              <div class="ring-wrap">
                ${renderScoreRing(item.composite)}
                <span class="ring-label">${item.fitLabel}</span>
              </div>
            </div>

            <div class="city-highlights">
              <div>
                <div class="hl-label">Monthly Cost</div>
                <div class="hl-val">${formatMoney(item.monthlyCost, state.currency)}</div>
                <div class="hl-hint">${item.monthlySavings >= 0 ? `Keep ${formatMoney(item.monthlySavings, state.currency)}/mo` : 'Over current income'}</div>
              </div>
              <div>
                <div class="hl-label">Internet Speed</div>
                <div class="hl-val">${item.city.dlMbps} Mbps</div>
                <div class="hl-hint">${item.city.latencyMs}ms · ${item.internetVerdict.split(' · ')[0]}</div>
              </div>
              <div>
                <div class="hl-label">${state.monthIndex >= 0 ? MONTHS[state.monthIndex] : 'Avg'} Weather</div>
                <div class="hl-val">${item.climate.tempC}°C</div>
                <div class="hl-hint">${item.climate.summary}</div>
              </div>
              <div>
                <div class="hl-label">Team Overlap</div>
                <div class="hl-val">${item.tz.hours} hrs/day</div>
                <div class="hl-hint">${item.tz.tier}</div>
              </div>
            </div>

            <div class="spark-row">
              <div>
                <div class="spark-meta">12-mo temp (${Math.round(Math.min(...item.city.tempC))}°–${Math.round(Math.max(...item.city.tempC))}°C)</div>
                <div style="font-size:12px;color:var(--ink-secondary);margin-top:2px;">Safety: <strong>${item.safetyVerdict}</strong></div>
              </div>
              ${renderTempSparkline(item.city.tempC, state.monthIndex)}
            </div>

            <div class="city-card-foot">
              <span class="savings-pill ${item.monthlySavings < 0 ? 'negative' : ''}">
                ${item.monthlySavings >= 0 ? `Save ${item.savingsRate}%` : `${item.savingsRate}% deficit`}
              </span>
              <a href="cities/${item.city.slug}.html" onclick="event.stopPropagation();" style="font-weight:600;">Full City Guide →</a>
            </div>
          </article>`).join('')}
      </div>
      ${remaining > 0 ? `
        <div style="display:flex;justify-content:center;gap:10px;margin-top:22px;flex-wrap:wrap;">
          <button type="button" id="load-more-btn" class="btn btn-primary">Show ${Math.min(18, remaining)} More Cities (${remaining} left)</button>
          <button type="button" id="show-all-btn" class="btn btn-outline">Show All ${filtered.length}</button>
        </div>` : ''}`;

    $('load-more-btn')?.addEventListener('click', () => { state.visibleCount += 18; renderExplore(); });
    $('show-all-btn')?.addEventListener('click', () => { state.visibleCount = filtered.length; renderExplore(); });
  }

  container.querySelectorAll('[data-city]').forEach((el) => {
    el.addEventListener('click', () => openDossier(el.dataset.city));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDossier(el.dataset.city); } });
  });
}

/* ==================== CITY GUIDE DRAWER ==================== */
function openDossier(cityId) {
  const city = CITIES.find((c) => c.id === cityId);
  if (!city) return;
  state.selectedCityId = cityId;
  updateSeoState();

  const res = scoreCity(city, {
    monthlyIncomeUsd: state.monthlyIncomeUsd,
    lifestyle: state.lifestyle,
    housing: state.housing,
    monthIndex: state.monthIndex,
    idealTemp: state.idealTemp,
    teamUtc: state.teamUtc,
    localStart: state.localStart,
    localEnd: state.localEnd,
    weights: state.weights
  });

  $('drawer-title').textContent = `${city.city}, ${city.country}`;
  $('drawer-subtitle').textContent = `${city.region} · ${city.tz} · Pop. ${city.population.toLocaleString('en-US')} · Elev. ${city.elevationM}m`;

  const b = res.breakdown;
  const maxTemp = Math.max(...city.tempC, 30), minTemp = Math.min(...city.tempC, 0);
  const tempSpan = Math.max(10, maxTemp - minTemp);
  const w = 480, h = 152, padL = 26, padR = 14, padT = 20, padB = 26;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const maxRain = Math.max(...city.rainMm, 120);

  const points = city.tempC.map((t, i) => `${(padL + (i / 11) * plotW).toFixed(1)},${(padT + (1 - (t - minTemp) / tempSpan) * plotH).toFixed(1)}`).join(' ');
  const rainBars = city.rainMm.map((r, i) => {
    const x = padL + (i / 11) * plotW - 8;
    const bh = (r / maxRain) * (plotH * 0.65);
    return `<rect x="${x.toFixed(1)}" y="${(padT + plotH - bh).toFixed(1)}" width="16" height="${bh.toFixed(1)}" rx="2.5" fill="#d3e6e2" />`;
  }).join('');
  const tempDots = city.tempC.map((t, i) => {
    const x = padL + (i / 11) * plotW, y = padT + (1 - (t - minTemp) / tempSpan) * plotH;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="#b95730" />
      <text x="${x.toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle" font-size="9.5" font-family="JetBrains Mono, monospace" fill="#161b1d">${Math.round(t)}°</text>
      <text x="${x.toFixed(1)}" y="${h - 6}" text-anchor="middle" font-size="10" fill="#6c757b">${MONTHS[i]}</text>`;
  }).join('');

  $('drawer-body').innerHTML = `
    <p style="margin:0;color:var(--ink-secondary);font-size:15px;">${city.summary}</p>
    <div class="comparison-cards" style="margin-bottom:0;">
      <div class="stat-tile"><div class="hl-label">Match Score</div><div class="kpi-value" style="color:var(--accent);">${res.composite}/100</div><div class="hl-hint">${res.fitLabel}</div></div>
      <div class="stat-tile"><div class="hl-label">Est. Monthly Cost</div><div class="kpi-value">${formatMoney(res.monthlyCost, state.currency)}</div><div class="hl-hint">${state.lifestyle} · ${state.housing}</div></div>
      <div class="stat-tile"><div class="hl-label">Monthly Savings</div><div class="kpi-value" style="color:${res.monthlySavings >= 0 ? 'var(--accent)' : 'var(--danger)'};">${formatMoney(res.monthlySavings, state.currency)}</div><div class="hl-hint">${res.savingsRate}% of your pay</div></div>
    </div>

    <div>
      <h4 style="margin:0 0 6px;font-size:14.5px;">Year-Round Weather <span style="font-weight:400;color:var(--ink-muted);">(Live NASA POWER 30-yr averages)</span></h4>
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;background:var(--surface-raised);border:1px solid var(--border);border-radius:10px;">${rainBars}<polyline fill="none" stroke="#b95730" stroke-width="2.3" points="${points}" />${tempDots}</svg>
    </div>

    <div>
      <h4 style="margin:0 0 6px;font-size:14.5px;">Estimated Monthly Budget Breakdown</h4>
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr><td>Rent &amp; Utilities (${state.housing})</td><td class="num" style="text-align:right;">${formatMoney(b.housing, state.currency)}</td></tr>
            <tr><td>Groceries &amp; Eating Out</td><td class="num" style="text-align:right;">${formatMoney(b.food, state.currency)}</td></tr>
            <tr><td>Coworking / Café Desk</td><td class="num" style="text-align:right;">${formatMoney(b.coworking, state.currency)}</td></tr>
            <tr><td>Getting Around Locally</td><td class="num" style="text-align:right;">${formatMoney(b.transit, state.currency)}</td></tr>
            <tr><td>Health Insurance &amp; Care</td><td class="num" style="text-align:right;">${formatMoney(b.health, state.currency)}</td></tr>
            <tr><td>Fun, Gym &amp; Everyday Extras</td><td class="num" style="text-align:right;">${formatMoney(b.misc, state.currency)}</td></tr>
            <tr><td><strong>Total Estimated Monthly Budget</strong></td><td class="num" style="text-align:right;"><strong>${formatMoney(res.monthlyCost, state.currency)}</strong></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div>
      <h4 style="margin:0 0 8px;font-size:14.5px;">Day-to-Day Remote Work Reality</h4>
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr><td>Internet Speed (M-Lab CC0)</td><td style="text-align:right;"><strong>${city.dlMbps} Mbps</strong> down · ${city.ulMbps} up · ${city.latencyMs}ms</td></tr>
            <tr><td>Video Call Verdict</td><td style="text-align:right;font-weight:600;color:var(--accent);">${res.internetVerdict}</td></tr>
            <tr><td>Team Work Overlap</td><td style="text-align:right;"><strong>${res.tz.hours} hrs/day</strong> (${res.tz.localWindow})</td></tr>
            <tr><td>Safety &amp; Stability (World Bank)</td><td style="text-align:right;">${res.safetyVerdict} (${res.scores.stability}/100)</td></tr>
            <tr><td>Air Quality &amp; Health</td><td style="text-align:right;">PM2.5: ${city.pm25} µg/m³ · Life exp. ${city.lifeExpectancy} yrs</td></tr>
            <tr><td>Annual Price Inflation</td><td style="text-align:right;">${city.cpiInflation}% / yr</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="alert-banner" style="margin-bottom:0;">
      <strong>Visa &amp; Stay Info:</strong> ${city.visaSummary}
      ${city.schengen ? ' · <em>Counts toward the Europe 90-day Schengen tourist cap unless you hold a visa.</em>' : ''}
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <button type="button" class="btn btn-primary" id="dossier-compare-btn">Compare Savings vs. Home</button>
      <a href="cities/${city.slug}.html" class="btn btn-outline">Open Full City Page</a>
    </div>
  `;

  $('dossier-compare-btn').addEventListener('click', () => {
    state.targetCityId = city.id;
    $('target-city-select').value = city.id;
    closeDossier();
    switchTab('budget');
  });

  $('drawer-backdrop').classList.add('open');
  $('city-drawer').classList.add('open');
}

function closeDossier() {
  state.selectedCityId = null;
  $('drawer-backdrop').classList.remove('open');
  $('city-drawer').classList.remove('open');
  updateSeoState();
}

/* ==================== TAB 2: COST & SAVINGS ==================== */
function renderBudget() {
  const home = HOME_BASES.find((h) => h.id === state.homeBaseId) || HOME_BASES[1];
  const target = CITIES.find((c) => c.id === state.targetCityId) || CITIES[0];
  const homeName = home.label.split(',')[0];

  const homeMonthly = Math.round(US_BASELINE_MONTHLY * home.pppRatio * home.urbanFactor * (LIFESTYLE_MULT[state.lifestyle] || 1));
  const targetMonthly = estimateMonthlyCost(target, state.lifestyle, state.housing).total;

  const monthlyDiff = homeMonthly - targetMonthly;
  const pctCheaper = Math.round(((homeMonthly - targetMonthly) / homeMonthly) * 100);
  const equivIncome = Math.round(state.monthlyIncomeUsd * (targetMonthly / homeMonthly));
  const homeRunway = Math.round((state.liquidSavingsUsd / homeMonthly) * 10) / 10;
  const targetRunway = Math.round((state.liquidSavingsUsd / targetMonthly) * 10) / 10;

  const projTarget = projectGeoArbitrage(state.monthlyIncomeUsd, targetMonthly, target.cpiInflation, state.investReturnPct, 5);
  const projHome = projectGeoArbitrage(state.monthlyIncomeUsd, homeMonthly, 2.8, state.investReturnPct, 5);
  const fiveYearDelta = projTarget.finalPortfolio - projHome.finalPortfolio;

  const topRunway = CITIES.map((c) => {
    const cost = estimateMonthlyCost(c, state.lifestyle, state.housing).total;
    return { c, cost, mos: Math.round((state.liquidSavingsUsd / cost) * 10) / 10 };
  }).sort((a, b) => b.mos - a.mos);

  const displayRunway = topRunway.slice(0, 12);
  if (!displayRunway.some((x) => x.c.id === target.id)) {
    const tRow = topRunway.find((x) => x.c.id === target.id);
    if (tRow) displayRunway.push(tRow);
  }
  const maxMos = displayRunway[0]?.mos || 1;

  $('budget-summary').innerHTML = `
    <div class="comparison-cards">
      <div class="stat-tile">
        <div class="kpi-label">Cost Difference vs. ${homeName}</div>
        <div class="kpi-value" style="color:${monthlyDiff >= 0 ? 'var(--accent)' : 'var(--warm)'};">${monthlyDiff >= 0 ? `${pctCheaper}% less` : `${Math.abs(pctCheaper)}% more`}</div>
        <div class="kpi-note">${formatMoney(Math.abs(monthlyDiff), state.currency)}/mo ${monthlyDiff >= 0 ? 'saved every month' : 'extra per month'}</div>
      </div>
      <div class="stat-tile">
        <div class="kpi-label">Same Lifestyle Costs</div>
        <div class="kpi-value">${formatMoney(equivIncome, state.currency)}/mo</div>
        <div class="kpi-note">Feels like earning ${formatMoney(state.monthlyIncomeUsd, state.currency)} in ${homeName}</div>
      </div>
      <div class="stat-tile">
        <div class="kpi-label">Extra 5-Year Wealth</div>
        <div class="kpi-value" style="color:${fiveYearDelta >= 0 ? 'var(--accent)' : 'var(--warm)'};">${fiveYearDelta >= 0 ? '+' : ''}${formatMoney(fiveYearDelta, state.currency)}</div>
        <div class="kpi-note">If you invest leftover pay at ${state.investReturnPct}%/yr</div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:18px;">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">5-Year Savings Growth: ${target.city} vs. ${homeName}</h3>
          <p class="panel-subtitle">Accounts for World Bank inflation (${target.cpiInflation}%/yr local CPI) and annual compounding.</p>
        </div>
      </div>
      ${renderFiveYearChart(projTarget.yearly, projHome.yearly, target.city, homeName)}
    </div>

    <div class="panel">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">How Long Your Cash Savings Last ("Runway")</h3>
          <p class="panel-subtitle">${formatMoney(state.liquidSavingsUsd, state.currency)} covers <strong>${targetRunway} months</strong> in ${target.city} vs. <strong>${homeRunway} months</strong> in ${homeName} (showing top 12 longest-runway hubs + your target).</p>
        </div>
      </div>
      <div>
        ${displayRunway.map((row) => {
          const pct = Math.min(100, Math.round((row.mos / maxMos) * 100));
          const highlight = row.c.id === target.id;
          return `
            <div class="runway-row">
              <div><strong style="${highlight ? 'color:var(--accent);' : ''}">${row.c.city}</strong><div style="font-size:12px;color:var(--ink-muted);">${row.c.country} · ${formatMoney(row.cost, state.currency)}/mo</div></div>
              <div class="runway-bar-bg"><div class="runway-bar-fg" style="width:${pct}%;background:${highlight ? 'var(--warm)' : 'var(--accent)'};"></div></div>
              <div class="num" style="text-align:right;font-weight:600;">${row.mos} mos</div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function renderFiveYearChart(targetSeries, homeSeries, targetLabel, homeLabel) {
  const maxVal = Math.max(...targetSeries.map((d) => d.portfolio), ...homeSeries.map((d) => d.portfolio), 10000);
  const w = 640, h = 195, padL = 62, padR = 20, padT = 22, padB = 34;
  const plotW = w - padL - padR, plotH = h - padT - padB, groupW = plotW / 5;
  const bars = targetSeries.map((t, i) => {
    const hm = homeSeries[i];
    const x = padL + i * groupW + groupW * 0.16, bw = groupW * 0.3;
    const th = (t.portfolio / maxVal) * plotH, hh = (hm.portfolio / maxVal) * plotH;
    return `
      <rect x="${x.toFixed(1)}" y="${(padT + plotH - th).toFixed(1)}" width="${bw.toFixed(1)}" height="${th.toFixed(1)}" rx="4" fill="#0f5c52" />
      <rect x="${(x + bw + 5).toFixed(1)}" y="${(padT + plotH - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="4" fill="#cbc3b2" />
      <text x="${(x + bw).toFixed(1)}" y="${h - 10}" text-anchor="middle" font-size="11.5" fill="#485258">Year ${t.year}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${(padT + plotH - th - 6).toFixed(1)}" text-anchor="middle" font-size="10" font-family="JetBrains Mono, monospace" fill="#0f5c52">${formatMoney(t.portfolio, state.currency)}</text>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;">
      <line x1="${padL}" y1="${padT + plotH}" x2="${w - padR}" y2="${padT + plotH}" stroke="#e3ddd0" />
      <text x="${padL - 8}" y="${padT + 8}" text-anchor="end" font-size="10.5" font-family="JetBrains Mono, monospace" fill="#6c757b">${formatMoney(maxVal, state.currency)}</text>
      <text x="${padL - 8}" y="${padT + plotH}" text-anchor="end" font-size="10.5" font-family="JetBrains Mono, monospace" fill="#6c757b">0</text>
      ${bars}
    </svg>
    <div style="display:flex;gap:18px;font-size:13px;margin-top:8px;color:var(--ink-secondary);flex-wrap:wrap;">
      <span><span style="display:inline-block;width:11px;height:11px;background:#0f5c52;border-radius:3px;margin-right:6px;"></span>Living in ${targetLabel}: <strong>${formatMoney(targetSeries[4].portfolio, state.currency)}</strong></span>
      <span><span style="display:inline-block;width:11px;height:11px;background:#cbc3b2;border-radius:3px;margin-right:6px;"></span>Staying in ${homeLabel}: <strong>${formatMoney(homeSeries[4].portfolio, state.currency)}</strong></span>
    </div>`;
}

/* ==================== TAB 3: WORK HOURS & TIME ZONES ==================== */
function renderTimezones() {
  const q = state.tzSearch.trim().toLowerCase();
  const cities = CITIES.filter((c) => {
    if (state.tzRegion !== 'All' && c.region !== state.tzRegion) return false;
    if (q && !`${c.city} ${c.country} ${c.tz}`.toLowerCase().includes(q)) return false;
    return true;
  })
    .map((city) => ({
      city,
      overlap: computeTimezoneOverlap(city.utcStd, state.tzTeamUtc, state.tzLocalStart, state.tzLocalEnd, 9, 17)
    }))
    .sort((a, b) => b.overlap.hours - a.overlap.hours);

  const visible = state.tzShowAll ? cities : cities.slice(0, 24);
  const isInWindow = (hour, start, end) => { const h = ((hour % 24) + 24) % 24; return start <= end ? (h >= start && h < end) : (h >= start || h < end); };

  $('tz-matrix').innerHTML = `
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;font-size:12.5px;color:var(--ink-secondary);">
      <div>Showing ${visible.length} of ${cities.length} matching cities — dark green blocks are shared live call hours.</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;">
        <span><span style="display:inline-block;width:11px;height:11px;background:var(--accent);border-radius:2px;margin-right:5px;"></span>Shared Call Hours</span>
        <span><span style="display:inline-block;width:11px;height:11px;background:#cfe3df;border-radius:2px;margin-right:5px;"></span>Team 9–5</span>
        <span><span style="display:inline-block;width:11px;height:11px;background:#f0dfd1;border-radius:2px;margin-right:5px;"></span>Your Solo Focus</span>
      </div>
    </div>
    ${visible.map(({ city, overlap }) => {
      const cells = Array.from({ length: 24 }, (_, utcH) => {
        const inTeam = isInWindow(utcH + state.tzTeamUtc, 9, 17);
        const inLocal = isInWindow(utcH + city.utcStd, state.tzLocalStart, state.tzLocalEnd);
        let cls = 'tz-cell';
        if (inTeam && inLocal) cls += ' overlap';
        else if (inTeam) cls += ' team';
        else if (inLocal) cls += ' local';
        return `<div class="${cls}"></div>`;
      }).join('');
      const tierCls = overlap.tier === 'Easy Live Calls' ? 'tier-prime' : overlap.tier === 'Part-Day Sync' ? 'tier-flex' : 'tier-async';
      const diffSign = overlap.utcDiff >= 0 ? `+${overlap.utcDiff}h` : `${overlap.utcDiff}h`;
      return `
        <div class="tz-timeline-row">
          <div><strong>${city.city}</strong> <span class="num" style="font-size:11.5px;color:var(--ink-muted);">(${diffSign})</span><div style="font-size:12px;color:var(--ink-muted);">${city.country} · ${overlap.plainNote}</div></div>
          <div class="tz-hours-grid">${cells}</div>
          <div style="text-align:right;"><span class="tier-badge ${tierCls}">${overlap.hours}h · ${overlap.tier}</span><div style="font-size:11.5px;color:var(--ink-muted);margin-top:3px;">${overlap.localWindow}</div></div>
        </div>`;
    }).join('')}
    ${cities.length > 24 ? `<div style="text-align:center;margin-top:16px;"><button type="button" id="tz-toggle-all" class="btn btn-outline btn-sm">${state.tzShowAll ? 'Show Top 24' : `Show All ${cities.length} Cities`}</button></div>` : ''}
  `;
  $('tz-toggle-all')?.addEventListener('click', () => { state.tzShowAll = !state.tzShowAll; renderTimezones(); });
}

/* ==================== TAB 4: 12-MONTH TRIP PLANNER ==================== */
function renderPlanner() {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const countryDays = {};
  let schengenDays = 0, totalCost = 0, tempSum = 0;
  const sortedCities = [...CITIES].sort((a, b) => a.city.localeCompare(b.city));

  $('planner-grid').innerHTML = MONTHS.map((m, idx) => {
    const city = CITIES.find((c) => c.id === state.itinerary[idx]) || CITIES[0];
    const cost = estimateMonthlyCost(city, state.lifestyle, state.housing).total;
    const temp = city.tempC[idx], rain = city.rainMm[idx];
    totalCost += cost; tempSum += temp;
    countryDays[city.country] = (countryDays[city.country] || 0) + daysInMonth[idx];
    if (city.schengen) schengenDays += daysInMonth[idx];

    const options = sortedCities.map((c) => `<option value="${c.id}" ${c.id === city.id ? 'selected' : ''}>${c.city} (${c.iso2})</option>`).join('');
    return `
      <div class="month-slot">
        <div class="month-slot-head"><span>${m}</span><span class="num" style="color:var(--warm);">${temp.toFixed(0)}°C</span></div>
        <select class="select planner-select" data-month="${idx}" aria-label="City for ${m}">${options}</select>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink-secondary);"><span class="num">${formatMoney(cost, state.currency)}</span><span class="num">${rain}mm rain</span></div>
      </div>`;
  }).join('');

  $('planner-grid').querySelectorAll('.planner-select').forEach((sel) => {
    sel.addEventListener('change', (e) => { state.itinerary[Number(e.target.dataset.month)] = e.target.value; renderPlanner(); });
  });

  const annualIncome = state.monthlyIncomeUsd * 12;
  const annualSavings = annualIncome - totalCost;
  const avgTemp = (tempSum / 12).toFixed(1);
  const over183 = Object.entries(countryDays).filter(([, days]) => days >= 183);

  let guardrailHtml = '';
  if (over183.length) guardrailHtml += `<div class="alert-banner warn"><strong>183-Day Tax Rule Watch:</strong> ${over183.map(([c, d]) => `${c} (${d} days)`).join(', ')} reaches 183+ days in a year, which often triggers tax residency. <em>General planning note only — verify with a tax advisor.</em></div>`;
  if (schengenDays > 90) guardrailHtml += `<div class="alert-banner warn"><strong>Europe 90-Day Limit (Schengen):</strong> This route spends <strong>${schengenDays} days</strong> in Schengen countries. Most non-EU passports allow 90 days per 180-day period without a Digital Nomad Visa.</div>`;
  if (!guardrailHtml) guardrailHtml = `<div class="alert-banner"><strong>Stay Limits Look Good:</strong> No single country goes over 182 days, and total Europe (Schengen) days (${schengenDays}) stay under the 90-day tourist cap.</div>`;

  $('planner-alerts').innerHTML = guardrailHtml;
  $('planner-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total Year Cost</div><div class="kpi-value">${formatMoney(totalCost, state.currency)}</div><div class="kpi-note">About ${formatMoney(Math.round(totalCost / 12), state.currency)}/mo</div></div>
    <div class="kpi-card"><div class="kpi-label">Yearly Money Saved</div><div class="kpi-value" style="color:${annualSavings >= 0 ? 'var(--accent)' : 'var(--danger)'};">${formatMoney(annualSavings, state.currency)}</div><div class="kpi-note">${Math.round((annualSavings / annualIncome) * 100)}% of annual pay</div></div>
    <div class="kpi-card"><div class="kpi-label">Average Trip Weather</div><div class="kpi-value">${avgTemp}°C</div><div class="kpi-note">Live NASA POWER monthly</div></div>
    <div class="kpi-card"><div class="kpi-label">Countries &amp; Europe Days</div><div class="kpi-value">${Object.keys(countryDays).length} countries</div><div class="kpi-note">${schengenDays}d in Schengen</div></div>`;

  $('planner-country-breakdown').innerHTML = Object.entries(countryDays)
    .sort((a, b) => b[1] - a[1])
    .map(([country, days]) => `
      <div class="runway-row">
        <strong>${country}</strong>
        <div class="runway-bar-bg"><div class="runway-bar-fg" style="width:${Math.min(100, Math.round((days / 183) * 100))}%;background:${days >= 183 ? 'var(--warm)' : 'var(--accent)'};"></div></div>
        <div class="num" style="text-align:right;">${days} / 183 days</div>
      </div>`).join('');
}

function applySmartRoute(preset) {
  if (preset === 'spring') state.itinerary = ['medellin', 'las-palmas', 'mexico-city', 'lisbon', 'split', 'prague', 'tallinn', 'fukuoka', 'porto', 'athens', 'funchal', 'cape-town'];
  if (preset === 'value') state.itinerary = ['chiang-mai', 'da-nang', 'da-nang', 'kuala-lumpur', 'tbilisi', 'tbilisi', 'bali', 'bali', 'medellin', 'oaxaca', 'chiang-mai', 'chiang-mai'];
  if (preset === 'ussync') state.itinerary = ['san-jose', 'oaxaca', 'mexico-city', 'medellin', 'lisbon', 'montreal', 'montreal', 'vancouver', 'porto', 'florianopolis', 'buenos-aires', 'medellin'];
  renderPlanner();
}

function exportItinerary(format) {
  const rows = MONTHS.map((month, i) => {
    const c = CITIES.find((x) => x.id === state.itinerary[i]);
    return { month, city: c.city, country: c.country, estimated_monthly_usd: estimateMonthlyCost(c, state.lifestyle, state.housing).total, avg_temp_c: c.tempC[i], rainfall_mm: c.rainMm[i], internet_mbps: c.dlMbps, timezone: c.tz, schengen: c.schengen };
  });
  const content = format === 'csv'
    ? `${Object.keys(rows[0]).join(',')}\n${rows.map((r) => Object.values(r).map((v) => `"${v}"`).join(',')).join('\n')}`
    : JSON.stringify({ generatedAt: new Date().toISOString(), itinerary: rows }, null, 2);
  const blob = new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `meridian-nomad-plan.${format}`; a.click();
  URL.revokeObjectURL(url);
}

/* ==================== TAB 5: DATA SOURCES & SEO ==================== */
function renderProvenance() {
  $('dataset-cards').innerHTML = OPEN_DATASETS.map((ds) => `
    <article class="dataset-card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <span class="license-pill">${ds.licenseCode} · Commercial OK</span>
        <span style="font-size:12px;color:var(--accent);font-weight:600;">${ds.refreshCadence}</span>
      </div>
      <h3 style="margin:2px 0 0;font-family:var(--font-serif);font-size:19px;">${ds.name}</h3>
      <div style="font-size:12.5px;color:var(--ink-muted);">Published by ${ds.publisher} · <a href="${ds.licenseUrl}" target="_blank" rel="noopener">${ds.license}</a></div>
      <p style="margin:0;font-size:13.5px;color:var(--ink-secondary);">${ds.role}</p>
      <div style="font-size:12px;background:var(--bg);padding:9px 11px;border-radius:8px;color:var(--ink);"><strong>Credit line:</strong> ${ds.citation}</div>
    </article>`).join('');

  $('excluded-table').innerHTML = EXCLUDED_DATASETS_AUDIT.map((ex) => `
    <tr><td><strong>${ex.name}</strong></td><td class="num">${ex.license}</td><td>${ex.reason}</td></tr>`).join('');

  const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const combined = ldScripts.map((s) => { try { return JSON.parse(s.textContent); } catch { return null; } }).filter(Boolean);
  $('jsonld-preview').textContent = JSON.stringify(combined, null, 2);
}

function renderCurrentTab() {
  if (state.activeTab === 'explore') renderExplore();
  if (state.activeTab === 'budget') renderBudget();
  if (state.activeTab === 'timezones') renderTimezones();
  if (state.activeTab === 'planner') renderPlanner();
  if (state.activeTab === 'provenance') renderProvenance();
}

function syncWeightInputs() {
  ['cost', 'internet', 'climate', 'stability', 'timezone'].forEach((k) => {
    $(`w-${k}`).value = state.weights[k];
    $(`w-${k}-val`).textContent = `${state.weights[k]}%`;
  });
}

function syncControlLabels() {
  $('income-val').textContent = `${formatMoney(state.monthlyIncomeUsd, state.currency)}/mo`;
  $('ideal-temp-val').textContent = `${state.idealTemp}°C`;
  $('min-speed-val').textContent = state.minSpeed === 0 ? 'Any speed' : `${state.minSpeed}+ Mbps`;
  $('max-budget-val').textContent = `${formatMoney(state.maxBudget, state.currency)}/mo`;
  $('savings-val').textContent = formatMoney(state.liquidSavingsUsd, state.currency);
  $('return-val').textContent = `${state.investReturnPct}% / yr`;
}

function init() {
  readUrlParams();
  $('currency-select').value = state.currency;
  $('team-tz').innerHTML = TEAM_TIMEZONES.map((t) => `<option value="${t.utc}" ${t.utc === state.teamUtc ? 'selected' : ''}>${t.label}</option>`).join('');
  $('tz-team-select').innerHTML = TEAM_TIMEZONES.map((t) => `<option value="${t.utc}" ${t.utc === state.tzTeamUtc ? 'selected' : ''}>${t.label}</option>`).join('');
  $('home-base-select').innerHTML = HOME_BASES.map((h) => `<option value="${h.id}" ${h.id === state.homeBaseId ? 'selected' : ''}>${h.label}</option>`).join('');
  const alphaCities = [...CITIES].sort((a, b) => a.city.localeCompare(b.city));
  $('target-city-select').innerHTML = alphaCities.map((c) => `<option value="${c.id}" ${c.id === state.targetCityId ? 'selected' : ''}>${c.city}, ${c.country}</option>`).join('');

  document.querySelectorAll('.mode-tab').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  $('currency-select').addEventListener('change', (e) => { state.currency = e.target.value; syncControlLabels(); renderCurrentTab(); });
  $('copy-share-url').addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', state.activeTab);
    url.searchParams.set('income', String(state.monthlyIncomeUsd));
    url.searchParams.set('cur', state.currency);
    navigator.clipboard?.writeText(url.toString());
    $('copy-share-url').textContent = 'Link Copied';
    setTimeout(() => { $('copy-share-url').textContent = 'Share Setup'; }, 1600);
  });

  $('toggle-advanced').addEventListener('click', () => {
    state.advancedOpen = !state.advancedOpen;
    $('advanced-drawer').classList.toggle('open', state.advancedOpen);
    $('toggle-advanced').textContent = state.advancedOpen ? 'Hide Filters & Weights' : 'Customize Filters & Priorities';
  });

  $('city-search').addEventListener('input', (e) => { state.searchQuery = e.target.value; state.visibleCount = 18; renderExplore(); });
  $('income-range').value = state.monthlyIncomeUsd;
  $('income-range').addEventListener('input', (e) => { state.monthlyIncomeUsd = Number(e.target.value); syncControlLabels(); renderExplore(); });
  $('month-select').addEventListener('change', (e) => { state.monthIndex = Number(e.target.value); renderExplore(); });
  $('ideal-temp').addEventListener('input', (e) => { state.idealTemp = Number(e.target.value); syncControlLabels(); renderExplore(); });
  $('team-tz').addEventListener('change', (e) => { state.teamUtc = Number(e.target.value); renderExplore(); });
  $('min-speed').addEventListener('input', (e) => { state.minSpeed = Number(e.target.value); syncControlLabels(); renderExplore(); });
  $('max-budget').addEventListener('input', (e) => { state.maxBudget = Number(e.target.value); syncControlLabels(); renderExplore(); });

  document.querySelectorAll('[data-lifestyle]').forEach((btn) => btn.addEventListener('click', () => {
    state.lifestyle = btn.dataset.lifestyle;
    document.querySelectorAll('[data-lifestyle]').forEach((b) => b.classList.toggle('active', b === btn));
    renderCurrentTab();
  }));
  document.querySelectorAll('[data-housing]').forEach((btn) => btn.addEventListener('click', () => {
    state.housing = btn.dataset.housing;
    document.querySelectorAll('[data-housing]').forEach((b) => b.classList.toggle('active', b === btn));
    renderCurrentTab();
  }));

  document.querySelectorAll('[data-preset]').forEach((btn) => btn.addEventListener('click', () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    state.activePreset = btn.dataset.preset;
    state.weights = { ...p.weights };
    document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('active', b === btn));
    $('preset-hint').textContent = p.desc;
    syncWeightInputs();
    renderExplore();
  }));

  ['cost', 'internet', 'climate', 'stability', 'timezone'].forEach((key) => {
    $(`w-${key}`).addEventListener('input', (e) => {
      state.weights[key] = Number(e.target.value);
      state.activePreset = 'custom';
      document.querySelectorAll('[data-preset]').forEach((b) => b.classList.remove('active'));
      $('preset-hint').textContent = 'Using your custom priority weights.';
      syncWeightInputs();
      renderExplore();
    });
  });

  document.querySelectorAll('[data-region]').forEach((btn) => btn.addEventListener('click', () => {
    state.region = btn.dataset.region;
    state.countryIso2 = '';
    state.visibleCount = 18;
    document.querySelectorAll('[data-region]').forEach((b) => b.classList.toggle('active', b === btn));
    renderExplore();
  }));
  $('sort-select').addEventListener('change', (e) => { state.sortBy = e.target.value; renderExplore(); });
  $('view-toggle').addEventListener('click', () => {
    state.viewMode = state.viewMode === 'cards' ? 'table' : 'cards';
    $('view-toggle').textContent = state.viewMode === 'cards' ? 'Table View' : 'Card View';
    renderExplore();
  });

  $('home-base-select').addEventListener('change', (e) => { state.homeBaseId = e.target.value; renderBudget(); });
  $('target-city-select').addEventListener('change', (e) => { state.targetCityId = e.target.value; renderBudget(); });
  $('savings-range').addEventListener('input', (e) => { state.liquidSavingsUsd = Number(e.target.value); syncControlLabels(); renderBudget(); });
  $('return-range').addEventListener('input', (e) => { state.investReturnPct = Number(e.target.value); syncControlLabels(); renderBudget(); });

  $('tz-team-select').addEventListener('change', (e) => { state.tzTeamUtc = Number(e.target.value); renderTimezones(); });
  $('tz-start').addEventListener('change', (e) => { state.tzLocalStart = Number(e.target.value); renderTimezones(); });
  $('tz-end').addEventListener('change', (e) => { state.tzLocalEnd = Number(e.target.value); renderTimezones(); });
  $('tz-region-select').addEventListener('change', (e) => { state.tzRegion = e.target.value; renderTimezones(); });
  $('tz-search').addEventListener('input', (e) => { state.tzSearch = e.target.value; renderTimezones(); });

  document.querySelectorAll('[data-route-preset]').forEach((btn) => btn.addEventListener('click', () => applySmartRoute(btn.dataset.routePreset)));
  $('export-csv').addEventListener('click', () => exportItinerary('csv'));
  $('export-json').addEventListener('click', () => exportItinerary('json'));

  $('copy-attribution').addEventListener('click', () => {
    navigator.clipboard?.writeText(OPEN_DATASETS.map((d) => `- ${d.citation} (${d.licenseUrl})`).join('\n'));
    $('copy-attribution').textContent = 'Citations Copied';
    setTimeout(() => { $('copy-attribution').textContent = 'Copy All Citations'; }, 1600);
  });

  $('drawer-close').addEventListener('click', closeDossier);
  $('drawer-backdrop').addEventListener('click', closeDossier);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDossier(); });

  syncWeightInputs();
  syncControlLabels();
  switchTab(state.activeTab);
  if (state.selectedCityId) openDossier(state.selectedCityId);
}

document.addEventListener('DOMContentLoaded', init);
