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
A single squad's presence in one Season: its league, table placement, standings, and roster all belong to that Season alone. A club fielding the same squad across multiple seasons has one Team row per Season, not one Team reused over time.
_Avoid_: Squad (unless quoting league terminology), club (Team is one squad, not the whole club).

**Roster Membership**:
The record of one Player belonging to one Team (and, transitively, one Season). A Player can hold at most one Roster Membership per Season. The history of a Player's Roster Memberships across Seasons is how "which team did this player play for in 2024/2025" gets answered.
_Avoid_: Team assignment, Player.teamId (the old single-FK shape this replaces).

**Table Placement**:
A Team's league standing/rank for its Season (the existing free-text `Team.placement` field). Distinct from **Placement** (below) despite the shared English word — this is a league table position, not a tournament result.
_Avoid_: Placement alone when referring to a Team's league rank — always qualify as "table placement" in discussion to avoid collision with the Placement entity.

**Placement**:
A Player's result in one category of one tournament Appointment (existing `Placement` model). Unrelated to a Team's league standing.
_Avoid_: Ranking, result (when precision matters).

**Label**:
An editor-created tag (name + color) attached to a tournament Appointment to convey an arbitrary attribute — e.g. the region it takes place in, or that it matters for coaches. Labels are purely informational: they never gate RSVP or notification behavior for the appointment itself. A tournament can carry any number of Labels, including none. Replaces the old `TOURNAMENT`/`TOURNAMENT_DE` type split, which conflated "region" with the appointment's type and silently suppressed RSVP/notifications for one of the two. An editor can additionally flag a Label as counting toward **Top-Level Tournament** stats (below) — this still doesn't gate RSVP/notifications, it only feeds the season statistics page.
_Avoid_: Tag, category, type (Label is the canonical term; "type" now refers only to `AppointmentType`, which Labels are independent of).

**Top-Level Tournament**:
A `TOURNAMENT`-type Appointment carrying at least one Label an editor has flagged as counting toward top-level tournament stats (e.g. a regional/national championship). "Top-level" is entirely a function of which Label(s) a tournament carries — there's no separate tier field on Appointment itself.
_Avoid_: Major tournament, championship (imprecise — the actual set of qualifying tournaments is whatever Labels editors flag, not a fixed category).

**Participating Player**:
A Player who, within one Season, both holds a Roster Membership and has at least one Placement on any Appointment in that Season — i.e. actually played, not just rostered. Independent of whether that Placement came from a Top-Level Tournament specifically.
_Avoid_: Active player (collides with **Active Season**'s existing, unrelated meaning — "active" always refers to the single `isActive` Season).

**Muted Label** (in a user's notification/feed preferences):
A Label a user has chosen to suppress — appointments carrying it are excluded from that user's push notifications or calendar feed, but remain unaffected for every other user. Muting is a personal preference, not a property of the Label or the Appointment.
_Avoid_: Hidden, blocked, filtered (when precision matters — "muted" ties it to the notification/feed context specifically).
