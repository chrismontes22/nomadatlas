import { html, raw, esc, jsonLd, scriptJson } from './html.mjs';
import { fmtNum, fmtMoney, fmtTemp, fmtMm, MONTHS, MONTHS_SHORT, cToF, fmtPct } from '../shared/format.mjs';
import { scoreClass, FACTORS } from '../shared/scores.mjs';
import { describe, comfort } from '../shared/climate.mjs';
import { STATUS, stayLabel } from '../shared/visa.mjs';
import { TOOLS, toolDesc } from './nav.mjs';
import { iconTile } from './icons.mjs';

export const cityLabel = (c) => (c.alias && c.alias !== c.country?.name ? c.name + ', ' + c.alias : c.name);
/** ", Country" to follow a city's name, or nothing for city-states such as Singapore and Hong Kong. */
export const inCountry = (c) => (!c.country || c.name === c.country.name ? '' : ', ' + c.country.name);
export const cityFull = (c) => cityLabel(c) + inCountry(c);
export const cityPath = (c) => '/cities/' + c.slug + '/';
export const countryPath = (c) => '/countries/' + c.slug + '/';
export const passportPath = (c) => '/visa-free-countries/' + c.slug + '/';
export const monthPath = (m) => '/where-to-go/' + MONTHS[m].toLowerCase() + '/';

/* Map images (SVG files written by scripts/build.mjs from each page's images[].spec, see scripts/lib/mapcards.mjs).
   File names describe the picture, which is a small hint for image search. */
export const cityMapPath = (c) => '/img/cities/' + (c.slug.endsWith('-' + c.country.slug) ? c.slug : c.slug + '-' + c.country.slug) + '-map.svg';
export const countryMapPath = (k) => '/img/countries/' + k.slug + '-map.svg';
export const monthMapPath = (m) => '/img/where-to-go/' + MONTHS[m].toLowerCase() + '-map.svg';
/** Header class for pages that show a map image (static site only: the single-file preview has no image files). */
export const mediaHead = (ctx) => (ctx.mode === 'static' ? 'pagehead--media' : '');
/** The map image beside a page's heading. It's above the fold, so it loads eagerly with high priority (good for LCP). */
export function mapFigure(ctx, img) {
  if (!img || ctx.mode !== 'static') return '';
  return html`<figure class="mapcard"><img src="${img.src}" alt="${img.alt}" width="${img.w}" height="${img.h}" fetchpriority="high" decoding="async"><figcaption>${img.caption}</figcaption></figure>`;
}

export const scoreChip = (v, label = 'Score') => html`<span class="score score--${scoreClass(v)}" title="${label}: ${v ?? 'no data'} out of 100"><span class="sr">${label}: </span>${v ?? '–'}</span>`;

export function meter(label, value, note) {
  return html`<div class="meter">
    <div class="meter__head"><span class="meter__label">${label}</span><span class="meter__val">${value ?? '–'}<small>/100</small></span></div>
    <div class="meter__track" aria-hidden="true"><span class="meter__fill meter__fill--${scoreClass(value)}" style="width:${value ?? 0}%"></span></div>
    ${note ? html`<p class="meter__note">${note}</p>` : ''}
  </div>`;
}

export function factorBars(parts, weights) {
  return html`<ul class="fbars" aria-label="Score breakdown">${FACTORS.filter((f) => parts[f.key] != null && (!weights || +weights[f.key] > 0)).map((f) => html`<li title="${f.label}: ${parts[f.key]}/100"><span class="fbars__lab">${f.short}</span><span class="fbars__track"><span class="fbars__fill fbars__fill--${scoreClass(parts[f.key])}" style="width:${parts[f.key]}%"></span></span></li>`)}</ul>`;
}

export function statList(items, cls = '') {
  return html`<dl class="stats ${cls}">${items.filter(Boolean).map((it) => html`<div class="stats__item"><dt>${it.label}</dt><dd>${it.value}${it.note ? html`<span class="stats__note">${it.note}</span>` : ''}</dd></div>`)}</dl>`;
}

