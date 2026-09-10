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

export type TournamentSeriesAppointment = {
	appointmentId: string;
	title: string;
	categories: TournamentSeriesCategory[];
};

// Every non-deleted TOURNAMENT Appointment dated in the given Season — see
// CONTEXT.md's "Tournament Series" entry. Appointment.seasonId already scopes
// each Appointment to a single Season regardless of its
// nextAppointmentId/previousAppointments chain, so an Appointment that's part
// of a multi-season series is only ever returned for the Season it actually
// falls in; other appointments in the same chain (past or future seasons)
// aren't included here.
export const getTournamentSeriesPlacements = createServerFn({ method: "GET" })
	.validator((d: { seasonId?: string }) => d)
	.handler(async ({ data }) => {
		try {
			if (!data.seasonId) {
				return { data: [], message: m.stats_stats_found() };
			}

			const appointments = await prismaClient.appointment.findMany({
				orderBy: { startDate: "asc" },
				select: {
					id: true,
					placements: {
						select: {
							category: true,
							placement: true,
							player: { select: { name: true } },
							playerId: true,
						},
					},
					title: true,
				},
				where: {
					deletedAt: null,
					seasonId: data.seasonId,
					type: "TOURNAMENT",
				},
			});

			const series: TournamentSeriesAppointment[] = appointments.map(
				(appointment) => ({
					appointmentId: appointment.id,
					categories: groupPlacementsByCategory(appointment.placements).map(
						(group) => ({
							category: group.category,
							placements: sortPlacementsByRank(group.placements).map((p) => ({
								placement: p.placement,
								playerId: p.playerId,
								playerName: p.player.name,
							})),
						}),
					),
					title: appointment.title,
				}),
			);

			return { data: series, message: m.stats_stats_found() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});
