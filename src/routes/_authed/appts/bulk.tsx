import {
	createFileRoute,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { RowSelectionState } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
	type AppointmentWithSeason,
	bulkDeleteAppointments,
	getBulkAppointmentsPage,
} from "@/api/appointments";
import { getSeasons } from "@/api/seasons";
import { LoadMoreFooter } from "@/components/appointments/LoadMoreFooter";
import { DetailsList, type DetailsListColumn } from "@/components/DetailsList";
import { FilterBar, type FilterBarSegment } from "@/components/FilterBar";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link as EntityLink } from "@/components/ui/link";
import { useLoadMoreBatch } from "@/hooks/useLoadMoreBatch";
import type { AppointmentType } from "@/lib/prisma/enums";
import { m } from "@/paraglide/messages";

const BATCH_SIZE = 25;
const ALL_SEASONS = "ALL";

const appointmentTypeLabel: Record<AppointmentType, string> = {
	HOLIDAY: m.common_holiday(),
	TEAM_MATCH: m.common_team_matches(),
	TOURNAMENT: m.common_tournament(),
	TOURNAMENT_DE: m.common_tournament_germany(),
};

const bulkSearchSchema = z.object({
	query: z.string().optional(),
	seasonId: z.string().optional(),
	skip: z.number().int().nonnegative().optional(),
});

// biome-ignore assist/source/useSortedKeys: validateSearch and loaderDeps need to be before loader
export const Route = createFileRoute("/_authed/appts/bulk")({
	beforeLoad: async ({ context }) => {
		if (
			!context.user ||
			(context.user.role !== "ADMIN" && context.user.role !== "EDITOR")
		) {
			throw Error("Forbidden");
		}
	},
	component: RouteComponent,
	errorComponent: () => (
		<Alert variant="destructive">
			<AlertDescription>
				{m.appointments_you_do_not_have_permission_to_manage_appointments()}
			</AlertDescription>
		</Alert>
	),
	validateSearch: bulkSearchSchema,
	loaderDeps: ({ search }) => ({ ...search }),
	loader: async ({ deps }) => {
		const skip = deps.skip ?? 0;
		const [response, seasonsRes] = await Promise.all([
			getBulkAppointmentsPage({
				data: {
					query: deps.query,
					seasonId: deps.seasonId,
					skip,
					take: BATCH_SIZE,
				},
			}),
			getSeasons(),
		]);
		const data = response.data ?? {
			appointments: [],
			grandTotal: 0,
			matchedTotal: 0,
		};
		const seasons = seasonsRes.data ?? [];
		return { ...data, seasons, skip };
	},
	head: () => ({
		meta: [{ title: m.appointments_bulk_management() }],
	}),
});

function formatDate(date: Date | string) {
	return new Date(date).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "2-digit",
	});
}

const columns: DetailsListColumn<AppointmentWithSeason>[] = [
	{
		key: "shortTitle",
		label: m.appointments_appointment(),
		render: (item) => (
			<EntityLink to="/appts/$apptId" params={{ apptId: item.id }}>
				{item.shortTitle}
			</EntityLink>
		),
	},
	{
		key: "type",
		label: m.appointments_type(),
		render: (item) => appointmentTypeLabel[item.type],
	},
	{
		key: "season",
		label: m.common_season(),
		render: (item) => item.season?.name ?? "—",
	},
	{
		key: "startDate",
		label: m.appointments_startdate(),
		render: (item) => formatDate(item.startDate),
	},
	{
		key: "location",
		label: m.appointments_location(),
		render: (item) => item.location ?? "—",
	},
];

