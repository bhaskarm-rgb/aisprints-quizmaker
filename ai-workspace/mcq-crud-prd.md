Date created: 2026-08-30
Date last modified: 2026-08-30

# MCQ Create, Update, and Delete - Technical PRD

## Overview/Problem

The previous sprint gave QuizMaker teachers an identity: they can register, log in, and log out. It left `/mcqs` as a stub page that says the question bank will arrive later. That later is now. A teacher who signs in today has nowhere to put a question, so the product still does nothing useful once you are past the login screen. This sprint turns the stub into a working question bank: list, create, edit, preview, and delete multiple-choice questions, and record what a teacher answered when they preview one.

---

## Hypothesis

We believe that a table-driven question bank with a dedicated create/edit page will let a teacher build and maintain real multiple-choice questions in QuizMaker, without waiting on sessions, sharing, or quiz assembly.

---

## Scope

### In Scope

- Three D1 tables: `mcqs`, `mcq_choices`, `mcq_attempts`, with a single local migration
- An MCQ carries a short `name` used to find it in the bank and a separate `question` holding the prompt the student reads
- An MCQ service that creates, lists, reads, updates, and deletes questions together with their choices
- An attempt service that records which choice a user picked and whether it was correct
- HTTP endpoints for MCQ list, create, read, update, delete, and attempt recording
- `/mcqs` rebuilt as a shadcn `Table` of questions with name, question, and an actions column
- A three-dot (ellipsis) dropdown per row offering Edit, Preview, and Delete
- A create/edit page at `/mcqs/new` and `/mcqs/[id]/edit` with Save and Cancel
- Two choice rows shown by default, expandable to a maximum of six
- A preview page at `/mcqs/[id]/preview` that shows the question as a student sees it and records an attempt
- A `localStorage` current-user helper so `created_by_user_id` and `mcq_attempts.user_id` hold real foreign keys
- Test-driven implementation with Vitest: every phase starts red and is not done until green

### Out of Scope

- Quizzes, question sets, tags, or categories
- Sharing, permissions, or "only the author may edit" rules
- Attempt history views, scoring dashboards, or analytics
- Search, filtering, pagination, or sorting on the question bank table
- Images, rich text, or math notation in questions and choices
- Sessions, cookies, or tokens
- Remote D1 migration apply as a phase gate (deploy per sprint rule 3 is a separate, explicit step)

### Cut

- Multi-select questions (more than one correct choice) — the attempt model stays a simple correct/incorrect check; revisit when a question type system exists
- Soft delete via `deleted_at` — attempt history is not yet surfaced anywhere, so preserving it has no user-visible payoff
- Blocking deletion of questions that already have attempts — same reason; a confirmation dialog is enough friction for now
- Server-derived identity from a session cookie — that is its own sprint; this one sends `userId` from the client
- Drag-to-reorder choices — position is stored so ordering is stable, but reordering is a later nicety
- `sonner` toasts — errors surface inline through the shadcn `Field` pattern already used by the auth forms

---

## Technical Requirements

### Database Schema

One new migration, `migrations/0002_create_mcqs.sql`, applied **locally** only. Do not apply it remotely unless the user asks.

```sql
CREATE TABLE mcqs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mcq_choices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL REFERENCES mcqs(id) ON DELETE CASCADE,
  choice_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (mcq_id, position)
);

CREATE TABLE mcq_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL REFERENCES mcqs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  choice_id TEXT NOT NULL REFERENCES mcq_choices(id) ON DELETE CASCADE,
  is_correct INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcq_choices_mcq_id ON mcq_choices(mcq_id);
CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts(mcq_id);
CREATE INDEX idx_mcq_attempts_user_id ON mcq_attempts(user_id);
```

`mcqs.name` is a short label a teacher uses to find the question in the bank. `mcqs.question` is the prompt the student reads. Both are required.

`is_correct` is SQLite `INTEGER` (0/1); the service maps it to and from a TypeScript `boolean`. Exactly one choice per question must be correct — SQLite cannot express that, so the **service layer enforces it** and rejects anything else.

`UNIQUE (mcq_id, position)` keeps choice order stable. Update replaces all choices for a question (delete then re-insert) inside one `db.batch()`, so positions never collide mid-write.

The `ON DELETE CASCADE` clauses are declared, but the service **also deletes children explicitly** in the same batch. D1 foreign-key enforcement depends on `PRAGMA foreign_keys` state, and correctness should not.

