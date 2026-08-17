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

**Layering**: routes (`src/routes`) → API/server functions (`src/api`) → Prisma client (`src/lib/db.ts`). Route components call functions from `src/api/*.ts`; those functions are the only place Prisma is touched directly (aside from `_authed.tsx`/`__root.tsx` auth checks).

**Server functions (`src/api/*.ts`)**: every mutation/query is a TanStack Start `createServerFn()`. The established pattern per function:
1. `.validator((d: Shape) => d)` for typed input (no runtime schema library — validator is just a type cast).
2. Auth check via `useIsRole("EDITOR"|"ADMIN")` (from `src/lib/session.ts`) for writes, or session presence for reads that require a logged-in user.
3. Body wrapped in try/catch, returning `json<Return<T>>({ data, message }, { status })` (`Return<T>` in `src/api/types.ts` is `{ message: string; data?: T }`) — errors return the same shape with a message and status 400/401/404, they don't throw.
4. Mutations that change an `Appointment` also write a `Transaction` row (`CREATE`/`UPDATE`/`DELETE`) inside the same `$transaction`, diffing only the fields that were part of the update, for the audit journal at `/appts/journal`. Do not confuse `prismaClient.$transaction` (DB transaction) with the `Transaction` model (change-history log) — see the comment in `createAppointment`.
5. Appointment publish/create/update notifies via `sendNotification` (`src/api/notifications.ts`) for `TOURNAMENT` type appointments only; updates are debounced 5s per-appointment (`pendingUpdateNotifications` map in `src/api/appointments.ts`) so rapid click-to-edit saves collapse into one push notification.

**Auth/session**: `src/lib/session.ts` wraps TanStack Start's `useSession` with a typed `SessionUser` (id/userName/name/role). `useIsRole`/`useIsUserOrRole` gate actions using `compareRoles` (`src/lib/utils.ts`; `ADMIN > EDITOR > USER`). Route-level auth: any route under `src/routes/_authed/` requires a session (enforced in `_authed.tsx`'s `beforeLoad`, which throws and is caught by `errorComponent` to render the `Login` component in place). `__root.tsx` loads the current user once via `beforeLoad` and exposes it as router context (`Route.useRouteContext()`), plus the persisted theme.

**Prisma**: schema at `prisma/schema.prisma`, client generated to `src/lib/prisma/` (gitignored/generated — Biome and coverage explicitly exclude it). IDs are `nanoid(6)` for user-facing entities (User, Appointment, Player, Team, Transaction) and `uuid()` for internal/relational-only records (invitations, password resets, subscriptions, feed config). Appointments soft-delete via `deletedAt`; querying "active" appointments means filtering `deletedAt: null` explicitly in every query (there's no global middleware for this).

**i18n**: all user-facing strings go through `t()` in `src/lib/text.ts`, a flat key→German-string dictionary (the app is German-only; keys are the English source strings). `t("{0} of {1} events", a, b)` does `{n}`-style interpolation via `format()` in `src/lib/utils.ts`. Missing keys render as `"key 🐧"` rather than throwing — treat that emoji in the UI as a signal of an untranslated string. Add new UI copy as a new key in the `texts` object, not inline.

**Routing**: TanStack Router file-based routes under `src/routes`. `routeTree.gen.ts` is generated — never edit it by hand. Path params use `$paramName` (e.g. `appts/$apptId.tsx`); `formatTanstackRouterPath` (`src/lib/utils.ts`) builds concrete URLs from a route's literal path for use outside JSX (e.g. push notification URLs).

**Client data fetching**: no TanStack Query mutation wiring; `src/hooks/useMutation.ts` is a small custom hook (`mutate`/`status`/`data`/`error`) wrapping calls to `src/api` functions from components — prefer it over ad hoc `useState`+fetch when adding new mutating UI.

**UI components**: shadcn/ui primitives live in `src/components/ui` (new-york style, zinc base, no prefix) — extend/compose these rather than hand-rolling primitives. `cn()` (`src/lib/utils.ts`) merges Tailwind classes (clsx + tailwind-merge). Styling uses Tailwind v4 (`@tailwindcss/vite`, config-less) plus `@catppuccin/tailwindcss`; per-user avatar colors are deterministically picked from the Catppuccin palette via `createColorForUserId`. See `docs/UI_STYLE_GUIDE.md` for concrete layout/component/color conventions extracted from already-refactored pages — check it before building new UI so patterns stay consistent.

**Notifications**: Web Push via `web-push`/VAPID (`src/lib/web-push.ts`, `src/api/notifications.ts`); users manage per-subscription `NotificationSettings` (new/changed appointment toggles) tied to a browser `Subscription`. A service worker (`public/sw.js`, registered in `__root.tsx`) handles push display; iOS requires the site to be added to the home screen first.

**Calendar feed**: `src/routes/feed/$feedId.ts` serves a per-user iCal feed (keyed by `User.feedId`) built with `src/lib/ical.ts`, filtered by each user's `FeedConfig` (response types, draft inclusion, appointment types).

## Testing

- Unit tests (Vitest + Testing Library + jsdom) live alongside source as `*.test.ts(x)`; setup file is `src/test/setup.ts`. Coverage excludes `src/lib/prisma/**` (generated) and `routeTree.gen.ts`.
- E2E tests (Playwright) live in `e2e/*.spec.ts` against a dedicated `prisma/test.db`, reset+seeded before each run (`test:e2e:setup`); `e2e/helpers.ts` holds shared fixtures/utilities. Playwright runs against `https://localhost:3000` (self-signed cert accepted) across Chromium/Firefox/WebKit + mobile viewport projects.

## Code style

- Biome (not ESLint/Prettier) enforces formatting (tabs, double quotes) and import/key sorting — run `npm run check` before considering a change done. `src/lib/prisma/**`, `src/routeTree.gen.ts`, and `src/styles.css` are excluded from linting/formatting.
- Path alias `@/*` → `src/*` (see `tsconfig.json` / shadcn `aliases`).
- TypeScript strict mode with `noUnusedLocals`/`noUnusedParameters` — dead code and unused params fail the build, not just lint.
