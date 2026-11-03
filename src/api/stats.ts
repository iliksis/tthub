import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import {
	groupPlacementsByCategory,
	sortPlacementsByRank,
} from "@/lib/placements";
import { m } from "@/paraglide/messages";

export type ParticipatingPlayersByTeam = {
	teamId: string;
	teamTitle: string;
	rosterSize: number;
	participatingCount: number;
};

// Per-Team breakdown of roster size vs. Participating Player count for the
// given Season — see CONTEXT.md's "Participating Player" entry. A
// Participating Player is a Player who both holds a Roster Membership
// (TeamPlayer) for the Team and has at least one Placement on any
// Appointment in the Season.
export const getParticipatingPlayersByTeam = createServerFn({ method: "GET" })
	.validator((d: { seasonId?: string }) => d)
	.handler(async ({ data }) => {
		try {
			if (!data.seasonId) {
				return { data: [], message: m.stats_stats_found() };
			}

			const [teams, placedPlayers] = await Promise.all([
				prismaClient.team.findMany({
					include: { players: { select: { playerId: true } } },
					orderBy: { title: "asc" },
					where: { seasonId: data.seasonId },
				}),
				prismaClient.placement.findMany({
					distinct: ["playerId"],
					select: { playerId: true },
					where: {
						appointment: { deletedAt: null, seasonId: data.seasonId },
					},
				}),
			]);
			const participatingPlayerIds = new Set(
				placedPlayers.map((p) => p.playerId),
			);

			const breakdown: ParticipatingPlayersByTeam[] = teams.map((team) => ({
				participatingCount: team.players.filter((tp) =>
					participatingPlayerIds.has(tp.playerId),
				).length,
				rosterSize: team.players.length,
				teamId: team.id,
				teamTitle: team.title,
			}));
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
