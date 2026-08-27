import { createFileRoute } from "@tanstack/react-router";
import { getSeasonsWithStats } from "@/api/seasons";
import { SeasonManagement } from "@/components/settings/SeasonManagement";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { m } from "@/paraglide/messages";

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
				{m.seasons_you_do_not_have_permission_to_access_season_settings()}
			</AlertDescription>
		</Alert>
	),
	head: () => ({
		meta: [{ title: m.common_seasons() }],
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
