Date created: 2026-08-25
Date last modified: 2026-08-25

# Register, Login, and Logout - Technical PRD

## Overview/Problem

QuizMaker is a greenfield application for teachers who need a shared bank of multiple-choice questions. Before anyone can collaborate on that bank, the product has no concept of a user: there is no way for more than one teacher to create an account, prove who they are, or leave the app. This sprint solves only that identity gap so later work can attach questions to real teachers.

---

## Hypothesis

We believe that a simple register, login, and logout flow backed by a hashed-password user store will let multiple teachers start using QuizMaker as distinct users, without delaying the first sprint on sessions, tokens, or social login.

---

## Scope

### In Scope

- A Cloudflare D1 `users` table and a local migration that creates it
- A user service that can create, read, update, and delete users in D1
- HTTP endpoints for register, login, and logout
- Client-side SHA-256 hashing of the password before it is sent in an HTTP POST
- Server-side storage of that hash only (never plaintext)
- Register and login pages that POST hashed credentials and, on success, send the teacher to a stub MCQ page
- A logout control that calls the logout endpoint and returns the teacher to the login page
- A stub `/mcqs` page that exists only as a landing destination for the next sprint
- Test-driven implementation with Vitest: each phase starts with failing unit tests and is not complete until those tests are green

### Out of Scope

- Multiple-choice question create, read, update, or delete
- Social login (Google, Microsoft, and similar)
- Tokens (JWT, API keys, bearer auth)
- Session management, cookies, CSRF tokens, or "remember me"
- Password reset, email verification, or account lockout
- Role-based access control or admin vs teacher distinction
- Remote D1 migration apply or production deploy as a *phase gate*. The user later deployed to `workers.dev` after Phase 4; agents still must not deploy or run `migrations apply --remote` unless explicitly asked.

### Cut

- Sessions and cookies — deliberately deferred so this sprint stays a thin identity layer
- Tokens — not needed until a later sprint that must keep a user signed in across requests
- Server-only password hashing with a dedicated KDF (bcrypt / Argon2) — extra dependency and Workers complexity; this sprint uses Web Crypto SHA-256 on the client and stores that hash
- Protected-route middleware that blocks `/mcqs` for anonymous visitors — there is no session to check
- Public HTTP endpoints for user update and delete — the service methods exist for later use, but this sprint only exposes register, login, and logout
- `@cloudflare/vitest-pool-workers` — unit tests mock D1 and `getCloudflareContext()`; a real Workers test pool is a later decision if we need runtime-faithful DB tests

---

## Technical Requirements

### Database Schema

D1 is configured. Database name `quizmaker`, id `e1314a07-8e95-486d-a39d-fb047c750849`, binding `DB` in `wrangler.jsonc`. Migration `migrations/0001_create_users.sql` is applied **locally**. Do not apply it remotely unless the user asks. After `cf-typegen`, `env.DB` is typed in `cloudflare-env.d.ts` (do not edit that file by hand).

Username and email are separate columns. They may hold the same value for a given user (for example both `jane@school.edu`). Both must still be unique across the table.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

SQLite UNIQUE constraints already index `username` and `email`. Do not add redundant indexes.

Never persist the plaintext password. The `password_hash` column stores the SHA-256 hex digest produced on the client.

### API Endpoints

Route handlers live under `src/app/api/`. Register and login call the user service. Every request body is validated with Zod before it touches the database. Responses never include `password_hash`.

#### POST /api/auth/register

