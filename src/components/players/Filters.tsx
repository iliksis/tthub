import { useRouter } from "@tanstack/react-router";
import { SlidersHorizontalIcon } from "lucide-react";
import React from "react";
import { z } from "zod";
import {
	FilterBar,
	type FilterBarSegment,
	type FilterToken,
} from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useDragToDismiss } from "@/hooks/use-drag-to-dismiss";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import type { Team } from "@/lib/prisma/client";
import { calculateAgeGroup } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export const filterSchema = z.object({
	ageGroup: z.string().optional(),
	qttrMax: z.number().optional(),
	qttrMin: z.number().optional(),
	query: z.string().optional(),
	teamId: z.string().optional(),
});
type FiltersProps = z.infer<typeof filterSchema>;

const NO_TEAM = "NONE";

const ageGroupOptions = [
	{ label: m.players_all_age_groups(), value: "ALL" },
	{ label: "U11", value: "U11" },
	{ label: "U13", value: "U13" },
	{ label: "U15", value: "U15" },
	{ label: "U19", value: "U19" },
	{ label: m.players_adult(), value: calculateAgeGroup(0) },
];

const teamOptions = (teams: Team[]) => [
	{ label: m.players_all_teams(), value: "ALL" },
	...teams.map((team) => ({ label: team.title, value: team.id })),
	{ label: m.players_no_team(), value: NO_TEAM },
];

// Shared by CommandBarFilters (desktop) and MobilePlayerFilters (mobile) —
// every field applies immediately; text search is debounced so typing
// doesn't fire a navigation per keystroke, everything else navigates on
// change. Mirrors the appointment list's filter pattern
// (src/components/appointments/List.tsx).
const usePlayerLiveFilters = (props: FiltersProps) => {
	const router = useRouter();

	const navigate = React.useCallback(
		(next: Partial<FiltersProps>) => {
			router.navigate({
				replace: true,
				search: { ...props, ...next },
				to: ".",
			});
		},
		[router, props],
	);

	const { queryInput, setQueryInput } = useDebouncedSearch(
		props.query,
		(value) => navigate({ query: value || undefined }),
	);

	const onClear = () => {
		setQueryInput("");
		router.navigate({ replace: true, search: {}, to: "." });
	};

	return { navigate, onClear, queryInput, setQueryInput };
};

type CommandBarFiltersProps = FiltersProps & { teams: Team[] };

// Desktop filter bar — a segmented toolbar built on the shared FilterBar:
// search, then one segment per filter dimension (team, age group, QTTR
// range). FilterBar owns the dropdown wiring and the removable-token row;
// this component only declares what the segments are. QTTR is a "custom"
// segment since a min/max range isn't a plain option list — its tokens are
// computed here and handed to the bar. Promoted from the players-filters
// prototype ("Toolbar" variant).
export const CommandBarFilters = ({
	teams,
	...search
}: CommandBarFiltersProps) => {
	const { navigate, onClear, queryInput, setQueryInput } =
		usePlayerLiveFilters(search);

	const qttrTokens: FilterToken[] = [];
	if (search.qttrMin !== undefined) {
		qttrTokens.push({
			key: "qttrMin",
			label: m.players_qttr_min({ param1: search.qttrMin.toString() }),
			onRemove: () => navigate({ qttrMin: undefined }),
		});
	}
	if (search.qttrMax !== undefined) {
		qttrTokens.push({
			key: "qttrMax",
			label: m.players_qttr_max({ param1: search.qttrMax.toString() }),
			onRemove: () => navigate({ qttrMax: undefined }),
		});
	}
	const hasQttrFilter = qttrTokens.length > 0;

	const segments: FilterBarSegment[] = [
		{
			key: "team",
			label: m.common_team(),
			onChange: (v) => navigate({ teamId: v === "ALL" ? undefined : v }),
			options: teamOptions(teams),
			type: "radio",
			value: search.teamId ?? "ALL",
		},
		{
			key: "ageGroup",
			label: m.common_age_group(),
			onChange: (v) => navigate({ ageGroup: v === "ALL" ? undefined : v }),
			options: ageGroupOptions,
			type: "radio",
			value: search.ageGroup ?? "ALL",
		},
		{
			active: hasQttrFilter,
			align: "end",
			children: (
				<div className="flex items-center gap-2 px-2 py-1.5">
					<Input
						type="number"
						placeholder={m.players_min()}
						className="h-7"
						value={search.qttrMin ?? ""}
						onChange={(e) =>
							navigate({
								qttrMin:
									e.target.value === "" ? undefined : Number(e.target.value),
							})
						}
					/>
					<Input
						type="number"
						placeholder={m.players_max()}
						className="h-7"
						value={search.qttrMax ?? ""}
						onChange={(e) =>
							navigate({
								qttrMax:
									e.target.value === "" ? undefined : Number(e.target.value),
							})
						}
					/>
				</div>
			),
			contentClassName: "w-56",
			icon: <SlidersHorizontalIcon className="size-3.5" />,
			key: "qttr",
			label: m.common_qttr(),
			tokens: qttrTokens,
			type: "custom",
			valueLabel: hasQttrFilter
				? `${search.qttrMin ?? "0"}–${search.qttrMax ?? "∞"}`
				: undefined,
		},
	];

	return (
		<FilterBar
			search={{
				onChange: setQueryInput,
				placeholder: m.players_search_players_or_add_filter(),
				value: queryInput,
			}}
			segments={segments}
			onReset={onClear}
		/>
	);
};

