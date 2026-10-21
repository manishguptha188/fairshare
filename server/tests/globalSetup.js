import { MongoMemoryServer } from 'mongodb-memory-server';

// One throw-away MongoDB server for the whole test run. Each test file gets its own database on it
// (see setup.js), so files can run in parallel without seeing each other's data.
export default async function startTestDatabase({ provide }) {
  const mongo = await MongoMemoryServer.create();
  provide('mongoUri', mongo.getUri());
  return () => mongo.stop();
}
