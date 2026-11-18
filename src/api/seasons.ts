import { createServerFn } from "@tanstack/react-start";
import { m } from "@/paraglide/messages";
import { run } from "./kernel.server";
import { SeasonsApi } from "./seasons.server";

export const getSeasons = createServerFn({ method: "GET" }).handler(() =>
	run(SeasonsApi, m.seasons_seasons_found, (api) => api.list()),
);

export const getSeasonsWithStats = createServerFn({ method: "GET" }).handler(
	() => run(SeasonsApi, m.seasons_seasons_found, (api) => api.listWithCounts()),
);

export const getActiveSeason = createServerFn({ method: "GET" }).handler(() =>
	run(SeasonsApi, m.seasons_active_season_found, (api) => api.active()),
);

export const createSeason = createServerFn({ method: "POST" })
	.validator((d: { name: string }) => d)
	.handler(({ data }) =>
		run(SeasonsApi, m.seasons_season_created, (api) => api.create(data.name)),
	);

export const updateSeason = createServerFn()
	.validator((d: { id: string; name: string }) => d)
	.handler(({ data }) =>
		run(SeasonsApi, m.seasons_season_updated, (api) =>
			api.update(data.id, data.name),
		),
	);

export const setActiveSeason = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(SeasonsApi, m.seasons_season_activated, (api) =>
			api.setActive(data.id),
		),
	);

// Recomputes the Active Season's stored statistics on demand.
export const refreshSeasonStatistics = createServerFn({
	method: "POST",
}).handler(() =>
	run(SeasonsApi, m.seasons_statistics_refreshed, (api) =>
		api.refreshStatistics(),
	),
);

export const deleteSeason = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(SeasonsApi, m.seasons_season_deleted, (api) => api.delete(data.id)),
	);
