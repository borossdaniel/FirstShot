#!/usr/bin/env node
// Turns web/landing.html (written as an artifact fragment) into a standalone website in
// deploy/oneshot/: a full HTML document plus data.json. Deploy with:
//   node web/build-data.mjs && node web/build-site.mjs && vercel deploy deploy/oneshot --prod

import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const html = `<!doctype html>
<html lang="en">
<head>
${head.replace('<title>OneShot</title>', `<title>${title}</title>`)}
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://oneshotagent.dev">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#060606">
<link rel="icon" href="${favicon}">
<style>html,body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`;
writeFileSync(join(out, 'index.html'), html);
copyFileSync(join(here, 'data.json'), join(out, 'data.json'));
// Hosted facts: a serverless function at /facts.json (see web/api/facts.js).
mkdirSync(join(out, 'api', '_data'), { recursive: true });
copyFileSync(join(here, 'api', 'facts.js'), join(out, 'api', 'facts.js'));
for (const f of ['models.json', 'retirements.json']) copyFileSync(join(here, '..', 'data', f), join(out, 'api', '_data', f));
// Repo check on the website (/api/scan): the same checker the CLI runs.
copyFileSync(join(here, 'api', 'scan.js'), join(out, 'api', 'scan.js'));
cpSync(join(here, '..', 'src'), join(out, 'api', '_lib', 'src'), { recursive: true });
cpSync(join(here, '..', 'data'), join(out, 'api', '_lib', 'data'), { recursive: true });
writeFileSync(join(out, 'package.json'), JSON.stringify({ private: true, type: 'module' }, null, 2) + '\n');
writeFileSync(join(out, 'vercel.json'), JSON.stringify({
  cleanUrls: true,
  rewrites: [{ source: '/facts.json', destination: '/api/facts' }],
  functions: { 'api/scan.js': { maxDuration: 60, includeFiles: 'api/_lib/**' } },
  headers: [
    { source: '/data.json', headers: [{ key: 'Cache-Control', value: 'public, max-age=300' }] },
    { source: '/(.*)', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }] },
  ],
}, null, 2) + '\n');
console.log(`site built → ${out} (${Math.round(html.length / 1024)} KB)`);
