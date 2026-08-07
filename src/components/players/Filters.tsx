import { useRouter } from "@tanstack/react-router";
import { SlidersHorizontalIcon } from "lucide-react";
import React from "react";
import { z } from "zod";
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
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import type { Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { calculateAgeGroup } from "@/lib/utils";

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
	{ label: t("All age groups"), value: "ALL" },
	{ label: "U11", value: "U11" },
	{ label: "U13", value: "U13" },
	{ label: "U15", value: "U15" },
	{ label: "U19", value: "U19" },
	{ label: t("Adult"), value: calculateAgeGroup(0) },
];

const teamOptions = (teams: Team[]) => [
	{ label: t("All teams"), value: "ALL" },
	...teams.map((team) => ({ label: team.title, value: team.id })),
	{ label: t("No team"), value: NO_TEAM },
];

// Shared by InlinePlayerFilters (desktop) and MobilePlayerFilters (mobile) —
// every field applies immediately; text search is debounced so typing
// doesn't fire a navigation per keystroke, everything else navigates on
// change. Mirrors the appointment list's filter pattern
// (src/components/appointments/List.tsx).
const usePlayerLiveFilters = (props: FiltersProps) => {
	const router = useRouter();
	const [queryInput, setQueryInput] = React.useState(props.query ?? "");

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

	// biome-ignore lint/correctness/useExhaustiveDependencies: only re-runs when the local input changes; navigate/props.query are read, not resynced on
	React.useEffect(() => {
		const timeout = setTimeout(() => {
			if (queryInput !== (props.query ?? "")) {
				navigate({ query: queryInput || undefined });
			}
		}, 300);
		return () => clearTimeout(timeout);
	}, [queryInput]);

	const hasActiveFilters =
		!!props.query ||
		!!props.teamId ||
		!!props.ageGroup ||
		props.qttrMin !== undefined ||
		props.qttrMax !== undefined;

	const onClear = () => {
		setQueryInput("");
		router.navigate({ replace: true, search: {}, to: "." });
	};

	return { hasActiveFilters, navigate, onClear, queryInput, setQueryInput };
};

type InlinePlayerFiltersProps = FiltersProps & { teams: Team[] };

export const InlinePlayerFilters = ({
	teams,
	...props
}: InlinePlayerFiltersProps) => {
	const { hasActiveFilters, navigate, onClear, queryInput, setQueryInput } =
		usePlayerLiveFilters(props);

	return (
		<div className="flex flex-wrap items-center gap-3">
			<Input
				className="w-56"
				placeholder={t("Search Players")}
				value={queryInput}
				onChange={(e) => setQueryInput(e.target.value)}
			/>
			<Select
				value={props.teamId ?? "ALL"}
				onValueChange={(v) =>
					navigate({ teamId: !v || v === "ALL" ? undefined : v })
				}
			>
				<SelectTrigger size="sm" className="w-40">
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
			<Select
				value={props.ageGroup ?? "ALL"}
				onValueChange={(v) =>
					navigate({ ageGroup: !v || v === "ALL" ? undefined : v })
				}
			>
				<SelectTrigger size="sm" className="w-40">
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
			<div className="flex items-center gap-2">
				<Label className="text-muted-foreground text-xs">QTTR</Label>
				<Input
					type="number"
					placeholder={t("Min")}
					className="w-20"
					value={props.qttrMin ?? ""}
					onChange={(e) =>
						navigate({
							qttrMin:
								e.target.value === "" ? undefined : Number(e.target.value),
						})
					}
				/>
				<Input
					type="number"
					placeholder={t("Max")}
					className="w-20"
					value={props.qttrMax ?? ""}
					onChange={(e) =>
						navigate({
							qttrMax:
								e.target.value === "" ? undefined : Number(e.target.value),
						})
					}
				/>
			</div>
			{hasActiveFilters && (
				<Button type="button" size="sm" variant="secondary" onClick={onClear}>
					{t("Clear")}
				</Button>
			)}
		</div>
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
		if (dragOffset > DISMISS_THRESHOLD) setSheetOpen(false);
		setDragOffset(0);
	};

	return (
		<div className="mb-3 flex flex-col gap-1.5">
			<div className="flex items-center gap-2">
				<Input
					placeholder={t("Search Players")}
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
						onPointerDown={onHandlePointerDown}
						onPointerMove={onHandlePointerMove}
						onPointerUp={onHandlePointerEnd}
						onPointerCancel={onHandlePointerEnd}
					>
						<div className="h-1.5 w-9 rounded-full bg-muted-foreground/30" />
					</div>
					<div className="flex flex-col gap-4 px-4 pb-6">
						<div className="grid grid-cols-2 gap-3">
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor="mobile-player-filters-team">{t("Team")}</Label>
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
									{t("Age Group")}
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
									QTTR {t("Min")}
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
									QTTR {t("Max")}
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
	T extends { name: string; year: number; qttr: number; teamId: string | null },
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
			if (
				filters.teamId === NO_TEAM
					? p.teamId !== null
					: p.teamId !== filters.teamId
			)
				return false;
		}
		if (filters.ageGroup && calculateAgeGroup(p.year) !== filters.ageGroup)
			return false;
		if (filters.qttrMin !== undefined && p.qttr < filters.qttrMin) return false;
		if (filters.qttrMax !== undefined && p.qttr > filters.qttrMax) return false;
		return true;
	});
