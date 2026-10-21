import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/requireAuth.js';
import { createAuthRouter } from './routes/auth.js';
import { groupsRouter } from './routes/groups.js';

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

// Tests pass a higher login-attempt limit so that signing up many test users doesn't trip the rate limiter.
export function createApp({ authAttemptsPerWindow = 20 } = {}) {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => {
    const databaseUp = mongoose.connection.readyState === 1;
    res.status(databaseUp ? 200 : 503).json({ status: databaseUp ? 'ok' : 'database unavailable' });
  });

  app.use('/api/auth', createAuthRouter({ attemptsPerWindow: authAttemptsPerWindow }));
  app.use('/api/groups', requireAuth, groupsRouter);

  // Unknown API paths get a JSON 404 instead of falling through to the React app.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // In production the same server hosts the built React app, so the browser talks to one origin
  // and the login cookie works without any CORS setup.
  if (config.isProduction) {
    app.use(express.static(clientDist));
    app.get('/{*path}', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
