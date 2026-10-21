import mongoose from 'mongoose';
import { toJSON } from './toJSON.js';

const { ObjectId } = mongoose.Schema.Types;

// A settlement records real money changing hands outside the app ("Meera paid Asha ₹300 by UPI").
const settlementSchema = new mongoose.Schema(
  {
    group: { type: ObjectId, ref: 'Group', required: true },
    from: { type: ObjectId, ref: 'User', required: true },
    to: { type: ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    settledAt: { type: Date, required: true },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON },
);

settlementSchema.index({ group: 1, settledAt: -1, _id: -1 });

export const Settlement = mongoose.model('Settlement', settlementSchema);
