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
