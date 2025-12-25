import dayGridPlugin from "@fullcalendar/daygrid";
import FullCalendar from "@fullcalendar/react";
import {
	createFileRoute,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getCalendarAppointments } from "@/api/appointments";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/appts/calendar")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: t("Calendar") }],
	}),
});

function RouteComponent() {
	const { theme } = useRouteContext({ from: "__root__" });
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
				today: t("Today"),
			}}
			buttonHints={{
				prev: t("Previous month"),
				next: t("Next month"),
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
			eventClassNames={cn(
				"hover:cursor-pointer tooltip",
				theme === "light" ? "latte" : "macchiato",
			)}
			eventClick={(info) => {
				router.navigate({
					to: "/appts/$apptId",
					params: { apptId: info.event.id },
				});
			}}
			eventDidMount={({ el, event }) => {
				el.setAttribute("data-tip", event.title);

				const isStartOfLine = event.start?.getDay() === 1;
				const isEndOfLine = event.end
					? event.end.getDay() === 0
					: event.start?.getDay() === 0;
				console.log(event.title, event.end?.getDate());
				const isLessThanTwoDays =
					(event?.end?.getTime() ?? 0) - (event?.start?.getTime() ?? 0) <
					86400000;
				if (isStartOfLine && !isEndOfLine && isLessThanTwoDays) {
					el.classList.add("tooltip-right");
				}
				if (isEndOfLine) {
					el.classList.add("tooltip-left");
				}
			}}
			// eventContent={({ event }) => {
			// 	return (
			// 		<div className="tooltip tooltip-left" data-tip={event.title}>
			// 			{event.extendedProps.shortTitle}
			// 		</div>
			// 	);
			// }}
		/>
	);
}
