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

---

## 3. Groups and authorization

**Concept.** *Authorization* answers "are you allowed to do this?". Being logged in isn't enough: Asha must not be
able to read or change Kiran's flat group just by guessing its id. That kind of bug (an "IDOR") is one of the most
common security problems in real APIs.

**Files.**
- `server/src/models/Group.js`: name, `members` (an array of user ids) and `hasMember(userId)`.
- `server/src/middleware/loadGroup.js`: runs before every `/api/groups/:groupId/...` route.
- `server/src/routes/groups.js`: list, create, view and add members, plus the balances route (section 5).
- `server/tests/groups.test.js`.

**How "view a group" travels.**
1. React calls `GET /api/groups/652f…` (the cookie goes along automatically).
2. `requireAuth` (mounted on all of `/api/groups` in `app.js`) sets `req.user`.
3. `loadGroup` runs `Group.findOne({ _id: groupId, members: req.user._id })`. The member check is *inside the query*.
4. No match → 404 "Group not found". A match → `req.group`, and the route continues.
5. The route calls `populate('members', 'name email')` to swap member ids for `{ id, name, email }` and responds.

**Decisions and alternatives.**
- *404, not 403, for outsiders.* A 403 would confirm that the id belongs to a real group.
- *Members inside the group document* (an embedded array) instead of a separate `Membership` collection. Groups are
  small, and one query answers both "is she a member?" and "who is in it?". A separate collection would be better if
  groups had thousands of members or per-member settings such as roles.
- *`$addToSet`* adds a member atomically, so two people adding Ravi at the same moment can't add him twice.
- *Adding people needs an existing account.* Email invitations would need an email service, so they are left out.

**Check yourself.**
1. Where exactly would you add a bug that lets outsiders read any group? Which test would catch it?
2. Why compare ObjectIds with `.equals()` rather than `===`?
3. What does `populate` do, and why is the group list returned *without* populating members?

**Try it.** Let a member leave a group with `DELETE /api/groups/:groupId/members/me`, but only when their balance is
zero (reuse the balance code from section 5). Write tests for "leaves when settled" and "refused while owing money".

---

## 4. Expenses and money

**Concept.** Money is stored as **whole paise** (integers). Computers store most decimals approximately:
`0.1 + 0.2` is `0.30000000000000004` in JavaScript. Add enough of those and a balance ends at ₹0.0000001, which
never shows as settled. Integers are exact.

**Files.**
- `server/src/lib/money.js`: `splitEqually` and `sumAmounts`, plain functions with no Express or MongoDB.
- `server/src/models/Expense.js`: what is stored, including the computed `shares`.
- `server/src/routes/expenses.js`: list (paged), create, edit, delete; validation in two layers.
- `server/tests/money.test.js` and `server/tests/expenses.test.js`.

**How "add an expense" travels.**
1. The React form turns "₹250.50" into `25050` paise (never through floating point) and sends
   `POST /api/groups/:groupId/expenses` with `{ description, amount, paidBy, splitType, participants | shares }`.
2. `requireAuth` → `loadGroup` → the route.
3. **Shape check (Zod):** `expenseSchema` is a *discriminated union*: an `equal` split must include `participants`,
   an `exact` split must include `shares`. Wrong types, decimals or missing fields → 400 with field messages.
4. **Business rules (`buildShares`):** the payer and everyone in the split must be group members, nobody may appear
   twice, and exact shares must add up to the total ("The shares add up to ₹300.00 but the expense is ₹900.00.").
5. For an equal split, `splitEqually` works out each person's share in paise.
6. `Expense.create` stores it; the response is `{ expense }` with `id` instead of `_id`.

**Decisions and alternatives.**
- *Who gets the leftover paisa?* ₹10.00 between 3 people is 334 + 333 + 333. The first people in the list get one
  extra paisa each; the total always adds up. A test checks this for 49 combinations of totals and group sizes.
- *Store shares even for equal splits.* Balances then just add up shares, and old expenses don't change if the group
  changes later. The alternative (recomputing equal splits at read time) breaks history.
- *Only the person who added an expense can edit or delete it* (403 for others). Real apps often let any member
  edit; this stricter rule is easier to reason about and to test.
- *Page-number pagination* (`?page=2`, 20 per page) is simple and fine for small lists. Very large or fast-changing
  lists usually use cursor pagination ("give me 20 older than this id") instead.

**Check yourself.**
1. Why does the API take `amount: 25050` instead of `amount: 250.50`?
2. What does `discriminatedUnion('splitType', …)` give you that a single object schema can't?
3. Why is the "shares must add up" rule in `buildShares` and not in the Zod schema?

**Try it.** Add a third split type, `percentage`: each share is a percentage, the percentages must add up to 100,
and the paise are worked out on the server. Decide where leftover paise go, and test 3 people at 33.33% of ₹100.

---

## 5. Balances and settling up

**Concept.** A member's **balance** is what they paid minus what they owe. Positive means the group owes them;
negative means they owe the group. Across a group the balances always add up to zero. A **settlement** records real
money changing hands ("Meera paid Asha ₹600 by UPI").

**Files.**
- `server/src/lib/balances.js`: `computeBalances` and `suggestSettlements`, plain functions.
- `server/src/models/Settlement.js`, `server/src/routes/settlements.js`.
- The `GET /api/groups/:groupId/balances` route in `server/src/routes/groups.js`.
- `server/tests/money.test.js` (the pure logic) and `server/tests/balances.test.js` (the API).

**How "show balances" travels.**
1. React calls `GET /api/groups/:groupId/balances`.
2. The route loads only the fields it needs from expenses (`amount paidBy shares`) and settlements
   (`from to amount`) with `.lean()`, which returns plain objects instead of full Mongoose documents.
3. `computeBalances` adds each expense to the payer and subtracts each share; settlements move money back.
4. `suggestSettlements` pairs the biggest debtor with the biggest creditor until everyone is at zero.
5. The response is `{ balances: [{ user, amount }], suggestedPayments: [{ from, to, amount }] }`.

**Decisions and alternatives.**
- *Computed, not stored.* A stored "balance" field would have to be updated correctly on every create, edit and
  delete, and one missed update leaves it wrong forever. Computing on read can't drift. The cost is reading all of a
  group's expenses, which is small for a flat or a trip. A very busy group would need a cached total or a MongoDB
  aggregation pipeline.
- *The greedy settle-up rule* needs at most (people − 1) payments. It doesn't always find the absolute minimum,
  but finding that is a much harder (NP-hard) problem, and greedy is what most apps use.
- *Only the payer or the receiver can record a payment*, so nobody can mark someone else's debt as paid.

**Check yourself.**
1. Asha paid ₹900 for 3 people. What are the three balances? Check your answer against the first test in
   `balances.test.js`.
2. Why must the balances always add up to zero? What would it mean if they didn't?
3. Why does the route convert ObjectIds to strings before calling `computeBalances`?

**Try it.** Write a unit test in `money.test.js` for four friends where two people are owed and two owe, and work out
by hand what `suggestSettlements` should return before running it.
