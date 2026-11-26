import { runCheck, expectInstalled, expect, fail, sh } from '../../src/check-helpers.js';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

const PROBE = 'FirstShotProbe7q3x';

// Script and stylesheet URLs in a built HTML file (not <a href> links).
function assetRefs(html) {
  const refs = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)) refs.push(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/gi)) refs.push(m[1]);
  return refs;
}

function filesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p));
    else out.push(p);
  }
  return out;
}

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'vite', 8);
  const pj = join(ws, 'package.json');
  if (!existsSync(pj)) fail('no_solution', 'package.json was not created');
  if (!JSON.parse(readFileSync(pj, 'utf8')).scripts?.build) fail('no_solution', 'npm script build is missing');
  for (const f of ['index.html', 'about.html', 'src/main.js']) {
    if (!existsSync(join(ws, f))) fail('no_solution', `${f} was not created`);
  }

  // Build with our own title: a variable already in the environment wins over .env,
  // so the probe shows up in the bundle only if the code reads import.meta.env at build time.
  rmSync(join(ws, 'dist'), { recursive: true, force: true });
  process.env.VITE_APP_TITLE = PROBE;
  const r = await sh(ws, 'npm run build', 90_000);
  if (r.code !== 0) fail('crash', `npm run build failed: ${r.out.trim().split('\n').slice(-3).join(' | ').slice(0, 300)}`);
  const dist = join(ws, 'dist');
  expect(existsSync(join(dist, 'index.html')), 'dist/index.html was not produced by npm run build');
  expect(existsSync(join(dist, 'about.html')), 'dist/about.html is missing: the build only includes index.html (about.html is not a build entry)');

  for (const page of ['index.html', 'about.html']) {
    const html = readFileSync(join(dist, page), 'utf8');
    const refs = assetRefs(html);
    expect(refs.some((u) => /\.js(\?|$)/.test(u)), `dist/${page} loads no built script`);
    for (const u of refs) {
      expect(!/^(\/|[a-z]+:)/i.test(u), `dist/${page} references "${u}", an absolute URL: the site would break when served from a subfolder`);
      expect(existsSync(join(dist, dirname(page), u.split(/[?#]/)[0])), `dist/${page} references "${u}", which does not exist in dist/`);
    }
  }

  const js = filesUnder(dist).filter((f) => f.endsWith('.js'));
  const env = js.some((f) => readFileSync(f, 'utf8').includes(PROBE));
  expect(env, 'VITE_APP_TITLE is not baked into the built JavaScript (built with VITE_APP_TITLE set in the environment; is it read via import.meta.env?)');
  expect(!js.some((f) => /import\.meta\.env|process\.env\.VITE_APP_TITLE/.test(readFileSync(f, 'utf8'))), 'the built JavaScript still reads the title at runtime instead of having it replaced at build time');

  const robots = join(dist, 'robots.txt');
  expect(existsSync(robots), 'dist/robots.txt is missing: it should be copied unchanged to the root of the build output');
  expect(/user-agent/i.test(readFileSync(robots, 'utf8')), 'dist/robots.txt does not look like a robots.txt file');
  return `vite@${version}: two pages, relative asset URLs, build-time env and public files correct`;
});
