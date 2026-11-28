import { html } from '../html.mjs';
import { fmtNum, listJoin, an } from '../../shared/format.mjs';
import { stayLabel, rankPassports } from '../../shared/visa.mjs';
import { SCHENGEN, EU_NON_SCHENGEN } from '../../shared/schengen.mjs';
import { fitTitle, fitDesc, faqBlock, faqLd, sourceNote, passportPath, countryPath, cityCards, visaPill } from '../components.mjs';
import { shell, crumbsLd } from './common.mjs';
import { visaForm, visaResults, visaSummary, MAP_LEGEND } from '../tools/visa.mjs';

const EASY = new Set(['free', 'voa', 'eta']);
const isEasy = (x) => !!x && EASY.has(x.s);
const val = (x) => (Array.isArray(x) ? x[0] : x ?? null);
const ranking = (db) => (db._passportRank ||= rankPassports(db.countries, db.visa));
/** Share of passports that can enter a country without a visa in advance, worked out once per country. */
function openShare(db, iso3) {
  const m = (db._openShare ||= new Map());
  if (!m.has(iso3)) m.set(iso3, db.visa.openness(iso3) / Math.max(1, db.visa.codes.length - 1));
  return m.get(iso3);
}

/**
 * The passports a passport is most naturally compared with: its land neighbours (the six most populous), or for islands and
 * countries with one neighbour, the four passports in the same region with the closest number of easy-access destinations.
 */
function peersOf(db, k) {
  const v = db.visa, rank = ranking(db);
  let peers = (k.neighbours || []).map((i) => db.byIso3.get(i)).filter((c) => c && v.has(c.iso3)), kind = 'neighbours';
  if (peers.length < 2) {
    const mine = rank.find((r) => r.c === k);
    const near = (list) => list.filter((r) => r.c !== k).sort((a, b) => Math.abs(a.n.easy - mine.n.easy) - Math.abs(b.n.easy - mine.n.easy) || a.c.name.localeCompare(b.c.name)).slice(0, 4).map((r) => r.c);
    peers = near(rank.filter((r) => r.c.region === k.region)); kind = 'region';
    if (peers.length < 2) { peers = near(rank); kind = 'rank'; } // a region with one other passport (North America)
  }
  peers = peers.sort((a, b) => (val(b.ind?.population) ?? 0) - (val(a.ind?.population) ?? 0)).slice(0, 6).sort((a, b) => a.name.localeCompare(b.name));
  return { peers, kind };
}

/** Where this passport gets in easily but most of its peers don't (edges), and the reverse (gaps). */
function compareWithPeers(db, k, peers) {
  const v = db.visa, edges = [], gaps = [];
  for (const d of db.countries) {
    if (d === k || !v.has(d.iso3)) continue;
    const mine = v.get(k.iso3, d.iso3);
    if (!mine || mine.s === 'home') continue;
    const theirs = peers.filter((p) => p !== d).map((p) => v.get(p.iso3, d.iso3)).filter((x) => x && x.s !== 'home');
    if (theirs.length < 2) continue;
    const easyN = theirs.filter(isEasy).length, row = { d, mine, easyN, of: theirs.length };
    if (isEasy(mine) && easyN * 2 < theirs.length) edges.push(row);
    else if (!isEasy(mine) && mine.s !== 'banned' && easyN * 2 > theirs.length) gaps.push(row);
  }
  const order = (a, b) => (b.d.cities.length > 0) - (a.d.cities.length > 0) || a.d.name.localeCompare(b.d.name);
  return { edges: edges.sort((a, b) => a.easyN - b.easyN || order(a, b)), gaps: gaps.sort((a, b) => b.easyN - a.easyN || order(a, b)) };
}

function peerSection(ctx, k) {
  const db = ctx.db, { peers, kind } = peersOf(db, k);
  if (peers.length < 2) return '';
  const { edges, gaps } = compareWithPeers(db, k, peers);
  const rank = ranking(db), mine = rank.find((r) => r.c === k);
  const who = kind === 'neighbours' ? 'its neighbours' : kind === 'region' ? 'similar passports in ' + k.region : 'passports with similar reach';
  const names = listJoin(peers.map((p) => p.name));
  const peerWord = kind === 'neighbours' ? 'neighbours' : 'of these passports';
  const list = (rows, cap = 12) => html`<ul class="vlist vlist--peer">${rows.slice(0, cap).map((r) => html`<li><a href="${ctx.link(countryPath(r.d))}">${r.d.name}</a>${visaPill(r.mine)}<span class="vlist__d">${r.easyN} of ${r.of} ${peerWord} enter easily</span></li>`)}</ul>${rows.length > cap ? html`<p class="hint">And ${rows.length - cap} more.</p>` : ''}`;
  return html`<section class="section" aria-labelledby="peer-h">
  <h2 id="peer-h">How the ${k.name} passport compares with ${who}</h2>
  <p>${k.name} passports rank <b>#${mine.rank} of ${rank.length}</b> for access without a visa in advance (${mine.n.easy} destinations). Compared with passports from ${names}, they get easier entry to <b>${edges.length}</b> destination${edges.length === 1 ? '' : 's'} and harder entry to <b>${gaps.length}</b>.${!edges.length && !gaps.length ? ' On this data they open the same doors: wherever most of these passports enter without a visa in advance, so does this one, and the reverse.' : ''}</p>
  ${edges.length || gaps.length ? html`<div class="cols cols--peer">
    ${edges.length ? html`<div><h3>Easier with ${an(k.name)} passport</h3>${list(edges)}</div>` : ''}
    ${gaps.length ? html`<div><h3>Harder with ${an(k.name)} passport</h3>${list(gaps)}</div>` : ''}
  </div>` : ''}
  <p class="hint">“Enter easily” means visa-free, a visa on arrival or an electronic travel authorisation (eTA).</p>
</section>`;
}

