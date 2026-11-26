import { buildApp } from './solution.mjs';

const app = buildApp();

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('OK: ' + msg);
}

// 1. Create a valid user
let res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Alice', email: 'alice@example.com', password: 'password123' } });
assert(res.statusCode === 201, 'create user -> 201');
let body = res.json();
assert(body.id === 1, 'first id is 1');
assert(body.name === 'Alice', 'name echoed');
assert(body.email === 'alice@example.com', 'email echoed');
assert(!('password' in body), 'password not in response');

// 2. Create second user
res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Bob', email: 'bob@example.com', password: 'password456' } });
assert(res.json().id === 2, 'second id is 2');

// 3. Invalid: short password
res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'C', email: 'c@example.com', password: 'short' } });
assert(res.statusCode === 400, 'short password -> 400');

// 4. Invalid: bad email
res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'D', email: 'not-an-email', password: 'password789' } });
assert(res.statusCode === 400, 'bad email -> 400');

// 5. Invalid: name too long
res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'x'.repeat(51), email: 'e@example.com', password: 'password789' } });
assert(res.statusCode === 400, 'name too long -> 400');

// 6. Invalid: missing field
res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'E', email: 'e@example.com' } });
assert(res.statusCode === 400, 'missing password -> 400');

// 7. GET /users/:id valid
res = await app.inject({ method: 'GET', url: '/users/1' });
assert(res.statusCode === 200, 'get user 1 -> 200');
body = res.json();
assert(body.email === 'alice@example.com', 'get user 1 email correct');
assert(!('password' in body), 'get user password not leaked');

// 8. GET /users/:id not found
res = await app.inject({ method: 'GET', url: '/users/999' });
assert(res.statusCode === 404, 'get user 999 -> 404');
assert(res.json().error === 'not found', 'not found error message');

// 9. GET /users/:id invalid id (not positive integer)
res = await app.inject({ method: 'GET', url: '/users/0' });
assert(res.statusCode === 400, 'get user 0 -> 400');

res = await app.inject({ method: 'GET', url: '/users/-1' });
assert(res.statusCode === 400, 'get user -1 -> 400');

res = await app.inject({ method: 'GET', url: '/users/abc' });
assert(res.statusCode === 400, 'get user abc -> 400');

// 10. GET /users default limit
for (let i = 0; i < 15; i++) {
  await app.inject({ method: 'POST', url: '/users', payload: { name: 'U' + i, email: `u${i}@example.com`, password: 'password000' } });
}
res = await app.inject({ method: 'GET', url: '/users' });
assert(res.statusCode === 200, 'list users -> 200');
body = res.json();
assert(body.limit === 10, 'default limit is 10');
assert(body.users.length === 10, 'default returns 10 users');
assert(!('password' in body.users[0]), 'list password not leaked');

// 11. GET /users with limit
res = await app.inject({ method: 'GET', url: '/users?limit=3' });
body = res.json();
assert(body.limit === 3, 'limit=3 reflected');
assert(body.users.length === 3, 'limit=3 returns 3 users');

// 12. GET /users invalid limit
res = await app.inject({ method: 'GET', url: '/users?limit=0' });
assert(res.statusCode === 400, 'limit=0 -> 400');

res = await app.inject({ method: 'GET', url: '/users?limit=51' });
assert(res.statusCode === 400, 'limit=51 -> 400');

res = await app.inject({ method: 'GET', url: '/users?limit=abc' });
assert(res.statusCode === 400, 'limit=abc -> 400');

console.log('\nAll tests passed.');
await app.close();
