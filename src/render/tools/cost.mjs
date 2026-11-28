import { html, raw } from '../html.mjs';
import { fmtMoney, fmtNum, fmtSignedPct } from '../../shared/format.mjs';
import { CATEGORIES, LIFESTYLES, CURRENCIES, priceIndex, translate, toCur, basketTotal } from '../../shared/cost.mjs';
import { countryOptions } from './match.mjs';
import { countryPath, dataTable } from '../components.mjs';

export const step = (cur) => (['JPY', 'KRW', 'IDR', 'HUF', 'ISK', 'INR', 'PHP', 'THB', 'CZK', 'MXN', 'ZAR', 'TRY'].includes(cur) ? 100 : 10);
export function costAmounts(ctx, from, life, cur) {
  const home = ctx.db.byIso3.get(from); const basket = (LIFESTYLES[life] || LIFESTYLES.comfortable).basket;
  return Object.fromEntries(CATEGORIES.map((cat) => {
    const usd = (basket[cat.key] * (priceIndex(home, cat) ?? 100)) / 100;
    const v = toCur(usd, cur, ctx.db.rates); const st = step(cur);
    return [cat.key, Math.round(v / st) * st];
  }));
}
export const costDefaults = (ctx) => ({ from: 'USA', to: 'PRT', cur: 'USD', life: 'comfortable', ...costAmounts(ctx, 'USA', 'comfortable', 'USD') });

export function costForm(ctx, s) {
  const sel = (a, b) => (a === b ? raw(' selected') : '');
  const priced = (v, none) => countryOptions(ctx, v, none);
  return html`<form class="panel costform" data-form autocomplete="off">
    <div class="costform__top">
      <div class="field"><label for="c-from">I live in</label><select id="c-from" name="from">${priced(s.from, 'Choose a country')}</select></div>
      <div class="field"><label for="c-to">Thinking of moving to</label><select id="c-to" name="to">${priced(s.to, 'Choose a country')}</select></div>
      <div class="field"><label for="c-cur">Currency</label><select id="c-cur" name="cur">${CURRENCIES.map((c) => html`<option${sel(c, s.cur)}>${c}</option>`)}</select></div>
      <fieldset class="field seg"><legend>Fill in typical spending</legend><div class="seg__opts">${Object.entries(LIFESTYLES).map(([k, l]) => html`<label class="seg__opt" title="${l.desc}"><input type="radio" name="life" value="${k}"${k === s.life ? raw(' checked') : ''}><span>${l.label}</span></label>`)}</div></fieldset>
    </div>
    <fieldset class="costform__amounts"><legend>What you spend in a month now</legend><div class="costform__grid">
      ${CATEGORIES.map((cat) => html`<div class="amount"><label for="c-${cat.key}">${cat.label}<small>${cat.desc}</small></label><input id="c-${cat.key}" name="${cat.key}" type="number" inputmode="numeric" min="0" step="10" value="${s[cat.key]}"></div>`)}
    </div></fieldset>
  </form>`;
}

export function costResults(ctx, s) {
  const db = ctx.db; const home = db.byIso3.get(s.from), dest = db.byIso3.get(s.to); const cur = s.cur;
  const money = (v) => fmtMoney(v, cur, step(cur));
  if (!home?.pli) return html`<div class="empty"><p>Pick a home country with price data to start.</p></div>`;
  const spend = Object.fromEntries(CATEGORIES.map((c) => [c.key, +s[c.key] || 0]));
  if (!(basketTotal(spend) > 0)) return html`<div class="empty"><p>Enter what you spend in a month to compare it with other countries.</p></div>`;
  const t = dest?.pli ? translate(spend, home, dest) : null;
  const all = db.countries.filter((c) => c.pli && c !== home).map((c) => ({ c, r: translate(spend, home, c) })).sort((a, b) => a.r.total - b.r.total);
  const head = t ? html`<div class="costhead">
      <p class="costhead__line">The same lifestyle costs about <b>${money(t.total)}</b> a month in ${dest.name}, <b class="${t.ratio < 1 ? 'good' : 'bad'}">${fmtSignedPct((t.ratio - 1) * 100)}</b> compared with ${money(t.homeTotal)} in ${home.name}.</p>
      <p class="costhead__sub">${t.ratio < 1 ? 'Your money goes ' + fmtNum(1 / t.ratio, 1) + '× as far.' : 'You would need ' + fmtNum(t.ratio, 2) + '× your current budget.'} Rent and eating out usually move the most.</p>
    </div>
    <div class="tablewrap"><table class="table table--cost"><caption>${home.name} compared with ${dest.name}, ${cur} per month</caption>
      <thead><tr><th scope="col">Category</th><th scope="col" class="num">${home.name}</th><th scope="col" class="num">${dest.name}</th><th scope="col" class="num">Difference</th><th scope="col" class="barcol"><span class="sr">Relative price</span></th></tr></thead>
      <tbody>${t.lines.map((l) => html`<tr><th scope="row">${l.label}</th><td class="num">${money(l.home)}</td><td class="num">${money(l.value)}</td><td class="num ${l.ratio < 0.995 ? 'good' : l.ratio > 1.005 ? 'bad' : ''}">${fmtSignedPct((l.ratio - 1) * 100)}</td><td class="barcol"><span class="ratiobar" style="--ratio:${Math.min(2, l.ratio).toFixed(3)}" title="${fmtNum(l.ratio * 100)}% of ${home.name} prices"></span></td></tr>`)}</tbody>
      <tfoot><tr><th scope="row">Total</th><td class="num"><b>${money(t.homeTotal)}</b></td><td class="num"><b>${money(t.total)}</b></td><td class="num">${fmtSignedPct((t.ratio - 1) * 100)}</td><td></td></tr></tfoot>
    </table></div>` : html`<div class="empty"><p>Choose a destination with price data to see a side-by-side breakdown.</p></div>`;
  return html`${head}
    <h3 class="h3gap">The same lifestyle in every country</h3>
    ${dataTable({ caption: 'Monthly cost of your current spending, re-priced for each country (' + cur + ')', id: 'cost-all',
      columns: [{ label: 'Country' }, { label: 'Region' }, { label: 'Monthly cost', num: true }, { label: 'vs ' + home.name, num: true }],
      rows: all.map(({ c, r }) => ({ cells: [html`<a href="${ctx.link(countryPath(c))}">${c.name}</a>`, c.region, money(r.total), fmtSignedPct((r.ratio - 1) * 100)], sort: [c.name, c.region, Math.round(r.total), Math.round(r.ratio * 1000)], attrs: c === dest ? 'class="is-current"' : '' })) })}`;
}