### API Endpoints

Handlers live in `handler.ts`, with `route.ts` as a one-line re-export, matching the auth sprint. Every body is validated with Zod before it reaches the database. Dynamic segments arrive as a Promise in Next 16: `context: { params: Promise<{ id: string }> }`.

#### GET /api/mcqs

Lists every question in the shared bank, newest first. No choices in the payload.

**Response:**
- Success (200): `{ "mcqs": [{ "id": "...", "name": "...", "question": "...", "choiceCount": 4, "createdAt": "...", "updatedAt": "..." }] }`
- Error (500): unexpected server error

#### POST /api/mcqs

Creates a question and its choices in one call.

**Request Body:**
```json
{
  "name": "Closest planet to the Sun",
  "question": "Which planet is closest to the Sun?",
  "userId": "<id of the logged-in user>",
  "choices": [
    { "text": "Mercury", "isCorrect": true },
    { "text": "Venus", "isCorrect": false }
  ]
}
```

**Response:**
- Success (201): the created question with its choices
- Error (400): validation failure — empty name, empty question, fewer than 2 or more than 6 choices, an empty choice, or a correct-choice count other than 1
- Error (404): `userId` does not match a row in `users`
- Error (500): unexpected server error

#### GET /api/mcqs/[id]

Returns one question with its choices ordered by `position`.

**Response:**
- Success (200): `{ "id": "...", "name": "...", "question": "...", "choices": [{ "id": "...", "text": "...", "isCorrect": true, "position": 0 }] }`
- Error (404): no question with that id
- Error (500): unexpected server error

#### PUT /api/mcqs/[id]

Replaces name, question, and the full set of choices. Same body as POST minus `userId` (authorship does not change on edit).

**Response:**
- Success (200): the updated question with its choices
- Error (400): same validation rules as create
- Error (404): no question with that id
- Error (500): unexpected server error

#### DELETE /api/mcqs/[id]

Deletes the question, its choices, and its attempts.

**Response:**
- Success (200): `{ "ok": true }`
- Error (404): no question with that id
- Error (500): unexpected server error

#### POST /api/mcqs/[id]/attempts

Records one preview submission. The server decides correctness by reading the chosen row — it never trusts an `isCorrect` value from the client.

**Request Body:**
```json
{
  "userId": "<id of the logged-in user>",
  "choiceId": "<id of the selected choice>"
}
```

**Response:**
- Success (201): `{ "id": "...", "mcqId": "...", "choiceId": "...", "isCorrect": true }`
- Error (400): validation failure, or `choiceId` does not belong to this question
- Error (404): unknown question or unknown user
- Error (500): unexpected server error

### User Interface Requirements

Continue with shadcn/ui and the existing `base-nova` style and `globals.css` tokens. Four registry components are still needed and must be added with the shadcn CLI, not hand-written: `dropdown-menu`, `textarea`, `radio-group`, `alert-dialog`. These come from the shadcn registry and are not new npm dependencies. `table`, `button`, `card`, `field`, `input`, `label`, `badge`, and `separator` are already installed.

Keep interactive pieces in `'use client'` components so Testing Library can render them. Surface errors through `FieldError` as the auth forms do. Do not add `react-hook-form`.

#### Question bank (/mcqs)
- Replaces the stub; keeps the "Question Bank" heading and the existing logout control
- "Create question" button routes to `/mcqs/new`
- shadcn `Table` with columns: Name, Question, Choices, Actions
- Actions column is a three-dot vertical ellipsis (`MoreVertical` from lucide) opening a `DropdownMenu` with Edit, Preview, and Delete
- Edit routes to `/mcqs/[id]/edit`, Preview to `/mcqs/[id]/preview`
- Delete opens an `AlertDialog`; confirming calls `DELETE /api/mcqs/[id]` and refreshes the list
- Empty state: a short line plus the same create call to action

#### Create and edit (/mcqs/new, /mcqs/[id]/edit)
- One shared `McqForm` component; edit mode preloads via `GET /api/mcqs/[id]`
- Fields: Name (`Input`, required, 1–200 characters), Question (`Textarea`, required, 1–1000 characters)
- Choices: two empty rows on a new question, "Add choice" up to six, remove down to two
- Each choice is a text `Input` plus a `RadioGroup` selection marking the single correct answer
- Client validation before submit: name non-empty, question non-empty, every visible choice non-empty, exactly one correct
- Save POSTs (create) or PUTs (edit), then routes back to `/mcqs`
- Cancel routes back to `/mcqs` without writing
- Create reads the current user from `localStorage` and sends `userId`; if none is stored, show a form-level error and send the teacher to `/login`

