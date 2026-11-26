import { buildApp } from './solution.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('OK: ' + msg);
}

const app = buildApp();

// valid create
let res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Alice', email: 'alice@example.com', password: 'password123' } });
assert(res.statusCode === 201, 'create user 201');
let body = JSON.parse(res.body);
assert(body.id === 1 && body.name === 'Alice' && body.email === 'alice@example.com', 'create user body');
assert(!('password' in body), 'password not in create response');

// second user
res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Bob', email: 'bob@example.com', password: 'password456' } });
body = JSON.parse(res.body);
assert(body.id === 2, 'second user gets id 2');

// invalid: short password
res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'C', email: 'c@example.com', password: 'short' } });
assert(res.statusCode === 400, 'short password -> 400');

// invalid: bad email
res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'C', email: 'not-an-email', password: 'password123' } });
assert(res.statusCode === 400, 'bad email -> 400');

// invalid: missing field
res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'C', email: 'c@example.com' } });
assert(res.statusCode === 400, 'missing password -> 400');

// invalid: name too long
res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'x'.repeat(51), email: 'c@example.com', password: 'password123' } });
assert(res.statusCode === 400, 'name too long -> 400');

// get existing user
res = await app.inject({ method: 'GET', url: '/users/1' });
assert(res.statusCode === 200, 'get user 1 -> 200');
body = JSON.parse(res.body);
assert(body.id === 1 && body.name === 'Alice' && !('password' in body), 'get user 1 body, no password');

// get missing user
res = await app.inject({ method: 'GET', url: '/users/999' });
assert(res.statusCode === 404, 'get user 999 -> 404');
body = JSON.parse(res.body);
assert(body.error === 'not found', '404 body shape');

// invalid id (not positive integer)
res = await app.inject({ method: 'GET', url: '/users/0' });
assert(res.statusCode === 400, 'id=0 -> 400');

res = await app.inject({ method: 'GET', url: '/users/abc' });
assert(res.statusCode === 400, 'id=abc -> 400');

res = await app.inject({ method: 'GET', url: '/users/-1' });
assert(res.statusCode === 400, 'id=-1 -> 400');

// list with default limit
res = await app.inject({ method: 'GET', url: '/users' });
assert(res.statusCode === 200, 'list default -> 200');
body = JSON.parse(res.body);
assert(body.limit === 10, 'default limit is 10');
assert(body.users.length === 2, 'list has 2 users so far');

// list with limit=1
res = await app.inject({ method: 'GET', url: '/users?limit=1' });
body = JSON.parse(res.body);
assert(body.limit === 1 && body.users.length === 1 && body.users[0].id === 1, 'limit=1 works');

// invalid limit
res = await app.inject({ method: 'GET', url: '/users?limit=0' });
assert(res.statusCode === 400, 'limit=0 -> 400');

res = await app.inject({ method: 'GET', url: '/users?limit=51' });
assert(res.statusCode === 400, 'limit=51 -> 400');

res = await app.inject({ method: 'GET', url: '/users?limit=abc' });
assert(res.statusCode === 400, 'limit=abc -> 400');

// fresh app has empty store
const app2 = buildApp();
res = await app2.inject({ method: 'GET', url: '/users' });
body = JSON.parse(res.body);
assert(body.users.length === 0, 'fresh app has empty user store');

console.log('\nAll smoke tests passed.');
await app.close();
await app2.close();
