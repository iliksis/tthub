# Research: TanStack Start context and middleware

Issue: iliksis/tthub#96 (part of map #95, "API classes for server logic"). Blocks #97.

Installed versions (from `node_modules/*/package.json`): `@tanstack/react-start` 1.168.40, `@tanstack/start-client-core` 1.170.19, `@tanstack/start-server-core` 1.169.23. The repo has no `src/start.ts` and no `createMiddleware` usage today.

Sources are all under `node_modules/@tanstack/`, cited relative to that folder. Tags:

- `S:` the skill docs shipped in the packages, which cite the upstream guides (`TanStack/router:docs/start/framework/react/guide/*.md`)
- `J:` runtime JS
- `T:` `.d.ts` types
- `C:` compiler source (`start-plugin-core`)

## Short answer

1. Yes, middleware can provide the session user and `db` to the handler. `createMiddleware({ type: "function" }).server(({ next }) => next({ context: { user, db } }))`, attached with `createServerFn().middleware([mw])`, arrives typed as `context` in `.handler(({ data, context }) => ...)`. The handler can then do `new XApi(context)`.
2. Chain order is enforced by types: `.middleware()` -> `.validator()` -> `.client()` -> `.server()` (S: `start-client-core/skills/start-core/middleware/SKILL.md`). On a server fn: `createServerFn().middleware([...]).validator(...).handler(...)`.
3. Bundling: the compiler removes server fn handler bodies and middleware `.server()` bodies from the client build, then dead-code-eliminates imports only they used. A server-only class imported by `src/api/*.ts` and used only inside handlers / middleware `.server()` does not reach the client. Anything referenced outside those bodies (module scope, loaders, components, plain exported helpers routes import) does.
4. `.validator` is the current name; `.inputValidator` is deprecated (works, compiler warns). The repo's `.validator((d: Shape) => d)` is correct; no migration needed.

## 1. What provides per-request context

### 1.1 Two middleware kinds (S: middleware/SKILL.md; T: `start-client-core/dist/esm/createMiddleware.d.ts`)

| | Request middleware | Function middleware |
|---|---|---|
| Created with | `createMiddleware()` | `createMiddleware({ type: "function" })` |
| Runs for | all server requests (SSR, server routes, server fns) | server fns only |
| Methods | `.server()` | `.validator()`, `.client()`, `.server()` |

Request middleware cannot depend on function middleware; function middleware can depend on both.

### 1.2 How context flows (J: `start-client-core/dist/esm/createServerFn.js`, `executeMiddleware`)

- Each `.server(({ next, context, data, ... }) => next({ context, sendContext }))`.
- `userNext` merges `userCtx.context` into `ctx.context` (`safeObjectMerge`), so later middleware and the handler see the accumulated object. Types accumulate via `AssignAllServerFnContext` (T: createMiddleware.d.ts).
- A middleware must return `next(...)` (or a `Response`/redirect). Returning nothing throws "User middleware returned undefined...".
- A `throw` in a middleware surfaces as the server fn error, like a throw in a handler. `throw new Error("Unauthorized")` therefore fits the repo's throwing pattern. `next()` rethrows downstream errors (`if (result.error) throw result.error`), so a middleware can also `try { await next() } catch (e) { console.error(e); throw ... }`, a possible home for the repeated log-and-rethrow boilerplate.
- `context` stays server-side. `sendContext` crosses the client/server boundary and, when coming from the client, is untrusted input (S: "CRITICAL: Trusting client sendContext"). The session must come from the cookie, never from `sendContext`. For this project: put `user` and `db` in `context`, do not use `sendContext`.

### 1.3 Reading the session inside middleware

`useSession` / `getRequest` read the current request from an `AsyncLocalStorage` (J: `start-server-core/dist/esm/request-response.js` lines 1-6 and 51-54; throws "No StartEvent found in AsyncLocalStorage" outside the server runtime). Middleware `.server()` runs inside that scope, so `useAppSession()` from `src/lib/session.ts` works there exactly as in handlers today.

The function-middleware `.server()` options are `data, context, next, method, serverFnMeta, signal` (T: `FunctionMiddlewareServerFnOptions`); there is no `request` field there (request middleware does get `request`). Use `useAppSession()` / `getRequest()` in function middleware.

### 1.4 Attaching

- Per function: `createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(...).handler(async ({ data, context }) => ...)`.
- Composition and factories: `createMiddleware({ type: "function" }).middleware([authMiddleware]).server(...)`; a factory like `requireRole("EDITOR")` returns such a middleware (S: "Middleware Factories").
- Middleware lists are flattened and de-duplicated by identity (J: `flattenMiddlewares`), so depending on `authMiddleware` from several others runs it once.
- Global: `src/start.ts` with `createStart(() => ({ requestMiddleware, functionMiddleware }))` (S: "Global Middleware"; T: `createStart.d.ts`). Global function middleware is prepended to every server fn (`getStartOptions()?.functionMiddleware` in `executeMiddleware`). A poor fit for auth here: login, invite and password-reset fns are public.
- Server routes can take `server: { middleware: [...] }` (S); relevant for `src/routes/feed/$feedId.ts` only if it is ever moved to the same scheme.

### 1.5 Execution order and `data`

Order: global function middleware, then the fn's flattened `.middleware()` list, then the server fn's own validator and handler. In `executeMiddleware` a middleware's validator runs just before its own `.server()`. The server fn's own validator is added as the final pseudo-middleware (`serverFnBaseToMiddleware`), so in an auth middleware `data` is the raw input unless that middleware declares a validator. Auth middleware should not depend on `data`.

### 1.6 Illustrative shape for #97 (not implemented, not type-checked)

