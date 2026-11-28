// Site-wide configuration. Set SITE_URL to your production origin before deploying (used for canonical URLs, sitemap and Open Graph).
// Pages load /assets/... from the domain root, so the site has to live at the root of an http(s) origin.
function siteUrl(s) {
  let u; try { u = new URL(s); } catch { throw new Error('SITE_URL is not a valid URL: ' + s); }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error('SITE_URL must be just an origin, such as https://your-domain.com (got ' + s + ')');
  return u.origin;
}
export const SITE = {
  name: 'NomadAtlas',
  url: siteUrl((globalThis.process?.env?.SITE_URL || 'https://www.example.com').trim()),
  tagline: 'Open-data calculators for choosing where to live and work remotely',
  description: 'Free calculators that match digital nomads to cities by budget, passport, time zone, weather, internet, safety and healthcare, built on open data from the World Bank, NASA, GeoNames and more.',
  locale: 'en_GB', // the copy uses British spelling (colour, licence, authorisation)
  twitter: null,
  defaultCurrency: 'USD',
};
