import { Link } from "@tanstack/react-router";
import { t } from "@/lib/text";
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
				{t("No teams found")}
			</div>
		);
	}

	return (
		<div className="flex flex-col rounded-lg bg-card">
			{teams.map((team) => (
				<Link
					key={team.id}
					to="/teams/$teamId"
					params={{ teamId: team.id }}
					className="flex w-full items-center justify-between gap-3 border-border/60 border-b py-3.5 px-3 text-left first:rounded-t-lg last:border-b-0 last:rounded-b-lg"
				>
					<div className="min-w-0 flex-1">
						<div className="truncate font-medium text-sm">{team.title}</div>
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
