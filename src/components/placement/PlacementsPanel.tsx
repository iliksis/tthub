import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { groupPlacementsByCategory } from "@/lib/placements";
import type { Placement, Player } from "@/lib/prisma/client";
import { t } from "@/lib/text";

type PlacementsPanelProps = {
	placements: (Placement & { player: Player })[];
	canEdit: boolean;
	onManage: () => void;
};

export function PlacementsPanel({
	placements,
	canEdit,
	onManage,
}: PlacementsPanelProps) {
	const grouped = groupPlacementsByCategory(placements);

	return (
		<div className="border-border/60 border-t pt-4">
			<div className="mb-3 flex items-center justify-between">
				<span className="font-bold text-sm">{t("Participants")}</span>
				{canEdit && (
					<Button type="button" variant="outline" size="sm" onClick={onManage}>
						{t("Show all")}
					</Button>
				)}
			</div>
			<div className="flex flex-col gap-4">
				{grouped.map((group) => (
					<div key={group.category}>
						<div className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">
							{group.category}
						</div>
						<div className="flex flex-col gap-1">
							{group.placements.map((p) => (
								<div
									key={p.playerId}
									className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
								>
									<Link
										to="/players/$playerId"
										params={{ playerId: p.player.id }}
									>
										{p.player.name}
									</Link>
									{p.placement ? (
										<span className="font-medium text-primary">
											{p.placement}
										</span>
									) : (
										<span className="text-muted-foreground italic">
											{t("Pending")}
										</span>
									)}
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
