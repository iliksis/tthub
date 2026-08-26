# Season-scoped Teams with a Roster Membership history table

**Status**: accepted

When adding Seasons, we considered letting a Team persist across multiple Seasons (Team↔Season many-to-many, league/placement/standings/roster staying on the same row) versus creating a brand-new Team row per Season. We chose the latter: each Season's squad is its own Team row, since its league, table placement, and standings are already season-specific in practice and conflating them across seasons would mean resetting/archiving those fields manually every year anyway.

This forced a related decision: `Player.teamId` (a single current-team FK) can no longer represent "which team did this player play for in season X". We replaced it with a Roster Membership join table (Player × Team, at most one per Player per Season) so per-season history survives even though Team rows themselves don't span seasons.

Consequence: creating a new season means recreating Team rows (a "copy teams from previous season" bulk action seeds the new season's Team list) and rosters start empty by default (with a per-team "copy roster" action to carry players over) rather than teams/rosters persisting automatically.
