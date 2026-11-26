import assert from 'node:assert/strict';
import { UserSchema, parseUser } from './solution.mjs';

// Valid input with tags
{
  const res = parseUser({ email: 'a@b.com', age: 20, tags: ['x', 'y'] });
  assert.equal(res.ok, true);
  assert.deepEqual(res.user, { email: 'a@b.com', age: 20, tags: ['x', 'y'] });
}

// Valid input, tags defaulted
{
  const res = parseUser({ email: 'a@b.com', age: 13 });
  assert.equal(res.ok, true);
  assert.deepEqual(res.user, { email: 'a@b.com', age: 13, tags: [] });
}

// Invalid email
{
  const res = parseUser({ email: 'not-an-email', age: 20 });
  assert.equal(res.ok, false);
  assert.equal(typeof res.errors.email, 'string');
  console.log('invalid email message:', res.errors.email);
}

// Age too young
{
  const res = parseUser({ email: 'a@b.com', age: 10 });
  assert.equal(res.ok, false);
  assert.equal(typeof res.errors.age, 'string');
  console.log('age too young message:', res.errors.age);
}

// Non-integer age
{
  const res = parseUser({ email: 'a@b.com', age: 13.5 });
  assert.equal(res.ok, false);
  assert.equal(typeof res.errors.age, 'string');
  console.log('non-integer age message:', res.errors.age);
}

// Wrong type tags
{
  const res = parseUser({ email: 'a@b.com', age: 20, tags: ['ok', 5] });
  assert.equal(res.ok, false);
  assert.equal(typeof res.errors.tags, 'string');
  console.log('bad tags message:', res.errors.tags);
}

// Multiple errors at once
{
  const res = parseUser({ email: 'bad', age: 5 });
  assert.equal(res.ok, false);
  assert.deepEqual(Object.keys(res.errors).sort(), ['age', 'email']);
}

// Schema is a real ZodObject usable directly
{
  const parsed = UserSchema.parse({ email: 'a@b.com', age: 30 });
  assert.deepEqual(parsed, { email: 'a@b.com', age: 30, tags: [] });
}

console.log('ALL TESTS PASSED');
