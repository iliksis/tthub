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
	ChevronDownIcon,
	Loader2Icon,
	MapPinIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { createResponse, getAppointmentsPage } from "@/api/appointments";
import {
	Filters,
	filterSchema,
	getAppointmentColumns,
	InlineFilters,
	List,
} from "@/components/appointments/List";
import { DetailsList } from "@/components/DetailsList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Appointment, Response } from "@/lib/prisma/client";
import {
	AppointmentStatus,
	AppointmentType,
	ResponseType,
} from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { cn, isDayInPast } from "@/lib/utils";

const BATCH_SIZE = 25;

// biome-ignore assist/source/useSortedKeys: validateSearch and loaderDeps need to be before loader
export const Route = createFileRoute("/_authed/appts/")({
	component: RouteComponent,
	validateSearch: filterSchema,
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
			return { ...data, skip };
		}
		throw new Error(response.message);
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
	} = Route.useLoaderData();
	const search = Route.useSearch();
	const router = useRouter();
	const isNavigating = useRouterState({ select: (s) => s.isLoading });
	const { user } = useRouteContext({ from: "__root__" });
	const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

	// The loader only ever fetches one batch (skip/take), never the whole list
	// again — so previously loaded rows are kept in state and the new batch is
	// appended to them, unless the filters changed (or this is the first
	// page), in which case it replaces them outright. Comparing against state
	// (not a ref) during render is the React-sanctioned way to reset/derive
	// state when an input changes without a useEffect round-trip.
	const filterKey = JSON.stringify({ ...search, skip: undefined });
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
			<div className="lg:hidden">
				<Filters {...search} />
				<List appointments={items} />
				<AppointmentLoadMoreFooter
					items={items}
					remaining={remaining}
					matchedTotal={matchedTotal}
					isNavigating={isNavigating}
					onLoadMore={onLoadMore}
				/>
			</div>

			{/* Desktop layout: master-detail + inline filters */}
			<div className="hidden lg:flex lg:flex-col lg:gap-4">
				<div className="flex items-center gap-3">
					<div className="flex flex-1 items-baseline gap-2">
						<h1 className="font-bold text-lg">{t("Appointments")}</h1>
						<p className="text-muted-foreground text-sm">
							{t(
								"{0} of {1} events",
								matchedTotal.toString(),
								grandTotal.toString(),
							)}
						</p>
					</div>
					<div className="flex overflow-hidden rounded-md border text-sm">
						<span className="bg-primary px-3 py-1.5 font-medium text-primary-foreground">
							{t("List")}
						</span>
						<Link
							to="/appts/calendar"
							className="px-3 py-1.5 text-muted-foreground hover:bg-accent"
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
				<div className="rounded-lg bg-card p-3">
					<InlineFilters {...search} />
				</div>
				<AppointmentSplitView
					appointments={items}
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

const AppointmentSplitView = ({
	appointments,
	footer,
}: {
	appointments: AppointmentWithResponses[];
	footer: React.ReactNode;
}) => {
	const { user } = useRouteContext({ from: "__root__" });
	const router = useRouter();
	const createResponseServerFn = useServerFn(createResponse);
	const [selectedId, setSelectedId] = React.useState<string | undefined>(
		appointments[0]?.id,
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

	const selected = appointments.find((a) => a.id === selectedId);
	const isHoliday = selected?.type === AppointmentType.HOLIDAY;
	const isPublished = selected?.status === AppointmentStatus.PUBLISHED;
	const myResponse = selected?.responses.find((r) => r.userId === user?.id);
	const isMultipleDays =
		selected?.endDate != null &&
		new Date(selected.startDate).toDateString() !==
			new Date(selected.endDate).toDateString();

	const onRespond = (response: ResponseType) => async () => {
		if (!selected) return;
		const res = await createResponseServerFn({
			data: { appointmentId: selected.id, response },
		});
		const data = await res.json();
		if (res.status < 400 && data) {
			await router.invalidate();
			return;
		}
		toast.error(data.message);
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
	const columns = getAppointmentColumns(user?.id, {
		includeResponseColumn: true,
		sortable: false,
	});

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
											item.id === selectedId && "bg-muted",
											inPast && "opacity-65",
											isDeleted && "text-destructive",
											isCollapsed && "collapse",
										)}
										onClick={() => setSelectedId(item.id)}
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
				{selected ? (
					<>
						<div className="mb-3 flex items-center gap-2">
							<Badge variant="outline">{typeLabel(selected.type)}</Badge>
							{!isHoliday && (
								<Badge variant={isPublished ? "success" : "warning"}>
									{isPublished ? t("Published") : t("Draft")}
								</Badge>
							)}
						</div>
						<h3 className="mb-4 font-bold text-lg leading-snug">
							{selected.title}
						</h3>
						<div className="flex flex-col gap-2 text-sm">
							<div className="flex items-center gap-1.5 text-muted-foreground">
								<CalendarDaysIcon className="size-3.5 shrink-0" />
								{formatDateTime(selected.startDate)}
								{isMultipleDays && selected.endDate && (
									<> – {formatDateTime(selected.endDate)}</>
								)}
							</div>
							{selected.location && (
								<div className="flex items-center gap-1.5 text-muted-foreground">
									<MapPinIcon className="size-3.5 shrink-0" />
									{selected.location}
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
							<Link to="/appts/$apptId" params={{ apptId: selected.id }}>
								{t("Open appointment")}
							</Link>
						</Button>
					</>
				) : (
					<div className="text-muted-foreground text-sm">
						{t("No appointments found")}
					</div>
				)}
			</div>
		</div>
	);
};
