import { SignJWT, jwtVerify, errors } from 'jose';

const ISSUER = 'https://auth.example.com';
const AUDIENCE = 'example-api';
const key = (secret) => new TextEncoder().encode(secret);

export async function createToken(userId, secret) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key(secret));
}

export async function verifyToken(token, secret) {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    return { valid: true, userId: payload.sub };
  } catch (err) {
    return { valid: false, reason: err instanceof errors.JWTExpired ? 'expired' : 'invalid' };
  }
}
