import { runCheck, expectInstalled, importSolution, expect, expectEqual } from '../../src/check-helpers.js';

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'hono', 4);
  const m = await importSolution(ws);
  const app = m.app ?? m.default;
  expect(app && typeof app.request === 'function', '`app` is not exported as a Hono app');

  let r = await app.request('/health');
  expectEqual([r.status, await r.json()], [200, { status: 'ok' }], 'GET /health');

  r = await app.request('/echo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 1, b: [2] }) });
  expectEqual([r.status, await r.json()], [201, { a: 1, b: [2] }], 'POST /echo');

  r = await app.request('/users/42', { headers: { 'x-api-key': 'secret' } });
  expectEqual([r.status, await r.json()], [200, { id: '42' }], 'GET /users/42 with key');

  r = await app.request('/users/42');
  expectEqual([r.status, await r.json()], [401, { error: 'unauthorized' }], 'GET /users/42 without key');

  r = await app.request('/users/42', { headers: { 'x-api-key': 'wrong' } });
  expectEqual(r.status, 401, 'GET /users/42 with wrong key');

  r = await app.request('/nope');
  expectEqual([r.status, await r.json().catch(() => 'not json')], [404, { error: 'not found' }], 'GET /nope');
  return `hono@${version}: all routes behave`;
});
