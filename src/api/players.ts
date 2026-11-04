import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import type { Team } from "@/lib/prisma/client";
import type { Gender } from "@/lib/prisma/enums";
import { activeSeasonFilter } from "@/lib/season";
import { useIsRole } from "@/lib/session";
import { collapseHalves } from "@/lib/teamHalf";
import { m } from "@/paraglide/messages";

// Only the active-season membership (at most one, per the roster's unique
// constraint) — list/filter views only care about a player's *current*
// team, not their full history (that's getPlayer's job).
const currentTeamInclude = {
	teams: {
		include: { team: true },
		where: { team: { season: activeSeasonFilter } },
	},
} as const;

// A Player on both halves of a split squad holds two memberships; compact
// views want the current half's only.
const withCurrentHalf = <P extends { teams: { team: Team }[] }>(
	players: P[],
): P[] =>
	players.map((p) => ({
		...p,
		teams: collapseHalves(p.teams, (tp) => tp.team),
	}));

// Club Member / Playing Eligibility are editor/admin-only. Rather than change
// the row shape per role, non-editors get both flags forced to false so the
// real values never reach their browser.
export const redactFlags = <P extends object>(
	players: P[],
	canSeeFlags: boolean,
): P[] => {
	if (canSeeFlags) return players;
	return players.map((p) => ({
		...p,
		isClubMember: false,
		isEligibleToPlay: false,
	}));
};

export const searchPlayers = createServerFn()
	.validator((d: { query?: string }) => d)
	.handler(async ({ data }) => {
		const canSeeFlags = await useIsRole("EDITOR");
		try {
			const players = await prismaClient.player.findMany({
				include: currentTeamInclude,
				orderBy: { name: "asc" },
				take: 10,
				where: {
					name: { contains: data.query ?? "" },
				},
			});
			return {
				data: redactFlags(withCurrentHalf(players), canSeeFlags),
				message: m.players_players_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getPlayers = createServerFn({ method: "GET" })
	.validator((d: { seasonId?: string }) => d)
	.handler(async ({ data }) => {
		const canSeeFlags = await useIsRole("EDITOR");
		try {
			const players = await prismaClient.player.findMany({
				include: {
					teams: {
						include: { team: true },
						where: {
							team: {
								season: data.seasonId
									? { id: data.seasonId }
									: activeSeasonFilter,
							},
						},
					},
				},
				orderBy: { name: "asc" },
			});
			return {
				data: redactFlags(withCurrentHalf(players), canSeeFlags),
				message: m.players_players_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const createPlayer = createServerFn({ method: "POST" })
	.validator(
		(d: {
			name: string;
			year: number;
			qttr: number;
			gender: Gender | null;
			isClubMember?: boolean;
			isEligibleToPlay?: boolean;
		}) => d,
	)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const player = await prismaClient.player.create({
				data: {
					gender: data.gender,
					isClubMember: data.isClubMember ?? false,
					isEligibleToPlay: data.isEligibleToPlay ?? false,
					name: data.name,
					qttr: data.qttr ?? 0,
					year: data.year,
				},
			});
			return { data: player, message: m.players_player_created() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getPlayer = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const canSeeFlags = await useIsRole("EDITOR");
		try {
			const player = await prismaClient.player.findUnique({
				include: {
					placements: {
						include: {
							appointment: {
								select: { startDate: true, title: true },
							},
						},
					},
					teams: {
						include: { team: { include: { season: true } } },
						orderBy: { createdAt: "desc" },
					},
				},
				where: { id: data.id },
			});
			if (!player) {
				throw new Error(m.players_player_not_found());
			}
			const [redacted] = redactFlags([player], canSeeFlags);
			return { data: redacted, message: m.players_player_found() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const updatePlayer = createServerFn()
	.validator(
		(d: {
			id: string;
			name: string;
			year: number;
			qttr: number;
			gender: Gender | null;
			isClubMember: boolean;
			isEligibleToPlay: boolean;
		}) => d,
	)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const player = await prismaClient.player.update({
				data: {
					gender: data.gender,
					isClubMember: data.isClubMember,
					isEligibleToPlay: data.isEligibleToPlay,
					name: data.name,
					qttr: data.qttr,
					year: data.year,
				},
				where: {
					id: data.id,
				},
			});
			return { data: player, message: m.players_player_updated() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const deletePlayer = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}
		try {
			const player = await prismaClient.player.delete({
				where: {
					id: data.id,
				},
			});
			return { data: player, message: m.players_player_deleted() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});
