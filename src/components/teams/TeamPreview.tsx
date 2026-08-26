import { useRouter } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import { PlayerRosterRow } from "@/components/teams/PlayerRosterRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TeamDetail } from "@/hooks/useTeamDetail";
import { t } from "@/lib/text";

export function TeamPreview({ team }: { team: TeamDetail }) {
	const router = useRouter();
	const sortedPlayers = [...team.players].sort(
		(a, b) => b.player.qttr - a.player.qttr,
	);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-3">
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
				<div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground text-sm">
					<UsersIcon className="size-3.5" />
					{t("Players")} · {team.players.length}
				</div>
				{team.players.length === 0 ? (
					<div className="py-3 text-center text-muted-foreground text-sm">
						{t("No players found")}
					</div>
				) : (
					<div className="flex max-h-56 flex-col overflow-y-auto border-t border-t-border">
						{sortedPlayers.map((tp) => (
							<PlayerRosterRow
								key={tp.id}
								player={tp.player}
								variant="compact"
							/>
						))}
					</div>
				)}
			</div>

			<Button
				variant="outline"
				size="sm"
				className="w-full"
				onClick={() =>
					router.navigate({ params: { teamId: team.id }, to: "/teams/$teamId" })
				}
			>
				{t("Open team")}
			</Button>
		</div>
	);
}
