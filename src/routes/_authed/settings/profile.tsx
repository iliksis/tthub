import { createFileRoute } from "@tanstack/react-router";
import { Profile } from "@/components/Profile";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/settings/profile")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: t("Settings"),
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
