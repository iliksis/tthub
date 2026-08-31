import { ConfirmModal } from "@/components/modal/ConfirmModal";
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
		<ConfirmModal
			label={label}
			open={open}
			onClose={onClose}
			onConfirm={onCopy}
			confirmLabel={m.appointments_copy()}
			confirmDisabled={!targetSeasonId}
			title={m.appointments_copy_to_season_title()}
		>
			<fieldset className="flex flex-col gap-1.5">
				<Label htmlFor="target-season">{m.appointments_target_season()}</Label>
				<EntitySelect
					id="target-season"
					items={seasons}
					value={targetSeasonId}
					onValueChange={(value) => {
						if (value) onTargetSeasonChange(value);
					}}
				/>
			</fieldset>
		</ConfirmModal>
	);
};
