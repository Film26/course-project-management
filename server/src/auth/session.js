// F-01 server-side sessions (rules R2, R3; NFR-04).
// The browser holds a random token in an HttpOnly cookie; the DB stores only its SHA-256 hash.
import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';

export const COOKIE_NAME = 'sid';

export function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** R2: active only if not revoked and strictly before expiresAt. */
export function isSessionActive(session, now = new Date()) {
  if (!session) return false;
  if (session.revokedAt) return false;
  return now.getTime() < new Date(session.expiresAt).getTime();
}

export async function createSession(userId) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3_600_000);
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

/** Returns { session, user } for an active session token, otherwise null. */
export async function findActiveSession(token) {
  if (!token || typeof token !== 'string') return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!isSessionActive(session)) return null;
  return { session, user: session.user };
}

export async function revokeSession(sessionId) {
  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    maxAge: config.sessionTtlHours * 3_600_000,
  };
}
