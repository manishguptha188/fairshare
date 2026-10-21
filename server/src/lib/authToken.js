import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const AUTH_COOKIE = 'fairshare_token';
const SESSION_DAYS = 7;

export function createAuthToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: `${SESSION_DAYS}d` });
}

// Returns the user id, or null when the token is missing, expired or signed with another secret.
export function readAuthToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwtSecret).sub;
  } catch {
    return null;
  }
}

// httpOnly: page JavaScript can't read the token, so an XSS bug can't steal it.
// sameSite 'lax': the browser doesn't send it on cross-site form posts, which blocks classic CSRF.
// secure: in production the cookie only travels over HTTPS.
export const authCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  path: '/',
};
