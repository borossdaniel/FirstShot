import { runCheck, expectInstalled, importSolution, expect, expectEqual, fail, firstLine } from '../../src/check-helpers.js';

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'fastify', 5);
  const m = await importSolution(ws);
  const buildApp = m.buildApp ?? m.default;
  expect(typeof buildApp === 'function', '`buildApp` is not exported');
  let app;
  try {
    app = await buildApp();
  } catch (e) {
    fail('crash', `buildApp() threw: ${firstLine(e)}`);
  }
  expect(app && typeof app.inject === 'function', 'buildApp() did not return a Fastify instance');
  try {
    await app.ready();
  } catch (e) {
    fail('crash', `app.ready() failed: ${firstLine(e)}`);
  }

  const call = async (method, url, payload) => {
    const r = await app.inject({ method, url, payload });
    let body;
    try { body = r.json(); } catch { body = r.body.slice(0, 80); }
    return { status: r.status ?? r.statusCode, body, raw: r.body };
  };
  const noPassword = (r, what) => expect(r.status >= 300 || !/password|hunter2hunter2/i.test(r.raw), `${what} leaks the password: ${r.raw.slice(0, 160)}`);

  try {
    let r = await call('POST', '/users', { name: 'Ada', email: 'ada@example.com', password: 'hunter2hunter2' });
    noPassword(r, 'POST /users');
    expectEqual([r.status, r.body], [201, { id: 1, name: 'Ada', email: 'ada@example.com' }], 'POST /users');

    for (const [label, body] of [
      ['an invalid email', { name: 'Bob', email: 'not-an-email', password: 'longenough' }],
      ['a missing password', { name: 'Bob', email: 'bob@example.com' }],
      ['a 3-character password', { name: 'Bob', email: 'bob@example.com', password: 'abc' }],
      ['an empty name', { name: '', email: 'bob@example.com', password: 'longenough' }],
    ]) {
      r = await call('POST', '/users', body);
      expect(r.status === 400, `POST /users with ${label} should be rejected with 400, got ${r.status} ${JSON.stringify(r.body)}`);
    }

    r = await call('GET', '/users/1');
    noPassword(r, 'GET /users/1');
    expectEqual([r.status, r.body], [200, { id: 1, name: 'Ada', email: 'ada@example.com' }], 'GET /users/1');
    r = await call('GET', '/users/99');
    expectEqual([r.status, r.body], [404, { error: 'not found' }], 'GET /users/99');
    r = await call('GET', '/users/abc');
    expectEqual(r.status, 400, 'GET /users/abc status (id must be an integer)');

    await call('POST', '/users', { name: 'Cy', email: 'cy@example.com', password: 'longenough' });
    r = await call('GET', '/users');
    expectEqual([r.status, r.body?.limit], [200, 10], 'GET /users (default limit)');
    expectEqual(r.body?.users, [{ id: 1, name: 'Ada', email: 'ada@example.com' }, { id: 2, name: 'Cy', email: 'cy@example.com' }], 'GET /users users (rejected users must not be stored)');
    noPassword(r, 'GET /users');
    r = await call('GET', '/users?limit=1');
    expectEqual([r.status, r.body], [200, { limit: 1, users: [{ id: 1, name: 'Ada', email: 'ada@example.com' }] }], 'GET /users?limit=1');
    for (const bad of ['abc', '0', '51']) {
      r = await call('GET', `/users?limit=${bad}`);
      expectEqual(r.status, 400, `GET /users?limit=${bad} status`);
    }
  } finally {
    await app.close();
  }
  return `fastify@${version}: routes, schema validation, coercion and response filtering correct`;
});
