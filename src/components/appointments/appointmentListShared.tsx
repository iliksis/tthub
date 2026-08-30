import { z } from "zod";
import type { AppointmentWithSeason } from "@/api/appointments";
import type { DetailsListColumn } from "@/components/DetailsList";
import { Link as EntityLink } from "@/components/ui/link";
import { AppointmentType } from "@/lib/prisma/enums";
import { m } from "@/paraglide/messages";

export const BATCH_SIZE = 25;
export const ALL_SEASONS = "ALL";

export const appointmentTypeLabel: Record<AppointmentType, string> = {
	HOLIDAY: m.common_holiday(),
	TEAM_MATCH: m.common_team_matches(),
	TOURNAMENT: m.common_tournament(),
	TOURNAMENT_DE: m.common_tournament_germany(),
};

export const typeFilterOptions = Object.values(AppointmentType).map((type) => ({
	label: appointmentTypeLabel[type],
	value: type,
}));

export const appointmentFilterSearchSchema = z.object({
	query: z.string().optional(),
	seasonId: z.string().optional(),
	skip: z.number().int().nonnegative().optional(),
	types: z.array(z.nativeEnum(AppointmentType)).optional(),
});

function formatDate(date: Date | string) {
	return new Date(date).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "2-digit",
	});
}

export const appointmentListColumns: DetailsListColumn<AppointmentWithSeason>[] =
	[
		{
			key: "shortTitle",
			label: m.appointments_appointment(),
			render: (item) => (
				<EntityLink to="/appts/$apptId" params={{ apptId: item.id }}>
					{item.shortTitle}
				</EntityLink>
			),
		},
		{
			key: "type",
			label: m.appointments_type(),
			render: (item) => appointmentTypeLabel[item.type],
		},
		{
			key: "season",
			label: m.common_season(),
			render: (item) => item.season?.name ?? "—",
		},
		{
			key: "startDate",
			label: m.appointments_startdate(),
			render: (item) => formatDate(item.startDate),
		},
		{
			key: "location",
			label: m.appointments_location(),
			render: (item) => item.location ?? "—",
		},
	];
