import { z } from "zod";
import {
	createTeamMatchAppointmentId,
	filterClickTTScheduleByClub,
	parseClickTTMatchDate,
	parseClickTTPdf,
} from "@/lib/clickTTpdf";
import { prismaClient } from "@/lib/db";
import { AppointmentType } from "@/lib/prisma/enums";
import type { ImporterDefinition } from "./types";

const configSchema = z.object({});

export const clickTTImporter = {
	configSchema,
	description: "Imports match schedules and standings from ClickTT.",
	id: "clickTT",
	name: "ClickTT",

	async run({ emit, log, setTotal }) {
		const baseUrl = process.env.CLICKTT_SCHEDULE_URL;
		const clubName = process.env.CLICKTT_CLUB_NAME;

		const teams = await prismaClient.team.findMany({
			where: { clickTTTeamId: { not: null } },
		});

		const teamSchedules = await Promise.all(
			teams.map(async (team) => {
				const res = await fetch(`${baseUrl}&group=${team.clickTTTeamId}`);
				const data = await res.arrayBuffer();
				const schedule = await parseClickTTPdf(data);
				const { matches } = filterClickTTScheduleByClub(schedule, clubName);
				return { matches, team };
			}),
		);

		setTotal(
			teamSchedules.reduce((total, { matches }) => total + matches.length, 0),
		);

		let imported = 0;
		let updated = 0;
		let skipped = 0;
		for (const { matches, team } of teamSchedules) {
			for (const match of matches) {
				const result = await emit({
					appointmentType: AppointmentType.TEAM_MATCH,
					externalId: createTeamMatchAppointmentId(
						// biome-ignore lint/style/noNonNullAssertion: filtered by clickTTTeamId not-null above
						team.clickTTTeamId!,
						match.home,
						match.away,
					),
					startsAt: parseClickTTMatchDate(match).toISOString(),
					teamMatch: {
						awayTeam: match.away,
						homeTeam: match.home,
						ownTeamId: team.id,
					},
					title: `${match.home} - ${match.away}`,
					type: "event",
				});
				if (result.status === "imported") imported++;
				else if (result.status === "updated") updated++;
				else skipped++;
			}
		}

		log(
			"info",
			`Imported ${imported} matches, updated ${updated}, skipped ${skipped}`,
		);

		return { imported, skipped };
	},
	version: "1.0.0",
} satisfies ImporterDefinition<typeof configSchema>;
