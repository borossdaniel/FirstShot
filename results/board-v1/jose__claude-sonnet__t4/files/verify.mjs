import { createToken, verifyToken } from './solution.mjs';
import { SignJWT } from 'jose';

const secret = 'test-secret-value';

const token = await createToken('user-123', secret);
console.log('token:', token);

const good = await verifyToken(token, secret);
console.log('valid token check:', good);
console.assert(good.valid === true && good.userId === 'user-123', 'FAIL: expected valid with correct userId');

const wrongSecret = await verifyToken(token, 'different-secret');
console.log('wrong secret check:', wrongSecret);
console.assert(wrongSecret.valid === false && wrongSecret.reason === 'invalid', 'FAIL: expected invalid for wrong secret');

const garbage = await verifyToken('not-a-real-jwt', secret);
console.log('garbage token check:', garbage);
console.assert(garbage.valid === false && garbage.reason === 'invalid', 'FAIL: expected invalid for garbage');

const key = new TextEncoder().encode(secret);
const expiredToken = await new SignJWT({})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject('user-456')
  .setIssuer('https://auth.example.com')
  .setAudience('example-api')
  .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
  .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
  .sign(key);

const expiredResult = await verifyToken(expiredToken, secret);
console.log('expired token check:', expiredResult);
console.assert(expiredResult.valid === false && expiredResult.reason === 'expired', 'FAIL: expected expired reason');

const wrongAudienceToken = await new SignJWT({})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject('user-789')
  .setIssuer('https://auth.example.com')
  .setAudience('other-api')
  .setIssuedAt()
  .setExpirationTime('15m')
  .sign(key);

const wrongAudienceResult = await verifyToken(wrongAudienceToken, secret);
console.log('wrong audience check:', wrongAudienceResult);
console.assert(wrongAudienceResult.valid === false && wrongAudienceResult.reason === 'invalid', 'FAIL: expected invalid for wrong audience');

console.log('ALL CHECKS PASSED');
