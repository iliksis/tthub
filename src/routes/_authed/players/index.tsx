import { createFileRoute } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import { getPlayers } from "@/api/players";
import { getActiveSeason } from "@/api/seasons";
import { getTeams } from "@/api/teams";
import { CreatePlayer } from "@/components/players/CreatePlayer";
import {
	applyPlayerFilters,
	CommandBarFilters,
	filterSchema,
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
		const activeSeasonRes = await getActiveSeason();
		const [playersRes, teamsRes] = await Promise.all([
			getPlayers(),
			getTeams({ data: { seasonId: activeSeasonRes.data?.id } }),
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
			<div className="hidden lg:grid lg:grid-cols-[1fr_340px] lg:gap-10">
				<div className="min-w-0">
					<div className="mb-3 flex items-center gap-3">
						<div className="flex flex-1 items-baseline gap-2">
							<h1 className="font-bold text-lg">{t("Players")}</h1>
							<p className="text-muted-foreground text-sm">
								{t(
									"{0} of {1} players",
									filteredPlayers.length.toString(),
									players.length.toString(),
								)}
							</p>
						</div>
						<CreatePlayer />
					</div>
					<div className="mb-3">
						<CommandBarFilters {...search} teams={teams ?? []} />
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
		<div className="min-w-0">
			<div className="mb-3 flex items-center gap-2.5">
				<UsersIcon className="size-4 text-foreground" />
				<span className="font-bold text-xs uppercase tracking-wider">
					{t("Teams")}
				</span>
				<span className="h-px flex-1 bg-border" />
			</div>
			{teams.length === 0 ? (
				<div className="text-muted-foreground text-sm">
					{t("No teams found")}
				</div>
			) : (
				<div className="flex flex-col">
					{teams.map((team) => (
						<div
							key={team.id}
							className="flex items-center justify-between gap-2 border-border/60 border-b py-2.5 last:border-0"
						>
							<div className="min-w-0">
								<Link
									to="/teams/$teamId"
									params={{ teamId: team.id }}
									className="font-medium text-sm"
								>
									{team.title}
								</Link>
								<div className="text-muted-foreground text-xs">
									<TeamMeta team={team} />
								</div>
							</div>
							<TeamPlacementBadge team={team} />
						</div>
					))}
				</div>
			)}
		</div>
	);
};
