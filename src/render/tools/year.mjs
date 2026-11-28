import { html, raw } from '../html.mjs';
import { MONTHS, MONTHS_SHORT, fmtMoney, fmtNum, fmtTemp } from '../../shared/format.mjs';
import { LIFESTYLES } from '../../shared/cost.mjs';
import { scoreClass } from '../../shared/scores.mjs';
import { planYear, PLEASANT, MAX_MONTHS } from '../../shared/year.mjs';
import { cityLabel, cityFull, cityPath, visaPill, passportPath } from '../components.mjs';
import { countryOptions } from './match.mjs';
import { icon } from '../icons.mjs';

/** The example everyone sees first: the classic loop of a cheap winter in Asia, spring in Europe, summer in the Balkans and
 *  autumn in Mexico. With no passport set it shows the one thing people most often get wrong: April to June is 91 days. */
export const DEFAULT_LEGS = 'chiang-mai:3,lisbon:3,belgrade:3,mexico-city:3';
const TONES = ['teal', 'violet', 'amber', 'sky', 'rose', 'emerald', 'indigo', 'coral'];

export function yearDefaults(ctx) {
  // Plan next year once October comes round.
  return { year: ctx.buildMonth >= 9 ? ctx.year + 1 : ctx.year, start: 0, p: '', life: 'comfortable', legs: DEFAULT_LEGS };
}

const cityOpts = (ctx) => (ctx.db._yearCityOpts ||= [...ctx.db.cities].map((c) => ({ v: c.slug, l: cityFull(c) })).sort((a, b) => a.l.localeCompare(b.l)));
/** One stop in the form. id keeps element ids unique as stops are added and removed; num is the stop's position (from 1). */
export function stopRow(ctx, leg, id, num = id + 1) {
  const slug = leg.city?.slug ?? leg.slug, m = +leg.months || 3, i = id;
  return html`<li class="stop" data-stop>
    <div class="field"><label for="y-c-${i}">Stop ${num}</label><select id="y-c-${i}" name="city">${cityOpts(ctx).map((o) => html`<option value="${o.v}"${o.v === slug ? raw(' selected') : ''}>${o.l}</option>`)}</select></div>
    <div class="field"><label for="y-m-${i}">Months</label><select id="y-m-${i}" name="months">${Array.from({ length: 12 }, (_, k) => html`<option${k + 1 === m ? raw(' selected') : ''}>${k + 1}</option>`)}</select></div>
    <button type="button" class="iconbtn" data-remove aria-label="Remove this stop">×</button>
  </li>`;
}

export function yearForm(ctx, s, legs) {
  const sel = (a, b) => (String(a) === String(b) ? raw(' selected') : '');
  const y0 = Math.min(ctx.year, +s.year);
  return html`<form class="panel finder yearform" data-form autocomplete="off">
  <div class="finder__main">
    <div class="field"><label for="y-year">Year</label><select id="y-year" name="year">${[y0, y0 + 1, y0 + 2].map((y) => html`<option${sel(y, s.year)}>${y}</option>`)}</select></div>
    <div class="field"><label for="y-start">Starting in</label><select id="y-start" name="start">${MONTHS.map((m, i) => html`<option value="${i}"${sel(i, s.start)}>${m}</option>`)}</select></div>
    <div class="field"><label for="y-p">Your passport</label><select id="y-p" name="p">${countryOptions(ctx, s.p, 'Not set (no visa checks)')}</select></div>
    <fieldset class="field seg"><legend>Lifestyle</legend><div class="seg__opts">${Object.entries(LIFESTYLES).map(([k, l]) => html`<label class="seg__opt" title="${l.desc}"><input type="radio" name="life" value="${k}"${k === s.life ? raw(' checked') : ''}><span>${l.label}</span></label>`)}</div></fieldset>
  </div>
  <fieldset class="yearform__stops"><legend>Your stops, in order</legend>
    <ol class="stops" data-stops>${legs.map((l, i) => stopRow(ctx, l, i))}</ol>
    <div class="schform__btns"><button type="button" class="btn btn--ghost btn--small" data-add>Add a stop</button><button type="button" class="btn btn--small" data-suggest>${icon('sun')} Suggest a sun-chasing year</button></div>
  </fieldset>
  <div class="finder__actions"><button type="button" class="btn btn--ghost" data-share>Copy link to this plan</button></div>
</form>`;
}

