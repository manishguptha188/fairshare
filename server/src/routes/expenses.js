import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../errors.js';
import { splitEqually, sumAmounts } from '../lib/money.js';
import { isObjectId, objectId, optionalDate, paise } from '../lib/validation.js';
import { Expense } from '../models/Expense.js';

const PAGE_SIZE = 20;

const common = {
  description: z.string().trim().min(1, 'Describe the expense.').max(100, 'Use at most 100 characters.'),
  amount: paise,
  paidBy: objectId,
  spentAt: optionalDate,
};

// The two split types need different extra data, so the body is checked against one shape or the other
// depending on `splitType`.
const expenseSchema = z.discriminatedUnion('splitType', [
  z.object({
    ...common,
    splitType: z.literal('equal'),
    participants: z.array(objectId).min(1, 'Choose at least one person to split with.'),
  }),
  z.object({
    ...common,
    splitType: z.literal('exact'),
    shares: z.array(z.object({ user: objectId, amount: paise })).min(1, 'Add at least one share.'),
  }),
]);

const listQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1) });

const rupees = (amountInPaise) => `₹${(amountInPaise / 100).toFixed(2)}`;

// Checks the rules that need the group (who is a member) and returns the shares to store.
function buildShares(input, group) {
  if (!group.hasMember(input.paidBy)) {
    throw new HttpError(400, 'The payer must be a member of this group.', { paidBy: 'Not a member of this group.' });
  }

  const userIds = input.splitType === 'equal' ? input.participants : input.shares.map((share) => share.user);
  if (new Set(userIds).size !== userIds.length) {
    throw new HttpError(400, 'Each person can only appear once in the split.', { shares: 'Someone is listed twice.' });
  }
  if (!userIds.every((userId) => group.hasMember(userId))) {
    throw new HttpError(400, 'Everyone in the split must be a member of this group.', { shares: 'Not all are members.' });
  }

  if (input.splitType === 'equal') {
    return splitEqually(input.amount, input.participants);
  }

  const sharesTotal = sumAmounts(input.shares);
  if (sharesTotal !== input.amount) {
    throw new HttpError(400, `The shares add up to ${rupees(sharesTotal)} but the expense is ${rupees(input.amount)}.`, {
      shares: 'Shares must add up to the total.',
    });
  }
  return input.shares;
}

async function findExpenseInGroup(req) {
  const { expenseId } = req.params;
  const expense = isObjectId(expenseId) && (await Expense.findOne({ _id: expenseId, group: req.group._id }));
  if (!expense) {
    throw new HttpError(404, 'Expense not found.');
  }
  return expense;
}

// Members can see every expense in their group, but only the person who added one can change or delete it.
function assertCanChange(expense, user) {
  if (!expense.createdBy.equals(user._id)) {
    throw new HttpError(403, 'Only the person who added this expense can change it.');
  }
}

// Mounted at /api/groups/:groupId/expenses after loadGroup, so req.group is the current user's group.
export const expensesRouter = Router();

expensesRouter.get('/', async (req, res) => {
  const { page } = listQuerySchema.parse(req.query);
  const filter = { group: req.group._id };

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .sort({ spentAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE),
    Expense.countDocuments(filter),
  ]);

  res.json({ expenses, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total });
});

expensesRouter.post('/', async (req, res) => {
  const input = expenseSchema.parse(req.body);
  const expense = await Expense.create({
    group: req.group._id,
    description: input.description,
    amount: input.amount,
    paidBy: input.paidBy,
    splitType: input.splitType,
    shares: buildShares(input, req.group),
    spentAt: input.spentAt ?? new Date(),
    createdBy: req.user._id,
  });
  res.status(201).json({ expense });
});

expensesRouter.put('/:expenseId', async (req, res) => {
  const expense = await findExpenseInGroup(req);
  assertCanChange(expense, req.user);

  const input = expenseSchema.parse(req.body);
  expense.set({
    description: input.description,
    amount: input.amount,
    paidBy: input.paidBy,
    splitType: input.splitType,
    shares: buildShares(input, req.group),
    spentAt: input.spentAt ?? expense.spentAt,
  });
  await expense.save();
  res.json({ expense });
});

expensesRouter.delete('/:expenseId', async (req, res) => {
  const expense = await findExpenseInGroup(req);
  assertCanChange(expense, req.user);
  await expense.deleteOne();
  res.status(204).end();
});
