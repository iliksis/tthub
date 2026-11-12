# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

TTHub is a personal table tennis club management app (teams, players, tournament appointments, RSVPs, placements, calendar feed, web push notifications). Built with TanStack Start (React 19, file-based routing, SSR server functions), Prisma (SQLite via better-sqlite3 driver adapter), Tailwind CSS v4 + shadcn/ui ("new-york" style), Vitest, and Playwright. Deployed via Docker/Fly.io. Unhandled errors show a fallback page where users can copy diagnostic details to share with an admin (`src/components/ErrorPage.tsx`) instead of an automated error-tracking service.

## Commands

- `npm run dev` — start dev server (port 3000, HTTPS via mkcert)
- `npm run build` — production build
- `npm test` — run Vitest unit tests once (`vitest` for watch mode)
- `npx vitest run src/lib/utils.test.ts` — run a single unit test file
- `npm run test:e2e` — reset+seed the e2e SQLite DB and run Playwright tests
- `npm run check` — Biome lint + format check (`npm run lint` / `npm run format` for individual steps)
- `npm run db:migrate` — create/apply a Prisma migration against `.env.local`'s `DATABASE_URL`
- `npm run db:studio` — open Prisma Studio
- `npm run db:seed` — seed the dev DB (`prisma/seed.ts`)

All `db:*` scripts load `.env.local` via `dotenv-cli`; a `.env.local` with `DATABASE_URL`, `SESSION_PASSWORD`, and VAPID keys (see README) is required for local dev.

## Architecture

**Layering**: routes (`src/routes`) → server functions (`src/api/<aggregate>.ts`) → API classes (`src/api/<aggregate>.server.ts`) → Prisma client (`src/lib/db.ts`). Route components call server functions from `src/api/*.ts`; API classes are the only place Prisma is touched directly (aside from the legacy file listed below and the notifier, see Notifications).

