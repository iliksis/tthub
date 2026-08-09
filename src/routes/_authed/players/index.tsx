import { createFileRoute } from "@tanstack/react-router";
import { getPlayers } from "@/api/players";
import { getTeams } from "@/api/teams";
import { CreatePlayer } from "@/components/players/CreatePlayer";
import {
	applyPlayerFilters,
	filterSchema,
	InlinePlayerFilters,
	MobilePlayerFilters,
} from "@/components/players/Filters";
import { List } from "@/components/players/List";
import {
	TeamMeta,
	TeamPlacementBadge,
	type TeamRow,
} from "@/components/teams/TeamSummary";
import { Link } from "@/components/ui/link";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/players/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: t("Players") }],
	}),
	loader: async () => {
		const [playersRes, teamsRes] = await Promise.all([
			getPlayers(),
			getTeams(),
		]);
		return { players: playersRes.data, teams: teamsRes.data };
	},
	validateSearch: filterSchema,
});

function RouteComponent() {
	const { players, teams } = Route.useLoaderData();
	const search = Route.useSearch();

	if (!players) return <div>{t("An Error occurred")}</div>;

	const filteredPlayers = applyPlayerFilters(players, search);

	return (
		<>
			{/* Mobile / tablet layout */}
			<div className="lg:hidden">
				<MobilePlayerFilters {...search} teams={teams ?? []} />
				<List players={filteredPlayers} />
				<CreatePlayer />
			</div>

			{/* Desktop layout: data-dense split view */}
			<div className="hidden lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
				<div className="min-w-0">
					<div className="mb-3 flex items-center gap-3">
						<h1 className="font-bold flex-1">
							{t("Players")}{" "}
							<span className="font-normal text-muted-foreground">
								· {filteredPlayers.length} / {players.length}
							</span>
						</h1>
						<CreatePlayer />
					</div>
					<div className="mb-3 rounded-lg bg-card p-3">
						<InlinePlayerFilters {...search} teams={teams ?? []} />
					</div>
					<List players={filteredPlayers} />
				</div>
				<TeamsRail teams={teams ?? []} />
			</div>
		</>
	);
}

type TeamsRailProps = {
	teams: TeamRow[];
};
const TeamsRail = ({ teams }: TeamsRailProps) => {
	return (
		<div className="min-w-0 rounded-lg bg-card p-4">
			<h3 className="mb-3 font-bold text-sm">
				{t("Teams")}{" "}
				<span className="font-normal text-muted-foreground">
					· {teams.length}
				</span>
			</h3>
			<div className="flex flex-col gap-2">
				{teams.length === 0 ? (
					<div className="text-muted-foreground text-sm">
						{t("No teams found")}
					</div>
				) : (
					teams.map((team) => (
						<div key={team.id} className="rounded-md bg-muted/40 p-3">
							<div className="mb-1 flex items-center justify-between gap-2">
								<Link
									to="/teams/$teamId"
									params={{ teamId: team.id }}
									className="font-semibold text-sm"
								>
									{team.title}
								</Link>
								<TeamPlacementBadge team={team} />
							</div>
							<div className="text-muted-foreground text-xs">
								<TeamMeta team={team} />
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
};
