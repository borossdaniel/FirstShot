import assert from 'node:assert/strict';
import { startMocking } from './solution.mjs';

const server = startMocking();

try {
  // 1. GET /products/:id
  let res = await fetch('https://api.shop.test/products/42');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: '42', name: 'Product 42' });

  res = await fetch('https://api.shop.test/products/0');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'not found' });

  // 2. GET /search
  res = await fetch('https://api.shop.test/search?q=shoes');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { query: 'shoes', results: [] });

  // 3. POST /orders
  res = await fetch('https://api.shop.test/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p1', quantity: 2 }),
  });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { orderId: 'ord_1', productId: 'p1', quantity: 2 });

  res = await fetch('https://api.shop.test/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p2', quantity: 3 }),
  });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { orderId: 'ord_2', productId: 'p2', quantity: 3 });

  res = await fetch('https://api.shop.test/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p3', quantity: 0 }),
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'invalid quantity' });

  res = await fetch('https://api.shop.test/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p4', quantity: 1.5 }),
  });
  assert.equal(res.status, 400);

  res = await fetch('https://api.shop.test/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p5', quantity: -1 }),
  });
  assert.equal(res.status, 400);

  // 4. GET /health -> network error
  await assert.rejects(() => fetch('https://api.shop.test/health'));

  // Unhandled route must error, never hit real network
  await assert.rejects(() => fetch('https://api.shop.test/unknown-route'));
  await assert.rejects(() => fetch('https://example.com/'));

  console.log('ALL CHECKS PASSED');
} finally {
  server.close();
}
