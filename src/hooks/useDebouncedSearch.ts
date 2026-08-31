import React from "react";

// Shared by the appointments, players, and bulk/trash appointment filter
// bars: a text search input that updates instantly for a responsive feel,
// but only fires `onCommit` (typically a router.navigate) `delay`ms after
// the user stops typing, and only when the value actually changed — so
// typing doesn't fire a navigation/loader request per keystroke.
//
// `onCommit` and `currentValue` are read through refs kept fresh on every
// render, rather than as effect dependencies, so the debounce timer always
// calls back with the latest closure instead of one captured when typing
// started.
export function useDebouncedSearch(
	currentValue: string | undefined,
	onCommit: (value: string) => void,
	delay = 300,
) {
	const [queryInput, setQueryInput] = React.useState(currentValue ?? "");

	const onCommitRef = React.useRef(onCommit);
	onCommitRef.current = onCommit;
	const currentValueRef = React.useRef(currentValue);
	currentValueRef.current = currentValue;

	React.useEffect(() => {
		const timeout = setTimeout(() => {
			if (queryInput !== (currentValueRef.current ?? "")) {
				onCommitRef.current(queryInput);
			}
		}, delay);
		return () => clearTimeout(timeout);
	}, [queryInput, delay]);

	return { queryInput, setQueryInput };
}
