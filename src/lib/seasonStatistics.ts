import type { PrismaClient } from "@/lib/prisma/client";
import type { Gender } from "@/lib/prisma/enums";
import { AGE_GROUPS, type AgeGroup, calculateAgeGroup } from "@/lib/utils";

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

type BreakdownPlayer = {
	year: number;
	gender: Gender | null;
	isEligibleToPlay: boolean;
};

const emptyCounts = (): GenderCounts => ({ female: 0, male: 0, unknown: 0 });

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

// Any Prisma client, including an interactive-transaction client.
type StatisticsDb = Pick<
	PrismaClient,
	"player" | "season" | "seasonStatistics"
>;

// Rebuilds the stored Season Statistics record for one Season from every
// Player (roster memberships and placements do not feed it). Idempotent:
// upserts, so a second run yields the same figures with a fresh computedAt.
export async function recomputeSeasonStatistics(
	db: StatisticsDb,
	seasonId: string,
	referenceYear = new Date().getFullYear(),
) {
	const players = await db.player.findMany({
		select: { gender: true, isEligibleToPlay: true, year: true },
	});
	const breakdown = buildAgeGroupBreakdown(players, referenceYear);
	const eligible = players.filter((p) => p.isEligibleToPlay);
	const figures = {
		breakdown,
		eligibleCount: eligible.length,
		eligibleFemaleCount: eligible.filter((p) => p.gender === "FEMALE").length,
		eligibleMaleCount: eligible.filter((p) => p.gender === "MALE").length,
		playerCount: players.length,
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
