import { html, raw } from '../html.mjs';
import { MONTHS, fmtMoney, fmtTemp, fmtNum, fmtHours, fmtClock, fmtOffset, fmtCoord } from '../../shared/format.mjs';
import { LIFESTYLES, CURRENCIES, toCur } from '../../shared/cost.mjs';
import { FACTORS, DEFAULT_WEIGHTS } from '../../shared/scores.mjs';
import { DEFAULT_CLIMATE, describe } from '../../shared/climate.mjs';
import { COMMON_ZONES } from '../../shared/tz.mjs';
import { stayLabel } from '../../shared/visa.mjs';
import { scoreChip, factorBars, visaPill, cityPath, cityLabel } from '../components.mjs';

export function matchDefaults(ctx) {
  return {
    budget: 3000, cur: 'USD', life: 'comfortable', month: ctx.buildMonth, p1: '', p2: '',
    tmin: DEFAULT_CLIMATE.tMin, tmax: DEFAULT_CLIMATE.tMax, rain: DEFAULT_CLIMATE.maxRain,
    tz: '', ts: 9, te: 17, ms: 8, me: 20, need: 4, region: '', easy: false,
    ...Object.fromEntries(FACTORS.map((f) => ['w_' + f.key, DEFAULT_WEIGHTS[f.key]])),
  };
}
/** Form state (strings or numbers) to scoring query. */
export function toQuery(s, ctx) {
  const rates = ctx.db.rates;
  const rate = rates.rates[s.cur] ?? 1;
  return {
    month: +s.month < 0 ? null : +s.month,
    climate: { tMin: +s.tmin, tMax: +s.tmax, maxRain: +s.rain },
    budgetUsd: (+s.budget || 0) / rate,
    basket: (LIFESTYLES[s.life] || LIFESTYLES.comfortable).basket,
    passports: [s.p1, s.p2].filter(Boolean),
    team: s.tz ? { tz: s.tz, start: +s.ts, end: +s.te } : null,
    me: { start: +s.ms, end: +s.me },
    needOverlap: +s.need,
    weights: Object.fromEntries(FACTORS.map((f) => [f.key, +s['w_' + f.key]])),
    year: ctx.year,
  };
}
export function matchFilter(s) {
  return (r) => (!s.region || r.country.region === s.region) && (!s.easy || !r.visa || ['free', 'voa', 'eta', 'home'].includes(r.visa.s));
}

const hours = (sel) => Array.from({ length: 24 }, (_, h) => html`<option value="${h}"${h === +sel ? raw(' selected') : ''}>${String(h).padStart(2, '0')}:00</option>`);
export const countryOptions = (ctx, sel, none = 'None selected') => html`<option value="">${none}</option>${[...ctx.db.countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => html`<option value="${c.iso3}"${c.iso3 === sel ? raw(' selected') : ''}>${c.name}</option>`)}`;
export const zoneOptions = (sel, none) => html`${none ? html`<option value="">${none}</option>` : ''}${COMMON_ZONES.map(([z, l]) => html`<option value="${z}"${z === sel ? raw(' selected') : ''}>${l}</option>`)}`;

