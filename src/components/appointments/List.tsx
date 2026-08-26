import { useRouter } from "@tanstack/react-router";
import { SlidersHorizontalIcon } from "lucide-react";
import React from "react";
import { z } from "zod";
import { FilterBar, type FilterBarSegment } from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useDragToDismiss } from "@/hooks/use-drag-to-dismiss";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import type { Appointment, Response, Season, Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";

export const getUserResponse = (
	item: Appointment & { responses: Response[] },
	userId: string | undefined,
) => item.responses?.find((r) => r.userId === userId)?.responseType ?? "MAYBE";

export const filterSchema = z.object({
	deleted: z.boolean().optional(),
	query: z.string().optional(),
	responses: z.array(z.enum(["ACCEPT", "MAYBE", "DECLINE", "NONE"])).optional(),
	seasonId: z.string().optional(),
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

// Desktop filter bar — a segmented toolbar built on the shared FilterBar:
// search, then one segment per filter dimension (type, and whichever of
// response/team applies to the selected type), plus a plain toggle segment
// for "show deleted". FilterBar owns the dropdown wiring, active-state
// styling, and the removable-token row (a segment can't show per-value
// removal on its own, e.g. which of several selected responses to drop) —
// this component only declares what the segments are.
type SeasonFiltersProps = {
	teams: Team[];
	seasons: Season[];
};

const ALL_SEASONS = "ALL";

function seasonFilterOptions(seasons: Season[]) {
	return [
		{ label: t("All"), value: ALL_SEASONS },
		...seasons.map((season) => ({ label: season.name, value: season.id })),
	];
}

export const CommandBarFilters = (props: FiltersProps & SeasonFiltersProps) => {
	const { teams, seasons, ...search } = props;
	const {
		navigate,
		onClear,
		queryInput,
		setQueryInput,
		setTypeGroup,
		toggleResponse,
		toggleTeam,
	} = useAppointmentLiveFilters(search);

	const typeGroup: TypeGroup = search.typeGroup ?? "ALL";

	const segments: FilterBarSegment[] = [
		{
			key: "type",
			label: t("Type"),
			onChange: (v) => setTypeGroup(v as TypeGroup),
			options: typeGroupTabs.map((tab) => ({
				label: tab.label,
				value: tab.key,
			})),
			type: "radio",
			value: typeGroup,
		},
	];
	if (seasons.length > 0) {
		segments.push({
			key: "season",
			label: t("Season"),
			onChange: (v) =>
				navigate({ seasonId: v === ALL_SEASONS ? undefined : v }),
			options: seasonFilterOptions(seasons),
			type: "radio",
			value: search.seasonId ?? ALL_SEASONS,
		});
	}
	if (typeGroup === "TOURNAMENT") {
		segments.push({
			key: "response",
			label: t("My response"),
			onToggle: (v) => toggleResponse(v as ResponseFilterValue),
			options: responseOptions,
			type: "checkbox",
			values: search.responses ?? [],
		});
	}
	if (typeGroup === "TEAM_MATCH" && teams.length > 0) {
		segments.push({
			key: "team",
			label: t("Team"),
			onToggle: toggleTeam,
			options: teams.map((tm) => ({ label: tm.title, value: tm.id })),
			type: "checkbox",
			values: search.teamIds ?? [],
		});
	}
	segments.push({
		active: !!search.deleted,
		key: "deleted",
		label: t("Show deleted?"),
		onToggle: () => navigate({ deleted: search.deleted ? undefined : true }),
		tokenLabel: t("Incl. deleted"),
		type: "toggle",
	});

	return (
		<FilterBar
			search={{
				onChange: setQueryInput,
				placeholder: t("Search appointment or add filter..."),
				value: queryInput,
			}}
			segments={segments}
			onReset={onClear}
		/>
	);
};

// Mobile: a search bar that's always visible and filters as you type, plus
// a secondary sheet for everything else — type group, contextual pills,
// sort, date range, show deleted. All apply immediately, no Apply button.
export const MobileFilters = (props: FiltersProps & SeasonFiltersProps) => {
	const { teams, seasons, ...search } = props;
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

						{seasons.length > 0 && (
							<fieldset className="flex flex-col gap-1.5">
								<Label>{t("Season")}</Label>
								<div className="flex flex-wrap gap-1.5">
									{seasonFilterOptions(seasons).map((option) => (
										<FilterPill
											key={option.value}
											active={(search.seasonId ?? ALL_SEASONS) === option.value}
											onClick={() =>
												navigate({
													seasonId:
														option.value === ALL_SEASONS
															? undefined
															: option.value,
												})
											}
										>
											{option.label}
										</FilterPill>
									))}
								</div>
							</fieldset>
						)}

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
