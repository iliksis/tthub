import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import { t } from "@/lib/text";

export const searchTeams = createServerFn()
	.validator((d: { query?: string }) => d)
	.handler(async ({ data }) => {
		try {
			const teams = await prismaClient.team.findMany({
				include: { _count: { select: { players: true } } },
				orderBy: { title: "asc" },
				take: 10,
				where: {
					OR: [
						{ title: { contains: data.query ?? "" } },
						{ league: { contains: data.query ?? "" } },
					],
				},
			});
			return { data: teams, message: t("Teams found") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getTeams = createServerFn({ method: "GET" }).handler(async () => {
	try {
		const teams = await prismaClient.team.findMany({
			include: { _count: { select: { players: true } } },
			orderBy: { title: "asc" },
		});
		return { data: teams, message: t("Teams found") };
	} catch (e) {
		console.error(e);
		throw new Error((e as Error).message);
	}
});

export const createTeam = createServerFn({ method: "POST" })
	.validator(
		(d: { title: string; league: string; clickTTTeamId?: string }) => d,
	)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const team = await prismaClient.team.create({
				data: {
					clickTTTeamId: data.clickTTTeamId || null,
					league: data.league,
					title: data.title,
				},
			});
			return { data: team, message: t("Team created") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getTeam = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		try {
			const team = await prismaClient.team.findUnique({
				include: { players: true },
				where: { id: data.id },
			});
			if (!team) {
				throw new Error(t("Team not found"));
			}
			return { data: team, message: t("Team found") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const updateTeam = createServerFn()
	.validator(
		(d: {
			id: string;
			title: string;
			league: string;
			clickTTTeamId?: string;
		}) => d,
	)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const team = await prismaClient.team.update({
				data: {
					clickTTTeamId: data.clickTTTeamId || null,
					league: data.league,
					title: data.title,
				},
				where: {
					id: data.id,
				},
			});
			return { data: team, message: t("Team updated") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const deleteTeam = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
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
			return { message: t("Team deleted") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});
