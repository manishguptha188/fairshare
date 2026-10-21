import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';

try {
  await mongoose.connect(config.mongoUri);
} catch (err) {
  console.error(`Could not connect to MongoDB at ${config.mongoUri}.`);
  console.error('For local development, start the database first with `npm run db`.');
  console.error(err.message);
  process.exit(1);
}

createApp().listen(config.port, () => {
  console.log(`FairShare API listening on http://localhost:${config.port}`);
});
