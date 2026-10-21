# Architecture

FairShare is a single Node.js application with two halves: an Express REST API backed by MongoDB, and a React
single-page app built with Vite. In development they run as two processes; in production Express serves both.

```
 Browser (React SPA)
   │  fetch('/api/...')  + httpOnly login cookie
   ▼
 Express 5  ── helmet, JSON body limit, cookie parser
   │   /api/auth/*        register · login · logout · me        (rate limited)
   │   /api/groups/*      requireAuth → loadGroup → route        (members only)
   │   errorHandler       one JSON error format for everything
   ▼
 Mongoose 9  ──►  MongoDB (users · groups · expenses · settlements)
```

## Folder structure

```text
server/
  src/
    app.js              builds the Express app (no listen, so tests can use it)
    server.js           connects to MongoDB and starts listening
    config.js           environment variables and their defaults
    errors.js           HttpError(status, message, fields)
    lib/                plain functions with no Express or database code
      money.js          splitEqually, sumAmounts
      balances.js       computeBalances, suggestSettlements
      validation.js     shared Zod pieces (objectId, email, paise, optionalDate)
      authToken.js      JWT creation and checking, cookie settings
    middleware/         requireAuth, loadGroup, errorHandler
    models/             User, Group, Expense, Settlement
    routes/             auth, groups, expenses, settlements
  scripts/              local-db.js (local MongoDB), seed.js (sample data)
  tests/                Vitest + Supertest against a throw-away MongoDB
client/
  src/
    api.js              apiRequest() and ApiError
    hooks/useApi.js     loading / error / data for one API path
    auth/               AuthProvider (who is logged in), RequireAuth
    pages/              Login, Register, Groups, Group, NotFound
    components/         Layout, TextField, States, group/* (form, lists, panels)
    lib/                money and date formatting
docs/                   this file and the learning guide
```

## Data model

All money is stored as integer **paise**. Every document has `createdAt` and `updatedAt`.

| Collection | Fields | Indexes |
|---|---|---|
| `users` | `name`, `email` (lowercase), `passwordHash` (never returned) | `email` unique |
| `groups` | `name`, `members: [userId]`, `createdBy` | `members` |
| `expenses` | `group`, `description`, `amount`, `paidBy`, `splitType` (`equal` / `exact`), `shares: [{ user, amount }]`, `spentAt`, `createdBy` | `{ group, spentAt: -1, _id: -1 }` |
| `settlements` | `group`, `from`, `to`, `amount`, `settledAt`, `createdBy` | `{ group, settledAt: -1, _id: -1 }` |

- **Members are embedded** in the group: groups are small, and one query answers both "who is in it?" and "is this
  user allowed in?".
- **Shares are stored for every expense**, already worked out in paise, so balances only ever add up shares.
- **Balances are not stored.** They are computed from expenses and settlements on each request, so they can't drift
  out of sync after an edit or a delete.

## API

All routes are under `/api` and exchange JSON. Errors look like `{ "error": "message", "fields": { "name": "problem" } }`.

| Method | Path | Who | What |
|---|---|---|---|
| POST | `/auth/register` | anyone | Create an account and log in (201) |
| POST | `/auth/login` | anyone | Log in (sets the cookie) |
| POST | `/auth/logout` | anyone | Clear the cookie (204) |
| GET | `/auth/me` | logged in | The current user |
| GET | `/groups` | logged in | Groups you belong to |
| POST | `/groups` | logged in | Create a group with you as the first member |
| GET | `/groups/:id` | member | The group with member names |
| POST | `/groups/:id/members` | member | Add a registered user by email |
| GET | `/groups/:id/balances` | member | Balances and suggested payments |
| GET | `/groups/:id/expenses?page=n` | member | Expenses, newest first, 20 per page |
| POST | `/groups/:id/expenses` | member | Add an expense (`equal` with `participants`, or `exact` with `shares`) |
| PUT | `/groups/:id/expenses/:expenseId` | whoever added it | Replace an expense |
| DELETE | `/groups/:id/expenses/:expenseId` | whoever added it | Delete an expense (204) |
| GET | `/groups/:id/settlements` | member | Recorded payments |
| POST | `/groups/:id/settlements` | the payer or receiver | Record a payment |
| DELETE | `/groups/:id/settlements/:settlementId` | whoever recorded it | Delete a payment (204) |
| GET | `/health` | anyone | 200 when the database is connected, 503 when not |

Status codes used: 200, 201, 204, 400 (validation), 401 (not logged in), 403 (logged in but not allowed),
404 (missing, or not yours to see), 409 (duplicate), 429 (too many login attempts), 500.

## Security

- Passwords are hashed with bcrypt (cost 10) and never returned by the API.
- The session is a JWT (7 days) in an `httpOnly`, `SameSite=Lax` cookie, `Secure` in production. Scripts can't read
  it, and cross-site form posts don't carry it.
- `requireAuth` loads the user from the database on every request, so deleted accounts stop working at once.
- `loadGroup` puts the membership check inside the database query and answers 404 to outsiders.
- Login and register are rate limited per IP (20 per 15 minutes); production trusts one proxy hop so the limit
  applies to the real visitor.
- Every request body is validated with Zod; Mongoose schemas repeat the critical rules (integer paise, required
  fields) as a second line of defence. Request bodies are capped at 20 kB.
- `helmet` sets standard security headers, including a Content Security Policy.
- Secrets come only from environment variables, and the server never prints `MONGODB_URI` (a hosted connection
  string contains the database password).

## Testing

- **Server:** Vitest + Supertest send real HTTP requests to the Express app, backed by a real MongoDB started by
  `mongodb-memory-server`. Each test file gets its own database and every test starts with empty collections.
  The money logic also has plain unit tests.
- **Client:** Vitest + React Testing Library in jsdom. Components are tested the way a user uses them (labels,
  buttons, visible text), and the app-level test runs the real router with a fake `fetch`.
- **CI:** GitHub Actions runs lint, all tests and the production build on every push and pull request.

## Deployment

`render.yaml` describes one free Render web service: it builds the client (`npm run build`) and starts Express
(`npm start`), which serves the API and the built React files from the same origin. The database is a free MongoDB
Atlas cluster whose connection string goes in the `MONGODB_URI` environment variable; Render generates
`JWT_SECRET`. Free Render services sleep when idle, so the first request after a while is slow.

## Known limits and next steps

- Adding members requires an existing account (no email invitations).
- Members can't leave or be removed yet.
- Only equal and exact splits; no percentages, currencies or receipts.
- Balances are computed on every request; very large groups would need a cached or aggregated total.
- Page-number pagination; cursor pagination would suit very long histories better.
