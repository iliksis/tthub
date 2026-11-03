# Research: Prisma `Json` column on SQLite with better-sqlite3

Ticket: iliksis/tthub#65 (part of #64). Context: Season Statistics stores the roster breakdown (age group x gender) as JSON.

## Answer

**Supported. Use `Json`.** Prisma 7.9.1 with `@prisma/adapter-better-sqlite3` 7.9.1 reads, writes, types and migrates a `Json` column on SQLite. Verified empirically in a scratch project (not the repo schema).

## Versions

- `prisma`, `@prisma/client`, `@prisma/adapter-better-sqlite3`: all `7.9.1` (package.json `^7.9.1`, package-lock.json resolves 7.9.1). Generator `prisma-client`, `engineType = "client"`.
- better-sqlite3 12.11.1 (pulled in by the adapter in the scratch install).
- SQLite `Json` support was introduced in Prisma 6.2.0 ("support for `json` and `enum` fields in SQLite", https://github.com/prisma/prisma/releases/tag/6.2.0).

## Findings (empirical, Prisma 7.9.1 + better-sqlite3 adapter)

- **Migration SQL** (`prisma migrate diff --from-empty --to-schema`): `Json` -> `"roster" JSONB NOT NULL`, `Json?` -> `"opt" JSONB`. The column is declared `JSONB` but data is stored as plain JSON **text** (`typeof(roster) = 'text'`), so SQLite's own `json_extract(roster, '$.U13.m')` works on it.
- **Write/read**: objects round-trip; read returns a parsed object (not a string).
- **Generated typing**: model field is `runtime.JsonValue` (`string | number | boolean | null | JsonObject | JsonArray`); input is `InputJsonValue`; filter is `Prisma.JsonFilter<"Model">`. Nothing is typed beyond that.
- **Querying inside**: works on SQLite, but `path` must be a **string JSON path** (`path: "$.U13.m"`). The array form used for Postgres/MySQL (`["U13","m"]`) throws `Argument path: Invalid value provided. Expected String`. `where: { roster: { equals: {...} } }` also works. The docs do not cover this (see caveat 5), so rely on the test.
- **Null handling**: for a nullable column, `Prisma.JsonNull` stores JSON `null` (text `'null'`) and `Prisma.DbNull` is SQL NULL; `{ opt: { equals: Prisma.DbNull } }` filters correctly.
- **Quirk**: because of the `JSONB` declared type (NUMERIC affinity), a top-level JSON number is stored as an SQLite integer. Values still read back correctly; irrelevant for object-shaped rosters.

## Caveats

1. Values are untyped: cast or validate on read (e.g. `row.roster as RosterBreakdown`). The Prisma docs suggest the `prisma-json-types-generator` package for strong typing (https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields); optional for one column.
2. When writing, a typed value may need a cast `as Prisma.InputJsonValue` (interfaces without index signatures often do not assign to `InputJsonValue`; type aliases usually do).
3. Filtering inside JSON is limited on SQLite (string path, basic operators). Aggregate by age group/gender in application code or raw `json_extract`.
4. Repo rule: `src/lib/prisma/` is committed, so run `npm run db:generate` and commit the regenerated client with the schema change.
5. Docs gap: Prisma's docs are inconsistent here. The Json fields guide never mentions SQLite and says advanced filtering is "supported by PostgreSQL and MySQL only"; the schema reference type-mapping table lists `JSONB` for SQLite while a SQLite subsection still says "Not supported" (https://www.prisma.io/docs/orm/reference/prisma-schema-reference). The 6.2.0 release notes and the empirical test are the authoritative evidence.

## Fallback (only if Json ever proves awkward)

A `String` column holding `JSON.stringify(...)`, parsed with `JSON.parse` in `src/api/*`. Simple and typed by your own interface, no `JsonNull`/`DbNull` semantics, but no `path` filtering and no DB-level validity guarantee. Not needed today.

## Sources

- Prisma 6.2.0 release notes: https://github.com/prisma/prisma/releases/tag/6.2.0
- Working with Json fields: https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields
- Prisma schema reference: https://www.prisma.io/docs/orm/reference/prisma-schema-reference
- Local verification: scratch project with prisma/client/adapter 7.9.1: `prisma generate`, `prisma migrate diff`, and a script exercising create/read/`path`/`equals`/`DbNull`.