Creates a user and returns the created record (without the password hash).

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "username": "jane@school.edu",
  "email": "jane@school.edu",
  "password": "<sha-256 hex of the plaintext password>"
}
```

**Response:**
- Success (201): `{ "id": "...", "firstName": "Jane", "lastName": "Doe", "username": "jane@school.edu", "email": "jane@school.edu" }`
- Error (400): validation failure (missing fields, invalid email, empty names, password digest not a 64-char hex string)
- Error (409): username or email already exists
- Error (500): unexpected server error

#### POST /api/auth/login

Looks up the user by **username or email** (`COLLATE NOCASE`) and compares the submitted hash to `password_hash`. The JSON field is still named `username`; the value may be either identifier.

**Request Body:**
```json
{
  "username": "jane@school.edu",
  "password": "<sha-256 hex of the plaintext password>"
}
```

**Response:**
- Success (200): same public user object as register
- Error (400): validation failure
- Error (401): username not found or hash does not match (same message for both)
- Error (500): unexpected server error

Login does not set a cookie or issue a token. The client uses the success response only to decide to navigate to `/mcqs`.

#### POST /api/auth/logout

No session exists, so this endpoint does not clear server state. It exists so the UI has a single, stable contract for "leave the app."

**Request Body:** none

**Response:**
- Success (200): `{ "ok": true }`
- Error (500): unexpected server error

The client then navigates to `/login`.

### User Interface Requirements

Start from the shadcn/ui **login** and **signup** blocks (card + field + input + button). Keep their centered page layout and card chrome. Tailwind is already provided by shadcn; do not add a second styling system. Surface errors through `FieldError`. Do not add `react-hook-form`. Theme with tokens from `src/app/globals.css`.

Map the block fields onto the `users` table. Drop block features that are out of scope (Google buttons, "Forgot your password?").

Replace the starter homepage with a short QuizMaker landing that links to register and login.

#### Landing (/)
- Product name and one-sentence purpose
- Links to `/register` and `/login`

#### Register (/register)
- Page uses the shadcn signup-block layout (`min-h-svh`, centered, `max-w-sm`) and `SignupForm` from `@/components/signup-form`
- Fields (block's single "Full Name" is split to match the schema):
  - First name, last name, username, email, password, confirm password
- Username and email may be identical
- No "Sign up with Google" control
- Client validation before submit:
  - First and last name required, 1–50 characters
  - Username required, 3–50 characters
  - Email required and a valid email address
  - Password required, at least 8 characters
  - Confirm password must match password
- On submit: hash the plaintext password with SHA-256 (hex), POST `/api/auth/register` with the hash (never the plaintext), then navigate to `/mcqs` on 201
- Show field errors and a form-level message for 409 / 500
- "Already have an account? Sign in" links to `/login`

#### Login (/login)
- Page uses the shadcn login-block layout and `LoginForm` from `@/components/login-form`
- Fields: username or email, and password (login matches either the username or the email stored at registration)
- No "Forgot your password?" and no "Login with Google"
- Client validation: both required; password at least 8 characters
- On submit: hash the plaintext password with SHA-256 (hex), POST `/api/auth/login` with the hash, then navigate to `/mcqs` on 200
- Show a single generic error for 401 so the UI does not reveal whether the username exists
- "Don't have an account? Sign up" links to `/register`

#### MCQ stub (/mcqs)
- Heading such as "Question Bank"
- Short copy that this page will hold the shared MCQ bank in the next sprint
- Logout control that POSTs `/api/auth/logout` and navigates to `/login`
- No question list, editor, or persistence

#### Logout
- Not its own page
- Triggered from `/mcqs` (and any later authenticated chrome)
- Always ends on `/login`

`/mcqs` is not gated. Without sessions, a direct visit is allowed. That is accepted for this sprint.

---

## Test-Driven Development

Every implementation phase follows red → green. Tests are the phase gate; acceptance criteria are the sprint gate. Do not implement production code for a phase until that phase's tests exist and have been run in a failing state.

**Framework**: Vitest, as specified in `.cursor/skills/testing/SKILL.md`. Installed with `vitest`, `@vitejs/plugin-react@4`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, and `vite-tsconfig-paths`. Pin `@vitejs/plugin-react` to v4 (v6 pulls Babel 8 and conflicts with shadcn's Babel 7).

**Cycle for each phase**:
1. Write the phase's unit tests first (colocated `*.test.ts` / `*.test.tsx`)
2. Run `npm test` and confirm they fail for the right reason (missing module, unmet behavior, wrong status) — not because of a broken test
3. Implement the minimum production code to make those tests pass
4. Re-run `npm test`. The phase is incomplete until the new tests are green and earlier phases stay green
5. Do not add assertions that cannot fail. Prefer observable results (status codes, JSON, what the user sees, returned public users) over mock call order. Phase 1 is the exception: the migration and `wrangler.jsonc` binding *are* the deliverable, so those tests read those files.

**What unit tests must not do**:
- Reach a real D1 database, network, or model provider
- Render Server Components with Testing Library (test client components and plain functions)
- Reconstruct the full D1 prepared-statement chain in every file — keep DB access in `src/lib/` and mock that boundary

Install and config happen at the start of Phase 1, before any schema work:

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom vite-tsconfig-paths
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

```json
"test": "vitest run",
"test:watch": "vitest"
```

---

## Implementation Phases

### Phase 1: D1 and user schema - COMPLETED

**Objective**: Give the app a Vitest harness, a local D1 database, and a `users` table.

**TDD (write first — expect red)**:
1. Install Vitest and config as in Test-Driven Development above, then add `src/lib/db/users-schema.test.ts`
2. Assert `wrangler.jsonc` declares a D1 database binding named `DB`
3. Assert a `migrations/` SQL file creates `users` with `id`, `first_name`, `last_name`, `username`, `email`, `password_hash`, `created_at`, and `updated_at`
4. Assert `username` and `email` are UNIQUE, and that the table has `password_hash` rather than a plaintext `password` column
5. Run `npm test` and confirm these fail (no binding, no migration, or incomplete SQL)

**Implement (turn green)**:
1. Create the D1 database with Wrangler and add the `DB` binding to `wrangler.jsonc`
2. Run `npm run cf-typegen` so `env.DB` is typed
3. Create a migration for the `users` table
4. Apply the migration locally only
5. Re-run `npm test` until the schema tests pass

**Phase gate**: `npm test` is green for the schema tests.

**Deliverables**:
- `vitest.config.ts` and `package.json` `test` / `test:watch` scripts
- `src/lib/db/users-schema.test.ts`
- `wrangler.jsonc` D1 binding
- Updated `cloudflare-env.d.ts` via typegen (do not edit by hand)
- Migration file under `migrations/`
- Local schema applied

### Phase 2: User service and password hashing - COMPLETED

**Objective**: Centralize all user persistence and share one hashing helper between the browser and the server.

**TDD (write first — expect red)**:
1. Add `src/lib/hash-password.test.ts`:
   - Same plaintext always yields the same 64-character hex digest
   - Digest is not equal to the plaintext
   - Different passwords produce different digests
2. Add `src/lib/services/user.test.ts` against a mocked D1 (no real database):
   - `createUser` persists the supplied `password_hash` and returns a public user with no `password_hash`
   - Username and email may be the same value on one user
   - Duplicate username or email fails in a way the API can map to 409
   - `findUserByUsername` returns the record (including hash) or `null`
   - `updateUser` changes name fields and returns a public user
   - `deleteUser` removes the record so a later find returns `null`
3. Mock `@opennextjs/cloudflare` `getCloudflareContext` with a fake `env.DB`. Reset mocks in `beforeEach`.
4. Run `npm test` and confirm the new tests fail

**Implement (turn green)**:
1. Add a Web Crypto SHA-256 hex helper that is safe to import from both client and server code
2. Add `src/lib/services/user.ts` with create, find-by-username, update, and delete
3. Use prepared statements with numbered placeholders (`?1`, `?2`)
4. Never return `password_hash` from service methods that feed HTTP responses
5. Re-run `npm test` until hashing and user-service tests pass

**Phase gate**: `npm test` is green for hashing and user-service tests. Prior schema tests stay green.

**Deliverables**:
- `src/lib/hash-password.ts` and `src/lib/hash-password.test.ts`
- `src/lib/services/user.ts` and `src/lib/services/user.test.ts`
- Create, update, and delete usable by later sprints

### Phase 3: Auth API - COMPLETED

**Objective**: Expose register, login, and logout as HTTP POST endpoints.

**TDD (write first — expect red)**:
1. Add route-handler tests that call `POST` with a `Request` and read `status` plus JSON. Mock the user service; do not hit D1.
2. `src/app/api/auth/register/route.test.ts`:
   - Valid body → 201 public user, no `password_hash` in the body
   - Invalid body (missing fields, bad email, password not 64-char hex) → 400, no create call
   - Duplicate username or email → 409
3. `src/app/api/auth/login/route.test.ts`:
   - Matching username and hash → 200 public user
   - Unknown username → 401
   - Wrong hash → 401 with the same message as unknown username
   - Invalid body → 400
4. `src/app/api/auth/logout/route.test.ts`:
   - POST → 200 `{ "ok": true }`
5. Run `npm test` and confirm the new tests fail

**Implement (turn green)**:
1. Zod was required by project validation rules and was added in this phase (`zod@^4.4.3`)
2. Add Zod schemas for register and login bodies
3. Implement `POST /api/auth/register`, `POST /api/auth/login`, and `POST /api/auth/logout`
4. Map unique-constraint failures to 409 and credential mismatches to a generic 401
5. Re-run `npm test` until the route tests pass

**Phase gate**: `npm test` is green for register, login, and logout handlers. Prior tests stay green.

**Deliverables**:
- `src/app/api/auth/register/route.ts` and `route.test.ts`
- `src/app/api/auth/login/route.ts` and `route.test.ts`
- `src/app/api/auth/logout/route.ts` and `route.test.ts`
- Shared request/response types as needed

### Phase 4: Auth UI and MCQ stub - COMPLETED

**Objective**: Let a teacher register or log in from the browser and land on the MCQ stub.

**TDD (write first — expect red)**:
1. Put interactive UI in client components so Testing Library can render them. Query by role and accessible name. Use `userEvent`, not `fireEvent`.
2. `src/components/signup-form.test.tsx`:
   - Renders first name, last name, username, email, password, confirm password
   - Blocks submit when confirm password does not match (no `fetch`)
   - On valid submit, `fetch` POSTs `/api/auth/register` with a SHA-256 hex `password`, never the plaintext
   - 201 response navigates to `/mcqs` (mock `next/navigation`)
   - 409 shows a form-level error
3. `src/components/login-form.test.tsx`:
   - On valid submit, `fetch` POSTs `/api/auth/login` with a hashed password
   - 200 navigates to `/mcqs`
   - 401 shows a generic error that does not say whether the username exists
4. `src/components/logout-button.test.tsx`:
   - Click POSTs `/api/auth/logout` then navigates to `/login`
5. Run `npm test` and confirm the new tests fail

**Implement (turn green)**:
1. Replace the starter homepage with a landing page
2. Add `/login` and `/register` using the shadcn login/signup block page shells
3. Implement `LoginForm` and `SignupForm` from those blocks, adapted to our fields (no Google, no forgot-password)
4. Hash the password in the browser before POST
5. Add `/mcqs` stub with a logout control
6. Wire success and error paths for all three actions
7. Re-run `npm test` until the form tests pass

**Phase gate**: `npm test` is green for register, login, and logout UI tests. Prior tests stay green. Then verify the same flows in the browser (landing, register, login, stub, logout).

**Deliverables**:
- `src/app/page.tsx` landing
- `src/app/register/page.tsx` (shadcn signup-block shell)
- `src/app/login/page.tsx` (shadcn login-block shell)
- `src/components/signup-form.tsx` and `src/components/login-form.tsx`
- `src/app/mcqs/page.tsx` stub
- `src/components/logout-button.tsx`
- Client hashing used on both forms
- Colocated `*.test.tsx` for the client components

### Phase 5: Verification - COMPLETED

**Objective**: Prove the flow works on the local stack before calling the sprint done.

**TDD (full suite must already be green)**:
1. Run `npm test` with no new failing tests. If anything is red, fix it here — do not add hollow tests to force green
2. If a gap shows up (for example login 401 message drift between API and UI), write the failing test first, then fix

**Manual and build checks** (not a substitute for the suite):
1. Register a user, confirm the row in local D1 stores a hash not plaintext
2. Log in with the same credentials and land on `/mcqs`
3. Reject a duplicate username or email with 409
4. Reject a wrong password with 401 and a generic message
5. Log out and land on `/login`
6. Run `npm run lint` and `npm run build` and report the actual result

**Phase gate**: `npm test`, `npm run lint`, and `npm run build` all succeed. Manual happy path matches the tests.

**Recorded results (2026-08-25)**:
- `npm test`: **33 passed** (9 files)
- Local D1: 4 user rows; all `password_hash` values are 64-character lowercase hex (`sha256_hex_count = 4`, `non_hex_len_count = 0`). Query used counts and length only — do not `SELECT` hashes or emails into chat.
- User confirmed register → login (username or email) → `/mcqs` → logout → `/login` locally and on the deployed Worker
- `npm run lint`: exit 0 after removing unused `Request` param from logout `POST` (`src/app/api/auth/logout/handler.ts`)
- `npm run build`: first run compiled all 9 routes then aborted on Windows + Node v26.1.0 with `UV_HANDLE_CLOSING` / exit `3221226505` because `initOpenNextCloudflareForDev()` ran during `next build`. Guarded that init to `next dev` only in `next.config.ts`; retry **exit 0**

**Deliverables**:
- Green Vitest suite for all phases
- Manual path through register → MCQ stub → logout → login
- Lint and build results recorded in Current Status

---

## Technical Implementation Details

### Key Files

- `wrangler.jsonc` - D1 `DB` binding to database `quizmaker` (`e1314a07-8e95-486d-a39d-fb047c750849`)
- `migrations/0001_create_users.sql` - `users` table migration (applied locally only)
- `src/lib/hash-password.ts` - shared SHA-256 hex helper (browser + Workers)
- `src/lib/services/user.ts` - D1-backed create, find, update, delete
- `src/lib/auth/schemas.ts` - Zod schemas for register and login bodies
- `src/app/api/auth/register/route.ts` - register endpoint (re-exports `POST` from `handler.ts`)
- `src/app/api/auth/login/route.ts` - login endpoint (re-exports `POST` from `handler.ts`)
- `src/app/api/auth/logout/route.ts` - logout endpoint (re-exports `POST` from `handler.ts`)
- `src/app/page.tsx` - landing
- `src/app/register/page.tsx` - register page (shadcn signup-block layout)
- `src/app/login/page.tsx` - login page (shadcn login-block layout)
- `src/app/mcqs/page.tsx` - MCQ stub
- `src/components/signup-form.tsx` - register form (shadcn signup block, adapted fields)
- `src/components/login-form.tsx` - login form (shadcn login block; field label "Username or email")
- `next.config.ts` - Turbopack root pin; `initOpenNextCloudflareForDev()` only when `process.argv` includes `"dev"`
- `src/app/api/auth/*/handler.ts` - actual `POST` implementations (tests import these)
- `src/components/logout-button.tsx` - logout control
- `vitest.config.ts` - Vitest + jsdom + `@/` path resolution
- `src/lib/db/users-schema.test.ts` - migration and D1 binding contract
- `src/lib/hash-password.test.ts` - SHA-256 helper
- `src/lib/services/user.test.ts` - user service against mocked D1
- `src/app/api/auth/*/route.test.ts` - register, login, logout handlers
- `src/components/signup-form.test.tsx` - register UI
- `src/components/login-form.test.tsx` - login UI
- `src/components/logout-button.test.tsx` - logout UI

### Implementation Patterns

D1 access stays in `src/lib/`. Route handlers call the user service; they do not run SQL. Reach the binding with `getCloudflareContext()` from `@opennextjs/cloudflare`. Use numbered placeholders. Prefer `all()` and `results[0]` over `first()`.

```typescript
const { results } = await db
  .prepare(
    "SELECT id, first_name, last_name, username, email, password_hash FROM users WHERE username = ?1 COLLATE NOCASE OR email = ?1 COLLATE NOCASE",
  )
  .bind(identifier)
  .all<UserRow>();

