import type { Placement } from "@/lib/prisma/client";

export function groupPlacementsByCategory<
	T extends Pick<Placement, "category">,
>(placements: T[]): { category: string; placements: T[] }[] {
	const grouped = placements.reduce(
		(acc, placement) => {
			const category = acc.find((c) => c.category === placement.category);
			if (category) {
				category.placements.push(placement);
			} else {
				acc.push({ category: placement.category, placements: [placement] });
			}
			return acc;
		},
		[] as { category: string; placements: T[] }[],
	);

	return grouped.sort((a, b) => a.category.localeCompare(b.category));
}

// Unranked placements sort last; ranked placements sort numerically ascending
// via `localeCompare`'s `numeric` option, so "2" sorts before "10" despite
// `placement` being free text rather than a number. Both `null` and `""`
// count as unranked: PlacementsSheet's edit form seeds a cleared placement as
// `""`, not `null` (see startEdit/commitEdit), so treating only `null` as
// unranked would leave a blank placement sorted by string comparison instead
// of last.
export function sortPlacementsByRank<T extends Pick<Placement, "placement">>(
	placements: T[],
): T[] {
	return [...placements].sort((a, b) => {
		const aRank = a.placement || null;
		const bRank = b.placement || null;
		if (aRank === null && bRank === null) return 0;
		if (aRank === null) return 1;
		if (bRank === null) return -1;
		return aRank.localeCompare(bRank, "de", { numeric: true });
	});
}
