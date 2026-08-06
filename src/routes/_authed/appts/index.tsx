import {
	createFileRoute,
	Link,
	useRouteContext,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	CalendarDaysIcon,
	CalendarPlusIcon,
	CheckCircle2Icon,
	ChevronDownIcon,
	CopyIcon,
	EyeOffIcon,
	ListIcon,
	Loader2Icon,
	MapPinIcon,
	RotateCcwIcon,
	Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
	createAppointment,
	createResponse,
	deleteAppointment,
	getAppointmentsPage,
	getCalendarAppointments,
	publishAppointment,
	restoreAppointment,
	unpublishAppointment,
} from "@/api/appointments";
import {
	filterSchema,
	getAppointmentColumns,
	InlineFilters,
	List,
	MobileFilters,
} from "@/components/appointments/List";
import { MobileCalendar } from "@/components/calendar/MobileCalendar";
import type { CalendarAppointment } from "@/components/calendar/MonthCalendar";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { DetailsList } from "@/components/DetailsList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { buildMonthGrid } from "@/lib/calendarGrid";
import type { Appointment, Response } from "@/lib/prisma/client";
import {
	AppointmentStatus,
	AppointmentType,
	ResponseType,
} from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { cn, isDayInPast } from "@/lib/utils";

const BATCH_SIZE = 25;

const searchSchema = filterSchema.extend({
	month: z.number().int().min(0).max(11).optional(),
	view: z.enum(["list", "calendar"]).optional(),
	year: z.number().int().optional(),
});

type CalendarLoaderData = {
	appointments: CalendarAppointment[];
	monthIndex: number;
	year: number;
};

async function loadCalendarData(
	month: number | undefined,
	year: number | undefined,
): Promise<CalendarLoaderData> {
	const today = new Date();
	const resolvedYear = year ?? today.getFullYear();
	const monthIndex = month ?? today.getMonth();
	const weeks = buildMonthGrid(resolvedYear, monthIndex, today);
	const start = weeks[0][0].fullDate;
	const lastCell = weeks.at(-1)?.at(-1);
	const end = new Date(lastCell?.fullDate ?? start);
	end.setDate(end.getDate() + 1);

	const res = await getCalendarAppointments({ data: { end, start } });
	const response = await res.json();
	if (res.status < 400) {
		const appointments: CalendarAppointment[] = (response.data ?? []).map(
			(a) => ({
				...a,
				end: new Date(a.end),
				start: new Date(a.start),
			}),
		);
		return { appointments, monthIndex, year: resolvedYear };
	}
	throw new Error(response.message);
}

// biome-ignore assist/source/useSortedKeys: validateSearch and loaderDeps need to be before loader
export const Route = createFileRoute("/_authed/appts/")({
	component: RouteComponent,
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({ ...search }),
	loader: async ({ deps }) => {
		const skip = deps.skip ?? 0;
		const res = await getAppointmentsPage({
			data: {
				dateFrom: deps.dateFrom ? new Date(deps.dateFrom) : undefined,
				dateTo: deps.dateTo ? new Date(deps.dateTo) : undefined,
				query: deps.query,
				response: deps.response,
				skip,
				take: BATCH_SIZE,
				type: deps.type,
				withDeleted: deps.deleted,
			},
		});
		const response = await res.json();
		if (res.status < 400) {
			const data = response.data ?? {
				appointments: [],
				grandTotal: 0,
				matchedTotal: 0,
			};
			const calendar =
				deps.view === "calendar"
					? await loadCalendarData(deps.month, deps.year)
					: null;
			return { ...data, calendar, skip };
		}
		throw new Error(response.message);
	},
	errorComponent: () => {
		return (
			<Alert variant="destructive">
				<AlertDescription>
					{t("Appointments could not be loaded")}
				</AlertDescription>
			</Alert>
		);
	},
	head: () => ({
		meta: [{ title: t("Appointments") }],
	}),
});

type AppointmentWithResponses = Appointment & { responses: Response[] };

function typeLabel(type: string) {
	if (type === AppointmentType.HOLIDAY) return t("Holiday");
	if (type === AppointmentType.TOURNAMENT_DE) return t("Tournament (Germany)");
	return t("Tournament");
}

function formatDateTime(date: Date | string) {
	return new Date(date).toLocaleString("de-DE", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "short",
		weekday: "short",
	});
}

