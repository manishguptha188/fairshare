const env = process.env.NODE_ENV ?? 'development';
const isProduction = env === 'production';

export const config = {
  env,
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/fairshare',
  // A fixed fallback keeps local setup simple, but a production server must never run with it.
  jwtSecret: process.env.JWT_SECRET ?? (isProduction ? undefined : 'dev-only-secret-do-not-use-in-production'),
};

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET must be set when NODE_ENV is production');
}