#### Preview (/mcqs/[id]/preview)
- Shows the `question` prompt and its choices as a student sees them, with no correct-answer hint before submission. The `name` is a teacher-facing label and is not shown as the prompt
- `RadioGroup` selection plus a Submit button
- Submit POSTs `/api/mcqs/[id]/attempts` with `userId` and `choiceId`
- After the response, reveal whether the answer was correct and offer a link back to `/mcqs`
- Correctness comes from the server response, never computed in the browser

#### Current user
- `src/lib/current-user.ts` with `setCurrentUser`, `getCurrentUser`, and `clearCurrentUser` over `localStorage`
- `LoginForm` and `SignupForm` call `setCurrentUser` on success; `LogoutButton` calls `clearCurrentUser`
- This is the only change to auth-sprint code in this sprint

---

## Test-Driven Development

Same discipline as the auth sprint. Every phase is red → green. Do not write production code for a phase until that phase's tests exist and have been run failing for the right reason.

**Framework**: Vitest, already installed and configured (`vitest.config.ts`, `npm test`). No new test tooling. Do not introduce `@cloudflare/vitest-pool-workers`.

**Cycle for each phase**:
1. Write the phase's colocated `*.test.ts` / `*.test.tsx` first
2. Run `npm test` and confirm the new tests fail for the intended reason — missing module, wrong status, unmet behavior — not a broken test
3. Implement the minimum production code to turn them green
4. Re-run `npm test`; the phase is incomplete until new tests pass and all 33 existing auth tests stay green
5. Assert observable results — HTTP status, returned JSON, SQL bound values, what the user sees — not mock call order

**What unit tests must not do**: reach a real D1 database or network; render Server Components with Testing Library; rebuild the D1 prepared-statement chain in every file. Mock `@opennextjs/cloudflare` at the module boundary with a fake `env.DB`, as `src/lib/services/user.test.ts` already does. Schema, service, and route tests use `// @vitest-environment node`; UI tests use the default jsdom.

---

## Implementation Phases

Each phase ends with: green suite, commit, push, deploy, and the hash reported back. Do not start the next phase without an explicit go-ahead.

### Phase 1: MCQ schema - COMPLETED

**Objective**: Add the three tables to local D1.

**TDD (write first — expect red)**: `src/lib/db/mcqs-schema.test.ts` asserts a `migrations/` file creates `mcqs`, `mcq_choices`, and `mcq_attempts`; that `mcqs` has `name`, `question`, and `created_by_user_id` referencing `users`; that `mcq_choices` has `mcq_id`, `choice_text`, `is_correct`, and `position` with `ON DELETE CASCADE`; and that `mcq_attempts` has `mcq_id`, `user_id`, `choice_id`, and `is_correct`.

**Implement**: Write `migrations/0002_create_mcqs.sql`, apply it locally only, re-run the suite.

**Phase gate**: Schema tests green; auth tests still green.

### Phase 2: MCQ service - COMPLETED

**Objective**: Own all MCQ and choice SQL in one module.

**TDD (write first — expect red)**: `src/lib/services/mcq.test.ts` against a mocked D1 — create persists the question and its choices with correct positions; create rejects fewer than 2, more than 6, or a correct count other than 1; list returns summaries with `choiceCount`; get returns choices ordered by position and `null` for an unknown id; update replaces the choice set; delete removes question, choices, and attempts; a missing row raises `McqNotFoundError`.

**Implement**: `src/lib/services/mcq.ts` mirroring `user.ts` — `getCloudflareContext({ async: true })`, `?1` placeholders, snake-to-camel mappers, `db.batch()` for multi-statement writes.

**Phase gate**: Service tests green; prior tests green.

### Phase 3: MCQ API - COMPLETED

**Objective**: Expose list, create, read, update, and delete over HTTP.

**TDD (write first — expect red)**: Route tests importing `POST`/`GET`/`PUT`/`DELETE` from `./handler` with the service mocked — happy paths return 200/201 with the expected JSON; bad bodies return 400 with no service call; unknown ids return 404; an unknown `userId` on create returns 404.

**Implement**: `src/lib/mcq/schemas.ts` (Zod) plus handlers under `src/app/api/mcqs/`, with `route.ts` re-exports and the auth sprint's error-mapping style.

