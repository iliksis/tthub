import { ConfirmModal } from "@/components/modal/ConfirmModal";
import { m } from "@/paraglide/messages";

type RestoreModalProps = {
	label: string;
	open: boolean;
	onClose: () => void;
	onRestore: () => void;
};

export const RestoreModal = ({
	label,
	open,
	onClose,
	onRestore,
}: RestoreModalProps) => {
	return (
		<ConfirmModal
			label={label}
			open={open}
			onClose={onClose}
			onConfirm={onRestore}
			confirmLabel={m.common_restore()}
		/>
	);
};
