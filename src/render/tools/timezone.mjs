import { html, raw } from '../html.mjs';
import { MONTHS, fmtHours, fmtClock, fmtOffset } from '../../shared/format.mjs';
import { overlap, refDate, tzOffset, COMMON_ZONES } from '../../shared/tz.mjs';
import { scoreChip, cityPath, cityLabel, dataTable } from '../components.mjs';
import { zoneOptions } from './match.mjs';

export const tzDefaults = (ctx) => ({ tz: 'America/New_York', ts: 9, te: 17, ms: 8, me: 20, need: 4, month: ctx.buildMonth, region: '' });
const hours = (name, v, id) => html`<select id="${id}" name="${name}">${Array.from({ length: 24 }, (_, h) => html`<option value="${h}"${h === +v ? raw(' selected') : ''}>${String(h).padStart(2, '0')}:00</option>`)}</select>`;

export function tzForm(ctx, s) {
  const sel = (a, b) => (String(a) === String(b) ? raw(' selected') : '');
  return html`<form class="panel finder finder--flat" data-form autocomplete="off"><div class="finder__main">
    <div class="field field--wide"><label for="t-tz">Team or clients are in</label><select id="t-tz" name="tz">${zoneOptions(s.tz)}</select></div>
    <div class="field"><label for="t-ts">Their day starts</label>${hours('ts', s.ts, 't-ts')}</div>
    <div class="field"><label for="t-te">Their day ends</label>${hours('te', s.te, 't-te')}</div>
    <div class="field"><label for="t-ms">You'll start as early as</label>${hours('ms', s.ms, 't-ms')}</div>
    <div class="field"><label for="t-me">You'll work as late as</label>${hours('me', s.me, 't-me')}</div>
    <div class="field"><label for="t-need">Overlap you need (h)</label><input id="t-need" name="need" type="number" min="0.5" max="10" step="0.5" value="${s.need}"></div>
    <div class="field"><label for="t-month">Month</label><select id="t-month" name="month">${MONTHS.map((m, i) => html`<option value="${i}"${sel(i, s.month)}>${m}</option>`)}</select></div>
    <div class="field"><label for="t-region">Region</label><select id="t-region" name="region"><option value="">Anywhere</option>${ctx.db.regions.map((r) => html`<option${sel(r, s.region)}>${r}</option>`)}</select></div>
  </div></form>`;
}

function strip(team, me, ov, tzCity, date) {
  // 24h track in the city's local time: your window outlined, team hours shaded, overlap highlighted
  const oT = tzOffset(team.tz, date), oC = tzOffset(tzCity, date);
  const toLocal = (h) => ((h * 60 - oT + oC) % 1440 + 1440) % 1440;
  const segs = (a, b) => (b > a ? [[a, b]] : [[a, 1440], [0, b]]);
  let ts = toLocal(team.start), te = toLocal(team.end); if (team.end - team.start >= 24) te = ts;
  const teamSegs = segs(ts, te === ts ? ts + 1440 : te).map(([a, b]) => [a, Math.min(b, 1440)]);
  const meSegs = segs(me.start * 60, me.end * 60);
  const x = (m) => (m / 1440) * 240;
  return html`<svg class="tzstrip" viewBox="0 0 240 18" aria-hidden="true">
    <rect class="tz-track" x="0" y="5" width="240" height="8" rx="4"/>
    ${teamSegs.map(([a, b]) => html`<rect class="tz-team" x="${x(a).toFixed(1)}" y="5" width="${(x(b) - x(a)).toFixed(1)}" height="8"/>`)}
    ${meSegs.map(([a, b]) => html`<rect class="tz-me" x="${x(a).toFixed(1)}" y="2" width="${(x(b) - x(a)).toFixed(1)}" height="14" rx="3"/>`)}
    ${[6, 12, 18].map((h) => html`<line class="tz-tick" x1="${x(h * 60)}" x2="${x(h * 60)}" y1="0" y2="18"/>`)}
  </svg>`;
}

export function tzRows(ctx, s) {
  const date = refDate(ctx.year, +s.month);
  const team = { tz: s.tz, start: +s.ts, end: +s.te };
  return ctx.db.cities.filter((c) => !s.region || c.country.region === s.region).map((c) => ({ c, ov: overlap(team, { tz: c.tz, start: +s.ms, end: +s.me }, date) })).filter((r) => r.ov)
    .sort((a, b) => b.ov.minutes - a.ov.minutes || (b.c.score ?? 0) - (a.c.score ?? 0));
}

export function tzResults(ctx, s) {
  const date = refDate(ctx.year, +s.month);
  const team = { tz: s.tz, start: +s.ts, end: +s.te }; const me = { start: +s.ms, end: +s.me };
  const rows = tzRows(ctx, s);
  const need = +s.need * 60;
  const ok = rows.filter((r) => r.ov.minutes >= need).length;
  const label = COMMON_ZONES.find(([z]) => z === s.tz)?.[1] || s.tz;
  return html`<p class="results__summary"><b>${ok}</b> of ${rows.length} cities give you at least ${fmtHours(need)} with a ${String(s.ts).padStart(2, '0')}:00–${String(s.te).padStart(2, '0')}:00 team in ${label} (${fmtOffset(tzOffset(s.tz, date))} in ${MONTHS[+s.month]})</p>
  <p class="tzkey" aria-hidden="true"><span class="key key--team"></span>Team hours in local time <span class="key key--me"></span>Hours you're willing to work</p>
  ${dataTable({ caption: 'Working-hours overlap by city', id: 'tz-table', columns: [{ label: 'City' }, { label: 'Local time vs team', num: true }, { label: 'Overlap', num: true }, { label: 'Overlap in local time', num: true }, { label: 'Your day (00–24 local)', sortable: false }, { label: 'Score', num: true }],
    rows: rows.slice(0, 80).map(({ c, ov }) => ({ cells: [html`<a href="${ctx.link(cityPath(c))}">${cityLabel(c)}</a><span class="muted">, ${c.country.name}</span>`, (ov.diff === 0 ? '±0h' : (ov.diff > 0 ? '+' : '−') + fmtHours(Math.abs(ov.diff))), html`<span class="ovl ovl--${ov.minutes >= need ? 'hi' : ov.minutes > 0 ? 'lo' : 'none'}">${fmtHours(ov.minutes)}</span>`, ov.minutes ? fmtClock(ov.localStart) + '–' + fmtClock(ov.localEnd) : '–', strip(team, me, ov, c.tz, date), scoreChip(c.score)], sort: [cityLabel(c), ov.diff, ov.minutes, ov.localStart ?? '', '', c.score ?? ''] })) })}`;
}