**Phase gate**: Route tests green; prior tests green.

### Phase 4: Attempts - COMPLETED

**Objective**: Record and score a single answer server-side.

**TDD (write first — expect red)**: Service tests — an attempt stores the selected choice and derives `is_correct` from the stored row, rejects a `choiceId` belonging to a different question, and rejects an unknown user. Route tests — 201 with the scored result, 400 for a mismatched choice, 404 for unknown question or user.

**Implement**: `recordAttempt` in the MCQ service (or `src/lib/services/attempt.ts`) plus `src/app/api/mcqs/[id]/attempts/handler.ts`.

**Phase gate**: Attempt tests green; prior tests green.

### Phase 5: Question bank table - COMPLETED

**Objective**: Replace the stub with a real list.

**TDD (write first — expect red)**: `src/lib/current-user.test.ts` for the `localStorage` helper. `src/components/mcq-table.test.tsx` — renders a row per question with name and question text; the ellipsis trigger opens a menu with Edit, Preview, Delete; Delete opens a confirmation and only calls `DELETE` after confirming; cancelling calls nothing; the empty state renders when there are no questions.

**Implement**: Add the `dropdown-menu` and `alert-dialog` shadcn components, `src/lib/current-user.ts`, `src/components/mcq-table.tsx`, and rebuild `src/app/mcqs/page.tsx`. Wire `setCurrentUser` into the login and signup forms and `clearCurrentUser` into logout.

**Phase gate**: Table and current-user tests green; prior tests green.

### Phase 6: MCQ editor - COMPLETED

**Objective**: Create and edit questions in the browser.

**TDD (write first — expect red)**: `src/components/mcq-form.test.tsx` — renders two empty choice rows by default; "Add choice" stops at six; remove stops at two; submit is blocked with no `fetch` when the name is empty, the question is empty, a choice is empty, or no correct answer is selected; a valid create POSTs `/api/mcqs` with `userId` and the choice array and then navigates to `/mcqs`; edit mode preloads existing values and PUTs; Cancel navigates without any `fetch`; a missing stored user shows an error instead of posting.

**Implement**: Add the `textarea` and `radio-group` shadcn components, `src/components/mcq-form.tsx`, `src/app/mcqs/new/page.tsx`, and `src/app/mcqs/[id]/edit/page.tsx`.

**Phase gate**: Editor tests green; prior tests green.

### Phase 7: Preview and attempts UI - COMPLETED

**Objective**: Answer a question and see the result.

**TDD (write first — expect red)**: `src/components/mcq-preview.test.tsx` — renders the `question` prompt and its choices with no correct-answer marking before submission; Submit is disabled until a choice is selected; Submit POSTs `userId` and `choiceId`; the result message follows the server's `isCorrect`, including the case where the server says wrong while the client picked the visually first option.

**Implement**: `src/components/mcq-preview.tsx` and `src/app/mcqs/[id]/preview/page.tsx`.

**Phase gate**: Preview tests green; prior tests green.

### Phase 8: Verification - PLANNED

**Objective**: Prove the whole loop before calling the sprint done.

**Checks**: Full `npm test` green with no hollow tests; `npm run lint` and `npm run build` exit 0; manual walkthrough of login → create → list → edit → preview → delete; local D1 row counts confirm cascade deletion left no orphan choices or attempts.

**Phase gate**: All three commands succeed and the manual path matches the tests.

---

## Technical Implementation Details

### Key Files

- `migrations/0002_create_mcqs.sql` - the three MCQ tables (applied locally)
- `src/lib/db/mcqs-schema.test.ts` - migration contract for `mcqs`, `mcq_choices`, and `mcq_attempts`
- `src/lib/services/mcq.ts` - create, list, get, update, delete, and `recordAttempt`
- `src/lib/services/mcq.test.ts` - mocked D1 tests for the MCQ service
- `src/lib/mcq/schemas.ts` - Zod bodies for create, update, and attempt
- `src/app/api/mcqs/handler.ts` - GET list and POST create
- `src/app/api/mcqs/[id]/handler.ts` - GET, PUT, and DELETE one question
- `src/app/api/mcqs/[id]/attempts/handler.ts` - POST record an attempt
- `src/lib/current-user.ts` - `window.localStorage` helper for the logged-in user
- `src/test/setup.ts` - jsdom `localStorage` polyfill for Vitest on Node 26
- `src/components/mcq-table.tsx` - question bank table, actions menu, delete confirmation
- `src/components/mcq-bank.tsx` - fetches `/api/mcqs` and feeds the table
- `src/app/mcqs/page.tsx` - question bank page
- `src/app/mcqs/new/page.tsx` - create page
- `src/app/mcqs/[id]/edit/page.tsx` - edit page (loads via GET)
- `src/components/mcq-form.tsx` - shared create/edit form
- `src/app/mcqs/[id]/preview/page.tsx` - preview page
- `src/components/mcq-preview.tsx` - student-facing preview; correctness comes from the attempt API
- Colocated `*.test.ts` / `*.test.tsx` beside each of the above

