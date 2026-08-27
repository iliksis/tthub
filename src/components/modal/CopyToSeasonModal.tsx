import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
import { EntitySelect } from "@/components/ui/entity-select";
import { Label } from "@/components/ui/label";
import type { Season } from "@/lib/prisma/client";
import { m } from "@/paraglide/messages";

type CopyToSeasonModalProps = {
	open: boolean;
	seasons: Season[];
	targetSeasonId: string | undefined;
	onTargetSeasonChange: (seasonId: string) => void;
	label: string;
	onClose: () => void;
	onCopy: () => void;
};

export const CopyToSeasonModal = ({
	open,
	seasons,
	targetSeasonId,
	onTargetSeasonChange,
	label,
	onClose,
	onCopy,
}: CopyToSeasonModalProps) => {
	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose();
			}}
		>
			<DialogContent showCloseButton={false}>
				<DialogTitle>{m.appointments_copy_to_season_title()}</DialogTitle>
				<DialogDescription>{label}</DialogDescription>
				<fieldset className="flex flex-col gap-1.5">
					<Label htmlFor="target-season">
						{m.appointments_target_season()}
					</Label>
					<EntitySelect
						id="target-season"
						items={seasons}
						value={targetSeasonId}
						onValueChange={(value) => {
							if (value) onTargetSeasonChange(value);
						}}
					/>
				</fieldset>
				<DialogFooter>
					<DialogClose render={<Button type="button" variant="outline" />}>
						{m.common_close()}
					</DialogClose>
					<Button type="button" disabled={!targetSeasonId} onClick={onCopy}>
						{m.appointments_copy()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
