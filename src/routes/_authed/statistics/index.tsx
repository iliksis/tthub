import { createFileRoute } from "@tanstack/react-router";
import { getStatistics } from "@/api/statistics";
import { Overview } from "@/components/statistics/Overview";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/statistics/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: t("Statistics") }],
	}),
	loader: async () => {
		const data = await getStatistics();
		const response = await data.json();
		if (data.status < 400 && response.data) {
			return { statistics: response.data };
		}

		throw new Error(response.message);
	},
});

function RouteComponent() {
	const { statistics } = Route.useLoaderData();

	if (!statistics) return <div>{t("An Error occurred")}</div>;

	return <Overview statistics={statistics} />;
}
