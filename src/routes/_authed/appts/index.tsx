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
	CheckIcon,
	CircleQuestionMarkIcon,
	ListIcon,
	MapPinIcon,
	PartyPopperIcon,
	TrophyIcon,
	UserCheckIcon,
	UsersIcon,
	UserXIcon,
	XIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
	type AppointmentWithResponses,
	createResponse,
	getAppointmentsPage,
	getCalendarAppointments,
} from "@/api/appointments";
import { getSeasons } from "@/api/seasons";
import { getTeams } from "@/api/teams";
import {
	CommandBarFilters,
	filterSchema,
	getUserResponse,
	MobileFilters,
} from "@/components/appointments/List";
import { LoadMoreFooter } from "@/components/appointments/LoadMoreFooter";
import { MobileCalendar } from "@/components/calendar/MobileCalendar";
import type { CalendarAppointment } from "@/components/calendar/MonthCalendar";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { LabelBadges } from "@/components/labels/LabelBadges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link as EntityLink } from "@/components/ui/link";
import { useLoadMoreBatch } from "@/hooks/useLoadMoreBatch";
import { buildMonthGrid } from "@/lib/calendarGrid";
import type { AppointmentType, ResponseType } from "@/lib/prisma/enums";
import {
	cn,
	formatShortDate,
	isDayInPast,
	isInformationalAppointmentType,
} from "@/lib/utils";
import { m } from "@/paraglide/messages";

const typeIcon: Record<AppointmentType, typeof TrophyIcon> = {
	HOLIDAY: PartyPopperIcon,
	TEAM_MATCH: UsersIcon,
	TOURNAMENT: TrophyIcon,
};

const typeIconColor: Record<AppointmentType, string> = {
	HOLIDAY: "text-primary",
	TEAM_MATCH: "text-warning",
	TOURNAMENT: "text-success",
};

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
	seasonId: string | undefined,
): Promise<CalendarLoaderData> {
	const today = new Date();
	const resolvedYear = year ?? today.getFullYear();
	const monthIndex = month ?? today.getMonth();
	const weeks = buildMonthGrid(resolvedYear, monthIndex, today);
	const start = weeks[0][0].fullDate;
	const lastCell = weeks.at(-1)?.at(-1);
	const end = new Date(lastCell?.fullDate ?? start);
	end.setDate(end.getDate() + 1);

	const response = await getCalendarAppointments({
		data: { end, seasonId, start },
	});
	const appointments: CalendarAppointment[] = (response.data ?? []).map(
		(a) => ({
			...a,
			end: new Date(a.end),
			start: new Date(a.start),
		}),
	);
	return { appointments, monthIndex, year: resolvedYear };
}

// biome-ignore assist/source/useSortedKeys: validateSearch and loaderDeps need to be before loader
export const Route = createFileRoute("/_authed/appts/")({
	component: RouteComponent,
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({ ...search }),
	loader: async ({ deps }) => {
		const skip = deps.skip ?? 0;
		const seasonsRes = await getSeasons();
		const seasons = seasonsRes.data ?? [];
		// No default season filter — the list is already date-scoped to today
		// forward, and a team match from a different season is still worth
		// seeing, so "all seasons" is the default until the user picks one.
		const seasonId = deps.seasonId;
		const [response, teamsResponse] = await Promise.all([
			getAppointmentsPage({
				data: {
					query: deps.query,
					responses: deps.responses,
					seasonId,
					skip,
					sortDir: deps.sortDir,
					take: BATCH_SIZE,
					teamIds: deps.teamIds,
					typeGroup: deps.typeGroup,
				},
			}),
			getTeams({ data: { seasonId } }),
		]);
		const data = response.data ?? {
			appointments: [],
			grandTotal: 0,
			matchedTotal: 0,
		};
		const teams = teamsResponse.data ?? [];
		const calendar =
			deps.view === "calendar"
				? await loadCalendarData(deps.month, deps.year, seasonId)
				: null;
		return { ...data, calendar, seasons, skip, teams };
	},
	errorComponent: () => {
		return (
			<Alert variant="destructive">
				<AlertDescription>
					{m.appointments_appointments_could_not_be_loaded()}
				</AlertDescription>
			</Alert>
		);
	},
	head: () => ({
		meta: [{ title: m.common_appointments() }],
	}),
});

