// F-01 routes: POST /login, POST /logout, GET /me (FR-01, FR-02, FR-03)
import { Router } from 'express';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { verifyPassword, DUMMY_HASH } from '../auth/password.js';
import { COOKIE_NAME, createSession, revokeSession, cookieOptions } from '../auth/session.js';
import { requireAuth, publicUser } from '../auth/middleware.js';

export const authRouter = Router();

function validateLogin(body) {
  const details = {};
  const { email, password } = body ?? {};
  if (typeof email !== 'string' || !email.trim()) details.email = 'Email is required';
  else if (email.trim().length > 254 || !email.includes('@')) details.email = 'Email is invalid';
  if (typeof password !== 'string' || password.length === 0) details.password = 'Password is required';
  else if (password.length > 128) details.password = 'Password is too long';
  if (Object.keys(details).length) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid input', details);
  return { email: email.trim().toLowerCase(), password };
}

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = validateLogin(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // R1: always run bcrypt and return the same error for unknown email / wrong password.
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');

    const { token } = await createSession(user.id);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await revokeSession(req.session.id);
    const { maxAge, ...opts } = cookieOptions(); // eslint-disable-line no-unused-vars
    res.clearCookie(COOKIE_NAME, opts);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});
