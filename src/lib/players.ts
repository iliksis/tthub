// Club Member / Playing Eligibility are editor/admin-only. Rather than change
// the row shape per role, non-editors get both flags forced to false so the
// real values never reach their browser. Used by every aggregate that returns
// Player rows (players, teams, appointments).
export const redactPlayerFlags = <P extends object>(
	player: P,
	canSeeFlags: boolean,
): P =>
	canSeeFlags
		? player
		: { ...player, isClubMember: false, isEligibleToPlay: false };

export const redactFlags = <P extends object>(
	players: P[],
	canSeeFlags: boolean,
): P[] => players.map((p) => redactPlayerFlags(p, canSeeFlags));
