// A balance is how much the group owes a member (positive) or the member owes the group (negative), in paise.
// Balances are always worked out from the expenses and settlements, never stored, so editing or deleting
// an expense can't leave a stale total behind.
export function computeBalances(memberIds, expenses, settlements) {
  const balances = new Map(memberIds.map((id) => [id, 0]));
  const add = (userId, amount) => balances.set(userId, (balances.get(userId) ?? 0) + amount);

  for (const expense of expenses) {
    add(expense.paidBy, expense.amount);
    for (const share of expense.shares) {
      add(share.user, -share.amount);
    }
  }

  // Paying someone back moves money the other way: the payer's debt shrinks, the receiver is owed less.
  for (const settlement of settlements) {
    add(settlement.from, settlement.amount);
    add(settlement.to, -settlement.amount);
  }

  return balances;
}

// Turns balances into a list of payments that clears every debt. Each step pairs the person who owes the
// most with the person owed the most and settles as much as possible between them, so at least one of the
// two is fully settled per payment: n people never need more than n - 1 payments. (Finding the absolute
// minimum number of payments is a much harder problem; this greedy rule is what most apps use.)
export function suggestSettlements(balances) {
  const byIdForTies = (a, b) => (a.userId < b.userId ? -1 : 1);
  const debtors = [];
  const creditors = [];
  for (const [userId, amount] of balances) {
    if (amount < 0) debtors.push({ userId, amount: -amount });
    if (amount > 0) creditors.push({ userId, amount });
  }
  debtors.sort((a, b) => b.amount - a.amount || byIdForTies(a, b));
  creditors.sort((a, b) => b.amount - a.amount || byIdForTies(a, b));

  const payments = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    payments.push({ from: debtors[d].userId, to: creditors[c].userId, amount });
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (debtors[d].amount === 0) d += 1;
    if (creditors[c].amount === 0) c += 1;
  }
  return payments;
}
