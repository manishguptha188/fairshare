import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../errors.js';
import { isObjectId, objectId, optionalDate, paise } from '../lib/validation.js';
import { Settlement } from '../models/Settlement.js';

const settlementSchema = z
  .object({ from: objectId, to: objectId, amount: paise, settledAt: optionalDate })
  .refine((input) => input.from !== input.to, { message: 'Choose two different people.', path: ['to'] });

// Mounted at /api/groups/:groupId/settlements after loadGroup, so req.group is the current user's group.
export const settlementsRouter = Router();

settlementsRouter.get('/', async (req, res) => {
  const settlements = await Settlement.find({ group: req.group._id }).sort({ settledAt: -1, _id: -1 });
  res.json({ settlements });
});

settlementsRouter.post('/', async (req, res) => {
  const input = settlementSchema.parse(req.body);

  if (!req.group.hasMember(input.from) || !req.group.hasMember(input.to)) {
    throw new HttpError(400, 'Both people must be members of this group.');
  }
  // Only the payer or the receiver can record a payment, so nobody can mark someone else's debt as paid.
  if (!req.user._id.equals(input.from) && !req.user._id.equals(input.to)) {
    throw new HttpError(403, 'You can only record a payment you made or received.');
  }

  const settlement = await Settlement.create({
    group: req.group._id,
    from: input.from,
    to: input.to,
    amount: input.amount,
    settledAt: input.settledAt ?? new Date(),
    createdBy: req.user._id,
  });
  res.status(201).json({ settlement });
});

settlementsRouter.delete('/:settlementId', async (req, res) => {
  const { settlementId } = req.params;
  const settlement = isObjectId(settlementId) && (await Settlement.findOne({ _id: settlementId, group: req.group._id }));
  if (!settlement) {
    throw new HttpError(404, 'Payment not found.');
  }
  if (!settlement.createdBy.equals(req.user._id)) {
    throw new HttpError(403, 'Only the person who recorded this payment can delete it.');
  }
  await settlement.deleteOne();
  res.status(204).end();
});
