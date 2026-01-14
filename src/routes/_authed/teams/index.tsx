import { createFileRoute } from "@tanstack/react-router";
import { getTeams } from "@/api/teams";
import { CreateTeam } from "@/components/teams/CreateTeam";
import { List } from "@/components/teams/List";
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
		<div>
			<List teams={teams} />
			<CreateTeam />
		</div>
	);
}
