import { ZodError } from 'zod';
import { HttpError } from '../errors.js';

// Express recognises an error handler by its four arguments, so `next` must stay even though it is unused.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Please check the highlighted fields.',
      fields: Object.fromEntries(err.issues.map((issue) => [issue.path.join('.') || 'body', issue.message])),
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  // express.json() sets this when the request body is not valid JSON.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON.' });
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}
