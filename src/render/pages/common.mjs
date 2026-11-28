import { html } from '../html.mjs';
import { tzOffset, refDate, overlap } from '../../shared/tz.mjs';
import { fmtOffset, fmtHours } from '../../shared/format.mjs';
import { breadcrumbs, breadcrumbLd } from '../components.mjs';

export function shell(ctx, crumbs, inner) {
  return html`<div class="wrap page">${crumbs ? breadcrumbs(ctx, crumbs) : ''}${inner}</div>`;
}
export const crumbsLd = (ctx, crumbs) => breadcrumbLd(ctx, crumbs);

export const TEAM_HUBS = [
  ['America/Los_Angeles', 'San Francisco'], ['America/New_York', 'New York'], ['America/Sao_Paulo', 'São Paulo'], ['Europe/London', 'London'],
  ['Europe/Berlin', 'Berlin'], ['Asia/Dubai', 'Dubai'], ['Asia/Singapore', 'Singapore'], ['Australia/Sydney', 'Sydney'],
];
export function offsetsLabel(tz, year) {
  const jan = tzOffset(tz, refDate(year, 0)), jul = tzOffset(tz, refDate(year, 6));
  return jan === jul ? fmtOffset(jan) : fmtOffset(jan) + ' in January, ' + fmtOffset(jul) + ' in July';
}
export function overlapTable(ctx, tz, label) {
  const y = ctx.year;
  const rows = TEAM_HUBS.filter(([z]) => z !== tz).map(([z, name]) => {
    const jan = overlap({ tz: z, start: 9, end: 17 }, { tz, start: 8, end: 20 }, refDate(y, 0));
    const jul = overlap({ tz: z, start: 9, end: 17 }, { tz, start: 8, end: 20 }, refDate(y, 6));
    return { name, jan: jan?.minutes, jul: jul?.minutes, dJan: jan?.diff, dJul: jul?.diff };
  });
  // Daylight saving changes the gap with many hubs between January and July: show both when they differ.
  const gap = (d) => (d == null ? '–' : d === 0 ? 'Same time' : (d > 0 ? '+' : '−') + fmtHours(Math.abs(d)));
  const cell = (m) => html`<td class="num"><span class="ovl ovl--${m >= 360 ? 'hi' : m >= 180 ? 'mid' : m > 0 ? 'lo' : 'none'}">${fmtHours(m)}</span></td>`;
  return html`<div class="tablewrap"><table class="table table--compact">
    <caption>Overlap between a 9:00–17:00 team and a working day you're willing to stretch from 08:00 to 20:00 in ${label}</caption>
    <thead><tr><th scope="col">Team in</th><th scope="col" class="num">Time difference <small>January / July</small></th><th scope="col" class="num">January</th><th scope="col" class="num">July</th></tr></thead>
    <tbody>${rows.map((r) => html`<tr><th scope="row">${r.name}</th><td class="num">${r.dJan === r.dJul ? gap(r.dJan) : gap(r.dJan) + ' / ' + gap(r.dJul)}</td>${cell(r.jan)}${cell(r.jul)}</tr>`)}</tbody>
  </table></div>`;
}
