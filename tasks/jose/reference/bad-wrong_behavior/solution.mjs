import { SignJWT, jwtVerify } from 'jose';

const key = (secret) => new TextEncoder().encode(secret);

export async function createToken(userId, secret) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('https://auth.example.com')
    .setAudience('example-api')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key(secret));
}

// Bug: checks signature and expiry but never the issuer or audience.
export async function verifyToken(token, secret) {
  try {
    const { payload } = await jwtVerify(token, key(secret));
    return { valid: true, userId: payload.sub };
  } catch (err) {
    return { valid: false, reason: err.code === 'ERR_JWT_EXPIRED' ? 'expired' : 'invalid' };
  }
}
