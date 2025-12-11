import { Modal } from "./Modal";

type DeleteModalProps = {
	label: string;
	open: boolean;
	onClose: () => void;
	onDelete: () => void;
};

export const DeleteModal = ({
	label,
	open,
	onClose,
	onDelete,
}: DeleteModalProps) => {
	return (
		<Modal
			open={open}
			onClose={onClose}
			className="text-warning-content"
			modalBoxClassName="bg-warning"
			onRenderActionButton={() => (
				<button type="button" className="btn btn-error" onClick={onDelete}>
					Delete
				</button>
			)}
		>
			<p>{label}</p>
		</Modal>
	);
};
