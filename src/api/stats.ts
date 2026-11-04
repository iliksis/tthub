import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import {
	groupPlacementsByCategory,
	sortPlacementsByRank,
} from "@/lib/placements";
import {
	buildSeasonBreakdown,
	buildSeasonCountOverview,
} from "@/lib/seasonStatistics";
import { m } from "@/paraglide/messages";

// Stored Season Statistics counts for every Season, oldest first. Seasons
// without a record come back with null counts. Deliberately independent of
// the stats page's season selector.
export const getSeasonCountOverview = createServerFn({
	method: "GET",
}).handler(async () => {
	try {
		const seasons = await prismaClient.season.findMany({
			include: { statistics: true },
			orderBy: { createdAt: "asc" },
		});
		return {
			data: buildSeasonCountOverview(seasons),
			message: m.stats_stats_found(),
		};
	} catch (e) {
		console.error(e);
		throw new Error((e as Error).message);
	}
});

// One Season's stored age group x gender x eligibility breakdown and when it
// was computed. A Season without a record, or with an untracked (null)
// breakdown, comes back all-zero with `tracked: false` rather than throwing.
export const getSeasonBreakdown = createServerFn({ method: "GET" })
	.validator((d: { seasonId?: string }) => d)
	.handler(async ({ data }) => {
		try {
			const record = data.seasonId
				? await prismaClient.seasonStatistics.findUnique({
						select: { breakdown: true, computedAt: true },
						where: { seasonId: data.seasonId },
					})
				: null;
			const breakdown = buildSeasonBreakdown(record);
			// A null breakdown is "not tracked"; a non-null one that fails
			// validation is corrupt data and must not pass silently.
			if (record?.breakdown != null && !breakdown.tracked) {
				console.warn(
					`Season ${data.seasonId}: stored breakdown failed validation, treating it as untracked`,
				);
			}
			return { data: breakdown, message: m.stats_stats_found() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

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

// Every Tournament Series with at least one non-deleted TOURNAMENT
// Appointment in the given Season — see CONTEXT.md's "Tournament Series"
// entry. A series is the full connected graph reachable by following
// Appointment.nextAppointmentId/previousAppointments in both directions, not
// just the appointment(s) that happen to fall in the selected season:
// nextAppointmentId is a single scalar FK (an appointment has at most one
// forward link), but nothing enforces uniqueness on it, so several different
// appointments can all point at the same next appointment — that's how a
// series branches (e.g. two regional qualifiers both feeding into one
// final), producing a node with more than one entry in its reverse
// previousAppointments relation. SQLite via Prisma doesn't support recursive
// queries, so every non-deleted TOURNAMENT appointment is loaded once and the
// graph is walked in memory to find each connected component.
export const getTournamentSeriesPlacements = createServerFn({ method: "GET" })
	.validator((d: { seasonId?: string }) => d)
	.handler(async ({ data }) => {
		try {
			if (!data.seasonId) {
				return { data: [], message: m.stats_stats_found() };
			}

			const appointments = await prismaClient.appointment.findMany({
				orderBy: { startDate: "desc" },
				select: {
					id: true,
					nextAppointmentId: true,
					placements: {
						select: {
							category: true,
							placement: true,
							player: { select: { name: true } },
							playerId: true,
						},
					},
					season: { select: { name: true } },
					seasonId: true,
					startDate: true,
					title: true,
				},
				where: { deletedAt: null, type: "TOURNAMENT" },
			});

			const byId = new Map(appointments.map((a) => [a.id, a]));
			const previousIdsById = new Map<string, string[]>();
			for (const a of appointments) {
				if (!a.nextAppointmentId) continue;
				const previous = previousIdsById.get(a.nextAppointmentId) ?? [];
				previous.push(a.id);
				previousIdsById.set(a.nextAppointmentId, previous);
			}

			function connectedComponent(seedId: string) {
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
			}

			const seedIds = appointments
				.filter((a) => a.seasonId === data.seasonId)
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
						categories: groupPlacementsByCategory(a.placements).map(
							(group) => ({
								category: group.category,
								placements: sortPlacementsByRank(group.placements).map((p) => ({
									placement: p.placement,
									playerId: p.playerId,
									playerName: p.player.name,
								})),
							}),
						),
						date: a.startDate,
						isCurrent: a.seasonId === data.seasonId,
						nextId: a.nextAppointmentId,
						previousIds: previousIdsById.get(a.id) ?? [],
						seasonLabel: a.season?.name ?? "—",
						title: a.title,
					}));

				series.push({ nodes, seriesId: seedId });
			}

			return { data: series, message: m.stats_stats_found() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});
