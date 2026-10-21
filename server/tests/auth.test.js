import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { User } from '../src/models/User.js';
import { createTestApp, signUp } from './helpers.js';

const app = createTestApp();

function cookieFrom(res) {
  return (res.headers['set-cookie'] ?? []).find((cookie) => cookie.startsWith('fairshare_token='));
}

describe('POST /api/auth/register', () => {
  it('creates the account, logs the user in and never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '  Asha ', email: 'Asha@Example.com', password: 'correct-horse-1' });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: expect.any(String), name: 'Asha', email: 'asha@example.com' });
    expect(cookieFrom(res)).toMatch(/HttpOnly/i);
    expect(cookieFrom(res)).toMatch(/SameSite=Lax/i);

    const stored = await User.findOne({ email: 'asha@example.com' }).select('+passwordHash');
    expect(stored.passwordHash).not.toContain('correct-horse-1');
  });

  it('refuses a second account with the same email, whatever its letter case', async () => {
    await signUp(app, { email: 'asha@example.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other', email: 'ASHA@example.com', password: 'another-pass-2' });

    expect(res.status).toBe(409);
    expect(res.body.fields.email).toBeDefined();
    expect(await User.countDocuments()).toBe(1);
  });

  it('explains which fields are invalid', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: '', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(['email', 'name', 'password']);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the right password', async () => {
    await signUp(app, { email: 'asha@example.com', password: 'correct-horse-1' });
    const res = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'correct-horse-1' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('asha@example.com');
    expect(cookieFrom(res)).toBeDefined();
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    await signUp(app, { email: 'asha@example.com', password: 'correct-horse-1' });
    const wrongPassword = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'nope-nope' });
    const unknownEmail = await request(app).post('/api/auth/login').send({ email: 'ravi@example.com', password: 'nope-nope' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(cookieFrom(wrongPassword)).toBeUndefined();
  });

  it('blocks an IP after too many attempts', async () => {
    const strictApp = createTestApp({ authAttemptsPerWindow: 2 });
    const attempt = () => request(strictApp).post('/api/auth/login').send({ email: 'asha@example.com', password: 'guess' });

    await attempt();
    await attempt();
    const res = await attempt();
    expect(res.status).toBe(429);
  });
});

describe('GET /api/auth/me and logout', () => {
  it('returns the logged-in user, and nothing after logging out', async () => {
    const { agent } = await signUp(app, { name: 'Asha' });

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.name).toBe('Asha');

    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects a missing or forged token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);

    const forged = await request(app).get('/api/auth/me').set('Cookie', 'fairshare_token=not-a-real-token');
    expect(forged.status).toBe(401);
  });

  it('stops working once the account is deleted', async () => {
    const { agent, user } = await signUp(app);
    await User.findByIdAndDelete(user.id);

    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
