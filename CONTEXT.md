# TTHub

Personal table tennis club management app: teams, players, tournament/match appointments, RSVPs, placements, and the club calendar feed.

## Language

**Season**:
A named period of club activity (e.g. "2026/2027") that Teams and Appointments belong to. Exactly one Season is the Active Season at a time.
_Avoid_: Campaign, year, term.

**Active Season**:
The single Season currently flagged `isActive`. Set explicitly by an admin/editor toggle — not derived from dates. New Teams/Appointments default to it, and Team/Appointment lists filter to it by default.
_Avoid_: Current season (ambiguous — always say "active").

**Team**:
A single squad's presence in one Season: its league, table placement, standings, and roster all belong to that Season alone. A club fielding the same squad across multiple seasons has one Team row per Season, not one Team reused over time. A Team competing in a league that splits its season into two rounds is represented as two linked Team rows — see **Team Half** — rather than one Team carrying two sets of league/placement data.
_Avoid_: Squad (unless quoting league terminology), club (Team is one squad, not the whole club).

**Team Half** (Hinrunde / Rückrunde):
For a Team whose league splits its season into two competitive rounds, each round is its own Team row, linked to its counterpart: the Hinrunde (first round) and Rückrunde (second round). Each half has its own league, table placement, `clickTTGroupId`, and roster — a squad's Rückrunde lineup can differ from its Hinrunde lineup. The pairing is optional: most Teams have no Rückrunde half and remain a single, unpaired row exactly as before splitting existed. Where a single "team" needs to be shown compactly (team lists, cards, a Player's roster line), the Rückrunde half's data is shown if it exists, otherwise the Hinrunde half's — the more recent of the two.
_Avoid_: Sub-team, phase, split season (the Season itself doesn't split — only a Team's competition within it does).

**Roster Membership**:
The record of one Player belonging to one Team (and, transitively, one Season). A Player can hold at most one Roster Membership per Team. For a Team with a **Team Half** pairing, that means a Player can hold one Roster Membership on the Hinrunde row and a separate one on the Rückrunde row within the same Season — the two are independent, not a single per-Season membership. The history of a Player's Roster Memberships across Seasons is how "which team did this player play for in 2024/2025" gets answered.
_Avoid_: Team assignment, Player.teamId (the old single-FK shape this replaces).

**Table Placement**:
A Team's league standing/rank for its Season (the existing free-text `Team.placement` field). Distinct from **Placement** (below) despite the shared English word — this is a league table position, not a tournament result.
_Avoid_: Placement alone when referring to a Team's league rank — always qualify as "table placement" in discussion to avoid collision with the Placement entity.

**Placement**:
A Player's result in one category of one tournament Appointment (existing `Placement` model). Unrelated to a Team's league standing.
_Avoid_: Ranking, result (when precision matters).

**Label**:
An editor-created tag (name + color) attached to a tournament Appointment to convey an arbitrary attribute — e.g. the region it takes place in, or that it matters for coaches. Labels are purely informational: they never gate RSVP or notification behavior for the appointment itself. A tournament can carry any number of Labels, including none. Replaces the old `TOURNAMENT`/`TOURNAMENT_DE` type split, which conflated "region" with the appointment's type and silently suppressed RSVP/notifications for one of the two.
_Avoid_: Tag, category, type (Label is the canonical term; "type" now refers only to `AppointmentType`, which Labels are independent of).

**Tournament Series**:
A chain of one or more `TOURNAMENT` Appointments linked via `nextAppointmentId`/`previousAppointments` — the same mechanism used for "next appointment" links. A standalone tournament with no linked occurrences is a Tournament Series of length one. The season statistics page groups Placements by Tournament Series, scoped to whichever appointment(s) in the chain fall within the Season being viewed.
_Avoid_: Recurring tournament (doesn't capture the length-one case), tournament chain.

**Season Player**:
A Player who has any footprint in a Season — a Roster Membership, a Placement on any Appointment that Season, or both. Used for the season-over-season player count trend on the statistics page; broader than actually having played (a rostered-but-never-placed Player still counts).
_Avoid_: Participating Player (a stricter, now-unused concept — rostered *and* placed), Active player (collides with **Active Season**'s existing, unrelated meaning — "active" always refers to the single `isActive` Season).

**Muted Label** (in a user's notification/feed preferences):
A Label a user has chosen to suppress — appointments carrying it are excluded from that user's push notifications or calendar feed, but remain unaffected for every other user. Muting is a personal preference, not a property of the Label or the Appointment.
_Avoid_: Hidden, blocked, filtered (when precision matters — "muted" ties it to the notification/feed context specifically).
