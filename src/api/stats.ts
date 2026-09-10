import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
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
