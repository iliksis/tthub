"use client";

import {
	SelectContent as SelectContentPrimitive,
	SelectGroupLabel,
	SelectGroup as SelectGroupPrimitive,
	SelectItemIndicator,
	SelectItem as SelectItemPrimitive,
	Select as SelectPrimitive,
	SelectSeparator as SelectSeparatorPrimitive,
	SelectTrigger as SelectTriggerPrimitive,
	SelectValue as SelectValuePrimitive,
} from "@ui-sdk/react/select";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive;

function SelectGroup({
	className,
	...props
}: React.ComponentProps<typeof SelectGroupPrimitive>) {
	return (
		<SelectGroupPrimitive
			data-slot="select-group"
			className={cn("scroll-my-1 p-1", className)}
			{...props}
		/>
	);
}

function SelectValue({
	className,
	...props
}: React.ComponentProps<typeof SelectValuePrimitive>) {
	return (
		<SelectValuePrimitive
			data-slot="select-value"
			className={cn("flex flex-1 text-left", className)}
			{...props}
		/>
	);
}

function SelectTrigger({
	className,
	size = "default",
	children,
	...props
}: React.ComponentProps<typeof SelectTriggerPrimitive> & {
	size?: "sm" | "default";
}) {
	return (
		<SelectTriggerPrimitive
			data-slot="select-trigger"
			data-size={size}
			className={cn(
				"flex w-fit items-center justify-between gap-2 rounded-lg border border-input bg-transparent py-2 pr-2 pl-3 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			{(state) => (
				<>
					{typeof children === "function" ? children(state) : children}
					<ChevronDownIcon
						aria-hidden="true"
						className="pointer-events-none size-4 text-muted-foreground"
					/>
				</>
			)}
		</SelectTriggerPrimitive>
	);
}

// ui-sdk renders the popup in the top layer, so no portal/container is needed inside dialogs.
function SelectContent({
	className,
	side = "bottom",
	sideOffset = 4,
	align = "center",
	alignItemWithTrigger = true,
	...props
}: React.ComponentProps<typeof SelectContentPrimitive>) {
	return (
		<SelectContentPrimitive
			data-slot="select-content"
			side={side}
			sideOffset={sideOffset}
			align={align}
			alignItemWithTrigger={alignItemWithTrigger}
			className={cn(
				"z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 transition-[opacity,scale] duration-100 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
				className,
			)}
			{...props}
		/>
	);
}

function SelectLabel({
	className,
	...props
}: React.ComponentProps<typeof SelectGroupLabel>) {
	return (
		<SelectGroupLabel
			data-slot="select-label"
			className={cn("px-2 py-1 text-xs text-muted-foreground", className)}
			{...props}
		/>
	);
}

function SelectItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof SelectItemPrimitive>) {
	return (
		<SelectItemPrimitive
			data-slot="select-item"
			className={cn(
				"relative flex w-full cursor-default items-center gap-2 rounded-md py-1 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			{(state) => (
				<>
					{typeof children === "function" ? children(state) : children}
					<SelectItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
						<CheckIcon className="pointer-events-none" />
					</SelectItemIndicator>
				</>
			)}
		</SelectItemPrimitive>
	);
}

function SelectSeparator({
	className,
	...props
}: React.ComponentProps<typeof SelectSeparatorPrimitive>) {
	return (
		<SelectSeparatorPrimitive
			data-slot="select-separator"
			className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
			{...props}
		/>
	);
}

export {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
};
