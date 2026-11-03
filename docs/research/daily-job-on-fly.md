# Running a once-a-day job on Fly (issue #72)

Researched 2026-11-03. Question: how can TTHub run a daily job that calls server code (a Prisma recompute) as currently deployed?

## Deployment facts (from the repo)

- `fly.toml`: single `[[mounts]]` volume `data` at `/data`; `http_service` with `auto_stop_machines = 'stop'`, `auto_start_machines = true`, `min_machines_running = 1`; one VM (1 CPU, 512 MB).
- `Dockerfile`: `DATABASE_URL="file:///data/sqlite.db"`, `CMD ["npm","run","start"]`, which is `node .output/server/index.mjs` (`package.json`).
- `docker-entrypoint.js`: runs `npx prisma migrate deploy`, then the start command. Migrations therefore run before any in-process scheduler could start.
- `src/server.ts` is the SSR fetch entry (`paraglideMiddleware` wrapping the TanStack handler). `vite.config.ts` builds with `nitroV2Plugin()` from `@tanstack/nitro-v2-vite-plugin` (`^1.155.0`; latest 1.155.2, depends on `nitropack ^2.13.4`). `.output/` is therefore a Nitro `node-server` build.
- Node 22.15.0 in Docker.

## 1. In-process scheduler

### Libraries (npm registry, checked 2026-11-03)

| Library | Latest | License | Deps | Maintenance |
|---|---|---|---|---|
| croner (Hexagon/croner) | 11.0.0 (2026-10-26; dev tags after) | MIT | none, Node >=18 | README: "founded and actively maintained by Hexagon"; released this week |
| node-cron | 4.6.0 (2026-07-05) | ISC | none, Node >=20 | TS rewrite (v4), release-please, README claims 220k+ dependent repos |
| `setInterval` | built in | n/a | n/a | n/a |

Sources: https://github.com/Hexagon/croner, https://github.com/node-cron/node-cron, `npm view`.

- croner: `timezone` option takes an IANA name (e.g. `Europe/Berlin`); `protect: true` blocks overlapping runs; `catch` handles errors; `unref` lets the process exit; named jobs are tracked in `scheduledJobs`. DST: a fixed-time job runs once for a repeated time and, for a skipped time, at the first valid time after the gap on the same day (Vixie cron behaviour). Scheduling at e.g. 04:00 avoids the 02:00-03:00 transition hours anyway.
- node-cron: `timezone` option; `noOverlap: true`; README says it does not persist state and does not describe catch-up of missed runs.
- `setInterval` has no calendar or time zone awareness; "daily at 04:00 Berlin" would need hand-rolled `Intl` date math. Fine only for "every N hours".
- Nitro itself already bundles croner (`nitropack@2.13.6` depends on `croner ^10.0.1`).

### Where to start it

