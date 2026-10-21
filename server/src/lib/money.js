// All amounts are whole paise (₹1 = 100 paise). Integers add up exactly; floating-point rupees don't
// (0.1 + 0.2 !== 0.3), and a balance that is off by a fraction of a paisa never settles to zero.

// Splits a total as evenly as possible. When it doesn't divide exactly, the leftover paise go one each
// to the first people in the list, so the shares always add up to the total.
// splitEqually(1000, ['a', 'b', 'c']) -> a: 334, b: 333, c: 333
export function splitEqually(total, userIds) {
  if (!Number.isInteger(total) || total < 1) {
    throw new Error('total must be a positive whole number of paise');
  }
  if (userIds.length === 0) {
    throw new Error('at least one person must share the expense');
  }

  const base = Math.floor(total / userIds.length);
  const leftover = total - base * userIds.length;
  return userIds.map((user, index) => ({ user, amount: base + (index < leftover ? 1 : 0) }));
}

export function sumAmounts(items) {
  return items.reduce((sum, item) => sum + item.amount, 0);
}
