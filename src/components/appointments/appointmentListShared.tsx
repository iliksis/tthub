import type { RowSelectionState } from "@tanstack/react-table";
import {
	CalendarOffIcon,
	SlidersHorizontalIcon,
	TrophyIcon,
	UsersIcon,
} from "lucide-react";
import React from "react";
import { z } from "zod";
import type { AppointmentWithSeason } from "@/api/appointments";
import { FilterPill } from "@/components/appointments/List";
import {
	type CommandBarItem,
	commandBarButtonVariant,
	type DetailsListColumn,
} from "@/components/DetailsList";
import type { FilterBarSegment } from "@/components/FilterBar";
import { LabelBadges } from "@/components/labels/LabelBadges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link as EntityLink } from "@/components/ui/link";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useDragToDismiss } from "@/hooks/use-drag-to-dismiss";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { AppointmentType } from "@/lib/prisma/enums";
import { cn, formatShortDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export const BATCH_SIZE = 25;
export const ALL_SEASONS = "ALL";

export const appointmentTypeLabel: Record<AppointmentType, string> = {
	HOLIDAY: m.common_holiday(),
	TEAM_MATCH: m.common_team_matches(),
	TOURNAMENT: m.common_tournament(),
};

export const typeFilterOptions = Object.values(AppointmentType).map((type) => ({
	label: appointmentTypeLabel[type],
	value: type,
}));

export const appointmentFilterSearchSchema = z.object({
	query: z.string().optional(),
	seasonId: z.string().optional(),
	skip: z.number().int().nonnegative().optional(),
	types: z.array(z.nativeEnum(AppointmentType)).optional(),
});

const appointmentTypeIcon: Record<AppointmentType, typeof TrophyIcon> = {
	HOLIDAY: CalendarOffIcon,
	TEAM_MATCH: UsersIcon,
	TOURNAMENT: TrophyIcon,
};

export const appointmentListColumns: DetailsListColumn<AppointmentWithSeason>[] =
	[
		{
			key: "title",
			label: m.appointments_appointment(),
			render: (item) => (
				<EntityLink to="/appts/$apptId" params={{ apptId: item.id }}>
					{item.title}
				</EntityLink>
			),
		},
		{
			key: "type",
			label: m.appointments_type(),
			render: (item) => appointmentTypeLabel[item.type],
		},
		{
			key: "labels",
			label: m.labels_labels(),
			render: (item) => (
				<LabelBadges labels={item.labels.map((l) => l.label)} />
			),
		},
		{
			key: "season",
			label: m.common_season(),
			render: (item) => item.season?.name ?? "—",
		},
		{
			key: "startDate",
			label: m.appointments_startdate(),
			render: (item) => formatShortDate(item.startDate),
		},
		{
			key: "location",
			label: m.appointments_location(),
			render: (item) => item.location ?? "—",
		},
	];

// Shared between /appts/bulk and /appts/trash — both list pages support the
// same "select all N matching filters" flow, so the status bar communicating
// the current selection is identical between them.
export function SelectionStatusBar({
	matchedTotal,
	selectAllMatching,
	excludeCount,
	selectedCount,
	onExitSelectAllMatching,
	onEnterSelectAllMatching,
}: {
	matchedTotal: number;
	selectAllMatching: boolean;
	excludeCount: number;
	selectedCount: number;
	onExitSelectAllMatching: () => void;
	onEnterSelectAllMatching: () => void;
}) {
	if (matchedTotal === 0) return null;

	return (
		<div className="flex flex-wrap items-center gap-2 text-sm">
			{selectAllMatching ? (
				<>
					<span className="text-muted-foreground">
						{excludeCount > 0
							? m.appointments_n_matching_excluded({
									param1: selectedCount.toString(),
									param2: excludeCount.toString(),
								})
							: m.appointments_n_matching_selected_count({
									count: selectedCount,
								})}
					</span>
					<Button
						type="button"
						variant="link"
						size="sm"
						className="h-auto p-0"
						onClick={onExitSelectAllMatching}
					>
						{m.common_clear_selection()}
					</Button>
				</>
			) : (
				<>
					{selectedCount > 0 && (
						<span className="text-muted-foreground">
							{m.appointments_appointment_selected_count({
								count: selectedCount,
							})}
						</span>
					)}
					<Button
						type="button"
						variant="link"
						size="sm"
						className="h-auto p-0"
						onClick={onEnterSelectAllMatching}
					>
						{m.appointments_select_all_n_matching_filters({
							param1: matchedTotal.toString(),
						})}
					</Button>
				</>
			)}
		</div>
	);
}

// Mobile counterpart to the shared FilterBar (desktop): a search bar that's
// always visible and filters as you type, plus a secondary bottom sheet for
// everything else (type, season) — matching the appointments main list's
// MobileFilters (src/components/appointments/List.tsx): same drag-to-dismiss
// sheet, same FilterPill toggle buttons, same "dot on the filter button when
// something's active" affordance. Generic over `segments` (the same
// FilterBarSegment[] the desktop FilterBar already renders) rather than
// hardcoding fields, since /appts/bulk and /appts/trash only ever use the
// checkbox (type) and radio (season) segment kinds. Shared by both pages.
export function AppointmentMobileFilters({
	queryInput,
	setQueryInput,
	segments,
	onClearFilters,
}: {
	queryInput: string;
	setQueryInput: (value: string) => void;
	segments: FilterBarSegment[];
	onClearFilters: () => void;
}) {
	const [sheetOpen, setSheetOpen] = React.useState(false);
	const secondaryActive = segments.some((segment) => {
		if (segment.type === "radio") {
			return segment.value !== (segment.allValue ?? "ALL");
		}
		if (segment.type === "checkbox") return segment.values.length > 0;
		if (segment.type === "toggle") return segment.active;
		return false;
	});

	const prefersReducedMotion = usePrefersReducedMotion();
	const { dragOffset, isDragging, handlePointerHandlers } = useDragToDismiss(
		() => setSheetOpen(false),
	);

	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center gap-2">
				<Input
					placeholder={m.appointments_search_appointment()}
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
					onClick={onClearFilters}
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
						{segments.map((segment) => (
							<fieldset key={segment.key} className="flex flex-col gap-1.5">
								<Label>{segment.label}</Label>
								<div className="flex flex-wrap gap-1.5">
									{segment.type === "radio" &&
										segment.options.map((option) => (
											<FilterPill
												key={option.value}
												active={segment.value === option.value}
												onClick={() => segment.onChange(option.value)}
											>
												{option.label}
											</FilterPill>
										))}
									{segment.type === "checkbox" &&
										segment.options.map((option) => (
											<FilterPill
												key={option.value}
												active={segment.values.includes(option.value)}
												onClick={() => segment.onToggle(option.value)}
											>
												{option.label}
											</FilterPill>
										))}
								</div>
							</fieldset>
						))}
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}

// Mobile counterpart to DetailsList's table: one stacked card per Appointment
// with its own checkbox (no shift-click range-select — there's no keyboard
// modifier on touch, only tap-to-toggle plus the existing "select all N
// matching" link above). Shared by /appts/bulk and /appts/trash.
export function AppointmentCardList({
	items,
	getItemId,
	selection,
	onSelectionChange,
	emptyMessage,
}: {
	items: AppointmentWithSeason[];
	getItemId: (item: AppointmentWithSeason) => string;
	selection: RowSelectionState;
	onSelectionChange: (
		updater:
			| RowSelectionState
			| ((old: RowSelectionState) => RowSelectionState),
	) => void;
	emptyMessage: string;
}) {
	if (items.length === 0) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				{emptyMessage}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2.5">
			{items.map((item) => {
				const id = getItemId(item);
				const checked = !!selection[id];
				const Icon = appointmentTypeIcon[item.type];
				return (
					<div
						key={id}
						className={cn(
							"flex items-start gap-3 rounded-lg bg-card p-4",
							checked && "bg-muted",
						)}
					>
						<Checkbox
							checked={checked}
							className="mt-0.5 shrink-0"
							onCheckedChange={(isChecked) =>
								onSelectionChange((old) => {
									const next = { ...old };
									if (isChecked === true) next[id] = true;
									else delete next[id];
									return next;
								})
							}
						/>
						<div className="min-w-0 flex-1">
							<EntityLink
								to="/appts/$apptId"
								params={{ apptId: item.id }}
								className="block min-w-[6ch] truncate font-medium"
							>
								{item.title}
							</EntityLink>
							<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
								<span className="inline-flex items-center gap-1">
									<Icon className="size-3.5" />
									{appointmentTypeLabel[item.type]}
								</span>
								<span>{formatShortDate(item.startDate)}</span>
								{item.season && <span>{item.season.name}</span>}
								{item.location && (
									<span className="truncate">{item.location}</span>
								)}
							</div>
							<LabelBadges
								labels={item.labels.map((l) => l.label)}
								className="mt-1"
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// Mobile counterpart to DetailsList's inline command bar: the same actions,
// rendered as a persistent bottom action dock (matching the pattern used
// elsewhere, e.g. the appt detail page's Accept/Maybe/Decline dock) instead
// of a row of buttons above the list, so they stay reachable without
// scrolling back up a long card list. Only rendered while something is
// selected. Shared by /appts/bulk and /appts/trash.
export function MobileCommandDock<T>({
	commandBarItems,
	selectedItems,
	visible,
	isNavigating,
}: {
	commandBarItems: CommandBarItem<T>[];
	selectedItems: T[];
	visible: boolean;
	isNavigating?: boolean;
}) {
	if (!visible || commandBarItems.length === 0) return null;

	return (
		<div
			className={cn(
				"fixed inset-x-0 bottom-0 z-40 flex gap-2 border-border/60 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden",
				isNavigating && "pointer-events-none opacity-60",
			)}
		>
			{commandBarItems.map((commandItem) => {
				const isDisabled =
					isNavigating || commandItem.isDisabled?.(selectedItems);
				const variant = commandBarButtonVariant(commandItem.variant);
				return (
					<Button
						key={commandItem.key}
						type="button"
						variant={variant}
						disabled={isDisabled}
						onClick={() => commandItem.onClick?.(selectedItems)}
						className="flex-1"
					>
						{commandItem.icon}
						{commandItem.label}
					</Button>
				);
			})}
		</div>
	);
}
