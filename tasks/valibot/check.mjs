import { runCheck, expectInstalled, importSolution, importFromWorkspace, expect, expectEqual, fail, firstLine } from '../../src/check-helpers.js';

const EMAIL_MSG = 'Enter a valid email address';
const PASSWORD_MSG = 'Password must be at least 8 characters';

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'valibot', 1);
  const v = await importFromWorkspace(ws, 'valibot');
  const m = await importSolution(ws);
  expect(m.SignupSchema && typeof m.SignupSchema === 'object', 'SignupSchema is not exported');
  expect(typeof m.parseSignup === 'function', 'parseSignup is not exported');

  // The exported schema must be a real Valibot schema.
  let direct;
  try {
    direct = v.safeParse(m.SignupSchema, { email: 'ada@example.com', password: 'correct horse' });
  } catch (e) {
    fail('wrong_behavior', `SignupSchema is not a Valibot schema (v.safeParse threw: ${firstLine(e)})`);
  }
  expect(direct.success, `SignupSchema rejected a valid sign-up: ${JSON.stringify(direct.issues?.map((i) => i.message))}`);
  expectEqual(direct.output, { email: 'ada@example.com', password: 'correct horse', newsletter: false }, 'v.safeParse(SignupSchema, valid input).output');

  const parse = (input) => {
    try {
      return m.parseSignup(input);
    } catch (e) {
      fail('wrong_behavior', `parseSignup(${JSON.stringify(input)}) threw instead of returning a result: ${firstLine(e)}`);
    }
  };

  expectEqual(parse({ email: 'ada@example.com', password: 'correct horse' }), { ok: true, value: { email: 'ada@example.com', password: 'correct horse', newsletter: false } }, 'parseSignup on valid input (default newsletter)');
  expectEqual(parse({ email: 'ada@example.com', password: 'correct horse', newsletter: true }), { ok: true, value: { email: 'ada@example.com', password: 'correct horse', newsletter: true } }, 'parseSignup with newsletter: true');

  const bad = parse({ email: 'not-an-email', password: 'short' });
  expect(bad && bad.ok === false, `invalid input was accepted: ${JSON.stringify(bad)}`);
  expect(bad.errors && typeof bad.errors === 'object' && !Array.isArray(bad.errors), `errors should be an object mapping field names to messages, got ${JSON.stringify(bad.errors)}`);
  for (const [field, msg] of [['email', EMAIL_MSG], ['password', PASSWORD_MSG]]) {
    const got = bad.errors[field];
    expect(Array.isArray(got) && got.every((s) => typeof s === 'string'), `errors.${field} should be an array of message strings, got ${JSON.stringify(got)}`);
    expect(got.includes(msg), `errors.${field} should contain "${msg}", got ${JSON.stringify(got)}`);
  }
  expect(!('newsletter' in bad.errors), `newsletter reported as invalid although it was missing (it should default): ${JSON.stringify(bad.errors)}`);

  const missing = parse({ password: 'long enough password', newsletter: 'yes' });
  expect(missing && missing.ok === false, 'input without an email (and a non-boolean newsletter) was accepted');
  for (const field of ['email', 'newsletter']) {
    const got = missing.errors?.[field];
    expect(Array.isArray(got) && got.length > 0 && got.every((s) => typeof s === 'string'), `errors.${field} should list the problem for ${JSON.stringify({ password: '…', newsletter: 'yes' })}, got ${JSON.stringify(got)}`);
  }
  expect(!('password' in missing.errors), `password reported as invalid although it was valid: ${JSON.stringify(missing.errors)}`);
  return `valibot@${version}: schema, default and flattened field errors correct`;
});
