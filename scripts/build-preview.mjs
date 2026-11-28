// Builds a single-page preview of the whole site for embedding in a sandboxed viewer (Claude Artifact):
// inline CSS + JS, hash routing, data files beside the page. Output: preview/index.html + preview/data/*.json
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as esbuild from 'esbuild';
import { landBits } from './lib/land.mjs';

const OUT = 'preview';
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT + '/data', { recursive: true });
const J = (f) => readFile('data/' + f + '.json', 'utf8');
const meta = JSON.parse(await J('meta'));
const core = JSON.stringify({ countries: JSON.parse(await J('countries')), cities: JSON.parse(await J('cities')), rates: JSON.parse(await J('rates')), emissions: JSON.parse(await J('emissions')), meta });
const visa = await J('visa'), map = await J('map');
const version = createHash('sha1').update(core + visa + map).digest('hex').slice(0, 10);
await writeFile(OUT + '/data/core.json', core); await writeFile(OUT + '/data/visa.json', visa); await writeFile(OUT + '/data/map.json', map);

const css = (await esbuild.build({ entryPoints: ['src/styles/site.css'], bundle: true, minify: true, write: false, logLevel: 'warning' })).outputFiles[0].text;
const js = (await esbuild.build({ entryPoints: ['src/client/spa.mjs'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, define: { __DATA_VERSION__: JSON.stringify(version), __LAND__: JSON.stringify(landBits(JSON.parse(map))) }, logLevel: 'warning' })).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const page = `<title>NomadAtlas</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Open-data calculators that match digital nomads to cities by budget, passport, time zone and weather.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>${css}</style>
<div id="na-header"><header class="masthead"><div class="wrap masthead__inner"><span class="brand">Nomad<b>Atlas</b></span></div></header></div>
<main id="main" class="main"><div class="wrap page"><p class="lede">Loading 184 cities and 199 passports…</p></div></main>
<div id="na-footer"></div>
<script>window.__NA_SPA__ = true; window.__NA_BASE__ = '';</script>
<script>${js}</script>
`;
await writeFile(OUT + '/index.html', page);
// Local test wrapper (the viewer adds the document skeleton itself)
await writeFile(OUT + '/local.html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + page + '</body></html>');
console.log('[preview] index.html ' + (page.length / 1024).toFixed(0) + ' KB (CSS ' + (css.length / 1024).toFixed(0) + ' KB, JS ' + (js.length / 1024).toFixed(0) + ' KB), data v' + version);
