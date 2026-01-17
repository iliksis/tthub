import { createServerFn, json } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import { t } from "@/lib/text";
import type { Return } from "./types";

export const getTeams = createServerFn({ method: "GET" }).handler(async () => {
	try {
		const teams = await prismaClient.team.findMany({
			include: { _count: { select: { players: true } } },
			orderBy: { title: "asc" },
		});
		return json<Return<typeof teams>>(
			{ data: teams, message: t("Teams found") },
			{ status: 200 },
		);
	} catch (e) {
		console.error(e);
		const error = e as Error;
		return json<Return>({ message: error.message }, { status: 400 });
	}
});

export const createTeam = createServerFn({ method: "POST" })
	.inputValidator((d: { title: string; league: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			const team = await prismaClient.team.create({
				data: {
					league: data.league,
					title: data.title,
				},
			});
			return json<Return<typeof team>>(
				{ data: team, message: t("Team created") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const getTeam = createServerFn()
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		try {
			const team = await prismaClient.team.findUnique({
				include: { players: true },
				where: { id: data.id },
			});
			if (!team) {
				return json<Return>(
					{ message: t("Team not found") },
					{
						status: 404,
					},
				);
			}
			return json<Return<typeof team>>(
				{ data: team, message: t("Team found") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const updateTeam = createServerFn()
	.inputValidator((d: { id: string; title: string; league: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			const team = await prismaClient.team.update({
				data: {
					league: data.league,
					title: data.title,
				},
				where: {
					id: data.id,
				},
			});
			return json<Return<typeof team>>(
				{ data: team, message: t("Team updated") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const deleteTeam = createServerFn()
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			await prismaClient.player.updateMany({
				data: { teamId: null },
				where: { teamId: data.id },
			});
			await prismaClient.team.delete({
				where: {
					id: data.id,
				},
			});
			return json<Return>({ message: t("Team deleted") }, { status: 200 });
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});
