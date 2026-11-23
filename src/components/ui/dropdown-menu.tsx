"use client";

import {
	MenuCheckboxItem,
	MenuContent,
	MenuGroup,
	MenuGroupLabel,
	MenuItem,
	MenuItemIndicator,
	Menu as MenuPrimitive,
	MenuRadioGroup,
	MenuRadioItem,
	MenuSeparator,
	MenuSub,
	MenuSubContent,
	MenuSubTrigger,
	MenuTrigger,
} from "@ui-sdk/react/menu";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

const popupClass =
	"z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 transition-[opacity,scale] duration-100 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0";

const itemClass =
	"relative flex cursor-default items-center gap-2 rounded-md px-2 py-1 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-inset:pl-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const selectableItemClass = cn(itemClass, "pr-8");

function DropdownMenu({
	...props
}: React.ComponentProps<typeof MenuPrimitive>) {
	return <MenuPrimitive {...props} />;
}

function DropdownMenuTrigger({
	...props
}: React.ComponentProps<typeof MenuTrigger>) {
	return <MenuTrigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
	align = "start",
	side = "bottom",
	sideOffset = 4,
	className,
	...props
}: React.ComponentProps<typeof MenuContent>) {
	return (
		<MenuContent
			data-slot="dropdown-menu-content"
			align={align}
			side={side}
			sideOffset={sideOffset}
			className={cn(popupClass, className)}
			{...props}
		/>
	);
}

function DropdownMenuGroup({
	...props
}: React.ComponentProps<typeof MenuGroup>) {
	return <MenuGroup data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuLabel({
	className,
	inset,
	...props
}: React.ComponentProps<typeof MenuGroupLabel> & { inset?: boolean }) {
	return (
		<MenuGroupLabel
			data-slot="dropdown-menu-label"
			data-inset={inset ? "" : undefined}
			className={cn(
				"px-2 py-1 text-xs font-medium text-muted-foreground data-inset:pl-8",
				className,
			)}
			{...props}
		/>
	);
}

function DropdownMenuItem({
	className,
	inset,
	variant = "default",
	...props
}: React.ComponentProps<typeof MenuItem> & {
	inset?: boolean;
	variant?: "default" | "destructive";
}) {
	return (
		<MenuItem
			data-slot="dropdown-menu-item"
			data-inset={inset ? "" : undefined}
			data-variant={variant}
			className={cn(
				itemClass,
				"not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 data-[variant=destructive]:*:[svg]:text-destructive",
				className,
			)}
			{...props}
		/>
	);
}

function DropdownMenuSub({ ...props }: React.ComponentProps<typeof MenuSub>) {
	return <MenuSub {...props} />;
}

function DropdownMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: Omit<React.ComponentProps<typeof MenuSubTrigger>, "children"> & {
	children?: React.ReactNode;
	inset?: boolean;
}) {
	return (
		<MenuSubTrigger
			data-slot="dropdown-menu-sub-trigger"
			data-inset={inset ? "" : undefined}
			className={cn(
				itemClass,
				"data-popup-open:bg-accent data-popup-open:text-accent-foreground",
				className,
			)}
			{...props}
		>
			{children}
			<ChevronRightIcon className="ml-auto" aria-hidden="true" />
		</MenuSubTrigger>
	);
}

function DropdownMenuSubContent({
	align = "start",
	alignOffset = -3,
	side = "right",
	sideOffset = 0,
	className,
	...props
}: React.ComponentProps<typeof MenuSubContent>) {
	return (
		<MenuSubContent
			data-slot="dropdown-menu-sub-content"
			className={cn(popupClass, "w-auto min-w-[96px] shadow-lg", className)}
			align={align}
			alignOffset={alignOffset}
			side={side}
			sideOffset={sideOffset}
			{...props}
		/>
	);
}

function DropdownMenuCheckboxItem({
	className,
	children,
	inset,
	...props
}: Omit<React.ComponentProps<typeof MenuCheckboxItem>, "children"> & {
	children?: React.ReactNode;
	inset?: boolean;
}) {
	return (
		<MenuCheckboxItem
			data-slot="dropdown-menu-checkbox-item"
			data-inset={inset ? "" : undefined}
			className={cn(
				selectableItemClass,
				"data-highlighted:**:text-accent-foreground",
				className,
			)}
			{...props}
		>
			<span
				className="pointer-events-none absolute right-2 flex items-center justify-center"
				data-slot="dropdown-menu-checkbox-item-indicator"
			>
				<MenuItemIndicator>
					<CheckIcon aria-hidden="true" />
				</MenuItemIndicator>
			</span>
			{children}
		</MenuCheckboxItem>
	);
}

function DropdownMenuRadioGroup({
	...props
}: React.ComponentProps<typeof MenuRadioGroup>) {
	return <MenuRadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
	className,
	children,
	inset,
	...props
}: Omit<React.ComponentProps<typeof MenuRadioItem>, "children"> & {
	children?: React.ReactNode;
	inset?: boolean;
}) {
	return (
		<MenuRadioItem
			data-slot="dropdown-menu-radio-item"
			data-inset={inset ? "" : undefined}
			className={cn(
				selectableItemClass,
				"data-highlighted:**:text-accent-foreground",
				className,
			)}
			{...props}
		>
			<span
				className="pointer-events-none absolute right-2 flex items-center justify-center"
				data-slot="dropdown-menu-radio-item-indicator"
			>
				<MenuItemIndicator>
					<CheckIcon aria-hidden="true" />
				</MenuItemIndicator>
			</span>
			{children}
		</MenuRadioItem>
	);
}

function DropdownMenuSeparator({
	className,
	...props
}: React.ComponentProps<typeof MenuSeparator>) {
	return (
		<MenuSeparator
			data-slot="dropdown-menu-separator"
			className={cn("-mx-1 my-1 h-px bg-border", className)}
			{...props}
		/>
	);
}

function DropdownMenuShortcut({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="dropdown-menu-shortcut"
			className={cn(
				"ml-auto text-xs text-muted-foreground group-data-highlighted/dropdown-menu-item:text-accent-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
};
