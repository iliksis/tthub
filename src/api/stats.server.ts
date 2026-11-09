import {
	buildSeasonBreakdown,
	buildSeasonCountOverview,
} from "@/lib/seasonStatistics";
import {
	buildTournamentSeries,
	type TournamentSeries,
} from "@/lib/tournamentSeries";
import { ApiBase, type Policies } from "./kernel.server";

export class StatsApi extends ApiBase {
	static readonly policy = {
		breakdown: "AUTHENTICATED",
		seasonCountOverview: "AUTHENTICATED",
		tournamentSeries: "AUTHENTICATED",
	} as const satisfies Policies<StatsApi>;

	// Stored Season Statistics counts for every Season, oldest first. Seasons
	// without a record come back with null counts. Deliberately independent of
	// the stats page's season selector.
	async seasonCountOverview() {
		const seasons = await this.ctx.db.season.findMany({
			include: { statistics: true },
			orderBy: { createdAt: "asc" },
		});
		return buildSeasonCountOverview(seasons);
	}

	// One Season's stored age group x gender x eligibility breakdown and when
	// it was computed. A Season without a record, or with an untracked (null)
	// breakdown, comes back all-zero with `tracked: false` rather than throwing.
	async breakdown(seasonId: string | undefined) {
		const record = seasonId
			? await this.ctx.db.seasonStatistics.findUnique({
					select: { breakdown: true, computedAt: true },
					where: { seasonId },
				})
			: null;
		const breakdown = buildSeasonBreakdown(record);
		// A null breakdown is "not tracked"; a non-null one that fails
		// validation is corrupt data and must not pass silently.
		if (record?.breakdown != null && !breakdown.tracked) {
			console.warn(
				`Season ${seasonId}: stored breakdown failed validation, treating it as untracked`,
			);
		}
		return breakdown;
	}

	// See buildTournamentSeries (src/lib/tournamentSeries.ts) and CONTEXT.md's
	// "Tournament Series" entry.
	async tournamentSeries(
		seasonId: string | undefined,
	): Promise<TournamentSeries[]> {
		if (!seasonId) return [];

		const appointments = await this.ctx.db.appointment.findMany({
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

		return buildTournamentSeries(appointments, seasonId);
	}
}
