import { Badge } from "@/components/ui/badge";
import type { Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";

export type TeamRow = Team & { _count: { players: number } };

export const TeamMeta = ({ team }: { team: TeamRow }) => (
	<>
		{team.league}
		{team.league && " · "}
		{t("{0} players", team._count.players.toString())}
	</>
);

export const TeamPlacementBadge = ({ team }: { team: TeamRow }) =>
	team.placement ? (
		<Badge variant="secondary" className="shrink-0">
			{team.placement}
		</Badge>
	) : null;