function monthLabel(date: Date | string) {
	return new Date(date).toLocaleDateString("de-DE", {
		month: "long",
		year: "numeric",
	});
}

function RouteComponent() {
	const {
		appointments: batch,
		matchedTotal,
		grandTotal,
		skip,
		calendar,
	} = Route.useLoaderData();
	const search = Route.useSearch();
	const router = useRouter();
	const isNavigating = useRouterState({ select: (s) => s.isLoading });
	const { user } = useRouteContext({ from: "__root__" });
	const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";
	const isCalendarView = search.view === "calendar";

	const navigateToMonth = (target: Date) => {
		router.navigate({
			replace: true,
			search: (prev) => ({
				...prev,
				month: target.getMonth(),
				view: "calendar",
				year: target.getFullYear(),
			}),
			to: ".",
		});
	};

	// The loader only ever fetches one batch (skip/take), never the whole list
	// again — so previously loaded rows are kept in state and the new batch is
	// appended to them, unless the filters changed (or this is the first
	// page), in which case it replaces them outright. Comparing against state
	// (not a ref) during render is the React-sanctioned way to reset/derive
	// state when an input changes without a useEffect round-trip.
	// `view`/`month`/`year` don't affect the list query, so they're excluded
	// here — otherwise switching to Calendar and back (or paging months)
	// would look like a filter change and reset the accumulated `items`.
	const filterKey = JSON.stringify({
		...search,
		month: undefined,
		skip: undefined,
		view: undefined,
		year: undefined,
	});
	const [items, setItems] = React.useState<AppointmentWithResponses[]>(batch);
	const [appliedLoad, setAppliedLoad] = React.useState({ filterKey, skip });
	if (appliedLoad.filterKey !== filterKey || appliedLoad.skip !== skip) {
		const isFreshView = skip === 0 || appliedLoad.filterKey !== filterKey;
		setAppliedLoad({ filterKey, skip });
		setItems((prev) => (isFreshView ? batch : [...prev, ...batch]));
	}

	const remaining = matchedTotal - items.length;
	const onLoadMore = () => {
		router.navigate({
			replace: true,
			search: { ...search, skip: items.length },
			to: ".",
		});
	};

	return (
		<>
			{/* Mobile / tablet layout */}
			<div className="flex flex-col gap-3 pb-16 lg:hidden">
				{isCalendarView ? (
					calendar && (
						<MobileCalendar
							appointments={calendar.appointments}
							year={calendar.year}
							monthIndex={calendar.monthIndex}
							onPrevMonth={() =>
								navigateToMonth(
									new Date(calendar.year, calendar.monthIndex - 1, 1),
								)
							}
							onNextMonth={() =>
								navigateToMonth(
									new Date(calendar.year, calendar.monthIndex + 1, 1),
								)
							}
							onToday={() => navigateToMonth(new Date())}
						/>
					)
				) : (
					<>
						<MobileFilters {...search} />
						<List appointments={items} />
						<AppointmentLoadMoreFooter
							items={items}
							remaining={remaining}
							matchedTotal={matchedTotal}
							isNavigating={isNavigating}
							onLoadMore={onLoadMore}
						/>
					</>
				)}
			</div>

			{/* Mobile / tablet bottom tab bar — a native-style nav, fixed to the
			    viewport bottom rather than inline with the page content. The
			    mobile content column above reserves `pb-16` so its last item
			    never sits underneath it. */}
			<nav
				className="fixed inset-x-0 bottom-0 z-30 flex border-border/60 border-t bg-background/95 backdrop-blur-sm lg:hidden"
				style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
			>
				<Link
					to="."
					search={(prev) => ({ ...prev, view: "list" })}
					className={cn(
						"flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium",
						isCalendarView ? "text-muted-foreground" : "text-primary",
					)}
				>
					<ListIcon className="size-5" />
					{t("List")}
				</Link>
				<Link
					to="."
					search={(prev) => ({ ...prev, view: "calendar" })}
					className={cn(
						"flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium",
						isCalendarView ? "text-primary" : "text-muted-foreground",
					)}
				>
					<CalendarDaysIcon className="size-5" />
					{t("Calendar")}
				</Link>
			</nav>

			{/* Desktop layout: master-detail + inline filters, or calendar */}
			<div
				className={cn(
					"hidden lg:flex lg:flex-col lg:gap-4",
					isNavigating && "pointer-events-none opacity-60",
				)}
			>
				<div className="flex items-center gap-3">
					<div className="flex flex-1 items-baseline gap-2">
						<h1 className="font-bold text-lg">{t("Appointments")}</h1>
						{!isCalendarView && (
							<p className="text-muted-foreground text-sm">
								{t(
									"{0} of {1} events",
									matchedTotal.toString(),
									grandTotal.toString(),
								)}
							</p>
						)}
					</div>
					<div className="flex overflow-hidden rounded-md border text-sm">
						<Link
							to="."
							search={(prev) => ({ ...prev, view: "list" })}
							className={cn(
								"px-3 py-1.5 font-medium",
								isCalendarView
									? "text-muted-foreground hover:bg-accent"
									: "bg-primary text-primary-foreground",
							)}
						>
							{t("List")}
						</Link>
						<Link
							to="."
							search={(prev) => ({ ...prev, view: "calendar" })}
							className={cn(
								"px-3 py-1.5 font-medium",
								isCalendarView
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-accent",
							)}
						>
							{t("Calendar")}
						</Link>
					</div>
					{canEdit && (
						<Button asChild>
							<Link to="/create">
								<CalendarPlusIcon className="size-4" />
								{t("Create appointment")}
							</Link>
						</Button>
					)}
				</div>
				{isCalendarView ? (
					calendar && (
						<MonthCalendar
							appointments={calendar.appointments}
							year={calendar.year}
							monthIndex={calendar.monthIndex}
							onPrevMonth={() =>
								navigateToMonth(
									new Date(calendar.year, calendar.monthIndex - 1, 1),
								)
							}
							onNextMonth={() =>
								navigateToMonth(
									new Date(calendar.year, calendar.monthIndex + 1, 1),
								)
							}
							onToday={() => navigateToMonth(new Date())}
						/>
					)
				) : (
					<>
						<InlineFilters {...search} />
						<AppointmentSplitView
							appointments={items}
							onAppointmentsChange={setItems}
							footer={
								<AppointmentLoadMoreFooter
									items={items}
									remaining={remaining}
									matchedTotal={matchedTotal}
									isNavigating={isNavigating}
									onLoadMore={onLoadMore}
								/>
							}
						/>
					</>
				)}
			</div>
		</>
	);
}

