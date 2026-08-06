import { createFileRoute, redirect } from "@tanstack/react-router";
import { getTeams } from "@/api/teams";

export const Route = createFileRoute("/_authed/prototypes/team-detail/")({
	loader: async () => {
		const res = await getTeams();
		const data = await res.json();
		const first = data.data?.[0];
		if (!first) {
			throw new Error("No teams to preview — create a team first.");
		}
		throw redirect({
			params: { teamId: first.id },
			to: "/prototypes/team-detail/$teamId",
		});
	},
});
