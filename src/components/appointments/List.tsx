import { Link, useRouteContext, useRouter } from "@tanstack/react-router";
import {
	ArrowDownWideNarrowIcon,
	ArrowUpNarrowWideIcon,
	SlidersHorizontalIcon,
} from "lucide-react";
import React from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link as EntityLink } from "@/components/ui/link";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useDragToDismiss } from "@/hooks/use-drag-to-dismiss";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import type { Appointment, Response, Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { cn, isDayInPast, isInformationalAppointmentType } from "@/lib/utils";
import type { DetailsListColumn } from "../DetailsList";

type AppointmentWithResponses = Appointment & {
	responses: Response[];
	ownTeam: Team | null;
};

type ListProps = {
	appointments: AppointmentWithResponses[];
};

const getUserResponse = (
	item: Appointment & { responses: Response[] },
	userId: string | undefined,
) => item.responses?.find((r) => r.userId === userId)?.responseType ?? "MAYBE";

export const getAppointmentColumns = (
	userId: string | undefined,
	{ includeResponseColumn = false, sortable = true } = {},
): DetailsListColumn<Appointment & { responses: Response[] }>[] => [
	// The response column already conveys status, so the leading dot is only
	// needed when that column isn't present (the mobile list).
	...(includeResponseColumn
		? []
		: [
				{
					key: "status",
					label: "",
					render: (item: Appointment & { responses: Response[] }) => {
						const userResponse = getUserResponse(item, userId);
						const isAccepted = userResponse === "ACCEPT";
						const isDeclined = userResponse === "DECLINE";
						return isAccepted ? (
							<div className="size-2 rounded-full bg-success" />
						) : isDeclined ? (
							<div className="size-2 rounded-full bg-destructive" />
						) : null;
					},
				},
			]),
	{
		key: "title",
		label: t("Title"),
		render: (item) => (
			<EntityLink
				to="/appts/$apptId"
				params={{ apptId: item.id }}
				onClick={(e) => e.stopPropagation()}
				className="truncate"
			>
				{item.shortTitle}
			</EntityLink>
		),
		sortable,
		sortFn: (a, b) => a.shortTitle.localeCompare(b.shortTitle),
	},
	{
		key: "date",
		label: t("Date"),
		render: (item) => {
			const isMultipleDays =
				item.endDate !== null
					? new Date(item.startDate).getDate() !==
						new Date(item.endDate).getDate()
					: false;

			return (
				<>
					{new Date(item.startDate).toLocaleDateString("de-DE", {
						day: "2-digit",
						month: "2-digit",
						year: "2-digit",
					})}{" "}
					{isMultipleDays && item.endDate && (
						<>
							{" "}
							-{" "}
							{new Date(item.endDate).toLocaleDateString("de-DE", {
								day: "2-digit",
								month: "2-digit",
								year: "2-digit",
							})}
						</>
					)}
				</>
			);
		},
		sortable,
		sortFn: (a, b) =>
			new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
	},
	{
		key: "location",
		label: t("Location"),
		render: (item) => item.location,
	},
	...(includeResponseColumn
		? [
				{
					align: "right" as const,
					key: "response",
					label: "",
					render: (item: Appointment & { responses: Response[] }) => {
						if (isInformationalAppointmentType(item.type)) return null;
						const userResponse = getUserResponse(item, userId);
						const isAccepted = userResponse === "ACCEPT";
						const isDeclined = userResponse === "DECLINE";
						return (
							<Badge
								variant={
									isAccepted
										? "success"
										: isDeclined
											? "destructive"
											: "warning"
								}
							>
								{isAccepted
									? t("Accepted")
									: isDeclined
										? t("Declined")
										: t("Maybe")}
							</Badge>
						);
					},
				},
			]
		: []),
];

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

type MonthGroup = { label: string; items: AppointmentWithResponses[] };

function groupByMonth(items: AppointmentWithResponses[]): MonthGroup[] {
	const groups: MonthGroup[] = [];
	for (const item of items) {
		const label = monthLabel(item.startDate);
		const last = groups.at(-1);
		if (last && last.label === label) last.items.push(item);
		else groups.push({ items: [item], label });
	}
	return groups;
}

// Mobile list: a joined row per appointment grouped by month, styled after
// the journal page's mobile row list. Tapping a row navigates straight to
// the appointment — there's no selection step to pass through first.
export const List = ({ appointments }: ListProps) => {
	const { user } = useRouteContext({ from: "__root__" });

	if (appointments.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{t("No appointments found")}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{groupByMonth(appointments).map((group) => (
				<div key={group.label} className="flex flex-col">
					<div className="px-1 pb-1.5 text-muted-foreground text-xs uppercase tracking-wide">
						{group.label}
					</div>
					<div className="flex flex-col rounded-lg bg-card">
						{group.items.map((item) => {
							const inPast = isDayInPast(item.startDate);
							const isDeleted = item.deletedAt !== null;
							const userResponse = getUserResponse(item, user?.id);
							const isAccepted = userResponse === "ACCEPT";
							const isDeclined = userResponse === "DECLINE";
							return (
								<Link
									key={item.id}
									to="/appts/$apptId"
									params={{ apptId: item.id }}
									className={cn(
										"flex w-full items-center justify-between gap-3 border-border/60 border-b py-3.5 px-3 text-left first:rounded-t-lg last:border-b-0 last:rounded-b-lg",
										inPast && "opacity-65",
										isDeleted && "text-destructive",
									)}
								>
									<div className="min-w-0 flex-1">
										<div className="truncate font-medium text-sm">
											{item.shortTitle}
										</div>
										<div className="truncate text-muted-foreground text-xs">
											{formatDateTime(item.startDate)}
											{item.location && ` · ${item.location}`}
										</div>
									</div>
									{!isInformationalAppointmentType(item.type) && (
										<Badge
											variant={
												isAccepted
													? "success"
													: isDeclined
														? "destructive"
														: "warning"
											}
											className="shrink-0"
										>
											{isAccepted
												? t("Accepted")
												: isDeclined
													? t("Declined")
													: t("Maybe")}
										</Badge>
									)}
								</Link>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
};

export const filterSchema = z.object({
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
	deleted: z.boolean().optional(),
	query: z.string().optional(),
	responses: z.array(z.enum(["ACCEPT", "MAYBE", "DECLINE", "NONE"])).optional(),
	skip: z.number().int().nonnegative().optional(),
	sortDir: z.enum(["asc", "desc"]).optional(),
	teamIds: z.array(z.string()).optional(),
	typeGroup: z.enum(["TOURNAMENT", "TEAM_MATCH"]).optional(),
});
type FiltersProps = z.infer<typeof filterSchema>;

type TypeGroup = NonNullable<FiltersProps["typeGroup"]> | "ALL";
type ResponseFilterValue = NonNullable<FiltersProps["responses"]>[number];

const typeGroupTabs: { key: TypeGroup; label: string }[] = [
	{ key: "ALL", label: t("All") },
	{ key: "TOURNAMENT", label: t("Tournaments") },
	{ key: "TEAM_MATCH", label: t("Team matches") },
];

const responseOptions: { value: ResponseFilterValue; label: string }[] = [
	{ label: t("Accepted"), value: "ACCEPT" },
	{ label: t("Maybe"), value: "MAYBE" },
	{ label: t("Declined"), value: "DECLINE" },
	{ label: t("No response"), value: "NONE" },
];

function toggleInList<T>(list: T[] | undefined, value: T): T[] | undefined {
	const set = new Set(list ?? []);
	if (set.has(value)) set.delete(value);
	else set.add(value);
	return set.size > 0 ? [...set] : undefined;
}

// Shared by InlineFilters (desktop) and MobileFilters (mobile) — every field
// applies immediately; text search is debounced so typing doesn't fire a
// navigation per keystroke, everything else navigates on change.
const useAppointmentLiveFilters = (props: FiltersProps) => {
	const router = useRouter();
	const [queryInput, setQueryInput] = React.useState(props.query ?? "");

	const navigate = React.useCallback(
		(next: Partial<FiltersProps>) => {
			router.navigate({
				replace: true,
				search: { ...props, ...next, skip: undefined },
				to: ".",
			});
		},
		[router, props],
	);

	const navigateRef = React.useRef(navigate);
	navigateRef.current = navigate;
	const propsQueryRef = React.useRef(props.query);
	propsQueryRef.current = props.query;

	React.useEffect(() => {
		const timeout = setTimeout(() => {
			if (queryInput !== (propsQueryRef.current ?? "")) {
				navigateRef.current({ query: queryInput || undefined });
			}
		}, 300);
		return () => clearTimeout(timeout);
	}, [queryInput]);

	const setTypeGroup = (key: TypeGroup) =>
		navigate({
			responses: undefined,
			teamIds: undefined,
			typeGroup: key === "ALL" ? undefined : key,
		});

	const toggleResponse = (value: ResponseFilterValue) =>
		navigate({ responses: toggleInList(props.responses, value) });

	const toggleTeam = (teamId: string) =>
		navigate({ teamIds: toggleInList(props.teamIds, teamId) });

	const toggleSortDir = () =>
		navigate({ sortDir: props.sortDir === "asc" ? undefined : "asc" });

	const hasActiveFilters =
		!!props.query ||
		!!props.typeGroup ||
		!!props.responses?.length ||
		!!props.teamIds?.length ||
		!!props.dateFrom ||
		!!props.dateTo ||
		!!props.deleted;

	const onClear = () => {
		setQueryInput("");
		router.navigate({ replace: true, search: {}, to: "." });
	};

	return {
		hasActiveFilters,
		navigate,
		onClear,
		queryInput,
		setQueryInput,
		setTypeGroup,
		toggleResponse,
		toggleSortDir,
		toggleTeam,
	};
};

// The segmented type switch shared by both layouts. Full-width equal-split
// buttons read fine at any viewport width down to a single mobile column,
// since there are only ever three of them.
function TypeGroupTabs({
	value,
	onChange,
}: {
	value: TypeGroup;
	onChange: (key: TypeGroup) => void;
}) {
	return (
		<div className="flex w-full rounded-md border p-0.5 text-sm sm:w-fit">
			{typeGroupTabs.map((tab) => (
				<button
					key={tab.key}
					type="button"
					onClick={() => onChange(tab.key)}
					className={cn(
						"flex-1 rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 font-medium transition-colors sm:flex-none",
						value === tab.key
							? "bg-primary text-primary-foreground"
							: "text-muted-foreground hover:bg-muted hover:text-foreground",
					)}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}

function FilterPill({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				"rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
				active
					? "border-primary bg-primary text-primary-foreground"
					: "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
			)}
		>
			{children}
		</button>
	);
}

// Date-only sort: a single button toggles ascending/descending, matching
// what the design round settled on — no field picker, since date is the
// only sortable dimension this list needs.
function SortButton({
	dir,
	onToggle,
}: {
	dir: FiltersProps["sortDir"];
	onToggle: () => void;
}) {
	const isAscending = dir === "asc";
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className="shrink-0"
			onClick={onToggle}
			aria-label={`${t("Date")}: ${isAscending ? t("Ascending") : t("Descending")}`}
		>
			{isAscending ? (
				<ArrowUpNarrowWideIcon className="size-3.5" />
			) : (
				<ArrowDownWideNarrowIcon className="size-3.5" />
			)}
			{t("Date")}
		</Button>
	);
}

export const InlineFilters = (props: FiltersProps & { teams: Team[] }) => {
	const { teams, ...search } = props;
	const {
		hasActiveFilters,
		navigate,
		onClear,
		queryInput,
		setQueryInput,
		setTypeGroup,
		toggleResponse,
		toggleSortDir,
		toggleTeam,
	} = useAppointmentLiveFilters(search);

	const typeGroup: TypeGroup = search.typeGroup ?? "ALL";

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-3">
				<TypeGroupTabs value={typeGroup} onChange={setTypeGroup} />
				<Input
					className="w-56"
					placeholder={t("Search appointment or person...")}
					value={queryInput}
					onChange={(e) => setQueryInput(e.target.value)}
				/>
				<div className="flex items-center gap-2">
					<Label className="text-muted-foreground text-xs">{t("From")}</Label>
					<Input
						type="date"
						className="w-36"
						value={search.dateFrom ?? ""}
						onChange={(e) =>
							navigate({ dateFrom: e.target.value || undefined })
						}
					/>
					<Label className="text-muted-foreground text-xs">{t("To")}</Label>
					<Input
						type="date"
						className="w-36"
						value={search.dateTo ?? ""}
						onChange={(e) => navigate({ dateTo: e.target.value || undefined })}
					/>
				</div>
				<label
					htmlFor="inline-filters-deleted"
					className="flex items-center gap-2 text-sm text-muted-foreground"
				>
					<Checkbox
						id="inline-filters-deleted"
						checked={search.deleted ?? false}
						onCheckedChange={(checked) =>
							navigate({ deleted: checked === true ? true : undefined })
						}
					/>
					{t("Show deleted?")}
				</label>
				<SortButton dir={search.sortDir} onToggle={toggleSortDir} />
				{hasActiveFilters && (
					<Button type="button" size="sm" variant="secondary" onClick={onClear}>
						{t("Clear")}
					</Button>
				)}
			</div>

			{typeGroup === "TOURNAMENT" && (
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="text-muted-foreground text-xs">
						{t("My response")}:
					</span>
					{responseOptions.map((opt) => (
						<FilterPill
							key={opt.value}
							active={!!search.responses?.includes(opt.value)}
							onClick={() => toggleResponse(opt.value)}
						>
							{opt.label}
						</FilterPill>
					))}
				</div>
			)}

			{typeGroup === "TEAM_MATCH" && teams.length > 0 && (
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="text-muted-foreground text-xs">{t("Team")}:</span>
					{teams.map((team) => (
						<FilterPill
							key={team.id}
							active={!!search.teamIds?.includes(team.id)}
							onClick={() => toggleTeam(team.id)}
						>
							{team.title}
						</FilterPill>
					))}
				</div>
			)}
		</div>
	);
};

// Mobile: a search bar that's always visible and filters as you type, plus
// a secondary sheet for everything else — type group, contextual pills,
// sort, date range, show deleted. All apply immediately, no Apply button.
export const MobileFilters = (props: FiltersProps & { teams: Team[] }) => {
	const { teams, ...search } = props;
	const {
		navigate,
		queryInput,
		setQueryInput,
		setTypeGroup,
		toggleResponse,
		toggleSortDir,
		toggleTeam,
	} = useAppointmentLiveFilters(search);
	const [sheetOpen, setSheetOpen] = React.useState(false);
	const typeGroup: TypeGroup = search.typeGroup ?? "ALL";
	const secondaryActive =
		!!search.typeGroup ||
		!!search.responses?.length ||
		!!search.teamIds?.length ||
		!!search.dateFrom ||
		!!search.dateTo ||
		!!search.deleted ||
		!!search.sortDir;

	const clearSecondary = () =>
		navigate({
			dateFrom: undefined,
			dateTo: undefined,
			deleted: undefined,
			responses: undefined,
			sortDir: undefined,
			teamIds: undefined,
			typeGroup: undefined,
		});

	const prefersReducedMotion = usePrefersReducedMotion();
	const { dragOffset, isDragging, handlePointerHandlers } = useDragToDismiss(
		() => setSheetOpen(false),
	);

	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center gap-2">
				<Input
					placeholder={t("Search appointment or person...")}
					value={queryInput}
					onChange={(e) => setQueryInput(e.target.value)}
					className="flex-1"
				/>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="relative shrink-0"
					onClick={() => setSheetOpen(true)}
				>
					<SlidersHorizontalIcon className="size-4" />
					{secondaryActive && (
						<span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-primary" />
					)}
				</Button>
			</div>
			{secondaryActive && (
				<button
					type="button"
					onClick={clearSecondary}
					className="self-start text-muted-foreground text-xs underline underline-offset-2"
				>
					{t("Clear")}
				</button>
			)}
			<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
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
					<SheetTitle className="sr-only">{t("Filters")}</SheetTitle>
					<div
						className="flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-1 active:cursor-grabbing"
						{...handlePointerHandlers}
					>
						<div className="h-1.5 w-9 rounded-full bg-muted-foreground/30" />
					</div>
					<div className="flex flex-col gap-4 px-4 pb-6">
						<fieldset className="flex flex-col gap-1.5">
							<Label>{t("Type")}</Label>
							<TypeGroupTabs value={typeGroup} onChange={setTypeGroup} />
						</fieldset>

						{typeGroup === "TOURNAMENT" && (
							<fieldset className="flex flex-col gap-1.5">
								<Label>{t("My response")}</Label>
								<div className="flex flex-wrap gap-1.5">
									{responseOptions.map((opt) => (
										<FilterPill
											key={opt.value}
											active={!!search.responses?.includes(opt.value)}
											onClick={() => toggleResponse(opt.value)}
										>
											{opt.label}
										</FilterPill>
									))}
								</div>
							</fieldset>
						)}

						{typeGroup === "TEAM_MATCH" && teams.length > 0 && (
							<fieldset className="flex flex-col gap-1.5">
								<Label>{t("Team")}</Label>
								<div className="flex flex-wrap gap-1.5">
									{teams.map((team) => (
										<FilterPill
											key={team.id}
											active={!!search.teamIds?.includes(team.id)}
											onClick={() => toggleTeam(team.id)}
										>
											{team.title}
										</FilterPill>
									))}
								</div>
							</fieldset>
						)}

						<fieldset className="flex flex-col gap-1.5">
							<Label>{t("Sort")}</Label>
							<SortButton dir={search.sortDir} onToggle={toggleSortDir} />
						</fieldset>

						<div className="grid grid-cols-2 gap-3">
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor="mobile-filters-from">{t("From")}</Label>
								<Input
									id="mobile-filters-from"
									type="date"
									value={search.dateFrom ?? ""}
									onChange={(e) =>
										navigate({ dateFrom: e.target.value || undefined })
									}
								/>
							</fieldset>
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor="mobile-filters-to">{t("To")}</Label>
								<Input
									id="mobile-filters-to"
									type="date"
									value={search.dateTo ?? ""}
									onChange={(e) =>
										navigate({ dateTo: e.target.value || undefined })
									}
								/>
							</fieldset>
						</div>
						<label
							htmlFor="mobile-filters-deleted"
							className="flex items-center gap-2 text-sm text-muted-foreground"
						>
							<Checkbox
								id="mobile-filters-deleted"
								checked={search.deleted ?? false}
								onCheckedChange={(checked) =>
									navigate({ deleted: checked === true ? true : undefined })
								}
							/>
							{t("Show deleted?")}
						</label>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
};
