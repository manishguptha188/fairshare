import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';

beforeAll(async () => {
  await mongoose.connect(inject('mongoUri'), { dbName: `test-${randomUUID()}` });
  // Wait for unique indexes (such as User.email) to exist before any test relies on them.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
});

// Every test starts from empty collections, so tests never depend on the order they run in.
afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
