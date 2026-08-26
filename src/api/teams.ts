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

export const applyRosterChanges = createServerFn()
	.validator((d: { teamId: string; adds: string[]; removes: string[] }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			await prismaClient.$transaction(async (tx) => {
				const team = await tx.team.findUniqueOrThrow({
					where: { id: data.teamId },
				});

				if (data.removes.length > 0) {
					await tx.teamPlayer.deleteMany({
						where: { id: { in: data.removes } },
					});
				}
				if (data.adds.length > 0) {
					await tx.teamPlayer.createMany({
						data: data.adds.map((playerId) => ({
							playerId,
							seasonId: team.seasonId,
							teamId: data.teamId,
						})),
					});
				}
			});
			return { message: t("Roster updated") };
		} catch (e) {
			console.error(e);
			if ((e as { code?: string }).code === "P2002") {
				throw new Error(t("Player is already assigned to a team this season"));
			}
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
			const { playersCopied, teamsCopied } = await prismaClient.$transaction(
				async (tx) => {
					const targetTeamCount = await tx.team.count({
						where: { seasonId: data.targetSeasonId },
					});
					if (targetTeamCount > 0) {
						throw new Error(t("Teams already exist in the target season"));
					}

					const sourceTeams = await tx.team.findMany({
						include: { players: true },
						where: { seasonId: data.sourceSeasonId },
					});

					let playersCopied = 0;
					for (const team of sourceTeams) {
						// clickTTGroupId is intentionally not cloned: it's unique per
						// season and the source team still holds it, so each cloned
						// team needs it re-entered manually.
						const newTeam = await tx.team.create({
							data: {
								league: team.league,
								seasonId: data.targetSeasonId,
								title: team.title,
							},
						});
						if (team.players.length > 0) {
							await tx.teamPlayer.createMany({
								data: team.players.map((tp) => ({
									playerId: tp.playerId,
									seasonId: data.targetSeasonId,
									teamId: newTeam.id,
								})),
							});
							playersCopied += team.players.length;
						}
					}

					return { playersCopied, teamsCopied: sourceTeams.length };
				},
			);
			return {
				data: { playersCopied, teamsCopied },
				message: t(
					"{0} teams and {1} players cloned",
					teamsCopied.toString(),
					playersCopied.toString(),
				),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});
