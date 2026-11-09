import {
	groupPlacementsByCategory,
	sortPlacementsByRank,
} from "@/lib/placements";

export type TournamentSeriesPlacement = {
	playerId: string;
	playerName: string;
	placement: string | null;
};

export type TournamentSeriesCategory = {
	category: string;
	placements: TournamentSeriesPlacement[];
};

export type TournamentSeriesNode = {
	appointmentId: string;
	title: string;
	seasonLabel: string;
	date: Date;
	isCurrent: boolean;
	previousIds: string[];
	nextId: string | null;
	categories: TournamentSeriesCategory[];
};

export type TournamentSeries = {
	seriesId: string;
	nodes: TournamentSeriesNode[];
};

// What buildTournamentSeries needs of each non-deleted TOURNAMENT
// Appointment (the query lives in StatsApi.tournamentSeries).
export type SeriesAppointment = {
	id: string;
	title: string;
	startDate: Date;
	seasonId: string | null;
	season: { name: string } | null;
	nextAppointmentId: string | null;
	placements: {
		category: string;
		placement: string | null;
		playerId: string;
		player: { name: string };
	}[];
};

// Every Tournament Series with at least one non-deleted TOURNAMENT
// Appointment in the given Season — see CONTEXT.md's "Tournament Series"
// entry. A series is the full connected graph reachable by following
// Appointment.nextAppointmentId/previousAppointments in both directions,
// not just the appointment(s) that happen to fall in the selected season:
// nextAppointmentId is a single scalar FK (an appointment has at most one
// forward link), but nothing enforces uniqueness on it, so several
// different appointments can all point at the same next appointment —
// that's how a series branches (e.g. two regional qualifiers both feeding
// into one final), producing a node with more than one entry in its
// reverse previousAppointments relation. SQLite via Prisma doesn't support
// recursive queries, so every non-deleted TOURNAMENT appointment is loaded
// once and the graph is walked in memory to find each connected component.
export function buildTournamentSeries(
	appointments: SeriesAppointment[],
	seasonId: string,
): TournamentSeries[] {
	const byId = new Map(appointments.map((a) => [a.id, a]));
	const previousIdsById = new Map<string, string[]>();
	for (const a of appointments) {
		if (!a.nextAppointmentId) continue;
		const previous = previousIdsById.get(a.nextAppointmentId) ?? [];
		previous.push(a.id);
		previousIdsById.set(a.nextAppointmentId, previous);
	}

	const connectedComponent = (seedId: string) => {
		const visited = new Set<string>();
		const stack = [seedId];
		while (stack.length > 0) {
			const id = stack.pop();
			if (!id || visited.has(id)) continue;
			visited.add(id);
			const appointment = byId.get(id);
			if (appointment?.nextAppointmentId) {
				stack.push(appointment.nextAppointmentId);
			}
			for (const previousId of previousIdsById.get(id) ?? []) {
				stack.push(previousId);
			}
		}
		return visited;
	};

	const seedIds = appointments
		.filter((a) => a.seasonId === seasonId)
		.map((a) => a.id);

	const includedIds = new Set<string>();
	const series: TournamentSeries[] = [];
	for (const seedId of seedIds) {
		if (includedIds.has(seedId)) continue;
		const componentIds = connectedComponent(seedId);
		for (const id of componentIds) includedIds.add(id);

		const nodes: TournamentSeriesNode[] = [...componentIds]
			.map((id) => byId.get(id))
			.filter((a) => a !== undefined)
			.sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
			.map((a) => ({
				appointmentId: a.id,
				categories: groupPlacementsByCategory(a.placements).map((group) => ({
					category: group.category,
					placements: sortPlacementsByRank(group.placements).map((p) => ({
						placement: p.placement,
						playerId: p.playerId,
						playerName: p.player.name,
					})),
				})),
				date: a.startDate,
				isCurrent: a.seasonId === seasonId,
				nextId: a.nextAppointmentId,
				previousIds: previousIdsById.get(a.id) ?? [],
				seasonLabel: a.season?.name ?? "—",
				title: a.title,
			}));

		series.push({ nodes, seriesId: seedId });
	}

	return series;
}
