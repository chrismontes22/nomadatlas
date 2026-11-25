import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITIES, MONTHS, DATA_META } from '../data/cities.js';
import { OPEN_DATASETS } from '../data/datasets.js';
import { estimateMonthlyCost, scoreCity, PRESETS, describeInternet, describeSafety } from '../data/calculator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://meridian-nomad-atlas.example'; // Replace with your production domain before deploy
const TODAY = DATA_META?.refreshedAt || new Date().toISOString().slice(0, 10);
const CITY_COUNT = CITIES.length;
const COUNTRY_COUNT = new Set(CITIES.map((c) => c.iso2)).size;

function esc(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildStaticClimateSvg(city) {
  const w = 520, h = 156, pL = 28, pR = 16, pT = 20, pB = 26;
  const pW = w - pL - pR, pH = h - pT - pB;
  const maxT = Math.max(...city.tempC, 30), minT = Math.min(...city.tempC, 0), span = Math.max(10, maxT - minT);
  const maxR = Math.max(...city.rainMm, 120);
  const pts = city.tempC.map((t, i) => `${(pL + (i / 11) * pW).toFixed(1)},${(pT + (1 - (t - minT) / span) * pH).toFixed(1)}`).join(' ');
  const bars = city.rainMm.map((r, i) => {
    const x = pL + (i / 11) * pW - 8;
    const bh = (r / maxR) * (pH * 0.65);
    return `<rect x="${x.toFixed(1)}" y="${(pT + pH - bh).toFixed(1)}" width="16" height="${bh.toFixed(1)}" rx="2.5" fill="#d3e6e2" />`;
  }).join('');
  const dots = city.tempC.map((t, i) => {
    const x = pL + (i / 11) * pW, y = pT + (1 - (t - minT) / span) * pH;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="#b95730" />
      <text x="${x.toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle" font-size="9.5" font-family="JetBrains Mono, monospace" fill="#161b1d">${Math.round(t)}°</text>
      <text x="${x.toFixed(1)}" y="${h - 6}" text-anchor="middle" font-size="10" fill="#6c757b">${MONTHS[i]}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="12-month temperature and rainfall chart for ${esc(city.city)}" style="width:100%;height:auto;background:#fdfcf9;border:1px solid #e3ddd0;border-radius:10px;">${bars}<polyline fill="none" stroke="#b95730" stroke-width="2.3" points="${pts}" />${dots}</svg>`;
}

function buildJsonLdHome() {
  const ranked = CITIES.map((c) => scoreCity(c, { weights: PRESETS.balanced.weights })).sort((a, b) => b.composite - a.composite);

  const webApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `Meridian Nomad Atlas — ${CITY_COUNT}-City Digital Nomad Cost, Weather & Map Calculator`,
    url: `${SITE_ORIGIN}/`,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires HTML5 and JavaScript',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description:
      `Free digital nomad calculator comparing ${CITY_COUNT} global cities across ${COUNTRY_COUNT} countries by cost of living, 5-year savings, internet speed, NASA weather, safety, and work-hour overlap — built exclusively on 7 commercial-free, non-copyleft open datasets.`,
    featureList: [
      `Interactive Natural Earth country map & city finder across ${CITY_COUNT} cities in ${COUNTRY_COUNT} countries`,
      'Monthly cost of living & 5-year savings / cash runway calculator',
      '24-hour remote team work-hour & time zone overlap checker',
      '12-month trip itinerary builder with 183-day tax & Europe 90-day Schengen stay tracker',
      'Automated monthly open-data pipeline using 7 commercial-free datasets (CC BY 4.0, CC0, Public Domain)'
    ]
  };

  const dataCatalog = {
    '@context': 'https://schema.org',
    '@type': 'DataCatalog',
    name: 'Meridian Nomad Atlas Open Data Catalog',
    description: 'Verified commercial-free, non-copyleft datasets (Natural Earth, World Bank WDI/WGI, NASA POWER, GeoNames, M-Lab NDT, IANA tzdb).',
    dataset: OPEN_DATASETS.map((ds) => ({
      '@type': 'Dataset',
      name: ds.name,
      description: ds.role,
      url: ds.sourceUrl,
      license: ds.licenseUrl,
      creator: { '@type': 'Organization', name: ds.publisher },
      variableMeasured: ds.indicators
    }))
  };

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Top ${CITY_COUNT} Global Digital Nomad Cities Ranked by Open Data`,
    numberOfItems: ranked.length,
    itemListElement: ranked.slice(0, 50).map((r, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: `${r.city.city}, ${r.city.country}`,
      url: `${SITE_ORIGIN}/cities/${r.city.slug}.html`
    }))
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How does this digital nomad calculator estimate monthly living costs?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Monthly living budgets use the World Bank Household Consumption PPP conversion factor divided by same-year official exchange rates (CC BY 4.0), adjusted for city size, lifestyle tier, and housing type (coliving, studio, or central 1-bedroom).'
        }
      },
      {
        '@type': 'Question',
        name: 'Are all datasets free for commercial use with no copyleft?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. All 7 datasets — Natural Earth 110m (Public Domain), World Bank WDI/ICP & WGI (CC BY 4.0), GeoNames (CC BY 4.0), NASA POWER weather (Public Domain), Measurement Lab NDT (CC0 1.0), and IANA Time Zones (Public Domain) — allow free commercial use with zero copyleft or share-alike restrictions.'
        }
      },
      {
        '@type': 'Question',
        name: 'How often is the data updated, and does it cost anything to maintain?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Country borders (Natural Earth) are generated once, 30-year NASA weather normals are cached, and World Bank + GeoNames indicators refresh automatically via a free monthly GitHub Actions workflow with zero API keys or hosting fees.'
        }
      },
      {
        '@type': 'Question',
        name: 'What are the 183-day tax rule and the 90-day Europe Schengen limit?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Staying 183 or more days in one country within a year commonly triggers tax residency. In Europe, most non-EU visitors can stay up to 90 days in any 180-day period across Schengen countries without a special visa. The 12-Month Trip Planner automatically watches both limits as a planning aid.'
        }
      }
    ]
  };

  return [webApp, dataCatalog, itemList, faqPage]
    .map((obj) => `  <script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n  </script>`)
    .join('\n');
}

