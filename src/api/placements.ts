import { createServerFn } from "@tanstack/react-start";
import { m } from "@/paraglide/messages";
import { run } from "./kernel.server";
import { type PlacementKey, PlacementsApi } from "./placements.server";

export type { PlacementKey } from "./placements.server";

export const createPlacement = createServerFn()
	.validator((d: PlacementKey & { placement?: string }) => d)
	.handler(({ data }) =>
		run(PlacementsApi, m.placements_placement_created, (api) =>
			api.create(data),
		),
	);

export const getUniqueCategories = createServerFn().handler(() =>
	run(PlacementsApi, m.placements_categories_found, (api) => api.categories()),
);

export const updatePlacement = createServerFn()
	.validator((d: PlacementKey & { updates: { placement: string } }) => d)
	.handler(({ data: { updates, ...key } }) =>
		run(PlacementsApi, m.placements_placement_updated, (api) =>
			api.update(key, updates),
		),
	);

export const deletePlacement = createServerFn()
	.validator((d: PlacementKey) => d)
	.handler(({ data }) =>
		run(PlacementsApi, m.placements_placement_deleted, (api) =>
			api.delete(data),
		),
	);
