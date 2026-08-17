import { createFileRoute } from "@tanstack/react-router";
import { getImporterSettings } from "@/api/imports";
import { ImporterAvailability } from "@/components/imports/ImporterAvailability";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/settings/imports")({
	beforeLoad: async ({ context }) => {
		if (
			!context.user ||
			(context.user.role !== "ADMIN" && context.user.role !== "EDITOR")
		) {
			throw Error("Forbidden");
		}
	},
	component: RouteComponent,
	errorComponent: () => {
		return (
			<Alert variant="destructive">
				<AlertDescription>
					{t("You do not have permission to access import settings")}
				</AlertDescription>
			</Alert>
		);
	},
	head: () => ({
		meta: [{ title: t("Imports") }],
	}),
	loader: async ({ context }) => {
		const isAdmin = context.user?.role === "ADMIN";
		const { data } = await getImporterSettings();
		return {
			canManage: isAdmin,
			importers: data,
		};
	},
});

function RouteComponent() {
	const { importers, canManage } = Route.useLoaderData();

	return <ImporterAvailability importers={importers} canManage={canManage} />;
}
