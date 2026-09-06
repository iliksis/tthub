import { createFileRoute } from "@tanstack/react-router";
import { getLabels } from "@/api/labels";
import { LabelManagement } from "@/components/settings/LabelManagement";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_authed/settings/labels")({
	beforeLoad: async ({ context }) => {
		if (
			!context.user ||
			(context.user.role !== "ADMIN" && context.user.role !== "EDITOR")
		) {
			throw Error("Forbidden");
		}
	},
	component: RouteComponent,
	errorComponent: () => (
		<Alert variant="destructive">
			<AlertDescription>
				{m.labels_you_do_not_have_permission_to_access_label_settings()}
			</AlertDescription>
		</Alert>
	),
	head: () => ({
		meta: [{ title: m.labels_labels() }],
	}),
	loader: async () => {
		const { data } = await getLabels();
		return { labels: data };
	},
});

function RouteComponent() {
	const { labels } = Route.useLoaderData();

	return <LabelManagement labels={labels} />;
}