function RouteComponent() {
	const {
		appointments: batch,
		matchedTotal,
		grandTotal,
		skip,
		seasons,
	} = Route.useLoaderData();
	const search = Route.useSearch();
	const router = useRouter();
	const isNavigating = useRouterState({ select: (s) => s.isLoading });

	const [queryInput, setQueryInput] = React.useState(search.query ?? "");
	const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);
	const [pendingDelete, setPendingDelete] = React.useState<
		{ mode: "ids"; ids: string[] } | { mode: "matching" } | null
	>(null);

	const filterKey = `${search.query ?? ""}|${search.seasonId ?? ""}`;
	const { items, setItems } = useLoadMoreBatch(batch, skip, filterKey);

	// Both explicit selection and select-all-matching (plus its exclude-list)
	// are scoped to the current filter view: the ids/exclusions they reference
	// stop meaning anything once the filter — and therefore the rendered
	// `items` — changes, so the whole selection resets whenever filterKey
	// changes (the same derive-during-render reset pattern useLoadMoreBatch
	// uses for `items`).
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

	const selection = React.useMemo<RowSelectionState>(() => {
		if (!selectAllMatching) return explicitSelection;
		const sel: RowSelectionState = {};
		for (const item of items) {
			if (!excludeIds.has(item.id)) sel[item.id] = true;
		}
		return sel;
	}, [selectAllMatching, excludeIds, explicitSelection, items]);

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
					if (next[item.id]) {
						nextExclude.delete(item.id);
					} else {
						nextExclude.add(item.id);
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

	const bulkDeleteServerFn = useServerFn(bulkDeleteAppointments);
	const onDelete = async () => {
		if (!pendingDelete) return;
		try {
			const response = await bulkDeleteServerFn({
				data:
					pendingDelete.mode === "matching"
						? {
								excludeIds: Array.from(excludeIds),
								matching: { query: search.query, seasonId: search.seasonId },
							}
						: { ids: pendingDelete.ids },
			});
			if (pendingDelete.mode === "matching") {
				setItems((prev) => prev.filter((item) => excludeIds.has(item.id)));
				exitSelectAllMatching();
			} else {
				const deletedIds = pendingDelete.ids;
				setItems((prev) =>
					prev.filter((item) => !deletedIds.includes(item.id)),
				);
				setExplicitSelection({});
			}
			setIsConfirmingDelete(false);
			setPendingDelete(null);
			await router.invalidate();
			toast.success(response.message);
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	const remaining = matchedTotal - items.length;

	const seasonSegments: FilterBarSegment[] =
		seasons.length > 0
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
					},
				]
			: [];

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h1 className="font-bold text-lg">
					{m.appointments_bulk_management()}
				</h1>
				<p className="text-muted-foreground text-sm">
					{m.appointments_n_of_n_events({
						param1: matchedTotal.toString(),
						param2: grandTotal.toString(),
					})}
				</p>
			</div>

			<FilterBar
				search={{
					onChange: setQueryInput,
					placeholder: m.appointments_search_appointment(),
					value: queryInput,
				}}
				segments={seasonSegments}
				onReset={onClearFilters}
			/>

			{matchedTotal > 0 && (
				<div className="flex flex-wrap items-center gap-2 text-sm">
					{selectAllMatching ? (
						<>
							<span className="text-muted-foreground">
								{excludeIds.size > 0
									? m.appointments_n_matching_excluded({
											param1: selectedCount.toString(),
											param2: excludeIds.size.toString(),
										})
									: m.appointments_n_matching_selected_count({
											count: selectedCount,
										})}
							</span>
							<Button
								type="button"
								variant="link"
								size="sm"
								className="h-auto p-0"
								onClick={exitSelectAllMatching}
							>
								{m.common_clear_selection()}
							</Button>
						</>
					) : (
						<>
							{selectedCount > 0 && (
								<span className="text-muted-foreground">
									{m.appointments_appointment_selected_count({
										count: selectedCount,
									})}
								</span>
							)}
							<Button
								type="button"
								variant="link"
								size="sm"
								className="h-auto p-0"
								onClick={() => {
									setExplicitSelection({});
									setExcludeIds(new Set());
									setSelectAllMatching(true);
								}}
							>
								{m.appointments_select_all_n_matching_filters({
									param1: matchedTotal.toString(),
								})}
							</Button>
						</>
					)}
				</div>
			)}

			<div
				className={isNavigating ? "pointer-events-none opacity-60" : undefined}
			>
				<DetailsList
					items={items}
					getItemId={(item) => item.id}
					columns={columns}
					emptyMessage={m.appointments_no_appointments_found()}
					selection={selection}
					onSelectionChange={onSelectionChange}
					commandBarItems={[
						{
							icon: <Trash2Icon className="size-4" />,
							isDisabled: () => selectedCount === 0,
							key: "delete-selected",
							label: m.appointments_delete_selected(),
							onClick: (selected) => {
								setPendingDelete(
									selectAllMatching
										? { mode: "matching" }
										: { ids: selected.map((item) => item.id), mode: "ids" },
								);
								setIsConfirmingDelete(true);
							},
							variant: "error",
						},
					]}
				/>
			</div>

			<LoadMoreFooter
				itemCount={items.length}
				remaining={remaining}
				matchedTotal={matchedTotal}
				isNavigating={isNavigating}
				batchSize={BATCH_SIZE}
				onLoadMore={onLoadMore}
			/>

			<DeleteModal
				label={m.appointments_are_you_sure_you_want_to_delete_n_appointments({
					param1: (pendingDelete?.mode === "matching"
						? selectedCount
						: (pendingDelete?.ids.length ?? 0)
					).toString(),
				})}
				open={isConfirmingDelete}
				onClose={() => {
					setIsConfirmingDelete(false);
					setPendingDelete(null);
				}}
				onDelete={onDelete}
			/>
		</div>
	);
}
