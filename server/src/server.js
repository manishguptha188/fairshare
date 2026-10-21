import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';

try {
  await mongoose.connect(config.mongoUri);
} catch (err) {
  // Never print MONGODB_URI itself: a hosted connection string contains the database password,
  // and logs are often shared or kept by the hosting platform.
  console.error('Could not connect to MongoDB. Check the MONGODB_URI setting.');
  if (!config.isProduction) {
    console.error('For local development, start the database first with `npm run db`.');
  }
  console.error(err.message);
  process.exit(1);
}

createApp().listen(config.port, () => {
  console.log(`FairShare API listening on http://localhost:${config.port}`);
});
