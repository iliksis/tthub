import type { AppointmentWithResponses } from "@/api/appointments";
import { t } from "@/lib/text";
import { Card } from "../appointments/Card";

type NextMatchesRailProps = {
	appointments: AppointmentWithResponses[];
	limit?: number;
	onShowAll: () => void;
};

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
		<div className="flex flex-col gap-2.5">
			{upcoming.map((appointment) => (
				<Card key={appointment.id} appointment={appointment} />
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