export function passportPage(ctx, k) {
  const db = ctx.db; const v = db.visa;
  const n = v.counts([k.iso3]);
  // Destinations that refuse entry outright, so the counts below add up to every destination.
  const bannedTxt = n.banned ? ' ' + n.banned + (n.banned === 1 ? ' destination does' : ' destinations do') + ' not admit ' + k.name + ' passport holders at all.' : '';
  const s = { p1: k.iso3, p2: '', status: '', region: '', q: '' };
  const longest = db.countries.filter((c) => c !== k && v.has(c.iso3)).map((c) => ({ c, x: v.get(k.iso3, c.iso3) })).filter((r) => r.x?.s === 'free' && r.x.days).sort((a, b) => b.x.days - a.x.days || a.c.name.localeCompare(b.c.name)).slice(0, 8);
  const easyCities = db.citiesRanked.filter((c) => c.iso3 !== k.iso3 && ['free', 'voa', 'eta'].includes(v.get(k.iso3, c.iso3)?.s)).slice(0, 8);
  // Cities this passport enters easily although most passports can't: the access that sets it apart.
  const rareCities = db.citiesRanked.filter((c) => c.iso3 !== k.iso3 && isEasy(v.get(k.iso3, c.iso3)) && openShare(db, c.iso3) < 0.5)
    .sort((a, b) => openShare(db, a.iso3) - openShare(db, b.iso3) || a.rank - b.rank).filter((c, i, arr) => arr.findIndex((x) => x.iso3 === c.iso3) === i).slice(0, 8);
  const sch = v.get(k.iso3, 'PRT');
  const schTxt = SCHENGEN.includes(k.iso3) ? 'As a Schengen country national you have freedom of movement in the Schengen Area.' : EU_NON_SCHENGEN.includes(k.iso3) ? 'As an EU citizen you have freedom of movement in the Schengen Area, so the 90 days in 180 limit does not apply to you, although your country is not itself in Schengen.' : sch?.s === 'free' ? 'You can stay in the Schengen Area visa-free for up to 90 days in any 180-day period, counted across all 29 member countries together.' : 'You need a Schengen visa for most stays in the Schengen Area.';
  const faq = [
    { q: `How many countries can ${k.name} passport holders visit without a visa?`, a: `${n.easy} destinations: ${n.free} visa-free, ${n.voa} with a visa on arrival and ${n.eta} with an electronic travel authorisation (eTA). Another ${n.evisa} offer an e-visa you apply for online, and ${n.required} require a visa in advance.${bannedTxt}` },
    { q: `Can ${k.name} citizens travel to Europe without a visa?`, a: schTxt + ' Track your days with the Schengen 90/180 calculator.' },
    longest.length && { q: `Where can ${k.name} passport holders stay the longest without a visa?`, a: `The longest visa-free stays are in ${listJoin(longest.slice(0, 5).map((r) => r.c.name + ' (' + r.x.days + ' days)'))}.` },
    { q: 'How up to date is this visa information?', a: `The visa matrix comes from Passport Index Data, last updated ${v.updated}. Visa policies change often, so confirm with the destination's official government website before you travel.` },
  ].filter(Boolean);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Visa-free countries', path: '/visa-free-countries/' }, { name: k.name + ' passport', path: passportPath(k) }];
  const body = shell(ctx, crumbs, html`
<header class="pagehead">
  <p class="eyebrow">Passport · Data updated ${v.updated}</p>
  <h1>Visa-free countries for ${k.name} passport holders</h1>
  <p class="lede">With a passport from ${k.name} you can visit <b>${n.easy} destinations</b> without applying for a visa in advance: ${n.free} visa-free, ${n.voa} with a visa on arrival and ${n.eta} with an electronic travel authorisation. You need an e-visa for ${n.evisa} and a visa for ${n.required}.${bannedTxt}</p>
</header>
<section class="section" data-tool="visa" aria-labelledby="visa-tool-h">
  <h2 id="visa-tool-h" class="sr">Where ${k.name} passport holders can go</h2>
  <div data-summary>${visaSummary(ctx, s)}</div>
  <div class="worldmap" data-map="visa" aria-hidden="true"><div class="worldmap__ph">Loading map…</div></div>
  ${MAP_LEGEND}
  ${visaForm(ctx, s)}
  <div class="results" data-results aria-live="polite">${visaResults(ctx, s)}</div>
</section>
${peerSection(ctx, k)}
${rareCities.length >= 3 ? html`<section class="section"><h2>Where ${an(k.name)} passport opens doors most can’t</h2><p>Remote-work cities that ${k.name} passport holders can enter without a visa in advance, although most of the world’s passports need one. One city per country, rarest access first.</p>${cityCards(ctx, rareCities, (c) => stayLabel(v.get(k.iso3, c.iso3)) + ' · only ' + Math.round(openShare(db, c.iso3) * 100) + '% of passports')}</section>` : ''}
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
