import { ConfirmModal } from "@/components/modal/ConfirmModal";
import { m } from "@/paraglide/messages";

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
		<ConfirmModal
			label={label}
			open={open}
			onClose={onClose}
			onConfirm={onDelete}
			confirmLabel={m.common_delete()}
			confirmVariant="destructive"
		/>
	);
};
