// A split squad is two linked Team rows (see ADR 0003); compact displays show
// one entry per squad. The Rückrunde row points back at its Hinrunde via
// `hinrundeTeamId`, so any row that some other row in the list points at is
// superseded and dropped — the Rückrunde wins if it is present, otherwise the
// Hinrunde row stays. Unpaired teams pass through unchanged.
export function collapseHalves<T>(
	items: T[],
	getTeam: (item: T) => { id: string; hinrundeTeamId: string | null },
): T[] {
	const superseded = new Set<string>();
	for (const item of items) {
		const { hinrundeTeamId } = getTeam(item);
		if (hinrundeTeamId) superseded.add(hinrundeTeamId);
	}
	return items.filter((item) => !superseded.has(getTeam(item).id));
}
