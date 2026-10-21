// Throw an HttpError from a route when the request itself is the problem (wrong id, no permission, bad state).
// The error handler turns it into a JSON response with this status and message. `fields` maps a form field
// to its problem, so the client can show the message next to the right input.
export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