export function breadcrumbs(ctx, items) {
  return html`<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map((it, i) => (i === items.length - 1 ? html`<li aria-current="page">${it.name}</li>` : html`<li><a href="${ctx.link(it.path)}">${it.name}</a></li>`))}</ol></nav>`;
}
export function breadcrumbLd(ctx, items) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: ctx.site.url + it.path })) };
}

export function faqBlock(items, title = 'Frequently asked questions') {
  return html`<section class="section faq" aria-labelledby="faq-h"><h2 id="faq-h">${title}</h2>
    <div class="faq__list">${items.map((q, i) => html`<details class="faq__item"${i === 0 ? raw(' open') : ''}><summary><h3>${q.q}</h3></summary><div class="faq__a">${q.html || html`<p>${q.a}</p>`}</div></details>`)}</div>
  </section>`;
}
export function faqLd(items) {
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map((q) => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } })) };
}

export function pageHead({ eyebrow, title, lede, children, cls = '', icon = null }) {
  const eb = eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : '';
  return html`<header class="pagehead ${cls}">
    ${icon ? html`<div class="pagehead__top">${iconTile(icon[0], icon[1])}${eb}</div>` : eb}
    <h1>${title}</h1>
    ${lede ? html`<p class="lede">${lede}</p>` : ''}
    ${children || ''}
  </header>`;
}

export function sourceNote(ctx, names) {
  return html`<p class="sourcenote">Sources: ${names.join(' · ')}. <a href="${ctx.link('/data-sources/')}">Licences and attribution</a> · <a href="${ctx.link('/methodology/')}">How we calculate</a></p>`;
}

export function visaPill(v, showDays = true) {
  if (!v) return html`<span class="pill pill--na">No data</span>`;
  const label = v.s === 'free' && v.days && showDays ? v.days + ' days visa-free' : STATUS[v.s].short;
  return html`<span class="pill pill--${v.s}">${label}</span>`;
}

export function toolGrid(ctx, exclude) {
  return html`<ul class="toolgrid">${TOOLS.filter((t) => t.key !== exclude).map((t) => html`<li><a class="toolcard tone-${t.tone}" href="${ctx.link(t.path)}">${iconTile(t.icon)}<span class="toolcard__name">${t.name}</span><span class="toolcard__desc">${toolDesc(ctx, t)}</span></a></li>`)}</ul>`;
}

