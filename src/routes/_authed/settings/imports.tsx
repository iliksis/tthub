import { createFileRoute } from "@tanstack/react-router";
import { Holiday } from "open-holiday-js";
import { getAvailableImporters, getImporterSettings } from "@/api/imports";
import { HolidayImport } from "@/components/imports/HolidayImport";
import { ImporterAvailability } from "@/components/imports/ImporterAvailability";
import { MyTTImport } from "@/components/imports/MyTTImport";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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
		const api = new Holiday();
		const [countries, availableImportersRes, importerSettingsRes] =
			await Promise.all([
				api.getCountries(),
				getAvailableImporters(),
				context.user?.role === "ADMIN" ? getImporterSettings() : undefined,
			]);
		return {
			availableImporters: availableImportersRes.data,
			countries: countries.map((c) => ({
				code: c.isoCode,
				title: c.name[0].text,
			})),
			importerSettings: importerSettingsRes?.data,
		};
	},
});

function RouteComponent() {
	const { countries, availableImporters, importerSettings } =
		Route.useLoaderData();

	const holidayEnabled = availableImporters.some(
		(importer) => importer.id === "holiday",
	);

	return (
		<>
			{holidayEnabled && <HolidayImport countries={countries} />}
			<Separator className="my-4" />
			<MyTTImport />
			{importerSettings && (
				<>
					<Separator className="my-4" />
					<ImporterAvailability importers={importerSettings} />
				</>
			)}
		</>
	);
}