### Implementation Patterns

Multi-table writes go through `db.batch()`, which D1 runs as one transaction:

```typescript
await db.batch([
  db.prepare("DELETE FROM mcq_choices WHERE mcq_id = ?1").bind(mcqId),
  ...choices.map((choice, index) =>
    db
      .prepare(
        "INSERT INTO mcq_choices (mcq_id, choice_text, is_correct, position) VALUES (?1, ?2, ?3, ?4)",
      )
      .bind(mcqId, choice.text, choice.isCorrect ? 1 : 0, index),
  ),
]);
```

Choice-count and correct-count rules live in the service so they hold no matter which caller writes:

```typescript
if (choices.length < 2 || choices.length > 6) {
  throw new McqValidationError("A question needs between 2 and 6 choices");
}
if (choices.filter((choice) => choice.isCorrect).length !== 1) {
  throw new McqValidationError("Exactly one choice must be correct");
}
```

Dynamic route handlers await `params` in Next 16:

```typescript
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
}
```

### Important Notes

- The client sends `userId`; the server only checks that the user exists. Anyone can post any id. That is a known hole, accepted for this sprint, closed by a future sessions sprint.
- Attempt correctness is read from `mcq_choices` server-side. Never accept `isCorrect` from the request body.
- Keep D1 out of `'use client'` modules. Client components talk to the API with `fetch`.
- Add shadcn components with the CLI so they land in `src/components/ui/` with project tokens. Ask before adding any npm dependency.
- Never run `wrangler d1 migrations apply --remote` and never run `npm run deploy` unless the user asks. Deploys happen per sprint rule 3, at the end of each phase, on request.
- Long troubleshooting notes go in `ai-workspace/mcq-crud_runbook.md`, not here.

---

## Acceptance Criteria

- [ ] A teacher can create a question with a name, a question prompt, and 2–6 choices
- [ ] Name and question are both required; an empty either one is rejected before the write
- [ ] Exactly one choice must be marked correct; anything else is rejected before the write
- [ ] Adding a seventh choice is not possible, and removing below two is not possible
- [ ] `/mcqs` lists every question with name, question, and choice count
- [ ] Each row's three-dot menu offers Edit, Preview, and Delete
- [ ] Edit preloads the existing question and its choices and saves changes with PUT
- [ ] Cancel leaves the question unchanged
- [ ] Delete asks for confirmation, then removes the question, its choices, and its attempts
- [ ] Preview shows the question without revealing the answer, and reveals correctness only after submit
- [ ] Submitting a preview writes a row to `mcq_attempts` with the selected choice and server-derived correctness
- [ ] `mcqs.created_by_user_id` and `mcq_attempts.user_id` hold real ids from the `users` table
- [ ] Invalid bodies return 400 and unknown ids return 404, with no partial writes
- [ ] Each phase's tests were written first, ran red for the intended reason, then went green
- [ ] The 33 existing auth tests stay green throughout
- [ ] `npm test`, `npm run lint`, and `npm run build` all succeed

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| A question round-trips | Create → list → edit → save shows the edit | Manual walkthrough |
| Choices persist correctly | Choice count and order match what was entered | Query local D1 by `mcq_id` ordered by `position` |
| Exactly one correct answer | 0 questions with a correct count other than 1 | `GROUP BY mcq_id HAVING SUM(is_correct) != 1` returns no rows |
| Attempts are scored server-side | Wrong answers record `is_correct = 0` | Submit a known-wrong preview, inspect the row |
| Delete leaves no orphans | 0 choices or attempts without a parent question | Row counts before and after a delete |
| Suite stays green | `npm test` exits 0 at every phase gate | Vitest run per phase |

---

## Dependencies

### External Dependencies

- Cloudflare D1 — MCQ persistence via the existing `DB` binding
- Zod `^4.4.3` — request body validation
- Vitest, Testing Library, jsdom — already installed

