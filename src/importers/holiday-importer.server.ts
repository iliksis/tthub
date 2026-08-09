// src/importers/holiday-importer.server.ts
import { Holiday } from "open-holiday-js";
import { z } from "zod";
import { AppointmentType } from "@/lib/prisma/enums";
import type { ImporterDefinition } from "./types";

const configSchema = z.object({
	country: z.string().min(1),
	endDate: z.string().min(1),
	startDate: z.string().min(1),
	subdivision: z.string().optional(),
});

export const holidayImporter = {
	configSchema,
	description: "Imports public and school holidays from the Open Holidays API.",
	id: "holiday",
	name: "Holidays",

	async run({ config, emit, log }) {
		const { country, subdivision, startDate, endDate } =
			configSchema.parse(config);
		const api = new Holiday();

		const [schoolHolidays, publicHolidays] = await Promise.all([
			api.getSchoolHolidays(
				country,
				new Date(startDate),
				new Date(endDate),
				subdivision,
			),
			api.getPublicHolidays(
				country,
				new Date(startDate),
				new Date(endDate),
				subdivision,
			),
		]);

		let imported = 0;
		let skipped = 0;
		for (const holiday of [...schoolHolidays, ...publicHolidays]) {
			const result = await emit({
				appointmentType: AppointmentType.HOLIDAY,
				endsAt: holiday.endDate.toISOString(),
				externalId: holiday.id,
				startsAt: holiday.startDate.toISOString(),
				title: holiday.name[0].text,
				type: "event",
			});
			if (result.status === "imported") {
				imported++;
			} else {
				skipped++;
			}
		}

		log("info", `Imported ${imported} holidays, skipped ${skipped}`);

		return { imported, skipped };
	},
	version: "1.0.0",
} satisfies ImporterDefinition<typeof configSchema>;
