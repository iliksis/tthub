import { createFileRoute } from "@tanstack/react-router";
import { Holiday } from "open-holiday-js";
import { HolidayImport } from "@/components/imports/HolidayImport";
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
	loader: async () => {
		const api = new Holiday();
		const countries = await api.getCountries();
		return {
			countries: countries.map((c) => ({
				code: c.isoCode,
				title: c.name[0].text,
			})),
		};
	},
});

function RouteComponent() {
	const { countries } = Route.useLoaderData();

	return (
		<>
			<HolidayImport countries={countries} />
			<Separator className="my-4" />
			<MyTTImport />
		</>
	);
}
