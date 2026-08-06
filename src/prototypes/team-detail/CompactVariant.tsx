import {
	ChevronRightIcon,
	EditIcon,
	Trash2Icon,
	UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/text";
import {
	calculateAgeGroup,
	createColorForUserId,
	shortenUserName,
} from "@/lib/utils";
import { type TeamVariantProps, teamStats } from "./types";

// Axis: density/interaction — no table, a dense tappable card list with colored
// initials per player. Keeps the current breadcrumb header, optimizes for
// scanning a roster fast on mobile as well as desktop.
export function CompactVariant({
	team,
	canEdit,
	onEdit,
	onDelete,
	onPlayerClick,
}: TeamVariantProps) {
	const stats = teamStats(team);
	const sortedPlayers = [...team.players].sort((a, b) => b.qttr - a.qttr);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<span className="text-muted-foreground text-sm">{t("Teams")} /</span>
				<span className="font-semibold text-[15px]">{team.title}</span>
				<span className="text-muted-foreground text-sm">·</span>
				<span className="text-muted-foreground text-sm">
					{team.league ?? t("No league set")}
				</span>
				{team.placement && (
					<Badge variant="secondary">
						{t("Placement")} {team.placement}
					</Badge>
				)}
				<Badge variant="outline">
					{stats.playerCount} {t("Players")}
				</Badge>
				{stats.avgQttr > 0 && (
					<Badge variant="outline">Ø {stats.avgQttr} QTTR</Badge>
				)}
				{canEdit && (
					<div className="ml-auto flex gap-2">
						<Button variant="outline" size="sm" onClick={onEdit}>
							<EditIcon className="size-4" />
							{t("Update team")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
							onClick={onDelete}
						>
							<Trash2Icon className="size-4" />
							{t("Delete team")}
						</Button>
					</div>
				)}
			</div>

			{sortedPlayers.length === 0 ? (
				<div className="flex flex-col items-center gap-2 rounded-lg bg-card p-8 text-center text-muted-foreground">
					<UsersIcon className="size-5" />
					{t("No items found")}
				</div>
			) : (
				<div className="flex flex-col gap-2.5">
					{sortedPlayers.map((player) => {
						const color = createColorForUserId(player.id);
						return (
							<button
								key={player.id}
								type="button"
								onClick={() => onPlayerClick(player.id)}
								className="flex items-center gap-3 rounded-lg bg-card p-3 text-left transition-colors hover:bg-muted/50"
							>
								<div
									className="flex size-9 shrink-0 items-center justify-center rounded-full font-semibold text-xs"
									style={{
										backgroundColor: color.backgroundColor,
										color: color.foregroundColor,
									}}
								>
									{shortenUserName(player.name)}
								</div>
								<div className="min-w-0 flex-1">
									<div className="truncate font-medium text-sm">
										{player.name}
									</div>
									<div className="text-muted-foreground text-xs">
										{calculateAgeGroup(player.year)} · {player.year}
									</div>
								</div>
								<Badge variant="success">{player.qttr}</Badge>
								<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