type AppointmentLoadMoreFooterProps = {
	items: AppointmentWithResponses[];
	remaining: number;
	matchedTotal: number;
	isNavigating: boolean;
	onLoadMore: () => void;
};

function AppointmentLoadMoreFooter({
	items,
	remaining,
	matchedTotal,
	isNavigating,
	onLoadMore,
}: AppointmentLoadMoreFooterProps) {
	if (items.length === 0) return null;

	if (remaining > 0) {
		return (
			<div className="flex justify-center border-border/60 border-t pt-3">
				<Button
					variant="outline"
					className="w-full"
					disabled={isNavigating}
					onClick={onLoadMore}
				>
					{isNavigating && <Loader2Icon className="animate-spin" />}
					{isNavigating
						? t("Loading…")
						: t(
								"Load {0} more ({1} remaining)",
								Math.min(BATCH_SIZE, remaining).toString(),
								remaining.toString(),
							)}
				</Button>
			</div>
		);
	}

	return (
		<div className="flex justify-center border-border/60 border-t pt-3">
			<span className="text-muted-foreground text-xs">
				{t("You've reached the end — {0} events", matchedTotal.toString())}
			</span>
		</div>
	);
}

const isBulkEligible = (appointment: AppointmentWithResponses) =>
	appointment.deletedAt === null &&
	appointment.type !== AppointmentType.HOLIDAY;

type SplitViewBulkAction = {
	key: string;
	label: string;
	icon: React.ReactNode;
	destructive?: boolean;
	isDisabled: boolean;
	onClick: () => void;
};

