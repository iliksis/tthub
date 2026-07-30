import { createFileRoute } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import React from "react";
import { getPlayers } from "@/api/players";
import { getTeams } from "@/api/teams";
import { CreatePlayer } from "@/components/players/CreatePlayer";
import { List } from "@/components/players/List";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/players/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: t("Players") }],
	}),
	loader: async () => {
		const [playersData, teamsData] = await Promise.all([
			getPlayers(),
			getTeams(),
		]);
		const playersRes = await playersData.json();
		if (playersData.status >= 400) {
			throw new Error(playersRes.message);
		}
		const teamsRes = await teamsData.json();
		if (teamsData.status >= 400) {
			throw new Error(teamsRes.message);
		}
		return { players: playersRes.data, teams: teamsRes.data };
	},
});

function RouteComponent() {
	const { players, teams } = Route.useLoaderData();
	const [query, setQuery] = React.useState("");

	if (!players) return <div>{t("An Error occurred")}</div>;

	const filteredPlayers = query
		? players.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
		: players;

	return (
		<>
			{/* Mobile / tablet layout */}
			<div className="lg:hidden">
				<List players={players} />
				<CreatePlayer />
			</div>

			{/* Desktop layout: data-dense split view */}
			<div className="hidden lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
				<div className="min-w-0">
					<div className="mb-3 flex items-center gap-3">
						<h1 className="font-bold flex-1">
							{t("Players")}{" "}
							<span className="font-normal text-muted-foreground">
								· {players.length}
							</span>
						</h1>
						<div className="relative w-56">
							<SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
							<Input
								className="pl-8"
								placeholder={t("Search Players")}
								value={query}
								onChange={(e) => setQuery(e.target.value)}
							/>
						</div>
						<CreatePlayer />
					</div>
					<List players={filteredPlayers} />
				</div>
				<TeamsRail teams={teams ?? []} />
			</div>
		</>
	);
}

type TeamsRailProps = {
	teams: (Team & { _count: { players: number } })[];
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
								<span className="font-semibold text-sm">{team.title}</span>
								{team.placement && (
									<Badge variant="secondary" className="shrink-0">
										{team.placement}
									</Badge>
								)}
							</div>
							<div className="text-muted-foreground text-xs">
								{team.league}
								{team.league && " · "}
								{t("{0} players", team._count.players.toString())}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
};
