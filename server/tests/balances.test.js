import { beforeEach, describe, expect, it } from 'vitest';
import { createGroup, createTestApp, signUp } from './helpers.js';

const app = createTestApp();
let asha;
let ravi;
let meera;
let groupId;

beforeEach(async () => {
  asha = await signUp(app, { name: 'Asha', email: 'asha@example.com' });
  ravi = await signUp(app, { name: 'Ravi', email: 'ravi@example.com' });
  meera = await signUp(app, { name: 'Meera', email: 'meera@example.com' });
  groupId = await createGroup(asha, [ravi, meera]);
});

async function balancesFor(member) {
  const res = await member.agent.get(`/api/groups/${groupId}/balances`);
  expect(res.status).toBe(200);
  return res.body;
}

const byUser = (balances) => Object.fromEntries(balances.map((balance) => [balance.user, balance.amount]));

describe('balances and settling up', () => {
  it('starts everyone at zero with nothing to pay', async () => {
    const { balances, suggestedPayments } = await balancesFor(asha);
    expect(byUser(balances)).toEqual({ [asha.user.id]: 0, [ravi.user.id]: 0, [meera.user.id]: 0 });
    expect(suggestedPayments).toEqual([]);
  });

  it('follows expenses and recorded payments until everyone is square', async () => {
    // Asha pays ₹900 for all three; Ravi pays ₹500 that only Meera owes.
    await asha.agent.post(`/api/groups/${groupId}/expenses`).send({
      description: 'Dinner',
      amount: 90000,
      paidBy: asha.user.id,
      splitType: 'equal',
      participants: [asha.user.id, ravi.user.id, meera.user.id],
    });
    await ravi.agent.post(`/api/groups/${groupId}/expenses`).send({
      description: 'Cab',
      amount: 50000,
      paidBy: ravi.user.id,
      splitType: 'exact',
      shares: [{ user: meera.user.id, amount: 50000 }],
    });

    const before = await balancesFor(meera);
    expect(byUser(before.balances)).toEqual({ [asha.user.id]: 60000, [ravi.user.id]: 20000, [meera.user.id]: -80000 });
    expect(before.suggestedPayments).toEqual([
      { from: meera.user.id, to: asha.user.id, amount: 60000 },
      { from: meera.user.id, to: ravi.user.id, amount: 20000 },
    ]);

    // Meera pays both back, recording each payment herself.
    for (const payment of before.suggestedPayments) {
      const res = await meera.agent.post(`/api/groups/${groupId}/settlements`).send(payment);
      expect(res.status).toBe(201);
    }

    const after = await balancesFor(asha);
    expect(Object.values(byUser(after.balances))).toEqual([0, 0, 0]);
    expect(after.suggestedPayments).toEqual([]);
  });

  it("only lets the payer or receiver record a payment", async () => {
    const res = await ravi.agent
      .post(`/api/groups/${groupId}/settlements`)
      .send({ from: meera.user.id, to: asha.user.id, amount: 1000 });
    expect(res.status).toBe(403);
  });

  it('rejects a payment to yourself', async () => {
    const res = await asha.agent
      .post(`/api/groups/${groupId}/settlements`)
      .send({ from: asha.user.id, to: asha.user.id, amount: 1000 });
    expect(res.status).toBe(400);
    expect(res.body.fields.to).toBeDefined();
  });

  it('lets only the person who recorded a payment delete it', async () => {
    const created = await meera.agent
      .post(`/api/groups/${groupId}/settlements`)
      .send({ from: meera.user.id, to: asha.user.id, amount: 1000 });
    const url = `/api/groups/${groupId}/settlements/${created.body.settlement.id}`;

    expect((await asha.agent.delete(url)).status).toBe(403);
    expect((await meera.agent.delete(url)).status).toBe(204);
    expect((await meera.agent.get(`/api/groups/${groupId}/settlements`)).body.settlements).toEqual([]);
  });
});
