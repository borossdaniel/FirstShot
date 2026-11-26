import { parseUser } from './solution.mjs';
import assert from 'node:assert';

// Valid input, defaults applied
{
  const r = parseUser({ email: 'a@b.com', age: 20 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.user, { email: 'a@b.com', age: 20, tags: [] });
}

// Valid input with explicit tags
{
  const r = parseUser({ email: 'a@b.com', age: 13, tags: ['x', 'y'] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.user.tags, ['x', 'y']);
}

// Invalid email
{
  const r = parseUser({ email: 'not-an-email', age: 20 });
  assert.equal(r.ok, false);
  assert.equal(typeof r.errors.email, 'string');
  assert.equal(Object.keys(r.errors).length, 1);
}

// Age too young
{
  const r = parseUser({ email: 'a@b.com', age: 10 });
  assert.equal(r.ok, false);
  assert.equal(typeof r.errors.age, 'string');
}

// Age not integer
{
  const r = parseUser({ email: 'a@b.com', age: 15.5 });
  assert.equal(r.ok, false);
  assert.equal(typeof r.errors.age, 'string');
}

// tags with wrong element type
{
  const r = parseUser({ email: 'a@b.com', age: 20, tags: ['ok', 42] });
  assert.equal(r.ok, false);
  assert.equal(typeof r.errors.tags, 'string');
}

// multiple invalid fields
{
  const r = parseUser({ email: 'bad', age: 5 });
  assert.equal(r.ok, false);
  assert.equal(typeof r.errors.email, 'string');
  assert.equal(typeof r.errors.age, 'string');
}

// missing fields entirely
{
  const r = parseUser({});
  assert.equal(r.ok, false);
  assert.ok(r.errors.email);
  assert.ok(r.errors.age);
}

console.log('All tests passed');
