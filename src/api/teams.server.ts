import { redactPlayerFlags } from "@/lib/players";
import { m } from "@/paraglide/messages";
import {
	ApiBase,
	ConflictError,
	NotFoundError,
	type Policies,
	type Tx,
} from "./kernel.server";

export type TeamInput = {
	title: string;
	league: string;
	clickTTGroupId?: string;
};

export type ClonedCounts = { playersCopied: number; teamsCopied: number };

const toData = (input: TeamInput) => ({
	clickTTGroupId: input.clickTTGroupId || null,
	league: input.league,
	title: input.title,
});

export class TeamsApi extends ApiBase {
	static readonly policy = {
		applyRosterChanges: "EDITOR",
		cloneFromSeason: "EDITOR",
		create: "EDITOR",
		createRueckrunde: "EDITOR",
		delete: "EDITOR",
		get: "AUTHENTICATED",
		list: "AUTHENTICATED",
		search: "AUTHENTICATED",
		update: "EDITOR",
	} as const satisfies Policies<TeamsApi>;

	async search(query: string | undefined, seasonId: string | undefined) {
		return this.ctx.db.team.findMany({
			include: { _count: { select: { players: true } } },
			orderBy: { title: "asc" },
			take: 10,
			where: {
				OR: [
					{ title: { contains: query ?? "" } },
					{ league: { contains: query ?? "" } },
				],
				seasonId,
			},
		});
	}

	async list(seasonId: string | undefined) {
		return this.ctx.db.team.findMany({
			include: {
				_count: { select: { players: true } },
				standings: { orderBy: { rank: "asc" } },
			},
			orderBy: { title: "asc" },
			where: { seasonId },
		});
	}

	async get(id: string) {
		const team = await this.ctx.db.team.findUnique({
			include: {
				appointments: {
					include: { ownTeam: true, responses: true },
					orderBy: { startDate: "asc" },
					where: { deletedAt: null },
				},
				hinrundeTeam: { select: { id: true, title: true } },
				players: {
					include: { player: true },
					orderBy: { player: { name: "asc" } },
				},
				rueckrundeTeam: { select: { id: true, title: true } },
				season: true,
				standings: { orderBy: { rank: "asc" } },
			},
			where: { id },
		});
		if (!team) throw new NotFoundError(m.teams_team_not_found());
		// Club Member / Playing Eligibility are editor/admin-only.
		const canSeeFlags = this.isAtLeast("EDITOR");
		const players = team.players.map((tp) => ({
			...tp,
			player: redactPlayerFlags(tp.player, canSeeFlags),
		}));
		return { ...team, players };
	}

	async create(input: TeamInput & { seasonId: string }) {
		return this.ctx.db.team.create({
			data: { ...toData(input), seasonId: input.seasonId },
		});
	}

	async update(id: string, input: TeamInput) {
		return this.tx(async (tx) => {
			await this.requireTeam(tx, id);
			return tx.team.update({ data: toData(input), where: { id } });
		});
	}

	async createRueckrunde(hinrundeTeamId: string) {
		return this.tx(async (tx) => {
			const hinrunde = await this.requireTeam(tx, hinrundeTeamId);
			if (hinrunde.half === "RUECKRUNDE" || hinrunde.rueckrundeTeam) {
				throw new ConflictError(m.teams_team_already_has_a_rueckrunde());
			}
			// An unpaired team becomes the Hinrunde once it gets a pair.
			await tx.team.update({
				data: { half: "HINRUNDE" },
				where: { id: hinrunde.id },
			});
			return tx.team.create({
				data: {
					half: "RUECKRUNDE",
					hinrundeTeamId: hinrunde.id,
					seasonId: hinrunde.seasonId,
					title: hinrunde.title,
				},
			});
		});
	}

	async delete(id: string) {
		await this.tx(async (tx) => {
			const team = await this.requireTeam(tx, id);
			// TeamPlayer rows cascade-delete automatically (onDelete: Cascade);
			// the pair's link is nulled by the foreign key.
			await tx.team.delete({ where: { id } });
			// The surviving half is no longer paired, so it is a plain team again.
			const survivorId = team.hinrundeTeamId ?? team.rueckrundeTeam?.id;
			if (survivorId) {
				await tx.team.update({
					data: { half: null },
					where: { id: survivorId },
				});
			}
		});
	}

	// `removes` are TeamPlayer ids of this team; `adds` are Player ids.
	async applyRosterChanges(teamId: string, adds: string[], removes: string[]) {
		await this.tx(async (tx) => {
			const team = await this.requireTeam(tx, teamId);

			if (removes.length > 0) {
				await tx.teamPlayer.deleteMany({
					where: { id: { in: removes }, teamId },
				});
			}
			const playerIds = [...new Set(adds)];
			if (playerIds.length === 0) return;

			// Uniqueness is per team (a Player sits on both Team Halves), so
			// "one team per season" is enforced here: the only membership an
			// added Player may already hold this season is on the paired half.
			const pairIds = [team.hinrundeTeamId, team.rueckrundeTeam?.id].filter(
				(id): id is string => !!id,
			);
			const conflict = await tx.teamPlayer.findFirst({
				where: {
					playerId: { in: playerIds },
					seasonId: team.seasonId,
					teamId: { notIn: pairIds },
				},
			});
			if (conflict) {
				throw new ConflictError(
					m.teams_player_is_already_assigned_to_a_team_this_season(),
				);
			}
			await tx.teamPlayer.createMany({
				data: playerIds.map((playerId) => ({
					playerId,
					seasonId: team.seasonId,
					teamId,
				})),
			});
		});
	}

	async cloneFromSeason(
		sourceSeasonId: string,
		targetSeasonId: string,
	): Promise<ClonedCounts> {
		return this.tx(async (tx) => {
			const targetTeamCount = await tx.team.count({
				where: { seasonId: targetSeasonId },
			});
			if (targetTeamCount > 0) {
				throw new ConflictError(
					m.teams_teams_already_exist_in_the_target_season(),
				);
			}

			const sourceTeams = await tx.team.findMany({
				include: { players: true },
				where: { seasonId: sourceSeasonId },
			});

			let playersCopied = 0;
			for (const team of sourceTeams) {
				// clickTTGroupId is intentionally not cloned: it's unique per
				// season and the source team still holds it, so each cloned
				// team needs it re-entered manually.
				const newTeam = await tx.team.create({
					data: {
						league: team.league,
						seasonId: targetSeasonId,
						title: team.title,
					},
				});
				if (team.players.length > 0) {
					await tx.teamPlayer.createMany({
						data: team.players.map((tp) => ({
							playerId: tp.playerId,
							seasonId: targetSeasonId,
							teamId: newTeam.id,
						})),
					});
					playersCopied += team.players.length;
				}
			}

			return { playersCopied, teamsCopied: sourceTeams.length };
		});
	}

	private async requireTeam(tx: Tx, id: string) {
		const team = await tx.team.findUnique({
			include: { rueckrundeTeam: { select: { id: true } } },
			where: { id },
		});
		if (!team) throw new NotFoundError(m.teams_team_not_found());
		return team;
	}
}
