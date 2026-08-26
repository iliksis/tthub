// Shared fragment for Prisma `where` clauses that need to scope a query to
// the single active Season, e.g. `{ season: activeSeasonFilter }` or
// `{ team: { season: activeSeasonFilter } }`.
export const activeSeasonFilter = { isActive: true } as const;
