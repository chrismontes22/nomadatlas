import { html, raw, jsonLd, esc } from './html.mjs';
import { TOOLS } from './nav.mjs';
import { MONTHS } from '../shared/format.mjs';
import { cityPath, cityLabel, monthPath } from './components.mjs';

export const logo = raw('<svg class="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="12.5" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="16" cy="16" rx="5.2" ry="12.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.8 12h24.4M3.8 20h24.4" stroke="currentColor" stroke-width="1.4"/><circle cx="24.5" cy="7.5" r="4.2" class="logo__pin"/></svg>');

export function siteHeader(ctx, page) {
  const cur = page?.path || '';
  const is = (p) => (p === '/' ? cur === '/' : cur.startsWith(p));
  return html`<a class="skip" href="#main">Skip to content</a>
<header class="masthead">
  <div class="wrap masthead__inner">
    <a class="brand" href="${ctx.link('/')}" aria-label="NomadAtlas home">${logo}<span>Nomad<b>Atlas</b></span></a>
    <nav class="nav" aria-label="Main">
      <details class="dropdown">
        <summary><span class="lg">Tools</span><span class="sm">Menu</span></summary>
        <ul class="dropdown__panel">${TOOLS.map((t) => html`<li><a href="${ctx.link(t.path)}"${is(t.path) && t.path !== '/' ? raw(' aria-current="page"') : ''}><b>${t.short}</b><span>${t.desc}</span></a></li>`)}
          <li class="dropdown__extra"><a href="${ctx.link('/cities/')}"><b>All cities</b><span>Every city, ranked and on a map</span></a></li>
          <li class="dropdown__extra"><a href="${ctx.link('/countries/')}"><b>All countries</b><span>Cost, internet, safety and visas compared</span></a></li>
          <li class="dropdown__extra"><a href="${ctx.link('/methodology/')}"><b>Methodology</b><span>How every score is calculated</span></a></li></ul>
      </details>
      <a href="${ctx.link('/cities/')}"${is('/cities/') ? raw(' aria-current="page"') : ''}>Cities</a>
      <a href="${ctx.link('/countries/')}"${is('/countries/') ? raw(' aria-current="page"') : ''}>Countries</a>
      <a class="nav__hide-sm" href="${ctx.link('/methodology/')}"${is('/methodology/') ? raw(' aria-current="page"') : ''}>Methodology</a>
    </nav>
    ${ctx.mode === 'static' ? html`<button class="themetoggle" type="button" data-theme-toggle aria-label="Switch between light and dark theme"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" fill="currentColor"/></svg></button>` : ''}
  </div>
</header>`;
}

export function siteFooter(ctx) {
  const top = ctx.db.citiesRanked.slice(0, 10);
  return html`<footer class="footer">
  <div class="wrap footer__grid">
    <div class="footer__brand">
      <a class="brand" href="${ctx.link('/')}">${logo}<span>Nomad<b>Atlas</b></span></a>
      <p>Open-data calculators for choosing where to live and work remotely. Every number links back to a public dataset you can check.</p>
    </div>
    <nav aria-label="Tools"><h2>Tools</h2><ul>${TOOLS.map((t) => html`<li><a href="${ctx.link(t.path)}">${t.short}</a></li>`)}</ul></nav>
    <nav aria-label="Top cities"><h2>Top-rated cities</h2><ul>${top.map((c) => html`<li><a href="${ctx.link(cityPath(c))}">${cityLabel(c)}</a></li>`)}<li><a href="${ctx.link('/cities/')}">All 184 cities</a></li></ul></nav>
    <nav aria-label="Where to go by month"><h2>Where to go in…</h2><ul class="footer__months">${MONTHS.map((m, i) => html`<li><a href="${ctx.link(monthPath(i))}">${m}</a></li>`)}</ul></nav>
    <nav aria-label="About"><h2>About</h2><ul>
      <li><a href="${ctx.link('/methodology/')}">Methodology</a></li>
      <li><a href="${ctx.link('/data-sources/')}">Data sources &amp; licences</a></li>
      <li><a href="${ctx.link('/countries/')}">All countries</a></li>
      <li><a href="${ctx.link('/about/')}">About</a></li>
      <li><a href="${ctx.link('/privacy/')}">Privacy</a></li>
    </ul></nav>
  </div>
  <div class="wrap footer__legal">
    <p>Data: World Bank WDI, ICP and WGI (CC BY 4.0) · GeoNames (CC BY 4.0) · NASA POWER · M-Lab (CC0) · Wikidata (CC0) · Natural Earth (public domain) · Passport Index Data (MIT) · ECB reference rates · UK DESNZ conversion factors (OGL v3.0) · IANA tz database. <a href="${ctx.link('/data-sources/')}">Full attribution</a>.</p>
    <p>Estimates are for planning only. Always confirm visa rules with official government sources before you travel.</p>
  </div>
</footer>`;
}

export function documentHtml(ctx, page) {
  const url = ctx.site.url + page.path;
  const title = page.title;
  const og = ctx.site.url + '/og/' + (page.og || 'default') + '.png';
  const ld = [...(page.jsonld || [])];
  return '<!doctype html>\n' + html`<html lang="en" data-base="/">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${page.description}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}">
<meta property="og:type" content="${page.ogType || 'website'}">
<meta property="og:site_name" content="${ctx.site.name}">
<meta property="og:title" content="${page.ogTitle || title}">
<meta property="og:description" content="${page.description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${page.ogTitle || title}">
<meta property="og:locale" content="${ctx.site.locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${page.ogTitle || title}">
<meta name="twitter:description" content="${page.description}">
<meta name="twitter:image" content="${og}">
<meta name="theme-color" content="#f2f4f1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0c171f" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="${ctx.assets.css}">
<script>${raw("(function(){var d=document.documentElement;d.classList.add('js');try{var t=localStorage.getItem('na-theme');if(t==='dark'||t==='light')d.setAttribute('data-theme',t)}catch(e){}})();")}</script>
<script type="module" src="${ctx.assets.js}"></script>
${ld.map((o) => jsonLd(o))}
</head>
<body>
${siteHeader(ctx, page)}
<main id="main" class="main">${page.body}</main>
${siteFooter(ctx)}
</body>
</html>`.s;
}
