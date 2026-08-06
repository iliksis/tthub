import { createFileRoute } from "@tanstack/react-router";
import { getTeams } from "@/api/teams";
import { CreateTeam } from "@/components/teams/CreateTeam";
import { List } from "@/components/teams/List";
import { TeamsSplitView } from "@/components/teams/TeamsSplitView";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/teams/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: t("Teams") }],
	}),
	loader: async () => {
		const data = await getTeams();
		const res = await data.json();
		if (data.status < 400) {
			return { teams: res.data };
		}
		throw new Error(res.message);
	},
});

function RouteComponent() {
	const { teams } = Route.useLoaderData();

	if (!teams) return <div>{t("An Error occurred")}</div>;

	return (
		<>
			{/* Mobile / tablet layout */}
			<div className="lg:hidden">
				<List teams={teams} />
				<CreateTeam />
			</div>

			{/* Desktop layout: master-detail split view */}
			<div className="hidden lg:flex lg:flex-col lg:gap-4">
				<div className="flex items-center gap-3">
					<h1 className="flex-1 font-bold text-lg">
						{t("Teams")}{" "}
						<span className="font-normal text-muted-foreground text-sm">
							· {teams.length}
						</span>
					</h1>
					<CreateTeam />
				</div>
				<TeamsSplitView teams={teams} />
			</div>
		</>
	);
}
