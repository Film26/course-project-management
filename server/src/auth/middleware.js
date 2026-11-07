// F-01 backend enforcement (NFR-02, NFR-03, rule R4, R5).
// Identity always comes from the session cookie — never from body, query or headers.
import { ApiError } from '../errors.js';
import { COOKIE_NAME, findActiveSession } from './session.js';

export function publicUser(user) {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}

export async function requireAuth(req, res, next) {
  try {
    const found = await findActiveSession(req.cookies?.[COOKIE_NAME]);
    if (!found) throw new ApiError(401, 'UNAUTHENTICATED', 'Please log in');
    req.user = found.user;
    req.session = found.session;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'UNAUTHENTICATED', 'Please log in'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission for this action'));
    }
    next();
  };
}
