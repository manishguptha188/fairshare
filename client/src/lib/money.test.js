import { describe, expect, it } from 'vitest';
import { formatRupees, paiseToInput, toPaise } from './money.js';

describe('toPaise', () => {
  it.each([
    ['250', 25000],
    ['250.5', 25050],
    ['250.50', 25050],
    ['0.05', 5],
    ['1,250.75', 125075],
    [' ₹ 99 ', 9900],
    ['19.99', 1999],
  ])('reads %j as %i paise', (text, paise) => {
    expect(toPaise(text)).toBe(paise);
  });

  it.each(['', 'abc', '-5', '0', '0.00', '1.234', '1.2.3', '12e3'])('rejects %j', (text) => {
    expect(toPaise(text)).toBeNull();
  });
});

describe('formatting', () => {
  it('shows paise as Indian rupees', () => {
    expect(formatRupees(125075)).toBe('₹1,250.75');
    expect(formatRupees(1_00_00_000)).toBe('₹1,00,000.00');
  });

  it('turns paise back into an input value', () => {
    expect(paiseToInput(1999)).toBe('19.99');
    expect(paiseToInput(5)).toBe('0.05');
  });
});
