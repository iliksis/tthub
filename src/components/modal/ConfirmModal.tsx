import type { VariantProps } from "class-variance-authority";
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
};

export const ConfirmModal = ({
	label,
	open,
	onClose,
	onConfirm,
	confirmLabel,
	confirmVariant,
}: ConfirmModalProps) => {
	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose();
			}}
		>
			<DialogContent showCloseButton={false}>
				<DialogTitle className="sr-only">{m.common_dialog()}</DialogTitle>
				<DialogDescription>{label}</DialogDescription>
				<DialogFooter>
					<DialogClose render={<Button type="button" variant="outline" />}>
						{m.common_close()}
					</DialogClose>
					<Button type="button" variant={confirmVariant} onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
