import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import { t } from "@/lib/text";

export const searchTeams = createServerFn()
	.validator((d: { query?: string; seasonId?: string }) => d)
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
					seasonId: data.seasonId,
				},
			});
			return { data: teams, message: t("Teams found") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getTeams = createServerFn({ method: "GET" })
	.validator((d: { seasonId?: string }) => d)
	.handler(async ({ data }) => {
		try {
			const teams = await prismaClient.team.findMany({
				include: {
					_count: { select: { players: true } },
					standings: { orderBy: { rank: "asc" } },
				},
				orderBy: { title: "asc" },
				where: { seasonId: data.seasonId },
			});
			return { data: teams, message: t("Teams found") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const createTeam = createServerFn({ method: "POST" })
	.validator(
		(d: {
			title: string;
			league: string;
			clickTTGroupId?: string;
			seasonId: string;
		}) => d,
	)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const team = await prismaClient.team.create({
				data: {
					clickTTGroupId: data.clickTTGroupId || null,
					league: data.league,
					seasonId: data.seasonId,
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
				include: {
					appointments: {
						include: { ownTeam: true, responses: true },
						orderBy: { startDate: "asc" },
						where: { deletedAt: null },
					},
					players: {
						include: { player: true },
						orderBy: { player: { name: "asc" } },
					},
					season: true,
					standings: { orderBy: { rank: "asc" } },
				},
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
			clickTTGroupId?: string;
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
					clickTTGroupId: data.clickTTGroupId || null,
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
			// TeamPlayer rows cascade-delete automatically (onDelete: Cascade).
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

export const addTeamPlayer = createServerFn()
	.validator((d: { teamId: string; playerId: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const team = await prismaClient.team.findUniqueOrThrow({
				where: { id: data.teamId },
			});
			const teamPlayer = await prismaClient.teamPlayer.create({
				data: {
					playerId: data.playerId,
					seasonId: team.seasonId,
					teamId: data.teamId,
				},
			});
			return { data: teamPlayer, message: t("Player added to roster") };
		} catch (e) {
			console.error(e);
			if ((e as { code?: string }).code === "P2002") {
				throw new Error(t("Player is already assigned to a team this season"));
			}
			throw new Error((e as Error).message);
		}
	});

export const removeTeamPlayer = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			await prismaClient.teamPlayer.delete({ where: { id: data.id } });
			return { message: t("Player removed from roster") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const cloneTeamsFromSeason = createServerFn()
	.validator((d: { sourceSeasonId: string; targetSeasonId: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const sourceTeams = await prismaClient.team.findMany({
				where: { seasonId: data.sourceSeasonId },
			});
			// clickTTGroupId is intentionally not cloned: it's unique per season
			// and the source team still holds it, so each cloned team needs it
			// re-entered manually.
			await prismaClient.team.createMany({
				data: sourceTeams.map((team) => ({
					league: team.league,
					seasonId: data.targetSeasonId,
					title: team.title,
				})),
			});
			return {
				data: { count: sourceTeams.length },
				message: t("{0} teams cloned", sourceTeams.length.toString()),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const copyTeamRoster = createServerFn()
	.validator((d: { sourceTeamId: string; targetTeamId: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const [sourceRoster, targetTeam] = await Promise.all([
				prismaClient.teamPlayer.findMany({
					where: { teamId: data.sourceTeamId },
				}),
				prismaClient.team.findUniqueOrThrow({
					where: { id: data.targetTeamId },
				}),
			]);

			const existingPlayerIds = new Set(
				(
					await prismaClient.teamPlayer.findMany({
						select: { playerId: true },
						where: { seasonId: targetTeam.seasonId },
					})
				).map((tp) => tp.playerId),
			);

			const toCopy = sourceRoster.filter(
				(tp) => !existingPlayerIds.has(tp.playerId),
			);
			if (toCopy.length > 0) {
				await prismaClient.teamPlayer.createMany({
					data: toCopy.map((tp) => ({
						playerId: tp.playerId,
						seasonId: targetTeam.seasonId,
						teamId: data.targetTeamId,
					})),
				});
			}

			return {
				data: {
					copied: toCopy.length,
					skipped: sourceRoster.length - toCopy.length,
				},
				message: t(
					"{0} players copied, {1} already had a team this season",
					toCopy.length.toString(),
					(sourceRoster.length - toCopy.length).toString(),
				),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});
