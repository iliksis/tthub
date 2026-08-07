import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";

type ModalProps = {
	open?: boolean;
	onClose?: () => void;
	className?: string;
	modalBoxClassName?: string;
	onRenderActionButton?: () => React.ReactNode;
	closeButtonLabel?: string;
	closeButtonClassName?: string;
	title?: string;
};

export const Modal = ({
	children,
	open,
	className,
	modalBoxClassName,
	onClose,
	onRenderActionButton,
	closeButtonLabel = t("Close"),
	closeButtonClassName,
	title,
}: React.PropsWithChildren<ModalProps>) => {
	return (
		<Dialog
			open={open ?? false}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose?.();
			}}
		>
			<DialogContent
				className={cn("flex flex-col", modalBoxClassName, className)}
			>
				<DialogTitle className={title ? undefined : "sr-only"}>
					{title ?? t("Dialog")}
				</DialogTitle>
				<div className="flex-1">{children}</div>
				<DialogFooter>
					{onRenderActionButton?.()}
					<DialogClose
						render={
							<Button variant="secondary" className={closeButtonClassName} />
						}
					>
						{closeButtonLabel}
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
