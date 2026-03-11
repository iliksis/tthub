import { createServerFn, json } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { type PlayerData, scrapeMytt } from "@/lib/mytt-scraper";
import { useIsRole } from "@/lib/session";
import { t } from "@/lib/text";
import type { Return } from "./types";

export const searchPlayers = createServerFn()
	.inputValidator((d: { query?: string }) => d)
	.handler(async ({ data }) => {
		try {
			const players = await prismaClient.player.findMany({
				include: { team: true },
				orderBy: { name: "asc" },
				take: 10,
				where: {
					name: { contains: data.query ?? "" },
				},
			});
			return json<Return<typeof players>>(
				{ data: players, message: t("Players found") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const getPlayers = createServerFn({ method: "GET" }).handler(
	async () => {
		try {
			const players = await prismaClient.player.findMany({
				include: { team: true },
				orderBy: { name: "asc" },
			});
			return json<Return<typeof players>>(
				{ data: players, message: t("Players found") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	},
);

export const importMyttPlayers = createServerFn().handler(async () => {
	const isAuthorized = await useIsRole("EDITOR");
	if (!isAuthorized) {
		return json<Return>({ message: t("Unauthorized") }, { status: 401 });
	}

	try {
		const playerData = await scrapeMytt();
		const result: PlayerData[] = [];
		for (const data of playerData) {
			const qttr = parseInt(data.rating);
			if (Number.isNaN(qttr)) {
				continue;
			}

			const player = await prismaClient.player.findFirst({
				where: { name: data.name },
			});

			if (player && player.qttr !== qttr) {
				await prismaClient.player.update({
					data: { qttr },
					where: { id: player.id },
				});
				result.push(data);
			}
		}
		return json<Return<typeof result>>(
			{ data: result, message: t("{0} players", result.length.toString()) },
			{ status: 200 },
		);
	} catch (e) {
		console.error(e);
		const error = e as Error;
		return json<Return>({ message: error.message }, { status: 400 });
	}
});

export const createPlayer = createServerFn({ method: "POST" })
	.inputValidator((d: { name: string; year: number; qttr: number }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			const player = await prismaClient.player.create({
				data: {
					name: data.name,
					qttr: data.qttr ?? 0,
					year: data.year,
				},
			});
			return json<Return<typeof player>>(
				{ data: player, message: t("Player created") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
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
				return json<Return>(
					{ message: t("Player not found") },
					{
						status: 404,
					},
				);
			}
			return json<Return<typeof player>>(
				{ data: player, message: t("Player found") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
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
			return json<Return<typeof player>>(
				{ data: player, message: t("Player updated") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const deletePlayer = createServerFn()
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}
		try {
			const player = await prismaClient.player.delete({
				where: {
					id: data.id,
				},
			});
			return json<Return<typeof player>>(
				{ data: player, message: t("Player deleted") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});