function generateHomeHtml() {
  const ranked = CITIES.map((c) => scoreCity(c, { weights: PRESETS.balanced.weights })).sort((a, b) => b.composite - a.composite);
  const seoRows = ranked.slice(0, 15).map((r, i) => `              <tr>
                <td class="num">${i + 1}</td>
                <td><a href="cities/${r.city.slug}.html"><strong>${esc(r.city.city)}</strong>, ${esc(r.city.country)}</a></td>
                <td class="num"><strong>${r.composite}</strong>/100</td>
                <td class="num">$${r.monthlyCost.toLocaleString('en-US')}/mo</td>
                <td class="num">${r.city.dlMbps} Mbps</td>
                <td class="num">${r.climate.tempC}°C</td>
                <td>${esc(r.safetyVerdict)}</td>
              </tr>`).join('\n');

  const regions = ['Europe', 'Americas', 'Asia-Pacific', 'Middle East & Africa'];
  const regionalLinks = regions.map((reg) => {
    const list = CITIES.filter((c) => c.region === reg).sort((a, b) => a.city.localeCompare(b.city));
    return `
      <div style="margin-top:16px;">
        <h4 style="margin:0 0 6px;font-size:13.5px;text-transform:uppercase;letter-spacing:0.05em;color:var(--accent);">${esc(reg)} (${list.length})</h4>
        <div class="city-seo-links" style="margin-top:0;">
          ${list.map((c) => `<a href="cities/${c.slug}.html">${esc(c.city)}</a>`).join(' ')}
        </div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Meridian Nomad Atlas — ${CITY_COUNT}-City Digital Nomad Cost of Living, Weather &amp; Map Calculator</title>
  <meta name="description" content="Compare ${CITY_COUNT} digital nomad cities across ${COUNTRY_COUNT} countries on an interactive Natural Earth map. Estimate monthly cost of living, 5-year savings, internet speed, NASA weather, safety, and team call overlap using 7 free commercial open datasets." />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <link rel="canonical" href="${SITE_ORIGIN}/" />
  <link rel="manifest" href="manifest.webmanifest" />
  <meta name="theme-color" content="#0f5c52" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Meridian Nomad Atlas" />
  <meta property="og:title" content="Meridian Nomad Atlas — ${CITY_COUNT}-City Digital Nomad Calculator" />
  <meta property="og:description" content="Explore ${CITY_COUNT} global cities across ${COUNTRY_COUNT} countries with real Natural Earth borders, World Bank prices, NASA weather, and M-Lab internet speeds." />
  <meta property="og:url" content="${SITE_ORIGIN}/" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Meridian Nomad Atlas — Digital Nomad City Calculator" />
  <meta name="twitter:description" content="Plain-English remote-work calculator across ${CITY_COUNT} global cities powered by 7 free commercial open datasets." />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,500;0,6..72,600;1,6..72,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

  <link rel="stylesheet" href="styles.css" />

${buildJsonLdHome()}
</head>
<body>
  <a class="skip-link" href="#main-workspace">Skip to calculator</a>

  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="index.html">
        <span class="brand-mark" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 3a14 14 0 0 0 0 18"></path>
            <path d="M12 3a14 14 0 0 1 0 18"></path>
            <line x1="3" y1="12" x2="21" y2="12"></line>
          </svg>
        </span>
        <span>
          <div class="brand-title">Meridian Nomad Atlas</div>
          <div class="brand-sub">${CITY_COUNT} Global Cities · ${COUNTRY_COUNT} Countries · Updated ${TODAY}</div>
        </span>
      </a>

      <div class="header-actions">
        <label class="sr-only" for="currency-select">Display Currency</label>
        <select id="currency-select" class="currency-select" aria-label="Display Currency">
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR (€)</option>
          <option value="GBP">GBP (£)</option>
        </select>
        <button type="button" id="copy-share-url" class="btn btn-outline btn-sm">Share Setup</button>
      </div>
    </div>
  </header>

  <section class="hero">
    <div class="container hero-grid">
      <div>
        <p class="hero-kicker">7 Free Commercial Open Datasets · Zero Copyleft · Auto-Refreshed</p>
        <h1>Find your next place to live &amp; work remotely.</h1>
        <p class="hero-lead">
          Compare ${CITY_COUNT} cities across ${COUNTRY_COUNT} countries by real World Bank living costs, fast internet,
          30-year NASA weather, safety, and team call hours — on a real Natural Earth atlas map.
        </p>
      </div>
      <div class="hero-facts" aria-label="Coverage Facts">
        <div>
          <div class="fact-val">${CITY_COUNT}</div>
          <div class="fact-label">Cities across ${COUNTRY_COUNT} countries</div>
        </div>
        <div>
          <div class="fact-val">7</div>
          <div class="fact-label">Verified open datasets (CC BY / CC0 / PD)</div>
        </div>
        <div>
          <div class="fact-val">5</div>
          <div class="fact-label">Tools for cost, calls &amp; trip planning</div>
        </div>
      </div>
    </div>
  </section>

  <nav class="mode-nav-wrap" aria-label="Calculator Tools">
    <div class="container mode-nav" role="tablist">
      <button type="button" class="mode-tab" role="tab" data-tab="explore" aria-selected="true" aria-controls="panel-explore">
        City Finder <span class="tab-count">${CITY_COUNT}</span>
      </button>
      <button type="button" class="mode-tab" role="tab" data-tab="budget" aria-selected="false" aria-controls="panel-budget">
        Cost &amp; Savings
      </button>
      <button type="button" class="mode-tab" role="tab" data-tab="timezones" aria-selected="false" aria-controls="panel-timezones">
        Work Hours &amp; Time Zones
      </button>
      <button type="button" class="mode-tab" role="tab" data-tab="planner" aria-selected="false" aria-controls="panel-planner">
        12-Month Trip Planner
      </button>
      <button type="button" class="mode-tab" role="tab" data-tab="provenance" aria-selected="false" aria-controls="panel-provenance">
        Data Sources &amp; SEO <span class="tab-count">7</span>
      </button>
    </div>
  </nav>

  <main id="main-workspace" class="main-content">
    <div class="container">

      <!-- ==================== TAB 1: CITY FINDER ==================== -->
      <section id="panel-explore" class="tab-panel active" role="tabpanel">
        <div class="setup-bar">
          <div class="setup-grid">
            <div>
              <div class="control-label">
                <label for="income-range">Monthly Take-Home Pay
                  <span class="help-tip" tabindex="0" data-tip="Your net monthly pay after tax. We use it to show how much money you save in each city.">?</span>
                </label>
                <span id="income-val" class="control-val">$5,500/mo</span>
              </div>
              <input id="income-range" type="range" min="1500" max="20000" step="250" value="5500" />
            </div>

            <div>
              <div class="control-label">
                <span>Spending Style
                  <span class="help-tip" tabindex="0" data-tip="Budget = local spots & modest stay. Mid = comfortable cafés & coworking. Upscale = premium apartments & dining.">?</span>
                </span>
              </div>
              <div class="segmented" role="group" aria-label="Spending Style">
                <button type="button" class="seg-btn" data-lifestyle="lean">Budget</button>
                <button type="button" class="seg-btn active" data-lifestyle="comfortable">Mid</button>
                <button type="button" class="seg-btn" data-lifestyle="upscale">Upscale</button>
              </div>
            </div>

            <div>
              <label class="control-label" for="month-select">When You Plan to Go</label>
              <select id="month-select" class="select">
                <option value="-1">Any Time (Year Avg)</option>
                ${MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="control-label" for="team-tz">Your Team / Client Time Zone
                <span class="help-tip" tabindex="0" data-tip="Where your coworkers or clients work 9-to-5. We measure daily shared call hours.">?</span>
              </label>
              <select id="team-tz" class="select"></select>
            </div>
          </div>

          <div class="setup-footer">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <span style="font-size:12.5px;font-weight:700;color:var(--ink-muted);">Quick Focus:</span>
              <div class="preset-list">
                <button type="button" class="preset-btn active" data-preset="balanced">Balanced</button>
                <button type="button" class="preset-btn" data-preset="founder">Save Money</button>
                <button type="button" class="preset-btn" data-preset="engineer">Live Team Calls</button>
                <button type="button" class="preset-btn" data-preset="sunseeker">Great Weather</button>
                <button type="button" class="preset-btn" data-preset="family">Safe &amp; Calm</button>
              </div>
            </div>
            <button type="button" id="toggle-advanced" class="btn btn-outline btn-sm">Customize Filters &amp; Priorities</button>
          </div>
          <p id="preset-hint" style="margin:8px 0 0;font-size:12.5px;color:var(--ink-muted);">
            A well-rounded mix of cost, fast Wi-Fi, pleasant weather, safety, and work-hour overlap.
          </p>

          <div id="advanced-drawer" class="advanced-drawer">
            <div class="filters-subgrid">
              <div>
                <div class="control-label"><span>Housing Type</span></div>
                <div class="segmented" role="group" aria-label="Housing Type">
                  <button type="button" class="seg-btn" data-housing="coliving">Coliving</button>
                  <button type="button" class="seg-btn active" data-housing="studio">Studio</button>
                  <button type="button" class="seg-btn" data-housing="onebr">1-BR</button>
                </div>
              </div>
              <div>
                <div class="control-label"><label for="ideal-temp">Ideal Temperature</label><span id="ideal-temp-val" class="control-val">22°C</span></div>
                <input id="ideal-temp" type="range" min="10" max="30" step="1" value="22" />
              </div>
              <div>
                <div class="control-label"><label for="min-speed">Minimum Internet Speed</label><span id="min-speed-val" class="control-val">Any speed</span></div>
                <input id="min-speed" type="range" min="0" max="200" step="20" value="0" />
              </div>
              <div>
                <div class="control-label"><label for="max-budget">Max Monthly Cost</label><span id="max-budget-val" class="control-val">$5,000/mo</span></div>
                <input id="max-budget" type="range" min="1200" max="6000" step="100" value="5000" />
              </div>
            </div>

            <div style="font-size:13px;font-weight:700;margin-bottom:4px;">Fine-tune how much each factor counts in your Match Score:</div>
            <div class="weights-grid">
              <div><div class="control-label"><label for="w-cost">Low Cost</label><span id="w-cost-val" class="control-val">25%</span></div><input id="w-cost" type="range" min="0" max="60" value="25" /></div>
              <div><div class="control-label"><label for="w-internet">Fast Wi-Fi</label><span id="w-internet-val" class="control-val">22%</span></div><input id="w-internet" type="range" min="0" max="60" value="22" /></div>
              <div><div class="control-label"><label for="w-climate">Weather</label><span id="w-climate-val" class="control-val">18%</span></div><input id="w-climate" type="range" min="0" max="60" value="18" /></div>
              <div><div class="control-label"><label for="w-stability">Safety &amp; Air</label><span id="w-stability-val" class="control-val">20%</span></div><input id="w-stability" type="range" min="0" max="60" value="20" /></div>
              <div><div class="control-label"><label for="w-timezone">Team Calls</label><span id="w-timezone-val" class="control-val">15%</span></div><input id="w-timezone" type="range" min="0" max="60" value="15" /></div>
            </div>
          </div>
        </div>

        <!-- Natural Earth Real Country World Map -->
        <div id="world-map-panel" class="map-panel">
          <div class="map-head">
            <div>
              <strong style="font-family:var(--font-serif);font-size:18px;">Interactive World Atlas</strong>
              <span style="font-size:12.5px;color:var(--ink-muted);margin-left:8px;">Click any shaded country to filter cities, or click a dot for its full guide (Natural Earth · Public Domain).</span>
            </div>
            <div class="map-legend">
              <span><span class="map-dot-sample" style="background:#0f5c52;"></span>70+ Top Match</span>
              <span><span class="map-dot-sample" style="background:#9b6c16;"></span>60–69 Good Fit</span>
              <span><span class="map-dot-sample" style="background:#b95730;"></span>&lt;60 Niche Fit</span>
            </div>
          </div>
          <div id="world-map-stage"></div>
          <div id="map-tooltip" class="map-tooltip" role="status"></div>
        </div>

        <div id="explore-kpis" class="kpi-strip"></div>

        <div class="results-toolbar">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div class="region-filters" role="group" aria-label="Filter by Region">
              <button type="button" class="filter-chip active" data-region="All">All Regions</button>
              <button type="button" class="filter-chip" data-region="Europe">Europe</button>
              <button type="button" class="filter-chip" data-region="Americas">Americas</button>
              <button type="button" class="filter-chip" data-region="Asia-Pacific">Asia-Pacific</button>
              <button type="button" class="filter-chip" data-region="Middle East & Africa">Middle East &amp; Africa</button>
            </div>
            <span id="active-country-badge"></span>
          </div>
          <div class="toolbar-right" style="flex-wrap:wrap;">
            <label class="sr-only" for="city-search">Search cities or countries</label>
            <input id="city-search" type="search" class="search-input" placeholder="Search ${CITY_COUNT} cities or countries..." />
            <label class="sr-only" for="sort-select">Sort Cities</label>
            <select id="sort-select" class="select" style="width:auto;padding:7px 11px;font-size:13px;">
              <option value="composite">Sort: Best Match</option>
              <option value="cost">Sort: Lowest Cost</option>
              <option value="internet">Sort: Fastest Internet</option>
              <option value="climate">Sort: Best Weather</option>
              <option value="stability">Sort: Safest &amp; Most Stable</option>
              <option value="timezone">Sort: Most Team Overlap</option>
            </select>
            <button type="button" id="view-toggle" class="btn btn-outline btn-sm">Table View</button>
          </div>
        </div>

        <div id="explore-results">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>#</th><th>City</th><th>Match</th><th>Est. Cost/mo</th><th>Internet</th><th>Avg Temp</th><th>Safety</th></tr></thead>
              <tbody>
${seoRows}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ==================== TAB 2: COST & SAVINGS ==================== -->
      <section id="panel-budget" class="tab-panel" role="tabpanel">
        <div class="explainer-note">
          <span class="explainer-icon" aria-hidden="true">i</span>
          <div><strong>How this works:</strong> Pick where you live today and any of our ${CITY_COUNT} global cities. Using World Bank household price levels and inflation, we show how much cheaper life abroad is, your extra 5-year invested wealth, and how long your cash savings last.</div>
        </div>
        <div class="two-col-wide">
          <aside class="panel">
            <div class="panel-header"><div><h2 class="panel-title">Compare Home vs. Abroad</h2><p class="panel-subtitle">Synced with your income &amp; spending style</p></div></div>
            <div class="control-group"><label class="control-label" for="home-base-select">Where You Live Now</label><select id="home-base-select" class="select"></select></div>
            <div class="control-group"><label class="control-label" for="target-city-select">City You're Considering (${CITY_COUNT})</label><select id="target-city-select" class="select"></select></div>
            <div class="control-group">
              <div class="control-label"><label for="savings-range">Cash Savings ("Runway") <span class="help-tip" tabindex="0" data-tip="Savings you could live on without new income. We show how many months it covers.">?</span></label><span id="savings-val" class="control-val">$25,000</span></div>
              <input id="savings-range" type="range" min="3000" max="150000" step="1000" value="25000" />
            </div>
            <div class="control-group">
              <div class="control-label"><label for="return-range">Yearly Investment Return <span class="help-tip" tabindex="0" data-tip="Estimated annual growth if you invest leftover monthly savings.">?</span></label><span id="return-val" class="control-val">7% / yr</span></div>
              <input id="return-range" type="range" min="0" max="12" step="0.5" value="7" />
            </div>
          </aside>
          <div id="budget-summary"></div>
        </div>
      </section>

      <!-- ==================== TAB 3: WORK HOURS & TIME ZONES ==================== -->
      <section id="panel-timezones" class="tab-panel" role="tabpanel">
        <div class="explainer-note">
          <span class="explainer-icon" aria-hidden="true">i</span>
          <div><strong>Why overlap matters:</strong> Pick your team's headquarters time zone and your ideal local workday to see which of our ${CITY_COUNT} cities make live meetings effortless.</div>
        </div>
        <div class="panel" style="margin-bottom:20px;">
          <div class="panel-header"><div><h2 class="panel-title">Work-Hour &amp; Time Zone Checker</h2><p class="panel-subtitle">Backed by the Public Domain IANA Time Zone Database</p></div></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:14px;">
            <div><label class="control-label" for="tz-team-select">Team Office (9 AM–5 PM)</label><select id="tz-team-select" class="select"></select></div>
            <div>
              <label class="control-label" for="tz-start">Your Local Start</label>
              <select id="tz-start" class="select"><option value="7">7:00 AM</option><option value="8">8:00 AM</option><option value="9" selected>9:00 AM</option><option value="10">10:00 AM</option><option value="12">12:00 PM</option><option value="14">2:00 PM</option></select>
            </div>
            <div>
              <label class="control-label" for="tz-end">Your Local Finish</label>
              <select id="tz-end" class="select"><option value="16">4:00 PM</option><option value="17">5:00 PM</option><option value="18" selected>6:00 PM</option><option value="20">8:00 PM</option><option value="22">10:00 PM</option></select>
            </div>
            <div>
              <label class="control-label" for="tz-region-select">Region</label>
              <select id="tz-region-select" class="select"><option value="All">All Regions (${CITY_COUNT})</option><option value="Europe">Europe</option><option value="Americas">Americas</option><option value="Asia-Pacific">Asia-Pacific</option><option value="Middle East & Africa">Middle East &amp; Africa</option></select>
            </div>
            <div>
              <label class="control-label" for="tz-search">Search City</label>
              <input id="tz-search" type="search" class="input" placeholder="e.g., Tokyo, Lisbon..." />
            </div>
          </div>
        </div>
        <div id="tz-matrix" class="panel"></div>
      </section>

      <!-- ==================== TAB 4: 12-MONTH TRIP PLANNER ==================== -->
      <section id="panel-planner" class="tab-panel" role="tabpanel">
        <div class="explainer-note">
          <span class="explainer-icon" aria-hidden="true">i</span>
          <div><strong>Plan a full year abroad safely:</strong> Mix any of our ${CITY_COUNT} cities month-by-month, track live NASA weather and yearly cost, and get automatic alerts for the <strong>183-day tax rule</strong> and <strong>Europe's 90-day Schengen limit</strong>.</div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <div><h2 class="panel-title">12-Month Nomad Year Planner</h2><p class="panel-subtitle">Customize every month, then download your route as CSV or JSON</p></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="preset-btn" data-route-preset="spring">Chase 22°C Spring</button>
              <button type="button" class="preset-btn" data-route-preset="value">Save the Most Money</button>
              <button type="button" class="preset-btn" data-route-preset="ussync">Stay in US Call Hours</button>
              <button type="button" id="export-csv" class="btn btn-outline btn-sm">Download CSV</button>
              <button type="button" id="export-json" class="btn btn-outline btn-sm">Download JSON</button>
            </div>
          </div>
          <div id="planner-alerts"></div>
          <div id="planner-kpis" class="kpi-strip"></div>
          <div id="planner-grid" class="month-planner-grid"></div>
          <h3 style="font-family:var(--font-serif);font-size:19px;margin:8px 0 10px;">Days Planned Per Country (183-Day Check)</h3>
          <div id="planner-country-breakdown"></div>
        </div>
      </section>

      <!-- ==================== TAB 5: DATA SOURCES & SEO ==================== -->
      <section id="panel-provenance" class="tab-panel" role="tabpanel">
        <div class="explainer-note">
          <span class="explainer-icon" aria-hidden="true">i</span>
          <div><strong>Automated, free, and 100% cleared for commercial use:</strong> Country borders (Natural Earth) are built once, NASA 30-year climate normals are cached, and World Bank + GeoNames data refreshes automatically via a free monthly GitHub Actions workflow — with <strong>zero copyleft restrictions</strong>.</div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <div><h2 class="panel-title">7 Verified Free-for-Commercial-Use Datasets</h2><p class="panel-subtitle">Last refreshed: ${TODAY} · ${CITY_COUNT} cities across ${COUNTRY_COUNT} countries.</p></div>
            <button type="button" id="copy-attribution" class="btn btn-primary btn-sm">Copy All Citations</button>
          </div>
          <div id="dataset-cards" class="dataset-grid"></div>

          <h3 style="font-family:var(--font-serif);font-size:20px;margin:0 0 10px;">Popular Sources We Intentionally Left Out</h3>
          <div class="table-wrap" style="margin-bottom:24px;">
            <table class="data-table"><thead><tr><th>Excluded Source</th><th>License</th><th>Why We Left It Out</th></tr></thead><tbody id="excluded-table"></tbody></table>
          </div>

          <h3 style="font-family:var(--font-serif);font-size:20px;margin:0 0 8px;">Built-In SEO &amp; Automated Refresh Pipeline</h3>
          <p class="panel-subtitle" style="margin-bottom:12px;">
            Generates <strong>${CITY_COUNT} static city pages</strong> (<code>/cities/*.html</code>), <code>sitemap.xml</code>, <code>robots.txt</code>, <code>datasets.json</code>, and runs monthly via <code>.github/workflows/refresh-data.yml</code>. Live Schema.org JSON-LD:
          </p>
          <pre id="jsonld-preview" class="code-block"></pre>
        </div>
      </section>
    </div>
  </main>

  <section class="editorial-section" aria-labelledby="methodology-heading">
    <div class="container editorial-grid">
      <div>
        <h2 id="methodology-heading">How Every Score Is Built (In Plain English)</h2>
        <p style="color:var(--ink-secondary);">
          Every one of our ${CITY_COUNT} cities gets a 0–100 <strong>Match Score</strong> answering five everyday questions:
          <em>How affordable is daily life?</em> (World Bank household price levels),
          <em>Will video calls stay smooth?</em> (M-Lab internet speed &amp; delay),
          <em>Does the weather match what I like?</em> (live NASA POWER 30-year monthly normals),
          <em>How safe and stable is it?</em> (World Bank governance &amp; PM2.5 air quality), and
          <em>Do work hours overlap with my team?</em> (IANA time zones).
        </p>
        <h3 style="font-family:var(--font-serif);font-size:21px;margin:24px 0 6px;">Browse All ${CITY_COUNT} Static City Guides</h3>
        <nav aria-label="All City Guides">
          ${regionalLinks}
        </nav>
      </div>

      <div>
        <h2>Common Questions</h2>
        <details class="faq-item" open>
          <summary>How does this calculator estimate monthly living costs?</summary>
          <p>We apply World Bank Household Consumption PPP conversion factors matched to same-year official exchange rates (CC BY 4.0) to a standard remote-worker basket, adjusted for city size and your chosen housing type.</p>
        </details>
        <details class="faq-item">
          <summary>Are all 7 data sources genuinely free for commercial websites?</summary>
          <p>Yes. Every source uses CC BY 4.0, CC0 1.0, or Public Domain terms. Paid APIs (Numbeo), Non-Commercial feeds (Ookla Open Data, Cloudflare Radar, Open-Meteo free tier), and copyleft databases (OpenStreetMap ODbL) are intentionally excluded.</p>
        </details>
        <details class="faq-item">
          <summary>How do the country map and city numbers stay up to date for free?</summary>
          <p>Natural Earth country borders are pre-projected once into SVG. World Bank economic/governance indicators and GeoNames metadata refresh automatically via a free monthly GitHub Actions schedule with zero API keys.</p>
        </details>
        <details class="faq-item">
          <summary>What are the 183-day rule and Europe's 90-day Schengen rule?</summary>
          <p>Spending 183+ days in one country in a year commonly triggers tax residency, while non-EU visitors in Europe's Schengen Area can usually stay up to 90 days in any 180-day period without a special visa.</p>
        </details>
      </div>
    </div>
  </section>

  <footer class="site-footer">
    <div class="container footer-inner">
      <div><strong>Meridian Nomad Atlas</strong> · Natural Earth (Public Domain), World Bank (CC BY 4.0), GeoNames (CC BY 4.0), NASA POWER (Public Domain), M-Lab NDT (CC0), IANA tzdb (Public Domain).</div>
      <div style="display:flex;gap:14px;">
        <a href="datasets.json">datasets.json</a>
        <a href="sitemap.xml">sitemap.xml</a>
        <a href="robots.txt">robots.txt</a>
      </div>
    </div>
  </footer>

  <div id="drawer-backdrop" class="drawer-backdrop" aria-hidden="true"></div>
  <aside id="city-drawer" class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
    <div class="drawer-head">
      <div><h2 id="drawer-title" class="panel-title" style="font-size:24px;"></h2><p id="drawer-subtitle" class="panel-subtitle"></p></div>
      <button type="button" id="drawer-close" class="close-btn" aria-label="Close city guide">&times;</button>
    </div>
    <div id="drawer-body" class="drawer-body"></div>
  </aside>

  <script type="module" src="app.js"></script>
</body>
</html>
`;
}

function generateCityPageHtml(city) {
  const scored = scoreCity(city, { weights: PRESETS.balanced.weights });
  const cost = estimateMonthlyCost(city, 'comfortable', 'studio');
  const leanCost = estimateMonthlyCost(city, 'lean', 'coliving');
  const upscaleCost = estimateMonthlyCost(city, 'upscale', 'onebr');
  const internetNote = describeInternet(city);
  const safetyNote = describeSafety(scored.scores.stability);

  const bestMonths = city.tempC
    .map((t, i) => ({ m: MONTHS[i], score: 100 - Math.abs(t - 22) * 3.5 - Math.max(0, city.rainMm[i] - 70) * 0.2 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.m)
    .join(', ');

  const peers = CITIES.filter((c) => c.id !== city.id && (c.iso2 === city.iso2 || c.region === city.region)).slice(0, 6);

  const placeLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: `${city.city}, ${city.country}`,
    description: city.summary,
    geo: { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lon, elevation: city.elevationM },
    url: `${SITE_ORIGIN}/cities/${city.slug}.html`
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Meridian Nomad Atlas', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: city.region, item: `${SITE_ORIGIN}/#region-${encodeURIComponent(city.region)}` },
      { '@type': 'ListItem', position: 3, name: `${city.city}, ${city.country}`, item: `${SITE_ORIGIN}/cities/${city.slug}.html` }
    ]
  };
  const cityFaqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How much does it cost to live in ${city.city}, ${city.country} as a digital nomad?`,
        acceptedAnswer: { '@type': 'Answer', text: `Using live World Bank household price levels (CC BY 4.0), a comfortable monthly remote-worker budget in ${city.city} is about $${cost.total.toLocaleString('en-US')}/month for a studio, food, coworking, transit, and healthcare. Budget coliving starts near $${leanCost.total.toLocaleString('en-US')}/mo.` }
      },
      {
        '@type': 'Question',
        name: `Is the internet in ${city.city} fast enough for video calls?`,
        acceptedAnswer: { '@type': 'Answer', text: `Median broadband speeds in ${city.city} average ${city.dlMbps} Mbps download, ${city.ulMbps} Mbps upload, and ${city.latencyMs}ms delay (M-Lab CC0) — rated: ${internetNote}.` }
      },
      {
        '@type': 'Question',
        name: `What are the best months for weather in ${city.city}?`,
        acceptedAnswer: { '@type': 'Answer', text: `Based on live 30-year NASA POWER satellite weather normals for ${city.city}'s exact coordinates, the most comfortable months are typically ${bestMonths}.` }
      }
    ]
  };

  const monthRows = MONTHS.map((m, i) => `            <tr><td><strong>${m}</strong></td><td class="num">${city.tempC[i].toFixed(1)} °C</td><td class="num">${city.rainMm[i]} mm</td><td class="num">${city.sunHrs[i].toFixed(1)} hrs/day</td></tr>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Living in ${esc(city.city)}, ${esc(city.country)} as a Digital Nomad: Cost ($${cost.total.toLocaleString('en-US')}/mo), Wi-Fi &amp; Weather</title>
  <meta name="description" content="Plain-English remote work guide for ${esc(city.city)}, ${esc(city.country)}: ~$${cost.total.toLocaleString('en-US')}/mo budget, ${city.dlMbps} Mbps internet, NASA monthly weather (best: ${bestMonths}), safety score, and visa options." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${SITE_ORIGIN}/cities/${city.slug}.html" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(city.city)}, ${esc(city.country)} — Digital Nomad Cost, Wi-Fi &amp; Weather" />
  <meta property="og:description" content="~$${cost.total.toLocaleString('en-US')}/mo budget · ${city.dlMbps} Mbps internet · Best weather: ${bestMonths}." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../styles.css" />
  <script type="application/ld+json">${JSON.stringify(placeLd)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
  <script type="application/ld+json">${JSON.stringify(cityFaqLd)}</script>
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="../index.html"><span class="brand-mark" aria-hidden="true">M</span><span><div class="brand-title">Meridian Nomad Atlas</div><div class="brand-sub">Plain-English City Guide</div></span></a>
      <a class="btn btn-primary btn-sm" href="../index.html?city=${city.id}&amp;target=${city.id}">Customize in Calculator →</a>
    </div>
  </header>

  <main class="main-content">
    <div class="container">
      <nav aria-label="Breadcrumb" style="font-size:13px;color:var(--ink-muted);margin-bottom:14px;">
        <a href="../index.html">Atlas Home</a> / ${esc(city.region)} / <strong>${esc(city.city)}, ${esc(city.country)}</strong>
      </nav>

      <header style="margin-bottom:24px;">
        <p class="hero-kicker">${esc(city.region)} · Time Zone: ${esc(city.tz)} · Pop. ${city.population.toLocaleString('en-US')}</p>
        <h1 style="font-family:var(--font-serif);font-size:clamp(30px,4vw,42px);margin:0 0 10px;letter-spacing:-0.025em;">Living &amp; Working Remotely in ${esc(city.city)}, ${esc(city.country)}</h1>
        <p class="hero-lead">${esc(city.summary)}</p>
      </header>

      <div class="kpi-strip">
        <div class="kpi-card"><div class="kpi-label">Match Score</div><div class="kpi-value" style="color:var(--accent);">${scored.composite}/100</div><div class="kpi-note">${esc(scored.fitLabel)} (balanced profile)</div></div>
        <div class="kpi-card"><div class="kpi-label">Comfortable Budget</div><div class="kpi-value">$${cost.total.toLocaleString('en-US')}/mo</div><div class="kpi-note">Studio, food, desk &amp; transit</div></div>
        <div class="kpi-card"><div class="kpi-label">Internet Speed</div><div class="kpi-value">${city.dlMbps} Mbps</div><div class="kpi-note">${esc(internetNote.split(' · ')[0])} (${city.latencyMs}ms)</div></div>
        <div class="kpi-card"><div class="kpi-label">Safety &amp; Stability</div><div class="kpi-value">${scored.scores.stability}/100</div><div class="kpi-note">${esc(safetyNote)}</div></div>
      </div>

      <div class="editorial-grid" style="margin-top:24px;">
        <article class="panel">
          <h2 class="panel-title" style="margin-bottom:6px;">What Does a Month Cost in ${esc(city.city)}?</h2>
          <p class="panel-subtitle" style="margin-bottom:14px;">Estimated using live World Bank household price levels (CC BY 4.0) across three spending styles.</p>
          <div class="table-wrap" style="margin-bottom:18px;">
            <table class="data-table">
              <thead><tr><th>Style</th><th>Monthly Total</th><th>Housing Included</th></tr></thead>
              <tbody>
                <tr><td>Budget Nomad</td><td class="num">$${leanCost.total.toLocaleString('en-US')}/mo</td><td>Coliving / Shared ($${leanCost.breakdown.housing}/mo)</td></tr>
                <tr><td><strong>Comfortable</strong></td><td class="num"><strong>$${cost.total.toLocaleString('en-US')}/mo</strong></td><td>Private Studio ($${cost.breakdown.housing}/mo)</td></tr>
                <tr><td>Upscale</td><td class="num">$${upscaleCost.total.toLocaleString('en-US')}/mo</td><td>Central 1-BR ($${upscaleCost.breakdown.housing}/mo)</td></tr>
              </tbody>
            </table>
          </div>
          <p style="font-size:14px;color:var(--ink-secondary);"><strong>Visa &amp; Stay Info:</strong> ${esc(city.visaSummary)}</p>
          <p style="font-size:14px;color:var(--ink-secondary);"><strong>Best Weather Months:</strong> ${bestMonths} (live NASA POWER 30-year averages).</p>
          <p style="font-size:14px;color:var(--ink-secondary);"><strong>Environment &amp; Economy:</strong> Price inflation ${city.cpiInflation}%/yr, PM2.5 air quality ${city.pm25} µg/m³, life expectancy ${city.lifeExpectancy} years.</p>
          <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;">
            <a class="btn btn-primary" href="../index.html?tab=budget&amp;target=${city.id}">Compare ${esc(city.city)} vs. Home</a>
            <a class="btn btn-outline" href="../index.html?tab=timezones">Check Call Overlap</a>
          </div>
        </article>

        <article class="panel">
          <h2 class="panel-title" style="margin-bottom:10px;">Year-Round Weather in ${esc(city.city)}</h2>
          ${buildStaticClimateSvg(city)}
          <div class="table-wrap" style="margin-top:14px;">
            <table class="data-table"><thead><tr><th>Month</th><th>Avg Temp</th><th>Rainfall</th><th>Daily Sun</th></tr></thead><tbody>
${monthRows}
            </tbody></table>
          </div>
        </article>
      </div>

      <section style="margin-top:32px;">
        <h2 style="font-family:var(--font-serif);font-size:22px;margin:0 0 12px;">Explore Nearby ${esc(city.region)} Cities</h2>
        <div class="city-seo-links">${peers.map((p) => `<a class="btn btn-outline btn-sm" href="${p.slug}.html">${esc(p.city)}, ${esc(p.country)}</a>`).join(' ')}</div>
      </section>
    </div>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <div>Open Data (${TODAY}): Natural Earth (PD), World Bank (CC BY 4.0), GeoNames (CC BY 4.0), NASA POWER (PD), M-Lab NDT (CC0), IANA tzdb (PD).</div>
      <a href="../index.html">← Back to Meridian Nomad Atlas</a>
    </div>
  </footer>
</body>
</html>
`;
}