const user = results[0];
```

Password hashing uses the Web Crypto API so the same helper runs in the browser and on Workers without a new hashing library:

```typescript
export async function hashPassword(plaintext: string): Promise<string> {
  const bytes = new TextEncoder().encode(plaintext);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

The client hashes, then POSTs. The server stores and compares that digest. It does not hash a second time in this sprint, so register and login stay symmetric.

```typescript
const passwordHash = await hashPassword(plaintextPassword);

await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password: passwordHash }),
});
```

User service shape (implementation may add private helpers):

```typescript
createUser(input: CreateUserInput): Promise<PublicUser>
findUserByUsername(username: string): Promise<UserRecord | null>
updateUser(id: string, input: UpdateUserInput): Promise<PublicUser>
deleteUser(id: string): Promise<void>
```

`findUserByUsername` may include `password_hash` for login comparison. Map to `PublicUser` before any HTTP response.

Implemented in `src/lib/services/user.ts`:
- Unique D1 constraint failures become `UserConflictError` (for 409 in Phase 3)
- Missing rows on update or delete become `UserNotFoundError`
- `getCloudflareContext({ async: true })` is used so the service works in App Router
- User-service tests mock that call with an in-memory `env.DB` (`src/lib/services/user.test.ts`)
- Login lookup is `username = ?1 COLLATE NOCASE OR email = ?1 COLLATE NOCASE` so teachers can sign in with either field from registration

App Router `route.ts` files must re-export from `handler.ts`. The Next.js TypeScript plugin treats `route.ts` as an entry and reports `Cannot find module './route'` from colocated tests.

```typescript
// src/app/api/auth/login/route.ts
export { POST } from "./handler";
```

```typescript
// src/app/api/auth/login/route.test.ts
import { POST } from "./handler";
```

Zod v4 email: use `.pipe(z.email())`, not deprecated `z.string().email()`. Over-the-wire `password` must match `/^[a-f0-9]{64}$/`. Form schemas validate plaintext (min 8); body schemas validate the digest.

```typescript
const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/);

export const registerBodySchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  username: z.string().trim().min(3).max(50),
  email: z.string().trim().pipe(z.email()),
  password: sha256Hex,
});

export const loginBodySchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: sha256Hex,
});
```

Known digest for the test password `password123` (SHA-256 hex):

```text
ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f
```

On Windows PowerShell, use `curl.exe` (not the `curl` alias):

```bash
curl.exe -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"dev123\",\"password\":\"ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f\"}"
```

Mock Cloudflare and D1 at the module boundary. Never open a real database in unit tests:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({
    env: { DB: mockDb },
  })),
}));
```

Stub `server-only` if a module imports it:

```typescript
vi.mock("server-only", () => ({}));
```

### Important Notes

- This is not a production auth system. SHA-256 without a salt is not a password KDF. The client-side hash is the secret that travels over the wire; HTTPS is still required in any real deployment.
- Do not import D1 or `getCloudflareContext()` into a `'use client'` module. Only the hashing helper is shared.
- Ask before adding a dependency other than those already authorized (Vitest packages, Zod). Zod `^4.4.3` is installed and used for auth request and form bodies.
- `npm run dev` runs on Node. `next.config.ts` calls `initOpenNextCloudflareForDev()` only when argv includes `"dev"`, which lets `getCloudflareContext()` reach local D1 during `next dev`. Still prefer `npm run preview` for Workers-faithful checks. Never treat a static page render as proof that D1 works.
- Never run `npx wrangler d1 migrations apply` with `--remote` unless the user explicitly asks.
- Never run `npm run deploy` unless the user explicitly asks.
- Logout cannot invalidate anything server-side in this sprint. That is intentional.
- A phase is not done when the code "looks right." It is done when that phase's Vitest tests were first red, then green, and `npm test` is green for the whole suite so far.
- Do not introduce `@cloudflare/vitest-pool-workers` in this sprint. Mock D1 instead.
- Pin `@vitejs/plugin-react` to v4. Latest v6 pulls a Babel 8 peer that conflicts with `shadcn`'s Babel 7 tree (`npm install` ERESOLVE).
- Schema, service, and route tests use `// @vitest-environment node`. UI tests use the default jsdom environment.
- Call `getCloudflareContext({ async: true })` in App Router server code.

