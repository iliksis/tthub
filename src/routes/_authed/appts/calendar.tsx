import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const calendarSearchSchema = z.object({
	month: z.number().int().min(0).max(11).optional(),
	year: z.number().int().optional(),
});

export const Route = createFileRoute("/_authed/appts/calendar")({
	beforeLoad: ({ search }) => {
		throw redirect({
			search: { month: search.month, view: "calendar", year: search.year },
			to: "/appts",
		});
	},
	validateSearch: calendarSearchSchema,
});
