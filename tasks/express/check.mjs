import { runCheck, expectInstalled, importSolution, expect, expectEqual } from '../../src/check-helpers.js';

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'express', 5);
  const m = await importSolution(ws);
  const createApp = m.createApp ?? m.default;
  expect(typeof createApp === 'function', '`createApp` is not exported');
  const app = createApp();
  expect(app && typeof app.listen === 'function', 'createApp() did not return an Express app');

  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
    s.on('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (p) => {
    const r = await fetch(base + p);
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 80); }
    return [r.status, body];
  };
  try {
    expectEqual(await get('/health'), [200, { status: 'ok' }], 'GET /health');
    expectEqual(await get('/files/a/b/c.txt'), [200, { path: 'a/b/c.txt' }], 'GET /files/a/b/c.txt');
    expectEqual(await get('/files/readme.md'), [200, { path: 'readme.md' }], 'GET /files/readme.md');
    expectEqual(await get('/boom'), [500, { error: 'boom' }], 'GET /boom');
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
  return `express@${version}: wildcard route and async errors correct`;
});
