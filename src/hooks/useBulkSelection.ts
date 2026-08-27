import type { RowSelectionState } from "@tanstack/react-table";
import React from "react";

// Shared by /appts/bulk and /appts/trash: both explicit selection and
// select-all-matching (plus its exclude-list) are scoped to the current
// filter view, so the whole selection resets whenever `filterKey` changes
// (the same derive-during-render reset pattern useLoadMoreBatch uses for
// `items`). `matchedTotal` and `items` come from the page's own loader data;
// `getItemId` extracts the id used to key selection/exclusion.
export function useBulkSelection<T>(
	items: T[],
	matchedTotal: number,
	filterKey: string,
	getItemId: (item: T) => string,
) {
	const [explicitSelection, setExplicitSelection] =
		React.useState<RowSelectionState>({});
	const [selectAllMatching, setSelectAllMatching] = React.useState(false);
	const [excludeIds, setExcludeIds] = React.useState<Set<string>>(new Set());
	const [lastFilterKeyForSelection, setLastFilterKeyForSelection] =
		React.useState(filterKey);
	if (filterKey !== lastFilterKeyForSelection) {
		setLastFilterKeyForSelection(filterKey);
		setExplicitSelection({});
		setSelectAllMatching(false);
		setExcludeIds(new Set());
	}

	const exitSelectAllMatching = () => {
		setSelectAllMatching(false);
		setExcludeIds(new Set());
		setExplicitSelection({});
	};

	const enterSelectAllMatching = () => {
		setExplicitSelection({});
		setExcludeIds(new Set());
		setSelectAllMatching(true);
	};

	const selection = React.useMemo<RowSelectionState>(() => {
		if (!selectAllMatching) return explicitSelection;
		const sel: RowSelectionState = {};
		for (const item of items) {
			const id = getItemId(item);
			if (!excludeIds.has(id)) sel[id] = true;
		}
		return sel;
	}, [selectAllMatching, excludeIds, explicitSelection, items, getItemId]);

	const onSelectionChange = (
		updater:
			| RowSelectionState
			| ((old: RowSelectionState) => RowSelectionState),
	) => {
		const next = typeof updater === "function" ? updater(selection) : updater;
		if (selectAllMatching) {
			setExcludeIds((prev) => {
				const nextExclude = new Set(prev);
				for (const item of items) {
					const id = getItemId(item);
					if (next[id]) {
						nextExclude.delete(id);
					} else {
						nextExclude.add(id);
					}
				}
				return nextExclude;
			});
		} else {
			setExplicitSelection(next);
		}
	};

	const selectedCount = selectAllMatching
		? Math.max(matchedTotal - excludeIds.size, 0)
		: Object.values(explicitSelection).filter(Boolean).length;

	return {
		enterSelectAllMatching,
		excludeIds,
		exitSelectAllMatching,
		onSelectionChange,
		selectAllMatching,
		selectedCount,
		selection,
		setExplicitSelection,
	};
}
