import assert from "node:assert/strict";
import { parseUser } from "./solution.mjs";

// valid, with tags
const r1 = parseUser({ email: "a@b.com", age: 20, tags: ["x", "y"] });
assert.deepEqual(r1, { ok: true, user: { email: "a@b.com", age: 20, tags: ["x", "y"] } });

// valid, default tags
const r2 = parseUser({ email: "a@b.com", age: 13 });
assert.deepEqual(r2, { ok: true, user: { email: "a@b.com", age: 13, tags: [] } });

// invalid email, non-integer age, bad tags
const r3 = parseUser({ email: "not-an-email", age: 12.5, tags: [1, 2] });
assert.equal(r3.ok, false);
assert.ok(typeof r3.errors.email === "string");
assert.ok(typeof r3.errors.age === "string");
assert.ok(typeof r3.errors.tags === "string");
console.log("r3.errors:", r3.errors);

// age too young
const r4 = parseUser({ email: "a@b.com", age: 10 });
assert.equal(r4.ok, false);
assert.ok(typeof r4.errors.age === "string");
console.log("r4.errors:", r4.errors);

// missing fields entirely
const r5 = parseUser({});
assert.equal(r5.ok, false);
console.log("r5.errors:", r5.errors);

console.log("All checks passed.");
