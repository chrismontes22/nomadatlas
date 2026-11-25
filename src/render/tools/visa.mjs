import { html, raw } from '../html.mjs';
import { STATUS, STATUS_ORDER, stayLabel } from '../../shared/visa.mjs';
import { fmtNum } from '../../shared/format.mjs';
import { countryOptions } from './match.mjs';
import { countryPath, passportPath } from '../components.mjs';

export const visaDefaults = () => ({ p1: '', p2: '', status: '', region: '', q: '' });

export function visaForm(ctx, s, { fixed = false } = {}) {
  const sel = (a, b) => (a === b ? raw(' selected') : '');
  return html`<form class="panel visaform" data-form autocomplete="off">
    <div class="field"><label for="v-p1">Passport</label><select id="v-p1" name="p1">${countryOptions(ctx, s.p1, 'Choose your passport')}</select></div>
    <div class="field"><label for="v-p2">Second passport (optional)</label><select id="v-p2" name="p2">${countryOptions(ctx, s.p2, 'None')}</select></div>
    <div class="field"><label for="v-status">Show</label><select id="v-status" name="status"><option value="">All destinations</option><option value="easy"${sel('easy', s.status)}>No visa needed in advance</option>${STATUS_ORDER.map((k) => html`<option value="${k}"${sel(k, s.status)}>${STATUS[k].label}</option>`)}</select></div>
    <div class="field"><label for="v-region">Region</label><select id="v-region" name="region"><option value="">All regions</option>${ctx.db.regions.map((r) => html`<option${sel(r, s.region)}>${r}</option>`)}</select></div>
    <div class="field"><label for="v-q">Search a destination</label><input id="v-q" name="q" type="search" value="${s.q}" placeholder="e.g. Japan"></div>
  </form>`;
}

export function visaRows(ctx, s) {
  const pp = [s.p1, s.p2].filter(Boolean);
  const v = ctx.db.visa;
  return ctx.db.countries.filter((c) => v.has(c.iso3) && !pp.includes(c.iso3)).map((c) => ({ c, v: v.best(pp, c.iso3) })).filter((r) => r.v);
}

const easy = (s) => s === 'free' || s === 'voa' || s === 'eta';

export function visaSummary(ctx, s) {
  const pp = [s.p1, s.p2].filter(Boolean);
  const n = ctx.db.visa.counts(pp);
  return html`<div class="vsum">
    <div class="vsum__big"><span class="vsum__n">${n.easy}</span><span class="vsum__l">destinations without applying for a visa in advance</span></div>
    <ul class="vsum__list">${STATUS_ORDER.filter((k) => n[k] || k !== 'banned').map((k) => html`<li><span class="pill pill--${k}">${STATUS[k].label}</span><b>${n[k]}</b></li>`)}</ul>
  </div>`;
}

export function visaResults(ctx, s) {
  const pp = [s.p1, s.p2].filter(Boolean);
  if (!pp.length) {
    const open = ctx.db.countries.filter((c) => ctx.db.visa.has(c.iso3)).map((c) => ({ c, n: ctx.db.visa.openness(c.iso3) })).sort((a, b) => b.n - a.n).slice(0, 24);
    return html`<div class="empty"><p><b>Choose a passport</b> to see every destination it opens. Until then, here are the destinations that let the most passports in without a visa in advance.</p></div>
      <ol class="vlist vlist--rank">${open.map(({ c, n }) => html`<li><a href="${ctx.link(countryPath(c))}">${c.name}</a><span class="muted">${n} passports</span></li>`)}</ol>`;
  }
  const q = (s.q || '').trim().toLowerCase();
  const rows = visaRows(ctx, s).filter((r) => (!s.region || r.c.region === s.region) && (!q || r.c.name.toLowerCase().includes(q) || (r.c.aka || '').toLowerCase().includes(q)) && (!s.status || (s.status === 'easy' ? easy(r.v.s) : r.v.s === s.status)));
  const groups = STATUS_ORDER.map((k) => [k, rows.filter((r) => r.v.s === k).sort((a, b) => (k === 'free' ? (b.v.days ?? 999) - (a.v.days ?? 999) || a.c.name.localeCompare(b.c.name) : a.c.name.localeCompare(b.c.name)))]).filter(([, r]) => r.length);
  const by = (r) => (pp.length > 1 && r.v.from ? html` <span class="muted">via ${ctx.db.byIso3.get(r.v.from)?.name}</span>` : '');
  return html`<p class="results__summary"><b>${rows.length}</b> destinations shown</p>
    ${groups.length ? groups.map(([k, list]) => html`<section class="vgroup vgroup--${k}"><h3><span class="pill pill--${k}">${STATUS[k].label}</span> <span class="muted">${list.length}</span></h3>
      <ul class="vlist">${list.map((r) => html`<li><a href="${ctx.link(countryPath(r.c))}">${r.c.name}</a><span class="vlist__d">${k === 'free' ? (r.v.days ? r.v.days + ' days' : 'No fixed limit') : ''}${r.c.cities.length ? html` · ${r.c.cities.length} ${r.c.cities.length === 1 ? 'city' : 'cities'}` : ''}${by(r)}</span></li>`)}</ul></section>`) : html`<div class="empty"><p>No destinations match these filters.</p></div>`}`;
}

export const MAP_LEGEND = html`<ul class="maplegend" aria-label="Map legend">${['free', 'voa', 'eta', 'evisa', 'required', 'banned'].map((k) => html`<li><span class="swatch swatch--${k}"></span>${STATUS[k].label}</li>`)}<li><span class="swatch swatch--home"></span>Your passport</li></ul>`;
