import { MONTH_SLUGS } from '../../shared/format.mjs';
import { homePage } from './home.mjs';
import { cityPage } from './city.mjs';
import { countryPage } from './country.mjs';
import { passportPage } from './passport.mjs';
import { monthPage } from './month.mjs';
import { costPage, visaIndexPage, schengenPage, timezonePage, weatherPage, flightPage } from './tools.mjs';
import { citiesIndexPage, countriesIndexPage } from './indexes.mjs';
import { methodologyPage, dataSourcesPage, aboutPage, privacyPage, notFoundPage } from './info.mjs';

const STATIC = {
  '/': homePage, '/cost-of-living-calculator/': costPage, '/visa-free-countries/': visaIndexPage, '/schengen-calculator/': schengenPage,
  '/time-zone-overlap-calculator/': timezonePage, '/where-to-go/': weatherPage, '/flight-carbon-calculator/': flightPage,
  '/cities/': citiesIndexPage, '/countries/': countriesIndexPage, '/methodology/': methodologyPage, '/data-sources/': dataSourcesPage,
  '/about/': aboutPage, '/privacy/': privacyPage,
};

/** Every indexable path, in sitemap order. */
export function allPaths(db) {
  return [
    ...Object.keys(STATIC),
    ...db.citiesRanked.map((c) => '/cities/' + c.slug + '/'),
    ...MONTH_SLUGS.map((m) => '/where-to-go/' + m + '/'),
    ...[...db.countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => '/countries/' + c.slug + '/'),
    ...[...db.countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => '/visa-free-countries/' + c.slug + '/'),
  ];
}

/** Render a page for a path, or null. */
export function renderPath(ctx, path) {
  const p = path.replace(/[?#].*$/, '');
  if (STATIC[p]) return STATIC[p](ctx);
  if (p === '/404.html') return notFoundPage(ctx);
  let m;
  if ((m = p.match(/^\/cities\/([a-z0-9-]+)\/$/))) { const c = ctx.db.cityBySlug.get(m[1]); return c ? cityPage(ctx, c) : null; }
  if ((m = p.match(/^\/countries\/([a-z0-9-]+)\/$/))) { const c = ctx.db.countryBySlug.get(m[1]); return c ? countryPage(ctx, c) : null; }
  if ((m = p.match(/^\/visa-free-countries\/([a-z0-9-]+)\/$/))) { const c = ctx.db.countryBySlug.get(m[1]); return c && ctx.db.visa.has(c.iso3) ? passportPage(ctx, c) : null; }
  if ((m = p.match(/^\/where-to-go\/([a-z]+)\/$/))) { const i = MONTH_SLUGS.indexOf(m[1]); return i >= 0 ? monthPage(ctx, i) : null; }
  return null;
}
export { notFoundPage };