type MobilePlayerFiltersProps = FiltersProps & { teams: Team[] };

// Mobile: a search bar that's always visible and filters as you type, plus a
// secondary sheet for the fields people reach for less often (team, age
// group, QTTR range). Both apply immediately — no batching behind an Apply
// button. Mirrors MobileFilters in src/components/appointments/List.tsx,
// including the drag-to-dismiss handle.
export const MobilePlayerFilters = ({
	teams,
	...props
}: MobilePlayerFiltersProps) => {
	const { navigate, queryInput, setQueryInput } = usePlayerLiveFilters(props);
	const [sheetOpen, setSheetOpen] = React.useState(false);
	const secondaryActive =
		!!props.teamId ||
		!!props.ageGroup ||
		props.qttrMin !== undefined ||
		props.qttrMax !== undefined;

	const clearSecondary = () =>
		navigate({
			ageGroup: undefined,
			qttrMax: undefined,
			qttrMin: undefined,
			teamId: undefined,
		});

	const prefersReducedMotion = usePrefersReducedMotion();
	const { dragOffset, isDragging, handlePointerHandlers } = useDragToDismiss(
		() => setSheetOpen(false),
	);

	return (
		<div className="mb-3 flex flex-col gap-1.5">
			<div className="flex items-center gap-2">
				<Input
					placeholder={m.players_search_players()}
					value={queryInput}
					onChange={(e) => setQueryInput(e.target.value)}
					className="flex-1"
				/>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="relative shrink-0"
					aria-label={m.common_filters()}
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
					{m.common_clear()}
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
					<SheetTitle className="sr-only">{m.common_filters()}</SheetTitle>
					<div
						className="flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-1 active:cursor-grabbing"
						{...handlePointerHandlers}
					>
						<div className="h-1.5 w-9 rounded-full bg-muted-foreground/30" />
					</div>
					<div className="flex flex-col gap-4 px-4 pb-6">
						<div className="grid grid-cols-2 gap-3">
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor="mobile-player-filters-team">
									{m.common_team()}
								</Label>
								<Select
									value={props.teamId ?? "ALL"}
									onValueChange={(v) =>
										navigate({ teamId: !v || v === "ALL" ? undefined : v })
									}
								>
									<SelectTrigger
										id="mobile-player-filters-team"
										className="w-full"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{teamOptions(teams).map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</fieldset>
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor="mobile-player-filters-age-group">
									{m.common_age_group()}
								</Label>
								<Select
									value={props.ageGroup ?? "ALL"}
									onValueChange={(v) =>
										navigate({ ageGroup: !v || v === "ALL" ? undefined : v })
									}
								>
									<SelectTrigger
										id="mobile-player-filters-age-group"
										className="w-full"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ageGroupOptions.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</fieldset>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor="mobile-player-filters-qttr-min">
									QTTR {m.players_min()}
								</Label>
								<Input
									id="mobile-player-filters-qttr-min"
									type="number"
									value={props.qttrMin ?? ""}
									onChange={(e) =>
										navigate({
											qttrMin:
												e.target.value === ""
													? undefined
													: Number(e.target.value),
										})
									}
								/>
							</fieldset>
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor="mobile-player-filters-qttr-max">
									QTTR {m.players_max()}
								</Label>
								<Input
									id="mobile-player-filters-qttr-max"
									type="number"
									value={props.qttrMax ?? ""}
									onChange={(e) =>
										navigate({
											qttrMax:
												e.target.value === ""
													? undefined
													: Number(e.target.value),
										})
									}
								/>
							</fieldset>
						</div>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
};

export const applyPlayerFilters = <
	T extends {
		name: string;
		year: number;
		qttr: number;
		teams: { teamId: string }[];
	},
>(
	players: T[],
	filters: FiltersProps,
) =>
	players.filter((p) => {
		if (
			filters.query &&
			!p.name.toLowerCase().includes(filters.query.toLowerCase())
		)
			return false;
		if (filters.teamId) {
			const currentTeamId = p.teams[0]?.teamId ?? null;
			if (
				filters.teamId === NO_TEAM
					? currentTeamId !== null
					: currentTeamId !== filters.teamId
			)
				return false;
		}
		if (filters.ageGroup && calculateAgeGroup(p.year) !== filters.ageGroup)
			return false;
		if (filters.qttrMin !== undefined && p.qttr < filters.qttrMin) return false;
		if (filters.qttrMax !== undefined && p.qttr > filters.qttrMax) return false;
		return true;
	});