function monthLabel(date: Date | string) {
	return new Date(date).toLocaleDateString("de-DE", {
		month: "long",
		year: "numeric",
	});
}

type MonthGroup = {
	key: string;
	label: string;
	year: number;
	monthIndex: number;
	items: AppointmentWithResponses[];
};

function monthKey(date: Date | string) {
	const d = new Date(date);
	return `${d.getFullYear()}-${d.getMonth()}`;
}

function groupByMonth(items: AppointmentWithResponses[]): MonthGroup[] {
	const groups: MonthGroup[] = [];
	for (const item of items) {
		const key = monthKey(item.startDate);
		const last = groups.at(-1);
		if (last && last.key === key) last.items.push(item);
		else {
			const d = new Date(item.startDate);
			groups.push({
				items: [item],
				key,
				label: monthLabel(item.startDate),
				monthIndex: d.getMonth(),
				year: d.getFullYear(),
			});
		}
	}
	return groups;
}

function addMonths(year: number, monthIndex: number, delta: number) {
	const d = new Date(year, monthIndex + delta, 1);
	return { monthIndex: d.getMonth(), year: d.getFullYear() };
}

function toCalendarAppointments(
	items: AppointmentWithResponses[],
): CalendarAppointment[] {
	return items.map((item) => ({
		end: item.endDate ?? item.startDate,
		id: item.id,
		labels: item.labels.map((l) => l.label),
		location: item.location,
		start: item.startDate,
		title: item.title,
		type: item.type,
	}));
}

// Drives the two-way sync between the scrollable list and the rail calendar:
// an IntersectionObserver reports whichever month header is topmost in the
// page's normal scroll, and `scrollToMonth` (called from the calendar's
// prev/next/today) scrolls that header into view. A short suppression window
// after a programmatic scroll stops the observer from fighting the
// smooth-scroll animation it just triggered. Calendar content for the active
// month comes straight from the already-loaded `items` — no separate server
// round-trip — so switching months is instant either way.
function useScrollSyncedMonth(
	groups: { key: string; year: number; monthIndex: number }[],
) {
	// The sticky `<h2>` header itself — watched by the IntersectionObserver
	// below to detect which month is topmost as the user scrolls.
	const headerRefs = React.useRef(new Map<string, HTMLElement>());
	// The group's plain, non-sticky wrapper `<div>` — used by `scrollToMonth`
	// to compute a jump target. Its position is unaffected by scroll state;
	// the header's own is NOT (see the comment below).
	const groupRefs = React.useRef(new Map<string, HTMLElement>());
	const suppressRef = React.useRef(false);
	const [active, setActive] = React.useState(
		() =>
			groups[0] ?? {
				key: "",
				monthIndex: new Date().getMonth(),
				year: new Date().getFullYear(),
			},
	);

	// Cached per key so the same callback identity is passed to `ref` on every
	// render — otherwise (an inline `(key) => (el) => ...` closure, recreated
	// each render) React would tear down and re-attach every ref on every
	// re-render (which `setActive` triggers), and under rapid clicks an entry
	// could momentarily be missing right when it's needed.
	function makeRegister(store: React.RefObject<Map<string, HTMLElement>>) {
		const cache = new Map<string, (el: HTMLElement | null) => void>();
		return (key: string) => {
			let fn = cache.get(key);
			if (!fn) {
				fn = (el: HTMLElement | null) => {
					if (el) store.current.set(key, el);
					else store.current.delete(key);
				};
				cache.set(key, fn);
			}
			return fn;
		};
	}
	const registerHeader = React.useRef(makeRegister(headerRefs)).current;
	const registerGroup = React.useRef(makeRegister(groupRefs)).current;

	React.useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (suppressRef.current) return;
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
				const topKey = (visible[0]?.target as HTMLElement | undefined)?.dataset
					.monthKey;
				const match = groups.find((g) => g.key === topKey);
				if (match) setActive(match);
			},
			{ rootMargin: "-1px 0px -97% 0px", threshold: 0 },
		);
		for (const el of headerRefs.current.values()) observer.observe(el);
		return () => observer.disconnect();
	}, [groups]);

	const scrollToMonth = (year: number, monthIndex: number) => {
		const key = `${year}-${monthIndex}`;
		const match = groups.find((g) => g.key === key) ?? {
			key,
			monthIndex,
			year,
		};
		setActive(match);
		const el = groupRefs.current.get(key);
		if (el) {
			// `el` is the group's plain (non-sticky) wrapper, not the `<h2>`
			// header — a `position: sticky` element's own rect turns out to
			// reflect its *current stuck* position once scrolled past, not its
			// true static one (confirmed: reads back as wherever the page
			// already scrolled to), so it silently breaks once scrolling has
			// been clamped near the list's end. The wrapper is never sticky, so
			// its position is always the correct absolute target.
			suppressRef.current = true;
			window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY });
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					suppressRef.current = false;
				});
			});
		}
	};

	return { active, registerGroup, registerHeader, scrollToMonth };
}

