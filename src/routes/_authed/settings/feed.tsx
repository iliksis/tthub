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
		try {
			const result = await getFeedConfig();
			return { feedConfig: result.data };
		} catch (err) {
			return { error: (err as Error).message };
		}
	},
});

function RouteComponent() {
	const { feedConfig } = Route.useLoaderData();
	return (
		<CalendarFeed config={feedConfig?.config} feedId={feedConfig?.feedId} />
	);
}
