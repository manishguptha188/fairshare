import request from 'supertest';
import { createApp } from '../src/app.js';

export function createTestApp(options = {}) {
  return createApp({ authAttemptsPerWindow: 1000, ...options });
}

// Signs up a user and returns a Supertest agent that keeps their login cookie, like a browser would.
export async function signUp(app, { name = 'Asha', email = 'asha@example.com', password = 'correct-horse-1' } = {}) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name, email, password });
  if (res.status !== 201) {
    throw new Error(`Sign-up failed in test setup: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent, user: res.body.user };
}

// Creates a group owned by `owner` and adds the other signed-up users to it through the API.
export async function createGroup(owner, others = [], name = 'Flat 4B') {
  const created = await owner.agent.post('/api/groups').send({ name });
  const groupId = created.body.group.id;
  for (const other of others) {
    await owner.agent.post(`/api/groups/${groupId}/members`).send({ email: other.user.email });
  }
  return groupId;
}
