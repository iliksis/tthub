import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAllSubscriptions } from "@/api/notifications";
import { Notifications } from "@/components/settings/Notifications";
import { Profile } from "@/components/settings/Profile";
import { Separator } from "@/components/ui/separator";
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
		try {
			const result = await getAllSubscriptions();
			return { subscriptions: result.data };
		} catch (err) {
			return { error: (err as Error).message };
		}
	},
	validateSearch: searchSchema,
});

function RouteComponent() {
	const { subscriptions } = Route.useLoaderData();
	return (
		<div className="flex flex-col gap-8">
			<Profile />
			<Separator className="border-border/60" />
			<Notifications subscriptions={subscriptions} />
		</div>
	);
}
