import { createServerFn, json } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import type { Return } from "./types";

export const getPlayers = createServerFn({ method: "GET" }).handler(
	async () => {
		try {
			const players = await prismaClient.player.findMany({
				include: { team: true },
				orderBy: { name: "asc" },
			});
			return json<Return<typeof players>>(
				{ message: "Players found", data: players },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	},
);

export const createPlayer = createServerFn({ method: "POST" })
	.inputValidator((d: { name: string; year: number; qttr: number }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: "Unauthorized" }, { status: 401 });
		}

		try {
			const player = await prismaClient.player.create({
				data: {
					name: data.name,
					year: data.year,
					qttr: data.qttr ?? 0,
				},
			});
			return json<Return<typeof player>>(
				{ message: "Player created", data: player },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const getPlayer = createServerFn()
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		try {
			const player = await prismaClient.player.findUnique({
				where: { id: data.id },
				include: { team: true },
			});
			if (!player) {
				return json<Return>(
					{ message: "Player not found" },
					{
						status: 404,
					},
				);
			}
			return json<Return<typeof player>>(
				{ message: "Player found", data: player },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const updatePlayer = createServerFn()
	.inputValidator(
		(d: { id: string; name: string; year: number; qttr: number }) => d,
	)
	.handler(async ({ data }) => {
		try {
			const player = await prismaClient.player.update({
				where: {
					id: data.id,
				},
				data: {
					name: data.name,
					year: data.year,
					qttr: data.qttr,
				},
			});
			return json<Return<typeof player>>(
				{ message: "Player updated", data: player },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const deletePlayer = createServerFn()
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: "Unauthorized" }, { status: 401 });
		}
		try {
			const player = await prismaClient.player.delete({
				where: {
					id: data.id,
				},
			});
			return json<Return<typeof player>>(
				{ message: "Player deleted", data: player },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});
