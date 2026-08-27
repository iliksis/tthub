import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { activeSeasonFilter } from "@/lib/season";
import { useIsRole } from "@/lib/session";
import { m } from "@/paraglide/messages";

// Only the active-season membership (at most one, per the roster's unique
// constraint) — list/filter views only care about a player's *current*
// team, not their full history (that's getPlayer's job).
const currentTeamInclude = {
	teams: {
		include: { team: true },
		where: { team: { season: activeSeasonFilter } },
	},
} as const;

export const searchPlayers = createServerFn()
	.validator((d: { query?: string }) => d)
	.handler(async ({ data }) => {
		try {
			const players = await prismaClient.player.findMany({
				include: currentTeamInclude,
				orderBy: { name: "asc" },
				take: 10,
				where: {
					name: { contains: data.query ?? "" },
				},
			});
			return { data: players, message: m.players_players_found() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getPlayers = createServerFn({ method: "GET" })
	.validator((d: { seasonId?: string }) => d)
	.handler(async ({ data }) => {
		try {
			const players = await prismaClient.player.findMany({
				include: {
					teams: {
						include: { team: true },
						where: {
							team: {
								season: data.seasonId
									? { id: data.seasonId }
									: activeSeasonFilter,
							},
						},
					},
				},
				orderBy: { name: "asc" },
			});
			return { data: players, message: m.players_players_found() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const createPlayer = createServerFn({ method: "POST" })
	.validator((d: { name: string; year: number; qttr: number }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const player = await prismaClient.player.create({
				data: {
					name: data.name,
					qttr: data.qttr ?? 0,
					year: data.year,
				},
			});
			return { data: player, message: m.players_player_created() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getPlayer = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		try {
			const player = await prismaClient.player.findUnique({
				include: {
					placements: {
						include: {
							appointment: {
								select: { startDate: true, title: true },
							},
						},
					},
					teams: {
						include: { team: { include: { season: true } } },
						orderBy: { createdAt: "desc" },
					},
				},
				where: { id: data.id },
			});
			if (!player) {
				throw new Error(m.players_player_not_found());
			}
			return { data: player, message: m.players_player_found() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const updatePlayer = createServerFn()
	.validator((d: { id: string; name: string; year: number; qttr: number }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const player = await prismaClient.player.update({
				data: {
					name: data.name,
					qttr: data.qttr,
					year: data.year,
				},
				where: {
					id: data.id,
				},
			});
			return { data: player, message: m.players_player_updated() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const deletePlayer = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}
		try {
			const player = await prismaClient.player.delete({
				where: {
					id: data.id,
				},
			});
			return { data: player, message: m.players_player_deleted() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});