**Server functions and API classes** (ADR 0004, `docs/adr/0004-api-classes-for-server-logic.md`): server logic lives in one class per aggregate, `XApi extends ApiBase` in `src/api/<aggregate>.server.ts`, instantiated per request with a context `{ db, user | null, session, notifier }`. `session` is a `SessionStore` port (`update`/`clear`) for the methods that sign users in or out; `update` replaces the cookie's contents with exactly the `SessionUser` fields. Callers outside a server function that must not touch the cookie (the feed route) use `anonymousContext()`. The kernel is `src/api/kernel.server.ts`.
1. **Handler file** (`src/api/<aggregate>.ts`): each `createServerFn()` is a typed `.validator((d: Shape) => d)` (a type cast, no runtime schema library) plus a one-line handler `run(XApi, m.<success_message>, (api) => api.method(data))`. `run` builds the context from the session and wraps the result as `{ data, message }` (`Return<T>` in `src/api/types.ts`). Export names and input shapes are the public contract: keep them stable. Value imports are limited to the framework, paraglide, `./kernel.server` and its own `.server` file. A handler may delegate to another aggregate's class only when its export name predates the split (`users.ts` → `InvitationsApi`/`PasswordResetApi`/`FeedApi`); such exceptions are listed in `crossAggregateDelegation` in `src/api/architecture.test.ts`. Types are re-exported by type. Server functions that live in route files (`loginFn` in `_authed.tsx`, `fetchUser` in `__root.tsx`, `logoutFn` in `logout.tsx`) follow the same one-line shape with `AuthApi`.
2. **Policy**: every public method has an entry in `static readonly policy = { ... } as const satisfies Policies<XApi>` (`PUBLIC` / `AUTHENTICATED` / `EDITOR` / `ADMIN`); a missing entry fails to compile. Default to `AUTHENTICATED` for reads and the narrowest role for writes. `ApiBase` enforces it via a Proxy, so method bodies contain no auth code; row-level rules stay in the body (`this.requireSelfOrRole(userId, "ADMIN")` for "own record or ADMIN"), and so does role-dependent output (`this.isAtLeast("EDITOR")`, e.g. whether Player flags are redacted via `redactFlags` in `src/lib/players.ts`). Internal `this.x()` calls skip the policy check.
3. **Errors**: methods return plain data and throw. Expected failures throw an `ApiError` (`ForbiddenError`, `NotFoundError`, `ConflictError`) with a localized message that reaches the user as-is. Anything else is logged once by `ApiBase` (`[XApi.method]`, actor id, error) and replaced by `m.common_something_went_wrong()`. No `try`/`catch` in methods or handlers just to log.
4. **Transactions**: `this.tx((tx) => ...)` hands a `Tx` (`Prisma.TransactionClient`); `this.journal(tx, "Appointment")` gives that tx's `AuditJournal` (see Audit log below); `this.actorId` is the acting user's id (null when anonymous); `this.requiredActorId` narrows it to `string` in methods whose policy guarantees an actor.
5. **User data**: classes never return a User row with its credential field. Select `userViewSelect` (`src/lib/users.ts`) or narrower (`tokenUserSelect` for token pages); tests assert it with `expectNoCredentials` (`src/test/noCredentials.ts`).
6. **Collaboration**: classes never call each other. Shared DB logic is a plain function taking `db`/`tx` in `src/api/<aggregate>.domain.server.ts`; pure helpers and constants live in `src/lib`.
7. **Tests**: `src/api/<aggregate>.db.test.ts` (`// @vitest-environment node`) runs the real class on SQLite via `createTestApi(XApi, { role })` (`src/test/testApi.ts`; `await cleanup()` in `afterEach`; its `session` records what the class stored in the cookie). Each class gets an inline snapshot of its policy table, one `ForbiddenError` test, every mutation's happy path, at least one `ApiError` path, and side-effect assertions. Vitest can import `*.server.ts` because `vite.config.ts` disables TanStack Start import protection under `VITEST`; the build keeps it, so never import a `.server` file from client code.
8. **Guardrails**: migrated handler files are listed in the `includes` of the `noRestrictedImports` override in `biome.json`. That list is the shared allowlist: `src/api/architecture.test.ts` reads it and fails if a listed file imports anything beyond the above, uses `try`/`catch`/Prisma, or has a handler that does not delegate to `run`; it also checks every API class extends `ApiBase` with a `satisfies Policies<...>` table. Add the handler file there in the PR that migrates it, and remove it from the list below.

**Partially migrated** (legacy pattern: `requireEditor` check, `try`/`catch` that logs and rethrows `new Error((e as Error).message)`, direct `prismaClient`): `appointments.ts`. It moves to `AppointmentsApi` (`src/api/appointments.server.ts`) in slices (issues #119-#122): reads, RSVP responses, create, update and publish/unpublish are already one-line handlers delegating to the class; the remaining mutations (delete/restore, bulk, trash, copy-to-season) are still legacy. The file stays off the guardrail allowlist until the last slice. Within a slice, migrate whole handlers; leave the remaining legacy handlers in their existing pattern. Legacy specifics that still apply until then:
- Mutations that change an `Appointment` also write an audit log entry via `new AuditJournal(tx, "Appointment", session.id)` inside the same `$transaction`, diffing only the fields that were part of the update. Using `AuditJournal`/`auditEntriesFor` from the legacy file is the one sanctioned exception to "don't half-migrate" (ADR 0005 runs the audit-log PR against the legacy code).
- Legacy delete calls the `notifier` singleton's `cancelUpdated` (`src/api/notifier.server.ts`) directly after the transaction commits. Using the notifier from the legacy file is sanctioned like `AuditJournal` above.

**Audit log** (ADR 0005, `docs/adr/0005-entity-agnostic-audit-log.md`; "journal" in the UI at `/appts/journal`): one `AuditLog` table (`entityType`, `entityId`, `userId?`, `action: AuditAction`, `changes?` as `{ field: { old, new } }`) with no FK to the entity. Writes go through `AuditJournal` (`src/api/auditLog.domain.server.ts`: `created`, `updated(id, before, after, fields, extraChanges?)` which writes nothing when nothing changed, `softDeleted`, `restored`) inside the mutation's transaction; the owning class resolves domain details (e.g. label names) and passes them as `extraChanges`. Reads are `AuditLogApi` (`page`, `recent`, `forEntity`) and `auditEntriesFor(db, entityType, id)`; entities are resolved in code per `entityType` by the resolver registry in the same domain file, falling back to the raw id. Journalling a new entity: add it to `AUDIT_ENTITY_TYPES` (`src/lib/auditLog.ts`), a resolver, and field labels in `src/lib/auditLabels.ts`.

**Auth/session**: `src/lib/session.ts` wraps TanStack Start's `useSession` with a typed `SessionUser` (id/userName/name/role). Login, logout and the current-user lookup are `AuthApi` (`src/api/auth.server.ts`); accepting an invitation or completing a password reset also signs the user in. The legacy appointment mutations still gate on `requireEditor` (`useIsRole` + `compareRoles` in `src/lib/utils.ts`; `ADMIN > EDITOR > USER`). Route-level auth: any route under `src/routes/_authed/` requires a session (enforced in `_authed.tsx`'s `beforeLoad`, which throws and is caught by `errorComponent` to render the `Login` component in place). `__root.tsx` loads the current user once via `beforeLoad` and exposes it as router context (`Route.useRouteContext()`), plus the persisted theme.

