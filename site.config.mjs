// Site-wide configuration. Set SITE_URL to your production origin before deploying (used for canonical URLs, sitemap and Open Graph).
export const SITE = {
  name: 'NomadAtlas',
  url: (globalThis.process?.env?.SITE_URL || 'https://www.example.com').replace(/\/$/, ''),
  tagline: 'Open-data calculators for choosing where to live and work remotely',
  description: 'Free calculators that match digital nomads to cities by budget, passport, time zone, weather, internet, safety and healthcare, built on open data from the World Bank, NASA, GeoNames and more.',
  locale: 'en_US',
  twitter: null,
  defaultCurrency: 'USD',
};
