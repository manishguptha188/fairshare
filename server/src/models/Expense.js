import mongoose from 'mongoose';
import { toJSON } from './toJSON.js';

const { ObjectId } = mongoose.Schema.Types;
const paise = { type: Number, required: true, min: 1, validate: Number.isInteger };

const shareSchema = new mongoose.Schema({ user: { type: ObjectId, ref: 'User', required: true }, amount: paise }, { _id: false });

const expenseSchema = new mongoose.Schema(
  {
    group: { type: ObjectId, ref: 'Group', required: true },
    description: { type: String, required: true, trim: true, maxlength: 100 },
    amount: paise,
    paidBy: { type: ObjectId, ref: 'User', required: true },
    splitType: { type: String, enum: ['equal', 'exact'], required: true },
    // The shares are stored for every split type, already worked out in paise. Balances then only ever add
    // up shares, and an equal split stays exactly as it was even if the group's members change later.
    shares: { type: [shareSchema], required: true },
    spentAt: { type: Date, required: true },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON },
);

// Matches how expenses are listed: one group, newest first.
expenseSchema.index({ group: 1, spentAt: -1, _id: -1 });

export const Expense = mongoose.model('Expense', expenseSchema);
