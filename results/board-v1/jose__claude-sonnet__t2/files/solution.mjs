import { SignJWT, jwtVerify, errors } from 'jose';

const ISSUER = 'https://auth.example.com';
const AUDIENCE = 'example-api';

export async function createToken(userId, secret) {
  const key = new TextEncoder().encode(secret);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key);
}

export async function verifyToken(token, secret) {
  const key = new TextEncoder().encode(secret);

  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return { valid: true, userId: payload.sub };
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      return { valid: false, reason: 'expired' };
    }
    return { valid: false, reason: 'invalid' };
  }
}
