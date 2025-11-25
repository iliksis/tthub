import { useId } from "react";

type ModalProps = {
	openButtonText?: string;
	openButtonIcon?: React.ReactNode;
};

export const Modal = ({
	children,
	openButtonText,
	openButtonIcon,
}: React.PropsWithChildren<ModalProps>) => {
	const id = useId();
	const onClick = () => {
		const modal = document.querySelector<HTMLDialogElement>(`#modal_${id}`);
		if (modal) {
			modal.showModal();
		}
	};
	return (
		<>
			<button
				type="button"
				className="btn btn-primary"
				onClick={onClick}
				aria-label={openButtonText}
			>
				{openButtonIcon}
				{openButtonText ?? "Open Modal"}
			</button>
			<dialog id={`modal_${id}`} className="modal modal-bottom sm:modal-middle">
				<div className="modal-box">
					{children}
					<div className="modal-action">
						<form method="dialog">
							<button type="submit" className="btn btn-primary">
								Close
							</button>
						</form>
					</div>
				</div>
			</dialog>
		</>
	);
};
