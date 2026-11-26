import { SignJWT } from 'jose';
import { createToken, verifyToken } from './solution.mjs';

const secret = 'super-secret-key-for-testing';
const userId = 'user-123';

// 1. Happy path
const token = await createToken(userId, secret);
const result = await verifyToken(token, secret);
console.log('happy path:', result);
if (!(result.valid === true && result.userId === userId)) {
  throw new Error('FAIL: happy path');
}

// 2. Wrong secret
const wrongSecretResult = await verifyToken(token, 'wrong-secret');
console.log('wrong secret:', wrongSecretResult);
if (!(wrongSecretResult.valid === false && wrongSecretResult.reason === 'invalid')) {
  throw new Error('FAIL: wrong secret');
}

// 3. Garbage token
const garbageResult = await verifyToken('not.a.jwt', secret);
console.log('garbage token:', garbageResult);
if (!(garbageResult.valid === false && garbageResult.reason === 'invalid')) {
  throw new Error('FAIL: garbage token');
}

// 4. Expired token (crafted manually with jose, exp in the past)
const key = new TextEncoder().encode(secret);
const expiredToken = await new SignJWT({})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(userId)
  .setIssuer('https://auth.example.com')
  .setAudience('example-api')
  .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
  .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
  .sign(key);

const expiredResult = await verifyToken(expiredToken, secret);
console.log('expired token:', expiredResult);
if (!(expiredResult.valid === false && expiredResult.reason === 'expired')) {
  throw new Error('FAIL: expired token');
}

// 5. Wrong issuer
const wrongIssuerToken = await new SignJWT({})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(userId)
  .setIssuer('https://not-auth.example.com')
  .setAudience('example-api')
  .setIssuedAt()
  .setExpirationTime('15m')
  .sign(key);

const wrongIssuerResult = await verifyToken(wrongIssuerToken, secret);
console.log('wrong issuer:', wrongIssuerResult);
if (!(wrongIssuerResult.valid === false && wrongIssuerResult.reason === 'invalid')) {
  throw new Error('FAIL: wrong issuer');
}

// 6. Wrong audience
const wrongAudienceToken = await new SignJWT({})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(userId)
  .setIssuer('https://auth.example.com')
  .setAudience('other-api')
  .setIssuedAt()
  .setExpirationTime('15m')
  .sign(key);

const wrongAudienceResult = await verifyToken(wrongAudienceToken, secret);
console.log('wrong audience:', wrongAudienceResult);
if (!(wrongAudienceResult.valid === false && wrongAudienceResult.reason === 'invalid')) {
  throw new Error('FAIL: wrong audience');
}

console.log('\nALL TESTS PASSED');
