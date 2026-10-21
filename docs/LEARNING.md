# Learning guide

This guide walks through FairShare one feature at a time: the idea behind it, the files involved, how data moves
from the screen to the database and back, the decisions taken (and the alternatives), a few questions to check your
understanding, and a small change to try yourself.

Read it next to the code. When a question stumps you, open the file it mentions and find the line that answers it.

---

## 1. Project setup

**Concept.** A MERN app is two programs. The **server** (Node + Express) owns the data: it talks to MongoDB and
exposes a REST API under `/api`. The **client** (React, built with Vite) runs in the browser and calls that API with
`fetch`. They live in one repository as two npm *workspaces* so one `npm install` sets up both.

**Files.**
- `package.json`: the workspaces and the commands you run (`npm run dev`, `npm test`, …).
- `server/src/app.js`: builds the Express app (middleware, routes, error handler). It does **not** start listening,
  so tests can use it without opening a port.
- `server/src/server.js`: connects to MongoDB, then starts listening. This is what `npm run dev` runs.
- `server/src/config.js`: reads settings from environment variables, with safe defaults for local work.
- `server/src/middleware/errorHandler.js`: the single place that turns errors into JSON responses.
- `server/scripts/local-db.js`: starts a local MongoDB that keeps its data in `server/.data/db`.
- `client/vite.config.js`: forwards `/api` requests from the Vite dev server to Express.

**Decisions.**
- *Express 5* catches errors thrown in `async` route handlers and passes them to the error handler. In Express 4 you
  needed a wrapper (`asyncHandler`) or `try/catch` in every route; here you can just `throw`.
- *Node's `--env-file-if-exists` flag* loads `server/.env`, so no `dotenv` package is needed.
- *One origin.* In development Vite proxies `/api` to Express; in production Express serves the built React files.
  Either way the browser only ever talks to one origin, which keeps cookies simple and avoids CORS.
- *Tests use a real MongoDB* (`mongodb-memory-server`) rather than mocks, so they catch real query mistakes. Each test
  file gets its own database and every test starts with empty collections.

**Check yourself.**
1. Why is `createApp()` in a different file from the code that calls `listen()`?
2. What happens to a request for `/api/nothing-here`? Which lines decide that?
3. Why would mocking Mongoose in tests hide some bugs?

**Try it.** Add a `GET /api/version` route in `app.js` that returns `{ "version": "0.1.0" }`, and a test for it in
`server/tests/health.test.js`. Run `npm test --workspace server`.

---

## 2. Authentication

**Concept.** *Authentication* answers "who are you?". When you register or log in, the server checks your details
and then gives the browser a **token**: a signed note that says "this is user 652f…". The browser sends it back on
every request, and the server checks the signature to know who is asking. FairShare keeps the token in an
**httpOnly cookie**, which the browser stores and sends automatically but page JavaScript cannot read.

**Files.**
- `server/src/models/User.js`: the user schema. The password hash is `select: false`, and `toJSON` only exposes
  `id`, `name` and `email`.
- `server/src/routes/auth.js`: `POST /register`, `POST /login`, `POST /logout`, `GET /me`, plus input validation (Zod)
  and the login rate limit.
- `server/src/lib/authToken.js`: creates and checks the JWT, and holds the cookie settings.
- `server/src/middleware/requireAuth.js`: reads the cookie on protected routes and puts the user on `req.user`.
- `server/tests/auth.test.js`: what "working" means, written as tests.

**How a login travels.**
1. The React login form sends `POST /api/auth/login` with `{ email, password }` as JSON.
2. Express parses the JSON; `loginSchema.parse` trims and lowercases the email and rejects empty fields (400).
3. The route finds the user by email, asking for the hidden `passwordHash` with `.select('+passwordHash')`.
4. `bcrypt.compare` hashes the typed password the same way and compares. Wrong → 401 with a generic message.
5. Right → the server signs a JWT `{ sub: userId }` (valid 7 days) and sets it as the `fairshare_token` cookie.
6. The response body is `{ user: { id, name, email } }`; React stores that user in state and shows the app.
7. Later requests carry the cookie automatically. `requireAuth` verifies it and loads the user from MongoDB.

**Decisions and alternatives.**
- *Hashing, not encryption.* A bcrypt hash can't be turned back into the password. bcrypt is deliberately slow
  (cost 10 ≈ 100 ms), which makes guessing millions of passwords expensive. `bcryptjs` is used because it is plain
  JavaScript and installs on Windows without a C++ compiler.
- *Cookie vs `localStorage`.* A token in `localStorage` can be read by any script on the page, so one XSS bug leaks
  every session. An httpOnly cookie can't be read by scripts. The trade-off is CSRF (another site making your
  browser send the cookie); `SameSite=Lax` stops cross-site POSTs from carrying it.
- *Same error for wrong email and wrong password* so attackers can't use login to discover who has an account.
  (Registration still says "email already exists"; that's a usability trade-off most apps accept.)
- *Duplicate emails* are stopped by the database's unique index, not by a "does it exist?" query, because two
  sign-ups arriving at the same moment could both pass that check.
- *Rate limiting:* 20 login/register attempts per IP per 15 minutes.
- *Checking the user on every request* costs one indexed query but means a deleted account stops working at once.
  A stateless alternative is to trust the token alone until it expires.

**Check yourself.**
1. Why can't someone who copies the `users` collection log in as Asha?
2. What would change if the cookie weren't `httpOnly`?
3. Why does the password have a maximum length of 72?
4. Which test proves that logging out really works?

**Try it.** Add a `PATCH /api/auth/me` route that lets a logged-in user change their `name` (1–50 characters, trimmed).
Reuse `requireAuth`, validate with Zod, and write two tests: one that succeeds, one that sends an empty name and
expects 400.
