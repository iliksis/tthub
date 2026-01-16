import { createFileRoute } from "@tanstack/react-router";
import { Holiday } from "open-holiday-js";
import { HolidayImport } from "@/components/imports/HolidayImport";
import { MyTTImport } from "@/components/imports/MyTTImport";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/settings/imports")({
	component: RouteComponent,
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
			<div className="divider"></div>
			<MyTTImport />
		</>
	);
}
