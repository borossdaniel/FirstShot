import { SignJWT } from 'jose';
import { createToken, verifyToken } from './solution.mjs';

const secret = 'test-secret-value';
const wrongSecret = 'wrong-secret-value';

async function main() {
  // 1. Valid token round-trip
  const token = await createToken('user-123', secret);
  const result = await verifyToken(token, secret);
  console.assert(result.valid === true, 'expected valid token');
  console.assert(result.userId === 'user-123', 'expected matching userId');
  console.log('valid token ->', result);

  // 2. Wrong secret
  const badSig = await verifyToken(token, wrongSecret);
  console.assert(badSig.valid === false && badSig.reason === 'invalid', 'expected invalid signature');
  console.log('wrong secret ->', badSig);

  // 3. Garbage token
  const garbage = await verifyToken('not.a.jwt', secret);
  console.assert(garbage.valid === false && garbage.reason === 'invalid', 'expected invalid for garbage');
  console.log('garbage token ->', garbage);

  // 4. Expired token
  const key = new TextEncoder().encode(secret);
  const expired = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-456')
    .setIssuer('https://auth.example.com')
    .setAudience('example-api')
    .setIssuedAt(Math.floor(Date.now() / 1000) - 1000)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
    .sign(key);
  const expiredResult = await verifyToken(expired, secret);
  console.assert(expiredResult.valid === false && expiredResult.reason === 'expired', 'expected expired reason');
  console.log('expired token ->', expiredResult);

  // 5. Wrong issuer
  const wrongIssuer = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-789')
    .setIssuer('https://evil.example.com')
    .setAudience('example-api')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key);
  const wrongIssuerResult = await verifyToken(wrongIssuer, secret);
  console.assert(wrongIssuerResult.valid === false && wrongIssuerResult.reason === 'invalid', 'expected invalid for wrong issuer');
  console.log('wrong issuer ->', wrongIssuerResult);

  // 6. Wrong audience
  const wrongAud = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-999')
    .setIssuer('https://auth.example.com')
    .setAudience('other-api')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key);
  const wrongAudResult = await verifyToken(wrongAud, secret);
  console.assert(wrongAudResult.valid === false && wrongAudResult.reason === 'invalid', 'expected invalid for wrong audience');
  console.log('wrong audience ->', wrongAudResult);

  console.log('\nAll checks passed.');
}

main().catch((err) => {
  console.error('Test run threw unexpectedly:', err);
  process.exit(1);
});
