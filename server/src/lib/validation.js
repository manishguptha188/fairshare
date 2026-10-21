import { z } from 'zod';

// Lowercased so the same id written in different letter cases can't count as two different people.
export const objectId = z.string().toLowerCase().regex(/^[a-f\d]{24}$/, 'Invalid id.');

export const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'));

export function isObjectId(value) {
  return objectId.safeParse(value).success;
}

// The API takes money as whole paise so the server never has to round. ₹1 crore is a generous upper limit
// that still catches typos like an extra few zeros.
export const paise = z
  .number({ error: 'Enter an amount.' })
  .int('Use whole paise (no fractions).')
  .min(1, 'The amount must be more than zero.')
  .max(1_00_00_000_00, 'That amount is too large.');

// Accepts "2026-10-22" or a full ISO timestamp; leaving it out means "now".
export const optionalDate = z.coerce.date({ error: 'Enter a valid date.' }).optional();
