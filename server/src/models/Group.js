import mongoose from 'mongoose';
import { toJSON } from './toJSON.js';

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // Groups are small (a flat, a trip), so the member list lives inside the group document.
    // The index makes "which groups am I in?" a fast lookup.
    members: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON },
);

// ObjectIds are objects, so `members.includes(id)` would compare references; `.equals` compares the values.
groupSchema.methods.hasMember = function hasMember(userId) {
  return this.members.some((memberId) => memberId.equals(userId));
};

export const Group = mongoose.model('Group', groupSchema);
