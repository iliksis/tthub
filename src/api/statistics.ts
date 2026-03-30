import { createServerFn, json } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { AppointmentType } from "@/lib/prisma/enums";
import { useAppSession } from "@/lib/session";
import { buildStatistics } from "@/lib/statistics";
import { t } from "@/lib/text";
import type { Return } from "./types";

export const getStatistics = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await useAppSession();
		if (!session.data.id) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			const seasons = await prismaClient.season.findMany({
				include: {
					ageGroupCounts: true,
				},
				orderBy: { startDate: "asc" },
			});
			const appointments = await prismaClient.appointment.findMany({
				include: {
					placements: {
						include: {
							player: {
								select: {
									id: true,
									name: true,
									year: true,
								},
							},
						},
					},
				},
				orderBy: { startDate: "asc" },
				where: {
					deletedAt: null,
					OR: [
						{ type: AppointmentType.TOURNAMENT },
						{ type: AppointmentType.TOURNAMENT_DE },
					],
				},
			});

			const statistics = buildStatistics(seasons, appointments);

			return json<Return<typeof statistics>>(
				{ data: statistics, message: t("Statistics loaded") },
				{ status: 200 },
			);
		} catch (error) {
			console.error(error);
			const e = error as Error;
			return json<Return>({ message: e.message }, { status: 400 });
		}
	},
);
