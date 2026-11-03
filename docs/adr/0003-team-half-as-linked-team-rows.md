# Split-season Team Halves as two linked Team rows

**Status**: accepted

Some leagues (mainly youth) split a Team's season into two competitive rounds — Hinrunde and Rückrunde — each with its own league, table placement, and (critically) roster, since a squad's lineup can change between rounds. We considered adding a second, parallel set of league/placement/roster fields directly onto `Team` (`hinrundeLeague`/`rueckrundeLeague`, a second `clickTTGroupId`, etc.) versus representing each half as its own `Team` row, linked to its counterpart.

We chose two linked rows, extending the precedent from [ADR 0001](./0001-season-scoped-teams-and-roster-history.md) ("each competitive period is its own Team row" — there, a Season; here, a half of one). This means `Standing`, `clickTTGroupId` uniqueness, and roster editing all keep working per-row exactly as they do today, with no new parallel-field plumbing bolted onto `Team`. It costs a display-layer responsibility: anywhere a "team" is shown compactly (lists, cards, a Player's roster line) must resolve the pair down to one — the Rückrunde row's data if it exists, else the Hinrunde row's — while each half's own detail page shows only its own row's data plus a link to its pair.

Consequence: `TeamPlayer`'s uniqueness relaxes from "at most one Roster Membership per Player per Season" (ADR 0001) to "at most one per Player per Team" — a Player can now hold two Roster Memberships in the same Season if their squad splits (one per half). The pairing itself is optional and nullable: a non-split Team is unaffected, remaining a single unpaired row.
