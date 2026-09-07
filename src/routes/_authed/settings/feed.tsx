import { createFileRoute } from "@tanstack/react-router";
import { getLabels } from "@/api/labels";
import { getFeedConfig } from "@/api/users";
import { CalendarFeed } from "@/components/settings/CalendarFeed";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_authed/settings/feed")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: m.settings_calendar_feed_settings() }],
	}),
	loader: async () => {
		// Independent fetches, run in parallel: a failure in either one
		// degrades that piece of the page without taking down the other.
		const [feedConfigResult, labelsResult] = await Promise.allSettled([
			getFeedConfig(),
			getLabels(),
		]);
		return {
			feedConfig:
				feedConfigResult.status === "fulfilled"
					? feedConfigResult.value.data
					: undefined,
			labels:
				labelsResult.status === "fulfilled"
					? (labelsResult.value.data ?? [])
					: [],
		};
	},
});

function RouteComponent() {
	const { feedConfig, labels } = Route.useLoaderData();
	return (
		<CalendarFeed
			config={feedConfig?.config}
			feedId={feedConfig?.feedId}
			labels={labels}
		/>
	);
}
