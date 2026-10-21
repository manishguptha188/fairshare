import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    // Stored lowercase so "Asha@Mail.com" and "asha@mail.com" are the same account.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false keeps the hash out of every query unless a route asks for it explicitly (only login does).
    passwordHash: { type: String, required: true, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        return { id: ret._id.toString(), name: ret.name, email: ret.email };
      },
    },
  },
);

export const User = mongoose.model('User', userSchema);
