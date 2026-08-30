import { z } from "zod";
import type { AppointmentWithSeason } from "@/api/appointments";
import type { DetailsListColumn } from "@/components/DetailsList";
import { Button } from "@/components/ui/button";
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

// Shared between /appts/bulk and /appts/trash — both list pages support the
// same "select all N matching filters" flow, so the status bar communicating
// the current selection is identical between them.
export function SelectionStatusBar({
	matchedTotal,
	selectAllMatching,
	excludeCount,
	selectedCount,
	onExitSelectAllMatching,
	onEnterSelectAllMatching,
}: {
	matchedTotal: number;
	selectAllMatching: boolean;
	excludeCount: number;
	selectedCount: number;
	onExitSelectAllMatching: () => void;
	onEnterSelectAllMatching: () => void;
}) {
	if (matchedTotal === 0) return null;

	return (
		<div className="flex flex-wrap items-center gap-2 text-sm">
			{selectAllMatching ? (
				<>
					<span className="text-muted-foreground">
						{excludeCount > 0
							? m.appointments_n_matching_excluded({
									param1: selectedCount.toString(),
									param2: excludeCount.toString(),
								})
							: m.appointments_n_matching_selected_count({
									count: selectedCount,
								})}
					</span>
					<Button
						type="button"
						variant="link"
						size="sm"
						className="h-auto p-0"
						onClick={onExitSelectAllMatching}
					>
						{m.common_clear_selection()}
					</Button>
				</>
			) : (
				<>
					{selectedCount > 0 && (
						<span className="text-muted-foreground">
							{m.appointments_appointment_selected_count({
								count: selectedCount,
							})}
						</span>
					)}
					<Button
						type="button"
						variant="link"
						size="sm"
						className="h-auto p-0"
						onClick={onEnterSelectAllMatching}
					>
						{m.appointments_select_all_n_matching_filters({
							param1: matchedTotal.toString(),
						})}
					</Button>
				</>
			)}
		</div>
	);
}
