import { beforeEach, describe, expect, it } from 'vitest';
import { createGroup, createTestApp, signUp } from './helpers.js';

const app = createTestApp();
let asha;
let ravi;
let meera;
let kiran;
let groupId;
let expensesUrl;

beforeEach(async () => {
  asha = await signUp(app, { name: 'Asha', email: 'asha@example.com' });
  ravi = await signUp(app, { name: 'Ravi', email: 'ravi@example.com' });
  meera = await signUp(app, { name: 'Meera', email: 'meera@example.com' });
  kiran = await signUp(app, { name: 'Kiran', email: 'kiran@example.com' });
  groupId = await createGroup(asha, [ravi, meera]);
  expensesUrl = `/api/groups/${groupId}/expenses`;
});

function equalSplit(overrides = {}) {
  return {
    description: 'Groceries',
    amount: 1000,
    paidBy: asha.user.id,
    splitType: 'equal',
    participants: [asha.user.id, ravi.user.id, meera.user.id],
    ...overrides,
  };
}

describe('creating expenses', () => {
  it('splits equally, giving leftover paise to the first people', async () => {
    const res = await asha.agent.post(expensesUrl).send(equalSplit());

    expect(res.status).toBe(201);
    expect(res.body.expense.shares).toEqual([
      { user: asha.user.id, amount: 334 },
      { user: ravi.user.id, amount: 333 },
      { user: meera.user.id, amount: 333 },
    ]);
  });

  it('stores exact shares when they add up to the total', async () => {
    const res = await ravi.agent.post(expensesUrl).send({
      description: 'Pizza',
      amount: 90000,
      paidBy: ravi.user.id,
      splitType: 'exact',
      shares: [
        { user: ravi.user.id, amount: 30000 },
        { user: meera.user.id, amount: 60000 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.expense.splitType).toBe('exact');
  });

  it('rejects exact shares that do not add up, and says by how much', async () => {
    const res = await asha.agent.post(expensesUrl).send({
      description: 'Pizza',
      amount: 90000,
      paidBy: asha.user.id,
      splitType: 'exact',
      shares: [{ user: asha.user.id, amount: 30000 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('The shares add up to ₹300.00 but the expense is ₹900.00.');
  });

  it('rejects a payer or participant who is not in the group', async () => {
    const outsiderPays = await asha.agent.post(expensesUrl).send(equalSplit({ paidBy: kiran.user.id }));
    expect(outsiderPays.status).toBe(400);
    expect(outsiderPays.body.fields.paidBy).toBeDefined();

    const outsiderShares = await asha.agent.post(expensesUrl).send(equalSplit({ participants: [asha.user.id, kiran.user.id] }));
    expect(outsiderShares.status).toBe(400);
  });

  it('rejects someone listed twice, even with the id in different letter case', async () => {
    const res = await asha.agent.post(expensesUrl).send(equalSplit({ participants: [ravi.user.id, ravi.user.id.toUpperCase()] }));
    expect(res.status).toBe(400);
  });

  it('only accepts whole, positive paise', async () => {
    for (const amount of [10.5, 0, -100, '500']) {
      const res = await asha.agent.post(expensesUrl).send(equalSplit({ amount }));
      expect(res.status).toBe(400);
      expect(res.body.fields.amount).toBeDefined();
    }
  });

  it('keeps outsiders out', async () => {
    expect((await kiran.agent.post(expensesUrl).send(equalSplit())).status).toBe(404);
    expect((await kiran.agent.get(expensesUrl)).status).toBe(404);
  });
});

describe('listing expenses', () => {
  it('returns the newest first, 20 per page', async () => {
    for (let day = 1; day <= 22; day += 1) {
      const spentAt = `2026-10-${String(day).padStart(2, '0')}`;
      await asha.agent.post(expensesUrl).send(equalSplit({ description: `Day ${day}`, spentAt }));
    }

    const first = await ravi.agent.get(expensesUrl);
    expect(first.body).toMatchObject({ page: 1, totalPages: 2, total: 22 });
    expect(first.body.expenses).toHaveLength(20);
    expect(first.body.expenses[0].description).toBe('Day 22');

    const second = await ravi.agent.get(`${expensesUrl}?page=2`);
    expect(second.body.expenses.map((expense) => expense.description)).toEqual(['Day 2', 'Day 1']);
  });
});

describe('changing expenses', () => {
  it('lets the person who added it edit it, and recalculates the shares', async () => {
    const created = await asha.agent.post(expensesUrl).send(equalSplit());
    const url = `${expensesUrl}/${created.body.expense.id}`;

    const res = await asha.agent.put(url).send(equalSplit({ amount: 600, participants: [ravi.user.id, meera.user.id] }));

    expect(res.status).toBe(200);
    expect(res.body.expense.shares).toEqual([
      { user: ravi.user.id, amount: 300 },
      { user: meera.user.id, amount: 300 },
    ]);
  });

  it("stops other members from editing or deleting someone else's expense", async () => {
    const created = await asha.agent.post(expensesUrl).send(equalSplit());
    const url = `${expensesUrl}/${created.body.expense.id}`;

    expect((await ravi.agent.put(url).send(equalSplit())).status).toBe(403);
    expect((await ravi.agent.delete(url)).status).toBe(403);
  });

  it('deletes an expense', async () => {
    const created = await asha.agent.post(expensesUrl).send(equalSplit());
    const url = `${expensesUrl}/${created.body.expense.id}`;

    expect((await asha.agent.delete(url)).status).toBe(204);
    expect((await asha.agent.get(expensesUrl)).body.total).toBe(0);
  });

  it("can't reach an expense through a different group's address", async () => {
    const created = await asha.agent.post(expensesUrl).send(equalSplit());
    const otherGroupId = await createGroup(asha, [], 'Another group');

    const res = await asha.agent.delete(`/api/groups/${otherGroupId}/expenses/${created.body.expense.id}`);
    expect(res.status).toBe(404);
  });
});
