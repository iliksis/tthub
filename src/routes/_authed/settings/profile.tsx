import { createFileRoute } from "@tanstack/react-router";
import { Profile } from "@/components/Profile";

export const Route = createFileRoute("/_authed/settings/profile")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Settings",
			},
		],
	}),
});

function RouteComponent() {
	return (
		<div>
			<Profile />
		</div>
	);
}
