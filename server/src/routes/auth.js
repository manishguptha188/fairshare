import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { HttpError } from '../errors.js';
import { AUTH_COOKIE, authCookieOptions, createAuthToken } from '../lib/authToken.js';
import { email } from '../lib/validation.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { User } from '../models/User.js';

// Cost 10 takes roughly 100 ms per hash: slow enough to make guessing expensive, fast enough for a login.
const BCRYPT_COST = 10;

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(50, 'Use at most 50 characters.'),
  email,
  // bcrypt only uses the first 72 bytes of a password, so longer ones would be silently truncated.
  password: z.string().min(8, 'Use at least 8 characters.').max(72, 'Use at most 72 characters.'),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

export function createAuthRouter({ attemptsPerWindow }) {
  const router = Router();

  // Slows down password guessing: each IP gets a limited number of login/register attempts per 15 minutes.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: attemptsPerWindow,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  });

  router.post('/register', authLimiter, async (req, res) => {
    const { name, email, password } = registerSchema.parse(req.body);

    let user;
    try {
      user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, BCRYPT_COST) });
    } catch (err) {
      // The unique index on email is the real guard: checking "does it exist?" first could race with
      // a second sign-up for the same email arriving at the same moment.
      if (err.code === 11000) {
        throw new HttpError(409, 'An account with this email already exists.');
      }
      throw err;
    }

    res.cookie(AUTH_COOKIE, createAuthToken(user.id), authCookieOptions);
    res.status(201).json({ user });
  });

  router.post('/login', authLimiter, async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email }).select('+passwordHash');
    const passwordMatches = user && (await bcrypt.compare(password, user.passwordHash));
    // The same message for "no such email" and "wrong password" doesn't tell an attacker which emails exist.
    if (!passwordMatches) {
      throw new HttpError(401, 'Email or password is incorrect.');
    }

    res.cookie(AUTH_COOKIE, createAuthToken(user.id), authCookieOptions);
    res.json({ user });
  });

  router.post('/logout', (req, res) => {
    // The cookie is only cleared if the options match the ones it was set with (Express 5 ignores maxAge here).
    res.clearCookie(AUTH_COOKIE, authCookieOptions);
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
