import { AGE_GROUPS, type AgeGroup, calculateAgeGroup } from "@/lib/ageGroup";
import type { Player, PrismaClient } from "@/lib/prisma/client";

export type GenderCounts = { male: number; female: number; unknown: number };

export type AgeGroupBreakdownRow = {
	ageGroup: AgeGroup;
	eligible: GenderCounts;
	notEligible: GenderCounts;
};

export type AgeGroupBreakdown = {
	rows: AgeGroupBreakdownRow[];
	total: number;
};

export type BreakdownPlayer = Pick<
	Player,
	"year" | "gender" | "isEligibleToPlay"
>;

const emptyCounts = (): GenderCounts => ({ female: 0, male: 0, unknown: 0 });

export const sumCounts = (a: GenderCounts, b: GenderCounts): GenderCounts => ({
	female: a.female + b.female,
	male: a.male + b.male,
	unknown: a.unknown + b.unknown,
});

// Cross-tab of all Players by age group x eligibility x gender. Every age
// group is always present, in AGE_GROUPS order, so the shape is stable.
export function buildAgeGroupBreakdown(
	players: BreakdownPlayer[],
	referenceYear: number,
): AgeGroupBreakdown {
	const rows = new Map<AgeGroup, AgeGroupBreakdownRow>(
		AGE_GROUPS.map((ageGroup) => [
			ageGroup,
			{ ageGroup, eligible: emptyCounts(), notEligible: emptyCounts() },
		]),
	);
	let total = 0;
	for (const player of players) {
		const row = rows.get(calculateAgeGroup(player.year, referenceYear));
		if (!row) continue;
		const counts = player.isEligibleToPlay ? row.eligible : row.notEligible;
		if (player.gender === "MALE") counts.male++;
		else if (player.gender === "FEMALE") counts.female++;
		else counts.unknown++;
		total++;
	}
	return { rows: [...rows.values()], total };
}

// Age group x gender counts of rostered Players for the roster snapshot on the
// stats page (eligibility is merged away). A Player on several Teams (or both
// Team Halves) is counted once. This is the rostered population, unlike the
// stored Season Statistics breakdown, which covers every Player.
export function buildRosterAgeGroupCounts(
	players: (BreakdownPlayer & { id: string })[],
	referenceYear: number,
) {
	const unique = [...new Map(players.map((p) => [p.id, p])).values()];
	const breakdown = buildAgeGroupBreakdown(unique, referenceYear);
	return {
		rows: breakdown.rows.map((row) => ({
			ageGroup: row.ageGroup,
			...sumCounts(row.eligible, row.notEligible),
		})),
		total: breakdown.total,
	};
}

export type SeasonCountRow = {
	seasonId: string;
	seasonName: string;
	playerCount: number | null;
	eligibleCount: number | null;
	maleCount: number | null;
	femaleCount: number | null;
};

// One row per Season for the player-count chart. A Season without a stored
// record is untracked (all counts null); `playerCount` is also null on
// Seasons that predate the all-Player count.
export function buildSeasonCountOverview(
	seasons: {
		id: string;
		name: string;
		statistics: {
			playerCount: number | null;
			eligibleCount: number;
			eligibleMaleCount: number;
			eligibleFemaleCount: number;
		} | null;
	}[],
): SeasonCountRow[] {
	return seasons.map((s) => ({
		eligibleCount: s.statistics?.eligibleCount ?? null,
		femaleCount: s.statistics?.eligibleFemaleCount ?? null,
		maleCount: s.statistics?.eligibleMaleCount ?? null,
		playerCount: s.statistics?.playerCount ?? null,
		seasonId: s.id,
		seasonName: s.name,
	}));
}

// Any Prisma client, including an interactive-transaction client.
type StatisticsDb = Pick<
	PrismaClient,
	"player" | "season" | "seasonStatistics"
>;

// Rebuilds the stored Season Statistics record for the given Season from
// every Player (roster memberships and placements do not feed it). Idempotent:
// upserts, so a second run yields the same figures with a fresh computedAt.
// Overwrites whatever record exists, so callers must only pass a Season that
// is still being tracked (the Active Season); past Seasons are snapshots.
export async function recomputeSeasonStatistics(
	db: StatisticsDb,
	seasonId: string,
	referenceYear = new Date().getFullYear(),
) {
	const players = await db.player.findMany({
		select: { gender: true, isEligibleToPlay: true, year: true },
	});
	const breakdown = buildAgeGroupBreakdown(players, referenceYear);
	const eligible = breakdown.rows.reduce(
		(acc, row) => sumCounts(acc, row.eligible),
		emptyCounts(),
	);
	const figures = {
		breakdown,
		eligibleCount: eligible.male + eligible.female + eligible.unknown,
		eligibleFemaleCount: eligible.female,
		eligibleMaleCount: eligible.male,
		playerCount: breakdown.total,
	};
	return db.seasonStatistics.upsert({
		create: { seasonId, ...figures },
		update: figures,
		where: { seasonId },
	});
}

// Recomputes the Active Season's record; a no-op (null) without one.
export async function recomputeActiveSeasonStatistics(
	db: StatisticsDb,
	referenceYear = new Date().getFullYear(),
) {
	const active = await db.season.findFirst({ where: { isActive: true } });
	if (!active) return null;
	return recomputeSeasonStatistics(db, active.id, referenceYear);
}
