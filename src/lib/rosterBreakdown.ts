import type { Gender } from "@/lib/prisma/enums";
import { AGE_GROUPS, type AgeGroup, calculateAgeGroup } from "@/lib/utils";

export type RosterBreakdownRow = {
	ageGroup: AgeGroup;
	male: number;
	female: number;
	unknown: number;
};

export type RosterBreakdown = {
	rows: RosterBreakdownRow[];
	total: number;
};

type RosterPlayer = { id: string; year: number; gender: Gender | null };

// Cross-tab of rostered Players by age group x gender. A Player on several
// Teams (or both Team Halves) is counted once. Every age group is always
// present, even with zero players, so the table shape is stable.
export function buildRosterBreakdown(
	players: RosterPlayer[],
	referenceYear: number,
): RosterBreakdown {
	const unique = new Map(players.map((p) => [p.id, p]));
	const rows = new Map<AgeGroup, RosterBreakdownRow>(
		AGE_GROUPS.map((ageGroup) => [
			ageGroup,
			{ ageGroup, female: 0, male: 0, unknown: 0 },
		]),
	);
	let total = 0;
	for (const player of unique.values()) {
		const row = rows.get(calculateAgeGroup(player.year, referenceYear));
		if (!row) continue;
		total++;
		if (player.gender === "MALE") row.male++;
		else if (player.gender === "FEMALE") row.female++;
		else row.unknown++;
	}
	return { rows: [...rows.values()], total };
}
