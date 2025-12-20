import dayGridPlugin from "@fullcalendar/daygrid";
import FullCalendar from "@fullcalendar/react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getCalendarAppointments } from "@/api/appointments";

export const Route = createFileRoute("/_authed/appts/calendar")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Calendar" }],
	}),
});

function RouteComponent() {
	const router = useRouter();
	const getEvents = useServerFn(getCalendarAppointments);

	return (
		<FullCalendar
			events={async (info, success, failure) => {
				const res = await getEvents({
					data: { start: info.start, end: info.end },
				});

				const data = await res.json();
				if (res.status < 400) {
					success(data.data ?? []);
					return;
				}
				failure(new Error(data.message));
			}}
			plugins={[dayGridPlugin]}
			initialView="dayGridMonth"
			locale={"de"}
			firstDay={1}
			buttonText={{
				today: "Heute",
			}}
			dayCellContent={({ dayNumberText }) => {
				return (
					<div className="flex items-center justify-center">
						{dayNumberText}
					</div>
				);
			}}
			contentHeight={"600px"}
			displayEventTime={false}
			eventDisplay="block"
			eventClassNames="hover:cursor-pointer"
			eventClick={(info) => {
				router.navigate({
					to: "/appts/$apptId",
					params: { apptId: info.event.id },
				});
			}}
			eventContent={({ event }) => {
				return (
					<div className="tooltip tooltip-left" data-tip={event.title}>
						{event.extendedProps.shortTitle}
					</div>
				);
			}}
		/>
	);
}
