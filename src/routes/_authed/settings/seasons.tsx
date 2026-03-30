import { createFileRoute } from "@tanstack/react-router";
import { fetchSeasons } from "@/api/seasons";
import { Seasons } from "@/components/settings/Seasons";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/settings/seasons")({
	beforeLoad: async ({ context }) => {
		if (!context.user || context.user.role !== "ADMIN") {
			throw Error("Forbidden");
		}
	},
	component: RouteComponent,
	errorComponent: () => (
		<div className="alert alert-error">
			{t("You do not have permission to access seasons")}
		</div>
	),
	head: () => ({
		meta: [{ title: t("Seasons") }],
	}),
	loader: async () => {
		const seasons = await fetchSeasons();
		return { seasons };
	},
});

function RouteComponent() {
	const { seasons } = Route.useLoaderData();

	return <Seasons seasons={seasons} />;
}
