import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createGroup, createTestApp, signUp } from './helpers.js';

const app = createTestApp();
let asha;
let ravi;
let kiran;

beforeEach(async () => {
  asha = await signUp(app, { name: 'Asha', email: 'asha@example.com' });
  ravi = await signUp(app, { name: 'Ravi', email: 'ravi@example.com' });
  kiran = await signUp(app, { name: 'Kiran', email: 'kiran@example.com' });
});

describe('groups', () => {
  it('requires a login', async () => {
    expect((await request(app).get('/api/groups')).status).toBe(401);
  });

  it('creates a group with the creator as its first member', async () => {
    const res = await asha.agent.post('/api/groups').send({ name: '  Goa trip ' });

    expect(res.status).toBe(201);
    expect(res.body.group).toMatchObject({ name: 'Goa trip', members: [asha.user.id], createdBy: asha.user.id });
    expect(res.body.group._id).toBeUndefined();
  });

  it('lists only the groups you belong to', async () => {
    await createGroup(asha, [], 'Asha and friends');
    await createGroup(kiran, [], "Kiran's group");

    const res = await asha.agent.get('/api/groups');
    expect(res.body.groups.map((group) => group.name)).toEqual(['Asha and friends']);
  });

  it('shows members with their names, but never to outsiders', async () => {
    const groupId = await createGroup(asha, [ravi]);

    const asMember = await ravi.agent.get(`/api/groups/${groupId}`);
    expect(asMember.status).toBe(200);
    expect(asMember.body.group.members.map((member) => member.name)).toEqual(['Asha', 'Ravi']);

    const asOutsider = await kiran.agent.get(`/api/groups/${groupId}`);
    expect(asOutsider.status).toBe(404);
  });

  it('answers 404 for a malformed group id', async () => {
    expect((await asha.agent.get('/api/groups/not-an-id')).status).toBe(404);
  });

  it('validates the group name', async () => {
    const res = await asha.agent.post('/api/groups').send({ name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.fields.name).toBeDefined();
  });
});

describe('adding members', () => {
  it('adds a registered user by email', async () => {
    const groupId = await createGroup(asha);
    const res = await asha.agent.post(`/api/groups/${groupId}/members`).send({ email: 'RAVI@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.member.name).toBe('Ravi');
    expect((await ravi.agent.get(`/api/groups/${groupId}`)).status).toBe(200);
  });

  it('explains when nobody has that email', async () => {
    const groupId = await createGroup(asha);
    const res = await asha.agent.post(`/api/groups/${groupId}/members`).send({ email: 'nobody@example.com' });

    expect(res.status).toBe(404);
    expect(res.body.fields.email).toBeDefined();
  });

  it('refuses to add the same person twice', async () => {
    const groupId = await createGroup(asha, [ravi]);
    const res = await asha.agent.post(`/api/groups/${groupId}/members`).send({ email: 'ravi@example.com' });

    expect(res.status).toBe(409);
    const group = await asha.agent.get(`/api/groups/${groupId}`);
    expect(group.body.group.members).toHaveLength(2);
  });

  it("doesn't let an outsider add people", async () => {
    const groupId = await createGroup(asha);
    const res = await kiran.agent.post(`/api/groups/${groupId}/members`).send({ email: 'kiran@example.com' });

    expect(res.status).toBe(404);
  });
});
