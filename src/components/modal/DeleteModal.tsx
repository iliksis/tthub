import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/lib/text";

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
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose();
			}}
		>
			<DialogContent showCloseButton={false}>
				<DialogTitle className="sr-only">{t("Dialog")}</DialogTitle>
				<DialogDescription>{label}</DialogDescription>
				<DialogFooter>
					<DialogClose render={<Button type="button" variant="outline" />}>
						{t("Close")}
					</DialogClose>
					<Button type="button" variant="destructive" onClick={onDelete}>
						{t("Delete")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