export function matchForm(ctx, s) {
  const sel = (a, b) => (String(a) === String(b) ? raw(' selected') : '');
  return html`<form class="finder panel" data-form autocomplete="off">
  <div class="finder__main">
    <div class="field">
      <label for="m-budget">Monthly budget</label>
      <div class="inputgroup"><input id="m-budget" name="budget" type="number" inputmode="numeric" min="200" max="100000" step="50" value="${s.budget}"><select id="m-cur" name="cur" aria-label="Currency">${CURRENCIES.map((c) => html`<option${sel(c, s.cur)}>${c}</option>`)}</select></div>
    </div>
    <fieldset class="field seg">
      <legend>Lifestyle</legend>
      <div class="seg__opts">${Object.entries(LIFESTYLES).map(([k, l]) => html`<label class="seg__opt" title="${l.desc}"><input type="radio" name="life" value="${k}"${k === s.life ? raw(' checked') : ''}><span>${l.label}</span></label>`)}</div>
    </fieldset>
    <div class="field">
      <label for="m-month">When</label>
      <select id="m-month" name="month">${MONTHS.map((m, i) => html`<option value="${i}"${sel(i, s.month)}>${m}</option>`)}<option value="-1"${sel(-1, s.month)}>All year round</option></select>
    </div>
    <div class="field">
      <label for="m-p1">Your passport</label>
      <select id="m-p1" name="p1">${countryOptions(ctx, s.p1, 'Skip visa check')}</select>
    </div>
    <div class="field">
      <label for="m-p2">Second passport</label>
      <select id="m-p2" name="p2">${countryOptions(ctx, s.p2, 'None')}</select>
    </div>
  </div>
  <div class="finder__more">
    <details>
      <summary>Weather you like</summary>
      <div class="finder__grid">
        <div class="field"><label for="m-tmin">Coolest average temperature (°C)</label><input id="m-tmin" name="tmin" type="number" min="-10" max="35" step="1" value="${s.tmin}"></div>
        <div class="field"><label for="m-tmax">Warmest average temperature (°C)</label><input id="m-tmax" name="tmax" type="number" min="0" max="40" step="1" value="${s.tmax}"></div>
        <div class="field"><label for="m-rain">Rain you tolerate (mm per month)</label><input id="m-rain" name="rain" type="number" min="20" max="400" step="10" value="${s.rain}"></div>
      </div>
      <p class="hint">Averages over day and night. 16 to 25 °C is roughly 61 to 77 °F, which usually means daytime highs of about 22 to 31 °C.</p>
    </details>
    <details>
      <summary>Team time zone and working hours</summary>
      <div class="finder__grid">
        <div class="field field--wide"><label for="m-tz">Your team or clients work in</label><select id="m-tz" name="tz">${zoneOptions(s.tz, 'No time zone constraint')}</select></div>
        <div class="field"><label for="m-ts">Their day starts</label><select id="m-ts" name="ts">${hours(s.ts)}</select></div>
        <div class="field"><label for="m-te">Their day ends</label><select id="m-te" name="te">${hours(s.te)}</select></div>
        <div class="field"><label for="m-ms">You'll start as early as</label><select id="m-ms" name="ms">${hours(s.ms)}</select></div>
        <div class="field"><label for="m-me">You'll work as late as</label><select id="m-me" name="me">${hours(s.me)}</select></div>
        <div class="field"><label for="m-need">Overlap you need (hours)</label><input id="m-need" name="need" type="number" min="0.5" max="10" step="0.5" value="${s.need}"></div>
      </div>
    </details>
    <details>
      <summary>What matters to you</summary>
      <div class="weights">${FACTORS.map((f) => html`<div class="weight"><label for="m-w-${f.key}">${f.label}</label><input id="m-w-${f.key}" name="w_${f.key}" type="range" min="0" max="5" step="1" value="${s['w_' + f.key]}"><output for="m-w-${f.key}">${s['w_' + f.key]}</output></div>`)}</div>
      <p class="hint">0 ignores a factor. Visa and time-zone fit only count once you pick a passport or a team time zone.</p>
    </details>
    <details>
      <summary>Filters</summary>
      <div class="finder__grid">
        <div class="field field--wide"><label for="m-region">Region</label><select id="m-region" name="region"><option value="">Anywhere</option>${ctx.db.regions.map((r) => html`<option${sel(r, s.region)}>${r}</option>`)}</select></div>
        <label class="check"><input type="checkbox" name="easy" value="1"${s.easy ? raw(' checked') : ''}> Only places I can enter without applying for a visa in advance</label>
      </div>
    </details>
  </div>
  <div class="finder__actions"><button type="reset" class="btn btn--ghost" data-reset>Reset</button><button type="button" class="btn btn--ghost" data-share>Copy link to these settings</button></div>
</form>`;
}

function whyLine(r) {
  const top = Object.entries(r.parts).filter(([k, v]) => v != null && k !== 'visa' && k !== 'timezone').sort((a, b) => b[1] - a[1]).slice(0, 3);
  const L = { cost: 'great value', climate: 'good weather', internet: 'fast internet', safety: 'stable and safe', health: 'strong healthcare', air: 'clean air' };
  return top.map(([k]) => L[k]).filter(Boolean);
}

