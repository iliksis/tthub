# Research: making Vitest load `*.server.ts` API classes (#104)

Part of map #95 ("API classes for server logic"). No prior research-note convention existed in the repo, so notes live in `docs/research/`.

## Answer

Feasible. The cause is TanStack Start's import-protection Vite plugin, which Vitest picks up through `vite.config.ts`. Disabling it only when `VITEST` is set fixes the hang, the "No test suite found" failure, and lets a test import `src/api/<aggregate>.server.ts` and run against `createTestDb()`. Build-time protection is unaffected, so the `*.server.ts` naming decision in "Class shape and request context" can stand.

## Cause

- `@tanstack/start-plugin-core` ships the plugin `tanstack-start-core:import-protection`
  (`dist/esm/vite/import-protection-plugin/plugin.js`). It is enabled unless `importProtection.enabled === false`.
- Its default rules (`dist/esm/import-protection/defaults.js`) deny `**/*.server.*` in the **client** environment and `**/*.client.*` in the server environment.
- Vitest here runs with `environment: 'jsdom'` through the Vite config containing `tanstackStart()`. A `*.server.*` module is therefore treated as a denied client-side import. Under `vite serve` (which Vitest uses) the default behavior is `mock` (`behavior?.dev ?? "mock"`), so the module is replaced by a mock edge module instead of the real code.
- Observed effects, reproduced in this worktree:
  - a test **importing** `labels.server.ts` (the real module is swapped for a mock) hangs until the worker dies (~147s here, ~96s in the earlier experiment): "Worker exited unexpectedly";
  - a test file whose **own name** contains `.server.` is itself mocked, so Vitest reports "No test suite found in file".
- Same code renamed to a non-`.server` name loads fine, which matches the rules above.

Inference note: I confirmed the rule and the effect empirically (toggle fixes both symptoms); I did not trace why the mock produces a hang rather than an error.

## Fix

`vite.config.ts`:

```diff
-    tanstackStart(),
+    // Under Vitest the client-env default rule (**/*.server.*) mocks server-only
+    // modules, which hangs the worker. Unit tests run in Node, so the guard is
+    // off there; build and dev keep it.
+    tanstackStart(
+      process.env.VITEST ? { importProtection: { enabled: false } } : undefined,
+    ),
```

The option is documented in the plugin schema (`dist/esm/schema.js`, `importProtectionOptionsSchema.enabled`). `VITEST` is already used the same way in this file for `mkcert()`.

## Verification (all in this worktree)

- `src/api/labels.test.ts` imports `LabelsApi` from `./labels.server`, builds it with `createTestDb()`'s `prisma`, calls `list()`: **passes** (1/1, ~2s). Disconnect the Prisma client before `t.close()` or Windows fails to delete the temp DB (EBUSY).
- The same test saved as `labels.server.test.ts` also passes, so test files may carry `.server.` in their name.
- Full `npm test`: 16 files, 112 tests pass.
- `npm run build`: passes with the change.
- Negative check: adding `import { LabelsApi } from "@/api/labels.server"` to `src/routes/__root.tsx` makes `npm run build` fail with `Import denied in client environment / Denied by file pattern: **/*.server.*` (exit 1). Reverted afterwards.

## Caveats

- Import protection is off for the whole Vitest run, so a unit test cannot catch an illegal client import; the build remains the guard.
- A class importing `@/lib/db` pulls `dotenv/config` and builds a `PrismaClient` from `DATABASE_URL` at import time. Tests need `DATABASE_URL` set (any value) or the class must not import `prismaClient`; this is orthogonal to the plugin.
- Modules using `createMiddleware`/`createServerFn` (e.g. `mw.ts`) were not exercised in a test here.