### workers.dev, deploy, and local vs remote D1

This Worker has no custom domain. Public URL is:

```text
https://<worker-name>.<account-subdomain>.workers.dev
```

- Worker name is `"quizmaker"` in `wrangler.jsonc` (`name` field).
- Account subdomain is **one name for the whole Cloudflare account**, registered once. It is not the app name.
- Valid subdomain: lowercase `a-z`, `0-9`, hyphens; no `https://`; globally unique. CamelCase and taken names (`quizmaker`) fail.
- Register in Dashboard → Workers & Pages → **Your subdomain** → Change, then `npm run deploy`. Wrangler's `wrangler subdomain` CLI is deprecated.
- Skipping `workers.dev` requires `workers_dev: false` **and** a custom domain/route on a Cloudflare zone. Without that, first deploy cannot publish a public URL.
- `npm run deploy` = OpenNext build + Wrangler deploy. OpenNext warns Windows is unsupported; WSL is recommended. If `.open-next` delete hits `EPERM`, close processes using that folder and retry.
- Local D1 (`.wrangler/state/v3/d1`) and remote D1 are separate. Local `users` does not appear in production until `npx wrangler d1 migrations apply quizmaker --remote` (user runs this). Production register/login 500 with "no such table: users" means the remote migration was never applied.
- Inspect local hashes without dumping secrets:

