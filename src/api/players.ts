import { createServerFn } from "@tanstack/react-start";
import { m } from "@/paraglide/messages";
import { run } from "./kernel.server";
import { type PlayerInput, PlayersApi } from "./players.server";

export type { PlayerInput } from "./players.server";

export const searchPlayers = createServerFn()
	.validator((d: { query?: string }) => d)
	.handler(({ data }) =>
		run(PlayersApi, m.players_players_found, (api) => api.search(data.query)),
	);

export const getPlayers = createServerFn({ method: "GET" })
	.validator((d: { seasonId?: string }) => d)
	.handler(({ data }) =>
		run(PlayersApi, m.players_players_found, (api) => api.list(data.seasonId)),
	);

export const createPlayer = createServerFn({ method: "POST" })
	.validator((d: PlayerInput) => d)
	.handler(({ data }) =>
		run(PlayersApi, m.players_player_created, (api) => api.create(data)),
	);

export const getPlayer = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(PlayersApi, m.players_player_found, (api) => api.get(data.id)),
	);

export const updatePlayer = createServerFn()
	.validator((d: Required<PlayerInput> & { id: string }) => d)
	.handler(({ data: { id, ...input } }) =>
		run(PlayersApi, m.players_player_updated, (api) => api.update(id, input)),
	);

export const deletePlayer = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(PlayersApi, m.players_player_deleted, (api) => api.delete(data.id)),
	);
