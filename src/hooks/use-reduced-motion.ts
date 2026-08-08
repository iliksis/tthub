import * as React from "react";

export function usePrefersReducedMotion() {
	const [reduced, setReduced] = React.useState(false);

	React.useEffect(() => {
		const query = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReduced(query.matches);
		const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, []);

	return reduced;
}
