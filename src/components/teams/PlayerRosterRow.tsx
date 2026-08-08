import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link as EntityLink } from "@/components/ui/link";
import {
	calculateAgeGroup,
	createColorForUserId,
	shortenUserName,
} from "@/lib/utils";

type RosterPlayer = {
	id: string;
	name: string;
	year: number;
	qttr: number;
};

/**
 * A single player row for a team roster list. `variant="compact"` is a dense
 * text-only row (split-view preview panel); `variant="card"` is the larger
 * avatar+badge card used on mobile team detail.
 */
export function PlayerRosterRow({
	player,
	variant = "card",
}: {
	player: RosterPlayer;
	variant?: "card" | "compact";
}) {
	if (variant === "compact") {
		return (
			<EntityLink
				to="/players/$playerId"
				params={{ playerId: player.id }}
				className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm no-underline hover:bg-muted/60 hover:no-underline"
			>
				<span className="min-w-0 flex-1 truncate">{player.name}</span>
				<span className="shrink-0 text-muted-foreground text-xs">
					{calculateAgeGroup(player.year)}
				</span>
				<span className="shrink-0 font-medium text-xs">{player.qttr}</span>
			</EntityLink>
		);
	}

	const color = createColorForUserId(player.id);
	return (
		<Link
			to="/players/$playerId"
			params={{ playerId: player.id }}
			className="flex items-center gap-3 rounded-lg bg-card p-3 text-left no-underline transition-colors hover:bg-muted/50 hover:no-underline"
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
				<div className="truncate font-medium text-sm">{player.name}</div>
				<div className="text-muted-foreground text-xs">
					{calculateAgeGroup(player.year)} · {player.year}
				</div>
			</div>
			<Badge variant="success">{player.qttr}</Badge>
			<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
		</Link>
	);
}
