import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { m } from "@/paraglide/messages";

// Distinct Players with a Placement on a Top-Level Tournament Appointment in
// the given Season — see CONTEXT.md's "Top-Level Tournament" and
// "Participating Player" entries. A Top-Level Tournament is a TOURNAMENT
// Appointment carrying at least one Label an editor has flagged via
// Label.countsForStats (src/api/labels.ts).
export const getTopLevelTournamentParticipation = createServerFn({
	method: "GET",
})
	.validator((d: { seasonId?: string }) => d)
	.handler(async ({ data }) => {
		try {
			if (!data.seasonId) {
				return { data: 0, message: m.stats_stats_found() };
			}

			const participants = await prismaClient.placement.findMany({
				distinct: ["playerId"],
				select: { playerId: true },
				where: {
					appointment: {
						deletedAt: null,
						labels: { some: { label: { countsForStats: true } } },
						seasonId: data.seasonId,
						type: "TOURNAMENT",
					},
				},
			});
			return { data: participants.length, message: m.stats_stats_found() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});
