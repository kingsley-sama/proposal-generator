import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const key = new TextEncoder().encode(process.env.AUTH_SECRET);

const SESSION_COOKIE = 'session';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type SessionData = {
  user: { id: string };
  expires: string;
};

export async function signToken(payload: SessionData) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1 day from now')
    .sign(key);
}

export async function verifyToken(input: string): Promise<SessionData> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ['HS256'],
  });
  return payload as SessionData;
}

export async function getSession(): Promise<SessionData | null> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;
  try {
    return await verifyToken(session);
  } catch {
    return null;
  }
}

export async function setSession(userId: string) {
  const expires = new Date(Date.now() + ONE_DAY_MS);
  const token = await signToken({
    user: { id: userId },
    expires: expires.toISOString(),
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