### Internal Dependencies

- `src/lib/services/user.ts` — user existence check for the `userId` foreign keys
- `@opennextjs/cloudflare` `getCloudflareContext()` — reach `env.DB`
- shadcn/ui: existing `table`, `button`, `card`, `field`, `input`, `label`; new `dropdown-menu`, `textarea`, `radio-group`, `alert-dialog`
- `.cursor/skills/testing/SKILL.md` — colocation, mocking, and what makes a test worth writing
- `ai-workspace/register-login-logout_prd.md` — the service, handler, and Zod patterns this sprint copies

### Environment

- No new bindings, secrets, or environment variables

---

## Risks and Mitigation

### Technical Risks

- **Risk**: `userId` arrives from `localStorage`, so a caller can claim to be any user.
- **Mitigation**: Accepted and documented. The server still validates the user exists so foreign keys stay sound. A sessions sprint replaces this.

- **Risk**: A create or update writes the question but fails partway through the choices, leaving a question with no answers.
- **Mitigation**: All multi-statement writes go through `db.batch()`, which D1 runs as a single transaction.

- **Risk**: Cascade deletes silently do nothing if D1 has foreign-key enforcement off, orphaning choices and attempts.
- **Mitigation**: The service deletes children explicitly in the same batch. A service test asserts the child deletes are issued.

- **Risk**: Replacing choices on update collides with `UNIQUE (mcq_id, position)`.
- **Mitigation**: Delete all choices for the question first, then insert, in one batch.

- **Risk**: The dropdown and alert-dialog components are hard to drive in jsdom, tempting hollow tests.
- **Mitigation**: Query by role and accessible name with `userEvent`. If a menu genuinely cannot open in jsdom, extract the action handlers and test those directly rather than asserting nothing.

### User Experience Risks

- **Risk**: A teacher whose `localStorage` was cleared hits an error on save and loses their typed question.
- **Mitigation**: Check for a stored user before submitting, show a form-level message, and keep the form filled rather than navigating away mid-edit.

- **Risk**: Delete is irreversible and sits one click from Edit in the same menu.
- **Mitigation**: A confirmation dialog naming the question, with the destructive action styled as such.

- **Risk**: Preview looks like a real quiz-taking mode and teachers expect scores to be reported somewhere.
- **Mitigation**: Keep the copy explicit that this is a preview. Attempt history has no UI this sprint, by design.

---

## Troubleshooting Guide

Populate as issues surface. Anything longer than a few lines belongs in `ai-workspace/mcq-crud_runbook.md`.

### Node 26 `localStorage` is undefined in Vitest
**Problem**: `localStorage.clear()` throws `Cannot read properties of undefined`.
**Cause**: Node 26 exposes a global `localStorage` that is undefined unless `--localstorage-file` is set, and that shadows jsdom's storage.
**Solution**: Use `window.localStorage` in app code. Polyfill it in `src/test/setup.ts` for jsdom tests.
**Code Reference**: `src/lib/current-user.ts`, `src/test/setup.ts`

---

## Notes for AI Agents

When working with this PRD:

1. Read the Problem and Hypothesis first, then Scope, and build nothing outside In Scope
2. Follow TDD per phase: tests first, run them red, implement, run them green. Never mark a phase COMPLETED while its tests are missing or failing
3. One phase at a time. Stop for review after each. Commit, push, deploy, and report the hash before starting the next
4. A bug fix gets its own commit that touches only that issue
5. Work on `feature/mcq-crud`, branched from `feature/register-login-logout`
6. Mirror the existing patterns: services in `src/lib/services/`, `handler.ts` with a `route.ts` re-export, Zod on every body, numbered `?1` placeholders
7. Do not apply migrations with `--remote` and do not run `npm run deploy` unless asked
8. Add shadcn components with the CLI. Ask before adding any npm dependency
9. Do not add sessions, cookies, or tokens in this sprint
10. Update phase status markers and acceptance checkboxes as work lands
11. Use `filepath:line-number` when citing code

---

## Current Status

**Last Updated**: 2026-08-31
**Current Phase**: Phase 7 - Preview and attempts UI
**Status**: COMPLETED
**Branch**: `feature/mcq-crud`

**Verification**:
- Preview tests: red (missing `./mcq-preview`), then green
- `npm test`: 94 passed (18 files)

**Next Steps**: Await confirmation to commit, push, and deploy Phase 7. Then Phase 8 (verification).
