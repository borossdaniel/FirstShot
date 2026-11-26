import { parseSignup, SignupSchema } from './solution.mjs';
import assert from 'node:assert/strict';

// valid, newsletter omitted -> default false
{
  const r = parseSignup({ email: 'a@b.com', password: '12345678' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { email: 'a@b.com', password: '12345678', newsletter: false });
}

// valid, newsletter explicit true
{
  const r = parseSignup({ email: 'a@b.com', password: '12345678', newsletter: true });
  assert.equal(r.ok, true);
  assert.equal(r.value.newsletter, true);
}

// invalid email
{
  const r = parseSignup({ email: 'not-an-email', password: '12345678' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.email, ['Enter a valid email address']);
}

// invalid password
{
  const r = parseSignup({ email: 'a@b.com', password: 'short' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.password, ['Password must be at least 8 characters']);
}

// both invalid
{
  const r = parseSignup({ email: 'bad', password: 'short' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.email, ['Enter a valid email address']);
  assert.deepEqual(r.errors.password, ['Password must be at least 8 characters']);
}

// missing fields entirely
{
  const r = parseSignup({});
  assert.equal(r.ok, false);
  assert.ok(Array.isArray(r.errors.email));
  assert.ok(Array.isArray(r.errors.password));
}

console.log('All checks passed');
console.log(JSON.stringify(parseSignup({ email: 'bad', password: 'short' }), null, 2));
