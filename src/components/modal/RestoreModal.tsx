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
					<Button type="button" onClick={onRestore}>
						{m.common_restore()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
