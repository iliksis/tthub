import { useId } from "react";
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
}: React.PropsWithChildren<ModalProps>) => {
	const id = useId();
	const dialogProps = open ? { open: true } : {};

	if (!open) return null;

	return (
		<dialog
			id={`modal_${id}`}
			className={cn("modal", className)}
			onClose={onClose}
			{...dialogProps}
		>
			<div className={cn("modal-box flex flex-col", modalBoxClassName)}>
				<div className="flex-1">{children}</div>
				<div className="modal-action shrink">
					<form method="dialog" className="flex gap-2">
						{onRenderActionButton?.()}
						<button
							type="submit"
							className={cn("btn btn-secondary", closeButtonClassName)}
						>
							{closeButtonLabel}
						</button>
					</form>
				</div>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="submit">close</button>
			</form>
		</dialog>
	);
};
