import { useRouter, useRouterState } from "@tanstack/react-router";
import React from "react";
import {
	ALL_SEASONS,
	typeFilterOptions,
} from "@/components/appointments/appointmentListShared";
import type { FilterBarSegment } from "@/components/FilterBar";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { useLoadMoreBatch } from "@/hooks/useLoadMoreBatch";
import type { AppointmentType } from "@/lib/prisma/enums";
import { m } from "@/paraglide/messages";

export type AppointmentFilterSearch = {
	query?: string;
	seasonId?: string;
	skip?: number;
	types?: AppointmentType[];
};

type Season = { id: string; name: string; isActive: boolean };

// Shared between /appts/bulk and /appts/trash: both pages filter (query,
// season, type) and paginate the same shape of Appointment listing, and
// support the same "select all matching filters" + exclude-list selection
// model. Only the resulting bulk action(s) differ per page.
export function useAppointmentFilterList<T>({
	search,
	batch,
	skip,
	matchedTotal,
	seasons,
	getItemId,
}: {
	search: AppointmentFilterSearch;
	batch: T[];
	skip: number;
	matchedTotal: number;
	seasons: Season[];
	getItemId: (item: T) => string;
}) {
	const router = useRouter();
	const isNavigating = useRouterState({ select: (s) => s.isLoading });

	const [queryInput, setQueryInput] = React.useState(search.query ?? "");

	const filterKey = `${search.query ?? ""}|${search.seasonId ?? ""}|${(search.types ?? []).join(",")}`;
	const { items, setItems } = useLoadMoreBatch(batch, skip, filterKey);

	const selection = useBulkSelection(items, matchedTotal, filterKey, getItemId);

	const searchRef = React.useRef(search);
	searchRef.current = search;
	const routerRef = React.useRef(router);
	routerRef.current = router;

	// Debounced so typing doesn't fire a loader request per keystroke; the
	// input itself still updates instantly for a responsive feel.
	React.useEffect(() => {
		const timeout = setTimeout(() => {
			const current = searchRef.current;
			if (queryInput !== (current.query ?? "")) {
				routerRef.current.navigate({
					replace: true,
					search: {
						query: queryInput || undefined,
						seasonId: current.seasonId,
						types: current.types,
					},
					to: ".",
				});
			}
		}, 300);
		return () => clearTimeout(timeout);
	}, [queryInput]);

	const onSeasonChange = (value: string) => {
		router.navigate({
			replace: true,
			search: {
				query: search.query,
				seasonId: value === ALL_SEASONS ? undefined : value,
				types: search.types,
			},
			to: ".",
		});
	};

	const onToggleType = (value: string) => {
		const type = value as AppointmentType;
		const current = search.types ?? [];
		const next = current.includes(type)
			? current.filter((t) => t !== type)
			: [...current, type];
		router.navigate({
			replace: true,
			search: {
				query: search.query,
				seasonId: search.seasonId,
				types: next.length > 0 ? next : undefined,
			},
			to: ".",
		});
	};

	const onClearFilters = () => {
		setQueryInput("");
		router.navigate({ replace: true, search: {}, to: "." });
	};

	const onLoadMore = () => {
		router.navigate({
			replace: true,
			search: { ...search, skip: items.length },
			to: ".",
		});
	};

	const remaining = matchedTotal - items.length;

	const filterSegments: FilterBarSegment[] = [
		{
			key: "type",
			label: m.appointments_type(),
			onToggle: onToggleType,
			options: typeFilterOptions,
			type: "checkbox",
			values: search.types ?? [],
		},
		...(seasons.length > 0
			? [
					{
						key: "season",
						label: m.common_season(),
						onChange: onSeasonChange,
						options: seasons.map((season) => ({
							label: season.name,
							value: season.id,
						})),
						type: "radio",
						value: search.seasonId ?? ALL_SEASONS,
					} satisfies FilterBarSegment,
				]
			: []),
	];

	return {
		filterSegments,
		isNavigating,
		items,
		onClearFilters,
		onLoadMore,
		queryInput,
		remaining,
		router,
		setItems,
		setQueryInput,
		...selection,
	};
}
