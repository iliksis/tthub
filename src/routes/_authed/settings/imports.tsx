import { createFileRoute } from "@tanstack/react-router";
import { getImporterSettings } from "@/api/imports";
import { ImporterAvailability } from "@/components/imports/ImporterAvailability";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { m } from "@/paraglide/messages";

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
					{m.imports_you_do_not_have_permission_to_access_import_settings()}
				</AlertDescription>
			</Alert>
		);
	},
	head: () => ({
		meta: [{ title: m.common_imports() }],
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