function RouteComponent() {
	const {
		appointments: batch,
		matchedTotal,
		grandTotal,
		skip,
		calendar,
		teams,
		seasons,
	} = Route.useLoaderData();
	const search = Route.useSearch();
	const router = useRouter();
	const isNavigating = useRouterState({ select: (s) => s.isLoading });
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
	const { items, setItems } = useLoadMoreBatch<AppointmentWithResponses>(
		batch,
		skip,
		filterKey,
	);

	const remaining = matchedTotal - items.length;
	const onLoadMore = () => {
		router.navigate({
			replace: true,
			search: { ...search, skip: items.length },
			to: ".",
		});
	};

	// Desktop's rail calendar is derived straight from the already-loaded
	// `items` (no separate month-by-month server query) so scrolling the list
	// or navigating the calendar are both instant and never trigger the
	// route's loading state.
	const monthGroups = React.useMemo(() => groupByMonth(items), [items]);
	const { active, registerGroup, registerHeader, scrollToMonth } =
		useScrollSyncedMonth(monthGroups);
	const calendarAppointments = React.useMemo(
		() => toCalendarAppointments(items),
		[items],
	);

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
						<MobileFilters {...search} teams={teams} seasons={seasons} />
						<AppointmentTimeline
							groups={monthGroups}
							onAppointmentsChange={setItems}
							footer={
								<LoadMoreFooter
									itemCount={items.length}
									remaining={remaining}
									matchedTotal={matchedTotal}
									isNavigating={isNavigating}
									batchSize={BATCH_SIZE}
									onLoadMore={onLoadMore}
								/>
							}
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
					{m.appointments_list()}
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
					{m.appointments_calendar()}
				</Link>
			</nav>

			{/* Desktop layout: list on the left, filters + a scroll-synced
			    calendar sticky in a rail on the right. This scrolls with the
			    normal page scrollbar rather than an inner scroll container (see
			    useScrollSyncedMonth). */}
			<div
				className={cn(
					"hidden lg:flex lg:flex-col lg:gap-4",
					isNavigating && "pointer-events-none opacity-60",
				)}
			>
				<div className="flex items-center gap-3">
					<div className="flex flex-1 items-baseline gap-2">
						<h1 className="font-bold text-lg">{m.common_appointments()}</h1>
						<p className="text-muted-foreground text-sm">
							{m.appointments_n_of_n_events({
								param1: matchedTotal.toString(),
								param2: grandTotal.toString(),
							})}
						</p>
					</div>
				</div>
				<div className="flex gap-6">
					<div className="w-xl shrink-0">
						<AppointmentTimeline
							groups={monthGroups}
							registerGroup={registerGroup}
							registerHeader={registerHeader}
							onAppointmentsChange={setItems}
							footer={
								<LoadMoreFooter
									itemCount={items.length}
									remaining={remaining}
									matchedTotal={matchedTotal}
									isNavigating={isNavigating}
									batchSize={BATCH_SIZE}
									onLoadMore={onLoadMore}
								/>
							}
						/>
					</div>
					<div className="sticky top-6 flex min-w-95 flex-1 shrink-0 flex-col gap-4 self-start">
						<div className="shrink-0">
							<CommandBarFilters {...search} teams={teams} seasons={seasons} />
						</div>
						<MonthCalendar
							appointments={calendarAppointments}
							year={active.year}
							monthIndex={active.monthIndex}
							onPrevMonth={() => {
								const prev = addMonths(active.year, active.monthIndex, -1);
								scrollToMonth(prev.year, prev.monthIndex);
							}}
							onNextMonth={() => {
								const next = addMonths(active.year, active.monthIndex, 1);
								scrollToMonth(next.year, next.monthIndex);
							}}
							onToday={() => {
								const now = new Date();
								scrollToMonth(now.getFullYear(), now.getMonth());
							}}
						/>
					</div>
				</div>
			</div>
		</>
	);
}