**Prisma**: schema at `prisma/schema.prisma`, client generated to `src/lib/prisma/` (generated but committed to the repo, not gitignored — Biome and coverage explicitly exclude it; regenerate with `npm run db:generate` after a schema change and commit the result alongside it). IDs are `nanoid(6)` for user-facing entities (User, Appointment, Player, Team, AuditLog) and `uuid()` for internal/relational-only records (invitations, password resets, subscriptions, feed config). Appointments soft-delete via `deletedAt`; querying "active" appointments means filtering `deletedAt: null` explicitly in every query (there's no global middleware for this).

**i18n**: [Paraglide JS](https://paraglidejs.com) (`@inlang/paraglide-js`) compiles message catalogs under `messages/<locale>/<namespace>.json` into typed, tree-shaken functions in the gitignored `src/paraglide/` (generated by the Vite plugin in `vite.config.ts`, excluded from Biome and coverage like `src/lib/prisma/` — but unlike that directory, `src/paraglide/` is genuinely gitignored, not committed). Call sites import `{ m }` from `@/paraglide/messages` and call `m.<namespace>_<key>()`; typos are compile errors, not runtime fallbacks. The app only ships German today (`project.inlang/settings.json`: `baseLocale: "de"`, `locales: ["de"]`), but the SSR locale plumbing (`src/server.ts` wraps the request handler in `paraglideMiddleware`, `strategy: ["cookie", "baseLocale"]`) is already wired so adding a locale later is just adding `messages/<locale>/*.json` files — no routing/SSR rework.

Message keys are namespaced by feature (`appointments_*`, `players_*`, `teams_*`, `common_*`, ...): a string used across more than one feature namespace lives in `common`, everything else lives in the namespace of the feature that owns it. Interpolated messages use named parameters (`{param1}`, `{param2}`, ...) passed as an object: `m.appointments_n_of_n_events({ param1: current, param2: total })`. Pluralized messages (e.g. counts) use Paraglide's native `plural` declaration/selector/match syntax over CLDR categories (`one`/`other`) instead of caller-side singular/plural branching — see any `*_count` key in `messages/de/*.json` for the shape. Add new UI copy as a new key in the relevant `messages/de/<namespace>.json` file, not inline.

Date/time formatting (`toLocaleDateString`, `Intl.RelativeTimeFormat`, etc. in `src/lib/utils.ts` and elsewhere) is hardcoded to `"de-DE"` independently of Paraglide's `getLocale()` — adding a second UI locale would still render dates/times in German formatting until those call sites are also updated to use the active locale.

**Routing**: TanStack Router file-based routes under `src/routes`. `routeTree.gen.ts` is generated — never edit it by hand. Path params use `$paramName` (e.g. `appts/$apptId.tsx`); `formatTanstackRouterPath` (`src/lib/utils.ts`) builds concrete URLs from a route's literal path for use outside JSX (e.g. push notification URLs).

**Client data fetching**: no TanStack Query mutation wiring; `src/hooks/useMutation.ts` is a small custom hook (`mutate`/`status`/`data`/`error`) wrapping calls to `src/api` functions from components — prefer it over ad hoc `useState`+fetch when adding new mutating UI.

**UI components**: shadcn/ui primitives live in `src/components/ui` (new-york style, zinc base, no prefix) — extend/compose these rather than hand-rolling primitives. `cn()` (`src/lib/utils.ts`) merges Tailwind classes (clsx + tailwind-merge). Styling uses Tailwind v4 (`@tailwindcss/vite`, config-less) plus `@catppuccin/tailwindcss`; per-user avatar colors are deterministically picked from the Catppuccin palette via `createColorForUserId`. See `docs/UI_STYLE_GUIDE.md` for concrete layout/component/color conventions extracted from already-refactored pages — check it before building new UI so patterns stay consistent.

**Notifications**: Web Push via `web-push`/VAPID (`src/lib/web-push.ts` client side). Users manage per-subscription `NotificationSettings` (new/changed appointment toggles) tied to a browser `Subscription`, plus muted labels, through `NotificationsApi` (`src/api/notifications.server.ts`). Sending is the `Notifier` (`src/api/notifier.server.ts`), not an API class: no policy, no session; classes reach it as `this.ctx.notifier` and pass the actor id explicitly so the actor's own devices are skipped. `published`/`updated` are fire-and-forget (call after commit; a failed push is logged, never fails the mutation); `updated` is debounced 5s per appointment in a module-level map (single process: a restart drops pending pushes) so click-to-edit bursts collapse into one push; `cancelUpdated` drops a pending one. `createTestApi` injects a recording fake (`notifications` in its result). A service worker (`public/sw.js`, registered in `__root.tsx`) handles push display; iOS requires the site to be added to the home screen first.

**Calendar feed**: `src/routes/feed/$feedId.ts` serves a per-user iCal feed (keyed by `User.feedId`) built with `src/lib/ical.ts`. Lookup and filtering by each user's `FeedConfig` (response types, draft inclusion, appointment types, excluded labels) live in `FeedApi.forFeed` (`src/api/feed.server.ts`); the route only does HTTP and iCal formatting. `src/lib/feed.ts` converts between the comma-joined DB columns and the `FeedConfig` shape.

## Testing

- Unit tests (Vitest + Testing Library + jsdom) live alongside source as `*.test.ts(x)`; setup file is `src/test/setup.ts`. Coverage excludes `src/lib/prisma/**` (generated) and `routeTree.gen.ts`.
- E2E tests (Playwright) live in `e2e/*.spec.ts` against a dedicated `prisma/test.db`, reset+seeded before each run (`test:e2e:setup`); `e2e/helpers.ts` holds shared fixtures/utilities. Playwright runs against `https://localhost:3000` (self-signed cert accepted) across Chromium/Firefox/WebKit + mobile viewport projects.

## Code style

- Biome (not ESLint/Prettier) enforces formatting (tabs, double quotes) and import/key sorting — run `npm run check` before considering a change done. `src/lib/prisma/**`, `src/routeTree.gen.ts`, and `src/styles.css` are excluded from linting/formatting.
- Path alias `@/*` → `src/*` (see `tsconfig.json` / shadcn `aliases`).
- TypeScript strict mode with `noUnusedLocals`/`noUnusedParameters` — dead code and unused params fail the build, not just lint.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `iliksis/tthub`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
