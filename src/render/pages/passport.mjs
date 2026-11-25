import { html } from '../html.mjs';
import { fmtNum, listJoin } from '../../shared/format.mjs';
import { stayLabel } from '../../shared/visa.mjs';
import { SCHENGEN } from '../../shared/schengen.mjs';
import { fitTitle, fitDesc, faqBlock, faqLd, sourceNote, passportPath, countryPath, cityCards } from '../components.mjs';
import { shell, crumbsLd } from './common.mjs';
import { visaForm, visaResults, visaSummary, MAP_LEGEND } from '../tools/visa.mjs';

export function passportPage(ctx, k) {
  const db = ctx.db; const v = db.visa;
  const n = v.counts([k.iso3]);
  const s = { p1: k.iso3, p2: '', status: '', region: '', q: '' };
  const longest = db.countries.filter((c) => c !== k && v.has(c.iso3)).map((c) => ({ c, x: v.get(k.iso3, c.iso3) })).filter((r) => r.x?.s === 'free' && r.x.days).sort((a, b) => b.x.days - a.x.days || a.c.name.localeCompare(b.c.name)).slice(0, 8);
  const easyCities = db.citiesRanked.filter((c) => c.iso3 !== k.iso3 && ['free', 'voa', 'eta'].includes(v.get(k.iso3, c.iso3)?.s)).slice(0, 8);
  const sch = v.get(k.iso3, 'PRT');
  const schTxt = SCHENGEN.includes(k.iso3) ? 'As a Schengen country national you have freedom of movement in the Schengen Area.' : sch?.s === 'free' ? 'You can stay in the Schengen Area visa-free for up to 90 days in any 180-day period, counted across all 29 member countries together.' : 'You need a Schengen visa for most stays in the Schengen Area.';
  const faq = [
    { q: `How many countries can ${k.name} passport holders visit without a visa?`, a: `${n.easy} destinations: ${n.free} visa-free, ${n.voa} with a visa on arrival and ${n.eta} with an electronic travel authorisation (eTA). Another ${n.evisa} offer an e-visa you apply for online, and ${n.required} require a visa in advance.` },
    { q: `Can ${k.name} citizens travel to Europe without a visa?`, a: schTxt + ' Track your days with the Schengen 90/180 calculator.' },
    longest.length && { q: `Where can ${k.name} passport holders stay the longest without a visa?`, a: `The longest visa-free stays are in ${listJoin(longest.slice(0, 5).map((r) => r.c.name + ' (' + r.x.days + ' days)'))}.` },
    { q: 'How up to date is this visa information?', a: `The visa matrix comes from Passport Index Data, last updated ${v.updated}. Visa policies change often, so confirm with the destination's official government website before you travel.` },
  ].filter(Boolean);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Visa-free countries', path: '/visa-free-countries/' }, { name: k.name + ' passport', path: passportPath(k) }];
  const body = shell(ctx, crumbs, html`
<header class="pagehead">
  <p class="eyebrow">Passport · Data updated ${v.updated}</p>
  <h1>Visa-free countries for ${k.name} passport holders</h1>
  <p class="lede">With a passport from ${k.name} you can visit <b>${n.easy} destinations</b> without applying for a visa in advance: ${n.free} visa-free, ${n.voa} with a visa on arrival and ${n.eta} with an electronic travel authorisation. You need an e-visa for ${n.evisa} and a visa for ${n.required}.</p>
</header>
<section class="section" data-tool="visa" aria-label="Visa checker">
  <div data-summary>${visaSummary(ctx, s)}</div>
  <div class="worldmap" data-map="visa" aria-hidden="true"><div class="worldmap__ph">Loading map…</div></div>
  ${MAP_LEGEND}
  ${visaForm(ctx, s)}
  <div class="results" data-results aria-live="polite">${visaResults(ctx, s)}</div>
</section>
${longest.length ? html`<section class="section"><h2>Longest visa-free stays</h2><ul class="vlist vlist--rank">${longest.map((r) => html`<li><a href="${ctx.link(countryPath(r.c))}">${r.c.name}</a><span class="muted">${r.x.days} days</span></li>`)}</ul></section>` : ''}
${easyCities.length ? html`<section class="section"><h2>Top remote-work cities you can enter easily</h2>${cityCards(ctx, easyCities, (c) => stayLabel(v.get(k.iso3, c.iso3)))}</section>` : ''}
${faqBlock(faq)}
${sourceNote(ctx, ['Passport Index Data (MIT)', 'Natural Earth'])}
`);
  return {
    path: passportPath(k),
    title: fitTitle([`Visa-Free Countries for ${k.name} Passport Holders (${ctx.year})`, `${k.name} Passport: Visa-Free Countries (${ctx.year})`, `${k.name} Passport Visa-Free List`]),
    description: fitDesc([`${k.name} passport holders can visit ${n.easy} destinations without a visa in advance: ${n.free} visa-free, ${n.voa} on arrival, ${n.eta} eTA.`, 'Full list with stay lengths and a world map.']),
    jsonld: [crumbsLd(ctx, crumbs), faqLd(faq)],
    body, priority: 0.7, changefreq: 'monthly',
  };
}