1. **Module scope of `src/server.ts`.** This is the SSR entry that Nitro imports via its virtual renderer entry (see the `@tanstack/nitro-v2-vite-plugin@1.155.2` source: `import handler from '<ssrEntryFile>'`), so in production it is evaluated once per process. Simple, no extra config, but mixes scheduling with request handling, and `server.ts` is also evaluated under `vite dev`.
2. **A Nitro server plugin** (`defineNitroPlugin`, https://v2.nitro.build/guide/plugins). Plugins "run once during server startup" and have a `close` hook for graceful shutdown. The vite plugin passes its `nitroConfig` argument to `createNitro` at build time only (`config()` returns early unless `env.command === 'build'`), so a plugin registered via `nitroV2Plugin({ plugins: [...] })` would run in the production build but not in `vite dev`. Not confirmed by an actual build; verify before relying on it.

Either way keep the job body in `src/api` or `src/lib` (repo layering); the scheduler only calls it.

### Double-start guard

- Production: one process, one evaluation of the entry. The `uncaughtHandlerInstalled` flag in `vite.config.ts` is the repo's precedent for a once-guard.
- Dev HMR / re-evaluated modules: a module-level `let started` resets on re-evaluation, so keep the guard on `globalThis` (e.g. `globalThis.__tthubDailyJob ??= new Cron(...)`) or give the croner job a `name` and check `scheduledJobs`. Also skip scheduling unless `NODE_ENV === "production"`, which avoids firing on every dev restart and in Vitest/Playwright runs.
- Never put it in a per-request path.

### Restart and missed runs

- Neither library persists a "last run". If the process is down at the scheduled time (deploy, crash, host migration, stop), that run is skipped.
- Mitigation: make the recompute idempotent and run it once on startup (after migrations, which the entrypoint guarantees) in addition to the cron. Optionally store `lastRunAt` in the DB and on boot run only if older than ~24 h.
- Fly: `min_machines_running = 1` keeps one machine running in the primary region (https://docs.fly.io/launch/autostop-autostart/; it only has effect with `auto_stop_machines` `stop`/`suspend`), so in steady state the process stays up and in-process timers fire. Fly's docs describe autostop in terms of proxy traffic and do not say whether background work keeps a machine alive; with min = 1 that does not matter, but it would if min were 0. Deploys, host maintenance and OOM (512 MB) still restart the process, hence boot-time catch-up.

### Time zone

Use croner `timezone: "Europe/Berlin"`, e.g. `new Cron("0 4 * * *", { timezone: "Europe/Berlin", protect: true }, fn)`. The image is `node:22-slim`, so process TZ is UTC; passing the option explicitly avoids depending on `TZ`. If the job only needs "once per ~24 h" rather than "04:00 local", UTC avoids DST questions.

## 2. Built-in scheduled tasks in Nitro / TanStack Start

- TanStack Start itself has no scheduler; its hosting docs (https://tanstack.com/start/latest/docs/framework/react/guide/hosting) do not mention tasks, plugins or cron.
- Nitro v2 (engine behind `@tanstack/nitro-v2-vite-plugin`) has **experimental** tasks: `experimental: { tasks: true }`, `scheduledTasks: { '0 4 * * *': ['recompute'] }`, and `server/tasks/recompute.ts` with `defineTask`. For the `node-server` preset the engine is croner. Docs: "Tasks support is currently experimental"; no time zone is documented for schedules (assume UTC, unverified); one running instance per task. Source: https://v2.nitro.build/guide/tasks.
- The vite wrapper forwards `nitroConfig` to `createNitro` at build, so `nitroV2Plugin({ experimental: { tasks: true }, scheduledTasks: {...} })` is plausible, but TanStack does not document it and I did not build it. Tasks would not run under `vite dev`, have no persistence or catch-up, and need a `server/` dir outside `src/`. Same semantics as croner plus an experimental flag. TanStack's hosting page also now points to the newer `nitro/vite` plugin, so Nitro-v2 specifics may move.

## 3. Fly scheduled machines or an external trigger

### Fly scheduled machines

- `fly machine run --schedule hourly|daily|weekly|monthly` (https://docs.fly.io/machines/flyctl/fly-machine-run). The cycle is "fuzzy": roughly once per period; no time zone stated. Meant for finite jobs that exit. Fly's blueprint (https://docs.fly.io/blueprints/task-scheduling) calls it coarse-grained and unsuitable for precise timing.
- Volume problem: a volume attaches to one machine on one host (https://docs.fly.io/volumes/overview/). A scheduled machine cannot mount `/data` while the web machine has it, so it cannot run Prisma against `sqlite.db`. It could only call the web app over HTTP, which just adds Fly machinery in front of the external-trigger option below.
- Other Fly-documented patterns (same blueprint): Cron Manager (a second app plus `FLY_API_TOKEN`), supercronic in the same app (must be exactly one copy; a separate process group means a second machine that again cannot share the volume), or external services such as GitHub Actions. Supercronic in the same container adds nothing over croner in-process.

### External trigger (GitHub Actions cron) calling an authenticated route

- Add a route (e.g. `src/routes/api/jobs/recompute.ts`) that checks `Authorization: Bearer <JOB_SECRET>` with a constant-time compare, then runs the recompute. Store the secret via `fly secrets set JOB_SECRET=...` and as a GitHub repo secret used by the workflow (`curl -fsS -X POST -H "Authorization: Bearer $JOB_SECRET" https://<app>.fly.dev/api/jobs/recompute`). Never in `fly.toml` or the repo.
- GitHub `schedule` caveats (https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule): UTC by default (timezone can be set), minimum interval 5 minutes, delays and possibly dropped runs under load, default branch only, disabled after 60 days without repo activity in public repos. The silent-disable risk is real for a hobby repo.
- Benefit: `auto_start_machines = true` means the request wakes a stopped machine. The route must be idempotent since retries can double-fire.
- Cost: an externally reachable mutating endpoint, a secret to rotate, monitoring in a second system.

## 4. Single-instance guarantees with SQLite on one volume

- The architecture is already single-host: a Fly volume attaches to one machine on one server, and SQLite WAL requires all processes on the same host (https://www.sqlite.org/wal.html). One machine means one scheduler, as long as the app is not scaled out (extra machines would get their own empty volumes, a data-model problem independent of the job).
- What can still double-run: (a) overlapping old/new machines during a deploy (a volume cannot be attached twice, so overlap is not expected, but I found no doc sentence stating Fly's behaviour explicitly); (b) a second process in the container; (c) scheduler plus a manual/HTTP trigger; (d) dev HMR.
- Guard if wanted: idempotent job and/or a DB compare-and-set, e.g. `UPDATE JobRun SET startedAt = now WHERE name = ? AND (startedAt IS NULL OR startedAt < now - interval)`; proceed only if one row changed. SQLite allows one writer at a time (`SQLITE_BUSY` possible), so this is atomic. It doubles as the `lastRunAt` for restart catch-up. Neither library provides locking by default (node-cron's README mentions an env-var flag and optional Redis coordinator for distributed mode).
- Run the recompute in one `$transaction`; check a busy timeout is set on the better-sqlite3 adapter (not checked here).

## Recommendation

Use **croner in-process**, started once at production boot, with a catch-up on boot.

1. Add `croner` (11.x, MIT, zero deps, actively released; already the engine inside Nitro's tasks).
2. A small `startDailyJobs()` module (job body in `src/api`/`src/lib`), called from module scope of `src/server.ts` (or a Nitro plugin if verified), skipped unless `NODE_ENV === "production"`, guarded via `globalThis`/job `name`.
3. `new Cron("0 4 * * *", { timezone: "Europe/Berlin", protect: true, catch: log }, run)` plus one `run()` on boot when stored `lastRunAt` is older than ~24 h, using the atomic compare-and-set from section 4.
4. Make the recompute idempotent.

Trade-offs:

- In-process: no new infrastructure or secrets, direct Prisma access, works because `min_machines_running = 1` keeps the machine up. Downsides: shares the 512 MB web process, skipped while down (mitigated by boot catch-up), breaks if the app is scaled to zero or multiple machines.
- Nitro tasks: same semantics as croner but experimental, undocumented time zone, unverified through the vite wrapper. Pass.
- Fly scheduled machine: cannot mount the app volume, fuzzy timing; only useful as an HTTP caller. Pass.
- GitHub Actions + authenticated route: independent of process restarts and can wake a stopped machine, but adds an exposed endpoint, two secret stores, and GitHub's delayed/dropped/auto-disabled schedules. A reasonable later add-on, e.g. an admin "recompute now" trigger calling the same idempotent function.
- If the recompute becomes heavy or the app is scaled out, revisit with a separate worker, which would mean leaving SQLite-on-volume.

## Not verified

- Whether `nitroV2Plugin({ plugins | experimental.tasks | scheduledTasks })` is picked up in the production build (no build run; `node_modules` not installed in this worktree). The plugin source was read via `npm pack`.
- Time zone of Nitro `scheduledTasks` (undocumented).
- Fly deploy behaviour for volume apps regarding overlapping old/new machines.
