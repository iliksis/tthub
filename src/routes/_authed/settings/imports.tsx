import { createFileRoute } from "@tanstack/react-router";
import { Holiday } from "open-holiday-js";
import { HolidayImport } from "@/components/imports/HolidayImport";
import { MyTTImport } from "@/components/imports/MyTTImport";

export const Route = createFileRoute("/_authed/settings/imports")({
	component: RouteComponent,
	loader: async () => {
		const api = new Holiday();
		const countries = await api.getCountries();
		return {
			countries: countries.map((c) => ({
				title: c.name[0].text,
				code: c.isoCode,
			})),
		};
	},
	head: () => ({
		meta: [
			{
				title: "Imports",
			},
		],
	}),
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