// Clear old city pages so renamed slugs don't linger
const citiesDir = path.join(ROOT, 'cities');
fs.rmSync(citiesDir, { recursive: true, force: true });
fs.mkdirSync(citiesDir, { recursive: true });

fs.writeFileSync(path.join(ROOT, 'index.html'), generateHomeHtml(), 'utf8');
for (const city of CITIES) {
  fs.writeFileSync(path.join(citiesDir, `${city.slug}.html`), generateCityPageHtml(city), 'utf8');
}

const sitemapUrls = [
  `  <url><loc>${SITE_ORIGIN}/</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
  `  <url><loc>${SITE_ORIGIN}/datasets.json</loc><lastmod>${TODAY}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`,
  ...CITIES.map((c) => `  <url><loc>${SITE_ORIGIN}/cities/${c.slug}.html</loc><lastmod>${TODAY}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`)
].join('\n');

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}\n</urlset>\n`, 'utf8');
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`, 'utf8');
fs.writeFileSync(
  path.join(ROOT, 'datasets.json'),
  JSON.stringify({ name: 'Meridian Nomad Atlas Open Datasets Manifest', refreshedAt: TODAY, cityCount: CITY_COUNT, countryCount: COUNTRY_COUNT, commercialUseVerified: true, copyleftFree: true, datasets: OPEN_DATASETS }, null, 2) + '\n',
  'utf8'
);

console.log(`Built index.html, ${CITY_COUNT} static SEO city pages across ${COUNTRY_COUNT} countries, sitemap.xml (${CITY_COUNT + 2} URLs), robots.txt, and datasets.json.`);
