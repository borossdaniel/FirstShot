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
  process.env.FIRSTSHOT_REGISTRY = registry.url;
  process.env.FIRSTSHOT_DEPSDEV = registry.url; // deps.dev lookups get a 404: no network in tests
});
after(() => registry.close());

const project = (pkg) => {
  const dir = mkdtempSync(join(tmpdir(), 'firstshot-adv-'));
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
  assert.deepEqual(mcp.mcpServers.firstshot, { command: 'npx', args: ['-y', 'firstshot', 'mcp'] });
  const settings = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'));
  assert.equal(settings.hooks.Stop.length, 1);
  assert.equal(settings.hooks.Stop[0].hooks[0].command, 'npx -y firstshot hook');
  const md = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  assert.equal(md.match(/Never write dependency versions from memory/g).length, 1);
  assert.ok(md.startsWith('# Project'));
});

test('MCP server: initialize, list tools, call check_package', async () => {
  const bin = new URL('../bin/firstshot.js', import.meta.url).pathname;
  const child = spawn(process.execPath, [bin, 'mcp'], { env: { ...process.env, FIRSTSHOT_REGISTRY: registry.url } });
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
    assert.equal(initR.result.serverInfo.name, 'firstshot');
    assert.match(initR.result.instructions, /check_package/);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const list = await ask(2, 'tools/list', {});
    assert.deepEqual(list.result.tools.map((t) => t.name), ['check_package', 'check_project']);
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
  process.env.FIRSTSHOT_PYPI = pypi.url;
  try {
    const dir = mkdtempSync(join(tmpdir(), 'firstshot-py-'));
    writeFileSync(join(dir, 'requirements.txt'), 'pydantic==1.10.13\nrequests>=2.31\n# comment\n');
    writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "x"\ndependencies = [\n  "openai>=0.27,<1",\n]\n');
    const rep = await checkProject(dir);
    assert.deepEqual(rep.outdated.map((o) => [o.name, o.system, o.behind]).sort(), [['openai', 'pypi', 3], ['pydantic', 'pypi', 1]]);
    assert.ok(rep.skipped.some((s) => s.name === 'requests' && s.reason === 'no upper version limit'));
    assert.deepEqual(rep.outdated.find((o) => o.name === 'openai').notes, [], 'npm notes never leak onto Python packages');
  } finally {
    delete process.env.FIRSTSHOT_PYPI;
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
