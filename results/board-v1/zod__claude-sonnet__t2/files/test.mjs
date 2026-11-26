import { parseUser, UserSchema } from "./solution.mjs";
import assert from "node:assert/strict";

// Valid input with tags
{
  const r = parseUser({ email: "a@b.com", age: 20, tags: ["x", "y"] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.user, { email: "a@b.com", age: 20, tags: ["x", "y"] });
}

// Valid input without tags -> default applied
{
  const r = parseUser({ email: "a@b.com", age: 13 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.user, { email: "a@b.com", age: 13, tags: [] });
}

// Invalid email
{
  const r = parseUser({ email: "not-an-email", age: 20 });
  assert.equal(r.ok, false);
  assert.equal(typeof r.errors.email, "string");
  console.log("email error:", r.errors.email);
}

// Age too young
{
  const r = parseUser({ email: "a@b.com", age: 10 });
  assert.equal(r.ok, false);
  console.log("age error:", r.errors.age);
}

// Age not integer
{
  const r = parseUser({ email: "a@b.com", age: 20.5 });
  assert.equal(r.ok, false);
  console.log("age (non-integer) error:", r.errors.age);
}

// tags with wrong type
{
  const r = parseUser({ email: "a@b.com", age: 20, tags: ["x", 5] });
  assert.equal(r.ok, false);
  console.log("tags error:", r.errors.tags);
}

// Multiple errors at once
{
  const r = parseUser({ email: "bad", age: 5 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.email);
  assert.ok(r.errors.age);
  console.log("multiple errors:", r.errors);
}

// Missing fields entirely
{
  const r = parseUser({});
  assert.equal(r.ok, false);
  console.log("missing fields errors:", r.errors);
}

console.log("All tests passed.");
console.log("Schema shape keys:", Object.keys(UserSchema.shape));
