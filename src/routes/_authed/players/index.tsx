import { createFileRoute } from "@tanstack/react-router";
import { getPlayers } from "@/api/players";
import { CreatePlayer } from "@/components/players/CreatePlayer";
import { List } from "@/components/players/List";

export const Route = createFileRoute("/_authed/players/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Players" }],
	}),
	loader: async () => {
		const data = await getPlayers();
		const res = await data.json();
		if (data.status < 400) {
			return { players: res.data };
		}
		throw new Error(res.message);
	},
});

function RouteComponent() {
	const { players } = Route.useLoaderData();

	if (!players) return <div>An Error occurred</div>;

	return (
		<div>
			<List players={players} />
			<CreatePlayer />
		</div>
	);
}
