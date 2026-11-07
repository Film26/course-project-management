// F-01 unit tests — TEST-01-01 … TEST-01-03 (docs/sprints/sprint-1/F-01-auth.md §7)
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { newToken, hashToken, isSessionActive } from '../src/auth/session.js';

describe('TEST-01-01 isSessionActive (AC-01-05, rule R2)', () => {
  const now = new Date('2026-11-07T10:00:00Z');

  it('is active when not revoked and expiresAt is in the future', () => {
    const s = { revokedAt: null, expiresAt: new Date(now.getTime() + 1) };
    expect(isSessionActive(s, now)).toBe(true);
  });

  it('is expired exactly at expiresAt (boundary)', () => {
    const s = { revokedAt: null, expiresAt: new Date(now) };
    expect(isSessionActive(s, now)).toBe(false);
  });

  it('is inactive once revoked, even before expiry', () => {
    const s = { revokedAt: new Date(now.getTime() - 1000), expiresAt: new Date(now.getTime() + 3_600_000) };
    expect(isSessionActive(s, now)).toBe(false);
  });

  it('is inactive for a missing session', () => {
    expect(isSessionActive(null, now)).toBe(false);
  });
});

describe('TEST-01-02 password hashing (AC-01-09)', () => {
  it('stores a bcrypt hash, not the plaintext, and verifies correctly', async () => {
    const hash = await hashPassword('S3cret!');
    expect(hash).not.toBe('S3cret!');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await verifyPassword('S3cret!', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('TEST-01-03 session token hashing (AC-01-09, rule R3)', () => {
  it('produces a random token and a deterministic SHA-256 hex hash', () => {
    const t1 = newToken();
    const t2 = newToken();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThanOrEqual(43); // 32 bytes base64url
    expect(hashToken(t1)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t1)).toBe(hashToken(t1));
    expect(hashToken(t1)).not.toBe(t1);
  });
});
