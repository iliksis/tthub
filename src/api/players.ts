import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import type { Prisma } from "@/lib/prisma/client";
import { useIsRole } from "@/lib/session";
import { t } from "@/lib/text";

const playerWithTeamInclude = { team: true } satisfies Prisma.PlayerInclude;

export type PlayerWithTeam = Prisma.PlayerGetPayload<{
	include: typeof playerWithTeamInclude;
}>;

export const searchPlayers = createServerFn()
	.inputValidator((d: { query?: string }) => d)
	.handler(async ({ data }) => {
		try {
			const players = await prismaClient.player.findMany({
				include: playerWithTeamInclude,
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
				include: playerWithTeamInclude,
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
	.inputValidator((d: { name: string; year: number; qttr: number }) => d)
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
	.inputValidator((d: { id: string }) => d)
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
					team: true,
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
	.inputValidator(
		(d: {
			id: string;
			name: string;
			year: number;
			qttr: number;
			team?: string;
		}) => d,
	)
	.handler(async ({ data }) => {
		try {
			const player = await prismaClient.player.update({
				data: {
					name: data.name,
					qttr: data.qttr,
					teamId: data.team,
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
	.inputValidator((d: { id: string }) => d)
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
