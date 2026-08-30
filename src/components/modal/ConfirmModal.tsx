import type { VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
import { m } from "@/paraglide/messages";

type ConfirmModalProps = {
	label: string;
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
	confirmLabel: string;
	confirmVariant?: VariantProps<typeof buttonVariants>["variant"];
	confirmDisabled?: boolean;
	// A visible heading, for a modal whose body has other content besides the
	// confirmation text (e.g. a form field) — omit for the plain sr-only
	// title used by simple yes/no confirmations.
	title?: string;
	children?: ReactNode;
};

export const ConfirmModal = ({
	label,
	open,
	onClose,
	onConfirm,
	confirmLabel,
	confirmVariant,
	confirmDisabled,
	title,
	children,
}: ConfirmModalProps) => {
	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose();
			}}
		>
			<DialogContent showCloseButton={false}>
				{title ? (
					<DialogTitle>{title}</DialogTitle>
				) : (
					<DialogTitle className="sr-only">{m.common_dialog()}</DialogTitle>
				)}
				<DialogDescription>{label}</DialogDescription>
				{children}
				<DialogFooter>
					<DialogClose render={<Button type="button" variant="outline" />}>
						{m.common_close()}
					</DialogClose>
					<Button
						type="button"
						variant={confirmVariant}
						disabled={confirmDisabled}
						onClick={onConfirm}
					>
						{confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
