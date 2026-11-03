# Research: mutation paths that affect Season Statistics (issue #66)

Code reading only, at commit `9efedb8`. Vocabulary per `CONTEXT.md`. A Season Statistics row is planned per Season and would be fed by `TeamPlayer` (roster), `Player` (gender, year, future eligibility flag) and, for Season Player counts, `Placement` via `Appointment.seasonId`.

## Schema facts that drive the answers

- `TeamPlayer` has `teamId`, `playerId` and a **denormalised `seasonId`** (`prisma/schema.prisma:209`). It cascades on delete from `Team`, `Player` and `Season`. `@@unique([playerId, teamId])` is per team, so "one team per season" is enforced only in application code (`applyRosterChanges`).
- `Player` has no `seasonId`. A change to a Player's gender, year or eligibility touches **every Season in which that Player has a footprint** (an unbounded set).
- `Team.seasonId` is required and no API function changes it, so a Team never moves between Seasons.
- `Placement` has no season of its own; it takes it from `Appointment.seasonId` (optional; HOLIDAY rows are null). `Placement.player` / `.appointment` have no `onDelete` (restrict by default).
- `Appointment.season` is optional with no `onDelete`, so Prisma defaults to `SetNull`.

## Roster (`TeamPlayer`)

| # | File : function | Operation | In `$transaction`? | Season(s) affected |
|---|---|---|---|---|
| 1 | `src/api/teams.ts` : `applyRosterChanges` | `teamPlayer.deleteMany` (removes) and `createMany` (adds). The only add/remove path; allows the same player on both Team Halves of one Season. | Yes | One: `team.seasonId` (also written into new rows). Caveat: `removes` is a list of `TeamPlayer.id` filtered **only by id**, not `teamId`, so it can delete rows of any Season. Adds are rejected if the player is on a non-paired team in that Season. |
| 2 | Roster "move" (no dedicated function) | Composed client-side from two `applyRosterChanges` calls (remove on team A, add on team B). | Each call atomic; the pair is **not** | One Season (same-Season move, incl. Hinrunde to Rückrunde = two Team rows, one Season). Cross-Season moves are impossible: conflict check and `seasonId` are per team. |
| 3 | `src/api/teams.ts` : `cloneTeamsFromSeason` | `team.create` + `teamPlayer.createMany` copying each source roster | Yes | Two Seasons read/written: source (read only) and **target** (changed). Refuses if target already has teams. Does not copy `half`/`hinrundeTeamId`, so halves become flat teams. |
| 4 | `src/api/teams.ts` : `deleteTeam` | `team.delete`, which **cascades `TeamPlayer`**; nulls `half` on the surviving pair | Yes | One: `team.seasonId`. |
| 5 | `src/api/teams.ts` : `createRueckrundeTeam` | `team.update` (half) + `team.create`; new half has an **empty** roster | Yes | One. Matters only if stats split by Team Half. |
| 6 | `src/api/teams.ts` : `createTeam`, `updateTeam` | Team create / update (title, league, clickTTGroupId). `createTeam` sets `seasonId`. No TeamPlayer change. | No (single statement) | One. Relevant only if stats count Teams/leagues. |
| 7 | `src/api/players.ts` : `deletePlayer` | `player.delete`, which **cascades `TeamPlayer`**. Fails (FK restrict) if the Player has any `Placement`. | No (single statement; cascade is DB-level) | Many: every Season where the Player had a Roster Membership. |
| 8 | `src/api/seasons.ts` : `deleteSeason` | `season.delete` (cascades `TeamPlayer`) | Yes | One. Guard blocks when `team.count > 0` or non-deleted Appointments exist, so the `TeamPlayer` cascade is effectively unreachable. Soft-deleted Appointments do not block; their `seasonId` is silently set null. |

## Player attributes

| # | File : function | Operation | In `$transaction`? | Season(s) affected |
|---|---|---|---|---|
| 9 | `src/api/players.ts` : `createPlayer` | `player.create` (gender, year, qttr). No Roster Membership yet. | No | None until a roster add. |
| 10 | `src/api/players.ts` : `updatePlayer` | `player.update` (gender, year, qttr). A future eligibility flag would go through here. | No | **All** Seasons where the Player has a TeamPlayer or Placement. Not derivable from the input; needs a lookup. |
| 11 | `src/api/players.ts` : `deletePlayer` | See row 7 | No | Many |

## Placements and Appointments (Season Player count)

