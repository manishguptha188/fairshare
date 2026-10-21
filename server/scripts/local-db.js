// Runs a real MongoDB server for local development without installing MongoDB.
// mongodb-memory-server downloads the official MongoDB binary once; giving it a dbPath on disk
// (instead of its default temporary folder) makes the data survive restarts.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const dbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.data/db');
mkdirSync(dbPath, { recursive: true });

const mongo = await MongoMemoryServer.create({
  instance: { port: 27017, dbPath, storageEngine: 'wiredTiger' },
});

console.log(`MongoDB is running at ${mongo.getUri()}`);
console.log(`Data is stored in ${dbPath}. Press Ctrl+C to stop.`);

async function stop() {
  await mongo.stop({ doCleanup: false });
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
