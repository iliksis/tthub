import { z } from "zod";
import {
	type ClickTTStanding,
	createTeamMatchAppointmentId,
	filterClickTTScheduleByClub,
	parseClickTTMatchDate,
	parseClickTTPdf,
} from "@/lib/clickTTpdf";
import { prismaClient } from "@/lib/db";
import { AppointmentType } from "@/lib/prisma/enums";
import type { ImporterDefinition } from "./types";

const configSchema = z.object({});

/**
 * Replaces the stored league table for a team with a freshly parsed one.
 * Standings are a full-snapshot replace (not an update-tracked stream like
 * appointments), so this upserts every row and drops any that dropped out
 * of the table (promotion/relegation between seasons).
 */
async function persistStandings(teamId: string, standings: ClickTTStanding[]) {
	await prismaClient.$transaction([
		...standings.map((standing) =>
			prismaClient.standing.upsert({
				create: { teamId, ...standingFields(standing) },
				update: standingFields(standing),
				where: { teamId_teamName: { teamId, teamName: standing.team } },
			}),
		),
		prismaClient.standing.deleteMany({
			where: {
				teamId,
				teamName: { notIn: standings.map((s) => s.team) },
			},
		}),
	]);
}

function standingFields(standing: ClickTTStanding) {
	return {
		diff: standing.diff,
		draws: standing.draws,
		losses: standing.losses,
		matchesLost: standing.matchesLost,
		matchesWon: standing.matchesWon,
		pointsLost: standing.pointsLost,
		pointsWon: standing.pointsWon,
		rank: standing.rank,
		teamName: standing.team,
		undecided: standing.undecided,
		wins: standing.wins,
	};
}

export const clickTTImporter = {
	configSchema,
	description: "Imports match schedules and standings from ClickTT.",
	id: "clickTT",
	name: "ClickTT",

	async run({ emit, log, setTotal }) {
		const baseUrl = process.env.CLICKTT_SCHEDULE_URL;
		const clubName = process.env.CLICKTT_CLUB_NAME;

		const teams = await prismaClient.team.findMany({
			where: { clickTTGroupId: { not: null } },
		});

		const teamSchedules = await Promise.all(
			teams.map(async (team) => {
				const res = await fetch(`${baseUrl}&group=${team.clickTTGroupId}`);
				const data = await res.arrayBuffer();
				const schedule = await parseClickTTPdf(data);
				const { matches } = filterClickTTScheduleByClub(schedule, clubName);
				return { matches, standings: schedule.standings, team };
			}),
		);

		setTotal(
			teamSchedules.reduce((total, { matches }) => total + matches.length, 0),
		);

		let imported = 0;
		let updated = 0;
		let skipped = 0;
		let standingsUpdated = 0;
		for (const { matches, standings, team } of teamSchedules) {
			if (standings.length > 0) {
				await persistStandings(team.id, standings);
				standingsUpdated++;
			}
			for (const match of matches) {
				const result = await emit({
					appointmentType: AppointmentType.TEAM_MATCH,
					externalId: createTeamMatchAppointmentId(
						// biome-ignore lint/style/noNonNullAssertion: filtered by clickTTGroupId not-null above
						team.clickTTGroupId!,
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
			`Imported ${imported} matches, updated ${updated}, skipped ${skipped}, updated standings for ${standingsUpdated} teams`,
		);

		return { imported, skipped };
	},
	version: "1.0.0",
} satisfies ImporterDefinition<typeof configSchema>;
