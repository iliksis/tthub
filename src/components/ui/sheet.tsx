import {
	DialogBackdrop,
	DialogClose as SheetClosePrimitive,
	DialogContent as SheetContentPrimitive,
	DialogDescription as SheetDescriptionPrimitive,
	Dialog as SheetPrimitive,
	DialogTitle as SheetTitlePrimitive,
	DialogTrigger as SheetTriggerPrimitive,
} from "@ui-sdk/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { DialogContainerContext } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive>) {
	return <SheetPrimitive {...props} />;
}

function SheetTrigger({
	...props
}: React.ComponentProps<typeof SheetTriggerPrimitive>) {
	return <SheetTriggerPrimitive data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
	...props
}: React.ComponentProps<typeof SheetClosePrimitive>) {
	return <SheetClosePrimitive data-slot="sheet-close" {...props} />;
}

function SheetContent({
	className,
	children,
	side = "right",
	showCloseButton = true,
	...props
}: Omit<React.ComponentProps<typeof SheetContentPrimitive>, "children"> & {
	children?: React.ReactNode;
	side?: "top" | "right" | "bottom" | "left";
	showCloseButton?: boolean;
}) {
	const [container, setContainer] = React.useState<HTMLElement | null>(null);
	return (
		<>
			<DialogBackdrop
				data-slot="sheet-overlay"
				className="fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs"
			/>
			<SheetContentPrimitive
				ref={setContainer}
				data-slot="sheet-content"
				data-side={side}
				className={cn(
					"fixed z-50 m-0 flex max-h-none max-w-none flex-col gap-4 border-0 bg-popover bg-clip-padding p-0 text-sm text-popover-foreground shadow-lg outline-none transition duration-200 ease-in-out backdrop:bg-transparent data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:top-auto data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:w-full data-[side=bottom]:data-ending-style:translate-y-10 data-[side=bottom]:data-starting-style:translate-y-10 data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:-translate-x-10 data-[side=left]:data-starting-style:-translate-x-10 data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:left-auto data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-10 data-[side=right]:data-starting-style:translate-x-10 data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:w-full data-[side=top]:border-b data-[side=top]:data-ending-style:-translate-y-10 data-[side=top]:data-starting-style:-translate-y-10 data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
					className,
				)}
				{...props}
			>
				<DialogContainerContext value={container}>
					{children}
				</DialogContainerContext>
				{showCloseButton && (
					<SheetClosePrimitive
						data-slot="sheet-close"
						render={
							<Button
								variant="ghost"
								className="absolute top-3 right-3"
								size="icon-sm"
							/>
						}
					>
						<XIcon />
						<span className="sr-only">{m.common_close()}</span>
					</SheetClosePrimitive>
				)}
			</SheetContentPrimitive>
		</>
	);
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-header"
			className={cn("flex flex-col gap-0.5 p-4", className)}
			{...props}
		/>
	);
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-footer"
			className={cn("mt-auto flex flex-col gap-2 p-4", className)}
			{...props}
		/>
	);
}

function SheetTitle({
	className,
	...props
}: React.ComponentProps<typeof SheetTitlePrimitive>) {
	return (
		<SheetTitlePrimitive
			data-slot="sheet-title"
			className={cn("text-base font-medium text-foreground", className)}
			{...props}
		/>
	);
}

function SheetDescription({
	className,
	...props
}: React.ComponentProps<typeof SheetDescriptionPrimitive>) {
	return (
		<SheetDescriptionPrimitive
			data-slot="sheet-description"
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}

export {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
};
