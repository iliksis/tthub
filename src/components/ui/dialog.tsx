import {
	DialogBackdrop,
	DialogClose as DialogClosePrimitive,
	DialogContent as DialogContentPrimitive,
	DialogDescription as DialogDescriptionPrimitive,
	Dialog as DialogPrimitive,
	DialogTitle as DialogTitlePrimitive,
	DialogTrigger as DialogTriggerPrimitive,
} from "@ui-sdk/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

// shortcut: ui-sdk dialogs live in the top layer, so base-ui popups (select) must portal into them. Remove once select/dropdown move to ui-sdk (#164, #163).
const DialogContainerContext = React.createContext<HTMLElement | null>(null);
const useDialogContainer = () => React.useContext(DialogContainerContext);

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive>) {
	return <DialogPrimitive {...props} />;
}

function DialogTrigger({
	...props
}: React.ComponentProps<typeof DialogTriggerPrimitive>) {
	return <DialogTriggerPrimitive data-slot="dialog-trigger" {...props} />;
}

function DialogClose({
	...props
}: React.ComponentProps<typeof DialogClosePrimitive>) {
	return <DialogClosePrimitive data-slot="dialog-close" {...props} />;
}

function DialogContent({
	className,
	children,
	showCloseButton = true,
	...props
}: Omit<React.ComponentProps<typeof DialogContentPrimitive>, "children"> & {
	children?: React.ReactNode;
	showCloseButton?: boolean;
}) {
	const [container, setContainer] = React.useState<HTMLElement | null>(null);
	return (
		<>
			<DialogBackdrop
				data-slot="dialog-overlay"
				className="fixed inset-0 isolate z-50 bg-black/10 transition-opacity duration-100 supports-backdrop-filter:backdrop-blur-xs data-ending-style:opacity-0 data-starting-style:opacity-0"
			/>
			<DialogContentPrimitive
				ref={setContainer}
				data-slot="dialog-content"
				className={cn(
					"fixed inset-0 z-50 m-auto grid h-fit max-h-[calc(100%-2rem)] w-full max-w-[calc(100%-2rem)] gap-4 overflow-y-auto rounded-xl border-0 bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 transition-[opacity,scale] duration-100 outline-none backdrop:bg-transparent sm:max-w-sm data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
					className,
				)}
				{...props}
			>
				<DialogContainerContext value={container}>
					{children}
				</DialogContainerContext>
				{showCloseButton && (
					<DialogClosePrimitive
						data-slot="dialog-close"
						render={
							<Button
								variant="ghost"
								className="absolute top-2 right-2"
								size="icon-sm"
							/>
						}
					>
						<XIcon />
						<span className="sr-only">{m.common_close()}</span>
					</DialogClosePrimitive>
				)}
			</DialogContentPrimitive>
		</>
	);
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-header"
			className={cn("flex flex-col gap-2", className)}
			{...props}
		/>
	);
}

function DialogFooter({
	className,
	showCloseButton = false,
	children,
	...props
}: React.ComponentProps<"div"> & {
	showCloseButton?: boolean;
}) {
	return (
		<div
			data-slot="dialog-footer"
			className={cn(
				"-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
				className,
			)}
			{...props}
		>
			{children}
			{showCloseButton && (
				<DialogClosePrimitive render={<Button variant="outline" />}>
					{m.common_close()}
				</DialogClosePrimitive>
			)}
		</div>
	);
}

function DialogTitle({
	className,
	...props
}: React.ComponentProps<typeof DialogTitlePrimitive>) {
	return (
		<DialogTitlePrimitive
			data-slot="dialog-title"
			className={cn("text-base leading-none font-medium", className)}
			{...props}
		/>
	);
}

function DialogDescription({
	className,
	...props
}: React.ComponentProps<typeof DialogDescriptionPrimitive>) {
	return (
		<DialogDescriptionPrimitive
			data-slot="dialog-description"
			className={cn(
				"text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	useDialogContainer,
};
