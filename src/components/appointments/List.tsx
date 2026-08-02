import { Link, useRouteContext, useRouter } from "@tanstack/react-router";
import { SlidersHorizontalIcon } from "lucide-react";
import React from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Appointment, Response } from "@/lib/prisma/client";
import { AppointmentType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { cn, isDayInPast } from "@/lib/utils";
import type { DetailsListColumn } from "../DetailsList";

type AppointmentWithResponses = Appointment & { responses: Response[] };

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
		render: (item) => item.shortTitle,
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
						if (item.type === AppointmentType.HOLIDAY) return null;
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
									{item.type !== AppointmentType.HOLIDAY && (
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
	response: z.enum(["ACCEPT", "MAYBE", "DECLINE", "NONE"]).optional(),
	skip: z.number().int().nonnegative().optional(),
	type: z.enum(["TOURNAMENT", "TOURNAMENT_DE", "HOLIDAY"]).optional(),
});
type FiltersProps = z.infer<typeof filterSchema>;

const typeOptions: { value: string; label: string }[] = [
	{ label: t("All types"), value: "ALL" },
	{ label: t("Tournament"), value: AppointmentType.TOURNAMENT },
	{ label: t("Tournament (Germany)"), value: AppointmentType.TOURNAMENT_DE },
	{ label: t("Holiday"), value: AppointmentType.HOLIDAY },
];

const responseOptions: { value: string; label: string }[] = [
	{ label: t("All responses"), value: "ALL" },
	{ label: t("Accepted"), value: "ACCEPT" },
	{ label: t("Maybe"), value: "MAYBE" },
	{ label: t("Declined"), value: "DECLINE" },
	{ label: t("No response"), value: "NONE" },
];

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
		!!props.type ||
		!!props.response ||
		!!props.dateFrom ||
		!!props.dateTo ||
		!!props.deleted;

	const onClear = () => {
		setQueryInput("");
		router.navigate({ replace: true, search: {}, to: "." });
	};

	return { hasActiveFilters, navigate, onClear, queryInput, setQueryInput };
};

export const InlineFilters = (props: FiltersProps) => {
	const { hasActiveFilters, navigate, onClear, queryInput, setQueryInput } =
		useAppointmentLiveFilters(props);

	return (
		<div className="flex flex-wrap items-center gap-3">
			<Input
				className="w-56"
				placeholder={t("Search appointment or person...")}
				value={queryInput}
				onChange={(e) => setQueryInput(e.target.value)}
			/>
			<Select
				value={props.type ?? "ALL"}
				onValueChange={(v) =>
					navigate({
						type: v === "ALL" ? undefined : (v as FiltersProps["type"]),
					})
				}
			>
				<SelectTrigger size="sm" className="w-40">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{typeOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				value={props.response ?? "ALL"}
				onValueChange={(v) =>
					navigate({
						response: v === "ALL" ? undefined : (v as FiltersProps["response"]),
					})
				}
			>
				<SelectTrigger size="sm" className="w-40">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{responseOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<div className="flex items-center gap-2">
				<Label className="text-muted-foreground text-xs">{t("From")}</Label>
				<Input
					type="date"
					className="w-36"
					value={props.dateFrom ?? ""}
					onChange={(e) => navigate({ dateFrom: e.target.value || undefined })}
				/>
				<Label className="text-muted-foreground text-xs">{t("To")}</Label>
				<Input
					type="date"
					className="w-36"
					value={props.dateTo ?? ""}
					onChange={(e) => navigate({ dateTo: e.target.value || undefined })}
				/>
			</div>
			<label
				htmlFor="inline-filters-deleted"
				className="flex items-center gap-2 text-sm text-muted-foreground"
			>
				<Checkbox
					id="inline-filters-deleted"
					checked={props.deleted ?? false}
					onCheckedChange={(checked) =>
						navigate({ deleted: checked === true ? true : undefined })
					}
				/>
				{t("Show deleted?")}
			</label>
			{hasActiveFilters && (
				<Button type="button" size="sm" variant="secondary" onClick={onClear}>
					{t("Clear")}
				</Button>
			)}
		</div>
	);
};

// Mobile: a search bar that's always visible and filters as you type, plus
// a secondary sheet for the fields people reach for less often (type,
// response, date range, show deleted). Both apply immediately — no
// batching behind an Apply button.
export const MobileFilters = (props: FiltersProps) => {
	const { navigate, queryInput, setQueryInput } =
		useAppointmentLiveFilters(props);
	const [sheetOpen, setSheetOpen] = React.useState(false);
	const secondaryActive =
		!!props.type ||
		!!props.response ||
		!!props.dateFrom ||
		!!props.dateTo ||
		!!props.deleted;

	const clearSecondary = () =>
		navigate({
			dateFrom: undefined,
			dateTo: undefined,
			deleted: undefined,
			response: undefined,
			type: undefined,
		});

	// Drag-to-dismiss for the sheet's handle, same as the journal page's
	// mobile sheet: follows the pointer 1:1 while dragging, then either snaps
	// back or closes depending on how far past the threshold it was pulled.
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
								<Label htmlFor="mobile-filters-type">
									{t("Appointment type")}
								</Label>
								<Select
									value={props.type ?? "ALL"}
									onValueChange={(v) =>
										navigate({
											type:
												v === "ALL" ? undefined : (v as FiltersProps["type"]),
										})
									}
								>
									<SelectTrigger id="mobile-filters-type" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{typeOptions.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</fieldset>
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor="mobile-filters-response">{t("Response")}</Label>
								<Select
									value={props.response ?? "ALL"}
									onValueChange={(v) =>
										navigate({
											response:
												v === "ALL"
													? undefined
													: (v as FiltersProps["response"]),
										})
									}
								>
									<SelectTrigger
										id="mobile-filters-response"
										className="w-full"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{responseOptions.map((option) => (
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
								<Label htmlFor="mobile-filters-from">{t("From")}</Label>
								<Input
									id="mobile-filters-from"
									type="date"
									value={props.dateFrom ?? ""}
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
									value={props.dateTo ?? ""}
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
								checked={props.deleted ?? false}
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
