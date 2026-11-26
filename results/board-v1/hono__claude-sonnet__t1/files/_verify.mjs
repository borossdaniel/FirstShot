import { app } from './solution.mjs';

const checks = [];

const r1 = await app.request('/health');
checks.push(['GET /health status', r1.status, 200]);
checks.push(['GET /health body', JSON.stringify(await r1.json()), JSON.stringify({ status: 'ok' })]);

const r2 = await app.request('/echo', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ foo: 'bar', n: 1 }),
});
checks.push(['POST /echo status', r2.status, 201]);
checks.push(['POST /echo body', JSON.stringify(await r2.json()), JSON.stringify({ foo: 'bar', n: 1 })]);

const r3 = await app.request('/users/42');
checks.push(['GET /users/42 no key status', r3.status, 401]);
checks.push(['GET /users/42 no key body', JSON.stringify(await r3.json()), JSON.stringify({ error: 'unauthorized' })]);

const r4 = await app.request('/users/42', { headers: { 'x-api-key': 'wrong' } });
checks.push(['GET /users/42 wrong key status', r4.status, 401]);

const r5 = await app.request('/users/42', { headers: { 'x-api-key': 'secret' } });
checks.push(['GET /users/42 right key status', r5.status, 200]);
checks.push(['GET /users/42 right key body', JSON.stringify(await r5.json()), JSON.stringify({ id: '42' })]);

const r6 = await app.request('/nope');
checks.push(['GET /nope status', r6.status, 404]);
checks.push(['GET /nope body', JSON.stringify(await r6.json()), JSON.stringify({ error: 'not found' })]);

let failed = 0;
for (const [name, actual, expected] of checks) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
}
console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
