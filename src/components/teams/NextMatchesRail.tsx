import type { AppointmentWithResponses } from "@/api/appointments";
import { Link } from "@/components/ui/link";
import { t } from "@/lib/text";

type NextMatchesRailProps = {
	appointments: AppointmentWithResponses[];
	limit?: number;
	onShowAll: () => void;
};

function formatDay(date: Date | string) {
	return new Date(date).toLocaleDateString("de-DE", { day: "2-digit" });
}

function formatMonth(date: Date | string) {
	return new Date(date).toLocaleDateString("de-DE", { month: "short" });
}

function formatWeekdayDate(date: Date | string) {
	return new Date(date).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "short",
		weekday: "short",
	});
}

export function NextMatchesRail({
	appointments,
	limit = 3,
	onShowAll,
}: NextMatchesRailProps) {
	const now = Date.now();
	const upcoming = appointments
		.filter((a) => new Date(a.startDate).getTime() >= now)
		.slice(0, limit);

	if (upcoming.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{t("No upcoming matches")}
			</div>
		);
	}

	return (
		<div className="rounded-lg bg-card p-1">
			{upcoming.map((appointment) => (
				<Link
					key={appointment.id}
					to="/appts/$apptId"
					params={{ apptId: appointment.id }}
					className="flex items-center gap-2.5 border-border/60 border-b p-2.5 last:border-b-0"
				>
					<div className="flex w-9 shrink-0 flex-col items-center rounded-md bg-muted/60 px-2 py-1 text-xs leading-tight">
						<span className="font-bold text-sm">
							{formatDay(appointment.startDate)}
						</span>
						<span>{formatMonth(appointment.startDate)}</span>
					</div>
					<div className="min-w-0 flex-1">
						<div className="truncate font-medium text-[12.5px]">
							{appointment.shortTitle}
						</div>
						<div className="truncate text-muted-foreground text-xs">
							{formatWeekdayDate(appointment.startDate)}
							{appointment.location && ` · ${appointment.location}`}
						</div>
					</div>
				</Link>
			))}
			<div className="p-2 pt-1.5">
				<button
					type="button"
					onClick={onShowAll}
					className="text-primary text-xs hover:underline"
				>
					{t("All matches")} →
				</button>
			</div>
		</div>
	);
}
