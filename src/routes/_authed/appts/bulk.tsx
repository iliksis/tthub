import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CopyIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import {
	type AppointmentWithSeason,
	bulkCopyAppointmentsToSeason,
	bulkDeleteAppointments,
	getBulkAppointmentsPage,
} from "@/api/appointments";
import { getSeasons } from "@/api/seasons";
import {
	AppointmentCardList,
	AppointmentMobileFilters,
	appointmentFilterSearchSchema,
	appointmentListColumns,
	BATCH_SIZE,
	MobileCommandDock,
	SelectionStatusBar,
} from "@/components/appointments/appointmentListShared";
import { LoadMoreFooter } from "@/components/appointments/LoadMoreFooter";
import { type CommandBarItem, DetailsList } from "@/components/DetailsList";
import { FilterBar } from "@/components/FilterBar";
import { CopyToSeasonModal } from "@/components/modal/CopyToSeasonModal";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAppointmentFilterList } from "@/hooks/useAppointmentFilterList";
import { useBulkListAction } from "@/hooks/useBulkListAction";
import { useMutation } from "@/hooks/useMutation";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

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
	validateSearch: appointmentFilterSearchSchema,
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
					types: deps.types,
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

function RouteComponent() {
	const {
		appointments: batch,
		matchedTotal,
		grandTotal,
		skip,
		seasons,
	} = Route.useLoaderData();
	const search = Route.useSearch();

	const [isConfirmingCopy, setIsConfirmingCopy] = React.useState(false);
	const [pendingCopy, setPendingCopy] = React.useState<
		{ mode: "ids"; ids: string[] } | { mode: "matching" } | null
	>(null);
	const [targetSeasonId, setTargetSeasonId] = React.useState<
		string | undefined
	>(seasons.find((season) => season.isActive)?.id);

	const {
		router,
		isNavigating,
		queryInput,
		setQueryInput,
		items,
		setItems,
		filterSegments,
		onClearFilters,
		onLoadMore,
		remaining,
		selection,
		onSelectionChange,
		selectAllMatching,
		excludeIds,
		selectedCount,
		exitSelectAllMatching,
		enterSelectAllMatching,
		setExplicitSelection,
	} = useAppointmentFilterList({
		batch,
		getItemId: (item) => item.id,
		matchedTotal,
		search,
		seasons,
		skip,
	});

	const {
		isConfirming: isConfirmingDelete,
		setIsConfirming: setIsConfirmingDelete,
		pending: pendingDelete,
		setPending: setPendingDelete,
		run: onDelete,
	} = useBulkListAction({
		excludeIds,
		exitSelectAllMatching,
		router,
		search,
		serverFn: useServerFn(bulkDeleteAppointments),
		setExplicitSelection,
		setItems,
	});

	const bulkCopyServerFn = useServerFn(bulkCopyAppointmentsToSeason);
	// See useBulkListAction's `resyncToFirstPage`: a plain router.invalidate()
	// only refetches the current `skip`, which can't reconcile `items` against
	// a changed `matchedTotal` after paging via "load more" — reset to skip=0
	// instead so useLoadMoreBatch fully resyncs from fresh data.
	const resyncToFirstPage = () =>
		router.navigate({
			replace: true,
			search: {
				query: search.query,
				seasonId: search.seasonId,
				types: search.types,
			},
			to: ".",
		});
	const copyMutation = useMutation({
		fn: bulkCopyServerFn,
		onError: async (err) => {
			toast.error((err as Error).message);
			setIsConfirmingCopy(false);
			setPendingCopy(null);
			// See useBulkListAction's onError: a partial failure can leave some
			// rows already mutated even though this call threw, and there's no
			// reliable way to tell here which ones — clear selection state and
			// resync from the server instead of leaving a stale selection in
			// place.
			setExplicitSelection({});
			exitSelectAllMatching();
			await resyncToFirstPage();
		},
		onSuccess: async (ctx) => {
			if (!pendingCopy) return;
			if (pendingCopy.mode === "matching") {
				exitSelectAllMatching();
			} else {
				setExplicitSelection({});
			}
			setIsConfirmingCopy(false);
			setPendingCopy(null);
			await resyncToFirstPage();
			toast.success(ctx.data.message);
		},
	});
	const onCopy = async () => {
		if (!pendingCopy || !targetSeasonId) return;
		await copyMutation.mutate({
			data: {
				targetSeasonId,
				...(pendingCopy.mode === "matching"
					? {
							excludeIds: Array.from(excludeIds),
							matching: {
								query: search.query,
								seasonId: search.seasonId,
								types: search.types,
							},
						}
					: { ids: pendingCopy.ids }),
			},
		});
	};

	const commandBarItems: CommandBarItem<AppointmentWithSeason>[] = [
		{
			icon: <CopyIcon className="size-4" />,
			// `selected` reflects the currently loaded rows that are part of the
			// selection (see useBulkSelection's `selection` memo, which marks all
			// loaded items as selected minus excludeIds when selectAllMatching is
			// on) — checking it the same way in both modes means "select all
			// matching" filtered down to an all-HOLIDAY result (seasonId: null)
			// correctly disables Copy instead of opening a modal that copies
			// nothing.
			isDisabled: (selected) =>
				!selected.some((item) => item.seasonId !== null),
			key: "copy-to-season",
			label: m.appointments_copy_to_season(),
			onClick: (selected) => {
				setPendingCopy(
					selectAllMatching
						? { mode: "matching" }
						: { ids: selected.map((item) => item.id), mode: "ids" },
				);
				setIsConfirmingCopy(true);
			},
			variant: "secondary",
		},
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
	];
	const selectedItems = items.filter((item) => selection[item.id]);

	return (
		<div className="flex flex-col gap-4 pb-20 lg:pb-0">
			<div className="hidden lg:flex flex-col gap-1">
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

			<div className="hidden lg:block">
				<FilterBar
					search={{
						onChange: setQueryInput,
						placeholder: m.appointments_search_appointment(),
						value: queryInput,
					}}
					segments={filterSegments}
					onReset={onClearFilters}
				/>
			</div>
			<div className="lg:hidden">
				<AppointmentMobileFilters
					queryInput={queryInput}
					setQueryInput={setQueryInput}
					segments={filterSegments}
					onClearFilters={onClearFilters}
				/>
			</div>

			<SelectionStatusBar
				matchedTotal={matchedTotal}
				selectAllMatching={selectAllMatching}
				excludeCount={excludeIds.size}
				selectedCount={selectedCount}
				onExitSelectAllMatching={exitSelectAllMatching}
				onEnterSelectAllMatching={enterSelectAllMatching}
			/>

			<div
				className={cn(
					"hidden lg:block",
					isNavigating && "pointer-events-none opacity-60",
				)}
			>
				<DetailsList
					items={items}
					getItemId={(item) => item.id}
					columns={appointmentListColumns}
					emptyMessage={m.appointments_no_appointments_found()}
					selection={selection}
					onSelectionChange={onSelectionChange}
					commandBarItems={commandBarItems}
				/>
			</div>

			<div
				className={cn(
					"lg:hidden",
					isNavigating && "pointer-events-none opacity-60",
				)}
			>
				<AppointmentCardList
					items={items}
					getItemId={(item) => item.id}
					selection={selection}
					onSelectionChange={onSelectionChange}
					emptyMessage={m.appointments_no_appointments_found()}
				/>
			</div>

			<MobileCommandDock
				commandBarItems={commandBarItems}
				selectedItems={selectedItems}
				visible={selectedCount > 0}
				isNavigating={isNavigating}
			/>

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
					count:
						pendingDelete?.mode === "matching"
							? selectedCount
							: (pendingDelete?.ids.length ?? 0),
				})}
				open={isConfirmingDelete}
				onClose={() => {
					setIsConfirmingDelete(false);
					setPendingDelete(null);
				}}
				onDelete={onDelete}
			/>

			<CopyToSeasonModal
				open={isConfirmingCopy}
				seasons={seasons}
				targetSeasonId={targetSeasonId}
				onTargetSeasonChange={setTargetSeasonId}
				label={m.appointments_copy_n_appointments_to_season({
					count:
						pendingCopy?.mode === "matching"
							? selectedCount
							: (pendingCopy?.ids.length ?? 0),
				})}
				onClose={() => {
					setIsConfirmingCopy(false);
					setPendingCopy(null);
				}}
				onCopy={onCopy}
			/>
		</div>
	);
}
