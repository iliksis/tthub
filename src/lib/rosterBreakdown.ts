import type { Gender } from "@/lib/prisma/enums";
import { calculateAgeGroup } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export type RosterBreakdownRow = {
	ageGroup: string;
	male: number;
	female: number;
	unknown: number;
};

export type RosterBreakdown = {
	rows: RosterBreakdownRow[];
	total: number;
};

type RosterPlayer = { id: string; year: number; gender: Gender | null };

// Age groups in display order. Must match the buckets `calculateAgeGroup`
// returns; the adult label is a message, so the list is built on call.
const ageGroupOrder = () => ["U11", "U13", "U15", "U19", m.players_adult()];

// Cross-tab of rostered Players by age group x gender. A Player on several
// Teams (or both Team Halves) is counted once. Every age group is always
// present, even with zero players, so the table shape is stable.
export function buildRosterBreakdown(players: RosterPlayer[]): RosterBreakdown {
	const unique = new Map(players.map((p) => [p.id, p]));
	const rows = new Map<string, RosterBreakdownRow>(
		ageGroupOrder().map((ageGroup) => [
			ageGroup,
			{ ageGroup, female: 0, male: 0, unknown: 0 },
		]),
	);
	for (const player of unique.values()) {
		const row = rows.get(calculateAgeGroup(player.year));
		if (!row) continue;
		if (player.gender === "MALE") row.male++;
		else if (player.gender === "FEMALE") row.female++;
		else row.unknown++;
	}
	return { rows: [...rows.values()], total: unique.size };
}
