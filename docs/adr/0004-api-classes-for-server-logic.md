# Server Logic Lives in Per-Request API Classes

Every `createServerFn` in `src/api` used to repeat the same scaffolding: a role check, a `try`/`catch` that logged and rethrew, an inline Prisma transaction, a hand-written `Transaction` journal row, and a notification call. The scaffolding outweighed the logic (`createAppointment` ~65 lines, `updateAppointment` ~90), and nothing stopped a new function from forgetting a step.

We moved the logic into one class per aggregate, `src/api/<aggregate>.server.ts` (`AppointmentsApi`, ...), instantiated per request with a context `{ db, user | null, notifier }` built by a shared context builder. The server functions stay in `src/api/<aggregate>.ts` as validator-plus-one-line handlers (`run(Api, m.some_message, (api) => api.method(data))`), so exported names and the ~39 consumers do not change. A shared `ApiBase` enforces a per-class `static policy` table (`PUBLIC` / `AUTHENTICATED` / `EDITOR` / `ADMIN`, exhaustive via `satisfies`) and is the single place that logs unexpected errors and translates them into a generic message; expected failures are a small `ApiError` family (`ForbiddenError`, `NotFoundError`, conflict). Methods return plain data; the handler adds the localized success message. Classes never call each other: shared logic is a plain domain function taking a `db` or `tx`, and pure helpers live in `src/lib`.

**Considered:**
- *TanStack Start function middleware to inject the context.* Works (verified), but we chose an explicit context builder called from `run` so the handler and class stay a plain, testable call chain.
- *Decorators for the policy.* Rejected: unverified against the compile chain; a typed table gives the same declaration with a compile-time exhaustiveness check.
- *A class per use case, or a split rule for large aggregates.* Rejected: one class per aggregate regardless of size, with the migration (not the class) sliced into several PRs for `appointments`.
- *Mocking Prisma in tests.* Rejected: classes are tested for real against `createTestDb()` SQLite, with only the notifier faked.

**Consequences:**
- API classes live in `*.server.ts` files, which the build forbids importing from client code. Vitest needs TanStack Start's import protection disabled under `VITEST` (`vite.config.ts`); the build keeps the guard, so CI must run `npm run build`.
- Permissions are tightened while moving: the default is "logged in", and each migration PR lists every endpoint whose access changed. Unexpected errors (Prisma etc.) now show a generic message instead of raw text; notifications are fire-and-forget after commit and no longer fail the mutation.
- Methods calling each other through `this` skip the policy check (the Proxy wraps the raw target). The policy table is the one place to read who may call what; a snapshot test makes changes reviewable.
- The migration is incremental, one aggregate per PR, guarded by a Biome import restriction plus an architecture test that share an allowlist of migrated handler files. See the migration issues for the order.