const day = (isoDate) => { const d = new Date(isoDate + 'T00:00:00Z'); return d.getUTCDate() + ' ' + MONTHS_SHORT[d.getUTCMonth()]; };
const dayY = (isoDate) => day(isoDate) + ' ' + isoDate.slice(0, 4);
export const co2 = (kg) => (kg >= 1000 ? fmtNum(kg / 1000, 1) + ' t' : fmtNum(kg) + ' kg');

export function yearResults(ctx, s) {
  const p = planYear(ctx.db, s);
  if (!p.stops.length) return html`<div class="empty"><p>Add a stop to start planning.</p></div>`;
  const sch = p.schengen, pass = s.p ? ctx.db.byIso3.get(s.p) : null;
  const life = (LIFESTYLES[s.life] || LIFESTYLES.comfortable).label.toLowerCase();
  const schTile = !sch.days ? ['None', 'no stops in the Schengen Area'] : !sch.applies ? ['Free', 'the 90/180 rule does not apply to ' + pass.name + ' citizens'] : sch.over ? ['Over', 'leave ' + sch.overStop.city.name + ' by ' + day(sch.leaveBy) + ' to stay within 90 days'] : [sch.peak + '/90', 'most days used in any 180-day window'];
  const alerts = [];
  if (sch.over) alerts.push(['bad', html`<b>Schengen:</b> your ${sch.overStop.city.name} stay takes you past 90 days in 180 on ${dayY(sch.overDate)}. Leave the Schengen Area by ${dayY(sch.leaveBy)}, or shorten an earlier Schengen stay.`]);
  if (p.dropped > 0) alerts.push(['warn', html`A plan covers at most ${MAX_MONTHS} months, so the last <b>${p.dropped} stop${p.dropped === 1 ? '' : 's'}</b> ${p.dropped === 1 ? 'is' : 'are'} left out. Shorten or remove a stop to fit ${p.dropped === 1 ? 'it' : 'them'} in.`]);
  if (p.months !== 12) alerts.push(['warn', html`This plan covers <b>${p.months} month${p.months === 1 ? '' : 's'}</b>${p.months < 12 ? ', so ' + (12 - p.months) + ' of the year are still open' : ''}.`]);
  for (const st of p.stops) for (const n of st.notes) alerts.push(['warn', html`<b>${cityLabel(st.city)}:</b> ${n}. <a href="${ctx.link(passportPath(pass))}">${pass.name} passport rules</a>`]);
  // Timeline columns: one per month of the plan.
  const cols = [];
  for (const st of p.stops) st.months.forEach((m, k) => cols.push({ st, m, k, t: st.temps[k], rain: st.rain[k], comf: st.comf[k] }));
  const yy = (i) => "’" + String(p.year + Math.floor((p.start + i) / 12)).slice(2);
  const schRow = sch.applies && sch.days > 0;
  return html`<div class="schsum yrsum">
    <div class="schsum__item"><span class="yrsum__k">Living costs</span><span class="schsum__n">${p.cost != null ? fmtMoney(p.cost, 'USD', 100) : '–'}</span><span class="schsum__l">for ${p.months} months on a ${life} budget${p.cost != null ? ', about ' + fmtMoney(p.cost / p.months) + ' a month' : ''}</span></div>
    <div class="schsum__item"><span class="yrsum__k">Flights</span><span class="schsum__n">${p.flights.n ? co2(p.flights.kg) : '0'}</span><span class="schsum__l">${p.flights.n ? 'CO₂e for ' + p.flights.n + ' flight' + (p.flights.n === 1 ? '' : 's') + ' (' + fmtNum(p.flights.km) + ' km, economy)' : 'no flights between stops'}</span></div>
    <div class="schsum__item schsum__item--${p.weather.pleasant >= p.months * 0.75 ? 'good' : p.weather.pleasant >= p.months * 0.5 ? 'warn' : 'bad'}"><span class="yrsum__k">Weather</span><span class="schsum__n">${p.weather.pleasant}/${p.months}</span><span class="schsum__l">months with comfortable weather (average comfort ${p.weather.avg}/100)</span></div>
    <div class="schsum__item schsum__item--${sch.over ? 'bad' : 'good'}"><span class="yrsum__k">Schengen 90/180</span><span class="schsum__n">${schTile[0]}</span><span class="schsum__l">${schTile[1]}</span></div>
  </div>
  ${alerts.map(([k, m]) => html`<p class="alert alert--${k}">${m}</p>`)}
  ${!s.p ? html`<p class="hint">Set your passport to check visas for every stop. Without one, the Schengen check assumes you are not an EU, EEA or Swiss citizen.</p>` : ''}
  <div class="tablewrap"><table class="table yeartl">
    <caption>Your year month by month: where you are, the average temperature (coloured by comfort), rain${schRow ? ' and Schengen days used in the last 180' : ''}</caption>
    <thead><tr><th scope="col"><span class="sr">Month</span></th>${cols.map((c, i) => html`<th scope="col">${MONTHS_SHORT[c.m]}${i === 0 || c.m === 0 ? html`<small>${yy(i)}</small>` : ''}</th>`)}</tr></thead>
    <tbody>
      <tr><th scope="row">Where</th>${p.stops.map((st) => html`<td colspan="${st.months.length}" class="yt__stop tone-${TONES[st.i % TONES.length]}"><a href="${ctx.link(cityPath(st.city))}">${cityLabel(st.city)}</a></td>`)}</tr>
      <tr><th scope="row">Average</th>${cols.map((c) => html`<td class="yt__t yt__t--${scoreClass(c.comf)}" title="Comfort ${c.comf}/100">${fmtTemp(c.t)}</td>`)}</tr>
      <tr><th scope="row">Rain</th>${cols.map((c) => html`<td class="yt__r">${fmtNum(c.rain)}<small>mm</small></td>`)}</tr>
      ${schRow ? html`<tr><th scope="row">Schengen</th>${p.schengenByMonth.map((x) => html`<td class="yt__s${x.over ? ' is-over' : x.n ? ' is-on' : ''}"${x.over ? raw(' title="Over the 90-day limit this month"') : ''}>${x.n || '–'}</td>`)}</tr>` : ''}
    </tbody></table></div>
  <div class="tablewrap"><table class="table table--compact yearstops">
    <caption>Stop by stop${pass ? ', with entry rules for ' + pass.name + ' passport holders' : ''}</caption>
    <thead><tr><th scope="col">Stop</th><th scope="col">Dates</th><th scope="col" class="num">Weather</th><th scope="col" class="num">Cost</th>${pass ? html`<th scope="col">Entry</th>` : ''}<th scope="col" class="num">Getting there</th></tr></thead>
    <tbody>${p.stops.map((st) => html`<tr>
      <th scope="row"><a href="${ctx.link(cityPath(st.city))}">${cityLabel(st.city)}</a><small>${st.city.country.name}${st.schengen ? ' · Schengen' : ''}</small></th>
      <td>${day(st.from)} – ${dayY(st.to)}<small>${st.days} days</small></td>
      <td class="num">${fmtTemp(Math.min(...st.temps))}${Math.round(Math.min(...st.temps)) !== Math.round(Math.max(...st.temps)) ? '–' + fmtTemp(Math.max(...st.temps)) : ''}<small>comfort ${st.avgComf}</small></td>
      <td class="num">${st.perMonth != null ? fmtMoney(st.perMonth) + '/mo' : '–'}<small>${st.cost != null ? fmtMoney(st.cost, 'USD', 10) + ' in total' : 'no price data'}</small></td>
      ${pass ? html`<td>${visaPill(st.visa)}</td>` : ''}
      <td class="num">${st.flight ? html`${fmtNum(st.flight.km)} km<small>${co2(st.flight.kg)} CO₂e</small>` : st.i === 0 ? html`<span class="muted">Start</span>` : html`<span class="muted">Same city</span>`}</td>
    </tr>`)}</tbody>
    <tfoot><tr><th scope="row">Year</th><td>${p.totalDays} days</td><td class="num">${p.weather.pleasant} of ${p.months} months comfortable</td><td class="num"><b>${p.cost != null ? fmtMoney(p.cost, 'USD', 10) : '–'}</b></td>${pass ? html`<td></td>` : ''}<td class="num">${fmtNum(p.flights.km)} km · ${co2(p.flights.kg)}</td></tr></tfoot>
  </table></div>
  <p class="hint">Comfortable means a comfort score of ${PLEASANT} or more: an average temperature (day and night) between 16 and 25 °C with moderate rain. Flights are one way, economy, between consecutive stops, with non-CO₂ warming effects.</p>`;
}
