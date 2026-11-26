import { parseSignup, SignupSchema } from "./solution.mjs";
import assert from "node:assert/strict";

// Valid input, newsletter omitted -> default false
const r1 = parseSignup({ email: "a@b.com", password: "longenough" });
assert.deepEqual(r1, {
  ok: true,
  value: { email: "a@b.com", password: "longenough", newsletter: false },
});

// Valid input, newsletter explicitly true
const r2 = parseSignup({
  email: "a@b.com",
  password: "longenough",
  newsletter: true,
});
assert.deepEqual(r2, {
  ok: true,
  value: { email: "a@b.com", password: "longenough", newsletter: true },
});

// Invalid email and short password
const r3 = parseSignup({ email: "not-an-email", password: "short" });
assert.equal(r3.ok, false);
assert.deepEqual(r3.errors, {
  email: ["Enter a valid email address"],
  password: ["Password must be at least 8 characters"],
});

// Missing fields entirely
const r4 = parseSignup({});
assert.equal(r4.ok, false);
assert.ok(Array.isArray(r4.errors.email));
assert.ok(Array.isArray(r4.errors.password));

console.log("All tests passed");
console.log(JSON.stringify(r3.errors, null, 2));
