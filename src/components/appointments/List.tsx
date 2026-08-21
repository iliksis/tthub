import { Link, useRouteContext, useRouter } from "@tanstack/react-router";
import {
	CircleQuestionMarkIcon,
	PlusIcon,
	SearchIcon,
	SlidersHorizontalIcon,
	UserCheckIcon,
	UserXIcon,
	XIcon,
} from "lucide-react";
import React from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useDragToDismiss } from "@/hooks/use-drag-to-dismiss";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import type { Appointment, Response, Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { cn, isDayInPast, isInformationalAppointmentType } from "@/lib/utils";

type AppointmentWithResponses = Appointment & {
	responses: Response[];
	ownTeam: Team | null;
};

type ListProps = {
	appointments: AppointmentWithResponses[];
};

export const getUserResponse = (
	item: Appointment & { responses: Response[] },
	userId: string | undefined,
) => item.responses?.find((r) => r.userId === userId)?.responseType ?? "MAYBE";

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
											{isAccepted ? (
												<UserCheckIcon />
											) : isDeclined ? (
												<UserXIcon />
											) : (
												<CircleQuestionMarkIcon />
											)}
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

// Shared by CommandBarFilters (desktop) and MobileFilters (mobile) — every field
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

	const hasActiveFilters =
		!!props.query ||
		!!props.typeGroup ||
		!!props.responses?.length ||
		!!props.teamIds?.length ||
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

type FilterToken = { key: string; label: string; onRemove: () => void };

// Desktop filter bar: active filters render as removable tokens inline with
// the search input, everything else (type, response, team, deleted) lives
// behind a single "Add filter" menu so the table gets the full page width
// instead of a permanent row of controls.
export const CommandBarFilters = (props: FiltersProps & { teams: Team[] }) => {
	const { teams, ...search } = props;
	const {
		navigate,
		queryInput,
		setQueryInput,
		setTypeGroup,
		toggleResponse,
		toggleTeam,
	} = useAppointmentLiveFilters(search);

	const typeGroup: TypeGroup = search.typeGroup ?? "ALL";

	const tokens: FilterToken[] = [];
	if (search.typeGroup) {
		const tab = typeGroupTabs.find((t) => t.key === search.typeGroup);
		if (tab) {
			tokens.push({
				key: "type",
				label: tab.label,
				onRemove: () => setTypeGroup("ALL"),
			});
		}
	}
	for (const value of search.responses ?? []) {
		const opt = responseOptions.find((o) => o.value === value);
		if (opt) {
			tokens.push({
				key: `response-${value}`,
				label: opt.label,
				onRemove: () => toggleResponse(value),
			});
		}
	}
	for (const teamId of search.teamIds ?? []) {
		const team = teams.find((tm) => tm.id === teamId);
		if (team) {
			tokens.push({
				key: `team-${teamId}`,
				label: team.title,
				onRemove: () => toggleTeam(teamId),
			});
		}
	}
	if (search.deleted) {
		tokens.push({
			key: "deleted",
			label: t("Incl. deleted"),
			onRemove: () => navigate({ deleted: undefined }),
		});
	}

	return (
		<div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-card px-2 py-1.5 shadow-sm">
			<SearchIcon className="ml-1 size-4 shrink-0 text-muted-foreground" />
			{tokens.map((token) => (
				<Badge key={token.key} variant="secondary" className="gap-1 pr-1">
					{token.label}
					<button
						type="button"
						data-icon="inline-end"
						className="flex items-center rounded-full p-0.5 hover:bg-accent"
						aria-label={`${t("Clear")}: ${token.label}`}
						onClick={token.onRemove}
					>
						<XIcon />
					</button>
				</Badge>
			))}
			<Input
				className="h-7 min-w-40 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
				placeholder={t("Search appointment or add filter...")}
				value={queryInput}
				onChange={(e) => setQueryInput(e.target.value)}
			/>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<button
							type="button"
							className={cn(
								buttonVariants({ size: "sm", variant: "outline" }),
								"shrink-0",
							)}
						/>
					}
				>
					<PlusIcon className="size-3.5" />
					{t("Add filter")}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuGroup>
						<DropdownMenuLabel>{t("Type")}</DropdownMenuLabel>
						<DropdownMenuRadioGroup
							value={typeGroup}
							onValueChange={(value) => setTypeGroup(value as TypeGroup)}
						>
							{typeGroupTabs.map((tab) => (
								<DropdownMenuRadioItem key={tab.key} value={tab.key}>
									{tab.label}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuGroup>
					{typeGroup === "TOURNAMENT" && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								<DropdownMenuLabel>{t("My response")}</DropdownMenuLabel>
								{responseOptions.map((opt) => (
									<DropdownMenuCheckboxItem
										key={opt.value}
										checked={!!search.responses?.includes(opt.value)}
										onCheckedChange={() => toggleResponse(opt.value)}
									>
										{opt.label}
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuGroup>
						</>
					)}
					{typeGroup === "TEAM_MATCH" && teams.length > 0 && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								<DropdownMenuLabel>{t("Team")}</DropdownMenuLabel>
								{teams.map((team) => (
									<DropdownMenuCheckboxItem
										key={team.id}
										checked={!!search.teamIds?.includes(team.id)}
										onCheckedChange={() => toggleTeam(team.id)}
									>
										{team.title}
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuGroup>
						</>
					)}
					<DropdownMenuSeparator />
					<DropdownMenuCheckboxItem
						checked={search.deleted ?? false}
						onCheckedChange={(checked) =>
							navigate({ deleted: checked === true ? true : undefined })
						}
					>
						{t("Show deleted?")}
					</DropdownMenuCheckboxItem>
				</DropdownMenuContent>
			</DropdownMenu>
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
		toggleTeam,
	} = useAppointmentLiveFilters(search);
	const [sheetOpen, setSheetOpen] = React.useState(false);
	const typeGroup: TypeGroup = search.typeGroup ?? "ALL";
	const secondaryActive =
		!!search.typeGroup ||
		!!search.responses?.length ||
		!!search.teamIds?.length ||
		!!search.deleted;

	const clearSecondary = () =>
		navigate({
			deleted: undefined,
			responses: undefined,
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
					placeholder={t("Search appointment...")}
					value={queryInput}
					onChange={(e) => setQueryInput(e.target.value)}
					className="flex-1"
				/>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="relative shrink-0"
					aria-label={t("Filters")}
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
