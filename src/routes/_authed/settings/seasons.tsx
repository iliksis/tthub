import { createFileRoute } from "@tanstack/react-router";
import { getSeasonsWithStats } from "@/api/seasons";
import { SeasonManagement } from "@/components/settings/SeasonManagement";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/settings/seasons")({
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
				{t("You do not have permission to access season settings")}
			</AlertDescription>
		</Alert>
	),
	head: () => ({
		meta: [{ title: t("Seasons") }],
	}),
	loader: async () => {
		const { data } = await getSeasonsWithStats();
		return { seasons: data };
	},
});

function RouteComponent() {
	const { seasons } = Route.useLoaderData();

	return <SeasonManagement seasons={seasons} />;
}
