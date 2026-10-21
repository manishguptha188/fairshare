import { HttpError } from '../errors.js';
import { AUTH_COOKIE, readAuthToken } from '../lib/authToken.js';
import { User } from '../models/User.js';

// Loading the user on every request (instead of trusting the token alone) means a deleted account
// stops working immediately, at the cost of one small indexed query.
export async function requireAuth(req, res, next) {
  const userId = readAuthToken(req.cookies[AUTH_COOKIE]);
  const user = userId && (await User.findById(userId));
  if (!user) {
    throw new HttpError(401, 'Please log in to continue.');
  }
  req.user = user;
  next();
}