/* ---------- Climate chart: temperature band (avg low to avg high) with mean line, and monthly rain bars ---------- */
const niceStep = (range) => (range <= 20 ? 5 : 10);
export function climateChart(city, { highlight = null } = {}) {
  const c = city.clim;
  const W = 680, padL = 44, padR = 14, tTop = 26, tBot = 156, rTop = 196, rBot = 272, H = 300;
  const bw = (W - padL - padR) / 12; const xc = (i) => padL + bw * (i + 0.5);
  const lo = Math.min(...c.lo.filter((v) => v != null)), hi = Math.max(...c.hi.filter((v) => v != null));
  const step = niceStep(hi - lo);
  const yMin = Math.floor((lo - 1) / step) * step, yMax = Math.ceil((hi + 1) / step) * step;
  const ty = (v) => tBot - ((v - yMin) / (yMax - yMin)) * (tBot - tTop);
  const rMaxRaw = Math.max(20, ...c.rain.map((v) => v ?? 0));
  const rStep = rMaxRaw > 300 ? 200 : rMaxRaw > 150 ? 100 : rMaxRaw > 60 ? 50 : 20;
  const rMax = Math.ceil(rMaxRaw / rStep) * rStep;
  const ry = (v) => rBot - (v / rMax) * (rBot - rTop);
  const ticks = []; for (let v = yMin; v <= yMax + 0.01; v += step) ticks.push(v);
  const rTicks = [0, rMax / 2, rMax];
  const band = 'M' + c.hi.map((v, i) => xc(i).toFixed(1) + ' ' + ty(v).toFixed(1)).join('L') + 'L' + c.lo.map((v, i) => xc(i).toFixed(1) + ' ' + ty(v).toFixed(1)).reverse().join('L') + 'Z';
  const mean = 'M' + c.t.map((v, i) => xc(i).toFixed(1) + ' ' + ty(v).toFixed(1)).join('L');
  const barW = bw * 0.62;
  const bar = (i) => { const v = c.rain[i] ?? 0; const x = xc(i) - barW / 2, y = ry(v), y0 = rBot; const r = Math.min(3, (y0 - y) / 2, barW / 2); return 'M' + x.toFixed(1) + ' ' + y0 + 'V' + (y + r).toFixed(1) + 'Q' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + (x + r).toFixed(1) + ' ' + y.toFixed(1) + 'H' + (x + barW - r).toFixed(1) + 'Q' + (x + barW).toFixed(1) + ' ' + y.toFixed(1) + ' ' + (x + barW).toFixed(1) + ' ' + (y + r).toFixed(1) + 'V' + y0 + 'Z'; };
  const id = 'clim-' + city.slug;
  const tip = (i) => MONTHS[i] + ': high ' + fmtTemp(c.hi[i]) + ', low ' + fmtTemp(c.lo[i]) + ', mean ' + fmtTemp(c.t[i]) + ' (' + fmtTemp(c.t[i], 'F') + '); rain ' + fmtMm(c.rain[i]) + '; humidity ' + fmtPct(c.rh[i]);
  return html`<figure class="chart climchart" data-chart="climate">
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d" preserveAspectRatio="xMidYMid meet">
    <title id="${id}-t">Average climate in ${city.name} by month</title>
    <desc id="${id}-d">Temperature band from average daily low to average daily high, with the daily mean as a line; monthly rainfall as bars. ${MONTHS.map((m, i) => tip(i)).join('. ')}.</desc>
    <text class="ch-title" x="${padL}" y="14">Temperature, °C</text>
    ${ticks.map((v) => html`<line class="ch-grid" x1="${padL}" x2="${W - padR}" y1="${ty(v).toFixed(1)}" y2="${ty(v).toFixed(1)}"/><text class="ch-ylab" x="${padL - 8}" y="${(ty(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`)}
    ${highlight != null ? html`<rect class="ch-hl" x="${(padL + bw * highlight).toFixed(1)}" y="${tTop - 8}" width="${bw.toFixed(1)}" height="${rBot - tTop + 8}"/>` : ''}
    <path class="ch-band" d="${band}"/>
    <path class="ch-mean" d="${mean}"/>
    <text class="ch-title" x="${padL}" y="${rTop - 14}">Rain, mm per month</text>
    ${rTicks.map((v) => html`<line class="ch-grid" x1="${padL}" x2="${W - padR}" y1="${ry(v).toFixed(1)}" y2="${ry(v).toFixed(1)}"/><text class="ch-ylab" x="${padL - 8}" y="${(ry(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`)}
    ${c.rain.map((_, i) => html`<path class="ch-bar" d="${bar(i)}"/>`)}
    ${MONTHS_SHORT.map((m, i) => html`<text class="ch-xlab" x="${xc(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${m}</text>`)}
    ${c.t.map((_, i) => html`<rect class="ch-hit" data-i="${i}" x="${(padL + bw * i).toFixed(1)}" y="${tTop - 8}" width="${bw.toFixed(1)}" height="${rBot - tTop + 8}"><title>${tip(i)}</title></rect>`)}
  </svg>
  <figcaption class="chart__legend"><span class="key key--band"></span>Average daily low to high <span class="key key--line"></span>Daily mean <span class="key key--bar"></span>Rainfall</figcaption>
  <div class="chart__tip" hidden></div>
  <script type="application/json" class="chart__data">${raw(scriptJson({ t: c.t, hi: c.hi, lo: c.lo, rain: c.rain, rh: c.rh }))}</script>
</figure>`;
}

export function climateTable(city) {
  const c = city.clim;
  return html`<div class="tablewrap"><table class="table table--compact">
    <caption>Monthly climate averages for ${city.name} (temperatures 2015 to 2024; rain and humidity 2001 to 2025)</caption>
    <thead><tr><th scope="col">Month</th><th scope="col" class="num">High</th><th scope="col" class="num">Low</th><th scope="col" class="num">Rain</th><th scope="col" class="num">Humidity</th><th scope="col">Conditions</th><th scope="col" class="num">Comfort</th></tr></thead>
    <tbody>${MONTHS.map((m, i) => html`<tr><th scope="row">${m}</th><td class="num" title="${fmtTemp(c.hi[i], 'F')}">${fmtTemp(c.hi[i])}</td><td class="num" title="${fmtTemp(c.lo[i], 'F')}">${fmtTemp(c.lo[i])}</td><td class="num">${fmtMm(c.rain[i])}</td><td class="num">${fmtPct(c.rh[i])}</td><td>${describe(c, i)}</td><td class="num">${scoreChip(comfort(c, i), 'Comfort')}</td></tr>`)}</tbody>
  </table></div>`;
}

/** Generic sortable table. columns: [{label, num, sortable=true}], rows: [{cells:[html], sort:[values]}] */
export function dataTable({ caption, columns, rows, id, cls = '' }) {
  return html`<div class="tablewrap"><table class="table ${cls}" data-sortable${id ? raw(' id="' + esc(id) + '"') : ''}>
    ${caption ? html`<caption>${caption}</caption>` : ''}
    <thead><tr>${columns.map((c, i) => html`<th scope="col" class="${c.num ? 'num' : ''}"${c.sortable === false ? '' : raw(' data-col="' + i + '"')}${c.sortable === false ? '' : raw(' aria-sort="none"')}>${c.sortable === false ? c.label : html`<button type="button" class="sortbtn">${c.label}</button>`}</th>`)}</tr></thead>
    <tbody>${rows.map((r) => html`<tr${r.attrs ? raw(' ' + r.attrs) : ''}>${r.cells.map((cell, i) => (i === 0 && r.th !== false ? html`<th scope="row" data-sort="${r.sort?.[i] ?? ''}">${cell}</th>` : html`<td class="${columns[i]?.num ? 'num' : ''}" data-sort="${r.sort?.[i] ?? ''}">${cell}</td>`))}</tr>`)}</tbody>
  </table></div>`;
}

export function cityLink(ctx, c, { country = true } = {}) {
  return html`<a href="${ctx.link(cityPath(c))}">${cityLabel(c)}</a>${country && inCountry(c) ? html`<span class="muted">${inCountry(c)}</span>` : ''}`;
}

export function cityCards(ctx, cities, sub) {
  return html`<ul class="cards">${cities.map((c) => html`<li><a class="citycard" href="${ctx.link(cityPath(c))}">
    <span class="citycard__top"><span class="citycard__name">${cityLabel(c)}</span>${scoreChip(c.score, 'NomadAtlas score')}</span>
    <span class="citycard__country">${c.country.name}</span>
    <span class="citycard__sub">${sub ? sub(c) : html`${fmtMoney(c.costComfort)}/mo · ${c.country.net?.down ? fmtNum(c.country.net.down) + ' Mbps' : 'Internet n/a'}`}</span>
  </a></li>`)}</ul>`;
}

/** First candidate that fits (search titles ~65 chars). */
export const fitTitle = (cands, max = 65) => cands.find((t) => t && t.length <= max) || cands[cands.length - 1];
/** Join sentence parts, dropping optional trailing parts until it fits (meta descriptions ~160 chars). */
export function fitDesc(parts, max = 160) {
  const p = parts.filter(Boolean);
  while (p.length > 1 && p.join(' ').length > max) p.pop();
  let s = p.join(' ');
  if (s.length > max) s = s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
  return s;
}
export const median = (arr) => { const a = arr.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