| # | File : function | Operation | In `$transaction`? | Season(s) affected |
|---|---|---|---|---|
| 12 | `src/api/placements.ts` : `createPlacement`, `updatePlacement`, `deletePlacement` | Placement create/update/delete | No | One: the Appointment's `seasonId` (null for HOLIDAY). |
| 13 | `src/api/appointments.ts` : `updateAppointment` (~line 577) | Can **change `seasonId`** (also writes a `Transaction` journal row) | Yes | **Two**: old and new Season, for every Placement on that Appointment. |
| 14 | `src/api/appointments.ts` : `createAppointment`, `bulkCopyAppointmentsToSeason` | Create / copy Appointments (copies carry no Placements) | Yes (both) | One (target); no Placements, so no Season Player change. |
| 15 | `src/api/appointments.ts` : `deleteAppointment`, `restoreAppointment` (single); `bulkDeleteAppointments`, `bulkRestoreAppointments` (batched) | Soft delete / restore via `deletedAt`; Placements remain | Single: no `$transaction` found. Bulk: yes, one `$transaction` per batch (line ~795). | One: the Appointment's Season. Needs an explicit decision on whether Placements of trashed Appointments count. |

## Seasons and the importer

| # | File : function | Operation | In `$transaction`? | Season(s) affected |
|---|---|---|---|---|
| 16 | `src/api/seasons.ts` : `createSeason` | `season.create` (inactive) | No | One (new, no data) |
| 17 | `src/api/seasons.ts` : `updateSeason` | Rename only | No | One; label only |
| 18 | `src/api/seasons.ts` : `setActiveSeason` | `updateMany isActive=false` then `update isActive=true` | Yes | **Two**: previous and new active Season. No roster data changes. |
| 19 | `src/api/seasons.ts` : `deleteSeason` | See row 8 | Yes | One |
| 20 | `src/importers/clickTT-importer.server.ts` : `clickTTImporter.run` (invoked by `src/api/imports.ts` : `runImport`) | Does **not** touch Player or TeamPlayer. Writes `Standing` (`persistStandings`), `Team.placement`, and TEAM_MATCH Appointments (`persistEntity`). | Standings: batch `$transaction([...])`. `Team.placement`: no. Appointments: yes (`src/api/imports.ts:43,82`, with `Transaction` row). | One: Active Season only (`activeSeasonFilter`); appointment `seasonId` derives from `ownTeam.seasonId`. Feeds table-placement/standing stats only. |
| 21 | `src/api/imports.ts` : `setImporterEnabled` | Importer settings upsert | No | None |

## Seed and fixtures

| # | File | Operation | In `$transaction`? | Season(s) |
|---|---|---|---|---|
| 22 | `prisma/seed.ts` | Wipes placement, teamPlayer, team, player, season via `deleteMany` (lines 12-19), then creates Season "2025/26" (active), 2 Teams, 2 Players, 2 `TeamPlayer` rows, appointments | No | All (wipe), then one. Any materialised stats table must be wiped here too. |
| 23 | `e2e/seed-copy-to-season.ts`, e2e specs (`players`, `teams`, `stats`) | Direct Prisma writes of season/team/player/teamPlayer in the test DB | No | Test DB only; same caveat |

## Existing readers to keep consistent (not mutations)

`src/api/stats.ts`: `getPlayerCountOverSeasons`, `getRosterBreakdown`, `getTournamentSeriesPlacements` read `teamPlayer` / `placement` / `appointment` directly (read-time computation today).

## Findings relevant to the design

1. TeamPlayer writes funnel through `applyRosterChanges` and `cloneTeamsFromSeason` (both transactional) plus cascades from `deleteTeam`, `deletePlayer`, `deleteSeason`. No other roster mutation exists in `src/`; the seed creates rows directly.
2. Player edits and deletes carry no Season in their input; affected Seasons must be looked up from TeamPlayer/Placement, or stats computed at read time.
3. `deletePlayer` is not transactional and relies on DB cascade, so a refresh hook would have to live in the same statement or the stats must be read-time. It fails with a raw FK error when Placements exist.
4. `applyRosterChanges.removes` is not scoped to the team; derive affected Seasons from deleted rows' `seasonId`, not from `teamId`.
5. A roster "move" is two separate transactions, so a materialised stats row could be briefly inconsistent between them.
6. The importer never touches roster data; it affects Active-Season Team table placement and standings only.
7. `updateAppointment` changing `seasonId` moves Placements between two Seasons (Season Player counts); with `setActiveSeason` it is the only two-Season mutation besides `cloneTeamsFromSeason`.
8. Deleting a Season that has only soft-deleted Appointments sets their `seasonId` to null (default SetNull), orphaning their Placements from any Season.

Open question: a future eligibility flag is not in the schema. If on `Player`, it follows row 10; if per-Season, it belongs on `TeamPlayer`.
