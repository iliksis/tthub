import { createFileRoute } from "@tanstack/react-router";
import { getFeedConfig } from "@/api/users";
import { CalendarFeed } from "@/components/settings/CalendarFeed";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/settings/feed")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: t("Calendar Feed Settings") }],
	}),
	loader: async () => {
		const response = await getFeedConfig();
		const result = await response.json();
		if (response.status >= 400) {
			return { error: result.message };
		}
		return { feedConfig: result.data };
	},
});

function RouteComponent() {
	const { feedConfig } = Route.useLoaderData();
	return (
		<CalendarFeed config={feedConfig?.config} feedId={feedConfig?.feedId} />
	);
}