```bash
npx wrangler d1 execute quizmaker --local --command "SELECT COUNT(*) AS user_count, SUM(CASE WHEN length(password_hash) = 64 AND password_hash GLOB '[0-9a-f]*' THEN 1 ELSE 0 END) AS sha256_hex_count FROM users;"
```

### next.config.ts (dev-only OpenNext init)

```typescript
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
};

export default nextConfig;

if (process.argv.includes("dev")) {
  initOpenNextCloudflareForDev();
}
```

Do not use top-level `await import()` in `next.config.ts` — Next's config loader (`require()` of compiled config) fails with `ERR_REQUIRE_ASYNC_MODULE`.

---

## Acceptance Criteria

- [x] A teacher can register with first name, last name, username, email, and password and is taken to `/mcqs`
- [x] Username and email may be the same value on a single account
- [x] The stored `password_hash` is a SHA-256 hex digest, not the plaintext password
- [x] The register and login POSTs send the hash, not the plaintext password
- [x] A teacher can log in with username **or email** and password and is taken to `/mcqs`
- [x] A duplicate username or email is rejected with 409 and a clear form error
- [x] POST /api/auth/register returns 409 when the user service throws UserConflictError
- [x] A wrong username or password is rejected with 401 and the same generic message
- [x] Missing or invalid fields are rejected with 400 before any write
- [x] Phase 3 route tests: red (missing route modules), then green (`npm test` 24 passed)
- [x] Logout from `/mcqs` calls `POST /api/auth/logout` and returns the teacher to `/login`
- [x] `/mcqs` is a stub only: no question CRUD
- [x] No cookies, tokens, or session records are created
- [x] The user service can create, update, and delete users even though update and delete have no public endpoints yet
- [x] User service create, find, update, and delete pass against a mocked D1 (`src/lib/services/user.test.ts`)
- [x] Each phase's Vitest tests were written first, failed for the intended reason, then passed after implementation
- [x] Phase 1 schema tests: red (no `DB` binding, no `migrations/`), then green after D1 + `0001_create_users.sql`
- [x] Phase 2 hashing and user-service tests: red (missing modules), then green (`npm test` 14 passed)
- [x] Phase 4 form tests: red (missing form modules), then green (`npm test` 31 passed)
- [x] `npm test` (Vitest) succeeds for schema, hashing, user service, auth routes, and auth UI
- [x] `npm run lint` and `npm run build` succeed

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Distinct teachers can register | At least 2 local accounts coexist | Two register calls; two rows in local D1 |
| Password never stored in plaintext | 0 plaintext password rows | Inspect `users.password_hash` after register |
| Auth happy path completes | Register or login reaches `/mcqs` without a manual URL edit | Manual walkthrough |
| Failed login does not leak account existence | Identical 401 body for unknown user and bad password | Compare both error responses |
| Sprint stays inside identity scope | 0 MCQ persistence or session features shipped | Code review of this sprint's diff |
| Auth unit tests stay green | `npm test` exits 0 | Vitest run at end of each phase and in Phase 5 |

