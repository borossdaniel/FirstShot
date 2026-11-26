// Helpers for task check scripts.
//
// A check script runs AFTER the agent has finished, as:
//   node tasks/<id>/check.mjs <workspace>
// It must print exactly one line starting with RESULT_PREFIX followed by JSON
// ({ ok, category, detail }) and exit 0 on pass, 1 on fail.
//
// Categories (shared with the report):
//   pass            everything worked
//   no_solution     the file we asked for does not exist
//   not_installed   the library is not installed (often: hallucinated package name)
//   outdated_major  an old major version was installed instead of the current one
//   crash           the solution threw while loading
//   wrong_behavior  it loaded but did not do what the task asked

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const RESULT_PREFIX = 'ONESHOT_RESULT ';

export class CheckFailure extends Error {
  constructor(category, detail) {
    super(detail);
    this.category = category;
  }
}

export function fail(category, detail) {
  throw new CheckFailure(category, detail);
}

/** Assert a condition; on failure it counts as wrong_behavior. */
export function expect(cond, detail) {
  if (!cond) fail('wrong_behavior', detail);
}

export function expectEqual(actual, expected, what) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) fail('wrong_behavior', `${what}: expected ${e}, got ${a}`);
}

/** Check that `pkg` is installed in the workspace and is at least `major`. */
export function expectInstalled(ws, pkg, major) {
  const pj = join(ws, 'node_modules', ...pkg.split('/'), 'package.json');
  if (!existsSync(pj)) fail('not_installed', `${pkg} is not installed in node_modules`);
  const version = JSON.parse(readFileSync(pj, 'utf8')).version;
  const got = Number(String(version).split('.')[0]);
  if (major != null && got < major) {
    fail('outdated_major', `${pkg}@${version} installed, current major is ${major}`);
  }
  return version;
}

/** Import the agent's solution file from the workspace. */
export async function importSolution(ws, file = 'solution.mjs') {
  const p = join(ws, file);
  if (!existsSync(p)) fail('no_solution', `${file} was not created`);
  try {
    return await import(pathToFileURL(p).href);
  } catch (err) {
    fail('crash', `${file} threw on import: ${firstLine(err)}`);
  }
}

export function firstLine(err) {
  return String(err?.stack || err?.message || err).split('\n')[0].slice(0, 300);
}

/**
 * Wrap a check body. Usage in check.mjs:
 *   runCheck(async (ws) => { ...throw via fail()/expect()... });
 */
export async function runCheck(body) {
  const ws = process.argv[2];
  if (!ws) {
    console.error('usage: node check.mjs <workspace>');
    process.exit(2);
  }
  // Keep the check from hanging on servers or timers the solution leaves open.
  const guard = setTimeout(() => report(false, 'wrong_behavior', 'check timed out after 30s'), 30_000);
  guard.unref();
  try {
    const detail = await body(ws);
    report(true, 'pass', detail || 'all checks passed');
  } catch (err) {
    if (err instanceof CheckFailure) report(false, err.category, err.message);
    else report(false, 'crash', `solution threw while being checked: ${firstLine(err)}`);
  }
}

function report(ok, category, detail) {
  process.stdout.write(RESULT_PREFIX + JSON.stringify({ ok, category, detail }) + '\n');
  process.exit(ok ? 0 : 1);
}

/**
 * Tiny local HTTP server that records requests and answers with handler(req) -> { status, json }.
 * Lets checks test API SDKs (OpenAI, Anthropic, Stripe, ...) without keys or network.
 */
export async function startMockServer(handler) {
  const { createServer } = await import('node:http');
  const requests = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (d) => (raw += d));
    req.on('end', async () => {
      let body = raw;
      const type = req.headers['content-type'] || '';
      try {
        if (type.includes('json')) body = JSON.parse(raw || '{}');
        else if (type.includes('x-www-form-urlencoded')) body = Object.fromEntries(new URLSearchParams(raw));
      } catch {
        /* keep raw */
      }
      const entry = { method: req.method, path: req.url, headers: req.headers, body };
      requests.push(entry);
      let out;
      try {
        out = (await handler(entry, requests.length)) || { status: 404, json: { error: 'not mocked' } };
      } catch (e) {
        out = { status: 500, json: { error: String(e?.message || e) } };
      }
      res.writeHead(out.status || 200, { 'content-type': 'application/json', ...(out.headers || {}) });
      res.end(JSON.stringify(out.json ?? {}));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return {
    port,
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}

/**
 * Import a package exactly as the agent's own code would see it (resolved from the
 * workspace's node_modules), so the check always uses the agent's installed version.
 */
let shimCount = 0;
export async function importFromWorkspace(ws, specifier) {
  const { writeFileSync } = await import('node:fs');
  const shim = join(ws, `.oneshot-import-${process.pid}-${shimCount++}.mjs`);
  writeFileSync(shim, `import * as ns from ${JSON.stringify(specifier)};\nexport const mod = ns;\n`);
  try {
    return (await import(pathToFileURL(shim).href)).mod;
  } catch (e) {
    fail('not_installed', `could not import ${specifier} from the workspace: ${firstLine(e)}`);
  }
}

/** Run a shell command inside the workspace (for config-style tasks: build, lint, test). */
export async function sh(ws, cmd, timeoutMs = 120_000) {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('sh', ['-c', cmd], { cwd: ws, encoding: 'utf8', timeout: timeoutMs, env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' } });
  return { code: r.status ?? 1, out: (r.stdout || '') + (r.stderr || ''), timedOut: r.error?.code === 'ETIMEDOUT' };
}