export function matchResults(ctx, ranked, s, { limit = 12 } = {}) {
  const rates = ctx.db.rates; const cur = s.cur || 'USD';
  const money = (usd) => fmtMoney(toCur(usd, cur, rates), cur, cur === 'JPY' || cur === 'KRW' || cur === 'IDR' || cur === 'HUF' || cur === 'ISK' ? 1000 : 10);
  const m = +s.month;
  const temp = (r) => (m >= 0 ? fmtTemp(r.city.clim.t[m]) + ' · ' + describe(r.city.clim, m) : 'Year-round comfort ' + r.parts.climate);
  const life = (LIFESTYLES[s.life] || LIFESTYLES.comfortable).label.toLowerCase();
  const summary = html`<p class="results__summary"><b>${ranked.length}</b> of ${ctx.db.cities.length} cities match · ranked for <b>${m >= 0 ? MONTHS[m] : 'the whole year'}</b> on a <b>${fmtMoney(+s.budget, cur, 0)}</b> ${life} budget${s.p1 ? html` · visas for <b>${[s.p1, s.p2].filter(Boolean).map((p) => ctx.db.byIso3.get(p)?.name).join(' + ')}</b> passport${s.p2 ? 's' : ''}` : ''}</p>`;
  if (!ranked.length) return html`${summary}<div class="empty"><p><b>No cities match these filters.</b> Widen the region or allow destinations that need a visa in advance.</p></div>`;
  const [first, ...rest] = ranked;
  const overlapTxt = (r) => (r.overlap ? fmtHours(r.overlap.minutes) + ' overlap' + (r.overlap.minutes ? ' (' + fmtClock(r.overlap.localStart) + '–' + fmtClock(r.overlap.localEnd) + ' local)' : '') : null);
  const facts = (r) => [
    html`<span class="fact"><span class="fact__k">Cost</span><span>≈ ${money(r.costUsd)}<small>/mo</small></span></span>`,
    html`<span class="fact"><span class="fact__k">Weather</span><span>${temp(r)}</span></span>`,
    html`<span class="fact"><span class="fact__k">Internet</span><span>${r.country.net?.down ? fmtNum(r.country.net.down) + ' Mbps median' : 'No data'}</span></span>`,
    r.visa ? html`<span class="fact"><span class="fact__k">Visa</span><span>${visaPill(r.visa)}</span></span>` : '',
    r.overlap ? html`<span class="fact"><span class="fact__k">Work overlap</span><span>${overlapTxt(r)}</span></span>` : '',
  ];
  const c = first.city;
  return html`${summary}
<article class="pass" aria-label="Best match">
  <div class="pass__main">
    <p class="pass__kicker"><span>Best match</span><span class="mono">${fmtCoord(c.lat, c.lng)}</span></p>
    <h3 class="pass__city"><a href="${ctx.link(cityPath(c))}">${cityLabel(c)}</a></h3>
    <p class="pass__country">${c.country.name}<span class="mono"> · ${c.tz.replace(/_/g, ' ')}</span></p>
    <p class="pass__why">${whyLine(first).length ? 'Strong on ' + whyLine(first).join(', ') + '.' : ''}</p>
    <div class="pass__facts">${facts(first)}</div>
  </div>
  <div class="pass__stub">
    <span class="pass__label">Match</span>
    <span class="pass__score">${first.total}</span>
    <span class="pass__of">out of 100</span>
    ${factorBars(first.parts, toQuery(s, ctx).weights)}
    <a class="btn btn--small" href="${ctx.link(cityPath(c))}">City guide</a>
  </div>
</article>
<ol class="mlist" start="2">${rest.slice(0, limit - 1).map((r, i) => html`<li class="mrow">
  <span class="mrow__rank mono">${String(i + 2).padStart(2, '0')}</span>
  <div class="mrow__head"><a class="mrow__city" href="${ctx.link(cityPath(r.city))}">${cityLabel(r.city)}</a><span class="mrow__country">${r.country.name}</span></div>
  <span class="mrow__score">${scoreChip(r.total, 'Match score')}</span>
  <div class="mrow__facts">${facts(r)}</div>
</li>`)}</ol>
${ranked.length > limit ? html`<button type="button" class="btn btn--ghost btn--wide" data-more>Show ${Math.min(12, ranked.length - limit)} more</button>` : ''}`;
}
