import { SignJWT } from 'jose';
import { createToken, verifyToken } from './solution.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('PASS: ' + msg);
}

const secret = 'test-secret-key';
const wrongSecret = 'wrong-secret-key';

// 1. Valid token round-trip
const token = await createToken('user-123', secret);
const result = await verifyToken(token, secret);
assert(result.valid === true, 'valid token verifies as valid');
assert(result.userId === 'user-123', 'valid token returns correct userId');

// 2. Wrong secret
const badResult = await verifyToken(token, wrongSecret);
assert(badResult.valid === false, 'wrong secret is invalid');
assert(badResult.reason === 'invalid', 'wrong secret reason is "invalid"');

// 3. Malformed token
const malformedResult = await verifyToken('not.a.jwt', secret);
assert(malformedResult.valid === false, 'malformed token is invalid');
assert(malformedResult.reason === 'invalid', 'malformed token reason is "invalid"');

// 4. Expired token
const key = new TextEncoder().encode(secret);
const expiredToken = await new SignJWT({})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject('user-456')
  .setIssuer('https://auth.example.com')
  .setAudience('example-api')
  .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
  .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
  .sign(key);

const expiredResult = await verifyToken(expiredToken, secret);
assert(expiredResult.valid === false, 'expired token is invalid');
assert(expiredResult.reason === 'expired', 'expired token reason is "expired"');

// 5. Wrong issuer
const wrongIssuerToken = await new SignJWT({})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject('user-789')
  .setIssuer('https://wrong-issuer.example.com')
  .setAudience('example-api')
  .setIssuedAt()
  .setExpirationTime('15m')
  .sign(key);

const wrongIssuerResult = await verifyToken(wrongIssuerToken, secret);
assert(wrongIssuerResult.valid === false, 'wrong issuer is invalid');
assert(wrongIssuerResult.reason === 'invalid', 'wrong issuer reason is "invalid"');

// 6. Wrong audience
const wrongAudToken = await new SignJWT({})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject('user-999')
  .setIssuer('https://auth.example.com')
  .setAudience('wrong-api')
  .setIssuedAt()
  .setExpirationTime('15m')
  .sign(key);

const wrongAudResult = await verifyToken(wrongAudToken, secret);
assert(wrongAudResult.valid === false, 'wrong audience is invalid');
assert(wrongAudResult.reason === 'invalid', 'wrong audience reason is "invalid"');

console.log('\nAll tests passed.');
