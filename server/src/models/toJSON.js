// Shared JSON shape for API responses: expose `id` (a string) instead of Mongo's `_id`, and drop `__v`.
export const toJSON = {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    delete ret._id;
    return ret;
  },
};
