import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { startMockServer } from '../src/check-helpers.js';
import { declaredMajor, checkProject, adviseOne } from '../src/advisor.js';
import { init, stopHook } from '../src/install.js';

// A fake npm registry so tests never touch the network.
const LATEST = { commander: '15.1.0', zod: '4.6.7', vitest: '5.1.2', '@scope/lib': '2.0.0', tiny: '0.4.1' };
let registry;
before(async () => {
  registry = await startMockServer((req) => {
    const name = decodeURIComponent(req.path.slice(1));
    return LATEST[name] ? { json: { name, 'dist-tags': { latest: LATEST[name] } } } : { status: 404, json: {} };
  });
  process.env.ONESHOT_REGISTRY = registry.url;
  process.env.ONESHOT_DEPSDEV = registry.url; // deps.dev lookups get a 404: no network in tests
});
after(() => registry.close());

const project = (pkg) => {
  const dir = mkdtempSync(join(tmpdir(), 'oneshot-adv-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  return dir;
};

test('declaredMajor reads common ranges and skips ones it cannot compare', () => {
  assert.equal(declaredMajor('^12.1.0'), 12);
  assert.equal(declaredMajor('~4.2'), 4);
  assert.equal(declaredMajor('>=3 <5'), 3);
  assert.equal(declaredMajor('2.x'), 2);
  assert.equal(declaredMajor('^1.0.0 || ^2.0.0'), 2);
  for (const r of ['latest', '*', 'file:../x', 'workspace:*', 'github:a/b', 'git+https://x/y.git', '']) assert.equal(declaredMajor(r), null, r);
});

test('checkProject flags outdated majors and leaves current or uncomparable ones alone', async () => {
  const dir = project({ dependencies: { commander: '^12.1.0', zod: '^4.0.0', local: 'file:../local', tiny: '^0.3.0' }, devDependencies: { vitest: '^2.1.9', ghost: '^1.0.0' } });
  const rep = await checkProject(dir);
  assert.deepEqual(rep.outdated.map((o) => [o.name, o.behind]), [['commander', 3], ['vitest', 3]]);
  assert.ok(rep.skipped.some((s) => s.name === 'local'));
  assert.ok(rep.skipped.some((s) => s.name === 'ghost' && s.reason === 'not on npm'));
});

test('adviseOne gives the install command and warns about invented names', async () => {
  const ok = await adviseOne('commander');
  assert.equal(ok.latest, '15.1.0');
  assert.match(ok.advice, /npm install commander@latest/);
  const missing = await adviseOne('definitely-not-a-package');
  assert.equal(missing.exists, false);
  assert.match(missing.advice, /not on npm/);
});

test('Stop hook blocks with a reason while a dependency is outdated', async () => {
  const dir = project({ dependencies: { commander: '^12.0.0' } });
  const r = await stopHook(JSON.stringify({ cwd: dir, stop_hook_active: false }));
  assert.equal(r.code, 2);
  assert.match(r.message, /commander "\^12\.0\.0" → current is 15\.1\.0/);
});

test('Stop hook lets the agent stop when everything is current, or after it already blocked once', async () => {
  const current = project({ dependencies: { commander: '^15.0.0' } });
  assert.equal((await stopHook(JSON.stringify({ cwd: current }))).code, 0);
  const old = project({ dependencies: { commander: '^12.0.0' } });
  assert.equal((await stopHook(JSON.stringify({ cwd: old, stop_hook_active: true }))).code, 0);
});

test('init adds the MCP server, the Stop hook and the CLAUDE.md line, and is idempotent', () => {
  const dir = project({});
  writeFileSync(join(dir, 'CLAUDE.md'), '# Project\n');
  init(dir);
  init(dir);
  const mcp = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8'));
  assert.deepEqual(mcp.mcpServers.oneshot, { command: 'npx', args: ['-y', 'oneshot-agent', 'mcp'] });
  const settings = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'));
  assert.equal(settings.hooks.Stop.length, 1);
  assert.equal(settings.hooks.Stop[0].hooks[0].command, 'npx -y oneshot-agent hook');
  const md = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  assert.equal(md.match(/Never write these from memory/g).length, 1);
  assert.ok(md.startsWith('# Project'));
});

test('MCP server: initialize, list tools, call check_package', async () => {
  const bin = new URL('../bin/oneshot.js', import.meta.url).pathname;
  const child = spawn(process.execPath, [bin, 'mcp'], { env: { ...process.env, ONESHOT_REGISTRY: registry.url } });
  const replies = new Map();
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (line.trim()) { const m = JSON.parse(line); replies.set(m.id, m); }
    }
  });
  const ask = (id, method, params) => {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => (replies.has(id) ? resolve(replies.get(id)) : Date.now() - t0 > 5000 ? reject(new Error(`no reply to ${method}`)) : setTimeout(tick, 20));
      tick();
    });
  };
  try {
    const initR = await ask(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    assert.equal(initR.result.serverInfo.name, 'oneshot');
    assert.match(initR.result.instructions, /check_package/);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const list = await ask(2, 'tools/list', {});
    assert.deepEqual(list.result.tools.map((t) => t.name), ['current_facts', 'check_package', 'check_project']);
    const call = await ask(3, 'tools/call', { name: 'check_package', arguments: { name: 'zod' } });
    assert.equal(call.result.isError, false);
    assert.match(call.result.content[0].text, /zod@4\.6\.7/);
  } finally {
    child.kill();
  }
});

