#!/usr/bin/env node
// Turns web/landing.html (written as an artifact fragment) into a standalone website in
// deploy/oneshot/: a full HTML document plus data.json. Deploy with:
//   node web/build-data.mjs && node web/build-site.mjs && vercel deploy deploy/oneshot --prod

import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'deploy', 'oneshot');
mkdirSync(out, { recursive: true });

const src = readFileSync(join(here, 'landing.html'), 'utf8');
const cut = src.indexOf('</style>') + '</style>'.length;
const head = src
  .slice(0, cut)
  .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '');
const body = src.slice(cut);

const title = 'OneShot: your AI agent, current on the first try';
const desc = 'Coding agents install outdated libraries and write old model names, CI and Docker versions from memory. OneShot gives your agent today\'s values so it gets it right in one shot. Free.';
const favicon = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26"><rect width="26" height="26" rx="6" fill="#060606"/><circle cx="13" cy="13" r="9" fill="none" stroke="#ff4f1f" stroke-width="3"/><circle cx="13" cy="13" r="3.5" fill="#ff4f1f"/></svg>');

// One canonical host: www (the apex redirects there).
const SITE = 'https://www.oneshotagent.dev';
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function shareTags({ title, desc, path, noindex }) {
  const url = SITE + path;
  return [
    noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="OneShot">',
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${SITE}/og.png">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="OneShot: your AI agent writes last year\'s versions. Get it right in one shot.">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${SITE}/og.png">`,
    '<meta name="theme-color" content="#060606">',
    `<link rel="icon" href="${favicon}" type="image/svg+xml">`,
    '<link rel="alternate icon" href="/favicon.ico" sizes="32x32">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  ].join('\n');
}

const html = `<!doctype html>
<html lang="en">
<head>
${head.replace('<title>OneShot</title>', `<title>${title}</title>`)}
<meta name="description" content="${desc}">
${shareTags({ title, desc, path: '/' })}
<style>html,body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`;
writeFileSync(join(out, 'index.html'), html);
copyFileSync(join(here, 'data.json'), join(out, 'data.json'));
copyFileSync(join(here, '..', 'data', 'coverage.json'), join(out, 'coverage.json'));
cpSync(join(here, 'fonts'), join(out, 'fonts'), { recursive: true });
// Static files: share image, icons, robots.txt.
for (const f of readdirSync(join(here, 'static'))) copyFileSync(join(here, 'static', f), join(out, f));

// Small pages (privacy, imprint, terms, 404): body fragments in web/pages, one shared look.
const PAGE_CSS = `:root { color-scheme: dark; --bg: #060606; --fg: #f5f3ef; --muted: #8f8b85; --line: #262626; --signal: #ff4f1f; }
html, body { margin: 0; }
body { background: var(--bg); color: var(--fg); font: 16px/1.65 "Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; padding: max(28px, env(safe-area-inset-top)) 20px max(48px, env(safe-area-inset-bottom)); }
main { max-width: 680px; margin: 0 auto; }
a { color: var(--signal); text-underline-offset: 3px; }
.home { font: 600 14px "IBM Plex Mono", ui-monospace, Menlo, monospace; color: var(--fg); text-decoration: none; display: inline-flex; gap: 8px; align-items: center; }
h1 { font: 800 clamp(34px, 7vw, 52px)/1.05 "Archivo", "Arial Black", system-ui, sans-serif; letter-spacing: -0.02em; margin: 36px 0 10px; }
h2 { font: 700 20px/1.3 "Archivo", system-ui, sans-serif; margin: 36px 0 8px; }
.lead { color: var(--muted); margin: 0 0 8px; }
.short { border: 1px solid var(--line); border-radius: 14px; padding: 16px 20px; margin: 24px 0; background: #111; }
.short ul { margin: 0; padding-left: 20px; }
code { font: 14px "IBM Plex Mono", ui-monospace, Menlo, monospace; background: #1a1a1a; padding: 2px 6px; border-radius: 5px; overflow-wrap: anywhere; }
.facts { display: grid; grid-template-columns: minmax(0, 220px) 1fr; gap: 10px 20px; margin: 28px 0; padding: 20px; border: 1px solid var(--line); border-radius: 14px; background: #111; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; }
@media (max-width: 520px) { .facts { grid-template-columns: 1fr; gap: 2px; } .facts dd { margin-bottom: 12px; } }
.btn { display: inline-block; margin-top: 12px; padding: 12px 20px; border-radius: 999px; background: var(--signal); color: #0a0a0a; font-weight: 600; text-decoration: none; }
footer { color: var(--muted); font-size: 14px; margin-top: 48px; border-top: 1px solid var(--line); padding-top: 16px; }
footer a { color: inherit; }`;
const sitemap = ['/'];
for (const f of readdirSync(join(here, 'pages'))) {
  const src = readFileSync(join(here, 'pages', f), 'utf8');
  const meta = JSON.parse(src.match(/^<!--\s*(\{.*\})\s*-->/)[1]);
  const name = f.replace(/\.html$/, '');
  const path = name === '404' ? '/404' : `/${name}`;
  if (!meta.noindex) sitemap.push(path);
  const t = `${meta.title} · OneShot`;
  writeFileSync(join(out, f), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(t)}</title>
<meta name="description" content="${esc(meta.desc)}">
${shareTags({ title: t, desc: meta.desc, path, noindex: meta.noindex })}
<link rel="stylesheet" href="/fonts/fonts.css">
<style>${PAGE_CSS}</style>
</head>
<body>
<main>
<a class="home" href="/"><svg width="18" height="18" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="9" fill="none" stroke="#ff4f1f" stroke-width="3"/><circle cx="13" cy="13" r="3.5" fill="#ff4f1f"/></svg>OneShot</a>
${src.replace(/^<!--.*?-->\n/, '')}
<footer>OneShot · open source, MIT · <a href="/">Home</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/imprint">Imprint</a></footer>
</main>
</body>
</html>
`);
}
writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join('\n')}
</urlset>
`);
// Hosted facts: a serverless function at /facts.json (see web/api/facts.js).
mkdirSync(join(out, 'api', '_data'), { recursive: true });
copyFileSync(join(here, 'api', 'facts.js'), join(out, 'api', 'facts.js'));
for (const f of ['models.json', 'retirements.json']) copyFileSync(join(here, '..', 'data', f), join(out, 'api', '_data', f));
// Repo check on the website (/api/scan): the same checker the CLI runs.
copyFileSync(join(here, 'api', 'scan.js'), join(out, 'api', 'scan.js'));
copyFileSync(join(here, 'api', 'badge.js'), join(out, 'api', 'badge.js'));
cpSync(join(here, '..', 'src'), join(out, 'api', '_lib', 'src'), { recursive: true });
cpSync(join(here, '..', 'data'), join(out, 'api', '_lib', 'data'), { recursive: true });
writeFileSync(join(out, 'package.json'), JSON.stringify({ private: true, type: 'module' }, null, 2) + '\n');
writeFileSync(join(out, 'vercel.json'), JSON.stringify({
  cleanUrls: true,
  rewrites: [{ source: '/facts.json', destination: '/api/facts' }, { source: '/badge/:owner/:file', destination: '/api/badge?repo=:owner/:file' }],
  functions: { 'api/scan.js': { maxDuration: 60, includeFiles: 'api/_lib/**' }, 'api/badge.js': { maxDuration: 60, includeFiles: 'api/_lib/**' } },
  headers: [
    { source: '/data.json', headers: [{ key: 'Cache-Control', value: 'public, max-age=300' }] },
    { source: '/(.*)', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }] },
  ],
}, null, 2) + '\n');
console.log(`site built → ${out} (${Math.round(html.length / 1024)} KB)`);