function formatTime(date: Date | string) {
	return new Date(date).toLocaleTimeString("de-DE", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

// Inline participation summary shown under the title: counts only reflect
// responses that were actually recorded (there's no stored "invited" list
// to divide by), so a category is omitted once it's zero and the whole line
// disappears until at least one person has responded.
const ParticipationSummary = ({
	appointment,
}: {
	appointment: AppointmentWithResponses;
}) => {
	if (isInformationalAppointmentType(appointment.type)) return null;
	let accept = 0;
	let maybe = 0;
	let decline = 0;
	for (const response of appointment.responses) {
		if (response.responseType === "ACCEPT") accept++;
		else if (response.responseType === "MAYBE") maybe++;
		else if (response.responseType === "DECLINE") decline++;
	}
	if (accept + maybe + decline === 0) return null;

	return (
		<div className="mt-0.5 flex items-center gap-2 text-xs">
			{accept > 0 && (
				<span className="inline-flex items-center gap-1 text-success">
					<UserCheckIcon className="size-3" />
					{accept}
				</span>
			)}
			{maybe > 0 && (
				<span className="inline-flex items-center gap-1 text-warning">
					<CircleQuestionMarkIcon className="size-3" />
					{maybe}
				</span>
			)}
			{decline > 0 && (
				<span className="inline-flex items-center gap-1 text-destructive">
					<UserXIcon className="size-3" />
					{decline}
				</span>
			)}
		</div>
	);
};

// Inline per-row response control: while the user's response is still open
// (MAYBE, whether set explicitly or just defaulted because they haven't
// answered yet) they get Accept/Decline buttons; once they've committed to
// one, the buttons are replaced by a label so the row reads as settled.
const ResponseCell = ({
	appointment,
	userId,
	onRespond,
}: {
	appointment: AppointmentWithResponses;
	userId: string | undefined;
	onRespond: (appointmentId: string, response: ResponseType) => void;
}) => {
	if (isInformationalAppointmentType(appointment.type)) return null;
	const userResponse = getUserResponse(appointment, userId);

	if (userResponse === "ACCEPT" || userResponse === "DECLINE") {
		return (
			<Badge variant={userResponse === "ACCEPT" ? "success" : "destructive"}>
				{userResponse === "ACCEPT" ? m.common_accepted() : m.common_declined()}
			</Badge>
		);
	}

	return (
		<div className="flex justify-end gap-1.5">
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				title={m.common_accept()}
				className="border border-success/30 text-success hover:bg-success/15 hover:text-success"
				onClick={(e) => {
					e.stopPropagation();
					onRespond(appointment.id, "ACCEPT");
				}}
			>
				<CheckIcon />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				title={m.common_decline()}
				className="border border-destructive/30 text-destructive hover:bg-destructive/15 hover:text-destructive"
				onClick={(e) => {
					e.stopPropagation();
					onRespond(appointment.id, "DECLINE");
				}}
			>
				<XIcon />
			</Button>
		</div>
	);
};

const noopRegister = () => () => {};

const AppointmentTimeline = ({
	groups,
	registerGroup = noopRegister,
	registerHeader = noopRegister,
	onAppointmentsChange,
	footer,
}: {
	groups: MonthGroup[];
	registerGroup?: (key: string) => (el: HTMLElement | null) => void;
	registerHeader?: (key: string) => (el: HTMLElement | null) => void;
	onAppointmentsChange: React.Dispatch<
		React.SetStateAction<AppointmentWithResponses[]>
	>;
	footer: React.ReactNode;
}) => {
	const { user } = useRouteContext({ from: "__root__" });
	const router = useRouter();
	const createResponseServerFn = useServerFn(createResponse);

	const onRespond = async (appointmentId: string, response: ResponseType) => {
		const userId = user?.id;
		if (!userId) return;
		try {
			await createResponseServerFn({ data: { appointmentId, response } });
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
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	if (groups.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{m.appointments_no_appointments_found()}
			</div>
		);
	}

	return (
		<div className="flex min-w-0 flex-col gap-3">
			<div className="flex min-w-0 flex-col">
				{groups.map((group) => (
					<div key={group.key} ref={registerGroup(group.key)}>
						{/* `sticky` (not a collapse toggle) marks the current section as
						    you scroll — it also doubles as the IntersectionObserver
						    target that drives the rail calendar via `registerHeader`.
						    This wrapper (not the header) is what `scrollToMonth` reads
						    the jump target from — see useScrollSyncedMonth. */}
						<h2
							ref={registerHeader(group.key)}
							data-month-key={group.key}
							className="sticky top-0 z-10 -mx-1 mb-2 bg-background px-1 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide"
						>
							{group.label}
						</h2>
						<div className="flex min-w-0 flex-col pb-4">
							{group.items.map((item, idx) => {
								const inPast = isDayInPast(item.startDate);
								const isDeleted = item.deletedAt !== null;
								const Icon = typeIcon[item.type];
								const isMultipleDays =
									item.endDate !== null &&
									new Date(item.startDate).getDate() !==
										new Date(item.endDate).getDate();

								return (
									<div key={item.id} className="flex gap-4">
										<div className="flex w-11 shrink-0 flex-col items-center pt-3">
											<span className="font-bold text-lg leading-none">
												{new Date(item.startDate).getDate()}
											</span>
											<span className="mt-0.5 text-[10px] text-muted-foreground uppercase">
												{new Date(item.startDate).toLocaleDateString("de-DE", {
													weekday: "short",
												})}
											</span>
											{idx < group.items.length - 1 && (
												<div className="mt-2 w-px flex-1 bg-border" />
											)}
										</div>
										<div
											className={cn(
												"flex min-w-0 max-w-xl flex-1 items-center gap-4 rounded-lg px-3 py-2.5 pb-5",
												inPast && "opacity-65",
												isDeleted && "text-destructive",
											)}
										>
											<div className="min-w-0 flex-1">
												<div className="truncate">
													<EntityLink
														to="/appts/$apptId"
														params={{ apptId: item.id }}
													>
														{item.title}
													</EntityLink>
												</div>
												<div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
													<span className="inline-flex items-center gap-1">
														<Icon
															className={cn(
																"size-3.5",
																typeIconColor[item.type],
															)}
														/>
														{formatTime(item.startDate)}
													</span>
													{isMultipleDays && item.endDate && (
														<span>– {formatShortDate(item.endDate)}</span>
													)}
													{item.location && (
														<span className="inline-flex items-center gap-1">
															<MapPinIcon className="size-3" />
															{item.location}
														</span>
													)}
												</div>
												<ParticipationSummary appointment={item} />
												<LabelBadges
													labels={item.labels.map((l) => l.label)}
													className="mt-1"
												/>
											</div>
											<div className="shrink-0">
												<ResponseCell
													appointment={item}
													userId={user?.id}
													onRespond={onRespond}
												/>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				))}
			</div>
			{footer}
		</div>
	);
};