test('Python: requirement specs are read correctly', async () => {
  const { declaredMajorPy } = await import('../src/advisor.js');
  assert.equal(declaredMajorPy('==1.10.13'), 1);
  assert.equal(declaredMajorPy('~=2.3'), 2);
  assert.equal(declaredMajorPy('>=1.10,<2'), 1);
  assert.equal(declaredMajorPy('>=1.10,<2.5'), 2);
  assert.equal(declaredMajorPy('^1.4'), 1);
  assert.equal(declaredMajorPy('>=2.31'), null, 'no upper limit cannot be outdated');
  assert.equal(declaredMajorPy(''), null);
});

test('Python: requirements.txt and pyproject.toml are checked against PyPI', async () => {
  const pypi = await startMockServer((req) => {
    const name = req.path.split('/')[2];
    const v = { pydantic: '2.14.4', requests: '2.32.5', openai: '3.60.0' }[name];
    return v ? { json: { info: { version: v } } } : { status: 404, json: {} };
  });
  process.env.ONESHOT_PYPI = pypi.url;
  try {
    const dir = mkdtempSync(join(tmpdir(), 'oneshot-py-'));
    writeFileSync(join(dir, 'requirements.txt'), 'pydantic==1.10.13\nrequests>=2.31\n# comment\n');
    writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "x"\ndependencies = [\n  "openai>=0.27,<1",\n]\n');
    const rep = await checkProject(dir);
    assert.deepEqual(rep.outdated.map((o) => [o.name, o.system, o.behind]).sort(), [['openai', 'pypi', 3], ['pydantic', 'pypi', 1]]);
    assert.ok(rep.skipped.some((s) => s.name === 'requests' && s.reason === 'no upper version limit'));
    assert.deepEqual(rep.outdated.find((o) => o.name === 'openai').notes, [], 'npm notes never leak onto Python packages');
  } finally {
    delete process.env.ONESHOT_PYPI;
    await pypi.close();
  }
});

test('facts: risk levels follow how new the current major is', async () => {
  const { riskOf } = await import('../src/facts.js');
  assert.equal(riskOf({ ageMonths: 6, majorsIn2y: 1, major: 15 }), 'high');
  assert.equal(riskOf({ ageMonths: 30, majorsIn2y: 3, major: 9 }), 'high');
  assert.equal(riskOf({ ageMonths: 18, majorsIn2y: 1, major: 4 }), 'medium');
  assert.equal(riskOf({ ageMonths: 40, majorsIn2y: 1, major: 2 }), 'low');
  assert.equal(riskOf({ ageMonths: 3, majorsIn2y: 1, major: 0 }), 'low');
  assert.equal(riskOf({ ageMonths: 3, majorsIn2y: 2, major: 2026 }), 'low', 'calendar versions');
  assert.equal(riskOf({ ageMonths: 3, majorsIn2y: 1, major: 2, deprecated: true }), 'deprecated');
});

test('live facts: runtimes, actions and models come back formatted, and stale values in a project are caught', async () => {
  const today = new Date();
  const later = `${today.getFullYear() + 2}-01-01`;
  const src = await startMockServer((req) => {
    if (req.path === '/api/nodejs.json') return { json: [{ cycle: '26', lts: '2026-10-28', latest: '26.13.1', eol: later }, { cycle: '24', lts: '2025-10-28', latest: '24.22.3', eol: later }] };
    if (req.path === '/api/python.json') return { json: [{ cycle: '3.15', latest: '3.15.2', eol: later }, { cycle: '3.8', latest: '3.8.20', eol: '2024-10-07' }] };
    const m = req.path.match(/^\/repos\/(.+)\/releases\/latest$/);
    if (m) return { json: { tag_name: m[1] === 'actions/checkout' ? 'v7.0.1' : 'v7.1.0' } };
    return { status: 404, json: {} };
  });
  const cache = join(mkdtempSync(join(tmpdir(), 'oneshot-cache-')), 'facts.json');
  Object.assign(process.env, { ONESHOT_EOL: src.url, ONESHOT_GITHUB: src.url, ONESHOT_FACTS_CACHE: cache });
  try {
    const { currentFacts, formatFacts, scanProjectFacts } = await import('../src/livefacts.js');
    const text = formatFacts(await currentFacts());
    assert.match(text, /Node\.js: current LTS is 26/);
    assert.match(text, /actions\/checkout@v7/);
    assert.match(text, /claude-opus-5-5/);

    const dir = mkdtempSync(join(tmpdir(), 'oneshot-proj-'));
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'steps:\n  - uses: actions/checkout@v4\n  - uses: actions/setup-node@v7\n    with:\n      node-version: 20\n');
    writeFileSync(join(dir, 'Dockerfile'), 'FROM python:3.8-slim\n');
    writeFileSync(join(dir, 'ai.mjs'), 'const a = "claude-opus-4-8"; const b = "claude-sonnet-5-5";\n');
    const found = (await scanProjectFacts(dir)).map((p) => p.found).sort();
    assert.deepEqual(found, ['actions/checkout@v4', 'claude-opus-4-8', 'node-version 20', 'python:3.8-slim']);
  } finally {
    for (const k of ['ONESHOT_EOL', 'ONESHOT_GITHUB', 'ONESHOT_FACTS_CACHE']) delete process.env[k];
    await src.close();
  }
});

test('MCP server lists the current_facts tool', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/mcp.js', import.meta.url), 'utf8');
  assert.match(src, /name: 'current_facts'/);
});
