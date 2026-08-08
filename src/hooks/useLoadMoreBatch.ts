import React from "react";

// The loader only ever fetches one batch (skip/take), never the whole list
// again — so previously loaded items are kept in state and the new batch is
// appended to them, unless `filterKey` changed (or this is the first page),
// in which case it replaces them outright. Comparing against state (not a
// ref) during render is the React-sanctioned way to reset/derive state when
// an input changes without a useEffect round-trip. `appended` exposes just
// the newly-appended slice (empty on a fresh view) for callers that want to
// highlight newly loaded rows.
export function useLoadMoreBatch<T>(
	batch: T[],
	skip: number,
	filterKey: string,
) {
	const [items, setItems] = React.useState<T[]>(batch);
	const [appliedLoad, setAppliedLoad] = React.useState({ filterKey, skip });
	const [appended, setAppended] = React.useState<T[]>([]);

	if (appliedLoad.filterKey !== filterKey || appliedLoad.skip !== skip) {
		const isFreshView = skip === 0 || appliedLoad.filterKey !== filterKey;
		setAppliedLoad({ filterKey, skip });
		setItems((prev) => (isFreshView ? batch : [...prev, ...batch]));
		setAppended(isFreshView ? [] : batch);
	}

	return { appended, items, setItems };
}
