import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import {
	recomputeActiveSeasonStatistics,
	recomputeSeasonStatistics,
	type StatisticsDb,
} from "@/lib/seasonStatistics";
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

// The body of the activation transaction, extracted so it can be tested
// without a session. Besides flipping the flag it is the only recompute hook
// outside the nightly job: the outgoing Season gets its final snapshot and the
// incoming one is populated right away, so the new Active Season never shows
// an empty state until the next night. Must run inside a transaction.
export async function activateSeason(
	db: StatisticsDb,
	id: string,
	referenceYear?: number,
) {
	const outgoing = await db.season.findFirst({ where: { isActive: true } });
	// Recompute before deactivating: the outgoing Season is still tracked.
	if (outgoing) {
		await recomputeSeasonStatistics(db, outgoing.id, referenceYear);
	}
	await db.season.updateMany({
		data: { isActive: false },
		where: { isActive: true },
	});
	const season = await db.season.update({
		data: { isActive: true },
		where: { id },
	});
	// Re-activating the Active Season already refreshed it above.
	if (outgoing?.id !== season.id) {
		await recomputeSeasonStatistics(db, season.id, referenceYear);
	}
	return season;
}

export const setActiveSeason = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const season = await prismaClient.$transaction((tx) =>
				activateSeason(tx, data.id),
			);
			return { data: season, message: m.seasons_season_activated() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

// Unlike recomputeActiveSeasonStatistics, a missing Active Season is an error
// the caller must surface rather than a silent no-op. Exported for tests.
export async function refreshActiveSeasonStatistics(
	db: StatisticsDb,
	referenceYear?: number,
) {
	const record = await recomputeActiveSeasonStatistics(db, referenceYear);
	if (!record) throw new Error(m.seasons_no_active_season());
	return record;
}

// Recomputes the Active Season's stored statistics on demand. Only the Active
// Season is ever recomputed; past Seasons stay snapshots.
export const refreshSeasonStatistics = createServerFn({
	method: "POST",
}).handler(async () => {
	const isAuthorized = await useIsRole("EDITOR");
	if (!isAuthorized) {
		throw new Error(m.common_unauthorized());
	}

	try {
		// One transaction, so activating another Season between reading the
		// Active Season and writing its record can't overwrite the old record.
		const { computedAt, seasonId } = await prismaClient.$transaction((tx) =>
			refreshActiveSeasonStatistics(tx),
		);
		return {
			data: { computedAt, seasonId },
			message: m.seasons_statistics_refreshed(),
		};
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
