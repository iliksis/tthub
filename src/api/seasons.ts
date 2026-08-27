import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import { m } from "@/paraglide/messages";

export const getSeasons = createServerFn({ method: "GET" }).handler(
	async () => {
		try {
			const seasons = await prismaClient.season.findMany({
				orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
			});
			return { data: seasons, message: m.seasons_seasons_found() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	},
);

export const getSeasonsWithStats = createServerFn({ method: "GET" }).handler(
	async () => {
		try {
			const seasons = await prismaClient.season.findMany({
				include: {
					_count: {
						select: {
							appointments: { where: { deletedAt: null } },
							teams: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
			});
			return { data: seasons, message: m.seasons_seasons_found() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	},
);

export const getActiveSeason = createServerFn({ method: "GET" }).handler(
	async () => {
		try {
			const season = await prismaClient.season.findFirst({
				where: { isActive: true },
			});
			return { data: season, message: m.seasons_active_season_found() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	},
);

export const createSeason = createServerFn({ method: "POST" })
	.validator((d: { name: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const season = await prismaClient.season.create({
				data: { isActive: false, name: data.name },
			});
			return { data: season, message: m.seasons_season_created() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const updateSeason = createServerFn()
	.validator((d: { id: string; name: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const season = await prismaClient.season.update({
				data: { name: data.name },
				where: { id: data.id },
			});
			return { data: season, message: m.seasons_season_updated() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const setActiveSeason = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const season = await prismaClient.$transaction(async (tx) => {
				await tx.season.updateMany({
					data: { isActive: false },
					where: { isActive: true },
				});
				return tx.season.update({
					data: { isActive: true },
					where: { id: data.id },
				});
			});
			return { data: season, message: m.seasons_season_activated() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const deleteSeason = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		try {
			await prismaClient.$transaction(async (tx) => {
				const season = await tx.season.findUniqueOrThrow({
					where: { id: data.id },
				});
				if (season.isActive) {
					throw new Error(m.seasons_the_active_season_cannot_be_deleted());
				}

				const [teamCount, appointmentCount] = await Promise.all([
					tx.team.count({ where: { seasonId: data.id } }),
					tx.appointment.count({
						where: { deletedAt: null, seasonId: data.id },
					}),
				]);
				if (teamCount > 0 || appointmentCount > 0) {
					throw new Error(m.seasons_cannot_delete_while_referenced());
				}

				await tx.season.delete({ where: { id: data.id } });
			});
			return { message: m.seasons_season_deleted() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});
