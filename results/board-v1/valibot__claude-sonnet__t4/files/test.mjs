import assert from 'node:assert/strict';
import { parseSignup } from './solution.mjs';

// valid input, default applied
const r1 = parseSignup({ email: 'a@b.com', password: 'longenough' });
assert.equal(r1.ok, true);
assert.deepEqual(r1.value, { email: 'a@b.com', password: 'longenough', newsletter: false });

// valid input, explicit newsletter
const r2 = parseSignup({ email: 'a@b.com', password: 'longenough', newsletter: true });
assert.equal(r2.ok, true);
assert.equal(r2.value.newsletter, true);

// invalid email and short password
const r3 = parseSignup({ email: 'not-an-email', password: 'short' });
assert.equal(r3.ok, false);
assert.deepEqual(r3.errors.email, ['Enter a valid email address']);
assert.deepEqual(r3.errors.password, ['Password must be at least 8 characters']);

// missing fields
const r4 = parseSignup({});
assert.equal(r4.ok, false);
assert.ok(Array.isArray(r4.errors.email));
assert.ok(Array.isArray(r4.errors.password));

console.log('All tests passed');
console.log(JSON.stringify(r1, null, 2));
console.log(JSON.stringify(r3, null, 2));
