import { createFileRoute, useRouter } from "@tanstack/react-router";
import { getAppointments } from "@/api/appointments";
import type { Appointment } from "@/lib/prisma/client";
import { AppointmentType } from "@/lib/prisma/enums";

export const Route = createFileRoute("/_authed/appts/")({
	component: RouteComponent,
	loader: async () => {
		const data = await getAppointments({
			data: { type: AppointmentType.TOURNAMENT_BY },
		});
		const response = await data.json();
		if (data.status < 400) {
			return { appointments: response.data };
		}
		throw new Error(response.message);
	},
});

function RouteComponent() {
	const { appointments } = Route.useLoaderData();
	const router = useRouter();

	if (!appointments || appointments.length === 0)
		return <div>No appointments found</div>;

	const onClickAppointment = (id: string) => async () => {
		await router.navigate({ to: "/appts/$apptId", params: { apptId: id } });
	};

	const renderRow = (appointment: Appointment) => {
		const isMultipleDays =
			appointment.endDate !== null
				? new Date(appointment.startDate).getDate() !==
					new Date(appointment.endDate).getDate()
				: false;

		return (
			<tr
				key={appointment.id}
				className="hover:bg-base-200 hover:cursor-pointer"
				onClick={onClickAppointment(appointment.id)}
			>
				<th>{appointment.shortTitle}</th>
				<th>
					{new Date(appointment.startDate).toLocaleDateString("de-DE", {
						day: "2-digit",
						month: "2-digit",
						year: "2-digit",
					})}{" "}
					{isMultipleDays && appointment.endDate && (
						<>
							{" "}
							-{" "}
							{new Date(appointment.endDate).toLocaleDateString("de-DE", {
								day: "2-digit",
								month: "2-digit",
								year: "2-digit",
							})}{" "}
						</>
					)}
				</th>
				<th>{appointment.location}</th>
			</tr>
		);
	};

	return (
		<div className="overflow-x-auto">
			<table className="table text-xs">
				<thead className="text-xs">
					<tr>
						<th>Title</th>
						<th>Date</th>
						<th>Location</th>
					</tr>
				</thead>
				<tbody>{appointments.map(renderRow)}</tbody>
			</table>
		</div>
	);
}