---

## Dependencies

### External Dependencies

- Cloudflare D1 — user persistence (created, bound as `DB`, local migration applied)
- Web Crypto API — SHA-256 in the browser and on Workers
- Zod `^4.4.3` — request and form validation
- Vitest — unit test runner (installed; `npm test` / `npm run test:watch`)
- Testing Library + jsdom — client-component tests

### Internal Dependencies

- `@opennextjs/cloudflare` `getCloudflareContext()` — access `env.DB`
- `src/lib/` service pattern — keep SQL out of route handlers and client components
- shadcn/ui `button`, `card`, `field`, `input`, `label` — auth forms
- Next.js App Router — pages under `src/app/` and route handlers under `src/app/api/`
- `.cursor/skills/testing/SKILL.md` — Vitest setup, colocation, mocking, and what makes a test worth writing

### Environment

- `wrangler.jsonc` `d1_databases` binding named `DB`
- No new secrets are required for this sprint
- If a variable is added later, put the local value in `.dev.vars` and an empty placeholder in `.dev.vars.example`

---

## Risks and Mitigation

### Technical Risks

- **Risk**: `npm run dev` hides Workers-only failures, or `initOpenNextCloudflareForDev()` during `next build` aborts Windows + Node 26 with `UV_HANDLE_CLOSING`.
- **Mitigation**: Init OpenNext for `next dev` only (`next.config.ts`). Verify with `npm run preview` when Workers behavior matters. Apply the migration locally.

