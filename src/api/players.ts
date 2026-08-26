import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import { t } from "@/lib/text";

// Only the active-season membership (at most one, per the roster's unique
// constraint) — list/filter views only care about a player's *current*
// team, not their full history (that's getPlayer's job).
const currentTeamInclude = {
	teams: {
		include: { team: true },
		where: { team: { season: { isActive: true } } },
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
			return { data: players, message: t("Players found") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getPlayers = createServerFn({ method: "GET" }).handler(
	async () => {
		try {
			const players = await prismaClient.player.findMany({
				include: currentTeamInclude,
				orderBy: { name: "asc" },
			});
			return { data: players, message: t("Players found") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	},
);

export const createPlayer = createServerFn({ method: "POST" })
	.validator((d: { name: string; year: number; qttr: number }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const player = await prismaClient.player.create({
				data: {
					name: data.name,
					qttr: data.qttr ?? 0,
					year: data.year,
				},
			});
			return { data: player, message: t("Player created") };
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
				throw new Error(t("Player not found"));
			}
			return { data: player, message: t("Player found") };
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
			throw new Error(t("Unauthorized"));
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
			return { data: player, message: t("Player updated") };
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
			throw new Error(t("Unauthorized"));
		}
		try {
			const player = await prismaClient.player.delete({
				where: {
					id: data.id,
				},
			});
			return { data: player, message: t("Player deleted") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});
