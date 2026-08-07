import {
	createFileRoute,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import type { SortingState } from "@tanstack/react-table";
import React from "react";
import { z } from "zod";
import { getTransactionsPage } from "@/api/appointments";
import { JournalMobileRow } from "@/components/appointments/JournalMobileRow";
import { LoadMoreFooter } from "@/components/appointments/LoadMoreFooter";
import { TransactionDetail } from "@/components/appointments/TransactionDetail";
import { DetailsList, type DetailsListColumn } from "@/components/DetailsList";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useLoadMoreBatch } from "@/hooks/useLoadMoreBatch";
import type { Appointment, Transaction, User } from "@/lib/prisma/client";
import { TransactionType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import {
	getChangedFields,
	type TransactionChanges,
	transactionActionBadge,
} from "@/lib/transactionLabels";
import {
	cn,
	createColorForUserId,
	formatRelativeTime,
	shortenUserName,
} from "@/lib/utils";

const BATCH_SIZE = 25;

const journalSearchSchema = z.object({
	query: z.string().optional(),
	skip: z.number().int().nonnegative().optional(),
	sort: z.enum(["asc", "desc"]).optional(),
	type: z.enum(["CREATE", "UPDATE", "DELETE", "RESTORE"]).optional(),
});

// biome-ignore assist/source/useSortedKeys: validateSearch and loaderDeps need to be before loader
export const Route = createFileRoute("/_authed/appts/journal")({
	component: RouteComponent,
	validateSearch: journalSearchSchema,
	loaderDeps: ({ search }) => ({ ...search }),
	loader: async ({ deps }) => {
		const skip = deps.skip ?? 0;
		const res = await getTransactionsPage({
			data: {
				query: deps.query,
				skip,
				sortDirection: deps.sort,
				take: BATCH_SIZE,
				type: deps.type,
			},
		});
		const response = await res.json();
		if (res.status < 400) {
			const data = response.data ?? {
				grandTotal: 0,
				matchedTotal: 0,
				transactions: [],
			};
			return { ...data, skip };
		}
		throw new Error(response.message);
	},
	head: () => ({
		meta: [{ title: t("Transaction Journal") }],
	}),
});

type TransactionWithRelations = Transaction & {
	user: User | null;
	appointment: Appointment;
};

const typeFilters: { value: TransactionType | "ALL"; label: string }[] = [
	{ label: t("All actions"), value: "ALL" },
	{ label: t("Created"), value: TransactionType.CREATE },
	{ label: t("Changed"), value: TransactionType.UPDATE },
	{ label: t("Deleted"), value: TransactionType.DELETE },
	{ label: t("Restored"), value: TransactionType.RESTORE },
];

const getTransactionColumns =
	(): DetailsListColumn<TransactionWithRelations>[] => [
		{
			key: "time",
			label: t("Time"),
			render: (item) => (
				<span className="whitespace-nowrap text-muted-foreground text-xs">
					{formatRelativeTime(item.createdAt)}
				</span>
			),
			sortable: true,
			sortFn: (a, b) =>
				new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		},
		{
			key: "person",
			label: t("Person"),
			render: (item) => {
				if (!item.user) {
					return (
						<span className="text-muted-foreground text-sm">
							{t("Deleted user")}
						</span>
					);
				}
				const color = createColorForUserId(item.user.id);
				return (
					<div className="flex items-center gap-2">
						<Avatar size="sm" className="shrink-0">
							<AvatarFallback
								style={{
									backgroundColor: color.backgroundColor,
									color: color.foregroundColor,
								}}
							>
								{shortenUserName(item.user.name)}
							</AvatarFallback>
						</Avatar>
						<span className="text-sm">{item.user.name}</span>
					</div>
				);
			},
		},
		{
			key: "appointment",
			label: t("Appointment"),
			render: (item) => (
				<Link
					to="/appts/$apptId"
					params={{ apptId: item.appointment.id }}
					onClick={(e) => e.stopPropagation()}
					className="truncate text-sm"
				>
					{item.appointment.shortTitle}
				</Link>
			),
		},
		{
			key: "action",
			label: t("Action"),
			render: (item) => {
				const badge = transactionActionBadge(item.type);
				return <Badge variant={badge.variant}>{badge.label}</Badge>;
			},
		},
		{
			key: "changed",
			label: t("Changed"),
			render: (item) => {
				const fields = getChangedFields(
					item.changes as TransactionChanges | null,
				);
				return (
					<span className="text-muted-foreground text-xs">
						{fields.length > 0
							? t("{0} fields changed", fields.length.toString())
							: "—"}
					</span>
				);
			},
		},
	];

function RouteComponent() {
	const {
		transactions: batch,
		matchedTotal,
		grandTotal,
		skip,
	} = Route.useLoaderData();
	const search = Route.useSearch();
	const router = useRouter();
	const isNavigating = useRouterState({ select: (s) => s.isLoading });
	const prefersReducedMotion = usePrefersReducedMotion();
	const isMobile = useIsMobile();

	const [queryInput, setQueryInput] = React.useState(search.query ?? "");
	const [selectedId, setSelectedId] = React.useState<string | null>(null);

	// Drag-to-dismiss for the mobile sheet's handle: follows the pointer 1:1
	// while dragging, then either snaps back or closes depending on how far
	// past the threshold the sheet was pulled.
	const dragStartY = React.useRef<number | null>(null);
	const [dragOffset, setDragOffset] = React.useState(0);
	const [isDragging, setIsDragging] = React.useState(false);
	const DISMISS_THRESHOLD = 96;

	const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId);
		dragStartY.current = e.clientY;
		setIsDragging(true);
	};

	const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (dragStartY.current === null) return;
		setDragOffset(Math.max(0, e.clientY - dragStartY.current));
	};

	const onHandlePointerEnd = () => {
		dragStartY.current = null;
		setIsDragging(false);
		if (dragOffset > DISMISS_THRESHOLD) setSelectedId(null);
		setDragOffset(0);
	};

	const filterKey = `${search.query ?? ""}|${search.type ?? ""}|${search.sort ?? ""}`;
	const { items, appended } = useLoadMoreBatch(batch, skip, filterKey);
	const newIds = React.useMemo(
		() => new Set(appended.map((t) => t.id)),
		[appended],
	);

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
						sort: current.sort,
						type: current.type,
					},
					to: ".",
				});
			}
		}, 300);
		return () => clearTimeout(timeout);
	}, [queryInput]);

	const onTypeChange = (value: TransactionType | "ALL") => {
		router.navigate({
			replace: true,
			search: {
				query: search.query,
				sort: search.sort,
				type: value === "ALL" ? undefined : value,
			},
			to: ".",
		});
	};

	const onLoadMore = () => {
		router.navigate({
			replace: true,
			search: {
				query: search.query,
				skip: items.length,
				sort: search.sort,
				type: search.type,
			},
			to: ".",
		});
	};

	// Sorting is server-driven (see getTransactionsPage) since the list is
	// loaded in batches: reordering only the rows already fetched would leave
	// later "Load more" pages out of order. Toggling the header instead
	// re-fetches from the start with the new order.
	const sorting: SortingState =
		search.sort != null ? [{ desc: search.sort === "desc", id: "time" }] : [];

	const onSortingChange = (next: SortingState) => {
		const timeSort = next.find((s) => s.id === "time");
		router.navigate({
			replace: true,
			search: {
				query: search.query,
				sort: timeSort ? (timeSort.desc ? "desc" : "asc") : undefined,
				type: search.type,
			},
			to: ".",
		});
	};

	const selected = items.find((item) => item.id === selectedId) ?? null;
	const remaining = matchedTotal - items.length;

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h1 className="font-bold text-lg">{t("Transaction Journal")}</h1>
				<p className="text-muted-foreground text-sm">
					{t(
						"{0} of {1} events",
						matchedTotal.toString(),
						grandTotal.toString(),
					)}
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<Input
					placeholder={t("Search appointment or person...")}
					value={queryInput}
					onChange={(e) => setQueryInput(e.target.value)}
					className="w-64"
				/>
				<Select
					value={search.type ?? "ALL"}
					onValueChange={(v) => onTypeChange(v as TransactionType | "ALL")}
				>
					<SelectTrigger size="sm" className="w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{typeFilters.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Mobile layout: stacked card rows + a bottom-sheet detail view. */}
			<div className="lg:hidden">
				{items.length === 0 ? (
					<div className="py-8 text-center text-muted-foreground">
						{t("No items found")}
					</div>
				) : (
					<div className="flex flex-col rounded-lg bg-card">
						{items.map((item) => (
							<JournalMobileRow
								key={item.id}
								transaction={item}
								isSelected={item.id === selectedId}
								isNew={!prefersReducedMotion && newIds.has(item.id)}
								onClick={() =>
									setSelectedId(item.id === selectedId ? null : item.id)
								}
							/>
						))}
					</div>
				)}
			</div>

			{/* Table and detail rail are siblings in the same row, so they start
			    flush with each other instead of the rail trailing the header. */}
			<div className="hidden gap-4 lg:grid lg:grid-cols-[1fr_360px]">
				<div className="flex min-w-0 flex-col gap-3 overflow-x-auto rounded-lg bg-card p-3">
					<DetailsList
						items={items}
						getItemId={(item) => item.id}
						columns={getTransactionColumns()}
						sorting={sorting}
						onSortingChange={onSortingChange}
						onRenderRow={(item, children) => {
							const isNew = !prefersReducedMotion && newIds.has(item.id);
							return (
								<TableRow
									key={item.id}
									data-testid="journal-row"
									className={cn(
										"h-11 cursor-pointer",
										item.id === selectedId && "bg-muted",
										isNew &&
											"fade-in slide-in-from-top-1 animate-in duration-200 ease-out",
									)}
									onClick={() =>
										setSelectedId(item.id === selectedId ? null : item.id)
									}
								>
									{children}
								</TableRow>
							);
						}}
						selectMode="none"
					/>
				</div>
				<div className="lg:sticky lg:top-6 lg:h-fit">
					{selected ? (
						<div className="rounded-lg bg-card p-4">
							<TransactionDetail transaction={selected} />
						</div>
					) : (
						<div className="rounded-lg border border-border/60 border-dashed p-4 text-center text-muted-foreground text-sm">
							{t("Select a row to see details")}
						</div>
					)}
				</div>
			</div>

			<LoadMoreFooter
				itemCount={items.length}
				remaining={remaining}
				matchedTotal={matchedTotal}
				isNavigating={isNavigating}
				batchSize={BATCH_SIZE}
				onLoadMore={onLoadMore}
			/>

			<Sheet
				open={!!selected && isMobile}
				onOpenChange={(open) => !open && setSelectedId(null)}
			>
				<SheetContent
					side="bottom"
					showCloseButton={false}
					className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-t-0 duration-300 lg:hidden"
					style={
						dragOffset > 0
							? {
									transform: `translateY(${dragOffset}px)`,
									transitionDuration:
										isDragging || prefersReducedMotion ? "0ms" : undefined,
								}
							: undefined
					}
				>
					<SheetTitle className="sr-only">{t("Details")}</SheetTitle>
					<div
						className="flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-1 active:cursor-grabbing"
						onPointerDown={onHandlePointerDown}
						onPointerMove={onHandlePointerMove}
						onPointerUp={onHandlePointerEnd}
						onPointerCancel={onHandlePointerEnd}
					>
						<div className="h-1.5 w-9 rounded-full bg-muted-foreground/30" />
					</div>
					{selected && (
						<div className="px-4 pb-6">
							<TransactionDetail transaction={selected} />
						</div>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}
