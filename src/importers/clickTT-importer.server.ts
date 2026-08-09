import { z } from "zod";
import { parseClickTTPdf } from "@/lib/clickTTpdf";
import type { ImporterDefinition } from "./types";

const configSchema = z.object({});

export const clickTTImporter = {
	configSchema,
	description: "Imports match schedules and standings from ClickTT.",
	id: "clickTT",
	name: "ClickTT",

	async run({ config, emit, log, setTotal }) {
		const res = await fetch(
			"https://bttv.click-tt.de/cgi-bin/WebObjects/nuLigaDokumentTTDE.woa/wa/nuDokument?dokument=ScheduleReportFOP&group=524271",
		);
		const data = await res.arrayBuffer();
		const { matches, standings } = await parseClickTTPdf(data);
		log(
			"info",
			`Parsed ${matches.length} matches and ${standings.length} standings`,
		);

		// let imported = 0;
		// let skipped = 0;
		// for (const holiday of [...schoolHolidays, ...publicHolidays]) {
		// 	const result = await emit({
		// 		appointmentType: AppointmentType.HOLIDAY,
		// 		endsAt: holiday.endDate.toISOString(),
		// 		externalId: holiday.id,
		// 		startsAt: holiday.startDate.toISOString(),
		// 		title: holiday.name[0].text,
		// 		type: "event",
		// 	});
		// 	if (result.status === "imported") {
		// 		imported++;
		// 	} else {
		// 		skipped++;
		// 	}
		// }

		// log("info", `Imported ${imported} holidays, skipped ${skipped}`);

		return { imported: 0, skipped: 0 };
	},
	version: "1.0.0",
} satisfies ImporterDefinition<typeof configSchema>;
