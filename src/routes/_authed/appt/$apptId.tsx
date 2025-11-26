import { createFileRoute } from "@tanstack/react-router";
import { CalendarDaysIcon, Clock10Icon } from "lucide-react";
import type React from "react";
import { getAppointment } from "@/api/appointments";
import { AppointmentStatus } from "@/lib/prisma/enums";

export const Route = createFileRoute("/_authed/appt/$apptId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const data = await getAppointment({ data: { id: params.apptId } });
		const response = await data.json();
		if (data.status < 400) {
			return { appointment: response.data };
		}
		throw new Error(response.message);
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.appointment?.title,
			},
		],
	}),
});

function RouteComponent() {
	const { appointment } = Route.useLoaderData();
	if (!appointment) return <div>Appointment not found.</div>;

	const isMultipleDays =
		appointment.endDate !== null
			? new Date(appointment.startDate).getDate() !==
				new Date(appointment.endDate).getDate()
			: false;

	return (
		<div>
			{appointment?.status === AppointmentStatus.DRAFT && (
				<div role="alert" className="alert alert-warning alert-soft mb-4">
					<span>Appointment is still in draft.</span>
				</div>
			)}
			<div className="grid grid-cols-4 gap-2">
				<Card title="Date" icon={CalendarDaysIcon} gridRows={3}>
					<div className="flex flex-row">
						<p>
							{new Date(appointment.startDate).toLocaleDateString("de-DE", {
								dateStyle: "long",
							})}

							{isMultipleDays && appointment.endDate && (
								<>
									{" "}
									-{" "}
									{new Date(appointment.endDate).toLocaleDateString("de-DE", {
										dateStyle: "long",
									})}
								</>
							)}
						</p>
					</div>
				</Card>
				<Card title="Time" icon={Clock10Icon} gridRows={1}>
					<p>
						{new Date(appointment.startDate).toLocaleTimeString("de-DE", {
							timeStyle: "short",
						})}
					</p>
				</Card>
				<Card title="Location" icon={Clock10Icon} gridRows={4}>
					<p>{appointment.location || "No location set"}</p>
				</Card>
			</div>
		</div>
	);
}

type CardProps = {
	title: string;
	icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	gridRows?: number;
};
const Card = (props: React.PropsWithChildren<CardProps>) => {
	return (
		<div className={`card bg-base-200 col-span-${props.gridRows}`}>
			<div className="card-body p-4">
				<h2 className="card-title text-base">
					{props.icon && <props.icon className="my-1.5 size-4" />}
					{props.title}
				</h2>
				{props.children}
			</div>
		</div>
	);
};
