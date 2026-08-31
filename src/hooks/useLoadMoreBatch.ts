import React from "react";

// The loader only ever fetches one batch (skip/take), never the whole list
// again — so previously loaded items are kept in state and the new batch is
// appended to them, unless `filterKey` changed (or this is the first page),
// in which case it replaces them outright. Comparing against state (not a
// ref) during render is the React-sanctioned way to reset/derive state when
// an input changes without a useEffect round-trip. `appended` exposes just
// the newly-appended slice (empty on a fresh view) for callers that want to
// highlight newly loaded rows.
//
// `skip === 0` also resyncs on a new `batch` reference even when filterKey/skip
// are unchanged — needed for `router.invalidate()` after a mutation (e.g. a
// bulk action), which re-runs the loader for the same URL/search and would
// otherwise leave `items` stuck on whatever a caller locally spliced it to.
export function useLoadMoreBatch<T>(
	batch: T[],
	skip: number,
	filterKey: string,
) {
	const [items, setItems] = React.useState<T[]>(batch);
	const [appliedLoad, setAppliedLoad] = React.useState({
		batch,
		filterKey,
		skip,
	});
	const [appended, setAppended] = React.useState<T[]>([]);

	if (
		appliedLoad.filterKey !== filterKey ||
		appliedLoad.skip !== skip ||
		(skip === 0 && appliedLoad.batch !== batch)
	) {
		const isFreshView = skip === 0 || appliedLoad.filterKey !== filterKey;
		setAppliedLoad({ batch, filterKey, skip });
		setItems((prev) => (isFreshView ? batch : [...prev, ...batch]));
		setAppended(isFreshView ? [] : batch);
	}

	return { appended, items, setItems };
}
