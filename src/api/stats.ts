import { createServerFn } from "@tanstack/react-start";
import { m } from "@/paraglide/messages";
import { run } from "./kernel.server";
import { StatsApi } from "./stats.server";

export type {
	TournamentSeries,
	TournamentSeriesCategory,
	TournamentSeriesNode,
	TournamentSeriesPlacement,
} from "@/lib/tournamentSeries";

export const getSeasonCountOverview = createServerFn({
	method: "GET",
}).handler(() =>
	run(StatsApi, m.stats_stats_found, (api) => api.seasonCountOverview()),
);

export const getSeasonBreakdown = createServerFn({ method: "GET" })
	.validator((d: { seasonId?: string }) => d)
	.handler(({ data }) =>
		run(StatsApi, m.stats_stats_found, (api) => api.breakdown(data.seasonId)),
	);

export const getTournamentSeriesPlacements = createServerFn({ method: "GET" })
	.validator((d: { seasonId?: string }) => d)
	.handler(({ data }) =>
		run(StatsApi, m.stats_stats_found, (api) =>
			api.tournamentSeries(data.seasonId),
		),
	);
