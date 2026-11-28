import { html, raw } from '../html.mjs';
import { analyze, maxStay, toDay, fromDay } from '../../shared/schengen.mjs';
import { MONTHS_SHORT, fmtNum } from '../../shared/format.mjs';

const nice = (iso) => { if (!iso) return '–'; const d = new Date(iso + 'T00:00:00Z'); return d.getUTCDate() + ' ' + MONTHS_SHORT[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
export function schengenDefaults(ctx) {
  const t = toDay(ctx.buildDate);
  return { trips: [{ entry: fromDay(t - 160), exit: fromDay(t - 131) }, { entry: fromDay(t - 80), exit: fromDay(t - 51) }, { entry: fromDay(t - 20), exit: fromDay(t - 6) }], check: ctx.buildDate, plan: fromDay(t + 21), example: true };
}

export function tripRow(t, i) {
  return html`<li class="trip" data-trip>
    <div class="field"><label for="s-in-${i}">Entered</label><input id="s-in-${i}" type="date" name="entry" value="${t.entry}"></div>
    <div class="field"><label for="s-out-${i}">Left</label><input id="s-out-${i}" type="date" name="exit" value="${t.exit}"></div>
    <span class="trip__days mono" data-days>${Number.isFinite(toDay(t.exit) - toDay(t.entry)) && toDay(t.exit) >= toDay(t.entry) ? toDay(t.exit) - toDay(t.entry) + 1 + ' d' : ''}</span>
    <button type="button" class="iconbtn" data-remove aria-label="Remove this stay">×</button>
  </li>`;
}

export function schengenForm(ctx, s) {
  return html`<form class="panel schform" data-form autocomplete="off">
    <fieldset><legend>Your stays in the Schengen Area</legend>
      ${s.example ? html`<p class="hint hint--note" data-example-note>These are example stays. Replace them with yours; they are saved only in this browser.</p>` : ''}
      <ol class="trips" data-trips>${s.trips.map((t, i) => tripRow(t, i))}</ol>
      <div class="schform__btns"><button type="button" class="btn btn--ghost btn--small" data-add>Add a stay</button><button type="button" class="btn btn--ghost btn--small" data-clear>Clear all</button></div>
    </fieldset>
    <div class="finder__grid">
      <div class="field"><label for="s-check">Check the rule on</label><input id="s-check" type="date" name="check" value="${s.check}"></div>
      <div class="field"><label for="s-plan">Next planned entry</label><input id="s-plan" type="date" name="plan" value="${s.plan}"></div>
    </div>
  </form>`;
}

function chart(a) {
  const W = 680, H = 210, L = 34, R = 10, T = 14, B = 172;
  const n = a.series.length; const xs = (i) => L + (i / (n - 1)) * (W - L - R);
  const peak = Math.max(90, ...a.series.map((p) => p.used));
  const ys = (v) => B - (v / peak) * (B - T);
  const line = 'M' + a.series.map((p, i) => xs(i).toFixed(1) + ' ' + ys(p.used).toFixed(1)).join('L');
  const area = line + 'L' + xs(n - 1).toFixed(1) + ' ' + B + 'L' + L + ' ' + B + 'Z';
  const ci = a.series.findIndex((p) => p.d === a.checkDay);
  const ticks = a.series.map((p, i) => [p, i]).filter(([p]) => new Date(p.d * 86400000).getUTCDate() === 1);
  const over = a.series.map((p, i) => [p, i]).filter(([p]) => p.used > 90);
  return html`<figure class="chart schchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Days used in the rolling 180-day window, from 180 days before to 180 days after the check date">
    ${[0, 30, 60, 90].map((v) => html`<line class="ch-grid" x1="${L}" x2="${W - R}" y1="${ys(v).toFixed(1)}" y2="${ys(v).toFixed(1)}"/><text class="ch-ylab" x="${L - 6}" y="${(ys(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`)}
    <line class="ch-limit" x1="${L}" x2="${W - R}" y1="${ys(90).toFixed(1)}" y2="${ys(90).toFixed(1)}"/>
    <text class="ch-limitlab" x="${W - R}" y="${(ys(90) - 5).toFixed(1)}" text-anchor="end">90-day limit</text>
    <path class="ch-area" d="${area}"/><path class="ch-line" d="${line}"/>
    ${over.map(([p, i]) => html`<rect class="ch-over" x="${(xs(i) - 1).toFixed(1)}" y="${ys(p.used).toFixed(1)}" width="2" height="${(B - ys(p.used)).toFixed(1)}"/>`)}
    ${a.series.map((p, i) => (p.present ? html`<rect class="ch-present" x="${(xs(i) - 0.9).toFixed(1)}" y="${B + 4}" width="1.8" height="6"/>` : ''))}
    ${ci >= 0 ? html`<line class="ch-now" x1="${xs(ci).toFixed(1)}" x2="${xs(ci).toFixed(1)}" y1="${T - 4}" y2="${B + 12}"/><text class="ch-nowlab" x="${(xs(ci) + 4).toFixed(1)}" y="${T + 6}">Check date</text>` : ''}
    ${ticks.map(([p, i]) => html`<text class="ch-xlab" x="${xs(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${MONTHS_SHORT[new Date(p.d * 86400000).getUTCMonth()]}</text>`)}
  </svg><figcaption class="chart__legend"><span class="key key--sch"></span>Days counted in the 180 days ending that day <span class="key key--present"></span>Days you are in the Schengen Area</figcaption></figure>`;
}

export function schengenResults(ctx, s) {
  const trips = s.trips.filter((t) => t.entry && t.exit);
  // Stays the rule can't count (left before entering, or over ten years): say so rather than quietly leaving them out.
  const bad = trips.filter((t) => { const a = toDay(t.entry), b = toDay(t.exit); return Number.isFinite(a) && Number.isFinite(b) && (b < a || b - a > 3660); }).length;
  const a = analyze(trips, s.check);
  const plan = s.plan ? maxStay(trips, s.plan) : null;
  const state = a.used > 90 ? 'bad' : a.remaining <= 10 ? 'warn' : 'good';
  return html`<div class="schsum">
      <div class="schsum__item schsum__item--${state}"><span class="schsum__n">${a.used}</span><span class="schsum__l">days used in the 180 days up to ${nice(s.check)}</span></div>
      <div class="schsum__item"><span class="schsum__n">${a.remaining}</span><span class="schsum__l">of your 90 days unused in that window</span></div>
      ${plan ? html`<div class="schsum__item"><span class="schsum__n">${plan.days}</span><span class="schsum__l">days allowed if you enter on ${nice(s.plan)}${plan.lastDay ? html`, leaving by <b>${nice(plan.lastDay)}</b>` : ''}</span></div>` : ''}
    </div>
    ${bad ? html`<p class="alert alert--warn" role="alert"><b>Check your dates:</b> ${bad === 1 ? 'one stay is' : bad + ' stays are'} not counted because the date you left is before the date you entered (or the stay is over ten years long).</p>` : ''}
    ${a.firstOverstay ? html`<p class="alert alert--bad" role="alert"><b>Overstay:</b> these stays exceed 90 days in a 180-day window from ${nice(a.firstOverstay)} (${a.overstays.length} day${a.overstays.length === 1 ? '' : 's'} over the limit).</p>` : html`<p class="alert alert--good">${bad ? 'The stays it can count respect' : 'These stays respect'} the 90/180 rule.</p>`}
    ${a.resetDate ? (a.clearBy ? html`<p class="hint">All ${fmtNum(a.totalDays)} days of these stays had dropped out of the window by <b>${nice(a.resetDate)}</b>.</p>` : html`<p class="hint">Your window is completely clear again from <b>${nice(a.resetDate)}</b>, 180 days after the last day of these stays, once all ${fmtNum(a.totalDays)} days have dropped out.</p>`) : ''}
    ${chart(a)}`;
}
