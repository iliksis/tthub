import { createFileRoute } from "@tanstack/react-router";
import { getAppointments } from "@/api/appointments";
import { Filters, filterSchema, List } from "@/components/appointments/List";
import { AppointmentType } from "@/lib/prisma/enums";

export const Route = createFileRoute("/_authed/appts/")({
	component: RouteComponent,
	validateSearch: filterSchema,
	loaderDeps: ({ search }) => ({ ...search }),
	loader: async ({ deps: { deleted, title } }) => {
		const data = await getAppointments({
			data: {
				type: AppointmentType.TOURNAMENT_BY,
				title,
				withDeleted: deleted,
				orderBy: { startDate: "desc" },
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
				title: "Appointments",
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
