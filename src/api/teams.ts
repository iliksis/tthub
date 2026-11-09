import { createServerFn } from "@tanstack/react-start";
import { m } from "@/paraglide/messages";
import { run } from "./kernel.server";
import { type ClonedCounts, type TeamInput, TeamsApi } from "./teams.server";

export type { ClonedCounts, TeamInput } from "./teams.server";

export const searchTeams = createServerFn()
	.validator((d: { query?: string; seasonId?: string }) => d)
	.handler(({ data }) =>
		run(TeamsApi, m.teams_teams_found, (api) =>
			api.search(data.query, data.seasonId),
		),
	);

export const getTeams = createServerFn({ method: "GET" })
	.validator((d: { seasonId?: string }) => d)
	.handler(({ data }) =>
		run(TeamsApi, m.teams_teams_found, (api) => api.list(data.seasonId)),
	);

export const createTeam = createServerFn({ method: "POST" })
	.validator((d: TeamInput & { seasonId: string }) => d)
	.handler(({ data }) =>
		run(TeamsApi, m.teams_team_created, (api) => api.create(data)),
	);

export const getTeam = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(TeamsApi, m.teams_team_found, (api) => api.get(data.id)),
	);

export const createRueckrundeTeam = createServerFn({ method: "POST" })
	.validator((d: { hinrundeTeamId: string }) => d)
	.handler(({ data }) =>
		run(TeamsApi, m.teams_rueckrunde_created, (api) =>
			api.createRueckrunde(data.hinrundeTeamId),
		),
	);

export const updateTeam = createServerFn()
	.validator((d: TeamInput & { id: string }) => d)
	.handler(({ data: { id, ...input } }) =>
		run(TeamsApi, m.teams_team_updated, (api) => api.update(id, input)),
	);

export const deleteTeam = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(TeamsApi, m.teams_team_deleted, (api) => api.delete(data.id)),
	);

export const applyRosterChanges = createServerFn()
	.validator((d: { teamId: string; adds: string[]; removes: string[] }) => d)
	.handler(({ data }) =>
		run(TeamsApi, m.teams_roster_updated, (api) =>
			api.applyRosterChanges(data.teamId, data.adds, data.removes),
		),
	);

export const cloneTeamsFromSeason = createServerFn()
	.validator((d: { sourceSeasonId: string; targetSeasonId: string }) => d)
	.handler(({ data }) =>
		run(
			TeamsApi,
			({ playersCopied, teamsCopied }: ClonedCounts) =>
				m.teams_n_teams_and_n_players_cloned({
					param1: teamsCopied.toString(),
					param2: playersCopied.toString(),
				}),
			(api) => api.cloneFromSeason(data.sourceSeasonId, data.targetSeasonId),
		),
	);
