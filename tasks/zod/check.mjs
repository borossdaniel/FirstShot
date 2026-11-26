import { runCheck, expectInstalled, importSolution, expect, expectEqual } from '../../src/check-helpers.js';

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'zod', 4);
  const m = await importSolution(ws);
  expect(m.UserSchema && typeof m.UserSchema.safeParse === 'function', 'UserSchema is not exported as a Zod schema');
  expect(typeof m.parseUser === 'function', 'parseUser is not exported');

  const good = m.parseUser({ email: 'ada@example.com', age: 36 });
  expectEqual(good, { ok: true, user: { email: 'ada@example.com', age: 36, tags: [] } }, 'valid user with default tags');

  const withTags = m.parseUser({ email: 'ada@example.com', age: 13, tags: ['a'] });
  expect(withTags.ok === true && withTags.user.tags[0] === 'a', 'tags were not kept');

  const bad = m.parseUser({ email: 'not-an-email', age: 12.5 });
  expect(bad && bad.ok === false, 'invalid input was accepted');
  expect(bad.errors && typeof bad.errors === 'object', 'errors is not an object');
  for (const f of ['email', 'age']) {
    expect(typeof bad.errors[f] === 'string' && bad.errors[f].length > 0, `errors.${f} should be a message string, got ${JSON.stringify(bad.errors[f])}`);
  }
  expect(!('tags' in bad.errors), 'tags reported as invalid although it was missing (it should default)');

  const young = m.parseUser({ email: 'kid@example.com', age: 12 });
  expect(young.ok === false && typeof young.errors.age === 'string', 'age 12 should be rejected');
  return `zod@${version}: schema, defaults and error messages correct`;
});
