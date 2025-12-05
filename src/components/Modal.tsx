import { useId } from "react";
import { cn } from "@/lib/utils";

type ModalProps = {
	open?: boolean;
	onClose?: () => void;
	className?: string;
	modalBoxClassName?: string;
};

export const Modal = ({
	children,
	open,
	className,
	modalBoxClassName,
	onClose,
}: React.PropsWithChildren<ModalProps>) => {
	const id = useId();
	const dialogProps = open ? { open: true } : {};

	return (
		<dialog
			id={`modal_${id}`}
			className={cn("modal", className)}
			onClose={onClose}
			{...dialogProps}
		>
			<div className={cn("modal-box", modalBoxClassName)}>
				{children}
				<div className="modal-action">
					<form method="dialog">
						<button type="submit" className="btn btn-primary">
							Close
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
