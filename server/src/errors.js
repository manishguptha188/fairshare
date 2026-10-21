// Throw an HttpError from a route when the request itself is the problem (wrong id, no permission, bad state).
// The error handler turns it into a JSON response with this status and message.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
