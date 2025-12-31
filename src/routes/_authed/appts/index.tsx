import { createFileRoute } from "@tanstack/react-router";
import { getAppointments } from "@/api/appointments";
import { Filters, filterSchema, List } from "@/components/appointments/List";
import { AppointmentType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";

// biome-ignore assist/source/useSortedKeys: validateSearch and loaderDeps need to be before loader
export const Route = createFileRoute("/_authed/appts/")({
	component: RouteComponent,
	validateSearch: filterSchema,
	loaderDeps: ({ search }) => ({ ...search }),
	loader: async ({ deps: { deleted, title, location } }) => {
		const data = await getAppointments({
			data: {
				location,
				orderBy: { startDate: "desc" },
				title,
				type: AppointmentType.TOURNAMENT,
				withDeleted: deleted,
			},
		});
		const response = await data.json();
		if (data.status < 400) {
			return { appointments: response.data };
		}
		throw new Error(response.message);
	},
	head: () => ({
		meta: [
			{
				title: t("Appointments"),
			},
		],
	}),
});

function RouteComponent() {
	const { appointments } = Route.useLoaderData();
	const search = Route.useSearch();

	if (!appointments) return <div>An Error occurred</div>;

	return (
		<>
			<Filters {...search} />
			<List appointments={appointments} />
		</>
	);
}
