import { Button } from "@/components/ui/button";
import { t } from "@/lib/text";
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
			className="text-warning-foreground"
			modalBoxClassName="bg-warning"
			onRenderActionButton={() => (
				<Button type="button" variant="destructive" onClick={onDelete}>
					{t("Delete")}
				</Button>
			)}
		>
			<p>{label}</p>
		</Modal>
	);
};
