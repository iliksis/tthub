import { Link } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";
import { TeamMeta, TeamPlacementBadge, type TeamRow } from "./TeamSummary";

type ListProps = {
	teams: TeamRow[];
};

// Mobile list: a joined row per team, styled after the appointments page's
// mobile row list. Tapping a row navigates straight to the team — there's no
// selection step to pass through first. Unlike appointments (grouped by
// month), teams aren't grouped — league names have no reliable sort order to
// group/order sections by.
export const List = ({ teams }: ListProps) => {
	if (teams.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{m.common_no_teams_found()}
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			{teams.map((team) => (
				<Link
					key={team.id}
					to="/teams/$teamId"
					params={{ teamId: team.id }}
					className="flex w-full items-center justify-between gap-3 border-b border-b-border py-3.5 text-left last:border-b-0"
				>
					<div className="min-w-0 flex-1">
						<div className="min-w-[6ch] truncate font-medium text-sm">
							{team.title}
						</div>
						<div className="truncate text-muted-foreground text-xs">
							<TeamMeta team={team} />
						</div>
					</div>
					<TeamPlacementBadge team={team} />
				</Link>
			))}
		</div>
	);
};
