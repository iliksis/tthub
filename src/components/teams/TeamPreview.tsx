import { Link } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link as EntityLink } from "@/components/ui/link";
import type { TeamDetail } from "@/hooks/useTeamDetail";
import { t } from "@/lib/text";
import { calculateAgeGroup, createColorForUserId } from "@/lib/utils";

export function TeamPreview({ team }: { team: TeamDetail }) {
	const color = createColorForUserId(team.id);
	const sortedPlayers = [...team.players].sort((a, b) => b.qttr - a.qttr);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-3">
				<div
					className="flex size-11 shrink-0 items-center justify-center rounded-xl font-bold text-sm"
					style={{
						backgroundColor: color.backgroundColor,
						color: color.foregroundColor,
					}}
				>
					{team.title.slice(0, 2).toUpperCase()}
				</div>
				<div className="min-w-0 flex-1">
					<div className="truncate font-semibold text-sm">{team.title}</div>
					<div className="truncate text-muted-foreground text-xs">
						{team.league || "–"}
					</div>
				</div>
				{team.placement && (
					<Badge variant="secondary" className="shrink-0">
						{team.placement}
					</Badge>
				)}
			</div>

			<div>
				<div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground text-xs uppercase">
					<UsersIcon className="size-3.5" />
					{t("Players")} · {team.players.length}
				</div>
				{team.players.length === 0 ? (
					<div className="py-3 text-center text-muted-foreground text-sm">
						{t("No players found")}
					</div>
				) : (
					<div className="flex max-h-56 flex-col overflow-y-auto rounded-md border p-1">
						{sortedPlayers.map((player) => (
							<EntityLink
								key={player.id}
								to="/players/$playerId"
								params={{ playerId: player.id }}
								className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm no-underline hover:bg-muted/60 hover:no-underline"
							>
								<span className="min-w-0 flex-1 truncate">{player.name}</span>
								<span className="shrink-0 text-muted-foreground text-xs">
									{calculateAgeGroup(player.year)}
								</span>
								<span className="shrink-0 font-medium text-xs">
									{player.qttr}
								</span>
							</EntityLink>
						))}
					</div>
				)}
			</div>

			<Button asChild variant="outline" size="sm" className="w-full">
				<Link to="/teams/$teamId" params={{ teamId: team.id }}>
					{t("Open team")}
				</Link>
			</Button>
		</div>
	);
}
