import { createServerFn, json } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import {
	createSeasonAgeGroupCounts,
	createSeasonTitle,
	hasSeasonOverlap,
} from "@/lib/statistics";
import { t } from "@/lib/text";
import type { Return } from "./types";

export const fetchSeasons = createServerFn({ method: "GET" }).handler(
	async () => {
		const isAuthorized = await useIsRole("ADMIN");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		return prismaClient.season.findMany({
			include: {
				ageGroupCounts: true,
			},
			orderBy: { startDate: "desc" },
		});
	},
);

export const createSeason = createServerFn({ method: "POST" })
	.inputValidator((d: { startDate: Date; endDate: Date }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("ADMIN");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		const startDate = new Date(data.startDate);
		const endDate = new Date(data.endDate);

		if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
			return json<Return>(
				{ message: t("Season dates are invalid") },
				{ status: 400 },
			);
		}

		if (endDate <= startDate) {
			return json<Return>(
				{ message: t("Season end date must be after start date") },
				{ status: 400 },
			);
		}

		try {
			const existingSeasons = await prismaClient.season.findMany({
				orderBy: { startDate: "asc" },
				select: {
					endDate: true,
					id: true,
					startDate: true,
				},
			});

			if (hasSeasonOverlap(existingSeasons, startDate, endDate)) {
				return json<Return>(
					{ message: t("Season overlaps with an existing season") },
					{ status: 400 },
				);
			}

			const players = await prismaClient.player.findMany({
				select: {
					id: true,
					year: true,
				},
			});
			const season = await prismaClient.season.create({
				data: {
					ageGroupCounts: {
						create: createSeasonAgeGroupCounts(players, endDate),
					},
					endDate,
					startDate,
					title: createSeasonTitle(startDate, endDate),
				},
				include: {
					ageGroupCounts: true,
				},
			});

			return json<Return<typeof season>>(
				{ data: season, message: t("Season created") },
				{ status: 200 },
			);
		} catch (error) {
			console.error(error);
			const e = error as Error;
			return json<Return>({ message: e.message }, { status: 400 });
		}
	});

export const deleteSeason = createServerFn({ method: "POST" })
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("ADMIN");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			await prismaClient.seasonAgeGroupCount.deleteMany({
				where: { seasonId: data.id },
			});
			await prismaClient.season.delete({
				where: { id: data.id },
			});
			return json<Return>({ message: t("Season deleted") }, { status: 200 });
		} catch (error) {
			console.error(error);
			const e = error as Error;
			return json<Return>({ message: e.message }, { status: 400 });
		}
	});