- **Risk**: Mixing `?` and `?1` placeholders causes local Wrangler binding errors.
- **Mitigation**: Use numbered placeholders only.

- **Risk**: Client-side SHA-256 makes the hash the effective password; a leaked hash is enough to log in.
- **Mitigation**: Accepted for this sprint. Document it. A later sprint can add a salted KDF, HTTPS-only deploy, and sessions.

- **Risk**: Unique-constraint errors from D1 may surface as generic 500s.
- **Mitigation**: `UserConflictError` in the user service; register handler maps it to 409.

- **Risk**: Tests are written after the code and never fail, or they assert internals that do not prove behavior.
- **Mitigation**: Each phase starts with `npm test` red. Assert HTTP status, returned JSON, `fetch` bodies, and what the user can see. Mock D1 and navigation; do not hit a real database.

- **Risk**: Login 401 after a successful register when the teacher types their email.
- **Mitigation**: `findUserByUsername` matches `username` **or** `email` with `COLLATE NOCASE`. Covered in `src/lib/services/user.test.ts`.

### User Experience Risks

- **Risk**: Teachers expect to stay logged in after a refresh and will think login is broken.
- **Mitigation**: Copy on `/mcqs` can stay minimal; do not imply a lasting session. Sessions are a later sprint.

- **Risk**: Hashing before POST can look like the app "changed" the password if a teacher inspects the network tab.
- **Mitigation**: Expected. Keep the UI language as "password"; do not show the digest.

- **Risk**: Username vs email confusion on login.
- **Mitigation**: Login field is labeled "Username or email". The API `username` property accepts either stored value.

---

## Troubleshooting Guide

### D1 binding is undefined
**Problem**: Register or login throws when reading `env.DB`.
**Cause**: The database was not created, `wrangler.jsonc` has no `DB` binding, or types were not regenerated.
**Solution**: Create the D1 database, add the binding, run `npm run cf-typegen`, apply the migration locally.
**Code Reference**: `wrangler.jsonc`, `.cursor/rules/d1.mdc`

### Migration not visible locally
**Problem**: Queries fail with "no such table: users".
**Cause**: Migration created but not applied with `--local`.
**Solution**: `npx wrangler d1 migrations apply <db> --local`. Never use `--remote`.

### Unique username/email returns 500
**Problem**: A second register with the same username or email is a server error.
**Cause**: The SQLite constraint error was not mapped.
**Solution**: Catch the constraint failure in the service or route and respond with 409.

### Login always fails after a successful register
**Problem**: 401 on the same credentials just used to register.
**Cause**: Client hashed for one call and sent plaintext for the other, or the server hashed a second time only on one path.
**Solution**: Use the same helper and the same "hash once on the client, compare stored digest" rule on both paths.

### Password visible in the network tab as plaintext
**Problem**: The POST body contains the typed password.
**Cause**: The form submitted before hashing, or the hash helper was skipped on error-retry.
**Solution**: Hash in the submit handler and send only the hex digest. The register/login form tests must fail if `fetch` is called with plaintext.

### Vitest cannot resolve `@/` imports
**Problem**: Tests fail with "Cannot find module '@/lib/...'".
**Cause**: `vite-tsconfig-paths` is missing from `vitest.config.ts`.
**Solution**: Add the plugin as in the testing skill. Do not rewrite imports to relative paths just to make tests run.

### `npm install` fails on `@vitejs/plugin-react` peer deps
**Problem**: `ERESOLVE` between `@vitejs/plugin-react` v6 (Babel 8) and `shadcn` (Babel 7).
**Cause**: Unpinned `plugin-react` installs v6.
**Solution**: Stay on `@vitejs/plugin-react@4` as in `package.json`.
**Code Reference**: `package.json`

### Login 401 when using email after register
**Problem**: Signup works; login with the same email returns 401.
**Cause**: Lookup was `WHERE username = ?1` only. Teachers often type the email.
**Solution**: `WHERE username = ?1 COLLATE NOCASE OR email = ?1 COLLATE NOCASE` in `findUserByUsername`. Label the field "Username or email".
**Code Reference**: `src/lib/services/user.ts`, `src/components/login-form.tsx`

