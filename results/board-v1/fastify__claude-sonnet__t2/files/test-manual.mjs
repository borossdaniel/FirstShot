import { buildApp } from './solution.mjs';

const app = buildApp();

async function req(method, url, payload) {
  const res = await app.inject({ method, url, payload });
  return { status: res.statusCode, body: res.json() };
}

const results = [];

results.push(['create valid user', await req('POST', '/users', { name: 'Alice', email: 'alice@example.com', password: 'password123' })]);
results.push(['create second user', await req('POST', '/users', { name: 'Bob', email: 'bob@example.com', password: 'password123' })]);
results.push(['invalid email', await req('POST', '/users', { name: 'Bad', email: 'not-an-email', password: 'password123' })]);
results.push(['short password', await req('POST', '/users', { name: 'Bad', email: 'bad@example.com', password: 'short' })]);
results.push(['empty name', await req('POST', '/users', { name: '', email: 'bad2@example.com', password: 'password123' })]);
results.push(['missing field', await req('POST', '/users', { name: 'NoPass', email: 'np@example.com' })]);
results.push(['get user 1', await req('GET', '/users/1')]);
results.push(['get user 999', await req('GET', '/users/999')]);
results.push(['get user invalid id', await req('GET', '/users/abc')]);
results.push(['get user negative id', await req('GET', '/users/-1')]);
results.push(['list default limit', await req('GET', '/users')]);
results.push(['list limit=1', await req('GET', '/users?limit=1')]);
results.push(['list limit=0 invalid', await req('GET', '/users?limit=0')]);
results.push(['list limit=51 invalid', await req('GET', '/users?limit=51')]);

for (const [label, r] of results) {
  console.log(label, '->', r.status, JSON.stringify(r.body));
}

const hasPassword = JSON.stringify(results).includes('password123');
console.log('\nLeaked password in any response:', hasPassword);

await app.close();