```ts
export const dbMiddleware = createMiddleware({ type: "function" }).server(
  ({ next }) => next({ context: { db: prismaClient } }),
);

export const authMiddleware = createMiddleware({ type: "function" })
  .middleware([dbMiddleware])
  .server(async ({ next }) => {
    const { data } = await useAppSession();
    if (!data.id) throw new Error("Unauthorized");
    return next({ context: { user: data as SessionUser } });
  });

export const requireRole = (role: Role) =>
  createMiddleware({ type: "function" })
    .middleware([authMiddleware])
    .server(async ({ next, context }) => {
      if (compareRoles(context.user.role, role) === -1) throw new Error("Forbidden");
      return next();
    });

export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireRole("EDITOR")])
  .validator((d: CreateTeamInput) => d)
  .handler(({ data, context }) => new TeamsApi(context).create(data));
```

Notes: `useSession<SessionUser>` data may be empty, so the middleware is the place to narrow it so `XApi` receives a non-null `user`. Passing `db` through context is mainly useful for tests and for handing a `$transaction` client to an API class; a module-level `prismaClient` import also works.

### 1.7 Caveats

- Function middleware `.client()` also runs during SSR (S: "Browser APIs in .client() crash during SSR"). The plan needs no `.client()`.
- `createCsrfMiddleware` exists in `start-client-core/dist/esm/` (not investigated; out of scope).

## 2. `.validator` vs `.inputValidator`

- T: `createServerFn.d.ts` (~lines 80-100): `validator` is current; `inputValidator` is `@deprecated Use validator instead`.
- J: `createServerFn.js` `setValidator` stores the function under both keys; `executeMiddleware` reads `validator` first, falling back to `inputValidator`.
- C: `start-compiler/handleCreateServerFn.js` and `handleCreateMiddleware.js` warn "`inputValidator()` is deprecated. Use `validator()` instead." Same for `createMiddleware().validator()`.
- `execValidator` accepts a Standard Schema (`~standard`), an object with `parse`, or a plain function, so the cast function `(d: Shape) => d` is valid (it does no runtime checking, as CLAUDE.md notes). Validation runs only on the server (`if (validator && env === "server")`) and the `.validator()` call is stripped from the client build (C: `stripMethodCall` when `context.env === "client"`).

## 3. Bundling constraints for server-only classes

### 3.1 Isomorphic by default (S: execution-model/SKILL.md)

Route files, loaders and everything they import go into both bundles unless the compiler or import protection removes them. Loaders run on both sides.

### 3.2 What the compiler strips

- C: `start-compiler/handleCreateServerFn.js`: in the client and SSR-caller builds, the `.handler(fn)` argument is replaced by `createClientRpc(id)` / `createSsrRpc(id)`; `.validator(...)` calls are stripped on the client. The real handler body moves to a provider module (`tss-serverfn-split`).
- C: `start-compiler/compiler.js` (~line 720) then runs `deadCodeElimination`, removing imports and bindings that are no longer referenced.
- C: `start-compiler/handleCreateMiddleware.js` (client env): strips `.validator()` and `.server()` from `createMiddleware` chains, so middleware server bodies and their imports are eliminated from the client.

Consequence: `import { UsersApi } from "..."` in `src/api/users.ts`, used only inside `.handler(...)` bodies or middleware `.server()` bodies, disappears from the client build. Routes importing `src/api/users.ts` get RPC stubs only. This is the same mechanism that already lets `src/api/*.ts` import `prismaClient` today.

### 3.3 What defeats it

- Using the class at module scope, in a loader, in a component, or in a plain exported helper that a route imports. Those references survive DCE and pull the class and its imports (Prisma client, better-sqlite3, `web-push`) into the client graph.
- Module-level `process.env` reads in a file that can reach the client (S: execution-model, "Reading process.env at module scope"). Read env inside handlers / constructors, not at file scope.
- Barrel files that mix server-only classes with values routes import.
- Type-only imports are safe: they erase (S: "Type-only imports are ignored").
- `src/lib/session.ts` imports `@tanstack/react-start/server`, which is on the default client deny list (C: `import-protection/defaults.js`), so it is already client-hostile and must stay behind handler / middleware bodies.

### 3.4 Guardrails Start offers (S: execution-model; C: `import-protection/defaults.js`)

- File suffix `*.server.ts` is denied in the client environment (`*.client.*` denied on the server).
- Marker import `import "@tanstack/react-start/server-only"` at the top of a file does the same without renaming. Default behavior: `error` in production build, `mock` (recursive Proxy) in dev. Both are marked experimental in S.
- Config under `tanstackStart({ importProtection: { behavior, include, exclude, client, server, ignoreImporters, maxTraceDepth } })` (T: `start-plugin-core/dist/esm/schema.d.ts`). The repo's `vite.config.ts` sets none, so defaults apply.
- Runtime guards: `createServerOnlyFn(fn)` throws if called on the client; `createIsomorphicFn().server().client()` for split implementations.

Suggestion for #97: put API classes in `*.server.ts` files (or add the `server-only` marker) so an accidental import from a route or component fails the build instead of silently bundling Prisma.

## 4. Not verified

- No build was run. The bundling claims come from the compiler source and shipped docs. A throwaway spike (`vite build`, grep the client chunks for `better-sqlite3`/`PrismaClient`) would confirm.
- Behavior of `*.server.ts` under Vitest: Vitest does not run the Start compiler or import protection, so such files should import fine in unit tests (expected, unverified).
- Whether `prismaClient` use in `beforeLoad` in `src/routes/__root.tsx` and `_authed.tsx` is client-safe is unchanged by this work, but relevant to "files routes also import" and worth a look in #97.
