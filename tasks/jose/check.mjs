import { runCheck, expectInstalled, importSolution, importFromWorkspace, expect, expectEqual, fail, firstLine } from '../../src/check-helpers.js';

const ISSUER = 'https://auth.example.com';
const AUDIENCE = 'example-api';
const SECRET = 'a-very-long-test-secret-for-hs256-signing-0123456789';

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'jose', 6);
  const jose = await importFromWorkspace(ws, 'jose');
  const m = await importSolution(ws);
  expect(typeof m.createToken === 'function' && typeof m.verifyToken === 'function', 'createToken and verifyToken must both be exported');
  const key = new TextEncoder().encode(SECRET);

  // 1. The token the solution creates
  const token = await m.createToken('user-123', SECRET);
  expect(typeof token === 'string' && token.split('.').length === 3, `createToken should return a compact JWT string, got ${JSON.stringify(token)?.slice(0, 80)}`);
  const header = jose.decodeProtectedHeader(token);
  expectEqual(header.alg, 'HS256', 'JWT header alg');
  const claims = jose.decodeJwt(token);
  expectEqual(claims.sub, 'user-123', 'sub claim');
  expectEqual(claims.iss, ISSUER, 'iss claim');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  expect(aud.length === 1 && aud[0] === AUDIENCE, `aud claim should be "${AUDIENCE}", got ${JSON.stringify(claims.aud)}`);
  const now = Math.floor(Date.now() / 1000);
  expect(typeof claims.iat === 'number' && Math.abs(claims.iat - now) <= 10, `iat should be the current time in seconds, got ${claims.iat} (now ${now})`);
  expect(typeof claims.exp === 'number' && Math.abs(claims.exp - (now + 900)) <= 10, `exp should be 15 minutes from now (${now + 900}), got ${claims.exp}`);
  try {
    await jose.jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] });
  } catch (e) {
    fail('wrong_behavior', `the token from createToken does not verify with the secret: ${firstLine(e)}`);
  }

  // 2. verifyToken against tokens built here
  const sign = (claimsIn, { secret = SECRET, iat = now, exp = now + 900 } = {}) => {
    const jwt = new jose.SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('user-9').setIssuedAt(iat).setExpirationTime(exp);
    if (claimsIn.iss) jwt.setIssuer(claimsIn.iss);
    if (claimsIn.aud) jwt.setAudience(claimsIn.aud);
    return jwt.sign(new TextEncoder().encode(secret));
  };
  const run = async (label, t) => {
    try {
      return await m.verifyToken(t, SECRET);
    } catch (e) {
      fail('wrong_behavior', `verifyToken threw for ${label} instead of returning { valid: false, ... }: ${firstLine(e)}`);
    }
  };

  expectEqual(await run('its own token', token), { valid: true, userId: 'user-123' }, 'verifyToken(createToken(...))');
  expectEqual(await run('a valid token', await sign({ iss: ISSUER, aud: AUDIENCE })), { valid: true, userId: 'user-9' }, 'verifyToken on a valid token');

  const cases = [
    ['an expired token', await sign({ iss: ISSUER, aud: AUDIENCE }, { iat: now - 7200, exp: now - 3600 }), 'expired'],
    ['a token for another audience', await sign({ iss: ISSUER, aud: 'other-api' }), 'invalid'],
    ['a token from another issuer', await sign({ iss: 'https://evil.example.com', aud: AUDIENCE }), 'invalid'],
    ['a token signed with another secret', await sign({ iss: ISSUER, aud: AUDIENCE }, { secret: 'some-other-secret-that-is-also-long-enough-1234' }), 'invalid'],
    ['a token with a tampered payload', (() => {
      const [h, , s] = token.split('.');
      const p = Buffer.from(JSON.stringify({ ...claims, sub: 'admin' })).toString('base64url');
      return `${h}.${p}.${s}`;
    })(), 'invalid'],
    ['a malformed string', 'not-a-jwt', 'invalid'],
  ];
  for (const [label, t, reason] of cases) {
    const r = await run(label, t);
    expect(r && r.valid === false, `verifyToken accepted ${label}: ${JSON.stringify(r)}`);
    expect(r.reason === reason, `verifyToken on ${label} should give reason "${reason}", got ${JSON.stringify(r.reason)}`);
  }
  return `jose@${version}: HS256 token claims, verification and rejection reasons correct`;
});
