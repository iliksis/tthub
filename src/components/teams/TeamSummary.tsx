import { Badge } from "@/components/ui/badge";
import type { Team } from "@/lib/prisma/client";
import type { TeamHalf } from "@/lib/prisma/enums";
import { m } from "@/paraglide/messages";

export const TeamHalfBadge = ({ half }: { half: TeamHalf | null }) =>
	half ? (
		<Badge variant="outline" className="shrink-0">
			{half === "HINRUNDE" ? m.teams_hinrunde() : m.teams_rueckrunde()}
		</Badge>
	) : null;

export type TeamRow = Team & { _count: { players: number } };

export const TeamMeta = ({ team }: { team: TeamRow }) => (
	<>
		{team.league}
		{team.league && " · "}
		{m.teams_n_players({ param1: team._count.players.toString() })}
	</>
);

export const TeamPlacementBadge = ({ team }: { team: TeamRow }) =>
	team.placement ? (
		<Badge variant="secondary" className="shrink-0">
			{team.placement}
		</Badge>
	) : null;
