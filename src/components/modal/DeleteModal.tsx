import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
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
					<Button type="button" variant="destructive" onClick={onDelete}>
						{m.common_delete()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
