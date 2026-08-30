import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RotateCcwIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import {
	bulkRestoreAppointments,
	getTrashAppointmentsPage,
} from "@/api/appointments";
import { getSeasons } from "@/api/seasons";
import {
	appointmentFilterSearchSchema,
	appointmentListColumns,
	BATCH_SIZE,
	SelectionStatusBar,
} from "@/components/appointments/appointmentListShared";
import { LoadMoreFooter } from "@/components/appointments/LoadMoreFooter";
import { DetailsList } from "@/components/DetailsList";
import { FilterBar } from "@/components/FilterBar";
import { RestoreModal } from "@/components/modal/RestoreModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAppointmentFilterList } from "@/hooks/useAppointmentFilterList";
import { m } from "@/paraglide/messages";

// biome-ignore assist/source/useSortedKeys: validateSearch and loaderDeps need to be before loader
export const Route = createFileRoute("/_authed/appts/trash")({
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
			getTrashAppointmentsPage({
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
		meta: [{ title: m.appointments_trash() }],
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

	const [isConfirmingRestore, setIsConfirmingRestore] = React.useState(false);
	const [pendingRestore, setPendingRestore] = React.useState<
		{ mode: "ids"; ids: string[] } | { mode: "matching" } | null
	>(null);

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

	const bulkRestoreServerFn = useServerFn(bulkRestoreAppointments);
	const onRestore = async () => {
		if (!pendingRestore) return;
		try {
			const response = await bulkRestoreServerFn({
				data:
					pendingRestore.mode === "matching"
						? {
								excludeIds: Array.from(excludeIds),
								matching: {
									query: search.query,
									seasonId: search.seasonId,
									types: search.types,
								},
							}
						: { ids: pendingRestore.ids },
			});
			if (pendingRestore.mode === "matching") {
				setItems((prev) => prev.filter((item) => excludeIds.has(item.id)));
				exitSelectAllMatching();
			} else {
				const restoredIds = pendingRestore.ids;
				setItems((prev) =>
					prev.filter((item) => !restoredIds.includes(item.id)),
				);
				setExplicitSelection({});
			}
			setIsConfirmingRestore(false);
			setPendingRestore(null);
			await router.invalidate();
			toast.success(response.message);
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h1 className="font-bold text-lg">{m.appointments_trash()}</h1>
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
				segments={filterSegments}
				onReset={onClearFilters}
			/>

			<SelectionStatusBar
				matchedTotal={matchedTotal}
				selectAllMatching={selectAllMatching}
				excludeCount={excludeIds.size}
				selectedCount={selectedCount}
				onExitSelectAllMatching={exitSelectAllMatching}
				onEnterSelectAllMatching={enterSelectAllMatching}
			/>

			<div
				className={isNavigating ? "pointer-events-none opacity-60" : undefined}
			>
				<DetailsList
					items={items}
					getItemId={(item) => item.id}
					columns={appointmentListColumns}
					emptyMessage={m.appointments_no_deleted_appointments_found()}
					selection={selection}
					onSelectionChange={onSelectionChange}
					commandBarItems={[
						{
							icon: <RotateCcwIcon className="size-4" />,
							isDisabled: () => selectedCount === 0,
							key: "restore-selected",
							label: m.appointments_restore_selected(),
							onClick: (selected) => {
								setPendingRestore(
									selectAllMatching
										? { mode: "matching" }
										: { ids: selected.map((item) => item.id), mode: "ids" },
								);
								setIsConfirmingRestore(true);
							},
							variant: "secondary",
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

			<RestoreModal
				label={m.appointments_are_you_sure_you_want_to_restore_n_appointments({
					param1: (pendingRestore?.mode === "matching"
						? selectedCount
						: (pendingRestore?.ids.length ?? 0)
					).toString(),
				})}
				open={isConfirmingRestore}
				onClose={() => {
					setIsConfirmingRestore(false);
					setPendingRestore(null);
				}}
				onRestore={onRestore}
			/>
		</div>
	);
}