const AppointmentSplitView = ({
	appointments,
	onAppointmentsChange,
	footer,
}: {
	appointments: AppointmentWithResponses[];
	onAppointmentsChange: React.Dispatch<
		React.SetStateAction<AppointmentWithResponses[]>
	>;
	footer: React.ReactNode;
}) => {
	const { user } = useRouteContext({ from: "__root__" });
	const router = useRouter();
	const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";
	const createResponseServerFn = useServerFn(createResponse);
	const publishAppointmentServerFn = useServerFn(publishAppointment);
	const unpublishAppointmentServerFn = useServerFn(unpublishAppointment);
	const deleteAppointmentServerFn = useServerFn(deleteAppointment);
	const restoreAppointmentServerFn = useServerFn(restoreAppointment);
	const createAppointmentServerFn = useServerFn(createAppointment);
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
		() => new Set(appointments[0] ? [appointments[0].id] : []),
	);
	const [collapsedMonths, setCollapsedMonths] = React.useState<Set<string>>(
		() => new Set(),
	);

	const toggleMonth = (label: string) => {
		setCollapsedMonths((prev) => {
			const next = new Set(prev);
			if (next.has(label)) next.delete(label);
			else next.add(label);
			return next;
		});
	};

	const toggleSelected = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const selectedAppointments = appointments.filter((a) =>
		selectedIds.has(a.id),
	);
	const single =
		selectedAppointments.length === 1 ? selectedAppointments[0] : undefined;
	const myResponse = single?.responses.find((r) => r.userId === user?.id);

	const onRespond = (response: ResponseType) => async () => {
		if (!single) return;
		const userId = user?.id;
		if (!userId) return;
		const res = await createResponseServerFn({
			data: { appointmentId: single.id, response },
		});
		const data = await res.json();
		if (res.status < 400 && data) {
			const appointmentId = single.id;
			onAppointmentsChange((prev) =>
				prev.map((a) =>
					a.id === appointmentId
						? {
								...a,
								responses: [
									...a.responses.filter((r) => r.userId !== userId),
									{ appointmentId, responseType: response, userId },
								],
							}
						: a,
				),
			);
			await router.invalidate();
			return;
		}
		toast.error(data.message);
	};

	// `router.invalidate()` alone doesn't refresh this page's `items` state —
	// the parent only resyncs from loader data when the filters or `skip`
	// change (see the comment in RouteComponent), which an invalidate-only
	// refresh never does. So each bulk action also patches `items` directly
	// for instant feedback; invalidate() still runs afterwards to keep the
	// loader cache consistent for the next real navigation.
	const runBulkAction = async (
		calls: Promise<globalThis.Response>[],
		successMessage: string,
		applyLocalUpdate: () => void,
	) => {
		try {
			const results = await Promise.all(calls);
			if (results.every((res) => res.status < 400)) {
				applyLocalUpdate();
				toast.success(successMessage);
			} else {
				toast.error(t("An Error occurred"));
			}
			await router.invalidate();
		} catch {
			toast.error(t("An Error occurred"));
		}
	};

	// Available to every user, not just editors/admins — responding to a
	// batch of appointments is a personal action, not a management one.
	const onBulkRespond = (response: ResponseType) => {
		const targets = selectedAppointments.filter(
			(a) => a.type !== AppointmentType.HOLIDAY,
		);
		const userId = user?.id;
		if (targets.length === 0 || !userId) return;
		return runBulkAction(
			targets.map((a) =>
				createResponseServerFn({
					data: { appointmentId: a.id, response },
				}),
			),
			t("{0} appointments answered", targets.length.toString()),
			() => {
				const ids = new Set(targets.map((a) => a.id));
				onAppointmentsChange((prev) =>
					prev.map((a) =>
						ids.has(a.id)
							? {
									...a,
									responses: [
										...a.responses.filter((r) => r.userId !== userId),
										{ appointmentId: a.id, responseType: response, userId },
									],
								}
							: a,
					),
				);
			},
		);
	};

	const onPublish = (items: AppointmentWithResponses[]) => {
		const targets = items.filter(
			(a) => isBulkEligible(a) && a.status !== AppointmentStatus.PUBLISHED,
		);
		if (targets.length === 0) return;
		const ids = new Set(targets.map((a) => a.id));
		return runBulkAction(
			targets.map((a) => publishAppointmentServerFn({ data: { id: a.id } })),
			t("{0} appointments published", targets.length.toString()),
			() =>
				onAppointmentsChange((prev) =>
					prev.map((a) =>
						ids.has(a.id) ? { ...a, status: AppointmentStatus.PUBLISHED } : a,
					),
				),
		);
	};

	const onUnpublish = (items: AppointmentWithResponses[]) => {
		const targets = items.filter(
			(a) => isBulkEligible(a) && a.status === AppointmentStatus.PUBLISHED,
		);
		if (targets.length === 0) return;
		const ids = new Set(targets.map((a) => a.id));
		return runBulkAction(
			targets.map((a) => unpublishAppointmentServerFn({ data: { id: a.id } })),
			t("{0} appointments unpublished", targets.length.toString()),
			() =>
				onAppointmentsChange((prev) =>
					prev.map((a) =>
						ids.has(a.id) ? { ...a, status: AppointmentStatus.DRAFT } : a,
					),
				),
		);
	};

	const onDuplicate = async (items: AppointmentWithResponses[]) => {
		if (items.length === 0) return;
		try {
			const results = await Promise.all(
				items.map((a) => {
					const shortTitle = `${a.shortTitle} (Kopie)`;
					const title = `${a.title} (Kopie)`;
					if (a.type === AppointmentType.HOLIDAY) {
						return createAppointmentServerFn({
							data: {
								endDate: a.endDate,
								shortTitle,
								startDate: a.startDate,
								title,
								type: AppointmentType.HOLIDAY,
							},
						});
					}
					return createAppointmentServerFn({
						data: {
							endDate: a.endDate,
							location: a.location,
							shortTitle,
							startDate: a.startDate,
							status: AppointmentStatus.DRAFT,
							title,
							type: a.type,
						},
					});
				}),
			);
			const bodies = await Promise.all(results.map((res) => res.json()));
			const created: AppointmentWithResponses[] = bodies
				.filter((body) => body.data)
				.map((body) => ({
					...(body.data as Appointment),
					responses: [] as Response[],
				}));
			if (created.length > 0) {
				onAppointmentsChange((prev) =>
					[...prev, ...created].sort(
						(a, b) =>
							new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
					),
				);
			}
			if (created.length === items.length) {
				toast.success(
					t("{0} appointments duplicated", items.length.toString()),
				);
			} else {
				toast.error(t("An Error occurred"));
			}
			await router.invalidate();
		} catch {
			toast.error(t("An Error occurred"));
		}
	};

	const onRestore = (items: AppointmentWithResponses[]) => {
		const targets = items.filter((a) => a.deletedAt !== null);
		if (targets.length === 0) return;
		const ids = new Set(targets.map((a) => a.id));
		return runBulkAction(
			targets.map((a) => restoreAppointmentServerFn({ data: { id: a.id } })),
			t("{0} appointments restored", targets.length.toString()),
			() =>
				onAppointmentsChange((prev) =>
					prev.map((a) => (ids.has(a.id) ? { ...a, deletedAt: null } : a)),
				),
		);
	};

	const onDelete = (items: AppointmentWithResponses[]) => {
		const targets = items.filter((a) => a.deletedAt === null);
		if (targets.length === 0) return;
		const ids = new Set(targets.map((a) => a.id));
		const now = new Date();
		return runBulkAction(
			targets.map((a) => deleteAppointmentServerFn({ data: { id: a.id } })),
			t("{0} appointments deleted", targets.length.toString()),
			() =>
				onAppointmentsChange((prev) =>
					prev.map((a) => (ids.has(a.id) ? { ...a, deletedAt: now } : a)),
				),
		);
	};

	if (appointments.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{t("No appointments found")}
			</div>
		);
	}

	// Sorting is disabled here (unlike the mobile list) because rows are
	// grouped into month sections that assume the loader's chronological
	// order; a user-driven column sort would desync the group headers from
	// the visible row order.
	const dataColumns = getAppointmentColumns(user?.id, {
		includeResponseColumn: true,
		sortable: false,
	});
	const columns = [
		{
			key: "select",
			label: "",
			minWidth: "40px",
			render: (item: AppointmentWithResponses) => (
				<Checkbox
					checked={selectedIds.has(item.id)}
					onCheckedChange={() => toggleSelected(item.id)}
					onClick={(e) => e.stopPropagation()}
					aria-label={item.shortTitle}
				/>
			),
		},
		...dataColumns,
	];

	const hasRespondableSelection = selectedAppointments.some(
		(a) => a.type !== AppointmentType.HOLIDAY,
	);

	const bulkActions: SplitViewBulkAction[] = [
		{
			icon: <CheckCircle2Icon className="size-4" />,
			isDisabled: !selectedAppointments.some(
				(a) => isBulkEligible(a) && a.status !== AppointmentStatus.PUBLISHED,
			),
			key: "publish",
			label: t("Publish"),
			onClick: () => onPublish(selectedAppointments),
		},
		{
			icon: <EyeOffIcon className="size-4" />,
			isDisabled: !selectedAppointments.some(
				(a) => isBulkEligible(a) && a.status === AppointmentStatus.PUBLISHED,
			),
			key: "unpublish",
			label: t("Unpublish"),
			onClick: () => onUnpublish(selectedAppointments),
		},
		{
			icon: <CopyIcon className="size-4" />,
			isDisabled: selectedAppointments.length === 0,
			key: "duplicate",
			label: t("Duplicate"),
			onClick: () => onDuplicate(selectedAppointments),
		},
		{
			icon: <RotateCcwIcon className="size-4" />,
			isDisabled: !selectedAppointments.some((a) => a.deletedAt !== null),
			key: "restore",
			label: t("Restore"),
			onClick: () => onRestore(selectedAppointments),
		},
		{
			destructive: true,
			icon: <Trash2Icon className="size-4" />,
			isDisabled: !selectedAppointments.some((a) => a.deletedAt === null),
			key: "delete",
			label: t("Delete"),
			onClick: () => onDelete(selectedAppointments),
		},
	];

	return (
		<div className="grid grid-cols-[1fr_360px] items-start gap-4">
			<div className="flex min-w-0 flex-col gap-3">
				<div className="min-w-0 overflow-x-auto rounded-lg bg-card">
					<DetailsList
						items={appointments}
						getItemId={(item) => item.id}
						columns={columns}
						onRenderRow={(item, children) => {
							const inPast = isDayInPast(item.startDate);
							const isDeleted = item.deletedAt !== null;
							const index = appointments.findIndex((a) => a.id === item.id);
							const previous = appointments[index - 1];
							const label = monthLabel(item.startDate);
							const showMonthHeader =
								index === 0 || label !== monthLabel(previous.startDate);
							const isCollapsed = collapsedMonths.has(label);

							return (
								<React.Fragment key={item.id}>
									{showMonthHeader && (
										<TableRow
											className="cursor-pointer hover:bg-transparent"
											onClick={() => toggleMonth(label)}
										>
											<TableCell
												colSpan={columns.length}
												className="bg-muted/40 py-1.5 text-muted-foreground text-xs uppercase tracking-wide"
											>
												<span className="flex items-center gap-1.5 select-none">
													<ChevronDownIcon
														className={cn(
															"size-3.5 transition-transform duration-200 ease-out",
															isCollapsed && "-rotate-90",
														)}
													/>
													{label}
												</span>
											</TableCell>
										</TableRow>
									)}
									{/* `collapse` (visibility: collapse) hides the row without
								    re-triggering the table's column-width calculation, unlike
								    unmounting it or `display: none`, which would let the
								    remaining visible rows resize the columns. */}
									<TableRow
										className={cn(
											"h-10 cursor-pointer",
											selectedIds.has(item.id) && "bg-muted",
											inPast && "opacity-65",
											isDeleted && "text-destructive",
											isCollapsed && "collapse",
										)}
										onClick={() => toggleSelected(item.id)}
									>
										{children}
									</TableRow>
								</React.Fragment>
							);
						}}
						selectMode="none"
					/>
				</div>
				{footer}
			</div>
			<div className="min-w-0 rounded-lg bg-card p-5">
				{selectedIds.size === 0 ? (
					<div className="text-muted-foreground text-sm">
						{t("Select a row to see details")}
					</div>
				) : (
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between">
							<span className="font-semibold text-sm">
								{single
									? t("1 appointment selected")
									: t("{0} appointments selected", selectedIds.size.toString())}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setSelectedIds(new Set())}
							>
								{t("Clear selection")}
							</Button>
						</div>
						{single ? (
							<AppointmentDetailContent
								appointment={single}
								myResponse={myResponse}
								onRespond={onRespond}
							/>
						) : (
							<>
								<div className="flex max-h-48 flex-col overflow-y-auto rounded-md border p-1">
									{selectedAppointments.map((a) => (
										<div
											key={a.id}
											className="flex items-center gap-2 rounded-md px-1.5 py-1"
										>
											<span
												className={cn(
													"size-1.5 shrink-0 rounded-full",
													a.type === AppointmentType.HOLIDAY
														? "bg-muted-foreground"
														: a.status === AppointmentStatus.PUBLISHED
															? "bg-success"
															: "bg-warning",
												)}
											/>
											<span className="min-w-0 flex-1 truncate text-sm">
												{a.shortTitle}
											</span>
											<span className="shrink-0 text-muted-foreground text-xs">
												{new Date(a.startDate).toLocaleDateString("de-DE", {
													day: "2-digit",
													month: "2-digit",
												})}
											</span>
										</div>
									))}
								</div>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="flex-1 border border-success/30 text-success hover:bg-success/15 hover:text-success"
										disabled={!hasRespondableSelection}
										onClick={() => onBulkRespond(ResponseType.ACCEPT)}
									>
										{t("Accept")}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="flex-1 border border-warning/30 text-warning hover:bg-warning/15 hover:text-warning"
										disabled={!hasRespondableSelection}
										onClick={() => onBulkRespond(ResponseType.MAYBE)}
									>
										{t("Maybe")}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="flex-1 border border-destructive/30 text-destructive hover:bg-destructive/15 hover:text-destructive"
										disabled={!hasRespondableSelection}
										onClick={() => onBulkRespond(ResponseType.DECLINE)}
									>
										{t("Decline")}
									</Button>
								</div>
							</>
						)}
						{canEdit && (
							<div className="flex flex-col gap-2">
								{bulkActions.map((action) => (
									<Button
										key={action.key}
										type="button"
										variant={action.destructive ? "destructive" : "outline"}
										className="justify-start"
										disabled={action.isDisabled}
										onClick={action.onClick}
									>
										{action.icon}
										{action.label}
									</Button>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

function AppointmentDetailContent({
	appointment,
	myResponse,
	onRespond,
}: {
	appointment: AppointmentWithResponses;
	myResponse: Response | undefined;
	onRespond: (response: ResponseType) => () => Promise<void>;
}) {
	const isHoliday = appointment.type === AppointmentType.HOLIDAY;
	const isPublished = appointment.status === AppointmentStatus.PUBLISHED;
	const isMultipleDays =
		appointment.endDate != null &&
		new Date(appointment.startDate).toDateString() !==
			new Date(appointment.endDate).toDateString();

	return (
		<>
			<div className="mb-3 flex items-center gap-2">
				<Badge variant="outline">{typeLabel(appointment.type)}</Badge>
				{!isHoliday && (
					<Badge variant={isPublished ? "success" : "warning"}>
						{isPublished ? t("Published") : t("Draft")}
					</Badge>
				)}
			</div>
			<h3 className="mb-4 font-bold text-lg leading-snug">
				{appointment.title}
			</h3>
			<div className="flex flex-col gap-2 text-sm">
				<div className="flex items-center gap-1.5 text-muted-foreground">
					<CalendarDaysIcon className="size-3.5 shrink-0" />
					{formatDateTime(appointment.startDate)}
					{isMultipleDays && appointment.endDate && (
						<> – {formatDateTime(appointment.endDate)}</>
					)}
				</div>
				{appointment.location && (
					<div className="flex items-center gap-1.5 text-muted-foreground">
						<MapPinIcon className="size-3.5 shrink-0" />
						{appointment.location}
					</div>
				)}
			</div>
			{!isHoliday && (
				<div className="mt-4 flex gap-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							"flex-1 border border-success/30 text-success hover:bg-success/15 hover:text-success",
							myResponse?.responseType === ResponseType.ACCEPT &&
								"border-success bg-success text-success-foreground hover:bg-success/90 hover:text-success-foreground",
						)}
						onClick={onRespond(ResponseType.ACCEPT)}
					>
						{t("Accept")}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							"flex-1 border border-warning/30 text-warning hover:bg-warning/15 hover:text-warning",
							myResponse?.responseType === ResponseType.MAYBE &&
								"border-warning bg-warning text-warning-foreground hover:bg-warning/90 hover:text-warning-foreground",
						)}
						onClick={onRespond(ResponseType.MAYBE)}
					>
						{t("Maybe")}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							"flex-1 border border-destructive/30 text-destructive hover:bg-destructive/15 hover:text-destructive",
							myResponse?.responseType === ResponseType.DECLINE &&
								"border-destructive bg-destructive text-white hover:bg-destructive/90",
						)}
						onClick={onRespond(ResponseType.DECLINE)}
					>
						{t("Decline")}
					</Button>
				</div>
			)}
			<Button asChild variant="outline" size="sm" className="mt-2 w-full">
				<Link to="/appts/$apptId" params={{ apptId: appointment.id }}>
					{t("Open appointment")}
				</Link>
			</Button>
		</>
	);
}
