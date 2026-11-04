import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import {
	groupPlacementsByCategory,
	sortPlacementsByRank,
} from "@/lib/placements";
import type { Gender } from "@/lib/prisma/enums";
import { buildAgeGroupBreakdown } from "@/lib/seasonStatistics";
import { m } from "@/paraglide/messages";

export type SeasonPlayerCount = {
	seasonId: string;
	seasonName: string;
	playerCount: number;
	maleCount: number;
	femaleCount: number;
};

// Season Player count for every Season, oldest first — see CONTEXT.md's
// "Season Player" entry. A Season Player is a Player with a Roster
// Membership (TeamPlayer) or a Placement on a non-deleted Appointment in that
// Season; the two are unioned and deduplicated per Season. Players without a
// recorded gender only count towards the total. Deliberately independent of
// the stats page's season selector.
export const getPlayerCountOverSeasons = createServerFn({
	method: "GET",
}).handler(async () => {
	try {
		const playerSelect = { select: { gender: true, id: true } };
		const [seasons, rostered, placed] = await Promise.all([
			prismaClient.season.findMany({ orderBy: { createdAt: "asc" } }),
			prismaClient.teamPlayer.findMany({
				distinct: ["seasonId", "playerId"],
				select: { player: playerSelect, seasonId: true },
			}),
			prismaClient.placement.findMany({
				select: {
					appointment: { select: { seasonId: true } },
					player: playerSelect,
				},
				where: { appointment: { deletedAt: null } },
			}),
		]);

		type PlayerRef = { id: string; gender: Gender | null };
		const playersBySeason = new Map<string, Map<string, PlayerRef>>();
		const addToSeason = (seasonId: string, player: PlayerRef) => {
			let players = playersBySeason.get(seasonId);
			if (!players) {
				players = new Map();
				playersBySeason.set(seasonId, players);
			}
			players.set(player.id, player);
		};
		for (const tp of rostered) addToSeason(tp.seasonId, tp.player);
		for (const p of placed) {
			if (p.appointment.seasonId) addToSeason(p.appointment.seasonId, p.player);
		}

		const counts: SeasonPlayerCount[] = seasons.map((season) => {
			const players = [...(playersBySeason.get(season.id)?.values() ?? [])];
			return {
				femaleCount: players.filter((p) => p.gender === "FEMALE").length,
				maleCount: players.filter((p) => p.gender === "MALE").length,
				playerCount: players.length,
				seasonId: season.id,
				seasonName: season.name,
			};
		});
		return { data: counts, message: m.stats_stats_found() };
	} catch (e) {
		console.error(e);
		throw new Error((e as Error).message);
	}
});

// Live snapshot of the Active Season's currently-rostered Players by age
// group x gender. Deliberately independent of the stats page's season
// selector: it always describes the Active Season as of today.
export const getRosterBreakdown = createServerFn({ method: "GET" }).handler(
	async () => {
		try {
			const rostered = await prismaClient.teamPlayer.findMany({
				select: {
					player: {
						select: {
							gender: true,
							id: true,
							isEligibleToPlay: true,
							year: true,
						},
					},
				},
				where: { season: { isActive: true } },
			});
			// A Player on several Teams (or both halves) counts once.
			const unique = [
				...new Map(rostered.map((tp) => [tp.player.id, tp.player])).values(),
			];
			const breakdown = buildAgeGroupBreakdown(
				unique,
				new Date().getFullYear(),
			);
			return {
				data: {
					rows: breakdown.rows.map((row) => ({
						ageGroup: row.ageGroup,
						female: row.eligible.female + row.notEligible.female,
						male: row.eligible.male + row.notEligible.male,
						unknown: row.eligible.unknown + row.notEligible.unknown,
					})),
					total: breakdown.total,
				},
				message: m.stats_stats_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	},
);

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
