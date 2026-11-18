import { redactFlags, redactPlayerFlags } from "@/lib/players";
import type { Team } from "@/lib/prisma/client";
import type { Gender } from "@/lib/prisma/enums";
import { activeSeasonFilter } from "@/lib/season";
import { collapseHalves } from "@/lib/teamHalf";
import { m } from "@/paraglide/messages";
import {
	ApiBase,
	NotFoundError,
	type Policies,
	type Tx,
} from "./kernel.server";

export type PlayerInput = {
	name: string;
	year: number;
	qttr: number;
	gender: Gender | null;
	isClubMember?: boolean;
	isEligibleToPlay?: boolean;
};

// A Player on both halves of a split squad holds two memberships; compact
// views want the current half's only.
const withCurrentHalf = <P extends { teams: { team: Team }[] }>(
	players: P[],
): P[] =>
	players.map((p) => ({
		...p,
		teams: collapseHalves(p.teams, (tp) => tp.team),
	}));

// Memberships in one Season only (at most one squad, collapsed to the current
// half by `withCurrentHalf`): list/search views show a player's team in that
// Season, not their history (that's `get`'s job).
const teamsInSeason = (season: { id: string } | typeof activeSeasonFilter) =>
	({
		teams: { include: { team: true }, where: { team: { season } } },
	}) as const;

const toData = (input: PlayerInput) => ({
	gender: input.gender,
	isClubMember: input.isClubMember === true,
	isEligibleToPlay: input.isEligibleToPlay === true,
	name: input.name,
	qttr: input.qttr,
	year: input.year,
});

export class PlayersApi extends ApiBase {
	static readonly policy = {
		create: "EDITOR",
		delete: "EDITOR",
		get: "AUTHENTICATED",
		list: "AUTHENTICATED",
		search: "AUTHENTICATED",
		update: "EDITOR",
	} as const satisfies Policies<PlayersApi>;

	// Club Member / Playing Eligibility are editor/admin-only (see
	// `redactPlayerFlags`).
	private get canSeeFlags() {
		return this.isAtLeast("EDITOR");
	}

	// Only the active-season membership — the search box only cares about a
	// player's *current* team, not their full history (that's `get`'s job).
	async search(query: string | undefined) {
		const players = await this.ctx.db.player.findMany({
			include: teamsInSeason(activeSeasonFilter),
			orderBy: { name: "asc" },
			take: 10,
			where: { name: { contains: query ?? "" } },
		});
		return redactFlags(withCurrentHalf(players), this.canSeeFlags);
	}

	// Memberships of the given Season, or the active one.
	async list(seasonId: string | undefined) {
		const players = await this.ctx.db.player.findMany({
			include: teamsInSeason(seasonId ? { id: seasonId } : activeSeasonFilter),
			orderBy: { name: "asc" },
		});
		return redactFlags(withCurrentHalf(players), this.canSeeFlags);
	}

	async get(id: string) {
		const player = await this.ctx.db.player.findUnique({
			include: {
				placements: {
					include: {
						appointment: { select: { startDate: true, title: true } },
					},
				},
				teams: {
					include: { team: { include: { season: true } } },
					orderBy: { createdAt: "desc" },
				},
			},
			where: { id },
		});
		if (!player) throw new NotFoundError(m.players_player_not_found());
		return redactPlayerFlags(player, this.canSeeFlags);
	}

	async create(input: PlayerInput) {
		return this.ctx.db.player.create({ data: toData(input) });
	}

	async update(id: string, input: PlayerInput) {
		return this.tx(async (tx) => {
			await this.requirePlayer(tx, id);
			return tx.player.update({ data: toData(input), where: { id } });
		});
	}

	// TeamPlayer rows cascade-delete; Placements do not, so deleting a player
	// with placements fails (generic error), as before the migration.
	async delete(id: string) {
		return this.tx(async (tx) => {
			await this.requirePlayer(tx, id);
			return tx.player.delete({ where: { id } });
		});
	}

	private async requirePlayer(tx: Tx, id: string) {
		const player = await tx.player.findUnique({ where: { id } });
		if (!player) throw new NotFoundError(m.players_player_not_found());
	}
}