### `Cannot find module './route'` from colocated tests
**Problem**: Typecheck fails when a test imports `POST` from `./route`.
**Cause**: Next.js TypeScript plugin treats App Router `route.ts` as an isolated entry.
**Solution**: Put `POST` in `handler.ts`, re-export from `route.ts`, import `./handler` in tests.
**Code Reference**: `src/app/api/auth/login/route.ts`, `src/app/api/auth/login/handler.ts`

### workers.dev subdomain prompt loops on deploy
**Problem**: `Would you like to register a workers.dev subdomain now?` rejects every name.
**Cause**: Account has no `workers.dev` subdomain yet. Typed values were a full URL, CamelCase, or a name already taken globally (`quizmaker`).
**Solution**: Register a unique lowercase name (e.g. `bhaskarm-quiz`) in Dashboard → Workers & Pages → Your subdomain, then `npm run deploy` again. Do not include `https://`.

### Production register/login 500 after deploy
**Problem**: Live Worker returns 500; local works.
**Cause**: Remote D1 has no `users` table. Local `--local` migration does not apply remotely.
**Solution**: User runs `npx wrangler d1 migrations apply quizmaker --remote`. Agents must not run `--remote` unless asked.

### `npm run build` abort `UV_HANDLE_CLOSING` on Windows
**Problem**: Next prints the route table then exits `3221226505` (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`).
**Cause**: Node 26 on Windows + `initOpenNextCloudflareForDev()` during `next build` leaves Miniflare handles open at process exit (nodejs/node#56645).
**Solution**: Call `initOpenNextCloudflareForDev()` only when `process.argv.includes("dev")`. Do not use top-level await in `next.config.ts`.
**Code Reference**: `next.config.ts`

### OpenNext `EPERM` deleting `.open-next` on Windows
**Problem**: `npm run deploy` fails `rmSync` on `.open-next`.
**Cause**: Another process has the folder open; OpenNext on Windows is unsupported.
**Solution**: Close the preview/dev process using that folder and retry. Prefer WSL for OpenNext builds.

### PowerShell `curl` posts nothing useful
**Problem**: API curl examples fail or hit a help page.
**Cause**: PowerShell aliases `curl` to `Invoke-WebRequest`.
**Solution**: Use `curl.exe`.

### `getCloudflareContext` throws in unit tests
**Problem**: User service tests fail before any assertion.
**Cause**: jsdom has no Cloudflare context.
**Solution**: `vi.mock("@opennextjs/cloudflare")` and supply a fake `env.DB`. Do not switch the suite to `vitest-pool-workers` in this sprint.

---

## Notes for AI Agents

When working with this PRD:

1. Start by reading the Problem and Hypothesis to understand intent
2. Use Scope (In/Out/Cut) to determine boundaries — do not build out-of-scope items
3. Update phase status markers as work progresses
4. Add implementation details under "Technical Implementation Details" as code is written
5. Mark acceptance criteria as complete when features work
6. Add troubleshooting entries when bugs are found and fixed
7. Keep all sections current - remove outdated information
8. Use code references format: `filepath:line-number` when citing code
9. Ask before adding a dependency other than Vitest packages and Zod (already added)
10. Do not apply D1 migrations remotely and do not deploy unless the user explicitly asks. This account already has a `workers.dev` subdomain and a deployed `quizmaker` Worker; still wait for the ask.
11. Do not add cookies, tokens, sessions, or MCQ persistence in this sprint
12. Follow TDD per phase: write tests, run them red, implement, run them green. Do not mark a phase COMPLETED while its tests are missing or failing
13. Follow `.cursor/skills/testing/SKILL.md`: colocate tests, mock D1, never write assertions that cannot fail
14. Stay on `feature/register-login-logout` unless asked otherwise. Do not create new migrations unless asked.
15. Auth tests import `POST` from `./handler`, never from `./route`
16. Login identifier is username **or** email (`COLLATE NOCASE`). Do not revert to username-only lookup.
17. Keep `initOpenNextCloudflareForDev()` behind the `next dev` argv guard in `next.config.ts`

---

## Current Status

**Last Updated**: 2026-08-25
**Current Phase**: Phase 5 - Verification
**Status**: COMPLETED
**Branch**: `feature/register-login-logout`

**Verification**:
- `npm test`: 33 passed (9 files)
- `npm run lint`: exit 0
- `npm run build`: exit 0 (after `next.config.ts` OpenNext init guard)
- Local D1: 4 users, all `password_hash` values 64-char lowercase hex
- User confirmed the same flows locally and on the deployed Worker

**Next Steps**: This sprint is done. Later work can add sessions/cookies and the MCQ bank. Do not create migrations or deploy unless asked.
