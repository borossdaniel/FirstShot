import { SignJWT, jwtVerify } from 'jose';

const ISSUER = 'https://auth.example.com';
const AUDIENCE = 'example-api';
const EXPIRY = '15m';

export async function createToken(userId, secret) {
  const secretKey = new TextEncoder().encode(secret);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secretKey);
}

export async function verifyToken(token, secret) {
  const secretKey = new TextEncoder().encode(secret);

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return { valid: true, userId: payload.sub };
  } catch (err) {
    if (err?.code === 'ERR_JWT_EXPIRED') {
      return { valid: false, reason: 'expired' };
    }
    return { valid: false, reason: 'invalid' };
  }
}
