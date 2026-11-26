import assert from 'node:assert/strict';
import { startMocking } from './solution.mjs';

const server = startMocking();

try {
  // GET /products/:id
  let res = await fetch('https://api.shop.test/products/42');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: '42', name: 'Product 42' });

  // GET /products/0 -> 404
  res = await fetch('https://api.shop.test/products/0');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'not found' });

  // GET /search
  res = await fetch('https://api.shop.test/search?q=shoes');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { query: 'shoes', results: [] });

  // POST /orders valid
  res = await fetch('https://api.shop.test/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p1', quantity: 2 }),
  });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { orderId: 'ord_1', productId: 'p1', quantity: 2 });

  // second order increments counter
  res = await fetch('https://api.shop.test/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p2', quantity: 5 }),
  });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { orderId: 'ord_2', productId: 'p2', quantity: 5 });

  // POST /orders invalid quantity
  res = await fetch('https://api.shop.test/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p1', quantity: -1 }),
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'invalid quantity' });

  res = await fetch('https://api.shop.test/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p1', quantity: 1.5 }),
  });
  assert.equal(res.status, 400);

  // GET /health -> network error
  await assert.rejects(() => fetch('https://api.shop.test/health'));

  // unmatched request -> must error, never hit real network
  try {
    await fetch('https://api.shop.test/unknown-route');
    assert.fail('expected fetch to reject');
  } catch (e) {
    // If this were a real network attempt, the cause would be a DNS
    // lookup failure (ENOTFOUND) for the fake api.shop.test host.
    assert.notEqual(e.cause?.code, 'ENOTFOUND');
  }

  console.log('ALL CHECKS PASSED');
} finally {
  server.close();
}
