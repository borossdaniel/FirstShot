import { runCheck, expectInstalled, startMockServer, expect, expectEqual, fail, firstLine } from '../../src/check-helpers.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const API = 'https://api.shop.test';

async function call(path, init) {
  let r;
  try {
    r = await fetch(path.startsWith('http') ? path : API + path, init);
  } catch (e) {
    fail('wrong_behavior', `fetch ${path} failed: ${e.message}${e.cause ? ` (${String(e.cause.message || e.cause).slice(0, 150)})` : ''}`);
  }
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 80); }
  return [r.status, body];
}

async function rejects(url, init) {
  try {
    const r = await fetch(url, init);
    return { rejected: false, status: r.status, text: (await r.text()).slice(0, 80) };
  } catch {
    return { rejected: true };
  }
}

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'msw', 3);
  const file = join(ws, 'solution.mjs');
  if (!existsSync(file)) fail('no_solution', 'solution.mjs was not created');
  let m;
  try {
    m = await import(pathToFileURL(file).href);
  } catch (e) {
    // e.message names the missing export (e.g. an API removed in this major); the stack's first line does not.
    fail('crash', `solution.mjs threw on import: ${e?.name || 'Error'}: ${String(e?.message || e).split('\n')[0].slice(0, 250)}`);
  }
  expect(typeof m.startMocking === 'function', '`startMocking` is not exported');

  // A real local server standing in for "the network": unhandled requests must never reach it.
  const network = await startMockServer(() => ({ status: 200, json: { from: 'real network' } }));
  // Silence MSW's own warnings/errors about unhandled requests; they are expected here.
  const origWarn = console.warn;
  const origError = console.error;
  console.warn = () => {};
  console.error = () => {};
  let server;
  try {
    try {
      server = await m.startMocking();
    } catch (e) {
      fail('crash', `startMocking() threw: ${firstLine(e)}`);
    }
    expect(server && typeof server.close === 'function', 'startMocking() did not return the MSW server (no close())');

    try {
      expectEqual(await call('/products/7'), [200, { id: '7', name: 'Product 7' }], 'GET /products/7');
      expectEqual(await call('/products/abc'), [200, { id: 'abc', name: 'Product abc' }], 'GET /products/abc');
      expectEqual(await call('/products/0'), [404, { error: 'not found' }], 'GET /products/0');
      expectEqual(await call('/search?q=red%20shoes'), [200, { query: 'red shoes', results: [] }], 'GET /search?q=red%20shoes');

      const post = (body) => call('/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      expectEqual(await post({ productId: '7', quantity: 2 }), [201, { orderId: 'ord_1', productId: '7', quantity: 2 }], 'POST /orders { productId: "7", quantity: 2 }');
      expectEqual(await post({ productId: '7', quantity: 0 }), [400, { error: 'invalid quantity' }], 'POST /orders { quantity: 0 }');
      expectEqual(await post({ productId: '8', quantity: 1 }), [201, { orderId: 'ord_2', productId: '8', quantity: 1 }], 'POST /orders { productId: "8", quantity: 1 }');

      const health = await rejects(API + '/health');
      expect(health.rejected, `GET /health should fail with a network error, but it answered status ${health.status}`);

      const leak = await rejects(`${network.url}/unhandled?from=firstshot`);
      expect(network.requests.length === 0, `a request with no matching handler went through to the real network (got status ${leak.status} "${leak.text}"); unhandled requests must fail instead`);
      expect(leak.rejected, `a request with no matching handler should fail, but it answered status ${leak.status}`);
      const unknown = await rejects(API + '/unknown');
      expect(unknown.rejected, `GET ${API}/unknown has no handler and should fail, but it answered status ${unknown.status}`);
    } finally {
      await server.close();
    }

    const after = await rejects(`${network.url}/after-close`);
    expect(!after.rejected && network.requests.length === 1, 'after server.close() requests are still intercepted');
  } finally {
    console.warn = origWarn;
    console.error = origError;
    await network.close();
  }
  return `msw@${version}: handlers, params, body, network errors and unhandled-request strategy correct`;
});
