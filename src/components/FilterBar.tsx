import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import type React from "react";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";

export type FilterToken = { key: string; label: string; onRemove: () => void };
export type FilterOption = { value: string; label: string };

type SegmentCommon = {
	key: string;
	label: string;
	icon?: React.ReactNode;
	align?: "start" | "end";
};

// A single-select segment: inactive when `value` equals `allValue`
// (default "ALL"), active — and contributing one removable token — for any
// other selected option.
type RadioSegment = SegmentCommon & {
	type: "radio";
	value: string;
	allValue?: string;
	options: FilterOption[];
	onChange: (value: string) => void;
};

// A multi-select segment: contributes one removable token per selected
// value; the segment itself shows a count.
type CheckboxSegment = SegmentCommon & {
	type: "checkbox";
	values: string[];
	options: FilterOption[];
	onToggle: (value: string) => void;
};

// A single boolean, toggled directly on click — no dropdown, no chevron.
type ToggleSegment = SegmentCommon & {
	type: "toggle";
	active: boolean;
	// Token text can differ from the segment's own label (e.g. segment reads
	// "Show deleted?", its token reads "Incl. deleted").
	tokenLabel?: string;
	onToggle: () => void;
};

// Escape hatch for a segment whose value isn't a plain option list (e.g. a
// numeric min/max range): the caller renders the dropdown content and
// computes its own tokens, everything else (trigger chrome, active state,
// positioning) still comes from the shared shell.
type CustomSegment = SegmentCommon & {
	type: "custom";
	active: boolean;
	valueLabel?: string;
	tokens?: FilterToken[];
	contentClassName?: string;
	children: React.ReactNode;
};

export type FilterBarSegment =
	| RadioSegment
	| CheckboxSegment
	| ToggleSegment
	| CustomSegment;

function segmentTokens(segment: FilterBarSegment): FilterToken[] {
	switch (segment.type) {
		case "radio": {
			const allValue = segment.allValue ?? "ALL";
			if (segment.value === allValue) return [];
			const option = segment.options.find((o) => o.value === segment.value);
			return option
				? [
						{
							key: segment.key,
							label: option.label,
							onRemove: () => segment.onChange(allValue),
						},
					]
				: [];
		}
		case "checkbox":
			return segment.values.flatMap((value) => {
				const option = segment.options.find((o) => o.value === value);
				return option
					? [
							{
								key: `${segment.key}-${value}`,
								label: option.label,
								onRemove: () => segment.onToggle(value),
							},
						]
					: [];
			});
		case "toggle":
			return segment.active
				? [
						{
							key: segment.key,
							label: segment.tokenLabel ?? segment.label,
							onRemove: segment.onToggle,
						},
					]
				: [];
		case "custom":
			return segment.tokens ?? [];
	}
}

function SegmentTrigger({
	active,
	icon,
	chevron = true,
	className,
	children,
	...props
}: React.ComponentPropsWithoutRef<"button"> & {
	active: boolean;
	icon?: React.ReactNode;
	chevron?: boolean;
}) {
	return (
		<button
			type="button"
			className={cn(
				"flex h-9 items-center gap-1.5 px-3 text-sm transition-colors",
				active
					? "bg-primary/10 font-medium text-primary"
					: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
				className,
			)}
			{...props}
		>
			{icon}
			{children}
			{chevron && <ChevronDownIcon className="size-3.5" />}
		</button>
	);
}

function FilterBarSegmentButton({ segment }: { segment: FilterBarSegment }) {
	if (segment.type === "toggle") {
		return (
			<SegmentTrigger
				active={segment.active}
				icon={segment.icon}
				chevron={false}
				onClick={segment.onToggle}
			>
				{segment.label}
			</SegmentTrigger>
		);
	}

	const active =
		segment.type === "radio"
			? segment.value !== (segment.allValue ?? "ALL")
			: segment.type === "checkbox"
				? segment.values.length > 0
				: segment.active;

	const valueLabel =
		segment.type === "radio"
			? active
				? segment.options.find((o) => o.value === segment.value)?.label
				: undefined
			: segment.type === "checkbox"
				? segment.values.length > 0
					? String(segment.values.length)
					: undefined
				: segment.valueLabel;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<SegmentTrigger active={active} icon={segment.icon} />}
			>
				{segment.label}
				{valueLabel && (
					<span className="max-w-28 truncate">: {valueLabel}</span>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={segment.align ?? "start"}
				className={
					segment.type === "custom"
						? (segment.contentClassName ?? "w-56")
						: "w-52"
				}
			>
				{segment.type === "radio" && (
					<DropdownMenuRadioGroup
						value={segment.value}
						onValueChange={(v) =>
							segment.onChange(v || (segment.allValue ?? "ALL"))
						}
					>
						{segment.options.map((option) => (
							<DropdownMenuRadioItem key={option.value} value={option.value}>
								{option.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				)}
				{segment.type === "checkbox" &&
					segment.options.map((option) => (
						<DropdownMenuCheckboxItem
							key={option.value}
							checked={segment.values.includes(option.value)}
							onCheckedChange={() => segment.onToggle(option.value)}
						>
							{option.label}
						</DropdownMenuCheckboxItem>
					))}
				{segment.type === "custom" && segment.children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

const FilterBarResetButton = ({ onReset }: { onReset: () => void }) => {
	return (
		<button
			type="button"
			className="flex h-9 items-center gap-1.5 px-3 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
			onClick={onReset}
			aria-label={t("Clear")}
		>
			<XIcon size="16" />
		</button>
	);
};

// A segmented filter toolbar: a bordered strip of hairline-divided zones —
// search, then one per filter dimension — each showing its current value
// inline so state is visible without opening anything. Pass a declarative
// `segments` list (radio / checkbox / toggle / custom); the bar owns the
// dropdown wiring, active-state styling, and the removable-token row below
// (a segment can't show per-value removal on its own, e.g. a multi-select
// or a min/max range). Shared by the players and appointments list pages.
export function FilterBar({
	search,
	segments,
	onReset,
	className,
}: {
	search: {
		value: string;
		onChange: (value: string) => void;
		placeholder: string;
	};
	segments: FilterBarSegment[];
	// Clears every filter (including the search text) in one shot — wire it
	// to the same handler a page's "clear all" link would use, not a sweep
	// over individual token removals, since those are separate navigations
	// and would only leave the last one applied.
	onReset: () => void;
	className?: string;
}) {
	const tokens = segments.flatMap(segmentTokens);

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			<div className="flex flex-wrap items-stretch overflow-hidden border border-border [&>*:not(:last-child)]:border-border [&>*:not(:last-child)]:border-r">
				<div className="flex min-w-48 flex-1 items-center gap-2 px-3">
					<SearchIcon className="size-4 shrink-0 text-muted-foreground" />
					<Input
						className="h-9 w-full border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
						placeholder={search.placeholder}
						value={search.value}
						onChange={(e) => search.onChange(e.target.value)}
					/>
				</div>
				{segments.map((segment) => (
					<FilterBarSegmentButton key={segment.key} segment={segment} />
				))}
				{tokens.length > 0 && <FilterBarResetButton onReset={onReset} />}
			</div>
			{/* {tokens.length > 0 && (
				<div className="flex flex-wrap items-center gap-1.5">
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
								<XIcon size="16" />
							</button>
						</Badge>
					))}
				</div>
			)} */}
		</div>
	);
}
