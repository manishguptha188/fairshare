import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../errors.js';
import { computeBalances, suggestSettlements } from '../lib/balances.js';
import { email } from '../lib/validation.js';
import { loadGroup } from '../middleware/loadGroup.js';
import { Expense } from '../models/Expense.js';
import { Group } from '../models/Group.js';
import { Settlement } from '../models/Settlement.js';
import { User } from '../models/User.js';
import { expensesRouter } from './expenses.js';
import { settlementsRouter } from './settlements.js';

const groupSchema = z.object({
  name: z.string().trim().min(1, 'Give the group a name.').max(60, 'Use at most 60 characters.'),
});
const addMemberSchema = z.object({ email });

export const groupsRouter = Router();

groupsRouter.get('/', async (req, res) => {
  const groups = await Group.find({ members: req.user._id }).sort({ createdAt: -1 });
  res.json({ groups });
});

groupsRouter.post('/', async (req, res) => {
  const { name } = groupSchema.parse(req.body);
  const group = await Group.create({ name, members: [req.user._id], createdBy: req.user._id });
  res.status(201).json({ group });
});

groupsRouter.get('/:groupId', loadGroup, async (req, res) => {
  await req.group.populate('members', 'name email');
  res.json({ group: req.group });
});

// Any member can add someone who already has a FairShare account. There are no email invitations in this
// version, so the person has to sign up first.
groupsRouter.post('/:groupId/members', loadGroup, async (req, res) => {
  const { email } = addMemberSchema.parse(req.body);

  const user = await User.findOne({ email });
  if (!user) {
    throw new HttpError(404, 'No FairShare account uses that email. Ask them to sign up first.', {
      email: 'No account with this email.',
    });
  }
  if (req.group.hasMember(user._id)) {
    throw new HttpError(409, `${user.name} is already in this group.`, { email: 'Already a member.' });
  }

  // $addToSet is atomic, so two people adding the same member at once still can't create a duplicate.
  await Group.updateOne({ _id: req.group._id }, { $addToSet: { members: user._id } });
  res.status(201).json({ member: user });
});

groupsRouter.get('/:groupId/balances', loadGroup, async (req, res) => {
  const [expenses, settlements] = await Promise.all([
    Expense.find({ group: req.group._id }, 'amount paidBy shares').lean(),
    Settlement.find({ group: req.group._id }, 'from to amount').lean(),
  ]);

  // The balance functions work on plain string ids, so ObjectIds are converted once here.
  const balances = computeBalances(
    req.group.members.map(String),
    expenses.map((expense) => ({
      amount: expense.amount,
      paidBy: String(expense.paidBy),
      shares: expense.shares.map((share) => ({ user: String(share.user), amount: share.amount })),
    })),
    settlements.map((settlement) => ({ from: String(settlement.from), to: String(settlement.to), amount: settlement.amount })),
  );

  res.json({
    balances: [...balances].map(([user, amount]) => ({ user, amount })),
    suggestedPayments: suggestSettlements(balances),
  });
});

groupsRouter.use('/:groupId/expenses', loadGroup, expensesRouter);
groupsRouter.use('/:groupId/settlements', loadGroup, settlementsRouter);
