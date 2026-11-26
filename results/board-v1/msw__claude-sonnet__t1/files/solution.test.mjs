import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startMocking } from './solution.mjs';

let server;

before(() => {
  server = startMocking();
});

after(() => {
  server.close();
});

test('GET /products/:id returns product', async () => {
  const res = await fetch('https://api.shop.test/products/42');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: '42', name: 'Product 42' });
});

test('GET /products/0 returns 404', async () => {
  const res = await fetch('https://api.shop.test/products/0');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'not found' });
});

test('GET /search returns query and empty results', async () => {
  const res = await fetch('https://api.shop.test/search?q=shoes');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { query: 'shoes', results: [] });
});

test('POST /orders creates an order, incrementing orderId', async () => {
  const res1 = await fetch('https://api.shop.test/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p1', quantity: 2 }),
  });
  assert.equal(res1.status, 201);
  assert.deepEqual(await res1.json(), { orderId: 'ord_1', productId: 'p1', quantity: 2 });

  const res2 = await fetch('https://api.shop.test/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p2', quantity: 5 }),
  });
  assert.equal(res2.status, 201);
  assert.deepEqual(await res2.json(), { orderId: 'ord_2', productId: 'p2', quantity: 5 });
});

test('POST /orders with invalid quantity returns 400', async () => {
  const res = await fetch('https://api.shop.test/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p1', quantity: -1 }),
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'invalid quantity' });
});

test('POST /orders with non-integer quantity returns 400', async () => {
  const res = await fetch('https://api.shop.test/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p1', quantity: 1.5 }),
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'invalid quantity' });
});

test('GET /health simulates a network error', async () => {
  await assert.rejects(() => fetch('https://api.shop.test/health'));
});

test('unmatched requests fail instead of hitting the network', async () => {
  await assert.rejects(() => fetch('https://api.shop.test/unknown-endpoint'));
});
