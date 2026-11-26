import { buildApp } from './solution.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('PASS: ' + msg);
}

async function main() {
  const app = buildApp();
  await app.ready();

  // 1. Create a valid user
  let res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Alice', email: 'alice@example.com', password: 'password1' } });
  assert(res.statusCode === 201, 'create user returns 201');
  let body = JSON.parse(res.body);
  assert(body.id === 1, 'first user id is 1');
  assert(body.name === 'Alice', 'name correct');
  assert(body.email === 'alice@example.com', 'email correct');
  assert(body.password === undefined, 'password not in response');

  // 2. Create second user
  res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Bob', email: 'bob@example.com', password: 'password2' } });
  body = JSON.parse(res.body);
  assert(body.id === 2, 'second user id is 2');

  // 3. GET by id success
  res = await app.inject({ method: 'GET', url: '/users/1' });
  assert(res.statusCode === 200, 'get user 1 -> 200');
  body = JSON.parse(res.body);
  assert(body.name === 'Alice', 'get user 1 name correct');
  assert(body.password === undefined, 'get user password not exposed');

  // 4. GET by id not found
  res = await app.inject({ method: 'GET', url: '/users/999' });
  assert(res.statusCode === 404, 'get missing user -> 404');
  body = JSON.parse(res.body);
  assert(body.error === 'not found', 'not found error message correct');

  // 5. GET by id invalid (not positive integer)
  res = await app.inject({ method: 'GET', url: '/users/0' });
  assert(res.statusCode === 400, 'get user id 0 -> 400');

  res = await app.inject({ method: 'GET', url: '/users/-1' });
  assert(res.statusCode === 400, 'get user id -1 -> 400');

  res = await app.inject({ method: 'GET', url: '/users/abc' });
  assert(res.statusCode === 400, 'get user id abc -> 400');

  // 6. GET list default limit
  res = await app.inject({ method: 'GET', url: '/users' });
  assert(res.statusCode === 200, 'list users -> 200');
  body = JSON.parse(res.body);
  assert(body.limit === 10, 'default limit is 10');
  assert(body.users.length === 2, 'list returns 2 users (only 2 exist)');
  assert(body.users[0].password === undefined, 'list password not exposed');

  // 7. GET list with limit
  res = await app.inject({ method: 'GET', url: '/users?limit=1' });
  body = JSON.parse(res.body);
  assert(body.limit === 1, 'limit reflected as 1');
  assert(body.users.length === 1, 'list respects limit=1');

  // 8. GET list invalid limit
  res = await app.inject({ method: 'GET', url: '/users?limit=0' });
  assert(res.statusCode === 400, 'limit=0 -> 400');

  res = await app.inject({ method: 'GET', url: '/users?limit=51' });
  assert(res.statusCode === 400, 'limit=51 -> 400');

  res = await app.inject({ method: 'GET', url: '/users?limit=abc' });
  assert(res.statusCode === 400, 'limit=abc -> 400');

  // 9. POST invalid bodies
  res = await app.inject({ method: 'POST', url: '/users', payload: { name: '', email: 'a@b.com', password: 'password1' } });
  assert(res.statusCode === 400, 'empty name -> 400');

  res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'x'.repeat(51), email: 'a@b.com', password: 'password1' } });
  assert(res.statusCode === 400, 'name too long -> 400');

  res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Carl', email: 'not-an-email', password: 'password1' } });
  assert(res.statusCode === 400, 'invalid email -> 400');

  res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Carl', email: 'carl@example.com', password: 'short' } });
  assert(res.statusCode === 400, 'short password -> 400');

  res = await app.inject({ method: 'POST', url: '/users', payload: { email: 'carl@example.com', password: 'password1' } });
  assert(res.statusCode === 400, 'missing name -> 400');

  res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Carl', password: 'password1' } });
  assert(res.statusCode === 400, 'missing email -> 400');

  res = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Carl', email: 'carl@example.com' } });
  assert(res.statusCode === 400, 'missing password -> 400');

  // 10. Fresh app has empty store
  const app2 = buildApp();
  await app2.ready();
  res = await app2.inject({ method: 'GET', url: '/users' });
  body = JSON.parse(res.body);
  assert(body.users.length === 0, 'new app instance starts with empty user store');
  await app2.close();

  await app.close();
  console.log('\nALL TESTS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
