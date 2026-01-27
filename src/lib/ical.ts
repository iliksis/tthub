import Mustache from "mustache";
import type { Appointment } from "./prisma/client";

export class IcalGenerator {
	template: string = `BEGIN:VCALENDAR
CALSCALE:GREGORIAN
METHOD:PUBLISH
PRODID:-//TT Hub//EN
VERSION:2.0
{{#appointments}}
BEGIN:VEVENT
DTSTAMP:{{now}}
UID:{{id}}
DTSTART:{{start}}
{{#end}}
DTEND:{{end}}
{{/end}}
LOCATION:{{&location}}
SUMMARY:{{&title}}
END:VEVENT
{{/appointments}}
END:VCALENDAR`.replace(/\n/g, "\r\n");

	private _createIcalEvent(event: Appointment) {
		const start = this._createIcalDate(new Date(event.startDate));
		const end = event.endDate
			? this._createIcalDate(new Date(event.endDate))
			: undefined;
		const location = this._formatIcalEntry(event.location ?? "");
		const title = this._formatIcalEntry(event.title);

		return {
			end,
			id: event.id,
			location,
			now: this._createIcalDate(new Date()),
			start,
			title,
		};
	}

	private _formatIcalEntry(entry: string): string {
		if (entry.length <= 40) return entry;

		const part1 = entry.slice(0, 40);
		const part2 = entry.slice(40);

		return `${part1}\r\n ${this._formatIcalEntry(part2)}`;
	}

	private _createIcalDate(date: Date) {
		const year = date.getUTCFullYear();
		const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
		const day = date.getUTCDate().toString().padStart(2, "0");
		const hour = date.getUTCHours().toString().padStart(2, "0");
		const minute = date.getUTCMinutes().toString().padStart(2, "0");
		const second = date.getUTCSeconds().toString().padStart(2, "0");
		return `${year}${month}${day}T${hour}${minute}${second}Z`;
	}

	createAndDownloadIcalFile(...events: Appointment[]) {
		const now = Date.now();
		const ical = this.createIcalString(...events);
		const file = new Blob([ical], {
			type: "text/calendar",
		});
		const url = URL.createObjectURL(file);
		const link = document.createElement("a");
		link.href = url;
		link.download = `tthub-${now}.ics`;
		link.click();
	}

	createIcalString(...events: Appointment[]): string {
		return Mustache.render(this.template, {
			appointments: events.map((event) => this._createIcalEvent(event)),
		});
	}
}
