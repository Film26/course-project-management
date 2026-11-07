// F-01 password hashing (NFR-01). Only bcrypt hashes are ever stored.
import bcrypt from 'bcryptjs';

const COST = process.env.NODE_ENV === 'test' ? 4 : 10;

export function hashPassword(plain) {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Used when the email is unknown, so a failed login takes about as long either way (rule R1).
export const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', COST);
