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

const isCount = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= 0;

const isGenderCounts = (value: unknown): value is GenderCounts =>
	typeof value === "object" &&
	value !== null &&
	isCount((value as GenderCounts).male) &&
	isCount((value as GenderCounts).female) &&
	isCount((value as GenderCounts).unknown);

const sumGenderCounts = (c: GenderCounts) => c.male + c.female + c.unknown;

// Narrow guard for the stored breakdown JSON, so callers never see untyped
// data: the five stable age-group rows in fixed order, every count a
// non-negative integer, and `total` equal to the sum of all counts.
export function isAgeGroupBreakdown(
	value: unknown,
): value is AgeGroupBreakdown {
	if (typeof value !== "object" || value === null) return false;
	const { rows, total } = value as Partial<AgeGroupBreakdown>;
	if (
		!isCount(total) ||
		!Array.isArray(rows) ||
		rows.length !== AGE_GROUPS.length
	) {
		return false;
	}
	let sum = 0;
	for (const [index, row] of rows.entries()) {
		if (
			typeof row !== "object" ||
			row === null ||
			row.ageGroup !== AGE_GROUPS[index] ||
			!isGenderCounts(row.eligible) ||
			!isGenderCounts(row.notEligible)
		) {
			return false;
		}
		sum += sumGenderCounts(row.eligible) + sumGenderCounts(row.notEligible);
	}
	return sum === total;
}

// `tracked: false` means the Season has no stored record or its breakdown is
// not tracked (null): the rows are then all zero and must not be drawn. A
// tracked breakdown always has a computedAt.
export type SeasonBreakdown = AgeGroupBreakdown &
	(
		| { tracked: true; computedAt: Date }
		| { tracked: false; computedAt: Date | null }
	);

// What the stats page shows for one Season. A missing record, a null
// breakdown and a malformed one all read as untracked and all-zero instead
// of throwing.
export function buildSeasonBreakdown(
	record: { breakdown: unknown; computedAt: Date } | null,
): SeasonBreakdown {
	if (record && isAgeGroupBreakdown(record.breakdown)) {
		return {
			...record.breakdown,
			computedAt: record.computedAt,
			tracked: true,
		};
	}
	return {
		...buildAgeGroupBreakdown([], 0),
		computedAt: record?.computedAt ?? null,
		tracked: false,
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
export type StatisticsDb = Pick<
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
