import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getLabels } from "@/api/labels";
import { getAllSubscriptions } from "@/api/notifications";
import { Notifications } from "@/components/settings/Notifications";
import { Profile } from "@/components/settings/Profile";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
	dev: z.boolean().optional(),
});

export const Route = createFileRoute("/_authed/settings/profile")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: m.common_settings() }],
	}),
	loader: async () => {
		// Independent fetches, run in parallel: a failure in either one
		// degrades that piece of the page without taking down the other (this
		// route previously guaranteed it never throws on a data-fetch failure —
		// Promise.all would drop that guarantee for whichever call rejects).
		const [labelsResult, subscriptionsResult] = await Promise.allSettled([
			getLabels(),
			getAllSubscriptions(),
		]);
		return {
			error:
				subscriptionsResult.status === "rejected"
					? (subscriptionsResult.reason as Error).message
					: undefined,
			labels:
				labelsResult.status === "fulfilled"
					? (labelsResult.value.data ?? [])
					: [],
			subscriptions:
				subscriptionsResult.status === "fulfilled"
					? subscriptionsResult.value.data
					: undefined,
		};
	},
	validateSearch: searchSchema,
});

function RouteComponent() {
	const { subscriptions, labels } = Route.useLoaderData();
	return (
		<div className="flex flex-col gap-8">
			<Profile />
			<Notifications subscriptions={subscriptions} labels={labels} />
		</div>
	);
}
