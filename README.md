# NomadAtlas

Open-data calculators that help digital nomads decide where to live and work. It's a static site with about 610 pre-rendered, SEO-ready pages and no backend, accounts or tracking.

## What's inside

| Tool | URL | What it does |
|---|---|---|
| Destination finder | `/` | Ranks 184 cities by your budget, lifestyle, month, passports (up to two), team time zone and priority weights |
| Nomad year planner | `/nomad-year-planner/` | Plans a year across several cities: total living costs, flight CO₂, weather month by month, visa-free limits and the Schengen 90/180 rule, with a sun-chasing suggestion and shareable links |
| Cost of living calculator | `/cost-of-living-calculator/` | Re-prices what you spend today, category by category, for 180 countries |
| Visa-free countries | `/visa-free-countries/` | Entry rules for one or two passports, world map, passport ranking |
| Schengen 90/180 calculator | `/schengen-calculator/` | Days used, days left, reset date, longest next stay, timeline chart |
| Time zone overlap | `/time-zone-overlap-calculator/` | Working-hours overlap with your team for every city, DST-aware |
| Where to go by month | `/where-to-go/` | Cities that match your temperature and rain preferences |
| Flight CO₂ calculator | `/flight-carbon-calculator/` | Distance, flight time and emissions by cabin class |

Programmatic pages, each with unique data-driven copy, FAQs and structured data:

- 184 city guides at `/cities/{city}/`
- 199 country pages at `/countries/{country}/`
- 199 passport pages at `/visa-free-countries/{passport}/`, each comparing the passport with its neighbours
- 12 month guides at `/where-to-go/{month}/`
- Index pages, methodology, data sources, about and privacy

## Quick start

```bash
npm install          # only dev dependency: esbuild
npm run build        # renders dist/ (about 40 s)
npm run serve        # http://localhost:4321 (this computer only; HOST=0.0.0.0 opens it to your network)
npm run check        # validates titles, descriptions, canonicals, h1s, JSON-LD and every internal link
```

The processed datasets in `data/*.json` are committed, so a build works offline.

## Deploying

1. Set your production origin. It's used for canonical URLs, Open Graph tags and the sitemap:
   `SITE_URL=https://your-domain.com npm run build` (or edit `site.config.mjs`).
2. Upload `dist/` to any static host (Netlify, Cloudflare Pages, Vercel, S3, GitHub Pages). Pages are `folder/index.html`, so clean URLs work everywhere.
3. `dist/_headers` sets security headers (Content-Security-Policy, HSTS and others) and long-lived caching for hashed assets. Netlify and Cloudflare Pages read it automatically. Other hosts ignore it, so copy the same headers into their settings if they let you set headers. `npm run serve` sends these headers too, so you can check the site works with them before you deploy.
4. Submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## Refreshing the data

```bash
npm run data           # fetch + process (raw downloads are cached in data/raw, about 150 MB)
npm run data:refresh   # re-download everything, then process
npm run og             # regenerate social images and icons (needs Edge or Chrome; set BROWSER=... if not found)
```

To add a city, add a line to `scripts/data/cities.list.mjs` and run `npm run data`.

## Data sources and licences

Every source allows commercial use. None is share-alike or non-commercial.

| Source | Licence | Used for |
|---|---|---|
| World Bank WDI | CC BY 4.0 | Price levels, internet use, homicide, PM2.5, health, GDP |
| World Bank ICP 2021 | CC BY 4.0 | Category price levels (rent, food, restaurants, transport and more) |
| World Bank WGI | CC BY 4.0 | Political stability, rule of law, corruption, government effectiveness |
| GeoNames | CC BY 4.0 | City coordinates, population, elevation, time zones; country facts |
| NASA POWER | Public (NASA open data) | Monthly climate per city |
| M-Lab NDT statistics | CC0 | Measured internet speeds per country |
| Wikidata | CC0 | Plug types, voltage, driving side |
| Natural Earth | Public domain | World map shapes |
| Passport Index Data (imorte) | MIT | Visa requirement matrix |
| ECB reference rates | Free reuse with attribution | Currency conversion |
| UK DESNZ conversion factors 2026 | Open Government Licence v3.0 | Flight emission factors |
| IANA tz database | Public domain | Time zones (through the browser's Intl API) |

The attribution text for each source is on `/data-sources/` and in the footer of every page.

### Caveats to know

- **Visa data provenance.** The Passport Index Data repository is MIT-licensed, but its README says the data was scraped from passportindex.org. If you need zero legal ambiguity for a commercial launch, get advice or replace it with a matrix compiled from official government sources. The site tells users to confirm visa rules officially.
- **Internet speeds** come from M-Lab's public statistics API, whose latest period is January–March 2024. NDT single-stream tests read lower than Ookla; use them for relative comparison.
- **Cost estimates** use national price levels. Central areas of big hubs (London, New York, Paris) cost more than the national estimate. See `/methodology/`.
- **Climate** comes from a ~50 km reanalysis grid, adjusted for elevation. Coastal cities read 1–3 °C milder than local stations.

## Look and feel

- **Design system**: `src/styles/site.css`. Colours are CSS variables at the top (light and dark themes). Each tool and score factor has its own colour (`tone-*` classes) and line icon (`src/render/icons.mjs`).
- **Home-page globe**: `src/client/globe.mjs` draws a dotted globe on a canvas from the Natural Earth shapes (rasterised at build time by `scripts/lib/land.mjs`). It shows the destination finder's top matches and turns to face the best one when the settings change. It only animates while it's on screen and stays still for people who prefer reduced motion.
- **Live hero**: the globe is lit by the real sun for the moment you look at it (`src/shared/sun.mjs`): the night side is in shadow, the golden-hour band glows amber and every city in the atlas lights up after dark. The traveller who used to star in the daily intro now stands on top of it. The "Right now" line under the buttons (`src/client/now.mjs`) names cities in golden hour with their local time. The page ships with a fixed line of the same height, so the live text never moves anything (no layout shift, and the headline is the first thing painted).
- **City takes**: each city guide opens with data-derived pros and cons, one trade-off sentence and "similar weather for less" (`src/shared/insights.mjs`, documented on `/methodology/`).
- **Passport pages** compare each passport with its neighbours' (or similar passports in its region) and list cities it can enter that most passports can't.

## Project structure

```
site.config.mjs          Site name and URL
scripts/data/            fetch.mjs (download), process.mjs (clean + derive), sources.mjs (licences), cities.list.mjs
scripts/build.mjs        Static site generator, sitemap, robots.txt, manifest
scripts/check.mjs        SEO and link checker
scripts/og.mjs           Open Graph images and icons
scripts/build-preview.mjs  Single-file hash-routed preview (used for the Claude artifact)
src/shared/              Pure logic shared by build and browser: cost model, scores, climate, visas, time zones, Schengen
src/render/              HTML templates (pages, components, tool result renderers)
src/client/              Browser code: tool interactivity, sortable tables, maps, chart tooltips
src/styles/site.css      Design system (light and dark themes)
static/                  Favicons and social images (copied to dist/)
```

The same render functions produce the pre-rendered HTML at build time and the live results in the browser, so what search engines index matches what users see.
