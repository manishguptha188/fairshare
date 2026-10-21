import { describe, expect, it } from 'vitest';
import { computeBalances, suggestSettlements } from '../src/lib/balances.js';
import { splitEqually, sumAmounts } from '../src/lib/money.js';

describe('splitEqually', () => {
  it('splits an amount that divides exactly', () => {
    expect(splitEqually(900, ['a', 'b', 'c'])).toEqual([
      { user: 'a', amount: 300 },
      { user: 'b', amount: 300 },
      { user: 'c', amount: 300 },
    ]);
  });

  it('gives leftover paise to the first people so the shares still add up', () => {
    const shares = splitEqually(1000, ['a', 'b', 'c']);
    expect(shares.map((s) => s.amount)).toEqual([334, 333, 333]);
    expect(sumAmounts(shares)).toBe(1000);
  });

  it('never loses or invents a paisa, for any total and group size', () => {
    for (let people = 1; people <= 7; people += 1) {
      const ids = Array.from({ length: people }, (_, i) => `u${i}`);
      for (const total of [1, 2, 99, 100, 101, 12345, 99999]) {
        const shares = splitEqually(total, ids);
        expect(sumAmounts(shares)).toBe(total);
        const amounts = shares.map((s) => s.amount);
        expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('rejects totals that are not positive whole paise, and empty groups', () => {
    expect(() => splitEqually(0, ['a'])).toThrow();
    expect(() => splitEqually(10.5, ['a'])).toThrow();
    expect(() => splitEqually(100, [])).toThrow();
  });
});

describe('computeBalances', () => {
  it('credits the payer and debits everyone who shared', () => {
    const expenses = [{ paidBy: 'asha', amount: 900, shares: splitEqually(900, ['asha', 'ravi', 'meera']) }];
    const balances = computeBalances(['asha', 'ravi', 'meera'], expenses, []);

    expect(Object.fromEntries(balances)).toEqual({ asha: 600, ravi: -300, meera: -300 });
  });

  it('applies settlements and always sums to zero', () => {
    const expenses = [
      { paidBy: 'asha', amount: 900, shares: splitEqually(900, ['asha', 'ravi', 'meera']) },
      { paidBy: 'ravi', amount: 500, shares: [{ user: 'meera', amount: 500 }] },
    ];
    const settlements = [{ from: 'meera', to: 'asha', amount: 300 }];
    const balances = computeBalances(['asha', 'ravi', 'meera'], expenses, settlements);

    expect(Object.fromEntries(balances)).toEqual({ asha: 300, ravi: 200, meera: -500 });
    expect([...balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('lists members with nothing yet at zero', () => {
    expect(Object.fromEntries(computeBalances(['asha', 'ravi'], [], []))).toEqual({ asha: 0, ravi: 0 });
  });
});

describe('suggestSettlements', () => {
  it('suggests nothing when everyone is settled', () => {
    expect(suggestSettlements(new Map([['a', 0], ['b', 0]]))).toEqual([]);
  });

  it('pays the biggest creditor from the biggest debtor first', () => {
    const balances = new Map([['asha', 300], ['ravi', 200], ['meera', -500]]);
    expect(suggestSettlements(balances)).toEqual([
      { from: 'meera', to: 'asha', amount: 300 },
      { from: 'meera', to: 'ravi', amount: 200 },
    ]);
  });

  it('clears every balance in at most n - 1 payments', () => {
    const balances = new Map([['a', 700], ['b', -250], ['c', -250], ['d', 100], ['e', -300]]);
    const payments = suggestSettlements(balances);

    const after = new Map(balances);
    for (const { from, to, amount } of payments) {
      expect(amount).toBeGreaterThan(0);
      after.set(from, after.get(from) + amount);
      after.set(to, after.get(to) - amount);
    }
    expect([...after.values()].every((amount) => amount === 0)).toBe(true);
    expect(payments.length).toBeLessThanOrEqual(balances.size - 1);
  });
});
