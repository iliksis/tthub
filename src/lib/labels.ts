import type { catppuccinColorNames } from "@/lib/utils";

export type LabelColor = (typeof catppuccinColorNames)[number];

// Shared by every Appointment query across src/api/appointments.ts and
// src/routes/feed/$feedId.ts that needs an appointment's attached Labels in
// priority order (badge display order, and resolveTopPriorityLabel's color
// resolution for the calendar/iCal) — one place to change if that shape ever
// needs to, instead of the 7 call sites this used to be copy-pasted across.
export const labelsInclude = {
	include: { label: true },
	orderBy: { label: { priority: "asc" } },
} as const;
