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
		: {
				...player,
				isClubMember: false,
				isEligibleToPlay: false,
				myTischtennisId: null,
			};

// Stored as `NU<digits>`: bare digits get the prefix, case is folded, blank
// means "none" (null). Returns undefined for anything else.
export const normalizeMyTischtennisId = (
	raw: string | null | undefined,
): string | null | undefined => {
	const v = raw?.trim() ?? "";
	if (v === "") return null;
	const match = /^(?:nu)?(\d+)$/i.exec(v);
	return match ? `NU${match[1]}` : undefined;
};

export const redactFlags = <P extends object>(
	players: P[],
	canSeeFlags: boolean,
): P[] => players.map((p) => redactPlayerFlags(p, canSeeFlags));
