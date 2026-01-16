import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAllSubscriptions } from "@/api/notifications";
import { Notifications } from "@/components/settings/Notifications";
import { Profile } from "@/components/settings/Profile";
import { t } from "@/lib/text";

const searchSchema = z.object({
	dev: z.boolean().optional(),
});

export const Route = createFileRoute("/_authed/settings/profile")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: t("Settings") }],
	}),
	loader: async () => {
		const response = await getAllSubscriptions();
		const result = await response.json();
		if (response.status > 400) {
			return { error: result.message };
		}
		return { subscriptions: result.data };
	},
	validateSearch: searchSchema,
});

function RouteComponent() {
	const { subscriptions } = Route.useLoaderData();
	return (
		<div>
			<Profile />
			<div className="divider"></div>
			<Notifications subscriptions={subscriptions} />
		</div>
	);
}
