import { createFileRoute } from "@tanstack/react-router";
import { Profile } from "@/components/Profile";

export const Route = createFileRoute("/_authed/settings/profile")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div>
			<Profile />
		</div>
	);
}
