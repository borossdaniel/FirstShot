import { createToken, verifyToken } from './solution.mjs';
import { SignJWT } from 'jose';

const secret = 'super-secret-key-for-testing';
const userId = 'user-123';

const token = await createToken(userId, secret);
console.log('Token:', token);

const result = await verifyToken(token, secret);
console.log('Valid token result:', result);
if (result.valid !== true || result.userId !== userId) {
  throw new Error('FAIL: valid token should verify successfully with correct userId');
}

const wrongSecretResult = await verifyToken(token, 'wrong-secret');
console.log('Wrong secret result:', wrongSecretResult);
if (wrongSecretResult.valid !== false || wrongSecretResult.reason !== 'invalid') {
  throw new Error('FAIL: wrong secret should be invalid');
}

const garbageResult = await verifyToken('not.a.jwt', secret);
console.log('Garbage token result:', garbageResult);
if (garbageResult.valid !== false || garbageResult.reason !== 'invalid') {
  throw new Error('FAIL: garbage token should be invalid');
}

const expiredToken = await new SignJWT({})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(userId)
  .setIssuer('https://auth.example.com')
  .setAudience('example-api')
  .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
  .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
  .sign(new TextEncoder().encode(secret));

const expiredResult = await verifyToken(expiredToken, secret);
console.log('Expired token result:', expiredResult);
if (expiredResult.valid !== false || expiredResult.reason !== 'expired') {
  throw new Error('FAIL: expired token should return reason "expired"');
}

const wrongAudienceToken = await new SignJWT({})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(userId)
  .setIssuer('https://auth.example.com')
  .setAudience('some-other-api')
  .setIssuedAt()
  .setExpirationTime('15m')
  .sign(new TextEncoder().encode(secret));

const wrongAudienceResult = await verifyToken(wrongAudienceToken, secret);
console.log('Wrong audience result:', wrongAudienceResult);
if (wrongAudienceResult.valid !== false || wrongAudienceResult.reason !== 'invalid') {
  throw new Error('FAIL: wrong audience should be invalid');
}

console.log('\nAll checks passed.');
