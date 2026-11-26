import { runCheck, expectInstalled, expect, expectEqual, fail } from '../../src/check-helpers.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

const MAJOR = 16;
const ws = process.argv[2];
const env = { ...process.env, CI: '1', NEXT_TELEMETRY_DISABLED: '1', FORCE_COLOR: '0', NO_COLOR: '1' };

// `next build` runs before runCheck() so its time does not count against the check's 30 s guard.
// It only runs when there is something worth building.
function prebuild() {
  if (!ws) return null;
  try {
    const pkg = JSON.parse(readFileSync(join(ws, 'package.json'), 'utf8'));
    const next = JSON.parse(readFileSync(join(ws, 'node_modules/next/package.json'), 'utf8'));
    if (Number(next.version.split('.')[0]) < MAJOR || !pkg.scripts?.build) return null;
  } catch {
    return null;
  }
  const r = spawnSync('npm', ['run', 'build'], { cwd: ws, encoding: 'utf8', timeout: 45_000, env });
  return { code: r.status ?? 1, out: (r.stdout || '') + (r.stderr || ''), timedOut: r.error?.code === 'ETIMEDOUT' };
}
const build = prebuild();

const tail = (s, n = 4) => s.trim().split('\n').slice(-n).join(' | ').slice(0, 300);

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'next', MAJOR);
  const pj = join(ws, 'package.json');
  if (!existsSync(pj)) fail('no_solution', 'package.json was not created');
  if (!JSON.parse(readFileSync(pj, 'utf8')).scripts?.build) fail('no_solution', 'npm script build is missing');
  if (!build) fail('crash', 'npm run build could not be run');
  if (build.timedOut) fail('crash', 'npm run build did not finish within 45 s');
  if (build.code !== 0) fail('crash', `npm run build failed: ${tail(build.out)}`);

  const port = await freePort();
  const server = spawn(process.execPath, [join(ws, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ws, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));
  const stop = () => {
    try { process.kill(-server.pid, 'SIGKILL'); } catch { try { server.kill('SIGKILL'); } catch { /* gone */ } }
  };
  process.on('exit', stop);

  const base = `http://127.0.0.1:${port}`;
  const get = async (p, opts = {}) => {
    const r = await fetch(base + p, { redirect: 'manual', ...opts });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: r.status, body, headers: r.headers };
  };

  try {
    let up = false;
    for (let i = 0; i < 80 && !up; i++) {
      if (server.exitCode != null) fail('crash', `next start exited: ${tail(log)}`);
      try { await fetch(base + '/', { redirect: 'manual' }); up = true; } catch { await new Promise((r) => setTimeout(r, 250)); }
    }
    if (!up) fail('crash', `next start did not answer within 20 s: ${tail(log)}`);

    let r = await get('/');
    expect(r.status === 200 && String(r.body).includes('OneShot home'), `GET / should render "OneShot home" (status ${r.status})`);

    r = await get('/api/health');
    expectEqual([r.status, r.body], [200, { status: 'ok' }], 'GET /api/health');

    r = await get('/api/users/42');
    expectEqual([r.status, r.body], [200, { id: '42' }], 'GET /api/users/42');
    r = await get('/api/users/ada-lovelace');
    expectEqual([r.status, r.body], [200, { id: 'ada-lovelace' }], 'GET /api/users/ada-lovelace');

    r = await get('/posts/hello-world');
    expect(r.status === 200, `GET /posts/hello-world returned status ${r.status}`);
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(String(r.body).replace(/<!--[\s\S]*?-->/g, ''));
    const heading = h1 ? h1[1].replace(/<[^>]+>/g, '').trim() : null;
    expectEqual(heading, 'Post: hello-world', 'the <h1> on /posts/hello-world');

    for (const [from, to] of [['/old/docs/intro?x=1', '/new/docs/intro?x=1'], ['/old/a', '/new/a']]) {
      r = await get(from);
      const loc = r.headers.get('location');
      expect([301, 302, 307, 308].includes(r.status) && loc, `GET ${from} should redirect, got status ${r.status}`);
      const u = new URL(loc, base);
      expectEqual(u.pathname + u.search, to, `redirect target of ${from}`);
    }
    r = await get('/older');
    expect(![301, 302, 307, 308].includes(r.status), '/older must not be redirected (only paths under /old/)');
  } finally {
    stop();
  }

  if (/"middleware" file convention is deprecated/i.test(build.out)) {
    fail('wrong_behavior', 'routes work, but the redirect uses the deprecated `middleware` file convention; next build warns: The "middleware" file convention is deprecated. Please use "proxy" instead.');
  }
  return `next@${version}: build, pages, route handlers and request interception correct`;
});
